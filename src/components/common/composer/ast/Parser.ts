import type {
  ASTBlockNode,
  ASTCustomEmojiNode,
  ASTFormattingNode,
  ASTInlineNode,
  ASTLineBreakNode,
  ASTLinkNode,
  ASTMentionNode,
  ASTMonospaceNode,
  ASTNode,
  ASTParagraphBlockNode,
  ASTPreBlockNode,
  ASTQuoteBlockNode,
  ASTTextNode,
} from './entities/ASTNode';
import type { BlockToken, InlineToken, PreToken } from './entities/Token';

import { getClosingMarker, getOpeningMarker } from '../helpers/getFocusedNode';

/**
 * Recursive Descent Parsing
 */
export class Parser {
  private tokens: BlockToken[];

  private pos = 0;

  constructor(tokens: BlockToken[]) {
    this.tokens = tokens;
  }

  public parse(): ASTNode {
    const blocks: ASTBlockNode[] = [];

    // Process each block token
    while (this.pos < this.tokens.length) {
      const block = this.tokens[this.pos];

      switch (block.type) {
        case 'paragraph': {
          blocks.push(this.parseParagraphBlock(block));
          break;
        }
        case 'quote': {
          blocks.push(this.parseQuoteBlock(block));
          break;
        }
        case 'pre': {
          blocks.push(this.parsePreBlock(block as PreToken));
          break;
        }
      }
      this.pos++;
    }

    return {
      type: 'root',
      raw: blocks.map((block) => block.raw).join('\n'),
      children: blocks,
    };
  }

  private assingNodeIds(node: ASTNode): ASTNode {
    if ('children' in node && Array.isArray(node.children)) {
      node.children.forEach((child) => this.assingNodeIds(child));
    }
    return node;
  }

  private parseParagraphBlock(block: BlockToken): ASTParagraphBlockNode {
    return {
      type: 'paragraph',
      raw: block.raw,
      children: this.buildInlineTree(block.tokens),
    };
  }

  private parseQuoteBlock(block: BlockToken): ASTQuoteBlockNode {
    return {
      type: 'quote',
      raw: block.raw,
      children: this.buildInlineTree(block.tokens),
    };
  }

  // eslint-disable-next-line class-methods-use-this
  private parsePreBlock(block: PreToken): ASTPreBlockNode {
    return {
      type: 'pre',
      raw: block.raw,
      value: block.content,
      language: block.language,
      closed: block.closed,
    };
  }

  private buildInlineTree(tokens: InlineToken[]): ASTInlineNode[] {
    const result: ASTInlineNode[] = [];
    const stack: ASTInlineNode[] = [];

    for (const token of tokens) {
      switch (token.type) {
        case 'text': {
          const node: ASTTextNode = { type: 'text', value: token.value, raw: token.raw };
          if (stack.length > 0) {
            const parent = stack[stack.length - 1];
            if ('children' in parent && Array.isArray(parent.children)) {
              parent.children.push(node);
            }
          } else {
            result.push(node);
          }
          break;
        }

        case 'link': {
          const node: ASTLinkNode = {
            type: 'link',
            href: token.value,
            raw: token.raw,
            children: [],
            closed: false,
          };
          if (stack.length > 0) {
            (stack[stack.length - 1] as ASTFormattingNode).children?.push(node);
          } else {
            result.push(node);
          }
          stack.push(node);
          break;
        }

        case 'link-close': {
          const lastIndex = this.findLastMatchingTag(stack, 'link');
          if (lastIndex !== -1) {
            const node = stack[lastIndex] as ASTLinkNode;
            node.closed = true;
            stack.splice(lastIndex);
          }
          break;
        }

        case 'bold':
        case 'italic':
        case 'underline':
        case 'strikethrough':
        case 'spoiler': {
          const lastIndex = this.findLastMatchingTag(stack, token.type);
          if (lastIndex !== -1) {
            const node = stack[lastIndex] as ASTFormattingNode;
            node.closed = true;
            // Combine opening marker + children content + closing marker
            const openMarker = getOpeningMarker(node.type);
            const childrenRaw = node.children!.map((child) => child.raw).join('');
            const closeMarker = getClosingMarker(node.type);
            node.raw = openMarker + childrenRaw + closeMarker;
            stack.splice(lastIndex);
          } else {
            const node: ASTInlineNode = {
              type: token.type,
              raw: token.raw,
              children: [],
              closed: false,
            };
            if (stack.length > 0) {
              (stack[stack.length - 1] as ASTFormattingNode).children?.push(node);
            } else {
              result.push(node);
            }
            stack.push(node);
          }
          break;
        }

        case 'monospace': {
          const node: ASTMonospaceNode = {
            type: 'monospace',
            value: token.value,
            raw: token.raw,
            closed: true,
          };
          if (stack.length > 0) {
            (stack[stack.length - 1] as ASTFormattingNode).children?.push(node);
          } else {
            result.push(node);
          }
          break;
        }

        case 'mention': {
          const node: ASTMentionNode = {
            type: 'mention',
            raw: token.raw,
            userId: token.userId,
            value: token.value,
          };
          if (stack.length > 0) {
            (stack[stack.length - 1] as ASTFormattingNode).children?.push(node);
          } else {
            result.push(node);
          }
          break;
        }

        case 'customEmoji': {
          const node: ASTCustomEmojiNode = {
            type: 'customEmoji',
            documentId: token.documentId,
            value: token.value,
            raw: token.raw,
          };
          if (stack.length > 0) {
            (stack[stack.length - 1] as ASTFormattingNode).children?.push(node);
          } else {
            result.push(node);
          }
          break;
        }

        case 'line-break': {
          const node: ASTLineBreakNode = {
            type: 'line-break',
            raw: token.raw,
          };
          if (stack.length > 0) {
            (stack[stack.length - 1] as ASTFormattingNode).children?.push(node as ASTNode);
          } else {
            result.push(node);
          }
        }
      }
    }

    for (const node of stack) {
      const nodeIsNotClosed = !('closed' in node) || !node.closed;
      if (nodeIsNotClosed && 'children' in node) {
        const openMarker = getOpeningMarker(node.type);
        const childrenRaw = node.children!.map((child) => child.raw).join('');
        node.raw = openMarker + childrenRaw;
      }
    }

    return result;
  }

  // eslint-disable-next-line class-methods-use-this
  private findLastMatchingTag(stack: ASTInlineNode[], type: string): number {
    for (let i = stack.length - 1; i >= 0; i--) {
      const node = stack[i];
      const nodeIsNotClosed = !('closed' in node) || !node.closed;

      if (nodeIsNotClosed && node.type === type) {
        return i;
      }
    }
    return -1;
  }
}

export function parse(tokens: BlockToken[]): ASTNode {
  return new Parser(tokens).parse();
}
