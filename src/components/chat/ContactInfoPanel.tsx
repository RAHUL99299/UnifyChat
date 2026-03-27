import { useEffect, useMemo, useState } from "react";
import { X, ChevronRight, Image as ImageIcon, Link as LinkIcon, FileText, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ConversationWithDetails } from "@/hooks/useConversations";
import { MessageWithSender } from "@/hooks/useMessages";
import { extractUrls } from "@/lib/messageContent";

interface ContactProfile {
  display_name: string | null;
  username: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string | null;
}

interface ContactInfoPanelProps {
  conversation: ConversationWithDetails;
  messages: MessageWithSender[];
  onClose: () => void;
  onOpenMediaGallery: () => void;
  onOpenParticipants: () => void;
}

const ContactInfoPanel = ({
  conversation,
  messages,
  onClose,
  onOpenMediaGallery,
  onOpenParticipants,
}: ContactInfoPanelProps) => {
  const [profile, setProfile] = useState<ContactProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (conversation.is_group || !conversation.other_user_id) {
        setProfile(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, phone, bio, avatar_url, is_online, last_seen")
        .eq("id", conversation.other_user_id)
        .maybeSingle();

      if (!cancelled) {
        setProfile(data || null);
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [conversation.is_group, conversation.other_user_id]);

  const stats = useMemo(() => {
    let media = 0;
    let docs = 0;
    const links = new Set<string>();

    for (const msg of messages) {
      if (msg.message_type === "image" || msg.message_type === "gif" || msg.message_type === "video") {
        media += 1;
      } else if (msg.message_type === "file") {
        docs += 1;
      } else if (msg.message_type === "text") {
        for (const url of extractUrls(msg.content)) {
          links.add(url);
        }
      }
    }

    return {
      media,
      docs,
      links: links.size,
    };
  }, [messages]);

  const displayName = conversation.is_group
    ? conversation.display_name
    : profile?.display_name || conversation.display_name;

  const avatarInitials = conversation.avatar_initials || displayName.slice(0, 1).toUpperCase();
  const subtitle = conversation.is_group
    ? "Group"
    : profile?.phone || profile?.username || "Contact";

  const isOnline = conversation.is_group
    ? false
    : (profile?.is_online ?? conversation.is_online);

  const lastSeen = conversation.is_group
    ? null
    : (profile?.last_seen || conversation.other_user_last_seen);

  const aboutText = conversation.is_group
    ? "This is a group conversation."
    : profile?.bio?.trim() || "Hey there! I am using UnifyChat.";

  const statusLabel = (() => {
    if (conversation.is_group) {
      return "Group chat";
    }

    if (isOnline) {
      return "online";
    }

    if (!lastSeen) {
      return "last seen recently";
    }

    try {
      return `last seen ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}`;
    } catch {
      return "last seen recently";
    }
  })();

  return (
    <div className="fixed inset-0 z-[80] flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto h-full w-[22rem] max-w-[92vw] overflow-y-auto bg-card shadow-2xl animate-slide-in-right">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/50 bg-card/90 px-4 py-3 backdrop-blur-sm">
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            aria-label="Close info panel"
          >
            <X className="h-5 w-5" />
          </button>
          <h3 className="text-sm font-semibold text-foreground">
            {conversation.is_group ? "Group info" : "Contact info"}
          </h3>
        </div>

        <div className="p-4">
          <div className="mb-5 flex flex-col items-center gap-2 border-b border-border/50 pb-5">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full gradient-btn text-2xl font-bold text-primary-foreground">
                {avatarInitials}
              </div>
            )}
            <h2 className="text-center text-lg font-semibold text-foreground">{displayName}</h2>
            <p className="text-center text-xs text-muted-foreground">{subtitle}</p>
            <p className={`text-center text-xs font-medium ${isOnline ? "text-online" : "text-muted-foreground"}`}>
              {statusLabel}
            </p>
          </div>

          <div className="mb-3 rounded-2xl border border-border/60 bg-muted/25 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">About</p>
            <p className="text-sm text-foreground">{aboutText}</p>
          </div>

          <button
            onClick={onOpenMediaGallery}
            className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-muted/25 px-3 py-3 text-left transition-all hover:bg-muted/50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ImageIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Media, links and docs</p>
              <p className="text-xs text-muted-foreground">
                {stats.media} media · {stats.links} links · {stats.docs} docs
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          {conversation.is_group && (
            <button
              onClick={onOpenParticipants}
              className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-muted/25 px-3 py-3 text-left transition-all hover:bg-muted/50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Participants</p>
                <p className="text-xs text-muted-foreground">View all group members</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}

          {!conversation.is_group && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-2 text-center">
                <ImageIcon className="mx-auto h-4 w-4 text-muted-foreground" />
                <p className="mt-1 text-[11px] font-semibold text-foreground">{stats.media}</p>
                <p className="text-[10px] text-muted-foreground">Media</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-2 text-center">
                <LinkIcon className="mx-auto h-4 w-4 text-muted-foreground" />
                <p className="mt-1 text-[11px] font-semibold text-foreground">{stats.links}</p>
                <p className="text-[10px] text-muted-foreground">Links</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-2 text-center">
                <FileText className="mx-auto h-4 w-4 text-muted-foreground" />
                <p className="mt-1 text-[11px] font-semibold text-foreground">{stats.docs}</p>
                <p className="text-[10px] text-muted-foreground">Docs</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactInfoPanel;
