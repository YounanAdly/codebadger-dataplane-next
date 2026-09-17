// src/app/dashboard/access-denied/page.tsx
// Rendered (via proxy rewrite) when a /dashboard request arrives without a
// valid signed link or session cookie.
import { AccessDeniedView } from "@/components/access-denied";

// CRITICAL: this page must never be cached at the edge. It is normally served
// through a proxy *rewrite* of /dashboard, so a prerendered/static variant
// gets cached under that URL — once that happens every future /dashboard hit
// (including valid signed-link entries) is answered by the cached 401 and the
// dashboard becomes permanently inaccessible until a redeploy. Dynamic
// rendering + no-store keeps the rewrite per-request.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardAccessDeniedPage() {
  return <AccessDeniedView />;
}
