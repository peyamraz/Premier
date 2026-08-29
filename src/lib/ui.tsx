import { useEffect, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* motion helpers                                                      */
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

/** Deterministic pseudo-random 0..1 */
export function rand(i: number, seed = 1): number {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Decode / scramble effect for monospace eyebrows. */
export function useScramble(text: string, speed = 30): string {
  const reduced = usePrefersReducedMotion();
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (reduced) {
      setOut(text);
      return;
    }
    const glyphs = "█▓▒░<>/\\#%01";
    let frame = 0;
    const total = 24;
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

/* ------------------------------------------------------------------ */
/* custom inline icon set (24×24, stroke = currentColor)               */
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
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4.5 6.5h15M9.5 6V4.5h5V6M6.5 6.5l.8 13h9.4l.8-13" />
      <path d="M10 10.5v5.5M14 10.5v5.5" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6.5" cy="6.5" r="2.4" />
      <circle cx="6.5" cy="17.5" r="2.4" />
      <path d="M8.6 8.2L20 17M8.6 15.8L20 7M13.2 12l1.6 1.2" />
    </>
  ),
  rotate: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 1 2.2 5.3" />
      <path d="M4 13.5l.6 3.9 3.9-.7" />
    </>
  ),
  flip: (
    <>
      <path d="M12 3v18" strokeDasharray="2.5 2.5" />
      <path d="M9 7L3.5 12 9 17V7zM15 7l5.5 5L15 17V7z" fill="currentColor" stroke="none" />
    </>
  ),
  text: (
    <>
      <path d="M5 6.5V4.5h14v2M12 4.5v15M9 19.5h6" />
    </>
  ),
  upload: <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M4.5 15v4.5h15V15" />,
  download: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4.5 15.5V20h15v-4.5" />,
  volume: (
    <>
      <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z" fill="currentColor" stroke="none" />
      <path d="M15 9a4.2 4.2 0 0 1 0 6M17.5 6.8a7.6 7.6 0 0 1 0 10.4" />
    </>
  ),
  volumeX: (
    <>
      <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z" fill="currentColor" stroke="none" />
      <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
    </>
  ),
  maximize: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  minimize: <path d="M9 4v5H4M15 4v5h5M15 20v-5h5M9 20v-5H4" />,
  chevronL: <path d="M14.5 5.5L8 12l6.5 6.5" />,
  chevronR: <path d="M9.5 5.5L16 12l-6.5 6.5" />,
  film: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M7.5 5v14M16.5 5v14M3 9.5h4.5M3 14.5h4.5M16.5 9.5H21M16.5 14.5H21" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="1" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M3.5 17l5-4.5 3.5 3 4-4 4.5 4.5" />
    </>
  ),
  fx: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />,
  wave: <path d="M3 12h2l2-5 3 10 3-14 3 12 2-6 1.2 3H21" />,
  bolt: <path d="M13 2.5L5 13.5h5.5L11 21.5l8-11h-5.5z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.6 2" />
    </>
  ),
  stepB: (
    <>
      <rect x="5" y="5.5" width="2.4" height="13" fill="currentColor" stroke="none" />
      <path d="M19 5.5v13L9.5 12z" fill="currentColor" stroke="none" />
    </>
  ),
  stepF: (
    <>
      <rect x="16.6" y="5.5" width="2.4" height="13" fill="currentColor" stroke="none" />
      <path d="M5 5.5v13L14.5 12z" fill="currentColor" stroke="none" />
    </>
  ),
  cutline: <path d="M12 3v18" strokeDasharray="3 3" />,
};

export function Icon({
  name,
  className = "h-4 w-4",
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {P[name] ?? P.film}
    </svg>
  );
}
