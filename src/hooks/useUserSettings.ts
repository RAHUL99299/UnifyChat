import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUserSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      if (!user) {
        setSettings(null);
        setLoading(false);
        return;
      }
      // try server first
      const res = await (supabase as any).from("user_settings").select("settings").eq("user_id", user.id).single();
      if (res && res.data && res.data.settings) {
        setSettings(res.data.settings);
        try { localStorage.setItem(`settings:${user.id}`, JSON.stringify(res.data.settings)); } catch (e) {}
        setLoading(false);
        return;
      }
      // fallback to localStorage
      const raw = localStorage.getItem(`settings:${user.id}`);
      if (raw) setSettings(JSON.parse(raw));
    } catch (e) {
      const raw = localStorage.getItem(`settings:${user?.id}`);
      if (raw) setSettings(JSON.parse(raw));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-settings-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_settings",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const nextSettings = payload?.new?.settings;
          if (!nextSettings) return;

          setSettings(nextSettings);
          try {
            localStorage.setItem(`settings:${user.id}`, JSON.stringify(nextSettings));
          } catch (_e) {
            // Ignore localStorage failures (private mode/full quota)
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const updateSettings = useCallback(async (newSettings: any) => {
    if (!user) throw new Error("Not authenticated");
    try {
      // upsert into user_settings table
      const payload = { user_id: user.id, settings: newSettings };
      const { error } = await (supabase as any).from("user_settings").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      setSettings(newSettings);
      try { localStorage.setItem(`settings:${user.id}`, JSON.stringify(newSettings)); } catch (e) {}
    } catch (e) {
      // fallback: store locally
      try { localStorage.setItem(`settings:${user.id}`, JSON.stringify(newSettings)); } catch (e) {}
      setSettings(newSettings);
    }
  }, [user]);

  return { settings, loading, fetchSettings, updateSettings };
}
