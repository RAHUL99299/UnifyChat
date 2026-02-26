import { useState, useRef, useEffect } from "react";
import { ConversationWithDetails } from "@/hooks/useConversations";
import { useMessages, MessageWithSender } from "@/hooks/useMessages";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import EnhancedMessageBubble from "./EnhancedMessageBubble";
import ChatSearchBar from "./ChatSearchBar";
import GroupParticipantsPanel from "./GroupParticipantsPanel";
import {
  ArrowLeft,
  MoreVertical,
  Phone,
  Video,
  Paperclip,
  Smile,
  Mic,
  Send,
  Search,
  X,
} from "lucide-react";

interface EnhancedChatWindowProps {
  conversation: ConversationWithDetails;
  onBack: () => void;
  onOpenMediaGallery: () => void;
}

const EnhancedChatWindow = ({ conversation, onBack, onOpenMediaGallery }: EnhancedChatWindowProps) => {
  const { messages, loading, sendMessage, deleteMessage, editMessage } = useMessages(conversation.id);
  const { setTyping } = useTypingIndicator(conversation.id);
  const [inputText, setInputText] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showParticipants, setShowParticipants] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageWithSender | null>(null);
  const [editingMsg, setEditingMsg] = useState<MessageWithSender | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    if (editingMsg) {
      editMessage(editingMsg.id, inputText.trim());
      setEditingMsg(null);
    } else {
      sendMessage(inputText.trim());
    }
    setInputText("");
    setReplyTo(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    setTyping();
  };

  const searchResults = searchQuery
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 bg-card/80 backdrop-blur-sm px-4 py-3 border-b border-border/50">
        <button onClick={onBack} className="md:hidden p-1.5 hover:bg-muted rounded-xl transition-all">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div
          className="relative cursor-pointer"
          onClick={() => conversation.is_group && setShowParticipants(true)}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl gradient-btn text-sm font-bold text-primary-foreground shadow-md shadow-primary/20">
            {conversation.avatar_initials}
          </div>
          {conversation.is_online && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-online shadow-sm" />
          )}
        </div>
        <div className="flex-1 min-w-0" onClick={() => conversation.is_group && setShowParticipants(true)}>
          <h2 className="text-sm font-bold text-foreground truncate">{conversation.display_name}</h2>
          <p className="text-xs text-muted-foreground">
            {conversation.is_typing ? (
              <span className="text-primary font-medium">typing...</span>
            ) : conversation.is_online ? (
              <span className="text-online font-medium">online</span>
            ) : "last seen recently"}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <button className="p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-foreground">
            <Video className="h-5 w-5" />
          </button>
          <button className="p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-foreground">
            <Phone className="h-5 w-5" />
          </button>
          <button onClick={() => setShowSearch(!showSearch)} className="p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-foreground">
            <Search className="h-5 w-5" />
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-foreground">
              <MoreVertical className="h-5 w-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full z-50 w-48 rounded-xl glass-panel shadow-xl animate-scale-in overflow-hidden">
                <button onClick={() => { onOpenMediaGallery(); setShowMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors">
                  Media, Links & Docs
                </button>
                <button onClick={() => { setShowSearch(true); setShowMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors">
                  Search
                </button>
                {conversation.is_group && (
                  <button onClick={() => { setShowParticipants(true); setShowMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors">
                    Group info
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSearch && (
        <ChatSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          resultCount={searchResults.length}
          onClose={() => { setShowSearch(false); setSearchQuery(""); }}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-chat-bg px-4 py-3" onClick={() => setShowMenu(false)}>
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <div className="rounded-2xl bg-muted/60 p-4">
              <span className="text-2xl">👋</span>
            </div>
            <p className="text-sm text-muted-foreground">Say hello to start the convo!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <EnhancedMessageBubble
              key={msg.id}
              message={msg}
              isGroupChat={conversation.is_group}
              searchQuery={searchQuery}
              onReply={() => setReplyTo(msg)}
              onDelete={() => deleteMessage(msg.id)}
              onEdit={() => {
                setEditingMsg(msg);
                setInputText(msg.content);
              }}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="flex items-center gap-2 bg-muted/60 px-4 py-2 border-t border-border/50 animate-fade-in">
          <div className="flex-1 border-l-2 border-primary pl-2">
            <p className="text-xs font-semibold text-primary">{replyTo.sender_name}</p>
            <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {editingMsg && (
        <div className="flex items-center gap-2 bg-muted/60 px-4 py-2 border-t border-border/50 animate-fade-in">
          <div className="flex-1">
            <p className="text-xs font-semibold text-primary">Editing message</p>
          </div>
          <button onClick={() => { setEditingMsg(null); setInputText(""); }}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm px-3 py-3 border-t border-border/50">
        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-xl">
          <Smile className="h-5 w-5" />
        </button>
        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-xl">
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          className="flex-1 rounded-xl border-none bg-muted/60 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        />
        {inputText.trim() ? (
          <button
            onClick={handleSend}
            className="flex h-10 w-10 items-center justify-center rounded-xl gradient-btn text-primary-foreground hover:shadow-lg hover:shadow-primary/25 transition-all"
          >
            <Send className="h-5 w-5" />
          </button>
        ) : (
          <button className="flex h-10 w-10 items-center justify-center rounded-xl gradient-btn text-primary-foreground hover:shadow-lg hover:shadow-primary/25 transition-all">
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>

      {showParticipants && (
        <GroupParticipantsPanel
          conversationId={conversation.id}
          groupName={conversation.display_name}
          onClose={() => setShowParticipants(false)}
        />
      )}
    </div>
  );
};

export default EnhancedChatWindow;
