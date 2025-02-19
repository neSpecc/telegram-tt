import type { BlockToken } from './entities/Token';

export class BlockTokenizer {
  private pos = 0;
  private blocks: BlockToken[] = [];
  private currentBlock: BlockToken | null = null;

  constructor(private readonly text: string) {
    /**
     * Normalize line endings to ensure consistent parsing
     * This handles both Windows (\r\n) and Unix (\n) line endings
     */
    this.text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  public tokenize(): BlockToken[] {
    while (this.pos < this.text.length) {
      if (this.text.startsWith('```', this.pos)) {
        this.flushCurrentBlock();
        this.handlePreBlock();
        continue;
      }

      if (this.isLineStart() && this.text.startsWith('>', this.pos)) {
        this.flushCurrentBlock();
        this.handleQuoteBlock();
        continue;
      }

      const char = this.text[this.pos];

      if (char === '\n') {
        if (this.pos === 0) {
          this.beginParagraph();
        }

        const isRightBeforeBlock = this.isRightBeforeBlock(this.pos + 1);

        this.flushCurrentBlock();

        /**
         * Create new paragraph if either:
         *    - Next char is not a newline OR
         *    - Next char is newline but followed by block
         */
        if (!isRightBeforeBlock || this.text[this.pos + 1] === '\n') {
          this.beginParagraph();
        }

        this.pos++;
        continue;
      }

      if (!this.currentBlock) {
        this.beginParagraph();
      }

      this.addCharacterToCurrentParagraph(char);
      this.pos++;
    }

    this.flushCurrentBlock();
    return this.blocks;
  }

  private beginParagraph() {
    this.currentBlock = {
      type: 'paragraph',
      raw: '',
      content: '',
      tokens: [],
    };
  }

  private addCharacterToCurrentParagraph(char: string) {
    if (!this.currentBlock) {
      throw new Error('Failed to addCharacterToCurrentParagraph: no current block');
    }

    this.currentBlock.raw += char;
    this.currentBlock.content += char;
  }

  private flushCurrentBlock() {
    if (this.currentBlock) {
      this.blocks.push(this.currentBlock);
      this.currentBlock = null;
    }
  }

  private handlePreBlock() {
    const startPos = this.pos;
    this.pos += 3;

    let language = '';
    while (this.pos < this.text.length && this.text[this.pos] !== '\n') {
      language += this.text[this.pos];
      this.pos++;
    }
    this.pos++;

    const contentStart = this.pos;
    let contentEnd = this.pos;
    let closed = false;

    while (this.pos < this.text.length) {
      // Check for closing ``` only at start of line
      if (this.isLineStart() && this.text.startsWith('```', this.pos)) {
        closed = true;
        break;
      }
      if (this.text[this.pos] === '\n' && this.isLineStart(this.pos + 1) && this.text.startsWith('```', this.pos + 1)) {
        // Don't include trailing newline before closing ```
        const prevChar = this.text[this.pos - 1];
        if (prevChar === '\n') {
          contentEnd = this.pos + 1;
        }
        else {
          contentEnd = this.pos;
        }
        closed = true;
      }
      else {
        contentEnd = this.pos + 1;
      }
      this.pos++;
    }

    const content = this.text.slice(contentStart, contentEnd);

    // Include closing ```
    if (closed && this.text.startsWith('```', this.pos)) {
      this.pos += 3;
    }

    const raw = this.text.slice(startPos, this.pos);

    this.blocks.push({
      type: 'pre',
      raw,
      content,
      language: language || undefined,
      closed,
      tokens: [],
    });
  }

  private handleQuoteBlock() {
    const startPos = this.pos;
    let content = '';
    let contentEnd = this.pos;

    // Skip initial '>'
    this.pos += 1;
    contentEnd = this.pos; // Include '>' in raw even for empty quotes

    // Process until end of line or end of text
    while (this.pos < this.text.length && this.text[this.pos] !== '\n') {
      content += this.text[this.pos] ?? '';
      contentEnd = this.pos + 1;
      this.pos++;
    }

    const raw = this.text.slice(startPos, contentEnd);

    this.blocks.push({
      type: 'quote',
      raw,
      content,
      tokens: [],
    });

    // Handle newline after quote
    if (this.pos < this.text.length && this.text[this.pos] === '\n') {
      this.pos++; // Skip newline

      // If next char is newline or we're at end of text, create empty paragraph
      if (this.pos >= this.text.length || this.text[this.pos] === '\n') {
        this.beginParagraph();
        this.flushCurrentBlock();
      }
      // Otherwise let main tokenizer handle any text
    }
  }

  private isLineStart(pos?: number): boolean {
    pos = pos ?? this.pos;
    return pos === 0 || this.text[pos - 1] === '\n';
  }

  private isRightBeforeBlock(pos: number): boolean {
    // Skip whitespace
    while (pos < this.text.length && this.text[pos] === '\n') {
      pos++;
    }

    // Check if next non-whitespace char starts a block
    return (
      this.text.startsWith('>', pos)
      || this.text.startsWith('```', pos)
    );
  }
}
