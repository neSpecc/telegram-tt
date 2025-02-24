/* eslint-disable no-null/no-null */
/* eslint-disable no-console */
/**
 * We count only text nodes, images and new lines
 */
function createParagraphWalker(div: Element, whatToShow?: number, filter?: NodeFilter, allowBr = false) {
  if (whatToShow) {
    return document.createTreeWalker(div, whatToShow, filter);
  }

  return document.createTreeWalker(
    div,
    // eslint-disable-next-line no-bitwise
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node: Node): number => {
        if (node.nodeType === Node.TEXT_NODE) {
          return NodeFilter.FILTER_ACCEPT;
        }
        if (allowBr && node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'BR') {
          return NodeFilter.FILTER_ACCEPT;
        }
        if (node.nodeType === Node.ELEMENT_NODE && (node as Element).classList.contains('custom-emoji')) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    },
  );
}

function getRange(): Range | undefined {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    return undefined;
  }

  return selection.getRangeAt(0);
}

function isCaretInParagraph(div: Element, container: Node): boolean {
  if (div === container) {
    return true;
  }

  // eslint-disable-next-line no-null/no-null
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_ALL, null);
  let node = walker.nextNode();

  while (node) {
    if (node === container) return true;

    node = walker.nextNode();
  }

  return false;
}

/**
 * Returns visible length of a node.
 * Text content for text nodes, 1 for other nodes (like <img>)
 */
function getNodeLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').length;
  }

  if (node.nodeType === Node.ELEMENT_NODE && (node as Element).classList.contains('custom-emoji')) {
    return 1;
  }

  return 0;
}

function getDivLength(div: Element): number {
  const walker = createParagraphWalker(div);
  let node = walker.nextNode();
  let length = 0;

  while (node) {
    length += getNodeLength(node);
    node = walker.nextNode();
  }

  return length;
}

export function getCaretOffset(input: HTMLElement, range = getRange(), isEnd = false): number {
  // console.groupCollapsed(`getCaretOffset: ${isEnd ? 'end' : 'start'}`);
  if (!range) {
    return 0;
  }

  let offset = 0;

  const rangeCurrentContainer = isEnd ? range.endContainer : range.startContainer;
  const rangeCurrentOffset = isEnd ? range.endOffset : range.startOffset;

  const paragraphs = Array.from(input.querySelectorAll('div.paragraph'));
  const caretDiv = paragraphs.find((div) => isCaretInParagraph(div, rangeCurrentContainer));

  // const checkForQuoteEnding = (possibleQuoteParagraph: Element) => {
  //   const isEndOfQuote = possibleQuoteParagraph.classList.contains('paragraph-quote') && !possibleQuoteParagraph.nextElementSibling;
  //   if (isEndOfQuote) {
  //     console.warn('end of quote. Increment offset %o by 1 beacuse in md it ends with \\n\\n instead of \\n ---> %o', offset, offset + 1);
  //     offset += 1;
  //   }
  // };

  for (const div of paragraphs) {
    // console.log('processing paragraph', div);
    if (div === caretDiv) {
      // console.log('caret in this paragraph', range);

      const walker = createParagraphWalker(div, undefined, undefined, true);
      let node = walker.nextNode();
      // console.log('node', node);

      /**
       * If startContainer is the paragraph div itself
       * Count nodes up to startOffset
       */
      if (rangeCurrentContainer === div) {
        // console.log('startContainer is the paragraph div itself. Probably, caret near IMG or BR');

        // const children = div.children;
        let count = 0;
        // if (rangeCurrentOffset > 0) {
        // offset += node ? getNodeLength(node) : 0;
        // console.log('incrementing offset %o by node length %o ----> %o', offset, getNodeLength(node), offset + getNodeLength(node));

        while (node && count < rangeCurrentOffset) {
          // console.log('counting nodes until we reach a node with range.startOffset %o', range.startOffset);
          offset += getNodeLength(node);
          count++;
          node = walker.nextNode();
        }
        // while (children[count] && count < rangeCurrentOffset) {
        //   console.log('counting nodes until we reach a node with range.startOffset %o', range.startOffset);
        //   offset += getNodeLength(children[count]);
        //   count++;
        // }
        // }
        // checkForQuoteEnding(div);
        break;
      }

      /**
       * Iterate through all text nodes before the caret
       * and increment the offset by the length of the text node
       */
      while (node && node !== rangeCurrentContainer) {
        // console.log('incrementing offset %o by node length %o ----> %o', offset, getNodeLength(node), offset + getNodeLength(node));
        offset += getNodeLength(node);
        node = walker.nextNode();
        // console.log('swithching to the next node', node);
      }

      /**
       * Caret is in a text node
       * Increment the offset by the local range offset
       */
      if (node === rangeCurrentContainer && node.nodeType === Node.TEXT_NODE) {
        // console.log(`caret in this node. incrementing offset %o by range.${isEnd ? 'endOffset' : 'startOffset'} %o ----> %o`, offset, range.startOffset, offset + range.startOffset);
        offset += rangeCurrentOffset;
      }
      break;
    }

    // console.log('caret not in this paragraph');

    /**
     * Caret is not in the current paragraph
     * Incrementing offset by whole div length before going to next paragraph
     */
    offset += getDivLength(div);
    // console.log('incrementing offset by whole paragraph length %o ----> %o', getDivLength(div), offset);

    /**
     * Increment offset by 1 because of div new line
     */
    offset += 1;
    // console.log('incrementing offset by 1 because of div new line ----> %o', offset);

    // checkForQuoteEnding(div);
  }

  // console.log('offset', offset);
  // console.groupEnd();

  return offset;
}

export function setCaretToNode(node: Node, localOffset: number, after = false) {
  if (!node) {
    return false;
  }

  const range = document.createRange();
  if (after) {
    if (node.nodeType === Node.TEXT_NODE) {
      range.setStart(node, localOffset);
    } else {
      range.setStartAfter(node);
    }
  } else {
    range.setStart(node, localOffset);
  }
  range.collapse(true);

  const selection = window.getSelection();
  if (!selection) {
    throw new Error('setCaretPosition: selection is null');
  }

  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

export function setCaretOffset(input: HTMLElement, htmlOffset: number) {
  // console.log('set caret offset', htmlOffset);

  try {
    // console.groupCollapsed(`setCaretOffset(${htmlOffset})`);

    let currentOffset = 0;
    let caretWasSet = false;

    // Iterate through paragraphs
    const paragraphs = Array.from(input.querySelectorAll('div.paragraph'));
    let lastNode: Node | undefined;
    let isParagraphEndsWithBr = false;

    for (const div of paragraphs) {
      // console.log('processing paragraph', div);

      const walker = createParagraphWalker(div, NodeFilter.SHOW_ALL, (node) => {
        /**
         * Skip all nodes inside custom emoji because we can't set caret to them (contenteditable=false)
         */
        if (node.nodeType === Node.TEXT_NODE) {
          if ((node as Text).parentElement?.closest('.custom-emoji') !== null) {
            return NodeFilter.FILTER_SKIP;
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          if (
            (node as Element).closest('.custom-emoji') !== null
            && !(node as Element).classList.contains('custom-emoji')
          ) {
            return NodeFilter.FILTER_SKIP;
          }
        }

        return NodeFilter.FILTER_ACCEPT;
      });

      let node = walker.nextNode();
      let paragraphIsEmpty = true; // Track if paragraph only has BR

      while (node) {
        // console.log('processing node', node);
        lastNode = node;
        if (node.nodeType === Node.TEXT_NODE) {
          // console.log('node is text node');
          isParagraphEndsWithBr = false;

          paragraphIsEmpty = false; // Has text content
          const text = node.textContent || '';
          const length = text.length;

          // const isInRange = currentOffset <= htmlOffset && htmlOffset <= currentOffset + length;
          // console.log(
          //   'isInRange? %o target offset %o should be between (cur) %o and (node end) %o',
          //   isInRange,
          //   htmlOffset,
          //   currentOffset,
          //   currentOffset + length,
          // );

          if (currentOffset <= htmlOffset && htmlOffset <= currentOffset + length) {
            const localOffset = htmlOffset - currentOffset;
            caretWasSet = setCaretToNode(node, localOffset);
            // console.log('set caret to node %o at local offset %o', node, node, localOffset);
            break;
          }
          // console.log('adding node length (%o) to the currentOffset(%o) = %o', length, currentOffset, currentOffset + length);

          currentOffset += length;
        } else if (node.nodeName === 'BR') {
          isParagraphEndsWithBr = true;

          // console.log('br currentOffset === htmlOffset', currentOffset === htmlOffset, currentOffset, htmlOffset);
          if (currentOffset === htmlOffset) {
            caretWasSet = setCaretToNode(node, 0, true);
            // console.log('set caret to br', node);
            break;
          }
          // console.log('incrementing current offset by 1 because of br. %o + 1 ---> %o', currentOffset, currentOffset + 1);
          currentOffset += 1;
        } else if (node.nodeType === Node.ELEMENT_NODE && (node as Element).classList.contains('custom-emoji')) {
          // console.log('node is custom emoji. incrementing currentOffset by 1');

          currentOffset += 1;
        }
        node = walker.nextNode();
      }

      // console.log('all nodes of paragraph processed. Caret was set?', caretWasSet);

      if (caretWasSet) {
        // console.log('caret was set. Breaking');
        // selectionChangeMutex = false;
        break;
      }

      /**
       * Count line break between non-empty paragraphs.
       * Except:
       * - last paragraph
       * - paragraph that already contains <br>
       */
      const lastParagraph = paragraphs[paragraphs.length - 1];
      const isLastParagraph = div === lastParagraph;
      if (!isLastParagraph && !paragraphIsEmpty && !isParagraphEndsWithBr) {
        // console.log('Line break (between non-emptyparagraphs). Increment currentOffset %o by 1 ---> %o', currentOffset, currentOffset + 1);
        currentOffset += 1;
      }

      const isEndOfQuote = div.classList.contains('paragraph-quote') && !div.nextElementSibling;
      if (isEndOfQuote) {
        // console.warn('end of quote. Increment currentOffset %o by 1 beacuse in md it ends with \\n\\n instead of \\n ---> %o', currentOffset, currentOffset + 1);
        // currentOffset += 1;
      }
    }

    // Handle caret at the end
    if (!caretWasSet && lastNode && currentOffset === htmlOffset) {
      // console.log('setting caret to last node', {
      //   lastNode,
      //   nodeType: lastNode.nodeType,
      //   nodeValue: lastNode.nodeValue,
      // });
      caretWasSet = setCaretToNode(lastNode, 0, true);
    } else if (!caretWasSet) {
      if (!lastNode) {
        if (htmlOffset === 0) {
          // Create an empty text node without any special characters
          const newLastNode = document.createTextNode('');
          input.appendChild(newLastNode);

          // console.log('Empty text node added', {
          //   newLastNode,
          //   nodeType: newLastNode.nodeType,
          //   nodeValue: newLastNode.nodeValue,
          // });

          caretWasSet = setCaretToNode(newLastNode, 0, true);
        } else {
          console.error(
            'caret can\'t be set to %o. Maximum length is %o. Fallback to the end of the text.',
            htmlOffset,
            currentOffset,
          );
          console.error('lastNode is null. Can\'t set caret position.');
        }

        return;
      }

      // console.log('set caret to last node', lastNode);
      if (lastNode.nodeType === Node.ELEMENT_NODE && (lastNode as HTMLElement).contentEditable === 'false') {
        // console.log('last node is not editable. Can\'t set caret inside.');
        caretWasSet = setCaretToNode(lastNode, 0, true);
      } else {
        // console.log('last node is editable. Setting caret inside it.');
        caretWasSet = setCaretToNode(lastNode, 0, true);
      }
    }

    // console.groupEnd();
  } catch (error) {
    console.error('setCaretPosition error', error);
    // selectionChangeMutex = false;
  } finally {
    // console.groupEnd();
  }
}

/**
 * Returns the start and end of the selection range in the input element
 */
export function getSelectionRange(input: HTMLElement): { start: number; end: number } {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return { start: 0, end: 0 };

  const range = selection.getRangeAt(0);

  if (range.collapsed) {
    const start = getCaretOffset(input);
    return { start, end: start };
  }

  const startRange = range.cloneRange();
  startRange.collapse(true);
  const start = getCaretOffset(input, startRange);

  const endRange = range.cloneRange();
  endRange.collapse(false);
  const end = getCaretOffset(input, endRange, true);

  return { start, end };
}
