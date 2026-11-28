import React from 'react'

interface OrbitBrandLogoProps {
  size?: number
  className?: string
  'aria-hidden'?: boolean
}

/**
 * Unified TNPSC Aspirant Orbit brand emblem:
 * Academic graduation cap encircled by a tilted golden-purple orbital ring and star node.
 */
export const OrbitBrandLogo: React.FC<OrbitBrandLogoProps> = ({
  size = 24,
  className = '',
  'aria-hidden': ariaHidden = true,
}) => {
  const uid = React.useId().replace(/:/g, '')
  const goldGradId = `orbit-gold-${uid}`
  const ringGradId = `orbit-ring-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      <defs>
        <linearGradient id={goldGradId} x1="8" y1="6" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF7CC" />
          <stop offset="45%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id={ringGradId} x1="3" y1="28" x2="37" y2="11" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A855F7" stopOpacity="0.95" />
          <stop offset="48%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FFF59D" />
        </linearGradient>
      </defs>

      {/* Back orbital arc */}
      <ellipse
        cx="20"
        cy="20.5"
        rx="16.5"
        ry="7.4"
        transform="rotate(-24 20 20.5)"
        stroke={`url(#${ringGradId})`}
        strokeWidth="2.1"
        strokeLinecap="round"
        opacity="0.88"
      />

      {/* Graduation cap crown */}
      <path
        d="M20 9.5L32 15.2L20 20.9L8 15.2L20 9.5Z"
        fill={`url(#${goldGradId})`}
        stroke="#FFFDF0"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />

      {/* Cap base / academic band */}
      <path
        d="M12.5 17.6V23.4C12.5 25.4 15.8 27.2 20 27.2C24.2 27.2 27.5 25.4 27.5 23.4V17.6L20 21.1L12.5 17.6Z"
        fill={`url(#${goldGradId})`}
        fillOpacity="0.92"
      />

      {/* Tassel */}
      <path
        d="M30.4 16.2V23.2"
        stroke="#FFF59D"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="30.4" cy="24.2" r="1.4" fill="#FFD700" />

      {/* Orbital star node */}
      <circle cx="33.2" cy="11.2" r="2.3" fill="#FFF7CC" />
      <circle cx="33.2" cy="11.2" r="1.2" fill="#FFD700" />
    </svg>
  )
}

export default OrbitBrandLogo
