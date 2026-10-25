import { useEffect, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * ScrollToTop component:
 * Guarantees that whenever a user navigates to any new page, standard-wise class,
 * subject, unit, chapter, or study material, the scroll position is forcefully reset to top (0, 0).
 * Prevents mobile, tablet, and desktop browsers from retaining scroll offsets or opening in the middle.
 */
const ScrollToTop = () => {
  const { pathname, search, hash } = useLocation()

  useIsomorphicLayoutEffect(() => {
    // Disable browser's default scroll restoration to prevent it from keeping old scroll offsets
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }

    const resetScroll = () => {
      // If there's an anchor hash and the element exists on the page, scroll to it
      if (hash) {
        const element = document.querySelector(hash)
        if (element) {
          element.scrollIntoView({ behavior: 'instant', block: 'start' })
          return
        }
      }

      // Force window to scroll to the top immediately
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant' as ScrollBehavior,
      })

      // Also reset documentElement, body, and potential scrolling container elements
      if (document.documentElement) {
        document.documentElement.scrollTop = 0
      }
      if (document.body) {
        document.body.scrollTop = 0
      }
      const appContainer = document.querySelector('.app')
      if (appContainer) {
        appContainer.scrollTop = 0
      }
      const mainContainer = document.querySelector('.main-content')
      if (mainContainer) {
        mainContainer.scrollTop = 0
      }
    }

    // 1. Immediate synchronous reset before paint
    resetScroll()

    // 2. Next animation frame to override any immediate layout calculation or framer-motion repositioning
    const rafId = requestAnimationFrame(resetScroll)

    // 3. Fallback timeout to ensure mobile browser finishes rendering after dynamic content or asset loads
    const timerId = setTimeout(resetScroll, 50)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(timerId)
    }
  }, [pathname, search, hash])

  return null
}

export default ScrollToTop
