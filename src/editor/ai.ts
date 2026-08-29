import type { Dispatch } from "react";
import type { Filters } from "./model";
import { DEFAULT_FILTERS, MIN_CLIP, clamp, seqDuration, uid } from "./model";
import type { Action, ProjectState } from "./state";

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
  "ALTYAZI — “altyazı ekle: Merhaba dünya” · “altyazıları temizle”",
  "GEZİNME — “oynat” · “durdur” · “5 saniye ileri” · “yarısına git” · “sona git”",
  "PROJE — “video yükle” · “dışa aktar” · “sesi kapat” · “otomatik kurgula”",
];

export const SUGGESTIONS: { label: string; cmd: string }[] = [
  { label: "Otomatik Kurgula", cmd: "otomatik kurgula" },
  { label: "Sinematik Renk", cmd: "sinematik renk uygula" },
  { label: "Siyah-Beyaz", cmd: "siyah beyaz yap" },
  { label: "Burada Böl", cmd: "burada böl" },
  { label: "+5 sn", cmd: "5 saniye ileri" },
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

function parse(text: string, raw: string): Intent {
  if (/(yardım|yardim|komutlar|neler yapabilir|help)/.test(text)) return { t: "help" };
  if (/(otomatik|otonom|kendin yap|akıllı kurgu|smart|auto)/.test(text) && /(kurgu|edit|düzenle|yap)/.test(text)) return { t: "auto" };
  if (text === "kurgula" || text === "otomatik kurgula") return { t: "auto" };
  if (/(altyazı|caption)/.test(text)) {
    const m = raw.match(/[:\-–]\s*(.+)$/);
    if (m) return { t: "captionAdd", text: m[1].trim() };
    if (/(sil|temizle|kaldır)/.test(text)) return { t: "captionClear" };
    return { t: "captionAdd", text: "Yeni altyazı" };
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
    case "auto":
      await runAutoEdit(ctx);
      break;
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
    mk("Sahneler analiz ediliyor"),
    mk("Ölü boşluklar kırpılıyor"),
    mk("Sinematik renk paleti uygulanıyor"),
    mk("Altyazılar oluşturuluyor"),
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

    /* 3 — sahne analizi */
    set(2, { status: "run" });
    await sleep(900);
    if (cancelled()) return abort();
    s = ctx.getState();
    const candidates = s.clips.filter(
      (c) => c.out - c.in > 3 && s.media.find((m) => m.id === c.mediaId)?.kind === "video",
    );
    set(2, { status: "done", note: `${candidates.length} aday` });

    /* 4 — ölü boşluk kırpma */
    set(3, { status: "run" });
    for (const c of candidates) {
      if (cancelled()) return abort();
      const fresh = ctx.getState().clips.find((k) => k.id === c.id);
      if (!fresh) continue;
      const span = fresh.out - fresh.in;
      if (span <= 3) continue;
      const nIn = fresh.in + span * 0.08;
      const nOut = fresh.out - span * 0.12;
      if (nOut - nIn >= MIN_CLIP + 0.2) {
        ctx.dispatch({ type: "TRIM_CLIP", id: fresh.id, in: nIn, out: nOut });
        trimmedCount++;
        await sleep(170);
      }
    }
    set(3, { status: "done", note: `${trimmedCount} klip` });
    if (trimmedCount > 0) ctx.log("ok", `${trimmedCount} klipten giriş/çıkış boşlukları kırpıldı`);
    else ctx.log("ai", "Kırpılacak ölü boşluk bulunamadı");

    /* 5 — renk */
    if (cancelled()) return abort();
    set(4, { status: "run" });
    await sleep(750);
    ctx.dispatch({ type: "SET_FILTER", patch: { ...DEFAULT_FILTERS, ...PRESETS.sinematik.f } });
    set(4, { status: "done", note: "turuncu-teal" });
    ctx.log("ok", "Renk paleti uygulandı: Sinematik (turuncu-teal)");

    /* 6 — altyazılar */
    if (cancelled()) return abort();
    set(5, { status: "run" });
    await sleep(700);
    s = ctx.getState();
    let acc = 0;
    const caps = s.clips.slice(0, 6).map((c, i) => {
      const d = c.out - c.in;
      const start = acc + Math.min(0.4, d * 0.1);
      const end = Math.min(acc + d * 0.85, start + 3.5);
      acc += d;
      const media = s.media.find((m) => m.id === c.mediaId);
      return { id: uid(), start, end, text: `${CAP_TEMPLATES[i % CAP_TEMPLATES.length]} • ${media?.name ?? `klip ${i + 1}`}` };
    });
    for (const cap of caps) {
      if (cancelled()) return abort();
      ctx.dispatch({ type: "ADD_CAPTION", caption: cap });
      captionCount++;
      await sleep(110);
    }
    set(5, { status: "done", note: `${captionCount} altyazı` });
    ctx.log("ok", `Otomatik kurgu tamam — ${trimmedCount} kırpma · sinematik renk · ${captionCount} altyazı`);
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
