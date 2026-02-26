import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_online: boolean;
  last_seen: string | null;
}

export function useProfiles() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*");
    if (data) {
      setProfiles(data.map(p => ({
        id: p.id,
        display_name: p.display_name,
        username: p.username,
        avatar_url: p.avatar_url,
        bio: p.bio,
        is_online: p.is_online ?? false,
        last_seen: p.last_seen,
      })));
      if (user) {
        const mine = data.find(p => p.id === user.id);
        if (mine) setMyProfile({
          id: mine.id,
          display_name: mine.display_name,
          username: mine.username,
          avatar_url: mine.avatar_url,
          bio: mine.bio,
          is_online: mine.is_online ?? false,
          last_seen: mine.last_seen,
        });
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const updateMyProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    await supabase.from("profiles").update(updates).eq("id", user.id);
    fetchProfiles();
  };

  const setOnlineStatus = async (online: boolean) => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ is_online: online, last_seen: new Date().toISOString() })
      .eq("id", user.id);
  };

  return { profiles, myProfile, loading, updateMyProfile, setOnlineStatus, fetchProfiles };
}
