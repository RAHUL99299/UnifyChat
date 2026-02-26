import { useState } from "react";
import { ArrowLeft, Plus, Camera, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface StatusItem {
  id: string;
  userName: string;
  avatarInitials: string;
  time: string;
  viewed: boolean;
}

const dummyStatuses: StatusItem[] = [
  { id: "1", userName: "Alice Johnson", avatarInitials: "AJ", time: "Today, 10:30 AM", viewed: false },
  { id: "2", userName: "Dev Team", avatarInitials: "DT", time: "Today, 9:15 AM", viewed: false },
  { id: "3", userName: "Emma Wilson", avatarInitials: "EW", time: "Yesterday", viewed: true },
];

interface StatusPageProps {
  onBack: () => void;
}

const StatusPage = ({ onBack }: StatusPageProps) => {
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [statusText, setStatusText] = useState("");

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center gap-3 bg-header px-4 py-3 text-header-foreground">
        <button onClick={onBack} className="p-1 hover:bg-primary/20 rounded-full transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">Status</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* My status */}
        <div className="px-4 py-3">
          <button
            onClick={() => setShowCreate(true)}
            className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-muted transition-colors"
          >
            <div className="relative">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                {user?.email?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                <Plus className="h-3 w-3 text-primary-foreground" />
              </div>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">My Status</p>
              <p className="text-xs text-muted-foreground">Tap to add status update</p>
            </div>
          </button>
        </div>

        {/* Recent statuses */}
        <div className="px-4">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Recent updates</h3>
          {dummyStatuses
            .filter((s) => !s.viewed)
            .map((status) => (
              <button
                key={status.id}
                className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-muted transition-colors"
              >
                <div className="h-12 w-12 rounded-full border-2 border-primary flex items-center justify-center text-sm font-semibold text-muted-foreground">
                  {status.avatarInitials}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">{status.userName}</p>
                  <p className="text-xs text-muted-foreground">{status.time}</p>
                </div>
              </button>
            ))}
        </div>

        <div className="px-4 mt-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Viewed updates</h3>
          {dummyStatuses
            .filter((s) => s.viewed)
            .map((status) => (
              <button
                key={status.id}
                className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-muted transition-colors"
              >
                <div className="h-12 w-12 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center text-sm font-semibold text-muted-foreground">
                  {status.avatarInitials}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">{status.userName}</p>
                  <p className="text-xs text-muted-foreground">{status.time}</p>
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* Create status dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-md mx-4 rounded-xl bg-card p-6 shadow-xl animate-scale-in">
            <h3 className="text-lg font-semibold text-foreground mb-4">Create Status</h3>
            <textarea
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
              placeholder="Type a status update..."
              className="w-full h-32 rounded-lg bg-muted p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 rounded-lg border border-border py-2 text-sm text-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FABs */}
      <div className="absolute bottom-20 right-6 flex flex-col gap-3">
        <button className="flex h-11 w-11 items-center justify-center rounded-full bg-muted shadow-lg hover:bg-muted/80 transition-colors">
          <Pencil className="h-5 w-5 text-foreground" />
        </button>
        <button className="flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg hover:bg-primary/90 transition-colors">
          <Camera className="h-6 w-6 text-primary-foreground" />
        </button>
      </div>
    </div>
  );
};

export default StatusPage;
