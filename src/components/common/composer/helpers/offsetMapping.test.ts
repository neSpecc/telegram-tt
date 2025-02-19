import type { OffsetMappingRecord } from '../ast/entities/OffsetMapping';

import { generateNodeId } from './node';
import { htmlToMdOffset, mdToHtmlOffset } from './offsetMapping';

describe('offset mapping', () => {
  const offsetMapping = [
    {
      htmlStart: 0,
      htmlEnd: 6,
      mdStart: 0,
      mdEnd: 15,
      nodeType: 'mention',
      raw: '[Tanya](id:123)',
      nodeId: generateNodeId(),
    },
    {
      htmlStart: 6,
      htmlEnd: 7,
      mdStart: 15,
      mdEnd: 16,
      nodeType: 'text',
      raw: 'ф',
      nodeId: generateNodeId(),
    },
  ];

  describe('htmlToMdOffset', () => {
    it('should map start of mention correctly', () => {
      expect(htmlToMdOffset(offsetMapping, 0)).toBe(0);
    });

    it('should map inside mention to end', () => {
      expect(htmlToMdOffset(offsetMapping, 1)).toBe(15);
      expect(htmlToMdOffset(offsetMapping, 5)).toBe(15);
    });

    it('should map text after mention correctly', () => {
      expect(htmlToMdOffset(offsetMapping, 6)).toBe(15);
      expect(htmlToMdOffset(offsetMapping, 7)).toBe(16);
    });

    it('should map positions after all content', () => {
      expect(htmlToMdOffset(offsetMapping, 8)).toBe(17);
    });

    it('should map text before mention correctly', () => {
      const mapping = [
        {
          htmlStart: 0,
          htmlEnd: 3,
          mdStart: 0,
          mdEnd: 3,
          nodeType: 'text',
          raw: '123',
          nodeId: generateNodeId(),
        },
        {
          htmlStart: 3,
          htmlEnd: 6,
          mdStart: 3,
          mdEnd: 18,
          nodeType: 'mention',
          raw: '[Tanya](id:123)',
          nodeId: generateNodeId(),
        },
      ];
      expect(htmlToMdOffset(mapping, 0)).toBe(0);
      expect(htmlToMdOffset(mapping, 1)).toBe(1);
      expect(htmlToMdOffset(mapping, 2)).toBe(2);
      expect(htmlToMdOffset(mapping, 3)).toBe(3);
      expect(htmlToMdOffset(mapping, 4)).toBe(18);
      expect(htmlToMdOffset(mapping, 5)).toBe(18);
    });
  });

  // Add more complex test cases
  describe('complex cases', () => {
    it('should handle multiple mentions', () => {
      const offsetMapping = [
        {
          htmlStart: 0,
          htmlEnd: 6,
          mdStart: 0,
          mdEnd: 15,
          nodeType: 'mention',
          raw: '[Tanya](id:123)',
          nodeId: generateNodeId(),
        },
        {
          htmlStart: 6,
          htmlEnd: 7,
          mdStart: 15,
          mdEnd: 16,
          nodeType: 'text',
          raw: ' ',
          nodeId: generateNodeId(),
        },
        {
          htmlStart: 7,
          htmlEnd: 12,
          mdStart: 16,
          mdEnd: 30,
          nodeType: 'mention',
          raw: '[Boris](id:456)',
          nodeId: generateNodeId(),
        },
      ];

      // Test specific positions
      expect(htmlToMdOffset(offsetMapping, 0)).toBe(0); // Start of first mention
      expect(htmlToMdOffset(offsetMapping, 1)).toBe(15); // Inside first mention
      expect(htmlToMdOffset(offsetMapping, 6)).toBe(15); // Space between mentions
      expect(htmlToMdOffset(offsetMapping, 7)).toBe(16); // Start of second mention
      expect(htmlToMdOffset(offsetMapping, 8)).toBe(30); // Inside second mention
    });
  });
});

describe('mdToHtmlOffset', () => {
  const offsetMapping: OffsetMappingRecord[] = [
    {
      htmlStart: 0,
      htmlEnd: 6,
      mdStart: 0,
      mdEnd: 15,
      nodeType: 'mention',
      raw: '[Tanya](id:123)',
      nodeId: generateNodeId(),
    },
    {
      htmlStart: 6,
      htmlEnd: 7,
      mdStart: 15,
      mdEnd: 16,
      nodeType: 'text',
      raw: 'ф',
      nodeId: generateNodeId(),
    },
  ];

  it('should map start of mention correctly', () => {
    expect(mdToHtmlOffset(offsetMapping, 0)).toBe(0); // Start of [Tanya] -> start of @Tanya
  });

  it('should map inside mention to html representation', () => {
    expect(mdToHtmlOffset(offsetMapping, 1)).toBe(1); // Inside [Tanya] -> inside @Tanya
    expect(mdToHtmlOffset(offsetMapping, 5)).toBe(5); // Inside [Tanya] -> inside @Tanya
    expect(mdToHtmlOffset(offsetMapping, 14)).toBe(6); // End of [Tanya](id:123) -> end of @Tanya
  });

  it('should map text after mention correctly', () => {
    expect(mdToHtmlOffset(offsetMapping, 15)).toBe(6); // Start of 'ф'
    expect(mdToHtmlOffset(offsetMapping, 16)).toBe(7); // End of 'ф'
  });

  it('should map positions after all content', () => {
    expect(mdToHtmlOffset(offsetMapping, 17)).toBe(8); // After all content
  });

  describe('complex cases', () => {
    it('should handle text before mention', () => {
      const mapping: OffsetMappingRecord[] = [
        {
          htmlStart: 0,
          htmlEnd: 3,
          mdStart: 0,
          mdEnd: 3,
          nodeType: 'text',
          raw: '123',
          nodeId: generateNodeId(),
        },
        {
          htmlStart: 3,
          htmlEnd: 9,
          mdStart: 3,
          mdEnd: 18,
          nodeType: 'mention',
          raw: '[Tanya](id:123)',
          nodeId: generateNodeId(),
        },
      ];

      expect(mdToHtmlOffset(mapping, 0)).toBe(0); // Start of '123'
      expect(mdToHtmlOffset(mapping, 1)).toBe(1); // Inside '123'
      expect(mdToHtmlOffset(mapping, 2)).toBe(2); // Inside '123'
      expect(mdToHtmlOffset(mapping, 3)).toBe(3); // Start of [Tanya]
      expect(mdToHtmlOffset(mapping, 4)).toBe(4); // Inside [Tanya]
      expect(mdToHtmlOffset(mapping, 17)).toBe(9); // End of [Tanya](id:123)
    });

    it('should handle multiple mentions', () => {
      const mapping: OffsetMappingRecord[] = [
        {
          htmlStart: 0,
          htmlEnd: 6,
          mdStart: 0,
          mdEnd: 15,
          nodeType: 'mention',
          raw: '[Tanya](id:123)',
          nodeId: generateNodeId(),
        },
        {
          htmlStart: 6,
          htmlEnd: 7,
          mdStart: 15,
          mdEnd: 16,
          nodeType: 'text',
          raw: ' ',
          nodeId: generateNodeId(),
        },
        {
          htmlStart: 7,
          htmlEnd: 12,
          mdStart: 16,
          mdEnd: 30,
          nodeType: 'mention',
          raw: '[Boris](id:456)',
          nodeId: generateNodeId(),
        },
      ];

      expect(mdToHtmlOffset(mapping, 0)).toBe(0); // Start of first mention
      expect(mdToHtmlOffset(mapping, 14)).toBe(6); // End of first mention
      expect(mdToHtmlOffset(mapping, 15)).toBe(6); // Space
      expect(mdToHtmlOffset(mapping, 16)).toBe(7); // Start of second mention
      expect(mdToHtmlOffset(mapping, 29)).toBe(12); // End of second mention
    });
  });

  it('should handle custom emoji', () => {
    const mapping: OffsetMappingRecord[] = [
      {
        htmlEnd: 1,
        htmlStart: 0,
        mdEnd: 19,
        mdStart: 0,
        nodeType: 'customEmoji',
        raw: '[square](doc:123)',
        nodeId: generateNodeId(),
      },
    ];

    expect(mdToHtmlOffset(mapping, 19)).toBe(1); // end
  });
});
