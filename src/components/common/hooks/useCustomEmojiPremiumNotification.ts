import { useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

export default function useCustomEmojiPremiumNotification(currentUserId: string) {
  const customEmojiNotificationNumber = useRef(0);
  const { showNotification } = getActions();
  const lang = useOldLang();

  const showCustomEmojiPremiumNotification = useLastCallback(() => {
    const notificationNumber = customEmojiNotificationNumber.current;
    if (!notificationNumber) {
      showNotification({
        message: lang('UnlockPremiumEmojiHint'),
        action: {
          action: 'openPremiumModal',
          payload: { initialSection: 'animated_emoji' },
        },
        actionText: lang('PremiumMore'),
      });
    } else {
      showNotification({
        message: lang('UnlockPremiumEmojiHint2'),
        action: {
          action: 'openChat',
          payload: { id: currentUserId, shouldReplaceHistory: true },
        },
        actionText: lang('Open'),
      });
    }
    customEmojiNotificationNumber.current = Number(!notificationNumber);
  });

  return {
    showCustomEmojiPremiumNotification,
  };
}
