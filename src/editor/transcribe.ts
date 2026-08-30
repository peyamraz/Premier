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
  return caps;
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
