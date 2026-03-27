import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  phone: string | null;
  phone_verified: boolean;
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
  const lastOnlineSentRef = useRef<boolean | null>(null);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*");
    if (data) {
      const mappedProfiles = data.map(p => ({
        id: p.id,
        display_name: p.display_name,
        username: p.username,
        phone: p.phone,
        phone_verified: p.phone_verified ?? false,
        avatar_url: p.avatar_url,
        bio: p.bio,
        is_online: p.is_online ?? false,
        last_seen: p.last_seen,
      }));
      setProfiles(mappedProfiles);
      if (user) {
        const mine = mappedProfiles.find(p => p.id === user.id);
        if (mine) setMyProfile({
          id: mine.id,
          display_name: mine.display_name,
          username: mine.username,
          phone: mine.phone,
          phone_verified: mine.phone_verified ?? false,
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

    // Subscribe to real-time changes
    const channel = supabase
      .channel('profiles:*')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setProfiles((prev) => {
              const updatedProfile = {
                id: payload.new.id,
                display_name: payload.new.display_name,
                username: payload.new.username,
                phone: payload.new.phone,
                phone_verified: payload.new.phone_verified ?? false,
                avatar_url: payload.new.avatar_url,
                bio: payload.new.bio,
                is_online: payload.new.is_online ?? false,
                last_seen: payload.new.last_seen,
              };
              const index = prev.findIndex((p) => p.id === payload.new.id);
              if (index >= 0) {
                const newProfiles = [...prev];
                newProfiles[index] = updatedProfile;
                return newProfiles;
              }
              return [...prev, updatedProfile];
            });

            // Update myProfile if it's the current user
            if (user?.id === payload.new.id) {
              setMyProfile({
                id: payload.new.id,
                display_name: payload.new.display_name,
                username: payload.new.username,
                phone: payload.new.phone,
                phone_verified: payload.new.phone_verified ?? false,
                avatar_url: payload.new.avatar_url,
                bio: payload.new.bio,
                is_online: payload.new.is_online ?? false,
                last_seen: payload.new.last_seen,
              });
            }
          } else if (payload.eventType === 'INSERT') {
            const newProfile = {
              id: payload.new.id,
              display_name: payload.new.display_name,
              username: payload.new.username,
              phone: payload.new.phone,
              phone_verified: payload.new.phone_verified ?? false,
              avatar_url: payload.new.avatar_url,
              bio: payload.new.bio,
              is_online: payload.new.is_online ?? false,
              last_seen: payload.new.last_seen,
            };
            setProfiles((prev) => [...prev, newProfile]);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchProfiles, user?.id]);

  const updateMyProfile = async (updates: Partial<Profile>) => {
    if (!user) throw new Error("Not authenticated");
    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    if (error) throw error;
    await fetchProfiles();
  };

  const setOnlineStatus = useCallback(async (online: boolean) => {
    if (!user) return;

    // Avoid noisy toggles when the status has not changed.
    if (lastOnlineSentRef.current === online) return;

    await supabase
      .from("profiles")
      .update({ is_online: online, last_seen: new Date().toISOString() })
      .eq("id", user.id);
    lastOnlineSentRef.current = online;
  }, [user]);

  return { profiles, myProfile, loading, updateMyProfile, setOnlineStatus, fetchProfiles };
}
