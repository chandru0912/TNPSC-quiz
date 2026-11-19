import { useId } from 'react'
import { Sparkles, X } from 'lucide-react'
import './AchievementAwards.css'

export type AchievementAwardTier = 'GOLD' | 'PLATINUM' | 'SILVER'
export type AchievementAwardResult = AchievementAwardTier | 'NONE'

interface AwardShieldLogoProps {
  tier: AchievementAwardTier
  size?: number
  showLabel?: boolean
}

const TIER_PALETTE: Record<
  AchievementAwardTier,
  {
    outerStart: string
    outerMid: string
    outerEnd: string
    innerStart: string
    innerEnd: string
    starStart: string
    starEnd: string
    ribbonBg: string
    ribbonBorder: string
    textColor: string
    glow: string
  }
> = {
  GOLD: {
    outerStart: '#fff4b8',
    outerMid: '#ffd700',
    outerEnd: '#b45309',
    innerStart: '#fbbf24',
    innerEnd: '#78350f',
    starStart: '#ffffff',
    starEnd: '#fde047',
    ribbonBg: '#451a03',
    ribbonBorder: '#fbbf24',
    textColor: '#fef08a',
    glow: 'rgba(255, 215, 0, 0.45)',
  },
  PLATINUM: {
    outerStart: '#ffffff',
    outerMid: '#e2e8f0',
    outerEnd: '#64748b',
    innerStart: '#cbd5e1',
    innerEnd: '#1e293b',
    starStart: '#ffffff',
    starEnd: '#bae6fd',
    ribbonBg: '#0f172a',
    ribbonBorder: '#e2e8f0',
    textColor: '#f1f5f9',
    glow: 'rgba(226, 232, 240, 0.45)',
  },
  SILVER: {
    outerStart: '#f1f5f9',
    outerMid: '#94a3b8',
    outerEnd: '#334155',
    innerStart: '#94a3b8',
    innerEnd: '#0f172a',
    starStart: '#f8fafc',
    starEnd: '#cbd5e1',
    ribbonBg: '#1e293b',
    ribbonBorder: '#94a3b8',
    textColor: '#e2e8f0',
    glow: 'rgba(148, 163, 184, 0.4)',
  },
}

export function AwardShieldLogo({ tier, size = 34, showLabel = true }: AwardShieldLogoProps) {
  const uid = useId().replace(/:/g, '')
  const pal = TIER_PALETTE[tier]
  const outerGradId = `aw-outer-${tier}-${uid}`
  const innerGradId = `aw-inner-${tier}-${uid}`
  const starGradId = `aw-star-${tier}-${uid}`

  return (
    <span
      className={`award-logo-wrap tier-${tier.toLowerCase()}`}
      style={{ '--award-glow': pal.glow } as React.CSSProperties}
      title={`${tier} Achievement Award`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="award-shield-svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={outerGradId} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={pal.outerStart} />
            <stop offset="48%" stopColor={pal.outerMid} />
            <stop offset="100%" stopColor={pal.outerEnd} />
          </linearGradient>
          <linearGradient id={innerGradId} x1="14" y1="10" x2="50" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={pal.innerStart} />
            <stop offset="100%" stopColor={pal.innerEnd} />
          </linearGradient>
          <linearGradient id={starGradId} x1="20" y1="14" x2="44" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={pal.starStart} />
            <stop offset="100%" stopColor={pal.starEnd} />
          </linearGradient>
        </defs>

        {/* 3D Outer Metallic Shield */}
        <path
          d="M32 4L54 12V30C54 44.5 44.6 55.4 32 60C19.4 55.4 10 44.5 10 30V12L32 4Z"
          fill={`url(#${outerGradId})`}
          stroke={pal.outerStart}
          strokeWidth="1.5"
        />

        {/* Inner Faceted Shield Core */}
        <path
          d="M32 9L49 15.2V29.5C49 41.2 41.5 50.2 32 54.2C22.5 50.2 15 41.2 15 29.5V15.2L32 9Z"
          fill={`url(#${innerGradId})`}
          stroke={pal.outerMid}
          strokeWidth="1"
        />

        {/* Center Five-Point Star */}
        <path
          d="M32 15.5L35.9 23.4L44.6 24.7L38.3 30.8L39.8 39.5L32 35.4L24.2 39.5L25.7 30.8L19.4 24.7L28.1 23.4L32 15.5Z"
          fill={`url(#${starGradId})`}
          stroke={pal.outerEnd}
          strokeWidth="0.9"
        />

        {/* Bottom Metallic Ribbon Banner with Tier Name */}
        <rect
          x="8"
          y="46"
          width="48"
          height="13"
          rx="4"
          fill={pal.ribbonBg}
          stroke={pal.ribbonBorder}
          strokeWidth="1.2"
        />
        <text
          x="32"
          y="55"
          textAnchor="middle"
          fill={pal.textColor}
          fontSize={tier === 'PLATINUM' ? '7.2' : '8.2'}
          fontWeight="800"
          letterSpacing="0.6"
        >
          {tier}
        </text>
      </svg>
      {showLabel && <span className="award-logo-text">{tier}</span>}
    </span>
  )
}

interface LessonAwardSummaryBarProps {
  goldCount: number
  platinumCount: number
  silverCount: number
  totalAwards?: number
  compact?: boolean
  showTotal?: boolean
  hideZero?: boolean
}

export function LessonAwardSummaryBar({
  goldCount,
  platinumCount,
  silverCount,
  totalAwards,
  compact = false,
  showTotal = true,
  hideZero = false,
}: LessonAwardSummaryBarProps) {
  const computedTotal = totalAwards ?? goldCount + platinumCount + silverCount
  const showSilver = !hideZero || silverCount > 0
  const showPlatinum = !hideZero || platinumCount > 0
  const showGold = !hideZero || goldCount > 0

  if (hideZero && !showSilver && !showPlatinum && !showGold) {
    return null
  }

  return (
    <div className={`lesson-award-summary-bar ${compact ? 'is-compact' : ''}`} aria-label="Achievement Awards Summary">
      {showSilver && (
        <div className="award-pill-item tier-silver">
          <AwardShieldLogo tier="SILVER" size={compact ? 24 : 30} showLabel={false} />
          <span className="award-pill-name">SILVER</span>
          <strong className="award-pill-count">× {silverCount}</strong>
        </div>
      )}

      {showPlatinum && (
        <div className="award-pill-item tier-platinum">
          <AwardShieldLogo tier="PLATINUM" size={compact ? 24 : 30} showLabel={false} />
          <span className="award-pill-name">PLATINUM</span>
          <strong className="award-pill-count">× {platinumCount}</strong>
        </div>
      )}

      {showGold && (
        <div className="award-pill-item tier-gold">
          <AwardShieldLogo tier="GOLD" size={compact ? 24 : 30} showLabel={false} />
          <span className="award-pill-name">GOLD</span>
          <strong className="award-pill-count">× {goldCount}</strong>
        </div>
      )}

      {showTotal && (
        <div className="award-total-chip">
          <span>Total Awards:</span>
          <strong>{computedTotal}</strong>
        </div>
      )}
    </div>
  )
}

interface AwardCelebrationModalProps {
  isOpen: boolean
  onClose: () => void
  awardType: AchievementAwardResult
  percentage: number
  title?: string
}

export function AwardCelebrationModal({
  isOpen,
  onClose,
  awardType,
  percentage,
  title,
}: AwardCelebrationModalProps) {
  if (!isOpen) return null

  const isEarned = awardType === 'GOLD' || awardType === 'PLATINUM' || awardType === 'SILVER'
  const roundedPct = Math.round(Number(percentage || 0) * 10) / 10

  return (
    <div className="award-celebration-backdrop" role="dialog" aria-modal="true" aria-label="Achievement Award Celebration">
      <div className={`award-celebration-card glass tier-${awardType.toLowerCase()}`}>
        <button
          type="button"
          className="award-celebration-close"
          onClick={onClose}
          aria-label="Close celebration"
        >
          <X size={18} />
        </button>

        {isEarned ? (
          <>
            <div className="award-particles-ring" aria-hidden="true">
              <span className="aw-sparkle s1" />
              <span className="aw-sparkle s2" />
              <span className="aw-sparkle s3" />
              <span className="aw-sparkle s4" />
              <span className="aw-sparkle s5" />
              <span className="aw-sparkle s6" />
            </div>

            <div className="award-celebration-emblem">
              <AwardShieldLogo tier={awardType} size={112} showLabel={false} />
            </div>

            <div className="award-unlock-tag">
              <Sparkles size={14} />
              <span>
                {awardType === 'GOLD'
                  ? 'Rank #1 Highest Achievement'
                  : awardType === 'PLATINUM'
                    ? 'Rank #2 Elite Achievement'
                    : 'Rank #3 Merit Achievement'}
              </span>
            </div>

            <h2 className="award-celebration-heading">
              {awardType} AWARD UNLOCKED!
            </h2>

            {title && <p className="award-celebration-lesson">{title}</p>}

            <div className="award-celebration-score-pill">
              <span>Achieved Score</span>
              <strong>{roundedPct}%</strong>
            </div>
          </>
        ) : (
          <>
            <div className="award-encourage-icon">
              <Sparkles size={42} />
            </div>
            <h2 className="award-celebration-heading encourage">
              Keep Practicing! You Can Earn Your Next Award.
            </h2>
            {title && <p className="award-celebration-lesson">{title}</p>}
            <div className="award-celebration-score-pill">
              <span>Achieved Score</span>
              <strong>{roundedPct}%</strong>
            </div>
            <p className="award-encourage-sub">
              Reach 60%+ for Silver, 75%+ for Platinum, or 90%+ for a Gold Award on your next attempt!
            </p>
          </>
        )}

        <button type="button" className="btn btn-primary award-celebration-cta" onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  )
}
