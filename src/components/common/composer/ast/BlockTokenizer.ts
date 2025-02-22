import type { BlockToken } from './entities/Token';

export class BlockTokenizer {
  private pos = 0;

  private blocks: BlockToken[] = [];

  // eslint-disable-next-line no-null/no-null
  private currentBlock: BlockToken | null = null;

  constructor(private readonly text: string, private readonly options: { isSingleLine?: boolean } = {}) {
    /**
     * Normalize line endings to ensure consistent parsing
     * This handles both Windows (\r\n) and Unix (\n) line endings
     */
    this.text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  public tokenize(): BlockToken[] {
    if (this.options.isSingleLine) {
      return this.tokenizeSingleLine();
    }

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

        this.flushCurrentBlock();

        /**
         * Create new paragraph if either:
         *    - Next char is not a newline OR
         *    - Next char is newline but followed by block
         */
        const isRightBeforeBlock = this.isRightBeforeBlock(this.pos + 1);

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

  private tokenizeSingleLine(): BlockToken[] {
    // Create single paragraph with all content
    const content = this.text
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' '); // Normalize multiple spaces

    return [{
      type: 'paragraph',
      raw: content,
      content,
      tokens: [],
    }];
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
      // eslint-disable-next-line no-null/no-null
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
        } else {
          contentEnd = this.pos;
        }
        closed = true;
      } else {
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

    this.pos++;

    if (this.pos < this.text.length && this.text[this.pos] === '\n') {
      const nextNextChar = this.text[this.pos + 1] ?? '';
      if (this.pos + 1 >= this.text.length || nextNextChar === '\n') {
        const raw = this.text.slice(startPos, this.pos); // '>'
        this.blocks.push({
          type: 'quote',
          raw,
          content: '',
          tokens: [],
        });

        this.pos++;

        const leftPart = this.text.slice(0, this.pos);
        const rightPart = this.text.slice(this.pos + 1);

        /**
         * Case >\n\n1
         * — should not create empty paragraph when there is next block
         */
        const isQuoteEndingBeforeBlock = leftPart.endsWith('>\n') && rightPart;

        if (isQuoteEndingBeforeBlock) {
          return;
        }

        this.beginParagraph();
        this.flushCurrentBlock();
        return;
      }
    }

    let content = '';
    let rawEnd = this.pos;

    while (this.pos < this.text.length) {
      const lineStart = this.pos;
      let lineEnd = this.text.indexOf('\n', this.pos);
      if (lineEnd === -1) {
        lineEnd = this.text.length;
      }

      content += this.text.slice(lineStart, lineEnd);
      this.pos = lineEnd;
      rawEnd = this.pos;

      if (this.pos >= this.text.length) {
        break;
      }

      const nextChar = this.text[this.pos + 1] ?? '';
      this.pos++;

      if (
        this.pos < this.text.length
        && (nextChar === '\n'
          || this.text.startsWith('>', this.pos)
          || this.text.startsWith('```', this.pos))
      ) {
        break;
      }

      content += '\n';
      rawEnd = this.pos;

      if (
        this.isLineStart()
        && (this.text.startsWith('>', this.pos)
          || this.text.startsWith('```', this.pos))
      ) {
        break;
      }
    }

    const raw = this.text.slice(startPos, rawEnd);

    this.blocks.push({
      type: 'quote',
      raw,
      content,
      tokens: [],
    });
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
