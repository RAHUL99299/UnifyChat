import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations } from "./useConversations";

export interface Status {
  id: string;
  user_id: string;
  content_type: "text" | "image" | "video";
  content: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_avatar?: string;
  viewed?: boolean;
  view_count?: number;
}

export interface StatusViewer {
  id: string;
  status_id: string;
  viewer_user_id: string;
  viewed_at: string;
  viewer_name?: string;
  viewer_avatar?: string | null;
}

const STATUS_MEDIA_BUCKET = "status-media";
const STATUS_UPDATED_EVENT = "unifychat-status-updated";

const getPathFromPublicUrl = (publicUrl: string) => {
  const marker = `/storage/v1/object/public/${STATUS_MEDIA_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
};

export const useStatuses = () => {
  const { user } = useAuth();
  const { conversations } = useConversations();
  const [myStatuses, setMyStatuses] = useState<Status[]>([]);
  const [otherStatuses, setOtherStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewedStatusIds, setViewedStatusIds] = useState<Set<string>>(new Set());
  const [viewersByStatus, setViewersByStatus] = useState<Record<string, StatusViewer[]>>({});

  const broadcastStatusUpdate = () => {
    window.dispatchEvent(new CustomEvent(STATUS_UPDATED_EVENT));
  };

  // Get users we're chatting with
  const chatContactIds = new Set(
    conversations
      .map((conv) => conv.other_user_id)
      .filter((id): id is string => id !== undefined && id !== null)
  );

  // Fetch my statuses
  const fetchMyStatuses = async () => {
    if (!user) return;
    try {
      const { data: statusRows, error } = await supabase
        .from("statuses")
        .select("*")
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      const myStatusesWithProfile = (statusRows || []).map((status) => ({
        ...status,
        user_name: myProfile?.display_name || "You",
        user_avatar: myProfile?.avatar_url || null,
      }));

      setMyStatuses(myStatusesWithProfile as Status[]);
    } catch (error) {
      console.error("Error fetching my statuses:", JSON.stringify(error));
    }
  };

  // Fetch statuses from contacts I'm chatting with
  const fetchContactStatuses = async () => {
    if (!user || chatContactIds.size === 0) return;
    try {
      const contactIdArray = Array.from(chatContactIds);

      const { data: statusRows, error } = await supabase
        .from("statuses")
        .select("*")
        .in("user_id", contactIdArray)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      const profileIds = Array.from(new Set((statusRows || []).map((row) => row.user_id)));
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", profileIds);

      if (profileError) throw profileError;

      const profileMap = new Map(
        (profileRows || []).map((profile) => [profile.id, profile])
      );

      const statusesWithProfiles = (statusRows || []).map((status) => ({
        ...status,
        user_name: profileMap.get(status.user_id)?.display_name,
        user_avatar: profileMap.get(status.user_id)?.avatar_url,
      }));

      setOtherStatuses(statusesWithProfiles as Status[]);
    } catch (error) {
      console.error("Error fetching contact statuses:", JSON.stringify(error));
    }
  };

  // Subscribe to real-time status updates
  useEffect(() => {
    if (!user) return;

    // Subscribe to my status changes
    const myStatusChannel = supabase
      .channel("my_statuses_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "statuses",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            setMyStatuses((prev) => prev.filter((s) => s.id !== payload.old.id));
          } else {
            await fetchMyStatuses();
          }
        }
      )
      .subscribe();

    // Subscribe to contact status changes
    const contactStatusChannel = supabase
      .channel("contact_statuses_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "statuses",
        },
        async (_payload) => {
          await fetchContactStatuses();
        }
      )
      .subscribe();

    return () => {
      myStatusChannel.unsubscribe();
      contactStatusChannel.unsubscribe();
    };
  }, [user?.id, chatContactIds.size]);

  // Fetch statuses on mount
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMyStatuses(), fetchContactStatuses()]).finally(() => {
      setLoading(false);
    });
  }, [user?.id, chatContactIds.size]);

  const fetchMyStatusViewers = async () => {
    if (!user || myStatuses.length === 0) {
      setViewersByStatus({});
      return;
    }

    const statusIds = myStatuses.map((status) => status.id);
    const { data: viewerRows, error: viewersError } = await supabase
      .from("status_viewers")
      .select("id, status_id, viewer_user_id, viewed_at")
      .in("status_id", statusIds)
      .order("viewed_at", { ascending: false });

    if (viewersError) {
      console.error("Error fetching status viewers:", viewersError);
      return;
    }

    const viewerIds = Array.from(new Set((viewerRows || []).map((row) => row.viewer_user_id)));
    let profileMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();

    if (viewerIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", viewerIds);

      if (!profileError) {
        profileMap = new Map(
          (profileRows || []).map((profile) => [
            profile.id,
            { display_name: profile.display_name, avatar_url: profile.avatar_url },
          ])
        );
      }
    }

    const grouped: Record<string, StatusViewer[]> = {};
    for (const row of viewerRows || []) {
      const profile = profileMap.get(row.viewer_user_id);
      const viewer: StatusViewer = {
        id: row.id,
        status_id: row.status_id,
        viewer_user_id: row.viewer_user_id,
        viewed_at: row.viewed_at,
        viewer_name: profile?.display_name || "User",
        viewer_avatar: profile?.avatar_url || null,
      };

      if (!grouped[row.status_id]) {
        grouped[row.status_id] = [];
      }
      grouped[row.status_id].push(viewer);
    }

    setViewersByStatus(grouped);
  };

  useEffect(() => {
    void fetchMyStatusViewers();
  }, [myStatuses.map((status) => status.id).join("|")]);

  useEffect(() => {
    const handleStatusUpdate = () => {
      void Promise.all([fetchMyStatuses(), fetchContactStatuses()]);
    };

    window.addEventListener(STATUS_UPDATED_EVENT, handleStatusUpdate);
    return () => {
      window.removeEventListener(STATUS_UPDATED_EVENT, handleStatusUpdate);
    };
  }, [user?.id, chatContactIds.size]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("status_viewers_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "status_viewers",
        },
        async (payload) => {
          const statusId = (payload.new as { status_id?: string })?.status_id;
          if (!statusId) return;
          if (!myStatuses.some((status) => status.id === statusId)) return;
          await fetchMyStatusViewers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, myStatuses.map((status) => status.id).join("|")]);

  // Fallback refresh: keeps seen counts fresh even if realtime publication is misconfigured.
  useEffect(() => {
    if (!user || myStatuses.length === 0) return;

    const intervalId = window.setInterval(() => {
      void fetchMyStatusViewers();
    }, 2500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user?.id, myStatuses.map((status) => status.id).join("|")]);

  // Mark status as viewed
  const markAsViewed = async (statusId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("status_viewers")
        .upsert({
          status_id: statusId,
          viewer_user_id: user.id,
        }, {
          onConflict: "status_id,viewer_user_id",
          ignoreDuplicates: true,
        });

      if (!error) {
        setViewedStatusIds((prev) => new Set([...prev, statusId]));
        broadcastStatusUpdate();
      }
    } catch (error) {
      console.error("Error marking status as viewed:", error);
    }
  };

  // Create a new status
  const createStatus = async (
    content_type: "text" | "image" | "video",
    content: string
  ) => {
    if (!user) return null;
    try {
      const newStatus: Status = {
        id: crypto.randomUUID(),
        user_id: user.id,
        content_type,
        content: content,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Create the status (no select here to avoid failures when SELECT policy is misconfigured)
      const { error: statusError } = await supabase
        .from("statuses")
        .insert(newStatus);

      if (statusError) {
        console.error("Status creation error:", statusError);
        throw statusError;
      }

      // Automatically make visible to all contacts you're chatting with
      const contactIds = Array.from(chatContactIds);
      if (contactIds.length > 0) {
        const visibilityRecords = contactIds.map((userId) => ({
          status_id: newStatus.id,
          visible_to_user_id: userId,
        }));

        const { error: visibilityError } = await supabase
          .from("status_visibility")
          .insert(visibilityRecords);

        if (visibilityError) {
          console.error("Visibility error:", visibilityError);
          // Keep the status instead of failing whole upload when visibility metadata fails.
        }
      }

      // Optimistic local update for immediate feedback.
      setMyStatuses((prev) => [newStatus, ...prev]);
      broadcastStatusUpdate();
      await fetchMyStatuses();
      return newStatus;
    } catch (error) {
      console.error("Error creating status:", error);
      return null;
    }
  };

  const uploadStatusMedia = async (file: File, mediaType: "image" | "video") => {
    if (!user) return null;

    const fileExt = file.name.split(".").pop() || (mediaType === "image" ? "jpg" : "mp4");
    const objectPath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(STATUS_MEDIA_BUCKET)
      .upload(objectPath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Status media upload error:", uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from(STATUS_MEDIA_BUCKET)
      .getPublicUrl(objectPath);

    return data.publicUrl;
  };

  // Delete a status
  const deleteStatus = async (statusId: string) => {
    if (!user) return false;
    try {
      const targetStatus = myStatuses.find((status) => status.id === statusId);

      const { error } = await supabase
        .from("statuses")
        .delete()
        .eq("id", statusId)
        .eq("user_id", user.id);

      if (error) throw error;

      setMyStatuses((prev) => prev.filter((s) => s.id !== statusId));
      broadcastStatusUpdate();

      if (targetStatus && (targetStatus.content_type === "image" || targetStatus.content_type === "video")) {
        const objectPath = getPathFromPublicUrl(targetStatus.content);
        if (objectPath) {
          await supabase.storage.from(STATUS_MEDIA_BUCKET).remove([objectPath]);
        }
      }

      return true;
    } catch (error) {
      console.error("Error deleting status:", error);
      return false;
    }
  };

  return {
    myStatuses,
    otherStatuses,
    loading,
    viewedStatusIds,
    viewersByStatus,
    createStatus,
    uploadStatusMedia,
    deleteStatus,
    markAsViewed,
    getStatusViewers: (statusId: string) => viewersByStatus[statusId] || [],
    getStatusViewCount: (statusId: string) => (viewersByStatus[statusId] || []).length,
    refreshStatuses: () => Promise.all([fetchMyStatuses(), fetchContactStatuses()]),
  };
};
