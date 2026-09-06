/* Whisper Web Worker — tarayıcı içinde gerçek konuşma tanıma */

import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@xenova/transformers";

/* yerel model aramasını kapat — CDN'den gelsin */
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;

interface ReqMsg {
  type: "transcribe";
  audio: Float32Array;
  language: string | null; // "turkish" | "english" | null(otomatik)
  model: string;
}

self.onmessage = async (e: MessageEvent<ReqMsg>) => {
  const msg = e.data;
  if (msg.type !== "transcribe") return;

  const post = (obj: Record<string, unknown>) => (self as unknown as Worker).postMessage(obj);

  try {
    if (!transcriber) {
      post({ type: "status", status: "Model indiriliyor (ilk kullanımda ~40 MB)…" });
      transcriber = await pipeline("automatic-speech-recognition", msg.model, {
        quantized: true,
        progress_callback: (p: { status?: string; progress?: number; file?: string }) => {
          if (p.status === "progress" && typeof p.progress === "number") {
            post({
              type: "progress",
              stage: "model",
              pct: Math.round(p.progress),
              file: p.file ?? "",
            });
          } else if (p.status) {
            post({ type: "status", status: String(p.status) });
          }
        },
      });
    }

    post({ type: "status", status: "Konuşma tanınıyor…" });
    const output = (await transcriber(msg.audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
      task: "transcribe",
      ...(msg.language ? { language: msg.language } : {}),
    })) as unknown as {
      text?: string;
      chunks?: { text: string; timestamp: [number, number | null] }[];
    };

    post({ type: "result", text: output.text ?? "", chunks: output.chunks ?? [] });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
