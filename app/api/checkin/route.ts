import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTemplateCheckin } from "@/lib/aiWriter";
import { generateGeminiCheckin } from "@/lib/gemini";
import { sendCheckinPush } from "@/lib/push";
import { cooldownForSensitivity, detectSituation, isQuietHours } from "@/lib/triggers";
import type { Profile, Task } from "@/lib/types";

export const maxDuration = 30;

function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function POST() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (profileError || !profileData) {
    return NextResponse.json({ error: "Could not load notification settings" }, { status: 500 });
  }

  const profile = profileData as Profile;
  if (!profile.notifications_enabled) return NextResponse.json({ checkin: null });

  const now = new Date();
  if (isQuietHours(now, profile)) return NextResponse.json({ checkin: null });

  const { data: taskRows, error: tasksError } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .gte("start_time", new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString())
    .lte("start_time", new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString());
  if (tasksError) {
    return NextResponse.json({ error: "Could not load tasks for check-in evaluation" }, { status: 500 });
  }

  const timeZone = profile.timezone || "UTC";
  const today = dateKeyInTimeZone(now, timeZone);
  const tasks = ((taskRows ?? []) as Task[]).filter(
    (task) => dateKeyInTimeZone(new Date(task.start_time), timeZone) === today
  );
  const situation = detectSituation(tasks, profile, now);
  if (!situation) return NextResponse.json({ checkin: null });

  let content = null;
  if (profile?.ai_processing_enabled !== false) {
    content = await generateGeminiCheckin(situation);
  }
  if (!content) {
    content = generateTemplateCheckin(situation);
  }

  const candidateId = crypto.randomUUID();
  const { data: checkins, error } = await supabase.rpc("create_checkin_if_available", {
    p_checkin_id: candidateId,
    p_user_id: user.id,
    p_task_id: situation.task?.id ?? null,
    p_trigger_type: situation.trigger_type,
    p_headline: content.headline,
    p_message: content.message,
    p_source: content.source,
    p_cooldown_minutes: cooldownForSensitivity(profile.checkin_sensitivity),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const checkin = checkins?.[0];
  if (!checkin) return NextResponse.json({ checkin: null });

  const wasCreated = checkin.id === candidateId;
  if (wasCreated && situation.task?.id) {
    await supabase
      .from("tasks")
      .update({ last_checkin_at: now.toISOString() })
      .eq("id", situation.task.id)
      .eq("user_id", user.id);
  }

  if (wasCreated) await sendCheckinPush(supabase, checkin);

  return NextResponse.json({ checkin });
}
