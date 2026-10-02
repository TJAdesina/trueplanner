import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { detectSituation, isQuietHours } from "@/lib/triggers";
import type { Checkin, Profile, Task } from "@/lib/types";

const CHECK_INTERVAL_MS = 30_000;

export function useCheckinEngine(tasks: Task[], profile: Profile | null) {
  const [activeCheckin, setActiveCheckin] = useState<Checkin | null>(null);
  const [generating, setGenerating] = useState(false);
  const inFlight = useRef(false);

  const evaluate = useCallback(async () => {
    if (!profile || !profile.notifications_enabled || inFlight.current) return;
    if (isQuietHours(new Date(), profile)) return;
    if (activeCheckin) return; // don't stack check-ins

    const situation = detectSituation(tasks, profile, new Date());
    if (!situation) return;

    inFlight.current = true;
    setGenerating(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
      });
      if (res.ok) {
        const { checkin } = await res.json();
        if (checkin) setActiveCheckin(checkin as Checkin);
      }
    } finally {
      inFlight.current = false;
      setGenerating(false);
    }
  }, [tasks, profile, activeCheckin]);

  useEffect(() => {
    evaluate();
    const id = setInterval(evaluate, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, profile]);

  const dismiss = useCallback(async () => {
    if (!activeCheckin) return;
    const supabase = createClient();
    await supabase
      .from("checkins")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("id", activeCheckin.id);
    setActiveCheckin(null);
  }, [activeCheckin]);

  const resolve = useCallback(
    async (action: "cut" | "shrink" | "move") => {
      if (!activeCheckin) return;
      const supabase = createClient();
      await supabase
        .from("checkins")
        .update({
          status: "actioned",
          resolved_action: action,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", activeCheckin.id);
      setActiveCheckin(null);
    },
    [activeCheckin]
  );

  return { activeCheckin, generating, dismiss, resolve };
}
