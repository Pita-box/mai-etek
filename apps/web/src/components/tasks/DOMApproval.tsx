'use client';

import React, { useState } from 'react';
import { approveTask, rejectTask } from '@/actions/tasks';
import { Check, X, Star } from 'lucide-react';

export const DOMApproval = ({ taskId, onTaskMutated }: { taskId: string; onTaskMutated: () => Promise<void> }) => {
  const [rating, setRating] = useState(3);
  const [feedback, setFeedback] = useState('');
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
    } catch (e) {
      console.error(e);
      alert('Chyba při schvalování');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!feedback) {
      alert('Při zamítnutí je nutné zadat zpětnou vazbu (důvod).');
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('feedback', feedback);
      const result = await rejectTask(taskId, formData);
      if (result?.error) {
        throw new Error(result.error);
      }
      await onTaskMutated();
    } catch (e) {
      console.error(e);
      alert('Chyba při zamítání');
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

        <div className="flex gap-4 pt-4">
          <button
            onClick={handleApprove}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 font-semibold py-3 px-4 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
          >
            <Check className="w-5 h-5" /> Schválit úkol
          </button>
          <button
            onClick={handleReject}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 text-red-400 border border-red-500/50 font-semibold py-3 px-4 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" /> Odmítnout úkol
          </button>
        </div>
      </div>
    </div>
  );
};
