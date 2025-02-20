import type { InlineToken } from './entities/Token';

const inlineRegex = {
  underlineMarker: /^<u>|^<\/u>/,
  strikethroughMarker: /^~~/,
  monospaceMarker: /^`([^`]+)`/, // Match content between backticks
  mention: /^\[([^\]]+)\]\(id:([^)\s]+)\)/,
  link: /^\[([^\]]+)\]\((?!(?:id|doc):)([^)]+)\)/, // Negative lookahead to exclude mentions and emojis
  escape: /^\\([*`~[\]\\])/, // Match backslash followed by special character
  spoilerMarker: /^\|\|/, // Add spoiler marker pattern
  customEmoji: /^\[([^\]]+)\]\(doc:([^)]+)\)/, // Match custom emoji format
};

export class InlineTokenizer {
  private pos = 0;

  private currentText = '';

  private tokens: InlineToken[] = [];

  private formatStack: Array<'bold' | 'italic'> = [];

  constructor(private readonly text: string, private readonly isRich: boolean = true) {
  }

  public tokenize(isPlainText = false): InlineToken[] {
    while (this.pos < this.text.length) {
      const remaining = this.text.slice(this.pos);

      // If not rich mode, only handle text and custom emoji
      if (!this.isRich && !isPlainText) {
        const customEmojiMatch = remaining.match(inlineRegex.customEmoji);
        if (customEmojiMatch) {
          this.handleCustomEmoji(customEmojiMatch);
          this.pos += customEmojiMatch[0].length;
          continue;
        }

        // Treat everything else as plain text
        this.currentText += this.text[this.pos];
        this.pos++;
        continue;
      }

      // Rich mode - handle all tokens
      if (isPlainText) {
        this.tokens.push({ type: 'text', value: remaining, raw: remaining });
        this.pos = this.text.length;
        continue;
      }

      const escapeMatch = remaining.match(inlineRegex.escape);
      if (escapeMatch) {
        this.currentText += escapeMatch[1];
        this.pos += 2;
        continue;
      }

      /**
       * Special case for *** sequence (italic inside bold)
       */
      if (remaining.startsWith('***')) {
        this.flushText();
        if (this.formatStack.length === 0) {
          // Opening: bold then italic
          this.tokens.push({ type: 'bold', raw: '**' });
          this.tokens.push({ type: 'italic', raw: '*' });
          this.formatStack.push('bold', 'italic');
        } else {
          // Closing: italic then bold
          if (this.formatStack.includes('italic')) {
            this.tokens.push({ type: 'italic', raw: '*' });
          }
          if (this.formatStack.includes('bold')) {
            this.tokens.push({ type: 'bold', raw: '**' });
          }
          this.formatStack = [];
        }
        this.pos += 3;
        continue;
      }

      if (remaining.startsWith('**') && !remaining.startsWith('***')) {
        this.flushText();
        this.tokens.push({ type: 'bold', raw: '**' });
        this.formatStack.push('bold');
        this.pos += 2;
        continue;
      }

      if (remaining.startsWith('*') && !remaining.startsWith('**')) {
        this.flushText();
        this.tokens.push({ type: 'italic', raw: '*' });
        this.formatStack.push('italic');
        this.pos += 1;
        continue;
      }

      const underlineMatch = remaining.match(inlineRegex.underlineMarker);
      if (underlineMatch) {
        const marker = underlineMatch[0];
        if (marker === '<u>') {
          const closeTagIndex = this.text.indexOf('</u>', this.pos);
          if (closeTagIndex === -1) {
            // No closing tag found, treat as plain text
            this.currentText += marker;
            this.pos += marker.length;
          } else {
            this.handleFormatting('underline', marker);
            this.pos += marker.length;
          }
        } else {
          const textBefore = this.text.slice(0, this.pos);
          const openTagCount = (textBefore.match(/<u>/g) || []).length;
          const closeTagCount = (textBefore.match(/<\/u>/g) || []).length;

          if (openTagCount > closeTagCount) {
            // We have an unclosed opening tag, handle closing tag
            this.handleFormatting('underline', marker);
            this.pos += marker.length;
          } else {
            // No matching opening tag, treat as plain text
            this.currentText += marker;
            this.pos += marker.length;
          }
        }
        continue;
      }

      const monospaceMatch = remaining.match(inlineRegex.monospaceMarker);
      if (monospaceMatch) {
        this.handleMonospace(monospaceMatch);
        this.pos += monospaceMatch[0].length;
        continue;
      }

      const linkMatch = remaining.match(inlineRegex.link);
      if (linkMatch) {
        this.handleLink(linkMatch);
        this.pos += linkMatch[0].length;
        continue;
      }

      const customEmojiMatch = remaining.match(inlineRegex.customEmoji);
      if (customEmojiMatch) {
        this.handleCustomEmoji(customEmojiMatch);
        this.pos += customEmojiMatch[0].length;
        continue;
      }

      const mentionMatch = remaining.match(inlineRegex.mention);
      if (mentionMatch) {
        this.handleMention(mentionMatch);
        this.pos += mentionMatch[0].length;
        continue;
      }

      const strikeMatch = remaining.match(inlineRegex.strikethroughMarker);
      if (strikeMatch) {
        this.handleFormatting('strikethrough', strikeMatch[0]);
        this.pos += 2; // Skip ~~
        continue;
      }

      const spoilerMatch = remaining.match(inlineRegex.spoilerMarker);
      if (spoilerMatch) {
        this.handleFormatting('spoiler', spoilerMatch[0]);
        this.pos += 2; // Skip ||
        continue;
      }

      this.currentText += this.text[this.pos];
      this.pos++;
    }

    this.flushText();

    return this.tokens;
  }

  private handleFormatting(type: string, marker: string): void {
    this.flushText();
    this.tokens.push({
      type: type as any,
      raw: marker,
    });
  }

  private handleMonospace(match: RegExpMatchArray): void {
    this.flushText();
    this.tokens.push({
      type: 'monospace',
      value: match[1],
      raw: match[0],
    });
  }

  private handleMention(match: RegExpMatchArray): void {
    this.flushText();
    const [raw, username, userId] = match;

    this.tokens.push({
      type: 'mention',
      raw,
      userId,
      value: username,
    });
  }

  private handleLink(match: RegExpMatchArray): void {
    this.flushText();

    this.tokens.push({
      type: 'link',
      value: match[2],
      raw: match[0],
    });

    this.tokens.push({
      type: 'text',
      value: match[1],
      raw: match[1],
    });

    this.tokens.push({
      type: 'link-close',
      raw: '',
    });
  }

  private handleCustomEmoji(match: RegExpMatchArray): void {
    this.flushText();
    const [raw, emoji, documentId] = match;

    this.tokens.push({
      type: 'customEmoji',
      value: emoji,
      documentId,
      raw,
    });
  }

  private flushText(): void {
    if (this.currentText) {
      this.tokens.push({
        type: 'text',
        value: this.currentText,
        raw: this.currentText,
      });
      this.currentText = '';
    }
  }
}
