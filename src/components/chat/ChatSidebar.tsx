import { useState } from "react";
import { ChatContact, sampleContacts } from "@/data/sampleChats";
import ChatListItem from "./ChatListItem";
import { MessageCircle, MoreVertical, Search } from "lucide-react";

interface ChatSidebarProps {
  activeContactId: string | null;
  onSelectContact: (contact: ChatContact) => void;
}

const ChatSidebar = ({ activeContactId, onSelectContact }: ChatSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = sampleContacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between bg-header px-4 py-3 text-header-foreground">
        <h1 className="text-lg font-bold">WhatsApp</h1>
        <div className="flex items-center gap-1">
          <button className="p-2 hover:bg-primary/20 rounded-full transition-colors">
            <MessageCircle className="h-5 w-5" />
          </button>
          <button className="p-2 hover:bg-primary/20 rounded-full transition-colors">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search or start new chat"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((contact) => (
          <ChatListItem
            key={contact.id}
            contact={contact}
            isActive={contact.id === activeContactId}
            onClick={() => onSelectContact(contact)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No chats found
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
