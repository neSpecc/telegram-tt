import type { StateHookSetter } from '../../../../lib/teact/teact';
import { useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiAttachment, ApiFormattedText, ApiMessage } from '../../../../api/types';

import {
  EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID, EDITABLE_STORY_INPUT_ID,
} from '../../../../config';
import { canReplaceMessageMedia, isUploadingFileSticker } from '../../../../global/helpers';
import buildAttachment from '../helpers/buildAttachment';
import getFilesFromDataTransferItems from '../helpers/getFilesFromDataTransferItems';

import useOldLang from '../../../../hooks/useOldLang';

const TYPE_HTML = 'text/html';
const DOCUMENT_TYPE_WORD = 'urn:schemas-microsoft-com:office:word';
const NAMESPACE_PREFIX_WORD = 'xmlns:w';

const VALID_TARGET_IDS = new Set([EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID, EDITABLE_STORY_INPUT_ID]);
const CLOSEST_CONTENT_EDITABLE_SELECTOR = 'div[contenteditable]';

/**
 * This method now handles only file pasting and set attachments based on them
 * Text pasting is handled by ast/input.ts in beforeInput event
 */
const useClipboardPaste = (
  isActive: boolean,
  setAttachments: StateHookSetter<ApiAttachment[]>,
  editedMessage: ApiMessage | undefined,
) => {
  const { showNotification } = getActions();
  const lang = useOldLang();

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    async function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) {
        return;
      }

      const input = (e.target as HTMLElement)?.closest(CLOSEST_CONTENT_EDITABLE_SELECTOR);
      if (!input || !VALID_TARGET_IDS.has(input.id)) {
        return;
      }

      // Some extensions can trigger paste into their panels without focus
      if (document.activeElement !== input) {
        return;
      }

      const { items } = e.clipboardData;
      let files: File[] | undefined = [];

      if (items.length > 0) {
        files = await getFilesFromDataTransferItems(items);
        if (editedMessage) {
          files = files?.slice(0, 1);
        }
      }

      if (!files?.length) {
        return;
      }

      let isWordDocument = false;
      try {
        const html = e.clipboardData.getData(TYPE_HTML);
        const parser = new DOMParser();
        const parsedDocument = parser.parseFromString(html, TYPE_HTML);
        isWordDocument = parsedDocument.documentElement
          .getAttribute(NAMESPACE_PREFIX_WORD) === DOCUMENT_TYPE_WORD;
      } catch (err: any) {
        // Ignore
      }

      let shouldSetAttachments = files?.length && !isWordDocument;

      const newAttachments = files ? await Promise.all(files.map((file) => buildAttachment(file.name, file))) : [];
      const canReplace = (editedMessage && newAttachments?.length
        && canReplaceMessageMedia(editedMessage, newAttachments[0]));
      const isUploadingDocumentSticker = isUploadingFileSticker(newAttachments[0]);
      const isInAlbum = editedMessage && editedMessage?.groupedId;

      if (editedMessage && isUploadingDocumentSticker) {
        showNotification({ message: lang(isInAlbum ? 'lng_edit_media_album_error' : 'lng_edit_media_invalid_file') });
        return;
      }

      if (isInAlbum) {
        shouldSetAttachments = canReplace === true;
        if (!shouldSetAttachments) {
          showNotification({ message: lang('lng_edit_media_album_error') });
          return;
        }
      }

      if (shouldSetAttachments) {
        setAttachments(editedMessage ? newAttachments : (attachments) => attachments.concat(newAttachments));
      }
    }

    document.addEventListener('paste', handlePaste, false);

    return () => {
      document.removeEventListener('paste', handlePaste, false);
    };
  }, [
    editedMessage, setAttachments, isActive, lang,
  ]);
};

export default useClipboardPaste;
