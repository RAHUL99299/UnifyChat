import { useState } from "react";
import { ArrowLeft, Image as ImageIcon, FileText, Link as LinkIcon } from "lucide-react";

interface MediaGalleryProps {
  conversationName: string;
  onBack: () => void;
}

const MediaGallery = ({ conversationName, onBack }: MediaGalleryProps) => {
  const [activeTab, setActiveTab] = useState<"media" | "docs" | "links">("media");

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onBack} />
      <div className="relative ml-auto h-full w-80 bg-card shadow-xl animate-slide-in-right overflow-y-auto">
        <div className="sticky top-0 bg-header text-header-foreground px-4 py-3 flex items-center gap-3">
          <button onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h3 className="font-semibold truncate">{conversationName}</h3>
        </div>

        <div className="flex border-b border-border">
          {[
            { key: "media" as const, icon: ImageIcon, label: "Media" },
            { key: "docs" as const, icon: FileText, label: "Docs" },
            { key: "links" as const, icon: LinkIcon, label: "Links" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === "media" && (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square rounded bg-muted flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                </div>
              ))}
            </div>
          )}
          {activeTab === "docs" && (
            <p className="text-sm text-muted-foreground text-center py-8">No documents</p>
          )}
          {activeTab === "links" && (
            <p className="text-sm text-muted-foreground text-center py-8">No links</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaGallery;
