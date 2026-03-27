import { serve } from "https://deno.land/std@0.201.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const WEB_PUSH_VAPID_PUBLIC_KEY = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY") || "";
const WEB_PUSH_VAPID_PRIVATE_KEY = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY") || "";
const WEB_PUSH_SUBJECT = Deno.env.get("WEB_PUSH_SUBJECT") || "mailto:notifications@unifychat.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { global: { headers: {} } });

const getMessagePreviewText = (messageType: string | null, content: string | null) => {
  const trimmed = (content || "").trim();

  if (messageType === "image") return "Photo";
  if (messageType === "gif") return "GIF";
  if (messageType === "video") return "Video";
  if (messageType === "audio") return "Voice message";
  if (messageType === "file") return "File";

  return trimmed || "New message";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    if (!WEB_PUSH_VAPID_PUBLIC_KEY || !WEB_PUSH_VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: "missing_vapid_keys" }), { status: 500, headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing_auth" }), { status: 401, headers: corsHeaders });
    }

    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    const {
      data: { user },
      error: authError,
    } = await serviceClient.auth.getUser(accessToken);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const conversationId = String(body.conversationId || "").trim();
    const messageId = String(body.messageId || "").trim();

    if (!conversationId || !messageId) {
      return new Response(JSON.stringify({ error: "conversationId and messageId are required" }), { status: 400, headers: corsHeaders });
    }

    const { data: message, error: messageError } = await serviceClient
      .from("messages")
      .select("id, conversation_id, sender_id, content, message_type")
      .eq("id", messageId)
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (messageError) throw messageError;
    if (!message) {
      return new Response(JSON.stringify({ error: "message_not_found" }), { status: 404, headers: corsHeaders });
    }

    if (message.sender_id !== user.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { data: senderProfile } = await serviceClient
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    const senderName = senderProfile?.display_name || "New message";

    const { data: participants, error: participantsError } = await serviceClient
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .neq("user_id", user.id);

    if (participantsError) throw participantsError;

    const recipientIds = (participants || []).map((p) => p.user_id).filter(Boolean);
    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: 0 }), { headers: corsHeaders });
    }

    const { data: settingsRows } = await serviceClient
      .from("user_settings")
      .select("user_id, settings")
      .in("user_id", recipientIds);

    const msgNotificationEnabled = new Map<string, boolean>();
    for (const recipientId of recipientIds) {
      msgNotificationEnabled.set(recipientId, true);
    }

    for (const row of settingsRows || []) {
      const enabled = row?.settings?.notifications?.msgNotify !== false;
      msgNotificationEnabled.set(row.user_id, enabled);
    }

    const targetRecipientIds = recipientIds.filter((recipientId) => msgNotificationEnabled.get(recipientId) !== false);

    if (targetRecipientIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: recipientIds.length }), { headers: corsHeaders });
    }

    const { data: recipientProfiles } = await serviceClient
      .from("profiles")
      .select("id, is_online")
      .in("id", targetRecipientIds);

    const offlineRecipientIds = targetRecipientIds.filter((recipientId) => {
      const profile = (recipientProfiles || []).find((row) => row.id === recipientId);
      return !profile?.is_online;
    });

    if (offlineRecipientIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: targetRecipientIds.length }), { headers: corsHeaders });
    }

    const { data: subscriptions, error: subscriptionsError } = await serviceClient
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", offlineRecipientIds)
      .eq("is_active", true);

    if (subscriptionsError) throw subscriptionsError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: targetRecipientIds.length }), { headers: corsHeaders });
    }

    webpush.setVapidDetails(WEB_PUSH_SUBJECT, WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY);

    let sent = 0;
    let failed = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        if (!sub.endpoint || !sub.p256dh || !sub.auth) {
          failed += 1;
          return;
        }

        const payload = JSON.stringify({
          title: senderName,
          body: getMessagePreviewText(message.message_type, message.content),
          tag: `chat-${conversationId}`,
          url: "/",
          conversationId,
        });

        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          );

          sent += 1;

          await serviceClient
            .from("push_subscriptions")
            .update({ is_active: true, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", sub.id);
        } catch (err: any) {
          failed += 1;
          const statusCode = err?.statusCode || err?.status || 0;
          if (statusCode === 404 || statusCode === 410) {
            await serviceClient
              .from("push_subscriptions")
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq("id", sub.id);
          }
        }
      })
    );

    return new Response(JSON.stringify({ sent, failed }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), { status: 500, headers: corsHeaders });
  }
});
