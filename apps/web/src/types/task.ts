export type TaskStatus = 'pending' | 'in_progress' | 'submitted' | 'in_review' | 'completed' | 'approved' | 'rejected' | 'expired';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_by: string;
  assigned_to: string;
  status: TaskStatus;
  priority: TaskPriority;
  points_reward: number;
  deadline: string | null;
  recurrence: RecurrenceType;
  recurrence_config: Record<string, unknown> | null;
  parent_task_id: string | null;
  rating: number | null;
  dom_feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskEvidence {
  id: string;
  task_id: string;
  type: 'text' | 'image' | 'video';
  content: string;
  created_at: string;
}
