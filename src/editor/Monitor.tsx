import { useEffect, useRef, useState } from "react";
import { Icon, usePrefersReducedMotion } from "../lib/ui";
import { CAPTION_STYLES, FONT_FAMILIES, cumStart, filterCSS, findClipAt, fmtTC, layerPose, type EffectsState } from "./model";
import { getSfxUrl } from "./sfx";
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

/* video efekti katmanları */
const GRAIN_URL =
  "image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='120' height='120' filter='url(%23g)'/></svg>";

function VfxOverlay({ fx }: { fx: EffectsState }) {
  return (
    <>
      {fx.vignette && (
        <div
          className="pointer-events-none absolute inset-0 z-[6]"
          style={{ background: "radial-gradient(115% 90% at 50% 45%, transparent 52%, rgba(0,0,0,.62) 100%)" }}
        />
      )}
      {fx.glow && (
        <div
          className="pointer-events-none absolute inset-0 z-[6] mix-blend-screen"
          style={{ background: "radial-gradient(80% 60% at 50% 38%, rgba(255,214,150,.28), transparent 70%)", filter: "blur(2px)" }}
        />
      )}
      {fx.chroma && (
        <>
          <div className="pointer-events-none absolute inset-0 z-[6]" style={{ boxShadow: "inset 3px 0 12px rgba(255,60,90,.5), inset -3px 0 12px rgba(60,200,255,.5)" }} />
          <div className="pointer-events-none absolute inset-0 z-[6] opacity-25" style={{ background: "linear-gradient(90deg, rgba(255,0,60,.12), transparent 18%, transparent 82%, rgba(0,180,255,.12))" }} />
        </>
      )}
      {fx.grain && (
        <div className="pointer-events-none absolute inset-0 z-[7] opacity-[0.14] mix-blend-overlay" style={{ backgroundImage: `url("${GRAIN_URL}")` }} />
      )}
      {fx.vhs && (
        <>
          <div className="pointer-events-none absolute inset-0 z-[7] opacity-60" style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,.045) 0 1px, transparent 1px 3px)" }} />
          <div className="vhs-track pointer-events-none absolute inset-x-0 z-[7] h-10 opacity-25" style={{ background: "linear-gradient(180deg, transparent, rgba(255,255,255,.5), transparent)" }} />
          <div className="pointer-events-none absolute inset-0 z-[7]" style={{ boxShadow: "inset 0 0 40px rgba(80,120,255,.18)" }} />
        </>
      )}
      {fx.flicker && <div className="vfx-flicker pointer-events-none absolute inset-0 z-[7] bg-black" />}
    </>
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
  const [stageH, setStageH] = useState(540);

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
      const h = entries[0]?.contentRect.height;
      if (w) setStageW(w);
      if (h) setStageH(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* SFX oynatma motoru — zaman çizelgesindeki efektleri zamanında tetikler */
  const sfxEls = useRef<Map<string, HTMLAudioElement>>(new Map());
  useEffect(() => {
    const active = new Set<string>();
    if (playing) {
      for (const it of state.sfx) {
        if (seqPos >= it.start - 0.03 && seqPos < it.start + it.dur) active.add(it.id);
      }
    }
    for (const it of state.sfx) {
      const existing = sfxEls.current.get(it.id);
      if (active.has(it.id) && !existing) {
        void getSfxUrl(it.type).then((url) => {
          if (sfxEls.current.get(it.id)) return;
          const a = new Audio(url);
          a.volume = it.volume * state.volume * (state.muted ? 0 : 1);
          a.currentTime = Math.max(0, Math.min(seqPos - it.start, it.dur - 0.02));
          void a.play().catch(() => {});
          a.onended = () => sfxEls.current.delete(it.id);
          sfxEls.current.set(it.id, a);
        });
      } else if (!active.has(it.id) && existing) {
        existing.pause();
        sfxEls.current.delete(it.id);
      }
    }
    /* kaldırılmış efektleri temizle */
    for (const [id, el] of sfxEls.current) {
      if (!state.sfx.some((x) => x.id === id)) {
        el.pause();
        sfxEls.current.delete(id);
      }
    }
  }, [state.sfx, seqPos, playing, state.volume, state.muted]);

  useEffect(() => {
    const els = sfxEls.current;
    return () => {
      for (const el of els.values()) el.pause();
      els.clear();
    };
  }, []);

  /* BGM (stok / dahili müzik) oynatma */
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const bgmUrlRef = useRef<string | null>(null);
  useEffect(() => {
    let el = bgmRef.current;
    if (!el) {
      el = new Audio();
      el.loop = true;
      bgmRef.current = el;
    }
    const url = state.music?.url ?? null;
    if (url !== bgmUrlRef.current) {
      bgmUrlRef.current = url;
      if (url) {
        el.src = url;
        el.currentTime = 0;
      } else {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
    }
    if (el) el.volume = state.music ? state.music.volume * (state.muted ? 0 : 1) : 0;
    if (url && playing) void el.play().catch(() => {});
    else el?.pause();
  }, [state.music, playing, state.muted]);
  useEffect(
    () => () => {
      bgmRef.current?.pause();
      bgmRef.current = null;
    },
    [],
  );

  const activeClip = state.clips[activeIndex];
  const activeMedia = activeClip
    ? state.media.find((m) => m.id === activeClip.mediaId)
    : undefined;
  const caption = state.captions.find((c) => seqPos >= c.start && seqPos < c.end);
  const st = CAPTION_STYLES[state.captionStyle] ?? CAPTION_STYLES.klasik;

  /* aktif sahnenin tipi — altyazı rengini hafifçe etkiler */
  const mood = (() => {
    const fc = findClipAt(state.clips, seqPos);
    if (!fc) return null;
    const an = state.analysis[fc.clip.mediaId];
    if (!an) return null;
    const local = fc.clip.in + fc.local;
    return an.segments.find((sg) => local >= sg.start && local < sg.end)?.type ?? null;
  })();
  const f = state.filters;

  /* çerçeve oranına göre ekrana sığan dikdörtgen */
  const frameAR = state.frame.w / Math.max(1, state.frame.h);
  const boxAR = stageW / Math.max(1, stageH);
  const frameW = frameAR >= boxAR ? stageW : stageH * frameAR;
  const frameH = frameAR >= boxAR ? stageW / frameAR : stageH;

  /* aktif klibin çerçeve uyumu + konum/ölçek dönüşümü */
  const fitOf = (mId: string) => {
    const clip =
      activeClip && activeClip.mediaId === mId
        ? activeClip
        : state.clips.find((c) => c.mediaId === mId);
    const mode = clip?.fit ?? state.fitMode;
    const objectFit = mode === "cover" ? "cover" : mode === "contain" ? "contain" : "fill";
    const scale = (clip?.scale ?? 100) / 100;
    const tx = clip?.tx ?? 0;
    const ty = clip?.ty ?? 0;
    return { objectFit, transform: `translate(${tx}%, ${ty}%) scale(${scale})` } as const;
  };

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
        {/* çerçeve — seçilen orana göre ortalanır */}
        <div
          className="absolute left-1/2 top-1/2 overflow-hidden bg-black shadow-[0_0_0_1px_rgba(255,180,60,.14)]"
          style={{ width: frameW, height: frameH, transform: "translate(-50%,-50%)" }}
        >
          <div
            className="absolute inset-0 transition-[filter] duration-200"
            style={{
              filter: filterCSS(f),
              transform: `rotate(${f.rotate}deg) scale(${f.flipH ? -1 : 1}, ${f.flipV ? -1 : 1})`,
            }}
          >
            {state.media
              .filter((m) => m.kind === "video")
              .map((m) => {
                const fit = fitOf(m.id);
                return (
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
                    style={{ objectFit: fit.objectFit, transform: fit.transform }}
                    className={`absolute inset-0 h-full w-full transition-opacity duration-150 ${
                      activeMedia?.id === m.id ? "opacity-100" : "opacity-0"
                    }`}
                  />
                );
              })}
            {state.media
              .filter((m) => m.kind === "image")
              .map((m) => {
                const fit = fitOf(m.id);
                return (
                  <img
                    key={m.id}
                    src={m.url}
                    alt=""
                    draggable={false}
                    style={{ objectFit: fit.objectFit, transform: fit.transform }}
                    className={`absolute inset-0 h-full w-full transition-opacity duration-150 ${
                      activeMedia?.id === m.id ? "opacity-100" : "opacity-0"
                    }`}
                  />
                );
              })}
          </div>

          {/* sıcaklık / tint — manuel beyaz dengesi katmanı */}
          {f.temp !== 0 && (
            <div
              className="pointer-events-none absolute inset-0 z-[5]"
              style={{
                mixBlendMode: "soft-light",
                background:
                  f.temp > 0
                    ? `rgba(255,147,41,${(f.temp / 100) * 0.65})`
                    : `rgba(56,130,255,${(-f.temp / 100) * 0.65})`,
              }}
            />
          )}
          {f.tint !== 0 && (
            <div
              className="pointer-events-none absolute inset-0 z-[5]"
              style={{
                mixBlendMode: "soft-light",
                background:
                  f.tint > 0
                    ? `rgba(255,72,196,${(f.tint / 100) * 0.55})`
                    : `rgba(64,201,120,${(-f.tint / 100) * 0.55})`,
              }}
            />
          )}

          {safe && (
            <>
              <div className="pointer-events-none absolute inset-[5%] z-[5] border border-dashed border-scope/40" />
              <div className="pointer-events-none absolute inset-[12.5%] z-[5] border border-dashed border-amb/40" />
            </>
          )}

          {/* video efektleri (VFX) */}
          <VfxOverlay fx={state.effects} />

          {caption && (
            <div className="absolute inset-x-0 bottom-[8%] z-[7] px-4 text-center">
              <span
                className="inline-block rounded-[3px] px-3 py-1.5"
                style={{
                  borderLeft: mood ? `3px solid ${mood === "action" ? "#ffb43c" : mood === "static" ? "#6fb1ff" : "#3bd6b0"}` : undefined,
                  fontSize: Math.max(11, frameW * 0.021),
                  fontFamily:
                    st.font === "display"
                      ? "var(--font-display)"
                      : st.font === "mono"
                        ? "var(--font-mono)"
                        : st.font === "serif"
                          ? "Georgia, 'Times New Roman', serif"
                          : "var(--font-sans)",
                  color: st.fg,
                  background: st.box ? st.bg : "transparent",
                  fontWeight: st.weight,
                  textTransform: st.upper ? "uppercase" : "none",
                  letterSpacing: st.font === "display" ? "0.05em" : "0.01em",
                  textShadow: st.outline
                    ? "-1px -1px 0 rgba(0,0,0,.9), 1px -1px 0 rgba(0,0,0,.9), -1px 1px 0 rgba(0,0,0,.9), 1px 1px 0 rgba(0,0,0,.9), 0 2px 8px rgba(0,0,0,.5)"
                    : undefined,
                }}
              >
                {caption.text}
              </span>
            </div>
          )}

          {/* hareketli grafik katmanları */}
          {state.layers.map((L) => {
            const p = layerPose(L, seqPos);
            if (!p.visible) return null;
            const isSel = state.selLayer === L.id;
            const fsPx = (L.size / 100) * frameW;
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
                  transform: `translate(calc(-50% + ${p.jx}px), calc(-50% + ${p.jy}px)) rotate(${p.rot}deg) scale(${p.scale / 100})`,
                  filter: p.blur > 0.2 ? `blur(${p.blur}px)` : undefined,
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
        </div>

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
          <span
            className="rounded-[3px] bg-amb/15 px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.12em] text-amb"
            title={`${state.frame.w}×${state.frame.h} px`}
          >
            ⬚ {state.frame.ratio}
          </span>
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
