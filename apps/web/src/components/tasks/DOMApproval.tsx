'use client';

import React, { useState } from 'react';
import { approveTask, rejectTask } from '@/actions/tasks';
import { useToast } from '@/components/shared/useToast';
import { Check, X, Star, ShieldAlert } from 'lucide-react';

export const DOMApproval = ({ taskId, onTaskMutated }: { taskId: string; onTaskMutated: () => Promise<void> }) => {
  const toast = useToast();
  const [rating, setRating] = useState(3);
  const [feedback, setFeedback] = useState('');
  const [penaltyEnabled, setPenaltyEnabled] = useState(false);
  const [penaltyPoints, setPenaltyPoints] = useState('');
  const [penaltyReason, setPenaltyReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('rating', rating.toString());
      formData.append('feedback', feedback);
      const result = await approveTask(taskId, formData);
      if (result?.error) {
        throw new Error(result.error);
      }
      await onTaskMutated();
      toast.success('Úkol byl schválen.');
    } catch (e) {
      console.error(e);
      toast.error(
        'Úkol se nepodařilo schválit.',
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!feedback) {
      toast.error('Doplň zpětnou vazbu.', 'Při zamítnutí je nutné zadat důvod.');
      return;
    }

    const parsedPenalty = parseInt(penaltyPoints, 10);
    if (penaltyEnabled && (!Number.isFinite(parsedPenalty) || parsedPenalty <= 0)) {
      toast.error('Penalizace není platná.', 'Body kázeňské penalizace musí být kladné číslo.');
      return;
    }

    if (penaltyEnabled && parsedPenalty > 100 && !window.confirm(`Opravdu přidat ${parsedPenalty} bodů kázeňského dluhu?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('feedback', feedback);
      if (penaltyEnabled) {
        formData.append('discipline_points', parsedPenalty.toString());
        formData.append('discipline_reason', penaltyReason.trim() || feedback);
      }
      const result = await rejectTask(taskId, formData);
      if (result?.error) {
        throw new Error(result.error);
      }
      await onTaskMutated();
      toast.success('Úkol byl odmítnut.');
    } catch (e) {
      console.error(e);
      toast.error(
        'Úkol se nepodařilo odmítnout.',
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-glass-panel border border-glass-border rounded-xl p-6 mt-6">
      <h3 className="text-xl font-medium text-white mb-4">Hodnocení úkolu</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Tvé hodnocení (Hvězdičky)</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                aria-label={`Nastavit hodnocení ${star} z 5`}
                onClick={() => setRating(star)}
                className={`p-1 transition-colors ${rating >= star ? 'text-yellow-400' : 'text-gray-600'}`}
              >
                <Star className="w-8 h-8" fill={rating >= star ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Zpětná vazba pro suba</label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="w-full bg-black/40 border border-glass-border rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 min-h-[100px]"
            placeholder="Napiš mu, co si o jeho výkonu myslíš..."
            disabled={isSubmitting}
          />
        </div>

        <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-rose-100">
            <input
              type="checkbox"
              checked={penaltyEnabled}
              onChange={(event) => setPenaltyEnabled(event.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 accent-primary"
            />
            <ShieldAlert className="h-4 w-4" />
            Přidat kázeňskou penalizaci při odmítnutí
          </label>

          {penaltyEnabled ? (
            <div className="mt-4 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
              <label className="block text-sm font-medium text-rose-100">
                Body dluhu
                <input
                  value={penaltyPoints}
                  onChange={(event) => setPenaltyPoints(event.target.value)}
                  type="number"
                  min={1}
                  disabled={isSubmitting}
                  className="mt-2 w-full rounded-lg border border-rose-300/20 bg-black/40 p-3 text-white focus:border-rose-200/50 focus:outline-none disabled:opacity-50"
                />
              </label>
              <label className="block text-sm font-medium text-rose-100">
                Důvod penalizace
                <textarea
                  value={penaltyReason}
                  onChange={(event) => setPenaltyReason(event.target.value)}
                  disabled={isSubmitting}
                  className="mt-2 min-h-[82px] w-full rounded-lg border border-rose-300/20 bg-black/40 p-3 text-white placeholder-rose-100/30 focus:border-rose-200/50 focus:outline-none disabled:opacity-50"
                  placeholder="Když necháš prázdné, použije se zpětná vazba k odmítnutí."
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isSubmitting}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-4 py-3 font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="w-5 h-5" /> Schválit úkol
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={isSubmitting}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-red-500/20 px-4 py-3 font-semibold text-red-400 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="w-5 h-5" /> Odmítnout úkol
          </button>
        </div>
      </div>
    </div>
  );
};
