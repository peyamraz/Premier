import { useRef, useState } from "react";
import { Icon } from "../lib/ui";
import { FONT_FAMILIES, clipDur, filterCSS, findClipAt, fmtShort, layerPose, seqDuration } from "./model";
import { getSfxUrl } from "./sfx";
import { useEditor } from "./state";

type Stage = "setup" | "render" | "done";
type ResKey = "src" | "1080" | "720" | "480";

const RES: Record<ResKey, { label: string; w: number; h: number }> = {
  src: { label: "KAYNAK", w: 0, h: 0 },
  "1080": { label: "1080p", w: 1920, h: 1080 },
  "720": { label: "720p", w: 1280, h: 720 },
  "480": { label: "480p", w: 854, h: 480 },
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function waitEvent(el: HTMLVideoElement, ev: string, timeout = 2500): Promise<void> {
  return new Promise((resolve) => {
    const t = window.setTimeout(() => resolve(), timeout);
    el.addEventListener(
      ev,
      () => {
        window.clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("görsel okunamadı"));
    img.src = url;
  });
}

export function ExportModal({ onClose }: { onClose: () => void }) {
  const { state, toast } = useEditor();
  const [stage, setStage] = useState<Stage>("setup");
  const [res, setRes] = useState<ResKey>("720");
  const [bitrate, setBitrate] = useState(12_000_000);
  const [fname, setFname] = useState((state.name || "kurgu").replace(/[^\w\-ğüşıöçĞÜŞİÖÇ]+/gi, "_"));
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const cancelRef = useRef(false);

  const totalDur = seqDuration(state.clips);
  const firstMedia = state.clips.length
    ? state.media.find((m) => m.id === state.clips[0].mediaId)
    : undefined;

  const run = async () => {
    cancelRef.current = false;
    setStage("render");
    setProgress(0);
    setResult(null);

    /* boyut */
    let W = 1280;
    let H = 720;
    if (res === "src" && firstMedia) {
      const scale = Math.min(1, 1920 / Math.max(1, firstMedia.width));
      W = Math.round((firstMedia.width * scale) / 2) * 2;
      H = Math.round((firstMedia.height * scale) / 2) * 2;
    } else if (res !== "src") {
      W = RES[res].w;
      H = RES[res].h;
    }

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast("Tarayıcı canvas desteklemiyor");
      setStage("setup");
      return;
    }

    /* ses grafiği — render için ayrı elemanlar, monitör sesi etkilenmez */
    let actx: AudioContext | null = null;
    let dest: MediaStreamAudioDestinationNode | null = null;
    try {
      actx = new AudioContext();
      dest = actx.createMediaStreamDestination();
      await actx.resume();
    } catch {
      actx = null;
      dest = null;
    }

    const exportEls: Record<string, HTMLVideoElement> = {};
    const f = state.filters;
    const vol = state.muted ? 0 : state.volume;
    for (const m of state.media) {
      if (m.kind !== "video") continue;
      const el = document.createElement("video");
      el.src = m.url;
      el.preload = "auto";
      el.playsInline = true;
      if (actx && dest) {
        try {
          const src = actx.createMediaElementSource(el);
          const g = actx.createGain();
          g.gain.value = vol;
          src.connect(g);
          g.connect(dest);
        } catch {
          el.muted = true;
        }
      } else {
        el.muted = true;
      }
      exportEls[m.id] = el;
    }

    const stream = canvas.captureStream(30);
    if (dest && !state.muted && vol > 0) {
      for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
    }

    const mimes = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    const mime = mimes.find((mm) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mm));
    if (!mime) {
      toast("Bu tarayıcıda video kaydı desteklenmiyor");
      setStage("setup");
      void actx?.close();
      return;
    }

    const chunks: BlobPart[] = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const stopped = new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });

    const draw = (srcEl: CanvasImageSource, sw: number, sh: number) => {
      ctx.save();
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.translate(W / 2, H / 2);
      ctx.rotate((f.rotate * Math.PI) / 180);
      ctx.scale(f.flipH ? -1 : 1, f.flipV ? -1 : 1);
      ctx.filter = filterCSS(f);
      const sc = Math.max(W / Math.max(1, sw), H / Math.max(1, sh));
      const w = sw * sc;
      const h = sh * sc;
      ctx.drawImage(srcEl, -w / 2, -h / 2, w, h);
      ctx.restore();
    };

    const drawCaption = (t: number) => {
      const cap = state.captions.find((c) => t >= c.start && t < c.end);
      if (!cap || !cap.text.trim()) return;
      const fs = Math.max(14, Math.round(H * 0.05));
      ctx.font = `600 ${fs}px "IBM Plex Sans", sans-serif`;
      const tw = ctx.measureText(cap.text).width;
      ctx.fillStyle = "rgba(0,0,0,.66)";
      const bx = W / 2 - tw / 2 - fs * 0.6;
      const by = H - fs * 2.5;
      ctx.fillRect(bx, by, tw + fs * 1.2, fs * 1.7);
      const fc = findClipAt(state.clips, t);
      const an = fc ? state.analysis[fc.clip.mediaId] : undefined;
      const sg = an
        ? an.segments.find((x) => fc!.clip.in + fc!.local >= x.start && fc!.clip.in + fc!.local < x.end)
        : undefined;
      ctx.fillStyle = sg?.type === "action" ? "#ffd48a" : sg?.type === "static" ? "#a9cdff" : "#f2efe6";
      ctx.font = `${sg?.type === "action" ? 700 : 500} ${fs}px "IBM Plex Sans", sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(cap.text, W / 2 - tw / 2, by + fs * 0.85);
    };

    const drawLayers = (t: number) => {
      for (const L of state.layers) {
        const p = layerPose(L, t);
        if (!p.visible || p.opacity <= 0.5) continue;
        const fs = Math.max(6, (L.size / 100) * W);
        const weight = L.font === "display" ? "" : "600 ";
        ctx.save();
        ctx.globalAlpha = clamp01(p.opacity / 100);
        ctx.translate((p.x / 100) * W, (p.y / 100) * H);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.scale(p.scale / 100, p.scale / 100);
        ctx.font = `${weight}${fs}px ${FONT_FAMILIES[L.font]}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        let text = L.upper ? L.text.toLocaleUpperCase("tr-TR") : L.text;
        if (L.animIn === "typewriter") text = text.slice(0, p.chars);
        const tw = ctx.measureText(text).width;
        const bh = fs * 1.35;
        if (p.clip < 1) {
          ctx.beginPath();
          ctx.rect(-tw / 2 - fs, -bh / 2 - fs, (tw + fs * 2) * p.clip, bh + fs * 2);
          ctx.clip();
        }
        if (L.bg) {
          ctx.fillStyle = L.bg;
          ctx.globalAlpha = clamp01(p.opacity / 100) * 0.88;
          ctx.fillRect(-tw / 2 - fs * 0.55, -bh / 2, tw + fs * 1.1, bh);
          ctx.globalAlpha = clamp01(p.opacity / 100);
        } else {
          ctx.shadowColor = "rgba(0,0,0,.6)";
          ctx.shadowBlur = fs * 0.35;
          ctx.shadowOffsetY = fs * 0.06;
        }
        ctx.fillStyle = L.color;
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
    };

    rec.start(250);

    /* stok müzik + ses efektlerini kayda karıştır */
    if (actx && dest && !state.muted) {
      const t0c = actx.currentTime + 0.06;
      if (state.music) {
        try {
          const mb = await (await fetch(state.music.url)).arrayBuffer();
          const mbuf = await actx.decodeAudioData(mb);
          const src = actx.createBufferSource();
          src.buffer = mbuf;
          src.loop = true;
          const g = actx.createGain();
          g.gain.value = state.music.volume;
          src.connect(g);
          g.connect(dest);
          src.start(t0c);
        } catch {
          toast("Stok müzik dışa aktarıma eklenemedi (CORS/çözümleme) — video yine de render ediliyor");
        }
      }
      for (const it of state.sfx) {
        try {
          const url = await getSfxUrl(it.type);
          const bb = await (await fetch(url)).arrayBuffer();
          const bbuf = await actx.decodeAudioData(bb);
          const src = actx.createBufferSource();
          src.buffer = bbuf;
          const g = actx.createGain();
          g.gain.value = it.volume;
          src.connect(g);
          g.connect(dest);
          src.start(t0c + it.start);
        } catch {
          /* efekt çözümlenemedi — sessizce geç */
        }
      }
    }

    const t0 = performance.now();
    const elapsed = () => (performance.now() - t0) / 1000;

    const frameLoop = (cond: () => boolean, drawFn: () => void): Promise<void> =>
      new Promise((resolve) => {
        const tick = () => {
          if (cancelRef.current) return resolve();
          drawFn();
          const t = elapsed();
          drawCaption(t);
          drawLayers(t);
          setProgress(Math.min(1, t / Math.max(0.001, totalDur)));
          if (cond()) return resolve();
          requestAnimationFrame(tick);
        };
        tick();
      });

    for (const clip of state.clips) {
      if (cancelRef.current) break;
      const media = state.media.find((m) => m.id === clip.mediaId);
      if (!media) continue;
      if (media.kind === "video") {
        const el = exportEls[media.id];
        if (el.readyState < 1) await waitEvent(el, "loadeddata", 4000);
        el.currentTime = clip.in;
        await waitEvent(el, "seeked", 2000);
        void el.play().catch(() => {});
        await frameLoop(
          () => el.ended || el.currentTime >= clip.out - 0.04,
          () => draw(el, el.videoWidth || media.width, el.videoHeight || media.height),
        );
        el.pause();
      } else {
        const img = await loadImage(media.url).catch(() => null);
        if (!img) continue;
        const dur = clipDur(clip);
        const start = performance.now();
        await frameLoop(
          () => (performance.now() - start) / 1000 >= dur,
          () => draw(img, media.width, media.height),
        );
      }
    }

    rec.stop();
    await stopped;
    void actx?.close();

    if (cancelRef.current) {
      toast("Dışa aktarma iptal edildi");
      setStage("setup");
      return;
    }

    const blob = new Blob(chunks, { type: mime.split(";")[0] });
    setResult({ url: URL.createObjectURL(blob), size: blob.size });
    setProgress(1);
    setStage("done");
    toast("Dışa aktarma tamamlandı");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]" onClick={stage === "render" ? undefined : onClose}>
      <div
        className="w-full max-w-lg rounded-[6px] border border-line2 bg-panel shadow-[0_40px_120px_rgba(0,0,0,.6)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Dışa aktar"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-amb text-bg0">
            <Icon name="download" className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-xl leading-none tracking-wide text-ink">DIŞA AKTAR</p>
            <p className="font-mono text-[9.5px] tracking-[0.2em] text-dim">RENDER HATTI • {fmtShort(totalDur)} SEKANS</p>
          </div>
          {stage !== "render" && (
            <button onClick={onClose} className="ml-auto text-dim transition-colors hover:text-rec" aria-label="Kapat">
              <Icon name="x" className="h-5 w-5" />
            </button>
          )}
        </div>

        {stage === "setup" && (
          <div className="space-y-4 p-4">
            <div>
              <p className="mb-1.5 font-mono text-[10px] tracking-[0.2em] text-dim">ÇÖZÜNÜRLÜK</p>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(RES) as ResKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setRes(k)}
                    className={`rounded-[3px] border py-2 font-mono text-[11px] transition-all ${
                      res === k ? "border-amb bg-amb/12 text-amb" : "border-line text-mut hover:border-line2 hover:text-ink"
                    }`}
                  >
                    {RES[k].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 font-mono text-[10px] tracking-[0.2em] text-dim">KALİTE</p>
                <select
                  value={bitrate}
                  onChange={(e) => setBitrate(Number(e.target.value))}
                  className="w-full rounded-[3px] border border-line bg-bg0 px-2 py-2 font-mono text-[11px] text-ink outline-none focus:border-amb"
                >
                  <option value={8_000_000}>Web için (8 Mbps)</option>
                  <option value={12_000_000}>Yüksek (12 Mbps)</option>
                  <option value={16_000_000}>Çok yüksek (16 Mbps)</option>
                </select>
              </div>
              <div>
                <p className="mb-1.5 font-mono text-[10px] tracking-[0.2em] text-dim">DOSYA ADI</p>
                <input
                  value={fname}
                  onChange={(e) => setFname(e.target.value)}
                  className="w-full rounded-[3px] border border-line bg-bg0 px-2 py-2 font-mono text-[11px] text-ink outline-none focus:border-amb"
                />
              </div>
            </div>
            <p className="rounded-[4px] border border-line bg-bg0 px-3 py-2.5 font-mono text-[10px] leading-relaxed text-dim">
              ▸ Çıktı: <span className="text-amb">WebM (VP9 + Opus)</span> — renkler, altyazılar ve ses yakılır.
              <br />▸ Gerçek zamanlı render: sekme açık kalmalı, süre ≈ {fmtShort(totalDur)}.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void run()}
                className="flex flex-1 items-center justify-center gap-2 rounded-[3px] bg-amb py-2.5 font-mono text-[12px] font-bold tracking-wider text-bg0 transition-all hover:bg-amb2 hover:shadow-[0_8px_28px_rgba(255,180,60,.25)]"
              >
                <Icon name="bolt" className="h-4 w-4" /> RENDERI BAŞLAT
              </button>
              <button onClick={onClose} className="rounded-[3px] border border-line px-4 font-mono text-[11px] text-mut transition-colors hover:border-line2 hover:text-ink">
                VAZGEÇ
              </button>
            </div>
          </div>
        )}

        {stage === "render" && (
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-2.5">
              <span className="blink h-2.5 w-2.5 rounded-full bg-rec" />
              <span className="font-mono text-[12px] font-bold tracking-[0.2em] text-rec">REC</span>
              <span className="ml-auto font-mono text-[12px] tabular-nums text-amb">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-panel2">
              <div className="h-full rounded-full bg-gradient-to-r from-amb2 to-amb transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="flex justify-between font-mono text-[9.5px] tracking-wider text-dim">
              <span>VP9 • 30 FPS • {RES[res].label}</span>
              <span>SEKMENİZİ AÇIK TUTUN</span>
            </div>
            <button
              onClick={() => {
                cancelRef.current = true;
              }}
              className="w-full rounded-[3px] border border-rec/50 py-2 font-mono text-[11px] tracking-wider text-rec transition-colors hover:bg-rec/10"
            >
              İPTAL ET
            </button>
          </div>
        )}

        {stage === "done" && result && (
          <div className="space-y-4 p-4">
            <video src={result.url} controls className="w-full rounded-[4px] border border-line bg-black" />
            <div className="flex items-center gap-2 font-mono text-[10.5px] text-dim">
              <Icon name="check" className="h-4 w-4 text-scope" />
              <span className="text-scope">HAZIR</span>
              <span className="ml-auto">{(result.size / 1048576).toFixed(1)} MB • WebM</span>
            </div>
            <div className="flex gap-2">
              <a
                href={result.url}
                download={`${fname || "kurgu"}.webm`}
                className="flex flex-1 items-center justify-center gap-2 rounded-[3px] bg-amb py-2.5 font-mono text-[12px] font-bold tracking-wider text-bg0 transition-all hover:bg-amb2"
              >
                <Icon name="download" className="h-4 w-4" /> İNDİR
              </a>
              <button
                onClick={() => setStage("setup")}
                className="rounded-[3px] border border-line px-4 font-mono text-[11px] text-mut transition-colors hover:text-ink"
              >
                TEKRAR
              </button>
              <button onClick={onClose} className="rounded-[3px] border border-line px-4 font-mono text-[11px] text-mut transition-colors hover:text-ink">
                KAPAT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
