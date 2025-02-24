import type { FC } from '../../../../lib/teact/teact';
import React, {
  memo,
  useEffect,
  useLayoutEffect,
  useState,
} from '../../../../lib/teact/teact';

import type { Signal } from '../../../../util/signals';
import type {
  ASTBlockNode, ASTFormattingNode,
  ASTInlineNode, ASTLinkNode, ASTMentionNode, ASTMonospaceNode, ASTNode, ASTParagraphBlockNode,
  ASTPreBlockNode,
  ASTQuoteBlockNode,
  ASTRootNode,
} from './entities/ASTNode';

import buildClassName from '../../../../util/buildClassName';
import { IS_SAFARI } from '../../../../util/windowEnvironment';
import { getClosingMarker, getFocusedNode, getOpeningMarker } from '../helpers/getFocusedNode';
import { areNodesEqual, isBlockNode, splitByLineBreakNodes } from '../helpers/node';

import CustomEmoji from '../../CustomEmoji';

const HIGHLIGHTABLE_NODE_CLASS = 'md-node-highlightable';
const FOCUSED_NODE_CLASS = 'md-node-focused';

interface TeactRendererProps {
  getAst: Signal<ASTRootNode | undefined>;
  onAfterUpdate?: () => void;
  getAstLastModified: Signal<number | undefined>;
  getMdOffset: Signal<number | undefined>;
}

const RendererTeact: FC<TeactRendererProps> = ({
  getAst,
  onAfterUpdate,
  getAstLastModified,
  getMdOffset,
}) => {
  const [currentAst, setCurrentAst] = useState<ASTRootNode>();
  const [lastModified, setLastModified] = useState<number | undefined>();
  const [focusedNode, setFocusedNode] = useState<ASTNode | undefined>();
  const [prevMdOffset, setPrevMdOffset] = useState<number | undefined>();

  useLayoutEffect(() => {
    const newAst = getAst();
    if (!newAst) return;

    const areEqual = currentAst && areNodesEqual(newAst, currentAst) && getAstLastModified() === lastModified;

    if (!currentAst || !areEqual) {
      setCurrentAst(newAst);
      setLastModified(getAstLastModified());
    }
  }, [getAst, currentAst, getAstLastModified, lastModified]);

  useLayoutEffect(() => {
    if (currentAst && onAfterUpdate) {
      const selection = window.getSelection();

      onAfterUpdate();

      const selectionRange = selection!.getRangeAt(0);
      const selectionRect = selectionRange.getBoundingClientRect();

      if (IS_SAFARI
        && selectionRect.x === 0
        && selectionRect.y === 0
        && selectionRect.width === 0
        && selectionRect.height === 0
      ) {
        requestAnimationFrame(() => {
          onAfterUpdate();
        });
      }
    }
  }, [currentAst, onAfterUpdate, lastModified]);

  useEffect(() => {
    const mdOffset = getMdOffset();

    if (mdOffset === prevMdOffset) {
      return;
    }

    setPrevMdOffset(mdOffset);

    if (mdOffset !== undefined && currentAst) {
      const result = getFocusedNode(mdOffset, currentAst);

      if (result.node) {
        if (
          result.node.type !== 'text'
          && result.node.type !== 'line-break'
          && 'parentNode' in result.node
        ) {
          setFocusedNode(result.node.parentNode as ASTNode);
        } else {
          setFocusedNode(result.node);
        }
      } else {
        setFocusedNode(undefined);
      }
    } else {
      setFocusedNode(undefined);
    }
  }, [getMdOffset, currentAst, prevMdOffset]);

  function renderNode(node: ASTNode | undefined): React.ReactNode {
    if (!node) return '';

    if (node.type === 'root') {
      return node.children?.map((child) => renderNode(child));
    }

    return isBlockNode(node) ? renderBlockNode(node) : renderInlineNode(node as ASTInlineNode);
  }

  function renderChildren(children: ASTNode[] | undefined, isFocusedOverride?: boolean) {
    if (!children) {
      return undefined;
    }

    return children.map((child) => renderInlineNode(child as ASTInlineNode, isFocusedOverride));
  }

  function renderBlockNode(node: ASTBlockNode): React.ReactNode {
    switch (node.type) {
      case 'paragraph':
        return renderParagraph(node as ASTParagraphBlockNode);
      case 'quote':
        return renderQuote(node);
      case 'pre':
        return renderPre(node);
      default:
        return undefined;
    }
  }

  function renderParagraph(node: ASTParagraphBlockNode) {
    return (
      <div className="paragraph">
        {node.children.length > 0 && node.children.some((child) => child.type !== 'text' || child.value)
          ? renderChildren(node.children)
          : <br />}
      </div>
    );
  }

  function renderQuote(node: ASTQuoteBlockNode) {
    const lines = splitByLineBreakNodes(node);

    const renderLine = (line: ASTNode[], i: number) => {
      const lineElements = line.map((childNode) => {
        const childElement = renderNode(childNode);

        return childElement !== '' ? childElement : '\n';
      });

      if (i === 0) {
        lineElements.unshift(<span className="md-preview-char">&gt;</span>);
      }

      return renderBlockLine('quote', lineElements, node.id!, `${node.id}-${i}-line`);
    };

    const renderLines = lines.map((line, i) => {
      const lineElement = renderLine(line, i);

      return lineElement;
    });

    return (
      <div className={buildClassName(
        'md-quote',
        HIGHLIGHTABLE_NODE_CLASS,
        focusedNode?.id === node.id && FOCUSED_NODE_CLASS,
      )}
      >
        <div className="md-quote-content">
          {renderLines}
        </div>
      </div>
    );
  }

  function renderBlockLine(
    type: 'pre' | 'quote',
    content: React.ReactNode | string | React.ReactNode[],
    groupId: string,
    key: string,
  ) {
    return (
      <div
        key={key}
        data-block-id={groupId}
        className={buildClassName(
          'paragraph',
          `paragraph-${type}`,
          HIGHLIGHTABLE_NODE_CLASS,
        )}
      >
        {content}
      </div>
    );
  }

  function renderPre(node: ASTPreBlockNode) {
    const groupId = Math.random().toString(36).substring(2, 15);
    const content = node.value;

    let lines: string[] = [];
    if (content.length > 0) {
      if (content.includes('\n')) {
        // Split and preserve empty lines, but don't add an extra empty line at the end
        lines = content.endsWith('\n')
          ? content.slice(0, -1).split('\n')
          : content.split('\n');
      } else {
        lines = [content];
      }
    }

    const br = <br />;

    return (
      <div className={buildClassName(
        'md-pre',
        HIGHLIGHTABLE_NODE_CLASS,
        focusedNode?.id === node.id && FOCUSED_NODE_CLASS,
      )}
      >
        {
          renderBlockLine(
            'pre',
            <span className="md-preview-char">
              ```{node.language ? <span className="md-pre-language">{node.language}</span> : ''}
            </span>,
            groupId,
            `${groupId}-opening-tag`,
          )
        }
        {lines.map((line, i) => {
          return renderBlockLine('pre', line || br, groupId, `${groupId}-${i}`);
        })}
        {node.closed && renderBlockLine(
          'pre',
          <span className="md-preview-char">```</span>,
          groupId,
          `${groupId}-closing-tag`,
        )}
      </div>
    );
  }

  function renderInlineNode(node: ASTInlineNode, isFocusedOverride?: boolean): React.ReactNode {
    const isFocused = isFocusedOverride !== undefined ? isFocusedOverride : focusedNode?.id === node.id;

    switch (node.type) {
      case 'text': {
        // Clean the text value of BOM and zero-width spaces
        const cleanValue = node.value?.replace(/[\u200B\uFEFF]/g, '');
        // return (
        //   <span data-node-id={node.id}>
        //     {cleanValue}
        //   </span>
        // );
        return cleanValue || '';
      }
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strikethrough':
      case 'spoiler':
      case 'monospace':
        return renderFormatting(node as ASTFormattingNode, isFocused);

      case 'link':
        return renderLink(node as ASTLinkNode, isFocused);
      case 'mention':
        return renderMention(node as ASTMentionNode, isFocused);

      case 'customEmoji':
        return (
          <CustomEmoji
            documentId={node.documentId}
            size={20}
            className="inline-custom-emoji"
          />
        );
      case 'line-break':
        return <br />;

      default:
        return undefined;
    }
  }

  function renderFormatting(node: ASTFormattingNode, isFocusedOverride?: boolean) {
    const isFocused = isFocusedOverride !== undefined ? isFocusedOverride : focusedNode?.id === node.id;

    const className = getFormattingClassName(node);
    const openingMarker = getOpeningMarker(node.type);
    const closingMarker = node.closed ? getClosingMarker(node.type) : '';

    const tags: Record<string, keyof JSX.IntrinsicElements> = {
      bold: 'strong',
      italic: 'em',
      underline: 'u',
      strikethrough: 's',
      monospace: 'code',
    };

    const TagName = tags[node.type] || 'span';

    return (
      <TagName className={buildClassName(
        className,
        isFocused && FOCUSED_NODE_CLASS,
      )}
      >
        <span className="md-preview-char">{openingMarker}</span>
        { 'children' in node ? renderChildren(node.children, isFocused) : (node as ASTMonospaceNode).value}
        {closingMarker && <span className="md-preview-char">{closingMarker}</span>}
      </TagName>
    );
  }

  function getFormattingClassName(node: ASTFormattingNode) {
    return buildClassName(
      `md-${node.type}`,
      HIGHLIGHTABLE_NODE_CLASS,
    );
  }

  function renderLink(node: ASTLinkNode, isFocusedOverride?: boolean) {
    const isFocused = isFocusedOverride !== undefined ? isFocusedOverride : focusedNode?.id === node.id;

    return (
      <span
        className={buildClassName(
          HIGHLIGHTABLE_NODE_CLASS,
          isFocused && FOCUSED_NODE_CLASS,
        )}
      >
        <span className="md-preview-char">{getOpeningMarker('link')}</span>
        <a href={node.href}>
          {node.children && renderChildren(node.children, isFocused)}
        </a>
        <span className="md-preview-char">
          {getClosingMarker('link')}
          (<a href={node.href}>{node.href}</a>)
        </span>
      </span>
    );
  }

  function renderMention(node: ASTMentionNode, isFocusedOverride?: boolean) {
    const isFocused = isFocusedOverride !== undefined ? isFocusedOverride : focusedNode?.id === node.id;

    return (
      <span className={buildClassName(
        'md-mention',
        isFocused && FOCUSED_NODE_CLASS,
      )}
      >
        {node.value}
      </span>
    );
  }

  return currentAst && renderNode(currentAst);
};

export default memo(RendererTeact);
