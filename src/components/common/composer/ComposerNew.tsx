/* eslint-disable no-null/no-null */
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSignal,
  useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiFormattedText, ApiSticker } from '../../../api/types';
import type { MenuPositionOptions } from '../../ui/Menu';
import type { ASTRootNode } from './ast/entities/ASTNode';
import type { TextEditorApi } from './TextEditorApi';

import { selectIsCurrentUserPremium } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLastCallback from '../../../hooks/useLastCallback';
import useCustomEmojiPremiumNotification from '../hooks/useCustomEmojiPremiumNotification';
import { TextEditorMode, useTextEditor } from './hooks/useTextEditor';

import SymbolMenuButton from '../../middle/composer/SymbolMenuButton';
import RendererTeact from './ast/RendererTeact';

import './ComposerNew.scss';

type OwnProps = {
  value?: ApiFormattedText;
  onChange?: (textFormatted: ApiFormattedText) => void;
  mode?: TextEditorMode;
  canSendSymbols?: boolean;
  className?: string;
  setEditorApi?: (editorApi: TextEditorApi) => void;
  onFocus?: NoneToVoidFunction;
  onBlur?: NoneToVoidFunction;
  ariaLabel?: string;
  tabIndex?: number;
  customEmojiMenuPosition?: MenuPositionOptions;
  isSingleLine?: boolean;
};

type StateProps = {
  currentUserId: string | undefined;
  isCurrentUserPremium: boolean;
};

const Composer: FC<OwnProps & StateProps> = ({
  mode = TextEditorMode.Rich,
  value,
  onChange,
  canSendSymbols,
  currentUserId,
  isCurrentUserPremium,
  className,
  setEditorApi,
  onFocus,
  onBlur,
  ariaLabel,
  tabIndex,
  customEmojiMenuPosition,
  isSingleLine,
}) => {
  const inputRef = useRef<HTMLDivElement>(null);
  const editorApiRef = useRef<TextEditorApi | undefined>(undefined);
  const [isSymbolMenuOpen, openSymbolMenu, closeSymbolMenu] = useFlag();
  const [customEmoji, setCustomEmoji] = useState<ApiSticker | undefined>(undefined);
  const { isMobile } = useAppLayout();
  const [getAst, setAst] = useSignal<ASTRootNode | undefined>(undefined);
  const [getAstLastModified, setAstLastModified] = useSignal<number | undefined>(undefined);
  const [getHtmlOffset, setHtmlOffset] = useSignal<number | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  const updateCallback = useLastCallback((apiFormattedText: ApiFormattedText, ast: ASTRootNode, htmlOffset: number) => {
    setAst(ast);
    setHtmlOffset(htmlOffset);
    setAstLastModified(ast.lastModified);
    onChange?.(apiFormattedText);
  });

  const onAfterUpdate = useCallback(() => {
    const htmlOffset = getHtmlOffset();
    if (htmlOffset !== undefined && editorApiRef.current) {
      editorApiRef.current.setCaretOffset(htmlOffset);
    }
  }, [getHtmlOffset]);

  const handleRemoveSymbol = useLastCallback(() => {
    editorApiRef.current!.deleteLastSymbol();
    setCustomEmoji(undefined);
  });

  const insertText = useLastCallback((text: string) => {
    editorApiRef.current!.insert(text, editorApiRef.current!.getCaretOffset().end);
  });

  const { showCustomEmojiPremiumNotification } = useCustomEmojiPremiumNotification(currentUserId!);

  const handleCustomEmojiSelect = useLastCallback((emoji: ApiSticker) => {
    if (!emoji.isFree && !isCurrentUserPremium) {
      showCustomEmojiPremiumNotification();
      return;
    }

    insertText(`[${emoji.emoji}](doc:${emoji.id})`);
    setCustomEmoji(emoji);
    closeSymbolMenu();
  });

  const insertEmoji = useLastCallback((emoji: string) => {
    insertText(emoji);
    closeSymbolMenu();
  });

  const handleSymbolMenuOpen = useLastCallback(() => {
    openSymbolMenu();
  });

  const handleSymbolMenuClose = useLastCallback(() => {
    closeSymbolMenu();
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    editorApiRef.current = useTextEditor({
      value,
      mode,
      isSingleLine,
      input: inputRef.current!,
      onUpdate: updateCallback,
    });

    setEditorApi?.(editorApiRef.current);
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!isSingleLine) {
      return;
    }
    const scrollWidth = inputWrapperRef.current!.scrollWidth;
    const innerWidth = inputWrapperRef.current!.clientWidth;

    if (scrollWidth === innerWidth) {
      return;
    }

    requestAnimationFrame(() => {
      inputWrapperRef.current!.scrollBy(scrollWidth - innerWidth, 0);
    });
  }, [getAst, isSingleLine]);

  const fullClassName = buildClassName(
    'ComposerNew',
    className,
  );

  const getTriggerElement = useLastCallback(() => document.querySelector('.ComposerNew .composer-input'));
  const getRootElement = useLastCallback(() => document.querySelector('#Settings'));
  useHorizontalScroll(inputWrapperRef, !isSingleLine);

  return (
    <div
      className={fullClassName}
      ref={containerRef}
    >
      <div
        ref={inputWrapperRef}
        className={buildClassName(
          'composer-input-container',
          isSingleLine && '_no-scrollbar',
          isSingleLine && 'single-line',
        )}
      >
        <div
          ref={inputRef}
          className="composer-input"
          contentEditable
          role="textbox"
          dir="auto"
          tabIndex={tabIndex}
          onFocus={onFocus}
          onBlur={onBlur}
          aria-label={ariaLabel}
        >
          <RendererTeact
            getAst={getAst}
            getAstLastModified={getAstLastModified}
            onAfterUpdate={onAfterUpdate}
          />
        </div>
      </div>
      {(canSendSymbols) && (
        <SymbolMenuButton
          chatId=""
          threadId=""
          isMobile={isMobile}
          isReady
          isSymbolMenuOpen={isSymbolMenuOpen}
          openSymbolMenu={handleSymbolMenuOpen}
          closeSymbolMenu={handleSymbolMenuClose}
          canSendStickers={false}
          canSendGifs={false}
          isMessageComposer={false}
          onCustomEmojiSelect={handleCustomEmojiSelect}
          onRemoveSymbol={handleRemoveSymbol}
          onEmojiSelect={insertEmoji}
          isAttachmentModal={!isMobile}
          isSymbolMenuForced={false}
          canSendPlainText
          inputCssSelector=".ComposerNew .form-control"
          idPrefix="ComposerNew"
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          customEmojiToggler={customEmoji}
          positionOptions={isMobile ? undefined : customEmojiMenuPosition}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      currentUserId: global.currentUserId,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
    };
  },
)(Composer));
