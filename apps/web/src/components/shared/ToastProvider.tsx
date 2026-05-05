"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toastMotion } from "@/lib/motion";
import {
  dismissToast,
  type ToastItem,
  type ToastType,
  useToastStore,
} from "@/components/shared/useToast";

const toastIcons: Record<ToastType, typeof CheckCircle2> = {
  error: AlertCircle,
  info: Info,
  success: CheckCircle2,
};

const toastClasses: Record<ToastType, string> = {
  error: "border-rose-400/35 bg-rose-950/45 text-rose-50 shadow-[0_0_30px_rgba(244,63,94,0.16)]",
  info: "border-white/10 bg-black/90 text-white shadow-[0_0_30px_rgba(191,23,65,0.14)]",
  success: "border-primary/30 bg-black/90 text-white shadow-[0_0_30px_rgba(191,23,65,0.18)]",
};

const iconClasses: Record<ToastType, string> = {
  error: "text-rose-200",
  info: "text-primary",
  success: "text-primary",
};

type ToastProviderProps = {
  children: React.ReactNode;
};

type ToastCardProps = {
  toast: ToastItem;
};

function ToastCard({ toast }: ToastCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = toastIcons[toast.type];

  useEffect(() => {
    if (toast.duration <= 0) return;

    const timeout = window.setTimeout(() => {
      dismissToast(toast.id);
    }, toast.duration);

    return () => window.clearTimeout(timeout);
  }, [toast.duration, toast.id]);

  const motionProps = prefersReducedMotion
    ? {
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        initial: { opacity: 0 },
        transition: { duration: 0.12 },
      }
    : toastMotion;

  return (
    <motion.li
      layout
      {...motionProps}
      role={toast.type === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto grid w-full grid-cols-[auto_1fr_auto] gap-3 rounded-2xl border px-4 py-3 backdrop-blur-xl",
        toastClasses[toast.type],
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4", iconClasses[toast.type])} />

      <div className="min-w-0">
        <p className="text-sm font-semibold leading-5 text-white">
          {toast.title}
        </p>
        {toast.description ? (
          <p className="mt-1 break-words text-xs leading-5 text-zinc-300">
            {toast.description}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        aria-label="Zavřít oznámení"
        onClick={() => dismissToast(toast.id)}
        className="rounded-full p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.li>
  );
}

export function ToastProvider({ children }: ToastProviderProps) {
  const toasts = useToastStore();

  return (
    <>
      {children}
      <ol
        aria-live="polite"
        aria-relevant="additions removals"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[100] mx-auto flex w-[min(420px,calc(100vw-32px))] flex-col gap-3"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} />
          ))}
        </AnimatePresence>
      </ol>
    </>
  );
}
