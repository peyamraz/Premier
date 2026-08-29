import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
} from "react";
import {
  IMG,
  Icon,
  Reveal,
  fmtShort,
  fmtTC,
  rand,
  usePrefersReducedMotion,
  useScramble,
} from "../lib/ui";

const FPS = 24;
const DUR = 72.5; // seconds
const TF = DUR * FPS; // total frames

type Tone = "amb" | "teal" | "cue" | "rec";
type Clip = {
  id: string;
  name: string;
  start: number;
  dur: number;
  kind: "video" | "audio" | "gfx";
  tone: Tone;
};

const TRACKS: { id: string; type: "v" | "a"; clips: Clip[] }[] = [
  {
    id: "V2",
    type: "v",
    clips: [{ id: "gfx1", name: "title_card.mogrt", start: 2, dur: 5, kind: "gfx", tone: "teal" }],
  },
  {
    id: "V1",
    type: "v",
    clips: [
      { id: "c1", name: "clip_01.mp4", start: 0, dur: 28, kind: "video", tone: "amb" },
      { id: "c2", name: "clip_02.mp4", start: 28, dur: 19, kind: "video", tone: "amb" },
      { id: "c3", name: "drone_03.mp4", start: 47, dur: 13, kind: "video", tone: "amb" },
      { id: "c4", name: "outro.mov", start: 60, dur: 12.5, kind: "video", tone: "amb" },
    ],
  },
  {
    id: "A1",
    type: "a",
    clips: [{ id: "m1", name: "music.wav", start: 0, dur: 72.5, kind: "audio", tone: "cue" }],
  },
  {
    id: "A2",
    type: "a",
    clips: [
      { id: "v1", name: "vo_take2.wav", start: 30, dur: 26, kind: "audio", tone: "teal" },
      { id: "s1", name: "sfx_riser.wav", start: 46, dur: 3, kind: "audio", tone: "rec" },
    ],
  },
];

const TONE: Record<Tone, { bg: string; border: string; txt: string; wb: string }> = {
  amb: { bg: "rgba(255,180,60,.14)", border: "rgba(255,180,60,.5)", txt: "#ffd48a", wb: "#ffb43c" },
  teal: { bg: "rgba(59,214,176,.13)", border: "rgba(59,214,176,.45)", txt: "#8fe9d2", wb: "#3bd6b0" },
  cue: { bg: "rgba(111,177,255,.13)", border: "rgba(111,177,255,.45)", txt: "#a9cdff", wb: "#6fb1ff" },
  rec: { bg: "rgba(255,84,73,.14)", border: "rgba(255,84,73,.5)", txt: "#ffb0aa", wb: "#ff5449" },
};

const BIN: { id: string; name: string; meta: string; dur: string }[] = [
  { id: "c1", name: "clip_01.mp4", meta: "1080p • H.264", dur: "00:28" },
  { id: "c2", name: "clip_02.mp4", meta: "1080p • H.264", dur: "00:19" },
  { id: "c3", name: "drone_03.mp4", meta: "4K • HEVC", dur: "00:13" },
  { id: "c4", name: "outro.mov", meta: "1080p • ProRes", dur: "00:12" },
  { id: "gfx1", name: "title_card.mogrt", meta: "Motion GFX", dur: "00:05" },
  { id: "m1", name: "music.wav", meta: "48kHz • Stereo", dur: "01:12" },
  { id: "v1", name: "vo_take2.wav", meta: "48kHz • Mono", dur: "00:26" },
  { id: "s1", name: "sfx_riser.wav", meta: "48kHz • Stereo", dur: "00:03" },
];

const EFFECTS = [
  { name: "Lumetri Color", icon: "color" },
  { name: "Warp Stabilizer", icon: "fx" },
  { name: "Auto Reframe", icon: "image" },
  { name: "DeNoise", icon: "wave" },
  { name: "Ultra Key", icon: "bolt" },
];

const CAPS: { t0: number; t1: number; text: string }[] = [
  { t0: 6, t1: 11.5, text: "The sea was always part of the story." },
  { t0: 12.5, t1: 18, text: "We shot the vows at golden hour." },
  { t0: 20, t1: 26.5, text: "Two cameras, one drone, zero retakes." },
  { t0: 29, t1: 36, text: "Cutting it together took one night." },
  { t0: 40, t1: 47, text: "Color came from a single LUT pass." },
  { t0: 52, t1: 60, text: "The coast kept the secret for us." },
];

const ZOOMS = [1, 1.6, 2.6];

function WaveBars({ seed, color }: { seed: number; color: string }) {
  const bars = useMemo(
    () => Array.from({ length: 44 }, (_, i) => 16 + rand(i, seed) * 68),
    [seed],
  );
  return (
    <div className="pointer-events-none absolute inset-x-1.5 inset-y-2 flex items-end gap-[2px] opacity-75">
      {bars.map((h, i) => (
        <span
          key={i}
          className="min-w-0 flex-1 rounded-t-[1px]"
          style={{ height: `${h}%`, background: color }}
        />
      ))}
    </div>
  );
}

function VuMeter({ level, label }: { level: number; label: string }) {
  const segs = 12;
  return (
    <div className="flex flex-col items-center gap-[2px]">
      <div className="flex flex-col-reverse gap-[2px]">
        {Array.from({ length: segs }, (_, i) => {
          const on = level * segs > i;
          const col = i < 7 ? "bg-scope" : i < 10 ? "bg-amb" : "bg-rec";
          return (
            <span
              key={i}
              className={`vu-seg h-[3px] w-2.5 rounded-[1px] ${on ? col : "bg-panel2"}`}
              style={{ opacity: on ? 1 : 0.6 }}
            />
          );
        })}
      </div>
      <span className="font-mono text-[8px] text-dim">{label}</span>
    </div>
  );
}

export function Workspace() {
  const reduced = usePrefersReducedMotion();
  const eyebrow = useScramble("FF//2026.1 — NON-LINEAR EDITING SUITE");

  const [pos, setPos] = useState(0); // frames
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState<string>("c1");
  const [cc, setCc] = useState(false);
  const [safe, setSafe] = useState(false);
  const [inPt, setInPt] = useState<number | null>(null);
  const [outPt, setOutPt] = useState<number | null>(null);
  const [zi, setZi] = useState(0);
  const [vu, setVu] = useState({ l: 0, r: 0 });
  const [loaded, setLoaded] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => setLoaded(true), 80);
    return () => window.clearTimeout(t);
  }, []);

  /* playback engine */
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setPos((p) => Math.min(p + dt * FPS, TF));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    if (pos >= TF && playing) setPlaying(false);
  }, [pos, playing]);

  /* audio meters */
  useEffect(() => {
    if (reduced) {
      setVu(playing ? { l: 0.58, r: 0.44 } : { l: 0, r: 0 });
      return;
    }
    let raf = 0;
    const loop = () => {
      setVu((v) => {
        const j = () => Math.random() * 0.5 + 0.5;
        const tl = playing ? 0.22 + 0.55 * j() : 0;
        const tr = playing ? 0.18 + 0.5 * j() : 0;
        return { l: v.l + (tl - v.l) * 0.22, r: v.r + (tr - v.r) * 0.22 };
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, reduced]);

  /* follow playhead when zoomed */
  useEffect(() => {
    if (!playing || zi === 0) return;
    const c = scrollRef.current;
    const el = innerRef.current;
    if (!c || !el) return;
    const x = (pos / TF) * el.offsetWidth;
    if (x < c.scrollLeft + c.clientWidth * 0.25 || x > c.scrollLeft + c.clientWidth * 0.75) {
      c.scrollLeft = x - c.clientWidth * 0.35;
    }
  }, [pos, playing, zi]);

  const posFromClientX = (clientX: number) => {
    const el = areaRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * TF;
  };

  const onScrubDown = (e: RPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setPlaying(false);
    setPos(posFromClientX(e.clientX));
  };
  const onScrubMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (dragging.current) setPos(posFromClientX(e.clientX));
  };
  const onScrubUp = () => {
    dragging.current = false;
  };

  const selectClip = (id: string, jump: boolean) => {
    setSel(id);
    if (jump) {
      for (const tr of TRACKS) {
        const c = tr.clips.find((k) => k.id === id);
        if (c && tr.type === "v") {
          setPos(c.start * FPS);
          return;
        }
      }
    }
  };

  const selClip = useMemo(() => {
    for (const tr of TRACKS) {
      const c = tr.clips.find((k) => k.id === sel);
      if (c) return c;
    }
    return null;
  }, [sel]);

  const posSec = pos / FPS;
  const activeCap = cc ? CAPS.find((c) => posSec >= c.t0 && posSec <= c.t1) : undefined;
  const zoom = ZOOMS[zi];

  const seconds = useMemo(() => Array.from({ length: Math.ceil(DUR) + 1 }, (_, i) => i), []);

  const maskLine = (text: string, delay: number, cls = "") => (
    <span className="block overflow-hidden">
      <span
        className={`block transition-transform duration-700 ease-[cubic-bezier(.16,.84,.3,1)] ${
          loaded ? "translate-y-0" : "translate-y-[110%]"
        } ${cls}`}
        style={{ transitionDelay: `${delay}ms` }}
      >
        {text}
      </span>
    </span>
  );

  const tbtn =
    "flex h-8 w-8 items-center justify-center rounded-[3px] border border-line bg-panel text-mut transition-colors hover:border-amb/60 hover:text-amb";

  return (
    <section id="workspace" className="scroll-mt-14 pt-10 md:pt-14">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        {/* ------------------------------------------------ heading row */}
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <p className="mb-5 flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-amb">
              <span className="h-px w-8 bg-amb/60" />
              {eyebrow}
            </p>
            <h1 className="font-display text-[64px] leading-[0.9] tracking-[0.01em] sm:text-[88px] lg:text-[76px] xl:text-[92px]">
              {maskLine("FRAMEFORGE", 100)}
              {maskLine("PRO 2026", 240, "hollow")}
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-mut">
              The complete editing suite — AI-powered tools, 16-angle multicam,
              motion graphics and team projects — under a{" "}
              <em className="not-italic font-semibold text-ink">perpetual license</em>.
              Pay once, cut forever. No monthly fees, no watermark, no cloud
              leash.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#pricing"
                className="group inline-flex items-center gap-2.5 rounded-[3px] bg-amb px-5 py-3 text-[13px] font-bold uppercase tracking-wider text-bg0 transition-all hover:bg-amb2 hover:shadow-[0_8px_28px_rgba(255,180,60,.28)]"
              >
                <Icon name="play" className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
                Get Creator License
              </a>
              <a
                href="#ai"
                className="inline-flex items-center gap-2.5 rounded-[3px] border border-line2 px-5 py-3 text-[13px] font-semibold uppercase tracking-wider text-mut transition-colors hover:border-amb/60 hover:text-ink"
              >
                Watch the AI workflow
                <span className="text-amb">↓</span>
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {["MULTICAM ×16", "8K • 10-BIT • HDR", "RENDER −50%", "5 APPS / 1 LICENSE"].map(
                (s) => (
                  <span
                    key={s}
                    className="rounded-[3px] border border-line bg-panel/70 px-2.5 py-1 font-mono text-[10.5px] tracking-[0.14em] text-mut"
                  >
                    {s}
                  </span>
                ),
              )}
            </div>
          </div>

          {/* ------------------------------------------------ program monitor */}
          <div className="lg:col-span-7">
            <Reveal delay={150}>
              <div className="overflow-hidden rounded-[5px] border border-line2 bg-panel shadow-[0_30px_80px_rgba(0,0,0,.5)]">
                <div className="flex items-center gap-3 border-b border-line px-3 py-1.5">
                  <span className="font-mono text-[10px] tracking-[0.2em] text-dim">
                    PROGRAM MONITOR
                  </span>
                  <span className="font-mono text-[10px] text-mut">wedding_vlog.prproj</span>
                  <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-scope">
                    <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-scope" />
                    AUTOSAVED 12s AGO
                  </span>
                </div>

                <div className="scanlines vignette relative aspect-video overflow-hidden bg-black">
                  <img
                    src={IMG}
                    alt="Program preview — golden-hour wedding scene from the wedding_vlog sequence"
                    className={`absolute inset-0 h-full w-full object-cover ${playing && !reduced ? "kb" : ""}`}
                  />

                  {safe && (
                    <>
                      <div className="pointer-events-none absolute inset-[5%] z-[5] border border-dashed border-scope/40" />
                      <div className="pointer-events-none absolute inset-[12.5%] z-[5] border border-dashed border-amb/40" />
                    </>
                  )}

                  <div className="absolute left-3 top-3 z-[7] flex items-center gap-2">
                    <span className="rounded-[3px] bg-black/60 px-2 py-1 font-mono text-[10px] tracking-[0.18em] text-ink">
                      PGM ▸ SEQ 01
                    </span>
                    {playing && (
                      <span className="blink flex items-center gap-1 rounded-[3px] bg-black/60 px-2 py-1 font-mono text-[10px] tracking-[0.18em] text-rec">
                        ● REC
                      </span>
                    )}
                  </div>

                  <div className="absolute right-3 top-3 z-[7] flex gap-1.5">
                    <button
                      onClick={() => setSafe((s) => !s)}
                      className={`rounded-[3px] px-2 py-1 font-mono text-[10px] tracking-wider transition-colors ${
                        safe
                          ? "bg-scope/90 text-bg0"
                          : "bg-black/60 text-mut hover:text-ink"
                      }`}
                    >
                      SAFE
                    </button>
                    <button
                      onClick={() => setCc((c) => !c)}
                      className={`rounded-[3px] px-2 py-1 font-mono text-[10px] tracking-wider transition-colors ${
                        cc ? "bg-amb text-bg0" : "bg-black/60 text-mut hover:text-ink"
                      }`}
                    >
                      CC
                    </button>
                  </div>

                  {activeCap && (
                    <div className="absolute inset-x-0 bottom-9 z-[7] text-center">
                      <span className="rounded-[3px] bg-black/75 px-3 py-1.5 text-[13px] font-medium text-ink">
                        {activeCap.text}
                      </span>
                    </div>
                  )}

                  {!playing && posSec < 0.5 && (
                    <button
                      onClick={() => setPlaying(true)}
                      aria-label="Play sequence"
                      className="absolute inset-0 z-[7] flex items-center justify-center bg-black/25 transition-colors hover:bg-black/15"
                    >
                      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-amb/70 bg-black/55 text-amb transition-transform hover:scale-110">
                        <Icon name="play" className="ml-1 h-6 w-6" />
                      </span>
                    </button>
                  )}

                  <div className="absolute inset-x-0 bottom-0 z-[7] flex items-end justify-between gap-4 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-8">
                    <span className="font-mono text-sm tabular-nums tracking-[0.12em] text-amb [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
                      {fmtTC(pos)}
                    </span>
                    <div className="flex items-end gap-1.5 pb-0.5">
                      <VuMeter level={vu.l} label="L" />
                      <VuMeter level={vu.r} label="R" />
                    </div>
                  </div>
                </div>

                {/* transport bar */}
                <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
                  <button className={tbtn} aria-label="Go to start" onClick={() => { setPos(0); setPlaying(false); }}>
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                      <path d="M7 5h2.2v14H7zM19 5.5v13l-8.5-6.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setPlaying((p) => !p)}
                    aria-label={playing ? "Pause" : "Play"}
                    className="flex h-8 w-10 items-center justify-center rounded-[3px] bg-amb text-bg0 transition-colors hover:bg-amb2"
                  >
                    <Icon name={playing ? "pause" : "play"} className="h-3.5 w-3.5" />
                  </button>
                  <button className={tbtn} aria-label="Go to end" onClick={() => { setPos(TF); setPlaying(false); }}>
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                      <path d="M14.8 5H17v14h-2.2zM5 5.5v13l8.5-6.5z" />
                    </svg>
                  </button>
                  <span className="mx-1 hidden font-mono text-[11px] tabular-nums text-mut sm:block">
                    {fmtTC(pos)} <span className="text-dim">/ {fmtTC(TF)}</span>
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      onClick={() => setInPt(posSec)}
                      className="rounded-[3px] border border-line px-2 py-1 font-mono text-[10.5px] text-mut transition-colors hover:border-amb/60 hover:text-amb"
                    >
                      IN&nbsp;I
                    </button>
                    <button
                      onClick={() => setOutPt(posSec)}
                      className="rounded-[3px] border border-line px-2 py-1 font-mono text-[10.5px] text-mut transition-colors hover:border-amb/60 hover:text-amb"
                    >
                      OUT&nbsp;O
                    </button>
                    {(inPt !== null || outPt !== null) && (
                      <button
                        onClick={() => { setInPt(null); setOutPt(null); }}
                        className="rounded-[3px] px-1.5 py-1 font-mono text-[10.5px] text-dim transition-colors hover:text-rec"
                      >
                        ✕
                      </button>
                    )}
                    <span className="mx-1 h-5 w-px bg-line" />
                    <button
                      onClick={() => setZi((z) => Math.max(0, z - 1))}
                      disabled={zi === 0}
                      className="rounded-[3px] border border-line px-2 py-1 font-mono text-[10.5px] text-mut transition-colors hover:text-amb disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="font-mono text-[10.5px] text-dim">{Math.round(zoom * 100)}%</span>
                    <button
                      onClick={() => setZi((z) => Math.min(ZOOMS.length - 1, z + 1))}
                      disabled={zi === ZOOMS.length - 1}
                      className="rounded-[3px] border border-line px-2 py-1 font-mono text-[10.5px] text-mut transition-colors hover:text-amb disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* timeline */}
                <div ref={scrollRef} className="overflow-x-auto border-t border-line bg-bg1">
                  <div
                    ref={innerRef}
                    className="relative min-w-full select-none"
                    style={{ width: `${zoom * 100}%` }}
                    onPointerDown={onScrubDown}
                    onPointerMove={onScrubMove}
                    onPointerUp={onScrubUp}
                    onPointerCancel={onScrubUp}
                  >
                    {/* ruler */}
                    <div className="flex h-6 border-b border-line bg-panel">
                      <div className="sticky left-0 z-10 w-10 shrink-0 border-r border-line" />
                      <div className="relative flex-1">
                        {seconds.map((s) => (
                          <div key={s} className="absolute top-0 h-full" style={{ left: `${(s / DUR) * 100}%` }}>
                            <span className={`block w-px ${s % 5 === 0 ? "h-full bg-line2" : "h-2 bg-line"}`} />
                            {s % 5 === 0 && s < DUR && (
                              <span className="absolute left-1 top-0.5 font-mono text-[9px] tabular-nums text-dim">
                                {fmtShort(s)}
                              </span>
                            )}
                          </div>
                        ))}
                        {inPt !== null && (
                          <span className="absolute top-0 h-full w-[3px] bg-scope" style={{ left: `${(inPt / DUR) * 100}%` }} />
                        )}
                        {outPt !== null && (
                          <span className="absolute top-0 h-full w-[3px] bg-rec" style={{ left: `${(outPt / DUR) * 100}%` }} />
                        )}
                      </div>
                    </div>

                    {TRACKS.map((tr) => (
                      <div key={tr.id} className="flex h-11 cursor-ew-resize border-b border-line/60">
                        <div className="sticky left-0 z-10 flex w-10 shrink-0 items-center justify-center border-r border-line bg-panel font-mono text-[10px] font-semibold text-mut">
                          {tr.id}
                        </div>
                        <div className="relative flex-1">
                          {tr.clips.map((c) => {
                            const t = TONE[c.tone];
                            return (
                              <button
                                key={c.id}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => selectClip(c.id, tr.type === "v")}
                                className={`clip absolute bottom-1 top-1 overflow-hidden rounded-[3px] border text-left ${sel === c.id ? "sel" : ""}`}
                                style={{
                                  left: `${(c.start / DUR) * 100}%`,
                                  width: `${(c.dur / DUR) * 100}%`,
                                  background: t.bg,
                                  borderColor: t.border,
                                  ...({ "--wb": t.wb } as CSSProperties),
                                }}
                              >
                                {c.kind === "audio" ? (
                                  <WaveBars seed={c.id.length * 7 + c.start} color={`var(--wb)`} />
                                ) : (
                                  <span className="absolute inset-x-0 top-0 flex h-full flex-col justify-between p-1">
                                    {c.kind === "gfx" ? (
                                      <span className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-wider" style={{ color: t.txt }}>
                                        <Icon name="fx" className="h-2.5 w-2.5" /> GFX
                                      </span>
                                    ) : (
                                      <span className="flex gap-[3px] pt-0.5">
                                        {Array.from({ length: 6 }, (_, i) => (
                                          <span key={i} className="h-1 w-1 rounded-[1px]" style={{ background: t.border }} />
                                        ))}
                                      </span>
                                    )}
                                    <span className="truncate font-mono text-[9px] leading-none" style={{ color: t.txt }}>
                                      {c.name}
                                    </span>
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* playhead + in/out region, aligned to the track area */}
                    <div
                      ref={areaRef}
                      className="pointer-events-none absolute bottom-0 left-10 right-0 top-6"
                    >
                      {inPt !== null && outPt !== null && outPt > inPt && (
                        <div
                          className="absolute bottom-0 top-0 bg-amb/8"
                          style={{ left: `${(inPt / DUR) * 100}%`, width: `${((outPt - inPt) / DUR) * 100}%` }}
                        />
                      )}
                      <div
                        className="absolute bottom-0 top-0"
                        style={{ left: `${(pos / TF) * 100}%` }}
                      >
                        <span className="absolute -left-[5px] top-0 h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-amb" />
                        <span className="absolute -left-px top-0 h-full w-[2px] bg-amb shadow-[0_0_8px_rgba(255,180,60,.7)]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* status strip */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-3 py-1.5 font-mono text-[10px] tracking-wider text-dim">
                  <span>
                    SEL: <span className="text-amb">{selClip?.name ?? "—"}</span>
                  </span>
                  <span className="hidden sm:inline">
                    IN {inPt !== null ? fmtShort(inPt) : "--:--"} / OUT {outPt !== null ? fmtShort(outPt) : "--:--"}
                  </span>
                  <span className="ml-auto hidden md:inline">1920×1080 • 23.976fps • H.264</span>
                </div>
              </div>
            </Reveal>

            {/* project + effects bins */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Reveal delay={220}>
                <div className="h-44 overflow-hidden rounded-[5px] border border-line bg-panel">
                  <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-dim">PROJECT: wedding_vlog</span>
                    <span className="font-mono text-[10px] text-dim">{BIN.length} items</span>
                  </div>
                  <ul className="max-h-[132px] overflow-y-auto py-1">
                    {BIN.map((b) => (
                      <li key={b.id}>
                        <button
                          onClick={() => selectClip(b.id, true)}
                          className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-[5px] text-left transition-colors ${
                            sel === b.id
                              ? "border-amb bg-panel2 text-ink"
                              : "border-transparent text-mut hover:bg-panel2/60 hover:text-ink"
                          }`}
                        >
                          <Icon
                            name={b.name.endsWith(".wav") ? "music" : b.name.endsWith(".mogrt") ? "fx" : "film"}
                            className={`h-3.5 w-3.5 shrink-0 ${sel === b.id ? "text-amb" : "text-dim"}`}
                          />
                          <span className="truncate font-mono text-[11px]">{b.name}</span>
                          <span className="ml-auto shrink-0 font-mono text-[9.5px] text-dim">{b.dur}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={300}>
                <div className="h-44 overflow-hidden rounded-[5px] border border-line bg-panel">
                  <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-dim">EFFECTS</span>
                    <span className="font-mono text-[10px] text-dim">hover to preview</span>
                  </div>
                  <ul className="py-1">
                    {EFFECTS.map((fx) => (
                      <li key={fx.name}>
                        <span className="flex cursor-default items-center gap-2.5 px-3 py-[5px] text-mut transition-all hover:translate-x-1 hover:bg-panel2/60 hover:text-ink">
                          <Icon name={fx.icon} className="h-3.5 w-3.5 text-dim" />
                          <span className="font-mono text-[11px]">{fx.name}</span>
                          <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-dim">fx</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
