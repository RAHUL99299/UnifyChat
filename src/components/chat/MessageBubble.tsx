import { Message } from "@/data/sampleChats";
import { Check, CheckCheck } from "lucide-react";
import { useUserSettings } from "@/hooks/useUserSettings";

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isOut = message.isOutgoing;
  const { settings } = useUserSettings();
  const readReceiptsEnabled = settings?.privacy?.readReceipts !== false;

  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"} mb-1 animate-message-in`}>
      <div
        className={`relative max-w-[75%] rounded-lg px-3 py-1.5 shadow-sm ${
          isOut
            ? "bg-chat-bubble-out text-chat-bubble-out-fg rounded-tr-none"
            : "bg-chat-bubble-in text-chat-bubble-in-fg rounded-tl-none"
        }`}
      >
        <p className="text-sm leading-relaxed">{message.text}</p>
        <div className={`mt-0.5 flex items-center justify-end gap-1`}>
          <span className="text-[10px] text-muted-foreground">{message.timestamp}</span>
          {isOut && (
            <span className="text-tick">
              {message.status === "sent" ? (
                <Check className="h-3.5 w-3.5" />
              ) : !readReceiptsEnabled ? (
                // if read receipts disabled, show a single check for delivered/read
                <Check className="h-3.5 w-3.5" />
              ) : (
                <CheckCheck
                  className={`h-3.5 w-3.5 ${
                    message.status === "read" ? "text-tick" : "text-muted-foreground"
                  }`}
                />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
