/* eslint-disable max-len */
/* eslint-disable no-null/no-null */
import type { ApiMessageEntityCustomEmoji } from '../../../../api/types';
import type {
  ASTBlockNode, ASTInlineNode, ASTMonospaceNode, ASTNode, ASTParagraphBlockNode, ASTUnderlineNode,
} from './entities/ASTNode';
import type { OffsetMapping, OffsetMappingRecord } from './entities/OffsetMapping';

import { buildCustomEmojiHtmlFromEntity } from '../../../middle/composer/helpers/customEmoji';
// import { buildCustomEmojiHtmlFromEntity } from '../../../telegram-tt/src/components/middle/composer/helpers/customEmoji';
import { escapeAttribute, escapeHTML } from '../helpers/escape';
import { getFocusedNode } from '../helpers/getFocusedNode';
import { isBlockNode, isNodeClosed, splitByLineBreakNodes } from '../helpers/node';

export interface RendererOptions {
  mode: 'html' | 'markdown' | 'api';
  isPreview?: boolean;
  previewNodeOffset?: number;
}

export const HIGHLIGHTABLE_NODE_CLASS = 'md-node-highlightable';
export const FOCUSED_NODE_CLASS = 'md-node-focused';
export const BLOCK_GROUP_ATTR = 'data-block-id';

function previewSpan(char: string): string {
  return `<span class="md-preview-char">${char}</span>`;
}

export class RendererHtml {
  private offsetMapping: OffsetMapping = [];

  private focusedNode: ASTNode | null = null;

  private currentHtmlOffset = 0;

  private currentMdOffset = 0;

  private prevBlock: ASTNode | undefined = undefined;

  private parentMap: WeakMap<ASTNode, ASTNode> | undefined = undefined;

  constructor(private options: RendererOptions = { mode: 'html', isPreview: false }) {}

  public render(ast: ASTNode, options?: RendererOptions, parentMap?: WeakMap<ASTNode, ASTNode>): string {
    this.parentMap = parentMap || new WeakMap();
    this.options = options || this.options;
    this.offsetMapping = [];
    this.currentHtmlOffset = 0;
    this.currentMdOffset = 0;
    this.prevBlock = undefined;

    if (options?.previewNodeOffset !== undefined) {
      const result = getFocusedNode(options.previewNodeOffset, ast);

      /**
       * If the focused node is not a text node,
       * we need to focus on the parent node
       */
      if (result.node?.type !== 'text' && result.node?.type !== 'line-break') {
        this.focusedNode = result.node;
      } else {
        this.focusedNode = result.parentNode;
      }
    } else {
      this.focusedNode = null;
    }

    const result = this.renderNode(ast);

    if (result === undefined) {
      throw new Error(`Renderer: can not render node of unknown node type: ${ast.type}`);
    }

    return result;
  }

  public getOffsetMapping(): OffsetMappingRecord[] {
    return this.offsetMapping;
  }

  private addToMapping(htmlLength: number, mdLength: number, node: ASTNode) {
    this.offsetMapping.push({
      htmlStart: this.currentHtmlOffset,
      htmlEnd: this.currentHtmlOffset + htmlLength,
      mdStart: this.currentMdOffset,
      mdEnd: this.currentMdOffset + mdLength,
      nodeType: node.type,
      raw: node.raw,
      nodeId: node.id,
    });

    this.currentHtmlOffset += htmlLength;
    this.currentMdOffset += mdLength;
  }

  private getParentNode(node: ASTNode): ASTNode | undefined {
    return this.parentMap?.get(node) || undefined;
  }

  private renderNode(node: ASTNode): string | undefined {
    if (node.type === 'root') {
      const blocks = node.children.map((child: ASTNode) => this.renderNode(child));
      const joiner = this.options.mode !== 'html' ? '\n' : '';
      return blocks.join(joiner);
    }

    if (isBlockNode(node)) {
      let result = this.renderBlockNode(node);

      if (this.prevBlock?.type === 'quote') {
        // console.log('this.prevBlock', this.prevBlock);
        //
        // const isQuoteEmpty = this.prevBlock.children.length === 0;

        // if (!isQuoteEmpty) {
        result = `\n${result}`;
        // }
      }

      this.prevBlock = node;
      return result;
    }

    return this.renderInlineNode(node as ASTInlineNode);
  }

  // eslint-disable-next-line class-methods-use-this
  private createLine(type: string, text: string, groupId: string, isFocused: boolean) {
    return `<div ${BLOCK_GROUP_ATTR}="${groupId}" class="paragraph paragraph-${type} ${HIGHLIGHTABLE_NODE_CLASS} ${isFocused ? FOCUSED_NODE_CLASS : ''}">${text}</div>`;
  }

  private prepareLines(type: string, prefix: string, content: string, suffix: string, groupId: string, isFocused: boolean) {
    const result = [];

    if (prefix) {
      result.push(this.createLine(type, prefix, groupId, isFocused));
    }

    if (content.length > 0) {
      let lines = [];

      if (content.includes('\n')) {
        // Split and preserve empty lines, but don't add an extra empty line at the end
        lines = content.endsWith('\n')
          ? content.slice(0, -1).split('\n')
          : content.split('\n');
      } else {
        lines = [content];
      }

      lines.forEach((line) => {
        result.push(this.createLine(type, line || '<br>', groupId, isFocused));
      });
    }

    if (suffix) {
      result.push(this.createLine(type, suffix, groupId, isFocused));
    }

    return result.join('');
  }

  private renderBlockNode(node: ASTBlockNode): string {
    const isFocused = node === this.focusedNode;
    const isPreview = this.options.isPreview;

    let blockHtml = '';

    switch (node.type) {
      case 'paragraph': {
        const children = node.children.map((child) => this.renderNode(child)).join('');

        blockHtml = this.options.mode === 'html'
          ? `<div class="paragraph">${children.length > 0 ? children : '<br>'}</div>`
          : `${node.children.map((child) => this.renderNode(child)).join('')}`;

        break;
      }
      case 'quote': {
        const savedHtmlOffset = this.currentHtmlOffset;
        const savedMdOffset = this.currentMdOffset;

        let hasNextBlock = false;

        const parentNode = this.getParentNode(node);

        if (parentNode && 'children' in parentNode && Array.isArray(parentNode.children)) {
          const siblings = parentNode.children as ASTBlockNode[];
          const nodeIndex = siblings.indexOf(node);
          const nextNode = siblings[nodeIndex + 1];
          hasNextBlock = nextNode && isBlockNode(nextNode);
        }

        const quoteMdLength = node.raw.length + (hasNextBlock ? 1 : 0); // +1 for the extra linebreak after the quote

        this.addToMapping(
          node.raw.length,
          quoteMdLength,
          node,
        );

        // Move past '>'
        this.currentHtmlOffset = savedHtmlOffset + 1;
        this.currentMdOffset = savedMdOffset + 1;

        const lines = splitByLineBreakNodes(node);

        if (this.options.mode === 'html') {
          const linesHtml = lines.map((line, index) => {
            // line is [ASTNode, ASTNode, ASTNode]
            let lineContent = line.map((child) => {
              const childNodeHtml = this.renderNode(child);

              return childNodeHtml || '\n';
            }).join('');

            if (index === 0) {
              lineContent = previewSpan('>').concat(lineContent || '');
            }

            const lineHtml = this.createLine(
              'quote',
              lineContent,
              node.id || Math.random().toString(36).substring(2, 15),
              isFocused,
            );

            return lineHtml.concat('\n');
          });

          this.currentHtmlOffset = savedHtmlOffset + node.raw.length;
          this.currentMdOffset = savedMdOffset + quoteMdLength;

          blockHtml = `<div class="md-quote ${HIGHLIGHTABLE_NODE_CLASS} ${isFocused ? FOCUSED_NODE_CLASS : ''}"><div class="md-quote-content">${linesHtml.join('')}</div></div>`;
        } else {
          const linesMd = lines.map((line) => {
            return line.map((child) => this.renderNode(child)).join('');
          }).join('\n');

          blockHtml = `>${linesMd}`;
        }

        break;
      }
      case 'pre': {
        if (this.options.mode === 'markdown') {
          const prefixLinebreak = node.language || (node.value !== '' && node.value !== '\n');
          return `\`\`\`${node.language ? `${node.language}` : ''}${prefixLinebreak ? '\n' : ''}${node.value}${node.closed ? '\n```' : ''}`;
        }

        this.addToMapping(
          node.raw.length,
          node.raw.length,
          node,
        );

        const content = node.value;
        const language = node.language ? `<span class="md-pre-language">${node.language}</span>` : '';
        const prefix = isPreview ? previewSpan(`\`\`\`${language || ''}`) : '';
        const suffix = isPreview && node.closed ? previewSpan('```') : '';

        const result = this.prepareLines('pre', prefix, content, suffix, node.id || Math.random().toString(36).substring(2, 15), isFocused);

        blockHtml = `<div class="md-pre">${result}</div>`;

        break;
      }

      default:
        return '';
    }

    if (this.options.mode === 'html') {
      this.currentHtmlOffset += 1;
      this.currentMdOffset += 1;
    }

    return blockHtml;
  }

  public renderInlineNode(node: ASTInlineNode | ASTParagraphBlockNode, isFocusedOverride?: boolean) {
    const { mode = 'html', isPreview = false } = this.options;
    const isFocused = isFocusedOverride !== undefined ? isFocusedOverride : this.isNodeFocused(node);
    const isClosed = isNodeClosed(node);

    const grammar = {
      bold: {
        tag: 'strong',
        markdown: '**',
      },
      italic: {
        tag: 'em',
        markdown: '*',
      },
      strikethrough: {
        tag: 's',
        markdown: '~~',
      },
      monospace: {
        tag: 'code',
        markdown: '`',
      },
      spoiler: {
        tag: 'span',
        markdown: '||',
      },
    };

    switch (node.type) {
      case 'text': {
        const text = mode === 'html' ? escapeHTML(node.value) : node.value;
        this.addToMapping(
          node.value.length,
          node.raw.length,
          node,
        );
        return text;
      }
      case 'bold':
      case 'italic':
      case 'strikethrough':
      case 'monospace':
      case 'spoiler': {
        const grammatic = grammar[node.type];
        const markerLength = grammatic.markdown.length;

        // Skip nested formatting nodes of the same type
        if ('children' in node && Array.isArray(node.children) && node.children.length === 1 && node.children[0].type === node.type) {
          return this.renderChildren(node.children as ASTNode[], isFocused);
        }

        const savedHtmlOffset = this.currentHtmlOffset;
        const savedMdOffset = this.currentMdOffset;

        this.addToMapping(
          node.raw.length - (isPreview ? 0 : markerLength * 2),
          node.raw.length,
          node,
        );

        this.currentHtmlOffset = savedHtmlOffset + (isPreview ? markerLength : 0);
        this.currentMdOffset = savedMdOffset + markerLength;

        const content = 'children' in node ? this.renderChildren(node.children as ASTNode[], isFocused) : (node as ASTMonospaceNode).value;

        this.currentHtmlOffset = savedHtmlOffset + node.raw.length;
        this.currentMdOffset = savedMdOffset + node.raw.length;

        const prefix = isPreview ? previewSpan(grammatic.markdown) : '';
        const suffix = isPreview && isClosed ? previewSpan(grammatic.markdown) : '';

        if (mode === 'html') {
          return `<${grammatic.tag} class="md-${node.type} ${HIGHLIGHTABLE_NODE_CLASS} ${isFocused ? FOCUSED_NODE_CLASS : ''}">${prefix}${content}${suffix}</${grammatic.tag}>`;
        } else {
          return `${grammatic.markdown}${content}${isClosed ? grammatic.markdown : ''}`;
        }
      }
      case 'underline': {
        const markerLength = 3; // Length of '<u>' and '</u>'

        const savedHtmlOffset = this.currentHtmlOffset;
        const savedMdOffset = this.currentMdOffset;

        this.addToMapping(
          node.raw.length,
          node.raw.length,
          node,
        );

        this.currentHtmlOffset = savedHtmlOffset + markerLength;
        this.currentMdOffset = savedMdOffset + markerLength;

        const content = this.renderChildren((node as ASTUnderlineNode).children as ASTNode[], isFocused);

        this.currentHtmlOffset = savedHtmlOffset + node.raw.length;
        this.currentMdOffset = savedMdOffset + node.raw.length;

        if (mode === 'html') {
          const prefix = isPreview ? previewSpan('&lt;u&gt;') : '';
          const suffix = isPreview ? previewSpan('&lt;/u&gt;') : '';
          return `<span class="md-underline ${HIGHLIGHTABLE_NODE_CLASS} ${isFocused ? FOCUSED_NODE_CLASS : ''}">${prefix}${content}${suffix}</span>`;
        } else {
          return `<u>${content}</u>`;
        }
      }
      case 'link': {
        const href = escapeAttribute(node.href);
        const savedHtmlOffset = this.currentHtmlOffset;
        const savedMdOffset = this.currentMdOffset;
        this.addToMapping(
          node.raw.length,
          node.raw.length,
          node,
        );

        this.currentHtmlOffset = savedHtmlOffset + 1; // '['
        this.currentMdOffset = savedMdOffset + 1;

        const children = this.renderChildren(node.children as ASTNode[], isFocused);

        this.currentHtmlOffset = savedHtmlOffset + node.raw.length;
        this.currentMdOffset = savedMdOffset + node.raw.length;

        if (mode === 'html') {
          if (isPreview) {
            return [
              `<span class="${HIGHLIGHTABLE_NODE_CLASS} ${isFocused ? FOCUSED_NODE_CLASS : ''}">`,
              previewSpan('['),
              `<a href="${href}">${children}</a>`,
              previewSpan(`](<a href="${href}">${href}</a>)`),
              '</span>',
            ].join('');
          } else {
            return `<a href="${href}">${children}</a>`;
          }
        } else {
          return `[${children}](${href})`;
        }
      }
      case 'mention': {
        if (mode === 'html') {
          const htmlText = `${node.value}`;
          const mdText = `[${node.value}](id:${node.userId})`;
          this.addToMapping(htmlText.length, mdText.length, node);
          return `<span class="md-mention">${htmlText}</span>`;
        } else {
          return `[${node.value}](id:${node.userId})`;
        }
      }
      case 'customEmoji': {
        const mdText = `[${node.value}](doc:${node.documentId})`;
        if (mode === 'html') {
          const imgTagLength = 1;
          this.addToMapping(imgTagLength, mdText.length, node);
          // if (typeof window !== 'undefined' && window.location.port === '5173') {
          //   return '<div class="custom-emoji" contenteditable="false"><img class="emoji emoji-small placeholder" draggable="false" alt="😎" data-document-id="5071170261227667457" data-entity-type="MessageEntityCustomEmoji" src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f604/512.gif" /></div>';
          // }
          return buildCustomEmojiHtmlFromEntity(node.value, node as unknown as ApiMessageEntityCustomEmoji);
        } else {
          return mdText;
        }
        break;
      }
      case 'paragraph': {
        return this.renderChildren((node as ASTParagraphBlockNode).children as ASTNode[], isFocused);
      }
      case 'line-break': {
        if (mode === 'html') {
          // eslint-disable-next-line no-console
          console.warn('Unexpected line-break node in html mode', node);
          return '<br>';
        } else {
          return '\n';
        }
      }
      default: {
        // eslint-disable-next-line no-console
        console.error(`AST Renderer: can not render node of unknown type: ${(node as unknown as ASTNode).type}`);
        return '';
      }
    }
  }

  private renderChildren(children: ASTNode[], isFocusedOverride?: boolean): string {
    if (!children) {
      // console.error('No children to render');
    }

    return children
      .map((child) => this.renderInlineNode(child as ASTInlineNode, isFocusedOverride))
      .join('');
  }

  /**
   * Node is focused when itself or one of its children equals the focused node
   * @param node Node - node to check
   */
  private isNodeFocused(node: ASTNode): boolean {
    if (node === this.focusedNode) {
      return true;
    }

    if ('children' in node && Array.isArray(node.children)) {
      return node.children.some((child) => this.isNodeFocused(child));
    }

    return false;
  }
}
