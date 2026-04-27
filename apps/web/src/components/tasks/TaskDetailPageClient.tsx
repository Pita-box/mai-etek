'use client';

import { useRouter } from 'next/navigation';
import { Task } from '@/types/task';
import { TaskDetailContent } from './TaskDetailContent';

type TaskDetailPageClientProps = {
  task: Task;
  role: 'dom' | 'sub';
};

export function TaskDetailPageClient({ task, role }: TaskDetailPageClientProps) {
  const router = useRouter();

  const refreshPage = async () => {
    router.refresh();
  };

  return <TaskDetailContent task={task} role={role} layout="page" onTaskMutated={refreshPage} />;
}
