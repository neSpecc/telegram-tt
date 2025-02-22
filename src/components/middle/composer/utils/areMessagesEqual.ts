import type { ApiFormattedText } from '../../../../api/types';

/**
 * Deep compares two ApiFormattedText objects.
 */
export function areMessagesEqual(
  msg1: ApiFormattedText | undefined,
  msg2: ApiFormattedText | undefined,
): boolean {
  if (!msg1 || !msg2) {
    return false;
  }
  if (msg1.text !== msg2.text) {
    return false;
  }

  if (!msg1.entities && !msg2.entities) {
    return true;
  }
  if (!msg1.entities || !msg2.entities) {
    return false;
  }
  if (msg1.entities.length !== msg2.entities.length) {
    return false;
  }

  /* Compare entities deeply */
  return msg1.entities.every((entity, index) => {
    const otherEntity = msg2.entities![index];
    if (!otherEntity) {
      return false;
    }
    if (
      entity.type !== otherEntity.type
      || entity.offset !== otherEntity.offset
      || entity.length !== otherEntity.length
    ) {
      return false;
    }
    if ('url' in entity && 'url' in otherEntity && entity.url !== otherEntity.url) {
      return false;
    }
    if ('userId' in entity && 'userId' in otherEntity && entity.userId !== otherEntity.userId) {
      return false;
    }
    return true;
  });
}
