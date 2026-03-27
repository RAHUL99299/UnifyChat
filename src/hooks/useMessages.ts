import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getMessagePreviewText } from "@/lib/messageContent";
import { showIncomingMessageNotification } from "@/lib/browserNotifications";

const messageCache = new Map<string, MessageWithSender[]>();
const senderProfileCache = new Map<string, { display_name: string | null; avatar_url: string | null }>();

const inFlightConversationLoads = new Map<string, Promise<MessageWithSender[]>>();

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
  reply_to_raw_content?: string;
  reply_to_message_type?: string;
  reactions?: { emoji: string; user_id: string }[];
}

interface SendMessageOptions {
  replyTo?: Pick<MessageWithSender, "id" | "content" | "message_type" | "sender_name"> | null;
}

const MEDIA_MESSAGE_TYPES = ["image", "gif", "video"] as const;

const applyReceiptStatus = (
  messages: MessageWithSender[],
  readByOthersIds: Set<string>,
  isRecipientOnline: boolean
) => {
  return messages.map((message) => {
    if (!message.is_outgoing) return message;

    if (readByOthersIds.has(message.id)) {
      return { ...message, status: "read" };
    }

    return { ...message, status: isRecipientOnline ? "delivered" : "sent" };
  });
};

const getCachedMessages = (conversationId: string) => messageCache.get(conversationId) || null;

const enrichReplyData = (
  messages: Array<{
    id: string;
    content: string;
    conversation_id: string;
    sender_id: string;
    message_type: string | null;
    status: string | null;
    created_at: string | null;
    updated_at: string | null;
    reply_to_id?: string | null;
  }>,
  userId: string,
  profileMap: Map<string, { display_name: string | null; avatar_url: string | null }>
): MessageWithSender[] => {
  const messageMap = new Map(messages.map((message) => [message.id, message]));

  return messages.map((message) => {
    const profile = profileMap.get(message.sender_id);
    const replyTarget = message.reply_to_id ? messageMap.get(message.reply_to_id) : null;
    const replyProfile = replyTarget ? profileMap.get(replyTarget.sender_id) : null;

    return {
      id: message.id,
      content: message.content,
      conversation_id: message.conversation_id,
      sender_id: message.sender_id,
      message_type: message.message_type || "text",
      status: message.status || "sent",
      created_at: message.created_at || "",
      updated_at: message.updated_at || "",
      sender_name: profile?.display_name || "User",
      sender_avatar: profile?.avatar_url || null,
      is_outgoing: message.sender_id === userId,
      reply_to_id: message.reply_to_id || undefined,
      reply_to_content: replyTarget
        ? getMessagePreviewText(replyTarget.message_type || "text", replyTarget.content)
        : undefined,
      reply_to_sender: replyTarget
        ? replyTarget.sender_id === userId
          ? "You"
          : replyProfile?.display_name || "User"
        : undefined,
      reply_to_raw_content: replyTarget?.content || undefined,
      reply_to_message_type: replyTarget?.message_type || undefined,
      reactions: [],
    };
  });
};

const sortMessages = (messages: MessageWithSender[]) =>
  [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

const setConversationCache = (conversationId: string, messages: MessageWithSender[]) => {
  messageCache.set(conversationId, sortMessages(messages));
};

const fetchProfilesIfNeeded = async (senderIds: string[]) => {
  const missingSenderIds = senderIds.filter((id) => !senderProfileCache.has(id));

  if (missingSenderIds.length > 0) {
    const { data: fetchedProfiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", missingSenderIds);

    for (const profile of fetchedProfiles || []) {
      senderProfileCache.set(profile.id, {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      });
    }
  }

  return new Map(
    senderIds
      .map((id) => {
        const profile = senderProfileCache.get(id);
        if (!profile) return null;
        return [id, profile] as const;
      })
      .filter((entry): entry is readonly [string, { display_name: string | null; avatar_url: string | null }] => !!entry)
  );
};

const fetchAndCacheConversationMessages = async (
  conversationId: string,
  userId: string
): Promise<MessageWithSender[]> => {
  const inFlight = inFlightConversationLoads.get(conversationId);
  if (inFlight) return inFlight;

  const loadPromise = (async () => {
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!msgs) {
      messageCache.set(conversationId, []);
      return [];
    }

    const senderIds = [...new Set(msgs.map((m) => m.sender_id))];
    const profileMap = await fetchProfilesIfNeeded(senderIds);

    const enriched = enrichReplyData(msgs, userId, profileMap);

    setConversationCache(conversationId, enriched);
    return enriched;
  })();

  inFlightConversationLoads.set(conversationId, loadPromise);

  try {
    return await loadPromise;
  } finally {
    inFlightConversationLoads.delete(conversationId);
  }
};

export async function prefetchConversationMessages(conversationId: string, userId: string) {
  if (!conversationId || !userId) return;
  if (getCachedMessages(conversationId)) return;
  await fetchAndCacheConversationMessages(conversationId, userId);
}

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(false);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [isRecipientOnline, setIsRecipientOnline] = useState(false);
  const messagesRef = useRef<MessageWithSender[]>([]);
  const readByOthersIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!conversationId || !user) {
      setRecipientId(null);
      setIsRecipientOnline(false);
      return;
    }

    let alive = true;

    const loadRecipient = async () => {
      const { data: participant } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", user.id)
        .maybeSingle();

      const nextRecipientId = participant?.user_id || null;
      if (!alive) return;
      setRecipientId(nextRecipientId);

      if (!nextRecipientId) {
        setIsRecipientOnline(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_online")
        .eq("id", nextRecipientId)
        .maybeSingle();

      if (!alive) return;
      setIsRecipientOnline(Boolean(profile?.is_online));
    };

    void loadRecipient();

    return () => {
      alive = false;
    };
  }, [conversationId, user]);

  useEffect(() => {
    if (!recipientId) return;

    const profileChannel = supabase
      .channel(`recipient-profile-${recipientId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${recipientId}`,
        },
        (payload) => {
          const nextOnline = Boolean((payload.new as { is_online?: boolean | null })?.is_online);
          setIsRecipientOnline(nextOnline);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [recipientId]);

  useEffect(() => {
    if (!conversationId) return;
    setMessages((prev) => {
      const next = applyReceiptStatus(prev, readByOthersIdsRef.current, isRecipientOnline);
      setConversationCache(conversationId, next);
      return next;
    });
  }, [conversationId, isRecipientOnline]);

  const markMessagesAsRead = useCallback(
    async (messageIds: string[]) => {
      if (!user || messageIds.length === 0) return;

      const { data: existingReceipts } = await supabase
        .from("message_read_receipts")
        .select("message_id")
        .eq("user_id", user.id)
        .in("message_id", messageIds);

      const alreadyRead = new Set(existingReceipts?.map((receipt) => receipt.message_id) || []);
      const toMark = messageIds.filter((id) => !alreadyRead.has(id));

      if (toMark.length > 0) {
        await supabase
          .from("message_read_receipts")
          .insert(toMark.map((id) => ({ message_id: id, user_id: user.id })));
      }
    },
    [user]
  );

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) return;

    const cached = getCachedMessages(conversationId);
    if (cached) {
      setMessages(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const enriched = await fetchAndCacheConversationMessages(conversationId, user.id);

    const outgoingIds = enriched
      .filter((message) => message.is_outgoing)
      .map((message) => message.id);

    let readByOthersIds = new Set<string>();
    if (outgoingIds.length > 0) {
      const { data: readReceipts } = await supabase
        .from("message_read_receipts")
        .select("message_id, user_id")
        .in("message_id", outgoingIds)
        .neq("user_id", user.id);

      readByOthersIds = new Set((readReceipts || []).map((receipt) => receipt.message_id));
    }

    readByOthersIdsRef.current = readByOthersIds;

    const statusAware = applyReceiptStatus(enriched, readByOthersIds, isRecipientOnline);
    setMessages(statusAware);
    setConversationCache(conversationId, statusAware);
    setLoading(false);

    // Mark messages as read
    const unreadIds = enriched
      .filter((m) => m.sender_id !== user.id)
      .map((m) => m.id);

    await markMessagesAsRead(unreadIds);
  }, [conversationId, markMessagesAsRead, user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime
  useEffect(() => {
    if (!conversationId || !user) return;

    const upsertIncomingMessage = async (payload: { new: any }) => {
      const row = payload.new;
      if (!row || row.conversation_id !== conversationId) return;

      let profile = senderProfileCache.get(row.sender_id);
      if (!profile) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .eq("id", row.sender_id)
          .maybeSingle();

        if (profileData) {
          profile = {
            display_name: profileData.display_name,
            avatar_url: profileData.avatar_url,
          };
          senderProfileCache.set(row.sender_id, profile);
        }
      }

      const incoming: MessageWithSender = {
        id: row.id,
        content: row.content,
        conversation_id: row.conversation_id,
        sender_id: row.sender_id,
        message_type: row.message_type || "text",
        status: row.status || "sent",
        created_at: row.created_at || "",
        updated_at: row.updated_at || "",
        sender_name: profile?.display_name || "User",
        sender_avatar: profile?.avatar_url || null,
        is_outgoing: row.sender_id === user.id,
        reply_to_id: row.reply_to_id || undefined,
        reply_to_content: undefined,
        reply_to_sender: undefined,
        reply_to_raw_content: undefined,
        reply_to_message_type: undefined,
        reactions: [],
      };

      setMessages((prev) => {
        const replyTarget = row.reply_to_id ? prev.find((message) => message.id === row.reply_to_id) : null;
        const existingIndex = prev.findIndex((m) => m.id === incoming.id);
        const next = existingIndex >= 0 ? [...prev] : [...prev, incoming];
        if (existingIndex >= 0) {
          next[existingIndex] = {
            ...incoming,
            reply_to_content: replyTarget
              ? getMessagePreviewText(replyTarget.message_type, replyTarget.content)
              : incoming.reply_to_content,
            reply_to_sender: replyTarget
              ? replyTarget.sender_id === user.id
                ? "You"
                : replyTarget.sender_name
              : incoming.reply_to_sender,
            reply_to_raw_content: replyTarget?.content,
            reply_to_message_type: replyTarget?.message_type,
          };
        } else {
          next[next.length - 1] = {
            ...incoming,
            reply_to_content: replyTarget
              ? getMessagePreviewText(replyTarget.message_type, replyTarget.content)
              : incoming.reply_to_content,
            reply_to_sender: replyTarget
              ? replyTarget.sender_id === user.id
                ? "You"
                : replyTarget.sender_name
              : incoming.reply_to_sender,
            reply_to_raw_content: replyTarget?.content,
            reply_to_message_type: replyTarget?.message_type,
          };
        }

        const sorted = sortMessages(next);
        const statusAware = applyReceiptStatus(sorted, readByOthersIdsRef.current, isRecipientOnline);
        setConversationCache(conversationId, statusAware);
        return statusAware;
      });

      if (row.sender_id !== user.id) {
        showIncomingMessageNotification({
          userId: user.id,
          messageId: row.id,
          senderName: incoming.sender_name,
          content: incoming.content,
          messageType: incoming.message_type,
          conversationId,
        });
        await markMessagesAsRead([row.id]);
      }
    };

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        upsertIncomingMessage
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_read_receipts",
        },
        (payload) => {
          const receipt = payload.new as { message_id?: string; user_id?: string };
          if (!receipt.message_id || !receipt.user_id || receipt.user_id === user.id) return;

          const currentMessages = messagesRef.current;
          if (!currentMessages.some((message) => message.id === receipt.message_id && message.is_outgoing)) {
            return;
          }

          setMessages((prev) => {
            const nextReadIds = new Set(readByOthersIdsRef.current);
            nextReadIds.add(receipt.message_id as string);
            readByOthersIdsRef.current = nextReadIds;

            const next = applyReceiptStatus(prev, readByOthersIdsRef.current, isRecipientOnline);
            setConversationCache(conversationId, next);
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        fetchMessages
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        fetchMessages
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, fetchMessages, isRecipientOnline, markMessagesAsRead, user]);

  const sendMessage = async (content: string, messageType = "text", options?: SendMessageOptions) => {
    if (!user || !conversationId || !content.trim()) return;

    const trimmed = content.trim();
    const messageId = crypto.randomUUID();
    const optimistic: MessageWithSender = {
      id: messageId,
      content: trimmed,
      conversation_id: conversationId,
      sender_id: user.id,
      message_type: messageType,
      status: "sent",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sender_name: user.user_metadata?.display_name || user.email || "You",
      sender_avatar: null,
      is_outgoing: true,
      reply_to_id: options?.replyTo?.id || undefined,
      reply_to_content: options?.replyTo
        ? getMessagePreviewText(options.replyTo.message_type || "text", options.replyTo.content)
        : undefined,
      reply_to_sender: options?.replyTo?.sender_name || undefined,
      reply_to_raw_content: options?.replyTo?.content || undefined,
      reply_to_message_type: options?.replyTo?.message_type || undefined,
      reactions: [],
    };

    setMessages((prev) => {
      const next = sortMessages([...prev, optimistic]);
      setConversationCache(conversationId, next);
      return next;
    });

    const { error } = await supabase.from("messages").insert({
      id: messageId,
      conversation_id: conversationId,
      sender_id: user.id,
      content: trimmed,
      message_type: messageType,
      reply_to_id: options?.replyTo?.id || null,
    });

    if (error) {
      setMessages((prev) => {
        const next = prev.filter((message) => message.id !== messageId);
        setConversationCache(conversationId, next);
        return next;
      });
      throw error;
    }

    void supabase.functions
      .invoke("send_push_message", {
        body: {
          conversationId,
          messageId,
        },
      })
      .catch(() => {
        // Push delivery failures should not affect message sending.
      });

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  };

  const deleteMessage = async (messageId: string) => {
    if (!conversationId) return;

    const previousMessages = getCachedMessages(conversationId) || messages;
    const nextMessages = previousMessages.filter((message) => message.id !== messageId);

    setMessages(nextMessages);
    setConversationCache(conversationId, nextMessages);

    const { error } = await supabase.from("messages").delete().eq("id", messageId);

    if (error) {
      setMessages(previousMessages);
      setConversationCache(conversationId, previousMessages);
      throw error;
    }
  };

  const editMessage = async (messageId: string, newContent: string) => {
    await supabase
      .from("messages")
      .update({ content: newContent })
      .eq("id", messageId);
  };

  const clearChat = async () => {
    if (!conversationId) return 0;

    const previousMessages = getCachedMessages(conversationId) || messages;
    const removableIds = new Set(
      previousMessages
        .filter((message) => message.is_outgoing)
        .map((message) => message.id)
    );

    if (removableIds.size === 0) {
      return 0;
    }

    const nextMessages = previousMessages.filter((message) => !removableIds.has(message.id));
    setMessages(nextMessages);
    setConversationCache(conversationId, nextMessages);

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId);

    if (error) {
      setMessages(previousMessages);
      setConversationCache(conversationId, previousMessages);
      throw error;
    }

    return removableIds.size;
  };

  const clearMedia = async () => {
    if (!conversationId) return 0;

    const previousMessages = getCachedMessages(conversationId) || messages;
    const removableIds = new Set(
      previousMessages
        .filter((message) => message.is_outgoing && MEDIA_MESSAGE_TYPES.includes(message.message_type as typeof MEDIA_MESSAGE_TYPES[number]))
        .map((message) => message.id)
    );

    if (removableIds.size === 0) {
      return 0;
    }

    const nextMessages = previousMessages.filter((message) => !removableIds.has(message.id));
    setMessages(nextMessages);
    setConversationCache(conversationId, nextMessages);

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId)
      .in("message_type", [...MEDIA_MESSAGE_TYPES]);

    if (error) {
      setMessages(previousMessages);
      setConversationCache(conversationId, previousMessages);
      throw error;
    }

    return removableIds.size;
  };

  return { messages, loading, sendMessage, deleteMessage, editMessage, clearChat, clearMedia, fetchMessages };
}
