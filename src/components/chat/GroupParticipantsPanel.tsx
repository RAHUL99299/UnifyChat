import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Shield, UserMinus } from "lucide-react";

interface Participant {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_online: boolean;
}

interface GroupParticipantsPanelProps {
  conversationId: string;
  groupName: string;
  onClose: () => void;
}

const GroupParticipantsPanel = ({ conversationId, groupName, onClose }: GroupParticipantsPanelProps) => {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId);

      if (!parts) return;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, is_online")
        .in("id", parts.map((p) => p.user_id));

      if (profiles) {
        setParticipants(
          profiles.map((p) => ({
            user_id: p.id,
            display_name: p.display_name || "User",
            avatar_url: p.avatar_url,
            is_online: p.is_online ?? false,
          }))
        );
      }
    };
    fetch();
  }, [conversationId]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto h-full w-80 bg-card shadow-xl animate-slide-in-right overflow-y-auto">
        <div className="sticky top-0 bg-header text-header-foreground px-4 py-3 flex items-center gap-3">
          <button onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
          <h3 className="font-semibold">Group info</h3>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-center mb-4">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
              {groupName[0]?.toUpperCase()}
            </div>
          </div>
          <h2 className="text-center text-lg font-semibold text-foreground mb-1">{groupName}</h2>
          <p className="text-center text-sm text-muted-foreground mb-6">
            {participants.length} participants
          </p>

          <h4 className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">
            Participants
          </h4>
          <div className="space-y-1">
            {participants.map((p) => (
              <div key={p.user_id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted transition-colors">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
                    {p.display_name[0]?.toUpperCase()}
                  </div>
                  {p.is_online && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-online" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.display_name}</p>
                  <p className="text-xs text-muted-foreground">{p.is_online ? "online" : "offline"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupParticipantsPanel;
