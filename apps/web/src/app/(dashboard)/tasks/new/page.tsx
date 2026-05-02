'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTask } from '@/actions/tasks';
import { TaskPriority, RecurrenceType } from '@/types/task';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewTaskPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [points, setPoints] = useState(0);
  const [deadline, setDeadline] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [expiryPenaltyPoints, setExpiryPenaltyPoints] = useState(0);
  const [expiryPenaltyReason, setExpiryPenaltyReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (recurrence !== 'none' && !deadline) {
        throw new Error('Opakovaný úkol potřebuje termín splnění.');
      }

      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('priority', priority);
      formData.append('points_reward', points.toString());
      if (deadline) formData.append('deadline', new Date(deadline).toISOString());
      formData.append('recurrence', recurrence);
      formData.append('expiry_penalty_points', expiryPenaltyPoints.toString());
      formData.append('expiry_penalty_reason', expiryPenaltyReason);
      
      const result = await createTask(formData);
      if (result && result.error) {
        throw new Error(result.error);
      }
      
      // router.push and refresh are handled in createTask redirect, but just in case it doesn't redirect due to error:
      if (!result?.error) {
         router.push('/tasks');
         router.refresh();
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Nepodařilo se vytvořit úkol. Ujistěte se, že ID suba je platné.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/tasks" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Zpět na úkoly
      </Link>

      <div className="bg-glass-panel border border-glass-border rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Nový úkol</h1>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Název úkolu *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-black/40 border border-glass-border rounded-lg p-3 text-white focus:outline-none focus:border-primary/50"
              placeholder="Např. Každodenní cvičení"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Popis (Instrukce)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-black/40 border border-glass-border rounded-lg p-3 text-white focus:outline-none focus:border-primary/50 min-h-[120px]"
              placeholder="Detailní instrukce, co přesně má udělat..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Priorita</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full bg-black/40 border border-glass-border rounded-lg p-3 text-white focus:outline-none focus:border-primary/50 appearance-none"
              >
                <option value="low">Nízká</option>
                <option value="medium">Střední</option>
                <option value="high">Vysoká</option>
                <option value="urgent">Urgentní</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Odměna (Body)</label>
              <input
                type="number"
                min="0"
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                className="w-full bg-black/40 border border-glass-border rounded-lg p-3 text-white focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Termín splnění</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-black/40 border border-glass-border rounded-lg p-3 text-white focus:outline-none focus:border-primary/50 [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Opakování</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                className="w-full bg-black/40 border border-glass-border rounded-lg p-3 text-white focus:outline-none focus:border-primary/50 appearance-none"
              >
                <option value="none">Bez opakování</option>
                <option value="daily">Denně</option>
                <option value="weekly">Týdně</option>
                <option value="monthly">Měsíčně</option>
              </select>
              {recurrence !== 'none' ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Opakované instance se generují podle dne a času termínu.
                </p>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Penalizace při prošlém termínu</label>
              <input
                type="number"
                min="0"
                value={expiryPenaltyPoints}
                onChange={(e) => setExpiryPenaltyPoints(parseInt(e.target.value) || 0)}
                className="w-full bg-black/40 border border-glass-border rounded-lg p-3 text-white focus:outline-none focus:border-primary/50"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Důvod penalizace</label>
              <input
                type="text"
                value={expiryPenaltyReason}
                onChange={(e) => setExpiryPenaltyReason(e.target.value)}
                className="w-full bg-black/40 border border-glass-border rounded-lg p-3 text-white focus:outline-none focus:border-primary/50"
                placeholder="Volitelné, např. Nedodržení termínu"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-glass-border flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-primary text-white font-semibold py-3 px-6 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Uložit a zadat úkol
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
