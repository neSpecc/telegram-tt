import type {
  ASTBlockNode, ASTNode, ASTQuoteBlockNode, ASTTextNode,
} from '../ast/entities/ASTNode';

export function generateNodeId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function isBlockNode(node: ASTNode): node is ASTBlockNode {
  return ['paragraph', 'quote', 'pre'].includes(node.type);
}

export function isNodeClosed(node: ASTNode): boolean {
  if ('closed' in node) {
    return node.closed ?? true;
  }
  return true;
}

export function areNodesEqual(node1: ASTNode, node2: ASTNode): boolean {
  return node1.id === node2.id;
}

export function createTextNode(value: string): ASTNode {
  return {
    type: 'text' as const,
    value,
    raw: value,
  };
}

export function splitByLineBreakNodes(node: ASTQuoteBlockNode): ASTNode[][] {
  const lines: ASTNode[][] = [];
  let currentLine: ASTNode[] = [];

  for (const [index, child] of node.children.entries()) {
    if (child.type === 'line-break') {
      lines.push(currentLine);
      currentLine = [];

      // last child is a line-break. Adding empty text node
      if (index === node.children.length - 1) {
        lines.push([{
          type: 'text',
          value: '',
          raw: '',
        } as ASTTextNode]);
      }
    } else {
      currentLine.push(child);
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  if (lines.length === 0) {
    lines.push([{ type: 'text', value: '', raw: '' } as ASTTextNode]);
  }

  return lines;
}
