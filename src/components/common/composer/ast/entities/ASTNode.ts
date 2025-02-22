export type ASTNode = ASTRootNode | ASTInlineNode | ASTBlockNode;

export interface ASTRootNode extends ASTNodeBase {
  type: 'root';
  children: ASTNode[];
  lastModified?: number;
}

export type ASTInlineNode = ASTTextNode
| ASTFormattingNode
| ASTMentionNode
| ASTCustomEmojiNode
| ASTLineBreakNode;

export type ASTFormattingNode =
  | ASTBoldNode
  | ASTItalicNode
  | ASTUnderlineNode
  | ASTStrikethroughNode
  | ASTMonospaceNode
  | ASTSpoilerNode
  | ASTLinkNode;
export type ASTBlockNode = ASTParagraphBlockNode | ASTQuoteBlockNode | ASTPreBlockNode;

export interface ASTQuoteBlockNode extends ASTBlockNodeBase {
  type: 'quote';
  children: ASTInlineNode[];
}
export interface ASTPreBlockNode extends ASTBlockNodeBase {
  type: 'pre';
  language?: string;
  value: string;
  closed: boolean;
}
export interface ASTParagraphBlockNode extends ASTBlockNodeBase {
  type: 'paragraph';
  children: ASTInlineNode[];
}
export interface ASTBlockNodeBase extends ASTNodeBase {
}

export interface ASTTextNode extends ASTNodeBase {
  type: 'text';
  value: string;
}

export interface ASTBoldNode extends ASTFormattingInlineNodeBase {
  type: 'bold';
}
export interface ASTItalicNode extends ASTFormattingInlineNodeBase {
  type: 'italic';
}
export interface ASTUnderlineNode extends ASTFormattingInlineNodeBase {
  type: 'underline';
}

export interface ASTStrikethroughNode extends ASTFormattingInlineNodeBase {
  type: 'strikethrough';
}

export interface ASTMonospaceNode extends ASTFormattingInlineNodeBase {
  type: 'monospace';
  value: string;
}

export interface ASTSpoilerNode extends ASTFormattingInlineNodeBase {
  type: 'spoiler';
}

export interface ASTLinkNode extends ASTFormattingInlineNodeBase {
  type: 'link';
  href: string;
}

export interface ASTMentionNode extends ASTInlineNodeBase {
  type: 'mention';
  userId: string;
}

export interface ASTCustomEmojiNode extends ASTInlineNodeBase {
  type: 'customEmoji';
  documentId: string;
}

export interface ASTLineBreakNode extends ASTNodeBase {
  type: 'line-break';
}

export interface ASTInlineNodeBase extends ASTNodeBase {
  type: string;
  value: string;
}

export interface ASTFormattingInlineNodeBase extends ASTNodeBase {
  type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'monospace' | 'spoiler' | 'link';
  children?: ASTNode[];
  closed?: boolean;
}

export interface ASTNodeBase {
  type: string;
  raw: string;
  id?: string;
}
