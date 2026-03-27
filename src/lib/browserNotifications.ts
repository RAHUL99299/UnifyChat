import { getMessagePreviewText } from "@/lib/messageContent";

type NotificationPermissionState = NotificationPermission | "unsupported";

interface IncomingMessageNotificationInput {
  userId: string;
  messageId: string;
  senderName: string;
  content: string;
  messageType: string;
  conversationId?: string;
}

interface NotificationPrefs {
  msgNotify: boolean;
  highPriority: boolean;
  vibrate: boolean;
}

const shownMessageIds = new Set<string>();

const canUseNotifications = () => typeof window !== "undefined" && "Notification" in window;

const readNotificationPrefs = (userId: string): NotificationPrefs => {
  const defaults: NotificationPrefs = {
    msgNotify: true,
    highPriority: false,
    vibrate: true,
  };

  try {
    const raw = localStorage.getItem(`settings:${userId}`);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    const notifications = parsed?.notifications || {};

    return {
      msgNotify: notifications.msgNotify !== false,
      highPriority: Boolean(notifications.highPriority),
      vibrate: notifications.vibrate !== false,
    };
  } catch (_err) {
    return defaults;
  }
};

export const requestNotificationPermissionIfNeeded = async (): Promise<NotificationPermissionState> => {
  if (!canUseNotifications()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
};

export const showIncomingMessageNotification = (input: IncomingMessageNotificationInput) => {
  if (!canUseNotifications()) return;
  if (Notification.permission !== "granted") return;

  const prefs = readNotificationPrefs(input.userId);
  if (!prefs.msgNotify) return;

  const appInForeground = document.visibilityState === "visible" && document.hasFocus();
  if (appInForeground && !prefs.highPriority) return;

  if (shownMessageIds.has(input.messageId)) return;
  shownMessageIds.add(input.messageId);

  const notification = new Notification(input.senderName || "New message", {
    body: getMessagePreviewText(input.messageType, input.content),
    tag: input.conversationId ? `conversation-${input.conversationId}` : `message-${input.messageId}`,
    renotify: true,
    requireInteraction: false,
    data: { conversationId: input.conversationId },
  });

  if (prefs.vibrate && "vibrate" in navigator) {
    navigator.vibrate([120, 80, 120]);
  }

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  window.setTimeout(() => {
    notification.close();
  }, 8000);
};
