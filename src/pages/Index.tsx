import { useState, useEffect } from "react";
import { Lock, Sparkles } from "lucide-react";
import unifychatLogo from "@/assets/unifychat-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations, ConversationWithDetails } from "@/hooks/useConversations";
import { useProfiles } from "@/hooks/useProfiles";
import { useTheme } from "@/hooks/useTheme";
import { prefetchConversationMessages } from "@/hooks/useMessages";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";
import { supabase } from "@/integrations/supabase/client";
import EnhancedChatSidebar from "@/components/chat/EnhancedChatSidebar";
import EnhancedChatWindow from "@/components/chat/EnhancedChatWindow";
import CallOverlay from "@/components/chat/CallOverlay";
import NewChatDialog from "@/components/chat/NewChatDialog";
import StatusPage from "@/pages/StatusPage";
import SettingsPage from "@/pages/SettingsPage";
import LinkedDevicesPage from "@/pages/LinkedDevicesPage";

type OverlayPage = "none" | "status" | "settings" | "linked-devices";

const Index = () => {
  const { signOut, user } = useAuth();
  const { conversations, loading, createConversation, deleteConversation } = useConversations();
  const { myProfile, setOnlineStatus } = useProfiles();
  const { theme, toggleTheme } = useTheme();
  usePushNotifications();
  const [activeConversation, setActiveConversation] = useState<ConversationWithDetails | null>(null);
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [filter, setFilter] = useState("all");
  const [overlayPage, setOverlayPage] = useState<OverlayPage>("none");
  const {
    callPhase,
    callType,
    connectionState,
    incomingCall,
    localStream,
    remoteStream,
    remoteProfile,
    statusText,
    durationSeconds,
    isMuted,
    isCameraOff,
    canToggleCamera,
    diagnostics,
    isSignalingConnected,
    startCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useWebRTCCall();

  useEffect(() => {
    if (!user) return;

    let hiddenTimeout: number | null = null;
    let heartbeatInterval: number | null = null;

    const clearHiddenTimeout = () => {
      if (hiddenTimeout) {
        window.clearTimeout(hiddenTimeout);
        hiddenTimeout = null;
      }
    };

    const startHeartbeat = () => {
      if (heartbeatInterval) {
        window.clearInterval(heartbeatInterval);
      }
      heartbeatInterval = window.setInterval(() => {
        if (!document.hidden) {
          setOnlineStatus(true);
        }
      }, 25000);
    };

    setOnlineStatus(true);
    startHeartbeat();

    const handleBeforeUnload = () => setOnlineStatus(false);
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Grace window prevents flicker when switching windows briefly.
        clearHiddenTimeout();
        hiddenTimeout = window.setTimeout(() => {
          setOnlineStatus(false);
        }, 15000);
        return;
      }

      clearHiddenTimeout();
      setOnlineStatus(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearHiddenTimeout();
      if (heartbeatInterval) {
        window.clearInterval(heartbeatInterval);
      }
      setOnlineStatus(false);
    };
  }, [user, setOnlineStatus]);

  const handleStartChat = async (userId: string) => {
    const convId = await createConversation(userId);
    setShowNewChat(false);
    if (convId) {
      setPendingConversationId(convId);
    }
  };

  useEffect(() => {
    if (!pendingConversationId) return;
    const conv = conversations.find((c) => c.id === pendingConversationId);
    if (conv) {
      setActiveConversation(conv);
      setPendingConversationId(null);
    }
  }, [pendingConversationId, conversations]);

  useEffect(() => {
    if (!activeConversation) return;

    const updated = conversations.find((c) => c.id === activeConversation.id);
    if (!updated) {
      setActiveConversation(null);
      return;
    }

    if (updated !== activeConversation) {
      setActiveConversation(updated);
    }
  }, [conversations, activeConversation]);

  useEffect(() => {
    if (!user || conversations.length === 0) return;

    const warmConversations = conversations
      .slice(0, 2)
      .map((conversation) => conversation.id);

    for (const conversationId of warmConversations) {
      prefetchConversationMessages(conversationId, user.id);
    }
  }, [conversations, user]);

  const handlePrefetchConversation = (conversationId: string) => {
    if (!user) return;
    prefetchConversationMessages(conversationId, user.id);
  };

  const handleCreateGroup = async (name: string, memberIds: string[]) => {
    if (!user) return;
    const groupId = crypto.randomUUID();
    const { error } = await supabase
      .from("conversations")
      .insert({ id: groupId, is_group: true, group_name: name });

    if (!error) {
      await supabase.from("conversation_participants").insert([
        { conversation_id: groupId, user_id: user.id },
        ...memberIds.map((id) => ({ conversation_id: groupId, user_id: id })),
      ]);
    }
    setShowNewChat(false);
  };

  const handleStartAudioCall = () => {
    if (!activeConversation || activeConversation.is_group || !activeConversation.other_user_id) return;
    startCall({
      toUserId: activeConversation.other_user_id,
      callType: "audio",
      conversationId: activeConversation.id,
      targetName: activeConversation.display_name,
      targetAvatar: activeConversation.avatar_initials,
      targetAvatarUrl: activeConversation.avatar_url,
      callerAvatarUrl: myProfile?.avatar_url || undefined,
    });
  };

  const handleStartVideoCall = () => {
    if (!activeConversation || activeConversation.is_group || !activeConversation.other_user_id) return;
    startCall({
      toUserId: activeConversation.other_user_id,
      callType: "video",
      conversationId: activeConversation.id,
      targetName: activeConversation.display_name,
      targetAvatar: activeConversation.avatar_initials,
      targetAvatarUrl: activeConversation.avatar_url,
      callerAvatarUrl: myProfile?.avatar_url || undefined,
    });
  };

  if (overlayPage !== "none") {
    return (
      <div className="flex min-h-[100dvh] w-full overflow-x-hidden gradient-mesh">
        <div className="relative mx-auto flex h-[100dvh] w-full max-w-[1440px] overflow-hidden bg-card/60 md:my-3 md:h-[calc(100dvh-1.5rem)] md:rounded-2xl glass-panel shadow-2xl animate-scale-in">
          {overlayPage === "status" && <StatusPage onBack={() => setOverlayPage("none")} />}
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
    <div className="flex min-h-[100dvh] w-full overflow-x-hidden gradient-mesh">
      <div className="relative mx-auto flex h-[100dvh] w-full max-w-[1440px] overflow-hidden bg-card/60 md:my-3 md:h-[calc(100dvh-1.5rem)] md:rounded-2xl glass-panel shadow-2xl animate-scale-in">
        {/* Sidebar */}
        <div
          className={`h-full min-h-0 w-full flex-shrink-0 border-r border-border/50 md:w-[340px] lg:w-[380px] ${
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
            onSignOut={signOut}
            theme={theme}
            onToggleTheme={toggleTheme}
            myProfile={myProfile}
            filter={filter}
            onFilterChange={setFilter}
            onPrefetchConversation={handlePrefetchConversation}
            onDeleteConversation={deleteConversation}
          />
        </div>

        {/* Chat window / Empty state */}
        <div
          className={`h-full min-h-0 min-w-0 flex-1 transition-opacity duration-150 ${
            activeConversation ? "block animate-slide-in-right md:animate-fade-in" : "hidden md:block"
          }`}
        >
          {activeConversation ? (
            <EnhancedChatWindow
              conversation={activeConversation}
              onBack={() => setActiveConversation(null)}
              onStartAudioCall={handleStartAudioCall}
              onStartVideoCall={handleStartVideoCall}
              canStartCall={!activeConversation.is_group && !!activeConversation.other_user_id}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 py-10 gradient-mesh-vivid">
              <div className="relative mb-6 md:mb-8">
                <div className="absolute -inset-6 rounded-full bg-primary/10 blur-2xl animate-pulse" />
                <img src={unifychatLogo} alt="UnifyChat" className="relative h-24 w-24 object-contain drop-shadow-lg md:h-32 md:w-32" />
              </div>
              <h2 className="mb-3 text-center text-2xl font-extrabold gradient-text tracking-tight md:text-3xl">UnifyChat</h2>
              <p className="mb-8 max-w-sm text-center text-sm text-muted-foreground leading-relaxed md:text-base">
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

      <CallOverlay
        callPhase={callPhase}
        callType={callType}
        statusText={statusText}
        durationSeconds={durationSeconds}
        remoteName={remoteProfile?.name || "User"}
        remoteAvatarInitials={remoteProfile?.avatarInitials || "U"}
        remoteAvatarUrl={remoteProfile?.avatarUrl || null}
        connectionState={connectionState}
        incomingCall={callPhase === "incoming" && !!incomingCall}
        localStream={localStream}
        remoteStream={remoteStream}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        canToggleCamera={canToggleCamera}
        diagnostics={diagnostics}
        isSignalingConnected={isSignalingConnected}
        onAccept={acceptIncomingCall}
        onReject={rejectIncomingCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
      />

    </div>
  );
};

export default Index;
