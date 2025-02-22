/* eslint-disable no-null/no-null */
import type {
  ASTFormattingNode, ASTLineBreakNode, ASTLinkNode, ASTMentionNode, ASTNode, ASTRootNode,
} from '../ast/entities/ASTNode';

export interface NodeLocation {
  /**
   * The node that contains the offset
   */
  node: ASTNode | null;
  /**
   * The parent node of the node that contains the offset
   */
  parentNode: ASTNode | null;
  /**
   * Offset of the node in the raw string
   */
  currentOffset: number;
  /**
   * The start of the content within the node
   */
  contentStart?: number;
  /**
   * The end of the content within the node
   */
  contentEnd?: number;
}

function getMarkers(node: ASTNode): { startMarker: string; endMarker: string } {
  switch (node.type) {
    case 'pre': {
      const content = 'value' in node ? node.value : '';
      return {
        startMarker: `\`\`\`${node.language ? `${node.language}\n` : '\n'}`,
        endMarker: content.length > 0 ? '\n```' : '```',
      };
    }
    case 'monospace':
      return { startMarker: '`', endMarker: '`' };
    case 'quote':
      return { startMarker: '>', endMarker: '' };
    default:
      return { startMarker: '', endMarker: '' };
  }
}

function handleMarkedNode(
  node: ASTNode,
  offset: number,
  startOffset: number,
  parentNode: ASTNode | null,
): NodeLocation {
  const { startMarker, endMarker } = getMarkers(node);

  // For nodes with children (like quote), check children after marker
  if ('children' in node && Array.isArray(node.children)) {
    // First check if we're at the marker
    if (offset >= startOffset && offset < startOffset + startMarker.length) {
      return {
        node,
        parentNode,
        currentOffset: startOffset,
      };
    }

    // If node has no children (empty quote) and we're past the marker, return the node
    if (node.children.length === 0 && offset >= startOffset + startMarker.length) {
      return {
        node,
        parentNode,
        currentOffset: startOffset,
      };
    }

    // Then check children
    let currentOffset = startOffset + startMarker.length;
    for (const child of node.children) {
      const result = getFocusedNode(offset, child, currentOffset, node);
      if (result.node) {
        return result;
      }
      currentOffset = result.currentOffset;
    }

    // Check if we're in the end marker
    if (endMarker && offset >= currentOffset && offset <= currentOffset + endMarker.length) {
      return {
        node,
        parentNode,
        currentOffset: startOffset,
      };
    }

    return { node: null, parentNode: null, currentOffset };
  }

  // For nodes without children (like code), use the old logic
  const content = 'value' in node ? node.value : '';
  const totalLength = startMarker.length + content.length + endMarker.length;
  const endOffset = startOffset + totalLength;

  if (offset >= startOffset && offset <= endOffset) {
    return {
      node,
      parentNode,
      currentOffset: startOffset,
      contentStart: startOffset + startMarker.length,
      contentEnd: endOffset - endMarker.length,
    };
  }
  return { node: null, parentNode: null, currentOffset: endOffset };
}

/**
 * Finds the most specific AST node at a given offset position in the text.
 *
 * The function traverses the AST and returns:
 * 1. The most specific node that contains the offset
 * 2. Its parent node
 * 3. The current offset after processing the node
 *
 * Special handling for:
 * - Text nodes: Returns the text node if offset is within its content
 * - Links/Mentions: Returns text child if offset is in text part, or parent node if in syntax part
 * - Block nodes (pre/code/quote): Returns the node if offset is within its boundaries
 * - Root node: Handles line breaks between blocks
 *
 * @param offset - The position in text to find node for
 * @param node - The AST node to search in
 * @param startOffset - The starting offset of the current node
 * @param parentNode - The parent of the current node
 * @returns NodeLocation containing found node, its parent, and current offset
 */
export function getFocusedNode(
  offset: number,
  node: ASTNode | null,
  startOffset: number = 0,
  parentNode: ASTNode | null = null,
): NodeLocation {
  if (node === null) {
    return { node: null, parentNode: null, currentOffset: offset };
  }

  // Handle special node types
  switch (node.type) {
    case 'text':
      return handleTextNode(node, offset, startOffset, parentNode);
    case 'pre':
    case 'monospace':
    case 'quote':
      return handleMarkedNode(node, offset, startOffset, parentNode);
    case 'link':
    case 'mention':
      return handleLinkLikeNode(node, offset, startOffset, parentNode);
    case 'line-break':
      return handleLineBreakNode(node, offset, startOffset, parentNode);
  }

  // Handle root node with line breaks
  if (node.type === 'root' && 'children' in node) {
    return handleRootNode(node, offset, startOffset);
  }

  // Handle nodes with children
  if ('children' in node) {
    return handleNodeWithChildren(node, offset, startOffset, parentNode);
  }

  return { node: null, parentNode: null, currentOffset: startOffset };
}

function handleLinkLikeNode(
  node: ASTLinkNode | ASTMentionNode,
  offset: number,
  startOffset: number,
  parentNode: ASTNode | null,
): NodeLocation {
  if (!('children' in node) || !Array.isArray(node.children)) {
    return { node: null, parentNode: null, currentOffset: startOffset };
  }

  const textStart = startOffset + 1; // Skip [
  const textEnd = textStart + node.children[0].raw.length;
  const fullEnd = startOffset + node.raw.length;

  // If offset is in text part, return text child
  if (offset >= textStart && offset < textEnd) {
    return {
      node: node.children[0],
      parentNode: node,
      currentOffset: startOffset,
    };
  }

  // If offset is within the node's full range (including closing parenthesis), return the node
  if (offset >= startOffset && offset <= fullEnd) {
    return { node, parentNode, currentOffset: startOffset };
  }

  // If offset is after the node, return null to continue searching
  return {
    node: null,
    parentNode: null,
    currentOffset: fullEnd,
  };
}

function handleLineBreakNode(
  node: ASTLineBreakNode,
  offset: number,
  startOffset: number,
  parentNode: ASTNode | null,
): NodeLocation {
  if (offset - 1 === startOffset) {
    return { node, parentNode, currentOffset: startOffset };
  }

  return { node: null, parentNode: null, currentOffset: startOffset };
}

export function getOpeningMarker(type: ASTFormattingNode['type']): string {
  switch (type) {
    case 'bold': return '**';
    case 'italic': return '*';
    case 'underline': return '<u>';
    case 'strikethrough': return '~~';
    case 'link': return '[';
    case 'spoiler': return '||';
    case 'monospace': return '`';
    default: return '';
  }
}

export function getClosingMarker(type: ASTFormattingNode['type']): string {
  switch (type) {
    case 'bold': return '**';
    case 'italic': return '*';
    case 'underline': return '</u>';
    case 'strikethrough': return '~~';
    case 'link': return ']';
    case 'spoiler': return '||';
    case 'monospace': return '`';
    default: return '';
  }
}

function handleTextNode(
  node: ASTNode,
  offset: number,
  startOffset: number,
  parentNode: ASTNode | null,
): NodeLocation {
  if (node.type !== 'text') {
    return { node: null, parentNode: null, currentOffset: startOffset };
  }

  const endOffset = startOffset + node.value.length;
  if (offset >= startOffset && offset <= endOffset) {
    return { node, parentNode, currentOffset: startOffset };
  }
  return { node: null, parentNode: null, currentOffset: endOffset };
}

function handleRootNode(
  node: ASTRootNode,
  offset: number,
  startOffset: number,
): NodeLocation {
  if (!('children' in node)) {
    return { node: null, parentNode: null, currentOffset: startOffset };
  }

  let currentOffset = startOffset;

  for (const child of node.children) {
    const result = getFocusedNode(offset, child, currentOffset, node);
    if (result.node) {
      return result;
    }
    currentOffset = result.currentOffset;
    // Add line break after each block except the last one
    if (child !== node.children[node.children.length - 1]) {
      currentOffset += 1; // Add 1 for the line break
    }
  }

  return { node: null, parentNode: null, currentOffset };
}

function handleNodeWithChildren(
  node: ASTNode,
  offset: number,
  startOffset: number,
  parentNode: ASTNode | null,
): NodeLocation {
  if (!('children' in node) || !Array.isArray(node.children)) {
    return { node: null, parentNode: null, currentOffset: startOffset };
  }

  // Check if we're at the start of this node
  if (offset === startOffset) {
    return { node, parentNode, currentOffset: startOffset };
  }

  let currentOffset = startOffset;

  // Add opening marker length
  const openingMarker = getOpeningMarker(node.type as any);
  currentOffset += openingMarker.length;

  // Process children
  for (const child of node.children) {
    const result = getFocusedNode(offset, child, currentOffset, node);
    if (result.node) {
      return result;
    }
    currentOffset = result.currentOffset;
  }

  // Add closing marker length
  const closingMarker = getClosingMarker(node.type as any);
  currentOffset += closingMarker.length;

  // If no child contains the offset but offset is within this node's range
  if (offset >= startOffset && offset <= currentOffset) {
    return { node, parentNode, currentOffset: startOffset };
  }

  return { node: null, parentNode: null, currentOffset };
}

/**
 * Recursively finds first text node inside a node
 */
export function findDeepestTextNode(node: ASTNode): ASTNode | null {
  if (node.type === 'text') {
    return node;
  }
  if ('children' in node && Array.isArray(node.children) && node.children.length > 0) {
    return findDeepestTextNode(node.children[0]);
  }
  return null;
}
