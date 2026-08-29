import { useEffect, useState } from "react";
import { fmtTC, useClock, usePrefersReducedMotion, Icon } from "../lib/ui";

const NAV = [
  { label: "AI Tools", href: "#ai" },
  { label: "Suite", href: "#suite" },
  { label: "Shortcuts", href: "#shortcuts" },
  { label: "Compare", href: "#compare" },
  { label: "What's New", href: "#new" },
  { label: "Pricing", href: "#pricing" },
];

export function Header() {
  const frames = useClock();
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-bg0/92 backdrop-blur-sm">
      <div className="flex h-10 items-center gap-4 px-3 md:px-5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rec/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amb/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-scope/80" />
        </div>
        <a
          href="#workspace"
          className="font-display text-xl leading-none tracking-[0.06em] text-ink transition-colors hover:text-amb"
        >
          FRAMEFORGE <span className="text-amb">PRO</span>
          <span className="ml-2 hidden font-mono text-[10px] font-medium tracking-normal text-dim sm:inline">
            2026.1
          </span>
        </a>
        <nav className="ml-2 hidden items-center gap-0.5 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-[3px] px-2.5 py-1 text-[11.5px] font-medium uppercase tracking-wider text-mut transition-colors hover:bg-panel hover:text-ink"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-[3px] border border-scope/40 bg-scope/10 px-2 py-0.5 font-mono text-[10px] tracking-wider text-scope sm:flex">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-scope" />
            PERPETUAL LICENSE
          </span>
          <span className="hidden font-mono text-xs tabular-nums text-amb lg:block">
            {fmtTC(frames)}
          </span>
        </div>
      </div>
    </header>
  );
}

const TICKER = [
  "H.265 / HEVC",
  "PRORES 422 HQ",
  "8K MULTICAM ×16",
  "TEXT-BASED EDITING",
  "SPEECH → TEXT",
  "AUTO COLOR 2.0",
  "REAL-TIME COLLAB",
  "GPU RENDER −50%",
  "NATIVE WEBM",
  "HDR / HLG PIPELINE",
  "1000+ MOGRTs",
  "50+ CINEMATIC LUTs",
];

export function Ticker() {
  return (
    <div className="marquee border-y border-line bg-bg1 py-2.5" aria-hidden="true">
      <div className="marquee-track">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center">
            {TICKER.map((t) => (
              <span
                key={`${copy}-${t}`}
                className="flex items-center gap-6 px-6 font-mono text-[11px] tracking-[0.22em] text-dim"
              >
                <b className="font-semibold text-mut">{t}</b>
                <svg viewBox="0 0 8 8" className="h-1.5 w-1.5 text-amb" aria-hidden="true">
                  <path d="M4 0L8 4 4 8 0 4z" fill="currentColor" />
                </svg>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const FOOT_LINKS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "AI Engine", href: "#ai" },
      { label: "Multicam", href: "#multicam" },
      { label: "The Suite", href: "#suite" },
      { label: "Licensing", href: "#pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Shortcut Sheet", href: "#shortcuts" },
      { label: "What's New", href: "#new" },
      { label: "Format Support", href: "#formats" },
      { label: "System Reqs", href: "#reqs" },
    ],
  },
  {
    title: "Decide",
    links: [
      { label: "Free vs Creator", href: "#compare" },
      { label: "30-Day Trial", href: "#pricing" },
      { label: "Workspace Tour", href: "#workspace" },
      { label: "Pro Spec Sheet", href: "#multicam" },
    ],
  },
];

export function Footer() {
  const frames = useClock();
  const reduced = usePrefersReducedMotion();
  const [cpu, setCpu] = useState(34);
  const [ram, setRam] = useState(58);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setCpu((c) => Math.min(92, Math.max(12, c + (Math.random() * 26 - 13))));
      setRam((r) => Math.min(88, Math.max(30, r + (Math.random() * 10 - 5))));
    }, 900);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <footer className="relative z-10 border-t border-line bg-bg1">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="font-display text-3xl tracking-[0.05em] text-ink">
            FRAMEFORGE <span className="text-amb">PRO</span>
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-mut">
            A non-linear editing suite built around one idea: you should own your
            tools. Perpetual licenses, on-device AI, and a timeline that stays out
            of your way.
          </p>
          <p className="mt-5 max-w-sm font-mono text-[10.5px] leading-relaxed tracking-wide text-dim">
            // FrameForge Pro is a fictional product — this page is a design
            concept, not a real software offer.
          </p>
        </div>
        {FOOT_LINKS.map((col) => (
          <div key={col.title} className="md:col-span-2">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.24em] text-dim">
              {col.title}
            </p>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-sm text-mut transition-colors hover:text-amb"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="md:col-span-1">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.24em] text-dim">
            Build
          </p>
          <p className="font-mono text-sm text-mut">2026.1.0</p>
          <p className="mt-1 font-mono text-[11px] text-dim">“Meridian”</p>
        </div>
      </div>

      {/* NLE status bar */}
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5 font-mono text-[10.5px] tracking-wider text-dim">
          <span className="flex items-center gap-1.5 text-scope">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-scope" />
            ONLINE
          </span>
          <span className="text-amb">v2026.1.0</span>
          <span className="hidden sm:inline">RENDERER: MERCURY GPU — CUDA 12.4</span>
          <span className="hidden md:flex items-center gap-1.5">
            CPU
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-panel2">
              <span
                className="block h-full rounded-full bg-amb transition-all duration-700"
                style={{ width: `${cpu}%` }}
              />
            </span>
          </span>
          <span className="hidden md:flex items-center gap-1.5">
            RAM
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-panel2">
              <span
                className="block h-full rounded-full bg-scope transition-all duration-700"
                style={{ width: `${ram}%` }}
              />
            </span>
          </span>
          <span className="ml-auto flex items-center gap-4">
            <span className="hidden sm:inline">SEQ 01 • 23.976 FPS</span>
            <span className="tabular-nums text-amb">{fmtTC(frames)}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
