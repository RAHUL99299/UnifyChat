import { ChatContact } from "@/data/sampleChats";
import { ArrowLeft, MoreVertical, Phone, Video } from "lucide-react";

interface ChatHeaderProps {
  contact: ChatContact;
  onBack: () => void;
}

const ChatHeader = ({ contact, onBack }: ChatHeaderProps) => {
  return (
    <div className="flex items-center gap-3 bg-header px-3 py-2 text-header-foreground">
      <button onClick={onBack} className="md:hidden p-1 hover:bg-primary/20 rounded-full transition-colors">
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="relative">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold">
          {contact.avatar}
        </div>
        {contact.isOnline && (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-header bg-online" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold truncate">{contact.name}</h2>
        <p className="text-xs opacity-80">
          {contact.isTyping
            ? "typing..."
            : contact.isOnline
            ? "online"
            : "last seen recently"}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <button className="p-2 hover:bg-primary/20 rounded-full transition-colors">
          <Video className="h-5 w-5" />
        </button>
        <button className="p-2 hover:bg-primary/20 rounded-full transition-colors">
          <Phone className="h-5 w-5" />
        </button>
        <button className="p-2 hover:bg-primary/20 rounded-full transition-colors">
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
