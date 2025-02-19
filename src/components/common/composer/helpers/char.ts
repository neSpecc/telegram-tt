export function isEmoji(char: string | undefined): boolean {
  return char ? char.match(/^[^\p{L}\p{N}]+$/u) !== null : false;
}
