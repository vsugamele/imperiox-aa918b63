export type AnnotationKind = "frame" | "note" | "label" | "arrow" | "reel" | "script" | "copy" | "ad_asset" | "schedule" | "account";

export type ScheduleItemKind = "post" | "story" | "reel" | "email" | "wa" | "other";
export interface ScheduleItem {
  time: string;   // "HH:MM"
  kind: ScheduleItemKind;
  label: string;
}

export interface AnnotationData {
  kind: AnnotationKind;
  text: string;
  style?: {
    borderColor?: string;
    bgColor?: string;
    fontSize?: number;
    orientation?: "diag-down" | "diag-up" | "horizontal" | "vertical";
    showHead?: boolean;
    // reel-specific
    url?: string;
    platform?: "instagram" | "tiktok" | "youtube" | "other";
    thumb?: string;
    thumb_proxy?: string;
    author?: string;
    title?: string;
    description?: string;
    // generator-specific
    heading?: string;
    subheading?: string;
    link?: string;
    generating?: boolean;
    // schedule-specific
    recurrence?: "daily" | "weekly";
    items?: ScheduleItem[];
    // account-specific
    accountId?: string;
    viewMode?: "compact" | "expanded";
  };
  onTextChange?: (id: string, text: string) => void;
  onUploadImage?: (id: string) => void;
  onGenerate?: (id: string, kind: AnnotationKind) => void;
  onStyleChange?: (id: string, patch: Partial<NonNullable<AnnotationData["style"]>>) => void;
  editingId?: string | null;
}




export const DEFAULT_SCHEDULE_ITEMS: ScheduleItem[] = [
  { time: "09:00", kind: "post",  label: "Post carrossel — dor do avatar" },
  { time: "13:00", kind: "post",  label: "Post reels — solução" },
  { time: "18:00", kind: "post",  label: "Post prova social" },
  { time: "20:00", kind: "story", label: "Story bastidor" },
  { time: "20:05", kind: "story", label: "Story enquete" },
  { time: "20:10", kind: "story", label: "Story CTA link" },
];

export function sortScheduleItems(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}


export const ANNOTATION_TYPE_TO_KIND: Record<string, AnnotationKind> = {
  annotation_frame: "frame",
  annotation_note: "note",
  annotation_label: "label",
  annotation_arrow: "arrow",
  annotation_reel: "reel",
  annotation_script: "script",
  annotation_copy: "copy",
  annotation_ad_asset: "ad_asset",
  annotation_schedule: "schedule",
  annotation_account: "account",
};

export const ANNOTATION_KIND_TO_TYPE: Record<AnnotationKind, string> = {
  frame: "annotation_frame",
  note: "annotation_note",
  label: "annotation_label",
  arrow: "annotation_arrow",
  reel: "annotation_reel",
  script: "annotation_script",
  copy: "annotation_copy",
  ad_asset: "annotation_ad_asset",
  schedule: "annotation_schedule",
  account: "annotation_account",
};

export const ANNOTATION_DEFAULTS: Record<AnnotationKind, { w: number; h: number; text: string; style: AnnotationData["style"] }> = {
  frame: { w: 320, h: 220, text: "Grupo", style: { borderColor: "#c9922a" } },
  note:  { w: 200, h: 120, text: "Nota…", style: { bgColor: "#c9922a" } },
  label: { w: 260, h: 50,  text: "Título", style: { fontSize: 28 } },
  arrow: { w: 180, h: 120, text: "",       style: { orientation: "diag-down", showHead: true, borderColor: "#c9922a" } },
  reel:  { w: 220, h: 320, text: "",       style: { platform: "other" } },
  script: { w: 280, h: 240, text: "", style: { heading: "" } },
  copy:   { w: 260, h: 180, text: "", style: { heading: "" } },
  ad_asset: { w: 260, h: 260, text: "", style: { heading: "" } },
  schedule: { w: 300, h: 340, text: "Rotina Diária de Conteúdo", style: { recurrence: "daily", items: DEFAULT_SCHEDULE_ITEMS } },
  account: { w: 260, h: 130, text: "", style: { viewMode: "compact" } },
};



// ---------- Reel URL helpers ----------
export function detectReelPlatform(url: string): "instagram" | "tiktok" | "youtube" | "other" {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  return "other";
}

export function extractReelAuthor(url: string): string | undefined {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host.includes("instagram.com")) {
      const m = u.pathname.match(/^\/([^/]+)\//);
      if (m && !["reel", "reels", "p", "tv"].includes(m[1])) return `@${m[1]}`;
    }
    if (host.includes("tiktok.com")) {
      const m = u.pathname.match(/^\/@([^/]+)/);
      if (m) return `@${m[1]}`;
    }
    if (host.includes("youtube.com")) {
      const m = u.pathname.match(/^\/@([^/]+)/) || u.pathname.match(/^\/channel\/([^/]+)/);
      if (m) return `@${m[1]}`;
    }
    return host;
  } catch { return undefined; }
}

export function extractReelThumb(url: string): string | undefined {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes("youtu")) {
      let id: string | null = null;
      if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1).split("/")[0];
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2];
      else id = u.searchParams.get("v");
      if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
  } catch {
    // A malformed URL has no derived thumbnail; callers use their existing placeholder.
  }
  return undefined;
}

