import type { CheckinContent, DetectedSituation } from "./types";

const BRAND_SYSTEM_PROMPT = `You are the check-in writer inside TruePlanner, a calm productivity app.
Voice: calm, capable, direct, respectful, practical, quietly encouraging. Never frantic, never guilt-driven, never overly enthusiastic, never therapy-like.
You are NOT deciding whether to interrupt the user \u2014 that decision has already been made by a separate deterministic system. Your only job is to phrase the situation you're given.

Rules:
- Write a short headline (max 6 words, no exclamation marks, no emoji).
- Write one brief, factual message (1\u20132 sentences, under 500 characters) describing the situation plainly and pointing toward a decision.
- Always leave room for the three actions (Cut it / Shrink it / Move it) to follow \u2014 do not restate them in the message.
- Never say "you failed", "you're behind", "don't give up", or use exclamation points.
- Never pretend to know how the user feels.
- Output ONLY strict JSON: {"headline": string, "message": string}. No markdown, no commentary.`;

const GEMINI_TIMEOUT_MS = 20_000;

function situationToPrompt(situation: DetectedSituation): string {
  const ctx = situation.context;
  const relevantTasks = [situation.task, ...(situation.relatedTasks ?? [])]
    .filter((task): task is NonNullable<typeof task> => Boolean(task))
    .slice(0, 4)
    .map((task) => `- ${task.title} (${task.status})`)
    .join("\n");
  const taskContext = relevantTasks
    ? `\nRelevant tasks:\n${relevantTasks}\nUse at least one task title exactly as written in your headline or message.`
    : "";

  switch (situation.trigger_type) {
    case "overrun":
      return ctx.minutesRemaining && ctx.minutesRemaining > 0
        ? `Situation: TASK ENDING SOON. Task "${situation.task?.title}" is scheduled from ${situation.task?.start_time} to ${situation.task?.end_time}, has about ${ctx.minutesRemaining} minutes remaining, and is not complete.${taskContext}`
        : `Situation: OVERRUN. Task "${situation.task?.title}" was scheduled from ${situation.task?.start_time} to ${situation.task?.end_time} and is still not complete, about ${ctx.minutesOverdue} minutes overdue.${taskContext}`;
    case "drift":
      return `Situation: DRIFT. About ${ctx.percentOfDayElapsed}% of the working day has elapsed. Only ${ctx.completedCount} of ${ctx.totalCount} planned tasks are meaningfully complete.${taskContext}`;
    case "accumulation":
      return `Situation: ACCUMULATION. ${ctx.overdueCount} of ${ctx.totalCount} active tasks are overdue, and the remaining plan may not fit the time left. Name one or more specific overdue tasks; never describe this only as the day passing.${taskContext}`;
    case "repeated":
      return `Situation: REPEATED DISRUPTION. Task "${situation.task?.title}" has been moved or postponed ${ctx.moveCount} times.${taskContext}`;
    default:
      return `Situation: general check-in.${taskContext}`;
  }
}

export async function generateGeminiCheckin(
  situation: DetectedSituation
): Promise<CheckinContent | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not configured; using the template check-in writer.");
    return null;
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: BRAND_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: situationToPrompt(situation) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.6,
          maxOutputTokens: 200,
        },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error(`Gemini check-in generation failed (${res.status}).`, details);
      return null;
    }

    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("Gemini check-in generation returned no candidate text.");
      return null;
    }

    const parsed = JSON.parse(text);
    if (
      typeof parsed.headline !== "string" ||
      !parsed.headline.trim() ||
      typeof parsed.message !== "string" ||
      !parsed.message.trim()
    ) {
      console.error("Gemini check-in generation returned an invalid JSON payload.");
      return null;
    }

    const taskNames = [situation.task, ...(situation.relatedTasks ?? [])]
      .filter((task): task is NonNullable<typeof task> => Boolean(task))
      .map((task) => task.title.trim())
      .filter(Boolean);
    if (
      taskNames.length > 0 &&
      !taskNames.some((name) => `${parsed.headline} ${parsed.message}`.toLowerCase().includes(name.toLowerCase()))
    ) {
      console.warn("Gemini returned a check-in without naming a relevant task; using the template writer.");
      return null;
    }

    return {
      headline: parsed.headline.slice(0, 80),
      message: parsed.message.slice(0, 320),
      source: "gemini",
    };
  } catch (error) {
    const detail = String(error).replaceAll(apiKey, "[redacted]");
    console.error("Gemini check-in generation failed; using the template writer.", detail);
    return null;
  }
}
