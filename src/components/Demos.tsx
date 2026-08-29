import { useEffect, useMemo, useRef, useState } from "react";
import { IMG, Icon, Reveal, SectionHead, rand, usePrefersReducedMotion } from "../lib/ui";

/* ================================================================== */
/* 1 · TEXT-BASED EDITING                                              */
/* ================================================================== */

const TRANSCRIPT =
  "I grew up on the coast, so the sea was always — always — part of the story. When we cut the drone pass over the cliffs, um, the whole opening finally made sense.";

function TextBasedDemo() {
  const words = useMemo(() => TRANSCRIPT.split(" "), []);
  const [cut, setCut] = useState<Set<number>>(() => new Set([12, 27]));
  const [removed, setRemoved] = useState<Set<number>>(new Set());

  const toggle = (i: number) =>
    setCut((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const removeSelected = () => setRemoved((r) => new Set([...r, ...cut]));
  const reset = () => {
    setRemoved(new Set());
    setCut(new Set([12, 27]));
  };

  return (
    <DemoCard
      tag="FORGE AI"
      title="Text-Based Editing"
      blurb="The transcript is the timeline. Strike filler words and dead takes — the video cuts itself."
    >
      <p className="text-[15px] leading-[1.9] text-mut">
        {words.map((w, i) =>
          removed.has(i) ? null : (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`mx-[2px] rounded-[2px] px-[1px] transition-all hover:bg-panel2 ${
                cut.has(i) ? "word-cut" : "hover:text-ink"
              }`}
            >
              {w}
            </button>
          ),
        )}
      </p>
      <div className="mt-4 flex items-center gap-2.5">
        <button
          onClick={removeSelected}
          disabled={cut.size === 0}
          className="rounded-[3px] bg-rec/90 px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg0 transition-all hover:bg-rec disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Icon name="scissors" className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />
          Remove selected ({cut.size})
        </button>
        <button
          onClick={reset}
          className="rounded-[3px] border border-line px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-mut transition-colors hover:border-amb/60 hover:text-amb"
        >
          Restore
        </button>
        <span className="ml-auto hidden font-mono text-[10px] text-dim sm:block">
          click words to mark
        </span>
      </div>
    </DemoCard>
  );
}

/* ================================================================== */
/* 2 · SPEECH-TO-TEXT CAPTIONS                                         */
/* ================================================================== */

const CAP_LINES = [
  "The sea was always part of the story.",
  "We cut the drone pass over the cliffs,",
  "and the opening finally made sense.",
];

function CaptionDemo() {
  const [line, setLine] = useState(0);
  const [count, setCount] = useState(0);
  const [run, setRun] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!run) return;
    const words = CAP_LINES[line].split(" ");
    if (count >= words.length) {
      timer.current = window.setTimeout(() => {
        setCount(0);
        setLine((l) => {
          if (l >= CAP_LINES.length - 1) {
            setRun(false);
            return l;
          }
          return l + 1;
        });
      }, 700);
      return () => {
        if (timer.current) window.clearTimeout(timer.current);
      };
    }
    timer.current = window.setTimeout(() => setCount((c) => c + 1), 240);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [run, line, count]);

  const start = () => {
    setLine(0);
    setCount(1);
    setRun(true);
  };

  const words = CAP_LINES[line].split(" ");
  const done = !run && line === CAP_LINES.length - 1 && count >= words.length;

  return (
    <DemoCard
      tag="FORGE AI"
      title="Speech to Text"
      blurb="Broadcast-accurate captions in 14 languages, generated on-device while you scrub."
    >
      <div className="scanlines relative aspect-[16/7] overflow-hidden rounded-[4px] border border-line bg-black">
        <img
          src={IMG}
          alt="Interview still used for the captioning demo"
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-x-0 bottom-3 z-[3] px-4 text-center">
          <span className="inline-block rounded-[3px] bg-black/80 px-3 py-1.5 font-mono text-[12.5px] text-ink">
            {words.slice(0, Math.min(count, words.length)).join(" ")}
            {run && <span className="blink text-amb">▌</span>}
          </span>
        </div>
        <span className="absolute left-2.5 top-2.5 z-[3] rounded-[3px] bg-black/60 px-2 py-0.5 font-mono text-[9.5px] tracking-[0.2em] text-scope">
          EN-US • 99.1% CONF
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={start}
          className="flex h-9 items-center gap-2 rounded-[3px] bg-amb px-4 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg0 transition-colors hover:bg-amb2"
        >
          <Icon name={run ? "pause" : "play"} className="h-3 w-3" />
          {run ? "Transcribing…" : done ? "Run again" : "Transcribe"}
        </button>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-panel2">
          <div
            className="h-full rounded-full bg-scope transition-all duration-300"
            style={{ width: `${((line + Math.min(count / words.length, 1)) / CAP_LINES.length) * 100}%` }}
          />
        </div>
        <span className="font-mono text-[10px] tabular-nums text-dim">
          {line + 1}/{CAP_LINES.length}
        </span>
      </div>
    </DemoCard>
  );
}

/* ================================================================== */
/* 3 · AUTO COLOR                                                      */
/* ================================================================== */

const GRADES = [
  { id: "teal", label: "Teal & Orange", filter: "contrast(1.16) saturate(1.38) brightness(1.02)", tint: "linear-gradient(180deg,rgba(255,140,40,.22),rgba(20,90,110,.28))" },
  { id: "noir", label: "Noir", filter: "grayscale(1) contrast(1.32) brightness(0.94)", tint: "linear-gradient(180deg,rgba(255,255,255,.05),rgba(0,0,0,.3))" },
  { id: "gold", label: "Golden Hour", filter: "sepia(0.34) saturate(1.45) contrast(1.12)", tint: "linear-gradient(180deg,rgba(255,180,60,.2),rgba(120,40,10,.2))" },
] as const;

function ColorDemo() {
  const [x, setX] = useState(58);
  const [g, setG] = useState<(typeof GRADES)[number]>(GRADES[0]);
  return (
    <DemoCard
      tag="LUMETRI 2.0"
      title="One-Click Auto Color"
      blurb="Grades trained on 40,000 professionally graded scenes. Drag to compare against the flat pass."
    >
      <div className="relative aspect-[16/8] overflow-hidden rounded-[4px] border border-line bg-black">
        <img
          src={IMG}
          alt="Flat log pass of the wedding scene"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: "saturate(0.72) contrast(0.88)" }}
        />
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - x}% 0 0)` }}
        >
          <img
            src={IMG}
            alt="Auto-graded version of the wedding scene"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: g.filter }}
          />
          <div className="absolute inset-0 mix-blend-overlay" style={{ background: g.tint }} />
        </div>
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-[3] w-[2px] bg-amb shadow-[0_0_10px_rgba(255,180,60,.8)]"
          style={{ left: `${x}%` }}
        >
          <span className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amb bg-bg0/90 font-mono text-[10px] text-amb">
            ⇄
          </span>
        </div>
        <span className="absolute left-2.5 top-2.5 z-[3] rounded-[3px] bg-black/60 px-2 py-0.5 font-mono text-[9.5px] tracking-[0.2em] text-amb">
          FORGE GRADE
        </span>
        <span className="absolute right-2.5 top-2.5 z-[3] rounded-[3px] bg-black/60 px-2 py-0.5 font-mono text-[9.5px] tracking-[0.2em] text-mut">
          FLAT LOG
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={x}
          onChange={(e) => setX(Number(e.target.value))}
          className="grade-range"
          aria-label="Grade compare position"
        />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {GRADES.map((gr) => (
          <button
            key={gr.id}
            onClick={() => setG(gr)}
            className={`rounded-[3px] border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-wider transition-colors ${
              g.id === gr.id
                ? "border-amb bg-amb/15 text-amb"
                : "border-line text-mut hover:border-line2 hover:text-ink"
            }`}
          >
            {gr.label}
          </button>
        ))}
      </div>
    </DemoCard>
  );
}

/* ================================================================== */
/* 4 · AUDIO CLEANUP                                                   */
/* ================================================================== */

function AudioDemo() {
  const reduced = usePrefersReducedMotion();
  const [clean, setClean] = useState(false);
  const bars = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => {
        const env = 22 + Math.sin(i / 5.2) * 14 + rand(i, 3) * 20;
        const noisy = Math.min(96, env + rand(i, 9) * 52);
        return { clean: env, noisy };
      }),
    [],
  );
  return (
    <DemoCard
      tag="FORGE AI"
      title="Audio Cleanup"
      blurb="Neural denoise lifts dialogue out of wind, traffic and room hum — without the robot voice."
    >
      <div className="relative h-32 overflow-hidden rounded-[4px] border border-line bg-bg0">
        <div className="absolute inset-x-0 flex h-full items-end gap-[3px] px-3 pb-3">
          {bars.map((b, i) => (
            <span
              key={i}
              className="min-w-0 flex-1 rounded-t-[1px] transition-all duration-500 ease-out"
              style={{
                height: `${(clean ? b.clean : b.noisy) * (reduced ? 1 : 1)}%`,
                background: clean
                  ? "linear-gradient(180deg,#3bd6b0,#1f7a66)"
                  : "linear-gradient(180deg,#ff5449,#7a2823)",
              }}
            />
          ))}
        </div>
        <div
          className="absolute inset-x-0 border-t border-dashed transition-all duration-500"
          style={{ bottom: clean ? "12%" : "34%", borderColor: clean ? "rgba(59,214,176,.5)" : "rgba(255,84,73,.5)" }}
        >
          <span
            className={`absolute right-2 -top-4 font-mono text-[9px] tracking-wider ${clean ? "text-scope" : "text-rec"}`}
          >
            NOISE FLOOR {clean ? "−54 dB" : "−18 dB"}
          </span>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => setClean((c) => !c)}
          role="switch"
          aria-checked={clean}
          className={`relative h-6 w-12 rounded-full border transition-colors ${
            clean ? "border-scope bg-scope/25" : "border-line2 bg-panel2"
          }`}
        >
          <span
            className={`absolute top-[3px] h-4 w-4 rounded-full transition-all ${
              clean ? "left-[26px] bg-scope" : "left-[4px] bg-dim"
            }`}
          />
        </button>
        <span className="font-mono text-[11px] uppercase tracking-wider text-mut">
          Neural DeNoise {clean ? "engaged" : "bypassed"}
        </span>
        <span
          className={`ml-auto rounded-[3px] px-2 py-1 font-mono text-[10px] tracking-wider transition-colors ${
            clean ? "bg-scope/15 text-scope" : "bg-rec/15 text-rec"
          }`}
        >
          {clean ? "DIALOGUE ISOLATED" : "ROOM HUM DETECTED"}
        </span>
      </div>
    </DemoCard>
  );
}

/* ================================================================== */
/* shared demo card shell                                              */
/* ================================================================== */

function DemoCard({
  tag,
  title,
  blurb,
  children,
}: {
  tag: string;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group rounded-[5px] border border-line bg-panel p-5 transition-all duration-300 hover:-translate-y-1 hover:border-line2 hover:shadow-[0_18px_50px_rgba(0,0,0,.45)] sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="rounded-[3px] bg-amb/12 px-2 py-1 font-mono text-[9.5px] font-semibold tracking-[0.22em] text-amb">
          {tag}
        </span>
        <h3 className="font-display text-2xl tracking-wide text-ink">{title}</h3>
      </div>
      <p className="mb-5 text-[13.5px] leading-relaxed text-mut">{blurb}</p>
      {children}
    </div>
  );
}

/* ================================================================== */
/* AI section with sticky rail                                         */
/* ================================================================== */

const AI_TOOLS = [
  { icon: "image", name: "Auto Reframe", note: "social crops, subject-locked" },
  { icon: "scissors", name: "Scene Edit Detection", note: "rebuild timelines from cuts" },
  { icon: "captions", name: "Speech to Text", note: "14 languages, on-device" },
  { icon: "color", name: "Auto Color 2.0", note: "one-click cinematic grades" },
  { icon: "wave", name: "Audio Cleanup", note: "neural denoise + de-ess" },
  { icon: "razor", name: "Smart Trim", note: "silence & filler removal" },
];

export function Demos() {
  return (
    <section id="ai" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <SectionHead no="02" kicker="Forge AI engine" title={<>AI THAT CUTS <span className="text-amb">WITH YOU</span></>} />
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <p className="text-[15px] leading-relaxed text-mut">
                Every model runs <span className="font-semibold text-ink">on your GPU</span> —
                footage never leaves the machine. Four tools you can try right
                here, right now.
              </p>
              <ul className="mt-7 space-y-1">
                {AI_TOOLS.map((t, i) => (
                  <Reveal key={t.name} delay={i * 70}>
                    <li className="group flex items-center gap-3.5 rounded-[4px] border border-transparent px-3 py-2.5 transition-all hover:border-line hover:bg-panel">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-line bg-panel2 text-dim transition-colors group-hover:border-amb/50 group-hover:text-amb">
                        <Icon name={t.icon} className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-[13.5px] font-semibold text-ink">{t.name}</span>
                        <span className="block font-mono text-[10.5px] text-dim">{t.note}</span>
                      </span>
                    </li>
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
          <div className="space-y-6 lg:col-span-8">
            <Reveal><TextBasedDemo /></Reveal>
            <Reveal delay={80}><ColorDemo /></Reveal>
            <div className="grid gap-6 xl:grid-cols-2">
              <Reveal delay={120}><CaptionDemo /></Reveal>
              <Reveal delay={180}><AudioDemo /></Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* MULTICAM + PRO SPEC SHEET                                           */
/* ================================================================== */

const ANGLES = [
  { id: "A", label: "CAM A — WIDE", style: { filter: "none" } },
  { id: "B", label: "CAM B — TELE", style: { filter: "sepia(0.22) saturate(1.18) contrast(1.05)" } },
  { id: "C", label: "CAM C — DRONE", style: { filter: "saturate(0.92) hue-rotate(-12deg) brightness(1.06)" } },
  { id: "D", label: "CAM D — B&W", style: { filter: "grayscale(1) contrast(1.25)" } },
];

const PRO_SPECS = [
  { icon: "camera", text: "Multi-cam editing — up to 16 angles, audio-synced" },
  { icon: "vr", text: "360° / VR headsets & ambisonic monitoring" },
  { icon: "film", text: "8K / 10-bit / HEVC native decode" },
  { icon: "color", text: "Lumetri-style HDR & HLG color pipeline" },
  { icon: "bolt", text: "GPU-accelerated Mercury render engine" },
  { icon: "encode", text: "Proxy workflows with one-key toggle" },
  { icon: "fx", text: "Essential Graphics + 1000 MOGRT templates" },
  { icon: "person", text: "Dynamic link to FuseFX compositions" },
  { icon: "wave", text: "Essential Sound + 5.1 surround mixing" },
  { icon: "collab", text: "Real-time Team Projects, 8 editors live" },
];

export function Multicam() {
  const [active, setActive] = useState(0);
  const cam = ANGLES[active];
  return (
    <section id="multicam" className="scroll-mt-24 border-t border-line bg-bg1/60 py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <SectionHead no="03" kicker="Multi-cam & pro pipeline" title={<>SIXTEEN ANGLES. <span className="text-amb">ONE CUT.</span></>} />

        <div className="grid gap-6 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <div className="grid h-full grid-cols-2 gap-3">
              {ANGLES.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setActive(i)}
                  className={`group relative aspect-video overflow-hidden rounded-[4px] border-2 text-left transition-all ${
                    i === active
                      ? "border-rec shadow-[0_0_0_1px_rgba(255,84,73,.4),0_10px_30px_rgba(0,0,0,.4)]"
                      : "border-line opacity-70 hover:opacity-100 hover:border-line2"
                  }`}
                  aria-label={`Cut to ${a.label}`}
                >
                  <img src={IMG} alt={a.label} className="absolute inset-0 h-full w-full object-cover" style={a.style} />
                  <span className="absolute left-1.5 top-1.5 rounded-[2px] bg-black/65 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-ink">
                    {a.label}
                  </span>
                  {i === active && (
                    <span className="blink absolute right-1.5 top-1.5 rounded-[2px] bg-rec px-1.5 py-0.5 font-mono text-[9px] font-bold text-bg0">
                      PGM
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120} className="lg:col-span-7">
            <div className="flex h-full flex-col overflow-hidden rounded-[5px] border border-line2 bg-panel">
              <div className="relative aspect-video overflow-hidden bg-black">
                <img
                  key={cam.id}
                  src={IMG}
                  alt={`Program output — ${cam.label}`}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={cam.style}
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-8">
                  <span className="font-mono text-[11px] tracking-[0.18em] text-amb">
                    MULTICAM ▸ {cam.label}
                  </span>
                  <span className="font-mono text-[10px] text-dim">SYNC: AUDIO WAVEFORM</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 px-4 py-3">
                <button
                  onClick={() => setActive((a) => (a + 1) % ANGLES.length)}
                  className="rounded-[3px] bg-amb px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg0 transition-colors hover:bg-amb2"
                >
                  Cut to next angle ▸
                </button>
                <span className="font-mono text-[10.5px] text-dim">
                  cut edits land on the timeline as live switches
                </span>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={150}>
          <div className="mt-6 rounded-[5px] border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line px-4 py-2">
              <span className="font-mono text-[10px] tracking-[0.24em] text-dim">PRO SPEC SHEET</span>
              <span className="font-mono text-[10px] text-dim">v2026.1</span>
            </div>
            <ul className="grid gap-x-8 gap-y-1 p-4 sm:grid-cols-2">
              {PRO_SPECS.map((s) => (
                <li key={s.text} className="flex items-center gap-3 rounded-[3px] px-2 py-2 transition-colors hover:bg-panel2">
                  <Icon name={s.icon} className="h-4 w-4 shrink-0 text-amb" />
                  <span className="text-[13px] text-mut">{s.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
