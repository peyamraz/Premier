import { useRef, useState } from "react";
import { Icon } from "../lib/ui";
import {
  FPS,
  clipDur,
  cumStart,
  findClipAt,
  fmtShort,
  fmtTC,
  uid,
  type MediaItem,
} from "./model";
import { useEditor } from "./state";

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
        <section>
          <p className={`${sectionTitle} mb-2`}>Altyazılar ({state.captions.length})</p>
          {state.captions.length === 0 && (
            <p className="rounded-[4px] border border-dashed border-line px-3 py-4 text-center font-mono text-[10px] leading-relaxed text-dim">
              ZAMAN ÇİZELGESİ ARAÇ ÇUBUĞUNDAN
              <br />
              “ALTYAZI” İLE EKLEYİN
            </p>
          )}
          <div className="space-y-2">
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

/* durum çubuğu için dışa aktarım */
export function useSeqInfo() {
  const { state, seqPos, totalDur } = useEditor();
  const hit = findClipAt(state.clips, seqPos);
  return { seqPos, totalDur, hit, fps: FPS, tc: fmtTC(seqPos) };
}
