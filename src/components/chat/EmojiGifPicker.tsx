import { useState, useRef, useCallback, useEffect } from "react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { Search, X } from "lucide-react";

// Pre-defined sticker packs using Unicode emoji
const STICKER_PACKS = [
  {
    id: "reactions",
    label: "Reactions",
    stickers: ["👍", "👎", "❤️", "😂", "😮", "😢", "😡", "🎉", "🔥", "💯", "👏", "🙌", "🤝", "✌️", "🤞", "❓", "‼️", "💤", "💢", "🆗"],
  },
  {
    id: "expressions",
    label: "Moods",
    stickers: ["😍", "🥰", "😘", "🤩", "🥳", "😎", "🤓", "🥴", "😤", "😱", "🤯", "🤔", "😴", "🙄", "😏", "🤗", "😈", "👻", "💀", "🤡"],
  },
  {
    id: "animals",
    label: "Animals",
    stickers: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐸", "🐵", "🐧", "🐦", "🦋", "🐝", "🐙", "🦄", "🦋"],
  },
  {
    id: "food",
    label: "Food",
    stickers: ["🍕", "🍔", "🍟", "🌭", "🍿", "🥗", "🍱", "🍣", "🍜", "🍦", "🎂", "🍩", "☕", "🧃", "🥤", "🍺", "🍷", "🥂", "🧁", "🍪"],
  },
  {
    id: "activities",
    label: "Activities",
    stickers: ["⚽", "🏀", "🎮", "🎯", "🎲", "🎸", "🎵", "🎬", "📚", "💻", "📱", "🚀", "✈️", "🚗", "🏆", "🥇", "🎁", "🎊", "🎈", "🎆"],
  },
];

const TENOR_BASE = "https://tenor.googleapis.com/v2";

interface GifResult {
  id: string;
  previewUrl: string;
  fullUrl: string;
  title: string;
}

const FALLBACK_GIFS: GifResult[] = [
  { id: "fallback-happy", title: "happy", previewUrl: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif", fullUrl: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif" },
  { id: "fallback-wow", title: "wow", previewUrl: "https://media.giphy.com/media/3oEduOnl5IHM5NRodO/giphy.gif", fullUrl: "https://media.giphy.com/media/3oEduOnl5IHM5NRodO/giphy.gif" },
  { id: "fallback-thanks", title: "thanks", previewUrl: "https://media.giphy.com/media/3oEdva9BUHPIs2SkGk/giphy.gif", fullUrl: "https://media.giphy.com/media/3oEdva9BUHPIs2SkGk/giphy.gif" },
  { id: "fallback-lol", title: "lol", previewUrl: "https://media.giphy.com/media/12msOFU8oL1eww/giphy.gif", fullUrl: "https://media.giphy.com/media/12msOFU8oL1eww/giphy.gif" },
  { id: "fallback-clap", title: "clap", previewUrl: "https://media.giphy.com/media/l3q2XhfQ8oCkm1Ts4/giphy.gif", fullUrl: "https://media.giphy.com/media/l3q2XhfQ8oCkm1Ts4/giphy.gif" },
  { id: "fallback-facepalm", title: "facepalm", previewUrl: "https://media.giphy.com/media/TJawtKM6OCKkvwCIqX/giphy.gif", fullUrl: "https://media.giphy.com/media/TJawtKM6OCKkvwCIqX/giphy.gif" },
  { id: "fallback-party", title: "party", previewUrl: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif", fullUrl: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif" },
  { id: "fallback-yes", title: "yes", previewUrl: "https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif", fullUrl: "https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif" },
];

const mapFallbackGifs = (query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return FALLBACK_GIFS;
  return FALLBACK_GIFS.filter((gif) => gif.title.includes(q));
};

const mapTenorResult = (result: any): GifResult | null => {
  const formats = result?.media_formats || {};
  const previewUrl =
    formats.tinygif?.url ||
    formats.nanogif?.url ||
    formats.mediumgif?.url ||
    formats.gif?.url ||
    "";
  const fullUrl =
    formats.gif?.url ||
    formats.mediumgif?.url ||
    formats.tinygif?.url ||
    formats.nanogif?.url ||
    "";

  if (!previewUrl || !fullUrl) return null;

  return {
    id: String(result.id || crypto.randomUUID()),
    previewUrl,
    fullUrl,
    title: String(result.title || "GIF"),
  };
};

interface EmojiGifPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onGifSelect: (url: string) => void;
  onStickerSelect: (sticker: string) => void;
  onClose: () => void;
  isDarkTheme?: boolean;
  tenorApiKey?: string;
}

const EmojiGifPicker = ({
  onEmojiSelect,
  onGifSelect,
  onStickerSelect,
  onClose,
  isDarkTheme = false,
  tenorApiKey = import.meta.env.VITE_TENOR_API_KEY || "LIVDSRZULELA",
}: EmojiGifPickerProps) => {
  const [activeTab, setActiveTab] = useState<"emoji" | "gif" | "sticker">("emoji");
  const [gifQuery, setGifQuery] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [usingFallbackGifs, setUsingFallbackGifs] = useState(false);
  const [activeStickerPack, setActiveStickerPack] = useState(STICKER_PACKS[0].id);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gifsFetchedRef = useRef(false);

  const fetchGifs = useCallback(
    async (query: string) => {
      setGifLoading(true);
      setGifError(null);
      try {
        const endpoint = query
          ? `${TENOR_BASE}/search?q=${encodeURIComponent(query)}&key=${tenorApiKey}&client_key=unifychat_web&limit=20&media_filter=tinygif,nanogif,gif`
          : `${TENOR_BASE}/featured?key=${tenorApiKey}&client_key=unifychat_web&limit=20&media_filter=tinygif,nanogif,gif`;
        const res = await fetch(endpoint);
        if (!res.ok) {
          const errorBody = await res.text();
          throw new Error(`Tenor API error (${res.status}): ${errorBody}`);
        }
        const data = await res.json();

        const results: GifResult[] = (data.results || [])
          .map((r: any) => mapTenorResult(r))
          .filter((r: GifResult | null): r is GifResult => !!r);

        if (results.length === 0) {
          throw new Error("Tenor returned no usable GIF results");
        }

        setGifs(results);
        setUsingFallbackGifs(false);
      } catch (error) {
        console.error("GIF fetch failed:", error);
        setGifs(mapFallbackGifs(query));
        setUsingFallbackGifs(true);
        setGifError("Trending GIF API unavailable. Showing fallback GIFs.");
      } finally {
        setGifLoading(false);
      }
    },
    [tenorApiKey]
  );

  const handleTabSwitch = (tab: "emoji" | "gif" | "sticker") => {
    setActiveTab(tab);
    if (tab === "gif" && !gifsFetchedRef.current) {
      gifsFetchedRef.current = true;
      fetchGifs("");
    }
  };

  const handleGifSearch = (q: string) => {
    setGifQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchGifs(q);
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const activePack = STICKER_PACKS.find((p) => p.id === activeStickerPack) || STICKER_PACKS[0];

  return (
    <div className="flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
      style={{ width: 340, height: 420 }}
    >
      {/* Tab bar */}
      <div className="flex items-center border-b border-border/50 bg-card flex-shrink-0">
        {(["emoji", "gif", "sticker"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabSwitch(tab)}
            className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-colors border-b-2 ${
              activeTab === tab
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {tab === "emoji" ? "😊 Emoji" : tab === "gif" ? "GIF" : "🎭 Stickers"}
          </button>
        ))}
        <button
          onClick={onClose}
          className="px-2.5 py-2.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Emoji tab */}
      {activeTab === "emoji" && (
        <div className="flex-1 overflow-hidden">
          <EmojiPicker
            onEmojiClick={(data: EmojiClickData) => onEmojiSelect(data.emoji)}
            theme={isDarkTheme ? Theme.DARK : Theme.LIGHT}
            width="100%"
            height="100%"
            searchPlaceholder="Search emoji..."
            lazyLoadEmojis
          />
        </div>
      )}

      {/* GIF tab */}
      {activeTab === "gif" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/30 flex-shrink-0">
            <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <input
                autoFocus
                value={gifQuery}
                onChange={(e) => handleGifSearch(e.target.value)}
                placeholder="Search GIFs..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {gifQuery && (
                <button onClick={() => { setGifQuery(""); fetchGifs(""); }}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {gifLoading ? (
              <div className="flex justify-center items-center h-32">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : gifs.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-32 gap-2 text-center">
                <span className="text-2xl">🎬</span>
                <p className="text-xs text-muted-foreground">
                  {gifQuery ? "No GIFs found" : "No GIFs available"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {gifError && (
                  <p className="px-1 text-[11px] text-amber-600 dark:text-amber-400">{gifError}</p>
                )}
                <div className="columns-2 gap-1.5">
                {gifs.map((gif) => (
                  <button
                    key={gif.id}
                    onClick={() => { onGifSelect(gif.fullUrl); onClose(); }}
                    className="w-full mb-1.5 rounded-xl overflow-hidden hover:opacity-80 transition-opacity block"
                    title={gif.title}
                  >
                    <img
                      src={gif.previewUrl}
                      alt={gif.title}
                      className="w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end px-3 py-1 flex-shrink-0 border-t border-border/20">
            <span className="text-[10px] text-muted-foreground">
              {usingFallbackGifs ? "Fallback GIFs" : "Powered by Tenor"}
            </span>
          </div>
        </div>
      )}

      {/* Sticker tab */}
      {activeTab === "sticker" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Pack selector */}
          <div className="flex gap-1.5 px-2 py-2 border-b border-border/30 overflow-x-auto flex-shrink-0">
            {STICKER_PACKS.map((pack) => (
              <button
                key={pack.id}
                onClick={() => setActiveStickerPack(pack.id)}
                className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full transition-colors ${
                  activeStickerPack === pack.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {pack.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-5 gap-1">
              {activePack.stickers.map((sticker, i) => (
                <button
                  key={i}
                  onClick={() => { onStickerSelect(sticker); onClose(); }}
                  className="flex items-center justify-center h-12 text-3xl hover:bg-muted rounded-xl transition-colors"
                >
                  {sticker}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmojiGifPicker;
