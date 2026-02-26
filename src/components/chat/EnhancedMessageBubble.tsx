import { useState } from "react";
import { MessageWithSender } from "@/hooks/useMessages";
import { Check, CheckCheck, Reply, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface EnhancedMessageBubbleProps {
  message: MessageWithSender;
  isGroupChat: boolean;
  searchQuery: string;
  onReply: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

const EnhancedMessageBubble = ({
  message,
  isGroupChat,
  searchQuery,
  onReply,
  onDelete,
  onEdit,
}: EnhancedMessageBubbleProps) => {
  const [showActions, setShowActions] = useState(false);
  const isOut = message.is_outgoing;

  const formatTime = (ts: string) => {
    try {
      return format(new Date(ts), "h:mm a");
    } catch {
      return "";
    }
  };

  const highlightSearch = (text: string) => {
    if (!searchQuery) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-accent/30 text-inherit rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div
      className={`group flex ${isOut ? "justify-end" : "justify-start"} mb-1.5 animate-message-in`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="relative max-w-[75%]">
        {showActions && (
          <div
            className={`absolute top-0 z-10 flex gap-0.5 ${
              isOut ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"
            }`}
          >
            <button onClick={onReply} className="rounded-xl bg-card p-1.5 shadow-sm hover:bg-muted transition-all">
              <Reply className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {isOut && (
              <>
                <button onClick={onEdit} className="rounded-xl bg-card p-1.5 shadow-sm hover:bg-muted transition-all">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button onClick={onDelete} className="rounded-xl bg-card p-1.5 shadow-sm hover:bg-muted transition-all">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </>
            )}
          </div>
        )}

        <div
          className={`rounded-2xl px-3.5 py-2 shadow-sm ${
            isOut
              ? "bg-primary/15 text-foreground rounded-tr-sm"
              : "bg-card text-foreground rounded-tl-sm shadow-md shadow-black/5"
          }`}
        >
          {!isOut && isGroupChat && (
            <p className="text-xs font-bold text-primary mb-0.5">{message.sender_name}</p>
          )}

          <p className="text-sm leading-relaxed">{highlightSearch(message.content)}</p>

          <div className="mt-0.5 flex items-center justify-end gap-1">
            <span className="text-[10px] text-muted-foreground">{formatTime(message.created_at)}</span>
            {isOut && (
              <span>
                {message.status === "sent" ? (
                  <Check className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <CheckCheck
                    className={`h-3.5 w-3.5 ${
                      message.status === "read" ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedMessageBubble;
