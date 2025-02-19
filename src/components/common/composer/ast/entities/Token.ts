export type BlockToken = ParagraphToken | QuoteToken | PreToken;
export interface ParagraphToken extends BlockTokenBase {}
export interface QuoteToken extends BlockTokenBase {}
export interface PreToken extends BlockTokenBase {
  language?: string;
  closed: boolean;
}
export interface BlockTokenBase {
  type: 'paragraph' | 'quote' | 'pre';
  /**
   * Including markdown syntax.
   */
  raw: string;
  /**
   * Excluding markdown syntax.
   */
  content: string;
  tokens: InlineToken[];
}

export type InlineToken =
  | TextToken
  | BoldToken
  | ItalicToken
  | UnderlineToken
  | StrikethroughToken
  | MonospaceToken
  | SpoilerToken
  | LinkToken
  | LinkCloseToken
  | MentionToken
  | CustomEmojiToken;

export interface InlineTokenBase {
  type: string;
  raw: string;
}

export interface TextToken extends InlineTokenBase {
  type: 'text';
  value: string;
}

export interface BoldToken extends InlineTokenBase {
  type: 'bold';
}

export interface ItalicToken extends InlineTokenBase {
  type: 'italic';
}

export interface UnderlineToken extends InlineTokenBase {
  type: 'underline';
}

export interface StrikethroughToken extends InlineTokenBase {
  type: 'strikethrough';
}

export interface MonospaceToken extends InlineTokenBase {
  type: 'monospace';
  value: string;
}

export interface LinkToken extends InlineTokenBase {
  type: 'link';
  value: string;
}

export interface LinkCloseToken extends InlineTokenBase {
  type: 'link-close';
}

export interface MentionToken extends InlineTokenBase {
  type: 'mention';
  userId: string;
  value: string;
}

export interface SpoilerToken extends InlineTokenBase {
  type: 'spoiler';
}

export interface CustomEmojiToken extends InlineTokenBase {
  type: 'customEmoji';
  value: string;
  documentId: string;
}
