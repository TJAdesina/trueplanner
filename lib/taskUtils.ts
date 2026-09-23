import type { DayStatus, Task, TaskPriority, TaskStatus } from "./types";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  paused: "Paused",
  completed: "Completed",
  shrunk: "Shrunk",
  moved: "Moved",
  cut: "Cut",
  overdue: "Overdue",
  archived: "Archived",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** Tailwind class fragments per status \u2014 kept muted, on-brand, never alarmist. */
export const STATUS_STYLE: Record<TaskStatus, string> = {
  not_started: "bg-charcoal/5 text-charcoal/70 border-charcoal/10",
  in_progress: "bg-forest/10 text-forest border-forest/20",
  paused: "bg-peach/20 text-charcoal border-peach/30",
  completed: "bg-green/15 text-forest border-green/30",
  shrunk: "bg-green/10 text-forest border-green/20",
  moved: "bg-charcoal/5 text-charcoal/70 border-charcoal/15",
  cut: "bg-charcoal/5 text-charcoal/40 border-charcoal/10 line-through",
  overdue: "bg-peach/25 text-charcoal border-peach/40",
  archived: "bg-charcoal/5 text-charcoal/40 border-charcoal/10",
};

export const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-charcoal/25",
  medium: "bg-peach",
  high: "bg-forest",
};

export function isActiveStatus(status: TaskStatus): boolean {
  return status === "not_started" || status === "in_progress" || status === "paused" || status === "overdue";
}

export function isResolvedStatus(status: TaskStatus): boolean {
  return !isActiveStatus(status);
}

export function computeOverdue(task: Task, now: Date = new Date()): boolean {
  if (task.status !== "not_started" && task.status !== "in_progress" && task.status !== "paused") {
    return false;
  }
  return new Date(task.end_time).getTime() < now.getTime();
}

export function effectiveStatus(task: Task, now: Date = new Date()): TaskStatus {
  if (computeOverdue(task, now)) return "overdue";
  return task.status;
}

interface ProgressCounts {
  completed: number;
  started: number;
  shrunk: number;
  moved: number;
  cut: number;
  pending: number;
  overdue: number;
}

export function summarizeProgress(tasks: Task[], now: Date = new Date()): ProgressCounts {
  const counts: ProgressCounts = {
    completed: 0,
    started: 0,
    shrunk: 0,
    moved: 0,
    cut: 0,
    pending: 0,
    overdue: 0,
  };

  for (const t of tasks) {
    const status = effectiveStatus(t, now);
    switch (status) {
      case "completed":
        counts.completed++;
        break;
      case "in_progress":
      case "paused":
        counts.started++;
        break;
      case "shrunk":
        counts.shrunk++;
        break;
      case "moved":
        counts.moved++;
        break;
      case "cut":
        counts.cut++;
        break;
      case "overdue":
        counts.overdue++;
        break;
      case "not_started":
        counts.pending++;
        break;
      default:
        break;
    }
  }

  return counts;
}

export function computeDayStatus(tasks: Task[], now: Date = new Date()): DayStatus {
  if (tasks.length === 0) return "on_track";

  const counts = summarizeProgress(tasks, now);
  const meaningfulTotal = tasks.length;
  const resolvedOrMoving = counts.completed + counts.started + counts.shrunk;

  if (counts.overdue >= 3 || (counts.overdue >= 2 && counts.pending >= 2)) {
    return "recovery_mode";
  }
  if (counts.overdue >= 1 && resolvedOrMoving / meaningfulTotal < 0.5) {
    return "needs_adjustment";
  }
  if (counts.overdue >= 1) {
    return "slightly_behind";
  }
  return "on_track";
}

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  on_track: "On track",
  slightly_behind: "Slightly behind",
  needs_adjustment: "Plan needs adjustment",
  recovery_mode: "Recovery mode",
};

export const DAY_STATUS_STYLE: Record<DayStatus, string> = {
  on_track: "text-forest bg-green/15",
  slightly_behind: "text-charcoal bg-peach/20",
  needs_adjustment: "text-charcoal bg-peach/30",
  recovery_mode: "text-cream bg-forest",
};

export function findCurrentTask(tasks: Task[], now: Date = new Date()): Task | null {
  const active = tasks.filter((t) => isActiveStatus(effectiveStatus(t, now)));
  if (active.length === 0) return null;

  // Prefer something already in progress.
  const inProgress = active.find((t) => t.status === "in_progress");
  if (inProgress) return inProgress;

  // Then anything overdue (most urgent), earliest end time first.
  const overdue = active
    .filter((t) => effectiveStatus(t, now) === "overdue")
    .sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime());
  if (overdue.length > 0) return overdue[0];

  // Otherwise the next task coming up, closest start time first.
  const upcoming = active
    .filter((t) => t.status === "not_started" || t.status === "paused")
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  return upcoming[0] ?? null;
}
