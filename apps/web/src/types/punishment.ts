export type PunishmentStatus = 'assigned' | 'submitted' | 'completed' | 'cancelled';
export type PunishmentSeverity = 1 | 2 | 3 | 4 | 5;
export type PunishmentPlanStatus = 'draft' | 'ready' | 'used' | 'archived';

export type PunishmentTaskSummary = {
  id: string;
  public_task_id?: string | null;
  title: string;
};

export interface Punishment {
  id: string;
  title: string;
  description: string | null;
  severity: PunishmentSeverity;
  categories: string[];
  usage_count: number;
  is_template: boolean;
  template_id: string | null;
  task_id: string | null;
  assigned_to: string | null;
  created_by: string;
  status: PunishmentStatus;
  completion_note: string | null;
  completed_by: string | null;
  completed_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  task?: PunishmentTaskSummary | null;
}

export type PunishmentViewerRole = 'dom' | 'sub';

export type PunishmentSubProfile = {
  id: string;
  full_name: string | null;
};

export interface PunishmentPlanItem {
  id: string;
  plan_id: string;
  template_id: string | null;
  title_snapshot: string;
  description_snapshot: string | null;
  severity_snapshot: PunishmentSeverity;
  categories_snapshot: string[];
  position: number;
  is_done: boolean;
  done_at: string | null;
  usage_counted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PunishmentPlan {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  event_at: string | null;
  status: PunishmentPlanStatus;
  used_at: string | null;
  created_at: string;
  updated_at: string;
  items: PunishmentPlanItem[];
}
