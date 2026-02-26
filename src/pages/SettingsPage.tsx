import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/hooks/useProfiles";
import {
  ArrowLeft,
  User,
  Lock,
  MessageSquare,
  Bell,
  Laptop,
  HelpCircle,
  ChevronRight,
  Camera,
} from "lucide-react";

interface SettingsPageProps {
  onBack: () => void;
  onOpenLinkedDevices: () => void;
}

const SettingsPage = ({ onBack, onOpenLinkedDevices }: SettingsPageProps) => {
  const { user } = useAuth();
  const { myProfile, updateMyProfile } = useProfiles();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [editName, setEditName] = useState(myProfile?.display_name || "");
  const [editBio, setEditBio] = useState(myProfile?.bio || "");

  const menuItems = [
    { key: "account", icon: User, label: "Account", desc: "Privacy, security, change number" },
    { key: "privacy", icon: Lock, label: "Privacy", desc: "Block contacts, disappearing messages" },
    { key: "chats", icon: MessageSquare, label: "Chats", desc: "Theme, wallpapers, chat history" },
    { key: "notifications", icon: Bell, label: "Notifications", desc: "Message, group & call tones" },
    { key: "linked", icon: Laptop, label: "Linked Devices", desc: "Manage your linked devices" },
    { key: "help", icon: HelpCircle, label: "Help", desc: "Help center, contact us, privacy policy" },
  ];

  if (activeSection === "account") {
    return (
      <div className="flex h-full flex-col bg-card">
        <div className="flex items-center gap-3 bg-header px-4 py-3 text-header-foreground">
          <button onClick={() => setActiveSection(null)} className="p-1 hover:bg-primary/20 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">Account</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Display Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => updateMyProfile({ display_name: editName })}
              className="mt-1 w-full rounded-lg bg-muted px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Bio</label>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              onBlur={() => updateMyProfile({ bio: editBio })}
              className="mt-1 w-full rounded-lg bg-muted px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none h-20"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Email</label>
            <p className="mt-1 text-sm text-foreground">{user?.email}</p>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === "privacy") {
    return (
      <div className="flex h-full flex-col bg-card">
        <div className="flex items-center gap-3 bg-header px-4 py-3 text-header-foreground">
          <button onClick={() => setActiveSection(null)} className="p-1 hover:bg-primary/20 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">Privacy</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {["Last Seen & Online", "Profile Photo", "About", "Read Receipts", "Disappearing Messages"].map(item => (
            <div key={item} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
              <span className="text-sm text-foreground">{item}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeSection === "chats") {
    return (
      <div className="flex h-full flex-col bg-card">
        <div className="flex items-center gap-3 bg-header px-4 py-3 text-header-foreground">
          <button onClick={() => setActiveSection(null)} className="p-1 hover:bg-primary/20 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">Chats</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {["Theme", "Wallpaper", "Chat backup", "Chat history", "Font size"].map(item => (
            <div key={item} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
              <span className="text-sm text-foreground">{item}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeSection === "notifications") {
    return (
      <div className="flex h-full flex-col bg-card">
        <div className="flex items-center gap-3 bg-header px-4 py-3 text-header-foreground">
          <button onClick={() => setActiveSection(null)} className="p-1 hover:bg-primary/20 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">Notifications</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {["Message notifications", "Group notifications", "Call notifications", "Notification tone"].map(item => (
            <div key={item} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
              <span className="text-sm text-foreground">{item}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center gap-3 bg-header px-4 py-3 text-header-foreground">
        <button onClick={onBack} className="p-1 hover:bg-primary/20 rounded-full transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>

      {/* Profile card */}
      <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground">
            {myProfile?.display_name?.[0]?.toUpperCase() || "U"}
          </div>
          <button className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
            <Camera className="h-3 w-3 text-primary-foreground" />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-foreground truncate">
            {myProfile?.display_name || "User"}
          </p>
          <p className="text-sm text-muted-foreground truncate">{myProfile?.bio || "Hey there!"}</p>
        </div>
      </div>

      {/* Menu */}
      <div className="flex-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.key}
            onClick={() => {
              if (item.key === "linked") {
                onOpenLinkedDevices();
              } else {
                setActiveSection(item.key);
              }
            }}
            className="flex w-full items-center gap-4 px-4 py-4 hover:bg-muted/60 transition-colors"
          >
            <item.icon className="h-5 w-5 text-muted-foreground" />
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default SettingsPage;
