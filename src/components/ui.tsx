// src/components/ui.tsx
/**
 * CodeBadger dashboard primitives — one visual language for every page.
 * Server-component safe: pure markup + CSS transitions, no client JS.
 */
import Link from "next/link";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Icons — single coherent 16px stroke system, currentColor            */
/* ------------------------------------------------------------------ */

type IconProps = { className?: string };

function Svg({ children, className = "w-4 h-4" }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export function IconPullRequest({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="4" cy="4" r="1.75" />
      <circle cx="4" cy="12" r="1.75" />
      <path d="M4 5.75v4.5" />
      <circle cx="12" cy="12" r="1.75" />
      <path d="M12 9.5V7a2.5 2.5 0 0 0-2.5-2.5H8" />
      <path d="M9.5 3 8 4.5 9.5 6" />
    </Svg>
  );
}

export function IconCommit({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5v4M8 10.5v4" />
    </Svg>
  );
}

export function IconBranch({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="4" cy="3.5" r="1.75" />
      <circle cx="4" cy="12.5" r="1.75" />
      <circle cx="12" cy="5.5" r="1.75" />
      <path d="M4 5.25v5.5" />
      <path d="M12 7.25c0 2.5-3 2.25-5.5 3.5" />
    </Svg>
  );
}

export function IconExternal({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6.5 3.5H3.75A1.25 1.25 0 0 0 2.5 4.75v7.5A1.25 1.25 0 0 0 3.75 13.5h7.5a1.25 1.25 0 0 0 1.25-1.25V9.5" />
      <path d="M9.5 2.5h4v4" />
      <path d="M13.5 2.5 8 8" />
    </Svg>
  );
}

export function IconArrowRight({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M2.5 8h11" />
      <path d="m9.5 4 4 4-4 4" />
    </Svg>
  );
}

export function IconArrowLeft({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M13.5 8h-11" />
      <path d="m6.5 4-4 4 4 4" />
    </Svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m3 8.5 3.5 3.5L13 4.5" />
    </Svg>
  );
}

export function IconX({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </Svg>
  );
}

export function IconDot({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconShield({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8 1.75 13.5 3.5v4c0 3.5-2.4 5.9-5.5 7-3.1-1.1-5.5-3.5-5.5-7v-4L8 1.75Z" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Verdicts                                                            */
/* ------------------------------------------------------------------ */

export type Verdict = "success" | "failure" | "comment" | "pending";

export const VERDICT_CFG: Record<Verdict, { label: string; cls: string; icon: (p: IconProps) => ReactNode }> = {
  success: { label: "Approved", cls: "text-success bg-success-soft border-success-border", icon: IconCheck },
  failure: { label: "Changes Required", cls: "text-accent bg-accent-soft border-accent-border", icon: IconX },
  comment: { label: "Comment", cls: "text-warning bg-warning-soft border-warning-border", icon: IconDot },
  pending: { label: "Pending", cls: "text-info bg-info-soft border-info-border", icon: IconDot },
};

export function VerdictBadge({ verdict, size = "sm" }: { verdict: string; size?: "sm" | "lg" }) {
  const v = VERDICT_CFG[(verdict as Verdict) in VERDICT_CFG ? (verdict as Verdict) : "pending"];
  const Icon = v.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap ${
        size === "lg" ? "px-4 py-1.5 text-sm" : "px-2.5 py-0.5 text-xs"
      } ${v.cls}`}
    >
      <Icon className={size === "lg" ? "w-3.5 h-3.5" : "w-3 h-3"} />
      {v.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Severity                                                            */
/* ------------------------------------------------------------------ */

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export const SEVERITY_CFG: Record<Severity, { label: string; cls: string; dot: string }> = {
  critical: { label: "Critical", cls: "text-accent bg-accent-soft border-accent-border", dot: "bg-accent" },
  high: { label: "High", cls: "text-warning bg-warning-soft border-warning-border", dot: "bg-warning" },
  medium: { label: "Medium", cls: "text-warning bg-warning-soft border-warning-border", dot: "bg-warning" },
  low: { label: "Low", cls: "text-info bg-info-soft border-info-border", dot: "bg-info" },
  info: { label: "Info", cls: "text-fg-2 bg-[var(--neutral-soft)] border-[var(--neutral-border)]", dot: "bg-fg-3" },
};

export function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_CFG[(severity as Severity) in SEVERITY_CFG ? (severity as Severity) : "info"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Surfaces & stats                                                    */
/* ------------------------------------------------------------------ */

export function StatCard({ label, value, tone = "default", hint }: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "failure" | "warning";
  hint?: string;
}) {
  const valueCls = {
    default: "text-fg",
    success: "text-success",
    failure: "text-accent",
    warning: "text-warning",
  }[tone];
  return (
    <div className="cb-fade-up group relative overflow-hidden rounded-xl border border-line-subtle bg-surface px-5 py-4 transition-colors duration-200 hover:border-line-strong">
      <div className={`absolute inset-x-0 top-0 h-px ${tone === "failure" ? "bg-accent/40" : tone === "success" ? "bg-success/40" : tone === "warning" ? "bg-warning/40" : "bg-transparent"}`} />
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-3">{label}</div>
      <div className={`mt-1.5 text-3xl font-semibold tracking-tight tabular-nums ${valueCls}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-fg-3">{hint}</div> : null}
    </div>
  );
}

export function EmptyState({ title, body, cta }: {
  title: string;
  body: string;
  cta?: { href: string; label: string; external?: boolean };
}) {
  return (
    <div className="cb-fade-in flex flex-col items-center justify-center gap-1 px-6 py-16 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-line-subtle bg-raised text-fg-3">
        <IconShield className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <p className="max-w-sm text-sm text-fg-3">{body}</p>
      {cta ? (
        <a
          href={cta.href}
          {...(cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3.5 py-1.5 text-xs font-semibold text-fg-2 transition-colors duration-150 hover:border-accent-border hover:text-fg"
        >
          {cta.label}
          <IconArrowRight className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App shell — sidebar on desktop, top bar on mobile                   */
/* ------------------------------------------------------------------ */

const NAV = [
  { key: "prs", label: "Pull Requests", Icon: IconPullRequest },
  { key: "commits", label: "Commits", Icon: IconCommit },
  { key: "branches", label: "Branches", Icon: IconBranch },
] as const;

function Logo({ className = "h-8 w-8" }: IconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/codebadger-logo.jpg" alt="CodeBadger" className={`${className} rounded-lg object-cover ring-1 ring-line`} />
  );
}

export function AppShell({
  active,
  owner,
  repo,
  children,
}: {
  active: string;
  owner: string;
  repo: string;
  children: ReactNode;
}) {
  const navUrl = (t: string) => `/dashboard?tab=${t}`;
  return (
    <div className="min-h-screen bg-canvas text-fg">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line-subtle bg-canvas/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo className="h-7 w-7" />
        <span className="text-sm font-semibold tracking-tight">CodeBadger</span>
        <span className="ml-auto truncate rounded-md border border-line-subtle bg-raised px-2 py-1 font-mono text-[11px] text-fg-3" title={`${owner}/${repo}`}>
          {owner}/{repo}
        </span>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-line-subtle bg-canvas px-3 py-2 lg:hidden" aria-label="Primary">
        {NAV.map(({ key, label, Icon }) => (
          <Link
            key={key}
            href={navUrl(key)}
            aria-current={active === key ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
              active === key ? "bg-accent-soft text-fg" : "text-fg-3 hover:text-fg-2"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line-subtle bg-surface px-4 py-5 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2.5 rounded-lg px-1 py-1 transition-opacity duration-150 hover:opacity-90">
          <Logo />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">CodeBadger</div>
            <div className="text-[11px] text-fg-3">AI Review Dataplane</div>
          </div>
        </Link>

        <div className="mb-6 rounded-lg border border-line-subtle bg-raised px-3 py-2.5">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-fg-3">Repository</div>
          <div className="mt-0.5 truncate font-mono text-xs text-fg-2" title={`${owner}/${repo}`}>
            {owner}/{repo}
          </div>
        </div>

        <nav className="flex flex-col gap-0.5" aria-label="Primary">
          <div className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-fg-3">Review</div>
          {NAV.map(({ key, label, Icon }) => {
            const isActive = active === key;
            return (
              <Link
                key={key}
                href={navUrl(key)}
                aria-current={isActive ? "page" : undefined}
                className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-150 ${
                  isActive ? "bg-accent-soft text-fg" : "text-fg-2 hover:bg-raised hover:text-fg"
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full transition-opacity duration-150 ${
                    isActive ? "bg-accent opacity-100" : "opacity-0"
                  }`}
                />
                <Icon className={`h-4 w-4 ${isActive ? "text-accent" : "text-fg-3 group-hover:text-fg-2"}`} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center gap-2 border-t border-line-subtle px-2 pt-4 text-[11px] text-fg-3">
          <span className="cb-pulse-dot h-1.5 w-1.5 rounded-full bg-success" />
          Dataplane online
        </div>
      </aside>

      <main className="px-4 py-6 sm:px-6 lg:ml-60 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

/* Page header used at the top of main content */
export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-fg-3">{description}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}
