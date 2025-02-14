import type { ApiFormattedText } from '../../../../api/types';

/**
 * Used to check whether the value returned by MessageInput is empty
 * @param formattedText - both text and entities
 */
export function isMessageEmpty(formattedText: ApiFormattedText | undefined) {
  return formattedText?.text === '' && formattedText?.entities?.length === 0;
}
