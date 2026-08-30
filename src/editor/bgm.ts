/* Dahili prosedürel fon müziği motoru — çevrimdışı çalışır, telifsizdir.
   OfflineAudioContext ile gerçekten sentezlenir ve WAV olarak kodlanır. */

export type ProcKind = "ambiens" | "lofi" | "nabiz";

export interface ProcTrack {
  kind: ProcKind;
  title: string;
  desc: string;
  bpm: number;
  dur: number; // saniye
}

export const PROCEDURAL_TRACKS: ProcTrack[] = [
  { kind: "ambiens", title: "Amber Pad", desc: "Yavaş ambiyans pedi — diyalog ve röportaj altı", bpm: 60, dur: 24 },
  { kind: "lofi", title: "Kurgu Odası", desc: "Lo-fi beat — vlog ve sosyal medya ritmi", bpm: 84, dur: 22.86 },
  { kind: "nabiz", title: "Sinematik Nabız", desc: "Dört dörtlük vuruş — aksiyon ve tanıtım", bpm: 100, dur: 19.2 },
];

const cache = new Map<ProcKind, string>();

export async function getProceduralUrl(kind: ProcKind): Promise<string> {
  const hit = cache.get(kind);
  if (hit) return hit;
  const t = PROCEDURAL_TRACKS.find((p) => p.kind === kind)!;
  const buf = await render(kind, t);
  const url = toWavUrl(buf);
  cache.set(kind, url);
  return url;
}

/* ------------------------------------------------------------------ */
/* sentez                                                              */
/* ------------------------------------------------------------------ */

type Ctx = OfflineAudioContext;

function makeCtx(dur: number): Ctx {
  return new OfflineAudioContext(2, Math.ceil(44100 * dur), 44100);
}

function noiseBuffer(ctx: Ctx, dur: number): AudioBuffer {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function env(g: GainNode, t: number, a: number, peak: number, dec: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}

function kick(ctx: Ctx, t: number, dest: AudioNode, vol = 0.9) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  const g = ctx.createGain();
  env(g, t, 0.002, vol, 0.2);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.3);
}

function snare(ctx: Ctx, t: number, dest: AudioNode, vol = 0.5) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.2);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1900;
  bp.Q.value = 0.7;
  const g = ctx.createGain();
  env(g, t, 0.001, vol, 0.13);
  src.connect(bp).connect(g).connect(dest);
  src.start(t);
}

function hat(ctx: Ctx, t: number, dest: AudioNode, vol = 0.22, open = false) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, open ? 0.18 : 0.05);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 6800;
  const g = ctx.createGain();
  env(g, t, 0.001, vol, open ? 0.16 : 0.035);
  src.connect(hp).connect(g).connect(dest);
  src.start(t);
}

function tone(
  ctx: Ctx,
  t: number,
  freq: number,
  dur: number,
  dest: AudioNode,
  opts: { type?: OscillatorType; vol?: number; attack?: number; lp?: number; detune?: number } = {},
) {
  const o = ctx.createOscillator();
  o.type = opts.type ?? "triangle";
  o.frequency.value = freq;
  if (opts.detune) o.detune.value = opts.detune;
  const g = ctx.createGain();
  const a = opts.attack ?? 0.01;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.vol ?? 0.2), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = o;
  if (opts.lp) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = opts.lp;
    o.connect(f);
    node = f;
  }
  node.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const N = (semi: number) => 440 * Math.pow(2, (semi - 69) / 12); // midi → hz

async function render(kind: ProcKind, t: ProcTrack): Promise<AudioBuffer> {
  const ctx = makeCtx(t.dur);
  const master = ctx.createGain();
  master.gain.value = 0.82;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);

  if (kind === "ambiens") {
    /* yumuşak noise yatağı */
    const bed = ctx.createBufferSource();
    bed.buffer = noiseBuffer(ctx, t.dur);
    bed.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    const bg = ctx.createGain();
    bg.gain.value = 0.028;
    bed.connect(lp).connect(bg).connect(master);
    bed.start(0);

    /* ped akorları: Am — F — C — G */
    const chords = [
      [57, 60, 64],
      [53, 57, 60],
      [48, 52, 55],
      [55, 59, 62],
    ];
    chords.forEach((ch, i) => {
      const t0 = i * 6;
      for (const m of ch) {
        for (const det of [-7, 7]) {
          tone(ctx, t0, N(m), 6.4, master, { type: "sawtooth", vol: 0.055, attack: 1.6, lp: 780, detune: det });
        }
      }
    });
    /* pentatonik çınlamalar */
    const penta = [69, 72, 74, 76, 79, 81];
    for (let i = 0; i < 8; i++) {
      const tt = 1.2 + i * 2.9;
      tone(ctx, tt, N(penta[i % penta.length]) * 2, 2.4, master, { type: "sine", vol: 0.1, attack: 0.02, lp: 5000 });
    }
  }

  if (kind === "lofi") {
    const beat = 60 / t.bpm;
    const bars = 8;
    /* akorlar: i — VI — iii — VII (Am, F, C, G) ikişer bar */
    const prog = [
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [48, 52, 55, 59],
      [55, 59, 62, 65],
    ];
    for (let bar = 0; bar < bars; bar++) {
      const t0 = bar * 4 * beat;
      /* davul deseni */
      kick(ctx, t0, master, 0.85);
      kick(ctx, t0 + 2.5 * beat, master, 0.7);
      snare(ctx, t0 + 1 * beat, master, 0.4);
      snare(ctx, t0 + 3 * beat, master, 0.42);
      for (let h2 = 0; h2 < 8; h2++) {
        hat(ctx, t0 + h2 * 0.5 * beat, master, h2 % 2 ? 0.13 : 0.2, h2 === 7);
      }
      /* akor stabı */
      if (bar % 2 === 0) {
        const ch = prog[bar / 2];
        for (const m of ch) {
          tone(ctx, t0 + 0.02, N(m), 2 * 4 * beat * 0.92, master, { type: "triangle", vol: 0.075, attack: 0.03, lp: 1300 });
        }
      }
      /* bas */
      const root = prog[Math.floor(bar / 2)][0] - 12;
      tone(ctx, t0, N(root), 1.6 * beat, master, { type: "sine", vol: 0.3, attack: 0.01, lp: 300 });
      tone(ctx, t0 + 2.5 * beat, N(root), 1.2 * beat, master, { type: "sine", vol: 0.24, attack: 0.01, lp: 300 });
    }
    /* plak çıtırtısı */
    for (let i = 0; i < 90; i++) {
      const tt = Math.random() * t.dur;
      hat(ctx, tt, master, 0.02 + Math.random() * 0.02);
    }
  }

  if (kind === "nabiz") {
    const beat = 60 / t.bpm;
    const bars = 8;
    for (let bar = 0; bar < bars; bar++) {
      const t0 = bar * 4 * beat;
      for (let b = 0; b < 4; b++) {
        kick(ctx, t0 + b * beat, master, 0.95);
        hat(ctx, t0 + (b + 0.5) * beat, master, 0.16, true);
      }
      for (let s = 0; s < 16; s++) {
        hat(ctx, t0 + s * 0.25 * beat, master, s % 4 === 2 ? 0.1 : 0.05);
      }
      /* 16'lık bas puls */
      const root = bar < 4 ? N(33) : N(31);
      for (let s = 0; s < 16; s++) {
        tone(ctx, t0 + s * 0.25 * beat, root, 0.24 * beat, master, { type: "sawtooth", vol: s % 4 === 0 ? 0.2 : 0.11, attack: 0.005, lp: 520 });
      }
      /* pad */
      if (bar % 2 === 0) {
        const ch = bar < 4 ? [45, 48, 52] : [43, 47, 50];
        for (const m of ch) {
          tone(ctx, t0, N(m), 8 * beat, master, { type: "sawtooth", vol: 0.035, attack: 2.2, lp: 900, detune: 6 });
        }
      }
    }
  }

  return ctx.startRendering();
}

/* ------------------------------------------------------------------ */
/* WAV kodlama                                                         */
/* ------------------------------------------------------------------ */

function toWavUrl(buffer: AudioBuffer): string {
  const nCh = 2;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const bytes = 44 + len * nCh * 2;
  const ab = new ArrayBuffer(bytes);
  const v = new DataView(ab);
  const wStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  wStr(0, "RIFF");
  v.setUint32(4, bytes - 8, true);
  wStr(8, "WAVE");
  wStr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, nCh, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * nCh * 2, true);
  v.setUint16(32, nCh * 2, true);
  v.setUint16(34, 16, true);
  wStr(36, "data");
  v.setUint32(40, len * nCh * 2, true);
  const L = buffer.getChannelData(0);
  const R = buffer.getChannelData(1);
  let off = 44;
  for (let i = 0; i < len; i++) {
    const l = Math.max(-1, Math.min(1, L[i]));
    const r = Math.max(-1, Math.min(1, R[i]));
    v.setInt16(off, l * 32767, true);
    v.setInt16(off + 2, r * 32767, true);
    off += 4;
  }
  return URL.createObjectURL(new Blob([ab], { type: "audio/wav" }));
}
