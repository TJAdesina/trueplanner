import type { DetectedSituation, Profile, Task } from "./types";
import { minutesBetween, percentOfWorkdayElapsed } from "./time";
import { effectiveStatus, isActiveStatus } from "./taskUtils";

/**
 * The deterministic detection engine described in the product spec
 * (section 8 & 17): the SYSTEM decides *when* a check-in is warranted.
 * The AI (see lib/aiWriter.ts / app/api/checkin) only decides *how* to
 * phrase it. This file contains no language generation at all.
 */

const REPEATED_MOVE_THRESHOLD = 2;

function taskIsNearEnd(task: Task, now: Date, sensitivity: Profile["checkin_sensitivity"]): boolean {
  const start = new Date(task.start_time).getTime();
  const end = new Date(task.end_time).getTime();
  const created = new Date(task.created_at).getTime();
  const duration = end - start;
  const elapsed = now.getTime() - start;
  const minimumAgeMinutes = sensitivity === "proactive" ? 1 : sensitivity === "balanced" ? 3 : 5;
  const minimumAge = Math.min(minimumAgeMinutes * 60_000, duration * 0.1);
  const leadFraction = sensitivity === "proactive" ? 0.3 : sensitivity === "balanced" ? 0.15 : 0;
  const leadTime = duration * leadFraction;

  return (
    duration > 0 &&
    now.getTime() >= start &&
    now.getTime() - created >= minimumAge &&
    elapsed >= duration - leadTime
  );
}

function withinCooldown(task: Task, now: Date, sensitivity: Profile["checkin_sensitivity"]): boolean {
  if (!task.last_checkin_at) return false;
  return minutesBetween(new Date(task.last_checkin_at), now) < cooldownForSensitivity(sensitivity);
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
  const checkinReady = active.filter((task) =>
    taskIsNearEnd(task, now, profile.checkin_sensitivity)
  );
  if (!checkinReady.length) return null;

  // --- 1. Repeated disruption: a task moved several times -------------
  if (profile.trigger_repeated_enabled) {
    const repeated = checkinReady
      .filter((t) => t.move_count >= REPEATED_MOVE_THRESHOLD && !withinCooldown(t, now, profile.checkin_sensitivity))
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
    const ending = checkinReady
      .filter((t) => !withinCooldown(t, now, profile.checkin_sensitivity))
      .sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime())[0];
    if (ending) {
      const minutesRemaining = Math.max(0, minutesBetween(now, new Date(ending.end_time)));
      return {
        trigger_type: "overrun",
        task: ending,
        context: {
          minutesRemaining,
          minutesOverdue: Math.max(0, minutesBetween(new Date(ending.end_time), now)),
        },
      };
    }
  }

  // --- 3. Accumulation: multiple overdue / untouched tasks -------------
  if (profile.trigger_accumulation_enabled) {
    const overdueTasks = checkinReady.filter((t) => effectiveStatus(t, now) === "overdue");
    const untouched = checkinReady.filter((t) => t.status === "not_started");
    const overloaded = overdueTasks.length >= 2 || (overdueTasks.length >= 1 && untouched.length >= 2);

    if (overloaded) {
      const anyRecent = checkinReady.some((t) => withinCooldown(t, now, profile.checkin_sensitivity));
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
      profile.working_hours_end,
      profile.timezone
    );
    const completed = tasks.filter((t) => t.status === "completed" || t.status === "shrunk").length;
    const progressRatio = tasks.length > 0 ? completed / tasks.length : 1;

    if (percentElapsed >= 50 && progressRatio < 0.3 && active.length > 0) {
      const anyRecent = checkinReady.some((t) => withinCooldown(t, now, profile.checkin_sensitivity));
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
      return 30;
  }
}

export function isQuietHours(now: Date, profile: Profile, timeZone = profile.timezone): boolean {
  if (!profile.quiet_hours_start || !profile.quiet_hours_end) return false;
  const [sh, sm] = profile.quiet_hours_start.split(":").map(Number);
  const [eh, em] = profile.quiet_hours_end.split(":").map(Number);

  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  let cur: number;
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    cur =
      Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 +
      Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  } else {
    cur = now.getHours() * 60 + now.getMinutes();
  }

  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  // Wraps past midnight (e.g. 22:00 -> 07:00)
  return cur >= start || cur < end;
}
