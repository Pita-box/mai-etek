import React from 'react';
import { TaskPriority, TaskStatus } from '@/types/task';
import { AlertCircle, Clock, CheckCircle2, XCircle, PlayCircle, MoreHorizontal } from 'lucide-react';

interface PriorityBadgeProps {
  priority: TaskPriority;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const styles = {
    low: 'bg-glass-panel text-gray-400 border-gray-700/50',
    medium: 'bg-glass-panel text-blue-400 border-blue-500/30',
    high: 'bg-glass-panel text-orange-400 border-orange-500/30',
    urgent: 'bg-glass-panel text-red-500 border-red-500/50 animate-pulse',
  };

  const labels: Record<TaskPriority, string> = {
    low: 'Nízká',
    medium: 'Střední',
    high: 'Vysoká',
    urgent: 'Urgentní',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border backdrop-blur-md ${styles[priority]}`}>
      {labels[priority]}
    </span>
  );
};

interface StatusBadgeProps {
  status: TaskStatus;
}

export const TaskStatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config: Record<string, { icon: React.ElementType, className: string, label: string }> = {
    pending: { icon: Clock, className: 'text-gray-400 bg-gray-500/10 border-gray-500/20', label: 'Čeká' },
    in_progress: { icon: PlayCircle, className: 'text-blue-400 bg-blue-500/10 border-blue-500/20', label: 'Probíhá' },
    in_review: { icon: MoreHorizontal, className: 'text-purple-400 bg-purple-500/10 border-purple-500/20', label: 'Ke kontrole' },
    submitted: { icon: MoreHorizontal, className: 'text-purple-400 bg-purple-500/10 border-purple-500/20', label: 'Ke kontrole' }, // Map submitted to review UI
    completed: { icon: CheckCircle2, className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Splněno' },
    approved: { icon: CheckCircle2, className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Schváleno' },
    rejected: { icon: XCircle, className: 'text-red-400 bg-red-500/10 border-red-500/20', label: 'Zamítnuto' },
    expired: { icon: AlertCircle, className: 'text-orange-400 bg-orange-500/10 border-orange-500/20', label: 'Vypršelo' },
    cancelled: { icon: XCircle, className: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20', label: 'Zrušeno' },
  };

  // Typecast to handle legacy or server-only statuses gracefully
  const c = config[status as keyof typeof config] || config.in_progress;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.className}`}>
      <Icon className="w-3.5 h-3.5" />
      {c.label}
    </span>
  );
};
