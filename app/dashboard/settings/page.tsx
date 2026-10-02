"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useRouter } from "next/navigation";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { enablePushNotifications } from "@/lib/notifications";
import type { CheckinAction, TaskPriority } from "@/lib/types";

import type { Profile } from "@/lib/types";

export default function SettingsPage() {
  const { profile, loading, updateProfile } = useProfile();
  const router = useRouter();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<{
    subscribed: boolean;
    storageReady: boolean;
    configured?: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/push-subscription")
      .then((response) => response.json())
      .then((status) => setPushStatus(status))
      .catch(() => setPushStatus({ subscribed: false, storageReady: false }));
  }, []);

  if (loading || !profile) {
    return <p className="text-sm text-charcoal/50">Loading settings\u2026</p>;
  }

  async function save(patch: Partial<Profile>) {
    await updateProfile(patch);
    setSavedAt(Date.now());
  }

  async function setNotificationsEnabled(enabled: boolean) {
    setNotificationError(null);
    if (!enabled) {
      await save({ notifications_enabled: false });
      return;
    }

    try {
      const permission = await enablePushNotifications();
      if (permission === "granted") {
        await save({ notifications_enabled: true });
        const response = await fetch("/api/push-subscription");
        if (response.ok) setPushStatus(await response.json());
      }
      else setNotificationError("Allow notifications in your browser to enable push check-ins.");
    } catch (error) {
      setNotificationError(
        error instanceof Error ? error.message : "Could not enable push notifications."
      );
    }
  }

  async function exportData() {
    const supabase = createClient();
    const { data: tasks } = await supabase.from("tasks").select("*");
    const blob = new Blob([JSON.stringify({ profile, tasks }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trueplanner-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAllTasks() {
    if (!confirm("This removes every task you've created. Continue?")) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await supabase.from("tasks").delete().eq("user_id", user.id);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <div>
        <h1 className="font-serif text-2xl text-forest">Settings</h1>
        {savedAt && <p className="mt-1 text-xs text-green-700">Saved.</p>}
      </div>

      <section className="card p-6">
        <p className="eyebrow">Notifications</p>
        <div className="mt-2 divide-y divide-charcoal/8">
          <Toggle
            label="Browser notifications"
            description="Get check-ins even when the tab isn't focused."
            checked={profile.notifications_enabled}
            onChange={setNotificationsEnabled}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <p className="text-xs text-charcoal/60" role="status">
              {!pushStatus
                ? "Checking this browser's push setup..."
                : !pushStatus.configured
                  ? "Web Push is missing its server-side VAPID public key."
                : !pushStatus.storageReady
                  ? "Push subscription storage is unavailable. Run the latest Supabase schema."
                  : pushStatus.subscribed
                    ? "This browser is registered to receive check-in pushes."
                    : "This browser has no push subscription yet."}
            </p>
            <Button
              variant="secondary"
              onClick={() => setNotificationsEnabled(true)}
              disabled={!pushStatus?.storageReady || !pushStatus.configured}
            >
              Enable on this device
            </Button>
          </div>
          {notificationError && (
            <p className="py-2 text-sm text-[#B3492B]">{notificationError}</p>
          )}
          <div className="py-3">
            <span className="block text-sm font-medium text-charcoal">Check-in sensitivity</span>
            <div className="mt-2 flex gap-2">
              {(["gentle", "balanced", "proactive"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => save({ checkin_sensitivity: s })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    profile.checkin_sensitivity === s
                      ? "border-forest bg-forest text-cream"
                      : "border-charcoal/15 text-charcoal/70 hover:bg-charcoal/5"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 py-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-charcoal/80">
                Quiet hours start
              </label>
              <input
                type="time"
                value={profile.quiet_hours_start ?? ""}
                onChange={(e) => save({ quiet_hours_start: e.target.value || null })}
                className="w-full rounded-lg border border-charcoal/15 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-charcoal/80">
                Quiet hours end
              </label>
              <input
                type="time"
                value={profile.quiet_hours_end ?? ""}
                onChange={(e) => save({ quiet_hours_end: e.target.value || null })}
                className="w-full rounded-lg border border-charcoal/15 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <Toggle
            label="Overrun check-ins"
            description="When a scheduled task ends but is still incomplete."
            checked={profile.trigger_overrun_enabled}
            onChange={(v) => save({ trigger_overrun_enabled: v })}
          />
          <Toggle
            label="Drift check-ins"
            description="When the day is more than half over with little progress."
            checked={profile.trigger_drift_enabled}
            onChange={(v) => save({ trigger_drift_enabled: v })}
          />
          <Toggle
            label="Accumulation check-ins"
            description="When several tasks are overdue at once."
            checked={profile.trigger_accumulation_enabled}
            onChange={(v) => save({ trigger_accumulation_enabled: v })}
          />
          <Toggle
            label="Repeated-disruption check-ins"
            description="When the same task keeps getting moved."
            checked={profile.trigger_repeated_enabled}
            onChange={(v) => save({ trigger_repeated_enabled: v })}
          />
        </div>
      </section>

      <section className="card p-6">
        <p className="eyebrow">Productivity preferences</p>
        <div className="mt-2 divide-y divide-charcoal/8">
          <div className="grid grid-cols-2 gap-4 py-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-charcoal/80">
                Working hours start
              </label>
              <input
                type="time"
                value={profile.working_hours_start}
                onChange={(e) => save({ working_hours_start: e.target.value })}
                className="w-full rounded-lg border border-charcoal/15 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-charcoal/80">
                Working hours end
              </label>
              <input
                type="time"
                value={profile.working_hours_end}
                onChange={(e) => save({ working_hours_end: e.target.value })}
                className="w-full rounded-lg border border-charcoal/15 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="py-3">
            <span className="block text-sm font-medium text-charcoal">Default priority</span>
            <div className="mt-2 flex gap-2">
              {(["low", "medium", "high"] as TaskPriority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => save({ default_priority: p })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    profile.default_priority === p
                      ? "border-forest bg-forest text-cream"
                      : "border-charcoal/15 text-charcoal/70 hover:bg-charcoal/5"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="py-3">
            <span className="block text-sm font-medium text-charcoal">Default recovery behavior</span>
            <p className="mt-0.5 text-xs text-charcoal/50">
              Which action check-ins suggest first.
            </p>
            <div className="mt-2 flex gap-2">
              {(["cut", "shrink", "move"] as CheckinAction[]).map((a) => (
                <button
                  key={a}
                  onClick={() => save({ default_recovery_behavior: a })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    profile.default_recovery_behavior === a
                      ? "border-forest bg-forest text-cream"
                      : "border-charcoal/15 text-charcoal/70 hover:bg-charcoal/5"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            label="Show completed tasks"
            checked={profile.show_completed_tasks}
            onChange={(v) => save({ show_completed_tasks: v })}
          />
          <Toggle
            label="Auto-suggest smaller task versions"
            checked={profile.auto_suggest_shrink}
            onChange={(v) => save({ auto_suggest_shrink: v })}
          />
        </div>
      </section>

      <section className="card p-6">
        <p className="eyebrow">Appearance</p>
        <div className="mt-2 divide-y divide-charcoal/8">
          <div className="py-3">
            <span className="block text-sm font-medium text-charcoal">Theme</span>
            <div className="mt-2 flex gap-2">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => save({ theme: t })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    profile.theme === t
                      ? "border-forest bg-forest text-cream"
                      : "border-charcoal/15 text-charcoal/70 hover:bg-charcoal/5"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            label="Reduced motion"
            checked={profile.reduced_motion}
            onChange={(v) => save({ reduced_motion: v })}
          />
        </div>
      </section>

      <section className="card p-6">
        <p className="eyebrow">Privacy &amp; data</p>
        <div className="mt-2 divide-y divide-charcoal/8">
          <Toggle
            label="Allow AI processing for check-ins"
            description="When off, check-ins use the built-in rule-based writer instead of Gemini."
            checked={profile.ai_processing_enabled}
            onChange={(v) => save({ ai_processing_enabled: v })}
          />
          <div className="flex items-center justify-between py-3">
            <span className="text-sm font-medium text-charcoal">Export your data</span>
            <Button variant="secondary" onClick={exportData}>Export</Button>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm font-medium text-charcoal">Delete all tasks</span>
            <Button variant="ghost" onClick={deleteAllTasks} className="text-[#B3492B]">
              Delete
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
