import { useState, useRef, useEffect, useCallback } from "react";
import MediaGallery from "./MediaGallery";
import ContactInfoPanel from "./ContactInfoPanel";
import { ConversationWithDetails } from "@/hooks/useConversations";
import { useMessages, MessageWithSender } from "@/hooks/useMessages";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import EnhancedMessageBubble from "./EnhancedMessageBubble";
import ChatSearchBar from "./ChatSearchBar";
import GroupParticipantsPanel from "./GroupParticipantsPanel";
import ChatInputBar from "./ChatInputBar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getMessagePreviewText } from "@/lib/messageContent";
import {
  ArrowLeft,
  MoreVertical,
  Phone,
  Video,
  Search,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface EnhancedChatWindowProps {
  conversation: ConversationWithDetails;
  onBack: () => void;
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  canStartCall: boolean;
}

const EnhancedChatWindow = ({
  conversation,
  onBack,
  onStartAudioCall,
  onStartVideoCall,
  canStartCall,
}: EnhancedChatWindowProps) => {
  const { messages, loading, sendMessage, deleteMessage, editMessage, clearChat, clearMedia } = useMessages(conversation.id);
  const { toast } = useToast();
  const { setTyping, stopTyping } = useTypingIndicator(conversation.id);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showParticipants, setShowParticipants] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageWithSender | null>(null);
  const [editingMsg, setEditingMsg] = useState<MessageWithSender | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [activeMedia, setActiveMedia] = useState<{ type: "image" | "gif" | "video"; url: string } | null>(null);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageElementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const highlightResetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (highlightResetTimeoutRef.current) {
        window.clearTimeout(highlightResetTimeoutRef.current);
      }
    };
  }, []);

  const registerMessageRef = useCallback(
    (messageId: string) => (element: HTMLDivElement | null) => {
      messageElementRefs.current[messageId] = element;
    },
    []
  );

  const navigateToReferencedMessage = useCallback((targetMessageId: string) => {
    const targetElement = messageElementRefs.current[targetMessageId];
    if (!targetElement) return;

    targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(targetMessageId);

    if (highlightResetTimeoutRef.current) {
      window.clearTimeout(highlightResetTimeoutRef.current);
    }

    highlightResetTimeoutRef.current = window.setTimeout(() => {
      setHighlightedMessageId((current) => (current === targetMessageId ? null : current));
    }, 1500);
  }, []);

  const handleSendMessage = async (content: string, type = "text") => {
    await sendMessage(content, type, { replyTo });
    setReplyTo(null);
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessage(messageId);
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  };

  const handleEditMessage = async (id: string, content: string) => {
    await editMessage(id, content);
  };

  const handleClearChat = async () => {
    if (isClearing) return;

    setIsClearing(true);
    try {
      const deletedCount = await clearChat();
      toast({
        title: deletedCount > 0 ? "Chat cleared" : "Nothing to clear",
        description: deletedCount > 0
          ? `${deletedCount} sent message${deletedCount === 1 ? "" : "s"} removed.`
          : "No sent messages available to clear.",
      });
      setShowClearDialog(false);
    } catch (error: any) {
      toast({
        title: "Failed to clear chat",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearMedia = async () => {
    if (isClearing) return;

    setIsClearing(true);
    try {
      const deletedCount = await clearMedia();
      toast({
        title: deletedCount > 0 ? "Media cleared" : "Nothing to clear",
        description: deletedCount > 0
          ? `${deletedCount} sent media message${deletedCount === 1 ? "" : "s"} removed.`
          : "No sent media messages available to clear.",
      });
      setShowClearDialog(false);
    } catch (error: any) {
      toast({
        title: "Failed to clear media",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const searchResults = searchQuery
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const getTypingLabel = () => {
    if (!conversation.is_typing || conversation.typing_users.length === 0) {
      return "";
    }

    if (!conversation.is_group) {
      return "typing...";
    }

    const [first, second, ...rest] = conversation.typing_users;
    if (!second) {
      return `${first.name} is typing...`;
    }
    if (rest.length === 0) {
      return `${first.name} and ${second.name} are typing...`;
    }

    return `${first.name} and ${rest.length + 1} others are typing...`;
  };

  const getConversationStatusText = () => {
    if (conversation.is_typing) {
      return <span className="text-primary font-medium">{getTypingLabel()}</span>;
    }

    if (conversation.is_online) {
      return <span className="text-online font-medium">online</span>;
    }

    if (!conversation.is_group && conversation.other_user_last_seen) {
      try {
        return (
          <span className="text-muted-foreground">
            last seen {formatDistanceToNow(new Date(conversation.other_user_last_seen), { addSuffix: true })}
          </span>
        );
      } catch {
        return <span className="text-muted-foreground">last seen recently</span>;
      }
    }

    return <span className="text-muted-foreground">last seen recently</span>;
  };

  return (
    <div className="relative isolate grid h-full min-h-0 min-w-0 grid-rows-[auto,1fr,auto] overflow-hidden">
      {showMenu && (
        <div
          className="absolute inset-0 z-40 bg-transparent"
          onClick={() => setShowMenu(false)}
          aria-hidden="true"
        />
      )}

      {/* Header */}
      <div className="sticky top-0 z-50 flex items-center gap-2 border-b border-border/50 bg-card/90 px-3 py-2.5 backdrop-blur-sm sm:gap-3 sm:px-4 sm:py-3">
        <button onClick={onBack} className="min-h-11 min-w-11 rounded-xl p-1.5 transition-all hover:bg-muted md:hidden">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div
          className="relative cursor-pointer"
          onClick={() => setShowInfoPanel(true)}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl overflow-hidden bg-muted text-sm font-bold text-muted-foreground shadow-md shadow-primary/20 sm:h-10 sm:w-10">
            {conversation.avatar_url ? (
              <img src={conversation.avatar_url} alt={conversation.display_name} className="h-full w-full object-cover" />
            ) : (
              conversation.avatar_initials
            )}
          </div>
          {conversation.is_online && (
            <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-online shadow-sm" />
          )}
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowInfoPanel(true)}>
          <h2 className="truncate text-sm font-bold text-foreground">{conversation.display_name}</h2>
          <p className="text-xs text-muted-foreground">{getConversationStatusText()}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onStartVideoCall}
            disabled={!canStartCall}
            className="min-h-10 min-w-10 rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:opacity-40 sm:min-h-11 sm:min-w-11"
            title={canStartCall ? "Start video call" : "Calls are only available in 1:1 chats"}
          >
            <Video className="h-5 w-5" />
          </button>
          <button
            onClick={onStartAudioCall}
            disabled={!canStartCall}
            className="min-h-10 min-w-10 rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:opacity-40 sm:min-h-11 sm:min-w-11"
            title={canStartCall ? "Start voice call" : "Calls are only available in 1:1 chats"}
          >
            <Phone className="h-5 w-5" />
          </button>
          <button onClick={() => setShowSearch(!showSearch)} className="min-h-10 min-w-10 rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground sm:min-h-11 sm:min-w-11">
            <Search className="h-5 w-5" />
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="min-h-10 min-w-10 rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground sm:min-h-11 sm:min-w-11">
              <MoreVertical className="h-5 w-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full z-[70] mt-1 w-56 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-card shadow-xl animate-scale-in">
                <button onClick={() => { setShowMediaGallery(true); setShowMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors">
                  Media, Links & Docs
                </button>
                <button
                  onClick={() => {
                    setShowInfoPanel(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
                >
                  {conversation.is_group ? "Group info" : "Contact info"}
                </button>
                <button onClick={() => { setShowSearch(true); setShowMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors">
                  Search
                </button>
                <button
                  onClick={() => {
                    setShowClearDialog(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Clear all chats
                </button>
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
      <div className="relative z-0 min-h-0 overflow-y-auto bg-chat-bg px-3 py-3 sm:px-4" onClick={() => setShowMenu(false)}>
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
              messageRef={registerMessageRef(msg.id)}
              isReferenceTargetHighlighted={highlightedMessageId === msg.id}
              onNavigateToReference={navigateToReferencedMessage}
              onReply={() => setReplyTo(msg)}
              onDelete={() => handleDeleteMessage(msg.id)}
              onEdit={() => setEditingMsg(msg)}
              onOpenMedia={setActiveMedia}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="flex items-center gap-2 border-t border-border/50 bg-muted/60 px-3 py-2 animate-fade-in sm:px-4">
          <div className="flex-1 border-l-2 border-primary pl-2">
            <p className="text-xs font-semibold text-primary">{replyTo.sender_name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {getMessagePreviewText(replyTo.message_type, replyTo.content)}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {editingMsg && (
        <div className="flex items-center gap-2 border-t border-primary/20 bg-primary/5 px-3 py-2 animate-fade-in sm:px-4">
          <div className="flex-1">
            <p className="text-xs font-semibold text-primary">Editing message</p>
            <p className="text-xs text-muted-foreground truncate">{editingMsg.content}</p>
          </div>
          <button onClick={() => setEditingMsg(null)} className="p-1">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="z-40 bg-card/90 backdrop-blur-sm">
        <ChatInputBar
          conversationId={conversation.id}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onTyping={setTyping}
          onStopTyping={stopTyping}
          editingMsg={editingMsg ? { id: editingMsg.id, content: editingMsg.content } : null}
          onEditCancel={() => setEditingMsg(null)}
        />
      </div>

      {showParticipants && (
        <GroupParticipantsPanel
          conversationId={conversation.id}
          groupName={conversation.display_name}
          onClose={() => setShowParticipants(false)}
        />
      )}

      {showMediaGallery && (
        <MediaGallery
          conversationName={conversation.display_name}
          messages={messages}
          onBack={() => setShowMediaGallery(false)}
        />
      )}

      {showInfoPanel && (
        <ContactInfoPanel
          conversation={conversation}
          messages={messages}
          onClose={() => setShowInfoPanel(false)}
          onOpenMediaGallery={() => {
            setShowInfoPanel(false);
            setShowMediaGallery(true);
          }}
          onOpenParticipants={() => {
            setShowInfoPanel(false);
            setShowParticipants(true);
          }}
        />
      )}

      <Dialog open={!!activeMedia} onOpenChange={(open) => !open && setActiveMedia(null)}>
        <DialogContent className="w-[min(96vw,72rem)] border-border/50 bg-card/95 p-2 shadow-2xl sm:p-3 sm:rounded-2xl">
          <DialogTitle className="sr-only">Media preview</DialogTitle>
          {activeMedia?.type === "video" ? (
            <video
              src={activeMedia.url}
              controls
              autoPlay
              className="max-h-[80vh] w-full rounded-xl bg-black object-contain"
            />
          ) : activeMedia ? (
            <img
              src={activeMedia.url}
              alt="Chat media preview"
              className="max-h-[80vh] w-full rounded-xl bg-black object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="w-[min(96vw,28rem)] border-border/50 bg-card/95 p-4 shadow-2xl sm:p-5 sm:rounded-2xl">
          <DialogTitle className="text-base">Clear all chats</DialogTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose what to remove in this conversation.
          </p>
          <div className="mt-4 grid gap-2">
            <button
              onClick={handleClearChat}
              disabled={isClearing}
              className="w-full rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground transition-all hover:bg-destructive/90 disabled:opacity-50"
            >
              {isClearing ? "Clearing..." : "Clear chat"}
            </button>
            <button
              onClick={handleClearMedia}
              disabled={isClearing}
              className="w-full rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted disabled:opacity-50"
            >
              {isClearing ? "Clearing..." : "Clear media"}
            </button>
            <button
              onClick={() => setShowClearDialog(false)}
              disabled={isClearing}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnhancedChatWindow;
