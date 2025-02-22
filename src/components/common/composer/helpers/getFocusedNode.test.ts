import type {
  ASTBoldNode, ASTFormattingNode, ASTParagraphBlockNode, ASTTextNode,
} from '../ast/entities/ASTNode';

import { MarkdownParser } from '../ast';
import { getFocusedNode } from './getFocusedNode';

describe('getFocusedNode', () => {
  const parser = new MarkdownParser();

  it('should find text node at offset', () => {
    const text = 'Hello world';
    const ast = parser.fromString(text);

    const result = getFocusedNode(2, ast);

    expect(result.node).toMatchObject({
      type: 'text',
      value: 'Hello world',
      raw: 'Hello world',
    });
    expect(result.currentOffset).toBe(0);
  });

  it('should find text inside formatting node', () => {
    const text = '**bold text**';
    const ast = parser.fromString(text);

    const result = getFocusedNode(4, ast);

    expect(result.node?.type).toBe('text');
    expect((result.node as any).value).toBe('bold text');
  });

  it('should treat take into account each formatting chars', () => {
    const text = '1**2**3';
    const ast = parser.fromString(text);

    const result = getFocusedNode(7, ast);
    const resultNode = result.node as ASTTextNode;

    expect(resultNode.type).toBe('text');
    expect(resultNode.value).toBe('3');
    expect(resultNode.raw).toBe('3');
    expect(result.parentNode?.type).toBe('paragraph');
    expect(result.parentNode?.raw).toBe('1**2**3');
  });

  it('should handle unclosed formatting nodes', () => {
    const text = 'start ** end'; // Start bold
    const ast = parser.fromString(text);

    // Position cursor after the first asterisk
    const result = getFocusedNode(7, ast);

    expect(result.node?.type).toBe('bold');
    expect(result.parentNode?.type).toBe('paragraph');
  });

  it('should count markdown characters', () => {
    const text = '*0* *1*';
    const ast = parser.fromString(text);

    const result = getFocusedNode(6, ast); // after *1
    const resultNode = result.node as ASTTextNode;
    const resultParentNode = result.parentNode as ASTFormattingNode;

    expect(resultNode.type).toBe('text');
    expect(resultNode.value).toBe('1');
    expect(resultNode.raw).toBe('1');
    expect(resultParentNode.type).toBe('italic');
    expect(resultParentNode.raw).toBe('*1*');
    expect(resultParentNode.closed).toBe(true);
    expect((resultParentNode.children?.[0] as ASTTextNode).value).toBe('1');
    expect((resultParentNode.children?.[0] as ASTTextNode).raw).toBe('1');
  });

  it('should handle multiple nodes', () => {
    const text = 'start **middle** end';
    const ast = parser.fromString(text);

    const startResult = getFocusedNode(2, ast);
    expect(startResult.node?.type).toBe('text');
    expect(startResult.parentNode?.type).toBe('paragraph');
    expect((startResult.parentNode as ASTParagraphBlockNode).raw).toBe('start **middle** end');
    expect((startResult.node as any).value).toBe('start ');

    // Test bold text
    const boldResult = getFocusedNode(8, ast);
    expect(boldResult.node?.type).toBe('text');
    expect(boldResult.parentNode?.type).toBe('bold');
    expect((boldResult.parentNode as ASTBoldNode).raw).toBe('**middle**');
    expect((boldResult.node as any).value).toBe('middle');

    // Test end text
    const endResult = getFocusedNode(14, ast);
    expect(endResult.node).toMatchObject({ type: 'text', value: 'middle', raw: 'middle' });
    expect(endResult.parentNode).toMatchObject({
      type: 'bold',
      raw: '**middle**',
      closed: true,
      children: [
        {
          type: 'text',
          value: 'middle',
          raw: 'middle',
        },
      ],
    });
  });

  it('should handle italic inside bold', () => {
    const text = '**bold *italic* text**';
    const ast = parser.fromString(text);

    const boldResult = getFocusedNode(2, ast);
    expect(boldResult.node).toMatchObject({ type: 'text', value: 'bold ', raw: 'bold ' });
    expect(boldResult.parentNode?.raw).toBe('**bold *italic* text**');

    const italicResult = getFocusedNode(9, ast);

    expect(italicResult.node).toMatchObject({ type: 'text', value: 'italic', raw: 'italic' });
    expect(italicResult.parentNode?.raw).toBe('*italic*');
  });

  it('should handle bold inside italic', () => {
    const text = '*italic **bold** text*';
    const ast = parser.fromString(text);

    const italicResult = getFocusedNode(2, ast);

    expect(italicResult.node).toMatchObject({ type: 'text', value: 'italic ', raw: 'italic ' });
    expect(italicResult.parentNode?.raw).toBe('*italic **bold** text*');

    const boldResult = getFocusedNode(9, ast);

    expect(boldResult.node).toMatchObject({
      type: 'bold',
      raw: '**bold**',
      closed: true,
      children: [{ type: 'text', value: 'bold', raw: 'bold' }],
    });
    expect(boldResult.parentNode?.raw).toBe('*italic **bold** text*');
  });

  it.skip('should supprt ***', () => {
    const text = '***';
    const ast = parser.fromString(text);

    const node = getFocusedNode(2, ast);

    expect(node.node).toMatchObject({ type: 'text', value: 'italic ', raw: 'italic ' });
    expect(node.parentNode?.raw).toBe('*italic **bold** text*');
  });

  it('should handle offset beyond text length', () => {
    const text = 'short';
    const ast = parser.fromString(text);

    const result = getFocusedNode(10, ast);

    expect(result.node).toBeNull();
    expect(result.currentOffset).toBe(5);
  });

  it('should return paragraph for offset 0', () => {
    const text = '**bold**';
    const ast = parser.fromString(text);

    const result = getFocusedNode(0, ast);
    expect(result.node?.type).toBe('paragraph');
  });

  it('should handle cursor at formatting markers', () => {
    // Arrange
    const text = '1 **2**';
    const ast = parser.fromString(text);

    // Act & Assert
    // At opening marker
    const atStart = getFocusedNode(3, ast);

    expect(atStart.node?.type).toBe('bold');
    expect(atStart.node?.raw).toBe('**2**');

    // At closing marker
    const atEnd = getFocusedNode(6, ast);
    expect(atEnd.node?.type).toBe('bold');
    expect(atEnd.node?.raw).toBe('**2**');
  });

  it('should handle incomplete formatting', () => {
    const text = 'start *text'; // Unclosed italic
    const ast = parser.fromString(text);

    const result = getFocusedNode(8, ast);

    expect(result).toMatchObject({
      node: { type: 'text', value: 'text', raw: 'text' },
      parentNode: {
        type: 'italic',
        raw: '*text',
        closed: false,
        children: [{ type: 'text', value: 'text', raw: 'text' }],
      },
      currentOffset: 7,
    });
  });

  it('should find text node with parent', () => {
    // Arrange
    const text = '**bold text**';
    const ast = parser.fromString(text);

    // Act
    const result = getFocusedNode(4, ast);

    // Assert
    expect(result.node?.type).toBe('text');
    expect(result.parentNode?.type).toBe('bold');
    expect((result.node as any).value).toBe('bold text');
  });

  describe('links', () => {
    it('should return link node for offset at opening bracket', () => {
      const text = '1 [Click here](https://example.com) 2';
      const ast = parser.fromString(text);

      const result = getFocusedNode(3, ast);

      expect(result.node).toMatchObject(
        { type: 'text', value: 'Click here', raw: 'Click here' },
      );
      expect(result.parentNode).toMatchObject({
        type: 'link',
        raw: '[Click here](https://example.com)',
        href: 'https://example.com',
        closed: true,
        children: [
          { type: 'text', value: 'Click here', raw: 'Click here' },
        ],
      });
    });

    it('should return text node for offset inside link text', () => {
      const text = '1 [Click here](https://example.com) 2';
      const ast = parser.fromString(text);

      const result = getFocusedNode(5, ast);
      expect(result.node?.type).toBe('text');
      expect(result.parentNode?.type).toBe('link');
    });

    it('should return link node for offset in URL part', () => {
      const text = '1 [Click here](https://example.com) 2';
      const ast = parser.fromString(text);

      const result = getFocusedNode(20, ast);
      expect(result.node?.type).toBe('link');
    });

    it('should return link node for offset at closing parenthesis', () => {
      const text = '1 [2](3) 4';
      const ast = parser.fromString(text);

      const result = getFocusedNode(8, ast);
      expect(result.node?.type).toBe('link');
    });
  });

  it('large line', () => {
    const text = '1\n2\n3\n4\n5\n6\n```\n```';
    const ast = parser.fromString(text);

    const result = getFocusedNode(15, ast);
    expect(result.node?.type).toBe('pre');
  });

  it('handle line breaks', () => {
    const text = '\n1';
    const ast = parser.fromString(text);

    const result = getFocusedNode(1, ast);
    expect(result.node?.type).toBe('paragraph');

    const result2 = getFocusedNode(2, ast);
    expect(result2.node?.type).toBe('text');
  });

  describe('monospace ', () => {
    it('should return monospace for offset at opening backtick', () => {
      const text = '1 `2` 3';
      const ast = parser.fromString(text);

      const result = getFocusedNode(3, ast);

      expect(result.node).toMatchObject({
        type: 'monospace', value: '2', raw: '`2`', closed: true,
      });
      expect(result.parentNode?.type).toBe('paragraph');
      expect(result.parentNode?.raw).toBe('1 `2` 3');
    });
  });

  describe('quote', () => {
    it('should return text as child of quote node for offset at opening quote', () => {
      const text = '1\n>2';
      const ast = parser.fromString(text);

      const result = getFocusedNode(3, ast);

      expect(result.parentNode).toMatchObject({
        type: 'quote',
        raw: '>2',
        children: [{ type: 'text', value: '2', raw: '2' }],
      });
    });

    it('should not return quote if > is not at the beginning of the line', () => {
      const text = '1 >2';
      const ast = parser.fromString(text);

      const result = getFocusedNode(3, ast);

      expect(result.node).toMatchObject({
        type: 'text',
        raw: '1 >2',
        value: '1 >2',
      });
    });

    it('should return quote if offset at the quote body', () => {
      const text = '1\n>2 3 4 5';
      const ast = parser.fromString(text);

      const result = getFocusedNode(6, ast);

      expect(result.node).toMatchObject({
        type: 'text',
        raw: '2 3 4 5',
        value: '2 3 4 5',
      });
      expect(result.parentNode?.type).toBe('quote');
      expect(result.parentNode?.raw).toBe('>2 3 4 5');
    });

    it('should return quote if quote body is empty', () => {
      const text = '1\n>';
      const ast = parser.fromString(text);

      const result = getFocusedNode(3, ast);

      expect(result.node).toMatchObject({
        type: 'quote',
        raw: '>',
        children: [],
      });
      expect(result.parentNode?.type).toBe('root');
    });
  });

  describe('underline', () => {
    // it.each([
    //   ['1<u>2</u>3', 2],
    //   ['1<u>2</u>3', 3],
    //   ['1<u>2</u>3', 4],
    //   ['1<u>2</u>3', 6],
    //   ['1<u>2</u>3', 7],
    //   ['1<u>2</u>3', 8],
    // ])('should return underline node for offset at tag: %s, %s', (text: string, offset: number) => {
    //   const ast = parser.fromString(text);
    //   const result = getFocusedNode(offset, ast);

    //   expect(result.node).toMatchObject({
    //     type: 'underline',
    //     raw: '<u>2</u>',
    //   });
    // });

    it.each([
      ['1<u>2</u>3', 1, 'text', '1'],
      ['1<u>2</u>3', 2, 'underline', '<u>2</u>'],
      ['1<u>2</u>3', 3, 'underline', '<u>2</u>'],
      ['1<u>2</u>3', 4, 'text', '2'],
      ['1<u>2</u>3', 5, 'text', '2'],
      ['1<u>2</u>3', 6, 'underline', '<u>2</u>'],
      ['1<u>2</u>3', 7, 'underline', '<u>2</u>'],
      ['1<u>2</u>3', 8, 'underline', '<u>2</u>'],
      ['1<u>2</u>3', 9, 'underline', '<u>2</u>'],
      ['1<u>2</u>3', 10, 'text', '3'],

    ])('for %s with offset %o should return %s tag with raw %s', (text: string, offset: number, expectedType: string, expectedRaw: string) => {
      const ast = parser.fromString(text);
      const result = getFocusedNode(offset, ast);

      expect(result.node?.type).toBe(expectedType);
      expect(result.node?.raw).toBe(expectedRaw);
    });
  });

  describe('mention', () => {
    it.skip('should return mention node for offset at opening bracket', () => {
      const text = '1 [Name](id:123) 2';
      const ast = parser.fromString(text);

      const result = getFocusedNode(3, ast);

      expect(result.node).toMatchObject(
        { type: 'text', raw: 'Name', value: 'Name' },
      );
      expect(result.parentNode).toMatchObject({
        type: 'mention',
        raw: '[Name](id:123)',
        userId: '123',
        children: [{ type: 'text', raw: 'Name', value: 'Name' }],
      });
    });

    it('should handle code after mention', () => {
      const ast = parser.fromString('01 [Name](id:123)19 `21`');
      const result = getFocusedNode(10, ast);

      expect(result.node).toMatchObject({ type: 'monospace' });
      expect(result.parentNode?.type).toBe('paragraph');
      expect(result.parentNode?.raw).toBe('01 [Name](id:123)19 `21`');
    });

    it('should return text node for offset inside link text', () => {
      const text = '1 [Click here](https://example.com) 2';
      const ast = parser.fromString(text);

      const result = getFocusedNode(5, ast);
      expect(result.node?.type).toBe('text');
      expect(result.parentNode?.type).toBe('link');
    });

    it('should return link node for offset in URL part', () => {
      const text = '1 [Click here](https://example.com) 2';
      const ast = parser.fromString(text);

      const result = getFocusedNode(20, ast);
      expect(result.node?.type).toBe('link');
    });

    it('should return link node for offset at closing parenthesis', () => {
      const text = '1 [2](3) 4';
      const ast = parser.fromString(text);

      const result = getFocusedNode(8, ast);
      expect(result.node?.type).toBe('link');
    });
  });
});
