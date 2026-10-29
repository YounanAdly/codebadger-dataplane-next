"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  decimals?: number;
  /** Total count duration in ms. */
  duration?: number;
  /** Delay before counting starts, in ms — use to stagger rows. */
  delay?: number;
  className?: string;
}

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

const format = (value: number, decimals: number): string =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/**
 * Number that counts up from zero the first time it scrolls into view.
 * Server-rendered markup shows the final value immediately, so no-JS and
 * reduced-motion visitors never see a zero. `display` holds the animated
 * value while counting; `null` renders the live final value, which also
 * keeps the number correct if the server data refreshes.
 */
export function CountUp({ value, decimals = 0, duration = 1100, delay = 0, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let timeout = 0;
    let started = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || started) continue;
          started = true;
          observer.disconnect();
          timeout = window.setTimeout(() => {
            const start = performance.now();
            const tick = (now: number) => {
              const progress = Math.min(1, (now - start) / duration);
              if (progress < 1) {
                setDisplay(format(value * easeOutExpo(progress), decimals));
                raf = requestAnimationFrame(tick);
              } else {
                setDisplay(null);
              }
            };
            raf = requestAnimationFrame(tick);
          }, delay);
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [value, decimals, duration, delay]);

  return (
    <span ref={ref} className={className}>
      {display ?? format(value, decimals)}
    </span>
  );
}
