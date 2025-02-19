import type { InlineToken } from './entities/Token';
import { InlineTokenizer } from './InlineTokenizer';

describe('inlineTokenizer', () => {
  const tokenize = (input: string, isPlainText = false) => new InlineTokenizer(input).tokenize(isPlainText);

  it('should handle empty string', () => {
    const input = '';
    expect(tokenize(input)).toEqual([]);
  });

  it('should parse plain text', () => {
    const input = 'Hello world';
    expect(tokenize(input)).toEqual([
      { type: 'text', value: 'Hello world', raw: 'Hello world' },
    ]);
  });

  it('should parse bold text', () => {
    const input = 'Hello **bold** world';
    expect(tokenize(input)).toEqual([
      { type: 'text', value: 'Hello ', raw: 'Hello ' },
      { type: 'bold', raw: '**' },
      { type: 'text', value: 'bold', raw: 'bold' },
      { type: 'bold', raw: '**' },
      { type: 'text', value: ' world', raw: ' world' },
    ]);
  });

  it('should parse italic text', () => {
    const input = 'Hello *italic* world';
    expect(tokenize(input)).toEqual([
      { type: 'text', value: 'Hello ', raw: 'Hello ' },
      { type: 'italic', raw: '*' },
      { type: 'text', value: 'italic', raw: 'italic' },
      { type: 'italic', raw: '*' },
      { type: 'text', value: ' world', raw: ' world' },
    ]);
  });

  it('should parse strikethrough text', () => {
    const input = 'Hello ~~strike~~ world';
    expect(tokenize(input)).toEqual([
      { type: 'text', value: 'Hello ', raw: 'Hello ' },
      { type: 'strikethrough', raw: '~~' },
      { type: 'text', value: 'strike', raw: 'strike' },
      { type: 'strikethrough', raw: '~~' },
      { type: 'text', value: ' world', raw: ' world' },
    ]);
  });

  describe('monospace', () => {
    it('should parse monospace', () => {
      const input = 'Here is `some code` text';
      expect(tokenize(input)).toEqual([
        { type: 'text', value: 'Here is ', raw: 'Here is ' },
        { type: 'monospace', value: 'some code', raw: '`some code`' },
        { type: 'text', value: ' text', raw: ' text' },
      ]);
    });

    it('should parse monospace with special characters', () => {
      const input = '`code with **bold** inside`';
      expect(tokenize(input)).toEqual([
        { type: 'monospace', value: 'code with **bold** inside', raw: '`code with **bold** inside`' },
      ]);
    });

    it('should parse multiple monospace blocks', () => {
      const input = '`code1` text `code2`';
      expect(tokenize(input)).toEqual([
        { type: 'monospace', value: 'code1', raw: '`code1`' },
        { type: 'text', value: ' text ', raw: ' text ' },
        { type: 'monospace', value: 'code2', raw: '`code2`' },
      ]);
    });
  });

  it('should parse nested italic inside bold', () => {
    const input = '**bold *italic* bold**';
    expect(tokenize(input)).toEqual([
      { type: 'bold', raw: '**' },
      { type: 'text', value: 'bold ', raw: 'bold ' },
      { type: 'italic', raw: '*' },
      { type: 'text', value: 'italic', raw: 'italic' },
      { type: 'italic', raw: '*' },
      { type: 'text', value: ' bold', raw: ' bold' },
      { type: 'bold', raw: '**' },
    ]);
  });

  it('*** case', () => {
    const input = '***bold italic bold***';
    expect(tokenize(input)).toEqual([
      { type: 'bold', raw: '**' },
      { type: 'italic', raw: '*' },
      { type: 'text', value: 'bold italic bold', raw: 'bold italic bold' },
      { type: 'italic', raw: '*' },
      { type: 'bold', raw: '**' },
    ]);
  });

  it('**11 *22 33*** -> italic inside bold', () => {
    const input = '**11 *22 33***';
    expect(tokenize(input)).toEqual([
      { type: 'bold', raw: '**' },
      { type: 'text', value: '11 ', raw: '11 ' },
      { type: 'italic', raw: '*' },
      { type: 'text', value: '22 33', raw: '22 33' },
      { type: 'italic', raw: '*' },
      { type: 'bold', raw: '**' },
    ]);
  });

  it('should parse nested bold inside italic', () => {
    const input = '*Italic **Bold** still Italic*';
    const tokens = tokenize(input);

    expect(tokens).toEqual<InlineToken[]>([
      { type: 'italic', raw: '*' },
      { type: 'text', value: 'Italic ', raw: 'Italic ' },
      { type: 'bold', raw: '**' },
      { type: 'text', value: 'Bold', raw: 'Bold' },
      { type: 'bold', raw: '**' },
      { type: 'text', value: ' still Italic', raw: ' still Italic' },
      { type: 'italic', raw: '*' },
    ]);
  });

  it('should handle code within formatting', () => {
    const input = '**bold `code` bold**';
    expect(tokenize(input)).toEqual([
      { type: 'bold', raw: '**' },
      { type: 'text', value: 'bold ', raw: 'bold ' },
      { type: 'monospace', value: 'code', raw: '`code`' },
      { type: 'text', value: ' bold', raw: ' bold' },
      { type: 'bold', raw: '**' },
    ]);
  });

  it('should handle multiple text segments', () => {
    const input = 'text1 **bold** text2 *italic* text3';
    expect(tokenize(input)).toEqual([
      { type: 'text', value: 'text1 ', raw: 'text1 ' },
      { type: 'bold', raw: '**' },
      { type: 'text', value: 'bold', raw: 'bold' },
      { type: 'bold', raw: '**' },
      { type: 'text', value: ' text2 ', raw: ' text2 ' },
      { type: 'italic', raw: '*' },
      { type: 'text', value: 'italic', raw: 'italic' },
      { type: 'italic', raw: '*' },
      { type: 'text', value: ' text3', raw: ' text3' },
    ]);
  });

  it('should handle multiple nesting', () => {
    const input = 'Text **bold *italic and ~~striked~~* code** end';
    // Explanation: bold -> text -> italic -> text -> strikethrough -> text -> strikethrough end -> italic end -> text -> bold end

    const tokens = tokenize(input);

    expect(tokens).toEqual<InlineToken[]>([
      { type: 'text', value: 'Text ', raw: 'Text ' },
      // bold open
      { type: 'bold', raw: '**' },
      { type: 'text', value: 'bold ', raw: 'bold ' },
      // italic open
      { type: 'italic', raw: '*' },
      { type: 'text', value: 'italic and ', raw: 'italic and ' },
      // strike open
      { type: 'strikethrough', raw: '~~' },
      { type: 'text', value: 'striked', raw: 'striked' },
      // strike close
      { type: 'strikethrough', raw: '~~' },
      { type: 'italic', raw: '*' },
      { type: 'text', value: ' code', raw: ' code' },
      // bold close
      { type: 'bold', raw: '**' },
      { type: 'text', value: ' end', raw: ' end' },
    ]);
  });

  describe('mentions', () => {
    it('should parse mention', () => {
      const input = 'Hello [user](id:123)!';
      expect(tokenize(input)).toEqual([
        { type: 'text', value: 'Hello ', raw: 'Hello ' },
        { type: 'mention', raw: '[user](id:123)', userId: '123', value: 'user' },
        { type: 'text', value: '!', raw: '!' },
      ]);
    });

    it.skip('should not parse mention if user id is not a number', () => {
      const input = 'Hello [user](id:abc)!';
      expect(tokenize(input)).toEqual([
        { type: 'text', value: 'Hello [user](id:abc)!', raw: 'Hello [user](id:abc)!' },
      ]);
    });

    // it('should parse mention with spaces in username', () => {
    //   const input = '[John Doe](mention:456)';
    //   expect(tokenize(input)).toEqual([
    //     { type: 'mention', raw: '[John Doe](mention:456)', userId: '456' },
    //     { type: 'text', value: 'John Doe', raw: 'John Doe' },
    //     { type: 'mention-close', raw: '' },
    //   ]);
    // });

    it('should parse multiple mentions', () => {
      const input = '[user1](id:123) and [user2](id:456)';
      expect(tokenize(input)).toEqual([
        { type: 'mention', raw: '[user1](id:123)', userId: '123', value: 'user1' },
        { type: 'text', value: ' and ', raw: ' and ' },
        { type: 'mention', raw: '[user2](id:456)', userId: '456', value: 'user2' },
      ]);
    });

    it('should handle mention within formatted text', () => {
      const input = '**Hello [user](id:123)!**';
      expect(tokenize(input)).toEqual([
        { type: 'bold', raw: '**' },
        { type: 'text', value: 'Hello ', raw: 'Hello ' },
        { type: 'mention', raw: '[user](id:123)', userId: '123', value: 'user' },
        { type: 'text', value: '!', raw: '!' },
        { type: 'bold', raw: '**' },
      ]);
    });

    it('should handle mention within formatting inside', () => {
      const input = 'Hello [**user**](id:123)';

      expect(tokenize(input)).toEqual([
        { type: 'text', value: 'Hello ', raw: 'Hello ' },
        { type: 'mention', raw: '[**user**](id:123)', userId: '123', value: '**user**' },
      ]);
    });

    it('should not handle mention without user id', () => {
      const input = 'Hello [user](id)';

      expect(tokenize(input)).toEqual([
        { type: 'text', value: 'Hello ', raw: 'Hello ' },
        { type: 'link', raw: '[user](id)', value: 'id' },
        { type: 'text', value: 'user', raw: 'user' },
        { type: 'link-close', raw: '' },
      ]);
    });

    it('should handle mention without user id but with : as text', () => {
      const input = 'Hello [user](id:)';

      expect(tokenize(input)).toEqual([
        { type: 'text', value: 'Hello [user](id:)', raw: 'Hello [user](id:)' },
      ]);
    });
  });

  describe('links', () => {
    it('should parse simple link', () => {
      const input = '[Click here](https://example.com)';
      const tokens = tokenize(input);
      expect(tokens).toEqual([
        {
          type: 'link',
          value: 'https://example.com',
          raw: '[Click here](https://example.com)',
        },
        { type: 'text', value: 'Click here', raw: 'Click here' },
        { type: 'link-close', raw: '' },
      ]);
    });

    it('should parse multiple links', () => {
      const input = '[Link1](url1) and [Link2](url2)';
      expect(tokenize(input)).toEqual([
        { type: 'link', value: 'url1', raw: '[Link1](url1)' },
        { type: 'text', value: 'Link1', raw: 'Link1' },
        { type: 'link-close', raw: '' },
        { type: 'text', value: ' and ', raw: ' and ' },
        { type: 'link', value: 'url2', raw: '[Link2](url2)' },
        { type: 'text', value: 'Link2', raw: 'Link2' },
        { type: 'link-close', raw: '' },
      ]);
    });

    it('should parse links with special characters in URL', () => {
      const input = '[Link](https://example.com/path?param=value#hash)';
      expect(tokenize(input)).toEqual([
        { type: 'link', value: 'https://example.com/path?param=value#hash', raw: '[Link](https://example.com/path?param=value#hash)' },
        { type: 'text', value: 'Link', raw: 'Link' },
        { type: 'link-close', raw: '' },
      ]);
    });

    describe('invalid links', () => {
      it('should parse unclosed brackets as text', () => {
        const input = '[text(url)';
        expect(tokenize(input)).toEqual([
          { type: 'text', value: '[text(url)', raw: '[text(url)' },
        ]);
      });

      it('should parse missing url as text', () => {
        const input = '[text]()';
        expect(tokenize(input)).toEqual([
          { type: 'text', value: '[text]()', raw: '[text]()' },
        ]);
      });
    });
  });

  describe('unclosed formatting', () => {
    it('should handle unclosed bold', () => {
      const input = '**bold';
      expect(tokenize(input)).toEqual([
        { type: 'bold', raw: '**' },
        { type: 'text', value: 'bold', raw: 'bold' },
      ]);
    });

    it('should handle unclosed italic', () => {
      const input = '*italic';
      expect(tokenize(input)).toEqual([
        { type: 'italic', raw: '*' },
        { type: 'text', value: 'italic', raw: 'italic' },
      ]);
    });
  });

  describe('escaped characters', () => {
    it('should handle escaped asterisks', () => {
      const input = 'normal \\*not italic\\* text';
      expect(tokenize(input)).toEqual([
        { type: 'text', value: 'normal *not italic* text', raw: 'normal *not italic* text' },
      ]);
    });

    it('should handle escaped backticks', () => {
      const input = 'normal \\`not code\\` text';
      expect(tokenize(input)).toEqual([
        { type: 'text', value: 'normal `not code` text', raw: 'normal `not code` text' },
      ]);
    });
  });

  it('should handle consecutive formatting markers', () => {
    const input = '**bold** **also bold**';
    expect(tokenize(input)).toEqual([
      { type: 'bold', raw: '**' },
      { type: 'text', value: 'bold', raw: 'bold' },
      { type: 'bold', raw: '**' },
      { type: 'text', value: ' ', raw: ' ' },
      { type: 'bold', raw: '**' },
      { type: 'text', value: 'also bold', raw: 'also bold' },
      { type: 'bold', raw: '**' },
    ]);
  });

  it('should handle plain text', () => {
    const input = 'plain **text**';
    const isPlainText = true;

    expect(tokenize(input, isPlainText)).toEqual([
      { type: 'text', value: 'plain **text**', raw: 'plain **text**' },
    ]);
  });

  describe('underline', () => {
    it('should parse underline text', () => {
      const input = 'Hello <u>underline</u> world';
      expect(tokenize(input)).toEqual([
        { type: 'text', value: 'Hello ', raw: 'Hello ' },
        { type: 'underline', raw: '<u>' },
        { type: 'text', value: 'underline', raw: 'underline' },
        { type: 'underline', raw: '</u>' },
        { type: 'text', value: ' world', raw: ' world' },
      ]);
    });

    it('should not parse unclosed underline text', () => {
      const input = 'Hello <u>underline';
      expect(tokenize(input)).toEqual([
        { type: 'text', value: 'Hello <u>underline', raw: 'Hello <u>underline' },
      ]);
    });

    it('should not parse clossing underline whithou opening', () => {
      const input = 'text</u>';
      expect(tokenize(input)).toEqual([
        { type: 'text', value: 'text</u>', raw: 'text</u>' },
      ]);
    });

    it('should handle nested formatting inside underline', () => {
      const input = '<u>text **bold** text</u>';
      expect(tokenize(input)).toEqual([
        { type: 'underline', raw: '<u>' },
        { type: 'text', value: 'text ', raw: 'text ' },
        { type: 'bold', raw: '**' },
        { type: 'text', value: 'bold', raw: 'bold' },
        { type: 'bold', raw: '**' },
        { type: 'text', value: ' text', raw: ' text' },
        { type: 'underline', raw: '</u>' },
      ]);
    });
  });

  describe('spoiler', () => {
    it('should parse spoiler text', () => {
      const input = 'Hello ||hidden|| world';
      expect(tokenize(input)).toEqual([
        { type: 'text', value: 'Hello ', raw: 'Hello ' },
        { type: 'spoiler', raw: '||' },
        { type: 'text', value: 'hidden', raw: 'hidden' },
        { type: 'spoiler', raw: '||' },
        { type: 'text', value: ' world', raw: ' world' },
      ]);
    });

    it('should handle nested formatting inside spoiler', () => {
      const input = '||text **bold** text||';
      expect(tokenize(input)).toEqual([
        { type: 'spoiler', raw: '||' },
        { type: 'text', value: 'text ', raw: 'text ' },
        { type: 'bold', raw: '**' },
        { type: 'text', value: 'bold', raw: 'bold' },
        { type: 'bold', raw: '**' },
        { type: 'text', value: ' text', raw: ' text' },
        { type: 'spoiler', raw: '||' },
      ]);
    });
  });

  describe('custom emoji', () => {
    it('should parse custom emoji', () => {
      const input = 'Hello [😀](doc:5062301574668222465) world';
      expect(tokenize(input)).toEqual([
        { type: 'text', value: 'Hello ', raw: 'Hello ' },
        { type: 'customEmoji', raw: '[😀](doc:5062301574668222465)', documentId: '5062301574668222465', value: '😀' },
        { type: 'text', value: ' world', raw: ' world' },
      ]);
    });

    it.skip('should not be parsed if document id is not a number', () => {
      const input = 'Hello [😀](doc:1ac)';
      expect(tokenize(input)).toEqual([
        { type: 'text', value: 'Hello [😀](doc:1a2)', raw: 'Hello [😀](doc:1a2)' },
      ]);
    });

    it('should parse multiple mentions', () => {
      const input = '[😀](doc:5062301574668222465)[☺️](doc:5062301574668333789)';
      expect(tokenize(input)).toEqual([
        { type: 'customEmoji', raw: '[😀](doc:5062301574668222465)', documentId: '5062301574668222465', value: '😀' },
        { type: 'customEmoji', raw: '[☺️](doc:5062301574668333789)', documentId: '5062301574668333789', value: '☺️' },
      ]);
    });

    it('should handle custom emoji within formatted text', () => {
      const input = '**Hello [😀](doc:5062301574668222465)!**';
      expect(tokenize(input)).toEqual([
        { type: 'bold', raw: '**' },
        { type: 'text', value: 'Hello ', raw: 'Hello ' },
        { type: 'customEmoji', raw: '[😀](doc:5062301574668222465)', documentId: '5062301574668222465', value: '😀' },
        { type: 'text', value: '!', raw: '!' },
        { type: 'bold', raw: '**' },
      ]);
    });

    it('should not handle custom emoji without document id', () => {
      const input = 'Hello [😀](doc:)';

      expect(tokenize(input)).toEqual([
        { type: 'text', value: 'Hello [😀](doc:)', raw: 'Hello [😀](doc:)' },
      ]);
    });
  });
});
