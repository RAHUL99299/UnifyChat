import { useState, useRef, useEffect, useCallback } from "react";
import { Paperclip, Smile, Mic, Send, X, FileIcon } from "lucide-react";
import EmojiGifPicker from "./EmojiGifPicker";
import VoiceRecorder from "./VoiceRecorder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const getStorageErrorMessage = (err: unknown) => {
  const fallback = "Upload failed. Please check your connection and try again.";
  const message = typeof err === "object" && err !== null && "message" in err
    ? String((err as { message?: unknown }).message || "")
    : "";

  if (!message) return fallback;

  if (/bucket.*not found|not found.*bucket/i.test(message)) {
    return "Storage bucket 'chat-attachments' is missing. Run the latest Supabase migration, then try again.";
  }

  if (/row-level security|policy|permission denied|unauthorized|forbidden/i.test(message)) {
    return "Upload is blocked by storage permissions. Apply the latest storage policies migration and retry.";
  }

  return `Upload failed: ${message}`;
};

interface FilePreview {
  file: File;
  previewUrl: string | null;
  messageType: "image" | "video" | "file";
}

export interface ChatInputBarProps {
  conversationId: string;
  /** Send a new text/media message */
  onSendMessage: (content: string, type?: string) => Promise<void> | void;
  /** Called when editing an existing message (replaces send) */
  onEditMessage?: (id: string, content: string) => Promise<void> | void;
  onTyping: () => void;
  onStopTyping: () => void;
  /** When set, input is pre-filled and send triggers edit instead */
  editingMsg?: { id: string; content: string } | null;
  onEditCancel?: () => void;
}

const ChatInputBar = ({
  conversationId,
  onSendMessage,
  onEditMessage,
  onTyping,
  onStopTyping,
  editingMsg,
  onEditCancel,
}: ChatInputBarProps) => {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Pre-fill input when entering edit mode
  useEffect(() => {
    if (editingMsg) {
      setText(editingMsg.content);
      inputRef.current?.focus();
    } else {
      setText("");
    }
  }, [editingMsg]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showEmojiPicker]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (editingMsg && onEditMessage) {
      await onEditMessage(editingMsg.id, trimmed);
      onEditCancel?.();
    } else {
      await onSendMessage(trimmed, "text");
    }
    onStopTyping();
    setText("");
    inputRef.current?.focus();
  }, [text, editingMsg, onEditMessage, onSendMessage, onEditCancel, onStopTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && editingMsg) {
      onEditCancel?.();
    }
  };

  // Insert emoji at cursor position
  const insertEmojiAtCursor = (emoji: string) => {
    const input = inputRef.current;
    if (!input) {
      setText((prev) => prev + emoji);
      return;
    }
    const start = input.selectionStart ?? text.length;
    const end = input.selectionEnd ?? text.length;
    const newText = text.slice(0, start) + emoji + text.slice(end);
    setText(newText);
    requestAnimationFrame(() => {
      const pos = start + emoji.length;
      input.setSelectionRange(pos, pos);
      input.focus();
    });
  };

  const handleGifSelect = async (url: string) => {
    setShowEmojiPicker(false);
    await onSendMessage(url, "gif");
  };

  const handleStickerSelect = async (sticker: string) => {
    setShowEmojiPicker(false);
    await onSendMessage(sticker, "sticker");
  };

  // File / photo selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert("File is too large. Maximum allowed size is 50 MB.");
      e.target.value = "";
      return;
    }

    let messageType: "image" | "video" | "file" = "file";
    if (file.type.startsWith("image/")) messageType = "image";
    else if (file.type.startsWith("video/")) messageType = "video";

    const previewUrl =
      messageType === "image" || messageType === "video"
        ? URL.createObjectURL(file)
        : null;

    setFilePreview({ file, previewUrl, messageType });
    e.target.value = ""; // allow reselecting the same file
  };

  const cancelFilePreview = () => {
    if (filePreview?.previewUrl) URL.revokeObjectURL(filePreview.previewUrl);
    setFilePreview(null);
  };

  const uploadAndSendFile = async () => {
    if (!filePreview) return;
    if (!user) {
      alert("You need to sign in before uploading files.");
      return;
    }
    setUploading(true);
    try {
      const safeName = filePreview.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${conversationId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-attachments")
        .upload(path, filePreview.file, { contentType: filePreview.file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("chat-attachments")
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl;

      if (filePreview.messageType === "image") {
        await onSendMessage(publicUrl, "image");
      } else if (filePreview.messageType === "video") {
        await onSendMessage(publicUrl, "video");
      } else {
        const meta = JSON.stringify({
          url: publicUrl,
          name: filePreview.file.name,
          size: filePreview.file.size,
          mimeType: filePreview.file.type,
        });
        await onSendMessage(meta, "file");
      }

      if (filePreview.previewUrl) URL.revokeObjectURL(filePreview.previewUrl);
      setFilePreview(null);
    } catch (err) {
      console.error("File upload failed:", err);
      alert(getStorageErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleVoiceComplete = async (blob: Blob, durationSecs: number) => {
    setIsRecording(false);
    if (!user) {
      alert("You need to sign in before sending voice messages.");
      return;
    }
    setUploading(true);
    try {
      const ext = blob.type.includes("ogg") ? "ogg" : "webm";
      const path = `${user.id}/${conversationId}/voice-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-attachments")
        .upload(path, blob, { contentType: blob.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("chat-attachments")
        .getPublicUrl(path);

      const meta = JSON.stringify({ url: urlData.publicUrl, duration: durationSecs });
      await onSendMessage(meta, "audio");
    } catch (err) {
      console.error("Voice upload failed:", err);
      alert(getStorageErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col">
      {/* ── File preview ─────────────────────────────── */}
      {filePreview && (
        <div className="flex items-center gap-3 bg-muted/60 px-4 py-2.5 border-t border-border/50 animate-fade-in">
          {filePreview.messageType === "image" && filePreview.previewUrl ? (
            <img
              src={filePreview.previewUrl}
              alt="preview"
              className="h-14 w-14 object-cover rounded-xl flex-shrink-0"
            />
          ) : filePreview.messageType === "video" && filePreview.previewUrl ? (
            <video
              src={filePreview.previewUrl}
              className="h-14 w-14 object-cover rounded-xl flex-shrink-0"
            />
          ) : (
            <div className="h-14 w-14 flex items-center justify-center bg-primary/10 rounded-xl flex-shrink-0">
              <FileIcon className="h-7 w-7 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{filePreview.file.name}</p>
            <p className="text-xs text-muted-foreground">{formatSize(filePreview.file.size)}</p>
          </div>
          <button
            onClick={cancelFilePreview}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors flex-shrink-0"
            title="Remove"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={uploadAndSendFile}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl gradient-btn text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex-shrink-0"
          >
            {uploading ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {uploading ? "Uploading…" : "Send"}
          </button>
        </div>
      )}

      {/* ── Voice recorder (replaces input row while active) ─ */}
      {isRecording ? (
        <VoiceRecorder
          onRecordingComplete={handleVoiceComplete}
          onCancel={() => setIsRecording(false)}
        />
      ) : (
        /* ── Main input row ─────────────────────────── */
        <div className="relative flex items-center gap-1.5 border-t border-border/50 bg-card/80 px-2.5 py-2.5 backdrop-blur-sm sm:gap-2 sm:px-3 sm:py-3">
          {/* Emoji / GIF / Sticker picker panel */}
          {showEmojiPicker && (
            <div
              ref={pickerRef}
              className="absolute bottom-full left-0 mb-2 z-[100]"
            >
              <EmojiGifPicker
                onEmojiSelect={insertEmojiAtCursor}
                onGifSelect={handleGifSelect}
                onStickerSelect={handleStickerSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            </div>
          )}

          {/* Emoji button */}
          <button
            onClick={() => setShowEmojiPicker((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors flex-shrink-0 sm:h-11 sm:w-11 ${
              showEmojiPicker
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Emoji, GIFs & Stickers"
          >
            <Smile className="h-5 w-5" />
          </button>

          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground flex-shrink-0 sm:h-11 sm:w-11"
            title="Attach file or photo"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar,.xls,.xlsx,.ppt,.pptx,.mp3,.mp4,.mov,.avi"
            onChange={handleFileChange}
          />

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => {
              const nextValue = e.target.value;
              setText(nextValue);
              if (nextValue.trim().length > 0) {
                onTyping();
              } else {
                onStopTyping();
              }
            }}
            onBlur={onStopTyping}
            onKeyDown={handleKeyDown}
            placeholder={editingMsg ? "Edit message…" : "Type a message…"}
            className="flex-1 min-w-0 rounded-xl border-none bg-muted/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 sm:px-4"
          />

          {/* Send OR Mic button */}
          {text.trim() ? (
            <button
              onClick={handleSend}
              className="flex h-10 w-10 items-center justify-center rounded-xl gradient-btn text-primary-foreground transition-all hover:shadow-lg hover:shadow-primary/25 flex-shrink-0 sm:h-11 sm:w-11"
              title="Send message"
            >
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={() => !uploading && setIsRecording(true)}
              disabled={uploading}
              className="flex h-10 w-10 items-center justify-center rounded-xl gradient-btn text-primary-foreground transition-all hover:shadow-lg hover:shadow-primary/25 flex-shrink-0 disabled:opacity-50 sm:h-11 sm:w-11"
              title="Record voice message"
            >
              {uploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatInputBar;
