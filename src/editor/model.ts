/* Veri modeli + saf yardımcı fonksiyonlar */

export type MediaKind = "video" | "image";

export interface MediaItem {
  id: string;
  kind: MediaKind;
  name: string;
  url: string;
  duration: number; // saniye (image için sabit 5)
  width: number;
  height: number;
  thumb?: string;
}

export type FitMode = "cover" | "contain" | "stretch";

export const FIT_LABEL: Record<FitMode, string> = {
  cover: "Doldur",
  contain: "Sığdır",
  stretch: "Ger",
};

export interface Clip {
  id: string;
  mediaId: string;
  in: number; // saniye
  out: number; // saniye
  fit?: FitMode; // çerçeve uyumu (yoksa global)
  scale?: number; // % (100 = normal)
  tx?: number; // % yatay kaydırma (-50..50)
  ty?: number; // % dikey kaydırma
}

export interface FrameSpec {
  ratio: string; // "16:9" | "9:16" | ... | "custom"
  w: number;
  h: number;
}

export const RATIOS: { id: string; w: number; h: number; tag: string }[] = [
  { id: "16:9", w: 1920, h: 1080, tag: "Yatay • YouTube" },
  { id: "9:16", w: 1080, h: 1920, tag: "Dikey • Reels" },
  { id: "1:1", w: 1080, h: 1080, tag: "Kare • IG" },
  { id: "4:5", w: 1080, h: 1350, tag: "IG Akış" },
  { id: "21:9", w: 2560, h: 1080, tag: "Sinema" },
  { id: "4:3", w: 1440, h: 1080, tag: "Retro" },
];

export const ratioToFrame = (id: string): FrameSpec => {
  const r = RATIOS.find((x) => x.id === id);
  return r ? { ratio: r.id, w: r.w, h: r.h } : { ratio: "16:9", w: 1920, h: 1080 };
};

/** Oranı koruyarak uzun kenarı hedefe ölçekler (çift sayılara yuvarlar). */
export function dimsFor(frame: FrameSpec, longEdge: number): { w: number; h: number } {
  const scale = longEdge / Math.max(frame.w, frame.h);
  const w = Math.round((frame.w * scale) / 2) * 2;
  const h = Math.round((frame.h * scale) / 2) * 2;
  return { w, h };
}

export interface Caption {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface Filters {
  brightness: number;
  contrast: number;
  saturate: number;
  hue: number;
  rotate: number; // 0/90/180/270
  flipH: boolean;
  flipV: boolean;
}

/* ------------------------------------------------------------------ */
/* video efektleri (VFX)                                               */
/* ------------------------------------------------------------------ */

export type VFX = "vhs" | "grain" | "vignette" | "chroma" | "glow" | "flicker";

export const VFX_LIST: VFX[] = ["vhs", "grain", "vignette", "chroma", "glow", "flicker"];

export const VFX_META: Record<VFX, { label: string; desc: string }> = {
  vhs: { label: "VHS", desc: "Tarama çizgileri + iz bandı + sinyal titremesi" },
  grain: { label: "GREN", desc: "35mm film kumlanması" },
  vignette: { label: "VİNYET", desc: "Köşelerden kararan odak" },
  chroma: { label: "RGB AYRIŞMA", desc: "Kırmızı/mavi kanal kayması" },
  glow: { label: "PARLAMA", desc: "Yumuşak bloom ışığı" },
  flicker: { label: "TİTREME", desc: "Projektör ışığı dalgalanması" },
};

export type EffectsState = Record<VFX, boolean>;

export const NO_EFFECTS: EffectsState = {
  vhs: false,
  grain: false,
  vignette: false,
  chroma: false,
  glow: false,
  flicker: false,
};

export const DEFAULT_FILTERS: Filters = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hue: 0,
  rotate: 0,
  flipH: false,
  flipV: false,
};

export const FPS = 24;
export const MIN_CLIP = 0.2;

let counter = 0;
export function uid(): string {
  counter = (counter + 1) % 1296;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export const clipDur = (c: Clip): number => c.out - c.in;

export const seqDuration = (clips: Clip[]): number =>
  clips.reduce((a, c) => a + clipDur(c), 0);

export function cumStart(clips: Clip[], index: number): number {
  let a = 0;
  for (let i = 0; i < index && i < clips.length; i++) a += clipDur(clips[i]);
  return a;
}

export function findClipAt(
  clips: Clip[],
  t: number,
): { index: number; clip: Clip; local: number } | null {
  if (clips.length === 0) return null;
  let acc = 0;
  for (let i = 0; i < clips.length; i++) {
    const d = clipDur(clips[i]);
    if (t < acc + d || i === clips.length - 1) {
      return { index: i, clip: clips[i], local: clamp(t - acc, 0, d) };
    }
    acc += d;
  }
  return null;
}

export function fmtTC(sec: number, fps = FPS): string {
  const s = Math.max(0, sec);
  const f = Math.floor((s % 1) * fps);
  const ss = Math.floor(s) % 60;
  const mm = Math.floor(s / 60) % 60;
  const hh = Math.floor(s / 3600);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(hh)}:${p(mm)}:${p(ss)}:${p(f)}`;
}

export function fmtShort(sec: number): string {
  const s = Math.floor(Math.max(0, sec)) % 60;
  const m = Math.floor(Math.max(0, sec) / 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(m)}:${p(s)}`;
}

export function filterCSS(f: Filters): string {
  return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) hue-rotate(${f.hue}deg)`;
}

/* ------------------------------------------------------------------ */
/* hareketli grafik katmanları (motion graphics)                       */
/* ------------------------------------------------------------------ */

export type Easing = "linear" | "easeOut" | "easeInOut" | "back" | "bounce";
export type AnimType =
  | "none"
  | "fade"
  | "slideUp"
  | "slideLeft"
  | "slideRight"
  | "zoom"
  | "wipe"
  | "typewriter"
  | "pop"
  | "blurIn"
  | "glitch";

export interface MotionLayer {
  id: string;
  kind: "title" | "lower" | "text";
  name: string;
  text: string;
  start: number; // saniye
  end: number;
  x: number; // % (soldan)
  y: number; // % (yukarıdan)
  scale: number; // %
  rot: number; // derece
  opacity: number; // 0-100
  size: number; // punto, kare genişliğinin %'si
  color: string;
  bg: string; // "" = yok
  font: "display" | "sans" | "mono";
  upper: boolean;
  animIn: AnimType;
  animOut: AnimType;
  animDur: number; // saniye
  easing: Easing;
  follow?: "none" | "pan" | "zoom"; // yazı takibi: pan = ekranı tarar, zoom = yavaş yaklaşma
}

export const EASINGS: Record<Easing, { label: string; fn: (t: number) => number }> = {
  linear: { label: "Doğrusal", fn: (t) => t },
  easeOut: { label: "Yumuşak çıkış", fn: (t) => 1 - Math.pow(1 - t, 3) },
  easeInOut: {
    label: "Giriş-çıkış",
    fn: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  },
  back: {
    label: "Taşmalı",
    fn: (t) => {
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    },
  },
  bounce: {
    label: "Zıplayan",
    fn: (t) => {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
  },
};

export const ANIMS: Record<AnimType, string> = {
  none: "Yok",
  fade: "Solma",
  slideUp: "Yukarı kay",
  slideLeft: "Soldan kay",
  slideRight: "Sağdan kay",
  zoom: "Yaklaş",
  wipe: "Perde",
  typewriter: "Daktilo",
  pop: "Pop (taşmalı)",
  blurIn: "Bulanık netleşme",
  glitch: "Glitch",
};

export const FONT_FAMILIES: Record<MotionLayer["font"], string> = {
  display: '"Bebas Neue", "Arial Narrow", sans-serif',
  sans: '"IBM Plex Sans", sans-serif',
  mono: '"IBM Plex Mono", monospace',
};

export function easeValue(e: Easing, t: number): number {
  return EASINGS[e].fn(clamp(t, 0, 1));
}

export interface LayerPose {
  x: number;
  y: number;
  scale: number;
  rot: number;
  opacity: number; // 0-100
  clip: number; // 0-1 (perde)
  chars: number; // daktilo
  blur: number; // px
  jx: number; // glitch jitter px
  jy: number;
  visible: boolean;
}

/** Deterministik sözde-rastgele (monitör + render aynı değeri üretir). */
export const prand = (seed: number): number => {
  const v = Math.sin(seed * 127.1) * 43758.5453;
  return v - Math.floor(v);
};

/** Katmanın t anındaki dönüşüm durumu — monitör ve render aynı matematiği kullanır. */
export function layerPose(L: MotionLayer, t: number): LayerPose {
  const d = Math.max(0.001, L.animDur);
  const visible = t >= L.start && t < L.end;
  const pi = t < L.start + d ? easeValue(L.easing, (t - L.start) / d) : 1;
  const po = t > L.end - d ? easeValue(L.easing, (L.end - t) / d) : 1;

  let { x, y, scale, rot } = L;
  let opacity = L.opacity;
  let clip = 1;
  let chars = L.text.length;
  let blur = 0;
  let jx = 0;
  let jy = 0;

  const applyIn = (p: number, a: AnimType) => {
    const q = 1 - p;
    switch (a) {
      case "fade":
        opacity *= p;
        break;
      case "pop":
        scale *= 0.2 + 0.8 * p;
        opacity *= Math.min(1, p * 2);
        break;
      case "blurIn":
        opacity *= Math.min(1, p * 1.4);
        blur = q * 14;
        break;
      case "glitch": {
        opacity *= Math.min(1, p * 1.8);
        const f = Math.floor(t * 24);
        jx = (prand(f) - 0.5) * 16 * q;
        jy = (prand(f + 7) - 0.5) * 9 * q;
        if (prand(Math.floor(t * 18)) < 0.22) opacity *= 0.15;
        break;
      }
      case "slideUp":
        y += q * 10;
        opacity *= Math.min(1, p * 1.6);
        break;
      case "slideLeft":
        x -= q * 14;
        opacity *= Math.min(1, p * 1.6);
        break;
      case "slideRight":
        x += q * 14;
        opacity *= Math.min(1, p * 1.6);
        break;
      case "zoom":
        scale *= 0.35 + 0.65 * p;
        opacity *= p;
        break;
      case "wipe":
        clip = p;
        break;
      case "typewriter":
        chars = Math.round(p * L.text.length);
        break;
      case "none":
        break;
    }
  };
  const applyOut = (p: number, a: AnimType) => {
    const q = 1 - p;
    switch (a) {
      case "fade":
      case "typewriter":
      case "zoom":
      case "pop":
      case "blurIn":
      case "glitch":
        opacity *= p;
        break;
      case "slideUp":
        y -= q * 8;
        opacity *= p;
        break;
      case "slideLeft":
        x += q * 12;
        opacity *= p;
        break;
      case "slideRight":
        x -= q * 12;
        opacity *= p;
        break;
      case "wipe":
        clip = p;
        break;
      case "none":
        break;
    }
  };

  applyIn(pi, L.animIn);
  applyOut(po, L.animOut);

  /* yazı takibi — pan: metin ekranı tarar; zoom: yavaş yaklaşma */
  if (L.follow && L.follow !== "none") {
    const u = clamp((t - L.start) / Math.max(0.001, L.end - L.start), 0, 1);
    if (L.follow === "pan") {
      x = 112 - 124 * u;
      opacity = Math.max(opacity, 0);
      scale = 100;
      clip = 1;
      jx = 0;
      jy = 0;
    } else if (L.follow === "zoom") {
      scale = 100 + 34 * u;
    }
  }

  return { x, y, scale, rot, opacity, clip, chars, blur, jx, jy, visible };
}

export function makeLayer(
  kind: MotionLayer["kind"],
  text: string,
  start: number,
  end: number,
): MotionLayer {
  const base = {
    id: uid(),
    text,
    start,
    end,
    scale: 100,
    rot: 0,
    opacity: 100,
    upper: true,
    animDur: 0.8,
    easing: "easeOut" as Easing,
  };
  if (kind === "title") {
    return {
      ...base,
      kind,
      name: `Başlık — ${text.slice(0, 14)}`,
      x: 50,
      y: 36,
      size: 8,
      color: "#EAE5D9",
      bg: "",
      font: "display",
      animIn: "slideUp",
      animOut: "fade",
    };
  }
  if (kind === "lower") {
    return {
      ...base,
      kind,
      name: `Alt bant — ${text.slice(0, 14)}`,
      x: 7,
      y: 84,
      size: 2.8,
      color: "#FFB43C",
      bg: "#0B0E13",
      font: "sans",
      upper: false,
      animIn: "slideLeft",
      animOut: "fade",
      animDur: 0.6,
    };
  }
  return {
    ...base,
    kind,
    name: `Metin — ${text.slice(0, 14)}`,
    x: 50,
    y: 52,
    size: 3.6,
    color: "#3BD6B0",
    bg: "",
    font: "mono",
    upper: false,
    animIn: "typewriter",
    animOut: "fade",
    easing: "linear",
    animDur: 1.4,
  };
}
