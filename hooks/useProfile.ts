import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    let currentProfile = profileData;
    if (profileData && profileData.timezone !== timeZone) {
      const { data: updatedProfile } = await supabase
        .from("profiles")
        .update({ timezone: timeZone })
        .eq("id", user.id)
        .select()
        .single();
      if (updatedProfile) currentProfile = updatedProfile;
    }

    setProfile(
      currentProfile
        ? ({ ...currentProfile, timezone: currentProfile.timezone ?? timeZone } as Profile)
        : null
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!profile || typeof document === "undefined") return;
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      root.classList.toggle(
        "dark",
        profile.theme === "dark" || (profile.theme === "system" && media.matches)
      );
    };

    applyTheme();
    if (profile.theme === "system") media.addEventListener("change", applyTheme);
    return () => {
      media.removeEventListener("change", applyTheme);
      root.classList.remove("dark");
    };
  }, [profile?.theme]);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id)
        .select()
        .single();

      if (!error && data) setProfile(data as Profile);
      return { data, error };
    },
    []
  );

  return { profile, loading, refresh, updateProfile };
}
