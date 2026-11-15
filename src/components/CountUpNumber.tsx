import React, { useEffect, useRef, useState } from 'react';

interface CountUpNumberProps {
  value: number;
  formatter: (val: number) => string;
  durationMs?: number;
  className?: string;
}

export const CountUpNumber: React.FC<CountUpNumberProps> = ({
  value,
  formatter,
  durationMs = 800,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const prevValueRef = useRef<number>(0);
  const isFirstRenderRef = useRef<boolean>(true);

  useEffect(() => {
    const startVal = isFirstRenderRef.current ? 0 : prevValueRef.current;
    const endVal = value;

    if (!isFirstRenderRef.current && Math.abs(endVal - startVal) > 0.01) {
      setIsFlashing(true);
      const flashTimer = setTimeout(() => setIsFlashing(false), 900);
      prevValueRef.current = value;

      let rafId: number;
      const startTime = performance.now();

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(startVal + (endVal - startVal) * eased);
        if (progress < 1) {
          rafId = requestAnimationFrame(animate);
        } else {
          setDisplayValue(endVal);
        }
      };

      rafId = requestAnimationFrame(animate);
      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(flashTimer);
      };
    }

    isFirstRenderRef.current = false;
    prevValueRef.current = value;

    let rafId: number;
    const startTime = performance.now();

    const animateInitial = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startVal + (endVal - startVal) * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(animateInitial);
      } else {
        setDisplayValue(endVal);
      }
    };

    rafId = requestAnimationFrame(animateInitial);
    return () => cancelAnimationFrame(rafId);
  }, [value, durationMs]);

  return (
    <span
      className={`tabular-nums transition-all duration-500 rounded px-0.5 -mx-0.5 ${
        isFlashing
          ? 'text-[#00E676] drop-shadow-[0_0_12px_rgba(0,230,118,0.85)] bg-[#00E676]/10'
          : ''
      } ${className}`}
    >
      {formatter(displayValue)}
    </span>
  );
};
