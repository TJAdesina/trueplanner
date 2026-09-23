import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTemplateCheckin } from "@/lib/aiWriter";
import { generateGeminiCheckin } from "@/lib/gemini";
import type { DetectedSituation } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const situation: DetectedSituation | undefined = body?.situation;

  if (!situation || !situation.trigger_type) {
    return NextResponse.json({ error: "Missing situation" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_processing_enabled")
    .eq("id", user.id)
    .single();

  let content = null;
  if (profile?.ai_processing_enabled !== false) {
    content = await generateGeminiCheckin(situation);
  }
  if (!content) {
    content = generateTemplateCheckin(situation);
  }

  const { data: checkin, error } = await supabase
    .from("checkins")
    .insert({
      user_id: user.id,
      task_id: situation.task?.id ?? null,
      trigger_type: situation.trigger_type,
      headline: content.headline,
      message: content.message,
      source: content.source,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (situation.task?.id) {
    await supabase
      .from("tasks")
      .update({ last_checkin_at: new Date().toISOString() })
      .eq("id", situation.task.id);
  }

  return NextResponse.json({ checkin });
}
