export function removeAllSelections() {
  const selection = window.getSelection();
  selection?.removeAllRanges();
}
