"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_SOUND, SOUNDS, clampVolume, nextSoundId, volumeGain } from "./sounds";

// Âm thanh nền tự tổng hợp bằng Web Audio API: không tải file, không gọi mạng, không bản quyền.

export interface AmbientState {
  playing: boolean;
  soundId: string;
  volume: number;
}

const KEY = "lumo.ambient.v1";
const SERVER_STATE: AmbientState = { playing: false, soundId: DEFAULT_SOUND, volume: 0.5 };
let state: AmbientState = SERVER_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as Partial<AmbientState>;
    state = {
      playing: false,
      soundId: SOUNDS.some((s) => s.id === p.soundId) ? String(p.soundId) : DEFAULT_SOUND,
      volume: clampVolume(typeof p.volume === "number" ? p.volume : 0.5),
    };
  } catch {
    /* dùng mặc định */
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ soundId: state.soundId, volume: state.volume }));
  } catch {
    /* bỏ qua */
  }
}

function set(patch: Partial<AmbientState>) {
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): AmbientState {
  load();
  return state;
}

export function useAmbient(): AmbientState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE);
}

// ---------- Bộ máy âm thanh ----------

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let active: Handle | null = null;
const buffers = new Map<string, AudioBuffer>();

interface Handle {
  stop: (fadeSec: number) => void;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
  }
  return ctx;
}

type NoiseKind = "white" | "pink" | "brown";

// Nhiễu lặp 8 giây, nối đầu cuối bằng crossfade đều công suất để không bị tiếng "tách" mỗi lần lặp.
function noiseBuffer(c: AudioContext, kind: NoiseKind): AudioBuffer {
  const hit = buffers.get(kind);
  if (hit) return hit;
  const sr = c.sampleRate;
  const len = Math.floor(sr * 8);
  const xf = Math.floor(sr * 0.25);
  const buf = c.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(len + xf);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0,
      last = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") {
        raw[i] = w;
      } else if (kind === "pink") {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        raw[i] = last * 3.5;
      }
    }
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      if (i < xf) {
        const t = (i / xf) * (Math.PI / 2);
        d[i] = raw[i] * Math.sin(t) + raw[len + i] * Math.cos(t);
      } else {
        d[i] = raw[i];
      }
    }
  }
  buffers.set(kind, buf);
  return buf;
}

function build(c: AudioContext, out: AudioNode, id: string): Handle {
  const bus = c.createGain();
  bus.gain.value = 0;
  bus.connect(out);
  bus.gain.setTargetAtTime(1, c.currentTime, 0.25);

  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [bus];
  const stoppers: Array<() => void> = [];

  const track = <T extends AudioNode>(n: T): T => {
    nodes.push(n);
    return n;
  };
  const chain = (...n: AudioNode[]) => {
    for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]);
  };
  const loop = (kind: NoiseKind) => {
    const b = noiseBuffer(c, kind);
    const s = c.createBufferSource();
    s.buffer = b;
    s.loop = true;
    s.start(0, Math.random() * b.duration);
    sources.push(s);
    nodes.push(s);
    return s;
  };
  const filt = (type: BiquadFilterType, freq: number, q = 0.7) => {
    const f = track(c.createBiquadFilter());
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };
  const gain = (v: number) => {
    const g = track(c.createGain());
    g.gain.value = v;
    return g;
  };
  const lfo = (hz: number, depth: number, target: AudioParam) => {
    const o = c.createOscillator();
    o.frequency.value = hz;
    const g = track(c.createGain());
    g.gain.value = depth;
    o.connect(g);
    g.connect(target);
    o.start();
    sources.push(o);
    nodes.push(o);
  };
  const every = (min: number, max: number, fn: () => void) => {
    let timer = 0;
    let dead = false;
    const tick = () => {
      if (dead) return;
      fn();
      timer = window.setTimeout(tick, min + Math.random() * (max - min));
    };
    timer = window.setTimeout(tick, min);
    stoppers.push(() => {
      dead = true;
      window.clearTimeout(timer);
    });
  };
  // Tiếng "tách" ngắn: một đoạn nhiễu trắng qua bộ lọc, to lên nhanh rồi tắt dần.
  const burst = (type: BiquadFilterType, freq: number, q: number, peak: number, attack: number, decay: number) => {
    const b = noiseBuffer(c, "white");
    const s = c.createBufferSource();
    s.buffer = b;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = 0;
    s.connect(f);
    f.connect(g);
    g.connect(bus);
    const t = c.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    s.start(t, Math.random() * (b.duration - 1));
    s.stop(t + attack + decay + 0.05);
    s.onended = () => {
      s.disconnect();
      f.disconnect();
      g.disconnect();
    };
  };
  // Tiếng "leng keng" của ly tách.
  const ping = (freq: number, peak: number, decay: number, delay = 0) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = 0;
    o.connect(g);
    g.connect(bus);
    const t = c.currentTime + delay;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.start(t);
    o.stop(t + decay + 0.05);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  };

  switch (id) {
    case "pink":
      chain(loop("pink"), gain(0.7), bus);
      break;
    case "rain": {
      chain(loop("pink"), filt("highpass", 500), filt("lowpass", 7000), gain(0.5), bus);
      chain(loop("brown"), filt("lowpass", 220), gain(0.25), bus);
      every(35, 130, () =>
        burst("bandpass", 1800 + Math.random() * 3500, 2.5, 0.02 + Math.random() * 0.06, 0.003, 0.03 + Math.random() * 0.04)
      );
      break;
    }
    case "cafe": {
      const g1 = gain(0.5);
      chain(loop("pink"), filt("bandpass", 650, 0.8), g1, bus);
      lfo(0.21, 0.25, g1.gain);
      const g2 = gain(0.3);
      chain(loop("pink"), filt("bandpass", 1400, 1.0), g2, bus);
      lfo(0.33, 0.2, g2.gain);
      chain(loop("brown"), filt("lowpass", 300), gain(0.35), bus);
      every(2500, 8000, () => {
        const f = 2600 + Math.random() * 1600;
        ping(f, 0.05, 0.35);
        if (Math.random() < 0.5) ping(f * 1.5, 0.03, 0.25, 0.07);
      });
      break;
    }
    case "waves": {
      const lp = filt("lowpass", 600);
      const a = gain(0.55);
      chain(loop("pink"), lp, a, bus);
      lfo(0.11, 0.35, a.gain);
      lfo(0.047, 0.15, a.gain);
      lfo(0.11, 450, lp.frequency);
      break;
    }
    case "fire": {
      chain(loop("brown"), filt("lowpass", 500), gain(0.55), bus);
      chain(loop("pink"), filt("bandpass", 3000, 0.6), gain(0.05), bus);
      every(40, 420, () => {
        const big = Math.random() < 0.12;
        burst(
          "highpass",
          1200 + Math.random() * 2500,
          0.7,
          big ? 0.28 : 0.05 + Math.random() * 0.12,
          0.002,
          big ? 0.07 : 0.015 + Math.random() * 0.03
        );
      });
      break;
    }
    default:
      chain(loop("brown"), filt("lowpass", 1200), gain(0.9), bus);
  }

  return {
    stop(fade) {
      stoppers.forEach((f) => f());
      bus.gain.setTargetAtTime(0, c.currentTime, fade / 4);
      window.setTimeout(() => {
        sources.forEach((s) => {
          try {
            s.stop();
          } catch {
            /* đã dừng */
          }
        });
        nodes.forEach((n) => {
          try {
            n.disconnect();
          } catch {
            /* đã ngắt */
          }
        });
      }, fade * 1000 + 250);
    },
  };
}

function start(): boolean {
  const c = getCtx();
  if (!c || !master) return false;
  void c.resume();
  master.gain.setTargetAtTime(volumeGain(state.volume), c.currentTime, 0.1);
  active?.stop(0.4);
  active = build(c, master, state.soundId);
  return true;
}

export function play() {
  load();
  if (start()) set({ playing: true });
}

export function pause() {
  load();
  if (active) {
    active.stop(0.9);
    active = null;
  }
  set({ playing: false });
}

export function toggle() {
  load();
  if (state.playing) pause();
  else play();
}

export function setSound(id: string) {
  load();
  if (!SOUNDS.some((s) => s.id === id)) return;
  set({ soundId: id });
  if (state.playing) start();
}

export function stepSound(dir: 1 | -1) {
  load();
  setSound(nextSoundId(state.soundId, dir));
}

export function setVolume(v: number) {
  load();
  set({ volume: clampVolume(v) });
  if (ctx && master) master.gain.setTargetAtTime(volumeGain(state.volume), ctx.currentTime, 0.05);
}

// Phải gọi trong một thao tác bấm của người dùng thì trình duyệt mới cho phát âm thanh.
export function unlock() {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
}

// Tiếng chuông hai nốt báo hết hiệp hoặc hết giờ nghỉ. Phát cả khi âm nền đang tắt.
export function chime() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const t = c.currentTime;
  [880, 1318.5].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.value = 0;
    o.connect(g);
    g.connect(c.destination);
    const s = t + i * 0.18;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(0.14, s + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 1.3);
    o.start(s);
    o.stop(s + 1.4);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  });
}

export const ambient = { play, pause, toggle, setSound, stepSound, setVolume, unlock, chime };