import type {
  ChangeEvent, FormEvent, RefObject,
} from 'react';
import type { ApiFormattedText } from "ast/src/ast/ApiFormattedText";
import type { FC } from '../../lib/teact/teact';
import React, { memo, useState } from '../../lib/teact/teact';

import type { TextEditorApi } from '../common/composer/TextEditorApi';

import buildClassName from '../../util/buildClassName';
import { isMessageEmpty } from '../middle/composer/utils/isMessageEmpty';

import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Composer from '../common/composer/ComposerNew';
import { MenuPositionOptions } from './Menu';

type InputProps = {
  id?: string;
  label?: string;
  error?: string;
  success?: string;
  tabIndex?: number;
  /**
   * @todo support disabled, readOnly, autoComplete, maxLength
   */
  // disabled?: boolean;
  // readOnly?: boolean;
  // autoComplete?: string;
  // maxLength?: number;
};

type OwnProps = InputProps & {
  className?: string;
  value?: ApiFormattedText;
  onChange: (textFormatted: ApiFormattedText) => void;
  canSendSymbols?: boolean;
  customEmojiMenuPosition?: MenuPositionOptions;
};

const InputFormatted: FC<OwnProps> = ({
  id,
  className,
  value,
  label,
  error,
  // disabled,
  success,
  tabIndex,
  onChange,
  canSendSymbols,
  customEmojiMenuPosition,
}) => {
  const [isFocused, markFocused, unmarkFocused] = useFlag();
  const [editorApi, setEditorApi] = useState<TextEditorApi | undefined>(undefined);
  const [isEmpty, setIsEmpty] = useState(true);
  const lang = useOldLang();
  const labelText = error || success || label;
  const fullClassName = buildClassName(
    'input-formatted',
    'input-group',
    !isEmpty && 'touched',
    error ? 'error' : success && 'success',
    // disabled && 'disabled',
    // readOnly && 'disabled',
    labelText && 'with-label',
    className,
  );

  const handleClick = useLastCallback(() => {
    editorApi!.focus();
  });

  const updateCallback = useLastCallback((textFormatted: ApiFormattedText) => {
    setIsEmpty(isMessageEmpty(textFormatted));
    onChange?.(textFormatted);
  });

  return (
    <div className={fullClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      <div
        className={buildClassName(
          'form-control',
          'form-control-with-emoji',
          isFocused && 'focus',
        )}
        onClick={handleClick}
      >
        <Composer
          value={value}
          // disabled={disabled}
          onChange={updateCallback}
          onFocus={markFocused}
          onBlur={unmarkFocused}
          setEditorApi={setEditorApi}
          canSendSymbols={canSendSymbols}
          aria-label={labelText}
          tabIndex={tabIndex}
          customEmojiMenuPosition={customEmojiMenuPosition}
        />
      </div>
      {labelText && (
        <label htmlFor={id}>{labelText}</label>
      )}
    </div>
  );
};

export default memo(InputFormatted);
