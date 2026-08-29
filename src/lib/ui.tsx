import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Remote still used across program monitors / demos */
export const IMG =
  "https://image.qwenlm.ai/generated-images/5f88626f-a6fd-443c-9f53-3ef674c129db/_result.png";

/* ------------------------------------------------------------------ */
/* motion / time helpers                                               */
/* ------------------------------------------------------------------ */

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function fmtTC(totalFrames: number, fps = 24): string {
  const f = Math.floor(Math.max(0, totalFrames)) % fps;
  const s = Math.floor(totalFrames / fps) % 60;
  const m = Math.floor(totalFrames / (fps * 60)) % 60;
  const h = Math.floor(totalFrames / (fps * 3600));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`;
}

export function fmtShort(totalSeconds: number): string {
  const s = Math.floor(totalSeconds) % 60;
  const m = Math.floor(totalSeconds / 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(m)}:${p(s)}`;
}

/** Free-running session timecode (for header / status bars). */
export function useClock(fps = 24): number {
  const reduced = usePrefersReducedMotion();
  const [frames, setFrames] = useState(0);
  useEffect(() => {
    if (reduced) {
      setFrames(0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      setFrames(Math.floor(((t - t0) / 1000) * fps));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced, fps]);
  return frames;
}

export function useReveal<T extends HTMLElement = HTMLDivElement>(
  threshold = 0.12,
) {
  const ref = useRef<T | null>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVis(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVis(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, vis };
}

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, vis } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal ${vis ? "reveal-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/** Decode / scramble effect for monospace eyebrows. */
export function useScramble(text: string, speed = 34): string {
  const reduced = usePrefersReducedMotion();
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (reduced) {
      setOut(text);
      return;
    }
    const glyphs = "█▓▒░<>/\\#%01";
    let frame = 0;
    const total = 26;
    const id = window.setInterval(() => {
      frame++;
      const settle = (frame / total) * text.length * 1.15;
      setOut(
        text
          .split("")
          .map((c, i) =>
            c === " " ? " " : i < settle ? c : glyphs[(Math.random() * glyphs.length) | 0],
          )
          .join(""),
      );
      if (frame >= total) {
        setOut(text);
        window.clearInterval(id);
      }
    }, speed);
    return () => window.clearInterval(id);
  }, [text, reduced, speed]);
  return out;
}

/** Deterministic pseudo-random 0..1 */
export function rand(i: number, seed = 1): number {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/* ------------------------------------------------------------------ */
/* section header                                                      */
/* ------------------------------------------------------------------ */

export function SectionHead({
  no,
  kicker,
  title,
}: {
  no: string;
  kicker: string;
  title: ReactNode;
}) {
  return (
    <Reveal>
      <div className="mb-10 flex items-end gap-5">
        <span className="font-mono text-sm font-semibold text-amb">{no}</span>
        <div>
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.28em] text-dim">
            {kicker}
          </p>
          <h2 className="font-display text-4xl leading-none tracking-wide text-ink md:text-5xl">
            {title}
          </h2>
        </div>
        <div className="mb-2.5 flex-1 border-t border-line" />
      </div>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* custom inline icon set                                              */
/* ------------------------------------------------------------------ */

const P: Record<string, ReactNode> = {
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="7" y="5.5" width="3.4" height="13" fill="currentColor" stroke="none" />
      <rect x="13.6" y="5.5" width="3.4" height="13" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  dash: <path d="M6 12h12" />,
  film: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M7.5 5v14M16.5 5v14M3 9.5h4.5M3 14.5h4.5M16.5 9.5H21M16.5 14.5H21" />
    </>
  ),
  fx: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />,
  wave: <path d="M3 12h2l2-5 3 10 3-14 3 12 2-6 1.2 3H21" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="10" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  encode: <path d="M12 3v11M7.5 10.5l4.5 4.5 4.5-4.5M4 21h16" />,
  person: (
    <>
      <circle cx="12" cy="7" r="3" />
      <path d="M6 21c0-4 2.6-7 6-7s6 3 6 7" />
    </>
  ),
  razor: (
    <>
      <path d="M13 4l7 7-6 6H7v-7z" />
      <path d="M4 20l5.5-5.5" />
    </>
  ),
  captions: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M6 12h6M14 12h4M6 15.5h4M12 15.5h6" />
    </>
  ),
  color: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16zM12 12l6.9 4" />
    </>
  ),
  bolt: <path d="M13 2L5 13.5h5L9 22l8-11.5h-5z" />,
  collab: (
    <>
      <circle cx="7.5" cy="8" r="2.5" />
      <circle cx="16.5" cy="8" r="2.5" />
      <path d="M3 19c0-3 2-5 4.5-5S12 16 12 19M12 19c0-3 2-5 4.5-5s4.5 2 4.5 5" />
    </>
  ),
  download: <path d="M12 4v10M8 10.5l4 4 4-4M5 20.5h14" />,
  camera: (
    <>
      <rect x="3" y="7" width="13" height="10" rx="1" />
      <path d="M16 10.5l5-3v9l-5-3" />
    </>
  ),
  chip: (
    <>
      <rect x="7" y="7" width="10" height="10" />
      <path d="M9.5 3v4M14.5 3v4M9.5 17v4M14.5 17v4M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4" />
    </>
  ),
  ram: (
    <>
      <rect x="3" y="7" width="18" height="9" rx="1" />
      <path d="M6.5 10.5v2.5M9.5 10.5v2.5M12.5 10.5v2.5M15.5 10.5v2.5M5.5 16v2.5M18.5 16v2.5" />
    </>
  ),
  disk: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 4a8 8 0 0 1 8 8" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="16" r="2" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M3 17l5-5 4 4 3-3 6 6" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="7" r="2" />
      <circle cx="6" cy="17" r="2" />
      <path d="M7.7 8.2L20 17M7.7 15.8L20 7" />
    </>
  ),
  vr: (
    <>
      <path d="M3 8h18v7h-5l-2-2h-4l-2 2H3z" />
      <path d="M8 8V6.5h8V8" />
    </>
  ),
  keyboard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.8 2.8 2.8 13.2 0 16M12 4c-2.8 2.8-2.8 13.2 0 16" />
    </>
  ),
};

export function Icon({
  name,
  className = "h-4 w-4",
}: {
  name: keyof typeof P | string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {P[name] ?? null}
    </svg>
  );
}
