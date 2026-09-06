/* İçeriğe uygun kesme — gerçek analiz verisiyle çalışan saf fonksiyonlar */

import type { AnalysisMap } from "./analysis";
import { analyzeMedia } from "./analysis";
import type { Clip, MediaItem } from "./model";
import { MIN_CLIP, uid } from "./model";
import type { Action } from "./state";
import type { Dispatch } from "react";

/** Medya kutusundaki videoları tarar, eksik analizleri tamamlar. */
export async function ensureAnalysis(
  media: MediaItem[],
  existing: AnalysisMap,
  dispatch: Dispatch<Action>,
  prog: (label: string) => void,
): Promise<AnalysisMap> {
  const map: AnalysisMap = { ...existing };
  const targets = media.filter((m) => m.kind === "video" && !map[m.id]);
  let i = 0;
  for (const m of targets) {
    prog(`Analiz ${i + 1}/${targets.length} — ${m.name}`);
    const r = await analyzeMedia(m, () => {});
    map[m.id] = r;
    dispatch({ type: "SET_ANALYSIS_ENTRY", mediaId: m.id, result: r });
    i++;
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* 1) Ölü boşluk (sessizlik) kesme                                     */
/* ------------------------------------------------------------------ */

export function cutSilence(
  clips: Clip[],
  map: AnalysisMap,
): { clips: Clip[]; cuts: number; removedSec: number } {
  let cuts = 0;
  let removedSec = 0;
  const out: Clip[] = [];
  for (const c of clips) {
    const r = map[c.mediaId];
    if (!r || !r.silence.length) {
      out.push(c);
      continue;
    }
    const gaps: { s: number; e: number }[] = [];
    for (const sg of r.silence) {
      const s = Math.max(c.in, sg.start + 0.12);
      const e = Math.min(c.out, sg.end - 0.12);
      if (e - s >= 0.3) gaps.push({ s, e });
    }
    if (!gaps.length) {
      out.push(c);
      continue;
    }
    gaps.sort((a, b) => a.s - b.s);
    let cursor = c.in;
    const pieces: Clip[] = [];
    for (const g of gaps) {
      if (g.s - cursor >= MIN_CLIP) pieces.push({ ...c, id: uid(), in: cursor, out: g.s });
      removedSec += g.s - cursor >= 0 ? g.e - g.s : 0;
      cuts++;
      cursor = g.e;
    }
    if (c.out - cursor >= MIN_CLIP) pieces.push({ ...c, id: uid(), in: cursor, out: c.out });
    if (!pieces.length) pieces.push({ ...c });
    out.push(...pieces);
  }
  return { clips: out, cuts, removedSec };
}

/* ------------------------------------------------------------------ */
/* 2) Sahne geçişlerinden bölme                                        */
/* ------------------------------------------------------------------ */

export function splitScenes(
  clips: Clip[],
  map: AnalysisMap,
): { clips: Clip[]; splits: number } {
  let splits = 0;
  const out: Clip[] = [];
  for (const c of clips) {
    const r = map[c.mediaId];
    const pts = (r?.scenes ?? []).filter((t) => t > c.in + 0.25 && t < c.out - 0.25);
    if (!pts.length) {
      out.push(c);
      continue;
    }
    let cur: Clip = { ...c };
    for (const t of pts) {
      out.push({ ...cur, out: t });
      cur = { ...cur, id: uid(), in: t };
      splits++;
    }
    out.push(cur);
  }
  return { clips: out, splits };
}

/* ------------------------------------------------------------------ */
/* 3) Kesimleri beat ızgarasına oturtma                                */
/* ------------------------------------------------------------------ */

export function snapBeats(
  clips: Clip[],
  map: AnalysisMap,
): { clips: Clip[]; snaps: number } {
  let snaps = 0;
  const out = clips.map((c) => {
    const r = map[c.mediaId];
    if (!r?.beats?.length) return c;
    let best = c.out;
    let bd = 0.24;
    for (const b of r.beats) {
      if (b < c.in) continue;
      const d = Math.abs(b - c.out);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    if (best !== c.out && best > c.in + MIN_CLIP) {
      snaps++;
      return { ...c, out: best };
    }
    return c;
  });
  return { clips: out, snaps };
}
