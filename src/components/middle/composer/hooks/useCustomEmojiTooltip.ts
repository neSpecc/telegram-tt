/* eslint-disable */
import type { RefObject } from 'react';
import type { InputApi } from '../../../../../../ast/src/api';
/* eslint-enable */
import { useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiFormattedText, ApiSticker } from '../../../../api/types';
import type { Signal } from '../../../../util/signals';

import { EMOJI_IMG_REGEX } from '../../../../config';
import twemojiRegex from '../../../../lib/twemojiRegex';
import { IS_EMOJI_SUPPORTED } from '../../../../util/windowEnvironment';

import { useThrottledResolver } from '../../../../hooks/useAsyncResolvers';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import useDerivedState from '../../../../hooks/useDerivedState';
import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

const THROTTLE = 300;
const RE_ENDS_ON_EMOJI = new RegExp(`(${twemojiRegex.source})$`, 'g');
const RE_ENDS_ON_EMOJI_IMG = new RegExp(`${EMOJI_IMG_REGEX.source}$`, 'g');

export default function useCustomEmojiTooltip(
  isEnabled: boolean,
  getApiFormattedText: Signal<ApiFormattedText | undefined>,
  getInputApi: Signal<InputApi | undefined>,
  customEmojis?: ApiSticker[],
) {
  const { loadCustomEmojiForEmoji, clearCustomEmojiForEmoji } = getActions();

  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const extractLastEmojiThrottled = useThrottledResolver(() => {
    const message = getApiFormattedText();
    const inputApi = getInputApi();

    if (!inputApi) return undefined;

    const range = inputApi.getCaretOffset();
    const isCollapsed = range.start === range.end;

    if (!isEnabled || !message || !isCollapsed) return undefined;
    if (!message.text) return undefined;

    const beforeCaret = inputApi.getLeftSlice();
    const hasEmoji = beforeCaret.match(IS_EMOJI_SUPPORTED ? twemojiRegex : EMOJI_IMG_REGEX);

    if (!hasEmoji) return undefined;

    return beforeCaret.match(IS_EMOJI_SUPPORTED ? RE_ENDS_ON_EMOJI : RE_ENDS_ON_EMOJI_IMG)?.[0];
  }, [getApiFormattedText, getInputApi, isEnabled], THROTTLE);

  const getLastEmoji = useDerivedSignal(
    extractLastEmojiThrottled, [extractLastEmojiThrottled, getApiFormattedText], true,
  );

  const isActive = useDerivedState(() => Boolean(getLastEmoji()), [getLastEmoji]);
  const hasCustomEmojis = Boolean(customEmojis?.length);

  useEffect(() => {
    if (!isEnabled || !isActive) return;

    const lastEmoji = getLastEmoji();
    if (lastEmoji) {
      if (!hasCustomEmojis) {
        loadCustomEmojiForEmoji({
          emoji: IS_EMOJI_SUPPORTED ? lastEmoji : lastEmoji.match(/.+alt="(.+)"/)?.[1]!,
        });
      }
    } else {
      clearCustomEmojiForEmoji();
    }
  }, [isEnabled, isActive, getLastEmoji, hasCustomEmojis, clearCustomEmojiForEmoji, loadCustomEmojiForEmoji]);

  const insertCustomEmoji = useLastCallback((emoji: ApiSticker) => {
    const lastEmoji = getLastEmoji();
    const inputApi = getInputApi()!;
    const leftSlice = inputApi.getLeftSlice();
    if (!isEnabled || !lastEmoji || !inputApi) return;

    const emojiMarkdown = `[${emoji.emoji}](doc:${emoji.id})`;
    const input = getInputApi()!;
    const lastEmojiLength = lastEmoji.length;
    const lastEmojiIndex = leftSlice.indexOf(lastEmoji);

    input.replace(lastEmojiIndex, lastEmojiIndex + lastEmojiLength, emojiMarkdown);
  });

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, getApiFormattedText]);

  return {
    isCustomEmojiTooltipOpen: Boolean(isActive && hasCustomEmojis && !isManuallyClosed),
    closeCustomEmojiTooltip: markManuallyClosed,
    insertCustomEmoji,
  };
}
