import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MessageWithSender {
  id: string;
  content: string;
  conversation_id: string;
  sender_id: string;
  message_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  sender_name: string;
  sender_avatar: string | null;
  is_outgoing: boolean;
  reply_to_id?: string;
  reply_to_content?: string;
  reply_to_sender?: string;
  reactions?: { emoji: string; user_id: string }[];
}

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) return;
    setLoading(true);

    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!msgs) {
      setMessages([]);
      setLoading(false);
      return;
    }

    // Get sender profiles
    const senderIds = [...new Set(msgs.map((m) => m.sender_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", senderIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    const enriched: MessageWithSender[] = msgs.map((m) => {
      const profile = profileMap.get(m.sender_id);
      return {
        id: m.id,
        content: m.content,
        conversation_id: m.conversation_id,
        sender_id: m.sender_id,
        message_type: m.message_type || "text",
        status: m.status || "sent",
        created_at: m.created_at || "",
        updated_at: m.updated_at || "",
        sender_name: profile?.display_name || "User",
        sender_avatar: profile?.avatar_url || null,
        is_outgoing: m.sender_id === user.id,
        reactions: [],
      };
    });

    setMessages(enriched);
    setLoading(false);

    // Mark messages as read
    const unreadIds = msgs
      .filter((m) => m.sender_id !== user.id)
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      const { data: existingReceipts } = await supabase
        .from("message_read_receipts")
        .select("message_id")
        .eq("user_id", user.id)
        .in("message_id", unreadIds);

      const alreadyRead = new Set(existingReceipts?.map((r) => r.message_id) || []);
      const toMark = unreadIds.filter((id) => !alreadyRead.has(id));

      if (toMark.length > 0) {
        await supabase.from("message_read_receipts").insert(
          toMark.map((id) => ({ message_id: id, user_id: user.id }))
        );
      }
    }
  }, [conversationId, user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, fetchMessages]);

  const sendMessage = async (content: string, messageType = "text") => {
    if (!user || !conversationId || !content.trim()) return;

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
      message_type: messageType,
    });

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  };

  const deleteMessage = async (messageId: string) => {
    await supabase.from("messages").delete().eq("id", messageId);
  };

  const editMessage = async (messageId: string, newContent: string) => {
    await supabase
      .from("messages")
      .update({ content: newContent })
      .eq("id", messageId);
  };

  return { messages, loading, sendMessage, deleteMessage, editMessage, fetchMessages };
}
