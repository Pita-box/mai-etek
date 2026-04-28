'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus } from 'lucide-react';
import { Task } from '@/types/task';
import { TaskCard } from './TaskCard';
import { TaskDetailPopup } from './TaskDetailPopup';
import { useTasksRealtime } from './useTasksRealtime';

type TasksClientProps = {
  tasks: Task[];
  role: 'dom' | 'sub';
};

type DomFilter = 'active' | 'review' | 'rejected' | 'completed';

const domFilters: Array<{ key: DomFilter; label: string }> = [
  { key: 'active', label: 'Probíhající' },
  { key: 'review', label: 'Ke kontrole' },
  { key: 'rejected', label: 'Odmítnuté' },
  { key: 'completed', label: 'Dokončené' },
];

const subActiveStatuses = ['pending', 'in_progress', 'revision_requested', 'in_review'] as const;
const subCompletedStatuses = ['completed', 'approved'] as const;
const domActiveStatuses = ['in_progress'] as const;
const COMPLETED_TASK_SUB_VISIBILITY_MS = 24 * 60 * 60 * 1000;

function isCompletedTaskStillVisibleToSub(task: Task) {
  if (!subCompletedStatuses.includes(task.status as (typeof subCompletedStatuses)[number])) {
    return false;
  }

  if (!task.completed_at) {
    return true;
  }

  const completedAt = new Date(task.completed_at).getTime();

  if (Number.isNaN(completedAt)) {
    return true;
  }

  return Date.now() - completedAt < COMPLETED_TASK_SUB_VISIBILITY_MS;
}

function isSubVisibleTask(task: Task) {
  if (subActiveStatuses.includes(task.status as (typeof subActiveStatuses)[number])) {
    return true;
  }

  return isCompletedTaskStillVisibleToSub(task);
}

export function TasksClient({ tasks: initialTasks, role }: TasksClientProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<DomFilter>('active');
  const { tasks, isRealtimeSyncing, refreshTasks } = useTasksRealtime(initialTasks);

  const domGroups = useMemo(() => ({
    active: tasks.filter((task) => task.status === 'pending' || domActiveStatuses.includes(task.status as (typeof domActiveStatuses)[number])),
    review: tasks.filter((task) => ['submitted', 'in_review'].includes(task.status)),
    rejected: tasks.filter((task) => ['revision_requested', 'rejected'].includes(task.status)),
    completed: tasks.filter((task) => ['completed', 'approved'].includes(task.status)),
  }), [tasks]);

  const subTasks = useMemo(() => tasks.filter(isSubVisibleTask), [tasks]);
  const visibleTasks = role === 'dom' ? domGroups[activeFilter] : subTasks;
  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) || null : null;

  return (
    <div className="relative p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">DOM/SUB workflow</p>
          <h1 className="mt-2 text-4xl font-black text-white tracking-tight">Úkoly</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-gray-400">
            <p>Správa, kontrola a plnění povinností.</p>
          </div>
        </div>
        {role === 'dom' ? (
          <Link
            id="tasks-create-task-link"
            href="/tasks/new"
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-bold text-white shadow-[0_0_30px_rgba(var(--primary-rgb),0.25)] transition hover:bg-primary/90"
          >
            <Plus className="w-5 h-5" />
            Vytvořit úkol
          </Link>
        ) : null}
      </div>

      {role === 'dom' ? (
        <div className="flex flex-wrap gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-3">
          {domFilters.map((filter) => {
            const isActive = activeFilter === filter.key;
            return (
              <button
                id={`tasks-filter-${filter.key}`}
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary ${isActive ? 'bg-primary text-white' : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                  }`}
              >
                {filter.label} <span className="opacity-70">({domGroups[filter.key].length})</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <TaskSection
        title={role === 'dom' ? domFilters.find((filter) => filter.key === activeFilter)?.label || 'Úkoly' : `Moje úkoly (${visibleTasks.length})`}
        tone={activeFilter === 'completed' ? 'emerald' : activeFilter === 'review' ? 'purple' : activeFilter === 'rejected' ? 'red' : 'blue'}
        tasks={visibleTasks}
        role={role}
        onOpen={(task) => setSelectedTaskId(task.id)}
        empty={role === 'dom' ? 'V tomto filtru zatím nejsou žádné úkoly.' : 'Nemáš žádné aktivní úkoly. Užij si klid.'}
      />

      {selectedTask ? (
        <TaskDetailPopup
          key={selectedTask.id}
          task={selectedTask}
          role={role}
          onClose={() => setSelectedTaskId(null)}
          onTaskMutated={refreshTasks}
        />
      ) : null}

      {isRealtimeSyncing ? (
        <div
          className="fixed bottom-5 right-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/20 bg-black/70 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.18)] backdrop-blur-xl"
          aria-label="Probíhá živá synchronizace"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}

type TaskSectionProps = {
  title: string;
  tone: 'blue' | 'purple' | 'emerald' | 'red';
  tasks: Task[];
  role: 'dom' | 'sub';
  onOpen: (task: Task) => void;
  empty?: string;
};

function TaskSection({ title, tone, tasks, role, onOpen, empty }: TaskSectionProps) {
  const dotClass = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
  }[tone];

  return (
    <section>
      <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
        {title}
      </h2>
      {tasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => <TaskCard key={task.id} task={task} role={role} onOpen={onOpen} />)}
        </div>
      ) : empty ? (
        <div className="text-center py-12 bg-glass-panel border border-glass-border rounded-xl">
          <p className="text-gray-400">{empty}</p>
        </div>
      ) : null}
    </section>
  );
}
