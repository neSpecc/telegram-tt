/* eslint-disable no-null/no-null */
import type { ApiFormattedText } from '../../../../api/types';
import type {
  ASTFormattingInlineNodeBase, ASTFormattingNode, ASTLinkNode, ASTMonospaceNode, ASTNode, ASTPreBlockNode,
  ASTRootNode,
} from '../ast/entities/ASTNode';
import type { OffsetMappingRecord } from '../ast/entities/OffsetMapping';
import type { LinkFormattingOptions, TextEditorApi } from '../TextEditorApi';

import { MarkdownParser } from '../ast';
import {
  blurContenteditable,
  getCaretOffset, getSelectionRange, setCaretOffset, setCaretToNode,
} from '../helpers/caret';
import { getClosingMarker, getFocusedNode } from '../helpers/getFocusedNode';
import { highlightLinksAsMarkown } from '../helpers/highlightLinks';
import { createHistory } from '../helpers/history';
import { htmlToMdOffset, mdToHtmlOffset } from '../helpers/offsetMapping';
import { useInputOperations } from '../helpers/useInputOperations';

import { FORMATTING_REGEX } from '../ast/InlineTokenizer';
import { BLOCK_GROUP_ATTR, FOCUSED_NODE_CLASS, HIGHLIGHTABLE_NODE_CLASS } from '../ast/RendererHtml';

export enum TextEditorMode {
  Rich,
  Plain,
}

export function useTextEditor({
  value,
  mode = TextEditorMode.Rich,
  input,
  onUpdate,
}: {
  input: HTMLDivElement;
  mode?: TextEditorMode;
  onUpdate: (apiFormattedText: ApiFormattedText, ast: ASTRootNode, htmlOffset: number) => void;
  value?: ApiFormattedText;
}): TextEditorApi {
  const parser = new MarkdownParser(mode === TextEditorMode.Rich);
  let currentText = '';
  let focusedNode: ASTNode | null = null;
  let selectionChangeMutex = false;
  let updateCallbackMutex = false;
  let offsetMapping: OffsetMappingRecord[] = [];
  let currentMdRange = [0, 0];
  let onAfterUpdateDebouncer: ReturnType<typeof setTimeout> | null = null;

  if (value) {
    updateContent(value, value.text.length);
  }

  const history = createHistory();

  /**
   * Initialize history with empty state
   */
  history.push('', 0);

  function onKeydown(event: KeyboardEvent) {
    const isCmd = event.metaKey || event.ctrlKey;

    if (isCmd && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      const previousState = history.undo();
      if (previousState !== null) {
        history.isUndoRedoAction = true;
        updateContent(previousState.text, previousState.caretOffset);
        history.isUndoRedoAction = false;
      }
    }

    if (isCmd && ((event.shiftKey && event.key === 'z') || event.key === 'y')) {
      event.preventDefault();
      const nextState = history.redo();
      if (nextState !== null) {
        history.isUndoRedoAction = true;
        updateContent(nextState.text, nextState.caretOffset);
        history.isUndoRedoAction = false;
      }
    }

    if (isCmd) {
      switch (event.key.toLowerCase()) {
        case 'b': {
          event.preventDefault();
          if (mode === TextEditorMode.Rich) {
            handleFormatting('bold');
          }
          break;
        }
        case 'i': {
          event.preventDefault();
          if (mode === TextEditorMode.Rich) {
            handleFormatting('italic');
          }
          break;
        }
        case 'u': {
          event.preventDefault();
          if (mode === TextEditorMode.Rich) {
            handleFormatting('underline');
          }
          break;
        }
        case 's': {
          event.preventDefault();
          if (mode === TextEditorMode.Rich) {
            handleFormatting('strikethrough');
          }
          break;
        }
      }
    }

    const isArrowUp = event.key === 'ArrowUp';
    const isArrowDown = event.key === 'ArrowDown';

    if (isArrowUp || isArrowDown) {
      handleArrowMovement(isArrowUp, event);
    }
  }

  function updateContent(text: string | ApiFormattedText, mdOffset: number) {
    if (typeof text === 'string') {
      parser.fromString(text);
      currentText = text;
    } else {
      parser.fromApiFormattedText(text);
      currentText = parser.toMarkdown();
    }

    const mapping = parser.computeOffsetMapping();
    const apiFormattedText = parser.toApiFormattedText();
    offsetMapping = mapping;

    const htmlOffset = mdToHtmlOffset(offsetMapping, mdOffset);

    currentMdRange = [mdOffset, mdOffset];

    if (!updateCallbackMutex) {
      onUpdate(apiFormattedText, parser.getAST(), htmlOffset);
    }

    if (onAfterUpdateDebouncer) {
      clearTimeout(onAfterUpdateDebouncer);
    }

    // wait Teact to finish rendering
    requestAnimationFrame(() => {
      // wait for browser to finish painting
      requestAnimationFrame(() => {
        hightlightFocusedNode();
      });
    });
    onAfterUpdateDebouncer = setTimeout(() => {
      onAfterUpdate();
    }, 100);
  }

  function onAfterUpdate() {
    selectionChangeMutex = false;
    updateCallbackMutex = false;
  }

  input.addEventListener('keydown', onKeydown);
  input.addEventListener('beforeinput', onBeforeInput);

  document.addEventListener('selectionchange', () => {
    if (document.activeElement === input) {
      onInputSelectionChange();
    }
  }, {
    passive: true,
  });

  /**
   * Returns the start and end of the selection range in the input element
   * Visible start and end conveted to real markdown start and end
   */
  function getInputOperationMarkdownRange(
    isDelete: boolean = false,
    deleteDirection?: 'forward' | 'backward',
  ): { start: number; end: number } {
    const {
      start: htmlStart, end: htmlEnd,
    } = getSelectionRange(input);
    const mdStart = htmlToMdOffset(offsetMapping, htmlStart);
    const mdEnd = htmlToMdOffset(offsetMapping, htmlEnd);

    return { start: mdStart, end: mdEnd };
  }

  /**
   * @todo - support composition events
   */
  function onBeforeInput(event: InputEvent) {
    event.preventDefault();
    /**
     * Remove real caret to prevent jumping to the start because of re-rendering
     * It will be set back manualy after renderer do its job
     */
    blurContenteditable(input);
    input.style.caretColor = 'transparent';
    selectionChangeMutex = true;

    // Use tracked offset instead of selection
    let [mdStart, mdEnd] = currentMdRange;

    const isDelete = event.inputType.startsWith('delete');
    const direction = event.inputType.includes('Forward') ? 'forward' : 'backward';

    /**
     * Special case for delete operations:
     * - If we're deleting near a mention, expand the selection to cover the whole mention
     * - Improve Emoji deletion: delete both 2 chars
     */
    if (isDelete) {
      const mentionRecord = offsetMapping.find((m) => m.nodeType === 'mention' && (
        (mdStart >= m.mdStart && mdStart <= m.mdEnd)
          || (mdStart === m.mdEnd)
      ));

      const customEmojiRecord = offsetMapping.find((m) => m.nodeType === 'customEmoji' && (
        (mdStart >= m.mdStart && mdStart <= m.mdEnd)
          || (mdStart === m.mdEnd)
      ));

      if (mentionRecord) {
        mdStart = mentionRecord.mdStart;
        mdEnd = Math.max(mdEnd, mentionRecord.mdEnd);
      } else if (customEmojiRecord) {
        mdStart = customEmojiRecord.mdStart;
        mdEnd = Math.max(mdEnd, customEmojiRecord.mdEnd);
      } else if (direction) {
        // const prevCharIndex = mdStart - 1;
        // const prevVisibleCharIndex =

        // const nextCharIndex = mdEnd + 1;
        // const nextVisibleCharIndex = htmlToMdOffset(offsetMapping, htmlEnd + 1);

        // if (isDelete && !isRange) {
        //   if (deleteDirection === 'forward' && nextCharIndex !== nextVisibleCharIndex) {
        //     mdEnd = nextVisibleCharIndex;
        //   } else if (deleteDirection === 'backward' && prevCharIndex !== prevVisibleCharIndex) {
        //     mdStart = prevVisibleCharIndex;
        //   }
        // }
      }
    }

    // console.log('before input:', {
    //   inputType: event.inputType,
    //   text: currentText,
    //   mdStart,
    //   mdEnd,
    // });

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const utils = useInputOperations({
      text: currentText,
      start: mdStart,
      end: mdEnd,
    });

    let mdNewPosition = mdStart;

    switch (event.inputType) {
      case 'insertText': {
        const textToInsert = event.data;
        if (!textToInsert) {
          break;
        }

        if (hasSpecialInsertBehavior(textToInsert, currentText, mdStart)) {
          [currentText, mdNewPosition] = handleSpecialInsertion(textToInsert, currentText, mdStart);
        } else {
          [currentText, mdNewPosition] = utils.insertText(textToInsert);
        }

        break;
      }
      case 'insertParagraph':
      case 'insertLineBreak': {
        const { node } = getFocusedNode(mdStart, parser.getAST()!);
        /**
         * If the caret is at the end of a pre block, get out of the pre block
         * Also, if pre is not empty, remove the last line break
         */
        if (isAtEndOfPreBlock(node, currentText, mdStart)) {
          const preEnd = currentText.indexOf('\n```', mdStart) + 4; // +4 to get past the \n```
          const hasContent = /[^\n]/.test((node as ASTPreBlockNode).value || '');

          if (hasContent) {
            [currentText, mdNewPosition] = utils.removeTextAt(preEnd - 4, 1);
          }

          currentText = `${currentText.slice(0, preEnd)}\n${currentText.slice(preEnd)}`;
          mdNewPosition = preEnd;
        } else {
          [currentText, mdNewPosition] = utils[event.inputType]();
        }

        break;
      }
      case 'insertReplacementText': {
        const { dataTransfer } = event;

        [currentText, mdNewPosition] = utils.insertReplacementText(dataTransfer);
        break;
      }
      case 'deleteContent':
      case 'deleteContentForward':
      case 'deleteContentBackward':
      case 'deleteWordBackward':
      case 'deleteWordForward':
      case 'deleteSoftLineBackward':
      case 'deleteHardLineBackward':
      case 'deleteByCut':
      /**
       * @todo - handle deleteHardLineForward
       * @todo - handle deleteSoftLineForward
       * @todo - handle deleteEntireSoftLine
       */
      {
        [currentText, mdNewPosition] = utils[event.inputType]();
        break;
      }
      case 'insertFromPaste':
      case 'insertFromDrop':
      case 'insertCompositionText':
      {
        const { dataTransfer } = event;
        let text = dataTransfer?.getData('text/plain') || '';
        const html = dataTransfer?.getData('text/html') || '';

        if (html && !text) {
          text = html;
        }

        text = highlightLinksAsMarkown(text);

        [currentText, mdNewPosition] = utils.insertText(text.trim());

        break;
      }

      case 'formatBold':
      case 'formatItalic':
      case 'formatUnderline':
      case 'formatStrikeThrough': {
        const nodeName: 'bold' | 'italic' | 'underline' | 'strikethrough' = event
          .inputType
          .replace('format', '')
          .toLowerCase() as 'bold' | 'italic' | 'underline' | 'strikethrough';

        event.preventDefault();

        if (mode === TextEditorMode.Rich) {
          handleFormatting(nodeName);
        }
        break;
      }
      default: {
        // console.warn('onBeforeInput: unknown event type', event.inputType, event);
        return;
      }
    }

    ofAfterInput(mdNewPosition);
  }

  /**
   * @todo accept new text as a parameter
   */
  function ofAfterInput(newMdOffset: number) {
    const newText = currentText;
    const caretOffset = newMdOffset;
    history.push(newText, caretOffset);
    updateContent(newText, caretOffset);
  }

  /**
   * We have special behavior for some characters:
   * - create pair markers for `*` and `\``
   * - create code block for `\`\`\`
   * - just move caret for "*|*" case
   */
  function hasSpecialInsertBehavior(char: string, text: string, pos: number): boolean {
    if (!['*', '`'].includes(char)) {
      return false;
    }

    const prevChar = text.slice(Math.max(0, pos - 1), pos);
    const nextChar = text.slice(pos, pos + 1);

    if (char === '`') {
      const prevTwo = text.slice(Math.max(0, pos - 2), pos);
      if (prevTwo === '``') {
        const { node } = getFocusedNode(pos, parser.getAST()!);
        if (node?.type === 'pre') {
          return false;
        }
        return true;
      }
    }

    // *|* case
    if (nextChar === char && prevChar === char) {
      return true;
    }

    // Only allow pairing if surrounded by spaces/boundaries
    if (prevChar !== '' && prevChar !== ' ') {
      return false;
    }

    if (nextChar !== '' && nextChar !== ' ') {
      return false;
    }

    return true;
  }

  function isAtEndOfPreBlock(node: ASTNode | null, text: string, pos: number): boolean {
    if (node?.type !== 'pre') {
      return false;
    }

    const char = text[pos];
    const rightPart = text.slice(pos + 1);
    const leftPart = text.slice(0, pos);

    const isLastLine = rightPart.startsWith('```') && leftPart.endsWith('\n');

    if (char === '\n' && isLastLine) {
      return true;
    }

    return false;
  }

  function handleSpecialInsertion(char: string, text: string, pos: number): [string, number] {
    const markers = {
      '*': { open: '*', close: '*' },
      '`': { open: '`', close: '`' },
    };

    const marker = markers[char as keyof typeof markers];
    if (!marker) {
      return [text, pos];
    }

    if (char === '`') {
      const before = text.slice(Math.max(0, pos - 2), pos);
      if (before === '``') {
        const pre = parser.toMarkdown({
          raw: '```',
          type: 'pre',
          value: '',
          closed: true,
        });

        // Remove the two backticks and add code block, preserving text after
        const textAfter = text.slice(pos);
        const leftSlice = text.slice(0, pos - 2);
        const hasLineBreakBefore = leftSlice.endsWith('\n') || leftSlice === '';

        text = leftSlice + (hasLineBreakBefore === false ? '\n' : '') + pre + textAfter;
        const caretOffset = pos - 2 + 3 + (!hasLineBreakBefore ? 1 : 0);

        return [text, caretOffset];
      }
    }

    // *|* case ‚ just move caret
    const nextChar = text.slice(pos, pos + 1);
    if (nextChar === char) {
      return [text, pos + 1];
    }

    // Insert paired markers
    return [
      text.slice(0, pos) + marker.open + marker.close + text.slice(pos),
      pos + marker.open.length,
    ];
  }

  function onInputSelectionChange() {
    if (selectionChangeMutex) {
      return;
    }

    const { start: mdStart, end: mdEnd } = getInputOperationMarkdownRange();

    currentMdRange = [mdStart, mdEnd];

    const caretOffset = getCaretOffset(input);
    const { node } = getFocusedNode(caretOffset, parser.getAST()!);

    if (focusedNode !== node || node?.type === 'pre') {
      focusedNode = node;
      hightlightFocusedNode();
    }
  }

  function findNodeMapping(node: ASTNode, mapping: OffsetMappingRecord[]): OffsetMappingRecord | undefined {
    if ('id' in node && node.id) {
      const exactMatch = mapping.find((m) => m.nodeId === node.id);
      if (exactMatch) {
        return exactMatch;
      }
    }

    return undefined;
  }

  function getFormattingNodesInRange(ast: ASTNode, start: number, end: number): ASTFormattingNode[] {
    const formattingNodes: ASTNode[] = [];

    function isFormattingNode(node: ASTNode): boolean {
      return ['bold', 'italic', 'underline', 'strikethrough', 'monospace', 'link', 'spoiler'].includes(node.type);
    }

    function traverse(node: ASTNode): void {
      if (['paragraph', 'root'].includes(node.type) === false) {
        const mapping = parser.getOffsetMapping();
        const nodeMapping = findNodeMapping(node, mapping);
        if (nodeMapping) {
          const nodeStart = nodeMapping.mdStart;
          const nodeEnd = nodeMapping.mdEnd;

          if (nodeStart <= end && nodeEnd >= start) {
            if (isFormattingNode(node)) {
              formattingNodes.push(node);
            }
          }
        }
      }

      if ('children' in node && node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    }

    traverse(ast);

    return formattingNodes as ASTFormattingNode[];
  }

  function handleFormatting(type: ASTFormattingNode['type'], options?: LinkFormattingOptions): void {
    let { start, end } = getInputOperationMarkdownRange();
    const ast = parser.getAST()!;

    /**
     * Disallow formatting inside nodes with "value"
     */
    const { node: currentNode } = getFocusedNode(start, parser.getAST());
    if (currentNode && currentNode?.type !== 'text' && 'value' in currentNode && type !== currentNode.type) {
      return;
    }

    if (type === 'link') {
      start = options?.start ?? start;
      end = options?.end ?? end;

      if (start === end) {
        return;
      }
    }

    const formattingNodes = getFormattingNodesInRange(ast, start, end);
    const isCurrentlyFormatted = formattingNodes.some((node) => node.type === type);

    let newCaretOffset = start;

    if (isCurrentlyFormatted) {
      const targetNode = formattingNodes.find((node) => node.type === type);

      if (!targetNode) {
        return;
      }

      const newNode = 'children' in targetNode
        ? {
          type: 'paragraph',
          raw: '',
          children: [...(targetNode.children as ASTNode[])],
          closed: true,
        } as ASTNode
        : {
          type: 'text',
          raw: '',
          value: (targetNode as ASTMonospaceNode).value,
        };

      const grandParent = parser.getParentNode(targetNode);
      if (grandParent) {
        const textLength = 'children' in targetNode
          ? (targetNode.children as ASTNode[]).reduce((len: number, child: ASTNode) => {
            if (child.type === 'text') {
              return len + child.value.length;
            }
            return len;
          }, 0)
          : ((targetNode as ASTMonospaceNode).value).length;

        const om = parser.getOffsetMapping();
        const nodeMapping = findNodeMapping(targetNode, om);

        const nodeStart = nodeMapping?.mdStart ?? start;

        parser.replaceNode(targetNode, newNode as ASTFormattingNode);
        currentText = parser.toMarkdown();

        newCaretOffset = nodeStart + textLength;
      }
    } else {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const utils = useInputOperations({
        text: currentText,
        start,
        end,
      });
      const slice = currentText.slice(start, end);
      const isRange = start !== end;
      const closingMarker = getClosingMarker(type);

      if (isRange) {
        if (type === 'link') {
          const zeroWidthSpace = '\u200B';
          const newText = parser.toMarkdown({
            type: 'link',
            raw: '',
            href: options?.href ?? slice,
            children: [{
              type: 'text',
              value: slice,
              raw: slice,
            }],
          } as ASTLinkNode);

          /**
           * we're adding zero width space to the end of the link
           * to prevent stepping into preview mode as caret is at the end of the link
           */
          [currentText, newCaretOffset] = utils.replaceSlice(newText + zeroWidthSpace);
        } else {
          const newText = parser.toMarkdown({
            type,
            raw: '',
            children: [{
              type: 'text',
              value: slice,
              raw: slice,
            }],
          } as ASTFormattingNode);

          [currentText, newCaretOffset] = utils.replaceSlice(newText);

          newCaretOffset -= closingMarker.length;
        }
      } else {
        let emptyNode = '';
        if (type !== 'link') {
          emptyNode = parser.toMarkdown({
            type,
            raw: '',
            children: [{
              type: 'text',
              value: '',
              raw: '',
            }],
          } as ASTFormattingNode);
        } else {
          emptyNode = parser.toMarkdown({
            type,
            raw: '',
            href: '',
          } as ASTLinkNode);
        }
        [currentText, newCaretOffset] = utils.insertText(emptyNode);
        newCaretOffset -= closingMarker.length;
      }
    }

    ofAfterInput(newCaretOffset);
  }

  /**
   * We have special behavior for Up/Down arrows
   * Used to jump in empty pre blocks
   */
  function handleArrowMovement(isUp: boolean, event: KeyboardEvent) {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    const range = selection.getRangeAt(0);
    let elementNode = range.startContainer;

    while (elementNode.nodeType !== Node.ELEMENT_NODE && elementNode.parentNode) {
      elementNode = elementNode.parentNode;
    }

    const currentBlock = (elementNode as HTMLElement).closest('div.paragraph');
    if (!currentBlock) {
      return;
    }

    const nextBlock = isUp ? currentBlock.previousElementSibling : currentBlock.nextElementSibling;

    const isPreBlock = (node: Element) => {
      return node.classList.contains('paragraph-pre');
    };

    if (nextBlock && isPreBlock(nextBlock) && !isPreBlock(currentBlock)) {
      event.preventDefault();

      setCaretToNode(nextBlock, 0);
    }
  }

  /**
   * We highligh nodes in 2 steps.
   * 1. On Renderer — when render a node (to display markdown and set a caret position)
   * 2. Based on DOM — when the caret is moved around (to prevent unnecessary re-renders when content is not changing)
   */
  function hightlightFocusedNode() {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    const rangeCount = selection.rangeCount;

    if (rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    let focusedNode: Node | null = range.startContainer;

    if (focusedNode.nodeType !== Node.ELEMENT_NODE) {
      focusedNode = focusedNode.parentNode;
    }

    if (focusedNode === null) {
      return;
    }

    const closestHighlightableNode = (focusedNode as HTMLElement).closest(`.${HIGHLIGHTABLE_NODE_CLASS}`);
    const previouslyFocused = input.querySelectorAll(`.${FOCUSED_NODE_CLASS}`);

    for (const node of previouslyFocused) {
      if (node === closestHighlightableNode) {
        continue;
      }

      node.classList.remove(FOCUSED_NODE_CLASS);
    }

    if (closestHighlightableNode === null) {
      return;
    }

    const groupId = closestHighlightableNode.getAttribute(BLOCK_GROUP_ATTR);

    if (groupId) {
      const group = input.querySelectorAll(`[${BLOCK_GROUP_ATTR}="${groupId}"]`);
      for (const node of group) {
        node.classList.add(FOCUSED_NODE_CLASS);
      }
    } else {
      closestHighlightableNode.classList.add(FOCUSED_NODE_CLASS);
    }

    /**
     * Fix for Safari glitch in arrow moving in string like "aaaaaa **bbbbbbbbbb** cccccc"
     *
     * UPD. With this fix selection works badly for link (you can't select a whole link) and pre (you can't select line)
     */
    // if (caretOffset) {
    //   selectionChangeMutex = true;
    //   setCaretOffset(input, caretOffset);
    //   requestAnimationFrame(() => {
    //     selectionChangeMutex = false;
    //   });
    // }
  }

  function setContent(apiFormattedText: ApiFormattedText | undefined) {
    if (apiFormattedText !== undefined) {
      if (parser.toApiFormattedText() === apiFormattedText) {
        return;
      }

      console.log('setContent', apiFormattedText, input);

      // parser.fromApiFormattedText(apiFormattedText);
      // text = parser.toMarkdown();
    }

    // updateCallbackMutex = true;
    updateContent(apiFormattedText || '', 0);
  }

  const api: TextEditorApi = {
    setContent,
    getCaretOffset: () => getInputOperationMarkdownRange(),
    setCaretOffset: (offset: number) => {
      input.style.caretColor = 'initial';
      setCaretOffset(input, Math.max(0, offset));
    },
    getMarkdown: () => currentText,
    insert: (text: string, offset: number) => {
      /**
       * Disallow inserting custom emoji to "pre", add it after
       */
      if (FORMATTING_REGEX.customEmoji.test(text)) {
        const { node } = getFocusedNode(offset, parser.getAST());
        if (node?.type === 'pre') {
          const preMapping = findNodeMapping(node, parser.getOffsetMapping());
          offset = preMapping?.mdEnd ?? 0;
        }
      }

      let start = 0;
      let end = 0;

      if (offset !== undefined) {
        start = offset;
        end = offset;
      } else {
        const { start: mdStart, end: mdEnd } = getInputOperationMarkdownRange();

        start = mdStart;
        end = mdEnd;
      }

      // eslint-disable-next-line react-hooks/rules-of-hooks
      const utils = useInputOperations({
        text: currentText,
        start,
        end,
      });

      const [newText, newPosition] = utils.insertText(text);

      currentText = newText;

      ofAfterInput(newPosition);
    },
    replace: (start: number, end: number, text: string) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const utils = useInputOperations({
        text: currentText,
        start,
        end,
      });

      const [newText, newPosition] = utils.replaceSlice(text);
      currentText = newText;

      ofAfterInput(newPosition);
    },
    getLeftSlice: () => {
      const { start } = getInputOperationMarkdownRange();
      return currentText.slice(0, start);
    },
    deleteLastSymbol: () => {
      const { start, end } = getInputOperationMarkdownRange(true, 'backward');

      // eslint-disable-next-line react-hooks/rules-of-hooks
      const utils = useInputOperations({
        text: currentText,
        start,
        end,
      });

      const [newText, newPosition] = utils.deleteContentBackward();
      currentText = newText;

      ofAfterInput(newPosition);
    },
    format: (formatting: ASTFormattingNode['type'], options?: LinkFormattingOptions) => {
      handleFormatting(formatting, options);
    },
    getActiveFormattingsForRange: () => {
      const { start, end } = getInputOperationMarkdownRange();
      const ast = parser.getAST()!;

      const formattingNodes = getFormattingNodesInRange(ast, start, end);
      const formattings = new Set<ASTFormattingInlineNodeBase['type']>();

      formattingNodes.forEach((node) => {
        formattings.add(node.type as ASTFormattingInlineNodeBase['type']);
      });

      return Array.from(formattings);
    },
    getFormattingNodes: () => {
      const { start, end } = getInputOperationMarkdownRange();
      const ast = parser.getAST()!;

      return getFormattingNodesInRange(ast, start, end);
    },
    updateFormattingNode: (id: string, options?: { href: string }) => {
      const node = parser.getNodeById(id) as ASTLinkNode | undefined;

      if (!node || !options?.href) {
        return;
      }

      const newHrefDist = options.href.length - node.href.length;
      const dimensions = findNodeMapping(node, offsetMapping);

      const newNode = {
        ...node,
        href: options?.href,
      } as ASTLinkNode;

      parser.replaceNode(node, newNode);
      currentText = parser.toMarkdown();

      ofAfterInput(dimensions ? dimensions.mdEnd + newHrefDist + 1 : 0);
    },
    focus: () => {
      console.warn('focus');

      setCaretOffset(input, htmlToMdOffset(offsetMapping, currentText.length));
    },
    getCurrentNode: () => {
      const { start } = getInputOperationMarkdownRange();
      const { node } = getFocusedNode(start, parser.getAST()!);

      if (!node) {
        return {
          node: null,
          parentNode: null,
        };
      }

      const parentNode = parser.getParentNode(node);

      return {
        node,
        parentNode,
      };
    },
  };

  return api;
}
