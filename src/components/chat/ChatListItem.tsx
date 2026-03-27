import { ChatContact } from "@/data/sampleChats";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Check, CheckCheck } from "lucide-react";

interface ChatListItemProps {
  contact: ChatContact;
  isActive: boolean;
  onClick: () => void;
}

const ChatListItem = ({ contact, isActive, onClick }: ChatListItemProps) => {
  const { settings } = useUserSettings();

  const hidePhotos = settings?.privacy?.profilePhoto === "nobody";

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/60 ${
        isActive ? "bg-muted" : ""
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
          {hidePhotos ? "" : contact.avatar}
        </div>
        {contact.isOnline && (
          <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-online" />
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-semibold text-foreground">
            {contact.name}
          </span>
          <span
            className={`text-xs ${
              contact.unreadCount > 0 ? "text-primary font-medium" : "text-muted-foreground"
            }`}
          >
            {contact.timestamp}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className="truncate text-sm text-muted-foreground">
            {contact.isTyping ? (
              <span className="italic text-primary">typing...</span>
            ) : (
              contact.lastMessage
            )}
          </p>
          {contact.unreadCount > 0 && (
            <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
              {contact.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default ChatListItem;
