/* eslint-disable */
import { setupInput } from '../../../../../ast/src/input'
/* eslint-enable */
/* eslint-disable */
import type { InputApi } from '../../../../../ast/src/api';
/* eslint-enable */
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo,
  useEffect,
  useRef,
  useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiFormattedText, ApiSticker } from '../../../api/types';

import useLastCallback from '../../../hooks/useLastCallback';
import buildClassName from '../../../util/buildClassName';
import SymbolMenuButton from '../../middle/composer/SymbolMenuButton';
import useFlag from '../../../hooks/useFlag';
import { selectIsCurrentUserPremium } from '../../../global/selectors';
import useCustomEmojiPremiumNotification from '../hooks/useCustomEmojiPremiumNotification';

export enum ComposerMode {
  Plain = 'plain',
  Rich = 'rich',
}

type InputTextProps = {
  label?: string;
  error?: string;
};

type OwnProps = InputTextProps & {
  onChange?: (textFormatted: ApiFormattedText) => void;
  mode?: ComposerMode;
  canSendSymbols?: boolean;
};

type StateProps = {
  currentUserId: string;
  isCurrentUserPremium: boolean;
};

const Composer: FC<OwnProps & StateProps> = ({
  label,
  error,
  onChange,
  canSendSymbols,
  currentUserId,
  isCurrentUserPremium,
}) => {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLDivElement>(null);
  const [inputApi, setInputApi] = useState<InputApi | undefined>(undefined);
  const [isSymbolMenuOpen, openSymbolMenu, closeSymbolMenu] = useFlag();
  const [isFocused, markFocused, unmarkFocused] = useFlag();
  const labelText = error || label;

  const updateCallback = useLastCallback((textFormatted: ApiFormattedText) => {
    onChange?.(textFormatted);
  });

  const handleRemoveSymbol = useLastCallback(() => {
    console.log('handleRemoveSymbol');
  });

  const insertText = useLastCallback((text: string) => {
    inputApi!.insert(text, inputApi!.getCaretOffset().end);
  });

  const { showCustomEmojiPremiumNotification } = useCustomEmojiPremiumNotification(currentUserId!);

  const handleCustomEmojiSelect = useLastCallback((emoji: ApiSticker) => {
    if (!emoji.isFree && !isCurrentUserPremium) {
      showCustomEmojiPremiumNotification();
      return;
    }

    insertText(`[${emoji.emoji}](doc:${emoji.id})`);
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

  const handleClick = useLastCallback(() => {
    console.log('handleClick', inputApi);

    inputApi!.focus();
  });

  useEffect(() => {
    const input = setupInput({
      mode: ComposerMode.Rich,
      input: inputRef.current!,
      onUpdate: updateCallback,
      onHtmlUpdate: (html: string) => {
      },
    });

    setInputApi(input);
  }, []);

  const fullClassName = buildClassName(
    'ComposerNew',
    'input-group',
  );

  const getTriggerElement = useLastCallback(() => inputRef.current);
  // const getRootElement = useLastCallback(() => ref.current!.closest('.custom-scroll, .no-scrollbar'));
  // const getMenuElement = useLastCallback(() => {
  //   return isStatusPicker ? menuRef.current : ref.current!.querySelector('.sticker-context-menu .bubble');
  // });
  // const getLayout = useLastCallback(() => ({ withPortal: isStatusPicker, shouldAvoidNegativePosition: true }));

  return (
    <div className={fullClassName}>
      <div
        className={buildClassName(
          'ComposerNew-input-wrapper',
          'form-control',
          isFocused && 'focus',
          error && 'error',
        )}
        onClick={handleClick}
      >
        <div
          ref={inputRef}
          className="composer-input"
          contentEditable
          role="textbox"
          dir="auto"
          aria-label={labelText}
          tabIndex={0}
          onFocus={markFocused}
          onBlur={unmarkFocused}
        />
        {(canSendSymbols) && (
          <SymbolMenuButton
            chatId=""
            threadId=""
            isMobile={false}
            isReady={false}
            isSymbolMenuOpen={isSymbolMenuOpen}
            openSymbolMenu={handleSymbolMenuOpen}
            closeSymbolMenu={handleSymbolMenuClose}
            canSendStickers={false}
            canSendGifs={false}
            isMessageComposer={false}
            onCustomEmojiSelect={handleCustomEmojiSelect}
            onRemoveSymbol={handleRemoveSymbol}
            onEmojiSelect={insertEmoji}
            isAttachmentModal
            isSymbolMenuForced={false}
            canSendPlainText
            inputCssSelector=".ComposerNew .form-control"
            idPrefix="ComposerNew"
            getTriggerElement={getTriggerElement}
            positionOptions={{
              anchor: {
                x: 300,
                y: 270,
              },
            }}
          />
        )}
      </div>
      {labelText && (
        <label htmlFor="ComposerNew">{labelText}</label>
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
