import { useEffect, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiDraft, ApiFormattedText, ApiMessage } from '../../../../api/types';
import type { MessageListType, ThreadId } from '../../../../types';
import type { Signal } from '../../../../util/signals';
import type { TextEditorApi } from '../../../common/composer/TextEditorApi';
import { ApiMessageEntityTypes } from '../../../../api/types';

import { EDITABLE_INPUT_CSS_SELECTOR } from '../../../../config';
import { requestMeasure, requestNextMutation } from '../../../../lib/fasterdom/fasterdom';
import { hasMessageMedia } from '../../../../global/helpers';
import { isMessageEmpty } from '../utils/isMessageEmpty';

import { useDebouncedResolver } from '../../../../hooks/useAsyncResolvers';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import useEffectWithPrevDeps from '../../../../hooks/useEffectWithPrevDeps';
import useLastCallback from '../../../../hooks/useLastCallback';
import useBackgroundMode from '../../../../hooks/window/useBackgroundMode';
import useBeforeUnload from '../../../../hooks/window/useBeforeUnload';

const URL_ENTITIES = new Set<string>([ApiMessageEntityTypes.TextUrl, ApiMessageEntityTypes.Url]);
const DEBOUNCE_MS = 300;

const useEditing = (
  getApiFormattedText: Signal<ApiFormattedText | undefined>,
  setApiFormattedText: (apiFormattedText: ApiFormattedText | undefined) => void,
  getEditorApi: () => TextEditorApi | undefined,
  editedMessage: ApiMessage | undefined,
  resetComposer: (shouldPreserveInput?: boolean) => void,
  chatId: string,
  threadId: ThreadId,
  type: MessageListType,
  draft?: ApiDraft,
  editingDraft?: ApiFormattedText,
): [VoidFunction, VoidFunction, boolean] => {
  const {
    editMessage, setEditingDraft, toggleMessageWebPage, openDeleteMessageModal,
  } = getActions();
  const [shouldForceShowEditing, setShouldForceShowEditing] = useState(false);

  const replyingToId = draft?.replyInfo?.replyToMsgId;

  useEffectWithPrevDeps(([prevEditedMessage, prevReplyingToId]) => {
    if (!editedMessage) {
      return;
    }

    if (replyingToId && prevReplyingToId !== replyingToId) {
      setApiFormattedText(undefined);
      setShouldForceShowEditing(false);
      return;
    }

    if (prevEditedMessage?.id === editedMessage.id && replyingToId === prevReplyingToId) {
      return;
    }

    const text = !prevEditedMessage && editingDraft?.text.length ? editingDraft : editedMessage.content.text;

    setApiFormattedText(text);
    setShouldForceShowEditing(true);

    requestNextMutation(() => {
      const messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR);
      if (messageInput) {
        getEditorApi()?.focus();
      }
    });
  }, [editedMessage, replyingToId, editingDraft, setApiFormattedText, getEditorApi]);

  useEffect(() => {
    if (!editedMessage) {
      return;
    }

    const shouldSetNoWebPage = !('webPage' in editedMessage.content)
      && editedMessage.content.text?.entities?.some((entity) => URL_ENTITIES.has(entity.type));

    toggleMessageWebPage({
      chatId,
      threadId,
      noWebPage: shouldSetNoWebPage,
    });
  }, [chatId, threadId, editedMessage]);

  useEffect(() => {
    if (!editedMessage) return undefined;
    return () => {
      const message = getApiFormattedText();
      const update = !isMessageEmpty(message) ? message : undefined;

      setEditingDraft({
        chatId, threadId, type, text: update,
      });
    };
  }, [chatId, editedMessage, getApiFormattedText, setEditingDraft, threadId, type]);

  const detectLinkDebounced = useDebouncedResolver(() => {
    if (!editedMessage) return false;

    const edited = getApiFormattedText();

    if (!edited) return false;

    return !('webPage' in editedMessage.content)
      && editedMessage.content.text?.entities?.some((entity) => URL_ENTITIES.has(entity.type))
      && !(edited.entities?.some((entity) => URL_ENTITIES.has(entity.type)));
  }, [editedMessage, getApiFormattedText], DEBOUNCE_MS, true);

  const getShouldResetNoWebPageDebounced = useDerivedSignal(
    detectLinkDebounced,
    [detectLinkDebounced, getApiFormattedText],
    true,
  );

  useEffectWithPrevDeps(([prevEditedMessage]) => {
    if (!editedMessage || prevEditedMessage?.id !== editedMessage.id) {
      return;
    }

    if (getShouldResetNoWebPageDebounced()) {
      toggleMessageWebPage({
        chatId,
        threadId,
        noWebPage: false,
      });
    }
  }, [editedMessage, chatId, getApiFormattedText, threadId, getShouldResetNoWebPageDebounced]);

  const restoreNewDraftAfterEditing = useLastCallback(() => {
    if (!draft) return;

    // Run one frame after editing draft reset
    requestMeasure(() => {
      setApiFormattedText(draft.text);

      // Wait one more frame until new HTML is rendered
      requestNextMutation(() => {
        const messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR);
        if (messageInput) {
          getEditorApi()?.focus();
        }
      });
    });
  });

  const handleEditCancel = useLastCallback(() => {
    resetComposer();
    restoreNewDraftAfterEditing();
  });

  const handleEditComplete = useLastCallback(() => {
    const message = getApiFormattedText();

    if (!message) return;

    const { text, entities } = message;

    if (!editedMessage) {
      return;
    }

    if (!text && !hasMessageMedia(editedMessage)) {
      openDeleteMessageModal({
        chatId,
        messageIds: [editedMessage.id],
        isSchedule: type === 'scheduled',
      });
      return;
    }

    editMessage({
      messageList: { chatId, threadId, type },
      text,
      entities,
    });

    resetComposer();
    restoreNewDraftAfterEditing();
  });

  const handleBlur = useLastCallback(() => {
    if (!editedMessage) return;

    const message = getApiFormattedText();
    const update = !isMessageEmpty(message) ? message : undefined;

    setEditingDraft({
      chatId, threadId, type, text: update,
    });
  });

  useBackgroundMode(handleBlur);
  useBeforeUnload(handleBlur);

  return [handleEditComplete, handleEditCancel, shouldForceShowEditing];
};

export default useEditing;
