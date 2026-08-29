import { useEffect, useRef, useState } from "react";
import { Icon, usePrefersReducedMotion } from "../lib/ui";
import { FONT_FAMILIES, cumStart, filterCSS, fmtTC, layerPose } from "./model";
import { useEditor } from "./state";

function VuMeter({ level, label }: { level: number; label: string }) {
  const segs = 10;
  return (
    <div className="hidden items-end gap-[2px] sm:flex">
      <div className="flex flex-col-reverse gap-[2px]">
        {Array.from({ length: segs }, (_, i) => {
          const on = level * segs > i;
          const col = i < 6 ? "bg-scope" : i < 8 ? "bg-amb" : "bg-rec";
          return (
            <span
              key={i}
              className={`h-[3px] w-5 rounded-[1px] transition-opacity duration-100 ${on ? col : "bg-panel2"}`}
              style={{ opacity: on ? 1 : 0.55 }}
            />
          );
        })}
      </div>
      <span className="ml-1 font-mono text-[9px] text-dim">{label}</span>
    </div>
  );
}

export function Monitor({ scanning = false }: { scanning?: boolean }) {
  const {
    state,
    dispatch,
    seqPos,
    playing,
    activeIndex,
    totalDur,
    vu,
    togglePlay,
    seek,
    stepFrames,
    splitAtPlayhead,
    setInAtPlayhead,
    setOutAtPlayhead,
    registerMediaEl,
  } = useEditor();
  const reduced = usePrefersReducedMotion();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [full, setFull] = useState(false);
  const [safe, setSafe] = useState(false);
  const [stageW, setStageW] = useState(960);

  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setStageW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeClip = state.clips[activeIndex];
  const activeMedia = activeClip
    ? state.media.find((m) => m.id === activeClip.mediaId)
    : undefined;
  const caption = state.captions.find((c) => seqPos >= c.start && seqPos < c.end);
  const f = state.filters;

  const toggleFull = () => {
    const el = boxRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen().catch(() => {});
  };

  const tbtn =
    "flex h-8 w-8 items-center justify-center rounded-[3px] border border-line bg-panel text-mut transition-all hover:border-amb/60 hover:text-amb active:scale-95 disabled:opacity-30 disabled:hover:border-line disabled:hover:text-mut";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* monitör başlığı */}
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-line px-3">
        <span className="font-mono text-[10px] tracking-[0.22em] text-dim">PROGRAM MONİTÖR</span>
        <span className="truncate font-mono text-[10px] text-mut">{state.name}.ffproj</span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-scope">
          <span className={`h-1.5 w-1.5 rounded-full bg-scope ${playing ? "pulse-dot" : ""}`} />
          {playing ? "OYNUYOR" : "HAZIR"}
        </span>
      </div>

      {/* ekran */}
      <div ref={boxRef} className="scanlines vignette relative m-2 flex-1 overflow-hidden rounded-[4px] border border-line bg-black md:m-3">
        <div
          className="absolute inset-0 transition-[filter] duration-200"
          style={{
            filter: filterCSS(f),
            transform: `rotate(${f.rotate}deg) scale(${f.flipH ? -1 : 1}, ${f.flipV ? -1 : 1})`,
          }}
        >
          {state.media
            .filter((m) => m.kind === "video")
            .map((m) => (
              <video
                key={m.id}
                src={m.url}
                playsInline
                preload="auto"
                ref={(el) => {
                  registerMediaEl(m.id, el);
                }}
                onLoadedMetadata={(e) => {
                  const el = e.currentTarget;
                  if (Number.isFinite(el.duration)) {
                    dispatch({
                      type: "UPDATE_MEDIA",
                      id: m.id,
                      patch: { duration: el.duration, width: el.videoWidth || m.width, height: el.videoHeight || m.height },
                    });
                  }
                }}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${
                  activeMedia?.id === m.id ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}
          {state.media
            .filter((m) => m.kind === "image")
            .map((m) => (
              <img
                key={m.id}
                src={m.url}
                alt=""
                draggable={false}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${
                  activeMedia?.id === m.id ? "opacity-100" : "opacity-0"
                }`}
              />
            ))}
        </div>

        {safe && (
          <>
            <div className="pointer-events-none absolute inset-[5%] z-[5] border border-dashed border-scope/40" />
            <div className="pointer-events-none absolute inset-[12.5%] z-[5] border border-dashed border-amb/40" />
          </>
        )}

        {scanning && (
          <>
            <div className="pointer-events-none absolute inset-0 z-[6] bg-amb/5" />
            <div className="scan-sweep pointer-events-none absolute inset-y-0 z-[6] w-16 bg-gradient-to-r from-transparent via-amb/25 to-transparent" />
            <div className="pointer-events-none absolute left-3 bottom-3 z-[7] flex items-center gap-2 rounded-[3px] bg-black/70 px-2 py-1 font-mono text-[10px] tracking-[0.18em] text-amb">
              <span className="blink h-1.5 w-1.5 rounded-full bg-amb" />
              AI ANALİZ EDİYOR
            </div>
          </>
        )}

        {/* bilgi rozetleri */}
        <div className="absolute left-3 top-3 z-[7] flex items-center gap-2">
          {activeClip && (
            <span className="rounded-[3px] bg-black/60 px-2 py-1 font-mono text-[10px] tracking-[0.16em] text-ink">
              PGM ▸ KLİP {activeIndex + 1}/{state.clips.length}
            </span>
          )}
        </div>
        <div className="absolute right-3 top-3 z-[7] flex gap-1.5">
          <button
            onClick={() => setSafe((s) => !s)}
            className={`rounded-[3px] px-2 py-1 font-mono text-[10px] tracking-wider transition-colors ${
              safe ? "bg-scope/90 text-bg0" : "bg-black/60 text-mut hover:text-ink"
            }`}
          >
            GÜVENLİ ALAN
          </button>
        </div>

        {caption && (
          <div className="absolute inset-x-0 bottom-10 z-[7] text-center">
            <span className="rounded-[3px] bg-black/75 px-3 py-1.5 text-[14px] font-medium text-ink">
              {caption.text}
            </span>
          </div>
        )}

        {/* hareketli grafik katmanları */}
        {state.layers.map((L) => {
          const p = layerPose(L, seqPos);
          if (!p.visible) return null;
          const isSel = state.selLayer === L.id;
          const fsPx = (L.size / 100) * stageW;
          const shown = L.animIn === "typewriter" ? L.text.slice(0, p.chars) : L.text;
          return (
            <button
              key={L.id}
              onClick={() => dispatch({ type: "SELECT_LAYER", id: L.id })}
              title={`${L.name} — tıklayınca seçilir`}
              className={`absolute z-[6] cursor-pointer whitespace-pre text-left leading-tight transition-shadow ${
                isSel ? "ants-frame" : ""
              }`}
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                opacity: p.opacity / 100,
                transform: `translate(-50%, -50%) rotate(${p.rot}deg) scale(${p.scale / 100})`,
                clipPath: p.clip < 1 ? `inset(0 ${(1 - p.clip) * 100}% 0 0)` : undefined,
                fontSize: fsPx,
                color: L.color,
                fontFamily: FONT_FAMILIES[L.font],
                textTransform: L.upper ? "uppercase" : "none",
                letterSpacing: L.font === "display" ? "0.04em" : "0.02em",
                background: L.bg || undefined,
                padding: L.bg ? "0.22em 0.55em" : "0.06em 0.14em",
                textShadow: L.bg ? "none" : "0 2px 14px rgba(0,0,0,.65)",
              }}
            >
              {shown}
              {L.animIn === "typewriter" && p.chars < L.text.length && (
                <span className="blink" style={{ color: L.color }}>▌</span>
              )}
            </button>
          );
        })}

        {totalDur === 0 && (
          <div className="absolute inset-0 z-[7] flex flex-col items-center justify-center gap-2 text-center">
            <Icon name="film" className="h-8 w-8 text-line2" />
            <p className="font-mono text-[11px] tracking-[0.2em] text-dim">
              ZAMAN ÇİZELGESİ BOŞ — MEDYA KUTUSUNDAN KLİP EKLEYİN
            </p>
          </div>
        )}

        {!playing && totalDur > 0 && (
          <button
            onClick={togglePlay}
            aria-label="Oynat"
            className="absolute inset-0 z-[7] flex items-center justify-center bg-black/20 transition-colors hover:bg-black/10"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-amb/70 bg-black/55 text-amb transition-transform duration-200 hover:scale-110">
              <Icon name="play" className="ml-1 h-6 w-6" />
            </span>
          </button>
        )}

        {/* zaman kodu + VU */}
        <div className="absolute inset-x-0 bottom-0 z-[7] flex items-end justify-between gap-4 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-10">
          <span className="font-mono text-sm tabular-nums tracking-[0.12em] text-amb [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
            {fmtTC(seqPos)}
          </span>
          <VuMeter level={playing && !reduced ? vu.l : 0} label="L" />
          <VuMeter level={playing && !reduced ? vu.r : 0} label="R" />
        </div>
      </div>

      {/* taşıma çubuğu */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-2 py-2 md:px-3">
        <button className={tbtn} aria-label="Bir kare geri" onClick={() => stepFrames(-1)}>
          <Icon name="stepB" className="h-3.5 w-3.5" />
        </button>
        <button
          className={tbtn}
          aria-label="Önceki klip"
          disabled={activeIndex === 0 && seqPos < 0.1}
          onClick={() => seek(activeIndex > 0 ? cumStart(state.clips, activeIndex - 1) : 0)}
        >
          <Icon name="chevronL" className="h-4 w-4" />
        </button>
        <button
          onClick={togglePlay}
          aria-label={playing ? "Duraklat" : "Oynat"}
          className="flex h-8 w-11 items-center justify-center rounded-[3px] bg-amb text-bg0 transition-all hover:bg-amb2 active:scale-95"
        >
          <Icon name={playing ? "pause" : "play"} className="h-4 w-4" />
        </button>
        <button
          className={tbtn}
          aria-label="Sonraki klip"
          disabled={activeIndex >= state.clips.length - 1}
          onClick={() => {
            const next = Math.min(activeIndex + 1, state.clips.length - 1);
            seek(cumStart(state.clips, next));
          }}
        >
          <Icon name="chevronR" className="h-4 w-4" />
        </button>
        <button className={tbtn} aria-label="Bir kare ileri" onClick={() => stepFrames(1)}>
          <Icon name="stepF" className="h-3.5 w-3.5" />
        </button>

        <span className="mx-2 hidden font-mono text-[11px] tabular-nums text-mut sm:block">
          {fmtTC(seqPos)} <span className="text-dim">/ {fmtTC(totalDur)}</span>
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <button className={tbtn} aria-label="Böl (Ctrl+K)" title="Oynatma başlığında böl" onClick={splitAtPlayhead}>
            <Icon name="scissors" className="h-4 w-4" />
          </button>
          <button className={tbtn} aria-label="Giriş noktası [I]" title="Giriş noktası işaretle" onClick={setInAtPlayhead}>
            <span className="font-mono text-[10px] font-bold">IN</span>
          </button>
          <button className={tbtn} aria-label="Çıkış noktası [O]" title="Çıkış noktası işaretle" onClick={setOutAtPlayhead}>
            <span className="font-mono text-[10px] font-bold">OUT</span>
          </button>
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <button
            className={tbtn}
            aria-label={state.muted ? "Sesi aç" : "Sesi kapat"}
            onClick={() => dispatch({ type: "SET_MUTED", muted: !state.muted })}
          >
            <Icon name={state.muted ? "volumeX" : "volume"} className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(state.volume * 100)}
            onChange={(e) => dispatch({ type: "SET_VOLUME", volume: Number(e.target.value) / 100 })}
            className="range-amber hidden w-20 md:block"
            aria-label="Ses düzeyi"
          />
          <button className={tbtn} aria-label="Tam ekran" onClick={toggleFull}>
            <Icon name={full ? "minimize" : "maximize"} className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
