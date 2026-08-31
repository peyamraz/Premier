import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Icon } from "../lib/ui";
import { TYPE_BADGE, TYPE_LABEL } from "./analysis";
import { cutSilence, ensureAnalysis, snapBeats, splitScenes } from "./smartcut";
import { MIN_CLIP, clamp, clipDur, cumStart, findClipAt, fmtShort, seqDuration } from "./model";
import { SFX_META } from "./sfx";
import { useEditor } from "./state";

type DragMode =
  | "scrub"
  | "move"
  | "trimL"
  | "trimR"
  | "capL"
  | "capR"
  | "layerL"
  | "layerR"
  | "sfxMove"
  | "sfxL"
  | "sfxR";

interface DragInfo {
  mode: DragMode;
  id: string;
  startX: number;
  origIn: number;
  origOut: number;
  origStart: number;
  origEnd: number;
  moved: boolean;
}

const LABEL_W = 44;

export function Timeline() {
  const { state, dispatch, seqPos, playing, seek, totalDur, splitAtPlayhead, toast } = useEditor();
  const [zoom, setZoom] = useState(1);
  const [armed, setArmed] = useState(false);
  const [smartBusy, setSmartBusy] = useState<string | null>(null);

  /* içeriğe uygun kesme araçları */
  const runSmart = async (kind: "silence" | "scenes" | "beats") => {
    if (smartBusy) return;
    if (!state.clips.length) {
      toast("Önce zaman çizelgesine klip ekleyin");
      return;
    }
    setSmartBusy(kind);
    try {
      const map = await ensureAnalysis(state.media, state.analysis, dispatch, (l) => setSmartBusy(`${kind}:${l}`));
      const src = state.clips;
      if (kind === "silence") {
        const r = cutSilence(src, map);
        if (r.cuts) {
          dispatch({ type: "SET_CLIPS", clips: r.clips });
          toast(`${r.cuts} ölü boşluk kesildi (${r.removedSec.toFixed(1)} sn atıldı)`);
        } else toast("Kesilecek ölü boşluk bulunamadı");
      } else if (kind === "scenes") {
        const r = splitScenes(src, map);
        if (r.splits) {
          dispatch({ type: "SET_CLIPS", clips: r.clips });
          toast(`${r.splits} sahne geçişinden bölündü`);
        } else toast("Klipler içinde sahne geçişi bulunamadı");
      } else {
        const r = snapBeats(src, map);
        if (r.snaps) {
          dispatch({ type: "SET_CLIPS", clips: r.clips });
          toast(`${r.snaps} kesim beat ızgarasına oturtuldu`);
        } else toast("Yakında beat bulunamadı — müzik içeren video deneyin");
      }
    } finally {
      setSmartBusy(null);
    }
  };
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<DragInfo | null>(null);
  const pps = 30 * zoom;

  const minSpan = Math.max(totalDur, 16);
  const width = minSpan * pps;

  /* oynarken oynatma başlığını görünür tut */
  useEffect(() => {
    if (!playing || zoom <= 1) return;
    const c = scrollRef.current;
    if (!c) return;
    const x = seqPos * pps;
    if (x < c.scrollLeft + 60 || x > c.scrollLeft + c.clientWidth - 100) {
      c.scrollLeft = x - 140;
    }
  }, [seqPos, playing, pps, zoom]);

  useEffect(() => {
    if (armed) {
      const t = window.setTimeout(() => setArmed(false), 2500);
      return () => window.clearTimeout(t);
    }
  }, [armed]);

  const mediaOf = (mediaId: string) => state.media.find((m) => m.id === mediaId);

  const timeFromClientX = (clientX: number) => {
    const el = innerRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return clamp((clientX - r.left - LABEL_W) / pps, 0, totalDur || 0);
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-mode]");
    const clipEl = target.closest<HTMLElement>("[data-clip]");
    const capEl = target.closest<HTMLElement>("[data-cap]");
    const layerEl = target.closest<HTMLElement>("[data-layer]");
    const ruler = target.closest<HTMLElement>("[data-ruler]");

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (handle && clipEl) {
      const clip = state.clips.find((c) => c.id === clipEl.dataset.clip);
      if (!clip) return;
      dispatch({ type: "SELECT_CLIP", id: clip.id });
      drag.current = {
        mode: handle.dataset.mode as DragMode,
        id: clip.id,
        startX: e.clientX,
        origIn: clip.in,
        origOut: clip.out,
        origStart: 0,
        origEnd: 0,
        moved: false,
      };
      return;
    }
    if (handle && capEl) {
      const cap = state.captions.find((c) => c.id === capEl.dataset.cap);
      if (!cap) return;
      dispatch({ type: "SELECT_CAPTION", id: cap.id });
      drag.current = {
        mode: handle.dataset.mode as DragMode,
        id: cap.id,
        startX: e.clientX,
        origIn: 0,
        origOut: 0,
        origStart: cap.start,
        origEnd: cap.end,
        moved: false,
      };
      return;
    }
    const sfxEl = target.closest<HTMLElement>("[data-sfx]");
    if (sfxEl) {
      const it = state.sfx.find((x) => x.id === sfxEl.dataset.sfx);
      if (!it) return;
      drag.current = {
        mode: handle ? (handle.dataset.mode as DragMode) : "sfxMove",
        id: it.id,
        startX: e.clientX,
        origIn: 0,
        origOut: 0,
        origStart: it.start,
        origEnd: it.start + it.dur,
        moved: false,
      };
      return;
    }
    if (clipEl) {
      const id = clipEl.dataset.clip!;
      dispatch({ type: "SELECT_CLIP", id });
      drag.current = {
        mode: "move",
        id,
        startX: e.clientX,
        origIn: 0,
        origOut: 0,
        origStart: 0,
        origEnd: 0,
        moved: false,
      };
      return;
    }
    if (capEl) {
      dispatch({ type: "SELECT_CAPTION", id: capEl.dataset.cap! });
      return;
    }
    if (handle && layerEl) {
      const L = state.layers.find((l) => l.id === layerEl.dataset.layer);
      if (!L) return;
      dispatch({ type: "SELECT_LAYER", id: L.id });
      drag.current = {
        mode: handle.dataset.mode as DragMode,
        id: L.id,
        startX: e.clientX,
        origIn: 0,
        origOut: 0,
        origStart: L.start,
        origEnd: L.end,
        moved: false,
      };
      return;
    }
    if (layerEl) {
      dispatch({ type: "SELECT_LAYER", id: layerEl.dataset.layer! });
      return;
    }
    if (ruler || true) {
      drag.current = {
        mode: "scrub",
        id: "",
        startX: e.clientX,
        origIn: 0,
        origOut: 0,
        origStart: 0,
        origEnd: 0,
        moved: false,
      };
      seek(timeFromClientX(e.clientX));
    }
  };

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 3) d.moved = true;

    if (d.mode === "scrub") {
      seek(timeFromClientX(e.clientX));
      return;
    }
    if (d.mode === "trimL" || d.mode === "trimR") {
      const media = state.clips.find((c) => c.id === d.id);
      const m = media && mediaOf(media.mediaId);
      const maxDur = m ? Math.max(m.duration, d.origOut) : d.origOut + 60;
      if (d.mode === "trimL") {
        dispatch({ type: "TRIM_CLIP", id: d.id, in: clamp(d.origIn + dx / pps, 0, d.origOut - MIN_CLIP) });
      } else {
        dispatch({ type: "TRIM_CLIP", id: d.id, out: clamp(d.origOut + dx / pps, d.origIn + MIN_CLIP, maxDur) });
      }
      return;
    }
    if (d.mode === "capL" || d.mode === "capR") {
      const total = Math.max(totalDur, 1);
      if (d.mode === "capL") {
        dispatch({ type: "UPDATE_CAPTION", id: d.id, patch: { start: clamp(d.origStart + dx / pps, 0, d.origEnd - MIN_CLIP) } });
      } else {
        dispatch({ type: "UPDATE_CAPTION", id: d.id, patch: { end: clamp(d.origEnd + dx / pps, d.origStart + MIN_CLIP, total + 30) } });
      }
      return;
    }
    if (d.mode === "layerL" || d.mode === "layerR") {
      if (d.mode === "layerL") {
        dispatch({ type: "UPDATE_LAYER", id: d.id, patch: { start: clamp(d.origStart + dx / pps, 0, d.origEnd - MIN_CLIP) } });
      } else {
        dispatch({ type: "UPDATE_LAYER", id: d.id, patch: { end: clamp(d.origEnd + dx / pps, d.origStart + MIN_CLIP, 600) } });
      }
      return;
    }
    if (d.mode === "sfxMove" || d.mode === "sfxL" || d.mode === "sfxR") {
      const dur0 = d.origEnd - d.origStart;
      if (d.mode === "sfxMove") {
        dispatch({ type: "UPDATE_SFX", id: d.id, patch: { start: Math.max(0, d.origStart + dx / pps) } });
      } else if (d.mode === "sfxL") {
        const ns = clamp(d.origStart + dx / pps, 0, d.origEnd - 0.1);
        dispatch({ type: "UPDATE_SFX", id: d.id, patch: { start: ns, dur: d.origEnd - ns } });
      } else {
        dispatch({ type: "UPDATE_SFX", id: d.id, patch: { dur: Math.max(0.1, dur0 + dx / pps) } });
      }
      return;
    }
    if (d.mode === "move" && d.moved) {
      const clips = state.clips;
      const curIdx = clips.findIndex((c) => c.id === d.id);
      if (curIdx < 0) return;
      const remaining = clips.filter((c) => c.id !== d.id);
      const xIn = timeFromClientX(e.clientX) - clipDur(clips[curIdx]) / 2;
      let insertAt = remaining.length;
      let acc = 0;
      for (let i = 0; i < remaining.length; i++) {
        const mid = acc + clipDur(remaining[i]) / 2;
        if (xIn < mid) {
          insertAt = i;
          break;
        }
        acc += clipDur(remaining[i]);
      }
      if (insertAt !== curIdx) {
        dispatch({ type: "REORDER_CLIP", from: curIdx, to: insertAt });
      }
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (d && d.mode === "move" && d.moved) toast("Klip sıralaması güncellendi");
    drag.current = null;
  };

  const addCaption = () => {
    if (totalDur === 0) {
      toast("Önce zaman çizelgesine klip ekleyin");
      return;
    }
    const start = clamp(seqPos, 0, Math.max(0, totalDur - 0.5));
    dispatch({
      type: "ADD_CAPTION",
      caption: { id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`, start, end: Math.min(start + 3, totalDur), text: "Yeni altyazı" },
    });
  };

  const ticks: number[] = [];
  const step = pps >= 22 ? 1 : pps >= 9 ? 2 : 5;
  for (let t = 0; t <= minSpan; t += step) ticks.push(t);

  const activeMediaId = findClipAt(state.clips, seqPos)?.clip.mediaId;

  return (
    <div className="flex h-full flex-col bg-bg1">
      {/* araç çubuğu */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="font-mono text-[10px] tracking-[0.22em] text-dim">ZAMAN ÇİZELGESİ</span>
        <span className="font-mono text-[10px] text-mut">Sekans 01</span>
        <button
          onClick={splitAtPlayhead}
          className="ml-3 flex h-6 items-center gap-1.5 rounded-[3px] border border-line px-2 font-mono text-[10px] text-mut transition-colors hover:border-amb/60 hover:text-amb"
          title="Oynatma başlığında böl (Ctrl+K)"
        >
          <Icon name="scissors" className="h-3 w-3" /> BÖL
        </button>
        <button
          onClick={() => {
            if (state.selClip) {
              dispatch({ type: "REMOVE_CLIP", id: state.selClip });
              toast("Klip silindi");
            } else toast("Önce bir klip seçin");
          }}
          className="flex h-6 items-center gap-1.5 rounded-[3px] border border-line px-2 font-mono text-[10px] text-mut transition-colors hover:border-rec/60 hover:text-rec"
          title="Seçili klibi sil (Delete)"
        >
          <Icon name="trash" className="h-3 w-3" /> SİL
        </button>
        <button
          onClick={addCaption}
          className="flex h-6 items-center gap-1.5 rounded-[3px] border border-line px-2 font-mono text-[10px] text-mut transition-colors hover:border-scope/60 hover:text-scope"
        >
          <Icon name="text" className="h-3 w-3" /> ALTYAZI
        </button>
        <span className="mx-1 hidden h-4 w-px bg-line sm:block" />
        <span className="hidden font-mono text-[9px] tracking-[0.18em] text-dim md:block">İÇERİĞE GÖRE:</span>
        <button
          onClick={() => void runSmart("silence")}
          disabled={!!smartBusy}
          title="Analizle bulunan ölü boşlukları (sessizlikleri) keser"
          className="flex h-6 items-center gap-1.5 rounded-[3px] border border-line px-2 font-mono text-[10px] text-mut transition-colors hover:border-amb/60 hover:text-amb disabled:opacity-40"
        >
          <Icon name="scissors" className="h-3 w-3" /> SESSİZLİK KES
        </button>
        <button
          onClick={() => void runSmart("scenes")}
          disabled={!!smartBusy}
          title="Histogram farkıyla bulunan sahne geçişlerinden böler"
          className="flex h-6 items-center gap-1.5 rounded-[3px] border border-line px-2 font-mono text-[10px] text-mut transition-colors hover:border-amb/60 hover:text-amb disabled:opacity-40"
        >
          <Icon name="film" className="h-3 w-3" /> SAHNE BÖL
        </button>
        <button
          onClick={() => void runSmart("beats")}
          disabled={!!smartBusy}
          title="Kesim noktalarını tespit edilen BPM ızgarasına oturtur"
          className="flex h-6 items-center gap-1.5 rounded-[3px] border border-line px-2 font-mono text-[10px] text-mut transition-colors hover:border-amb/60 hover:text-amb disabled:opacity-40"
        >
          <Icon name="wave" className="h-3 w-3" /> BEAT OTURT
        </button>
        {smartBusy && (
          <span className="pulse-dot font-mono text-[9px] tracking-wider text-amb">
            {smartBusy.includes(":") ? smartBusy.split(":")[1] : "analiz ediliyor"}…
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden font-mono text-[10px] text-dim sm:block">
            {state.clips.length} klip • {fmtShort(totalDur)}
          </span>
          <button
            onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.3).toFixed(2)))}
            className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-line font-mono text-[11px] text-mut transition-colors hover:text-amb"
            aria-label="Uzaklaş"
          >
            −
          </button>
          <span className="w-10 text-center font-mono text-[10px] tabular-nums text-mut">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(4, +(z + 0.3).toFixed(2)))}
            className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-line font-mono text-[11px] text-mut transition-colors hover:text-amb"
            aria-label="Yakınlaş"
          >
            +
          </button>
          <span className="mx-1 h-4 w-px bg-line" />
          <button
            onClick={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              dispatch({ type: "CLEAR_ALL" });
              setArmed(false);
              toast("Proje sıfırlandı");
            }}
            className={`flex h-6 items-center gap-1.5 rounded-[3px] border px-2 font-mono text-[10px] transition-colors ${
              armed ? "border-rec bg-rec/15 text-rec" : "border-line text-dim hover:border-rec/50 hover:text-rec"
            }`}
            title="Tüm zaman çizelgesini temizle"
          >
            <Icon name="x" className="h-3 w-3" /> {armed ? "EMİN MİSİN?" : "TEMİZLE"}
          </button>
        </div>
      </div>

      {/* cetvel + izler */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div
          ref={innerRef}
          className="relative h-full min-w-full select-none"
          style={{ width: width + LABEL_W }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* cetvel */}
          <div data-ruler className="sticky top-0 z-20 flex h-7 cursor-ew-resize border-b border-line bg-panel">
            <div className="sticky left-0 z-10 flex w-11 shrink-0 items-center justify-center border-r border-line font-mono text-[9px] text-dim">
              TC
            </div>
            <div className="relative flex-1">
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 h-full" style={{ left: t * pps }}>
                  <span className={`block w-px ${t % (step * 5) === 0 ? "h-full bg-line2" : "h-2 bg-line"}`} />
                  {t % (step * 5) === 0 && (
                    <span className="absolute left-1 top-0.5 font-mono text-[9px] tabular-nums text-dim">{fmtShort(t)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* V1 izi */}
          <div className="flex h-16 border-b border-line/60">
            <div className="sticky left-0 z-10 flex w-11 shrink-0 items-center justify-center border-r border-line bg-panel font-mono text-[10px] font-semibold text-mut">
              V1
            </div>
            <div className="relative flex-1" style={{ width }}>
              {state.clips.map((c, i) => {
                const m = mediaOf(c.mediaId);
                const start = cumStart(state.clips, i);
                const dur = clipDur(c);
                const isImg = m?.kind === "image";
                const isSel = state.selClip === c.id;
                const isActive = activeMediaId === c.mediaId;
                return (
                  <div
                    key={c.id}
                    data-clip={c.id}
                    className={`clip absolute bottom-1.5 top-1.5 cursor-grab overflow-hidden rounded-[3px] border transition-[filter,box-shadow] duration-150 active:cursor-grabbing ${
                      isSel ? "sel" : ""
                    }`}
                    style={{
                      left: start * pps,
                      width: Math.max(18, dur * pps),
                      background: isImg ? "rgba(59,214,176,.13)" : "rgba(255,180,60,.13)",
                      borderColor: isImg ? "rgba(59,214,176,.45)" : "rgba(255,180,60,.5)",
                    }}
                  >
                    {c.speed && Math.abs(c.speed - 1) > 0.001 && (
                      <span className="absolute right-1 top-0.5 z-[1] rounded-[2px] bg-bg0/85 px-1 font-mono text-[8px] font-bold tabular-nums text-amb">
                        {c.speed}×
                      </span>
                    )}
                    {!isImg && (
                      <span className="absolute inset-x-0 top-1 flex gap-[3px] px-1">
                        {Array.from({ length: Math.max(2, Math.min(14, Math.floor((dur * pps) / 10))) }, (_, k) => (
                          <span key={k} className="h-1 w-1 shrink-0 rounded-[1px] bg-amb/60" />
                        ))}
                      </span>
                    )}
                    {isImg && (
                      <span className="absolute right-1 top-1">
                        <Icon name="image" className="h-3 w-3 text-scope" />
                      </span>
                    )}
                    <span
                      className="absolute inset-x-0 bottom-0.5 flex items-baseline gap-1.5 px-1.5"
                    >
                      <span className={`truncate font-mono text-[9px] leading-none ${isImg ? "text-[#8fe9d2]" : "text-[#ffd48a]"}`}>
                        {m?.name ?? "…"}
                      </span>
                      {isActive && <span className="pulse-dot h-1 w-1 shrink-0 self-center rounded-full bg-amb" />}
                    </span>

                    {/* analiz katmanı: sahne çizgileri, sessizlik, beat */}
                    {(() => {
                      const an = state.analysis[c.mediaId];
                      if (!an || isImg) return null;
                      const seg = an.segments.find((sg) => {
                        const mid = (c.in + c.out) / 2;
                        return mid >= sg.start && mid < sg.end;
                      });
                      const badge = seg ? TYPE_BADGE[seg.type] : null;
                      return (
                        <>
                          {an.silence.map((sg, i) => {
                            const s = Math.max(sg.start, c.in);
                            const e = Math.min(sg.end, c.out);
                            if (e - s < 0.1) return null;
                            return (
                              <span
                                key={`si${i}`}
                                title="ölü boşluk"
                                className="pointer-events-none absolute bottom-0 top-0 bg-rec/25"
                                style={{ left: `${((s - c.in) / dur) * 100}%`, width: `${((e - s) / dur) * 100}%` }}
                              />
                            );
                          })}
                          {an.scenes
                            .filter((b) => b > c.in + 0.2 && b < c.out - 0.2)
                            .map((b) => (
                              <span
                                key={`sc${b}`}
                                title="sahne geçişi"
                                className="pointer-events-none absolute bottom-0 top-0 w-px bg-ink/70"
                                style={{ left: `${((b - c.in) / dur) * 100}%` }}
                              />
                            ))}
                          {an.beats
                            .filter((b) => b > c.in && b < c.out)
                            .slice(0, 48)
                            .map((b) => (
                              <span
                                key={`bt${b}`}
                                className="pointer-events-none absolute bottom-0 h-1.5 w-px bg-amb/50"
                                style={{ left: `${((b - c.in) / dur) * 100}%` }}
                              />
                            ))}
                          {badge && (
                            <span
                              title={TYPE_LABEL[seg!.type]}
                              className={`pointer-events-none absolute right-1 top-0.5 flex h-3 w-3 items-center justify-center rounded-[2px] font-mono text-[8px] font-bold ${badge.cls}`}
                            >
                              {badge.letter}
                            </span>
                          )}
                        </>
                      );
                    })()}

                    <span data-mode="trimL" className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-black/20 opacity-0 transition-opacity hover:opacity-100" />
                    <span data-mode="trimR" className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-black/20 opacity-0 transition-opacity hover:opacity-100" />
                  </div>
                );
              })}
              {state.clips.length === 0 && (
                <div className="flex h-full items-center px-3 font-mono text-[10px] tracking-[0.18em] text-dim">
                  ▸ MEDYA KUTUSUNDAKİ “+” İLE KLİP EKLEYİN
                </div>
              )}
            </div>
          </div>

          {/* grafik izi */}
          <div className="flex h-10 border-b border-line/60">
            <div className="sticky left-0 z-10 flex w-11 shrink-0 items-center justify-center border-r border-line bg-panel font-mono text-[10px] font-semibold text-amb">
              G1
            </div>
            <div className="relative flex-1" style={{ width }}>
              {state.layers.map((L) => {
                const isSel = state.selLayer === L.id;
                const tone =
                  L.kind === "title"
                    ? { bd: "rgba(255,180,60,.5)", bg: "rgba(255,180,60,.13)", tx: "#ffd48a" }
                    : L.kind === "lower"
                      ? { bd: "rgba(59,214,176,.45)", bg: "rgba(59,214,176,.12)", tx: "#8fe9d2" }
                      : { bd: "rgba(111,177,255,.45)", bg: "rgba(111,177,255,.12)", tx: "#a9cdff" };
                return (
                  <div
                    key={L.id}
                    data-layer={L.id}
                    className={`clip absolute bottom-1.5 top-1.5 cursor-pointer overflow-hidden rounded-[3px] border px-1.5 ${isSel ? "sel" : ""}`}
                    style={{
                      left: L.start * pps,
                      width: Math.max(24, (L.end - L.start) * pps),
                      background: tone.bg,
                      borderColor: tone.bd,
                    }}
                    title={`${L.name} (${fmtShort(L.start)}–${fmtShort(L.end)})`}
                  >
                    <span className="block truncate pt-1 font-mono text-[9px]" style={{ color: tone.tx }}>
                      {L.kind === "title" ? "◆" : L.kind === "lower" ? "▬" : "▸"} {L.text}
                    </span>
                    <span data-mode="layerL" className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" />
                    <span data-mode="layerR" className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" />
                  </div>
                );
              })}
              {state.layers.length === 0 && (
                <div className="flex h-full items-center px-3 font-mono text-[10px] tracking-[0.14em] text-dim">
                  ▸ GRAFİK YOK — AI KONSOLUNA “otomatik grafik” YAZIN
                </div>
              )}
            </div>
          </div>

          {/* altyazı izi */}
          <div className="flex h-10">
            <div className="sticky left-0 z-10 flex w-11 shrink-0 items-center justify-center border-r border-line bg-panel font-mono text-[10px] font-semibold text-mut">
              C1
            </div>
            <div className="relative flex-1" style={{ width }}>
              {state.captions.map((c) => {
                const isSel = state.selCaption === c.id;
                return (
                  <div
                    key={c.id}
                    data-cap={c.id}
                    className={`absolute bottom-1.5 top-1.5 cursor-pointer overflow-hidden rounded-[3px] border px-1.5 transition-colors ${
                      isSel ? "border-scope bg-scope/20" : "border-cue/40 bg-cue/10 hover:border-cue/70"
                    }`}
                    style={{ left: c.start * pps, width: Math.max(24, (c.end - c.start) * pps) }}
                  >
                    <span className="block truncate pt-0.5 font-mono text-[9px] text-[#a9cdff]">{c.text}</span>
                    <span data-mode="capL" className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" />
                    <span data-mode="capR" className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* SFX izi */}
          <div className="flex h-10 border-t border-line/60">
            <div className="sticky left-0 z-10 flex w-11 shrink-0 items-center justify-center border-r border-line bg-panel font-mono text-[10px] font-semibold text-rec">
              S1
            </div>
            <div className="relative flex-1" style={{ width }}>
              {state.sfx.map((it) => (
                <div
                  key={it.id}
                  data-sfx={it.id}
                  className="clip group absolute bottom-1.5 top-1.5 cursor-grab overflow-hidden rounded-[3px] border border-rec/50 bg-rec/12 px-1.5 active:cursor-grabbing"
                  style={{ left: it.start * pps, width: Math.max(20, it.dur * pps) }}
                  title={`${SFX_META[it.type].label} — ${fmtShort(it.start)} · sürükle: taşı, kenarlar: boyut`}
                >
                  <span className="flex items-center gap-1 pt-1">
                    <Icon name="wave" className="h-2.5 w-2.5 shrink-0 text-rec" />
                    <span className="truncate font-mono text-[9px] text-[#ffb0aa]">
                      {SFX_META[it.type].label}
                    </span>
                  </span>
                  <span className="pointer-events-none absolute inset-x-1 bottom-1 flex items-end gap-[2px] opacity-60">
                    {Array.from({ length: Math.max(3, Math.min(20, Math.floor((it.dur * pps) / 6))) }, (_, k) => (
                      <span key={k} className="h-[3px] min-w-0 flex-1 rounded-[1px] bg-rec/70" style={{ height: `${4 + ((k * 37) % 7)}px` }} />
                    ))}
                  </span>
                  <span data-mode="sfxL" className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" />
                  <span data-mode="sfxR" className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" />
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      dispatch({ type: "REMOVE_SFX", id: it.id });
                    }}
                    onPointerDown={(ev) => ev.stopPropagation()}
                    className="absolute right-0.5 top-0.5 hidden h-3.5 w-3.5 items-center justify-center rounded-[2px] bg-bg0/80 text-dim transition-colors hover:text-rec group-hover:flex"
                    title="Efekti sil"
                  >
                    <Icon name="x" className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              {state.sfx.length === 0 && (
                <div className="flex h-full items-center px-3 font-mono text-[10px] tracking-[0.14em] text-dim">
                  ▸ SES EFEKTİ YOK — “otomatik ses efekti” YA DA DENETÇİ KÜTÜPHANESİ
                </div>
              )}
            </div>
          </div>

          {/* oynatma başlığı */}
          <div className="pointer-events-none absolute bottom-0 top-0 z-30" style={{ left: LABEL_W + seqPos * pps }}>
            <span className="absolute -left-[5px] top-0 h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-amb" />
            <span className="absolute -left-px top-0 h-full w-[2px] bg-amb shadow-[0_0_8px_rgba(255,180,60,.7)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export { seqDuration };
