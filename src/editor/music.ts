/* Telifsiz stok müzik — Wikimedia Commons API (CORS: origin=*) */

export interface StockTrack {
  title: string;
  url: string;
  mime: string;
  license: string;
  artist: string;
}

const API = "https://commons.wikimedia.org/w/api.php";

/** CC-BY / public domain müzik kategorisi (Kevin MacLeod arşivi). */
export const MUSIC_CATEGORY = "Category:Audio files of music by Kevin MacLeod";

interface PageLike {
  title: string;
  imageinfo?: { url: string; mime: string; extmetadata?: Record<string, { value: string }> }[];
}

function parsePages(data: unknown): StockTrack[] {
  const pages = (data as { query?: { pages?: Record<string, PageLike> } })?.query?.pages;
  if (!pages) return [];
  const out: StockTrack[] = [];
  for (const p of Object.values(pages)) {
    const info = p.imageinfo?.[0];
    if (!info || !info.mime.startsWith("audio")) continue;
    const clean = p.title
      .replace(/^File:/, "")
      .replace(/\.(ogg|mp3|wav|flac)$/i, "")
      .replace(/^Kevin MacLeod\s*[-~–]\s*/i, "")
      .replace(/\s*-\s*Kevin MacLeod.*$/i, "")
      .trim();
    const artist = /kevin\s*macleod/i.test(p.title) ? "Kevin MacLeod" : "Wikimedia Commons";
    out.push({
      title: clean || p.title,
      url: info.url,
      mime: info.mime,
      license: info.extmetadata?.LicenseShortName?.value ?? "CC",
      artist,
    });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

/** Kategoriden hazır liste çeker. */
export async function listRoyaltyFreeMusic(): Promise<StockTrack[]> {
  const qs = new URLSearchParams({
    action: "query",
    generator: "categorymembers",
    gcmtitle: MUSIC_CATEGORY,
    gcmlimit: "50",
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiextmetadatafilter: "LicenseShortName",
    format: "json",
    origin: "*",
  });
  const res = await fetch(`${API}?${qs}`);
  if (!res.ok) throw new Error("commons api");
  return parsePages(await res.json());
}

/** Commons üzerinde telifsiz ses arar. */
export async function searchRoyaltyFreeMusic(q: string): Promise<StockTrack[]> {
  const qs = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${q} filetype:audio`,
    gsrnamespace: "6",
    gsrlimit: "25",
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiextmetadatafilter: "LicenseShortName",
    format: "json",
    origin: "*",
  });
  const res = await fetch(`${API}?${qs}`);
  if (!res.ok) throw new Error("commons api");
  return parsePages(await res.json());
}

/* önizleme çalar — tek shared eleman */
let previewEl: HTMLAudioElement | null = null;
let previewUrl = "";

export function togglePreview(url: string, onState?: (playing: boolean) => void): void {
  if (!previewEl) {
    previewEl = new Audio();
    previewEl.onended = () => onState?.(false);
  }
  if (previewUrl === url && !previewEl.paused) {
    previewEl.pause();
    onState?.(false);
    return;
  }
  previewEl.src = url;
  previewUrl = url;
  void previewEl.play().catch(() => onState?.(false));
  onState?.(true);
}

export function stopPreview(): void {
  previewEl?.pause();
}
