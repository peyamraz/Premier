import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../lib/ui";
import {
  NO_EFFECTS,
  cumStart,
  makeLayer,
  ratioToFrame,
  seqDuration,
  uid,
} from "./model";
import type { SFXType } from "./sfx";
import { SFX_META } from "./sfx";
import { useEditor, type SFXItem } from "./state";

/* ------------------------------------------------------------------ */
/* MagnatesMedia tarzı — ayrı stil stüdyosu                            */
/* ------------------------------------------------------------------ */

type StepId =
  | "bars"
  | "grade"
  | "texture"
  | "zoom"
  | "type"
  | "sound"
  | "captions";

type StepStatus = "idle" | "run" | "done";

interface StepDef {
  id: StepId;
  label: string;
  detail: string;
  icon: string;
}

const STEPS: StepDef[] = [
  { id: "bars", label: "Sinematik Barlar", detail: "2.39:1 anamorfik çerçeve", icon: "film" },
  { id: "grade", label: "Karanlık Grade", detail: "Düşük doygunluk, yüksek kontrast", icon: "fx" },
  { id: "texture", label: "Gren + Vinyet", detail: "35mm doku ve köşe kararması", icon: "image" },
  { id: "zoom", label: "2.5D Yavaş Zoom", detail: "Arşiv görsellerine yaklaşma", icon: "maximize" },
  { id: "type", label: "Kinetik Tipografi", detail: "Glitch başlık animasyonu", icon: "text" },
  { id: "sound", label: "Ses Tasarımı", detail: "Riser, vuruş ve bas düşüş", icon: "volume" },
  { id: "captions", label: "Sinema Altyazı", detail: "Konturlu serif stil", icon: "check" },
];

const GOLD = "#d4a24e";

export function MagnatesPanel() {
  const { state, dispatch, totalDur, toast } = useEditor();

  const [grade, setGrade] = useState(70);
  const [zoom, setZoom] = useState(112);
  const [title, setTitle] = useState("THE RISE");
  const [status, setStatus] = useState<Record<StepId, StepStatus>>(() =>
    Object.fromEntries(STEPS.map((s) => [s.id, "idle"])) as Record<StepId, StepStatus>,
  );
  const [applying, setApplying] = useState(false);
  const timers = useRef<number[]>([]);
  const added = useRef<{ layers: string[]; sfx: string[] }>({ layers: [], sfx: [] });

  /* temizlik: bileşen kapanınca zamanlayıcıları iptal et */
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const setStep = useCallback((id: StepId, st: StepStatus) => {
    setStatus((prev) => ({ ...prev, [id]: st }));
  }, []);

  /* ---------------- tekil uygulamalar ---------------- */

  const applyBars = useCallback(() => {
    dispatch({ type: "SET_FRAME", frame: ratioToFrame("21:9") });
  }, [dispatch]);

  const applyGrade = useCallback(
    (intensity: number) => {
      const k = intensity / 100;
      dispatch({
        type: "SET_FILTER",
        patch: {
          brightness: Math.round(100 - 12 * k),
          contrast: Math.round(100 + 26 * k),
          saturate: Math.round(100 - 34 * k),
        },
      });
    },
    [dispatch],
  );

  const applyTexture = useCallback(() => {
    dispatch({
      type: "SET_EFFECTS",
      effects: { ...NO_EFFECTS, grain: true, vignette: true },
    });
  }, [dispatch]);

  const applyZoomToClips = useCallback(
    (scalePct: number) => {
      const imageClipIds = state.clips
        .filter((c) => {
          const m = state.media.find((mm) => mm.id === c.mediaId);
          return m?.kind === "image";
        })
        .map((c) => c.id);
      imageClipIds.forEach((id) =>
        dispatch({ type: "CLIP_TRANSFORM", id, patch: { scale: scalePct } }),
      );
      return imageClipIds.length;
    },
    [state.clips, state.media, dispatch],
  );

  const applyTitle = useCallback(
    (text: string) => {
      const dur = Math.max(2.4, Math.min(4, totalDur || 3));
      const layer = makeLayer("title", text.trim() || "THE RISE", 0.2, 0.2 + dur);
      const id = layer.id;
      dispatch({
        type: "ADD_LAYER",
        layer: {
          ...layer,
          id,
          x: 50,
          y: 46,
          size: 9,
          scale: 100,
          color: GOLD,
          font: "display",
          upper: true,
          animIn: "glitch",
          animOut: "fade",
          animDur: 0.5,
          easing: "easeOut",
          follow: "zoom",
        },
      });
      added.current.layers.push(id);
    },
    [dispatch, totalDur],
  );

  const applySound = useCallback(() => {
    const items: SFXItem[] = [];
    const dur = seqDuration(state.clips);
    if (dur <= 0) return 0;

    /* açılış atmosferi */
    items.push({ id: uid(), type: "drone", start: 0, dur: SFX_META.drone.dur, volume: 0.5 });

    /* her sahne sınırına riser + vuruş */
    const boundaries = state.clips
      .map((_, i) => cumStart(state.clips, i))
      .slice(1)
      .filter((t) => t > 0.4 && t < dur - 0.4)
      .slice(0, 6);

    boundaries.forEach((t, i) => {
      const rise: SFXType = i % 2 === 0 ? "riser" : "swish";
      items.push({ id: uid(), type: rise, start: Math.max(0, t - 1.2), dur: SFX_META[rise].dur, volume: 0.6 });
      const hit: SFXType = i % 3 === 0 ? "boom" : "hit";
      items.push({ id: uid(), type: hit, start: t, dur: SFX_META[hit].dur, volume: 0.75 });
    });

    items.forEach((it) => dispatch({ type: "ADD_SFX", item: it }));
    added.current.sfx.push(...items.map((i) => i.id));
    return items.length;
  }, [state.clips, dispatch]);

  const applyCaptions = useCallback(() => {
    dispatch({ type: "SET_CAPTION_STYLE", style: "sinema" });
  }, [dispatch]);

  /* ---------------- sıralı (sinematik) uygulama ---------------- */

  const applyAll = useCallback(() => {
    if (applying) return;
    setApplying(true);
    setStatus(Object.fromEntries(STEPS.map((s) => [s.id, "idle"])) as Record<StepId, StepStatus>);

    const runners: { id: StepId; fn: () => void }[] = [
      { id: "bars", fn: applyBars },
      { id: "grade", fn: () => applyGrade(grade) },
      { id: "texture", fn: applyTexture },
      { id: "zoom", fn: () => applyZoomToClips(zoom) },
      { id: "type", fn: () => applyTitle(title) },
      { id: "sound", fn: () => applySound() },
      { id: "captions", fn: applyCaptions },
    ];

    runners.forEach((r, i) => {
      const t0 = window.setTimeout(() => setStep(r.id, "run"), i * 260);
      const t1 = window.setTimeout(() => {
        r.fn();
        setStep(r.id, "done");
        if (i === runners.length - 1) {
          setApplying(false);
          toast("Magnates stili uygulandı");
        }
      }, i * 260 + 220);
      timers.current.push(t0, t1);
    });
  }, [
    applying,
    applyBars,
    applyGrade,
    applyTexture,
    applyZoomToClips,
    applyTitle,
    applySound,
    applyCaptions,
    grade,
    zoom,
    title,
    setStep,
    toast,
  ]);

  /* ---------------- sıfırlama ---------------- */

  const resetStyle = useCallback(() => {
    dispatch({ type: "SET_FRAME", frame: ratioToFrame("16:9") });
    dispatch({ type: "RESET_FILTERS" });
    dispatch({ type: "SET_EFFECTS", effects: { ...NO_EFFECTS } });
    dispatch({ type: "SET_CAPTION_STYLE", style: "klasik" });
    state.clips.forEach((c) => dispatch({ type: "RESET_TRANSFORM", id: c.id }));
    added.current.layers.forEach((id) => dispatch({ type: "REMOVE_LAYER", id }));
    added.current.sfx.forEach((id) => dispatch({ type: "REMOVE_SFX", id }));
    added.current = { layers: [], sfx: [] };
    setStatus(Object.fromEntries(STEPS.map((s) => [s.id, "idle"])) as Record<StepId, StepStatus>);
    toast("Stil sıfırlandı");
  }, [dispatch, state.clips, toast]);

  const doneCount = STEPS.filter((s) => status[s.id] === "done").length;
  const hasClips = state.clips.length > 0;

  return (
    <section className="overflow-hidden rounded-[6px] border border-amb/25 bg-gradient-to-b from-panel to-bg0">
      {/* başlık bandı */}
      <div className="relative border-b border-amb/20 px-3.5 pb-3 pt-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-amb/12 text-amb">
            <Icon name="bolt" className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-[17px] leading-none tracking-[0.04em] text-ink">
              MAGNATES <span className="text-amb">STÜDYO</span>
            </p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-dim">
              Belgesel tarzı • tek tık
            </p>
          </div>
          <span className="ml-auto rounded-full border border-amb/30 bg-amb/8 px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-wider text-amb">
            {doneCount}/{STEPS.length}
          </span>
        </div>
        <div className="mt-3 h-px bg-gradient-to-r from-transparent via-amb/40 to-transparent" />
      </div>

      <div className="space-y-3 p-3.5">
        {/* tek tık uygula */}
        <button
          onClick={applyAll}
          disabled={applying || !hasClips}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-[4px] bg-amb px-3 py-2.5 font-display text-[15px] tracking-[0.06em] text-bg0 transition-all hover:bg-amb2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          {applying ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-bg0/30 border-t-bg0" />
              UYGULANIYOR…
            </>
          ) : (
            <>
              <Icon name="bolt" className="h-4 w-4" />
              STİLİ UYGULA
            </>
          )}
        </button>
        {!hasClips && (
          <p className="text-center font-mono text-[9px] text-dim">
            Önce zaman çizelgesine klip ekleyin
          </p>
        )}

        {/* adım listesi */}
        <ol className="space-y-1">
          {STEPS.map((s, i) => {
            const st = status[s.id];
            return (
              <li
                key={s.id}
                className={`flex items-center gap-2.5 rounded-[4px] border px-2.5 py-1.5 transition-all duration-300 ${
                  st === "done"
                    ? "border-amb/30 bg-amb/6"
                    : st === "run"
                      ? "border-amb/50 bg-amb/10"
                      : "border-line/60 bg-transparent"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[9px] transition-colors ${
                    st === "done"
                      ? "bg-amb text-bg0"
                      : st === "run"
                        ? "border border-amb text-amb"
                        : "border border-line2 text-dim"
                  }`}
                >
                  {st === "done" ? (
                    <Icon name="check" className="h-3 w-3" />
                  ) : st === "run" ? (
                    <span className="h-2.5 w-2.5 animate-spin rounded-full border border-amb border-t-transparent" />
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-mono text-[10.5px] font-semibold uppercase tracking-wide transition-colors ${
                      st === "idle" ? "text-mut" : "text-ink"
                    }`}
                  >
                    {s.label}
                  </p>
                  <p className="truncate font-mono text-[8.5px] text-dim">{s.detail}</p>
                </div>
                <Icon
                  name={s.icon}
                  className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                    st === "done" ? "text-amb" : "text-dim"
                  }`}
                />
              </li>
            );
          })}
        </ol>

        {/* ince ayarlar */}
        <div className="space-y-2.5 border-t border-line/70 pt-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-dim">İnce Ayar</p>

          <label className="block">
            <span className="flex justify-between font-mono text-[9.5px] text-dim">
              <span>GRADE YOĞUNLUĞU</span>
              <span className="tabular-nums text-amb">{grade}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={grade}
              onChange={(e) => {
                const v = Number(e.target.value);
                setGrade(v);
                applyGrade(v);
              }}
              className="range-amber mt-1 w-full"
            />
          </label>

          <label className="block">
            <span className="flex justify-between font-mono text-[9.5px] text-dim">
              <span>ZOOM GÜCÜ (GÖRSELLER)</span>
              <span className="tabular-nums text-amb">{zoom}%</span>
            </span>
            <input
              type="range"
              min={100}
              max={130}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="range-amber mt-1 w-full"
            />
          </label>

          <label className="block">
            <span className="mb-1 block font-mono text-[9.5px] text-dim">BAŞLIK METNİ</span>
            <div className="flex gap-1.5">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-w-0 flex-1 rounded-[3px] border border-line bg-bg0 px-2 py-1.5 font-display text-[13px] tracking-wide text-ink outline-none transition-colors focus:border-amb"
                placeholder="THE RISE"
              />
              <button
                onClick={() => applyTitle(title)}
                className="shrink-0 rounded-[3px] border border-line px-2 font-mono text-[9px] uppercase text-mut transition-colors hover:border-amb/60 hover:text-amb"
              >
                Ekle
              </button>
            </div>
          </label>
        </div>

        {/* sıfırla */}
        <button
          onClick={resetStyle}
          className="flex w-full items-center justify-center gap-1.5 rounded-[4px] border border-line px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-mut transition-colors hover:border-rec/50 hover:text-rec"
        >
          <Icon name="rotate" className="h-3.5 w-3.5" />
          Stili Temizle
        </button>
      </div>
    </section>
  );
}
