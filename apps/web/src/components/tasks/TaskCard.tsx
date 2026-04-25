import React from 'react';
import Link from 'next/link';
import { Task } from '@/types/task';
import { PriorityBadge, TaskStatusBadge } from './Badges';
import { Calendar, Award } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';

interface TaskCardProps {
  task: Task;
  role?: 'dom' | 'sub';
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const deadlineDate = task.deadline ? new Date(task.deadline) : null;
  const isOverdue = deadlineDate ? deadlineDate < new Date() : false;

  return (
    <Link href={`/tasks/${task.id}`}>
      <div className="group relative bg-glass-panel border border-glass-border rounded-xl p-5 hover:bg-white/5 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] cursor-pointer">
        <div className="flex justify-between items-start mb-3">
          <div className="flex gap-2 items-center flex-wrap">
            <TaskStatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
          {task.points_reward > 0 && (
            <div className="flex items-center gap-1 text-emerald-400 font-medium bg-emerald-500/10 px-2 py-1 rounded-md text-sm border border-emerald-500/20">
              <Award className="w-4 h-4" />
              <span>+{task.points_reward}</span>
            </div>
          )}
        </div>

        <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary transition-colors line-clamp-1">
          {task.title}
        </h3>
        
        {task.description && (
          <p className="text-gray-400 text-sm mb-4 line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-4 border-t border-glass-border">
          {deadlineDate ? (
            <div className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-400' : ''}`}>
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {isOverdue ? 'Vypršelo ' : 'Končí za '}
                {formatDistanceToNow(deadlineDate, { addSuffix: false, locale: cs })}
              </span>
            </div>
          ) : (
            <span className="text-gray-600">Bez termínu</span>
          )}
          
          <span className="text-primary/70 group-hover:text-primary transition-colors">
            Detail →
          </span>
        </div>
      </div>
    </Link>
  );
};
