import type { BlockToken } from './entities/Token';
import { BlockTokenizer } from './BlockTokenizer';

describe('blockTokenizer', () => {
  const tokenize = (input: string) => new BlockTokenizer(input).tokenize();

  describe('paragraph', () => {
    it('should parse plain text to paragraph', () => {
      const input = 'Hello world';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        { type: 'paragraph', raw: 'Hello world', content: 'Hello world', tokens: [] },
      ]);
    });

    it('should parse multiline text to several paragraphs', () => {
      const input = 'Hello world\nSecond line';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        { type: 'paragraph', raw: 'Hello world', content: 'Hello world', tokens: [] },
        { type: 'paragraph', raw: 'Second line', content: 'Second line', tokens: [] },
      ]);
    });

    it('should handle empty string input', () => {
      const input = '';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([]);
    });

    it('should handle string with only spaces', () => {
      const input = '   ';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        { type: 'paragraph', raw: '   ', content: '   ', tokens: [] },
      ]);
    });

    it('should preserve spaces around content', () => {
      const input = '  Hello  world  ';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        { type: 'paragraph', raw: '  Hello  world  ', content: '  Hello  world  ', tokens: [] },
      ]);
    });

    it('should handle multiple spaces between paragraphs', () => {
      const input = 'First\n  \nSecond';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        { type: 'paragraph', raw: 'First', content: 'First', tokens: [] },
        { type: 'paragraph', raw: '  ', content: '  ', tokens: [] },
        { type: 'paragraph', raw: 'Second', content: 'Second', tokens: [] },
      ]);
    });

    it('should handle string starting with newline', () => {
      const input = '\nHello';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        { type: 'paragraph', raw: '', content: '', tokens: [] },
        { type: 'paragraph', raw: 'Hello', content: 'Hello', tokens: [] },
      ]);
    });
  });

  describe('line breaks', () => {
    it.each([
      ['\n', 2], // Unix
      ['\r\n', 2], // Windows
      ['\r', 2], // Legacy Mac
      ['\n\n', 3], // Double line break
      ['\r\n\r\n', 3], // Double Windows line break
    ])('should parse %s line break as a separate %s paragraph(s)', (input, expectedCount) => {
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>(
        Array.from({ length: expectedCount }, () => ({ type: 'paragraph', raw: '', content: '', tokens: [] })),
      );
    });

    it('should parse trailing line break', () => {
      const input = 'line1\n';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        { type: 'paragraph', raw: 'line1', content: 'line1', tokens: [] },
        { type: 'paragraph', raw: '', content: '', tokens: [] },
      ]);
    });

    it('should parse consecutive line breaks', () => {
      const input = 'line1\n\nline2';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        { type: 'paragraph', raw: 'line1', content: 'line1', tokens: [] },
        { type: 'paragraph', raw: '', content: '', tokens: [] },
        { type: 'paragraph', raw: 'line2', content: 'line2', tokens: [] },
      ]);
    });
  });

  describe('pre blocks', () => {
    it('should parse pre block without language', () => {
      const input = '```\ncode here\n```';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        {
          type: 'pre',
          raw: '```\ncode here\n```',
          content: 'code here',
          language: undefined,
          tokens: [],
          closed: true,
        },
      ]);
    });

    it('should parse pre block with language', () => {
      const input = '```typescript\nconst x = 1;\n```';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        {
          type: 'pre',
          raw: '```typescript\nconst x = 1;\n```',
          content: 'const x = 1;',
          language: 'typescript',
          tokens: [],
          closed: true,
        },
      ]);
    });

    it('should handle empty pre block', () => {
      const input = '```\n```';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        {
          type: 'pre',
          raw: '```\n```',
          content: '',
          language: undefined,
          tokens: [],
          closed: true,
        },
      ]);
    });

    it('should handle pre block with empty language', () => {
      const input = '```\nsome code\n```';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        {
          type: 'pre',
          raw: '```\nsome code\n```',
          content: 'some code',
          language: undefined,
          tokens: [],
          closed: true,
        },
      ]);
    });

    it('should handle multiple pre blocks', () => {
      const input = '```js\ncode1\n```\ntext\n```python\ncode2\n```';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        {
          type: 'pre',
          raw: '```js\ncode1\n```',
          content: 'code1',
          language: 'js',
          tokens: [],
          closed: true,
        },
        {
          type: 'paragraph',
          raw: 'text',
          content: 'text',
          tokens: [],
        },
        {
          type: 'pre',
          raw: '```python\ncode2\n```',
          content: 'code2',
          language: 'python',
          tokens: [],
          closed: true,
        },
      ]);
    });

    it('should preserve newlines in pre block content', () => {
      const input = '```\nline1\nline2\nline3\n```';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        {
          type: 'pre',
          raw: '```\nline1\nline2\nline3\n```',
          content: 'line1\nline2\nline3',
          language: undefined,
          tokens: [],
          closed: true,
        },
      ]);
    });

    it('should handle pre block with backticks in content', () => {
      const input = '```\ncode with ` backtick\n```';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        {
          type: 'pre',
          raw: '```\ncode with ` backtick\n```',
          content: 'code with ` backtick',
          language: undefined,
          tokens: [],
          closed: true,
        },
      ]);
    });

    it('should handle pre block with markdown formatting inside', () => {
      const input = '```\n**bold** and *italic*\n```';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        {
          type: 'pre',
          raw: '```\n**bold** and *italic*\n```',
          content: '**bold** and *italic*',
          language: undefined,
          tokens: [],
          closed: true,
        },
      ]);
    });

    it('should not greedy override following text', () => {
      const input = '```\nline1\nline2\n```\nline3';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        { type: 'pre', raw: '```\nline1\nline2\n```', content: 'line1\nline2', language: undefined, tokens: [], closed: true },
        { type: 'paragraph', raw: 'line3', content: 'line3', tokens: [] },
      ]);
    });

    describe('edge cases', () => {
      it('should handle unclosed pre block', () => {
        const input = '```typescript\ncode without closing';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'pre',
            raw: '```typescript\ncode without closing',
            content: 'code without closing',
            language: 'typescript',
            tokens: [],
            closed: false,
          },
        ]);
      });

      it('should handle pre block with only language', () => {
        const input = '```typescript\n```';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'pre',
            raw: '```typescript\n```',
            content: '',
            language: 'typescript',
            tokens: [],
            closed: true,
          },
        ]);
      });

      it('should handle pre block starting with newlines', () => {
        const input = '```\n\n\ncode\n```';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'pre',
            raw: '```\n\n\ncode\n```',
            content: '\n\ncode',
            language: undefined,
            tokens: [],
            closed: true,
          },
        ]);
      });

      it('should handle linebreak after empty language', () => {
        const input = '```\n\n```';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'pre',
            raw: '```\n\n```',
            content: '\n',
            language: undefined,
            tokens: [],
            closed: true,
          },
        ]);
      });

      it('should handle linebreak after non-empty language', () => {
        const input = '```ts\n\n```';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'pre',
            raw: '```ts\n\n```',
            content: '\n',
            language: 'ts',
            tokens: [],
            closed: true,
          },
        ]);
      });

      it('should not close pre block if closing chars on the same line', () => {
        const input = '```typescript\ncode```';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'pre',
            raw: '```typescript\ncode```',
            content: 'code```',
            language: 'typescript',
            tokens: [],
            closed: false,
          },
        ]);
      });

      it('should not render pre block if last tick of opening backticks has been deleted', () => {
        const input = '``typescript\ncode```';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'paragraph',
            raw: '``typescript',
            content: '``typescript',
            tokens: [],
          },
          {
            type: 'paragraph',
            raw: 'code',
            content: 'code',
            tokens: [],
          },
          {
            type: 'pre',
            raw: '```',
            content: '',
            language: undefined,
            tokens: [],
            closed: false,
          },
        ]);
      });
    });
  });

  describe('quote blocks', () => {
    it('should parse quote block with plain text', () => {
      const input = '>quoted text';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        {
          type: 'quote',
          raw: '>quoted text',
          content: 'quoted text',
          tokens: [],
        },
      ]);
    });

    it('should handle empty quote block', () => {
      const input = '>';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        {
          type: 'quote',
          raw: '>',
          content: '',
          tokens: [],
        },
      ]);
    });

    it('should handle quote block with only spaces', () => {
      const input = '>   ';
      const tokens = tokenize(input);

      expect(tokens).toEqual<BlockToken[]>([
        {
          type: 'quote',
          raw: '>   ',
          content: '   ',
          tokens: [],
        },
      ]);
    });

    describe('quote line breaks', () => {
      it('should parse multiple lines with > as a separate quote blocks', () => {
        const input = '>line 1\n>line 2';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'quote',
            raw: '>line 1',
            content: 'line 1',
            tokens: [],
          },
          {
            type: 'quote',
            raw: '>line 2',
            content: 'line 2',
            tokens: [],
          },
        ]);
      });
      it('should break quote by linebreak', () => {
        const input = '>line 1\nline2';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'quote',
            raw: '>line 1',
            content: 'line 1',
            tokens: [],
          },
          {
            type: 'paragraph',
            raw: 'line2',
            content: 'line2',
            tokens: [],
          },
        ]);
      });
      // it('should break quote ended by 2 linebreaks', () => {
      //   const input = '>line 1\n\n';
      //   const tokens = tokenize(input);

      //   expect(tokens).toEqual<BlockToken[]>([
      //     {
      //       type: 'quote',
      //       raw: '>line 1\n',
      //       content: 'line 1\n',
      //       tokens: [],
      //     },
      //     {
      //       type: 'paragraph',
      //       raw: '',
      //       content: '',
      //       tokens: [],
      //     },
      //   ]);
      // });
      // it('should support internal line breaks', () => {
      //   const input = '>quote\ntext';
      //   const tokens = tokenize(input);

      //   expect(tokens).toEqual<BlockToken[]>([
      //     {
      //       type: 'quote',
      //       raw: '>quote\ntext',
      //       content: 'quote\ntext',
      //       tokens: [],
      //     },
      //   ]);
      // });
      it('should handle multiple quote blocks separated by 2 newlines', () => {
        const input = '>quote 1\n\n>quote 2';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'quote',
            raw: '>quote 1',
            content: 'quote 1',
            tokens: [],
          },
          {
            type: 'paragraph',
            raw: '',
            content: '',
            tokens: [],
          },
          {
            type: 'quote',
            raw: '>quote 2',
            content: 'quote 2',
            tokens: [],
          },
        ]);
      });
      it('should not add empty paragraph between text and quote', () => {
        const input = '1\n>1';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'paragraph',
            raw: '1',
            content: '1',
            tokens: [],
          },
          {
            type: 'quote',
            raw: '>1',
            content: '1',
            tokens: [],
          },
        ]);
      });

      it('should not remove empty paragraph between text and quote in case of \\n\\n', () => {
        const input = '1\n\n>';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'paragraph',
            raw: '1',
            content: '1',
            tokens: [],
          },
          {
            type: 'paragraph',
            raw: '',
            content: '',
            tokens: [],
          },
          {
            type: 'quote',
            raw: '>',
            content: '',
            tokens: [],
          },
        ]);
      });

      it('should allow creating lines after quote', () => {
        const input = '>\n\n';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'quote',
            raw: '>',
            content: '',
            tokens: [],
          },
          {
            type: 'paragraph',
            raw: '',
            content: '',
            tokens: [],
          },
          {
            type: 'paragraph',
            raw: '',
            content: '',
            tokens: [],
          },
        ]);
      });

      it('should not remove empty paragraph between | quote text empty quote |', () => {
        const input = '>\n1\n\n>';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'quote',
            raw: '>',
            content: '',
            tokens: [],
          },
          {
            type: 'paragraph',
            raw: '1',
            content: '1',
            tokens: [],
          },
          {
            type: 'paragraph',
            raw: '',
            content: '',
            tokens: [],
          },
          {
            type: 'quote',
            raw: '>',
            content: '',
            tokens: [],
          },
        ]);
      });
    });

    describe('edge cases', () => {
      it('should handle quote block with multiple spaces after >', () => {
        const input = '>    spaced text';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'quote',
            raw: '>    spaced text',
            content: '    spaced text',
            tokens: [],
          },
        ]);
      });

      it('should handle quote block with > on the same line', () => {
        const input = '> > spaced text';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'quote',
            raw: '> > spaced text',
            content: ' > spaced text',
            tokens: [],
          },
        ]);
      });

      it('should handle >>> as a single quote block', () => {
        const input = '>>> spaced text';
        const tokens = tokenize(input);

        expect(tokens).toEqual<BlockToken[]>([
          {
            type: 'quote',
            raw: '>>> spaced text',
            content: '>> spaced text',
            tokens: [],
          },
        ]);
      });
    });
  });
});
