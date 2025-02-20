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
import { getClosingMarker, getOpeningMarker } from '../helpers/getFocusedNode';
import { areNodesEqual, isBlockNode } from '../helpers/node';

import CustomEmoji from '../../CustomEmoji';

const HIGHLIGHTABLE_NODE_CLASS = 'md-node-highlightable';

interface TeactRendererProps {
  getAst: Signal<ASTRootNode | undefined>;
  onAfterUpdate?: () => void;
  getAstLastModified: Signal<number | undefined>;
}

const RendererTeact: FC<TeactRendererProps> = ({
  getAst,
  onAfterUpdate,
  getAstLastModified,
}) => {
  const [currentAst, setCurrentAst] = useState<ASTRootNode>();
  const [lastModified, setLastModified] = useState<number | undefined>();

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
      onAfterUpdate();
    }
  }, [currentAst, onAfterUpdate, lastModified]);

  function renderNode(node: ASTNode | undefined): React.ReactNode {
    if (!node) return '';

    if (node.type === 'root') {
      return node.children?.map((child) => renderNode(child));
    }

    return isBlockNode(node) ? renderBlockNode(node) : renderInlineNode(node as ASTInlineNode);
  }

  function renderChildren(children: ASTNode[] | undefined) {
    if (!children) {
      return undefined;
    }

    return children.map((child) => renderNode(child));
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
    return (
      <div className={buildClassName(
        'paragraph paragraph--quote',
        HIGHLIGHTABLE_NODE_CLASS,
      )}
      >
        <div className="md-quote">
          <span className="md-preview-char">&gt;</span>
          {renderChildren(node.children)}
        </div>
      </div>
    );
  }

  function renderPreLine(
    content: React.JSX.Element | string,
    groupId: string,
    key: string,
  ) {
    return (
      <div
        key={key}
        data-block-id={groupId}
        className={buildClassName(
          'paragraph paragraph-pre',
          HIGHLIGHTABLE_NODE_CLASS,
        )}
      >
        {content || <br />}
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

    return (
      <div className="md-pre">
        {
          renderPreLine(
            <span className="md-preview-char">
              ```{node.language ? <span className="md-pre-language">{node.language}</span> : ''}
            </span>,
            groupId,
            `${groupId}-opening-tag`,
          )
        }
        {lines.map((line, i) => {
          return renderPreLine(line, groupId, `${groupId}-${i}`);
        })}
        {node.closed && renderPreLine(
          <span className="md-preview-char">```</span>,
          groupId,
          `${groupId}-closing-tag`,
        )}
      </div>
    );
  }

  function renderInlineNode(node: ASTInlineNode): React.ReactNode {
    switch (node.type) {
      case 'text': {
        // Clean the text value of BOM and zero-width spaces
        const cleanValue = node.value?.replace(/[\u200B\uFEFF]/g, '');
        // return (
        //   <span data-node-id={node.id}>
        //     {cleanValue}
        //   </span>
        // );
        return cleanValue || undefined;
      }
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strikethrough':
      case 'spoiler':
      case 'monospace':
        return renderFormatting(node as ASTFormattingNode);

      case 'link':
        return renderLink(node as ASTLinkNode);
      case 'mention':
        return renderMention(node as ASTMentionNode);

      case 'customEmoji':
        return (
          <CustomEmoji
            documentId={node.documentId}
            size={20}
            className="inline-custom-emoji"
          />
        );

      default:
        return undefined;
    }
  }

  function renderFormatting(node: ASTFormattingNode) {
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
      <TagName className={className}>
        <span className="md-preview-char">{openingMarker}</span>
        { 'children' in node ? renderChildren(node.children) : (node as ASTMonospaceNode).value}
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

  function renderLink(node: ASTLinkNode) {
    return (
      <span
        className={buildClassName(
          HIGHLIGHTABLE_NODE_CLASS,
        )}
      >
        <span className="md-preview-char">{getOpeningMarker('link')}</span>
        <a href={node.href}>
          {node.children && renderChildren(node.children)}
        </a>
        <span className="md-preview-char">
          {getClosingMarker('link')}
          (<a href={node.href}>{node.href}</a>)
        </span>
      </span>
    );
  }

  function renderMention(node: ASTMentionNode) {
    return (
      <span className={buildClassName('md-mention')}>
        {node.value}
      </span>
    );
  }
  return currentAst && renderNode(currentAst);
};

export default memo(RendererTeact);
