import React, { useEffect, useState, useRef } from 'react';

interface AnimatedCountUpProps {
  end: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const AnimatedCountUp: React.FC<AnimatedCountUpProps> = ({
  end,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}) => {
  const safeEnd = Number.isFinite(Number(end)) ? Number(end) : 0;
  const [displayValue, setDisplayValue] = useState<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const prevEndRef = useRef<number>(0);

  useEffect(() => {
    // Accessibility check: Skip animation if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || duration <= 0) {
      setDisplayValue(safeEnd);
      prevEndRef.current = safeEnd;
      return;
    }

    const startVal = prevEndRef.current;
    const diff = safeEnd - startVal;

    if (diff === 0) {
      setDisplayValue(safeEnd);
      return;
    }

    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth ease-out cubic curve
      const easeOutProgress = 1 - Math.pow(1 - progress, 3);
      const current = startVal + diff * easeOutProgress;

      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(safeEnd);
        prevEndRef.current = safeEnd;
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [safeEnd, duration]);

  const safeDisplay = Number.isFinite(displayValue) ? displayValue : 0;
  const formatted =
    decimals > 0
      ? safeDisplay.toLocaleString('en-IN', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(safeDisplay).toLocaleString('en-IN');

  return (
    <span className={`animated-count-up ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

