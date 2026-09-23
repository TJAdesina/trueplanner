import type { CheckinContent, DetectedSituation } from "./types";

const BRAND_SYSTEM_PROMPT = `You are the check-in writer inside TruePlanner, a calm productivity app.
Voice: calm, capable, direct, respectful, practical, quietly encouraging. Never frantic, never guilt-driven, never overly enthusiastic, never therapy-like.
You are NOT deciding whether to interrupt the user \u2014 that decision has already been made by a separate deterministic system. Your only job is to phrase the situation you're given.

Rules:
- Write a short headline (max 6 words, no exclamation marks, no emoji).
- Write one brief, factual message (1\u20132 sentences, under 240 characters) describing the situation plainly and pointing toward a decision.
- Always leave room for the three actions (Cut it / Shrink it / Move it) to follow \u2014 do not restate them in the message.
- Never say "you failed", "you're behind", "don't give up", or use exclamation points.
- Never pretend to know how the user feels.
- Output ONLY strict JSON: {"headline": string, "message": string}. No markdown, no commentary.`;

function situationToPrompt(situation: DetectedSituation): string {
  const ctx = situation.context;
  switch (situation.trigger_type) {
    case "overrun":
      return `Situation: OVERRUN. Task "${situation.task?.title}" was scheduled to end at ${situation.task?.end_time} and is still not complete. It is about ${ctx.minutesOverdue} minutes past its scheduled end time.`;
    case "drift":
      return `Situation: DRIFT. About ${ctx.percentOfDayElapsed}% of the working day has elapsed. Only ${ctx.completedCount} of ${ctx.totalCount} planned tasks are meaningfully complete.`;
    case "accumulation":
      return `Situation: ACCUMULATION. ${ctx.overdueCount} of ${ctx.totalCount} active tasks are currently overdue, and the remaining plan is no longer realistic for the time left.`;
    case "repeated":
      return `Situation: REPEATED DISRUPTION. Task "${situation.task?.title}" has been moved or postponed ${ctx.moveCount} times.`;
    default:
      return `Situation: general check-in.`;
  }
}

export async function generateGeminiCheckin(
  situation: DetectedSituation
): Promise<CheckinContent | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

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
      // Keep check-ins snappy; fall back to templates rather than hang the UI.
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (typeof parsed.headline !== "string" || typeof parsed.message !== "string") return null;

    return {
      headline: parsed.headline.slice(0, 80),
      message: parsed.message.slice(0, 320),
      source: "gemini",
    };
  } catch {
    return null;
  }
}
