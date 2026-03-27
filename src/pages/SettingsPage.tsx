import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/hooks/useProfiles";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";
import { useUserSettings } from "@/hooks/useUserSettings";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { sampleContacts, sampleMessages } from "@/data/sampleChats";
import { supabase } from "@/integrations/supabase/client";
import { requestNotificationPermissionIfNeeded } from "@/lib/browserNotifications";
import {
  ArrowLeft, User, Lock, MessageSquare, Bell, Laptop, HelpCircle,
  ChevronRight, Camera, Trash2, Shield, Eye, EyeOff,
  Moon, Sun, Palette, Download, Archive, MessageCircle,
  Phone, Info, Mail, AlertTriangle, Volume2, Send,
} from "lucide-react";

/* ─── Animated slide-in wrapper ─── */
const SlideIn = ({ children, direction = "right" }: { children: React.ReactNode; direction?: "right" | "left" | "up" }) => {
  const [show, setShow] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setShow(true)); }, []);
  const translate = direction === "right" ? "translate-x-4" : direction === "left" ? "-translate-x-4" : "translate-y-4";
  return (
    <div className={`h-full w-full transition-all duration-300 ease-out ${show ? "opacity-100 translate-x-0 translate-y-0" : `opacity-0 ${translate}`}`}>
      {children}
    </div>
  );
};

/* ─── Toggle Switch ─── */
const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
  <label className="flex items-center justify-between py-3 cursor-pointer group">
    <span className="text-sm text-foreground group-hover:text-primary transition-colors">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  </label>
);

/* ─── Radio Option ─── */
const RadioOption = ({ value, current, onChange, label, desc }: { value: string; current: string; onChange: (v: string) => void; label: string; desc?: string }) => (
  <button type="button" onClick={() => onChange(value)} className="flex w-full items-center gap-3 py-2.5 px-1 cursor-pointer rounded-lg hover:bg-muted/50 transition-colors text-left">
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${current === value ? "border-primary" : "border-muted-foreground/40"}`}>
      {current === value && <span className="h-2.5 w-2.5 rounded-full bg-primary animate-in zoom-in-50 duration-150" />}
    </span>
    <div>
      <span className="text-sm text-foreground">{label}</span>
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
    </div>
  </button>
);

/* ─── Section Header ─── */
const SectionHeader = ({ title, onBack }: { title: string; onBack: () => void }) => (
  <div className="flex items-center gap-3 bg-header px-4 py-3 text-header-foreground sticky top-0 z-10">
    <button onClick={onBack} className="p-1.5 hover:bg-primary/20 rounded-full transition-all active:scale-90">
      <ArrowLeft className="h-5 w-5" />
    </button>
    <h2 className="text-lg font-semibold">{title}</h2>
  </div>
);

/* ─── Menu Row ─── */
const MenuRow = ({ icon: Icon, label, desc, onClick, danger }: { icon: any; label: string; desc?: string; onClick: () => void; danger?: boolean }) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center gap-4 px-4 py-3.5 hover:bg-muted/60 transition-all active:scale-[0.99] ${danger ? "text-destructive" : ""}`}
  >
    <Icon className={`h-5 w-5 ${danger ? "text-destructive" : "text-muted-foreground"}`} />
    <div className="text-left flex-1 min-w-0">
      <p className={`text-sm font-medium ${danger ? "text-destructive" : "text-foreground"}`}>{label}</p>
      {desc && <p className="text-xs text-muted-foreground truncate">{desc}</p>}
    </div>
    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
  </button>
);

/* ─── Save Button ─── */
const SaveButton = ({ onClick, saving, label }: { onClick: () => void; saving?: boolean; label?: string }) => (
  <div className="border-t border-border p-4 bg-card">
    <button
      onClick={onClick}
      disabled={saving}
      className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
    >
      {saving ? "Saving..." : label || "Save"}
    </button>
  </div>
);

/* ─── Wallpaper swatch ─── */
const WallpaperSwatch = ({ color, label, selected, onClick }: { color: string; label: string; selected: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1.5 transition-all duration-200 ${selected ? "scale-105" : "hover:scale-105"}`}
  >
    <div
      className={`h-20 w-16 rounded-xl border-2 transition-all shadow-sm ${selected ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
      style={{ background: color === "none" ? "repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 50%/16px 16px" : color }}
    />
    <span className={`text-xs ${selected ? "text-primary font-semibold" : "text-muted-foreground"}`}>{label}</span>
  </button>
);

/* ─── FAQ Item ─── */
const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between py-3 text-left">
        <span className="text-sm font-medium text-foreground">{q}</span>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-200 ${open ? "max-h-40 pb-3" : "max-h-0"}`}>
        <p className="text-sm text-muted-foreground">{a}</p>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════ */
/* ─── MAIN COMPONENT ─── */
/* ═══════════════════════════════════════════ */

interface SettingsPageProps {
  onBack: () => void;
  onOpenLinkedDevices: () => void;
}

const SettingsPage = ({ onBack, onOpenLinkedDevices }: SettingsPageProps) => {
  const { user, signOut } = useAuth();
  const { myProfile, updateMyProfile } = useProfiles();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { settings: serverSettings, updateSettings } = useUserSettings();

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [subPage, setSubPage] = useState<string | null>(null);

  // Account state
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Profile photo
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [showImageCropDialog, setShowImageCropDialog] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Privacy state
  const [lastSeenOption, setLastSeenOption] = useState("nobody");
  const [profilePhotoOption, setProfilePhotoOption] = useState("everyone");
  const [aboutOption, setAboutOption] = useState("nobody");
  const [readReceipts, setReadReceipts] = useState(true);
  const [disappearingTimeout, setDisappearingTimeout] = useState(7);
  const [blockedContacts] = useState<string[]>([]);

  // Chats state
  const [wallpaper, setWallpaper] = useState("none");
  const [fontSize, setFontSize] = useState("normal");
  const [enterToSend, setEnterToSend] = useState(true);
  const [mediaAutoDownload, setMediaAutoDownload] = useState(true);

  // Notifications state
  const [msgNotify, setMsgNotify] = useState(true);
  const [groupNotify, setGroupNotify] = useState(true);
  const [callNotify, setCallNotify] = useState(true);
  const [notifySound, setNotifySound] = useState("default");
  const [vibrate, setVibrate] = useState(true);
  const [highPriority, setHighPriority] = useState(false);

  // Help state
  const [supportMsg, setSupportMsg] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(`settings:${user.id}`);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.privacy) {
        setLastSeenOption(s.privacy.lastSeen || "nobody");
        setProfilePhotoOption(s.privacy.profilePhoto || "everyone");
        setAboutOption(s.privacy.about || "nobody");
        setReadReceipts(s.privacy.readReceipts !== false);
        setDisappearingTimeout(s.privacy.disappearingTimeout || 7);
      }
      if (s.chats) {
        setWallpaper(s.chats.wallpaper || "none");
        setFontSize(s.chats.fontSize || "normal");
        setEnterToSend(s.chats.enterToSend !== false);
        setMediaAutoDownload(s.chats.mediaAutoDownload !== false);
      }
      if (s.notifications) {
        setMsgNotify(s.notifications.msgNotify !== false);
        setGroupNotify(s.notifications.groupNotify !== false);
        setCallNotify(s.notifications.callNotify !== false);
        setNotifySound(s.notifications.sound || "default");
        setVibrate(s.notifications.vibrate !== false);
        setHighPriority(!!s.notifications.highPriority);
      }
    } catch (_e) { /* ignore parse errors */ }
  }, [user]);

  // Keep local state synced with server settings updates (including realtime updates).
  useEffect(() => {
    if (!serverSettings?.privacy) return;

    const p = serverSettings.privacy;
    setLastSeenOption(p.lastSeen || "nobody");
    setProfilePhotoOption(p.profilePhoto || "everyone");
    setAboutOption(p.about || "nobody");
    setReadReceipts(p.readReceipts !== false);
    setDisappearingTimeout(p.disappearingTimeout || 7);
  }, [serverSettings]);

  // Sync account fields when entering account section
  useEffect(() => {
    if (activeSection === "account") {
      setEditName(myProfile?.display_name || "");
      setEditBio(myProfile?.bio || "");
      setEditPhone(myProfile?.phone || "");
    }
  }, [activeSection, myProfile]);

  // Persist helper — saves to localStorage + fires updateSettings (no await)
  const persistSettings = (key: string, data: any) => {
    try {
      const allRaw = localStorage.getItem(`settings:${user?.id}`);
      const all = allRaw ? JSON.parse(allRaw) : {};
      all[key] = data;
      localStorage.setItem(`settings:${user?.id}`, JSON.stringify(all));
      updateSettings({ ...(serverSettings || {}), [key]: data }).catch(() => {});
    } catch (_e) { /* ignore */ }
  };

  const ensureSystemNotificationPermission = async () => {
    const permission = await requestNotificationPermissionIfNeeded();
    if (permission === "unsupported") {
      toast({
        title: "Notifications unavailable",
        description: "This browser does not support system notifications.",
      });
      return;
    }

    if (permission === "denied") {
      toast({
        title: "Notifications blocked",
        description: "Allow notifications in browser settings to get top-bar alerts.",
        variant: "destructive",
      });
    }
  };

  const openAvatarFilePicker = () => {
    if (!fileInputRef.current) return;
    // Clear value so selecting the same file still triggers onChange.
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  // Avatar upload - open crop dialog instead of direct upload
  const handleAvatarFileSelected = (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImageToCrop(result);
        setShowImageCropDialog(true);
      };
      reader.readAsDataURL(file);
    } catch (_e) {
      toast({ title: "Error", description: "Failed to read image file", variant: "destructive" });
    }
  };

  // Handle crop completion
  const handleCropComplete = async (croppedBlob: Blob) => {
    try {
      setIsUploadingAvatar(true);
      setShowImageCropDialog(false);
      setImageToCrop(null);

      const preview = URL.createObjectURL(croppedBlob);
      setAvatarPreview(preview);

      // Delete old avatar if it exists (automatic cleanup for storage optimization)
      if (myProfile?.avatar_url) {
        try {
          // Extract the file path from the public URL
          // URL format: https://[project-id].supabase.co/storage/v1/object/public/avatars/[user-id]/[timestamp].jpg
          const urlParts = myProfile.avatar_url.split('/avatars/');
          if (urlParts.length === 2) {
            const oldPath = urlParts[1];
            await supabase.storage.from("avatars").remove([oldPath]);
          }
        } catch (cleanupError) {
          // Log cleanup error but don't fail the upload - old files can be manually cleaned later
          console.warn("Failed to delete old avatar:", cleanupError);
        }
      }

      // Upload cropped image
      const timestamp = Date.now();
      const path = `${user?.id}/${timestamp}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, croppedBlob, { upsert: false });

      if (uploadError) {
        const msg = String(uploadError.message || "");
        const details = msg.toLowerCase().includes("bucket")
          ? "Avatar storage bucket is missing. Please run latest Supabase migrations."
          : msg || "Failed to upload avatar.";
        toast({ title: "Avatar upload failed", description: details, variant: "destructive" });
        return;
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      if (urlData?.publicUrl) {
        await updateMyProfile({ avatar_url: urlData.publicUrl });
        toast({ title: "Avatar updated", description: "Your profile photo is now visible to all users." });
        setShowAvatarEditor(false);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to upload avatar", variant: "destructive" });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const removeAvatar = () => {
    setAvatarPreview(null);
    updateMyProfile({ avatar_url: null }).catch(() => {});
    toast({ title: "Photo removed" });
  };

  /* ═══════════════════════════════════════════ */
  /* ─── PROFILE PHOTO EDITOR ─── */
  /* ═══════════════════════════════════════════ */
  if (showAvatarEditor) {
    return (
      <div className="flex h-full w-full flex-col bg-card animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
        <SectionHeader title="Edit Profile Photo" onBack={() => setShowAvatarEditor(false)} />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
          <div className="h-32 w-32 rounded-full bg-muted flex items-center justify-center text-4xl font-bold text-muted-foreground overflow-hidden ring-4 ring-primary/20">
            {avatarPreview || myProfile?.avatar_url ? (
              <img src={avatarPreview || myProfile?.avatar_url || ""} className="h-full w-full object-cover" alt="avatar" />
            ) : (
              myProfile?.display_name?.[0]?.toUpperCase() || "U"
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={openAvatarFilePicker}
              disabled={isUploadingAvatar}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-60"
            >
              <Camera className="h-4 w-4" /> Upload Photo
            </button>
            {(avatarPreview || myProfile?.avatar_url) && (
              <button onClick={() => { removeAvatar(); setShowAvatarEditor(false); }} className="flex items-center gap-2 rounded-xl bg-destructive/10 px-5 py-2.5 text-sm font-medium text-destructive transition-all hover:bg-destructive/20 active:scale-95">
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleAvatarFileSelected(file);
              }
            }}
          />

          {showImageCropDialog && imageToCrop && (
            <ImageCropDialog
              imageSrc={imageToCrop}
              onCropComplete={handleCropComplete}
              onCancel={() => {
                setShowImageCropDialog(false);
                setImageToCrop(null);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════ */
  /* ─── ACCOUNT SECTION ─── */
  /* ═══════════════════════════════════════════ */
  if (activeSection === "account") {
    if (showDeleteConfirm) {
      return (
        <div className="flex h-full w-full flex-col bg-card animate-in fade-in-0 duration-200">
          <SectionHeader title="Delete Account" onBack={() => setShowDeleteConfirm(false)} />
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 text-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Delete your account?</h3>
            <p className="text-sm text-muted-foreground max-w-xs">This will permanently delete your account, messages, and all data. This action cannot be undone.</p>
            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-all hover:bg-muted active:scale-95">Cancel</button>
              <button onClick={() => { toast({ title: "Account deletion requested", description: "Contact support for approval." }); setShowDeleteConfirm(false); }} className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground transition-all hover:bg-destructive/90 active:scale-95">Delete</button>
            </div>
          </div>
        </div>
      );
    }

    if (subPage) {
      return (
        <SlideIn direction="right">
          <div className="flex h-full flex-col bg-card">
            <SectionHeader title={subPage === "info" ? "Account Info" : "Change Phone"} onBack={() => setSubPage(null)} />
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {subPage === "info" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm text-foreground">{user?.email}</p></div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm text-foreground">{myProfile?.phone || "Not set"}</p></div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <Info className="h-5 w-5 text-muted-foreground" />
                    <div><p className="text-xs text-muted-foreground">Member since</p><p className="text-sm text-foreground">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "Unknown"}</p></div>
                  </div>
                </div>
              )}
              {subPage === "phone" && (
                <>
                  <p className="text-sm text-muted-foreground">Update your phone number.</p>
                  <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+91 98765 43210" className="w-full rounded-xl bg-muted px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                </>
              )}
            </div>
            {subPage === "phone" && (
              <SaveButton onClick={async () => {
                setSaving(true);
                try {
                  await updateMyProfile({ phone: editPhone });
                  toast({ title: "Phone updated" });
                  setSubPage(null);
                } catch (e: any) {
                  toast({ title: "Error", description: e?.message || "Failed", variant: "destructive" });
                } finally { setSaving(false); }
              }} saving={saving} />
            )}
          </div>
        </SlideIn>
      );
    }

    return (
      <SlideIn direction="right">
        <div className="flex h-full flex-col bg-card">
          <SectionHeader title="Account" onBack={() => setActiveSection(null)} />
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1 w-full rounded-xl bg-muted px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bio / Status</label>
              <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="mt-1 w-full rounded-xl bg-muted px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none h-20 transition-all" />
            </div>
            <div className="border-t border-border pt-3 space-y-0">
              <MenuRow icon={Phone} label="Change phone number" desc={myProfile?.phone || "Not set"} onClick={() => setSubPage("phone")} />
              <MenuRow icon={Info} label="Account info" desc="View account details" onClick={() => setSubPage("info")} />
              <MenuRow icon={Trash2} label="Delete account" desc="Permanently delete" onClick={() => setShowDeleteConfirm(true)} danger />
            </div>
          </div>
          <SaveButton saving={saving} onClick={async () => {
            setSaving(true);
            try {
              try {
                await updateMyProfile({ display_name: editName, bio: editBio, phone: editPhone });
                toast({ title: "Saved", description: "Account details updated." });
              } catch (error: any) {
                const msg = String(error?.message ?? "");
                if (msg.includes("phone")) {
                  await updateMyProfile({ display_name: editName, bio: editBio });
                  toast({ title: "Saved (except phone)", description: "Phone column not available.", variant: "destructive" });
                } else throw error;
              }
            } catch (e: any) {
              toast({ title: "Error", description: e?.message ?? "Save failed.", variant: "destructive" });
            } finally { setSaving(false); }
          }} />
        </div>
      </SlideIn>
    );
  }

  /* ═══════════════════════════════════════════ */
  /* ─── PRIVACY SECTION ─── */
  /* ═══════════════════════════════════════════ */
  if (activeSection === "privacy") {
    if (subPage) {
      const savePrivacy = () => {
        const data = { lastSeen: lastSeenOption, profilePhoto: profilePhotoOption, about: aboutOption, readReceipts, disappearingTimeout };
        persistSettings("privacy", data);
        toast({ title: "Saved", description: "Privacy settings updated." });
        setSubPage(null);
      };

      return (
        <SlideIn direction="right">
          <div className="flex h-full flex-col bg-card">
            <SectionHeader title={
              subPage === "last_seen" ? "Last Seen & Online" :
              subPage === "profile_photo" ? "Profile Photo" :
              subPage === "about" ? "About" :
              subPage === "read_receipts" ? "Read Receipts" :
              subPage === "disappearing" ? "Disappearing Messages" :
              subPage === "blocked" ? "Blocked Contacts" : ""
            } onBack={() => setSubPage(null)} />
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {subPage === "last_seen" && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground mb-3">Who can see your last seen and online status.</p>
                  <RadioOption value="everyone" current={lastSeenOption} onChange={setLastSeenOption} label="Everyone" />
                  <RadioOption value="contacts" current={lastSeenOption} onChange={setLastSeenOption} label="My contacts" />
                  <RadioOption value="contacts_except" current={lastSeenOption} onChange={setLastSeenOption} label="My contacts except..." />
                  <RadioOption value="nobody" current={lastSeenOption} onChange={setLastSeenOption} label="Nobody" />
                </div>
              )}
              {subPage === "profile_photo" && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground mb-3">Who can see your profile photo.</p>
                  <RadioOption value="everyone" current={profilePhotoOption} onChange={setProfilePhotoOption} label="Everyone" />
                  <RadioOption value="contacts" current={profilePhotoOption} onChange={setProfilePhotoOption} label="My contacts" />
                  <RadioOption value="nobody" current={profilePhotoOption} onChange={setProfilePhotoOption} label="Nobody" />
                </div>
              )}
              {subPage === "about" && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground mb-3">Who can see your About info.</p>
                  <RadioOption value="everyone" current={aboutOption} onChange={setAboutOption} label="Everyone" />
                  <RadioOption value="contacts" current={aboutOption} onChange={setAboutOption} label="My contacts" />
                  <RadioOption value="nobody" current={aboutOption} onChange={setAboutOption} label="Nobody" />
                </div>
              )}
              {subPage === "read_receipts" && (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">If turned off, you won't see read receipts from others either.</p>
                  <Toggle checked={readReceipts} onChange={setReadReceipts} label="Read receipts" />
                </div>
              )}
              {subPage === "disappearing" && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground mb-3">New messages will disappear after the selected duration.</p>
                  <RadioOption value="0" current={String(disappearingTimeout)} onChange={(v) => setDisappearingTimeout(Number(v))} label="Off" />
                  <RadioOption value="1" current={String(disappearingTimeout)} onChange={(v) => setDisappearingTimeout(Number(v))} label="24 hours" />
                  <RadioOption value="7" current={String(disappearingTimeout)} onChange={(v) => setDisappearingTimeout(Number(v))} label="7 days" />
                  <RadioOption value="90" current={String(disappearingTimeout)} onChange={(v) => setDisappearingTimeout(Number(v))} label="90 days" />
                </div>
              )}
              {subPage === "blocked" && (
                <div>
                  {blockedContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Shield className="h-12 w-12 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">No blocked contacts</p>
                      <p className="text-xs text-muted-foreground mt-1">Contacts you block will appear here.</p>
                    </div>
                  ) : (
                    blockedContacts.map((c) => <div key={c} className="p-3 text-sm">{c}</div>)
                  )}
                </div>
              )}
            </div>
            {subPage !== "blocked" && <SaveButton onClick={savePrivacy} />}
          </div>
        </SlideIn>
      );
    }

    const privacyValue = (key: string) => {
      if (key === "last_seen") return lastSeenOption;
      if (key === "profile_photo") return profilePhotoOption;
      if (key === "about") return aboutOption;
      return "";
    };

    return (
      <SlideIn direction="right">
        <div className="flex h-full flex-col bg-card">
          <SectionHeader title="Privacy" onBack={() => setActiveSection(null)} />
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Who can see my personal info</p></div>
            {[
              { key: "last_seen", icon: Eye, label: "Last seen & online" },
              { key: "profile_photo", icon: Camera, label: "Profile photo" },
              { key: "about", icon: Info, label: "About" },
            ].map((item) => (
              <button key={item.key} onClick={() => setSubPage(item.key)} className="flex w-full items-center gap-4 px-4 py-3 hover:bg-muted/60 transition-all active:scale-[0.99]">
                <item.icon className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 text-left">
                  <p className="text-sm text-foreground">{item.label}</p>
                  <p className="text-xs text-primary capitalize">{privacyValue(item.key)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}

            <div className="px-4 py-2 mt-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Messaging</p></div>
            <button onClick={() => setSubPage("read_receipts")} className="flex w-full items-center gap-4 px-4 py-3 hover:bg-muted/60 transition-all">
              <EyeOff className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 text-left"><p className="text-sm text-foreground">Read receipts</p><p className="text-xs text-primary">{readReceipts ? "On" : "Off"}</p></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button onClick={() => setSubPage("disappearing")} className="flex w-full items-center gap-4 px-4 py-3 hover:bg-muted/60 transition-all">
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 text-left"><p className="text-sm text-foreground">Disappearing messages</p><p className="text-xs text-primary">{disappearingTimeout === 0 ? "Off" : `${disappearingTimeout} days`}</p></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <div className="px-4 py-2 mt-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contacts</p></div>
            <button onClick={() => setSubPage("blocked")} className="flex w-full items-center gap-4 px-4 py-3 hover:bg-muted/60 transition-all">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 text-left"><p className="text-sm text-foreground">Blocked contacts</p><p className="text-xs text-muted-foreground">{blockedContacts.length}</p></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </SlideIn>
    );
  }

  /* ═══════════════════════════════════════════ */
  /* ─── CHATS SECTION ─── */
  /* ═══════════════════════════════════════════ */
  if (activeSection === "chats") {
    const wallpapers = [
      { color: "none", label: "Default" },
      { color: "#f3f4f6", label: "Light" },
      { color: "#e0e7ff", label: "Indigo" },
      { color: "#ecfdf5", label: "Mint" },
      { color: "#fff7ed", label: "Warm" },
      { color: "#fdf2f8", label: "Rose" },
      { color: "#0f172a", label: "Midnight" },
      { color: "#1e293b", label: "Slate" },
      { color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", label: "Gradient 1" },
      { color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", label: "Gradient 2" },
    ];

    const downloadBackup = () => {
      try {
        const payload = { contacts: sampleContacts, messages: sampleMessages, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `unifychat-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        toast({ title: "Backup downloaded" });
      } catch (_e) { toast({ title: "Error", description: "Failed to create backup.", variant: "destructive" }); }
    };

    const saveChats = () => {
      const data = { theme, wallpaper, fontSize, enterToSend, mediaAutoDownload };
      persistSettings("chats", data);
      if (fontSize === "small") document.documentElement.style.fontSize = "13px";
      else if (fontSize === "large") document.documentElement.style.fontSize = "17px";
      else document.documentElement.style.fontSize = "15px";
      toast({ title: "Saved", description: "Chat settings saved." });
    };

    if (subPage) {
      return (
        <SlideIn direction="right">
          <div className="flex h-full flex-col bg-card">
            <SectionHeader title={
              subPage === "theme" ? "Theme" :
              subPage === "wallpaper" ? "Chat Wallpaper" :
              subPage === "font" ? "Font Size" :
              subPage === "history" ? "Chat History" :
              subPage === "archive" ? "Archived Chats" : ""
            } onBack={() => setSubPage(null)} />
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {subPage === "theme" && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground mb-3">Choose your preferred appearance.</p>
                  <RadioOption value="light" current={theme} onChange={(v) => setTheme(v as any)} label="Light" desc="Bright and clean" />
                  <RadioOption value="dark" current={theme} onChange={(v) => setTheme(v as any)} label="Dark" desc="Easy on the eyes" />
                </div>
              )}
              {subPage === "wallpaper" && (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">Choose a background for the chat area.</p>
                  <div className="grid grid-cols-5 gap-3">
                    {wallpapers.map((w) => <WallpaperSwatch key={w.label} {...w} selected={wallpaper === w.color} onClick={() => setWallpaper(w.color)} />)}
                  </div>
                  <div className="mt-6 rounded-xl border border-border overflow-hidden">
                    <div className="text-xs text-muted-foreground px-3 py-2 bg-muted/50">Preview</div>
                    <div className="h-32 flex items-center justify-center" style={{ background: wallpaper === "none" ? "var(--chat-bg, #e5ddd5)" : wallpaper }}>
                      <div className="bg-white/90 dark:bg-gray-800/90 rounded-lg px-3 py-1.5 shadow-sm text-xs text-foreground">Hello! This is a preview.</div>
                    </div>
                  </div>
                </div>
              )}
              {subPage === "font" && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground mb-3">Choose message text size.</p>
                  <RadioOption value="small" current={fontSize} onChange={setFontSize} label="Small" desc="Compact text" />
                  <RadioOption value="normal" current={fontSize} onChange={setFontSize} label="Normal" desc="Default size" />
                  <RadioOption value="large" current={fontSize} onChange={setFontSize} label="Large" desc="Easier to read" />
                </div>
              )}
              {subPage === "history" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Manage your chat history data.</p>
                  <button onClick={downloadBackup} className="flex w-full items-center gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm hover:bg-muted transition-all active:scale-[0.98]">
                    <Download className="h-5 w-5 text-primary" /> <span className="text-foreground">Export all chats</span>
                  </button>
                  <button onClick={() => { localStorage.removeItem(`chatsData:${user?.id}`); toast({ title: "Cleared", description: "Local chat history cleared." }); }} className="flex w-full items-center gap-3 rounded-xl bg-destructive/5 px-4 py-3 text-sm hover:bg-destructive/10 transition-all active:scale-[0.98]">
                    <Trash2 className="h-5 w-5 text-destructive" /> <span className="text-destructive">Clear all chats</span>
                  </button>
                </div>
              )}
              {subPage === "archive" && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Archive className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No archived chats</p>
                  <p className="text-xs text-muted-foreground mt-1">Archived conversations will appear here.</p>
                </div>
              )}
            </div>
            {(subPage === "theme" || subPage === "wallpaper" || subPage === "font") && <SaveButton onClick={saveChats} />}
          </div>
        </SlideIn>
      );
    }

    return (
      <SlideIn direction="right">
        <div className="flex h-full flex-col bg-card">
          <SectionHeader title="Chats" onBack={() => setActiveSection(null)} />
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display</p></div>
            <MenuRow icon={theme === "dark" ? Moon : Sun} label="Theme" desc={theme === "dark" ? "Dark" : "Light"} onClick={() => setSubPage("theme")} />
            <MenuRow icon={Palette} label="Wallpaper" desc={wallpaper === "none" ? "Default" : "Custom"} onClick={() => setSubPage("wallpaper")} />
            <MenuRow icon={MessageSquare} label="Font size" desc={fontSize} onClick={() => setSubPage("font")} />

            <div className="px-4 py-2 mt-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chat settings</p></div>
            <div className="px-4">
              <Toggle checked={enterToSend} onChange={(v) => { setEnterToSend(v); persistSettings("chats", { theme, wallpaper, fontSize, enterToSend: v, mediaAutoDownload }); }} label="Enter key sends message" />
              <Toggle checked={mediaAutoDownload} onChange={(v) => { setMediaAutoDownload(v); persistSettings("chats", { theme, wallpaper, fontSize, enterToSend, mediaAutoDownload: v }); }} label="Media auto-download" />
            </div>

            <div className="px-4 py-2 mt-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</p></div>
            <MenuRow icon={Download} label="Chat backup & export" desc="Download or export chats" onClick={() => setSubPage("history")} />
            <MenuRow icon={Archive} label="Archived chats" desc="View archived conversations" onClick={() => setSubPage("archive")} />
          </div>
        </div>
      </SlideIn>
    );
  }

  /* ═══════════════════════════════════════════ */
  /* ─── NOTIFICATIONS SECTION ─── */
  /* ═══════════════════════════════════════════ */
  if (activeSection === "notifications") {
    if (subPage === "tones") {
      return (
        <SlideIn direction="right">
          <div className="flex h-full flex-col bg-card">
            <SectionHeader title="Notification Sound" onBack={() => setSubPage(null)} />
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {["default", "chime", "ding", "pop", "none"].map((s) => (
                <RadioOption key={s} value={s} current={notifySound} onChange={setNotifySound} label={s.charAt(0).toUpperCase() + s.slice(1)} />
              ))}
            </div>
            <SaveButton onClick={() => { persistSettings("notifications", { msgNotify, groupNotify, callNotify, sound: notifySound, vibrate, highPriority }); toast({ title: "Saved" }); setSubPage(null); }} />
          </div>
        </SlideIn>
      );
    }

    return (
      <SlideIn direction="right">
        <div className="flex h-full flex-col bg-card">
          <SectionHeader title="Notifications" onBack={() => setActiveSection(null)} />
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alerts</p></div>
            <div className="px-4">
              <Toggle checked={msgNotify} onChange={(v) => { setMsgNotify(v); persistSettings("notifications", { msgNotify: v, groupNotify, callNotify, sound: notifySound, vibrate, highPriority }); if (v) void ensureSystemNotificationPermission(); }} label="Message notifications" />
              <Toggle checked={groupNotify} onChange={(v) => { setGroupNotify(v); persistSettings("notifications", { msgNotify, groupNotify: v, callNotify, sound: notifySound, vibrate, highPriority }); }} label="Group notifications" />
              <Toggle checked={callNotify} onChange={(v) => { setCallNotify(v); persistSettings("notifications", { msgNotify, groupNotify, callNotify: v, sound: notifySound, vibrate, highPriority }); }} label="Call notifications" />
            </div>

            <div className="px-4 py-2 mt-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sound & Vibration</p></div>
            <MenuRow icon={Volume2} label="Notification tone" desc={notifySound.charAt(0).toUpperCase() + notifySound.slice(1)} onClick={() => setSubPage("tones")} />
            <div className="px-4">
              <Toggle checked={vibrate} onChange={(v) => { setVibrate(v); persistSettings("notifications", { msgNotify, groupNotify, callNotify, sound: notifySound, vibrate: v, highPriority }); }} label="Vibrate" />
            </div>

            <div className="px-4 py-2 mt-2"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</p></div>
            <div className="px-4">
              <Toggle checked={highPriority} onChange={(v) => { setHighPriority(v); persistSettings("notifications", { msgNotify, groupNotify, callNotify, sound: notifySound, vibrate, highPriority: v }); if (v) void ensureSystemNotificationPermission(); }} label="High priority notifications" />
              <p className="text-xs text-muted-foreground -mt-2 mb-2">Show notifications at the top with preview pop-ups.</p>
            </div>
          </div>
        </div>
      </SlideIn>
    );
  }

  /* ═══════════════════════════════════════════ */
  /* ─── HELP SECTION ─── */
  /* ═══════════════════════════════════════════ */
  if (activeSection === "help") {
    if (subPage === "faq") {
      return (
        <SlideIn direction="right">
          <div className="flex h-full flex-col bg-card">
            <SectionHeader title="FAQ" onBack={() => setSubPage(null)} />
            <div className="flex-1 overflow-y-auto p-4">
              <FaqItem q="How do I change my profile photo?" a="Go to Settings → tap your profile photo → Upload Photo." />
              <FaqItem q="How do I block someone?" a="Open Settings → Privacy → Blocked contacts." />
              <FaqItem q="Can I export my chat history?" a="Go to Settings → Chats → Chat backup & export → Export all chats." />
              <FaqItem q="How do I change the theme?" a="Go to Settings → Chats → Theme → choose Light or Dark." />
              <FaqItem q="How do disappearing messages work?" a="When enabled, new messages auto-delete after the chosen timer." />
              <FaqItem q="Is my data secure?" a="Yes. All messages are encrypted in transit and stored securely." />
            </div>
          </div>
        </SlideIn>
      );
    }

    if (subPage === "contact") {
      return (
        <SlideIn direction="right">
          <div className="flex h-full flex-col bg-card">
            <SectionHeader title="Contact Support" onBack={() => setSubPage(null)} />
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="text-sm text-muted-foreground">Describe your issue and we'll get back to you.</p>
              <textarea value={supportMsg} onChange={(e) => setSupportMsg(e.target.value)} placeholder="Describe your issue or question..." className="w-full rounded-xl bg-muted px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none h-40 transition-all" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span>Your email: {user?.email}</span>
              </div>
            </div>
            <SaveButton label="Send Message" saving={sendingSupport} onClick={() => {
              if (!supportMsg.trim()) { toast({ title: "Please enter a message" }); return; }
              setSendingSupport(true);
              setTimeout(() => {
                toast({ title: "Message sent!", description: "Our team will review it." });
                setSupportMsg("");
                setSendingSupport(false);
                setSubPage(null);
              }, 1200);
            }} />
          </div>
        </SlideIn>
      );
    }

    if (subPage === "privacy_policy") {
      return (
        <SlideIn direction="right">
          <div className="flex h-full flex-col bg-card">
            <SectionHeader title="Privacy Policy" onBack={() => setSubPage(null)} />
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <h3 className="text-base font-semibold text-foreground">UnifyChat Privacy Policy</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Last updated: March 2026</p>
              <p className="text-sm text-muted-foreground leading-relaxed">Your privacy is important to us. We collect only the minimum data necessary.</p>
              <h4 className="text-sm font-semibold text-foreground">Data We Collect</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">• Account info (email, name, phone)<br/>• Messages (stored encrypted)<br/>• Usage data (performance logs)</p>
              <h4 className="text-sm font-semibold text-foreground">Your Rights</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">You can request data deletion via Settings → Account → Delete Account.</p>
              <h4 className="text-sm font-semibold text-foreground">Contact</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">privacy@unifychat.app</p>
            </div>
          </div>
        </SlideIn>
      );
    }

    if (subPage === "app_info") {
      return (
        <SlideIn direction="right">
          <div className="flex h-full flex-col bg-card">
            <SectionHeader title="App Info" onBack={() => setSubPage(null)} />
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">UnifyChat</h3>
              <p className="text-sm text-muted-foreground">Version 1.0.0</p>
              <div className="space-y-2 text-center">
                <p className="text-xs text-muted-foreground">Connect, chat, and share seamlessly.</p>
                <p className="text-xs text-muted-foreground">Built with React + Supabase</p>
                <p className="text-xs text-muted-foreground">© 2026 UnifyChat. All rights reserved.</p>
              </div>
            </div>
          </div>
        </SlideIn>
      );
    }

    return (
      <SlideIn direction="right">
        <div className="flex h-full flex-col bg-card">
          <SectionHeader title="Help" onBack={() => setActiveSection(null)} />
          <div className="flex-1 overflow-y-auto">
            <MenuRow icon={HelpCircle} label="FAQ" desc="Frequently asked questions" onClick={() => setSubPage("faq")} />
            <MenuRow icon={Send} label="Contact support" desc="Get help from our team" onClick={() => setSubPage("contact")} />
            <MenuRow icon={Shield} label="Privacy policy" desc="How we handle your data" onClick={() => setSubPage("privacy_policy")} />
            <MenuRow icon={Info} label="App info" desc="Version and details" onClick={() => setSubPage("app_info")} />
          </div>
        </div>
      </SlideIn>
    );
  }

  /* ═══════════════════════════════════════════ */
  /* ─── MAIN SETTINGS MENU ─── */
  /* ═══════════════════════════════════════════ */
  const menuItems = [
    { key: "account", icon: User, label: "Account", desc: "Privacy, security, change number" },
    { key: "privacy", icon: Lock, label: "Privacy", desc: "Block contacts, disappearing messages" },
    { key: "chats", icon: MessageSquare, label: "Chats", desc: "Theme, wallpapers, chat history" },
    { key: "notifications", icon: Bell, label: "Notifications", desc: "Message, group & call tones" },
    { key: "linked", icon: Laptop, label: "Linked Devices", desc: "Manage your linked devices" },
    { key: "help", icon: HelpCircle, label: "Help", desc: "Help center, contact us, privacy policy" },
  ];

  return (
    <div className="flex h-full w-full flex-col bg-card">
      <div className="flex items-center gap-3 bg-header px-4 py-3 text-header-foreground sticky top-0 z-10">
        <button onClick={onBack} className="p-1.5 hover:bg-primary/20 rounded-full transition-all active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>

      {/* Profile card */}
      <button onClick={() => setShowAvatarEditor(true)} className="flex items-center gap-4 px-4 py-5 border-b border-border hover:bg-muted/40 transition-all active:scale-[0.99] text-left">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground overflow-hidden ring-2 ring-border">
            {avatarPreview || myProfile?.avatar_url ? (
              <img src={avatarPreview || myProfile?.avatar_url || ""} className="h-full w-full object-cover" alt="" />
            ) : (
              myProfile?.display_name?.[0]?.toUpperCase() || "U"
            )}
          </div>
          <span className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-sm">
            <Camera className="h-3 w-3 text-primary-foreground" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-foreground truncate">{myProfile?.display_name || "User"}</p>
          <p className="text-sm text-muted-foreground truncate">{myProfile?.bio || "Hey there!"}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Menu */}
      <div className="flex-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.key}
            onClick={() => {
              if (item.key === "linked") { onOpenLinkedDevices(); }
              else { setSubPage(null); setActiveSection(item.key); }
            }}
            className="flex w-full items-center gap-4 px-4 py-4 hover:bg-muted/60 transition-all active:scale-[0.99]"
          >
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <item.icon className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Hidden file input for avatar */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleAvatarFileSelected(file);
      }} />

      {/* Image Crop Dialog */}
      {showImageCropDialog && imageToCrop && (
        <ImageCropDialog
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setShowImageCropDialog(false);
            setImageToCrop(null);
          }}
        />
      )}
    </div>
  );
};

export default SettingsPage;
