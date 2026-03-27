import { useState, useRef, useEffect } from "react";
import { ChatContact, Message, sampleMessages } from "@/data/sampleChats";
import ChatHeader from "./ChatHeader";
import MessageBubble from "./MessageBubble";
import { Paperclip, Smile, Mic, Send } from "lucide-react";
import { useUserSettings } from "@/hooks/useUserSettings";

interface ChatWindowProps {
  contact: ChatContact;
  onBack: () => void;
}

const ChatWindow = ({ contact, onBack }: ChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>(
    sampleMessages[contact.id] || []
  );
  const [inputText, setInputText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { settings } = useUserSettings();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages(sampleMessages[contact.id] || []);
    setInputText("");
  }, [contact.id]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    const newMsg: Message = {
      id: `m${Date.now()}`,
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isOutgoing: true,
      status: "sent",
    };
    setMessages((prev) => [...prev, newMsg]);
    setInputText("");
  };

  return (
    <div className="flex h-full flex-col">
      <ChatHeader contact={contact} onBack={onBack} />

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto bg-chat-bg px-4 py-3"
        style={{ background: settings?.chats?.wallpaper && settings.chats.wallpaper !== 'none' ? settings.chats.wallpaper : undefined }}
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground italic">
              No messages yet. Say hello! 👋
            </p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 bg-card px-3 py-2 border-t border-border">
        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full">
          <Smile className="h-5 w-5" />
        </button>
        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full">
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message"
          className="flex-1 rounded-lg border-none bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {inputText.trim() ? (
          <button
            onClick={handleSend}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Send className="h-5 w-5" />
          </button>
        ) : (
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
