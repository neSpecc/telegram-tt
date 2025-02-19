import type { ASTParagraphBlockNode, ASTPreBlockNode, ASTQuoteBlockNode } from './entities/ASTNode';
import type { BlockToken, InlineToken, ParagraphToken, QuoteToken } from './entities/Token';
import { Parser } from './Parser';

describe('parser', () => {
  describe('primitives', () => {
    it('should parse plain text', () => {
      const tokens: BlockToken[] = [{
        type: 'paragraph',
        raw: 'Hello, world!',
        content: 'Hello, world!',
        tokens: [{ type: 'text', value: 'Hello, world!', raw: 'Hello, world!' }],
      }];
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(ast).toEqual({
        type: 'root',
        children: [{
          type: 'paragraph',
          raw: 'Hello, world!',
          children: [{ type: 'text', value: 'Hello, world!', raw: 'Hello, world!' }],
        }],
        raw: 'Hello, world!',
      });
    });

    it('should parse bold text', () => {
      const tokens: BlockToken[] = [{
        type: 'paragraph',
        raw: '**Bold text**',
        content: 'Bold text',
        tokens: [
          { type: 'bold', raw: '**' },
          { type: 'text', value: 'Bold text', raw: 'Bold text' },
          { type: 'bold', raw: '**' },
        ],
      }];
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(ast).toEqual({
        type: 'root',
        raw: '**Bold text**',
        children: [{
          type: 'paragraph',
          raw: '**Bold text**',
          children: [{
            type: 'bold',
            raw: '**Bold text**',
            children: [{ type: 'text', value: 'Bold text', raw: 'Bold text' }],
            closed: true,
          }],
        } as ASTParagraphBlockNode],
      });
    });

    it('should parse italic text', () => {
      const tokens: BlockToken[] = [{
        type: 'paragraph',
        raw: '*Italic text*',
        content: 'Italic text',
        tokens: [
          { type: 'italic', raw: '*' },
          { type: 'text', value: 'Italic text', raw: 'Italic text' },
          { type: 'italic', raw: '*' },
        ],
      }];
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(ast).toEqual({
        type: 'root',
        raw: '*Italic text*',
        children: [{
          type: 'paragraph',
          raw: '*Italic text*',
          children: [{
            type: 'italic',
            raw: '*Italic text*',
            children: [{ type: 'text', value: 'Italic text', raw: 'Italic text' }],
            closed: true,
          }],
        } as ASTParagraphBlockNode],
      });
    });

    it('should parse underline text', () => {
      const tokens: BlockToken[] = [{
        type: 'paragraph',
        raw: '<u>Underlined text</u>',
        content: 'Underlined text',
        tokens: [
          { type: 'underline', raw: '<u>' },
          { type: 'text', value: 'Underlined text', raw: 'Underlined text' },
          { type: 'underline', raw: '</u>' },
        ],
      }];
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(ast).toEqual({
        type: 'root',
        raw: '<u>Underlined text</u>',
        children: [{
          type: 'paragraph',
          raw: '<u>Underlined text</u>',
          children: [{
            type: 'underline',
            raw: '<u>Underlined text</u>',
            children: [{ type: 'text', value: 'Underlined text', raw: 'Underlined text' }],
            closed: true,
          }],
        } as ASTParagraphBlockNode],
      });
    });

    it('should parse strikethrough text', () => {
      const tokens: BlockToken[] = [{
        type: 'paragraph',
        raw: '~~Strikethrough text~~',
        content: 'Strikethrough text',
        tokens: [
          { type: 'strikethrough', raw: '~~' },
          { type: 'text', value: 'Strikethrough text', raw: 'Strikethrough text' },
          { type: 'strikethrough', raw: '~~' },
        ],
      }];
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(ast).toEqual({
        type: 'root',
        raw: '~~Strikethrough text~~',
        children: [{
          type: 'paragraph',
          raw: '~~Strikethrough text~~',
          children: [{
            type: 'strikethrough',
            raw: '~~Strikethrough text~~',
            children: [{ type: 'text', value: 'Strikethrough text', raw: 'Strikethrough text' }],
            closed: true,
          }],
        } as ASTParagraphBlockNode],
      });
    });

    it('should parse pre block', () => {
      const tokens: BlockToken[] = [{
        type: 'pre',
        raw: 'const x = 1;',
        language: 'typescript',
        content: 'const x = 1;',
        tokens: [{ type: 'text', value: 'const x = 1;', raw: 'const x = 1;' }],
      }];
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(ast).toEqual({
        type: 'root',
        raw: 'const x = 1;',
        children: [{
          type: 'pre',
          raw: 'const x = 1;',
          value: 'const x = 1;',
          language: 'typescript',
        } as ASTPreBlockNode],
      });
    });

    describe('quote blocks', () => {
      it('should parse simple quote block', () => {
        const token: QuoteToken = {
          type: 'quote',
          raw: '>quoted text',
          content: 'quoted text',
          tokens: [{ type: 'text', value: 'quoted text', raw: 'quoted text' }],
        };
        const parser = new Parser([token]);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: '>quoted text',
          children: [{
            type: 'quote',
            raw: '>quoted text',
            children: [{ type: 'text', value: 'quoted text', raw: 'quoted text' }],
          } as ASTQuoteBlockNode],
        });
      });

      it('should parse quote block with formatting', () => {
        const tokens: QuoteToken[] = [{
          type: 'quote',
          raw: '>quoted **bold** text',
          content: 'quoted **bold** text',
          tokens: [
            { type: 'text', value: 'quoted ', raw: 'quoted ' },
            { type: 'bold', raw: '**' },
            { type: 'text', value: 'bold', raw: 'bold' },
            { type: 'bold', raw: '**' },
            { type: 'text', value: ' text', raw: ' text' },
          ],
        }];
        const parser = new Parser(tokens);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: '>quoted **bold** text',
          children: [{
            type: 'quote',
            raw: '>quoted **bold** text',
            children: [
              { type: 'text', value: 'quoted ', raw: 'quoted ' },
              { type: 'bold', closed: true, children: [{ type: 'text', value: 'bold', raw: 'bold' }], raw: '**bold**' },
              { type: 'text', value: ' text', raw: ' text' },
            ],
          } as ASTQuoteBlockNode],
        });
      });

      it('should parse multiline quote block', () => {
        const tokens: QuoteToken[] = [{
          type: 'quote',
          raw: '>line 1\n>line 2',
          content: 'line 1\nline 2',
          tokens: [
            { type: 'text', value: 'line 1\nline 2', raw: 'line 1\nline 2' },
          ],
        }];
        const parser = new Parser(tokens);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: '>line 1\n>line 2',
          children: [{
            type: 'quote',
            raw: '>line 1\n>line 2',
            children: [{ type: 'text', value: 'line 1\nline 2', raw: 'line 1\nline 2' }],
          } as ASTQuoteBlockNode],
        });
      });

      it('should parse empty quote block', () => {
        const tokens: QuoteToken[] = [{
          type: 'quote',
          raw: '>',
          content: '',
          tokens: [{ type: 'text', value: '', raw: '' }],
        }];
        const parser = new Parser(tokens);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: '>',
          children: [{
            type: 'quote',
            raw: '>',
            children: [{ type: 'text', value: '', raw: '' }],
          } as ASTQuoteBlockNode],
        });
      });

      it('should parse quote block with nested formatting', () => {
        const tokens: QuoteToken[] = [{
          type: 'quote',
          raw: '>**bold <u>underline</u> text**',
          content: '**bold <u>underline</u> text**',
          tokens: [
            { type: 'bold', raw: '**' },
            { type: 'text', value: 'bold ', raw: 'bold ' },
            { type: 'underline', raw: '<u>' },
            { type: 'text', value: 'underline', raw: 'underline' },
            { type: 'underline', raw: '</u>' },
            { type: 'text', value: ' text', raw: ' text' },
            { type: 'bold', raw: '**' },
          ],
        }];
        const parser = new Parser(tokens);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: '>**bold <u>underline</u> text**',
          children: [{
            type: 'quote',
            raw: '>**bold <u>underline</u> text**',
            children: [
              {
                type: 'bold',
                closed: true,
                raw: '**bold <u>underline</u> text**',
                children: [
                  { type: 'text', value: 'bold ', raw: 'bold ' },
                  { type: 'underline', closed: true, children: [{ type: 'text', value: 'underline', raw: 'underline' }], raw: '<u>underline</u>' },
                  { type: 'text', value: ' text', raw: ' text' },
                ],
              },
            ],
          } as ASTQuoteBlockNode],
        });
      });
    });

    describe('monospace', () => {
      it('should parse monospace', () => {
        const tokens: BlockToken[] = [{
          type: 'paragraph',
          raw: '`console.log("Hello")`',
          content: 'console.log("Hello")',
          tokens: [{ type: 'monospace', value: 'console.log("Hello")', raw: '`console.log("Hello")`' }],
        }];
        const parser = new Parser(tokens);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: '`console.log("Hello")`',
          children: [{
            type: 'paragraph',
            raw: '`console.log("Hello")`',
            children: [{
              type: 'monospace',
              value: 'console.log("Hello")',
              raw: '`console.log("Hello")`',
              closed: true,
            }],
          } as ASTParagraphBlockNode],
        });
      });

      it('should parse multiple monospace fragments correctly', () => {
        const tokens: BlockToken[] = [{
          type: 'paragraph',
          raw: '`code1`',
          content: 'code1',
          tokens: [{ type: 'monospace', value: 'code1', raw: '`code1`' }],
        }, {
          type: 'paragraph',
          raw: '`code2`',
          content: 'code2',
          tokens: [{ type: 'monospace', value: 'code2', raw: '`code2`' }],
        }];
        const parser = new Parser(tokens);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: '`code1`\n`code2`',
          children: [{
            type: 'paragraph',
            raw: '`code1`',
            children: [{
              type: 'monospace',
              value: 'code1',
              raw: '`code1`',
              closed: true,
            }],
          } as ASTParagraphBlockNode, {
            type: 'paragraph',
            raw: '`code2`',
            children: [{
              type: 'monospace',
              value: 'code2',
              raw: '`code2`',
              closed: true,
            }],
          } as ASTParagraphBlockNode],
        });
      });

      it('should parse monospace inside formatted text', () => {
        const tokens: BlockToken[] = [{
          type: 'paragraph',
          raw: '**Bold and `inline code`**',
          content: 'Bold and inline code',
          tokens: [
            { type: 'bold', raw: '**' },
            { type: 'text', value: 'Bold and ', raw: 'Bold and ' },
            { type: 'monospace', value: 'inline code', raw: '`inline code`' },
            { type: 'bold', raw: '**' },
          ],
        }];
        const parser = new Parser(tokens);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: '**Bold and `inline code`**',
          children: [{
            type: 'paragraph',
            raw: '**Bold and `inline code`**',
            children: [{
              type: 'bold',
              raw: '**Bold and `inline code`**',
              children: [
                { type: 'text', value: 'Bold and ', raw: 'Bold and ' },
                { type: 'monospace', value: 'inline code', raw: '`inline code`', closed: true },
              ],
              closed: true,
            }],
          } as ASTParagraphBlockNode],
        });
      });
    });

    describe('block Code', () => {
      it('should parse single-line block code', () => {
        const tokens: BlockToken[] = [{
          type: 'pre',
          raw: 'console.log("Hello")',
          language: '',
          content: 'console.log("Hello")',
          tokens: [{ type: 'text', value: 'console.log("Hello")', raw: 'console.log("Hello")' }],
        }];
        const parser = new Parser(tokens);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: 'console.log("Hello")',
          children: [{
            type: 'pre',
            raw: 'console.log("Hello")',
            language: '',
            value: 'console.log("Hello")',
          } as ASTPreBlockNode],
        });
      });

      it('should parse multi-line block code', () => {
        const tokens: BlockToken[] = [{
          type: 'pre',
          raw: 'console.log("Hello")\nconsole.log("World")',
          language: '',
          content: 'console.log("Hello")\nconsole.log("World")',
          tokens: [{ type: 'text', value: 'console.log("Hello")\nconsole.log("World")', raw: 'console.log("Hello")\nconsole.log("World")' }],
        }];
        const parser = new Parser(tokens);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: 'console.log("Hello")\nconsole.log("World")',
          children: [{
            type: 'pre',
            raw: 'console.log("Hello")\nconsole.log("World")',
            language: '',
            value: 'console.log("Hello")\nconsole.log("World")',
          } as ASTPreBlockNode],
        });
      });

      it('should parse block code with language', () => {
        const tokens: BlockToken[] = [{
          type: 'pre',
          raw: '```js\nconsole.log("Hello")\n```',
          language: 'js',
          content: 'console.log("Hello")',
          tokens: [{ type: 'text', value: 'console.log("Hello")', raw: 'console.log("Hello")' }],
        }];
        const parser = new Parser(tokens);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: '```js\nconsole.log("Hello")\n```',
          children: [{
            type: 'pre',
            raw: '```js\nconsole.log("Hello")\n```',
            language: 'js',
            value: 'console.log("Hello")',
          } as ASTPreBlockNode],
        });
      });

      it('should treat internal formatting inside block code as plain text', () => {
        const tokens: BlockToken[] = [{
          type: 'pre',
          raw: '```js\n**console.log("Hello")**\n```',
          language: 'js',
          content: '**console.log("Hello")**',
          closed: true,
          tokens: [
            { type: 'bold', raw: '**' },
            { type: 'text', value: 'console.log("Hello")', raw: 'console.log("Hello")' },
            { type: 'bold', raw: '**' },
          ],
        }];
        const parser = new Parser(tokens);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: '```js\n**console.log("Hello")**\n```',
          children: [{
            type: 'pre',
            raw: '```js\n**console.log("Hello")**\n```',
            language: 'js',
            closed: true,
            value: '**console.log("Hello")**',
          } as ASTPreBlockNode],
        });
      });

      it('should set closed to false if code block is not closed', () => {
        const tokens: BlockToken[] = [{
          type: 'pre',
          raw: '```js\nconsole.log("Hello")',
          language: 'js',
          closed: false,
          content: 'js\nconsole.log("Hello")',
          tokens: [{ type: 'text', value: 'js\nconsole.log("Hello")', raw: 'js\nconsole.log("Hello")' }],
        }];
        const parser = new Parser(tokens);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: '```js\nconsole.log("Hello")',
          children: [{
            type: 'pre',
            raw: '```js\nconsole.log("Hello")',
            language: 'js',
            closed: false,
            value: 'js\nconsole.log("Hello")',
          } as ASTPreBlockNode],
        });
      });
    });

    describe('links', () => {
      it('should parse links', () => {
        const tokens: BlockToken[] = [{
          type: 'paragraph',
          raw: '[Click here](https://example.com)',
          content: '[Click here](https://example.com)',
          tokens: [
            { type: 'link', value: 'https://example.com', raw: '[Click here](https://example.com)' },
            { type: 'text', value: 'Click here', raw: 'Click here' },
            { type: 'link-close', raw: '' },
          ],
        }];
        const parser = new Parser(tokens);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: '[Click here](https://example.com)',
          children: [{
            type: 'paragraph',
            raw: '[Click here](https://example.com)',
            children: [{
              type: 'link',
              href: 'https://example.com',
              raw: '[Click here](https://example.com)',
              children: [{ type: 'text', value: 'Click here', raw: 'Click here' }],
              closed: true,
            }],
          } as ASTParagraphBlockNode],
        });
      });

      it('should handle link with empty href correctly', () => {
        const tokens: BlockToken[] = [{
          type: 'paragraph',
          raw: '[Click here]()',
          content: '[Click here]()',
          tokens: [
            { type: 'link', value: '', raw: '[Click here]()' },
            { type: 'text', value: 'Click here', raw: 'Click here' },
            { type: 'link-close', raw: '' },
          ],
        }];
        const parser = new Parser(tokens);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: '[Click here]()',
          children: [{
            type: 'paragraph',
            raw: '[Click here]()',
            children: [{
              type: 'link',
              href: '',
              raw: '[Click here]()',
              children: [{ type: 'text', value: 'Click here', raw: 'Click here' }],
              closed: true,
            }],
          } as ASTParagraphBlockNode],
        });
      });

      it('should parse bold text inside a link', () => {
        const tokens: BlockToken[] = [{
          type: 'paragraph',
          raw: '[**Bold text**](https://example.com)',
          content: '[**Bold text**](https://example.com)',
          tokens: [
            { type: 'link', value: 'https://example.com', raw: '[**Bold text**](https://example.com)' },
            { type: 'bold', raw: '**' },
            { type: 'text', value: 'Bold text', raw: 'Bold text' },
            { type: 'bold', raw: '**' },
            { type: 'link-close', raw: '' },
          ],
        }];
        const parser = new Parser(tokens);
        const ast = parser.parse();

        expect(ast).toEqual({
          type: 'root',
          raw: '[**Bold text**](https://example.com)',
          children: [{
            type: 'paragraph',
            raw: '[**Bold text**](https://example.com)',
            children: [{
              type: 'link',
              href: 'https://example.com',
              raw: '[**Bold text**](https://example.com)',
              children: [{
                type: 'bold',
                raw: '**Bold text**',
                children: [{ type: 'text', value: 'Bold text', raw: 'Bold text' }],
                closed: true,
              }],
              closed: true,
            }],
          } as ASTParagraphBlockNode],
        });
      });
    });

    it('should parse custom emoji', () => {
      const tokens: BlockToken[] = [{
        type: 'paragraph',
        raw: '👍',
        content: '👍',
        tokens: [{
          type: 'customEmoji',
          documentId: '123',
          value: '👍',
          raw: '👍',
        }],
      }];
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(ast).toEqual({
        type: 'root',
        raw: '👍',
        children: [
          {
            type: 'paragraph',
            raw: '👍',
            children: [{
              type: 'customEmoji',
              documentId: '123',
              value: '👍',
              raw: '👍',
            }],
          },
        ],
      });
    });

    it('should parse spoiler', () => {
      const tokens: BlockToken[] = [{
        type: 'paragraph',
        raw: '||Spoiler text||',
        content: 'Spoiler text',
        tokens: [
          { type: 'spoiler', raw: '||' },
          { type: 'text', value: 'Spoiler text', raw: 'Spoiler text' },
          { type: 'spoiler', raw: '||' },
        ],
      }];
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(ast).toEqual({
        type: 'root',
        raw: '||Spoiler text||',
        children: [{
          type: 'paragraph',
          raw: '||Spoiler text||',
          children: [{
            type: 'spoiler',
            raw: '||Spoiler text||',
            closed: true,
            children: [{ type: 'text', value: 'Spoiler text', raw: 'Spoiler text' }],
          }],
        }],
      });
    });
  });

  describe('nesting', () => {
    it('should parse nested formatting', () => {
      const tokens: BlockToken[] = [{
        type: 'paragraph',
        raw: '**bold *italic* text**',
        content: '**bold *italic* text**',
        tokens: [
          { type: 'bold', raw: '**' },
          { type: 'text', value: 'bold ', raw: 'bold ' },
          { type: 'italic', raw: '*' },
          { type: 'text', value: 'italic', raw: 'italic' },
          { type: 'italic', raw: '*' },
          { type: 'text', value: ' text', raw: ' text' },
          { type: 'bold', raw: '**' },
        ],
      }];
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(ast).toEqual({
        type: 'root',
        raw: '**bold *italic* text**',
        children: [{
          type: 'paragraph',
          raw: '**bold *italic* text**',
          children: [{
            type: 'bold',
            raw: '**bold *italic* text**',
            children: [
              { type: 'text', value: 'bold ', raw: 'bold ' },
              {
                type: 'italic',
                raw: '*italic*',
                children: [{ type: 'text', value: 'italic', raw: 'italic' }],
                closed: true,
              },
              { type: 'text', value: ' text', raw: ' text' },
            ],
            closed: true,
          }],
        }],
      });
    });
  });

  it('should handle empty input correctly', () => {
    const tokens: BlockToken[] = [];
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast).toEqual({ type: 'root', children: [], raw: '' });
  });

  it('should handle escaped markdown symbols correctly', () => {
    const tokens: BlockToken[] = [{
      type: 'paragraph',
      raw: '*escaped*',
      content: '*escaped*',
      tokens: [{ type: 'text', value: '*escaped*', raw: '*escaped*' }],
    }];
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast).toEqual({
      type: 'root',
      raw: '*escaped*',
      children: [{
        type: 'paragraph',
        raw: '*escaped*',
        children: [{ type: 'text', value: '*escaped*', raw: '*escaped*' }],
      }],
    });
  });

  it('should correctly parse mixed markdown and HTML', () => {
    const tokens: BlockToken[] = [{
      type: 'paragraph',
      raw: 'Some <b>bold</b> and **bold** text',
      content: 'Some <b>bold</b> and **bold** text',
      tokens: [{ type: 'text', value: 'Some <b>bold</b> and **bold** text', raw: 'Some <b>bold</b> and **bold** text' }],
    }];
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast).toEqual({
      type: 'root',
      raw: 'Some <b>bold</b> and **bold** text',
      children: [{
        type: 'paragraph',
        raw: 'Some <b>bold</b> and **bold** text',
        children: [{ type: 'text', value: 'Some <b>bold</b> and **bold** text', raw: 'Some <b>bold</b> and **bold** text' }],
      }],
    });
  });

  describe.skip('unclosed tags', () => {
    it.each([
      {
        tokens: [
          { type: 'bold', raw: '**' },
          { type: 'text', value: 'Bold without closing', raw: 'Bold without closing' },
        ],
        expected: [{
          type: 'bold',
          // raw: '**Bold without closing',
          children: [
            { type: 'text', value: 'Bold without closing', raw: 'Bold without closing' },
          ],
          closed: false,
        }],
      },
      {
        tokens: [
          { type: 'italic', raw: '*' },
          { type: 'text', value: 'Italic without closing', raw: 'Italic without closing' },
        ],
        expected: [
          {
            type: 'italic',
            // raw: '*Italic without closing',
            children: [
              { type: 'text', value: 'Italic without closing', raw: 'Italic without closing' },
            ],
            closed: false,
          },
        ],
      },
      {
        tokens: [
          { type: 'underline', raw: '<u>' },
          { type: 'text', value: 'Underline without closing', raw: 'Underline without closing' },
        ],
        expected: [
          {
            type: 'underline',
            // raw: '<u>Underline without closing',
            children: [
              { type: 'text', value: 'Underline without closing', raw: 'Underline without closing' },
            ],
            closed: false,
          },
        ],
      },
      {
        tokens: [
          { type: 'strikethrough', raw: '~~' },
          { type: 'text', value: 'Strikethrough without closing', raw: 'Strikethrough without closing' },
        ],
        expected: [
          {
            type: 'strikethrough',
            // raw: '~~Strikethrough without closing',
            children: [
              { type: 'text', value: 'Strikethrough without closing', raw: 'Strikethrough without closing' },
            ],
            closed: false,
          },
        ],
      },
      {
        tokens: [
          { type: 'bold', raw: '**' },
          { type: 'text', value: 'some bold', raw: 'some bold' },
          { type: 'italic', raw: '*' },
          { type: 'text', value: 'some italic', raw: 'some italic' },
        ],
        expected: [
          {
            type: 'bold',
            raw: '**some bold*some italic*',
            children: [
              { type: 'text', value: 'some bold', raw: 'some bold' },
              {
                type: 'italic',
                // raw: '*some italic',
                children: [
                  { type: 'text', value: 'some italic', raw: 'some italic' },
                ],
                closed: false,
              },
            ],
            closed: false,
          },
        ],
      },
    ])('should handle unclosed tags. %s --> %s', ({ tokens, expected }) => {
      const block: ParagraphToken = {
        type: 'paragraph',
        tokens: tokens as InlineToken[],
        raw: '',
        content: '',
      };

      const parser = new Parser([block]);
      const ast = parser.parse();

      expect((ast as ASTParagraphBlockNode).children[0]).toEqual({
        type: 'paragraph',
        raw: '',
        children: expected.map(token => ({ ...token, raw: '' })),
      });
    });
  });

  it('should parse plain text with escaping', () => {
    const tokens: BlockToken[] = [{
      type: 'paragraph',
      raw: '*not bold*',
      content: '*not bold*',
      tokens: [{ type: 'text', value: '*not bold*', raw: '*not bold*' }],
    }];
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast).toEqual({
      type: 'root',
      raw: '*not bold*',
      children: [{
        type: 'paragraph',
        raw: '*not bold*',
        children: [{ type: 'text', value: '*not bold*', raw: '*not bold*' }],
      }],
    });
  });

  describe('mention', () => {
    it('should parse mention', () => {
      const tokens: BlockToken[] = [
        { type: 'paragraph', raw: '[username](id:123)', content: '[username](id:123)', tokens: [
          { type: 'mention', raw: '[username](id:123)', userId: '123', value: 'username' },
        ] },
      ];
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(ast).toEqual({
        type: 'root',
        raw: '[username](id:123)',
        children: [{
          type: 'paragraph',
          raw: '[username](id:123)',
          children: [{
            type: 'mention',
            raw: '[username](id:123)',
            userId: '123',
            value: 'username',
          }],
        }],
      });
    });
  });

  describe('spoiler', () => {
    it('should parse spoiler text', () => {
      const tokens: BlockToken[] = [{
        type: 'paragraph',
        raw: '||hidden text||',
        content: 'hidden text',
        tokens: [
          { type: 'spoiler', raw: '||' },
          { type: 'text', value: 'hidden text', raw: 'hidden text' },
          { type: 'spoiler', raw: '||' },
        ],
      }];
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(ast).toEqual({
        type: 'root',
        raw: '||hidden text||',
        children: [{
          type: 'paragraph',
          raw: '||hidden text||',
          children: [{
            type: 'spoiler',
            raw: '||hidden text||',
            children: [{ type: 'text', value: 'hidden text', raw: 'hidden text' }],
            closed: true,
          }],
        }],
      });
    });

    it('should handle nested formatting inside spoiler', () => {
      const tokens: BlockToken[] = [{
        type: 'paragraph',
        raw: '||text **bold** text||',
        content: 'text **bold** text',
        tokens: [
          { type: 'spoiler', raw: '||' },
          { type: 'text', value: 'text ', raw: 'text ' },
          { type: 'bold', raw: '**' },
          { type: 'text', value: 'bold', raw: 'bold' },
          { type: 'bold', raw: '**' },
          { type: 'text', value: ' text', raw: ' text' },
          { type: 'spoiler', raw: '||' },
        ],
      }];
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(ast).toEqual({
        type: 'root',
        raw: '||text **bold** text||',
        children: [{
          type: 'paragraph',
          raw: '||text **bold** text||',
          children: [{
            type: 'spoiler',
            raw: '||text **bold** text||',
            children: [
              { type: 'text', value: 'text ', raw: 'text ' },
              {
                type: 'bold',
                raw: '**bold**',
                children: [{ type: 'text', value: 'bold', raw: 'bold' }],
                closed: true,
              },
              { type: 'text', value: ' text', raw: ' text' },
            ],
            closed: true,
          }],
        }],
      });
    });
  });

  describe('custom emoji', () => {
    it('should parse custom emoji', () => {
      const tokens: BlockToken[] = [
        {
          type: 'paragraph',
          raw: '[😀](doc:5062301574668222465)',
          content: '[😀](doc:5062301574668222465)',
          tokens: [
            { type: 'customEmoji', raw: '[😀](doc:5062301574668222465)', documentId: '5062301574668222465', value: '😀' },
          ],
        },
      ];
      const parser = new Parser(tokens);
      const ast = parser.parse();

      expect(ast).toEqual({
        type: 'root',
        raw: '[😀](doc:5062301574668222465)',
        children: [{
          type: 'paragraph',
          raw: '[😀](doc:5062301574668222465)',
          children: [{ type: 'customEmoji', raw: '[😀](doc:5062301574668222465)', documentId: '5062301574668222465', value: '😀' }],
        }],
      });
    });
  });
});
