"use client";

import { useState } from "react";
import { CountUp } from "@/components/charts/count-up";

export interface SeveritySlice {
  severity: string;
  count: number;
}

/* Same severity palette mapping the platform donut uses, expressed in the
   dataplane's tokens: accent critical, warning high, info medium, graphite
   low/info so every slice stays distinguishable. */
const SEVERITY_COLOR: Record<string, string> = {
  critical: "var(--accent)",
  high: "var(--warning)",
  medium: "var(--info)",
  low: "var(--fg-secondary)",
  info: "var(--fg-muted)",
};

/**
 * Findings-by-severity donut. Arcs sweep in when the card enters the
 * viewport; hovering an arc or its legend row thickens it, dims the rest,
 * and swaps the center to that slice's count.
 */
export function SeverityDonut({ slices, total }: { slices: SeveritySlice[]; total: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const R = 15.9155; // r=25.46 → circumference ≈ 100, dasharray = percent
  const nonZero = slices.filter((s) => s.count > 0);
  const arcs: Array<{ slice: SeveritySlice; pct: number; dashOffset: number }> = [];
  let offset = 25; // start at 12 o'clock
  for (const slice of nonZero) {
    const pct = total > 0 ? (slice.count / total) * 100 : 0;
    arcs.push({ slice, pct, dashOffset: offset });
    offset = (offset - pct + 100) % 100;
  }
  const active = hovered ? arcs.find((a) => a.slice.severity === hovered) : undefined;

  return (
    <div className="mt-4 grid items-center gap-6 sm:grid-cols-[auto_1fr]">
      <div className="relative mx-auto h-52 w-52 sm:mx-0">
        <div aria-hidden className="absolute inset-3 rounded-full bg-accent/[0.06] blur-2xl" />
        <svg
          viewBox="0 0 42 42"
          className="relative h-full w-full"
          role="img"
          aria-label={`Findings by severity: ${nonZero
            .map((s) => `${s.count} ${s.severity}`)
            .join(", ")}.`}
        >
          <circle cx="21" cy="21" r={R} fill="none" strokeWidth="5" className="stroke-raised" />
          {arcs.map(({ slice, pct, dashOffset }, i) => (
            <circle
              key={slice.severity}
              cx="21" cy="21" r={R} fill="none"
              stroke={SEVERITY_COLOR[slice.severity] ?? "var(--fg-muted)"}
              strokeWidth={hovered === slice.severity ? 6.5 : 5}
              strokeDasharray={`${pct.toFixed(2)} ${(100 - pct).toFixed(2)}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
              className={`cv-donut-arc cursor-pointer transition-[stroke-width,opacity] duration-300 ${
                hovered && hovered !== slice.severity ? "opacity-30" : "opacity-100"
              }`}
              style={{ ["--d" as string]: `${280 + i * 140}ms` }}
              onPointerEnter={() => setHovered(slice.severity)}
              onPointerLeave={() => setHovered(null)}
            />
          ))}
        </svg>

        {/* center readout — HTML overlay so the total can count up */}
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          {active ? (
            <div key={active.slice.severity} className="cb-fade-in px-6">
              <p className="text-2xl font-semibold tabular-nums text-fg">{active.slice.count}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-fg-3">
                {active.slice.severity} · {Math.round(active.pct)}%
              </p>
            </div>
          ) : (
            <div className="px-6">
              <p className="text-2xl font-semibold tabular-nums text-fg">
                <CountUp value={total} delay={650} />
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-fg-3">findings</p>
            </div>
          )}
        </div>
      </div>

      <ul className="space-y-1.5">
        {nonZero.map((slice, i) => (
          <li
            key={slice.severity}
            className={`group/row -mx-2 flex cursor-default items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-raised ${
              hovered && hovered !== slice.severity ? "opacity-45" : "opacity-100"
            }`}
            style={{ ["--d" as string]: `${460 + i * 80}ms` }}
            onPointerEnter={() => setHovered(slice.severity)}
            onPointerLeave={() => setHovered(null)}
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-sm transition-transform duration-300 ${
                hovered === slice.severity ? "scale-125" : ""
              }`}
              style={{ background: SEVERITY_COLOR[slice.severity] ?? "var(--fg-muted)" }}
              aria-hidden
            />
            <span className="w-16 capitalize text-fg">{slice.severity}</span>
            <span className="ml-auto w-8 text-right font-mono text-xs font-medium tabular-nums text-fg-2">
              {slice.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
