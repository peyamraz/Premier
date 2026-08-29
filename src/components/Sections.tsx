import { useState } from "react";
import { Icon, Reveal, SectionHead, useReveal } from "../lib/ui";

/* ================================================================== */
/* 04 · THE SUITE                                                      */
/* ================================================================== */

const MINI_APPS = [
  {
    icon: "fx",
    name: "FuseFX",
    role: "Motion & compositing",
    desc: "Layered composites, keying and particle work — linked live to your timeline.",
    tone: "text-amb",
  },
  {
    icon: "wave",
    name: "WaveRoom",
    role: "Audio workstation",
    desc: "Spectral repair, loudness matching and podcast tooling with round-trip edits.",
    tone: "text-scope",
  },
  {
    icon: "encode",
    name: "RenderLine",
    role: "Batch export",
    desc: "Queue exports in the background. Watch folders, presets and HDR aware.",
    tone: "text-cue",
  },
  {
    icon: "person",
    name: "Puppeteer",
    role: "Character animation",
    desc: "Drive rigged characters from your webcam and voice in real time.",
    tone: "text-rec",
  },
];

const BONUS = [
  { icon: "fx", label: "500+ transitions" },
  { icon: "bolt", label: "200+ video effects" },
  { icon: "image", label: "1000+ motion templates" },
  { icon: "color", label: "50+ cinematic LUTs" },
  { icon: "music", label: "50 royalty-free tracks" },
  { icon: "wave", label: "SFX library (2.4 GB)" },
];

function Suite() {
  return (
    <section id="suite" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <SectionHead no="04" kicker="Creative suite, one installer" title={<>ONE LICENSE. <span className="text-amb">THE WHOLE ROOM.</span></>} />
        <div className="grid gap-5 lg:grid-cols-12">
          <Reveal className="lg:col-span-6">
            <div className="group relative flex h-full flex-col overflow-hidden rounded-[5px] border border-amb/35 bg-panel p-7 transition-all duration-300 hover:border-amb/70 hover:shadow-[0_20px_60px_rgba(255,180,60,.1)]">
              <span className="absolute right-0 top-0 bg-amb px-2.5 py-1 font-mono text-[9.5px] font-bold tracking-[0.2em] text-bg0">
                FULL VERSION
              </span>
              <span className="flex h-12 w-12 items-center justify-center rounded-[4px] border border-amb/40 bg-amb/10 text-amb">
                <Icon name="film" className="h-6 w-6" />
              </span>
              <h3 className="mt-5 font-display text-4xl tracking-wide text-ink">
                FRAMEFORGE <span className="text-amb">PRO 2026</span>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-mut">
                The editor itself. Text-based timeline, Mercury GPU engine, HDR
                scopes and every format the industry throws at you.
              </p>
              {/* decorative mini timeline */}
              <div className="mt-6 space-y-1.5 rounded-[4px] border border-line bg-bg0 p-3">
                {[
                  ["V2", "w-1/4 bg-scope/40 ml-[8%]"],
                  ["V1", "w-[38%] bg-amb/50"],
                  ["V1", "w-[30%] bg-amb/35 ml-[40%]"],
                  ["A1", "w-[84%] bg-cue/35"],
                ].map(([t, w], i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 font-mono text-[8.5px] text-dim">{t}</span>
                    <div className="h-2.5 flex-1 rounded-[2px] bg-panel2">
                      <div className={`h-full rounded-[2px] ${w} transition-transform duration-300 group-hover:translate-x-1`} />
                    </div>
                  </div>
                ))}
              </div>
              <ul className="mt-6 grid gap-x-6 gap-y-1.5 text-[13px] text-mut sm:grid-cols-2">
                {["8K native decode", "Text-based editing", "16-angle multicam", "Team Projects live", "No watermark, ever", "Offline activation"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-scope" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <div className="grid content-start gap-5 sm:grid-cols-2 lg:col-span-6">
            {MINI_APPS.map((a, i) => (
              <Reveal key={a.name} delay={i * 90}>
                <div className="group h-full rounded-[5px] border border-line bg-panel p-5 transition-all duration-300 hover:-translate-y-1 hover:border-line2 hover:bg-panel2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[4px] border border-line bg-bg0">
                    <span className={a.tone}><Icon name={a.icon} className="h-5 w-5" /></span>
                  </span>
                  <h4 className="mt-4 font-display text-2xl tracking-wide text-ink">{a.name}</h4>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dim">{a.role}</p>
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-mut">{a.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={120}>
          <div className="mt-5 rounded-[5px] border border-line bg-panel px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <span className="font-mono text-[10px] tracking-[0.24em] text-dim">
                BONUS RESOURCES ▸
              </span>
              {BONUS.map((b) => (
                <span key={b.label} className="flex items-center gap-2 text-[12.5px] text-mut transition-colors hover:text-amb">
                  <Icon name={b.icon} className="h-3.5 w-3.5 text-amb" />
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================== */
/* 05 · SHORTCUTS                                                      */
/* ================================================================== */

type ShortcutGroup = { title: string; icon: string; items: { keys: string[]; action: string }[] };

const SHORTCUTS: ShortcutGroup[] = [
  {
    title: "Cutting & Trimming",
    icon: "razor",
    items: [
      { keys: ["C"], action: "Razor tool — cut clip at cursor" },
      { keys: ["Ctrl", "K"], action: "Add edit (cut) at playhead" },
      { keys: ["Q", "/", "W"], action: "Ripple trim previous / next" },
      { keys: ["[", "]"], action: "Trim in / out points" },
    ],
  },
  {
    title: "Navigation",
    icon: "camera",
    items: [
      { keys: ["Space"], action: "Play / stop" },
      { keys: ["←", "→"], action: "Step one frame" },
      { keys: ["Shift", "←/→"], action: "Step five frames" },
      { keys: ["I", "/", "O"], action: "Set in / out points" },
    ],
  },
  {
    title: "Timeline",
    icon: "film",
    items: [
      { keys: ["V"], action: "Selection tool" },
      { keys: ["A"], action: "Track select forward" },
      { keys: ["Shift", "Del"], action: "Ripple delete (close gap)" },
      { keys: ["Ctrl", "Shift", "D"], action: "Apply default transition" },
    ],
  },
  {
    title: "Export",
    icon: "encode",
    items: [
      { keys: ["Ctrl", "M"], action: "Send to RenderLine queue" },
      { keys: ["Ctrl", "E"], action: "Export settings panel" },
    ],
  },
];

function Shortcuts() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (s: string) => {
    try {
      void navigator.clipboard?.writeText(s);
    } catch {
      /* clipboard unavailable — still flash feedback */
    }
    setCopied(s);
    window.setTimeout(() => setCopied((c) => (c === s ? null : c)), 1400);
  };

  const downloadSheet = () => {
    const lines: string[] = [
      "FRAMEFORGE PRO 2026 — EDITING SHORTCUTS",
      "=".repeat(42),
      "",
    ];
    for (const g of SHORTCUTS) {
      lines.push(g.title.toUpperCase());
      lines.push("-".repeat(42));
      for (const it of g.items) {
        lines.push(`  ${it.keys.join(" + ").padEnd(18)} ${it.action}`);
      }
      lines.push("");
    }
    lines.push("frameforge.example — concept build");
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "frameforge-shortcuts.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section id="shortcuts" className="scroll-mt-24 border-t border-line bg-bg1/60 py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <SectionHead no="05" kicker="Muscle memory, shipped" title={<>EDIT AT THE <span className="text-amb">SPEED OF KEYS</span></>} />
        <div className="grid gap-5 md:grid-cols-2">
          {SHORTCUTS.map((g, gi) => (
            <Reveal key={g.title} delay={gi * 80}>
              <div className="h-full rounded-[5px] border border-line bg-panel">
                <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
                  <Icon name={g.icon} className="h-4 w-4 text-amb" />
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink">
                    {g.title}
                  </span>
                </div>
                <ul>
                  {g.items.map((it) => {
                    const combo = it.keys.join("+");
                    const isCopied = copied === combo;
                    return (
                      <li key={combo} className="border-b border-line/50 last:border-0">
                        <button
                          onClick={() => copy(combo)}
                          className="shortcut-row flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-panel2"
                          title="Click to copy shortcut"
                        >
                          <span className="flex shrink-0 items-center gap-1">
                            {it.keys.map((k, i) => (
                              <span key={i} className="flex items-center gap-1">
                                {i > 0 && <span className="font-mono text-[10px] text-dim">+</span>}
                                <kbd className="keycap">{k}</kbd>
                              </span>
                            ))}
                          </span>
                          <span className="text-[12.5px] text-mut">{it.action}</span>
                          <span
                            className={`ml-auto shrink-0 font-mono text-[9.5px] uppercase tracking-wider transition-colors ${
                              isCopied ? "text-scope" : "text-dim opacity-0 group-hover:opacity-100"
                            }`}
                          >
                            {isCopied ? "✓ copied" : "copy"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={160}>
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[5px] border border-line bg-panel px-5 py-4">
            <Icon name="keyboard" className="h-5 w-5 text-amb" />
            <p className="text-[13px] text-mut">
              Every shortcut is remappable — and the full map exports to a
              printable sheet for the edit bay wall.
            </p>
            <button
              onClick={downloadSheet}
              className="ml-auto flex items-center gap-2 rounded-[3px] bg-amb px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg0 transition-all hover:bg-amb2 hover:shadow-[0_6px_20px_rgba(255,180,60,.25)]"
            >
              <Icon name="download" className="h-3.5 w-3.5" />
              Download cheat sheet
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================== */
/* 06 · COMPARISON                                                     */
/* ================================================================== */

const ROWS: { feature: string; free: boolean | string; pro: boolean | string }[] = [
  { feature: "AI tools (Auto Color, DeNoise, Reframe)", free: false, pro: true },
  { feature: "Multi-cam editing", free: false, pro: true },
  { feature: "8K / 10-bit sources", free: false, pro: true },
  { feature: "Team Projects & live collab", free: false, pro: true },
  { feature: "FuseFX dynamic link", free: false, pro: true },
  { feature: "Audio toolset", free: "Limited", pro: "Full" },
  { feature: "Export options", free: "Limited", pro: "All formats" },
  { feature: "Watermark on export", free: "Yes", pro: "None" },
];

function Cell({ v }: { v: boolean | string }) {
  if (v === true)
    return (
      <span className="flex items-center gap-1.5 text-scope">
        <Icon name="check" className="h-4 w-4" /> <span className="font-mono text-[10px] tracking-wider">YES</span>
      </span>
    );
  if (v === false)
    return (
      <span className="flex items-center gap-1.5 text-rec/60">
        <Icon name="x" className="h-4 w-4" /> <span className="font-mono text-[10px] tracking-wider">NO</span>
      </span>
    );
  return <span className="font-mono text-[11px] tracking-wider text-amb">{v}</span>;
}

function Compare() {
  return (
    <section id="compare" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <SectionHead no="06" kicker="Side by side" title={<>FREE TRIAL <span className="text-amb">VS CREATOR</span></>} />
        <Reveal>
          <div className="overflow-hidden rounded-[5px] border border-line bg-panel">
            <div className="grid grid-cols-[1.5fr_1fr_1.2fr] border-b border-line bg-bg1 font-mono text-[10.5px] uppercase tracking-[0.2em]">
              <span className="px-4 py-3 text-dim sm:px-5">Feature</span>
              <span className="px-3 py-3 text-mut sm:px-4">Free Trial</span>
              <span className="border-l-2 border-amb bg-amb/8 px-3 py-3 text-amb sm:px-4">
                Creator ’26
              </span>
            </div>
            {ROWS.map((r, i) => (
              <div
                key={r.feature}
                className={`grid grid-cols-[1.5fr_1fr_1.2fr] items-center transition-colors hover:bg-panel2 ${
                  i % 2 ? "bg-bg1/40" : ""
                }`}
              >
                <span className="px-4 py-3 text-[13px] text-ink sm:px-5">{r.feature}</span>
                <span className="px-3 py-3 sm:px-4"><Cell v={r.free} /></span>
                <span className="border-l-2 border-amb/60 bg-amb/4 px-3 py-3 sm:px-4"><Cell v={r.pro} /></span>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={120}>
          <p className="mt-5 text-center font-mono text-[11px] tracking-wider text-dim">
            Trial = Creator for 30 days, watermark included. No card required.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================== */
/* 07 · WHAT'S NEW                                                     */
/* ================================================================== */

const LOG: { type: "NEW" | "IMPROVED" | "FIXED"; text: string }[] = [
  { type: "NEW", text: "Text-Based Editing 2.0 — filler-word detection (“um”, “uh”) marks itself." },
  { type: "NEW", text: "Auto Color 2.0 — one-click Hollywood grades trained on 40k scenes." },
  { type: "NEW", text: "Real-time collaboration — up to 8 editors in one sequence, live cursors." },
  { type: "NEW", text: "Native WebM export with alpha channel." },
  { type: "NEW", text: "25+ new transitions & filters, including film-halation and gate weave." },
  { type: "IMPROVED", text: "GPU acceleration — renders are 50% faster across CUDA, Metal and oneAPI." },
  { type: "IMPROVED", text: "H.265 encoding — ~35% smaller files at identical quality." },
  { type: "FIXED", text: "Multicam sync drift on 29.97 fps timelines." },
  { type: "FIXED", text: "Proxy toggle stutter on HEVC 10-bit sources." },
];

const TAG: Record<string, string> = {
  NEW: "bg-scope/15 text-scope border-scope/40",
  IMPROVED: "bg-amb/12 text-amb border-amb/40",
  FIXED: "bg-cue/12 text-cue border-cue/40",
};

function WhatsNew() {
  return (
    <section id="new" className="scroll-mt-24 border-t border-line bg-bg1/60 py-24">
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <SectionHead no="07" kicker="Release notes" title={<>WHAT'S NEW IN <span className="text-amb">2026</span></>} />
        <Reveal>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="rounded-[3px] bg-amb px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-bg0">
              v2026.1.0 “MERIDIAN”
            </span>
            <span className="font-mono text-[11px] text-dim">shipped Jan 2026 • 1.8 GB delta</span>
          </div>
        </Reveal>
        <div className="space-y-2">
          {LOG.map((e, i) => (
            <Reveal key={e.text} delay={i * 55}>
              <div className="group flex items-start gap-4 rounded-[4px] border border-transparent px-4 py-3 transition-all hover:border-line hover:bg-panel">
                <span className={`mt-0.5 w-24 shrink-0 rounded-[3px] border px-2 py-1 text-center font-mono text-[9.5px] font-bold tracking-[0.16em] ${TAG[e.type]}`}>
                  {e.type}
                </span>
                <p className="text-[13.5px] leading-relaxed text-mut transition-colors group-hover:text-ink">
                  {e.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* 08 · FORMATS                                                        */
/* ================================================================== */

const IMPORTS: { group: string; icon: string; items: string[] }[] = [
  { group: "Video", icon: "film", items: ["MP4", "MOV", "AVI", "MKV", "MPEG", "WMV", "FLV", "3GP", "WebM", "GIF", "MXF", "R3D*"] },
  { group: "Audio", icon: "music", items: ["WAV", "MP3", "AAC", "AIFF", "FLAC", "OGG"] },
  { group: "Stills", icon: "image", items: ["JPEG", "PNG", "TIFF", "PSD", "AI", "EXR", "DNG"] },
];

const EXPORTS = [
  "H.264", "H.265 / HEVC", "ProRes 422/4444", "DNxHD/HR", "Animation", "WebM", "TIFF sequence", "PNG sequence", "WAV", "MP3",
];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="cursor-default rounded-[3px] border border-line bg-bg0 px-2 py-1 font-mono text-[10.5px] tracking-wider text-mut transition-all hover:-translate-y-0.5 hover:border-amb/60 hover:text-amb">
      {children}
    </span>
  );
}

function Formats() {
  return (
    <section id="formats" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHead no="08" kicker="Codec coverage" title={<>IF IT'S A FORMAT, <span className="text-amb">IT CUTS</span></>} />
        <div className="grid gap-5 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-[5px] border border-line bg-panel p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="h-2 w-2 rotate-45 bg-scope" />
                <h3 className="font-display text-2xl tracking-wide text-ink">IMPORT</h3>
                <span className="ml-auto font-mono text-[10px] text-dim">50+ containers</span>
              </div>
              <div className="space-y-4">
                {IMPORTS.map((g) => (
                  <div key={g.group}>
                    <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-dim">
                      <Icon name={g.icon} className="h-3.5 w-3.5 text-scope" /> {g.group}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.items.map((f) => <Chip key={f}>{f}</Chip>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="flex h-full flex-col rounded-[5px] border border-line bg-panel p-5">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="h-2 w-2 rotate-45 bg-amb" />
                <h3 className="font-display text-2xl tracking-wide text-ink">EXPORT</h3>
                <span className="ml-auto font-mono text-[10px] text-dim">+ platform presets</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EXPORTS.map((f) => <Chip key={f}>{f}</Chip>)}
              </div>
              <div className="mt-auto pt-5">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-dim">One-click presets</p>
                <div className="flex flex-wrap gap-1.5">
                  {["YouTube 4K", "Vimeo", "Vertical 9:16", "Square 1:1", "Broadcast HLG", "Podcast MP3"].map((f) => (
                    <span key={f} className="rounded-[3px] border border-amb/40 bg-amb/8 px-2 py-1 font-mono text-[10.5px] tracking-wider text-amb">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* 09 · SYSTEM REQUIREMENTS                                            */
/* ================================================================== */

function Meter({ label, value, pct, vis }: { label: string; value: string; pct: number; vis: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-dim">{label}</span>
        <span className="font-mono text-[12px] font-semibold text-amb">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amb2 to-amb transition-all duration-1000 ease-out"
          style={{ width: vis ? `${pct}%` : "0%" }}
        />
      </div>
    </div>
  );
}

function Reqs() {
  const { ref, vis } = useReveal<HTMLDivElement>(0.3);
  return (
    <section id="reqs" className="scroll-mt-24 border-t border-line bg-bg1/60 py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHead no="09" kicker="Hardware check" title={<>WILL YOUR RIG <span className="text-amb">KEEP UP?</span></>} />
        <div ref={ref} className="grid gap-5 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-[5px] border border-line bg-panel p-6">
              <div className="mb-6 flex items-center gap-2.5">
                <Icon name="chip" className="h-4 w-4 text-mut" />
                <h3 className="font-display text-2xl tracking-wide text-ink">MINIMUM</h3>
              </div>
              <div className="space-y-5">
                <Meter label="OS" value="Windows 10 64-bit" pct={40} vis={vis} />
                <Meter label="Memory" value="16 GB RAM" pct={50} vis={vis} />
                <Meter label="Graphics" value="4 GB VRAM GPU" pct={42} vis={vis} />
                <Meter label="Storage" value="8 GB free space" pct={22} vis={vis} />
              </div>
              <p className="mt-6 border-t border-line pt-4 font-mono text-[10.5px] leading-relaxed text-dim">
                // Cuts 1080p smoothly. 4K timelines will lean on proxies.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="relative h-full overflow-hidden rounded-[5px] border border-amb/35 bg-panel p-6">
              <span className="absolute right-0 top-0 bg-amb/15 px-2.5 py-1 font-mono text-[9.5px] font-bold tracking-[0.2em] text-amb">
                SWEET SPOT
              </span>
              <div className="mb-6 flex items-center gap-2.5">
                <Icon name="bolt" className="h-4 w-4 text-amb" />
                <h3 className="font-display text-2xl tracking-wide text-ink">RECOMMENDED</h3>
              </div>
              <div className="space-y-5">
                <Meter label="OS" value="Windows 11 64-bit" pct={100} vis={vis} />
                <Meter label="Memory" value="32 GB RAM" pct={100} vis={vis} />
                <Meter label="Graphics" value="8 GB VRAM GPU" pct={82} vis={vis} />
                <Meter label="Storage" value="NVMe SSD media cache" pct={65} vis={vis} />
              </div>
              <p className="mt-6 border-t border-line pt-4 font-mono text-[10.5px] leading-relaxed text-dim">
                // 8K multicam, HDR scopes and zero dropped frames in the preview.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function Sections() {
  return (
    <>
      <Suite />
      <Shortcuts />
      <Compare />
      <WhatsNew />
      <Formats />
      <Reqs />
    </>
  );
}
