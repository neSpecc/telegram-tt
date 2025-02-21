import type { ApiMessageEntityMentionName } from '../../../../api/types';
import type { ASTMentionNode, ASTNode, ASTRootNode } from './entities/ASTNode';
import { ApiMessageEntityTypes } from '../../../../api/types';

import { ApiFormattedParser } from './ApiFormattedParser';

describe('apiFormattedParser', () => {
  describe('fromApiFormattedToAst', () => {
    const parser = new ApiFormattedParser();

    it('should handle empty text', () => {
      const result = parser.fromApiFormattedToAst({ text: '', entities: [] });
      expect(result).toEqual({
        type: 'root',
        raw: '',
        children: [
          { type: 'paragraph', children: [], raw: '' },
        ],
      });
    });

    describe('line breaks', () => {
      it('should create paragraphs for \\n', () => {
        const result = parser.fromApiFormattedToAst({ text: 'Hello\nworld', entities: [] });
        expect(result).toEqual({
          type: 'root',
          raw: 'Hello\nworld',
          children: [
            { type: 'paragraph', children: [{ type: 'text', value: 'Hello', raw: 'Hello' }], raw: 'Hello' },
            { type: 'paragraph', children: [{ type: 'text', value: 'world', raw: 'world' }], raw: 'world' },
          ],
        });
      });

      it('should create paragraphs for \\n\\n', () => {
        const input = 'Hello\n\nworld';
        const result = parser.fromApiFormattedToAst({ text: input, entities: [] });
        expect(result).toEqual({
          type: 'root',
          raw: 'Hello\n\nworld',
          children: [
            { type: 'paragraph', children: [{ type: 'text', value: 'Hello', raw: 'Hello' }], raw: 'Hello' },
            { type: 'paragraph', children: [], raw: '' },
            { type: 'paragraph', children: [{ type: 'text', value: 'world', raw: 'world' }], raw: 'world' },
          ],
        });
      });

      it.each([
        ['\n', 2], // Unix
        ['\r\n', 2], // Windows
        ['\r', 2], // Legacy Mac
        ['\n\n', 3], // Double line break
        ['\r\n\r\n', 3], // Double Windows line break
      ])('should parse %s line break as a separate %s paragraph(s)', (input, expectedCount) => {
        const result = parser.fromApiFormattedToAst({ text: input, entities: [] });

        expect(result).toEqual<ASTRootNode>({
          type: 'root',
          raw: input.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
          children: Array.from({ length: expectedCount }, () => ({
            type: 'paragraph',
            raw: '',
            children: [],
          })),
        });
      });

      it('should parse trailing line break', () => {
        const input = 'line1\n';
        const result = parser.fromApiFormattedToAst({ text: input, entities: [] });

        expect(result).toEqual<ASTRootNode>({
          type: 'root',
          raw: 'line1\n',
          children: [
            { type: 'paragraph', raw: 'line1', children: [{ type: 'text', value: 'line1', raw: 'line1' }] },
            { type: 'paragraph', raw: '', children: [] },
          ],
        });
      });

      it('should parse consecutive line breaks', () => {
        const input = 'line1\n\nline2';
        const result = parser.fromApiFormattedToAst({ text: input, entities: [] });

        expect(result).toEqual<ASTRootNode>({
          type: 'root',
          raw: 'line1\n\nline2',
          children: [
            { type: 'paragraph', raw: 'line1', children: [{ type: 'text', value: 'line1', raw: 'line1' }] },
            { type: 'paragraph', raw: '', children: [] },
            { type: 'paragraph', raw: 'line2', children: [{ type: 'text', value: 'line2', raw: 'line2' }] },
          ],
        });
      });

      it('should not create extra paragraphs before pre blocks', () => {
        const input = 'line1\ncode';
        const result = parser.fromApiFormattedToAst({
          text: input,
          entities: [
            {
              type: ApiMessageEntityTypes.Pre,
              offset: 6,
              length: 4,
              language: '',
            },
          ],
        });

        expect(result).toEqual<ASTRootNode>({
          type: 'root',
          raw: 'line1\n```\ncode\n```',
          children: [
            { type: 'paragraph', raw: 'line1', children: [{ type: 'text', value: 'line1', raw: 'line1' }] },
            {
              type: 'pre', raw: '```\ncode\n```', value: 'code', language: '', closed: true,
            },
          ],
        });
      });

      it('should not create extra paragraphs before quote blocks', () => {
        const input = 'line1\nquote';
        const result = parser.fromApiFormattedToAst({
          text: input,
          entities: [
            {
              type: ApiMessageEntityTypes.Blockquote,
              offset: 6,
              length: 5,
            },
          ],
        });

        expect(result).toEqual<ASTRootNode>({
          type: 'root',
          raw: 'line1\n>quote',
          children: [
            { type: 'paragraph', raw: 'line1', children: [{ type: 'text', value: 'line1', raw: 'line1' }] },
            { type: 'quote', raw: '>quote', children: [{ type: 'text', value: 'quote', raw: 'quote' }] },
          ],
        });
      });

      it('should not create empty paragraph if text starts with quote', () => {
        const input = 'quote';
        const result = parser.fromApiFormattedToAst({
          text: input,
          entities: [
            {
              type: ApiMessageEntityTypes.Blockquote,
              offset: 0,
              length: 5,
            },
          ],
        });

        expect(result).toEqual<ASTRootNode>({
          type: 'root',
          raw: '>quote',
          children: [
            { type: 'quote', raw: '>quote', children: [{ type: 'text', value: 'quote', raw: 'quote' }] },
          ],
        });
      });

      it('should not create empty paragraph if text starts with pre', () => {
        const input = 'pre';
        const result = parser.fromApiFormattedToAst({
          text: input,
          entities: [
            {
              type: ApiMessageEntityTypes.Pre,
              offset: 0,
              length: 3,
              language: 'typescript',
            },
          ],
        });

        expect(result).toEqual<ASTRootNode>({
          type: 'root',
          raw: '```typescript\npre\n```',
          children: [
            {
              type: 'pre', raw: '```typescript\npre\n```', value: 'pre', language: 'typescript', closed: true,
            },
          ],
        });
      });
    });

    it('should handle plain text without entities', () => {
      const result = parser.fromApiFormattedToAst({ text: 'Hello world', entities: [] });
      expect(result).toEqual({
        type: 'root',
        raw: 'Hello world',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', value: 'Hello world', raw: 'Hello world' },
            ],
            raw: 'Hello world',
          },
        ],
      });
    });

    it('should handle single entity', () => {
      const result = parser.fromApiFormattedToAst({
        text: 'Hello bold world',
        entities: [{
          type: ApiMessageEntityTypes.Bold,
          offset: 6,
          length: 4,
        }],
      });

      expect(result).toEqual({
        type: 'root',
        raw: 'Hello **bold** world',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', value: 'Hello ', raw: 'Hello ' },
              {
                type: 'bold',
                raw: '**bold**',
                children: [{ type: 'text', value: 'bold', raw: 'bold' }],
              },
              { type: 'text', value: ' world', raw: ' world' },
            ],
            raw: 'Hello **bold** world',
          },
        ],
      });
    });

    it('should handle nested entities', () => {
      const result = parser.fromApiFormattedToAst({
        text: 'Hello bold italic world',
        entities: [
          {
            type: ApiMessageEntityTypes.Bold,
            offset: 6,
            length: 11,
          },
          {
            type: ApiMessageEntityTypes.Italic,
            offset: 11,
            length: 6,
          },
        ],
      });

      expect(result).toEqual({
        type: 'root',
        raw: 'Hello **bold *italic*** world',
        children: [
          {
            type: 'paragraph',
            raw: 'Hello **bold *italic*** world',
            children: [
              { type: 'text', value: 'Hello ', raw: 'Hello ' },
              {
                type: 'bold',
                raw: '**bold *italic***',
                children: [
                  { type: 'text', value: 'bold ', raw: 'bold ' },
                  {
                    type: 'italic',
                    raw: '*italic*',
                    children: [
                      { type: 'text', value: 'italic', raw: 'italic' },
                    ],
                  },
                ],
              },
              { type: 'text', value: ' world', raw: ' world' },
            ],
          },
        ],
      });
    });

    it('should handle code blocks with language', () => {
      const result = parser.fromApiFormattedToAst({
        text: 'Code:\nconst x = 42;',
        entities: [{
          type: ApiMessageEntityTypes.Pre,
          offset: 6,
          length: 13,
          language: 'typescript',
        }],
      });

      expect(result).toEqual({
        type: 'root',
        raw: 'Code:\n```typescript\nconst x = 42;\n```',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', value: 'Code:', raw: 'Code:' },
            ],
            raw: 'Code:',
          },
          {
            type: 'pre',
            value: 'const x = 42;',
            raw: '```typescript\nconst x = 42;\n```',
            language: 'typescript',
            closed: true,
          },
        ],
      } as ASTRootNode);
    });

    it('should handle code blocks with several lines', () => {
      const result = parser.fromApiFormattedToAst({
        text: 'Code:\nconst x = 42;\nconst y = 43;',
        entities: [{
          type: ApiMessageEntityTypes.Pre,
          offset: 6,
          length: 28,
          language: 'typescript',
        }],
      });

      expect(result).toEqual({
        type: 'root',
        raw: 'Code:\n```typescript\nconst x = 42;\nconst y = 43;\n```',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', value: 'Code:', raw: 'Code:' },
            ],
            raw: 'Code:',
          },
          {
            type: 'pre',
            value: 'const x = 42;\nconst y = 43;',
            raw: '```typescript\nconst x = 42;\nconst y = 43;\n```',
            language: 'typescript',
            closed: true,
          },
        ],
      } as ASTRootNode);
    });

    it('should handle links', () => {
      const result = parser.fromApiFormattedToAst({
        text: 'Click here for more',
        entities: [{
          type: ApiMessageEntityTypes.TextUrl,
          offset: 0,
          length: 10,
          url: 'https://example.com',
        }],
      });

      expect(result).toEqual({
        type: 'root',
        raw: '[Click here](https://example.com) for more',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                href: 'https://example.com',
                raw: '[Click here](https://example.com)',
                children: [{ type: 'text', value: 'Click here', raw: 'Click here' }],
              },
              { type: 'text', value: ' for more', raw: ' for more' },
            ],
            raw: '[Click here](https://example.com) for more',
          },
        ],
      });
    });

    it('should handle mentions', () => {
      const result = parser.fromApiFormattedToAst({
        text: 'Hello user!',
        entities: [{
          type: ApiMessageEntityTypes.MentionName,
          offset: 6,
          length: 4,
          userId: '123',
        }],
      });

      expect(result).toEqual({
        type: 'root',
        raw: 'Hello [user](id:123)!',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', value: 'Hello ', raw: 'Hello ' },
              {
                type: 'mention', userId: '123', raw: '[user](id:123)', value: 'user',
              },
              { type: 'text', value: '!', raw: '!' },
            ],
            raw: 'Hello [user](id:123)!',
          },
        ],
      });
    });

    it('should remove @ char from mentions', () => {
      const result = parser.fromApiFormattedToAst({
        text: 'Hello @user!',
        entities: [{
          type: ApiMessageEntityTypes.MentionName,
          offset: 6,
          length: 5,
          userId: '123',
        }],
      });

      expect(result).toEqual({
        type: 'root',
        raw: 'Hello [user](id:123)!',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', value: 'Hello ', raw: 'Hello ' },
              {
                type: 'mention', userId: '123', raw: '[user](id:123)', value: 'user',
              },
              { type: 'text', value: '!', raw: '!' },
            ],
            raw: 'Hello [user](id:123)!',
          },
        ],
      });
    });

    it('should handle overlapping entities by preferring longer ones', () => {
      const result = parser.fromApiFormattedToAst({
        text: 'Hello bold italic world',
        entities: [
          {
            type: ApiMessageEntityTypes.Italic,
            offset: 11,
            length: 6,
          },
          {
            type: ApiMessageEntityTypes.Bold,
            offset: 6,
            length: 11,
          },
        ],
      });

      // Bold entity should take precedence as it's longer
      expect(result).toEqual({
        type: 'root',
        raw: 'Hello **bold *italic*** world',
        children: [
          {
            type: 'paragraph',
            raw: 'Hello **bold *italic*** world',
            children: [
              { type: 'text', value: 'Hello ', raw: 'Hello ' },
              {
                type: 'bold',
                raw: '**bold *italic***',
                children: [{ type: 'text', value: 'bold ', raw: 'bold ' }, {
                  type: 'italic',
                  raw: '*italic*',
                  children: [{ type: 'text', value: 'italic', raw: 'italic' }],
                }],
              },
              { type: 'text', value: ' world', raw: ' world' },
            ],
          },
        ],
      });
    });

    it('should handle underline', () => {
      const result = parser.fromApiFormattedToAst({
        text: 'Hello underlined text',
        entities: [{
          type: ApiMessageEntityTypes.Underline,
          offset: 6,
          length: 10,
        }],
      });

      expect(result).toEqual({
        type: 'root',
        raw: 'Hello <u>underlined</u> text',
        children: [{
          type: 'paragraph',
          raw: 'Hello <u>underlined</u> text',
          children: [
            { type: 'text', value: 'Hello ', raw: 'Hello ' },
            {
              type: 'underline',
              raw: '<u>underlined</u>',
              children: [{ type: 'text', value: 'underlined', raw: 'underlined' }],
            },
            { type: 'text', value: ' text', raw: ' text' },
          ],
        }],
      });
    });

    it('should handle spoiler', () => {
      const result = parser.fromApiFormattedToAst({
        text: 'Contains spoiler text here',
        entities: [{
          type: ApiMessageEntityTypes.Spoiler,
          offset: 9,
          length: 7,
        }],
      });

      expect(result).toEqual({
        type: 'root',
        raw: 'Contains ||spoiler|| text here',
        children: [{
          type: 'paragraph',
          raw: 'Contains ||spoiler|| text here',
          children: [
            { type: 'text', value: 'Contains ', raw: 'Contains ' },
            {
              type: 'spoiler',
              raw: '||spoiler||',
              children: [{ type: 'text', value: 'spoiler', raw: 'spoiler' }],
            },
            { type: 'text', value: ' text here', raw: ' text here' },
          ],
        }],
      });
    });

    it('should handle strikethrough', () => {
      const result = parser.fromApiFormattedToAst({
        text: 'Some struck text here',
        entities: [{
          type: ApiMessageEntityTypes.Strike,
          offset: 5,
          length: 6,
        }],
      });

      expect(result).toEqual({
        type: 'root',
        raw: 'Some ~~struck~~ text here',
        children: [{
          type: 'paragraph',
          raw: 'Some ~~struck~~ text here',
          children: [
            { type: 'text', value: 'Some ', raw: 'Some ' },
            {
              type: 'strikethrough',
              raw: '~~struck~~',
              children: [{ type: 'text', value: 'struck', raw: 'struck' }],
            },
            { type: 'text', value: ' text here', raw: ' text here' },
          ],
        }],
      });
    });

    it('should handle blockquote', () => {
      const result = parser.fromApiFormattedToAst({
        text: 'Regular text\nQuoted text\nMore regular',
        entities: [{
          type: ApiMessageEntityTypes.Blockquote,
          offset: 13,
          length: 11,
        }],
      });

      expect(result).toEqual({
        type: 'root',
        raw: 'Regular text\n>Quoted text\nMore regular',
        children: [
          {
            type: 'paragraph',
            raw: 'Regular text',
            children: [{ type: 'text', value: 'Regular text', raw: 'Regular text' }],
          },
          {
            type: 'quote',
            raw: '>Quoted text',
            children: [{ type: 'text', value: 'Quoted text', raw: 'Quoted text' }],
          },
          {
            type: 'paragraph',
            raw: 'More regular',
            children: [{ type: 'text', value: 'More regular', raw: 'More regular' }],
          },
        ],
      });
    });

    it('should handle nested formatting in blockquote', () => {
      const result = parser.fromApiFormattedToAst({
        text: 'Quote with bold text',
        entities: [
          {
            type: ApiMessageEntityTypes.Blockquote,
            offset: 0,
            length: 20,
          },
          {
            type: ApiMessageEntityTypes.Bold,
            offset: 11,
            length: 4,
          },
        ],
      });

      expect(result).toEqual({
        type: 'root',
        raw: '>Quote with **bold** text',
        children: [{
          type: 'quote',
          raw: '>Quote with **bold** text',
          children: [
            { type: 'text', value: 'Quote with ', raw: 'Quote with ' },
            {
              type: 'bold',
              raw: '**bold**',
              children: [{ type: 'text', value: 'bold', raw: 'bold' }],
            },
            { type: 'text', value: ' text', raw: ' text' },
          ],
        }],
      });
    });

    it.skip('should handle custom emoji', () => {
      const result = parser.fromApiFormattedToAst({
        text: 'Hello 😀!',
        entities: [{
          type: ApiMessageEntityTypes.CustomEmoji,
          offset: 6,
          length: 1,
          documentId: '5062301574668222465',
        }],
      });

      expect(result).toEqual({
        type: 'root',
        raw: 'Hello [😀](doc:5062301574668222465)!',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', value: 'Hello ', raw: 'Hello ' },
              {
                type: 'customEmoji', documentId: '5062301574668222465', raw: '[😀](doc:5062301574668222465)', value: '😀',
              },
              { type: 'text', value: '!', raw: '!' },
            ],
            raw: 'Hello [😀](doc:5062301574668222465)!',
          },
        ],
      });
    });
  });

  describe('fromAstToApiFormatted', () => {
    const parser = new ApiFormattedParser();

    it('should return plain text without entities', () => {
      const node: ASTNode = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'Hello world', raw: 'Hello world' }],
            raw: 'Hello world',
          },
        ],
        raw: 'Hello world',
      };

      const result = parser.fromAstToApiFormatted(node);

      expect(result.text).toEqual('Hello world');
      expect(result.entities).toBeUndefined();
    });

    it('should handle basic formatting', () => {
      const node: ASTNode = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'bold',
                children: [{ type: 'text', value: 'bold text', raw: 'bold text' }],
                raw: '**bold text**',
              },
            ],
            raw: '**bold text**',
          },
        ],
        raw: '**bold text**',
      };

      const result = parser.fromAstToApiFormatted(node);

      expect(result.text).toEqual('bold text');
      expect(result.entities).toEqual([{
        type: ApiMessageEntityTypes.Bold,
        offset: 0,
        length: 9,
      }]);
    });

    it('should handle nested formatting', () => {
      const node: ASTNode = {
        type: 'root',
        raw: '**bold *italic***',
        children: [{
          type: 'bold',
          children: [
            { type: 'text', value: 'bold ', raw: 'bold ' },
            {
              type: 'italic',
              children: [{ type: 'text', value: 'italic', raw: 'italic' }],
              raw: '*italic*',
            },
          ],
          raw: '**bold *italic***',
        }],
      };
      expect(parser.fromAstToApiFormatted(node)).toEqual({
        text: 'bold italic',
        entities: [
          {
            type: ApiMessageEntityTypes.Italic,
            offset: 5,
            length: 6,
          },
          {
            type: ApiMessageEntityTypes.Bold,
            offset: 0,
            length: 11,
          },
        ],
      });
    });

    it('should handle links', () => {
      const node: ASTNode = {
        type: 'root',
        raw: '[link text](https://example.com)',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                href: 'https://example.com',
                children: [{ type: 'text', value: 'link text', raw: 'link text' }],
                raw: '[link text](https://example.com)',
              },
            ],
            raw: '[link text](https://example.com)',
          },
        ],
      };
      expect(parser.fromAstToApiFormatted(node)).toEqual({
        text: 'link text',
        entities: [{
          type: ApiMessageEntityTypes.TextUrl,
          offset: 0,
          length: 9,
          url: 'https://example.com',
        }],
      });
    });

    it('should handle code blocks with language', () => {
      const node: ASTNode = {
        type: 'root',
        raw: '```typescript\nconst x = 42;\n```',
        children: [{
          type: 'pre',
          language: 'typescript',
          value: 'const x = 42;',
          raw: '```typescript\nconst x = 42;\n```',
          closed: true,
        }],
      };
      expect(parser.fromAstToApiFormatted(node)).toEqual({
        text: 'const x = 42;',
        entities: [{
          type: ApiMessageEntityTypes.Pre,
          offset: 0,
          length: 13,
          language: 'typescript',
        }],
      });
    });

    it('should handle mentions', () => {
      const node: ASTNode = {
        type: 'root',
        raw: '[user](id:2211234)',
        children: [
          {
            type: 'paragraph',
            children: [{
              type: 'mention',
              userId: '2211234',
              raw: '[user](id:2211234)',
              value: 'user',
            } as ASTMentionNode],
            raw: '[user](id:2211234)',
          },
        ],
      };
      expect(parser.fromAstToApiFormatted(node)).toEqual({
        text: '@user',
        entities: [{
          type: ApiMessageEntityTypes.MentionName,
          offset: 0,
          length: 5,
          userId: '2211234',
        } as ApiMessageEntityMentionName],
      });
    });

    // it('should handle mention with empty username', () => {
    //   const node: ASTNode = {
    //     type: 'root',
    //     raw: '@',
    //     children: [
    //       {
    //         type: 'paragraph',
    //         children: [{
    //           type: 'mention',
    //           username: '',
    //           raw: '@',
    //         }],
    //         raw: '@',
    //       },
    //     ],
    //   };
    //   expect(parser.fromAstToApiFormatted(node)).toEqual({
    //     text: '@',
    //     entities: [{
    //       type: ApiMessageEntityTypes.MentionName,
    //       offset: 0,
    //       length: 1,
    //       userId: '',
    //     } as ApiMessageEntityMentionName],
    //   });
    // });

    it('should handle multiple blocks with newlines', () => {
      const node: ASTNode = {
        type: 'root',
        raw: 'first\nsecond',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'first', raw: 'first' }],
            raw: 'first',
          },
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'second', raw: 'second' }],
            raw: 'second',
          },
        ],
      };
      expect(parser.fromAstToApiFormatted(node)).toEqual({
        text: 'first\nsecond',
        entities: undefined,
      });
    });

    it('should handle empty tree', () => {
      const node: ASTNode = {
        type: 'root',
        raw: '',
        children: [],
      };
      expect(parser.fromAstToApiFormatted(node)).toEqual({
        text: '',
        entities: undefined,
      });
    });

    it('should handle complex cases', () => {
      const node: ASTNode = {
        type: 'root',
        raw: 'regular text **bold [link](https://example.com)** \n some *italic* text',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', value: 'regular text ', raw: 'regular text ' },
              {
                type: 'bold',
                children: [
                  { type: 'text', value: 'bold ', raw: 'bold ' },
                  {
                    type: 'link',
                    href: 'https://example.com',
                    children: [{ type: 'text', value: 'link', raw: 'link' }],
                    raw: '[link](https://example.com)',
                  },
                ],
                raw: '**bold [link](https://example.com)**',
              },
            ],
            raw: 'regular text **bold [link](https://example.com)**',
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', value: ' some ', raw: ' some ' },
              { type: 'italic', children: [{ type: 'text', value: 'italic', raw: 'italic' }], raw: '*italic*' },
              { type: 'text', value: ' text', raw: ' text' },
            ],
            raw: 'some *italic* text',
          },
        ],
      };
      expect(parser.fromAstToApiFormatted(node)).toEqual({
        text: 'regular text bold link\n some italic text',
        entities: [
          {
            type: ApiMessageEntityTypes.TextUrl, offset: 18, length: 4, url: 'https://example.com',
          },
          { type: ApiMessageEntityTypes.Bold, offset: 13, length: 9 },
          { type: ApiMessageEntityTypes.Italic, offset: 29, length: 6 },
        ],
      });
    });

    it('should handle underline', () => {
      const node: ASTNode = {
        type: 'root',
        raw: '<u>underlined</u>',
        children: [{
          type: 'paragraph',
          children: [{
            type: 'underline',
            children: [
              { type: 'text', value: 'underlined', raw: 'underlined' },
            ],
            raw: '<u>underlined</u>',
          }],
          raw: '<u>underlined</u>',
        }],
      };

      expect(parser.fromAstToApiFormatted(node)).toEqual({
        text: 'underlined',
        entities: [{ type: ApiMessageEntityTypes.Underline, offset: 0, length: 10 }],
      });
    });

    it('should handle spoiler', () => {
      const node: ASTNode = {
        type: 'root',
        raw: '||spoiler||',
        children: [{
          type: 'paragraph',
          children: [{
            type: 'spoiler',
            children: [
              { type: 'text', value: 'spoiler', raw: 'spoiler' },
            ],
            raw: '||spoiler||',
          }],
          raw: '||spoiler||',
        }],
      };

      expect(parser.fromAstToApiFormatted(node)).toEqual({
        text: 'spoiler',
        entities: [{ type: ApiMessageEntityTypes.Spoiler, offset: 0, length: 7 }],
      });
    });

    it('should handle strikethrough', () => {
      const node: ASTNode = {
        type: 'root',
        raw: '~~strikethrough~~',
        children: [{
          type: 'paragraph',
          children: [{
            type: 'strikethrough',
            children: [
              { type: 'text', value: 'strikethrough', raw: 'strikethrough' },
            ],
            raw: '~~strikethrough~~',
          }],
          raw: '~~strikethrough~~',
        }],
      };

      expect(parser.fromAstToApiFormatted(node)).toEqual({
        text: 'strikethrough',
        entities: [{ type: ApiMessageEntityTypes.Strike, offset: 0, length: 13 }],
      });
    });

    it('should handle complex case', () => {
      const node: ASTRootNode = {
        type: 'root',
        raw: 'line1\n```js\ncode\n```\n>quote\nline4',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'line1', raw: 'line1' }],
            raw: 'line1',
          },
          {
            type: 'pre',
            language: 'js',
            value: 'code',
            raw: '```js\ncode\n```',
            closed: true,
          },
          {
            type: 'quote',
            children: [{ type: 'text', value: 'quote', raw: 'quote' }],
            raw: '>quote',
          },
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'line4', raw: 'line4' }],
            raw: 'line4',
          },
        ],
      };

      expect(parser.fromAstToApiFormatted(node)).toEqual({
        text: 'line1\ncode\nquote\nline4',
        entities: [
          {
            type: ApiMessageEntityTypes.Pre, offset: 6, length: 4, language: 'js',
          },
          { type: ApiMessageEntityTypes.Blockquote, offset: 12, length: 5 },
        ],
      });
    });

    it('should handle custom emoji in fromAstToApiFormatted', () => {
      const node: ASTNode = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', value: 'Hello ', raw: 'Hello ' },
              {
                type: 'customEmoji', documentId: '5062301574668222465', raw: '[😀](doc:5062301574668222465)', value: '😀',
              },
              { type: 'text', value: '!', raw: '!' },
            ],
            raw: 'Hello [😀](doc:5062301574668222465)!',
          },
        ],
        raw: 'Hello [😀](doc:5062301574668222465)!',
      };

      const result = parser.fromAstToApiFormatted(node);

      expect(result.text).toEqual('Hello 😀!');
      expect(result.entities).toEqual([{
        type: ApiMessageEntityTypes.CustomEmoji,
        offset: 6,
        length: 2,
        documentId: '5062301574668222465',
      }]);
    });
  });
});
