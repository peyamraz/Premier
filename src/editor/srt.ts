/* SRT (SubRip) altyazı formatı — ayrıştırma, üretme, indirme */

import type { Caption } from "./model";
import { uid } from "./model";

/* ------------------------------------------------------------------ */
/* zaman kodları                                                       */
/* ------------------------------------------------------------------ */

/** "00:01:23,456" → saniye */
function parseTC(tc: string): number | null {
  const m = tc.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!m) return null;
  const ms = parseInt(m[4].padEnd(3, "0"), 10);
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) + ms / 1000;
}

/** saniye → "00:01:23,456" */
export function fmtSrtTC(sec: number): string {
  const s = Math.max(0, sec);
  const ms = Math.round((s % 1) * 1000);
  const ss = Math.floor(s) % 60;
  const mm = Math.floor(s / 60) % 60;
  const hh = Math.floor(s / 3600);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(hh)}:${p(mm)}:${p(ss)},${p(Math.min(ms, 999), 3)}`;
}

/* ------------------------------------------------------------------ */
/* ayrıştırma                                                          */
/* ------------------------------------------------------------------ */

export interface SrtParseResult {
  captions: Caption[];
  skipped: number;
}

export function parseSrt(text: string): SrtParseResult {
  const captions: Caption[] = [];
  let skipped = 0;

  /* BOM temizliği + CRLF normalizasyonu */
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const blocks = clean.split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    let start = 0;
    let found = false;

    /* satırlar içinde zaman satırını bul (bazı dosyalarda indeks satırı olmaz) */
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(
        /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/,
      );
      if (m) {
        const s = parseTC(m[1]);
        const e = parseTC(m[2]);
        if (s !== null && e !== null && e > s) {
          start = i;
          const textLines = lines.slice(i + 1);
          if (textLines.length) {
            captions.push({
              id: uid(),
              start: s,
              end: e,
              text: textLines
                .join(" ")
                .replace(/<[^>]+>/g, "") // basit HTML etiketlerini temizle
                .replace(/\{[^}]+\}/g, "") // SSA biçimli süsleri temizle
                .trim(),
            });
            found = true;
          }
        }
        break;
      }
    }
    if (!found) skipped++;
  }

  captions.sort((a, b) => a.start - b.start);
  return { captions, skipped };
}

/* ------------------------------------------------------------------ */
/* üretme                                                              */
/* ------------------------------------------------------------------ */

export function toSrt(captions: Caption[]): string {
  const sorted = [...captions].sort((a, b) => a.start - b.start);
  return (
    sorted
      .map((c, i) => `${i + 1}\n${fmtSrtTC(c.start)} --> ${fmtSrtTC(c.end)}\n${c.text.trim()}`)
      .join("\n\n") + "\n"
  );
}

/* ------------------------------------------------------------------ */
/* indirme                                                             */
/* ------------------------------------------------------------------ */

export function downloadSrt(captions: Caption[], baseName: string): void {
  const blob = new Blob(["\uFEFF" + toSrt(captions)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName || "altyazilar"}.srt`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
