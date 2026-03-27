import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserSettings } from "@/hooks/useUserSettings";
import { requestNotificationPermissionIfNeeded } from "@/lib/browserNotifications";

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};

export function usePushNotifications() {
  const { user } = useAuth();
  const { settings } = useUserSettings();

  const messageNotificationsEnabled = useMemo(() => {
    if (!settings) return true;
    return settings?.notifications?.msgNotify !== false;
  }, [settings]);

  useEffect(() => {
    if (!user) return;
    if (!messageNotificationsEnabled) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
    if (!vapidPublicKey) {
      return;
    }

    let cancelled = false;

    const registerAndSubscribe = async () => {
      const permission = await requestNotificationPermissionIfNeeded();
      if (permission !== "granted") return;

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const existingSubscription = await registration.pushManager.getSubscription();
        const subscription =
          existingSubscription ||
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }));

        if (cancelled) return;

        const json = subscription.toJSON();
        const keys = json.keys || {};

        await (supabase as any)
          .from("push_subscriptions")
          .upsert(
            {
              user_id: user.id,
              endpoint: subscription.endpoint,
              p256dh: keys.p256dh || null,
              auth: keys.auth || null,
              user_agent: navigator.userAgent,
              is_active: true,
              last_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "endpoint" }
          );
      } catch (_err) {
        // Browser or permission limitations should not block chat usage.
      }
    };

    void registerAndSubscribe();

    return () => {
      cancelled = true;
    };
  }, [messageNotificationsEnabled, user]);
}
