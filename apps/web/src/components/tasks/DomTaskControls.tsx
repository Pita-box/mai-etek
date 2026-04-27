'use client';

import { useState, useTransition } from 'react';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { deleteTask, updateTask } from '@/actions/tasks';
import { RecurrenceType, Task, TaskPriority } from '@/types/task';

type DomTaskControlsProps = {
  task: Task;
};

function toLocalInputValue(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function DomTaskControls({ task }: DomTaskControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = (formData: FormData) => {
    const deadline = formData.get('deadline');
    if (deadline) {
      formData.set('deadline', new Date(String(deadline)).toISOString());
    }

    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await updateTask(task.id, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess('Úkol byl uložen.');
    });
  };

  const cancel = () => {
    if (!window.confirm('Opravdu zrušit/smazat tento úkol?')) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess(result?.cancelled ? 'Úkol byl zrušen.' : 'Úkol byl smazán.');
    });
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <button
        id="task-dom-edit-toggle"
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between text-left font-bold text-white"
      >
        DOM správa
        <span className="text-xs text-zinc-500">{expanded ? 'Skrýt' : 'Upravit'}</span>
      </button>

      {expanded ? (
        <form action={save} className="mt-5 space-y-4">
          <label className="block text-sm text-zinc-400">
            Název
            <input name="title" defaultValue={task.title} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary" />
          </label>
          <label className="block text-sm text-zinc-400">
            Instrukce
            <textarea name="description" defaultValue={task.description || ''} className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-zinc-400">
              Priorita
              <select name="priority" defaultValue={task.priority} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary">
                {(['low', 'medium', 'high', 'urgent'] satisfies TaskPriority[]).map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </label>
            <label className="block text-sm text-zinc-400">
              XP
              <input name="points_reward" type="number" min="0" defaultValue={task.points_reward} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary" />
            </label>
            <label className="block text-sm text-zinc-400">
              Termín
              <input name="deadline" type="datetime-local" defaultValue={toLocalInputValue(task.deadline)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-primary" />
            </label>
            <label className="block text-sm text-zinc-400">
              Opakování
              <select name="recurrence" defaultValue={task.recurrence} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary">
                {(['none', 'daily', 'weekly', 'monthly'] satisfies RecurrenceType[]).map((recurrence) => <option key={recurrence} value={recurrence}>{recurrence}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button id="task-dom-save" disabled={isPending} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-black disabled:opacity-50">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Uložit
            </button>
            <button id="task-dom-cancel" type="button" disabled={isPending} onClick={cancel} className="flex items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 font-bold text-red-200 disabled:opacity-50">
              <Trash2 className="h-4 w-4" />
              Zrušit/smazat
            </button>
          </div>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
