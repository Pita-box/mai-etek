"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fadeInUp } from "@/lib/motion";

type EmptyStateVariant = "default" | "compact" | "danger" | "success";

type EmptyStateProps = {
  actionHref?: string;
  actionLabel?: string;
  className?: string;
  description?: string;
  icon?: LucideIcon;
  onAction?: () => void;
  secondaryActionHref?: string;
  secondaryActionLabel?: string;
  title: string;
  variant?: EmptyStateVariant;
};

const variantClasses: Record<EmptyStateVariant, string> = {
  compact: "p-4",
  danger: "border-rose-400/20 bg-rose-500/10",
  default: "p-6",
  success: "border-primary/25 bg-primary/10",
};

const iconClasses: Record<EmptyStateVariant, string> = {
  compact: "border-white/10 bg-white/[0.04] text-primary",
  danger: "border-rose-400/25 bg-rose-500/10 text-rose-100",
  default: "border-white/10 bg-white/[0.04] text-primary",
  success: "border-primary/25 bg-primary/10 text-primary",
};

export function EmptyState({
  actionHref,
  actionLabel,
  className,
  description,
  icon: Icon = Inbox,
  onAction,
  secondaryActionHref,
  secondaryActionLabel,
  title,
  variant = "default",
}: EmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const isCompact = variant === "compact";
  const primaryActionLabel = actionLabel?.trim();
  const secondaryAction =
    secondaryActionHref && secondaryActionLabel?.trim()
      ? {
          href: secondaryActionHref,
          label: secondaryActionLabel.trim(),
        }
      : null;
  const hasPrimaryAction = Boolean(
    primaryActionLabel && (actionHref || onAction),
  );

  return (
    <motion.div
      initial={prefersReducedMotion ? false : "hidden"}
      animate="visible"
      variants={fadeInUp}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.025] text-center",
        variantClasses[variant],
        isCompact ? "min-h-36" : "min-h-56",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl border",
          isCompact ? "h-10 w-10" : "h-12 w-12",
          iconClasses[variant],
        )}
      >
        <Icon className={isCompact ? "h-5 w-5" : "h-6 w-6"} />
      </div>

      <h3
        className={cn(
          "mt-4 font-semibold text-white",
          isCompact ? "text-base" : "text-lg",
        )}
      >
        {title}
      </h3>

      {description ? (
        <p
          className={cn(
            "mt-2 max-w-md leading-6 text-zinc-400",
            isCompact ? "text-xs" : "text-sm",
          )}
        >
          {description}
        </p>
      ) : null}

      {hasPrimaryAction || secondaryAction ? (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {hasPrimaryAction && actionHref ? (
            <Button
              asChild
              className="rounded-2xl bg-primary font-semibold text-white hover:bg-primary/90"
            >
              <Link href={actionHref}>{primaryActionLabel}</Link>
            </Button>
          ) : null}

          {hasPrimaryAction && !actionHref ? (
            <Button
              type="button"
              onClick={onAction}
              className="rounded-2xl bg-primary font-semibold text-white hover:bg-primary/90"
            >
              {primaryActionLabel}
            </Button>
          ) : null}

          {secondaryAction ? (
            <Button
              asChild
              variant="outline"
              className="rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
            >
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}
