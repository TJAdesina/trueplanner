export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "paused"
  | "completed"
  | "shrunk"
  | "moved"
  | "cut"
  | "overdue"
  | "archived";

export type TaskPriority = "low" | "medium" | "high";

export type CheckinTrigger = "overrun" | "drift" | "accumulation" | "repeated";
export type CheckinStatus = "pending" | "actioned" | "dismissed";
export type CheckinAction = "cut" | "shrink" | "move";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string; // ISO timestamp
  end_time: string; // ISO timestamp
  priority: TaskPriority;
  category: string | null;
  project: string | null;
  estimated_minutes: number | null;
  deadline: string | null;
  notes: string | null;
  status: TaskStatus;
  move_count: number;
  original_scope: string | null;
  parent_task_id: string | null;
  last_checkin_at: string | null;
  created_at: string;
  updated_at: string;
}

export type NewTask = Pick<Task, "title" | "start_time" | "end_time"> &
  Partial<
    Pick<
      Task,
      | "description"
      | "priority"
      | "category"
      | "project"
      | "estimated_minutes"
      | "deadline"
      | "notes"
    >
  >;

export interface TaskEvent {
  id: string;
  task_id: string;
  user_id: string;
  event_type: string;
  detail: string | null;
  created_at: string;
}

export interface Checkin {
  id: string;
  user_id: string;
  task_id: string | null;
  trigger_type: CheckinTrigger;
  headline: string;
  message: string;
  status: CheckinStatus;
  resolved_action: CheckinAction | null;
  source: "template" | "gemini";
  created_at: string;
  resolved_at: string | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  timezone: string;
  notifications_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  checkin_sensitivity: "gentle" | "balanced" | "proactive";
  trigger_overrun_enabled: boolean;
  trigger_drift_enabled: boolean;
  trigger_accumulation_enabled: boolean;
  trigger_repeated_enabled: boolean;
  working_hours_start: string;
  working_hours_end: string;
  typical_task_minutes: number;
  default_priority: TaskPriority;
  default_recovery_behavior: CheckinAction;
  show_completed_tasks: boolean;
  auto_suggest_shrink: boolean;
  theme: "light" | "dark" | "system";
  reduced_motion: boolean;
  ai_processing_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** A detected situation, produced by the deterministic trigger engine. */
export interface DetectedSituation {
  trigger_type: CheckinTrigger;
  task?: Task;
  relatedTasks?: Task[];
  context: {
    minutesRemaining?: number;
    minutesOverdue?: number;
    percentOfDayElapsed?: number;
    completedCount?: number;
    totalCount?: number;
    overdueCount?: number;
    moveCount?: number;
  };
}

export interface CheckinContent {
  headline: string;
  message: string;
  source: "template" | "gemini";
}

export type DayStatus = "on_track" | "slightly_behind" | "needs_adjustment" | "recovery_mode";
