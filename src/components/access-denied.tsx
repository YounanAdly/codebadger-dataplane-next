// src/components/access-denied.tsx
// Shared "no access" view used by the access-denied route and as the
// server-render fallback inside the dashboard pages themselves.

import Link from "next/link";
import { IconArrowLeft } from "@/components/ui";

export function AccessDeniedView() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-fg">
      <div className="cb-fade-up max-w-md rounded-xl border border-line bg-surface p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-raised text-xl">
          🔒
        </div>
        <h1 className="mb-2 text-lg font-semibold text-fg">Access required</h1>
        <p className="text-sm text-fg-3">
          This dashboard is private. Open it from your project page on the
          CodeBadger platform — the link is generated for signed-in members of
          the project&apos;s company and expires shortly after.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-1.5 text-sm text-fg-2 underline-offset-4 transition-colors hover:text-fg hover:underline"
        >
          <IconArrowLeft className="h-3.5 w-3.5" />
          Back to dataplane home
        </Link>
      </div>
    </div>
  );
}
