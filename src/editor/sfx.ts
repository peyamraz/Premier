/* Tarayıcı içi SFX sentez motoru — OfflineAudioContext → WAV → data URL.
   Dış bağımlılık yok; efektler hem önizlemede çalar hem render'a yakılır. */

export const SFX_TYPES = [
  "whoosh",
  "riser",
  "hit",
  "pop",
  "click",
  "swish",
  "glitch",
  "ding",
  "subdrop",
  "drone",
  "boom",
] as const;

export type SFXType = (typeof SFX_TYPES)[number];

export const SFX_META: Record<SFXType, { label: string; dur: number }> = {
  whoosh: { label: "Süpürme", dur: 0.9 },
  riser: { label: "Yükseliş", dur: 1.6 },
  hit: { label: "Vuruş", dur: 0.4 },
  pop: { label: "Pop", dur: 0.16 },
  click: { label: "Tık", dur: 0.07 },
  swish: { label: "Hışırtı", dur: 0.7 },
  glitch: { label: "Glitch", dur: 0.6 },
  ding: { label: "Zil", dur: 1.1 },
  subdrop: { label: "Bas Düşüş", dur: 0.7 },
  drone: { label: "Drone", dur: 3 },
  boom: { label: "Gümbürtü", dur: 1.2 },
};

const cache = new Map<SFXType, string>();

function noiseBuffer(actx: BaseAudioContext, seconds = 2): AudioBuffer {
  const buf = actx.createBuffer(1, Math.floor(actx.sampleRate * seconds), actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function buildGraph(type: SFXType, actx: OfflineAudioContext, out: GainNode): void {
  const t0 = actx.currentTime + 0.01;
  const noise = () => {
    const s = actx.createBufferSource();
    s.buffer = noiseBuffer(actx);
    s.loop = true;
    return s;
  };
  const env = (a: number, peak: number, rel: number, dur: number) => {
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur - rel);
    g.connect(out);
    return g;
  };

  switch (type) {
    case "whoosh": {
      const g = env(0.22, 0.9, 0.3, 0.9);
      const bp = actx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(280, t0);
      bp.frequency.exponentialRampToValueAtTime(2600, t0 + 0.42);
      bp.frequency.exponentialRampToValueAtTime(320, t0 + 0.88);
      const n = noise();
      n.connect(bp);
      bp.connect(g);
      n.start(t0);
      n.stop(t0 + 0.95);
      break;
    }
    case "riser": {
      const g = env(1.3, 0.75, 0.2, 1.6);
      const hp = actx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(260, t0);
      hp.frequency.exponentialRampToValueAtTime(7200, t0 + 1.55);
      const n = noise();
      n.connect(hp);
      hp.connect(g);
      n.start(t0);
      n.stop(t0 + 1.6);
      const osc = actx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(70, t0);
      osc.frequency.exponentialRampToValueAtTime(420, t0 + 1.5);
      const og = actx.createGain();
      og.gain.setValueAtTime(0.0001, t0);
      og.gain.exponentialRampToValueAtTime(0.22, t0 + 1.4);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.58);
      osc.connect(og);
      og.connect(out);
      osc.start(t0);
      osc.stop(t0 + 1.6);
      break;
    }
    case "hit": {
      const g = env(0.008, 1, 0.3, 0.4);
      const osc = actx.createOscillator();
      osc.frequency.setValueAtTime(150, t0);
      osc.frequency.exponentialRampToValueAtTime(44, t0 + 0.28);
      osc.connect(g);
      osc.start(t0);
      osc.stop(t0 + 0.4);
      const bg = actx.createGain();
      bg.gain.setValueAtTime(0.5, t0);
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
      bg.connect(out);
      const lp = actx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      const n = noise();
      n.connect(lp);
      lp.connect(bg);
      n.start(t0);
      n.stop(t0 + 0.12);
      break;
    }
    case "pop": {
      const g = env(0.006, 0.85, 0.1, 0.16);
      const osc = actx.createOscillator();
      osc.frequency.setValueAtTime(720, t0);
      osc.frequency.exponentialRampToValueAtTime(190, t0 + 0.12);
      osc.connect(g);
      osc.start(t0);
      osc.stop(t0 + 0.16);
      break;
    }
    case "click": {
      const g = env(0.003, 0.7, 0.04, 0.07);
      const hp = actx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1200;
      const osc = actx.createOscillator();
      osc.type = "square";
      osc.frequency.value = 2300;
      osc.connect(hp);
      hp.connect(g);
      osc.start(t0);
      osc.stop(t0 + 0.07);
      break;
    }
    case "swish": {
      const g = env(0.18, 0.7, 0.2, 0.7);
      const hp = actx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(6400, t0);
      hp.frequency.exponentialRampToValueAtTime(700, t0 + 0.66);
      const n = noise();
      n.connect(hp);
      hp.connect(g);
      n.start(t0);
      n.stop(t0 + 0.7);
      break;
    }
    case "glitch": {
      const g = actx.createGain();
      g.gain.value = 0.55;
      g.connect(out);
      const hp = actx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 240;
      const osc = actx.createOscillator();
      osc.type = "square";
      const freqs = [820, 210, 1450, 320, 2100, 540, 1180, 260, 1700, 430, 900];
      const gates = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1];
      freqs.forEach((f, i) => osc.frequency.setValueAtTime(f, t0 + i * 0.05));
      const gg = actx.createGain();
      gates.forEach((v, i) => gg.gain.setValueAtTime(v * 0.9, t0 + i * 0.05));
      gg.gain.setValueAtTime(0.0001, t0 + 0.58);
      osc.connect(hp);
      hp.connect(gg);
      gg.connect(g);
      osc.start(t0);
      osc.stop(t0 + 0.6);
      break;
    }
    case "ding": {
      const g = env(0.005, 0.6, 0.9, 1.1);
      const o1 = actx.createOscillator();
      o1.frequency.value = 880;
      o1.connect(g);
      o1.start(t0);
      o1.stop(t0 + 1.1);
      const o2 = actx.createOscillator();
      o2.frequency.value = 1318;
      const g2 = actx.createGain();
      g2.gain.value = 0.3;
      o2.connect(g2);
      g2.connect(g);
      o2.start(t0);
      o2.stop(t0 + 1.1);
      break;
    }
    case "subdrop": {
      const g = env(0.02, 0.95, 0.45, 0.7);
      const osc = actx.createOscillator();
      osc.frequency.setValueAtTime(220, t0);
      osc.frequency.exponentialRampToValueAtTime(28, t0 + 0.5);
      osc.connect(g);
      osc.start(t0);
      osc.stop(t0 + 0.7);
      break;
    }
    case "drone": {
      const g = env(0.7, 0.4, 0.8, 3);
      const lp = actx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      lp.connect(g);
      for (const f of [55, 55.6, 110.3]) {
        const o = actx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        const og = actx.createGain();
        og.gain.value = f > 100 ? 0.25 : 0.5;
        o.connect(og);
        og.connect(lp);
        o.start(t0);
        o.stop(t0 + 3);
      }
      break;
    }
    case "boom": {
      const g = env(0.015, 1, 0.9, 1.2);
      const osc = actx.createOscillator();
      osc.frequency.setValueAtTime(95, t0);
      osc.frequency.exponentialRampToValueAtTime(27, t0 + 0.9);
      osc.connect(g);
      osc.start(t0);
      osc.stop(t0 + 1.2);
      const bg = actx.createGain();
      bg.gain.setValueAtTime(0.6, t0);
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      bg.connect(out);
      const lp = actx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 240;
      const n = noise();
      n.connect(lp);
      lp.connect(bg);
      n.start(t0);
      n.stop(t0 + 0.55);
      break;
    }
  }
}

function encodeWav(buffer: AudioBuffer): string {
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
  wStr(8, "WAVEfmt ");
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
  const R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
  let off = 44;
  for (let i = 0; i < len; i++) {
    const sl = Math.max(-1, Math.min(1, L[i]));
    const sr2 = Math.max(-1, Math.min(1, R[i]));
    v.setInt16(off, sl < 0 ? sl * 0x8000 : sl * 0x7fff, true);
    v.setInt16(off + 2, sr2 < 0 ? sr2 * 0x8000 : sr2 * 0x7fff, true);
    off += 4;
  }
  let bin = "";
  const u8 = new Uint8Array(ab);
  for (let i = 0; i < u8.length; i += 0x8000) {
    bin += String.fromCharCode(...Array.from(u8.subarray(i, i + 0x8000)));
  }
  return `data:audio/wav;base64,${btoa(bin)}`;
}

export async function getSfxUrl(type: SFXType): Promise<string> {
  const cached = cache.get(type);
  if (cached) return cached;
  const dur = SFX_META[type].dur + 0.05;
  const actx = new OfflineAudioContext(2, Math.ceil(44100 * dur), 44100);
  const out = actx.createGain();
  out.gain.value = 0.9;
  out.connect(actx.destination);
  buildGraph(type, actx, out);
  const rendered = await actx.startRendering();
  const url = encodeWav(rendered);
  cache.set(type, url);
  return url;
}

export function previewSfx(type: SFXType): void {
  void getSfxUrl(type).then((url) => {
    const a = new Audio(url);
    a.volume = 0.85;
    void a.play().catch(() => {});
  });
}
