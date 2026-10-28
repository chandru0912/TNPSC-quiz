/**
 * TNPSC Study Hub - Shared Scroll Lock Utility
 * Provides robust background scroll locking with reference counting,
 * scroll position preservation, and mobile (iOS/Android) fixed-viewport support.
 */

interface SavedBodyStyles {
  overflow: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  paddingRight: string;
  htmlOverflow: string;
  htmlScrollBehavior: string;
}

let activeLockCount = 0;
let savedScrollY = 0;
let savedStyles: SavedBodyStyles | null = null;

/**
 * Locks the background page from scrolling while preserving the current scroll position.
 * Uses reference counting so multiple open overlays do not conflict.
 */
export function lockScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (activeLockCount === 0) {
    // Record current scroll position across all browser standards
    savedScrollY =
      window.scrollY ||
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    const body = document.body;
    const html = document.documentElement;

    // Detect scrollbar width to prevent desktop layout shifting when scrollbar disappears
    const scrollbarWidth = window.innerWidth - html.clientWidth;

    // Save existing inline styles so we restore them perfectly
    savedStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
      htmlOverflow: html.style.overflow,
      htmlScrollBehavior: html.style.scrollBehavior,
    };

    // Temporarily disable smooth scroll behavior during lock to avoid animation jumps
    html.style.scrollBehavior = 'auto';
    html.style.overflow = 'hidden';

    // Lock body via position fixed + negative top offset (the standard for mobile Safari & Chrome)
    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  activeLockCount++;
}

/**
 * Decrements the active lock count and restores original background scrolling
 * and scroll position once all overlays have closed.
 */
export function unlockScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (activeLockCount <= 0) {
    activeLockCount = 0;
    return;
  }

  activeLockCount--;

  if (activeLockCount === 0 && savedStyles) {
    const body = document.body;
    const html = document.documentElement;
    const restoreY = savedScrollY;
    const styles = savedStyles;

    // Restore body styles
    body.style.overflow = styles.overflow;
    body.style.position = styles.position;
    body.style.top = styles.top;
    body.style.left = styles.left;
    body.style.right = styles.right;
    body.style.width = styles.width;
    body.style.paddingRight = styles.paddingRight;

    // Restore html styles
    html.style.overflow = styles.htmlOverflow;
    html.style.scrollBehavior = styles.htmlScrollBehavior;

    savedStyles = null;

    // Restore scroll position
    window.scrollTo({
      top: restoreY,
      left: 0,
      behavior: 'instant' as ScrollBehavior,
    });
  }
}

/**
 * Helper to inspect lock state for debugging and tests
 */
export function getActiveLockCount(): number {
  return activeLockCount;
}
