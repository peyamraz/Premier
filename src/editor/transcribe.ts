/* Otomatik altyazı çıkarma — ana iş parçacığı API'si */

import { clipDur, uid, type Caption, type Clip } from "./model";
import type { AnalysisMap } from "./analysis";

export interface TranscribeChunk {
  start: number;
  end: number;
  text: string;
}

export interface TranscribeResult {
  text: string;
  chunks: TranscribeChunk[];
}

type ProgressFn = (label: string, pct: number) => void;

const MODEL = "Xenova/whisper-tiny";

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./transcribe.worker.ts", import.meta.url), { type: "module" });
  }
  return worker;
}

/** Medya dosyasının sesini 16 kHz mono Float32 olarak çözer. */
export async function decodeTo16k(url: string): Promise<Float32Array | null> {
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const actx = new Ctx();
    const decoded = await actx.decodeAudioData(buf);
    void actx.close();

    const targetSr = 16000;
    const length = Math.ceil(decoded.duration * targetSr);
    if (length < targetSr * 0.3) return null; // 0.3 sn'den kısa — atla
    const off = new OfflineAudioContext(1, length, targetSr);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start(0);
    const rendered = await off.startRendering();
    return rendered.getChannelData(0);
  } catch {
    return null;
  }
}

/** Tek bir medya dosyasını Whisper ile tanır. */
export function transcribeAudio(
  url: string,
  language: string | null,
  onProgress: ProgressFn,
): Promise<TranscribeResult | null> {
  return new Promise((resolve) => {
    const w = getWorker();
    let settled = false;

    const finish = (r: TranscribeResult | null) => {
      if (settled) return;
      settled = true;
      w.removeEventListener("message", onMsg);
      resolve(r);
    };

    const onMsg = (e: MessageEvent) => {
      const d = e.data as {
        type: string;
        status?: string;
        pct?: number;
        file?: string;
        text?: string;
        chunks?: { text: string; timestamp: [number, number | null] }[];
        message?: string;
      };
      if (d.type === "status" && d.status) {
        onProgress(d.status, -1);
      } else if (d.type === "progress") {
        onProgress(`Model: ${d.file ?? ""}`, d.pct ?? 0);
      } else if (d.type === "result") {
        const chunks: TranscribeChunk[] = (d.chunks ?? [])
          .map((c) => ({
            start: c.timestamp[0] ?? 0,
            end: c.timestamp[1] ?? (c.timestamp[0] ?? 0) + 1.5,
            text: c.text.trim(),
          }))
          .filter((c) => c.text.length > 0 && c.end > c.start);
        finish({ text: d.text ?? "", chunks });
      } else if (d.type === "error") {
        onProgress(`Hata: ${d.message}`, -1);
        finish(null);
      }
    };

    w.addEventListener("message", onMsg);

    void decodeTo16k(url).then((audio) => {
      if (!audio) return finish(null);
      onProgress("Ses çözümlendi — tanıma başlıyor", 5);
      w.postMessage({ type: "transcribe", audio, language, model: MODEL }, [audio.buffer]);
    });

    /* güvenlik zaman aşımı: 6 dk */
    window.setTimeout(() => finish(null), 360_000);
  });
}

/* ------------------------------------------------------------------ */
/* zaman çizelgesi eşlemesi                                            */
/* ------------------------------------------------------------------ */

/** Medya-zamanlı parçaları sekans zamanına çevirir (klip konumlarına göre). */
export function mapChunksToSequence(
  chunks: TranscribeChunk[],
  clips: Clip[],
  mediaId: string,
  wordsPer = 6,
): Caption[] {
  const caps: Caption[] = [];
  for (const ch of chunks) {
    let acc = 0;
    for (const c of clips) {
      const d = clipDur(c);
      if (c.mediaId === mediaId) {
        const s = Math.max(ch.start, c.in);
        const e = Math.min(ch.end, c.out);
        if (e - s >= 0.25) {
          caps.push({ id: uid(), start: acc + (s - c.in), end: acc + (e - c.in), text: ch.text });
        }
      }
      acc += d;
    }
  }
  return wordsPer > 0 ? regroupCaptions(caps, wordsPer) : caps;
}

/* ------------------------------------------------------------------ */
/* satır başına kelime sayısına göre yeniden bölme                     */
/* ------------------------------------------------------------------ */

interface TimedWord {
  text: string;
  t: number; // saniye cinsinden başlangıç zamanı (kaynak satırdan enterpolasyon)
}

/**
 * Altyazıları satır başına en çok `wordsPer` kelime olacak şekilde yeniden böler.
 * Zamanlama, kaynak satırın içindeki kelime konumundan enterpole edilir;
 * cümle sonu noktalama işaretlerinde (. ? ! …) erken kapatılır.
 */
export function regroupCaptions(caps: Caption[], wordsPer: number): Caption[] {
  if (wordsPer < 1) return caps;

  /* 1 — tüm kelimeleri zaman çizelgesine ser */
  const words: TimedWord[] = [];
  for (const c of caps) {
    const parts = c.text.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) continue;
    const span = Math.max(0.001, c.end - c.start);
    parts.forEach((p, i) => {
      words.push({ text: p, t: c.start + (span * i) / parts.length });
    });
  }
  if (!words.length) return [];

  /* 2 — kelime öbekleri kur */
  const out: Caption[] = [];
  let cur: TimedWord[] = [];
  const flush = (nextT?: number) => {
    if (!cur.length) return;
    const start = cur[0].t;
    const last = cur[cur.length - 1];
    /* okuma süresi: kelime uzunluğuna göre pay */
    let end = last.t + Math.max(0.35, (last.text.length + 1) * 0.055);
    if (nextT !== undefined) end = Math.min(end, nextT - 0.02);
    if (end <= start) end = start + 0.3;
    out.push({ id: uid(), start, end, text: cur.map((w) => w.text).join(" ") });
    cur = [];
  };

  for (let i = 0; i < words.length; i++) {
    cur.push(words[i]);
    const w = words[i];
    const endsSentence = /[.?!…]["')\]]?$/.test(w.text);
    const isLast = i === words.length - 1;
    if (cur.length >= wordsPer || (endsSentence && cur.length >= 2) || isLast) {
      flush(isLast ? undefined : words[i + 1].t);
    }
  }
  return out;
}

/** Whisper başarısız olursa analiz verisindeki diyalog bölgelerinden zamanlama üretir. */
export function dialogFallbackCaptions(
  clips: Clip[],
  analysis: AnalysisMap,
): Caption[] {
  const caps: Caption[] = [];
  let acc = 0;
  for (const c of clips) {
    const d = clipDur(c);
    const an = analysis[c.mediaId];
    if (an) {
      for (const sg of an.segments) {
        if (sg.type !== "dialog") continue;
        const s = Math.max(sg.start, c.in);
        const e = Math.min(sg.end, c.out);
        if (e - s >= 0.8) {
          caps.push({
            id: uid(),
            start: acc + (s - c.in),
            end: acc + (e - c.in),
            text: `[konuşma ${(e - s).toFixed(0)} sn]`,
          });
        }
      }
    }
    acc += d;
  }
  return caps;
}
