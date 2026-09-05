// src/app/dashboard/access-denied/page.tsx
// Rendered (via proxy rewrite) when a /dashboard request arrives without a
// valid signed link or session cookie.
import { AccessDeniedView } from "@/components/access-denied";

export default function DashboardAccessDeniedPage() {
  return <AccessDeniedView />;
}
