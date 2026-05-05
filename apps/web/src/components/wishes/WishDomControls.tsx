"use client";

import { FormEvent, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { setWishStatus, upsertWishDomNote } from "@/actions/wishes";
import { useToast } from "@/components/shared/useToast";
import type { Wish, WishStatus } from "@/types/wish";

type WishDomControlsProps = {
  wish: Wish;
};

const statusOptions: Array<{
  value: Exclude<WishStatus, "new">;
  label: string;
}> = [
  { value: "noted", label: "Vzato na vědomí" },
  { value: "planned", label: "Naplánováno" },
  { value: "fulfilled", label: "Splněno" },
  { value: "declined", label: "Zamítnuto" },
];

type EditableWishStatus = Exclude<WishStatus, "new">;
type StatusSelectValue = EditableWishStatus | "";

function getInitialStatusValue(status: WishStatus): StatusSelectValue {
  return status === "new" ? "" : status;
}

export function WishDomControls({ wish }: WishDomControlsProps) {
  const router = useRouter();
  const toast = useToast();
  const [selectedStatus, setSelectedStatus] = useState<StatusSelectValue>(
    getInitialStatusValue(wish.status),
  );
  const [statusError, setStatusError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSuccess, setNoteSuccess] = useState(false);
  const [isStatusPending, startStatusTransition] = useTransition();
  const [isNotePending, startNoteTransition] = useTransition();
  const hasStatusChange = Boolean(
    selectedStatus && selectedStatus !== wish.status,
  );

  const saveStatus = () => {
    if (!selectedStatus || !hasStatusChange) return;
    setStatusError(null);
    setNoteSuccess(false);
    startStatusTransition(async () => {
      const result = await setWishStatus(wish.id, selectedStatus);
      if (result?.error) {
        setStatusError(result.error);
        toast.error("Stav přání se nepodařilo uložit.", result.error);
        return;
      }
      toast.success("Stav přání byl uložen.");
      router.refresh();
    });
  };

  const saveNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNoteError(null);
    setNoteSuccess(false);
    const formData = new FormData(event.currentTarget);

    startNoteTransition(async () => {
      const result = await upsertWishDomNote(wish.id, formData);
      if (result?.error) {
        setNoteError(result.error);
        toast.error("Poznámku se nepodařilo uložit.", result.error);
        return;
      }
      setNoteSuccess(true);
      toast.success("Poznámka byla uložena.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 border-t border-white/10 pt-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label>
          <span className="mb-2 block text-sm font-medium text-zinc-300">
            Stav
          </span>
          <select
            value={selectedStatus}
            onChange={(event) => {
              setSelectedStatus(event.target.value as StatusSelectValue);
              setStatusError(null);
            }}
            disabled={isStatusPending}
            className="w-full cursor-pointer rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-primary/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {wish.status === "new" ? (
              <option value="" disabled className="bg-zinc-950">
                Nové
              </option>
            ) : null}
            {statusOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-zinc-950"
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={saveStatus}
          disabled={!hasStatusChange || isStatusPending}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/15 px-4 py-3 text-sm font-bold text-primary transition hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isStatusPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : hasStatusChange ? (
            <Save className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Uložit stav
        </button>
      </div>

      {statusError ? (
        <p className="text-sm text-rose-300">{statusError}</p>
      ) : null}

      <form onSubmit={saveNote} className="space-y-3">
        <label>
          <span className="mb-2 block text-sm font-medium text-zinc-300">
            Soukromá poznámka
          </span>
          <textarea
            name="note"
            defaultValue={wish.dom_note || ""}
            maxLength={5000}
            rows={4}
            disabled={isNotePending}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-primary/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Poznámka viditelná jen pro DOM"
          />
        </label>
        <button
          type="submit"
          disabled={isNotePending}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/15 px-4 py-3 text-sm font-bold text-primary transition hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {isNotePending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Uložit poznámku
        </button>
      </form>

      {noteError ? <p className="text-sm text-rose-300">{noteError}</p> : null}
      {noteSuccess ? (
        <p className="text-sm text-emerald-300">Poznámka uložena.</p>
      ) : null}
    </div>
  );
}
