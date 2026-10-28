/**
 * TNPSC Study Hub - Interactive 3D Spatial Tilt & Volumetric Lighting Engine
 * 
 * Provides hardware-accelerated 60/120fps 3D cursor tracking, perspective rotation,
 * dynamic specular glare rendering, and true spatial parallax for logos and brand SVG icons.
 * Uses requestAnimationFrame with linear interpolation (LERP) damping.
 */

import { useEffect, type RefObject } from 'react'

export interface SpatialTiltOptions {
  /** Maximum tilt rotation angle in degrees (default: 18) */
  maxTilt?: number
  /** CSS perspective value in pixels (default: 1000) */
  perspective?: number
  /** Scale factor on hover/tilt (default: 1.05) */
  scale?: number
  /** Smoothness / LERP damping factor between 0.05 (soft) and 0.25 (snappy). Default: 0.12 */
  easing?: number
  /** Whether to inject and track dynamic specular glare reflection (default: true) */
  glare?: boolean
  /** Maximum opacity of the dynamic specular glare reflection (default: 0.85) */
  maxGlare?: number
  /** Reverse tilt direction (default: false) */
  reverse?: boolean
  /** Target child element selector for tilt (if parent handles hover area) */
  targetSelector?: string
}

const DEFAULT_OPTIONS: Required<SpatialTiltOptions> = {
  maxTilt: 18,
  perspective: 1000,
  scale: 1.05,
  easing: 0.12,
  glare: true,
  maxGlare: 0.85,
  reverse: false,
  targetSelector: '',
}

export const SPATIAL_LOGO_SELECTORS = [
  '.nav-logo',
  '.footer-brand',
  '.sidebar-brand',
  '.auth-icon',
  '.admin-auth-icon',
  '.mobile-auth-icon-box',
  '[data-spatial-logo]',
]

const boundElements = new WeakSet<HTMLElement>()

/**
 * Attaches interactive 3D spatial tilt tracking and dynamic specular glare to an element.
 * Returns a cleanup/destroy function.
 */
export function attachSpatialTilt(
  element: HTMLElement,
  options: SpatialTiltOptions = {}
): () => void {
  if (!element || typeof window === 'undefined') {
    return () => {}
  }

  // Prevent double binding on the same element
  if (boundElements.has(element)) {
    return () => {}
  }
  boundElements.add(element)

  const config: Required<SpatialTiltOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  // Check user preference for reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReducedMotion) {
    return () => {
      boundElements.delete(element)
    }
  }

  // Identify tilt target element (either specified child or the element itself)
  const tiltTarget: HTMLElement = config.targetSelector
    ? (element.querySelector(config.targetSelector) as HTMLElement) || element
    : element

  // Ensure 3D perspective foundations on parent container and target
  element.style.perspective = `${config.perspective}px`
  element.style.transformStyle = 'preserve-3d'
  tiltTarget.style.transformStyle = 'preserve-3d'

  // Inject specular glare layer if requested and not already present
  let glareEl: HTMLElement | null = null
  if (config.glare) {
    // Find child medallion (e.g. .nav-logo-icon-3d, .footer-logo-icon-3d, etc.) or tiltTarget
    const medallion =
      (tiltTarget.querySelector(
        '.nav-logo-icon-3d, .footer-logo-icon-3d, .sidebar-brand-mark, .auth-icon, .admin-auth-icon, .mobile-auth-icon-box'
      ) as HTMLElement) || tiltTarget

    let existingGlare = medallion.querySelector('.spatial-glare') as HTMLElement
    if (!existingGlare) {
      existingGlare = document.createElement('span')
      existingGlare.className = 'spatial-glare'
      existingGlare.setAttribute('aria-hidden', 'true')
      medallion.appendChild(existingGlare)
    }
    glareEl = existingGlare
  }

  // Motion physics state
  let isHovered = false
  let rect: DOMRect | null = null
  let rafId: number | null = null

  let targetRotX = 0
  let targetRotY = 0
  let targetScale = 1
  let targetGlareOpacity = 0

  let currentRotX = 0
  let currentRotY = 0
  let currentScale = 1
  let currentGlareOpacity = 0

  let glareX = 50
  let glareY = 50

  const updateMotion = () => {
    // LERP (Linear Interpolation) damping toward target angles
    currentRotX += (targetRotX - currentRotX) * config.easing
    currentRotY += (targetRotY - currentRotY) * config.easing
    currentScale += (targetScale - currentScale) * config.easing
    currentGlareOpacity += (targetGlareOpacity - currentGlareOpacity) * config.easing

    // Apply hardware-accelerated 3D transforms
    tiltTarget.style.transform = `perspective(${config.perspective}px) rotateX(${currentRotX.toFixed(
      2
    )}deg) rotateY(${currentRotY.toFixed(2)}deg) scale3d(${currentScale.toFixed(
      3
    )}, ${currentScale.toFixed(3)}, ${currentScale.toFixed(3)})`

    // Update dynamic specular glare coordinates & opacity
    if (glareEl) {
      glareEl.style.setProperty('--glare-x', `${glareX.toFixed(1)}%`)
      glareEl.style.setProperty('--glare-y', `${glareY.toFixed(1)}%`)
      glareEl.style.setProperty('--glare-opacity', `${currentGlareOpacity.toFixed(2)}`)
    }

    // Check if motion has settled to rest
    const isAtRest =
      !isHovered &&
      Math.abs(currentRotX) < 0.01 &&
      Math.abs(currentRotY) < 0.01 &&
      Math.abs(currentScale - 1) < 0.002 &&
      currentGlareOpacity < 0.01

    if (isAtRest) {
      tiltTarget.style.transform = ''
      tiltTarget.style.transition = ''
      if (glareEl) {
        glareEl.style.setProperty('--glare-opacity', '0')
      }
      rafId = null
    } else {
      rafId = requestAnimationFrame(updateMotion)
    }
  }

  const startLoop = () => {
    if (!rafId) {
      rafId = requestAnimationFrame(updateMotion)
    }
  }

  const handlePointerEnter = (e: PointerEvent) => {
    isHovered = true
    rect = element.getBoundingClientRect()
    // Disable CSS transitions during interactive tracking for 120fps fluidity
    tiltTarget.style.transition = 'none'
    targetScale = config.scale
    targetGlareOpacity = config.maxGlare
    handlePointerMove(e)
    startLoop()
  }

  const handlePointerMove = (e: PointerEvent | MouseEvent) => {
    if (!rect) {
      rect = element.getBoundingClientRect()
    }
    if (rect.width === 0 || rect.height === 0) return

    // Normalized coordinates from center: -0.5 to 0.5
    const normX = (e.clientX - rect.left) / rect.width - 0.5
    const normY = (e.clientY - rect.top) / rect.height - 0.5

    const clampedX = Math.max(-0.5, Math.min(0.5, normX))
    const clampedY = Math.max(-0.5, Math.min(0.5, normY))

    const mult = config.reverse ? -1 : 1

    targetRotY = clampedX * config.maxTilt * mult
    targetRotX = -clampedY * config.maxTilt * mult

    glareX = (clampedX + 0.5) * 100
    glareY = (clampedY + 0.5) * 100

    startLoop()
  }

  const handlePointerLeave = () => {
    isHovered = false
    rect = null
    // Smooth physical spring recovery on mouse exit
    tiltTarget.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease'
    targetRotX = 0
    targetRotY = 0
    targetScale = 1
    targetGlareOpacity = 0
    startLoop()
  }

  // Device orientation (mobile gyroscope) subtle 3D tilt
  const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
    if (isHovered || e.gamma === null || e.beta === null) return
    const normGamma = Math.max(-1, Math.min(1, e.gamma / 30))
    const normBeta = Math.max(-1, Math.min(1, (e.beta - 45) / 30))

    targetRotY = normGamma * (config.maxTilt * 0.6)
    targetRotX = -normBeta * (config.maxTilt * 0.6)
    targetScale = 1.01
    targetGlareOpacity = 0.35
    glareX = (normGamma + 1) * 50
    glareY = (normBeta + 1) * 50
    startLoop()
  }

  element.addEventListener('pointerenter', handlePointerEnter, { passive: true })
  element.addEventListener('pointermove', handlePointerMove, { passive: true })
  element.addEventListener('pointerleave', handlePointerLeave, { passive: true })

  if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && 'ontouchstart' in window) {
    window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true })
  }

  return () => {
    boundElements.delete(element)
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    element.removeEventListener('pointerenter', handlePointerEnter)
    element.removeEventListener('pointermove', handlePointerMove)
    element.removeEventListener('pointerleave', handlePointerLeave)
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && 'ontouchstart' in window) {
      window.removeEventListener('deviceorientation', handleDeviceOrientation)
    }
    tiltTarget.style.transform = ''
    tiltTarget.style.transition = ''
  }
}

/**
 * Initializes interactive 3D spatial tilt across all logo and brand elements on the website.
 * Observes DOM mutations so that dynamically mounted modals and pages automatically receive the effect.
 */
export function initSpatialTilt(options?: SpatialTiltOptions): () => void {
  if (typeof document === 'undefined') {
    return () => {}
  }

  const cleanups: Array<() => void> = []

  const scanAndAttach = () => {
    SPATIAL_LOGO_SELECTORS.forEach((selector) => {
      const elements = document.querySelectorAll<HTMLElement>(selector)
      elements.forEach((el) => {
        const cleanup = attachSpatialTilt(el, options)
        cleanups.push(cleanup)
      })
    })
  }

  // Initial scan
  scanAndAttach()

  // Dynamic mutation observer for route transitions and modal openings
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      scanAndAttach()
    }, 150)
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    observer.disconnect()
    cleanups.forEach((fn) => fn())
  }
}

/**
 * React Hook for binding interactive 3D spatial tilt to a ref.
 */
export function useSpatialTilt<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options?: SpatialTiltOptions
) {
  useEffect(() => {
    if (!ref.current) return
    const cleanup = attachSpatialTilt(ref.current, options)
    return cleanup
  }, [ref, options])
}
