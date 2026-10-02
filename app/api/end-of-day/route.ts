import { NextResponse } from "next/server";
import { generateDailyReview } from "@/lib/dailyReview";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Task } from "@/lib/types";

export const maxDuration = 30;

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

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (profileError || !profileData) {
    return NextResponse.json({ error: "Could not load profile" }, { status: 500 });
  }

  const profile = profileData as Profile;
  const now = new Date();
  const { data: taskRows, error: tasksError } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .gte("start_time", new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString())
    .lte("start_time", new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString());
  if (tasksError) {
    return NextResponse.json({ error: "Could not load today's tasks" }, { status: 500 });
  }

  const timeZone = profile.timezone || "UTC";
  const today = dateKeyInTimeZone(now, timeZone);
  const tasks = ((taskRows ?? []) as Task[]).filter(
    (task) => dateKeyInTimeZone(new Date(task.start_time), timeZone) === today
  );
  const review = await generateDailyReview(tasks, profile);
  return NextResponse.json({ review });
}