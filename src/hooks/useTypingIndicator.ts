import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useTypingIndicator(conversationId: string | null) {
  const { user } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setTyping = useCallback(async () => {
    if (!user || !conversationId) return;

    await supabase.from("typing_indicators").upsert(
      { conversation_id: conversationId, user_id: user.id },
      { onConflict: "conversation_id,user_id" }
    ).select();

    // Clear after 3s
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      await supabase
        .from("typing_indicators")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);
    }, 3000);
  }, [user, conversationId]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { setTyping };
}
