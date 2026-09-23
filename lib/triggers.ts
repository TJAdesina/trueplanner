import type { DetectedSituation, Profile, Task } from "./types";
import { minutesBetween, percentOfWorkdayElapsed } from "./time";
import { effectiveStatus, isActiveStatus } from "./taskUtils";

/**
 * The deterministic detection engine described in the product spec
 * (section 8 & 17): the SYSTEM decides *when* a check-in is warranted.
 * The AI (see lib/aiWriter.ts / app/api/checkin) only decides *how* to
 * phrase it. This file contains no language generation at all.
 */

const COOLDOWN_MINUTES = 30;
const REPEATED_MOVE_THRESHOLD = 2;

function withinCooldown(task: Task, now: Date): boolean {
  if (!task.last_checkin_at) return false;
  return minutesBetween(new Date(task.last_checkin_at), now) < COOLDOWN_MINUTES;
}

/**
 * Evaluate today's tasks and return at most one situation that deserves
 * a check-in right now, respecting per-trigger settings and cooldowns.
 * Returns null when nothing meaningful needs surfacing (the quiet-by-
 * default default state).
 */
export function detectSituation(
  tasks: Task[],
  profile: Profile,
  now: Date = new Date()
): DetectedSituation | null {
  if (!tasks.length) return null;

  const active = tasks.filter((t) => isActiveStatus(effectiveStatus(t, now)));

  // --- 1. Repeated disruption: a task moved several times -------------
  if (profile.trigger_repeated_enabled) {
    const repeated = active
      .filter((t) => t.move_count >= REPEATED_MOVE_THRESHOLD && !withinCooldown(t, now))
      .sort((a, b) => b.move_count - a.move_count)[0];
    if (repeated) {
      return {
        trigger_type: "repeated",
        task: repeated,
        context: { moveCount: repeated.move_count },
      };
    }
  }

  // --- 2. Overrun: a scheduled task's end time has passed -------------
  if (profile.trigger_overrun_enabled) {
    const overdue = active
      .filter((t) => effectiveStatus(t, now) === "overdue" && !withinCooldown(t, now))
      .sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime())[0];
    if (overdue) {
      return {
        trigger_type: "overrun",
        task: overdue,
        context: {
          minutesOverdue: minutesBetween(new Date(overdue.end_time), now),
        },
      };
    }
  }

  // --- 3. Accumulation: multiple overdue / untouched tasks -------------
  if (profile.trigger_accumulation_enabled) {
    const overdueTasks = active.filter((t) => effectiveStatus(t, now) === "overdue");
    const untouched = active.filter((t) => t.status === "not_started");
    const overloaded = overdueTasks.length >= 2 || (overdueTasks.length >= 1 && untouched.length >= 2);

    if (overloaded) {
      const anyRecent = active.some((t) => withinCooldown(t, now));
      if (!anyRecent) {
        return {
          trigger_type: "accumulation",
          relatedTasks: [...overdueTasks, ...untouched],
          context: {
            overdueCount: overdueTasks.length,
            totalCount: active.length,
          },
        };
      }
    }
  }

  // --- 4. Drift: more than half the day gone, little progress ---------
  if (profile.trigger_drift_enabled) {
    const percentElapsed = percentOfWorkdayElapsed(
      now,
      profile.working_hours_start,
      profile.working_hours_end
    );
    const completed = tasks.filter((t) => t.status === "completed" || t.status === "shrunk").length;
    const progressRatio = tasks.length > 0 ? completed / tasks.length : 1;

    if (percentElapsed >= 50 && progressRatio < 0.3 && active.length > 0) {
      const anyRecent = active.some((t) => withinCooldown(t, now));
      if (!anyRecent) {
        return {
          trigger_type: "drift",
          relatedTasks: active,
          context: {
            percentOfDayElapsed: percentElapsed,
            completedCount: completed,
            totalCount: tasks.length,
          },
        };
      }
    }
  }

  return null;
}

/** Convert a checkin-sensitivity setting into an effective cooldown, in minutes. */
export function cooldownForSensitivity(sensitivity: Profile["checkin_sensitivity"]): number {
  switch (sensitivity) {
    case "gentle":
      return 60;
    case "proactive":
      return 15;
    default:
      return COOLDOWN_MINUTES;
  }
}

export function isQuietHours(now: Date, profile: Profile): boolean {
  if (!profile.quiet_hours_start || !profile.quiet_hours_end) return false;
  const [sh, sm] = profile.quiet_hours_start.split(":").map(Number);
  const [eh, em] = profile.quiet_hours_end.split(":").map(Number);

  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const cur = now.getHours() * 60 + now.getMinutes();

  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  // Wraps past midnight (e.g. 22:00 -> 07:00)
  return cur >= start || cur < end;
}
