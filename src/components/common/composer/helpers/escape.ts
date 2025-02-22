export function escapeHTML(text: string): string {
  return text
    // .replace(/&(?!nbsp;)/g, '&amp;')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function escapeAttribute(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\s+/g, ' ')
    .replace(/[\r\n\t]/g, ' ');
}