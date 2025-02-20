import type { ApiFormattedText } from './ast/ApiFormattedText';
import type { ASTFormattingInlineNodeBase, ASTFormattingNode } from './ast/entities/ASTNode';

export interface LinkFormattingOptions {
  href?: string;
  start?: number;
  end?: number;
}

export type FormatOperation = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'link' | 'monospace' | 'spoiler';

export interface TextEditorApi {
  setContent: (formattedText: ApiFormattedText | undefined) => void;
  getCaretOffset: () => { start: number; end: number };
  setCaretOffset: (offset: number) => void;
  focus: () => void;
  insert: (text: string, offset: number) => void;
  getMarkdown: () => string;
  replace: (start: number, end: number, text: string) => void;
  getLeftSlice: () => string;
  deleteLastSymbol: () => void;
  format: (formatting: FormatOperation, options?: LinkFormattingOptions) => void;
  getActiveFormattingsForRange: () => ASTFormattingInlineNodeBase['type'][];
  getFormattingNodes: () => ASTFormattingNode[];
  updateFormattingNode: (id: string, options?: { href: string }) => void;
}
