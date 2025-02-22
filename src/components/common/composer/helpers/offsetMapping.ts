import type { OffsetMapping } from '../ast/entities/OffsetMapping';

export function mdToHtmlOffset(offsetMapping: OffsetMapping, mdOffset: number): number {
  const record = offsetMapping.find((m) => mdOffset >= m.mdStart && mdOffset <= m.mdEnd);

  if (record) {
    if (record.nodeType === 'mention' || record.nodeType === 'customEmoji') {
      if (mdOffset === record.mdStart) {
        return record.htmlStart;
      }
      if (mdOffset > record.mdStart + (record.htmlEnd - record.htmlStart)) {
        return record.htmlEnd;
      }
      const relativeOffset = mdOffset - record.mdStart;
      return record.htmlStart + relativeOffset;
    }

    const relativeOffset = mdOffset - record.mdStart;
    return record.htmlStart + relativeOffset;
  }

  const lastRecord = [...offsetMapping]
    .reverse()
    .find((m) => mdOffset > m.mdEnd);

  if (lastRecord) {
    const relativeOffset = mdOffset - lastRecord.mdEnd;
    return lastRecord.htmlEnd + relativeOffset;
  }

  return mdOffset;
}

export function htmlToMdOffset(offsetMapping: OffsetMapping, htmlOffset: number): number {
  const record = offsetMapping.find((m) => {
    return htmlOffset >= m.htmlStart && htmlOffset < m.htmlEnd;
  });

  if (record) {
    if (record.nodeType === 'mention') {
      if (htmlOffset === record.htmlStart) {
        return record.mdStart;
      }
      return record.mdEnd;
    }

    const relativeOffset = htmlOffset - record.htmlStart;
    return record.mdStart + relativeOffset;
  }

  const lastRecord = [...offsetMapping]
    .reverse()
    .find((m) => htmlOffset >= m.htmlEnd);

  if (lastRecord) {
    const relativeOffset = htmlOffset - lastRecord.htmlEnd;
    return lastRecord.mdEnd + relativeOffset;
  }

  return htmlOffset;
}
