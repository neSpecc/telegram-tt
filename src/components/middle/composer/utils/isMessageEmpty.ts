import type { ApiFormattedText } from '../../../../api/types';

/**
 * Used to check whether the value returned by MessageInput is empty
 * @param formattedText - both text and entities
 */
export function isMessageEmpty(formattedText: ApiFormattedText | undefined) {
  const emptyText = formattedText?.text === '';

  if (formattedText?.entities === undefined) {
    return emptyText;
  }

  return emptyText && formattedText?.entities?.length === 0;
}
