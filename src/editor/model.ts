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

export interface Clip {
  id: string;
  mediaId: string;
  in: number; // saniye
  out: number; // saniye
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
