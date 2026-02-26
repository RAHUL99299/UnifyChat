import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  unread_count: number;
  is_online: boolean;
  is_typing: boolean;
  other_user_id: string | null;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    
    // Get conversations user participates in
    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!participations?.length) {
      setConversations([]);
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
      setLoading(false);
      return;
    }

    // For each conversation, get details
    const detailed = await Promise.all(
      convs.map(async (conv) => {
        // Get participants
        const { data: parts } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", conv.id);

        const otherUserId = parts?.find((p) => p.user_id !== user.id)?.user_id || null;

        // Get other user's profile for 1:1
        let displayName = conv.group_name || "Chat";
        let avatarInitials = "?";
        let avatarUrl: string | null = null;
        let isOnline = false;

        if (!conv.is_group && otherUserId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", otherUserId)
            .single();

          if (profile) {
            displayName = profile.display_name || profile.username || "User";
            avatarInitials = displayName
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            avatarUrl = profile.avatar_url;
            isOnline = profile.is_online ?? false;
          }
        } else if (conv.is_group) {
          avatarInitials = (conv.group_name || "G")
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
        }

        // Get last message
        const { data: lastMsgs } = await supabase
          .from("messages")
          .select("content, created_at, sender_id")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1);

        const lastMsg = lastMsgs?.[0];
        let lastMessage = "";
        let lastMessageTime = conv.updated_at || "";

        if (lastMsg) {
          lastMessage = lastMsg.content;
          lastMessageTime = lastMsg.created_at || "";
        }

        // Get unread count
        const { data: allMsgs } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", conv.id)
          .neq("sender_id", user.id);

        const { data: readReceipts } = await supabase
          .from("message_read_receipts")
          .select("message_id")
          .eq("user_id", user.id);

        const readIds = new Set(readReceipts?.map((r) => r.message_id) || []);
        const unreadCount = allMsgs?.filter((m) => !readIds.has(m.id)).length || 0;

        // Check typing
        const { data: typingData } = await supabase
          .from("typing_indicators")
          .select("user_id")
          .eq("conversation_id", conv.id)
          .neq("user_id", user.id);

        return {
          id: conv.id,
          is_group: conv.is_group ?? false,
          group_name: conv.group_name,
          group_avatar: conv.group_avatar,
          updated_at: conv.updated_at || "",
          display_name: displayName,
          avatar_initials: avatarInitials,
          avatar_url: avatarUrl,
          last_message: lastMessage,
          last_message_time: lastMessageTime,
          unread_count: unreadCount,
          is_online: isOnline,
          is_typing: (typingData?.length || 0) > 0,
          other_user_id: otherUserId,
        } as ConversationWithDetails;
      })
    );

    setConversations(detailed);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("conversations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        fetchConversations();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "typing_indicators" }, () => {
        fetchConversations();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

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

    // Create new conversation
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .insert({ is_group: false })
      .select()
      .single();

    if (convError || !conv) return null;

    await supabase.from("conversation_participants").insert([
      { conversation_id: conv.id, user_id: user.id },
      { conversation_id: conv.id, user_id: otherUserId },
    ]);

    fetchConversations();
    return conv.id;
  };

  return { conversations, loading, fetchConversations, createConversation };
}
