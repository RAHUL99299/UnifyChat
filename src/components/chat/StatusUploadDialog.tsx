import { useState } from "react";
import { X, Loader, Type, Image as ImageIcon, Video, UploadCloud } from "lucide-react";
import { useStatuses } from "@/hooks/useStatuses";
import { useConversations } from "@/hooks/useConversations";

interface StatusUploadDialogProps {
  onClose: () => void;
}

const StatusUploadDialog = ({ onClose }: StatusUploadDialogProps) => {
  const { createStatus, uploadStatusMedia } = useStatuses();
  const { conversations } = useConversations();
  const [activeType, setActiveType] = useState<"text" | "image" | "video">("text");
  const [textContent, setTextContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const contactCount = conversations.filter((c) => c.other_user_id).length;

  const handlePickMedia = (file: File | null) => {
    if (!file) return;
    setMediaFile(file);
    setMediaPreviewUrl(URL.createObjectURL(file));
  };

  const handlePublish = async () => {
    if (uploading) return;

    setErrorText("");
    setUploading(true);

    let result = null;

    if (activeType === "text") {
      if (!textContent.trim()) {
        setUploading(false);
        return;
      }
      result = await createStatus("text", textContent.trim());
    } else {
      if (!mediaFile) {
        setUploading(false);
        setErrorText(`Please choose a ${activeType} first.`);
        return;
      }

      const mediaUrl = await uploadStatusMedia(mediaFile, activeType);
      if (!mediaUrl) {
        setUploading(false);
        setErrorText("Media upload failed. Please try again.");
        return;
      }

      result = await createStatus(activeType, mediaUrl);
    }

    setUploading(false);

    if (result) {
      setTextContent("");
      setMediaFile(null);
      setMediaPreviewUrl(null);
      onClose();
      return;
    }

    setErrorText("Status upload failed. Please ensure status tables and policies are created in Supabase.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 sm:p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-card shadow-xl animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-foreground">Share a Status</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted transition-colors"
          >
            <X className="h-6 w-6 text-foreground" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-1">
            <button
              onClick={() => setActiveType("text")}
              className={`flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeType === "text" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Type className="h-4 w-4" />
              Text
            </button>
            <button
              onClick={() => setActiveType("image")}
              className={`flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeType === "image" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              Image
            </button>
            <button
              onClick={() => setActiveType("video")}
              className={`flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeType === "video" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Video className="h-4 w-4" />
              Video
            </button>
          </div>

          {/* Status input */}
          <div className="mb-6">
            {activeType === "text" ? (
              <>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="What's on your mind?"
                  maxLength={500}
                  className="w-full h-40 rounded-lg bg-muted p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <div className="mt-2 text-xs text-muted-foreground text-right">
                  {textContent.length}/500
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 p-4 text-center hover:bg-muted transition-colors">
                  <UploadCloud className="mb-2 h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Choose a {activeType}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activeType === "image" ? "JPG, PNG, WEBP (max 50MB)" : "MP4, MOV, WEBM (max 50MB)"}
                  </p>
                  <input
                    type="file"
                    accept={activeType === "image" ? "image/*" : "video/*"}
                    className="hidden"
                    onChange={(e) => handlePickMedia(e.target.files?.[0] || null)}
                  />
                </label>

                {mediaPreviewUrl && (
                  <div className="overflow-hidden rounded-xl border border-border bg-black/40">
                    {activeType === "image" ? (
                      <img src={mediaPreviewUrl} alt="Status preview" className="h-56 w-full object-cover" />
                    ) : (
                      <video src={mediaPreviewUrl} controls className="h-56 w-full object-cover" />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Visibility info */}
          <div className="mb-6 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm font-medium text-foreground">
              ✨ Visible to {contactCount} contact{contactCount !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This status will be automatically shared with all users in your chats
            </p>
          </div>

          {errorText && (
            <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorText}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-border py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={
                uploading ||
                (activeType === "text" ? !textContent.trim() : !mediaFile)
              }
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Sharing status...
                </>
              ) : (
                "Share Status"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusUploadDialog;
