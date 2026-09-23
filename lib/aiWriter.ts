import type { CheckinContent, DetectedSituation } from "./types";
import { formatDuration } from "./time";

/**
 * The brand voice, encoded as a deterministic writer. No API key needed.
 * This exists so the product is fully usable out of the box, and serves
 * as the fallback if GEMINI_API_KEY is not configured or the live call
 * fails. Kept short, factual, calm \u2014 never dramatic, never guilt-driven.
 */

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function seedFrom(...parts: (string | number | undefined)[]): number {
  const s = parts.filter(Boolean).join("|");
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

export function generateTemplateCheckin(situation: DetectedSituation): CheckinContent {
  const seed = seedFrom(
    situation.trigger_type,
    situation.task?.id,
    situation.context.minutesOverdue,
    situation.context.overdueCount
  );

  switch (situation.trigger_type) {
    case "overrun": {
      const title = situation.task?.title ?? "This task";
      const overdue = situation.context.minutesOverdue ?? 0;

      const headlines = ["Time's up on this one.", "This task ran past its window.", "Your plan is getting tight."];
      const bodies = [
        `"${title}" was scheduled to end ${formatDuration(overdue)} ago and is still open. You could finish the essential part, reduce it, or move it.`,
        `"${title}" is ${formatDuration(overdue)} past its window. Still worth doing? Keep it, shrink it, or move it.`,
        `"${title}" hasn't wrapped up, and its time has passed. What's the most useful next step \u2014 finish, shrink, or move it?`,
      ];

      return {
        headline: pick(headlines, seed),
        message: pick(bodies, seed >> 2),
        source: "template",
      };
    }

    case "drift": {
      const { percentOfDayElapsed = 50, completedCount = 0, totalCount = 0 } = situation.context;
      const headlines = ["The day is moving.", "Worth a quick reset.", "Your plan is getting tight."];
      const bodies = [
        `About ${percentOfDayElapsed}% of your working hours have passed, and ${completedCount} of ${totalCount} tasks are done. What's the smallest useful version of what's left?`,
        `More than half the day is gone with limited progress logged. You don't need to rescue the whole plan \u2014 just decide what's still useful now.`,
        `Time's moving faster than the plan. Pick one task to finish, shrink, or move, and leave the rest for later.`,
      ];

      return {
        headline: pick(headlines, seed),
        message: pick(bodies, seed >> 2),
        source: "template",
      };
    }

    case "accumulation": {
      const { overdueCount = 0, totalCount = 0 } = situation.context;
      const headlines = ["Need a reset?", "The plan is carrying too much.", "This list isn't realistic anymore."];
      const bodies = [
        `${overdueCount} of ${totalCount} tasks are overdue. The original plan probably doesn't fit the time left \u2014 let's cut, shrink, or move a few things.`,
        `Several tasks have piled up. Rather than push through all of them, pick what still matters and let the rest go for today.`,
        `The remaining workload isn't realistic for the time left. Choose one or two things that matter and adjust the rest.`,
      ];

      return {
        headline: pick(headlines, seed),
        message: pick(bodies, seed >> 2),
        source: "template",
      };
    }

    case "repeated": {
      const title = situation.task?.title ?? "This task";
      const count = situation.context.moveCount ?? 2;
      const headlines = ["Still worth doing?", "This one keeps slipping.", "Worth a second look."];
      const bodies = [
        `"${title}" has been moved ${count} times. That's usually a sign its scope needs to change, not just its schedule. Shrink it, or cut it from today entirely.`,
        `You've rescheduled "${title}" a few times now. Maybe it's smaller than it looks, or maybe it doesn't belong on today's plan at all.`,
        `"${title}" keeps getting pushed. Consider shrinking it to something you can actually finish, or cutting it for now.`,
      ];

      return {
        headline: pick(headlines, seed),
        message: pick(bodies, seed >> 2),
        source: "template",
      };
    }

    default:
      return {
        headline: "Still worth doing?",
        message: "Keep it, shrink it, or move it \u2014 whatever reflects reality best.",
        source: "template",
      };
  }
}
