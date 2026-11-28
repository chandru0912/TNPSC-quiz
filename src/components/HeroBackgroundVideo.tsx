import React, { useEffect, useRef, useState } from 'react'
import './HeroBackgroundVideo.css'

interface HeroBackgroundVideoProps {
  src?: string
  className?: string
}

function isSaveDataEnabled(): boolean {
  if (typeof navigator === 'undefined') return false
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return Boolean(conn?.saveData)
}

const HeroBackgroundVideo: React.FC<HeroBackgroundVideoProps> = ({
  src = '/assets/thirukkural-hero.mp4',
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  const [saveData, setSaveData] = useState<boolean>(() => isSaveDataEnabled())
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches)
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const conn = (
      navigator as Navigator & {
        connection?: EventTarget & { saveData?: boolean }
      }
    ).connection
    if (!conn || typeof conn.addEventListener !== 'function') return
    const onConnectionChange = () => setSaveData(isSaveDataEnabled())
    conn.addEventListener('change', onConnectionChange)
    return () => conn.removeEventListener('change', onConnectionChange)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || hasError) return

    if (prefersReducedMotion || saveData) {
      video.pause()
      return
    }

    const attemptPlay = () => {
      video.muted = true
      const playPromise = video.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Fallback: retry playback on first user interaction if browser blocks autoplay
          const resumeOnInteract = () => {
            video.muted = true
            video.play().catch(() => {})
          }
          window.addEventListener('pointerdown', resumeOnInteract, { once: true })
          window.addEventListener('keydown', resumeOnInteract, { once: true })
        })
      }
    }

    attemptPlay()
    video.addEventListener('canplay', attemptPlay, { once: true })
    return () => {
      video.removeEventListener('canplay', attemptPlay)
    }
  }, [prefersReducedMotion, saveData, hasError])

  return (
    <div className={`hero-bg-video-wrap ${className}`.trim()} aria-hidden="true">
      {!hasError && !prefersReducedMotion && !saveData && (
        <video
          ref={videoRef}
          className="hero-video"
          src={src}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          controls={false}
          tabIndex={-1}
          onError={() => setHasError(true)}
        />
      )}

      {/* Subtle localized readability gradient only behind left-side text */}
      <div className="hero-video-overlay" />
    </div>
  )
}

export default HeroBackgroundVideo
