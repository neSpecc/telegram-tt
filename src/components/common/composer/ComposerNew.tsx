import type { FC } from '../../../lib/teact/teact';
import React, {
  memo,
  useEffect,
  useRef,
  useSignal,
  useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiFormattedText, ApiSticker } from '../../../api/types';
import type { MenuPositionOptions } from '../../ui/Menu';
import type { TextEditorApi } from './TextEditorApi';

import { selectIsCurrentUserPremium } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useInputCustomEmojis from '../../middle/composer/hooks/useInputCustomEmojis';
import useCustomEmojiPremiumNotification from '../hooks/useCustomEmojiPremiumNotification';
import { useTextEditor } from './hooks/useTextEditor';

import SymbolMenuButton from '../../middle/composer/SymbolMenuButton';

export enum ComposerMode {
  Plain = 'plain',
  Rich = 'rich',
}

type OwnProps = {
  value?: ApiFormattedText;
  onChange?: (textFormatted: ApiFormattedText) => void;
  mode?: ComposerMode;
  canSendSymbols?: boolean;
  className?: string;
  setEditorApi?: (editorApi: TextEditorApi) => void;
  onFocus?: NoneToVoidFunction;
  onBlur?: NoneToVoidFunction;
  ariaLabel?: string;
  tabIndex?: number;
  customEmojiMenuPosition?: MenuPositionOptions;
};

type StateProps = {
  currentUserId: string | undefined;
  isCurrentUserPremium: boolean;
};

const Composer: FC<OwnProps & StateProps> = ({
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
}) => {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLDivElement>(null);
  const editorApiRef = useRef<TextEditorApi | undefined>(undefined);
  const [isSymbolMenuOpen, openSymbolMenu, closeSymbolMenu] = useFlag();
  const [getCurrentValue, setCurrentValue] = useSignal<ApiFormattedText | undefined>(undefined);
  const [customEmoji, setCustomEmoji] = useState<ApiSticker | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);
  const { isMobile } = useAppLayout();

  const updateCallback = useLastCallback((textFormatted: ApiFormattedText) => {
    setCurrentValue(textFormatted);
    onChange?.(textFormatted);
  });

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

  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const absoluteContainerRef = useRef<HTMLDivElement>(null);

  useInputCustomEmojis(
    getCurrentValue,
    inputRef,
    sharedCanvasRef,
    sharedCanvasHqRef,
    absoluteContainerRef,
    'ComposerNew',
    true,
    isReady,
    true,
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    editorApiRef.current = useTextEditor({
      value,
      mode: ComposerMode.Rich,
      input: inputRef.current!,
      onUpdate: updateCallback,
      onHtmlUpdate: (html: string) => {
      },
    });

    setEditorApi?.(editorApiRef.current);
    setIsReady(true);
  }, []);

  const fullClassName = buildClassName(
    'ComposerNew',
    className,
  );

  const getTriggerElement = useLastCallback(() => inputRef.current);

  return (
    <div className={fullClassName}>
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
      />
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
          customEmojiToggler={customEmoji}
          positionOptions={isMobile ? undefined : customEmojiMenuPosition}
        />
      )}
      <canvas ref={sharedCanvasRef} className="shared-canvas" />
      <canvas ref={sharedCanvasHqRef} className="shared-canvas" />
      <div ref={absoluteContainerRef} className="absolute-video-container" />
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
