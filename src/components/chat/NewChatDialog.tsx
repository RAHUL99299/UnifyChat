import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X, Search, Users } from "lucide-react";

interface NewChatDialogProps {
  onStartChat: (userId: string) => void;
  onCreateGroup: (name: string, memberIds: string[]) => void;
  onClose: () => void;
}

interface UserItem {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_online: boolean;
}

const NewChatDialog = ({ onStartChat, onCreateGroup, onClose }: NewChatDialogProps) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, is_online")
        .neq("id", user?.id || "");
      if (data) {
        setUsers(data.map(u => ({
          id: u.id,
          display_name: u.display_name || "User",
          avatar_url: u.avatar_url,
          is_online: u.is_online ?? false,
        })));
      }
    };
    fetchUsers();
  }, [user]);

  const filtered = users.filter((u) =>
    u.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-card shadow-xl animate-scale-in mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground">
            {isGroupMode ? "New Group" : "New Chat"}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsGroupMode(!isGroupMode)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-colors ${
                isGroupMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <Users className="h-3 w-3" />
              Group
            </button>
            <button onClick={onClose}>
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {isGroupMode && (
          <div className="px-4 py-2 border-b border-border">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}

        <div className="px-4 py-2">
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No users found</p>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => (isGroupMode ? toggleUser(u.id) : onStartChat(u.id))}
                className={`flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 ${
                  selectedUsers.includes(u.id) ? "bg-primary/10" : ""
                }`}
              >
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                    {u.display_name[0]?.toUpperCase()}
                  </div>
                  {u.is_online && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-online" />
                  )}
                </div>
                <span className="text-sm font-medium text-foreground">{u.display_name}</span>
                {isGroupMode && selectedUsers.includes(u.id) && (
                  <span className="ml-auto text-primary text-xs">✓</span>
                )}
              </button>
            ))
          )}
        </div>

        {isGroupMode && selectedUsers.length > 0 && (
          <div className="border-t border-border p-4">
            <button
              onClick={() => onCreateGroup(groupName || "New Group", selectedUsers)}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Create Group ({selectedUsers.length} selected)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewChatDialog;
