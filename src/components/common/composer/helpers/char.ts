export function isEmoji(char: string | undefined): boolean {
  // eslint-disable-next-line no-null/no-null
  return char ? char.match(/[\p{Emoji}]/u) !== null : false;
}
