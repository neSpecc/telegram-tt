/* eslint-disable */
import { setupInput } from '../../../../../ast/src/input'
import useDerivedState from '../../../hooks/useDerivedState';
/* eslint-enable */
import type { FC, RefObject } from '../../../lib/teact/teact';
import React, { useEffect, useRef, useState } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import './TextEditor.scss';

interface OwnProps {
  ref?: RefObject<HTMLDivElement | null>;
  onUpdate: (html: string) => void;
  onSend: () => void;
  isActive: boolean;
}

const TextEditor: FC<OwnProps> = ({
  ref,
  onUpdate,
  onSend,
  isActive,
}) => {
  // eslint-disable-next-line no-null/no-null
  let editorRef = useRef<HTMLDivElement | null>(null);
  if (ref) {
    editorRef = ref;
  }

  const isTouched = useDerivedState(() => Boolean(isActive), [isActive]);

  const className = buildClassName(
    'text-editor form-control allow-selection',
    isTouched && 'touched',
    // shouldSuppressFocus && 'focus-disabled',
  );

  useEffect(() => {
    if (editorRef.current) {
      setupInput({
        input: editorRef.current,
        onUpdate,
      });
    }
  });

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const {
      isComposing, ctrlKey, metaKey, shiftKey,
    } = e;

    if (!isComposing && e.key === 'Enter' && !shiftKey) {
      console.log('sending');

      onSend();
    }
  }

  return (
    <div
      ref={editorRef}
      className={className}
      contentEditable
      role="textbox"
      dir="auto"
      aria-label="Message input"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    />
  );
};

export default TextEditor;
