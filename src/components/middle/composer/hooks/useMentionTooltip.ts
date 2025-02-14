import type { RefObject } from 'react';
import { useEffect, useState } from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../global';

import type {
  ApiChatMember, ApiFormattedText, ApiMessageEntity, ApiMessageEntityMentionName, ApiUser,
} from '../../../../api/types';
import type { Signal } from '../../../../util/signals';
import { ApiMessageEntityTypes } from '../../../../api/types';

import { requestNextMutation } from '../../../../lib/fasterdom/fasterdom';
import { filterUsersByName, getMainUsername, getUserFirstOrLastName } from '../../../../global/helpers';
import focusEditableElement from '../../../../util/focusEditableElement';
import { pickTruthy, unique } from '../../../../util/iteratees';
import { getCaretPosition, getHtmlBeforeSelection, setCaretPosition } from '../../../../util/selection';
/* eslint-disable */
import { InputApi } from '../../../../../../ast/src/api';
/* eslint-enable */
import { prepareForRegExp } from '../helpers/prepareForRegExp';

import { useThrottledResolver } from '../../../../hooks/useAsyncResolvers';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

const THROTTLE = 300;

let RE_USERNAME_SEARCH: RegExp;
try {
  RE_USERNAME_SEARCH = /(^|\s)@[-_\p{L}\p{M}\p{N}]*$/gui;
} catch (e) {
  // Support for older versions of Firefox
  RE_USERNAME_SEARCH = /(^|\s)@[-_\d\wа-яёґєії]*$/gi;
}

export default function useMentionTooltip(
  isEnabled: boolean,
  getApiFormattedText: Signal<ApiFormattedText | undefined>,
  setApiFormattedText: (apiFormattedText: ApiFormattedText | undefined) => void,
  getSelectionRange: Signal<Range | undefined>,
  inputRef: RefObject<HTMLDivElement>,
  getInputApi: Signal<InputApi | undefined>,
  groupChatMembers?: ApiChatMember[],
  topInlineBotIds?: string[],
  currentUserId?: string,
) {
  const [filteredUsers, setFilteredUsers] = useState<ApiUser[] | undefined>();
  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const extractUsernameTagThrottled = useThrottledResolver(() => {
    console.log('extractUsernameTagThrottled');

    if (!isEnabled) return undefined;

    const message = getApiFormattedText();
    const inputApi = getInputApi();
    if (!message || !inputApi) return undefined;

    const text = message.text;

    /**
     * @todo implement working with offset instead
     */
    if (!getSelectionRange()?.collapsed || !text.includes('@')) return undefined;

    const md = inputApi.getMarkdown();
    const caretOffset = inputApi.getCaretOffset();
    const beforeCaret = md.substring(0, caretOffset.start);

    return beforeCaret.match(RE_USERNAME_SEARCH)?.[0].trim();
  }, [isEnabled, getApiFormattedText, getSelectionRange, getInputApi], THROTTLE);

  const getUsernameTag = useDerivedSignal(
    extractUsernameTagThrottled, [extractUsernameTagThrottled, getApiFormattedText], true,
  );

  const getWithInlineBots = useDerivedSignal(() => {
    if (!isEnabled) return false;

    const message = getApiFormattedText();

    return message && message.text.startsWith('@');
  }, [getApiFormattedText, isEnabled]);

  useEffect(() => {
    const usernameTag = getUsernameTag();

    console.log('usernameTag', usernameTag);

    if (!usernameTag || !(groupChatMembers || topInlineBotIds)) {
      setFilteredUsers(undefined);
      return;
    }

    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    console.log('usersById', usersById);

    if (!usersById) {
      setFilteredUsers(undefined);
      return;
    }

    const memberIds = groupChatMembers?.reduce((acc: string[], member) => {
      if (member.userId !== currentUserId) {
        acc.push(member.userId);
      }

      return acc;
    }, []);

    const filter = usernameTag.substring(1);
    const filteredIds = filterUsersByName(unique([
      ...((getWithInlineBots() && topInlineBotIds) || []),
      ...(memberIds || []),
    ]), usersById, filter);

    const usersToDisplay = Object.values(pickTruthy(usersById, filteredIds));

    console.log('usersToDisplay', usersToDisplay);

    setFilteredUsers(usersToDisplay);
  }, [currentUserId, groupChatMembers, topInlineBotIds, getUsernameTag, getWithInlineBots]);

  const insertMention = useLastCallback((user: ApiUser, forceFocus = false) => {
    if (!user.usernames && !getUserFirstOrLastName(user)) {
      return;
    }

    const mainUsername = getMainUsername(user);
    const userFirstOrLastName = getUserFirstOrLastName(user) || '';

    const markdownToInsert = `[${userFirstOrLastName}](id:${user.id})`;

    // /**
    //  * @todo move to ast/Renderer
    //  */
    // const htmlToInsert = mainUsername
    //   ? `@${mainUsername}`
    //   : `<a
    //       class="text-entity-link"
    //       data-entity-type="${ApiMessageEntityTypes.MentionName}"
    //       data-user-id="${user.id}"
    //       contenteditable="false"
    //       dir="auto"
    //     >${userFirstOrLastName}</a>`;

    // const inputEl = inputRef.current!;
    const message = getApiFormattedText();
    if (!message) return;

    const text = message.text;
    const entities = message.entities ?? [];

    // const htmlBeforeSelection = getHtmlBeforeSelection(inputEl);
    // const fixedHtmlBeforeSelection = cleanWebkitNewLines(htmlBeforeSelection);

    const inputApi = getInputApi()!;

    const offset = inputApi.getCaretOffset();
    const mention = `[${userFirstOrLastName}](id:${user.id})`;

    inputApi.replace(offset.start - 1, offset.start, ''); // remove @
    inputApi.insert(mention, offset.end);

    setFilteredUsers(undefined);
  });

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, getApiFormattedText]);

  return {
    isMentionTooltipOpen: Boolean(filteredUsers?.length && !isManuallyClosed),
    closeMentionTooltip: markManuallyClosed,
    insertMention,
    mentionFilteredUsers: filteredUsers,
  };
}
