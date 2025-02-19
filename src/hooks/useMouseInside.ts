import { useEffect, useRef } from '../lib/teact/teact';

import { IS_TOUCH_ENV } from '../util/windowEnvironment';
import useLastCallback from './useLastCallback';

const MENU_CLOSE_TIMEOUT = 250;
let closeTimeout: number | undefined;

export default function useMouseInside(
  isOpen: boolean, onClose: NoneToVoidFunction, menuCloseTimeout = MENU_CLOSE_TIMEOUT, isDisabled = false,
) {
  const isMouseInside = useRef(false);

  useEffect(() => {
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = undefined;
    }
  }, [isOpen]);

  const handleMouseEnter = useLastCallback(() => {
    isMouseInside.current = true;

    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = undefined;
    }
  });

  const handleMouseLeave = useLastCallback(() => {
    isMouseInside.current = false;

    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = undefined;
    }

    closeTimeout = window.setTimeout(() => {
      if (!isMouseInside.current) {
        onClose();
      }
    }, menuCloseTimeout);
  });

  return [handleMouseEnter, handleMouseLeave];
}
