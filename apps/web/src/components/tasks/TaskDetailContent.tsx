'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, Award, Calendar, Clock, Eye, Layers3, Loader2, Repeat2, Send, ShieldAlert, Timer as TimerIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { submitTask } from '@/actions/tasks';
import { useToast } from '@/components/shared/useToast';
import { Task } from '@/types/task';
import { PriorityBadge, TaskStatusBadge } from './Badges';
import { EvidenceTab, TaskEvidenceTabs } from './TaskEvidenceTabs';
import { DomTaskControls } from './DomTaskControls';
import { DOMApproval } from './DOMApproval';

type TaskDetailContentProps = {
  task: Task;
  role: 'dom' | 'sub';
  titleId?: string;
  layout?: 'popup' | 'page';
  onTaskMutated: () => Promise<void>;
};

export function TaskDetailContent({ task, role, titleId, layout = 'popup', onTaskMutated }: TaskDetailContentProps) {
  const toast = useToast();
  const deadlineDate = task.deadline ? new Date(task.deadline) : null;
  const [activeEvidenceTab, setActiveEvidenceTab] = useState<EvidenceTab>('text');
  const [isSubmitting, startTransition] = useTransition();
  const isPage = layout === 'page';
  const isRecurringTemplate = task.recurrence !== 'none' && !task.parent_task_id;
  const isRecurringInstance = Boolean(task.parent_task_id);
  const expiryPenaltyPoints = task.expiry_penalty_points || 0;
  const canSubmitTask = role === 'sub' && !isRecurringTemplate && !['submitted', 'in_review', 'completed', 'approved', 'rejected', 'expired', 'cancelled'].includes(task.status);
  const showDomApproval = role === 'dom' && ['submitted', 'in_review'].includes(task.status);

  const handleSubmitTask = () => {
    startTransition(async () => {
      const result = await submitTask(task.id, {});
      if (result?.error) {
        console.error('Task submit failed:', result.error);
        toast.error('Úkol se nepodařilo odevzdat.', result.error);
        return;
      }
      await onTaskMutated();
      toast.success('Úkol byl odevzdán ke kontrole.');
    });
  };

  return (
    <div className={isPage ? 'space-y-6' : 'flex h-full flex-col overflow-hidden'}>
      <header className={isPage ? 'rounded-[2rem] border border-white/10 bg-black/45 p-6 shadow-2xl backdrop-blur-xl md:p-8' : 'border-b border-white/10 p-6 md:p-8'}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <TaskStatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              {task.public_task_id ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
                  ID {task.public_task_id}
                </span>
              ) : null}
              {isRecurringTemplate ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/25 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-200">
                  <Repeat2 className="h-3.5 w-3.5" />
                  Opakovaný
                </span>
              ) : null}
              {isRecurringInstance ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
                  <Layers3 className="h-3.5 w-3.5" />
                  Instance
                </span>
              ) : null}
            </div>

          </div>


        </div>
      </header>

      <div className={isPage ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]' : 'grid flex-1 overflow-y-auto p-6 md:grid-cols-[1fr_20rem] md:gap-6 md:p-8'}>
        <main className="space-y-6">
          <h1 id={titleId} className="text-3xl font-black tracking-tight first-letter:uppercase text-white md:text-5xl">
            {task.title}
          </h1>
          <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-lg font-bold text-white">Instrukce</h2>
            <p className="mt-4 whitespace-pre-wrap text-zinc-300">
              {task.description || 'Bez bližších instrukcí.'}
            </p>
          </article>

          <TaskEvidenceTabs
            task={task}
            role={role}
            activeTab={activeEvidenceTab}
            onActiveTabChange={setActiveEvidenceTab}
            onTaskMutated={onTaskMutated}
          />

          {role === 'sub' && task.status === 'in_review' ? (
            <div className="rounded-3xl border border-blue-400/30 bg-blue-500/10 p-6 text-blue-200">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6" />
                <div>
                  <h3 className="font-bold">Čeká na schválení</h3>
                  <p className="text-sm text-blue-200/80">DOM kontroluje tvoje odevzdání.</p>
                </div>
              </div>
            </div>
          ) : null}
        </main>

        <aside className="mt-6 space-y-4 xl:mt-0">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">Parametry</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-zinc-400"><Award className="h-4 w-4" /> XP</dt>
                <dd className="font-bold text-emerald-300">+{task.points_reward || 0}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-zinc-400"><Calendar className="h-4 w-4" /> Termín</dt>
                <dd className="text-right text-white">
                  {deadlineDate ? format(deadlineDate, 'PPp', { locale: cs }) : 'Bez termínu'}
                </dd>
              </div>
              {expiryPenaltyPoints > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-zinc-400"><ShieldAlert className="h-4 w-4" /> Penalizace</dt>
                  <dd className="text-right font-bold text-orange-300">+{expiryPenaltyPoints} dluh</dd>
                </div>
              ) : null}
              {task.recurrence !== 'none' ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-zinc-400"><Repeat2 className="h-4 w-4" /> Opakování</dt>
                  <dd className="text-right text-white">{task.recurrence}</dd>
                </div>
              ) : null}
              {task.recurrence_instance_date ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-zinc-400"><Layers3 className="h-4 w-4" /> Instance</dt>
                  <dd className="text-right text-white">
                    {format(new Date(task.recurrence_instance_date), 'PP', { locale: cs })}
                  </dd>
                </div>
              ) : null}
              {task.expired_at ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-zinc-400"><AlertCircle className="h-4 w-4" /> Vypršelo</dt>
                  <dd className="text-right text-white">
                    {format(new Date(task.expired_at), 'PPp', { locale: cs })}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-zinc-400">
                  <TimerIcon className="h-4 w-4" />
                  Vytvořeno
                </dt>
                <dd className="text-right text-white">
                  {new Date(task.created_at).toLocaleDateString('cs-CZ')}
                </dd>
              </div>
              {role === 'dom' && task.last_viewed_at ? (
                <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <dt className="flex items-center gap-2 text-zinc-400">
                    <Eye className="h-4 w-4" />
                    Naposledy zobrazeno
                  </dt>
                  <dd className="text-right text-white">
                    {format(new Date(task.last_viewed_at), 'dd.MM.yyyy (HH:mm)', { locale: cs })}{' '}<br />
                    <span className="text-zinc-400">({task.view_count || 1}x celkem)</span>
                  </dd>
                </div>
              ) : null}

            </dl>
          </div>

          {role === 'sub' ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <button
                id={isPage ? 'task-page-final-submit' : 'task-final-submit'}
                type="button"
                onClick={handleSubmitTask}
                disabled={isSubmitting || !canSubmitTask}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Odevzdat úkol pro kontrolu
              </button>
              {!canSubmitTask ? (
                <div className="mt-4 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
                  Tento úkol už byl odeslán ke kontrole nebo dokončen.
                </div>
              ) : null}
            </div>
          ) : null}

          {showDomApproval ? <DOMApproval taskId={task.id} onTaskMutated={onTaskMutated} /> : null}

          {role === 'dom' ? <DomTaskControls task={task} onTaskMutated={onTaskMutated} /> : null}

          {task.dom_feedback ? (
            <div className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-5">
              <h2 className="font-bold text-amber-200">Zpětná vazba DOM</h2>
              <p className="mt-3 text-sm italic text-amber-50/90">“{task.dom_feedback}”</p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
