import EMOJI_REGEX from '../../../../lib/twemojiRegex';

export function isEmoji(char: string | undefined): boolean {
  // eslint-disable-next-line no-null/no-null
  return char ? char.match(EMOJI_REGEX) !== null : false;
}
