'use client';

import { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { Task } from '@/types/task';
import { useTaskViewTracking } from './useTaskViewTracking';
import { TaskDetailContent } from './TaskDetailContent';

type TaskDetailPopupProps = {
  task: Task;
  role: 'dom' | 'sub';
  onClose: () => void;
  onTaskMutated: () => Promise<void>;
};

export function TaskDetailPopup({ task, role, onClose, onTaskMutated }: TaskDetailPopupProps) {
  const titleId = useId();

  useTaskViewTracking({ taskId: task.id, enabled: role === 'sub' });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-x-4 bottom-4 top-24 z-50 overflow-hidden rounded-[2rem] border border-white/10 bg-black/90 shadow-[0_30px_120px_rgba(0,0,0,0.65)] backdrop-blur-2xl md:left-[18rem] md:right-8"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.24),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_34%)]" />
      <div className="relative h-full overflow-hidden">
        <button
          id="task-detail-popup-close"
          type="button"
          onClick={onClose}
          aria-label="Zavřít detail úkolu"
          className="absolute right-6 top-6 z-10 cursor-pointer rounded-full border border-white/10 bg-white/10 p-3 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <X className="h-5 w-5" />
        </button>
        <TaskDetailContent task={task} role={role} titleId={titleId} layout="popup" onTaskMutated={onTaskMutated} />
      </div>
    </section>
  );
}
