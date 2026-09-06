import type { Filters, MediaItem } from "./model";
import { clamp } from "./model";

/* ------------------------------------------------------------------ */
/* tipler                                                              */
/* ------------------------------------------------------------------ */

export type ClipType = "action" | "static" | "dialog";

export interface SilenceRegion {
  start: number;
  end: number;
}

export interface SegmentMeta {
  start: number;
  end: number;
  type: ClipType;
  motion: number; // 0-100
  energy: number; // 0-1
}

export interface AnalysisResult {
  mediaId: string;
  duration: number;
  kind: "video" | "image";
  bpm: number | null;
  beats: number[];
  scenes: number[];
  silence: SilenceRegion[];
  segments: SegmentMeta[];
  motionAvg: number;
  colorPatch: Partial<Filters>;
  colorNote: string;
  bestFrame: { time: number; thumb: string } | null;
  suggestions: string[];
}

export type AnalysisMap = Record<string, AnalysisResult>;

export type ProgFn = (label: string, pct: number) => void;

/* ------------------------------------------------------------------ */
/* ses analizi — WebAudio ile gerçekten çözülür                        */
/* ------------------------------------------------------------------ */

interface AudioInfo {
  rms: Float32Array; // 50 ms'lik pencereler
  hop: number; // saniye
  duration: number;
}

async function decodeAudio(url: string): Promise<AudioInfo | null> {
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const audio = await ctx.decodeAudioData(buf);
    const sr = audio.sampleRate;
    const len = audio.length;
    const mono = new Float32Array(len);
    for (let ch = 0; ch < audio.numberOfChannels; ch++) {
      const d = audio.getChannelData(ch);
      for (let i = 0; i < len; i++) mono[i] += d[i] / audio.numberOfChannels;
    }
    void ctx.close();
    const hop = Math.max(256, Math.floor(sr * 0.05));
    const n = Math.floor(len / hop);
    const rms = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      const off = i * hop;
      for (let j = 0; j < hop; j++) sum += mono[off + j] * mono[off + j];
      rms[i] = Math.sqrt(sum / hop);
    }
    return { rms, hop: hop / sr, duration: len / sr };
  } catch {
    return null;
  }
}

function findSilence(a: AudioInfo): SilenceRegion[] {
  const sorted = Array.from(a.rms).sort((x, y) => x - y);
  const p20 = sorted[Math.floor(sorted.length * 0.2)] ?? 0;
  const floor = Math.max(0.007, p20 * 1.4);
  const regions: SilenceRegion[] = [];
  let start = -1;
  for (let i = 0; i < a.rms.length; i++) {
    if (a.rms[i] < floor) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      const s = start * a.hop;
      const e = i * a.hop;
      if (e - s >= 0.6) regions.push({ start: s, end: e });
      start = -1;
    }
  }
  if (start >= 0) {
    const s = start * a.hop;
    const e = a.rms.length * a.hop;
    if (e - s >= 0.6) regions.push({ start: s, end: e });
  }
  return regions;
}

function findOnsetsAndBpm(a: AudioInfo): { onsets: number[]; bpm: number | null } {
  const flux = new Float32Array(a.rms.length);
  for (let i = 1; i < a.rms.length; i++) flux[i] = Math.max(0, a.rms[i] - a.rms[i - 1]);

  const onsets: number[] = [];
  let last = -10;
  const win = 10;
  for (let i = 1; i < flux.length - 1; i++) {
    let med = 0;
    for (let j = Math.max(0, i - win); j < i; j++) med += flux[j];
    med /= win;
    const th = med * 2.4 + 0.0035;
    if (flux[i] > th && flux[i] >= flux[i - 1] && flux[i] > flux[i + 1]) {
      const t = i * a.hop;
      if (t - last > 0.14) {
        onsets.push(t);
        last = t;
      }
    }
  }

  /* BPM — onset zarfının otokorelasyonu (55–190 BPM) */
  let bpm: number | null = null;
  if (onsets.length >= 6) {
    const env = flux;
    let bestScore = 0;
    let bestLag = 0;
    const minLag = Math.floor(60 / 190 / a.hop);
    const maxLag = Math.min(env.length - 2, Math.floor(60 / 55 / a.hop));
    for (let lag = minLag; lag <= maxLag; lag++) {
      let score = 0;
      for (let i = 0; i < env.length - lag; i += 2) score += env[i] * env[i + lag];
      /* tempo önceliği: 90–140 BPM hafif bonus */
      const b = 60 / (lag * a.hop);
      if (b >= 85 && b <= 145) score *= 1.15;
      if (score > bestScore) {
        bestScore = score;
        bestLag = lag;
      }
    }
    if (bestLag > 0) bpm = Math.round(60 / (bestLag * a.hop));
  }

  return { onsets, bpm };
}

function beatGrid(a: AudioInfo, onsets: number[], bpm: number): number[] {
  const step = 60 / bpm;
  const start = onsets.length ? onsets[0] : 0;
  const beats: number[] = [];
  for (let t = start; t < a.duration; t += step) {
    /* en yakın onset'e mıknatısla */
    let snapped = t;
    let best = 0.09;
    for (const o of onsets) {
      const d = Math.abs(o - t);
      if (d < best) {
        best = d;
        snapped = o;
      }
      if (o > t + 0.2) break;
    }
    beats.push(Math.round(snapped * 100) / 100);
    if (beats.length > 500) break;
  }
  return beats;
}

/* ------------------------------------------------------------------ */
/* görüntü analizi — kare örnekleme, histogram, keskinlik              */
/* ------------------------------------------------------------------ */

const SW = 64;
const SH = 36;

interface FrameSample {
  t: number;
  luma: Float32Array; // SW*SH
  meanLuma: number;
  hist: Float32Array; // 16 kova
  rgb: [number, number, number];
  sharp: number;
  diff: number; // önceki kareyle fark (0-255)
}

function waitSeek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(to);
      resolve();
    };
    const to = window.setTimeout(done, 1600);
    v.addEventListener("seeked", done, { once: true });
    try {
      v.currentTime = t;
    } catch {
      window.clearTimeout(to);
      resolve();
    }
  });
}

interface FrameResult {
  samples: FrameSample[];
  best: { time: number; thumb: string } | null;
}

async function sampleFrames(url: string, duration: number, onProg: ProgFn, base: number, span: number): Promise<FrameResult | null> {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  v.style.cssText = "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
  document.body.appendChild(v);
  try {
    await new Promise<void>((resolve, reject) => {
      const to = window.setTimeout(() => reject(new Error("timeout")), 9000);
      v.onloadeddata = () => {
        window.clearTimeout(to);
        resolve();
      };
      v.onerror = () => {
        window.clearTimeout(to);
        reject(new Error("video okunamadı"));
      };
    });

    const count = Math.max(10, Math.min(46, Math.round(duration * 1.6)));
    const canvas = document.createElement("canvas");
    canvas.width = SW;
    canvas.height = SH;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    if (!g) return null;

    const samples: FrameSample[] = [];
    let prev: Float32Array | null = null;
    let bestSharp = -1;
    let bestData: ImageData | null = null;
    let bestT = 0;

    for (let i = 0; i < count; i++) {
      const t = Math.max(0.04, (duration - 0.08) * (i / (count - 1 || 1)) + 0.04);
      await waitSeek(v, t);
      g.drawImage(v, 0, 0, SW, SH);
      const img = g.getImageData(0, 0, SW, SH);
      const data = img.data;
      const luma = new Float32Array(SW * SH);
      const hist = new Float32Array(16);
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (let p = 0; p < SW * SH; p++) {
        const r = data[p * 4];
        const gg = data[p * 4 + 1];
        const b = data[p * 4 + 2];
        const y = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
        luma[p] = y;
        hist[Math.min(15, y >> 4)]++;
        sr += r;
        sg += gg;
        sb += b;
      }
      const npx = SW * SH;
      for (let h = 0; h < 16; h++) hist[h] /= npx;

      /* Laplacian keskinlik */
      let lap = 0;
      for (let y = 1; y < SH - 1; y++) {
        for (let x = 1; x < SW - 1; x++) {
          const p = y * SW + x;
          const d = 4 * luma[p] - luma[p - 1] - luma[p + 1] - luma[p - SW] - luma[p + SW];
          lap += d * d;
        }
      }

      let diff = 0;
      if (prev) {
        let s = 0;
        for (let p = 0; p < npx; p++) s += Math.abs(luma[p] - prev[p]);
        diff = s / npx;
      }

      const sharp = lap / npx;
      samples.push({
        t,
        luma,
        meanLuma: luma.reduce((a2, b2) => a2 + b2, 0) / npx,
        hist,
        rgb: [sr / npx, sg / npx, sb / npx],
        sharp,
        diff,
      });
      if (sharp > bestSharp) {
        bestSharp = sharp;
        bestData = new ImageData(new Uint8ClampedArray(img.data), SW, SH);
        bestT = t;
      }
      prev = luma;
      onProg("Görüntü taranıyor", base + (span * (i + 1)) / count);
    }

    let best: { time: number; thumb: string } | null = null;
    if (bestData) {
      const small = document.createElement("canvas");
      small.width = SW;
      small.height = SH;
      small.getContext("2d")?.putImageData(bestData, 0, 0);
      const big = document.createElement("canvas");
      big.width = 240;
      big.height = 135;
      const bg = big.getContext("2d");
      if (bg) {
        bg.imageSmoothingEnabled = true;
        bg.drawImage(small, 0, 0, 240, 135);
        best = { time: bestT, thumb: big.toDataURL("image/jpeg", 0.72) };
      }
    }
    return { samples, best };
  } catch {
    return null;
  } finally {
    v.removeAttribute("src");
    v.load();
    v.remove();
  }
}

function detectScenes(samples: FrameSample[]): number[] {
  const cuts: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    let histDiff = 0;
    for (let h = 0; h < 16; h++) histDiff += Math.abs(a.hist[h] - b.hist[h]);
    const lumaJump = Math.abs(a.meanLuma - b.meanLuma);
    if (histDiff > 0.55 || lumaJump > 42) {
      const at = (a.t + b.t) / 2;
      if (!cuts.length || at - cuts[cuts.length - 1] > 0.9) cuts.push(at);
    }
  }
  return cuts.map((c) => Math.round(c * 100) / 100);
}

function colorFromSamples(samples: FrameSample[]): { patch: Partial<Filters>; note: string } {
  const meanLuma = samples.reduce((a, s) => a + s.meanLuma, 0) / samples.length;
  const lumaStd = Math.sqrt(samples.reduce((a, s) => a + (s.meanLuma - meanLuma) ** 2, 0) / samples.length) + 14;
  let spread = 0;
  for (const s of samples) {
    const mx = Math.max(...s.rgb);
    const mn = Math.min(...s.rgb);
    spread += mx - mn;
  }
  spread /= samples.length;

  const patch: Partial<Filters> = {};
  const notes: string[] = [];

  const br = Math.round(clamp(100 + (118 - meanLuma) * 0.55, 88, 116));
  if (br !== 100) {
    patch.brightness = br;
    notes.push(`parlaklık ${br > 100 ? "+" : ""}${br - 100}`);
  }
  const ct = Math.round(clamp(100 + (44 - lumaStd) * 0.85, 96, 126));
  if (ct !== 100) {
    patch.contrast = ct;
    notes.push(`kontrast ${ct > 100 ? "+" : ""}${ct - 100}`);
  }
  const st = Math.round(clamp(100 + (24 - spread) * 1.7, 88, 140));
  if (st !== 100) {
    patch.saturate = st;
    notes.push(`doygunluk ${st > 100 ? "+" : ""}${st - 100}`);
  }

  return { patch, note: notes.length ? `otomatik seviye: ${notes.join(" · ")}` : "renk profili dengeli — düzeltme gerekmedi" };
}

function classifySegments(samples: FrameSample[] | null, audio: AudioInfo | null, duration: number): { segments: SegmentMeta[]; motionAvg: number } {
  const segments: SegmentMeta[] = [];
  const winDur = 2.5;
  let motionSum = 0;
  let motionN = 0;

  for (let start = 0; start < duration; start += winDur) {
    const end = Math.min(duration, start + winDur);
    let motion = 0;
    if (samples) {
      const inWin = samples.filter((s) => s.t >= start && s.t < end && s.diff > 0);
      if (inWin.length) {
        const avg = inWin.reduce((a, s) => a + s.diff, 0) / inWin.length;
        motion = clamp(avg * 7, 0, 100);
      }
    }
    let energy = 0;
    if (audio) {
      const i0 = Math.floor(start / audio.hop);
      const i1 = Math.min(audio.rms.length, Math.ceil(end / audio.hop));
      let e = 0;
      for (let i = i0; i < i1; i++) e += audio.rms[i];
      energy = (e / Math.max(1, i1 - i0)) * 6;
      energy = clamp(energy, 0, 1);
    }
    let type: ClipType = "static";
    if (motion > 38) type = "action";
    else if (audio && energy > 0.12 && energy < 0.85 && motion < 30) type = "dialog";
    else if (!audio && motion >= 12) type = "action";
    segments.push({ start, end, type, motion: Math.round(motion), energy: Math.round(energy * 100) / 100 });
    motionSum += motion;
    motionN++;
  }
  return { segments, motionAvg: motionN ? Math.round(motionSum / motionN) : 0 };
}

function buildSuggestions(r: Omit<AnalysisResult, "suggestions">): string[] {
  const out: string[] = [];
  const sil = r.silence.reduce((a, s) => a + (s.end - s.start), 0);
  if (sil > 0.8) out.push(`${sil.toFixed(1)} sn ölü boşluk bulundu — otomatik kırpma önerilir`);
  if (r.scenes.length) out.push(`${r.scenes.length} sahne geçişi tespit edildi — geçişlerden bölmek akışı temizler`);
  if (r.bpm) out.push(`BPM ${r.bpm} — kesimleri beat ızgarasına oturtmak ritmi güçlendirir`);
  if (r.motionAvg > 45) out.push("Yüksek hareketli içerik — hızlı kesmeler ve beat senkronu uygun");
  else if (r.motionAvg < 12 && r.segments.some((s) => s.type === "dialog")) out.push("Diyalog ağırlıklı içerik — uzun planlar korunmalı, alt bant önerilir");
  if (!out.length) out.push("İçerik dengeli — manuel ince ayar yeterli");
  return out;
}

/* ------------------------------------------------------------------ */
/* orkestra                                                            */
/* ------------------------------------------------------------------ */

export async function analyzeMedia(m: MediaItem, onProg: ProgFn): Promise<AnalysisResult> {
  onProg(`Ses çözümleniyor — ${m.name}`, 2);

  let audio: AudioInfo | null = null;
  if (m.kind === "video") audio = await decodeAudio(m.url);
  onProg(audio ? "Ses zarfı çıkarıldı" : "Ses izi bulunamadı", 22);

  let audioDerived = { silence: [] as SilenceRegion[], bpm: null as number | null, beats: [] as number[] };
  if (audio) {
    audioDerived.silence = findSilence(audio);
    onProg("Sessizlik bölgeleri işaretlendi", 34);
    const { onsets, bpm } = findOnsetsAndBpm(audio);
    audioDerived.bpm = bpm;
    if (bpm) audioDerived.beats = beatGrid(audio, onsets, bpm);
    onProg(bpm ? `Tempo bulundu: ${bpm} BPM` : "Belirgin tempo yok", 46);
  }

  const duration = m.duration || (audio ? audio.duration : 0);
  let samples: FrameSample[] | null = null;
  let scenes: number[] = [];
  let colorPatch: Partial<Filters> = {};
  let colorNote = "görsel analiz atlandı";
  let bestFrame: AnalysisResult["bestFrame"] = null;

  if (m.kind === "video" && duration > 0.5) {
    const fr = await sampleFrames(m.url, duration, onProg, 46, 46);
    samples = fr?.samples ?? null;
    bestFrame = fr?.best ?? null;
    if (samples && samples.length > 1) {
      scenes = detectScenes(samples);
      onProg(`${scenes.length} sahne geçişi bulundu`, 94);
      const col = colorFromSamples(samples);
      colorPatch = col.patch;
      colorNote = col.note;
      onProg("En iyi kare seçildi", 97);
    }
  }

  const { segments, motionAvg } = classifySegments(samples, audio, Math.max(duration, m.duration));

  const partial: Omit<AnalysisResult, "suggestions"> = {
    mediaId: m.id,
    duration,
    kind: m.kind,
    bpm: audioDerived.bpm,
    beats: audioDerived.beats,
    scenes,
    silence: audioDerived.silence,
    segments,
    motionAvg,
    colorPatch,
    colorNote,
    bestFrame,
  };

  const result: AnalysisResult = { ...partial, suggestions: buildSuggestions(partial) };
  onProg("Analiz tamamlandı", 100);
  return result;
}

export const TYPE_LABEL: Record<ClipType, string> = {
  action: "Aksiyon",
  static: "Statik",
  dialog: "Konuşma",
};

export const TYPE_BADGE: Record<ClipType, { letter: string; cls: string }> = {
  action: { letter: "A", cls: "bg-amb text-bg0" },
  static: { letter: "S", cls: "bg-cue text-bg0" },
  dialog: { letter: "K", cls: "bg-scope text-bg0" },
};
