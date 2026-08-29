import { useState } from "react";
import { Icon, Reveal, SectionHead } from "../lib/ui";

function BuyButton({ label, primary }: { label: string; primary?: boolean }) {
  const [state, setState] = useState<0 | 1 | 2>(0);
  const click = () => {
    if (state !== 0) return;
    setState(1);
    window.setTimeout(() => setState(2), 1100);
    window.setTimeout(() => setState(0), 4200);
  };
  return (
    <button
      onClick={click}
      className={`mt-6 flex w-full items-center justify-center gap-2 rounded-[3px] px-5 py-3 font-mono text-[12px] font-bold uppercase tracking-wider transition-all ${
        primary
          ? "bg-amb text-bg0 hover:bg-amb2 hover:shadow-[0_8px_26px_rgba(255,180,60,.3)]"
          : "border border-line2 text-mut hover:border-amb/60 hover:text-amb"
      } ${state === 1 ? "opacity-80" : ""}`}
    >
      {state === 0 && (
        <>
          <Icon name="play" className="h-3 w-3" /> {label}
        </>
      )}
      {state === 1 && (
        <>
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-current" />
          Opening secure checkout…
        </>
      )}
      {state === 2 && (
        <>
          <Icon name="check" className="h-3.5 w-3.5" /> Demo build — no live checkout
        </>
      )}
    </button>
  );
}

const CREATOR_FEATURES = [
  "All 5 apps, one installer",
  "Perpetual — yours forever",
  "1000+ MOGRTs • 50+ LUTs • 500+ transitions",
  "Team Projects (1 seat)",
  "12 months of updates included",
  "Offline activation, 2 machines",
];

const STUDIO_FEATURES = [
  "5 seats, shared asset library",
  "Live collab up to 8 editors",
  "Priority render support",
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-24 border-t border-line py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <SectionHead no="10" kicker="Perpetual licensing" title={<>PAY ONCE. <span className="text-amb">CUT FOREVER.</span></>} />
        <div className="grid gap-5 lg:grid-cols-12">
          {/* trial */}
          <Reveal className="lg:col-span-3">
            <div className="flex h-full flex-col rounded-[5px] border border-line bg-panel p-6 transition-all duration-300 hover:-translate-y-1 hover:border-line2">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-dim">Free Trial</p>
              <p className="mt-3 font-display text-5xl tracking-wide text-ink">
                $0<span className="ml-1 text-lg text-dim">/ 30 days</span>
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-mut">
                Every Creator feature for a month. Watermarked exports, no card
                on file.
              </p>
              <BuyButton label="Start trial" />
            </div>
          </Reveal>

          {/* creator — featured */}
          <Reveal delay={100} className="lg:col-span-6">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[5px] border border-amb/50 bg-panel p-7 shadow-[0_30px_80px_rgba(255,180,60,.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_34px_90px_rgba(255,180,60,.14)]">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.05]"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(-45deg,#ffb43c 0 2px,transparent 2px 14px)",
                }}
              />
              <span className="absolute right-5 top-0 -translate-y-1/2 rotate-0 rounded-[3px] bg-amb px-3 py-1 font-mono text-[10px] font-bold tracking-[0.18em] text-bg0">
                MOST POPULAR
              </span>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amb">Creator License</p>
                  <p className="mt-2 font-display text-7xl leading-none tracking-wide text-ink">
                    $299<span className="ml-2 align-top font-mono text-xs tracking-[0.18em] text-dim">ONE-TIME</span>
                  </p>
                </div>
                <div className="rounded-[4px] border border-line bg-bg0 px-3 py-2 text-right">
                  <p className="font-mono text-[9.5px] tracking-[0.2em] text-dim">VS SUBSCRIPTION RIVAL</p>
                  <p className="font-mono text-sm font-semibold text-scope">save $1,180 / 4 yrs</p>
                </div>
              </div>
              <ul className="mt-7 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                {CREATOR_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-mut">
                    <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-scope" />
                    {f}
                  </li>
                ))}
              </ul>
              <BuyButton label="Buy Creator — $299" primary />
              <p className="mt-3 text-center font-mono text-[10px] tracking-wider text-dim">
                30-day money-back guarantee • license key by email in minutes
              </p>
            </div>
          </Reveal>

          {/* studio */}
          <Reveal delay={180} className="lg:col-span-3">
            <div className="flex h-full flex-col rounded-[5px] border border-line bg-panel p-6 transition-all duration-300 hover:-translate-y-1 hover:border-scope/50">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-scope">Studio License</p>
              <p className="mt-3 font-display text-5xl tracking-wide text-ink">
                $499<span className="ml-1 text-lg text-dim">/ team</span>
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-mut">
                For edit bays and crews. Everything in Creator, multiplied.
              </p>
              <ul className="mt-4 space-y-2">
                {STUDIO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12.5px] text-mut">
                    <Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-scope" />
                    {f}
                  </li>
                ))}
              </ul>
              <BuyButton label="Buy Studio" />
            </div>
          </Reveal>
        </div>

        <Reveal delay={140}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-mono text-[10.5px] tracking-[0.16em] text-dim">
            <span className="flex items-center gap-2"><Icon name="check" className="h-3.5 w-3.5 text-scope" /> NO MONTHLY FEES</span>
            <span className="flex items-center gap-2"><Icon name="check" className="h-3.5 w-3.5 text-scope" /> NO WATERMARKS</span>
            <span className="flex items-center gap-2"><Icon name="check" className="h-3.5 w-3.5 text-scope" /> OFFLINE ACTIVATION</span>
            <span className="flex items-center gap-2"><Icon name="check" className="h-3.5 w-3.5 text-scope" /> 30-DAY REFUNDS</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
