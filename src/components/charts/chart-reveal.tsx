"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ChartRevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay in ms — offset sibling cards so they cascade in. */
  delay?: number;
}

/**
 * Viewport-entry arm for chart motion. Server-rendered markup and no-JS
 * visitors see the complete chart (`data-chart-anim="ssr"` carries no hidden
 * styles). After hydration — and only when motion is allowed — the wrapper
 * arms itself ("armed": hidden, shifted down) and flips to "play" the first
 * time it enters the viewport, which starts every CSS-driven chart animation
 * inside it. Reduced-motion users are never armed. The attribute is written
 * straight to the DOM node so intersection causes no re-render.
 */
export function ChartReveal({ children, className, delay = 0 }: ChartRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    el.dataset.chartAnim = "armed";
    // Cards already inside the viewport play immediately (same task, so the
    // hidden state is never painted) — above-fold charts never depend solely
    // on the observer's first callback.
    const rect = el.getBoundingClientRect();
    if (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.left < window.innerWidth
    ) {
      el.dataset.chartAnim = "play";
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.dataset.chartAnim = "play";
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-chart-anim="ssr"
      style={delay ? { ["--reveal-delay" as string]: `${delay}ms` } : undefined}
      className={className}
    >
      {children}
    </div>
  );
}
