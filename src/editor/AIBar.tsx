import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { Icon } from "../lib/ui";
import {
  SUGGESTIONS,
  executeCommand,
  type AgentStep,
  type AICtx,
  type LogKind,
  type LogLine,
} from "./ai";
import { clamp, uid } from "./model";
import { useEditor } from "./state";

interface AIBarProps {
  inputRef: MutableRefObject<HTMLInputElement | null>;
  onExport: () => void;
  onImport: () => void;
  onScanning: (b: boolean) => void;
}

const KIND_STYLE: Record<LogKind, string> = {
  user: "text-amb",
  ai: "text-mut",
  ok: "text-scope",
  warn: "text-rec",
};

const KIND_PREFIX: Record<LogKind, string> = {
  user: "❯",
  ai: "▸",
  ok: "✓",
  warn: "▲",
};

function AgentCard({ steps, onCancel }: { steps: AgentStep[]; onCancel: () => void }) {
  return (
    <div className="toast-in absolute bottom-full right-2 z-50 mb-2 w-80 max-w-[calc(100vw-16px)] rounded-[5px] border border-amb/40 bg-panel shadow-[0_24px_70px_rgba(0,0,0,.55)]">
      <div className="flex items-center gap-2.5 border-b border-line px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-[3px] bg-amb/15 text-amb">
          <Icon name="bolt" className="h-3.5 w-3.5" />
        </span>
        <div>
          <p className="font-display text-base leading-none tracking-[0.08em] text-ink">OTONOM KURGU</p>
          <p className="mt-0.5 font-mono text-[9px] tracking-[0.2em] text-dim">AJAN ÇALIŞIYOR…</p>
        </div>
        <span className="blink ml-auto h-2 w-2 rounded-full bg-rec" />
        <button
          onClick={onCancel}
          className="rounded-[3px] border border-line px-2 py-1 font-mono text-[9.5px] tracking-wider text-mut transition-colors hover:border-rec/60 hover:text-rec"
        >
          İPTAL
        </button>
      </div>
      <ul className="px-3 py-2.5">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5 py-[3.5px]">
            {s.status === "run" ? (
              <span className="flex h-3.5 w-3.5 items-center justify-center">
                <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-amb" />
              </span>
            ) : s.status === "done" ? (
              <Icon name="check" className="h-3.5 w-3.5 text-scope" />
            ) : s.status === "skip" ? (
              <Icon name="dash" className="h-3.5 w-3.5 text-dim" />
            ) : (
              <span className="mx-[3px] h-1.5 w-1.5 rounded-full bg-line2" />
            )}
            <span
              className={`font-mono text-[11px] ${
                s.status === "run" ? "text-ink" : s.status === "done" ? "text-mut" : "text-dim"
              }`}
            >
              {s.label}
            </span>
            {s.note && <span className="ml-auto font-mono text-[9.5px] text-amb">{s.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AIBar({ inputRef, onExport, onImport, onScanning }: AIBarProps) {
  const { state, dispatch, seqPos, playing, totalDur, togglePlay, pause, seek, splitAtPlayhead, toast } = useEditor();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [agent, setAgent] = useState<AgentStep[] | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const cancelRef = useRef(false);
  const logRef = useRef<HTMLDivElement | null>(null);
  const logOpenRef = useRef(false);

  /* canlı değerleri ref üzerinden taze tut (async komutlar sırasında) */
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const seqPosRef = useRef(seqPos);
  seqPosRef.current = seqPos;
  const totalDurRef = useRef(totalDur);
  totalDurRef.current = totalDur;

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, logOpen]);

  /* Ctrl+J — konsola odaklan */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputRef]);

  const log = useCallback((kind: LogKind, text: string) => {
    setLines((l) => [...l.slice(-48), { id: uid(), kind, text }]);
    logOpenRef.current = true;
    setLogOpen(true);
  }, []);

  const ctxRef = useRef<AICtx | null>(null);
  ctxRef.current = {
    getState: () => stateRef.current,
    dispatch,
    play: () => {
      if (!stateRef.current.clips.length) {
        log("warn", "Oynatılacak sekans boş — önce klip ekleyin");
        return;
      }
      if (!playingRef.current) togglePlay();
    },
    pause,
    seek,
    seekBy: (d) => seek(clamp(seqPosRef.current + d, 0, Math.max(0, totalDurRef.current))),
    splitAtPlayhead,
    importClick: onImport,
    openExport: onExport,
    toast,
    log,
    setAgent,
    onScanning,
    cancelRef,
  };

  const run = async (cmd: string) => {
    const text = cmd.trim();
    if (!text || busy) return;
    setValue("");
    setBusy(true);
    try {
      await executeCommand(text, ctxRef.current!);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="relative z-40 shrink-0 border-t-2 border-amb/25 bg-panel">
      {agent && <AgentCard steps={agent} onCancel={() => (cancelRef.current = true)} />}

      {/* komut satırı */}
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span
          className={`flex h-8 shrink-0 items-center gap-1.5 rounded-[3px] border px-2 font-mono text-[11px] font-bold tracking-wider ${
            busy ? "border-amb/60 bg-amb/10 text-amb" : "border-line bg-bg0 text-mut"
          }`}
        >
          <Icon name="bolt" className={`h-3.5 w-3.5 ${busy ? "pulse-dot text-amb" : "text-amb"}`} />
          AI
          <span className={`h-1.5 w-1.5 rounded-full ${busy ? "pulse-dot bg-amb" : "bg-scope"}`} />
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run(value);
            if (e.key === "Escape") (e.target as HTMLInputElement).blur();
          }}
          placeholder={`Komut yaz… örn. “sinematik renk”, “burada böl”, “otomatik kurgula”  ·  Ctrl+J`}
          disabled={busy}
          spellCheck={false}
          className="h-8 min-w-0 flex-1 rounded-[3px] border border-line bg-bg0 px-3 font-mono text-[12px] text-ink outline-none transition-colors placeholder:text-dim focus:border-amb/60 disabled:opacity-50"
          aria-label="AI komut satırı"
        />
        <button
          onClick={() => void run(value)}
          disabled={busy || !value.trim()}
          className="flex h-8 w-9 shrink-0 items-center justify-center rounded-[3px] bg-amb text-bg0 transition-all hover:bg-amb2 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Komutu çalıştır"
          title="Çalıştır (Enter)"
        >
          {busy ? <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-bg0" /> : <Icon name="play" className="ml-0.5 h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => {
            logOpenRef.current = !logOpen;
            setLogOpen(!logOpen);
          }}
          className={`hidden h-8 items-center gap-1.5 rounded-[3px] border px-2.5 font-mono text-[10px] tracking-wider transition-colors sm:flex ${
            logOpen ? "border-amb/50 text-amb" : "border-line text-dim hover:text-mut"
          }`}
        >
          <Icon name="text" className="h-3 w-3" /> GÜNLÜK
          {lines.length > 0 && <span className="text-amb">{lines.length}</span>}
        </button>
        <button
          onClick={() => {
            setLines([]);
            logOpenRef.current = false;
            setLogOpen(false);
          }}
          className="hidden h-8 items-center rounded-[3px] border border-line px-2 font-mono text-[10px] tracking-wider text-dim transition-colors hover:border-rec/50 hover:text-rec sm:flex"
          title="Günlüğü temizle"
        >
          <Icon name="trash" className="h-3 w-3" />
        </button>
      </div>

      {/* hazır komutlar */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="shrink-0 font-mono text-[9px] tracking-[0.2em] text-dim">HAZIR:</span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s.cmd}
            onClick={() => void run(s.cmd)}
            disabled={busy}
            className={`shrink-0 rounded-[3px] border px-2 py-1 font-mono text-[10px] tracking-wide transition-all hover:-translate-y-px disabled:opacity-40 ${
              s.cmd === "otomatik kurgula"
                ? "border-amb/50 bg-amb/8 text-amb hover:bg-amb/15 hover:shadow-[0_4px_16px_rgba(255,180,60,.2)]"
                : "border-line bg-bg0 text-mut hover:border-line2 hover:text-ink"
            }`}
          >
            {s.cmd === "otomatik kurgula" && <Icon name="bolt" className="mr-1 inline h-3 w-3" />}
            {s.label}
          </button>
        ))}
        <button
          onClick={() => void run("yardım")}
          className="ml-auto shrink-0 rounded-[3px] px-2 py-1 font-mono text-[10px] text-dim transition-colors hover:text-amb"
        >
          tüm komutlar →
        </button>
      </div>

      {/* AI günlüğü */}
      {logOpen && (
        <div
          ref={logRef}
          className="max-h-36 overflow-y-auto border-t border-line bg-bg1 px-3 py-2 font-mono text-[11px] leading-relaxed"
        >
          {lines.length === 0 ? (
            <p className="text-dim">▸ Günlük boş — bir komut çalıştırın.</p>
          ) : (
            lines.map((l) => (
              <p key={l.id} className={`${KIND_STYLE[l.kind]} animate-[toastIn_.25s_ease]`}>
                <span className="mr-1.5 opacity-70">{KIND_PREFIX[l.kind]}</span>
                {l.text}
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
}
