import { useEffect, useState } from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../global';

import type {
  ApiChatMember, ApiFormattedText, ApiUser,
} from '../../../../api/types';
import type { Signal } from '../../../../util/signals';

import { filterUsersByName, getMainUsername, getUserFirstOrLastName } from '../../../../global/helpers';
import { pickTruthy, unique } from '../../../../util/iteratees';
/* eslint-disable */
import { InputApi } from '../../../../../../ast/src/api';

/* eslint-enable */
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
  getSelectionRange: Signal<Range | undefined>,
  getInputApi: Signal<InputApi | undefined>,
  groupChatMembers?: ApiChatMember[],
  topInlineBotIds?: string[],
  currentUserId?: string,
) {
  const [filteredUsers, setFilteredUsers] = useState<ApiUser[] | undefined>();
  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const extractUsernameTagThrottled = useThrottledResolver(() => {
    // console.log('@ useMentionTooltip / extractUsernameTagThrottled');

    if (!isEnabled) return undefined;

    const message = getApiFormattedText();
    const inputApi = getInputApi();

    if (!message || !inputApi) return undefined;

    const text = message.text;

    /**
     * @todo implement working with offset instead
     */
    if (!getSelectionRange()?.collapsed || !text.includes('@')) return undefined;

    const beforeCaret = inputApi.getLeftSlice();

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

    if (!usernameTag || !(groupChatMembers || topInlineBotIds)) {
      setFilteredUsers(undefined);
      return;
    }

    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;

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

    setFilteredUsers(usersToDisplay);
  }, [currentUserId, groupChatMembers, topInlineBotIds, getUsernameTag, getWithInlineBots]);

  const insertMention = useLastCallback((user: ApiUser, forceFocus = false) => {
    if (!user.usernames && !getUserFirstOrLastName(user)) {
      return;
    }

    const mainUsername = getMainUsername(user);
    const userFirstOrLastName = getUserFirstOrLastName(user) || '';

    const message = getApiFormattedText();
    if (!message) return;

    const inputApi = getInputApi()!;

    const offset = inputApi.getCaretOffset();
    const name = mainUsername ? `@${mainUsername}` : userFirstOrLastName;
    const mention = `[${name}](id:${user.id})`;

    // replace @ with mention
    inputApi.replace(offset.start - 1, offset.start, mention);

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
