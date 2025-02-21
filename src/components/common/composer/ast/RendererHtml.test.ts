/* eslint-disable max-len */
import type {
  ASTBoldNode,
  ASTCustomEmojiNode,
  ASTFormattingNode,
  ASTLinkNode,
  ASTMentionNode,
  ASTNode,
  ASTPreBlockNode,
  ASTQuoteBlockNode,
  ASTRootNode,
  ASTUnderlineNode,
} from './entities/ASTNode';

import { RendererHtml } from './RendererHtml';

describe('renderer', () => {
  let renderer: RendererHtml;

  beforeEach(() => {
    renderer = new RendererHtml();
  });

  describe('html rendering', () => {
    const isPreviewValue = true;
    const isNotPreviewValue = false;
    const isClosedValue = true;
    const isNotClosedValue = false;

    it.each([
      [isPreviewValue, 'Hello world'],
      [isNotPreviewValue, 'Hello world'],
    ])('should render text node', (isPreview, expected) => {
      const node: ASTNode = { type: 'text', value: 'Hello world', raw: 'Hello world' };
      expect(renderer.render(node, { mode: 'html', isPreview })).toBe(expected);
    });

    it.each([
      [isPreviewValue, '&lt;div &amp; &quot;quote&quot; &#039;single&#039;&gt;'],
      [isNotPreviewValue, '&lt;div &amp; &quot;quote&quot; &#039;single&#039;&gt;'],
    ])('should escape HTML special characters', (isPreview, expected) => {
      const node: ASTNode = { type: 'text', value: '<div & "quote" \'single\'>', raw: '<div & "quote" \'single\'>' };
      expect(renderer.render(node, { mode: 'html', isPreview })).toBe(expected);
    });

    it.each([
      ['bold', isNotPreviewValue, isClosedValue, 'strong', 'md-bold', '', ''],
      ['bold', isPreviewValue, isClosedValue, 'strong', 'md-bold', '**', '**'],
      ['bold', isPreviewValue, isNotClosedValue, 'strong', 'md-bold', '**', ''],
      ['italic', isNotPreviewValue, isClosedValue, 'em', 'md-italic', '', ''],
      ['italic', isPreviewValue, isClosedValue, 'em', 'md-italic', '*', '*'],
      ['italic', isPreviewValue, isNotClosedValue, 'em', 'md-italic', '*', ''],
      ['underline', isNotPreviewValue, isClosedValue, 'span', 'md-underline', '', ''],
      ['underline', isPreviewValue, isClosedValue, 'span', 'md-underline', '&lt;u&gt;', '&lt;/u&gt;'],
      ['underline', isPreviewValue, isNotClosedValue, 'span', 'md-underline', '&lt;u&gt;', '&lt;/u&gt;'],
      ['strikethrough', isNotPreviewValue, isClosedValue, 's', 'md-strikethrough', '', ''],
      ['strikethrough', isPreviewValue, isClosedValue, 's', 'md-strikethrough', '~~', '~~'],
      ['strikethrough', isPreviewValue, isNotClosedValue, 's', 'md-strikethrough', '~~', ''],
      ['monospace', isNotPreviewValue, isClosedValue, 'code', 'md-monospace', '', ''],
      ['monospace', isPreviewValue, isClosedValue, 'code', 'md-monospace', '`', '`'],
      ['monospace', isPreviewValue, isNotClosedValue, 'code', 'md-monospace', '`', ''],
    ])('should render %s. isPreview: %s, isClosed: %s -----> %s',
      (formatting, isPreview, isClosed, tag, className, prefix, suffix) => {
        const node = {
          type: formatting,
          children: [{ type: 'text', value: 'Hello world', raw: 'Hello world' }],
          closed: isClosed,
          raw: `${prefix}Hello world${suffix}`,
        };

        const rendered = renderer.render(node as ASTFormattingNode, { mode: 'html', isPreview });

        const prefixString = isPreview ? `<span class="md-preview-char">${prefix}</span>` : '';
        const suffixString = isPreview && suffix ? `<span class="md-preview-char">${suffix}</span>` : '';

        expect(rendered)
          // eslint-disable-next-line max-len
          .toBe(`<${tag} class="${className} md-node-highlightable ">${prefixString}Hello world${suffixString}</${tag}>`);
      });

    it.each([
      [
        isNotPreviewValue,
        // eslint-disable-next-line max-len
        '<strong class="md-bold md-node-highlightable ">Bold <em class="md-italic md-node-highlightable ">italic</em></strong>',
      ],
      [
        isPreviewValue,
        // eslint-disable-next-line max-len
        '<strong class="md-bold md-node-highlightable "><span class="md-preview-char">**</span>Bold <em class="md-italic md-node-highlightable "><span class="md-preview-char">*</span>italic<span class="md-preview-char">*</span></em><span class="md-preview-char">**</span></strong>',
      ],
    ])('should render nested formatting', (isPreview, expected) => {
      const node: ASTNode = {
        type: 'bold',
        children: [
          { type: 'text', value: 'Bold ', raw: 'Bold ' },
          { type: 'italic', children: [{ type: 'text', value: 'italic', raw: 'italic' }], raw: 'italic' },
        ],
        raw: '**Bold **italic**',
      };

      const result = renderer.render(node, { mode: 'html', isPreview });
      expect(result).toBe(expected);
    });

    describe('quote blocks', () => {
      it('should render quote blocks', () => {
        const node: ASTQuoteBlockNode = {
          type: 'quote',
          raw: '>Quote',
          children: [{ type: 'text', value: 'Quote', raw: 'Quote' }],
        };

        expect(renderer.render(node, { mode: 'html', isPreview: isPreviewValue }))
          // eslint-disable-next-line max-len
          .toBe('<div class="paragraph paragraph--quote md-node-highlightable "><div class="md-quote"><span class="md-preview-char">></span>Quote</div></div>');
      });

      it('should render empty quote blocks', () => {
        const node: ASTQuoteBlockNode = {
          type: 'quote',
          raw: '>',
          children: [{ type: 'text', value: '', raw: '' }],
        };

        expect(renderer.render(node, { mode: 'html', isPreview: isPreviewValue }))
          // eslint-disable-next-line max-len
          .toBe('<div class="paragraph paragraph--quote md-node-highlightable "><div class="md-quote"><span class="md-preview-char">></span><br></div></div>');
      });
    });

    it('should render links with proper attributes', () => {
      const node: ASTNode = {
        type: 'link',
        href: 'https://example.com',
        raw: '[Click here](https://example.com)',
        children: [{ type: 'text', value: 'Click here', raw: 'Click here' }],
      };
      expect(renderer.render(node, { mode: 'html', isPreview: isPreviewValue }))
        .toBe('<a href="https://example.com">Click here</a>');
    });

    it.skip('should render code blocks with language', () => {
      const node: ASTNode = {
        type: 'pre',
        raw: '```typescript\nconst x = 42;\n```',
        language: 'typescript',
        value: 'const x = 42;',
        closed: true,
      };
      expect(renderer.render(node, { mode: 'html' })).toBe(
        // eslint-disable-next-line max-len
        '<div class="md-pre"><div data-block-id="hftc6lsa4jt" class="paragraph paragraph-pre md-node-highlightable ">const x = 42;</div></div>',
      );
    });

    it.skip.each([
      [isPreviewValue, isClosedValue, 'console.log("Hello");', 'ts', '<pre language="ts">```ts\nconsole.log(&quot;Hello&quot;);```</pre>'],
      [isPreviewValue, isClosedValue, 'console.log("Hello");', undefined, '<pre>```\nconsole.log(&quot;Hello&quot;);```</pre>'],
      [isNotPreviewValue, isClosedValue, 'console.log("Hello");', 'ts', '<pre language="ts">console.log(&quot;Hello&quot;);</pre>'],
      [isNotPreviewValue, isClosedValue, 'console.log("Hello");', undefined, '<pre>console.log(&quot;Hello&quot;);</pre>'],
      [isPreviewValue, isNotClosedValue, 'console.log("Hello");', 'ts', '<pre language="ts">```ts\nconsole.log(&quot;Hello&quot;);'],
      [isPreviewValue, isNotClosedValue, 'console.log("Hello");', undefined, '<pre>```\nconsole.log(&quot;Hello&quot;);'],
      [isNotPreviewValue, isNotClosedValue, 'console.log("Hello");', 'ts', '<pre language="ts">console.log(&quot;Hello&quot;);'],
      [isNotPreviewValue, isNotClosedValue, 'console.log("Hello");', undefined, '<pre>console.log(&quot;Hello&quot;);'],
    ])('should render pre blocks isPreview: %s, isClosed: %s, value: %s, language: %s -----> %s', (isPreview, isClosed, value, language, expected) => {
      const node = {
        type: 'pre',
        language,
        value,
        closed: isClosed,
      };
      expect(renderer.render(node as ASTPreBlockNode, { mode: 'html', isPreview })).toBe(expected);
    });

    describe('mentions', () => {
      it('should render mentions', () => {
        const node: ASTMentionNode = {
          type: 'mention',
          raw: '[username](mention:123)',
          userId: '123',
          value: 'username',
        };
        expect(renderer.render(node, { mode: 'html' }))
          .toBe('<span class="md-mention">username</span>');
      });
    });

    describe.skip('custom emoji', () => {
      it('should render custom emoji', () => {
        const node: ASTCustomEmojiNode = {
          type: 'customEmoji',
          raw: '[😀](doc:5062301574668222465)',
          documentId: '5062301574668222465',
          value: '😀',
        };

        expect(renderer.render(node, { mode: 'html' }))
          .toBe('<img class="custom-emoji emoji emoji-small placeholder" draggable="false" alt="😎" data-document-id="5071170261227667457" data-entity-type="MessageEntityCustomEmoji" src="http://localhost:1234/square.370a4828a4f2afc14ada.svg" />');
      });
    });
  });

  describe('markdown rendering', () => {
    it('should render text node', () => {
      const node: ASTNode = { type: 'text', value: 'Hello world', raw: 'Hello world' };
      expect(renderer.render(node, { mode: 'markdown' })).toBe('Hello world');
    });

    it('should render nested formatting', () => {
      const node: ASTNode = {
        type: 'bold',
        raw: '**Bold *italic***',
        children: [
          { type: 'text', value: 'Bold ', raw: 'Bold ' },
          { type: 'italic', children: [{ type: 'text', value: 'italic', raw: 'italic' }], raw: '*italic*' },
        ],
      };
      expect(renderer.render(node, { mode: 'markdown' })).toBe('**Bold *italic***');
    });

    it('should render unclosed formatting', () => {
      const node: ASTNode = {
        type: 'bold',
        raw: '**Bold *italic*',
        children: [
          { type: 'text', value: 'Bold ', raw: 'Bold ' },
          { type: 'italic', children: [{ type: 'text', value: 'italic', raw: 'italic' }], raw: '*italic*' },
        ],
        closed: false,
      };
      expect(renderer.render(node, { mode: 'markdown' })).toBe('**Bold *italic*');
    });

    it('should render links', () => {
      const node: ASTNode = {
        type: 'link',
        href: 'https://example.com',
        raw: '[Click here](https://example.com)',
        children: [{ type: 'text', value: 'Click here', raw: 'Click here' }],
      };
      expect(renderer.render(node, { mode: 'markdown' })).toBe('[Click here](https://example.com)');
    });

    it.each([
      ['const x = 42;', 'typescript', '```typescript\nconst x = 42;\n```'],
      ['const x = 42;', '', '```\nconst x = 42;\n```'],
      ['const x = 42;', undefined, '```\nconst x = 42;\n```'],
    ])('should render code blocks with language %s', (value, language, expected) => {
      const node: ASTNode = {
        type: 'pre',
        raw: '```',
        language,
        value,
        closed: true,
      };
      expect(renderer.render(node, { mode: 'markdown' })).toBe(expected);
    });

    it('should render quotes with proper formatting', () => {
      const node: ASTNode = {
        type: 'quote',
        children: [
          { type: 'text', value: 'Line 1\nLine 2', raw: 'Line 1\nLine 2' },
        ],
        raw: '>Line 1\n>Line 2',
      };
      expect(renderer.render(node, { mode: 'markdown' })).toBe('>Line 1\nLine 2');
    });

    it('should handle spoilers', () => {
      const node: ASTNode = {
        type: 'spoiler',
        children: [{ type: 'text', value: 'Hidden text', raw: 'Hidden text' }],
        raw: '||',
      };
      expect(renderer.render(node, { mode: 'markdown' })).toBe('||Hidden text||');
    });
  });
});

describe('offset mapping', () => {
  let renderer: RendererHtml;

  beforeEach(() => {
    renderer = new RendererHtml();
  });

  it('should map offsets correctly', () => {
    const node: ASTNode = { type: 'text', value: 'Hello world', raw: 'Hello world' };

    renderer.render(node, { mode: 'html' });

    const offsetMapping = renderer.getOffsetMapping();
    expect(offsetMapping).toEqual([
      {
        htmlStart: 0,
        htmlEnd: 11,
        mdStart: 0,
        mdEnd: 11,
        nodeType: 'text',
        raw: 'Hello world',
      },
    ]);
  });

  it('should map offsets correctly for bold node. children should be mapped as well', () => {
    const node: ASTBoldNode = {
      type: 'bold',
      raw: '**Bold**',
      children: [
        { type: 'text', value: 'Bold', raw: 'Bold' },
      ],
    };

    renderer.render(node, { mode: 'html', isPreview: true });
    const offsetMapping = renderer.getOffsetMapping();

    expect(offsetMapping).toEqual([
      {
        htmlStart: 0,
        htmlEnd: 8,
        mdStart: 0,
        mdEnd: 8,
        nodeType: 'bold',
        raw: '**Bold**',
      },
      {
        htmlStart: 2,
        htmlEnd: 6,
        mdStart: 2,
        mdEnd: 6,
        nodeType: 'text',
        raw: 'Bold',
      },
    ]);
  });

  it('should count support line breaks', () => {
    const node: ASTRootNode = {
      type: 'root',
      raw: '1\n2\n3',
      children: [
        { type: 'paragraph', raw: '1', children: [{ type: 'text', value: '1', raw: '1' }] },
        { type: 'paragraph', raw: '2', children: [{ type: 'text', value: '2', raw: '2' }] },
        { type: 'paragraph', raw: '3', children: [{ type: 'text', value: '3', raw: '3' }] },
      ],
    };

    renderer.render(node, { mode: 'html', isPreview: true });
    const offsetMapping = renderer.getOffsetMapping();

    expect(offsetMapping).toEqual([
      {
        htmlStart: 0,
        htmlEnd: 1,
        mdStart: 0,
        mdEnd: 1,
        nodeType: 'text',
        raw: '1',
      },
      {
        htmlStart: 2,
        htmlEnd: 3,
        mdStart: 2,
        mdEnd: 3,
        nodeType: 'text',
        raw: '2',
      },
      {
        htmlStart: 4,
        htmlEnd: 5,
        mdStart: 4,
        mdEnd: 5,
        nodeType: 'text',
        raw: '3',
      },
    ]);
  });

  it('should map offsets correctly for several blocks', () => {
    const node: ASTRootNode = {
      type: 'root',
      raw: '111 *italic*\n222 **bold**',
      children: [
        {
          type: 'paragraph',
          raw: '111 *italic*',
          children: [
            { type: 'text', value: '111 ', raw: '111 ' },
            { type: 'italic', children: [{ type: 'text', value: 'italic', raw: 'italic' }], raw: '*italic*' },
          ],
        },
        {
          type: 'paragraph',
          raw: '222 **bold**',
          children: [
            { type: 'text', value: '222 ', raw: '222 ' },
            { type: 'bold', children: [{ type: 'text', value: 'bold', raw: 'bold' }], raw: '**bold**' },
          ],
        },
      ],
    };

    renderer.render(node, { mode: 'html', isPreview: true });
    const offsetMapping = renderer.getOffsetMapping();

    expect(offsetMapping).toEqual([
      {
        htmlStart: 0,
        htmlEnd: 4,
        mdStart: 0,
        mdEnd: 4,
        nodeType: 'text',
        raw: '111 ',
      },
      {
        htmlStart: 4,
        htmlEnd: 12,
        mdStart: 4,
        mdEnd: 12,
        nodeType: 'italic',
        raw: '*italic*',
      },
      {
        htmlEnd: 11,
        htmlStart: 5,
        mdEnd: 11,
        mdStart: 5,
        nodeType: 'text',
        raw: 'italic',
      },
      {
        htmlStart: 13,
        htmlEnd: 17,
        mdStart: 13,
        mdEnd: 17,
        nodeType: 'text',
        raw: '222 ',
      },
      {
        htmlStart: 17,
        htmlEnd: 25,
        mdStart: 17,
        mdEnd: 25,
        nodeType: 'bold',
        raw: '**bold**',
      },
      {
        htmlStart: 19,
        htmlEnd: 23,
        mdStart: 19,
        mdEnd: 23,
        nodeType: 'text',
        raw: 'bold',
      },
    ]);
  });

  it('should not inclide unneeded nodes in offset mapping', () => {
    const node: ASTRootNode = {
      type: 'root',
      raw: '**bold** text',
      children: [
        {
          type: 'paragraph',
          raw: '**bold** text',
          children: [
            { type: 'bold', raw: '**bold**', children: [{ type: 'text', value: 'bold', raw: 'bold' }] },
            { type: 'text', value: ' text', raw: ' text' },
          ],
        },
      ],
    };

    renderer.render(node, { mode: 'html', isPreview: true });
    const offsetMapping = renderer.getOffsetMapping();

    expect(offsetMapping).toEqual([
      {
        htmlStart: 0,
        htmlEnd: 8,
        mdStart: 0,
        mdEnd: 8,
        nodeType: 'bold',
        raw: '**bold**',
      },
      {
        htmlStart: 2,
        htmlEnd: 6,
        mdStart: 2,
        mdEnd: 6,
        nodeType: 'text',
        raw: 'bold',
      },
      {
        htmlStart: 8,
        htmlEnd: 13,
        mdStart: 8,
        mdEnd: 13,
        nodeType: 'text',
        raw: ' text',
      },
    ]);
  });

  it('should map offsets correctly for mention node', () => {
    const node: ASTMentionNode = {
      type: 'mention',
      raw: '[username](id:123)',
      userId: '123',
      value: 'username',
    };
    const ast: ASTRootNode = {
      type: 'root',
      raw: '[username](id:123)',
      children: [{
        type: 'paragraph',
        raw: '[username](id:123)',
        children: [node],
      }],
    };

    renderer.render(ast, { mode: 'html', isPreview: true });
    const offsetMapping = renderer.getOffsetMapping();

    expect(offsetMapping).toEqual([
      {
        htmlStart: 0,
        htmlEnd: 8,
        mdStart: 0,
        mdEnd: 18,
        nodeType: 'mention',
        raw: '[username](id:123)',
      },
    ]);
  });

  it('should handle fragments after mentions', () => {
    const ast: ASTRootNode = {
      type: 'root',
      raw: 'Hello, [username](id:123), welcome **home**\nSecond line',
      children: [{
        type: 'paragraph',
        raw: 'Hello, [username](id:123), welcome **home**',
        children: [
          { type: 'text', value: 'Hello, ', raw: 'Hello, ' },
          {
            type: 'mention', raw: '[username](id:123)', userId: '123', value: 'username',
          } as ASTMentionNode,
          { type: 'text', value: ', welcome ', raw: ', welcome ' },
          { type: 'bold', raw: '**home**', children: [{ type: 'text', value: 'home', raw: 'home' }] },
        ],
      }, {
        type: 'paragraph',
        raw: 'Second line',
        children: [{ type: 'text', value: 'Second line', raw: 'Second line' }],
      }],
    };

    renderer.render(ast, { mode: 'html', isPreview: true });
    const offsetMapping = renderer.getOffsetMapping();

    expect(offsetMapping).toEqual([
      {
        nodeType: 'text', raw: 'Hello, ', htmlStart: 0, htmlEnd: 7, mdStart: 0, mdEnd: 7,
      },
      {
        nodeType: 'mention', raw: '[username](id:123)', htmlStart: 7, htmlEnd: 15, mdStart: 7, mdEnd: 25,
      },
      {
        nodeType: 'text', raw: ', welcome ', htmlStart: 15, htmlEnd: 25, mdStart: 25, mdEnd: 35,
      },
      {
        nodeType: 'bold', raw: '**home**', htmlStart: 25, htmlEnd: 33, mdStart: 35, mdEnd: 43,
      },
      {
        nodeType: 'text', raw: 'home', htmlStart: 27, htmlEnd: 31, mdStart: 37, mdEnd: 41,
      },
      {
        nodeType: 'text', raw: 'Second line', htmlStart: 34, htmlEnd: 45, mdStart: 44, mdEnd: 55,
      },
    ]);
  });

  it('should map offsets correctly for underline node', () => {
    const node: ASTUnderlineNode = {
      type: 'underline',
      raw: '<u>text</u>',
      children: [
        { type: 'text', value: 'text', raw: 'text' },
      ],
    };

    renderer.render(node, { mode: 'html', isPreview: true });
    const offsetMapping = renderer.getOffsetMapping();

    expect(offsetMapping).toEqual([
      {
        htmlStart: 0,
        htmlEnd: 11,
        mdStart: 0,
        mdEnd: 11,
        nodeType: 'underline',
        raw: '<u>text</u>',
      },
      {
        htmlStart: 3,
        htmlEnd: 7,
        mdStart: 3,
        mdEnd: 7,
        nodeType: 'text',
        raw: 'text',
      },
    ]);
  });

  it('should map offsets correctly for nested underline nodes', () => {
    const node: ASTRootNode = {
      type: 'root',
      raw: '<u>outer <u>inner</u></u>',
      children: [{
        type: 'paragraph',
        raw: '<u>outer <u>inner</u></u>',
        children: [{
          type: 'underline',
          raw: '<u>outer <u>inner</u></u>',
          children: [
            { type: 'text', value: 'outer ', raw: 'outer ' },
            {
              type: 'underline',
              raw: '<u>inner</u>',
              children: [{ type: 'text', value: 'inner', raw: 'inner' }],
            },
          ],
        }],
      }],
    };

    renderer.render(node, { mode: 'html', isPreview: true });
    const offsetMapping = renderer.getOffsetMapping();

    expect(offsetMapping).toEqual([
      {
        htmlStart: 0,
        htmlEnd: 25,
        mdStart: 0,
        mdEnd: 25,
        nodeType: 'underline',
        raw: '<u>outer <u>inner</u></u>',
        nodeId: undefined,
      },
      {
        htmlStart: 3,
        htmlEnd: 9,
        mdStart: 3,
        mdEnd: 9,
        nodeType: 'text',
        raw: 'outer ',
        nodeId: undefined,
      },
      {
        htmlStart: 9,
        htmlEnd: 21,
        mdStart: 9,
        mdEnd: 21,
        nodeType: 'underline',
        raw: '<u>inner</u>',
        nodeId: undefined,
      },
      {
        htmlStart: 12,
        htmlEnd: 17,
        mdStart: 12,
        mdEnd: 17,
        nodeType: 'text',
        raw: 'inner',
        nodeId: undefined,
      },
    ]);
  });

  it('should map offsets correctly for link node', () => {
    const node: ASTLinkNode = {
      type: 'link',
      raw: '[text](https://example.com)',
      href: 'https://example.com',
      children: [
        { type: 'text', value: 'text', raw: 'text' },
      ],
    };

    renderer.render(node, { mode: 'html', isPreview: true });
    const offsetMapping = renderer.getOffsetMapping();

    expect(offsetMapping).toEqual([
      {
        htmlStart: 0,
        htmlEnd: 27,
        mdStart: 0,
        mdEnd: 27,
        nodeType: 'link',
        raw: '[text](https://example.com)',
        nodeId: undefined,
      },
      {
        htmlStart: 1,
        htmlEnd: 5,
        mdStart: 1,
        mdEnd: 5,
        nodeType: 'text',
        raw: 'text',
        nodeId: undefined,
      },
    ]);
  });

  it('should map offsets correctly for nested link nodes', () => {
    const node: ASTRootNode = {
      type: 'root',
      raw: '[outer *bold*](https://outer.com)',
      children: [{
        type: 'paragraph',
        raw: '[outer *bold*](https://outer.com)',
        children: [{
          type: 'link',
          raw: '[outer *bold*](https://outer.com)',
          href: 'https://outer.com',
          children: [
            { type: 'text', value: 'outer ', raw: 'outer ' },
            {
              type: 'bold',
              raw: '*bold*',
              children: [{ type: 'text', value: 'bold', raw: 'bold' }],
            },
          ],
        }],
      }],
    };

    renderer.render(node, { mode: 'html', isPreview: true });
    const offsetMapping = renderer.getOffsetMapping();

    expect(offsetMapping).toEqual([
      {
        htmlStart: 0,
        htmlEnd: 33,
        mdStart: 0,
        mdEnd: 33,
        nodeType: 'link',
        raw: '[outer *bold*](https://outer.com)',
        nodeId: undefined,
      },
      {
        htmlStart: 1,
        htmlEnd: 7,
        mdStart: 1,
        mdEnd: 7,
        nodeType: 'text',
        raw: 'outer ',
        nodeId: undefined,
      },
      {
        htmlStart: 7,
        htmlEnd: 13,
        mdStart: 7,
        mdEnd: 13,
        nodeType: 'bold',
        raw: '*bold*',
        nodeId: undefined,
      },
      {
        htmlStart: 9,
        htmlEnd: 13,
        mdStart: 9,
        mdEnd: 13,
        nodeType: 'text',
        raw: 'bold',
        nodeId: undefined,
      },
    ]);
  });
});
