export function highlightLinksAsMarkown(text: string) {
  const zeroWidthSpace = '\u200B';
  return text.replace(
    /(^|\s)(https?:\/\/\S+)(?=\s|$)/g,
    `$1[$2]($2)${zeroWidthSpace}`,
  );
}
