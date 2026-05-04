import { Skeleton } from "@/components/ui/skeleton";

export function AuthPageSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-black/30 p-8">
        <Skeleton className="h-3 w-24 bg-primary/20" />
        <Skeleton className="mt-4 h-9 w-56 bg-white/10" />
        <Skeleton className="mt-3 h-4 w-full bg-white/10" />
        <div className="mt-8 space-y-4">
          <Skeleton className="h-11 w-full rounded-2xl bg-white/10" />
          <Skeleton className="h-11 w-full rounded-2xl bg-white/10" />
          <Skeleton className="h-11 w-full rounded-2xl bg-primary/20" />
        </div>
      </section>
    </main>
  );
}

