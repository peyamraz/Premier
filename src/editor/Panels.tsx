import { useMemo, useRef, useState } from "react";
import { Icon } from "../lib/ui";
import { TYPE_LABEL } from "./analysis";
import {
  listRoyaltyFreeMusic,
  searchRoyaltyFreeMusic,
  stopPreview,
  togglePreview,
  type StockTrack,
} from "./music";
import { PROCEDURAL_TRACKS, getProceduralUrl, type ProcKind, type ProcTrack } from "./bgm";
import { SFX_META, SFX_TYPES, previewSfx } from "./sfx";
import { dialogFallbackCaptions, mapChunksToSequence, regroupCaptions, transcribeAudio } from "./transcribe";
import { downloadSrt, parseSrt } from "./srt";
import {
  ANIMS,
  CAPTION_STYLES,
  CAPTION_STYLE_KEYS,
  EASINGS,
  FIT_LABEL,
  FPS,
  RATIOS,
  clipDur,
  cumStart,
  findClipAt,
  fmtShort,
  fmtTC,
  makeLayer,
  ratioToFrame,
  uid,
  VFX_LIST,
  VFX_META,
  type AnimType,
  type Caption,
  type Easing,
  type FitMode,
  type MediaItem,
  type VFX,
} from "./model";
import { useEditor } from "./state";
import { MagnatesPanel } from "./MagnatesPanel";

const sectionTitle = "font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-dim";
const toolBtn =
  "flex h-7 items-center gap-1.5 rounded-[3px] border border-line px-2 font-mono text-[10px] text-mut transition-colors hover:border-amb/60 hover:text-amb";

/* ================================================================== */
/* Medya kutusu                                                        */
/* ================================================================== */

export function MediaBin() {
  const { state, dispatch, addFiles, toast } = useEditor();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);

  const addToTimeline = (m: MediaItem) => {
    dispatch({
      type: "ADD_CLIP",
      clip: { id: uid(), mediaId: m.id, in: 0, out: m.duration > 0.1 ? m.duration : 5 },
    });
    toast(`“${m.name}” zaman çizelgesine eklendi`);
  };

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col transition-colors ${over ? "bg-amb/5" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void addFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="font-mono text-[10px] tracking-[0.22em] text-dim">MEDYA</span>
        <span className="font-mono text-[10px] text-mut">{state.media.length}</span>
        <button
          onClick={() => inputRef.current?.click()}
          className="ml-auto flex h-6 items-center gap-1.5 rounded-[3px] bg-amb px-2 font-mono text-[10px] font-bold text-bg0 transition-colors hover:bg-amb2"
        >
          <Icon name="upload" className="h-3 w-3" /> İÇE AKTAR
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*,image/*,.mp4,.webm,.mov,.mkv,.png,.jpg,.jpeg,.gif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto py-1">
        {state.media.map((m) => {
          const usedCount = state.clips.filter((c) => c.mediaId === m.id).length;
          return (
            <li key={m.id} className="group relative border-b border-line/50">
              <div className="flex items-center gap-2.5 px-2.5 py-2">
                <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-[3px] border border-line bg-black">
                  {m.thumb ? (
                    <img src={m.thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-dim">
                      <Icon name={m.kind === "video" ? "film" : "image"} className="h-4 w-4" />
                    </span>
                  )}
                  <span className="absolute bottom-0 right-0 bg-black/80 px-1 font-mono text-[8px] text-amb">
                    {fmtShort(m.duration)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[11px] text-ink" title={m.name}>
                    {m.name}
                  </p>
                  <p className="font-mono text-[9px] text-dim">
                    {m.kind === "video" ? "VİDEO" : "GÖRSEL"} • {m.width}×{m.height}
                    {usedCount > 0 && <span className="text-amb"> • {usedCount}×</span>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    onClick={() => addToTimeline(m)}
                    className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-line text-mut transition-colors hover:border-amb hover:bg-amb hover:text-bg0"
                    title="Zaman çizelgesine ekle"
                  >
                    <Icon name="plus" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      dispatch({ type: "REMOVE_MEDIA", id: m.id });
                      toast(`“${m.name}” kaldırıldı`);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-line text-mut transition-colors hover:border-rec hover:text-rec"
                    title="Medyayı sil"
                  >
                    <Icon name="trash" className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
        {state.media.length === 0 && (
          <li className="px-4 py-8 text-center">
            <Icon name="upload" className="mx-auto h-6 w-6 text-line2" />
            <p className="mt-2 font-mono text-[10px] leading-relaxed tracking-wider text-dim">
              DOSYALARI BURAYA BIRAKIN
              <br />
              VEYA İÇE AKTAR'A TIKLAYIN
            </p>
          </li>
        )}
      </ul>
    </div>
  );
}

/* ================================================================== */
/* Denetçi (inspector)                                                 */
/* ================================================================== */

function Slider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex justify-between font-mono text-[10px] text-dim">
        <span>{label}</span>
        <span className="tabular-nums text-amb">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range-amber mt-1 w-full"
      />
    </label>
  );
}

function AnalysisPanel({ an, name }: { an: import("./analysis").AnalysisResult; name: string }) {
  const dominant = an.segments.reduce(
    (acc, s) => {
      acc[s.type] = (acc[s.type] ?? 0) + (s.end - s.start);
      return acc;
    },
    {} as Record<string, number>,
  );
  const domType = (Object.entries(dominant).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "static") as "action" | "static" | "dialog";
  const silTotal = an.silence.reduce((a, s) => a + (s.end - s.start), 0);

  return (
    <section>
      <p className={`${sectionTitle} mb-2`}>Analiz Bulguları</p>
      <div className="rounded-[4px] border border-scope/30 bg-panel p-3">
        <p className="flex items-center gap-2 font-mono text-[10px] text-dim">
          <Icon name="wave" className="h-3 w-3 text-scope" />
          <span className="truncate">{name}</span>
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 font-mono text-[9.5px]">
          <span className="rounded-[3px] bg-bg0 px-1.5 py-1.5 text-center">
            <span className="block text-dim">TÜR</span>
            <span className={`font-bold ${domType === "action" ? "text-amb" : domType === "dialog" ? "text-scope" : "text-cue"}`}>
              {TYPE_LABEL[domType].toLocaleUpperCase("tr-TR")}
            </span>
          </span>
          <span className="rounded-[3px] bg-bg0 px-1.5 py-1.5 text-center">
            <span className="block text-dim">HAREKET</span>
            <span className="tabular-nums text-amb">%{an.motionAvg}</span>
          </span>
          <span className="rounded-[3px] bg-bg0 px-1.5 py-1.5 text-center">
            <span className="block text-dim">TEMPO</span>
            <span className="tabular-nums text-scope">{an.bpm ? `${an.bpm} BPM` : "—"}</span>
          </span>
          <span className="rounded-[3px] bg-bg0 px-1.5 py-1.5 text-center">
            <span className="block text-dim">SAHNE</span>
            <span className="tabular-nums text-ink">{an.scenes.length}</span>
          </span>
          <span className="rounded-[3px] bg-bg0 px-1.5 py-1.5 text-center">
            <span className="block text-dim">BOŞLUK</span>
            <span className="tabular-nums text-rec">{silTotal > 0.2 ? `${silTotal.toFixed(1)} sn` : "yok"}</span>
          </span>
          <span className="rounded-[3px] bg-bg0 px-1.5 py-1.5 text-center">
            <span className="block text-dim">BEAT</span>
            <span className="tabular-nums text-amb">{an.beats.length || "—"}</span>
          </span>
        </div>
        {an.bestFrame && an.bestFrame.thumb && (
          <div className="mt-2 flex items-center gap-2">
            <img src={an.bestFrame.thumb} alt="En iyi kare" className="h-12 w-20 rounded-[3px] border border-line object-cover" />
            <span className="font-mono text-[9px] leading-relaxed text-dim">
              EN İYİ KARE
              <br />
              <span className="text-amb">{fmtShort(an.bestFrame.time)}</span> — küçük resim adayı
            </span>
          </div>
        )}
        <p className="mt-2 border-t border-line pt-2 font-mono text-[9.5px] leading-relaxed text-mut">{an.colorNote}</p>
        <ul className="mt-1.5 space-y-1">
          {an.suggestions.map((s) => (
            <li key={s} className="flex gap-1.5 font-mono text-[9.5px] leading-snug text-dim">
              <span className="text-amb">▸</span> {s}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ================================================================== */
/* Çerçeve / Oran + Sığdırma                                           */
/* ================================================================== */

function RatioBox({ w, h, active }: { w: number; h: number; active: boolean }) {
  const max = 22;
  const scale = max / Math.max(w, h);
  return (
    <span
      className={`inline-block rounded-[2px] border transition-colors ${
        active ? "border-amb bg-amb/25" : "border-line2 bg-panel2"
      }`}
      style={{ width: w * scale, height: h * scale }}
    />
  );
}

function FramePanel() {
  const { state, dispatch, toast } = useEditor();
  const [cw, setCw] = useState(state.frame.w);
  const [ch, setCh] = useState(state.frame.h);
  const selClip = state.clips.find((c) => c.id === state.selClip) ?? null;

  const setRatio = (id: string) => {
    const fr = ratioToFrame(id);
    dispatch({ type: "SET_FRAME", frame: fr });
    setCw(fr.w);
    setCh(fr.h);
    toast(`Çerçeve ${id} (${fr.w}×${fr.h})`);
  };

  const applyCustom = () => {
    const w = Math.max(64, Math.min(7680, Math.round(cw) || 1920));
    const h = Math.max(64, Math.min(7680, Math.round(ch) || 1080));
    dispatch({ type: "SET_FRAME", frame: { ratio: `${w}:${h}`, w, h } });
    toast(`Özel çerçeve ${w}×${h}`);
  };

  const fit = (mode: FitMode) => dispatch({ type: "SET_FIT_MODE", mode });

  const patchSel = (patch: { scale?: number; tx?: number; ty?: number; fit?: FitMode }) => {
    if (selClip) dispatch({ type: "CLIP_TRANSFORM", id: selClip.id, patch });
  };

  return (
    <section>
      <p className={`${sectionTitle} mb-2`}>Çerçeve & Oran</p>
      <div className="space-y-2.5 rounded-[4px] border border-line bg-panel p-3">
        {/* oran hazır ayarları */}
        <div className="grid grid-cols-3 gap-1.5">
          {RATIOS.map((r) => (
            <button
              key={r.id}
              onClick={() => setRatio(r.id)}
              title={`${r.tag} — ${r.w}×${r.h}`}
              className={`group flex flex-col items-center gap-1 rounded-[4px] border px-1.5 py-2 transition-all ${
                state.frame.ratio === r.id
                  ? "border-amb bg-amb/10"
                  : "border-line bg-bg0 hover:border-line2 hover:bg-panel2"
              }`}
            >
              <RatioBox w={r.w} h={r.h} active={state.frame.ratio === r.id} />
              <span
                className={`font-mono text-[10px] font-semibold ${
                  state.frame.ratio === r.id ? "text-amb" : "text-mut group-hover:text-ink"
                }`}
              >
                {r.id}
              </span>
              <span className="font-mono text-[8px] leading-none text-dim">{r.tag}</span>
            </button>
          ))}
        </div>

        {/* özel boyut */}
        <div className="flex items-center gap-1.5">
          <input
            value={cw}
            onChange={(e) => setCw(Number(e.target.value) || 0)}
            className="h-7 w-0 min-w-0 flex-1 rounded-[3px] border border-line bg-bg0 px-2 text-center font-mono text-[11px] text-ink outline-none focus:border-amb/60"
            aria-label="Genişlik"
          />
          <span className="font-mono text-[10px] text-dim">×</span>
          <input
            value={ch}
            onChange={(e) => setCh(Number(e.target.value) || 0)}
            className="h-7 w-0 min-w-0 flex-1 rounded-[3px] border border-line bg-bg0 px-2 text-center font-mono text-[11px] text-ink outline-none focus:border-amb/60"
            aria-label="Yükseklik"
          />
          <button
            onClick={applyCustom}
            className="h-7 rounded-[3px] border border-line px-2.5 font-mono text-[10px] text-mut transition-colors hover:border-amb/60 hover:text-amb"
          >
            UYGULA
          </button>
        </div>

        {/* sığdırma modu */}
        <div>
          <p className="mb-1.5 font-mono text-[9px] tracking-[0.18em] text-dim">SIĞDIRMA</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(FIT_LABEL) as FitMode[]).map((m) => (
              <button
                key={m}
                onClick={() => fit(m)}
                title={m === "cover" ? "Çerçeveyi doldur, taşanı kes" : m === "contain" ? "Tamamını göster, kenar boşluk bırak" : "Çerçeveye göre ger"}
                className={`rounded-[3px] border py-1.5 font-mono text-[10px] transition-colors ${
                  state.fitMode === m
                    ? "border-scope bg-scope/12 text-scope"
                    : "border-line text-mut hover:border-line2 hover:text-ink"
                }`}
              >
                {FIT_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        {/* seçili klip konum/ölçek */}
        <div className="border-t border-line pt-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="font-mono text-[9px] tracking-[0.18em] text-dim">KLİP KONUM & ÖLÇEK</p>
            {selClip && (
              <button
                onClick={() => {
                  dispatch({ type: "RESET_TRANSFORM", id: selClip.id });
                  toast("Klip dönüşümü sıfırlandı");
                }}
                className="font-mono text-[8.5px] tracking-wider text-dim transition-colors hover:text-rec"
              >
                SIFIRLA
              </button>
            )}
          </div>
          {selClip ? (
            <div className="space-y-2">
              <Slider
                label="ÖLÇEK"
                value={selClip.scale ?? 100}
                min={50}
                max={250}
                unit="%"
                onChange={(v) => patchSel({ scale: v })}
              />
              <Slider
                label="YATAY"
                value={selClip.tx ?? 0}
                min={-50}
                max={50}
                unit="%"
                onChange={(v) => patchSel({ tx: v })}
              />
              <Slider
                label="DİKEY"
                value={selClip.ty ?? 0}
                min={-50}
                max={50}
                unit="%"
                onChange={(v) => patchSel({ ty: v })}
              />
            </div>
          ) : (
            <p className="font-mono text-[9.5px] leading-relaxed text-dim">
              Konum/ölçek için zaman çizelgesinde bir klip seçin.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* Video efektleri (VFX)                                               */
/* ================================================================== */

function EffectsPanel() {
  const { state, dispatch } = useEditor();
  const activeCount = VFX_LIST.filter((v) => state.effects[v]).length;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className={sectionTitle}>Video Efektleri</p>
        <span className="font-mono text-[9px] tabular-nums text-amb">{activeCount} aktif</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {VFX_LIST.map((v: VFX) => {
          const on = state.effects[v];
          return (
            <button
              key={v}
              onClick={() => dispatch({ type: "TOGGLE_VFX", vfx: v })}
              title={VFX_META[v].desc}
              className={`flex flex-col items-start gap-0.5 rounded-[4px] border px-2.5 py-2 text-left transition-all hover:-translate-y-0.5 ${
                on
                  ? "border-amb/60 bg-amb/10 shadow-[0_4px_16px_rgba(255,180,60,.08)]"
                  : "border-line bg-panel hover:border-line2"
              }`}
            >
              <span
                className={`font-mono text-[10px] font-semibold tracking-wide ${
                  on ? "text-amb" : "text-mut"
                }`}
              >
                {VFX_META[v].label}
              </span>
              <span className="truncate font-mono text-[8px] text-dim">{VFX_META[v].desc}</span>
              <span
                className={`mt-1 h-1 w-6 rounded-full transition-colors ${
                  on ? "bg-amb" : "bg-line2"
                }`}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function Inspector() {
  const { state, dispatch, seek, seqPos, splitAtPlayhead, setInAtPlayhead, setOutAtPlayhead, toast } = useEditor();
  const selClip = state.clips.find((c) => c.id === state.selClip) ?? null;
  const selIndex = selClip ? state.clips.findIndex((c) => c.id === selClip.id) : -1;
  const selMedia = selClip ? state.media.find((m) => m.id === selClip.mediaId) : null;
  const f = state.filters;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="font-mono text-[10px] tracking-[0.22em] text-dim">DENETÇİ</span>
        <span className="ml-auto font-mono text-[9px] text-dim">24 FPS • REC.709</span>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        {/* magnates stil stüdyosu */}
        <MagnatesPanel />

        {/* seçili klip */}
        <section>
          <p className={`${sectionTitle} mb-2`}>Seçili Klip</p>
          {selClip && selMedia ? (
            <div className="rounded-[4px] border border-line bg-panel p-3">
              <p className="flex items-center gap-2 font-mono text-[11px] text-ink">
                <Icon name={selMedia.kind === "video" ? "film" : "image"} className="h-3.5 w-3.5 text-amb" />
                <span className="truncate">{selMedia.name}</span>
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10px]">
                <span className="rounded-[3px] bg-bg0 px-2 py-1 text-center">
                  <span className="block text-dim">GİRİŞ</span>
                  <span className="tabular-nums text-scope">{fmtShort(selClip.in)}</span>
                </span>
                <span className="rounded-[3px] bg-bg0 px-2 py-1 text-center">
                  <span className="block text-dim">ÇIKIŞ</span>
                  <span className="tabular-nums text-rec">{fmtShort(selClip.out)}</span>
                </span>
                <span className="rounded-[3px] bg-bg0 px-2 py-1 text-center">
                  <span className="block text-dim">SÜRE</span>
                  <span className="tabular-nums text-amb">{fmtShort(clipDur(selClip))}</span>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button className={toolBtn} onClick={() => seek(cumStart(state.clips, selIndex))}>
                  <Icon name="chevronL" className="h-3 w-3" /> BAŞA GİT
                </button>
                <button className={toolBtn} onClick={setInAtPlayhead}>
                  GİRİŞ [I]
                </button>
                <button className={toolBtn} onClick={setOutAtPlayhead}>
                  ÇIKIŞ [O]
                </button>
                <button className={toolBtn} onClick={splitAtPlayhead}>
                  <Icon name="scissors" className="h-3 w-3" /> BÖL
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-[4px] border border-dashed border-line px-3 py-4 text-center font-mono text-[10px] leading-relaxed text-dim">
              ZAMAN ÇİZELGESİNDE BİR KLİP SEÇİN
            </p>
          )}
        </section>

        {/* analiz bulguları */}
        {selMedia && state.analysis[selMedia.id] && (
          <AnalysisPanel an={state.analysis[selMedia.id]} name={selMedia.name} />
        )}
        {!selMedia && state.media.length > 0 && Object.keys(state.analysis).length > 0 && (
          <AnalysisPanel an={Object.values(state.analysis)[0]} name={state.media.find((m) => m.id === Object.values(state.analysis)[0].mediaId)?.name ?? ""} />
        )}

        {/* çerçeve & oran */}
        <FramePanel />

        {/* görünüm */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className={sectionTitle}>Renk & Dönüştür</p>
            <button
              onClick={() => {
                dispatch({ type: "RESET_FILTERS" });
                toast("Renk ayarları sıfırlandı");
              }}
              className="font-mono text-[9px] tracking-wider text-dim transition-colors hover:text-rec"
            >
              SIFIRLA
            </button>
          </div>
          <div className="space-y-2.5 rounded-[4px] border border-line bg-panel p-3">
            <Slider label="PARLAKLIK" value={f.brightness} min={40} max={180} unit="%" onChange={(v) => dispatch({ type: "SET_FILTER", patch: { brightness: v } })} />
            <Slider label="KONTRAST" value={f.contrast} min={40} max={180} unit="%" onChange={(v) => dispatch({ type: "SET_FILTER", patch: { contrast: v } })} />
            <Slider label="DOYGUNLUK" value={f.saturate} min={0} max={200} unit="%" onChange={(v) => dispatch({ type: "SET_FILTER", patch: { saturate: v } })} />
            <Slider label="RENK TONU" value={f.hue} min={-90} max={90} unit="°" onChange={(v) => dispatch({ type: "SET_FILTER", patch: { hue: v } })} />
            <div className="flex gap-1.5 pt-1">
              <button
                className={toolBtn}
                onClick={() => dispatch({ type: "SET_FILTER", patch: { rotate: (f.rotate + 90) % 360 } })}
                title="90° döndür"
              >
                <Icon name="rotate" className="h-3.5 w-3.5" /> {f.rotate}°
              </button>
              <button
                className={`${toolBtn} ${f.flipH ? "border-amb text-amb" : ""}`}
                onClick={() => dispatch({ type: "SET_FILTER", patch: { flipH: !f.flipH } })}
                title="Yatay çevir"
              >
                <Icon name="flip" className="h-3.5 w-3.5" /> Y
              </button>
              <button
                className={`${toolBtn} ${f.flipV ? "border-amb text-amb" : ""}`}
                onClick={() => dispatch({ type: "SET_FILTER", patch: { flipV: !f.flipV } })}
                title="Dikey çevir"
              >
                <Icon name="flip" className="h-3.5 w-3.5 rotate-90" /> D
              </button>
            </div>
          </div>
        </section>

        {/* altyazılar */}
        <CaptionPanel />

        {/* hareketli grafikler */}
        <MotionGraphics />

        {/* ses efektleri */}
        <SfxPanel />

        {/* video efektleri */}
        <EffectsPanel />

        {/* stok müzik */}
        <MusicPanel />

        {/* kısayollar */}
        <section className="rounded-[4px] border border-line bg-panel p-3">
          <p className={`${sectionTitle} mb-2`}>Kısayollar</p>
          <ul className="space-y-1.5 font-mono text-[10px] text-mut">
            {[
              ["BOŞLUK", "oynat / durdur"],
              ["CTRL+K", "oynatma başlığında böl"],
              ["I / O", "giriş / çıkış işaretle"],
              ["← →", "kare adımı (Shift = 10)"],
              ["DELETE", "seçili klibi sil"],
            ].map(([k, v]) => (
              <li key={k} className="flex items-center gap-2">
                <span className="rounded-[3px] border border-line2 border-b-2 bg-bg0 px-1.5 py-0.5 text-[9px] text-amb">{k}</span>
                <span className="text-dim">{v}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Altyazılar — AI çıkarma + SRT içe/dışa + stiller                    */
/* ================================================================== */

const WORDS_OPTIONS = [2, 4, 6, 8, 12];

function CaptionPanel() {
  const { state, dispatch, toast } = useEditor();
  const [lang, setLang] = useState<string>("tr");
  const [wordsPer, setWordsPer] = useState(6);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  /* seçili kelime sayısıyla mevcut altyazıların kaç satıra ineceği (canlı önizleme) */
  const previewCount = useMemo(
    () => (state.captions.length ? regroupCaptions(state.captions, wordsPer).length : 0),
    [state.captions, wordsPer],
  );

  /* mevcut altyazıları seçili kelime sayısına göre yeniden böl */
  const regroupNow = () => {
    if (!state.captions.length) {
      toast("Bölünecek altyazı yok");
      return;
    }
    const caps = regroupCaptions(state.captions, wordsPer);
    if (caps.length === state.captions.length) {
      toast(`Zaten en çok ${wordsPer} kelime/satır`);
      return;
    }
    dispatch({ type: "SET_CAPTIONS", captions: caps });
    toast(`${state.captions.length} satır → ${caps.length} satır (${wordsPer} kelime/satır)`);
  };

  /* AI ile otomatik çıkarma */
  const autoExtract = async () => {
    if (busy) return;
    const videos = state.media.filter((m) => m.kind === "video");
    if (!videos.length) {
      toast("Önce video yükleyin");
      return;
    }
    setBusy(true);
    setProg("Hazırlanıyor…");
    try {
      let total = 0;
      const all: Caption[] = [];
      for (const m of videos) {
        setProg(`Ses çözülüyor — ${m.name}`);
        const r = await transcribeAudio(m.url, lang === "auto" ? null : lang === "tr" ? "turkish" : "english", (label) => {
          setProg(label);
        });
        if (r && r.chunks.length) {
          const caps = mapChunksToSequence(r.chunks, state.clips, m.id, wordsPer);
          all.push(...caps);
          total += caps.length;
          setProg(`${m.name}: ${caps.length} altyazı bulundu`);
        }
      }
      if (total > 0) {
        const merged = [...state.captions, ...all].sort((a, b) => a.start - b.start);
        dispatch({ type: "SET_CAPTIONS", captions: merged });
        toast(`${total} altyazı otomatik çıkarıldı`);
      } else {
        /* fallback: diyalog zamanlaması */
        const fb = dialogFallbackCaptions(state.clips, state.analysis);
        if (fb.length) {
          dispatch({ type: "SET_CAPTIONS", captions: [...state.captions, ...fb].sort((a, b) => a.start - b.start) });
          toast(`Konuşma algılanamadı — ${fb.length} zamanlama eklendi (elle yazın)`);
        } else {
          toast("Altyazı çıkarılamadı — ses yok ya da model yanıt vermedi");
        }
      }
    } finally {
      setBusy(false);
      setProg("");
    }
  };

  /* SRT içe aktar */
  const onSrtFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseSrt(String(reader.result ?? ""));
      if (!parsed.captions.length) {
        toast("SRT dosyasında altyazı bulunamadı");
        return;
      }
      const regrouped = regroupCaptions(parsed.captions, wordsPer);
      const merged = [...state.captions, ...regrouped].sort((a, b) => a.start - b.start);
      dispatch({ type: "SET_CAPTIONS", captions: merged });
      const note =
        regrouped.length !== parsed.captions.length
          ? ` — ${wordsPer} kelime/satıra bölündü (${regrouped.length} satır)`
          : "";
      toast(`${parsed.captions.length} altyazı içe aktarıldı${note}${parsed.skipped ? ` (${parsed.skipped} blok atlandı)` : ""}`);
    };
    reader.readAsText(file, "utf-8");
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className={sectionTitle}>Altyazılar ({state.captions.length})</p>
        {state.captions.length > 0 && (
          <button
            onClick={() => {
              dispatch({ type: "SET_CAPTIONS", captions: [] });
              toast("Tüm altyazılar temizlendi");
            }}
            className="font-mono text-[9px] tracking-wider text-dim transition-colors hover:text-rec"
          >
            TEMİZLE
          </button>
        )}
      </div>

      {/* araç çubuğu */}
      <div className="rounded-[4px] border border-amb/35 bg-amb/6 p-2.5">
        <div className="flex items-center gap-1.5">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            disabled={busy}
            className="h-7 rounded-[3px] border border-line bg-bg0 px-1.5 font-mono text-[10px] text-ink outline-none focus:border-amb disabled:opacity-40"
            aria-label="Altyazı dili"
          >
            <option value="tr">TR</option>
            <option value="en">EN</option>
            <option value="auto">OTO</option>
          </select>
          <button
            onClick={() => void autoExtract()}
            disabled={busy}
            className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[3px] bg-amb font-mono text-[10px] font-bold tracking-wider text-bg0 transition-all hover:bg-amb2 disabled:opacity-50"
          >
            <Icon name="text" className="h-3 w-3" /> AI İLE ÇIKAR
          </button>
        </div>
        {busy && (
          <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[9px] text-amb">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-amb" /> {prog || "çalışıyor"}…
          </p>
        )}
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-7 items-center justify-center gap-1.5 rounded-[3px] border border-line font-mono text-[10px] text-mut transition-colors hover:border-scope/60 hover:text-scope"
          >
            <Icon name="download" className="h-3 w-3 rotate-180" /> SRT YÜKLE
          </button>
          <button
            onClick={() => {
              if (!state.captions.length) {
                toast("İndirilecek altyazı yok");
                return;
              }
              downloadSrt(state.captions, state.name);
              toast("SRT dosyası indirildi");
            }}
            disabled={!state.captions.length}
            className="flex h-7 items-center justify-center gap-1.5 rounded-[3px] border border-line font-mono text-[10px] text-mut transition-colors hover:border-scope/60 hover:text-scope disabled:opacity-40"
          >
            <Icon name="download" className="h-3 w-3" /> SRT İNDİR
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".srt,.txt"
          className="hidden"
          onChange={(e) => {
            onSrtFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {/* satır başına kelime sayısı */}
        <div className="mt-1.5 rounded-[4px] border border-line bg-bg0/60 p-2">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9px] tracking-[0.18em] text-dim">KELİME / SATIR</p>
            <p className="font-mono text-[9px] tabular-nums text-mut">
              {state.captions.length
                ? `${state.captions.length} → ${previewCount} satır`
                : "SRT • AI • yeniden böl"}
            </p>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="flex flex-1 overflow-hidden rounded-[3px] border border-line">
              {WORDS_OPTIONS.map((n) => {
                const active = wordsPer === n;
                return (
                  <button
                    key={n}
                    onClick={() => setWordsPer(n)}
                    disabled={busy}
                    title={`Satır başına en çok ${n} kelime`}
                    className={`flex-1 py-1.5 font-mono text-[10px] tabular-nums transition-all active:translate-y-px disabled:opacity-40 ${
                      active
                        ? "bg-amb font-bold text-bg0 shadow-[inset_0_-2px_0_rgba(0,0,0,.25)]"
                        : "bg-bg0 text-mut hover:bg-panel hover:text-ink"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <button
              onClick={regroupNow}
              disabled={busy || !state.captions.length}
              title="Mevcut altyazıları seçili kelime sayısına göre yeniden böler"
              className="flex h-7 items-center gap-1.5 rounded-[3px] border border-scope/40 px-2 font-mono text-[10px] font-semibold text-scope transition-all hover:bg-scope/10 active:translate-y-px disabled:opacity-40"
            >
              <Icon name="scissors" className="h-3 w-3" /> YENİDEN BÖL
            </button>
          </div>
          <p className="mt-1.5 font-mono text-[8.5px] leading-relaxed text-dim">
            {wordsPer <= 2
              ? "Kinetik stil — kısa vurgular (TikTok/Shorts)"
              : wordsPer <= 4
                ? "Sosyal medya — hızlı okunur, 1–2 satır"
                : wordsPer <= 6
                  ? "Standart — YouTube için ideal"
                  : "Uzun satır — belgesel / röportaj"}
          </p>
        </div>
      </div>

      {/* stil seçici */}
      <div className="mt-2">
        <p className="mb-1.5 font-mono text-[9px] tracking-[0.18em] text-dim">STİL</p>
        <div className="grid grid-cols-3 gap-1.5">
          {CAPTION_STYLE_KEYS.map((k) => {
            const st = CAPTION_STYLES[k];
            const active = state.captionStyle === k;
            return (
              <button
                key={k}
                onClick={() => dispatch({ type: "SET_CAPTION_STYLE", style: k })}
                className={`rounded-[3px] border px-1 py-1.5 font-mono text-[9px] transition-all ${
                  active
                    ? "border-amb bg-amb/12 text-amb"
                    : "border-line bg-bg0 text-mut hover:border-line2 hover:text-ink"
                }`}
                style={active ? undefined : {}}
              >
                <span
                  className="mb-1 block truncate rounded-[2px] px-1 text-[9px] leading-relaxed"
                  style={{ color: st.fg, background: st.bg === "transparent" ? "#0b0e13" : st.bg, fontWeight: st.weight }}
                >
                  Aa
                </span>
                {st.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* liste */}
      {state.captions.length === 0 && !busy && (
        <p className="mt-2 rounded-[4px] border border-dashed border-line px-3 py-4 text-center font-mono text-[10px] leading-relaxed text-dim">
          “AI İLE ÇIKAR” KONUŞMAYI YAZIYA ÇEVİRİR
          <br />
          YA DA SRT DOSYASI YÜKLEYİN
        </p>
      )}
      <div className="mt-2 space-y-2">
        {state.captions.map((c) => {
          const isSel = state.selCaption === c.id;
          return (
            <div
              key={c.id}
              className={`rounded-[4px] border p-2.5 transition-colors ${
                isSel ? "border-scope/70 bg-scope/5" : "border-line bg-panel"
              }`}
              onClick={() => dispatch({ type: "SELECT_CAPTION", id: c.id })}
            >
              <input
                value={c.text}
                onChange={(e) => dispatch({ type: "UPDATE_CAPTION", id: c.id, patch: { text: e.target.value } })}
                className="w-full rounded-[3px] border border-line bg-bg0 px-2 py-1.5 font-sans text-[12px] text-ink outline-none transition-colors focus:border-scope"
                placeholder="Altyazı metni…"
              />
              <div className="mt-2 flex items-center gap-2">
                <label className="flex items-center gap-1 font-mono text-[9px] text-dim">
                  BAŞ
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    value={Math.round(c.start * 10) / 10}
                    onChange={(e) =>
                      dispatch({ type: "UPDATE_CAPTION", id: c.id, patch: { start: Math.max(0, Number(e.target.value) || 0) } })
                    }
                    className="w-14 rounded-[3px] border border-line bg-bg0 px-1.5 py-1 font-mono text-[10px] tabular-nums text-scope outline-none focus:border-scope"
                  />
                </label>
                <label className="flex items-center gap-1 font-mono text-[9px] text-dim">
                  BİT
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    value={Math.round(c.end * 10) / 10}
                    onChange={(e) =>
                      dispatch({ type: "UPDATE_CAPTION", id: c.id, patch: { end: Math.max(c.start + 0.2, Number(e.target.value) || 0) } })
                    }
                    className="w-14 rounded-[3px] border border-line bg-bg0 px-1.5 py-1 font-mono text-[10px] tabular-nums text-rec outline-none focus:border-scope"
                  />
                </label>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "REMOVE_CAPTION", id: c.id });
                    toast("Altyazı silindi");
                  }}
                  className="ml-auto flex h-6 w-6 items-center justify-center rounded-[3px] border border-line text-dim transition-colors hover:border-rec hover:text-rec"
                  title="Altyazıyı sil"
                >
                  <Icon name="trash" className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ================================================================== */
/* Hareketli grafikler (After Effects tarzı katman denetçisi)          */
/* ================================================================== */

const LAYER_COLORS = ["#EAE5D9", "#FFB43C", "#3BD6B0", "#6FB1FF", "#FF5449", "#FFFFFF", "#0B0E13"];

function EasingCurve({ easing }: { easing: Easing }) {
  const pts: string[] = [];
  const fn = EASINGS[easing].fn;
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const v = fn(t);
    pts.push(`${(4 + t * 112).toFixed(1)},${(38 - v * 28).toFixed(1)}`);
  }
  return (
    <svg viewBox="0 0 120 44" className="h-11 w-full rounded-[3px] border border-line bg-bg0" aria-hidden="true">
      <line x1="4" y1="38" x2="116" y2="38" stroke="#212a38" strokeWidth="1" />
      <line x1="4" y1="10" x2="116" y2="10" stroke="#212a38" strokeWidth="1" strokeDasharray="3 3" />
      <polyline points={pts.join(" ")} fill="none" stroke="#ffb43c" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="4" cy="38" r="2.4" fill="#3bd6b0" />
      <circle cx="116" cy="10" r="2.4" fill="#ff5449" />
    </svg>
  );
}

const selStyle =
  "w-full rounded-[3px] border border-line bg-bg0 px-2 py-1.5 font-mono text-[11px] text-ink outline-none transition-colors focus:border-amb";

export function MotionGraphics() {
  const { state, dispatch, seek, seqPos, toast } = useEditor();
  const sel = state.layers.find((l) => l.id === state.selLayer) ?? null;

  const add = (kind: "title" | "lower" | "text") => {
    const start = Math.max(0, Math.round(seqPos * 2) / 2);
    const label = kind === "title" ? "YENİ BAŞLIK" : kind === "lower" ? "Ad Soyad — Unvan" : "yeni metin…";
    const layer = makeLayer(kind, label, start, start + 4);
    dispatch({ type: "ADD_LAYER", layer });
    toast(`${layer.name} eklendi`);
  };

  const patch = (p: Partial<import("./model").MotionLayer>) => {
    if (sel) dispatch({ type: "UPDATE_LAYER", id: sel.id, patch: p });
  };

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <p className={sectionTitle}>Hareketli Grafik ({state.layers.length})</p>
        <span className="ml-auto font-mono text-[9px] tracking-wider text-dim">G1 İZİ</span>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-1.5">
        <button className={toolBtn + " justify-center"} onClick={() => add("title")}>
          <Icon name="text" className="h-3 w-3" /> BAŞLIK
        </button>
        <button className={toolBtn + " justify-center"} onClick={() => add("lower")}>
          <Icon name="film" className="h-3 w-3" /> BANT
        </button>
        <button className={toolBtn + " justify-center"} onClick={() => add("text")}>
          <Icon name="mic" className="h-3 w-3" /> METİN
        </button>
      </div>

      {state.layers.length === 0 && (
        <p className="rounded-[4px] border border-dashed border-line px-3 py-4 text-center font-mono text-[10px] leading-relaxed text-dim">
          KATMAN YOK — YUKARIDAN EKLEYİN
          <br />
          YA DA AI: “otomatik grafik”
        </p>
      )}

      <div className="space-y-1.5">
        {state.layers.map((L) => {
          const isSel = state.selLayer === L.id;
          const dot = L.kind === "title" ? "bg-amb" : L.kind === "lower" ? "bg-scope" : "bg-cue";
          return (
            <div
              key={L.id}
              onClick={() => {
                dispatch({ type: "SELECT_LAYER", id: L.id });
                seek(L.start);
              }}
              className={`group flex cursor-pointer items-center gap-2 rounded-[4px] border px-2.5 py-2 transition-colors ${
                isSel ? "border-amb/70 bg-amb/5" : "border-line bg-panel hover:border-line2"
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-[2px] ${dot}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[10.5px] text-ink">{L.text}</p>
                <p className="font-mono text-[9px] tabular-nums text-dim">
                  {fmtShort(L.start)}–{fmtShort(L.end)} • {ANIMS[L.animIn]}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: "REMOVE_LAYER", id: L.id });
                  toast("Katman silindi");
                }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border border-line text-dim opacity-0 transition-all hover:border-rec hover:text-rec group-hover:opacity-100"
                title="Katmanı sil"
              >
                <Icon name="trash" className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {sel && (
        <div className="mt-2.5 space-y-3 rounded-[4px] border border-amb/35 bg-panel p-3">
          <input
            value={sel.text}
            onChange={(e) => patch({ text: e.target.value })}
            className={selStyle}
            placeholder="Katman metni…"
          />

          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <Slider label="X KONUM" value={Math.round(sel.x)} min={0} max={100} unit="%" onChange={(v) => patch({ x: v })} />
            <Slider label="Y KONUM" value={Math.round(sel.y)} min={0} max={100} unit="%" onChange={(v) => patch({ y: v })} />
            <Slider label="PUNTO" value={Math.round(sel.size * 10) / 10} min={1} max={16} unit="%" onChange={(v) => patch({ size: v })} />
            <Slider label="OPAKLIK" value={Math.round(sel.opacity)} min={5} max={100} unit="%" onChange={(v) => patch({ opacity: v })} />
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 font-mono text-[9px] text-dim">
              BAŞ
              <input
                type="number"
                step={0.5}
                min={0}
                value={Math.round(sel.start * 10) / 10}
                onChange={(e) => patch({ start: Math.max(0, Number(e.target.value) || 0) })}
                className="w-14 rounded-[3px] border border-line bg-bg0 px-1.5 py-1 font-mono text-[10px] tabular-nums text-scope outline-none focus:border-amb"
              />
            </label>
            <label className="flex items-center gap-1 font-mono text-[9px] text-dim">
              BİT
              <input
                type="number"
                step={0.5}
                min={0}
                value={Math.round(sel.end * 10) / 10}
                onChange={(e) => patch({ end: Math.max(sel.start + 0.2, Number(e.target.value) || 0) })}
                className="w-14 rounded-[3px] border border-line bg-bg0 px-1.5 py-1 font-mono text-[10px] tabular-nums text-rec outline-none focus:border-amb"
              />
            </label>
            <label className="ml-auto flex items-center gap-1 font-mono text-[9px] text-dim">
              SÜRE
              <input
                type="number"
                step={0.1}
                min={0.1}
                max={3}
                value={Math.round(sel.animDur * 10) / 10}
                onChange={(e) => patch({ animDur: Math.min(3, Math.max(0.1, Number(e.target.value) || 0.5)) })}
                className="w-12 rounded-[3px] border border-line bg-bg0 px-1.5 py-1 font-mono text-[10px] tabular-nums text-amb outline-none focus:border-amb"
              />
            </label>
          </div>

          <div>
            <p className="mb-1 font-mono text-[9px] tracking-[0.18em] text-dim">RENK</p>
            <div className="flex gap-1.5">
              {LAYER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => patch({ color: c })}
                  aria-label={`Renk ${c}`}
                  className={`h-5 w-5 rounded-[3px] border transition-transform hover:scale-110 ${
                    sel.color === c ? "border-amb ring-1 ring-amb" : "border-line2"
                  }`}
                  style={{ background: c }}
                />
              ))}
              <button
                onClick={() => patch({ bg: sel.bg ? "" : "#0B0E13" })}
                className={`ml-auto h-5 rounded-[3px] border px-2 font-mono text-[8.5px] tracking-wider transition-colors ${
                  sel.bg ? "border-amb text-amb" : "border-line2 text-dim hover:text-mut"
                }`}
                title="Arka plan bandı"
              >
                BANT
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {(["display", "sans", "mono"] as const).map((fn) => (
              <button
                key={fn}
                onClick={() => patch({ font: fn })}
                className={`rounded-[3px] border py-1.5 font-mono text-[9.5px] uppercase tracking-wider transition-colors ${
                  sel.font === fn ? "border-amb bg-amb/12 text-amb" : "border-line text-mut hover:text-ink"
                }`}
              >
                {fn === "display" ? "Display" : fn === "sans" ? "Sans" : "Mono"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <label className="block">
              <span className="mb-1 block font-mono text-[9px] tracking-[0.18em] text-dim">GİRİŞ ANİMASYONU</span>
              <select value={sel.animIn} onChange={(e) => patch({ animIn: e.target.value as AnimType })} className={selStyle}>
                {(Object.keys(ANIMS) as AnimType[]).map((a) => (
                  <option key={a} value={a}>{ANIMS[a]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[9px] tracking-[0.18em] text-dim">ÇIKIŞ ANİMASYONU</span>
              <select value={sel.animOut} onChange={(e) => patch({ animOut: e.target.value as AnimType })} className={selStyle}>
                {(Object.keys(ANIMS) as AnimType[]).map((a) => (
                  <option key={a} value={a}>{ANIMS[a]}</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-[9px] tracking-[0.18em] text-dim">EASING EĞRİSİ</span>
              <span className="font-mono text-[9px] text-amb">{EASINGS[sel.easing].label}</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {(Object.keys(EASINGS) as Easing[]).map((e) => (
                <button
                  key={e}
                  onClick={() => patch({ easing: e })}
                  className={`rounded-[3px] border py-1 font-mono text-[8.5px] tracking-wide transition-colors ${
                    sel.easing === e ? "border-amb bg-amb/12 text-amb" : "border-line text-dim hover:text-mut"
                  }`}
                >
                  {e === "linear" ? "LINE" : e === "easeOut" ? "OUT" : e === "easeInOut" ? "IN-OUT" : e === "back" ? "BACK" : "BNC"}
                </button>
              ))}
            </div>
            <div className="mt-1.5">
              <EasingCurve easing={sel.easing} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ================================================================== */
/* Ses efektleri (S1)                                                  */
/* ================================================================== */

function SfxPanel() {
  const { state, dispatch, seqPos, totalDur, toast } = useEditor();
  const [previewing, setPreviewing] = useState<string | null>(null);

  const addAt = (type: (typeof SFX_TYPES)[number]) => {
    const start = totalDur > 0 ? Math.min(seqPos, Math.max(0, totalDur - 0.05)) : 0;
    dispatch({
      type: "ADD_SFX",
      item: {
        id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`,
        type,
        start,
        dur: SFX_META[type].dur,
        volume: 0.9,
      },
    });
    previewSfx(type);
    setPreviewing(type);
    window.setTimeout(() => setPreviewing((p) => (p === type ? null : p)), 600);
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className={sectionTitle}>Ses Efektleri ({state.sfx.length})</p>
        {state.sfx.length > 0 && (
          <button
            onClick={() => {
              dispatch({ type: "CLEAR_SFX" });
              toast("Tüm ses efektleri temizlendi");
            }}
            className="font-mono text-[9px] tracking-wider text-dim transition-colors hover:text-rec"
          >
            TEMİZLE
          </button>
        )}
      </div>

      <div className="rounded-[4px] border border-line bg-panel p-3">
        <p className="mb-2 font-mono text-[9px] leading-relaxed tracking-wider text-dim">
          KÜTÜPHANE — TIKLA: ÖNİZLE + OYNATMA BAŞLIĞINA EKLE
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {SFX_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => addAt(t)}
              title={`${SFX_META[t].label} — ${SFX_META[t].dur.toFixed(2)} sn`}
              className={`flex flex-col items-center gap-1 rounded-[3px] border px-1 py-2 transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(255,84,73,.15)] ${
                previewing === t
                  ? "border-rec bg-rec/15 text-rec"
                  : "border-line bg-bg0 text-mut hover:border-rec/60 hover:text-ink"
              }`}
            >
              <Icon name="wave" className={`h-3.5 w-3.5 ${previewing === t ? "pulse-dot" : ""}`} />
              <span className="font-mono text-[8.5px] tracking-wide">{SFX_META[t].label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 font-mono text-[9px] leading-relaxed text-dim">
          ▸ “otomatik ses efekti” — sahne tipine göre kendiliğinden yerleştirir
        </p>
      </div>

      {state.sfx.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {state.sfx.map((it) => (
            <div key={it.id} className="flex items-center gap-2 rounded-[4px] border border-line bg-panel px-2.5 py-2">
              <button
                onClick={() => previewSfx(it.type)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border border-line text-rec transition-colors hover:border-rec hover:bg-rec/10"
                title="Önizle"
              >
                <Icon name="play" className="ml-px h-3 w-3" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[10.5px] text-ink">{SFX_META[it.type].label}</p>
                <p className="font-mono text-[9px] text-dim">
                  {fmtShort(it.start)} · {it.dur.toFixed(2)} sn
                </p>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(it.volume * 100)}
                onChange={(e) =>
                  dispatch({ type: "UPDATE_SFX", id: it.id, patch: { volume: Number(e.target.value) / 100 } })
                }
                className="range-amber w-14"
                aria-label="Efekt sesi düzeyi"
              />
              <button
                onClick={() => dispatch({ type: "REMOVE_SFX", id: it.id })}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border border-line text-dim transition-colors hover:border-rec hover:text-rec"
                title="Sil"
              >
                <Icon name="trash" className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ================================================================== */
/* Stok / telifsiz müzik (Wikimedia Commons)                           */
/* ================================================================== */

function MusicPanel() {
  const { state, dispatch, toast } = useEditor();
  const [tracks, setTracks] = useState<StockTrack[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const load = async (fn: () => Promise<StockTrack[]>) => {
    setLoading(true);
    setError("");
    try {
      const r = await fn();
      setTracks(r);
      if (!r.length) setError("Sonuç bulunamadı — başka bir terim deneyin");
    } catch {
      setError("Müzik arşivine ulaşılamadı (ağ gerekli)");
    } finally {
      setLoading(false);
    }
  };

  const useAsBgm = (t: StockTrack) => {
    stopPreview();
    setPreviewUrl("");
    dispatch({ type: "SET_MUSIC", music: { url: t.url, title: t.title, artist: t.artist, volume: 0.55 } });
    toast(`Fon müziği: “${t.title}”`);
  };

  const [procBusy, setProcBusy] = useState<ProcKind | null>(null);
  const useProc = async (p: ProcTrack) => {
    if (procBusy) return;
    setProcBusy(p.kind);
    try {
      const url = await getProceduralUrl(p.kind);
      stopPreview();
      setPreviewUrl("");
      dispatch({ type: "SET_MUSIC", music: { url, title: p.title, artist: "FrameForge Motor", volume: 0.55 } });
      toast(`Fon müziği: “${p.title}” — dahili sentez, telifsiz`);
    } catch {
      toast("Sentez başarısız — tarayıcı WebAudio desteklemiyor olabilir");
    } finally {
      setProcBusy(null);
    }
  };

  return (
    <section>
      <p className={sectionTitle}>Stok Müzik</p>

      {/* aktif fon müziği */}
      {state.music && (
        <div className="mb-2 rounded-[4px] border border-amb/45 bg-amb/8 p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-amb/15 text-amb">
              <Icon name="music" className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[11px] font-semibold text-amb">{state.music.title}</p>
              <p className="truncate font-mono text-[9px] text-dim">
                {state.music.artist} • telifsiz • dışa aktarıma yakılır
              </p>
            </div>
            <button
              onClick={() => {
                dispatch({ type: "SET_MUSIC", music: null });
                toast("Fon müziği kaldırıldı");
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border border-line text-dim transition-colors hover:border-rec hover:text-rec"
              title="Fon müziğini kaldır"
            >
              <Icon name="x" className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-[9px] text-dim">SES</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(state.music.volume * 100)}
              onChange={(e) =>
                dispatch({
                  type: "SET_MUSIC",
                  music: state.music ? { ...state.music, volume: Number(e.target.value) / 100 } : null,
                })
              }
              className="range-amber flex-1"
              aria-label="Fon müziği sesi"
            />
            <span className="w-8 text-right font-mono text-[9px] tabular-nums text-amb">
              %{Math.round(state.music.volume * 100)}
            </span>
          </div>
        </div>
      )}

      {/* dahili motor — çevrimdışı, garantili çalışır */}
      <div className="mt-2 rounded-[4px] border border-scope/35 bg-scope/5 p-2.5">
        <p className="mb-2 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.18em] text-scope">
          <Icon name="bolt" className="h-3 w-3" /> DAHİLİ MOTOR — ÇEVRİMDIŞI HAZIR
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {PROCEDURAL_TRACKS.map((p) => (
            <button
              key={p.kind}
              onClick={() => void useProc(p)}
              disabled={procBusy === p.kind}
              title={p.desc}
              className="flex flex-col items-start gap-0.5 rounded-[3px] border border-line bg-bg0 px-2 py-2 text-left transition-all hover:-translate-y-0.5 hover:border-scope/70 hover:shadow-[0_6px_18px_rgba(59,214,176,.12)] disabled:opacity-50"
            >
              <span className="font-mono text-[9px] font-semibold leading-tight text-ink">{p.title}</span>
              <span className="font-mono text-[8px] text-dim">
                {p.bpm} BPM · {p.dur.toFixed(0)} sn
              </span>
              {procBusy === p.kind ? (
                <span className="pulse-dot font-mono text-[8px] text-scope">sentezleniyor…</span>
              ) : (
                <span className="font-mono text-[8px] text-scope">▸ kullan</span>
              )}
            </button>
          ))}
        </div>
        <p className="mt-1.5 font-mono text-[8.5px] leading-relaxed text-dim">
          Gerçek zamanlı sentez — ağ gerektirmez, dışa aktarıma yakılır.
        </p>
      </div>

      {/* arama */}
      <div className="mt-2 flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) void load(() => searchRoyaltyFreeMusic(query.trim()));
          }}
          placeholder="stok müzik ara… (örn. cinematic)"
          className="h-7 min-w-0 flex-1 rounded-[3px] border border-line bg-bg0 px-2 font-mono text-[10.5px] text-ink outline-none placeholder:text-dim focus:border-amb/60"
          aria-label="Stok müzik ara"
        />
        <button
          onClick={() => void load(() => searchRoyaltyFreeMusic(query.trim() || "music"))}
          disabled={loading}
          className="h-7 rounded-[3px] border border-line px-2.5 font-mono text-[10px] text-mut transition-colors hover:border-amb/60 hover:text-amb disabled:opacity-40"
        >
          ARA
        </button>
      </div>
      <button
        onClick={() => void load(listRoyaltyFreeMusic)}
        disabled={loading}
        className="mt-1.5 w-full rounded-[3px] border border-line py-1.5 font-mono text-[9.5px] tracking-[0.14em] text-dim transition-colors hover:border-scope/60 hover:text-scope disabled:opacity-40"
      >
        ▸ TELİFSİZ ARŞİVİ YÜKLE (CC-BY)
      </button>

      {/* liste */}
      {loading && (
        <p className="mt-2 flex items-center gap-2 font-mono text-[10px] text-dim">
          <span className="pulse-dot h-2 w-2 rounded-full bg-amb" /> arşiv taranıyor…
        </p>
      )}
      {!loading && error && <p className="mt-2 font-mono text-[10px] text-rec">{error}</p>}
      {!loading && tracks && tracks.length > 0 && (
        <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
          {tracks.map((t) => (
            <li
              key={t.url}
              className="flex items-center gap-2 rounded-[3px] border border-line bg-panel px-2 py-1.5 transition-colors hover:border-line2"
            >
              <button
                onClick={() => togglePreview(t.url, (p) => setPreviewUrl(p ? t.url : ""))}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border transition-colors ${
                  previewUrl === t.url
                    ? "border-amb bg-amb/15 text-amb"
                    : "border-line text-dim hover:border-amb/60 hover:text-amb"
                }`}
                title="Önizle / durdur"
              >
                <Icon name={previewUrl === t.url ? "pause" : "play"} className="ml-px h-3 w-3" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[10.5px] text-ink">{t.title}</p>
                <p className="truncate font-mono text-[8.5px] text-dim">
                  {t.artist} • {t.license} • {t.mime.includes("ogg") ? "OGG" : t.mime.replace("audio/", "").toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => useAsBgm(t)}
                className="shrink-0 rounded-[3px] border border-amb/50 px-2 py-1 font-mono text-[9px] font-bold tracking-wider text-amb transition-all hover:bg-amb hover:text-bg0"
                title="Fon müziği olarak kullan"
              >
                KULLAN
              </button>
            </li>
          ))}
        </ul>
      )}
      {!loading && !tracks && !error && (
        <p className="mt-2 font-mono text-[9px] leading-relaxed text-dim">
          ▸ Arşivden ya da aramayla telifsiz parça bul, “KULLAN” de — sekansla
          birlikte çalar ve dışa aktarıma işlenir.
        </p>
      )}
    </section>
  );
}

/* durum çubuğu için dışa aktarım */
export function useSeqInfo() {
  const { state, seqPos, totalDur } = useEditor();
  const hit = findClipAt(state.clips, seqPos);
  return { seqPos, totalDur, hit, fps: FPS, tc: fmtTC(seqPos) };
}
