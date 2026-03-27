import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatSidebarMessagePreview, getMessagePreviewText } from "@/lib/messageContent";

export interface ConversationLastMessage {
  text: string;
  preview: string;
  senderId: string | null;
  status: "sent" | "delivered" | "read";
  timestamp: string;
  isOutgoing: boolean;
}

export interface ConversationWithDetails {
  id: string;
  is_group: boolean;
  group_name: string | null;
  group_avatar: string | null;
  updated_at: string;
  // Derived
  display_name: string;
  avatar_initials: string;
  avatar_url: string | null;
  last_message: string;
  last_message_time: string;
  last_message_details: ConversationLastMessage | null;
  unread_count: number;
  is_online: boolean;
  other_user_last_seen: string | null;
  is_typing: boolean;
  typing_users: { user_id: string; name: string }[];
  other_user_id: string | null;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const profileNameByIdRef = useRef<Map<string, string>>(new Map());

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    if (!hasLoadedRef.current) {
      setLoading(true);
    }

    // Get conversations user participates in
    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!participations?.length) {
      setConversations([]);
      hasLoadedRef.current = true;
      setLoading(false);
      return;
    }

    const convIds = participations.map((p) => p.conversation_id);

    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .in("id", convIds)
      .order("updated_at", { ascending: false });

    if (!convs) {
      setConversations([]);
      hasLoadedRef.current = true;
      setLoading(false);
      return;
    }

    const initialsFrom = (name: string) =>
      name
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?";

    const [partsResult, allMsgsResult, readReceiptsResult, typingResult] = await Promise.all([
      supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds),
      supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, message_type, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("message_read_receipts")
        .select("message_id")
        .eq("user_id", user.id),
      supabase
        .from("typing_indicators")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds)
        .neq("user_id", user.id),
    ]);

    const participants = partsResult.data || [];
    const allMessages = allMsgsResult.data || [];
    const readReceipts = readReceiptsResult.data || [];
    const typingData = typingResult.data || [];

    const participantsByConversation = new Map<string, string[]>();
    for (const part of participants) {
      const current = participantsByConversation.get(part.conversation_id) || [];
      current.push(part.user_id);
      participantsByConversation.set(part.conversation_id, current);
    }

    const otherUserIds = Array.from(
      new Set(
        convs
          .filter((conv) => !conv.is_group)
          .map((conv) => participantsByConversation.get(conv.id)?.find((id) => id !== user.id) || null)
          .filter((id): id is string => !!id)
      )
    );

    const typingUserIds = Array.from(
      new Set(
        typingData
          .map((typing) => typing.user_id)
          .filter((id): id is string => !!id)
      )
    );

    const profileIdsToLoad = Array.from(new Set([...otherUserIds, ...typingUserIds]));

    const { data: profiles } = profileIdsToLoad.length
      ? await supabase
          .from("profiles")
          .select("id, display_name, username, phone, avatar_url, is_online, last_seen")
          .in("id", profileIdsToLoad)
      : { data: [] as any[] };

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    for (const profile of profiles || []) {
      const profileName = profile.display_name || profile.username || "User";
      profileNameByIdRef.current.set(profile.id, profileName);
    }

    const latestMessageByConversation = new Map<string, {
      content: string | null;
      message_type: string | null;
      created_at: string | null;
      sender_id: string | null;
      status: string | null;
    }>();
    for (const msg of allMessages) {
      if (!latestMessageByConversation.has(msg.conversation_id)) {
        latestMessageByConversation.set(msg.conversation_id, {
          content: msg.content,
          message_type: msg.message_type,
          created_at: msg.created_at,
          sender_id: msg.sender_id,
          status: msg.status,
        });
      }
    }

    const readIds = new Set(readReceipts.map((r) => r.message_id));
    const unreadCountByConversation = new Map<string, number>();
    for (const msg of allMessages) {
      if (msg.sender_id === user.id) continue;
      if (readIds.has(msg.id)) continue;
      unreadCountByConversation.set(
        msg.conversation_id,
        (unreadCountByConversation.get(msg.conversation_id) || 0) + 1
      );
    }

    const typingUsersByConversation = new Map<string, { user_id: string; name: string }[]>();
    for (const typing of typingData) {
      if (!typing.user_id) continue;
      const profile = profileMap.get(typing.user_id);
      const name = profile?.display_name || profile?.username || profileNameByIdRef.current.get(typing.user_id) || "User";
      const current = typingUsersByConversation.get(typing.conversation_id) || [];
      if (!current.some((entry) => entry.user_id === typing.user_id)) {
        current.push({ user_id: typing.user_id, name });
      }
      typingUsersByConversation.set(typing.conversation_id, current);
    }

    const detailed = convs.map((conv) => {
      const otherUserId = participantsByConversation.get(conv.id)?.find((id) => id !== user.id) || null;
      const profile = otherUserId ? profileMap.get(otherUserId) : null;

      let displayName = conv.group_name || "Chat";
      let avatarInitials = "?";
      let avatarUrl: string | null = null;
      let isOnline = false;
      let otherUserLastSeen: string | null = null;

      if (!conv.is_group && profile) {
        const baseName = profile.display_name || profile.username || "User";
        const phoneSuffix = profile.phone ? ` (${profile.phone})` : "";
        displayName = `${baseName}${phoneSuffix}`;
        avatarInitials = initialsFrom(displayName);
        avatarUrl = profile.avatar_url;
        isOnline = profile.is_online ?? false;
        otherUserLastSeen = profile.last_seen ?? null;
      } else if (conv.is_group) {
        avatarInitials = initialsFrom(conv.group_name || "Group");
      }

      const latest = latestMessageByConversation.get(conv.id);
      const typingUsers = typingUsersByConversation.get(conv.id) || [];
      const lastMessageDetails = latest?.content
        ? {
            text: latest.content,
            preview: formatSidebarMessagePreview(latest.message_type || "text", latest.content),
            senderId: latest.sender_id || null,
            status: (latest.status === "read" || latest.status === "delivered" ? latest.status : "sent") as "sent" | "delivered" | "read",
            timestamp: latest.created_at || conv.updated_at || "",
            isOutgoing: latest.sender_id === user.id,
          }
        : null;

      return {
        id: conv.id,
        is_group: conv.is_group ?? false,
        group_name: conv.group_name,
        group_avatar: conv.group_avatar,
        updated_at: conv.updated_at || "",
        display_name: displayName,
        avatar_initials: avatarInitials,
        avatar_url: avatarUrl,
        last_message: latest?.content
          ? getMessagePreviewText(latest.message_type || "text", latest.content)
          : "",
        last_message_time: latest?.created_at || conv.updated_at || "",
        last_message_details: lastMessageDetails,
        unread_count: unreadCountByConversation.get(conv.id) || 0,
        is_online: isOnline,
        other_user_last_seen: otherUserLastSeen,
        is_typing: typingUsers.length > 0,
        typing_users: typingUsers,
        other_user_id: otherUserId,
      } as ConversationWithDetails;
    });

    setConversations(detailed);
    hasLoadedRef.current = true;
    setLoading(false);
  }, [user]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      fetchConversations();
    }, 120);
  }, [fetchConversations]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      for (const timer of typingClearTimersRef.current.values()) {
        clearTimeout(timer);
      }
      typingClearTimersRef.current.clear();
    };
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("conversations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        scheduleRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "typing_indicators" }, (payload) => {
        const typingConversationId =
          (payload.new as { conversation_id?: string } | null)?.conversation_id ||
          (payload.old as { conversation_id?: string } | null)?.conversation_id;

        if (!typingConversationId) return;

        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const typingUserId = (payload.new as { user_id?: string } | null)?.user_id;
          if (!typingUserId || typingUserId === user.id) return;

          const pendingClearTimer = typingClearTimersRef.current.get(typingConversationId);
          if (pendingClearTimer) {
            clearTimeout(pendingClearTimer);
            typingClearTimersRef.current.delete(typingConversationId);
          }

          const typingUserName = profileNameByIdRef.current.get(typingUserId) || "Someone";
          setConversations((prev) =>
            prev.map((conversation) =>
              conversation.id === typingConversationId
                ? {
                    ...conversation,
                    is_typing: true,
                    typing_users: conversation.typing_users.some((entry) => entry.user_id === typingUserId)
                      ? conversation.typing_users
                      : [...conversation.typing_users, { user_id: typingUserId, name: typingUserName }],
                  }
                : conversation
            )
          );

          if (!profileNameByIdRef.current.has(typingUserId)) {
            void supabase
              .from("profiles")
              .select("id, display_name, username")
              .eq("id", typingUserId)
              .maybeSingle()
              .then((result) => {
                const profile = result.data;
                if (!profile) return;
                const resolvedName = profile.display_name || profile.username || "User";
                profileNameByIdRef.current.set(profile.id, resolvedName);
                setConversations((prev) =>
                  prev.map((conversation) => {
                    if (conversation.id !== typingConversationId) return conversation;
                    return {
                      ...conversation,
                      typing_users: conversation.typing_users.map((entry) =>
                        entry.user_id === typingUserId ? { ...entry, name: resolvedName } : entry
                      ),
                    };
                  })
                );
              });
          }

          return;
        }

        const removedTypingUserId = (payload.old as { user_id?: string } | null)?.user_id;

        const existingTimer = typingClearTimersRef.current.get(typingConversationId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const clearTimer = setTimeout(() => {
          setConversations((prev) =>
            prev.map((conversation) =>
              conversation.id === typingConversationId
                ? {
                    ...conversation,
                    typing_users: removedTypingUserId
                      ? conversation.typing_users.filter((entry) => entry.user_id !== removedTypingUserId)
                      : [],
                    is_typing: removedTypingUserId
                      ? conversation.typing_users.some((entry) => entry.user_id !== removedTypingUserId)
                      : false,
                  }
                : conversation
            )
          );
          typingClearTimersRef.current.delete(typingConversationId);
        }, 350);

        typingClearTimersRef.current.set(typingConversationId, clearTimer);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        const profile = (payload.new as {
          id?: string;
          display_name?: string | null;
          username?: string | null;
          phone?: string | null;
          is_online?: boolean | null;
          last_seen?: string | null;
        } | null) || (payload.old as { id?: string } | null);

        if (!profile?.id) return;

        const profileName = profile.display_name || profile.username || "User";
        profileNameByIdRef.current.set(profile.id, profileName);

        setConversations((prev) =>
          prev.map((conversation) => {
            const typingUsers = conversation.typing_users.map((entry) =>
              entry.user_id === profile.id ? { ...entry, name: profileName } : entry
            );

            if (conversation.is_group || conversation.other_user_id !== profile.id) {
              return {
                ...conversation,
                typing_users: typingUsers,
              };
            }

            const baseName = profile.display_name || profile.username || conversation.display_name || "User";
            const phoneSuffix = profile.phone ? ` (${profile.phone})` : "";
            const displayName = `${baseName}${phoneSuffix}`;

            return {
              ...conversation,
              display_name: displayName,
              avatar_initials:
                displayName
                  .split(" ")
                  .filter(Boolean)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || conversation.avatar_initials,
              is_online: profile.is_online ?? conversation.is_online,
              other_user_last_seen: profile.last_seen ?? conversation.other_user_last_seen,
              typing_users: typingUsers,
            };
          })
        );
      })
      .subscribe();

    return () => {
      for (const timer of typingClearTimersRef.current.values()) {
        clearTimeout(timer);
      }
      typingClearTimersRef.current.clear();
      supabase.removeChannel(channel);
    };
  }, [user, scheduleRefresh]);

  const createConversation = async (otherUserId: string) => {
    if (!user) return null;

    // Check if 1:1 conversation already exists
    const { data: myConvs } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (myConvs) {
      for (const mc of myConvs) {
        const { data: parts } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", mc.conversation_id);

        if (parts?.length === 2 && parts.some((p) => p.user_id === otherUserId)) {
          return mc.conversation_id;
        }
      }
    }

    // Create new conversation – generate ID client-side so we don't need
    // a SELECT that would be blocked by the RLS participant check.
    const newId = crypto.randomUUID();
    const { error: convError } = await supabase
      .from("conversations")
      .insert({ id: newId, is_group: false });

    if (convError) return null;

    const { error: partError } = await supabase
      .from("conversation_participants")
      .insert([
        { conversation_id: newId, user_id: user.id },
        { conversation_id: newId, user_id: otherUserId },
      ]);

    if (partError) return null;

    await fetchConversations();
    return newId;
  };

  const deleteConversation = async (conversationId: string) => {
    if (!user) return false;

    try {
      // Delete all messages in the conversation first
      const { error: msgError } = await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", conversationId);

      if (msgError) throw msgError;

      // Delete all participants
      const { error: partError } = await supabase
        .from("conversation_participants")
        .delete()
        .eq("conversation_id", conversationId);

      if (partError) throw partError;

      // Delete the conversation
      const { error: convError } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId);

      if (convError) throw convError;

      // Update local state immediately
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      return true;
    } catch (error: any) {
      console.error("Failed to delete conversation:", error?.message);
      return false;
    }
  };

  return { conversations, loading, fetchConversations, createConversation, deleteConversation };
}
