import { ArrowLeft, Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed } from "lucide-react";

interface CallRecord {
  id: string;
  name: string;
  initials: string;
  avatar_url?: string;
  type: "voice" | "video";
  direction: "incoming" | "outgoing" | "missed";
  time: string;
}

const dummyCalls: CallRecord[] = [
  { id: "1", name: "Alice Johnson", initials: "AJ", type: "voice", direction: "incoming", time: "Today, 2:30 PM" },
  { id: "2", name: "Dev Team", initials: "DT", type: "video", direction: "outgoing", time: "Today, 11:00 AM" },
  { id: "3", name: "Mom ❤️", initials: "M", type: "voice", direction: "missed", time: "Yesterday, 6:45 PM" },
  { id: "4", name: "Charlie Park", initials: "CP", type: "video", direction: "incoming", time: "Yesterday, 3:20 PM" },
  { id: "5", name: "David Kim", initials: "DK", type: "voice", direction: "outgoing", time: "Monday, 9:00 AM" },
];

interface CallsPageProps {
  onBack: () => void;
}

const CallsPage = ({ onBack }: CallsPageProps) => {
  const getIcon = (direction: string) => {
    switch (direction) {
      case "incoming": return <PhoneIncoming className="h-4 w-4 text-primary" />;
      case "outgoing": return <PhoneOutgoing className="h-4 w-4 text-primary" />;
      case "missed": return <PhoneMissed className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col bg-card">
      <div className="flex items-center gap-3 bg-header px-3 py-3 text-header-foreground sm:px-4">
        <button onClick={onBack} className="min-h-10 min-w-10 rounded-full p-1 hover:bg-primary/20 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">Calls</h2>
      </div>

      {/* Link to create call */}
      <div className="border-b border-border px-3 py-3 sm:px-4">
        <button className="flex min-h-12 w-full items-center gap-3 rounded-lg p-2 hover:bg-muted transition-colors">
          <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
            <Phone className="h-5 w-5 text-primary-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">Create call link</p>
        </button>
      </div>

      <div className="px-3 py-2 sm:px-4">
        <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Recent</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {dummyCalls.map((call) => (
          <div key={call.id} className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/60 sm:px-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden text-sm font-semibold text-muted-foreground">
              {call.avatar_url ? (
                <img src={call.avatar_url} alt={call.name} className="h-full w-full object-cover" />
              ) : (
                call.initials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${call.direction === "missed" ? "text-destructive" : "text-foreground"}`}>
                {call.name}
              </p>
              <div className="flex items-center gap-1">
                {getIcon(call.direction)}
                <span className="text-xs text-muted-foreground">{call.time}</span>
              </div>
            </div>
            <button className="min-h-10 min-w-10 rounded-full p-2 text-primary transition-colors hover:bg-muted">
              {call.type === "video" ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CallsPage;
