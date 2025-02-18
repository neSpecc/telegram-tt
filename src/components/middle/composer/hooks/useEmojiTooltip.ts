import { useEffect, useState } from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../global';

import type { EmojiData, EmojiModule, EmojiRawData } from '../../../../util/emoji/emoji';
import type { Signal } from '../../../../util/signals';
import {
  type ApiFormattedText, type ApiMessageEntityCustomEmoji, ApiMessageEntityTypes, type ApiSticker,
} from '../../../../api/types';

import { selectCustomEmojiForEmojis } from '../../../../global/selectors';
import { uncompressEmoji } from '../../../../util/emoji/emoji';
import {
  buildCollectionByKey, mapValues, pickTruthy, unique, uniqueByField,
} from '../../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import memoized from '../../../../util/memoized';
import renderText from '../../../common/helpers/renderText';
import { prepareForRegExp } from '../helpers/prepareForRegExp';

import { useThrottledResolver } from '../../../../hooks/useAsyncResolvers';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

interface Library {
  keywords: string[];
  byKeyword: Record<string, Emoji[]>;
  names: string[];
  byName: Record<string, Emoji[]>;
  maxKeyLength: number;
}

let emojiDataPromise: Promise<EmojiModule>;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;

let RE_EMOJI_SEARCH: RegExp;
let RE_LOWERCASE_TEST: RegExp;
const EMOJIS_LIMIT = 36;
const FILTER_MIN_LENGTH = 2;

const THROTTLE = 300;

const prepareRecentEmojisMemo = memoized(prepareRecentEmojis);
const prepareLibraryMemo = memoized(prepareLibrary);
const searchInLibraryMemo = memoized(searchInLibrary);

try {
  RE_EMOJI_SEARCH = /(^|\s):(?!\s)[-+_:'\s\p{L}\p{N}]*$/gui;
  RE_LOWERCASE_TEST = /\p{Ll}/u;
} catch (e) {
  // Support for older versions of firefox
  RE_EMOJI_SEARCH = /(^|\s):(?!\s)[-+_:'\s\d\wа-яёґєії]*$/gi;
  RE_LOWERCASE_TEST = /[a-zяёґєії]/;
}

export default function useEmojiTooltip(
  isEnabled: boolean,
  getApiFormattedText: Signal<ApiFormattedText | undefined>,
  setApiFormattedText: (formattedText: ApiFormattedText | undefined) => void,
  recentEmojiIds: string[],
  baseEmojiKeywords?: Record<string, string[]>,
  emojiKeywords?: Record<string, string[]>,
) {
  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const [byId, setById] = useState<Record<string, Emoji> | undefined>();
  const [filteredEmojis, setFilteredEmojis] = useState<Emoji[]>(MEMO_EMPTY_ARRAY);
  const [filteredCustomEmojis, setFilteredCustomEmojis] = useState<ApiSticker[]>(MEMO_EMPTY_ARRAY);

  // Initialize data on first render
  useEffect(() => {
    if (!isEnabled) return;

    function exec() {
      setById(emojiData.emojis);
    }

    if (emojiData) {
      exec();
    } else {
      ensureEmojiData().then(exec);
    }
  }, [isEnabled]);

  const detectEmojiCodeThrottled = useThrottledResolver(() => {
    const message = getApiFormattedText();
    const text = message?.text;

    return isEnabled && text?.includes(':') ? prepareForRegExp(text).match(RE_EMOJI_SEARCH)?.[0].trim() : undefined;
  }, [getApiFormattedText, isEnabled], THROTTLE);

  const getEmojiCode = useDerivedSignal(
    detectEmojiCodeThrottled, [detectEmojiCodeThrottled, getApiFormattedText], true,
  );

  const updateFiltered = useLastCallback((emojis: Emoji[]) => {
    setFilteredEmojis(emojis);

    if (emojis === MEMO_EMPTY_ARRAY) {
      setFilteredCustomEmojis(MEMO_EMPTY_ARRAY);
      return;
    }

    const nativeEmojis = emojis.map((emoji) => emoji.native);
    const customEmojis = uniqueByField(
      selectCustomEmojiForEmojis(getGlobal(), nativeEmojis),
      'id',
    );
    setFilteredCustomEmojis(customEmojis);
  });

  const insertEmoji = useLastCallback((emoji: string | ApiSticker, isForce = false) => {
    const message = getApiFormattedText();
    const text = message?.text;

    if (!text) return;

    const atIndex = text.lastIndexOf(':', isForce ? text.lastIndexOf(':') - 1 : undefined);

    if (atIndex !== -1) {
      const isCustomEmoji = typeof emoji !== 'string';
      const emojiString = isCustomEmoji ? emoji.emoji : emoji;

      if (!emojiString) {
        // eslint-disable-next-line no-console
        console.warn('Emoji string is empty', emoji);
        return;
      }

      const regularEmojiText = renderText(emojiString, ['emoji']);

      /**
       * @todo buildCustomEmojiHtml should be passed to ast/Renderer to handle custom emoji
       */
      // const emojiHtml = typeof emoji === 'string'
      //   ? renderText(emoji, ['emoji_html'])  // regular emoji
      //   : buildCustomEmojiHtml(emoji); // custom emoji <img>

      const newText = `${text.substring(0, atIndex)}${regularEmojiText}`;
      let emojiEntity: ApiMessageEntityCustomEmoji | undefined;

      if (isCustomEmoji) {
        emojiEntity = {
          type: ApiMessageEntityTypes.CustomEmoji,
          offset: atIndex,
          length: emojiString.length,
          documentId: emoji.id,
        };
      }

      const newEntities = message?.entities ? [...message.entities] : [];
      if (emojiEntity) {
        newEntities.push(emojiEntity);
      }

      setApiFormattedText({
        text: newText,
        entities: newEntities,
      });
    }

    updateFiltered(MEMO_EMPTY_ARRAY);
  });

  useEffect(() => {
    const emojiCode = getEmojiCode();
    if (!emojiCode || !byId) {
      updateFiltered(MEMO_EMPTY_ARRAY);
      return;
    }

    const newShouldAutoInsert = emojiCode.length > 2 && emojiCode.endsWith(':');

    const filter = emojiCode.substring(1, newShouldAutoInsert ? 1 + emojiCode.length - 2 : undefined);
    let matched: Emoji[] = MEMO_EMPTY_ARRAY;

    if (!filter) {
      matched = prepareRecentEmojisMemo(byId, recentEmojiIds, EMOJIS_LIMIT);
    } else if ((filter.length === 1 && RE_LOWERCASE_TEST.test(filter)) || filter.length >= FILTER_MIN_LENGTH) {
      const library = prepareLibraryMemo(byId, baseEmojiKeywords, emojiKeywords);
      matched = searchInLibraryMemo(library, filter.toLowerCase(), EMOJIS_LIMIT);
    }

    if (!matched.length) {
      updateFiltered(MEMO_EMPTY_ARRAY);
      return;
    }

    if (newShouldAutoInsert) {
      insertEmoji(matched[0].native, true);
    } else {
      updateFiltered(matched);
    }
  }, [
    baseEmojiKeywords, byId, getEmojiCode, emojiKeywords, insertEmoji, recentEmojiIds, updateFiltered,
  ]);

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, getApiFormattedText]);

  return {
    isEmojiTooltipOpen: Boolean(filteredEmojis.length || filteredCustomEmojis.length) && !isManuallyClosed,
    closeEmojiTooltip: markManuallyClosed,
    filteredEmojis,
    filteredCustomEmojis,
    insertEmoji,
  };
}

async function ensureEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('emoji-data-ios/emoji-data.json');
    emojiRawData = (await emojiDataPromise).default;

    emojiData = uncompressEmoji(emojiRawData);
  }

  return emojiDataPromise;
}

function prepareRecentEmojis(byId: Record<string, Emoji>, recentEmojiIds: string[], limit: number) {
  if (!byId || !recentEmojiIds.length) {
    return MEMO_EMPTY_ARRAY;
  }

  return Object.values(pickTruthy(byId, recentEmojiIds)).slice(0, limit);
}

function prepareLibrary(
  byId: Record<string, Emoji>,
  baseEmojiKeywords?: Record<string, string[]>,
  emojiKeywords?: Record<string, string[]>,
): Library {
  const emojis = Object.values(byId);

  const byNative = buildCollectionByKey<Emoji>(emojis, 'native');
  const baseEmojisByKeyword = baseEmojiKeywords
    ? mapValues(baseEmojiKeywords, (natives) => {
      return Object.values(pickTruthy(byNative, natives));
    })
    : {};
  const emojisByKeyword = emojiKeywords
    ? mapValues(emojiKeywords, (natives) => {
      return Object.values(pickTruthy(byNative, natives));
    })
    : {};

  const byKeyword = { ...baseEmojisByKeyword, ...emojisByKeyword };
  const keywords = ([] as string[]).concat(Object.keys(baseEmojisByKeyword), Object.keys(emojisByKeyword));

  const byName = emojis.reduce((result, emoji) => {
    emoji.names.forEach((name) => {
      if (!result[name]) {
        result[name] = [];
      }

      result[name].push(emoji);
    });

    return result;
  }, {} as Record<string, Emoji[]>);

  const names = Object.keys(byName);
  const maxKeyLength = keywords.reduce((max, keyword) => Math.max(max, keyword.length), 0);

  return {
    byKeyword,
    keywords,
    byName,
    names,
    maxKeyLength,
  };
}

function searchInLibrary(library: Library, filter: string, limit: number) {
  const {
    byKeyword, keywords, byName, names, maxKeyLength,
  } = library;

  let matched: Emoji[] = [];

  if (filter.length > maxKeyLength) {
    return MEMO_EMPTY_ARRAY;
  }

  const matchedKeywords = keywords.filter((keyword) => keyword.startsWith(filter)).sort();
  matched = matched.concat(Object.values(pickTruthy(byKeyword!, matchedKeywords)).flat());

  // Also search by names, which is useful for non-English languages
  const matchedNames = names.filter((name) => name.startsWith(filter));
  matched = matched.concat(Object.values(pickTruthy(byName, matchedNames)).flat());

  matched = unique(matched);

  if (!matched.length) {
    return MEMO_EMPTY_ARRAY;
  }

  return matched.slice(0, limit);
}
