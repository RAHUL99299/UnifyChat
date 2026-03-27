type ParsedMessagePayload = Record<string, unknown> | null;

export interface AttachmentMeta {
  url: string | null;
  name: string | null;
  size: number | null;
  mimeType: string | null;
  duration: number | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toOptionalString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : null;

const toOptionalNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

const looksLikeUrl = (value: string) => /^https?:\/\//i.test(value.trim());
const SIDEBAR_PREVIEW_LIMIT = 30;

export const parseMessagePayload = (content: string): ParsedMessagePayload => {
  try {
    const parsed = JSON.parse(content);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const getAttachmentMeta = (messageType: string, content: string): AttachmentMeta => {
  const payload = parseMessagePayload(content);
  const trimmedContent = content.trim();
  const rawUrl = looksLikeUrl(trimmedContent) ? trimmedContent : null;

  return {
    url: toOptionalString(payload?.url) || rawUrl,
    name: toOptionalString(payload?.name),
    size: toOptionalNumber(payload?.size),
    mimeType: toOptionalString(payload?.mimeType),
    duration: toOptionalNumber(payload?.duration),
  };
};

export const formatAttachmentSize = (size: number | null) => {
  if (!size || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const getMessagePreviewText = (messageType: string, content: string) => {
  switch (messageType) {
    case "image":
      return "Photo";
    case "gif":
      return "GIF";
    case "video":
      return "Video";
    case "audio":
      return "Voice message";
    case "sticker":
      return content;
    case "file": {
      const { name } = getAttachmentMeta(messageType, content);
      return name || "File";
    }
    default:
      return content;
  }
};

// ── URL utilities ─────────────────────────────────────
export const URL_REGEX_SOURCE = "https?://[^\\s<>\"{}|\\\\^`\\[\\]]+";

export const extractUrls = (text: string): string[] => {
  const matches = text.match(new RegExp(URL_REGEX_SOURCE, "g"));
  return matches ? [...new Set(matches)] : [];
};

export const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const getLinkData = (url: string, maxLength = 40) => {
  const trimmed = url.trim();

  try {
    return {
      domain: new URL(trimmed).hostname.replace(/^www\./, "") || "Link",
      short: trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed,
    };
  } catch {
    return {
      domain: "Link",
      short: trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed,
    };
  }
};

export const formatPreview = (text: string, maxLength = SIDEBAR_PREVIEW_LIMIT) => {
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (looksLikeUrl(trimmed)) {
    try {
      return new URL(trimmed).hostname.replace(/^www\./, "");
    } catch {
      return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
    }
  }

  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
};

export const formatSidebarMessagePreview = (messageType: string, content: string, maxLength = SIDEBAR_PREVIEW_LIMIT) => {
  const basePreview = getMessagePreviewText(messageType, content);
  if (messageType !== "text") {
    return formatPreview(basePreview, maxLength);
  }

  const trimmed = content.trim();
  if (looksLikeUrl(trimmed)) {
    return formatPreview(trimmed, maxLength);
  }

  const urls = extractUrls(trimmed);
  if (urls.length === 1 && trimmed === urls[0]) {
    return formatPreview(urls[0], maxLength);
  }

  const previewWithCompactLinks = urls.reduce(
    (acc, url) => acc.replace(url, getDomain(url)),
    trimmed
  );

  return formatPreview(previewWithCompactLinks, maxLength);
};

// ── File-type label ───────────────────────────────────
export const getFileTypeLabel = (name: string | null, mimeType: string | null): string => {
  if (mimeType) {
    if (/pdf/i.test(mimeType)) return "PDF";
    if (/word|docx?/i.test(mimeType)) return "DOCX";
    if (/spreadsheet|xlsx?|excel/i.test(mimeType)) return "XLSX";
    if (/presentation|pptx?|powerpoint/i.test(mimeType)) return "PPTX";
    if (/zip|rar|7z|tar|gz/i.test(mimeType)) return "ZIP";
    if (/plain|text/i.test(mimeType)) return "TXT";
  }
  if (name) {
    const ext = name.split(".").pop()?.toUpperCase();
    if (ext) return ext;
  }
  return "FILE";
};