import React, { useEffect, useRef, useState } from 'react'
import './HeroBackgroundVideo.css'

interface HeroBackgroundVideoProps {
  src?: string
  className?: string
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
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches)
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || hasError) return

    if (prefersReducedMotion) {
      video.pause()
      return
    }

    video.muted = true
    const playPromise = video.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Autoplay handled by muted + playsInline attributes
      })
    }
  }, [prefersReducedMotion, hasError])

  return (
    <div className={`hero-bg-video-wrap ${className}`.trim()} aria-hidden="true">
      {!hasError && !prefersReducedMotion && (
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
