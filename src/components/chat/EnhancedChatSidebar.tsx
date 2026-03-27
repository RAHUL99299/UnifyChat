import { useState } from "react";
import { ConversationWithDetails } from "@/hooks/useConversations";
import { Profile } from "@/hooks/useProfiles";
import {
  MessageCircle,
  Search,
  Users,
  CircleDot,
  Settings,
  Moon,
  Sun,
  LogOut,
  UserPlus,
  Sparkles,
  Check,
  CheckCheck,
  Trash2,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface EnhancedChatSidebarProps {
  conversations: ConversationWithDetails[];
  activeConversationId: string | null;
  onSelectConversation: (conv: ConversationWithDetails) => void;
  onPrefetchConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => Promise<boolean>;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenStatus: () => void;
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
  onPrefetchConversation,
  onDeleteConversation,
  onNewChat,
  onOpenSettings,
  onOpenStatus,
  onSignOut,
  theme,
  onToggleTheme,
  myProfile,
  filter,
  onFilterChange,
}: EnhancedChatSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"chats" | "status">("chats");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  const formatLastSeen = (timestamp: string | null) => {
    if (!timestamp) return "last seen recently";
    try {
      return `last seen ${formatDistanceToNow(new Date(timestamp), { addSuffix: true })}`;
    } catch {
      return "last seen recently";
    }
  };

  const getTypingLabel = (conv: ConversationWithDetails) => {
    if (!conv.is_typing || conv.typing_users.length === 0) {
      return "typing...";
    }

    if (!conv.is_group) {
      return "typing...";
    }

    const [first, second, ...rest] = conv.typing_users;
    if (!second) {
      return `${first.name} is typing...`;
    }
    if (rest.length === 0) {
      return `${first.name} and ${second.name} are typing...`;
    }

    return `${first.name} and ${rest.length + 1} others are typing...`;
  };

  const renderLastMessageTick = (conv: ConversationWithDetails) => {
    if (!conv.last_message_details?.isOutgoing) return null;

    return conv.last_message_details.status === "sent" ? (
      <Check className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
    ) : (
      <CheckCheck
        className={`h-3.5 w-3.5 flex-shrink-0 ${
          conv.last_message_details.status === "read" ? "text-primary" : "text-muted-foreground"
        }`}
      />
    );
  };

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-card/50 backdrop-blur-sm">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border/40 bg-card/85 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden bg-muted text-xs font-bold text-muted-foreground shadow-md shadow-primary/20">
            {myProfile?.avatar_url ? (
              <img src={myProfile.avatar_url} alt={myProfile.display_name || "You"} className="h-full w-full object-cover" />
            ) : (
              myProfile?.display_name?.[0]?.toUpperCase() || "U"
            )}
          </div>
          <h1 className="text-lg font-extrabold gradient-text tracking-tight sm:text-xl">UnifyChat</h1>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={onToggleTheme} className="min-h-11 min-w-11 p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-foreground">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={onNewChat} className="min-h-11 min-w-11 p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-foreground">
            <UserPlus className="h-4.5 w-4.5" />
          </button>
          <button onClick={onOpenSettings} className="min-h-11 min-w-11 p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-foreground">
            <Settings className="h-4.5 w-4.5" />
          </button>
          <button onClick={onSignOut} className="min-h-11 min-w-11 p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-[73px] z-20 mx-3 mt-2 flex rounded-xl bg-muted/85 p-1 backdrop-blur-sm sm:top-[81px]">
        {[
          { key: "chats" as const, icon: MessageCircle, label: "Chats" },
          { key: "status" as const, icon: CircleDot, label: "Status" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              if (tab.key === "status") onOpenStatus();
            }}
            className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
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
      <div className="sticky top-[121px] z-20 bg-card/85 px-3 py-3 backdrop-blur-sm sm:top-[129px]">
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
      <div className="sticky top-[182px] z-20 flex flex-wrap gap-2 bg-card/85 px-3 pb-2 backdrop-blur-sm sm:top-[190px]">
        {["all", "unread", "groups"].map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`min-h-9 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
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
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {filteredByType.map((conv) => {
          const isDeleteConfirm = deleteConfirm === conv.id;
          return (
            <div key={conv.id} className="mb-0.5 relative group">
              {isDeleteConfirm && (
                <div className="absolute inset-0 z-10 flex items-center gap-2 rounded-xl bg-destructive/90 px-3 py-3 animate-in fade-in-0 duration-200">
                  <p className="flex-1 text-xs font-medium text-destructive-foreground">Delete this chat?</p>
                  <button
                    onClick={async () => {
                      setDeleting(conv.id);
                      const success = await onDeleteConversation(conv.id);
                      setDeleting(null);
                      if (success) setDeleteConfirm(null);
                    }}
                    disabled={deleting === conv.id}
                    className="rounded-lg bg-destructive-foreground px-2 py-1.5 text-xs font-semibold text-destructive hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    {deleting === conv.id ? "..." : "Yes"}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="rounded-lg bg-white/20 px-2 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-white/30 transition-all"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <button
                onClick={() => onSelectConversation(conv)}
                onMouseEnter={() => onPrefetchConversation(conv.id)}
                onFocus={() => onPrefetchConversation(conv.id)}
                onPointerDown={() => onPrefetchConversation(conv.id)}
                className={`mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${
                  conv.id === activeConversationId
                    ? "bg-primary/10 shadow-sm"
                    : "hover:bg-muted/60"
                } ${
                  isDeleteConfirm ? "opacity-0" : "opacity-100"
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold overflow-hidden ${
                    conv.id === activeConversationId
                      ? "gradient-btn text-primary-foreground shadow-md shadow-primary/20"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {conv.avatar_url ? (
                      <img src={conv.avatar_url} alt={conv.display_name} className="h-full w-full object-cover" />
                    ) : (
                      conv.avatar_initials
                    )}
                  </div>
                  {conv.is_online && (
                    <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-online shadow-sm shadow-online/30" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between">
                    <span className={`truncate text-sm text-foreground ${conv.unread_count > 0 ? "font-bold" : "font-semibold"}`}>
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
                    <div className="flex min-w-0 items-center gap-1.5">
                      {conv.is_typing ? (
                        <p className="truncate text-[13px] italic text-primary font-medium">{getTypingLabel(conv)}</p>
                      ) : !conv.is_group && conv.is_online ? (
                        <p className="truncate text-[13px] text-online font-medium">online</p>
                      ) : !conv.is_group && !conv.last_message ? (
                        <p className="truncate text-[13px] text-muted-foreground">{formatLastSeen(conv.other_user_last_seen)}</p>
                      ) : (
                        <>
                          {renderLastMessageTick(conv)}
                          <p className={`truncate text-[13px] ${conv.unread_count > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                            {conv.last_message_details?.preview || conv.last_message || "No messages yet"}
                          </p>
                        </>
                      )}
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full gradient-btn px-1.5 text-[11px] font-bold text-primary-foreground shadow-sm shadow-primary/20">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm(conv.id);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                title="Delete chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
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
