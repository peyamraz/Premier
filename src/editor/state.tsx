import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_FILTERS,
  FPS,
  MIN_CLIP,
  clamp,
  clipDur,
  cumStart,
  findClipAt,
  seqDuration,
  uid,
  type Caption,
  type Clip,
  type Filters,
  type MediaItem,
  type MotionLayer,
} from "./model";
import type { AnalysisMap, AnalysisResult } from "./analysis";

/* ------------------------------------------------------------------ */
/* state                                                               */
/* ------------------------------------------------------------------ */

export interface ProjectState {
  name: string;
  media: MediaItem[];
  clips: Clip[];
  captions: Caption[];
  layers: MotionLayer[];
  analysis: AnalysisMap;
  filters: Filters;
  volume: number;
  muted: boolean;
  selClip: string | null;
  selCaption: string | null;
  selLayer: string | null;
}

export type Action =
  | { type: "ADD_MEDIA"; item: MediaItem }
  | { type: "UPDATE_MEDIA"; id: string; patch: Partial<MediaItem> }
  | { type: "REMOVE_MEDIA"; id: string }
  | { type: "ADD_CLIP"; clip: Clip }
  | { type: "REMOVE_CLIP"; id: string }
  | { type: "SPLIT_CLIP"; id: string; at: number }
  | { type: "TRIM_CLIP"; id: string; in?: number; out?: number }
  | { type: "REORDER_CLIP"; from: number; to: number }
  | { type: "SELECT_CLIP"; id: string | null }
  | { type: "ADD_CAPTION"; caption: Caption }
  | { type: "UPDATE_CAPTION"; id: string; patch: Partial<Caption> }
  | { type: "REMOVE_CAPTION"; id: string }
  | { type: "SELECT_CAPTION"; id: string | null }
  | { type: "SET_ANALYSIS_ENTRY"; mediaId: string; result: AnalysisResult }
  | { type: "CLEAR_ANALYSIS" }
  | { type: "ADD_LAYER"; layer: MotionLayer }
  | { type: "UPDATE_LAYER"; id: string; patch: Partial<MotionLayer> }
  | { type: "REMOVE_LAYER"; id: string }
  | { type: "SELECT_LAYER"; id: string | null }
  | { type: "SET_LAYERS"; layers: MotionLayer[] }
  | { type: "SET_FILTER"; patch: Partial<Filters> }
  | { type: "RESET_FILTERS" }
  | { type: "SET_VOLUME"; volume: number }
  | { type: "SET_MUTED"; muted: boolean }
  | { type: "SET_NAME"; name: string }
  | { type: "CLEAR_ALL" };

function reducer(s: ProjectState, a: Action): ProjectState {
  switch (a.type) {
    case "ADD_MEDIA":
      return { ...s, media: [...s.media, a.item] };
    case "UPDATE_MEDIA": {
      let changed = false;
      const media = s.media.map((m) => {
        if (m.id !== a.id) return m;
        const next = { ...m, ...a.patch };
        if (
          next.duration !== m.duration ||
          next.width !== m.width ||
          next.height !== m.height
        )
          changed = true;
        return next;
      });
      return changed ? { ...s, media } : s;
    }
    case "REMOVE_MEDIA": {
      const media = s.media.filter((m) => m.id !== a.id);
      const clips = s.clips.filter((c) => c.mediaId !== a.id);
      const selClip =
        s.selClip && clips.some((c) => c.id === s.selClip) ? s.selClip : null;
      return { ...s, media, clips, selClip };
    }
    case "ADD_CLIP":
      return { ...s, clips: [...s.clips, a.clip], selClip: a.clip.id };
    case "REMOVE_CLIP": {
      const clips = s.clips.filter((c) => c.id !== a.id);
      return { ...s, clips, selClip: s.selClip === a.id ? null : s.selClip };
    }
    case "SPLIT_CLIP": {
      const i = s.clips.findIndex((c) => c.id === a.id);
      if (i < 0) return s;
      const c = s.clips[i];
      const left: Clip = { ...c, out: a.at };
      const right: Clip = { ...c, id: uid(), in: a.at };
      const clips = [...s.clips.slice(0, i), left, right, ...s.clips.slice(i + 1)];
      return { ...s, clips, selClip: right.id };
    }
    case "TRIM_CLIP": {
      const clips = s.clips.map((c) => {
        if (c.id !== a.id) return c;
        const media = s.media.find((m) => m.id === c.mediaId);
        const max = media ? Math.max(media.duration, c.out) : c.out + 60;
        let inn = a.in !== undefined ? a.in : c.in;
        let out = a.out !== undefined ? a.out : c.out;
        inn = clamp(inn, 0, Math.max(0, max - MIN_CLIP));
        out = clamp(out, inn + MIN_CLIP, max);
        return { ...c, in: inn, out };
      });
      return { ...s, clips };
    }
    case "REORDER_CLIP": {
      if (a.from === a.to || a.from < 0 || a.from >= s.clips.length) return s;
      const clips = [...s.clips];
      const [c] = clips.splice(a.from, 1);
      clips.splice(clamp(a.to, 0, clips.length), 0, c);
      return { ...s, clips };
    }
    case "SELECT_CLIP":
      return { ...s, selClip: a.id, selCaption: a.id ? null : s.selCaption };
    case "ADD_CAPTION":
      return { ...s, captions: [...s.captions, a.caption].sort((x, y) => x.start - y.start), selCaption: a.caption.id, selClip: null };
    case "UPDATE_CAPTION": {
      const captions = s.captions.map((c) => (c.id === a.id ? { ...c, ...a.patch } : c));
      return { ...s, captions };
    }
    case "REMOVE_CAPTION":
      return {
        ...s,
        captions: s.captions.filter((c) => c.id !== a.id),
        selCaption: s.selCaption === a.id ? null : s.selCaption,
      };
    case "SELECT_CAPTION":
      return { ...s, selCaption: a.id, selClip: a.id ? null : s.selClip };
    case "SET_ANALYSIS_ENTRY":
      return { ...s, analysis: { ...s.analysis, [a.mediaId]: a.result } };
    case "CLEAR_ANALYSIS":
      return { ...s, analysis: {} };
    case "ADD_LAYER":
      return {
        ...s,
        layers: [...s.layers, a.layer].sort((p, q) => p.start - q.start),
        selLayer: a.layer.id,
        selClip: null,
        selCaption: null,
      };
    case "UPDATE_LAYER":
      return {
        ...s,
        layers: s.layers.map((l) => (l.id === a.id ? { ...l, ...a.patch } : l)),
      };
    case "REMOVE_LAYER":
      return {
        ...s,
        layers: s.layers.filter((l) => l.id !== a.id),
        selLayer: s.selLayer === a.id ? null : s.selLayer,
      };
    case "SELECT_LAYER":
      return {
        ...s,
        selLayer: a.id,
        selClip: a.id ? null : s.selClip,
        selCaption: a.id ? null : s.selCaption,
      };
    case "SET_LAYERS":
      return {
        ...s,
        layers: a.layers,
        selLayer: a.layers.length === 1 ? a.layers[0].id : null,
      };
    case "SET_FILTER":
      return { ...s, filters: { ...s.filters, ...a.patch } };
    case "RESET_FILTERS":
      return { ...s, filters: DEFAULT_FILTERS };
    case "SET_VOLUME":
      return { ...s, volume: clamp(a.volume, 0, 1), muted: false };
    case "SET_MUTED":
      return { ...s, muted: a.muted };
    case "SET_NAME":
      return { ...s, name: a.name };
    case "CLEAR_ALL":
      return {
        ...s,
        media: s.media.map((m) => {
          URL.revokeObjectURL(m.url);
          return m;
        }) && [],
        clips: [],
        captions: [],
        selClip: null,
        selCaption: null,
      };
    default:
      return s;
  }
}

const INITIAL: ProjectState = {
  name: "yeni_proje",
  media: [],
  clips: [],
  captions: [],
  layers: [],
  analysis: {},
  filters: DEFAULT_FILTERS,
  volume: 0.9,
  muted: false,
  selClip: null,
  selCaption: null,
  selLayer: null,
};

/* ------------------------------------------------------------------ */
/* medya incelemesi (prob)                                             */
/* ------------------------------------------------------------------ */

function probeVideo(
  url: string,
): Promise<{ duration: number; width: number; height: number; thumb?: string }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    const fail = window.setTimeout(() => {
      cleanup();
      reject(new Error("zaman aşımı"));
    }, 9000);
    const cleanup = () => {
      window.clearTimeout(fail);
      v.removeAttribute("src");
      v.load();
    };
    v.onloadedmetadata = () => {
      const duration = Number.isFinite(v.duration) ? v.duration : 0;
      const width = v.videoWidth || 1280;
      const height = v.videoHeight || 720;
      if (duration < 0.2) {
        cleanup();
        resolve({ duration, width, height });
        return;
      }
      v.currentTime = Math.min(0.5, duration / 2);
      v.onseeked = () => {
        let thumb: string | undefined;
        try {
          const c = document.createElement("canvas");
          c.width = 140;
          c.height = Math.max(2, Math.round((140 * height) / Math.max(1, width)));
          c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
          thumb = c.toDataURL("image/jpeg", 0.72);
        } catch {
          /* küçük resim yoksa sorun değil */
        }
        cleanup();
        resolve({ duration, width, height, thumb });
      };
      v.onerror = () => {
        cleanup();
        resolve({ duration, width, height });
      };
    };
    v.onerror = () => {
      cleanup();
      reject(new Error("okunamadı"));
    };
  });
}

function probeImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const fail = window.setTimeout(() => reject(new Error("zaman aşımı")), 9000);
    img.onload = () => {
      window.clearTimeout(fail);
      resolve({ width: img.naturalWidth || 1280, height: img.naturalHeight || 720 });
    };
    img.onerror = () => {
      window.clearTimeout(fail);
      reject(new Error("okunamadı"));
    };
    img.src = url;
  });
}

/* ------------------------------------------------------------------ */
/* context + motor                                                     */
/* ------------------------------------------------------------------ */

export interface Toast {
  id: string;
  msg: string;
}

interface EditorValue {
  state: ProjectState;
  dispatch: React.Dispatch<Action>;
  seqPos: number;
  playing: boolean;
  activeIndex: number;
  vu: { l: number; r: number };
  totalDur: number;
  togglePlay: () => void;
  pause: () => void;
  seek: (t: number) => void;
  stepFrames: (n: number) => void;
  splitAtPlayhead: () => void;
  setInAtPlayhead: () => void;
  setOutAtPlayhead: () => void;
  addFiles: (files: FileList | File[]) => Promise<void>;
  registerMediaEl: (id: string, el: HTMLVideoElement | null) => void;
  toasts: Toast[];
  toast: (msg: string) => void;
}

const Ctx = createContext<EditorValue | null>(null);

export function useEditor(): EditorValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("EditorProvider gerekli");
  return v;
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [seqPos, setSeqPosState] = useState(0);
  const seqPosRef = useRef(0);
  const [playing, setPlayingState] = useState(false);
  const playingRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeRef = useRef(0);
  const imageTime = useRef(0);
  const mediaEls = useRef<Record<string, HTMLVideoElement>>({});
  const [vu, setVu] = useState({ l: 0, r: 0 });
  const [toasts, setToasts] = useState<Toast[]>([]);

  const totalDur = useMemo(() => seqDuration(state.clips), [state.clips]);
  const totalDurRef = useRef(totalDur);
  totalDurRef.current = totalDur;

  const toast = useCallback((msg: string) => {
    const id = uid();
    setToasts((t) => [...t.slice(-3), { id, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const registerMediaEl = useCallback((id: string, el: HTMLVideoElement | null) => {
    if (el) mediaEls.current[id] = el;
    else delete mediaEls.current[id];
  }, []);

  const setSeq = useCallback((t: number) => {
    seqPosRef.current = t;
    setSeqPosState(t);
  }, []);

  const setupClip = useCallback(
    (index: number, offset = 0, autoplay = false) => {
      const s = stateRef.current;
      const clip = s.clips[index];
      if (!clip) return;
      activeRef.current = index;
      setActiveIndex(index);
      imageTime.current = offset;
      const media = s.media.find((m) => m.id === clip.mediaId);
      if (media?.kind === "video") {
        const el = mediaEls.current[media.id];
        if (el) {
          const t = clamp(clip.in + offset, 0, Math.max(clip.out, media.duration || clip.out));
          if (Math.abs(el.currentTime - t) > 0.02) {
            try {
              el.currentTime = t;
            } catch {
              /* metadata henüz yok */
            }
          }
          if (autoplay) void el.play().catch(() => {});
          else el.pause();
        }
      }
    },
    [],
  );

  const pauseEngine = useCallback(() => {
    playingRef.current = false;
    setPlayingState(false);
    const s = stateRef.current;
    const clip = s.clips[activeRef.current];
    if (clip) {
      const m = s.media.find((x) => x.id === clip.mediaId);
      if (m?.kind === "video") mediaEls.current[m.id]?.pause();
    }
    setVu({ l: 0, r: 0 });
  }, []);

  const advance = useCallback(() => {
    const s = stateRef.current;
    const next = activeRef.current + 1;
    if (next >= s.clips.length) {
      setSeq(totalDurRef.current);
      pauseEngine();
      return;
    }
    setupClip(next, 0, playingRef.current);
  }, [pauseEngine, setupClip, setSeq]);

  /* ana döngü */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const s = stateRef.current;
      if (playingRef.current && s.clips.length > 0) {
        const idx = activeRef.current;
        const clip = s.clips[idx];
        if (clip) {
          const media = s.media.find((m) => m.id === clip.mediaId);
          if (media?.kind === "video") {
            const el = mediaEls.current[media.id];
            if (el) {
              if (el.ended || el.currentTime >= clip.out - 0.045) advance();
              else setSeq(cumStart(s.clips, idx) + Math.max(0, el.currentTime - clip.in));
            }
          } else {
            imageTime.current += dt;
            const d = clipDur(clip);
            if (imageTime.current >= d) advance();
            else setSeq(cumStart(s.clips, idx) + imageTime.current);
          }
        }
        setVu({ l: 0.2 + Math.random() * 0.6, r: 0.15 + Math.random() * 0.55 });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [advance, setSeq]);

  const play = useCallback(() => {
    const s = stateRef.current;
    if (s.clips.length === 0) return;
    if (seqPosRef.current >= totalDurRef.current - 0.05) {
      setupClip(0, 0, false);
      setSeq(0);
    } else {
      const hit = findClipAt(s.clips, seqPosRef.current);
      if (hit) {
        if (hit.index !== activeRef.current) {
          setupClip(hit.index, hit.local, false);
        } else {
          imageTime.current = hit.local;
          const m = s.media.find((x) => x.id === hit.clip.mediaId);
          if (m?.kind === "video") {
            const el = mediaEls.current[m.id];
            const target = hit.clip.in + hit.local;
            if (el && Math.abs(el.currentTime - target) > 0.35) {
              try {
                el.currentTime = target;
              } catch {
                /* yoksay */
              }
            }
          }
        }
      }
    }
    playingRef.current = true;
    setPlayingState(true);
    const clip = stateRef.current.clips[activeRef.current];
    const m = clip && stateRef.current.media.find((x) => x.id === clip.mediaId);
    if (m?.kind === "video") void mediaEls.current[m.id]?.play().catch(() => {});
  }, [setupClip, setSeq]);

  const togglePlay = useCallback(() => {
    if (playingRef.current) pauseEngine();
    else play();
  }, [pauseEngine, play]);

  const seek = useCallback(
    (t: number) => {
      const s = stateRef.current;
      if (s.clips.length === 0) {
        setSeq(0);
        return;
      }
      const tt = clamp(t, 0, totalDurRef.current);
      const hit = findClipAt(s.clips, tt);
      if (!hit) return;
      setupClip(hit.index, hit.local, playingRef.current);
      setSeq(tt);
    },
    [setupClip, setSeq],
  );

  const stepFrames = useCallback(
    (n: number) => {
      if (playingRef.current) pauseEngine();
      seek(seqPosRef.current + n / FPS);
    },
    [pauseEngine, seek],
  );

  /* klip listesi değişince motoru hizala (bölme/silme/taşıma sonrası) */
  const firstClips = useRef(true);
  useEffect(() => {
    if (firstClips.current) {
      firstClips.current = false;
      return;
    }
    const s = stateRef.current;
    if (s.clips.length === 0) {
      activeRef.current = 0;
      setActiveIndex(0);
      setSeq(0);
      pauseEngine();
      return;
    }
    seek(clamp(seqPosRef.current, 0, totalDurRef.current));
  }, [state.clips, seek, setSeq, pauseEngine]);

  /* ses: yalnızca etkin klip duyulur */
  useEffect(() => {
    const activeMediaId = state.clips[activeIndex]?.mediaId;
    for (const m of state.media) {
      if (m.kind !== "video") continue;
      const el = mediaEls.current[m.id];
      if (!el) continue;
      el.volume = state.volume;
      el.muted = state.muted || m.id !== activeMediaId;
      if (m.id !== activeMediaId) el.pause();
    }
  }, [state.media, state.volume, state.muted, activeIndex, state.clips]);

  const splitAtPlayhead = useCallback(() => {
    const s = stateRef.current;
    const hit = findClipAt(s.clips, seqPosRef.current);
    if (!hit) return;
    if (hit.local < 0.1 || clipDur(hit.clip) - hit.local < 0.1) {
      toast("Bölmek için oynatma başlığını klip içine taşıyın");
      return;
    }
    dispatch({ type: "SPLIT_CLIP", id: hit.clip.id, at: hit.clip.in + hit.local });
    toast("Klip bölündü — Ctrl+Z yerine sil/birleştir kullanın");
  }, [toast]);

  const setInAtPlayhead = useCallback(() => {
    const s = stateRef.current;
    const hit = findClipAt(s.clips, seqPosRef.current);
    if (!hit) return;
    dispatch({ type: "TRIM_CLIP", id: hit.clip.id, in: hit.clip.in + hit.local });
    toast("Giriş noktası işaretlendi [I]");
  }, [toast]);

  const setOutAtPlayhead = useCallback(() => {
    const s = stateRef.current;
    const hit = findClipAt(s.clips, seqPosRef.current);
    if (!hit) return;
    dispatch({ type: "TRIM_CLIP", id: hit.clip.id, out: hit.clip.in + hit.local });
    toast("Çıkış noktası işaretlendi [O]");
  }, [toast]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      let added = 0;
      let skipped = 0;
      for (const f of arr) {
        const isVideo = f.type.startsWith("video/") || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(f.name);
        const isImage = f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif)$/i.test(f.name);
        if (!isVideo && !isImage) {
          skipped++;
          continue;
        }
        const url = URL.createObjectURL(f);
        if (isVideo) {
          const info = await probeVideo(url).catch(() => null);
          dispatch({
            type: "ADD_MEDIA",
            item: {
              id: uid(),
              kind: "video",
              name: f.name,
              url,
              duration: info?.duration ?? 0,
              width: info?.width ?? 1280,
              height: info?.height ?? 720,
              thumb: info?.thumb,
            },
          });
        } else {
          const info = await probeImage(url).catch(() => null);
          dispatch({
            type: "ADD_MEDIA",
            item: {
              id: uid(),
              kind: "image",
              name: f.name,
              url,
              duration: 5,
              width: info?.width ?? 1280,
              height: info?.height ?? 720,
              thumb: url,
            },
          });
        }
        added++;
      }
      if (added === 1) toast("1 dosya içe aktarıldı");
      else if (added > 1) toast(`${added} dosya içe aktarıldı`);
      if (skipped > 0) toast(`${skipped} dosya desteklenmedi`);
    },
    [toast],
  );

  const value: EditorValue = {
    state,
    dispatch,
    seqPos,
    playing,
    activeIndex,
    vu,
    totalDur,
    togglePlay,
    pause: pauseEngine,
    seek,
    stepFrames,
    splitAtPlayhead,
    setInAtPlayhead,
    setOutAtPlayhead,
    addFiles,
    registerMediaEl,
    toasts,
    toast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
