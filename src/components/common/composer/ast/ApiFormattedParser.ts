/* eslint-disable no-null/no-null */
import type {
  ASTFormattingNode, ASTInlineNode, ASTLinkNode, ASTNode, ASTParagraphBlockNode, ASTTextNode,
} from './entities/ASTNode';
import {
  type ApiFormattedText,
  type ApiMessageEntity,
  type ApiMessageEntityBlockquote,
  type ApiMessageEntityMentionName,
  type ApiMessageEntityPre,
  ApiMessageEntityTypes,
} from '../../../../api/types';

export class ApiFormattedParser {
  constructor(private readonly isRich: boolean = true) {
  }

  /**
   * Converts ApiFormattedText to AST
   */
  public fromApiFormattedToAst(formatted: ApiFormattedText): ASTNode {
    // eslint-disable-next-line prefer-const
    let { text, entities = [] } = formatted;

    /**
     * Normalize line endings to ensure consistent parsing
     * This handles both Windows (\r\n) and Unix (\n) line endings
     */
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const sortedEntities = [...entities].sort((a, b) => {
      if (a.offset === b.offset) {
        return b.length - a.length;
      }
      return a.offset - b.offset;
    });

    const root: ASTNode = {
      type: 'root',
      raw: text,
      children: [],
    };

    let currentOffset = 0;
    let currentParagraph: ASTParagraphBlockNode | null = null;

    const flushParagraph = () => {
      if (currentParagraph) {
        root.children.push(currentParagraph);
        currentParagraph = null;
      }
    };

    const beginParagraph = () => {
      currentParagraph = {
        type: 'paragraph',
        children: [],
        raw: '',
      } as ASTParagraphBlockNode;
      return currentParagraph;
    };

    // Instead of always creating initial paragraph
    const startsWithBlock = sortedEntities.some((e) => e.offset === 0 && (
      e.type === ApiMessageEntityTypes.Pre
        || e.type === ApiMessageEntityTypes.Blockquote
    ));

    if (!startsWithBlock) {
      beginParagraph(); // Only start with paragraph if not starting with block
    }

    function handleNewline(offset: number): boolean {
      const nextEntity = sortedEntities.find((e) => e.offset === offset + 1);
      const prevEntity = sortedEntities.find((e) => e.offset + e.length === offset
        && (e.type === ApiMessageEntityTypes.Pre || e.type === ApiMessageEntityTypes.Blockquote));

      const isBlock = nextEntity && (
        nextEntity.type === ApiMessageEntityTypes.Pre
        || nextEntity.type === ApiMessageEntityTypes.Blockquote
      );
      const isAfterBlock = !!prevEntity;

      if (!isBlock && !isAfterBlock) {
        flushParagraph();
        beginParagraph();
      }

      return isBlock || isAfterBlock;
    }

    const isOffsetEqual = (e: ApiMessageEntity) => e.offset === currentOffset;
    const isOffsetGreater = (e: ApiMessageEntity) => e.offset > currentOffset;

    while (currentOffset < text.length) {
      const currentEntities = sortedEntities.filter(isOffsetEqual);

      if (currentEntities.length > 0) {
        const entity = currentEntities[0];
        const entityText = text.slice(entity.offset, entity.offset + entity.length);

        if (entity.type === ApiMessageEntityTypes.Pre || entity.type === ApiMessageEntityTypes.Blockquote) {
          flushParagraph();
          const node = this.convertEntityToNode(
            entity,
            entityText,
            getNestedEntities(entity, sortedEntities),
          );
          if (entity.type === ApiMessageEntityTypes.Pre) {
            root.raw = root.raw.replace(
              entityText,
              `\`\`\`${entity.language || ''}\n${entityText}\n\`\`\``,
            );
          }
          root.children.push(node);
        } else {
          const paragraph = currentParagraph || beginParagraph();
          const node = this.convertEntityToNode(
            entity,
            entityText,
            getNestedEntities(entity, sortedEntities),
          );
          paragraph.children.push(node as ASTInlineNode);
          paragraph.raw += node.raw;
        }

        currentOffset += entity.length;
      } else {
        const nextEntity = sortedEntities.find(isOffsetGreater);
        const textEnd = nextEntity ? nextEntity.offset : text.length;
        const plainText = text.slice(currentOffset, textEnd);

        if (plainText) {
          const parts = plainText.split('\n');

          // eslint-disable-next-line @typescript-eslint/no-loop-func
          parts.forEach((part, index) => {
            const paragraph = currentParagraph || beginParagraph();

            if (part.length > 0) {
              paragraph.children.push(this.createTextNode(part) as ASTTextNode);
              paragraph.raw += part;
            }

            if (index < parts.length - 1) {
              currentOffset += part.length + 1; // +1 for newline
              handleNewline(currentOffset - 1); // Handle newline at its position
            }
          });
        }

        currentOffset = textEnd;
      }
    }

    flushParagraph(); // Flush final paragraph even if empty

    if (root.children.length > 0) {
      root.raw = root.children.map((child) => child.raw).join('\n');
    }

    return root;
  }

  private createFormattedNode(
    type: Exclude<
    ASTNode['type'],
    'root' | 'paragraph' | 'text' | 'link' | 'pre' | 'monospace' | 'mention' | 'customEmoji' | 'quote'
    >,
    text: string,
    entity: ApiMessageEntity,
    nestedEntities: ApiMessageEntity[],
    marker: { start: string; end: string },
  ): ASTFormattingNode {
    const children = nestedEntities.length > 0
      ? this.processNestedEntities(text, entity.offset, nestedEntities)
      : [this.createTextNode(text)];
    const childrenRaw = children.map((child) => child.raw).join('');
    return {
      type,
      raw: `${marker.start}${childrenRaw}${marker.end}`,
      children,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  private createTextNode(value: string): ASTNode {
    return {
      type: 'text' as const,
      value,
      raw: value,
    };
  }

  private processNestedEntities(
    parentText: string,
    startOffset: number,
    nestedEntities: ApiMessageEntity[],
  ): ASTInlineNode[] {
    const children: ASTInlineNode[] = [];
    let currentOffset = 0;

    const isOffsetEqual = (e: ApiMessageEntity) => e.offset === startOffset + currentOffset;
    const isOffsetGreater = (e: ApiMessageEntity) => e.offset > startOffset + currentOffset;

    while (currentOffset < parentText.length) {
      const entity = nestedEntities.find(isOffsetEqual);

      if (entity) {
        const entityText = parentText.slice(
          currentOffset,
          currentOffset + (entity.offset + entity.length - (startOffset + currentOffset)),
        );
        const nestedNode = this.convertEntityToNode(
          entity,
          entityText,
          getNestedEntities(entity, nestedEntities),
        );
        children.push(nestedNode as ASTInlineNode);
        currentOffset += entityText.length;
      } else {
        const nextEntity = nestedEntities.find(isOffsetGreater);
        const textEnd = nextEntity
          ? nextEntity.offset - startOffset
          : parentText.length;

        const plainText = parentText.slice(currentOffset, textEnd);
        if (plainText) {
          children.push(this.createTextNode(plainText) as ASTTextNode);
        }
        currentOffset = textEnd;
      }
    }

    return children;
  }

  private convertEntityToNode(
    entity: ApiMessageEntity,
    text: string,
    nestedEntities: ApiMessageEntity[],
  ): ASTNode {
    // In non-rich mode, only allow text and custom emoji
    if (!this.isRich) {
      if (entity.type === ApiMessageEntityTypes.CustomEmoji) {
        return {
          type: 'customEmoji',
          value: text,
          documentId: entity.documentId,
          raw: `[${text}](doc:${entity.documentId})`,
        };
      }
      return this.createTextNode(text);
    }

    switch (entity.type) {
      case ApiMessageEntityTypes.Bold:
        return this.createFormattedNode('bold', text, entity, nestedEntities, { start: '**', end: '**' });

      case ApiMessageEntityTypes.Italic:
        return this.createFormattedNode('italic', text, entity, nestedEntities, { start: '*', end: '*' });

      case ApiMessageEntityTypes.Underline:
        return this.createFormattedNode('underline', text, entity, nestedEntities, { start: '<u>', end: '</u>' });

      case ApiMessageEntityTypes.Strike:
        return this.createFormattedNode('strikethrough', text, entity, nestedEntities, { start: '~~', end: '~~' });

      case ApiMessageEntityTypes.Spoiler:
        return this.createFormattedNode('spoiler', text, entity, nestedEntities, { start: '||', end: '||' });

      case ApiMessageEntityTypes.Blockquote: {
        const children = nestedEntities.length > 0
          ? this.processNestedEntities(text, entity.offset, nestedEntities)
          : [this.createTextNode(text)];
        const childrenRaw = children.map((child) => child.raw).join('');
        return {
          type: 'quote',
          raw: `>${childrenRaw}`,
          children: children as ASTInlineNode[],
        };
      }

      case ApiMessageEntityTypes.Code:
        return {
          type: 'monospace',
          value: text,
          raw: `\`${text}\``,
        };

      case ApiMessageEntityTypes.Pre:
        return {
          type: 'pre',
          value: text,
          raw: `\`\`\`${entity.language || ''}\n${text}\n\`\`\``,
          language: entity.language,
          closed: true,
        };

      case ApiMessageEntityTypes.TextUrl: {
        const children = nestedEntities.length > 0
          ? this.processNestedEntities(text, entity.offset, nestedEntities)
          : [this.createTextNode(text)];
        const childrenRaw = children.map((child) => child.raw).join('');
        return {
          type: 'link',
          href: entity.url,
          raw: `[${childrenRaw}](${entity.url})`,
          children,
        };
      }

      case ApiMessageEntityTypes.MentionName: {
        const name = text.startsWith('@') ? text.slice(1) : text;

        return {
          type: 'mention',
          userId: entity.userId,
          raw: `[${name}](id:${entity.userId})`,
          value: name,
        };
      }

      case ApiMessageEntityTypes.CustomEmoji: {
        return {
          type: 'customEmoji',
          value: text,
          documentId: entity.documentId,
          raw: `[${text}](doc:${entity.documentId})`,
        };
      }

      default:
        return this.createTextNode(text);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  public fromAstToApiFormatted(ast: ASTNode): ApiFormattedText {
    let text = '';
    const entities: ApiMessageEntity[] = [];
    let currentOffset = 0;

    function processFormattedNode(
      node: ASTFormattingNode | ASTLinkNode,
      entityType: ApiMessageEntityTypes,
      extraProps: Partial<ApiMessageEntity> = {},
    ): { offset: number; length: number } {
      const startOffset = currentOffset;
      node.children?.forEach((child) => processNode(child));
      const length = currentOffset - startOffset;

      entities.push({
        type: entityType,
        offset: startOffset,
        length,
        ...extraProps,
      } as ApiMessageEntity);

      return { offset: startOffset, length };
    }

    processNode(ast);

    return {
      text,
      entities: entities.length > 0 ? entities : undefined,
    };

    function processNode(node: ASTNode) {
      switch (node.type) {
        case 'root': {
          // Process children with newlines between blocks
          node.children.forEach((child, index) => {
            processNode(child);
            if (index < node.children.length - 1) {
              text += '\n';
              currentOffset += 1;
            }
          });
          break;
        }

        case 'paragraph': {
          node.children.forEach((child) => {
            processNode(child);
          });
          break;
        }

        case 'quote': {
          const startOffset = currentOffset;
          node.children.forEach((child) => processNode(child));
          const length = currentOffset - startOffset;

          entities.push({
            type: ApiMessageEntityTypes.Blockquote,
            offset: startOffset,
            length,
          } as ApiMessageEntityBlockquote);
          break;
        }

        case 'pre': {
          const startOffset = currentOffset;
          text += node.value;
          const length = node.value.length;
          currentOffset += length;

          // Add newline after pre block
          currentOffset += 1;

          entities.push({
            type: ApiMessageEntityTypes.Pre,
            offset: startOffset,
            length,
            language: node.language,
          } as ApiMessageEntityPre);
          break;
        }

        case 'text': {
          text += node.value;
          currentOffset += node.value.length;
          break;
        }

        case 'bold':
        case 'italic':
        case 'underline':
        case 'strikethrough':
        case 'spoiler': {
          const typeMap = {
            bold: ApiMessageEntityTypes.Bold,
            italic: ApiMessageEntityTypes.Italic,
            underline: ApiMessageEntityTypes.Underline,
            strikethrough: ApiMessageEntityTypes.Strike,
            spoiler: ApiMessageEntityTypes.Spoiler,
          };
          processFormattedNode(node as ASTFormattingNode, typeMap[node.type]);
          break;
        }

        case 'link': {
          processFormattedNode(node as ASTLinkNode, ApiMessageEntityTypes.TextUrl, { url: node.href });
          break;
        }

        case 'mention': {
          const name = node.value;
          text += `@${name}`;
          const length = name.length + 1; // +1 for @
          entities.push({
            type: ApiMessageEntityTypes.MentionName,
            offset: currentOffset,
            length,
            userId: node.userId,
          } as ApiMessageEntityMentionName);
          currentOffset += length;
          break;
        }

        case 'monospace': {
          text += node.value;
          entities.push({
            type: ApiMessageEntityTypes.Code,
            offset: currentOffset,
            length: node.value.length,
          });
          currentOffset += node.value.length;
          break;
        }

        case 'customEmoji': {
          text += node.value;
          entities.push({
            type: ApiMessageEntityTypes.CustomEmoji,
            offset: currentOffset,
            length: node.value.length,
            documentId: node.documentId,
          });
          currentOffset += node.value.length;
          break;
        }
      }
    }
  }
}

function getNestedEntities(
  parentEntity: ApiMessageEntity,
  allEntities: ApiMessageEntity[],
): ApiMessageEntity[] {
  return allEntities.filter((e) => e.offset > parentEntity.offset
    && e.offset + e.length <= parentEntity.offset + parentEntity.length);
}
