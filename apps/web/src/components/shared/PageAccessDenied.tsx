"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";

type PageAccessDeniedProps = {
  returnHref?: string;
};

export function PageAccessDenied({
  returnHref = "/dashboard",
}: PageAccessDeniedProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.045] p-8 text-center backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-100">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-white">
          K této stránce nemáš přístup.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Přístup k této části aplikace musí nejdřív povolit DOM.
        </p>
        <Link
          href={returnHref}
          className="mt-6 inline-flex cursor-pointer items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60"
        >
          Zpět na povolenou stránku
        </Link>
      </section>
    </div>
  );
}
