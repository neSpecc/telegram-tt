import { useEffect, useLayoutEffect, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiDraft, ApiFormattedText, ApiMessage } from '../../../../api/types';
import type { ThreadId } from '../../../../types';
import type { Signal } from '../../../../util/signals';
import { ApiMessageEntityTypes } from '../../../../api/types';

import { DRAFT_DEBOUNCE } from '../../../../config';
import {
  requestMeasure,
} from '../../../../lib/fasterdom/fasterdom';
import { areMessagesEqual } from '../utils/areMessagesEqual';
import { isMessageEmpty } from '../utils/isMessageEmpty';

import useLastCallback from '../../../../hooks/useLastCallback';
import useLayoutEffectWithPrevDeps from '../../../../hooks/useLayoutEffectWithPrevDeps';
import useRunDebounced from '../../../../hooks/useRunDebounced';
import { useStateRef } from '../../../../hooks/useStateRef';
import useBackgroundMode from '../../../../hooks/window/useBackgroundMode';
import useBeforeUnload from '../../../../hooks/window/useBeforeUnload';

let isFrozen = false;

function freeze() {
  isFrozen = true;

  requestMeasure(() => {
    isFrozen = false;
  });
}

const useDraft = ({
  draft,
  chatId,
  threadId,
  getApiFormattedText,
  setApiFormattedText,
  editedMessage,
  isDisabled,
} : {
  draft?: ApiDraft;
  chatId: string;
  threadId: ThreadId;
  getApiFormattedText: Signal<ApiFormattedText | undefined>;
  setApiFormattedText: (apiFormattedText: ApiFormattedText | undefined) => void;
  editedMessage?: ApiMessage;
  isDisabled?: boolean;
}) => {
  const { saveDraft, clearDraft, loadCustomEmojis } = getActions();

  const isTouchedRef = useRef(false);

  useEffect(() => {
    const text = getApiFormattedText();
    const isLocalDraft = draft?.isLocal !== undefined;

    if (areMessagesEqual(text, draft?.text) && !isLocalDraft) {
      isTouchedRef.current = false;
    } else {
      isTouchedRef.current = true;
    }
  }, [draft, getApiFormattedText]);
  useEffect(() => {
    isTouchedRef.current = false;
  }, [chatId, threadId]);

  const isEditing = Boolean(editedMessage);

  const updateDraft = useLastCallback((prevState: { chatId?: string; threadId?: ThreadId } = {}) => {
    if (isDisabled || isEditing || !isTouchedRef.current) return;

    const text = getApiFormattedText();

    if (!isMessageEmpty(text)) {
      requestMeasure(() => {
        saveDraft({
          chatId: prevState.chatId ?? chatId,
          threadId: prevState.threadId ?? threadId,
          text,
        });
      });
    } else {
      clearDraft({
        chatId: prevState.chatId ?? chatId,
        threadId: prevState.threadId ?? threadId,
        shouldKeepReply: true,
      });
    }
  });

  const runDebouncedForSaveDraft = useRunDebounced(DRAFT_DEBOUNCE, true, undefined, [chatId, threadId]);

  // Restore draft on chat change
  useLayoutEffectWithPrevDeps(([prevChatId, prevThreadId, prevDraft]) => {
    if (isDisabled) {
      return;
    }
    const isTouched = isTouchedRef.current;

    if (chatId === prevChatId && threadId === prevThreadId) {
      if (isTouched && !draft) return; // Prevent reset from other client if we have local edits
      if (!draft && prevDraft) {
        setApiFormattedText({ text: '', entities: [] });
      }

      if (isTouched) return;
    }

    if (editedMessage || !draft) {
      return;
    }

    setApiFormattedText(draft.text);

    const customEmojiIds = draft.text?.entities
      ?.map((entity) => entity.type === ApiMessageEntityTypes.CustomEmoji && entity.documentId)
      .filter(Boolean) || [];
    if (customEmojiIds.length) loadCustomEmojis({ ids: customEmojiIds });
  }, [chatId, threadId, draft, getApiFormattedText, setApiFormattedText, editedMessage, isDisabled]);

  // Save draft on chat change. Should be layout effect to read correct html on cleanup
  useLayoutEffect(() => {
    if (isDisabled) {
      return undefined;
    }

    return () => {
      if (!isEditing) {
        updateDraft({ chatId, threadId });
      }

      freeze();
    };
  }, [chatId, threadId, isEditing, updateDraft, isDisabled]);

  const chatIdRef = useStateRef(chatId);
  const threadIdRef = useStateRef(threadId);
  useEffect(() => {
    if (isDisabled || isFrozen) {
      return;
    }

    if (!isMessageEmpty(getApiFormattedText())) {
      updateDraft();

      return;
    }

    const scopedСhatId = chatIdRef.current;
    const scopedThreadId = threadIdRef.current;

    runDebouncedForSaveDraft(() => {
      if (chatIdRef.current === scopedСhatId && threadIdRef.current === scopedThreadId) {
        updateDraft();
      }
    });
  }, [chatIdRef, getApiFormattedText, isDisabled, runDebouncedForSaveDraft, threadIdRef, updateDraft]);

  useBackgroundMode(updateDraft);
  useBeforeUnload(updateDraft);
};

export default useDraft;
