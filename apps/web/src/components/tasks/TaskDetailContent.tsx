'use client';

import { useState, useTransition } from 'react';
import { Award, Calendar, Clock, Loader2, Send } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { submitTask } from '@/actions/tasks';
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
  const deadlineDate = task.deadline ? new Date(task.deadline) : null;
  const [activeEvidenceTab, setActiveEvidenceTab] = useState<EvidenceTab>('text');
  const [isSubmitting, startTransition] = useTransition();
  const canSubmitTask = role === 'sub' && !['submitted', 'in_review', 'completed'].includes(task.status);
  const showDomApproval = role === 'dom' && ['submitted', 'in_review'].includes(task.status);
  const isPage = layout === 'page';

  const handleSubmitTask = () => {
    startTransition(async () => {
      const result = await submitTask(task.id, {});
      if (result?.error) {
        console.error('Task submit failed:', result.error);
        return;
      }
      await onTaskMutated();
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
            </div>
            <div>
              <h1 id={titleId} className="text-3xl font-black tracking-tight text-white md:text-5xl">
                {task.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                Full-screen přehled úkolu, instrukcí, stavu a odevzdání.
              </p>
            </div>
          </div>


        </div>
      </header>

      <div className={isPage ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]' : 'grid flex-1 overflow-y-auto p-6 md:grid-cols-[1fr_20rem] md:gap-6 md:p-8'}>
        <main className="space-y-6">
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

          {role === 'dom' ? <DomTaskControls task={task} /> : null}

          {role === 'dom' && task.last_viewed_at ? (
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-5">
              <h2 className="font-bold text-cyan-200">SUB zobrazení</h2>
              <p className="mt-3 text-sm text-cyan-50/90">
                Naposledy zobrazeno {format(new Date(task.last_viewed_at), 'PPp', { locale: cs })} ({task.view_count || 1}×)
              </p>
            </div>
          ) : null}

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
