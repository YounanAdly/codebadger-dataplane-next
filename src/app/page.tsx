import Image from "next/image";
import { IconExternal, IconPullRequest } from "@/components/ui";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-canvas font-sans text-fg">
      <main className="flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center mx-auto">
        <div className="cb-fade-up relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_16px_48px_-16px_rgba(0,0,0,0.8)]">
          <Image
            src="/codebadger-logo.jpg"
            alt="CodeBadger Logo"
            width={112}
            height={112}
            className="object-cover"
            priority
          />
        </div>

        <div className="cb-fade-up flex flex-col items-center gap-3" style={{ animationDelay: "60ms" }}>
          <h1 className="text-4xl font-semibold tracking-tight text-fg">
            CodeBadger
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-fg-3">
            Automated, high-precision AI code reviews for GitHub and Azure DevOps pull requests.
          </p>
          <a
            href="/dashboard"
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-accent-hover"
          >
            <IconPullRequest className="h-4 w-4" />
            Open dashboard
          </a>
        </div>

        <div className="cb-fade-up w-full rounded-xl border border-line-subtle bg-surface p-6 text-left" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-success">
              <span className="cb-pulse-dot h-2 w-2 rounded-full bg-success" />
              Dataplane Online
            </span>
            <span className="font-mono text-xs text-fg-3">Next.js Data Plane</span>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between border-t border-line-subtle pt-3">
              <span className="text-fg-2">GitHub Webhook</span>
              <code className="rounded-md border border-line-subtle bg-raised px-2 py-0.5 font-mono text-xs text-fg-2">/api/webhook</code>
            </div>
            <div className="flex items-center justify-between border-t border-line-subtle pt-3">
              <span className="text-fg-2">Azure DevOps Webhook</span>
              <code className="rounded-md border border-line-subtle bg-raised px-2 py-0.5 font-mono text-xs text-fg-2">/api/azure-webhook</code>
            </div>
          </div>
        </div>

        <p className="cb-fade-in text-xs text-fg-3" style={{ animationDelay: "200ms" }}>
          Powered by CodeBadger AI Review Engine
        </p>
      </main>
    </div>
  );
}
