/* eslint-disable no-null/no-null */
import { isEmoji } from './char';

export type InputResult = [string, number];

export function useInputOperations({
  text,
  start,
  end,
}: {
  text: string;
  start: number;
  end: number;
}) {
  const isRange = start !== end;

  function removeRange(): InputResult {
    if (isRange) {
      text = text.slice(0, start) + text.slice(end);

      return [text, start];
    }

    return [text, start];
  }

  function insertText(textToInsert: string): InputResult {
    return [
      text.slice(0, start) + textToInsert + text.slice(end),
      start + textToInsert.length,
    ];
  }

  function insertReplacementText(dataTransfer: DataTransfer | null): InputResult {
    if (dataTransfer === null) {
      return [text, start];
    }

    const replacementText = dataTransfer.getData('text/plain');

    if (replacementText === null) {
      return [text, start];
    }

    return insertText(replacementText);
  }

  function insertParagraph(): InputResult {
    return insertText('\n');
  }

  function insertLineBreak(): InputResult {
    return insertParagraph();
  }

  function deleteContent(): InputResult {
    return deleteContentBackward();
  }

  function deleteContentBackward(): InputResult {
    if (isRange) {
      return removeRange();
    }
    if (start === 0) {
      return [text, start];
    }

    const prevTwoChars = text.slice(start - 2, start);

    let sliceStart = start;

    if (isEmoji(prevTwoChars)) {
      sliceStart -= 2;
    } else {
      sliceStart -= 1;
    }

    text = text.slice(0, sliceStart) + text.slice(start);

    return [text, Math.max(sliceStart, 0)];
  }

  function deleteContentForward(): InputResult {
    if (start === text.length) {
      return [text, start];
    }

    if (isRange) {
      return removeRange();
    }

    const nextTwoChars = text.slice(start, start + 2);
    let sliceEnd = start;

    if (isEmoji(nextTwoChars)) {
      sliceEnd += 2;
    } else {
      sliceEnd += 1;
    }

    text = text.slice(0, start) + text.slice(sliceEnd);

    return [text, Math.min(start, text.length)];
  }

  function deleteWordBackward(): InputResult {
    if (isRange) {
      return removeRange();
    }

    let wordStart = start;

    while (wordStart > 0 && /\s/.test(text[wordStart - 1])) {
      wordStart--;
    }

    while (wordStart > 0 && !/\s/.test(text[wordStart - 1])) {
      wordStart--;
    }

    text = text.slice(0, wordStart) + text.slice(start);

    return [text, wordStart];
  }

  function deleteWordForward(): InputResult {
    if (isRange) {
      text = text.slice(0, start) + text.slice(end);

      return [text, start];
    }

    let wordEnd = start;

    while (wordEnd < text.length && /\s/.test(text[wordEnd])) {
      wordEnd++;
    }

    while (wordEnd < text.length && !/\s/.test(text[wordEnd])) {
      wordEnd++;
    }

    text = text.slice(0, start) + text.slice(wordEnd);

    return [text, start];
  }

  function deleteSoftLineBackward(): InputResult {
    if (isRange) {
      return removeRange();
    }

    const textBeforeCursor = text.slice(0, start);
    const lineBreakIndex = Math.max(textBeforeCursor.lastIndexOf('\n') + 1, 0);
    const newText = textBeforeCursor.slice(0, lineBreakIndex) + text.slice(start);

    return [newText, lineBreakIndex];
  }

  function deleteHardLineBackward(): InputResult {
    return deleteSoftLineBackward();
  }

  function replaceSlice(newText: string): InputResult {
    const result = text.slice(0, start) + newText + text.slice(end);
    const newPosition = start + newText.length;

    return [result, newPosition];
  }

  function removeTextAt(pos: number, length: number): InputResult {
    return [
      text.slice(0, pos) + text.slice(pos + length),
      pos,
    ];
  }

  function insertTextAt(textToInsert: string, pos: number): [string, number] {
    return [
      text.slice(0, pos) + textToInsert + text.slice(pos),
      pos + textToInsert.length,
    ];
  }

  function deleteByCut(): InputResult {
    const newText = text.slice(0, start) + text.slice(end);

    return [
      newText,
      start,
    ];
  }

  return {
    insertText,
    insertReplacementText,
    insertParagraph,
    insertLineBreak,
    deleteContent,
    deleteContentForward,
    deleteContentBackward,
    deleteWordBackward,
    deleteWordForward,
    deleteSoftLineBackward,
    deleteHardLineBackward,
    replaceSlice,
    insertTextAt,
    removeTextAt,
    deleteByCut,
  };
}
