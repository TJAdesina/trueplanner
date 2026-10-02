import { NextResponse } from "next/server";
import { generateTemplateCheckin } from "@/lib/aiWriter";
import { generateGeminiCheckin } from "@/lib/gemini";
import { sendCheckinPush } from "@/lib/push";
import { cooldownForSensitivity, detectSituation, isQuietHours } from "@/lib/triggers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Task } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function dateKeyInTimeZone(date: Date, timeZone: string): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
  }
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase admin setup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const now = new Date();
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .eq("notifications_enabled", true);
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const { data: taskRows, error: tasksError } = await supabase
    .from("tasks")
    .select("*")
    .gte("start_time", new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString())
    .lte("start_time", new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString());
  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  let created = 0;
  let skipped = 0;
  for (const row of profiles ?? []) {
    const profile = row as Profile;
    const timeZone = profile.timezone || "UTC";
    if (isQuietHours(now, profile, timeZone)) {
      skipped += 1;
      continue;
    }

    const today = dateKeyInTimeZone(now, timeZone);
    const tasks = ((taskRows ?? []) as Task[]).filter(
      (task) =>
        task.user_id === profile.id && dateKeyInTimeZone(new Date(task.start_time), timeZone) === today
    );
    const situation = detectSituation(tasks, profile, now);
    if (!situation) {
      skipped += 1;
      continue;
    }

    const { data: pending } = await supabase
      .from("checkins")
      .select("id")
      .eq("user_id", profile.id)
      .eq("status", "pending")
      .limit(1);
    if (pending?.length) {
      skipped += 1;
      continue;
    }

    const cooldownMinutes = cooldownForSensitivity(profile.checkin_sensitivity);
    const recentCutoff = new Date(now.getTime() - cooldownMinutes * 60_000).toISOString();
    const { data: recent } = await supabase
      .from("checkins")
      .select("id")
      .eq("user_id", profile.id)
      .gte("created_at", recentCutoff)
      .limit(1);
    if (recent?.length) {
      skipped += 1;
      continue;
    }

    let content = null;
    if (profile.ai_processing_enabled !== false) {
      content = await generateGeminiCheckin(situation);
    }
    if (!content) content = generateTemplateCheckin(situation);

    const candidateId = crypto.randomUUID();
    const { data: checkins, error: createError } = await supabase.rpc(
      "create_checkin_if_available",
      {
        p_checkin_id: candidateId,
        p_user_id: profile.id,
        p_task_id: situation.task?.id ?? null,
        p_trigger_type: situation.trigger_type,
        p_headline: content.headline,
        p_message: content.message,
        p_source: content.source,
        p_cooldown_minutes: cooldownMinutes,
      }
    );
    if (createError) {
      console.error(`Could not create a scheduled check-in for ${profile.id}.`, createError);
      continue;
    }

    const checkin = checkins?.[0];
    if (!checkin || checkin.id !== candidateId) {
      skipped += 1;
      continue;
    }

    if (situation.task?.id) {
      await supabase
        .from("tasks")
        .update({ last_checkin_at: now.toISOString() })
        .eq("id", situation.task.id)
        .eq("user_id", profile.id);
    }
    await sendCheckinPush(supabase, checkin);
    created += 1;
  }

  return NextResponse.json({ scanned: profiles?.length ?? 0, created, skipped });
}