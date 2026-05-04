import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  description?: string;
  onRetry?: () => void;
  returnHref?: string;
  returnLabel?: string;
  title: string;
};

export function ErrorState({
  description,
  onRetry,
  returnHref = "/dashboard",
  returnLabel = "Zpět na dashboard",
  title,
}: ErrorStateProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-100">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-3xl font-black tracking-tight text-white">
        {title}
      </h1>
      {description ? (
        <p className="mt-3 text-sm leading-6 text-zinc-400">{description}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {onRetry ? (
          <Button
            type="button"
            onClick={onRetry}
            className="rounded-2xl bg-primary text-white hover:bg-primary/90"
          >
            <RotateCcw className="h-4 w-4" />
            Zkusit znovu
          </Button>
        ) : null}
        <Button
          asChild
          variant="outline"
          className="rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
        >
          <Link href={returnHref}>{returnLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

