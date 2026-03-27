import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useTypingIndicator(conversationId: string | null) {
  const { user } = useAuth();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPingAtRef = useRef(0);
  const isTypingRef = useRef(false);

  const clearTyping = useCallback(async () => {
    if (!user || !conversationId) return;
    isTypingRef.current = false;
    await supabase
      .from("typing_indicators")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
  }, [conversationId, user]);

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    void clearTyping();
  }, [clearTyping]);

  const setTyping = useCallback(() => {
    if (!user || !conversationId) return;

    const now = Date.now();
    const shouldPing = !isTypingRef.current || now - lastPingAtRef.current > 1200;

    if (shouldPing) {
      isTypingRef.current = true;
      lastPingAtRef.current = now;
      void supabase.from("typing_indicators").upsert(
        { conversation_id: conversationId, user_id: user.id },
        { onConflict: "conversation_id,user_id" }
      );
    }

    // Clear shortly after typing stops for snappier UX.
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      void clearTyping();
    }, 2200);
  }, [user, conversationId, clearTyping]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      void clearTyping();
    };
  }, [clearTyping]);

  return { setTyping, stopTyping };
}
