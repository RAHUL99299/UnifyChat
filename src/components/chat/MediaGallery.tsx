import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Image as ImageIcon,
  FileText,
  Link as LinkIcon,
  Search,
  Download,
  ExternalLink,
  Play,
} from "lucide-react";
import { format } from "date-fns";
import { MessageWithSender } from "@/hooks/useMessages";
import {
  getAttachmentMeta,
  formatAttachmentSize,
  extractUrls,
  getDomain,
  getFileTypeLabel,
} from "@/lib/messageContent";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface GalleryItem {
  id: string;
  url: string;
  type: "image" | "video" | "gif";
  sentAt: string;
}

interface DocItem {
  id: string;
  url: string;
  name: string;
  size: number | null;
  mimeType: string | null;
  fileType: string;
  sentAt: string;
}

interface LinkItem {
  id: string;
  url: string;
  domain: string;
  sentAt: string;
}

interface MediaGalleryProps {
  conversationName: string;
  messages: MessageWithSender[];
  onBack: () => void;
}

const fmtTime = (ts: string) => {
  try {
    return format(new Date(ts), "MMM d, h:mm a");
  } catch {
    return "";
  }
};

const EmptyState = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="flex flex-col items-center gap-3 px-4 py-16">
    <div className="rounded-2xl bg-muted/50 p-5 text-muted-foreground/40">{icon}</div>
    <p className="text-sm text-muted-foreground text-center">{label}</p>
  </div>
);

const MediaGallery = ({ conversationName, messages, onBack }: MediaGalleryProps) => {
  const [activeTab, setActiveTab] = useState<"media" | "docs" | "links">("media");
  const [search, setSearch] = useState("");
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null);

  const { mediaItems, docItems, linkItems } = useMemo(() => {
    const media: GalleryItem[] = [];
    const docs: DocItem[] = [];
    const seenUrls = new Set<string>();
    const links: LinkItem[] = [];
    const seenLinks = new Set<string>();

    for (const msg of messages) {
      const { message_type, content, created_at, id } = msg;

      if (message_type === "image" || message_type === "gif") {
        const meta = getAttachmentMeta(message_type, content);
        if (meta.url && !seenUrls.has(meta.url)) {
          seenUrls.add(meta.url);
          media.push({ id, url: meta.url, type: message_type === "gif" ? "gif" : "image", sentAt: created_at });
        }
      } else if (message_type === "video") {
        const meta = getAttachmentMeta(message_type, content);
        if (meta.url && !seenUrls.has(meta.url)) {
          seenUrls.add(meta.url);
          media.push({ id, url: meta.url, type: "video", sentAt: created_at });
        }
      } else if (message_type === "file") {
        const meta = getAttachmentMeta(message_type, content);
        if (meta.url && !seenUrls.has(meta.url)) {
          seenUrls.add(meta.url);
          docs.push({
            id,
            url: meta.url,
            name: meta.name || "File",
            size: meta.size,
            mimeType: meta.mimeType,
            fileType: getFileTypeLabel(meta.name, meta.mimeType),
            sentAt: created_at,
          });
        }
      } else if (message_type === "text") {
        for (const url of extractUrls(content)) {
          if (!seenLinks.has(url)) {
            seenLinks.add(url);
            links.push({ id: `${id}-${url}`, url, domain: getDomain(url), sentAt: created_at });
          }
        }
      }
    }

    return { mediaItems: media, docItems: docs, linkItems: links };
  }, [messages]);

  const lc = search.toLowerCase();
  const filteredMedia = search
    ? mediaItems.filter((m) => m.type.includes(lc) || fmtTime(m.sentAt).toLowerCase().includes(lc))
    : mediaItems;
  const filteredDocs = search
    ? docItems.filter(
        (d) =>
          d.name.toLowerCase().includes(lc) ||
          d.fileType.toLowerCase().includes(lc) ||
          fmtTime(d.sentAt).toLowerCase().includes(lc)
      )
    : docItems;
  const filteredLinks = search
    ? linkItems.filter(
        (l) =>
          l.url.toLowerCase().includes(lc) ||
          l.domain.toLowerCase().includes(lc) ||
          fmtTime(l.sentAt).toLowerCase().includes(lc)
      )
    : linkItems;

  const tabs = [
    { key: "media" as const, icon: ImageIcon, label: "Media", count: mediaItems.length },
    { key: "docs" as const, icon: FileText, label: "Docs", count: docItems.length },
    { key: "links" as const, icon: LinkIcon, label: "Links", count: linkItems.length },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onBack} />
        <div className="relative ml-auto h-full w-80 bg-card shadow-2xl flex flex-col animate-slide-in-right">

          {/* ── Header ── */}
          <div className="flex-shrink-0 bg-card/90 backdrop-blur-sm px-4 py-3 border-b border-border/50 flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-foreground truncate">{conversationName}</h3>
              <p className="text-[11px] text-muted-foreground">Media, Docs & Links</p>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex-shrink-0 flex border-b border-border/50">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSearch(""); }}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-all ${
                  activeTab === tab.key
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="text-[10px] font-semibold">{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`text-[9px] leading-none rounded-full px-1.5 py-0.5 ${
                    activeTab === tab.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Search ── */}
          <div className="flex-shrink-0 px-3 py-2 border-b border-border/30">
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${activeTab}…`}
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto">

            {/* Media tab */}
            {activeTab === "media" && (
              filteredMedia.length === 0
                ? <EmptyState
                    icon={<ImageIcon className="h-8 w-8" />}
                    label={search ? "No results" : "No photos or videos shared yet"}
                  />
                : <div className="grid grid-cols-3 gap-0.5 p-0.5">
                    {filteredMedia.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setPreviewItem(item)}
                        className="relative aspect-square group overflow-hidden bg-muted"
                      >
                        {item.type === "video" ? (
                          <>
                            <video
                              src={item.url}
                              className="h-full w-full object-cover"
                              preload="metadata"
                              muted
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-all">
                              <div className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center">
                                <Play className="h-4 w-4 text-white ml-0.5" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <img
                            src={item.url}
                            alt=""
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                        )}
                        <div className="absolute bottom-0 inset-x-0 px-1 py-0.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[9px] text-white leading-tight truncate">{fmtTime(item.sentAt)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
            )}

            {/* Docs tab */}
            {activeTab === "docs" && (
              filteredDocs.length === 0
                ? <EmptyState
                    icon={<FileText className="h-8 w-8" />}
                    label={search ? "No results" : "No documents shared yet"}
                  />
                : <div className="flex flex-col gap-px py-1">
                    {filteredDocs.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={doc.name}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors group"
                      >
                        <div className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
                          <span className="text-[8px] font-bold text-primary tracking-tight">{doc.fileType}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{doc.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {[formatAttachmentSize(doc.size), fmtTime(doc.sentAt)].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <Download className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                      </a>
                    ))}
                  </div>
            )}

            {/* Links tab */}
            {activeTab === "links" && (
              filteredLinks.length === 0
                ? <EmptyState
                    icon={<LinkIcon className="h-8 w-8" />}
                    label={search ? "No results" : "No links shared yet"}
                  />
                : <div className="flex flex-col gap-1.5 p-3">
                    {filteredLinks.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col gap-1 p-3 rounded-xl bg-primary/5 border border-primary/10 hover:border-primary/30 hover:bg-primary/10 transition-all group"
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="h-5 w-5 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <ExternalLink className="h-2.5 w-2.5 text-primary" />
                          </div>
                          <span className="text-[11px] font-semibold text-primary truncate">{link.domain}</span>
                        </div>
                        <p className="text-xs text-blue-400 group-hover:text-blue-300 underline underline-offset-2 break-all line-clamp-2 transition-colors">
                          {link.url}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{fmtTime(link.sentAt)}</p>
                      </a>
                    ))}
                  </div>
            )}

          </div>
        </div>
      </div>

      {/* Inline preview modal */}
      {previewItem && (
        <Dialog open onOpenChange={() => setPreviewItem(null)}>
          <DialogContent className="max-w-5xl border-border/50 bg-black/95 p-2 shadow-2xl sm:rounded-2xl">
            <DialogTitle className="sr-only">Media preview</DialogTitle>
            {previewItem.type === "video" ? (
              <video
                src={previewItem.url}
                controls
                autoPlay
                className="max-h-[85vh] w-full rounded-xl object-contain"
              />
            ) : (
              <img
                src={previewItem.url}
                alt=""
                className="max-h-[85vh] w-full rounded-xl object-contain"
              />
            )}
            <p className="text-center text-[10px] text-white/50 pt-1">{fmtTime(previewItem.sentAt)}</p>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default MediaGallery;
