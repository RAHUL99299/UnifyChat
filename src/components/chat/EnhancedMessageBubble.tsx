import { useState, useRef } from "react";
import { MessageWithSender } from "@/hooks/useMessages";
import { Check, CheckCheck, Reply, Pencil, Trash2, FileIcon, Download, Play, Pause, Volume2 } from "lucide-react";
import { format } from "date-fns";
import { extractUrls, formatAttachmentSize, getAttachmentMeta, getLinkData } from "@/lib/messageContent";

interface EnhancedMessageBubbleProps {
  message: MessageWithSender;
  isGroupChat: boolean;
  searchQuery: string;
  messageRef?: (element: HTMLDivElement | null) => void;
  isReferenceTargetHighlighted?: boolean;
  onNavigateToReference?: (targetMessageId: string) => void;
  onReply: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onOpenMedia: (media: { type: "image" | "gif" | "video"; url: string }) => void;
}

const EnhancedMessageBubble = ({
  message,
  isGroupChat,
  searchQuery,
  messageRef,
  isReferenceTargetHighlighted = false,
  onNavigateToReference,
  onReply,
  onDelete,
  onEdit,
  onOpenMedia,
}: EnhancedMessageBubbleProps) => {
  const [showActions, setShowActions] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const isOut = message.is_outgoing;
  const isReplyMessage = !!message.reply_to_id;

  const formatTime = (ts: string) => {
    try {
      return format(new Date(ts), "h:mm a");
    } catch {
      return "";
    }
  };

  const formatDuration = (secs: number) => {
    if (!Number.isFinite(secs) || secs <= 0) return "00:00";
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const highlightSearch = (text: string) => {
    if (!searchQuery) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-accent/30 text-inherit rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const renderText = (text: string): React.ReactNode => {
    const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    const nodes: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = URL_RE.exec(text)) !== null) {
      if (m.index > last) nodes.push(highlightSearch(text.slice(last, m.index)));
      nodes.push(
        <a
          key={`url-${m.index}`}
          href={m[0]}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (isReplyMessage && message.reply_to_id) {
              e.preventDefault();
              e.stopPropagation();
              onNavigateToReference?.(message.reply_to_id);
              return;
            }
            e.stopPropagation();
          }}
          className="text-blue-400 underline underline-offset-2 hover:text-blue-300 break-all transition-colors"
        >
          {m[0]}
        </a>
      );
      last = m.index + m[0].length;
    }
    if (last < text.length) nodes.push(highlightSearch(text.slice(last)));
    return nodes.length > 0 ? <>{nodes}</> : <>{text}</>;
  };

  const toggleAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioPlaying) {
      audio.pause();
    } else {
      void audio.play();
    }
  };

  const renderContent = () => {
    const { message_type, content } = message;
    const attachmentMeta = getAttachmentMeta(message_type, content);

    // ── Image ─────────────────────────────────────────
    if (message_type === "image" && attachmentMeta.url) {
      return (
        <button
          type="button"
          onClick={() => onOpenMedia({ type: "image", url: attachmentMeta.url! })}
          className="block overflow-hidden rounded-xl"
        >
          <img
            src={attachmentMeta.url}
            alt="Image"
            className="rounded-xl max-w-full max-h-64 object-cover cursor-pointer hover:opacity-95 transition-opacity"
            loading="lazy"
          />
        </button>
      );
    }

    // ── GIF ───────────────────────────────────────────
    if (message_type === "gif" && attachmentMeta.url) {
      return (
        <button
          type="button"
          onClick={() => onOpenMedia({ type: "gif", url: attachmentMeta.url! })}
          className="block overflow-hidden rounded-xl"
        >
          <img
            src={attachmentMeta.url}
            alt="GIF"
            className="rounded-xl max-w-full max-h-56 object-cover cursor-pointer"
            loading="lazy"
          />
        </button>
      );
    }

    // ── Video ─────────────────────────────────────────
    if (message_type === "video" && attachmentMeta.url) {
      return (
        <button
          type="button"
          onClick={() => onOpenMedia({ type: "video", url: attachmentMeta.url! })}
          className="block overflow-hidden rounded-xl"
        >
          <video
            src={attachmentMeta.url}
            className="rounded-xl max-w-full max-h-64 object-cover"
            preload="metadata"
            muted
          />
        </button>
      );
    }

    // ── Sticker ───────────────────────────────────────
    if (message_type === "sticker") {
      return (
        <span className="block text-6xl leading-tight select-none">{content}</span>
      );
    }

    // ── Audio / Voice message ─────────────────────────
    if (message_type === "audio") {
      const audioUrl = attachmentMeta.url;
      const storedDuration = attachmentMeta.duration ?? 0;

      if (!audioUrl) {
        return <p className="text-sm leading-relaxed break-words">{content}</p>;
      }

      return (
        <div className="flex items-center gap-2.5 min-w-[180px]">
          <button
            onClick={toggleAudio}
            className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {audioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <div className="flex-1 flex flex-col gap-1">
            <div
              className="h-1 rounded-full bg-primary/20 cursor-pointer overflow-hidden"
              onClick={(e) => {
                const audio = audioRef.current;
                if (!audio || !audio.duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                audio.currentTime = ratio * audio.duration;
              }}
            >
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${audioProgress}%` }}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Volume2 className="h-3 w-3" />
                Voice
              </span>
              <span className="text-[10px] text-muted-foreground">
                {audioDuration > 0 ? formatDuration(audioDuration) : formatDuration(storedDuration)}
              </span>
            </div>
          </div>
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="metadata"
            onEnded={() => { setAudioPlaying(false); setAudioProgress(0); }}
            onPlay={() => setAudioPlaying(true)}
            onPause={() => setAudioPlaying(false)}
            onLoadedMetadata={(e) => {
              const duration = (e.target as HTMLAudioElement).duration;
              setAudioDuration(Number.isFinite(duration) && duration > 0 ? duration : 0);
            }}
            onTimeUpdate={(e) => {
              const audio = e.target as HTMLAudioElement;
              if (Number.isFinite(audio.duration) && audio.duration > 0) {
                setAudioProgress((audio.currentTime / audio.duration) * 100);
              }
            }}
            className="hidden"
          />
        </div>
      );
    }

    // ── File attachment ───────────────────────────────
    if (message_type === "file") {
      if (!attachmentMeta.url) {
        return <p className="text-sm leading-relaxed break-words">{content}</p>;
      }

      const sizeLabel = formatAttachmentSize(attachmentMeta.size);

      return (
        <a
          href={attachmentMeta.url}
          target="_blank"
          rel="noopener noreferrer"
          download={attachmentMeta.name || undefined}
          onClick={(e) => {
            if (isReplyMessage && message.reply_to_id) {
              e.preventDefault();
              e.stopPropagation();
              onNavigateToReference?.(message.reply_to_id);
              return;
            }
          }}
          className="flex items-center gap-2.5 hover:opacity-90 transition-opacity group/file min-w-[200px]"
        >
          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-primary/15">
            <FileIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{attachmentMeta.name || "File"}</p>
            <p className="text-xs text-muted-foreground">{sizeLabel}</p>
          </div>
          <Download className="h-4 w-4 text-muted-foreground group-hover/file:text-foreground flex-shrink-0" />
        </a>
      );
    }

    // ── Default: Text ─────────────────────────────────
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
        {renderText(content)}
      </p>
    );
  };

  const getReplyLinkPreview = () => {
    if (message.reply_to_message_type !== "text" || !message.reply_to_raw_content) return null;

    const trimmed = message.reply_to_raw_content.trim();
    const urls = extractUrls(trimmed);
    if (urls.length !== 1 || urls[0] !== trimmed) return null;

    return getLinkData(urls[0]);
  };

  const replyLinkPreview = getReplyLinkPreview();

  return (
    <div
      ref={messageRef}
      className={`group flex ${isOut ? "justify-end" : "justify-start"} mb-1.5 animate-message-in`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="relative max-w-[75%]">
        {showActions && (
          <div
            className={`absolute top-0 z-10 flex gap-0.5 ${
              isOut ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"
            }`}
          >
            <button onClick={(e) => { e.stopPropagation(); onReply(); }} className="rounded-xl bg-card p-1.5 shadow-sm hover:bg-muted transition-all">
              <Reply className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {isOut && message.message_type === "text" && (
              <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="rounded-xl bg-card p-1.5 shadow-sm hover:bg-muted transition-all">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            {isOut && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded-xl bg-card p-1.5 shadow-sm hover:bg-muted transition-all">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </button>
            )}
          </div>
        )}

        <div
          className={`rounded-2xl px-3.5 py-2.5 shadow-sm ${
            isOut
              ? "bg-primary/15 text-foreground rounded-tr-sm"
              : "bg-card text-foreground rounded-tl-sm shadow-md shadow-black/5"
          } ${isReplyMessage ? "cursor-pointer" : ""} ${
            isReferenceTargetHighlighted ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-chat-bg" : ""
          }`}
          onClick={() => {
            if (message.reply_to_id) {
              onNavigateToReference?.(message.reply_to_id);
            }
          }}
        >
          {!isOut && isGroupChat && (
            <p className="text-xs font-bold text-primary mb-0.5">{message.sender_name}</p>
          )}

          {message.reply_to_id && (
            <div className="mb-2 space-y-1.5">
              <p className="text-[10px] font-semibold leading-none">{message.reply_to_sender || "Message"}</p>
              <div className="rounded-xl border border-border/60 px-2.5 py-2">
                {replyLinkPreview ? (
                  <div className="space-y-0.5 text-left">
                    <p className="truncate text-[11px] font-semibold leading-tight">{replyLinkPreview.domain}</p>
                    <p className="truncate text-[11px] leading-tight text-muted-foreground">{replyLinkPreview.short}</p>
                  </div>
                ) : (
                  <p className="truncate text-[11px] leading-tight text-muted-foreground">
                    {message.reply_to_content || "Original message"}
                  </p>
                )}
              </div>
            </div>
          )}

          {renderContent()}

          <div className="mt-1 flex items-center justify-end gap-1">
            <span className="text-[10px] text-muted-foreground">{formatTime(message.created_at)}</span>
            {isOut && (
              <span>
                {message.status === "sent" ? (
                  <Check className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <CheckCheck
                    className={`h-3.5 w-3.5 ${
                      message.status === "read" ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedMessageBubble;
