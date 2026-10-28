import { useEffect } from 'react';
import { lockScroll, unlockScroll } from '../utils/scrollLock';

/**
 * React hook to lock background scrolling while a modal, popup, or side drawer is open.
 * Automatically cleans up on unmount or when `isLocked` becomes false.
 *
 * @param isLocked Whether the overlay is currently open
 */
export function useScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;

    lockScroll();

    return () => {
      unlockScroll();
    };
  }, [isLocked]);
}

export default useScrollLock;
