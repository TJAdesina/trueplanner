import type { Profile, Task } from "@/lib/types";
import { summarizeProgress } from "@/lib/taskUtils";

export interface DailyReview {
  assessment: string;
  wentWell: string[];
  improve: string[];
  planTomorrow: string[];
}

function fallbackReview(tasks: Task[], profile: Profile): DailyReview {
  const counts = summarizeProgress(tasks);
  const finished = counts.completed + counts.shrunk;
  const progressed = finished + counts.started;
  const unfinished = tasks.filter((task) =>
    ["not_started", "in_progress", "paused", "overdue"].includes(task.status)
  );
  const movedOften = tasks.filter((task) => task.move_count >= 2);
  const taskNames = unfinished.slice(0, 3).map((task) => `“${task.title}”`);

  const wentWell: string[] = [];
  if (finished > 0) wentWell.push(`You finished or deliberately reduced ${finished} of ${tasks.length} planned tasks.`);
  if (counts.started > 0) wentWell.push(`You made progress on ${counts.started} more task${counts.started === 1 ? "" : "s"}, even if they are not finished yet.`);
  if (counts.moved > 0 || counts.cut > 0) {
    wentWell.push("You adjusted the plan instead of treating every original commitment as fixed.");
  }
  if (!wentWell.length) wentWell.push("You have a clear record of what did and did not fit today, which gives you something concrete to plan from.");

  const improve: string[] = [];
  if (unfinished.length > 0) {
    improve.push(
      unfinished.length === 1
        ? `${taskNames[0]} was not finished today. Decide whether it still matters before carrying it forward.`
        : `${unfinished.length} tasks remain unfinished${taskNames.length ? `, including ${taskNames.join(", ")}` : ""}. Prioritize rather than moving the whole list forward.`
    );
  }
  if (movedOften.length > 0) {
    improve.push(`${movedOften[0].title} has been rescheduled ${movedOften[0].move_count} times; its scope or timing may need to change.`);
  }
  if (progressed < tasks.length && !improve.length) {
    improve.push("Compare the planned time blocks with how long the work actually took before repeating the same schedule.");
  }
  if (!improve.length) improve.push("Your plan was well managed today. Keep the same workload realistic and leave some room between tasks.");

  const planTomorrow: string[] = [];
  if (unfinished.length > 0) {
    planTomorrow.push(`Choose the single most important unfinished task first${taskNames[0] ? `; review ${taskNames[0]} before carrying it forward` : ""}.`);
  } else {
    planTomorrow.push("Start with the highest-priority task and keep the rest of the day flexible.");
  }
  planTomorrow.push(`Use about ${profile.typical_task_minutes} minutes as a starting block, then add buffer time before scheduling another task.`);

  const completionPercent = Math.round((finished / tasks.length) * 100);
  const assessment = finished === tasks.length
    ? `You completed or right-sized all ${tasks.length} planned tasks. That is a strong match between the plan and the day.`
    : `You completed or right-sized ${finished} of ${tasks.length} planned tasks (${completionPercent}%). ${unfinished.length} remain to review; progress is more useful than treating the day as pass or fail.`;

  return { assessment, wentWell, improve, planTomorrow };
}

export async function generateDailyReview(
  tasks: Task[],
  profile: Profile
): Promise<DailyReview> {
  const fallback = fallbackReview(tasks, profile);
  if (!profile.ai_processing_enabled || !process.env.GEMINI_API_KEY || tasks.length === 0) {
    return fallback;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const taskData = tasks.map((task) => ({
    title: task.title,
    status: task.status,
    priority: task.priority,
    estimatedMinutes: task.estimated_minutes,
    moves: task.move_count,
  }));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: "You write calm, practical end-of-day reviews for TruePlanner. Use only the supplied task facts; do not infer why a task was unfinished or claim work happened when its status does not support that. Be kind, direct, and specific. Return strict JSON with assessment (one sentence), wentWell (1-3 short items), improve (1-3 short items), and planTomorrow (1-3 actionable items). Mention actual task titles where useful. Never shame the user.",
          }],
        },
        contents: [{ role: "user", parts: [{ text: JSON.stringify({ tasks: taskData, typicalTaskMinutes: profile.typical_task_minutes }) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
          maxOutputTokens: 500,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      console.error(`Gemini end-of-day review failed (${response.status}).`);
      return fallback;
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return fallback;
    const parsed = JSON.parse(text);
    const validList = (value: unknown): value is string[] =>
      Array.isArray(value) && value.length > 0 && value.length <= 3 && value.every((item) => typeof item === "string" && item.trim());
    if (
      typeof parsed.assessment !== "string" ||
      !parsed.assessment.trim() ||
      !validList(parsed.wentWell) ||
      !validList(parsed.improve) ||
      !validList(parsed.planTomorrow)
    ) return fallback;

    return {
      assessment: parsed.assessment.slice(0, 300),
      wentWell: parsed.wentWell.map((item: string) => item.slice(0, 240)),
      improve: parsed.improve.map((item: string) => item.slice(0, 240)),
      planTomorrow: parsed.planTomorrow.map((item: string) => item.slice(0, 240)),
    };
  } catch (error) {
    const detail = String(error).replaceAll(apiKey, "[redacted]");
    console.error("Gemini end-of-day review failed; using data-based guidance.", detail);
    return fallback;
  }
}