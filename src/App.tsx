import { useEffect, useRef, useState } from "react";
import { ExportModal } from "./editor/ExportModal";
import { Inspector, MediaBin } from "./editor/Panels";
import { Monitor } from "./editor/Monitor";
import { Timeline } from "./editor/Timeline";
import { fmtShort, fmtTC } from "./editor/model";
import { EditorProvider, useEditor } from "./editor/state";
import { Icon, useScramble } from "./lib/ui";

/* ------------------------------------------------------------------ */
/* boş durum — sürükle & bırak sahnesi                                 */
/* ------------------------------------------------------------------ */

function EmptyState() {
  const { addFiles } = useEditor();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const title = useScramble("KURGUYA BAŞLA");

  return (
    <div className="flex flex-1 items-center justify-center p-5">
      <div className="relative w-full max-w-2xl px-8 py-12 text-center md:py-16">
        {/* yürüyen karınca çerçeve */}
        <div aria-hidden="true" className="ants-frame pointer-events-none absolute inset-0 rounded-[6px]" />
        {/* köşe kertikleri */}
        {[
          "left-0 top-0 border-l-2 border-t-2",
          "right-0 top-0 border-r-2 border-t-2",
          "bottom-0 left-0 border-b-2 border-l-2",
          "bottom-0 right-0 border-b-2 border-r-2",
        ].map((c) => (
          <span key={c} aria-hidden="true" className={`absolute h-5 w-5 border-amb ${c}`} />
        ))}

        <p className="font-mono text-[10.5px] tracking-[0.3em] text-amb">
          FRAMEFORGE PRO 2026 — YEREL KURGU STÜDYOSU
        </p>
        <h1 className="mt-4 font-display text-6xl leading-none tracking-[0.02em] text-ink md:text-8xl">
          {title}
        </h1>
        <p className="mx-auto mt-5 max-w-md text-[14px] leading-relaxed text-mut">
          Videoları sürükleyip bırakın — her şey <em className="not-italic font-semibold text-ink">tarayıcınızda</em>{" "}
          işlenir, dosyalar cihazınızdan çıkmaz. Kesin, biçin, renklendirin, altyazı ekleyin ve tek tıkla dışa aktarın.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10.5px] tracking-[0.18em] text-dim">
          <span><b className="text-amb">01</b> YÜKLE</span>
          <span className="text-line2">▸▸</span>
          <span><b className="text-amb">02</b> KES &amp; BİÇ</span>
          <span className="text-line2">▸▸</span>
          <span><b className="text-amb">03</b> DIŞA AKTAR</span>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={() => inputRef.current?.click()}
            className="group flex items-center gap-3 rounded-[4px] bg-amb px-7 py-3.5 font-mono text-[13px] font-bold tracking-wider text-bg0 transition-all hover:bg-amb2 hover:shadow-[0_10px_36px_rgba(255,180,60,.3)]"
          >
            <Icon name="upload" className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
            VİDEO SEÇ
          </button>
          <div className="flex flex-wrap justify-center gap-1.5">
            {["MP4", "WEBM", "MOV", "MKV", "PNG", "JPEG", "GIF"].map((f) => (
              <span key={f} className="rounded-[3px] border border-line bg-panel/70 px-2 py-0.5 font-mono text-[9.5px] tracking-wider text-dim">
                {f}
              </span>
            ))}
          </div>
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
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* üst çubuk + durum çubuğu                                            */
/* ------------------------------------------------------------------ */

function TopBar({ onExport }: { onExport: () => void }) {
  const { state, dispatch, totalDur } = useEditor();

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-bg1 px-3 md:px-4">
      <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-amb text-bg0">
        <Icon name="play" className="ml-0.5 h-4 w-4" />
      </span>
      <span className="font-display text-xl leading-none tracking-[0.06em] text-ink">
        FRAMEFORGE <span className="text-amb">PRO</span>
      </span>
      <span className="hidden rounded-[3px] border border-scope/40 bg-scope/10 px-2 py-0.5 font-mono text-[9px] tracking-wider text-scope sm:block">
        2026 • YEREL
      </span>

      <div className="ml-2 flex min-w-0 items-center gap-1.5 border-l border-line pl-3 md:ml-4 md:pl-4">
        <Icon name="film" className="h-3.5 w-3.5 shrink-0 text-dim" />
        <input
          value={state.name}
          onChange={(e) => dispatch({ type: "SET_NAME", name: e.target.value })}
          className="w-32 min-w-0 border-b border-transparent bg-transparent font-mono text-[12px] text-ink outline-none transition-colors focus:border-amb md:w-44"
          aria-label="Proje adı"
          spellCheck={false}
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden font-mono text-[10.5px] tabular-nums text-dim lg:block">
          {state.clips.length} klip • {fmtShort(totalDur)} • 24 fps
        </span>
        <button
          onClick={onExport}
          disabled={state.clips.length === 0}
          className="flex h-8 items-center gap-2 rounded-[3px] bg-amb px-3.5 font-mono text-[11px] font-bold tracking-wider text-bg0 transition-all hover:bg-amb2 hover:shadow-[0_6px_24px_rgba(255,180,60,.28)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:shadow-none"
        >
          <Icon name="download" className="h-3.5 w-3.5" /> DIŞA AKTAR
        </button>
      </div>
    </header>
  );
}

function StatusBar() {
  const { state, seqPos, playing, totalDur, activeIndex } = useEditor();
  const activeClip = state.clips[activeIndex];
  const activeMedia = activeClip ? state.media.find((m) => m.id === activeClip.mediaId) : undefined;

  return (
    <div className="flex h-7 shrink-0 items-center gap-4 overflow-hidden border-t border-line bg-bg1 px-3 font-mono text-[10px] tracking-wider text-dim md:px-4">
      <span className={`flex items-center gap-1.5 ${playing ? "text-amb" : "text-scope"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${playing ? "pulse-dot bg-amb" : "bg-scope"}`} />
        {playing ? "OYNUYOR" : "HAZIR"}
      </span>
      <span className="hidden truncate sm:block">
        {activeMedia ? `V1 ▸ ${activeMedia.name}` : "MEDYA BEKLENİYOR"}
      </span>
      <span className="hidden md:block">RENDERER: CANVAS+GPU</span>
      <span className="ml-auto flex items-center gap-4">
        <span className="hidden sm:inline">WEBM • VP9</span>
        <span className="tabular-nums text-amb">
          {fmtTC(seqPos)} / {fmtTC(totalDur)}
        </span>
      </span>
    </div>
  );
}

function Toasts() {
  const { toasts } = useEditor();
  return (
    <div className="pointer-events-none fixed bottom-9 right-4 z-[110] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-in flex items-center gap-2.5 rounded-[4px] border border-line2 border-l-2 border-l-amb bg-panel px-3.5 py-2.5 font-mono text-[11px] text-ink shadow-[0_12px_36px_rgba(0,0,0,.5)]"
        >
          <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-amb" />
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* kabuk                                                               */
/* ------------------------------------------------------------------ */

function Shell() {
  const { state, addFiles, togglePlay, stepFrames, splitAtPlayhead, setInAtPlayhead, setOutAtPlayhead, dispatch } = useEditor();
  const [showExport, setShowExport] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragCount = useRef(0);
  const hasContent = state.media.length > 0;

  /* global sürükle-bırak */
  useEffect(() => {
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      dragCount.current++;
      setDragOver(true);
    };
    const onLeave = () => {
      dragCount.current = Math.max(0, dragCount.current - 1);
      if (dragCount.current === 0) setDragOver(false);
    };
    const onOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCount.current = 0;
      setDragOver(false);
      if (e.dataTransfer?.files.length) void addFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles]);

  /* klavye kısayolları */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        stepFrames(e.shiftKey ? -10 : -1);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        stepFrames(e.shiftKey ? 10 : 1);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        splitAtPlayhead();
      } else if (e.key === "i" || e.key === "I") {
        setInAtPlayhead();
      } else if (e.key === "o" || e.key === "O") {
        setOutAtPlayhead();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (state.selClip) dispatch({ type: "REMOVE_CLIP", id: state.selClip });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, stepFrames, splitAtPlayhead, setInAtPlayhead, setOutAtPlayhead, state.selClip, dispatch]);

  return (
    <div className="relative flex h-screen min-h-[560px] flex-col overflow-hidden bg-bg0">
      <TopBar onExport={() => setShowExport(true)} />

      {hasContent ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <aside className="order-2 flex min-h-0 flex-col border-b border-line lg:order-1 lg:w-64 lg:border-b-0 lg:border-r xl:w-72">
              <MediaBin />
            </aside>
            <main className="order-1 flex min-h-0 flex-1 flex-col lg:order-2">
              <Monitor />
            </main>
            <aside className="order-3 flex min-h-0 flex-col border-t border-line lg:w-72 lg:border-l lg:border-t-0 xl:w-80">
              <Inspector />
            </aside>
          </div>
          <section className="order-4 h-60 shrink-0 border-t border-line md:h-64">
            <Timeline />
          </section>
        </>
      ) : (
        <EmptyState />
      )}

      <StatusBar />

      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center bg-bg0/80 backdrop-blur-[2px]">
          <div className="ants-frame relative rounded-[6px] px-16 py-12 text-center">
            <Icon name="upload" className="mx-auto h-10 w-10 text-amb" />
            <p className="mt-3 font-display text-4xl tracking-wide text-ink">DOSYALARI BIRAKIN</p>
            <p className="mt-1 font-mono text-[11px] tracking-[0.2em] text-dim">VİDEO • GÖRSEL</p>
          </div>
        </div>
      )}

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <EditorProvider>
      <Shell />
    </EditorProvider>
  );
}
