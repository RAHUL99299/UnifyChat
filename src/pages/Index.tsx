import { useState, useEffect } from "react";
import { Lock, Sparkles } from "lucide-react";
import unifychatLogo from "@/assets/unifychat-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations, ConversationWithDetails } from "@/hooks/useConversations";
import { useProfiles } from "@/hooks/useProfiles";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import EnhancedChatSidebar from "@/components/chat/EnhancedChatSidebar";
import EnhancedChatWindow from "@/components/chat/EnhancedChatWindow";
import NewChatDialog from "@/components/chat/NewChatDialog";
import MediaGallery from "@/components/chat/MediaGallery";
import StatusPage from "@/pages/StatusPage";
import CallsPage from "@/pages/CallsPage";
import SettingsPage from "@/pages/SettingsPage";
import LinkedDevicesPage from "@/pages/LinkedDevicesPage";

type OverlayPage = "none" | "status" | "calls" | "settings" | "linked-devices";

const Index = () => {
  const { signOut, user } = useAuth();
  const { conversations, loading, createConversation } = useConversations();
  const { myProfile, setOnlineStatus } = useProfiles();
  const { theme, toggleTheme } = useTheme();
  const [activeConversation, setActiveConversation] = useState<ConversationWithDetails | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [filter, setFilter] = useState("all");
  const [overlayPage, setOverlayPage] = useState<OverlayPage>("none");

  useEffect(() => {
    setOnlineStatus(true);
    const handleBeforeUnload = () => setOnlineStatus(false);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      setOnlineStatus(false);
    };
  }, []);

  const handleStartChat = async (userId: string) => {
    const convId = await createConversation(userId);
    setShowNewChat(false);
    if (convId) {
      const conv = conversations.find((c) => c.id === convId);
      if (conv) setActiveConversation(conv);
    }
  };

  const handleCreateGroup = async (name: string, memberIds: string[]) => {
    if (!user) return;
    const { data: conv } = await supabase
      .from("conversations")
      .insert({ is_group: true, group_name: name })
      .select()
      .single();

    if (conv) {
      await supabase.from("conversation_participants").insert([
        { conversation_id: conv.id, user_id: user.id },
        ...memberIds.map((id) => ({ conversation_id: conv.id, user_id: id })),
      ]);
    }
    setShowNewChat(false);
  };

  if (overlayPage !== "none") {
    return (
      <div className="flex h-screen gradient-mesh">
        <div className="relative mx-auto my-4 flex h-[calc(100vh-2rem)] w-full max-w-[1400px] overflow-hidden rounded-2xl glass-panel shadow-2xl animate-scale-in">
          {overlayPage === "status" && <StatusPage onBack={() => setOverlayPage("none")} />}
          {overlayPage === "calls" && <CallsPage onBack={() => setOverlayPage("none")} />}
          {overlayPage === "settings" && (
            <SettingsPage
              onBack={() => setOverlayPage("none")}
              onOpenLinkedDevices={() => setOverlayPage("linked-devices")}
            />
          )}
          {overlayPage === "linked-devices" && (
            <LinkedDevicesPage onBack={() => setOverlayPage("settings")} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen gradient-mesh">
      <div className="relative mx-auto my-4 flex h-[calc(100vh-2rem)] w-full max-w-[1400px] overflow-hidden rounded-2xl glass-panel shadow-2xl animate-scale-in">
        {/* Sidebar */}
        <div
          className={`w-full flex-shrink-0 border-r border-border/50 md:w-[380px] ${
            activeConversation ? "hidden md:block" : "block"
          }`}
        >
          <EnhancedChatSidebar
            conversations={conversations}
            activeConversationId={activeConversation?.id ?? null}
            onSelectConversation={setActiveConversation}
            onNewChat={() => setShowNewChat(true)}
            onOpenSettings={() => setOverlayPage("settings")}
            onOpenStatus={() => setOverlayPage("status")}
            onOpenCalls={() => setOverlayPage("calls")}
            onSignOut={signOut}
            theme={theme}
            onToggleTheme={toggleTheme}
            myProfile={myProfile}
            filter={filter}
            onFilterChange={setFilter}
          />
        </div>

        {/* Chat window / Empty state */}
        <div
          className={`flex-1 ${
            activeConversation ? "block animate-slide-in-right md:animate-fade-in" : "hidden md:block"
          }`}
          key={activeConversation?.id ?? "empty"}
        >
          {activeConversation ? (
            <EnhancedChatWindow
              conversation={activeConversation}
              onBack={() => setActiveConversation(null)}
              onOpenMediaGallery={() => setShowMediaGallery(true)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gradient-mesh-vivid">
              <div className="relative mb-8">
                <div className="absolute -inset-6 rounded-full bg-primary/10 blur-2xl animate-pulse" />
                <img src={unifychatLogo} alt="UnifyChat" className="relative h-32 w-32 object-contain drop-shadow-lg" />
              </div>
              <h2 className="mb-3 text-3xl font-extrabold gradient-text tracking-tight">UnifyChat</h2>
              <p className="mb-8 max-w-sm text-center text-sm text-muted-foreground leading-relaxed">
                Your conversations, your way. Connect with people that matter.
              </p>
              <div className="flex items-center gap-2 rounded-full bg-muted/60 px-4 py-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>End-to-end encrypted</span>
                <Sparkles className="h-3 w-3 text-accent" />
              </div>
            </div>
          )}
        </div>
      </div>

      {showNewChat && (
        <NewChatDialog
          onStartChat={handleStartChat}
          onCreateGroup={handleCreateGroup}
          onClose={() => setShowNewChat(false)}
        />
      )}

      {showMediaGallery && activeConversation && (
        <MediaGallery
          conversationName={activeConversation.display_name}
          onBack={() => setShowMediaGallery(false)}
        />
      )}
    </div>
  );
};

export default Index;
