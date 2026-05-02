export type TaskStatus = 'pending' | 'in_progress' | 'submitted' | 'in_review' | 'revision_requested' | 'completed' | 'approved' | 'rejected' | 'expired' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Task {
  id: string;
  public_task_id?: string | null;
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
  recurrence_instance_date?: string | null;
  expiry_penalty_points?: number | null;
  expiry_penalty_reason?: string | null;
  expired_at?: string | null;
  rating: number | null;
  dom_feedback: string | null;
  created_at: string;
  updated_at: string;
  xp_awarded_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  dom_feedback_read_at?: string | null;
  hide_from_sub_after_date?: string | null;
  last_viewed_at?: string | null;
  view_count?: number | null;
  task_attempts?: TaskAttempt[];
  task_evidence?: TaskEvidence[];
  task_media?: TaskMedia[];
}

export interface TaskAttempt {
  id: string;
  task_id: string;
  attempt_number: number;
  text_content: string | null;
  status: string;
  submitted_at: string | null;
  review_feedback?: string | null;
}

export interface TaskMedia {
  id: string;
  task_id: string;
  attempt_id?: string | null;
  media_type: 'image' | 'video';
  original_filename: string;
  drive_file_id: string;
  drive_web_view_link: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface TaskEvidence {
  id: string;
  task_id: string;
  type: 'text' | 'image' | 'video';
  content: string;
  created_at: string;
}
