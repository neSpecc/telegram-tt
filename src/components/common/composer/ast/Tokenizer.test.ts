import type { BlockToken } from './entities/Token';
import { tokenize } from './Tokenizer';

describe('tokenizer', () => {
  describe('paragraphs', () => {
    it('should parse single paragraph with plain text', () => {
      const input = 'Hello world';
      expect(tokenize(input)).toEqual<BlockToken[]>([
        {
          type: 'paragraph',
          raw: 'Hello world',
          content: 'Hello world',
          tokens: [
            { type: 'text', value: 'Hello world', raw: 'Hello world' },
          ],
        },
      ]);
    });

    it('should parse paragraph with inline formatting', () => {
      const input = 'Hello **bold** and *italic* text';
      expect(tokenize(input)).toEqual<BlockToken[]>([
        {
          type: 'paragraph',
          raw: 'Hello **bold** and *italic* text',
          content: 'Hello **bold** and *italic* text',
          tokens: [
            { type: 'text', value: 'Hello ', raw: 'Hello ' },
            { type: 'bold', raw: '**' },
            { type: 'text', value: 'bold', raw: 'bold' },
            { type: 'bold', raw: '**' },
            { type: 'text', value: ' and ', raw: ' and ' },
            { type: 'italic', raw: '*' },
            { type: 'text', value: 'italic', raw: 'italic' },
            { type: 'italic', raw: '*' },
            { type: 'text', value: ' text', raw: ' text' },
          ],
        },
      ]);
    });
  });

  describe('quotes', () => {
    it('should parse quote block with plain text', () => {
      const input = '>quoted text';
      expect(tokenize(input)).toEqual<BlockToken[]>([
        {
          type: 'quote',
          raw: '>quoted text',
          content: 'quoted text',
          tokens: [
            { type: 'text', value: 'quoted text', raw: 'quoted text' },
          ],
        },
      ]);
    });

    it('should parse quote block with formatting', () => {
      const input = '> quoted **bold** text';
      expect(tokenize(input)).toEqual<BlockToken[]>([
        {
          type: 'quote',
          raw: '> quoted **bold** text',
          content: ' quoted **bold** text',
          tokens: [
            { type: 'text', value: ' quoted ', raw: ' quoted ' },
            { type: 'bold', raw: '**' },
            { type: 'text', value: 'bold', raw: 'bold' },
            { type: 'bold', raw: '**' },
            { type: 'text', value: ' text', raw: ' text' },
          ],
        },
      ]);
    });

    it('should parse multiline quote', () => {
      const input = '>line 1\n>line 2';
      expect(tokenize(input)).toEqual<BlockToken[]>([
        {
          type: 'quote',
          raw: '>line 1',
          content: 'line 1',
          tokens: [
            { type: 'text', value: 'line 1', raw: 'line 1' },
          ],
        },
        {
          type: 'quote',
          raw: '>line 2',
          content: 'line 2',
          tokens: [
            { type: 'text', value: 'line 2', raw: 'line 2' },
          ],
        },
      ]);
    });
  });

  describe('code blocks', () => {
    it('should parse code block without language', () => {
      const input = '```\ncode here\n```';
      expect(tokenize(input)).toEqual<BlockToken[]>([
        {
          type: 'pre',
          raw: '```\ncode here\n```',
          content: 'code here',
          language: undefined,
          closed: true,
          tokens: [
            { type: 'text', value: 'code here', raw: 'code here' },
          ],
        },
      ]);
    });

    it('should parse code block with language', () => {
      const input = '```typescript\nconst x = 1;\n```';
      expect(tokenize(input)).toEqual<BlockToken[]>([
        {
          type: 'pre',
          raw: '```typescript\nconst x = 1;\n```',
          content: 'const x = 1;',
          language: 'typescript',
          closed: true,
          tokens: [
            { type: 'text', value: 'const x = 1;', raw: 'const x = 1;' },
          ],
        },
      ]);
    });

    it('should not parse formatting inside code block', () => {
      const input = '```\n**bold** and *italic*\n```';
      expect(tokenize(input)).toEqual<BlockToken[]>([
        {
          type: 'pre',
          raw: '```\n**bold** and *italic*\n```',
          content: '**bold** and *italic*',
          language: undefined,
          closed: true,
          tokens: [
            { type: 'text', value: '**bold** and *italic*', raw: '**bold** and *italic*' },
          ],
        },
      ]);
    });

    it('should not close pre block if closing backticks are deleted', () => {
      const input = '``\n```';
      expect(tokenize(input)).toEqual<BlockToken[]>([
        {
          type: 'paragraph',
          raw: '``',
          content: '``',
          tokens: [{ type: 'text', value: '``', raw: '``' }],
        },
        { type: 'pre', raw: '```', closed: false, content: '', language: undefined, tokens: [] },
      ]);
    });
  });

  describe('mixed content', () => {
    it('should parse mixed blocks', () => {
      const input = 'Normal text\n> quote\n```\ncode\n```';
      expect(tokenize(input)).toEqual<BlockToken[]>([
        {
          type: 'paragraph',
          raw: 'Normal text',
          content: 'Normal text',
          tokens: [{ type: 'text', value: 'Normal text', raw: 'Normal text' }],
        },
        {
          type: 'quote',
          raw: '> quote',
          content: ' quote',
          tokens: [{ type: 'text', value: ' quote', raw: ' quote' }],
        },
        {
          type: 'pre',
          raw: '```\ncode\n```',
          content: 'code',
          language: undefined,
          closed: true,
          tokens: [{ type: 'text', value: 'code', raw: 'code' }],
        },
      ]);
    });

    it('should parse complex formatting', () => {
      const input = 'Text with **bold *nested italic* content**';
      expect(tokenize(input)).toEqual<BlockToken[]>([
        {
          type: 'paragraph',
          raw: 'Text with **bold *nested italic* content**',
          content: 'Text with **bold *nested italic* content**',
          tokens: [
            { type: 'text', value: 'Text with ', raw: 'Text with ' },
            { type: 'bold', raw: '**' },
            { type: 'text', value: 'bold ', raw: 'bold ' },
            { type: 'italic', raw: '*' },
            { type: 'text', value: 'nested italic', raw: 'nested italic' },
            { type: 'italic', raw: '*' },
            { type: 'text', value: ' content', raw: ' content' },
            { type: 'bold', raw: '**' },
          ],
        },
      ]);
    });

    it('should handle empty blocks', () => {
      const input = '\n>\n```\n```\n';
      expect(tokenize(input)).toEqual<BlockToken[]>([
        { type: 'paragraph', raw: '', content: '', tokens: [] },
        { type: 'quote', raw: '>', content: '', tokens: [] },
        { type: 'pre', raw: '```\n```', closed: true, content: '', language: undefined, tokens: [] },
        { type: 'paragraph', raw: '', content: '', tokens: [] },
      ]);
    });
  });

  describe('special cases', () => {
    it('should handle empty input', () => {
      expect(tokenize('')).toEqual([]);
    });

    it('should handle only whitespace', () => {
      expect(tokenize('   ')).toEqual<BlockToken[]>([
        {
          type: 'paragraph',
          content: '   ',
          raw: '   ',
          tokens: [{ type: 'text', value: '   ', raw: '   ' }],
        },
      ]);
    });

    it('should handle escaped characters', () => {
      const input = 'Text with \\*not italic\\* content';
      expect(tokenize(input)).toEqual<BlockToken[]>([
        {
          type: 'paragraph',
          content: 'Text with \\*not italic\\* content',
          raw: 'Text with \\*not italic\\* content',
          tokens: [
            { type: 'text', value: 'Text with *not italic* content', raw: 'Text with *not italic* content' },
          ],
        },
      ]);
    });
  });
});
