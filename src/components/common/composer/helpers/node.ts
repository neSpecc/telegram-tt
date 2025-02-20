import type { ASTBlockNode, ASTNode } from '../ast/entities/ASTNode';

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
