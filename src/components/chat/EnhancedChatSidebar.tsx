import { useState } from "react";
import { ConversationWithDetails } from "@/hooks/useConversations";
import { Profile } from "@/hooks/useProfiles";
import {
  MessageCircle,
  Search,
  Users,
  Phone,
  CircleDot,
  Settings,
  Moon,
  Sun,
  LogOut,
  UserPlus,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface EnhancedChatSidebarProps {
  conversations: ConversationWithDetails[];
  activeConversationId: string | null;
  onSelectConversation: (conv: ConversationWithDetails) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenStatus: () => void;
  onOpenCalls: () => void;
  onSignOut: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  myProfile: Profile | null;
  filter: string;
  onFilterChange: (f: string) => void;
}

const EnhancedChatSidebar = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onOpenSettings,
  onOpenStatus,
  onOpenCalls,
  onSignOut,
  theme,
  onToggleTheme,
  myProfile,
  filter,
  onFilterChange,
}: EnhancedChatSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"chats" | "status" | "calls">("chats");

  const filtered = conversations.filter((c) =>
    c.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredByType =
    filter === "unread"
      ? filtered.filter((c) => c.unread_count > 0)
      : filter === "groups"
      ? filtered.filter((c) => c.is_group)
      : filtered;

  const formatTime = (timestamp: string) => {
    if (!timestamp) return "";
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: false });
    } catch {
      return "";
    }
  };

  return (
    <div className="flex h-full flex-col bg-card/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full gradient-btn text-xs font-bold text-primary-foreground shadow-md shadow-primary/20">
            {myProfile?.display_name?.[0]?.toUpperCase() || "U"}
          </div>
          <h1 className="text-xl font-extrabold gradient-text tracking-tight">UnifyChat</h1>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={onToggleTheme} className="p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-foreground">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={onNewChat} className="p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-foreground">
            <UserPlus className="h-4.5 w-4.5" />
          </button>
          <button onClick={onOpenSettings} className="p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-foreground">
            <Settings className="h-4.5 w-4.5" />
          </button>
          <button onClick={onSignOut} className="p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex mx-3 rounded-xl bg-muted/60 p-1">
        {[
          { key: "chats" as const, icon: MessageCircle, label: "Chats" },
          { key: "status" as const, icon: CircleDot, label: "Status" },
          { key: "calls" as const, icon: Phone, label: "Calls" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              if (tab.key === "status") onOpenStatus();
              if (tab.key === "calls") onOpenCalls();
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === tab.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-3 pb-2">
        {["all", "unread", "groups"].map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              filter === f
                ? "gradient-btn text-primary-foreground shadow-sm shadow-primary/20"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2">
        {filteredByType.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelectConversation(conv)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-all mb-0.5 ${
              conv.id === activeConversationId
                ? "bg-primary/10 shadow-sm"
                : "hover:bg-muted/60"
            }`}
          >
            <div className="relative flex-shrink-0">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold ${
                conv.id === activeConversationId
                  ? "gradient-btn text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-muted text-muted-foreground"
              }`}>
                {conv.avatar_initials}
              </div>
              {conv.is_online && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-online shadow-sm shadow-online/30" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-semibold text-foreground">
                  {conv.display_name}
                </span>
                <span
                  className={`text-[11px] ${
                    conv.unread_count > 0 ? "text-primary font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {formatTime(conv.last_message_time)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="truncate text-[13px] text-muted-foreground">
                  {conv.is_typing ? (
                    <span className="italic text-primary font-medium">typing...</span>
                  ) : (
                    conv.last_message || "No messages yet"
                  )}
                </p>
                {conv.unread_count > 0 && (
                  <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full gradient-btn px-1.5 text-[11px] font-bold text-primary-foreground shadow-sm shadow-primary/20">
                    {conv.unread_count}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
        {filteredByType.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-12">
            <div className="rounded-2xl bg-muted/60 p-4">
              <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-center text-sm text-muted-foreground">No chats found</p>
            <button onClick={onNewChat} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Start a new chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedChatSidebar;
