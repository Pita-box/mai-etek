import { Skeleton } from "@/components/ui/skeleton";

function MetricSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <Skeleton className="h-7 w-20 bg-white/10" />
      <Skeleton className="mt-3 h-3 w-28 bg-white/10" />
    </div>
  );
}

function ContentCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
      <Skeleton className="h-5 w-36 bg-white/10" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
          >
            <Skeleton className="h-4 w-3/5 bg-white/10" />
            <Skeleton className="mt-3 h-3 w-full bg-white/10" />
            <Skeleton className="mt-2 h-3 w-4/5 bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-3 w-20 bg-primary/20" />
          <Skeleton className="h-9 w-56 bg-white/10" />
          <Skeleton className="h-4 w-full max-w-xl bg-white/10" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricSkeleton />
          <MetricSkeleton />
          <MetricSkeleton />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ContentCardSkeleton rows={4} />
        <ContentCardSkeleton rows={4} />
      </div>

      <ContentCardSkeleton rows={5} />
    </div>
  );
}

export function DashboardShellSkeleton() {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background md:h-screen md:flex-row">
      <aside className="hidden w-72 shrink-0 border-r border-border bg-black/30 p-5 md:block">
        <Skeleton className="h-9 w-32 bg-white/10" />
        <div className="mt-8 space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-11 rounded-lg bg-white/10" />
          ))}
        </div>
      </aside>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="hidden items-center justify-between border-b border-border bg-black/25 px-8 py-5 md:flex">
          <Skeleton className="h-8 w-44 bg-white/10" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-24 rounded-full bg-white/10" />
            <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
          </div>
        </div>
        <div className="border-b border-border bg-black/25 p-4 md:hidden">
          <Skeleton className="h-9 w-full bg-white/10" />
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <DashboardPageSkeleton />
        </main>
      </div>
    </div>
  );
}

