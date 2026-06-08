import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-dvh bg-[var(--background)] px-4 pb-8">
      <header className="pt-10 pb-6 max-w-md mx-auto">
        <div className="h-5 w-24 bg-[var(--border)] rounded animate-pulse mb-2" />
        <div className="h-4 w-40 bg-[var(--border)] rounded animate-pulse opacity-60" />
      </header>
      <div className="max-w-md mx-auto space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-[var(--surface)] rounded-2xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}
