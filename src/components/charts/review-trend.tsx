import { CountUp } from "@/components/charts/count-up";

export interface TrendWeek {
  /** Short label, e.g. "Oct 6". */
  label: string;
  /** Pull requests reviewed that week. */
  reviewed: number;
  /** Of those, how many were asked to change. */
  changes: number;
}

const W = 640;
const H = 240;
const PAD_X = 10;
const PAD_TOP = 20;
const PAD_BOTTOM = 26;
const COL_GAP = 14;

/**
 * Weekly review activity: one column per week, approved (graphite) stacked
 * over changes-requested (accent). Server-rendered — no client JS. Columns
 * grow from the baseline and points pop via the shared cv-* chart motion
 * when the surrounding ChartReveal card flips to "play"; native <title>
 * tooltips carry the per-week breakdown.
 */
export function ReviewTrend({ weeks }: { weeks: TrendWeek[] }) {
  const n = weeks.length;
  const max = Math.max(1, ...weeks.map((w) => w.reviewed));
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const colW = n > 0 ? Math.min(56, (plotW - COL_GAP * (n - 1)) / n) : 0;
  const x = (i: number) => PAD_X + i * (colW + COL_GAP) + (plotW - n * colW - (n - 1) * COL_GAP) / 2;
  const h = (v: number) => (v / max) * plotH;
  const y = (v: number) => PAD_TOP + plotH - h(v);

  const totalReviewed = weeks.reduce((s, w) => s + w.reviewed, 0);
  const totalChanges = weeks.reduce((s, w) => s + w.changes, 0);
  const gridValues = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const last = weeks[n - 1];

  return (
    <figure className="mt-4 flex flex-1 flex-col">
      <div className="relative flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full"
          role="img"
          aria-label={`Reviews per week: ${totalReviewed} pull requests reviewed over the last ${n} weeks, ${totalChanges} asked for changes.`}
        >
          {/* gridlines with value labels */}
          {gridValues.map((v) => (
            <g key={v} className="cv-fade-in" style={{ ["--d" as string]: "150ms" }}>
              <line
                x1={PAD_X} x2={W - PAD_X} y1={y(v)} y2={y(v)}
                stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 4"
                className="text-fg"
              />
              <text x={PAD_X} y={y(v) - 4} className="fill-current text-fg-3" fontSize="10">
                {v}
              </text>
            </g>
          ))}

          {weeks.map((w, i) => {
            const changesH = h(w.changes);
            const approvedH = h(w.reviewed - w.changes);
            const isLatest = i === n - 1;
            return (
              <g key={`${w.label}-${i}`}>
                {w.reviewed > 0 ? (
                  <title>
                    {`Week of ${w.label}: ${w.reviewed} reviewed · ${w.changes} changes requested · ${w.reviewed - w.changes} approved`}
                  </title>
                ) : null}
                {w.reviewed > 0 ? (
                  <>
                    {/* changes-requested segment sits at the baseline */}
                    <rect
                      x={x(i)} y={y(w.changes)} width={colW} height={changesH}
                      rx="3" className="cv-col fill-accent"
                      style={{ ["--d" as string]: `${220 + i * 70}ms` }}
                    />
                    {/* approved segment stacks on top */}
                    {approvedH > 0 && (
                      <rect
                        x={x(i)} y={y(w.reviewed)} width={colW} height={approvedH}
                        rx="3" className="cv-col fill-fg-3/70"
                        style={{ ["--d" as string]: `${220 + i * 70}ms` }}
                      />
                    )}
                  </>
                ) : null}
                {/* latest week gets the breathing halo */}
                {isLatest && w.reviewed > 0 ? (
                  <circle
                    cx={x(i) + colW / 2} cy={y(w.reviewed) - 8} r="3"
                    className="cv-pop fill-accent/50 cv-pulse-ring"
                    style={{ ["--d" as string]: `${220 + i * 70 + 300}ms` }}
                  />
                ) : null}
                <text
                  x={x(i) + colW / 2} y={H - 8} textAnchor="middle"
                  fontSize="10" className="cv-fade-in fill-current text-fg-3"
                  style={{ ["--d" as string]: "260ms" }}
                >
                  {w.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-fg-3">
        <span className="cv-anim inline-flex items-center gap-1.5" style={{ ["--d" as string]: "500ms" }}>
          <span className="h-0.5 w-4 rounded bg-fg-3/70" aria-hidden />
          Approved
        </span>
        <span className="cv-anim inline-flex items-center gap-1.5" style={{ ["--d" as string]: "580ms" }}>
          <span className="h-0.5 w-4 rounded bg-accent" aria-hidden />
          Changes requested
        </span>
        <span className="cv-anim ml-auto font-mono text-[10px] text-fg-3" style={{ ["--d" as string]: "640ms" }}>
          <CountUp value={totalReviewed} delay={500} /> reviewed · {last ? `${last.reviewed} this week` : "no reviews yet"}
        </span>
      </figcaption>
    </figure>
  );
}
