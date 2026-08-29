import type { Dispatch } from "react";
import type { AnimType, Easing, Filters } from "./model";
import { DEFAULT_FILTERS, MIN_CLIP, clamp, clipDur, cumStart, makeLayer, seqDuration, uid } from "./model";
import { SFX_META, SFX_TYPES, previewSfx, type SFXType } from "./sfx";
import type { Action, ProjectState, SFXItem } from "./state";
import { analyzeMedia, TYPE_LABEL, type AnalysisMap, type AnalysisResult } from "./analysis";

export type EditMode = "full" | "assisted" | "manual";
export interface ReportBundle {
  results: AnalysisMap;
}
export interface ApplyOptions {
  scenes: boolean;
  silence: boolean;
  beatsnap: boolean;
  color: boolean;
  captions: boolean;
  graphics: boolean;
}

/* ------------------------------------------------------------------ */
/* tipler                                                              */
/* ------------------------------------------------------------------ */

export type LogKind = "user" | "ai" | "ok" | "warn";
export interface LogLine {
  id: string;
  kind: LogKind;
  text: string;
}

export interface AgentStep {
  id: string;
  label: string;
  status: "pending" | "run" | "done" | "skip";
  note?: string;
}

export interface AICtx {
  getState: () => ProjectState;
  getPos: () => number;
  dispatch: Dispatch<Action>;
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  seekBy: (d: number) => void;
  splitAtPlayhead: () => void;
  importClick: () => void;
  openExport: () => void;
  toast: (m: string) => void;
  log: (kind: LogKind, text: string) => void;
  setAgent: (steps: AgentStep[] | null) => void;
  onScanning: (b: boolean) => void;
  cancelRef: { current: boolean };
  prog: (label: string, pct: number) => void;
  getMode: () => EditMode;
  report: (r: ReportBundle | null) => void;
}

type Intent =
  | { t: "help" }
  | { t: "auto" }
  | { t: "play" }
  | { t: "pause" }
  | { t: "split" }
  | { t: "delete"; which: "selected" | "last" | "all" }
  | { t: "preset"; key: string }
  | { t: "adjust"; param: "brightness" | "contrast" | "saturate"; delta: number }
  | { t: "rotate" }
  | { t: "flip"; axis: "h" | "v" }
  | { t: "captionAdd"; text: string }
  | { t: "captionClear" }
  | { t: "goto"; target: number; mode: "abs" | "pct" | "end" }
  | { t: "seekBy"; delta: number }
  | { t: "import" }
  | { t: "export" }
  | { t: "mute"; on?: boolean }
  | { t: "volume"; v: number }
  | { t: "select"; which: "first" | "last" }
  | { t: "layerTitle"; text: string }
  | { t: "layerLower"; text: string }
  | { t: "layerText"; text: string }
  | { t: "layerAnim"; anim?: AnimType; easing?: Easing }
  | { t: "layerClear" }
  | { t: "layerRemove" }
  | { t: "layerResize"; dir: "up" | "down" }
  | { t: "autoMotion" }
  | { t: "analyze" }
  | { t: "beatsync" }
  | { t: "sfxAdd"; type: SFXType | null }
  | { t: "autoSfx" }
  | { t: "ticker"; text: string }
  | { t: "unknown"; raw: string };

/* ------------------------------------------------------------------ */
/* renk paletleri                                                      */
/* ------------------------------------------------------------------ */

export const PRESETS: Record<string, { label: string; f: Partial<Filters> }> = {
  sinematik: { label: "Sinematik (turuncu-teal)", f: { contrast: 118, saturate: 112, brightness: 97, hue: -6 } },
  sicak: { label: "Sıcak gün batımı", f: { brightness: 105, contrast: 106, saturate: 122, hue: -10 } },
  soguk: { label: "Soğuk mavi", f: { contrast: 104, saturate: 90, hue: 16 } },
  canli: { label: "Canlı / sosyal medya", f: { saturate: 145, contrast: 112, brightness: 104 } },
  siyahbeyaz: { label: "Siyah-beyaz", f: { saturate: 0, contrast: 112 } },
  vintage: { label: "Vintage film", f: { saturate: 80, contrast: 96, brightness: 105, hue: -14 } },
};

const HELP_LINES = [
  "KURGU — “burada böl” · “seçili klibi sil” · “son klibi sil” · “hepsini temizle”",
  "GÖRÜNTÜ — “sinematik” · “sıcak renk” · “siyah beyaz” · “canlı” · “parlaklık +15” · “döndür” · “yatay çevir” · “renkleri sıfırla”",
  "GRAFİK — “başlık ekle: DENİZ & MERT” · “alt bant: İrem — Gelin” · “metin: hoş geldiniz” · “animasyon: daktilo” · “easing: zıplayan” · “yazı büyüt” · “grafikleri temizle”",
  "ALTYAZI — “altyazı ekle: Merhaba dünya” · “altyazıları temizle”",
  "GEZİNME — “oynat” · “durdur” · “5 saniye ileri” · “yarısına git” · “sona git”",
  "PROJE — “video yükle” · “dışa aktar” · “sesi kapat” · “otomatik kurgula” · “otomatik grafik”",
];

export const SUGGESTIONS: { label: string; cmd: string }[] = [
  { label: "Otomatik Kurgula", cmd: "otomatik kurgula" },
  { label: "Analiz Et", cmd: "videoyu analiz et" },
  { label: "Beat Senkron", cmd: "beat senkron kes" },
  { label: "Otomatik Grafik", cmd: "otomatik grafik" },
  { label: "Başlık Ekle", cmd: "başlık ekle: DENİZ & MERT" },
  { label: "Alt Bant", cmd: "alt bant: İrem — Gelin" },
  { label: "Daktilo Animasyon", cmd: "animasyon: daktilo" },
  { label: "Sinematik Renk", cmd: "sinematik renk uygula" },
  { label: "Burada Böl", cmd: "burada böl" },
  { label: "Altyazı Ekle", cmd: "altyazı ekle: Yeni sahne" },
  { label: "Dışa Aktar", cmd: "dışa aktar" },
];

/* ------------------------------------------------------------------ */
/* komut ayrıştırma (TR)                                               */
/* ------------------------------------------------------------------ */

const norm = (s: string) => s.toLocaleLowerCase("tr-TR").trim();

const num = (s: string): number | null => {
  const m = s.match(/(-?\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  return parseFloat(m[1].replace(",", "."));
};

/** “başlık ekle: DENİZ & MERT” → “DENİZ & MERT” (iki nokta ya da anahtar kelime temizliği) */
function extractLayerText(raw: string, kws: RegExp): string {
  const m = raw.match(/[:\-–—]\s*(.+)$/);
  if (m && m[1].trim().length > 1) return m[1].trim();
  const rest = raw
    .replace(kws, " ")
    .replace(/[:\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return rest;
}

function parse(text: string, raw: string): Intent {
  if (/(yardım|yardim|komutlar|neler yapabilir|help)/.test(text)) return { t: "help" };
  if (/(otomatik|otonom|auto)[\s-]*(grafik|motion|efekt|jenerik)/.test(text) || /grafikleri?[\s-]*oluştur/.test(text))
    return { t: "autoMotion" };
  if (/(otomatik|otonom|kendin yap|akıllı kurgu|smart|auto)/.test(text) && /(kurgu|edit|düzenle|yap)/.test(text)) return { t: "auto" };
  if (text === "kurgula" || text === "otomatik kurgula") return { t: "auto" };
  if (/(analiz|tara|scan|incele)/.test(text)) return { t: "analyze" };
  if (/(beat|ritim|bpm|müzik)/.test(text) && /(kes|senkron|oturt|uydur)/.test(text)) return { t: "beatsync" };
  if (/otomatik/.test(text) && /(ses|sfx|efekt)/.test(text)) return { t: "autoSfx" };
  if (/(kayan yazı|akan yazı|ticker|yazı takibi)/.test(text)) {
    const m = raw.match(/[:\-–]\s*(.+)$/);
    return { t: "ticker", text: m ? m[1].trim() : "FRAMEFORGE PRO" };
  }
  if (/(ses efekti|ses:|efekt ekle|sfx)/.test(text)) {
    const pick = (): SFXType | null => {
      if (/(süpür|whoosh)/.test(text)) return "whoosh";
      if (/(yüksel|riser)/.test(text)) return "riser";
      if (/(vur|çarp|hit|darbe)/.test(text)) return "hit";
      if (/pop/.test(text)) return "pop";
      if (/tık|click/.test(text)) return "click";
      if (/hışır|swish/.test(text)) return "swish";
      if (/glitch/.test(text)) return "glitch";
      if (/zil|ding/.test(text)) return "ding";
      if (/bas|sub/.test(text)) return "subdrop";
      if (/drone|ambiyans/.test(text)) return "drone";
      if (/gümbür|boom|patla/.test(text)) return "boom";
      return null;
    };
    return { t: "sfxAdd", type: pick() };
  }
  if (/(altyazı|caption)/.test(text)) {
    const m = raw.match(/[:\-–]\s*(.+)$/);
    if (m) return { t: "captionAdd", text: m[1].trim() };
    if (/(sil|temizle|kaldır)/.test(text)) return { t: "captionClear" };
    return { t: "captionAdd", text: "Yeni altyazı" };
  }

  /* hareketli grafik komutları */
  if (/grafik(ler|leri)?i?[\s-]*(sil|temizle|kaldır)|^(sil|temizle)[\s-]*grafik/.test(text)) return { t: "layerClear" };
  if (/(katman|layer)[\s-]*(sil|kaldır)/.test(text)) return { t: "layerRemove" };
  if (/(yazıyı?|fontu?|puntoyu?)[\s-]*(büyüt|büyült|büyült)/.test(text)) return { t: "layerResize", dir: "up" };
  if (/(yazıyı?|fontu?|puntoyu?)[\s-]*(küçült|küçült)/.test(text)) return { t: "layerResize", dir: "down" };
  if (/(animasyon|easing|hareket)/.test(text) && /(grafik|katman|başlık|bant|metin|animasyon|easing)/.test(text)) {
    if (/(daktilo|typewriter|yazılarak)/.test(text)) return { t: "layerAnim", anim: "typewriter" };
    if (/(perde|wipe|siline)/.test(text)) return { t: "layerAnim", anim: "wipe" };
    if (/(yaklaş|zoom|büyüyerek)/.test(text)) return { t: "layerAnim", anim: "zoom" };
    if (/(kay|slide)/.test(text)) return { t: "layerAnim", anim: "slideUp" };
    if (/(sol|fade)/.test(text)) return { t: "layerAnim", anim: "fade" };
    if (/(zıpla|bounce)/.test(text)) return { t: "layerAnim", easing: "bounce" };
    if (/(taş|back|overshoot)/.test(text)) return { t: "layerAnim", easing: "back" };
    if (/(doğrusal|linear)/.test(text)) return { t: "layerAnim", easing: "linear" };
    if (/(giriş[\s-]*çıkış|in[\s-]*out)/.test(text)) return { t: "layerAnim", easing: "easeInOut" };
    return { t: "layerAnim", easing: "easeOut" };
  }
  if (/(başlık|title|jenerik)/.test(text)) {
    return { t: "layerTitle", text: extractLayerText(raw, /(başlık|title|jenerik|ekle|yeni|oluştur|katman|grafik)/gi) };
  }
  if (/(alt[\s-]?bant|lower[\s-]?third|isim[\s-]?bandı|alt[\s-]?yazı[\s-]?bandı)/.test(text)) {
    return { t: "layerLower", text: extractLayerText(raw, /(alt[\s-]?bant|lower[\s-]?third|isim[\s-]?bandı|ekle|yeni|oluştur|katman|grafik)/gi) };
  }
  if (/(metin[\s-]?katmanı|yazı[\s-]?katmanı)/.test(text) || /^metin[:\s-]/.test(text)) {
    return { t: "layerText", text: extractLayerText(raw, /(metin|yazı|katmanı|katman|ekle|yeni|oluştur|grafik)/gi) };
  }

  if (/(oynat|başlat|play)/.test(text)) return { t: "play" };
  if (/(durdur|duraklat|pause|^dur$)/.test(text)) return { t: "pause" };
  if (/(böl|kes|split|cut|razor)/.test(text)) return { t: "split" };

  if (/(sil|temizle|kaldır)/.test(text)) {
    if (/(hepsi|tümü|tümünü|her şey|timeline|zaman çizelgesi)/.test(text)) return { t: "delete", which: "all" };
    if (/son/.test(text)) return { t: "delete", which: "last" };
    return { t: "delete", which: "selected" };
  }

  if (/(siyah[\s-]?beyaz|monokrom)/.test(text)) return { t: "preset", key: "siyahbeyaz" };
  if (/(sıcak|warm|gün batımı)/.test(text)) return { t: "preset", key: "sicak" };
  if (/(soğuk|cool|mavi ton)/.test(text)) return { t: "preset", key: "soguk" };
  if (/(canlı|vivid)/.test(text)) return { t: "preset", key: "canli" };
  if (/(sinematik|cinematic|film gibi)/.test(text)) return { t: "preset", key: "sinematik" };
  if (/(vintage|retro|eski film)/.test(text)) return { t: "preset", key: "vintage" };
  if (/(renk|filtre|grade)/.test(text) && /(sıfırla|temizle|varsayılan)/.test(text)) return { t: "preset", key: "_reset" };

  if (/(parlak|aydınlık|brightness)/.test(text)) return { t: "adjust", param: "brightness", delta: adjDelta(text) };
  if (/(kontrast|contrast)/.test(text)) return { t: "adjust", param: "contrast", delta: adjDelta(text) };
  if (/(doygunluk|saturation|renklilik)/.test(text)) return { t: "adjust", param: "saturate", delta: adjDelta(text) };

  if (/(döndür|dondur|rotate)/.test(text)) return { t: "rotate" };
  if (/dikey[\s-]?çevir/.test(text)) return { t: "flip", axis: "v" };
  if (/(yatay[\s-]?çevir|aynala|flip)/.test(text)) return { t: "flip", axis: "h" };

  if (/(dışa aktar|export|render al|çıktı al)/.test(text)) return { t: "export" };
  if (/(video yükle|içe aktar|dosya ekle|import)/.test(text)) return { t: "import" };

  if (/(sesi kapat|sessiz|mute)/.test(text)) return { t: "mute", on: true };
  if (/(sesi aç|sessizliği kaldır|unmute)/.test(text)) return { t: "mute", on: false };
  if (/ses(i)?\s*\d+/.test(text)) {
    const n = num(text);
    if (n !== null) return { t: "volume", v: clamp(n, 0, 100) };
  }

  if (/(ileri|sonraki)/.test(text) && /(saniye|sn|kare)/.test(text)) return { t: "seekBy", delta: Math.abs(num(text) ?? 5) };
  if (/geri/.test(text) && /(saniye|sn)/.test(text)) return { t: "seekBy", delta: -Math.abs(num(text) ?? 5) };

  if (/(başlangıç|başa|ilk kare)/.test(text)) return { t: "goto", target: 0, mode: "abs" };
  if (/(sona|sonuna|bitiş)/.test(text)) return { t: "goto", target: 0, mode: "end" };
  if (/(yarı|ortas)/.test(text)) return { t: "goto", target: 50, mode: "pct" };
  const mmss = text.match(/(\d+):(\d{2})/);
  if (mmss) return { t: "goto", target: parseInt(mmss[1]) * 60 + parseInt(mmss[2]), mode: "abs" };
  if (/%\s?(\d+)/.test(text)) return { t: "goto", target: num(text) ?? 50, mode: "pct" };
  if (/(git|atla)/.test(text)) {
    const n = num(text);
    if (n !== null) return { t: "goto", target: n, mode: "abs" };
  }

  if (/ilk klibi seç/.test(text)) return { t: "select", which: "first" };
  if (/son klibi seç/.test(text)) return { t: "select", which: "last" };

  return { t: "unknown", raw };
}

function adjDelta(text: string): number {
  const down = /(azalt|düşür|eksilt|kıs)/.test(text);
  const n = num(text);
  if (n !== null && n !== 0) {
    if (down || /-\s?\d/.test(text)) return -Math.abs(n);
    return Math.abs(n);
  }
  return down ? -10 : 10;
}

/* ------------------------------------------------------------------ */
/* yürütme                                                             */
/* ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const fmtT = (sec: number): string => {
  const s = Math.floor(Math.max(0, sec)) % 60;
  const m = Math.floor(Math.max(0, sec) / 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(m)}:${p(s)}`;
};

export async function executeCommand(raw: string, ctx: AICtx): Promise<void> {
  ctx.log("user", raw);
  const intent = parse(norm(raw), raw);

  switch (intent.t) {
    case "help": {
      ctx.log("ai", "Anladığım komutlar:");
      for (const l of HELP_LINES) {
        await sleep(110);
        ctx.log("ai", l);
      }
      break;
    }
    case "auto": {
      const mode = ctx.getMode();
      if (mode === "manual") {
        ctx.log("warn", "Manuel moddasınız — otomasyon kapalı. Üstten TAM OTO ya da DESTEKLİ moda geçin.");
      } else if (mode === "assisted") {
        await analyzeOnly(ctx);
      } else {
        await runAutoEdit(ctx);
      }
      break;
    }
    case "analyze":
      await analyzeOnly(ctx);
      break;
    case "beatsync": {
      const s = ctx.getState();
      let results = s.analysis;
      if (!Object.keys(results).length) {
        ctx.log("ai", "Önce analiz çalıştırıyorum…");
        results = await analyzeAll(ctx);
        if (!Object.keys(results).length) break;
      }
      const n = snapToBeats(ctx, results);
      ctx.log(n ? "ok" : "warn", n ? `${n} kesim beat ızgarasına oturtuldu` : "Yakındaki beat bulunamadı — kesimler olduğu gibi kaldı");
      break;
    }
    case "play":
      ctx.play();
      ctx.log("ok", "Oynatma başlatıldı");
      break;
    case "pause":
      ctx.pause();
      ctx.log("ok", "Duraklatıldı");
      break;
    case "split":
      ctx.splitAtPlayhead();
      break;
    case "delete": {
      const s = ctx.getState();
      if (intent.which === "all") {
        ctx.dispatch({ type: "CLEAR_ALL" });
        ctx.log("ok", `Zaman çizelgesi temizlendi (${s.clips.length} klip kaldırıldı)`);
      } else if (intent.which === "last") {
        const last = s.clips[s.clips.length - 1];
        if (last) {
          ctx.dispatch({ type: "REMOVE_CLIP", id: last.id });
          ctx.log("ok", "Son klip silindi");
        } else ctx.log("warn", "Silinecek klip yok");
      } else if (s.selClip) {
        ctx.dispatch({ type: "REMOVE_CLIP", id: s.selClip });
        ctx.log("ok", "Seçili klip silindi");
      } else ctx.log("warn", "Önce zaman çizelgesinden bir klip seçin");
      break;
    }
    case "preset": {
      if (intent.key === "_reset") {
        ctx.dispatch({ type: "RESET_FILTERS" });
        ctx.log("ok", "Renk ayarları sıfırlandı");
      } else {
        const p = PRESETS[intent.key];
        ctx.dispatch({ type: "SET_FILTER", patch: { ...DEFAULT_FILTERS, ...p.f } });
        ctx.log("ok", `Renk paleti uygulandı: ${p.label}`);
      }
      break;
    }
    case "adjust": {
      const s = ctx.getState();
      const cur = s.filters[intent.param];
      const next = clamp(cur + intent.delta, 0, 300);
      ctx.dispatch({ type: "SET_FILTER", patch: { [intent.param]: next } });
      const names: Record<string, string> = { brightness: "Parlaklık", contrast: "Kontrast", saturate: "Doygunluk" };
      ctx.log("ok", `${names[intent.param]}: %${cur} → %${next}`);
      break;
    }
    case "rotate": {
      const s = ctx.getState();
      const next = (s.filters.rotate + 90) % 360;
      ctx.dispatch({ type: "SET_FILTER", patch: { rotate: next } });
      ctx.log("ok", `90° döndürüldü (şimdi ${next}°)`);
      break;
    }
    case "flip": {
      const s = ctx.getState();
      ctx.dispatch({
        type: "SET_FILTER",
        patch: intent.axis === "h" ? { flipH: !s.filters.flipH } : { flipV: !s.filters.flipV },
      });
      ctx.log("ok", intent.axis === "h" ? "Yatay eksende çevrildi" : "Dikey eksende çevrildi");
      break;
    }
    case "captionAdd": {
      const s = ctx.getState();
      const total = seqDuration(s.clips);
      if (total === 0) {
        ctx.log("warn", "Altyazı için önce zaman çizelgesine klip ekleyin");
        break;
      }
      const start = clamp(s.captions.length ? Math.max(...s.captions.map((c) => c.end)) : 0, 0, Math.max(0, total - 0.3));
      const cap = { id: uid(), start, end: Math.min(start + 3, total + 2), text: intent.text };
      ctx.dispatch({ type: "ADD_CAPTION", caption: cap });
      ctx.log("ok", `Altyazı eklendi: “${intent.text}” (${fmtT(start)}–${fmtT(cap.end)})`);
      break;
    }
    case "captionClear": {
      const s = ctx.getState();
      if (s.captions.length === 0) {
        ctx.log("warn", "Silinecek altyazı yok");
        break;
      }
      for (const c of s.captions) ctx.dispatch({ type: "REMOVE_CAPTION", id: c.id });
      ctx.log("ok", `${s.captions.length} altyazı temizlendi`);
      break;
    }
    case "goto": {
      const s = ctx.getState();
      const total = seqDuration(s.clips);
      const target = intent.mode === "end" ? total : intent.mode === "pct" ? (total * intent.target) / 100 : intent.target;
      ctx.seek(clamp(target, 0, Math.max(0, total - 0.01)));
      ctx.log("ok", `Oynatma başlığı taşındı: ${fmtT(clamp(target, 0, total))}`);
      break;
    }
    case "seekBy":
      ctx.seekBy(intent.delta);
      ctx.log("ok", `${intent.delta > 0 ? "+" : ""}${intent.delta} sn kaydırıldı`);
      break;
    case "import":
      ctx.importClick();
      ctx.log("ai", "Dosya seçici açıldı — video ya da görselleri seçin");
      break;
    case "export": {
      const s = ctx.getState();
      if (seqDuration(s.clips) === 0) {
        ctx.log("warn", "Dışa aktarılacak sekans boş — önce klip ekleyin");
        break;
      }
      ctx.openExport();
      ctx.log("ai", "Dışa aktarma penceresi açıldı");
      break;
    }
    case "mute": {
      const s = ctx.getState();
      const target = intent.on === undefined ? !s.muted : intent.on;
      ctx.dispatch({ type: "SET_MUTED", muted: target });
      ctx.log("ok", target ? "Ses kapatıldı" : "Ses açıldı");
      break;
    }
    case "volume":
      ctx.dispatch({ type: "SET_VOLUME", volume: intent.v / 100 });
      ctx.log("ok", `Ses düzeyi: %${intent.v}`);
      break;
    case "select": {
      const s = ctx.getState();
      const clip = intent.which === "first" ? s.clips[0] : s.clips[s.clips.length - 1];
      if (clip) {
        ctx.dispatch({ type: "SELECT_CLIP", id: clip.id });
        ctx.log("ok", `${intent.which === "first" ? "İlk" : "Son"} klip seçildi`);
      } else ctx.log("warn", "Zaman çizelgesinde klip yok");
      break;
    }
    case "layerTitle":
    case "layerLower":
    case "layerText": {
      const s = ctx.getState();
      const total = seqDuration(s.clips);
      const kind = intent.t === "layerTitle" ? "title" : intent.t === "layerLower" ? "lower" : "text";
      const def = kind === "title" ? "YENİ BAŞLIK" : kind === "lower" ? "Ad Soyad — Unvan" : "yeni metin";
      const text = intent.text || def;
      const start = total > 0 ? clamp(Math.floor(ctx.getPos() * 2) / 2, 0, Math.max(0, total - 0.5)) : 0;
      const layer = makeLayer(kind, text, start, Math.max(start + 4, Math.min(start + 4, total > 0 ? total : start + 4)));
      ctx.dispatch({ type: "ADD_LAYER", layer });
      ctx.seek(start);
      const animName = kind === "title" ? "yukarı kayarak" : kind === "lower" ? "soldan kayarak" : "daktilo ile yazılarak";
      ctx.log("ok", `${kind === "title" ? "Başlık" : kind === "lower" ? "Alt bant" : "Metin"} eklendi: “${text}” — ${animName} giriyor (${fmtT(start)}–${fmtT(layer.end)})`);
      break;
    }
    case "layerAnim": {
      const s = ctx.getState();
      const L = s.layers.find((l) => l.id === s.selLayer) ?? s.layers[s.layers.length - 1];
      if (!L) {
        ctx.log("warn", "Önce bir grafik katmanı ekleyin (“başlık ekle: …” ya da “otomatik grafik”)");
        break;
      }
      const patch: Partial<typeof L> = {};
      if (intent.anim) patch.animIn = intent.anim;
      if (intent.easing) patch.easing = intent.easing;
      ctx.dispatch({ type: "UPDATE_LAYER", id: L.id, patch });
      const what = intent.anim
        ? `giriş animasyonu “${intent.anim === "typewriter" ? "Daktilo" : intent.anim === "wipe" ? "Perde" : intent.anim === "zoom" ? "Yaklaş" : intent.anim === "slideUp" ? "Yukarı kay" : "Solma"}”`
        : `easing “${intent.easing === "bounce" ? "Zıplayan" : intent.easing === "back" ? "Taşmalı" : intent.easing === "linear" ? "Doğrusal" : intent.easing === "easeInOut" ? "Giriş-çıkış" : "Yumuşak çıkış"}”`;
      ctx.log("ok", `“${L.text}” katmanına ${what} uygulandı`);
      ctx.seek(Math.max(0, L.start - 0.2));
      break;
    }
    case "layerClear": {
      const s = ctx.getState();
      if (s.layers.length === 0) {
        ctx.log("warn", "Silinecek grafik katmanı yok");
        break;
      }
      ctx.dispatch({ type: "SET_LAYERS", layers: [] });
      ctx.log("ok", `${s.layers.length} grafik katmanı temizlendi`);
      break;
    }
    case "layerRemove": {
      const s = ctx.getState();
      const L = s.layers.find((l) => l.id === s.selLayer) ?? s.layers[s.layers.length - 1];
      if (!L) {
        ctx.log("warn", "Silinecek grafik katmanı yok");
        break;
      }
      ctx.dispatch({ type: "REMOVE_LAYER", id: L.id });
      ctx.log("ok", `Katman silindi: “${L.text}”`);
      break;
    }
    case "layerResize": {
      const s = ctx.getState();
      const L = s.layers.find((l) => l.id === s.selLayer) ?? s.layers[s.layers.length - 1];
      if (!L) {
        ctx.log("warn", "Önce bir grafik katmanı ekleyin");
        break;
      }
      const next = clamp(intent.dir === "up" ? L.size * 1.35 : L.size * 0.72, 1, 16);
      ctx.dispatch({ type: "UPDATE_LAYER", id: L.id, patch: { size: Math.round(next * 10) / 10 } });
      ctx.log("ok", `Punto ${intent.dir === "up" ? "büyütüldü" : "küçültüldü"}: %${L.size} → %${Math.round(next * 10) / 10}`);
      break;
    }
    case "autoMotion":
      await runAutoMotion(ctx);
      break;
    case "sfxAdd": {
      const s = ctx.getState();
      const total = seqDuration(s.clips);
      const type: SFXType = intent.type ?? SFX_TYPES[s.sfx.length % SFX_TYPES.length];
      const start = total > 0 ? clamp(Math.floor(ctx.getPos() * 4) / 4, 0, Math.max(0, total - 0.05)) : 0;
      const item: SFXItem = { id: uid(), type, start, dur: SFX_META[type].dur, volume: 0.9 };
      ctx.dispatch({ type: "ADD_SFX", item });
      previewSfx(type);
      ctx.log("ok", `“${SFX_META[type].label}” eklendi — ${fmtT(start)} noktasında çalacak`);
      break;
    }
    case "autoSfx":
      await runAutoSfx(ctx);
      break;
    case "ticker": {
      const s = ctx.getState();
      const total = seqDuration(s.clips);
      const end = total > 0 ? Math.min(total, 10) : 8;
      const layer = makeLayer("text", intent.text.toLocaleUpperCase("tr-TR"), 0, Math.max(end, 4));
      layer.follow = "pan";
      layer.size = 4;
      layer.y = 88;
      layer.animIn = "fade";
      layer.animOut = "fade";
      layer.color = "#ffb43c";
      layer.font = "mono";
      ctx.dispatch({ type: "ADD_LAYER", layer });
      ctx.log("ok", `Kayan yazı eklendi: “${intent.text}” — ekranı ${Math.max(end, 4).toFixed(0)} sn'de tarıyor`);
      break;
    }
    case "unknown":
      ctx.log("warn", `“${intent.raw}” komutunu çözemedim.`);
      await sleep(180);
      ctx.log("ai", "İpucu: “yardım” yazın ya da aşağıdaki hazır komutlardan birini deneyin.");
      break;
  }
}



/* ------------------------------------------------------------------ */
/* otonom kurgu ajanı                                                  */
/* ------------------------------------------------------------------ */

const CAP_TEMPLATES = ["Açılış", "Detay çekim", "Ana sahne", "Geçiş anı", "Vurgu", "Kapanış"];

export async function runAutoEdit(ctx: AICtx): Promise<void> {
  const mk = (label: string): AgentStep => ({ id: uid(), label, status: "pending" });
  const steps: AgentStep[] = [
    mk("Medya kutusu taranıyor"),
    mk("Zaman çizelgesi kuruluyor"),
    mk("Ses + görüntü gerçekten taranıyor"),
    mk("Ölü boşluk ve sahne kesimleri"),
    mk("Beat ızgarasına oturtuluyor"),
    mk("Otomatik renk uygulanıyor"),
    mk("Altyazılar oluşturuluyor"),
    mk("Hareketli grafikler üretiliyor"),
  ];
  ctx.cancelRef.current = false;
  ctx.setAgent([...steps]);
  ctx.onScanning(true);
  ctx.log("ai", "Otonom kurgu başlatıldı — arkanıza yaslanın.");

  const set = (i: number, patch: Partial<AgentStep>) => {
    steps[i] = { ...steps[i], ...patch };
    ctx.setAgent([...steps]);
  };
  const cancelled = () => ctx.cancelRef.current;
  const abort = () => {
    for (let i = 0; i < steps.length; i++) if (steps[i].status === "pending" || steps[i].status === "run") steps[i] = { ...steps[i], status: "skip" };
    ctx.setAgent([...steps]);
  };

  let trimmedCount = 0;
  let captionCount = 0;

  try {
    /* 1 — medya tarama */
    set(0, { status: "run" });
    await sleep(700);
    let s = ctx.getState();
    if (cancelled()) return abort();
    if (s.media.length === 0) {
      set(0, { status: "done", note: "0 dosya" });
      for (let i = 1; i < steps.length; i++) set(i, { status: "skip" });
      ctx.log("warn", "Medya kutusu boş — önce video yükleyin (sürükle-bırak ya da “video yükle”)");
      return;
    }
    set(0, { status: "done", note: `${s.media.length} dosya` });
    ctx.log("ai", `${s.media.length} medya dosyası bulundu, sahne analizi başlıyor…`);

    /* 2 — zaman çizelgesi */
    set(1, { status: "run" });
    await sleep(650);
    if (cancelled()) return abort();
    s = ctx.getState();
    if (s.clips.length === 0) {
      for (const m of s.media) {
        if (cancelled()) return abort();
        ctx.dispatch({ type: "ADD_CLIP", clip: { id: uid(), mediaId: m.id, in: 0, out: m.duration } });
        await sleep(130);
      }
      set(1, { status: "done", note: `${s.media.length} klip eklendi` });
      ctx.log("ok", `${s.media.length} klip zaman çizelgesine dizildi`);
    } else {
      set(1, { status: "done", note: "mevcut kurgu korundu" });
    }

    /* 3 — GERÇEK ANALİZ: ses çözümü + kare taraması */
    set(2, { status: "run" });
    if (cancelled()) return abort();
    const results = await analyzeAll(ctx);
    if (cancelled()) return abort();
    const foundScenes = Object.values(results).reduce((a, r) => a + r.scenes.length, 0);
    const foundSilence = Object.values(results).reduce(
      (a, r) => a + r.silence.reduce((x, sg) => x + (sg.end - sg.start), 0),
      0,
    );
    set(2, { status: "done", note: `${foundScenes} sahne · ${foundSilence.toFixed(1)} sn boşluk` });

    /* 4 — analiz kesimleri: ölü boşluk at + sahne geçişlerinden böl */
    set(3, { status: "run" });
    const cuts = await cutByAnalysis(ctx, results);
    if (cancelled()) return abort();
    trimmedCount = cuts.silenceCuts + cuts.sceneCuts;
    set(3, { status: "done", note: `${cuts.silenceCuts} boşluk · ${cuts.sceneCuts} sahne` });
    if (cuts.silenceCuts || cuts.sceneCuts)
      ctx.log("ok", `${cuts.silenceCuts} ölü boşluk kesildi · ${cuts.sceneCuts} sahne geçişinden bölündü`);
    else ctx.log("ai", "Kesilecek ölü boşluk / sahne geçişi bulunamadı");

    /* 4b — beat ızgarası (gerçek BPM) */
    set(4, { status: "run" });
    const anyBpm = Object.values(results).find((r) => r.bpm)?.bpm ?? null;
    let snapped = 0;
    if (anyBpm) {
      snapped = snapToBeats(ctx, results);
      await sleep(300);
    }
    if (cancelled()) return abort();
    if (anyBpm) {
      set(4, { status: "done", note: `BPM ${anyBpm} · ${snapped} kesim` });
      ctx.log("ok", `Kesimler BPM ${anyBpm} ızgarasına oturtuldu (${snapped} klip)`);
    } else {
      set(4, { status: "skip", note: "belirgin tempo yok" });
    }

    /* 5 — histogram tabanlı otomatik renk */
    if (cancelled()) return abort();
    set(5, { status: "run" });
    await sleep(400);
    const patch = mergedColorPatch(results);
    if (Object.keys(patch).length) {
      ctx.dispatch({ type: "SET_FILTER", patch: { ...DEFAULT_FILTERS, ...patch } });
      const note =
        Object.values(results).find((r) => r.colorNote.startsWith("otomatik"))?.colorNote ?? "otomatik seviye";
      set(5, { status: "done", note });
      ctx.log("ok", `Renk düzeltildi — ${note}`);
    } else {
      ctx.dispatch({ type: "SET_FILTER", patch: { ...DEFAULT_FILTERS, ...PRESETS.sinematik.f } });
      set(5, { status: "done", note: "sinematik palet" });
      ctx.log("ok", "Histogram dengeli — sinematik palet uygulandı");
    }

    /* 6 — altyazılar (analiz etiketli) */
    if (cancelled()) return abort();
    set(6, { status: "run" });
    await sleep(500);
    s = ctx.getState();
    let acc = 0;
    const caps = s.clips.slice(0, 6).map((c, i) => {
      const d = c.out - c.in;
      const start = acc + Math.min(0.4, d * 0.1);
      const end = Math.min(acc + d * 0.85, start + 3.5);
      acc += d;
      const media = s.media.find((m) => m.id === c.mediaId);
      const r = results[c.mediaId];
      const mid = (c.in + c.out) / 2;
      const seg = r?.segments.find((sg) => mid >= sg.start && mid < sg.end);
      const label = seg ? TYPE_LABEL[seg.type] : "Sahne";
      return { id: uid(), start, end, text: `${label} • ${media?.name ?? `klip ${i + 1}`}` };
    });
    for (const cap of caps) {
      if (cancelled()) return abort();
      ctx.dispatch({ type: "ADD_CAPTION", caption: cap });
      captionCount++;
      await sleep(110);
    }
    set(6, { status: "done", note: `${captionCount} altyazı` });

    /* 7 — hareketli grafikler */
    if (cancelled()) return abort();
    set(7, { status: "run" });
    await sleep(600);
    s = ctx.getState();
    let gfxCount = 0;
    if (s.layers.length === 0) {
      const total = seqDuration(s.clips);
      const intro = makeLayer("title", (s.name || "yeni_proje").replace(/_/g, " ").toLocaleUpperCase("tr-TR"), 0, Math.min(3.5, Math.max(2, total)));
      ctx.dispatch({ type: "ADD_LAYER", layer: intro });
      gfxCount++;
      await sleep(220);
      if (total > 5) {
        const outro = makeLayer("title", "SON", Math.max(0, total - 3), total + 0.5);
        outro.animIn = "zoom";
        outro.easing = "easeInOut";
        ctx.dispatch({ type: "ADD_LAYER", layer: outro });
        gfxCount++;
      }
    }
    set(7, { status: "done", note: gfxCount ? `${gfxCount} katman` : "mevcut korundu" });
    if (gfxCount) ctx.log("ok", `Jenerik katmanları eklendi: açılış başlığı${gfxCount > 1 ? " + kapanış kartı" : ""}`);

    ctx.log("ok", `Otomatik kurgu tamam — ${trimmedCount} kırpma · sinematik renk · ${captionCount} altyazı · ${gfxCount} grafik`);
    ctx.toast("Otomatik kurgu tamamlandı");
  } catch {
    ctx.log("warn", "Otomatik kurgu sırasında bir sorun oluştu");
  } finally {
    ctx.onScanning(false);
    if (cancelled()) {
      abort();
      ctx.log("warn", "Otomatik kurgu iptal edildi");
      window.setTimeout(() => ctx.setAgent(null), 1400);
    } else {
      window.setTimeout(() => ctx.setAgent(null), 2600);
    }
  }
}

/* ------------------------------------------------------------------ */
/* otonom grafik ajanı (mini After Effects)                            */
/* ------------------------------------------------------------------ */

const cleanName = (name: string): string =>
  name
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();

export async function runAutoMotion(ctx: AICtx): Promise<void> {
  const mk = (label: string): AgentStep => ({ id: uid(), label, status: "pending" });
  const steps: AgentStep[] = [
    mk("Grafik motoru hazırlanıyor"),
    mk("Açılış jeneriği tasarlanıyor"),
    mk("Alt bantlar yerleştiriliyor"),
    mk("Kapanış kartı ekleniyor"),
  ];
  ctx.cancelRef.current = false;
  ctx.setAgent([...steps]);
  ctx.onScanning(true);
  ctx.log("ai", "Otonom grafik ajanı çalışıyor — jenerik, bantlar ve kapanış kartı tasarlanıyor…");

  const set = (i: number, patch: Partial<AgentStep>) => {
    steps[i] = { ...steps[i], ...patch };
    ctx.setAgent([...steps]);
  };
  const cancelled = () => ctx.cancelRef.current;
  const abort = () => {
    for (let i = 0; i < steps.length; i++) if (steps[i].status === "pending" || steps[i].status === "run") steps[i] = { ...steps[i], status: "skip" };
    ctx.setAgent([...steps]);
  };

  let added = 0;
  try {
    /* 1 — hazırlık */
    set(0, { status: "run" });
    await sleep(650);
    if (cancelled()) return abort();
    const s = ctx.getState();
    const total = seqDuration(s.clips);
    if (s.media.length === 0 && s.layers.length > 0) {
      set(0, { status: "done", note: "hazır" });
      ctx.log("warn", "Medya yok — mevcut grafikler üzerinde çalışıyorum");
    }
    set(0, { status: "done", note: total > 0 ? `${fmtT(total)} sekans` : "boş sekans" });

    /* 2 — açılış jeneriği */
    set(1, { status: "run" });
    await sleep(700);
    if (cancelled()) return abort();
    const s2 = ctx.getState();
    const title = makeLayer(
      "title",
      (s2.name || "yeni_proje").replace(/_/g, " ").toLocaleUpperCase("tr-TR"),
      0,
      total > 0 ? Math.min(3.5, Math.max(2, total)) : 4,
    );
    ctx.dispatch({ type: "ADD_LAYER", layer: title });
    added++;
    set(1, { status: "done", note: `“${title.text}”` });
    ctx.log("ok", `Açılış jeneriği: “${title.text}” — yukarı kayarak giriyor`);
    await sleep(260);

    /* 3 — alt bantlar */
    set(2, { status: "run" });
    const s3 = ctx.getState();
    if (cancelled()) return abort();
    let acc = 0;
    let lowers = 0;
    for (const c of s3.clips.slice(0, 3)) {
      if (cancelled()) return abort();
      const d = c.out - c.in;
      const media = s3.media.find((m) => m.id === c.mediaId);
      const label = media ? cleanName(media.name) : `Sahne ${lowers + 1}`;
      const lower = makeLayer("lower", label, acc + 0.5, acc + Math.min(d, 4));
      ctx.dispatch({ type: "ADD_LAYER", layer: lower });
      added++;
      lowers++;
      acc += d;
      await sleep(240);
    }
    set(2, { status: "done", note: lowers ? `${lowers} bant` : "klip yok" });
    if (lowers) ctx.log("ok", `${lowers} alt bant yerleştirildi — soldan kayarak giriyor`);

    /* 4 — kapanış kartı */
    if (cancelled()) return abort();
    set(3, { status: "run" });
    await sleep(550);
    const s4 = ctx.getState();
    const total4 = seqDuration(s4.clips);
    if (total4 > 5) {
      const outro = makeLayer("title", "SON", Math.max(0, total4 - 3), total4 + 0.5);
      outro.animIn = "zoom";
      outro.easing = "easeInOut";
      outro.size = 10;
      ctx.dispatch({ type: "ADD_LAYER", layer: outro });
      added++;
      set(3, { status: "done", note: "zoom + ease" });
      ctx.log("ok", "Kapanış kartı: “SON” — yaklaşarak giriyor");
    } else {
      set(3, { status: "skip", note: "sekans kısa" });
    }

    ctx.seek(0);
    ctx.play();
    ctx.log("ok", `Otonom grafik tamam — ${added} katman (jenerik + bantlar + kapanış)`);
    ctx.toast("Otomatik grafik hazır");
  } catch {
    ctx.log("warn", "Grafik ajanı sırasında bir sorun oluştu");
  } finally {
    ctx.onScanning(false);
    if (cancelled()) {
      abort();
      ctx.log("warn", "Grafik ajanı iptal edildi");
      window.setTimeout(() => ctx.setAgent(null), 1400);
    } else {
      window.setTimeout(() => ctx.setAgent(null), 2600);
    }
  }
}

/* ------------------------------------------------------------------ */
/* GERÇEK ANALİZ MOTORU ENTEGRASYONU                                   */
/* ------------------------------------------------------------------ */

function logFindings(ctx: AICtx, name: string, r: AnalysisResult) {
  const sil = r.silence.reduce((a, s) => a + (s.end - s.start), 0);
  const parts = [
    r.scenes.length ? `${r.scenes.length} sahne` : null,
    sil > 0.2 ? `${sil.toFixed(1)} sn sessizlik` : null,
    `hareket %${r.motionAvg}`,
    r.bpm ? `BPM ${r.bpm}` : null,
  ].filter(Boolean);
  ctx.log("ai", `${name} → ${parts.join(" · ")}`);
}

export async function analyzeAll(ctx: AICtx): Promise<AnalysisMap> {
  const results: AnalysisMap = {};
  const s = ctx.getState();
  ctx.onScanning(true);
  for (const m of s.media) {
    if (ctx.cancelRef.current) break;
    const r = await analyzeMedia(m, (label, pct) => ctx.prog(`${m.name} — ${label}`, Math.round(pct)));
    results[m.id] = r;
    ctx.dispatch({ type: "SET_ANALYSIS_ENTRY", mediaId: m.id, result: r });
    logFindings(ctx, m.name, r);
  }
  ctx.onScanning(false);
  ctx.prog("", 0);
  return results;
}

export async function analyzeOnly(ctx: AICtx): Promise<void> {
  const s = ctx.getState();
  if (s.media.length === 0) {
    ctx.log("warn", "Analiz için medya kutusu boş — önce video yükleyin");
    return;
  }
  ctx.log("ai", "Analiz başlıyor — ses çözülüyor, kareler taranıyor (cihazınızda)…");
  const results = await analyzeAll(ctx);
  if (!Object.keys(results).length) return;
  ctx.report({ results });
  ctx.log("ok", "Analiz raporu hazır — bulguları seçip uygulayın");
}

/* ölü boşlukları at + sahne geçişlerinden böl */
export async function cutByAnalysis(ctx: AICtx, results: AnalysisMap): Promise<{ silenceCuts: number; sceneCuts: number }> {
  let silenceCuts = 0;
  let sceneCuts = 0;

  for (const r of Object.values(results)) {
    /* sessizlik bölgeleri */
    for (const sil of r.silence) {
      const covering = ctx
        .getState()
        .clips.filter((c) => c.mediaId === r.mediaId && c.in < sil.end - 0.15 && c.out > sil.start + 0.15);
      for (const c of covering) {
        if (ctx.cancelRef.current) return { silenceCuts, sceneCuts };
        const fresh = ctx.getState().clips.find((k) => k.id === c.id);
        if (!fresh) continue;
        if (sil.start <= fresh.in + 0.2) {
          if (sil.end < fresh.out - MIN_CLIP) {
            ctx.dispatch({ type: "TRIM_CLIP", id: fresh.id, in: Math.min(sil.end, fresh.out - MIN_CLIP) });
            silenceCuts++;
            await sleep(90);
          }
        } else if (sil.end >= fresh.out - 0.2) {
          if (sil.start > fresh.in + MIN_CLIP) {
            ctx.dispatch({ type: "TRIM_CLIP", id: fresh.id, out: Math.max(sil.start, fresh.in + MIN_CLIP) });
            silenceCuts++;
            await sleep(90);
          }
        } else {
          /* ortadaki boşluk: iki kez böl, ortayı kaldır */
          ctx.dispatch({ type: "SPLIT_CLIP", id: fresh.id, at: sil.start });
          await sleep(70);
          const right = ctx
            .getState()
            .clips.find((k) => k.mediaId === r.mediaId && Math.abs(k.in - sil.start) < 0.06);
          if (right) {
            ctx.dispatch({ type: "SPLIT_CLIP", id: right.id, at: sil.end });
            await sleep(70);
            const mid = ctx
              .getState()
              .clips.find((k) => k.mediaId === r.mediaId && Math.abs(k.in - sil.start) < 0.06 && Math.abs(k.out - sil.end) < 0.06);
            if (mid) {
              ctx.dispatch({ type: "REMOVE_CLIP", id: mid.id });
              silenceCuts++;
              await sleep(90);
            }
          }
        }
      }
    }

    /* sahne geçişleri */
    for (const b of r.scenes) {
      if (ctx.cancelRef.current) return { silenceCuts, sceneCuts };
      const fresh = ctx.getState().clips.find((c) => c.mediaId === r.mediaId && c.in < b - 0.25 && c.out > b + 0.25);
      if (fresh) {
        ctx.dispatch({ type: "SPLIT_CLIP", id: fresh.id, at: b });
        sceneCuts++;
        await sleep(90);
      }
    }
  }
  return { silenceCuts, sceneCuts };
}

/* kesimleri beat ızgarasına mıknatısla */
export function snapToBeats(ctx: AICtx, results: AnalysisMap): number {
  let n = 0;
  for (const c of ctx.getState().clips) {
    const r = results[c.mediaId];
    if (!r?.beats?.length) continue;
    let best = c.out;
    let bd = 0.4;
    for (const bt of r.beats) {
      const d = Math.abs(bt - c.out);
      if (d < bd) {
        bd = d;
        best = bt;
      }
      if (bt > c.out + 0.5) break;
    }
    if (best !== c.out && best > c.in + MIN_CLIP) {
      ctx.dispatch({ type: "TRIM_CLIP", id: c.id, out: best });
      n++;
    }
  }
  return n;
}

/* histogram düzeltmelerini birleştir */
export function mergedColorPatch(results: AnalysisMap): Partial<Filters> {
  const keys = ["brightness", "contrast", "saturate"] as const;
  const out: Partial<Filters> = {};
  for (const k of keys) {
    const vals = Object.values(results)
      .map((r) => r.colorPatch[k])
      .filter((v): v is number => typeof v === "number");
    if (vals.length) out[k] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return out;
}

/* DESTEKLİ mod — rapor uygulaması */
export async function applyReport(ctx: AICtx, bundle: ReportBundle, opts: ApplyOptions): Promise<void> {
  ctx.log("user", "Rapordaki seçili işlemleri uygula");
  let s = ctx.getState();
  if (s.clips.length === 0 && s.media.length > 0) {
    for (const m of s.media) ctx.dispatch({ type: "ADD_CLIP", clip: { id: uid(), mediaId: m.id, in: 0, out: m.duration } });
    await sleep(80);
  }

  const done: string[] = [];
  const filtered: AnalysisMap = {};
  for (const [k, r] of Object.entries(bundle.results)) {
    filtered[k] = { ...r, scenes: opts.scenes ? r.scenes : [], silence: opts.silence ? r.silence : [] };
  }

  if (opts.silence || opts.scenes) {
    const cuts = await cutByAnalysis(ctx, filtered);
    if (cuts.silenceCuts + cuts.sceneCuts > 0) done.push(`${cuts.silenceCuts + cuts.sceneCuts} kesim`);
  }
  if (opts.beatsnap) {
    const n = snapToBeats(ctx, bundle.results);
    if (n) done.push(`${n} beat kesimi`);
  }
  if (opts.color) {
    const patch = mergedColorPatch(bundle.results);
    if (Object.keys(patch).length) {
      ctx.dispatch({ type: "SET_FILTER", patch: { ...DEFAULT_FILTERS, ...patch } });
      done.push("otomatik renk");
    }
  }
  if (opts.captions) {
    s = ctx.getState();
    let acc = 0;
    for (const c of s.clips.slice(0, 6)) {
      const d = c.out - c.in;
      const start = acc + Math.min(0.4, d * 0.1);
      const end = Math.min(acc + d * 0.85, start + 3.5);
      acc += d;
      const media = s.media.find((m) => m.id === c.mediaId);
      const r = bundle.results[c.mediaId];
      const mid = (c.in + c.out) / 2;
      const seg = r?.segments.find((sg) => mid >= sg.start && mid < sg.end);
      ctx.dispatch({
        type: "ADD_CAPTION",
        caption: { id: uid(), start, end, text: `${seg ? TYPE_LABEL[seg.type] : "Sahne"} • ${media?.name ?? "klip"}` },
      });
      await sleep(60);
    }
    done.push("altyazılar");
  }
  if (opts.graphics) {
    s = ctx.getState();
    if (s.layers.length === 0) {
      const total = seqDuration(s.clips);
      ctx.dispatch({
        type: "ADD_LAYER",
        layer: makeLayer("title", (s.name || "yeni_proje").replace(/_/g, " ").toLocaleUpperCase("tr-TR"), 0, Math.min(3.5, Math.max(2, total || 4))),
      });
      done.push("jenerik");
    }
  }

  ctx.seek(0);
  ctx.play();
  ctx.log(done.length ? "ok" : "warn", done.length ? `Uygulandı: ${done.join(" · ")}` : "Hiçbir işlem seçilmemiş");
  ctx.toast(done.length ? "Rapor uygulandı" : "İşlem seçilmedi");
}

/* ------------------------------------------------------------------ */
/* otonom ses efekti ajanı — sahne tipine göre S1 izine efekt döşer    */
/* ------------------------------------------------------------------ */

export async function runAutoSfx(ctx: AICtx): Promise<void> {
  const mk = (label: string): AgentStep => ({ id: uid(), label, status: "pending" });
  const steps: AgentStep[] = [
    mk("Analiz verileri okunuyor"),
    mk("Geçiş efektleri yerleştiriliyor"),
    mk("Ritim vurguları ekleniyor"),
    mk("Ambiyans döşeniyor"),
  ];
  ctx.cancelRef.current = false;
  ctx.setAgent([...steps]);
  ctx.onScanning(true);
  ctx.log("ai", "Ses efekti ajanı çalışıyor — sahne tipine göre efekt seçiyor…");

  const set = (i: number, patch: Partial<AgentStep>) => {
    steps[i] = { ...steps[i], ...patch };
    ctx.setAgent([...steps]);
  };
  const cancelled = () => ctx.cancelRef.current;
  const abort = () => {
    for (let i = 0; i < steps.length; i++) if (steps[i].status === "pending" || steps[i].status === "run") steps[i] = { ...steps[i], status: "skip" };
    ctx.setAgent([...steps]);
  };

  let placed = 0;
  const add = (type: SFXType, start: number, volume = 0.9) => {
    const item: SFXItem = { id: uid(), type, start: Math.max(0, start), dur: SFX_META[type].dur, volume };
    ctx.dispatch({ type: "ADD_SFX", item });
    placed++;
  };

  try {
    /* 1 — analiz */
    set(0, { status: "run" });
    let s = ctx.getState();
    let results = s.analysis;
    if (!Object.keys(results).length && s.media.length) {
      ctx.log("ai", "Analiz bulunamadı — önce tarıyorum…");
      results = await analyzeAll(ctx);
    }
    if (cancelled()) return abort();
    set(0, { status: "done", note: `${Object.keys(results).length} medya` });
    s = ctx.getState();
    const total = seqDuration(s.clips);
    if (total === 0) {
      set(1, { status: "skip" });
      set(2, { status: "skip" });
      set(3, { status: "skip" });
      ctx.log("warn", "Zaman çizelgesi boş — önce klip ekleyin");
      return;
    }

    /* 2 — geçiş efektleri: her klip sınırına, takip eden sahnenin tipine göre */
    set(1, { status: "run" });
    for (let i = 1; i < s.clips.length; i++) {
      if (cancelled()) return abort();
      const boundary = cumStart(s.clips, i);
      const clip = s.clips[i];
      const r = results[clip.mediaId];
      const localT = boundary - cumStart(s.clips, i) + clip.in;
      const seg = r?.segments.find((sg) => localT >= sg.start && localT < sg.end);
      const fx: SFXType = seg?.type === "action" ? "hit" : seg?.type === "dialog" ? "click" : "whoosh";
      add(fx, boundary - 0.05);
      if (boundary > 1.6) add("riser", boundary - 1.45, 0.5);
      await sleep(140);
    }
    set(1, { status: "done", note: `${s.clips.length - 1} geçiş` });
    if (s.clips.length > 1) ctx.log("ok", `${s.clips.length - 1} geçişe sahne tipine uygun efekt yerleştirildi (aksiyon→vuruş, konuşma→tık, statik→süpürme)`);

    /* 3 — ritim vurguları */
    set(2, { status: "run" });
    const withBpm = Object.values(results).find((r) => r.bpm && r.beats.length);
    let beats = 0;
    if (withBpm) {
      const grid = withBpm.beats.filter((o) => o <= total);
      if (grid.length) add("subdrop", grid[0] - 0.02, 0.85);
      grid.forEach((o, i2) => {
        if (i2 > 0 && i2 % 4 === 0 && beats < 8) {
          add("pop", o - 0.02, 0.6);
          beats++;
        }
      });
      await sleep(300);
    }
    if (cancelled()) return abort();
    set(2, { status: withBpm ? "done" : "skip", note: withBpm ? `BPM ${withBpm.bpm} · ${beats + 1} vurgu` : "tempo yok" });
    if (withBpm) ctx.log("ok", `Ritim vurguları: BPM ${withBpm.bpm} — bas düşüş + ${beats} pop`);

    /* 4 — ambiyans */
    set(3, { status: "run" });
    await sleep(400);
    if (cancelled()) return abort();
    if (total > 6) {
      add("drone", 0, 0.35);
      set(3, { status: "done", note: "drone @ %35" });
      ctx.log("ok", "Düşük seviyeli drone ambiyansı başa döşendi");
    } else {
      set(3, { status: "skip", note: "sekans kısa" });
    }

    ctx.seek(0);
    ctx.play();
    ctx.log("ok", `Ses efekti yerleşimi tamam — ${placed} efekt (S1 izi)`);
    ctx.toast(`${placed} ses efekti yerleştirildi`);
  } catch {
    ctx.log("warn", "Ses efekti ajanı sırasında bir sorun oluştu");
  } finally {
    ctx.onScanning(false);
    if (cancelled()) {
      abort();
      ctx.log("warn", "Ses efekti ajanı iptal edildi");
      window.setTimeout(() => ctx.setAgent(null), 1400);
    } else {
      window.setTimeout(() => ctx.setAgent(null), 2600);
    }
  }
}
