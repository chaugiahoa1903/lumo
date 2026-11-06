"use client";

import type { MusicKind } from "./sounds";
import {
  MELODY_POOL,
  PROGRESSIONS,
  STEPS_PER_BAR,
  drumHits,
  midiToHz,
  mulberry32,
  pickProgression,
  stepTime,
  type Chord,
} from "./lofiTheory";

// Nhạc lofi/ambient tự sinh bằng Web Audio API: không file âm thanh, không gọi mạng.
export interface MusicHandle {
  stop: () => void;
}

function makeImpulse(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}

function makeWhite(c: AudioContext): AudioBuffer {
  const len = c.sampleRate * 3;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Đường bao âm lượng: lên nhanh tới peak, giảm về decayTo, rồi tắt dần tới thời điểm `end` (giây kể từ t).
function env(g: AudioParam, t: number, peak: number, attack: number, decayTo: number, decay: number, end: number) {
  g.cancelScheduledValues(t);
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.exponentialRampToValueAtTime(Math.max(0.0002, decayTo), t + attack + decay);
  g.exponentialRampToValueAtTime(0.0001, t + end);
}

export function startMusic(c: AudioContext, out: AudioNode, kind: MusicKind): MusicHandle {
  const dream = kind === "dream";
  const bpm = dream ? 58 : 74;
  const swing = dream ? 0 : 0.16;
  const e = 60 / bpm / 2; // độ dài một nốt móc kép
  const barLen = STEPS_PER_BAR * e;
  const rnd = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);

  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [];
  const add = <T extends AudioNode>(n: T): T => {
    nodes.push(n);
    return n;
  };
  const gainNode = (v: number) => {
    const g = add(c.createGain());
    g.gain.value = v;
    return g;
  };
  const filterNode = (type: BiquadFilterType, f: number, q = 0.7) => {
    const n = add(c.createBiquadFilter());
    n.type = type;
    n.frequency.value = f;
    n.Q.value = q;
    return n;
  };
  const startSrc = <T extends AudioScheduledSourceNode>(s: T) => {
    sources.push(s);
    nodes.push(s);
    return s;
  };

  // ----- chuỗi âm thanh chung: mọi thứ vào mix → bộ nén → root → out -----
  const root = gainNode(0);
  root.connect(out);
  root.gain.setTargetAtTime(1, c.currentTime, 0.4);
  const comp = add(c.createDynamicsCompressor());
  comp.threshold.value = -22;
  comp.ratio.value = 3;
  comp.attack.value = 0.01;
  comp.release.value = 0.25;
  const mix = gainNode(0.9);
  mix.connect(comp);
  comp.connect(root);
  const tone = filterNode("lowpass", dream ? 3200 : 4800);
  tone.connect(mix);

  const white = makeWhite(c);

  // tiếng vang dội và tiếng vọng
  const echoIn = gainNode(1);
  const echoDelay = add(c.createDelay(1.5));
  echoDelay.delayTime.value = dream ? 0.9 : (60 / bpm) * 0.75;
  const fb = gainNode(dream ? 0.5 : 0.36);
  const echoLp = filterNode("lowpass", 1800);
  const echoOut = gainNode(dream ? 0.5 : 0.3);
  echoIn.connect(echoDelay);
  echoDelay.connect(echoLp);
  echoLp.connect(fb);
  fb.connect(echoDelay);
  echoLp.connect(echoOut);
  echoOut.connect(tone);

  const verbIn = gainNode(1);
  const conv = add(c.createConvolver());
  conv.buffer = makeImpulse(c, dream ? 4 : 2.4);
  const verbOut = gainNode(dream ? 0.7 : 0.35);
  verbIn.connect(conv);
  conv.connect(verbOut);
  verbOut.connect(tone);

  // đàn phím, bass, trống, pad
  const keysBus = filterNode("lowpass", dream ? 2000 : 2600);
  keysBus.connect(tone);
  const keysEcho = gainNode(dream ? 0.3 : 0.2);
  keysBus.connect(keysEcho);
  keysEcho.connect(echoIn);
  const keysVerb = gainNode(dream ? 0.5 : 0.22);
  keysBus.connect(keysVerb);
  keysVerb.connect(verbIn);

  const bassBus = filterNode("lowpass", 520);
  bassBus.connect(mix);
  const drumBus = gainNode(0.9);
  drumBus.connect(mix);
  const snareVerb = gainNode(0.25);
  drumBus.connect(snareVerb);
  snareVerb.connect(verbIn);

  const padBus = filterNode("lowpass", 1000);
  padBus.connect(tone);
  const padVerb = gainNode(0.6);
  padBus.connect(padVerb);
  padVerb.connect(verbIn);

  // tiếng "chao" nhẹ của băng từ (tape wobble) áp lên độ cao của đàn và pad
  const wobble = gainNode(1);
  const lfo1 = startSrc(add(c.createOscillator()));
  lfo1.frequency.value = 0.31;
  const lfo1g = gainNode(7);
  lfo1.connect(lfo1g);
  lfo1g.connect(wobble);
  lfo1.start();
  const lfo2 = startSrc(add(c.createOscillator()));
  lfo2.frequency.value = 0.083;
  const lfo2g = gainNode(4);
  lfo2.connect(lfo2g);
  lfo2g.connect(wobble);
  lfo2.start();
  const lfo3 = startSrc(add(c.createOscillator()));
  lfo3.frequency.value = 0.05;
  const lfo3g = gainNode(350);
  lfo3.connect(lfo3g);
  lfo3g.connect(padBus.frequency);
  lfo3.start();

  // tiếng xì nhẹ của đĩa than, và tiếng mưa cho bản "mưa đêm"
  if (!dream) {
    const hiss = startSrc(add(c.createBufferSource()));
    hiss.buffer = white;
    hiss.loop = true;
    hiss.start(0, rnd() * 2);
    const hp = filterNode("highpass", 4500);
    const hg = gainNode(0.007);
    hiss.connect(hp);
    hp.connect(hg);
    hg.connect(root);
  }
  if (kind === "lofi-rain") {
    const rain = startSrc(add(c.createBufferSource()));
    rain.buffer = white;
    rain.loop = true;
    rain.start(0, rnd() * 2);
    const rh = filterNode("highpass", 500);
    const rl = filterNode("lowpass", 7000);
    const rg = gainNode(0.045);
    rain.connect(rh);
    rh.connect(rl);
    rl.connect(rg);
    rg.connect(root);
  }

  // ----- nhạc cụ -----
  const noiseHit = (
    target: AudioNode,
    type: BiquadFilterType,
    freq: number,
    q: number,
    peak: number,
    decay: number,
    t: number
  ) => {
    const s = c.createBufferSource();
    s.buffer = white;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = 0.0001;
    s.connect(f);
    f.connect(g);
    g.connect(target);
    env(g.gain, t, peak, 0.002, peak * 0.2, decay * 0.5, decay);
    s.start(t, rnd() * (white.duration - 0.5));
    s.stop(t + decay + 0.05);
    s.onended = () => {
      s.disconnect();
      f.disconnect();
      g.disconnect();
    };
  };

  const key = (freq: number, t: number, dur: number, vel: number) => {
    const o1 = c.createOscillator();
    o1.type = "sine";
    o1.frequency.value = freq;
    const o2 = c.createOscillator();
    o2.type = "triangle";
    o2.frequency.value = freq * 2;
    wobble.connect(o1.detune);
    wobble.connect(o2.detune);
    const g1 = c.createGain();
    const g2 = c.createGain();
    g1.gain.value = 0.0001;
    g2.gain.value = 0.0001;
    env(g1.gain, t, vel * 0.1, 0.01, vel * 0.045, 0.6, dur + 1.0);
    env(g2.gain, t, vel * 0.035, 0.005, vel * 0.004, 0.25, 0.7);
    o1.connect(g1);
    o2.connect(g2);
    g1.connect(keysBus);
    g2.connect(keysBus);
    o1.start(t);
    o2.start(t);
    const stopAt = t + dur + 1.1;
    o1.stop(stopAt);
    o2.stop(stopAt);
    o1.onended = () => {
      try {
        wobble.disconnect(o1.detune);
        wobble.disconnect(o2.detune);
      } catch {
        /* đã ngắt */
      }
      o1.disconnect();
      o2.disconnect();
      g1.disconnect();
      g2.disconnect();
    };
  };

  const chordKeys = (notes: number[], t: number, dur: number, vel: number) => {
    notes.forEach((m, i) => key(midiToHz(m), t + i * 0.012 + rnd() * 0.012, dur, vel * (0.85 + rnd() * 0.3)));
  };

  const bass = (m: number, t: number, dur: number, vel: number) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = midiToHz(m);
    const g = c.createGain();
    g.gain.value = 0.0001;
    env(g.gain, t, vel * 0.28, 0.02, vel * 0.14, dur * 0.6, dur + 0.2);
    o.connect(g);
    g.connect(bassBus);
    o.start(t);
    o.stop(t + dur + 0.3);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  };

  const bell = (m: number, t: number, vel: number) => {
    const f = midiToHz(m);
    const o1 = c.createOscillator();
    o1.type = "sine";
    o1.frequency.value = f;
    const o2 = c.createOscillator();
    o2.type = "sine";
    o2.frequency.value = f * 3.01;
    const g1 = c.createGain();
    const g2 = c.createGain();
    g1.gain.value = 0.0001;
    g2.gain.value = 0.0001;
    env(g1.gain, t, vel * 0.06, 0.005, vel * 0.01, 1.2, 2.8);
    env(g2.gain, t, vel * 0.015, 0.003, vel * 0.002, 0.5, 1.2);
    o1.connect(g1);
    o2.connect(g2);
    g1.connect(keysBus);
    g2.connect(keysBus);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 3);
    o2.stop(t + 3);
    o1.onended = () => {
      o1.disconnect();
      o2.disconnect();
      g1.disconnect();
      g2.disconnect();
    };
  };

  const pad = (notes: number[], t: number, dur: number) => {
    notes.forEach((m) => {
      const f = midiToHz(m);
      [-7, 7].forEach((cents) => {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = cents;
        wobble.connect(o.detune);
        const g = c.createGain();
        g.gain.value = 0.0001;
        o.connect(g);
        g.connect(padBus);
        env(g.gain, t, 0.016, 2.6, 0.012, dur * 0.5, dur + 3);
        o.start(t);
        o.stop(t + dur + 3.2);
        o.onended = () => {
          try {
            wobble.disconnect(o.detune);
          } catch {
            /* đã ngắt */
          }
          o.disconnect();
          g.disconnect();
        };
      });
    });
  };

  const kick = (t: number, vel: number) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = c.createGain();
    g.gain.value = 0.0001;
    env(g.gain, t, vel * 0.6, 0.004, vel * 0.2, 0.08, 0.3);
    o.connect(g);
    g.connect(drumBus);
    o.start(t);
    o.stop(t + 0.35);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  };

  const snare = (t: number, vel: number) => {
    noiseHit(drumBus, "bandpass", 1900, 0.8, vel * 0.22, 0.16, t);
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = 185;
    const g = c.createGain();
    g.gain.value = 0.0001;
    env(g.gain, t, vel * 0.12, 0.003, vel * 0.02, 0.05, 0.12);
    o.connect(g);
    g.connect(drumBus);
    o.start(t);
    o.stop(t + 0.15);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  };

  const hat = (t: number, vel: number) => noiseHit(drumBus, "highpass", 7500, 0.7, vel * 0.08, 0.05, t);

  // ----- trình lên lịch: mỗi lần xếp trước một ô nhịp -----
  let progIdx = Math.floor(rnd() * PROGRESSIONS.length);
  let chordIdx = 0;
  let bar = 0;
  let nextBarTime = c.currentTime + 0.25;

  const scheduleBar = (t0: number) => {
    const prog = PROGRESSIONS[progIdx];
    const chord: Chord = prog[chordIdx];

    if (dream) {
      if (bar % 2 === 0) {
        pad([...chord.notes, chord.bass + 12], t0, barLen * 2);
        bass(chord.bass, t0, barLen * 1.9, 0.6);
      }
      if (rnd() < 0.75) bell(MELODY_POOL[Math.floor(rnd() * MELODY_POOL.length)], t0 + rnd() * barLen, 0.7);
      if (rnd() < 0.35) bell(MELODY_POOL[Math.floor(rnd() * MELODY_POOL.length)], t0 + rnd() * barLen, 0.5);
    } else {
      const T = (s: number) => t0 + stepTime(s, bpm, swing);
      chordKeys(chord.notes, T(0), 3 * e, 0.95);
      if (rnd() < 0.55) chordKeys(chord.notes.slice(1), T(3), 1.2 * e, 0.5);
      if (rnd() < 0.35) chordKeys(chord.notes.slice(1), T(5), 1.2 * e, 0.55);
      bass(chord.bass, T(0), 3 * e, 1);
      if (rnd() < 0.7) bass(rnd() < 0.5 ? chord.bass : chord.bass + 7, T(5), 1.5 * e, 0.7);
      if (rnd() < 0.6) {
        const n = 1 + Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++) {
          const s = Math.floor(rnd() * STEPS_PER_BAR);
          key(midiToHz(MELODY_POOL[Math.floor(rnd() * MELODY_POOL.length)]), T(s), 2 * e, 0.55);
        }
      }
      for (let s = 0; s < STEPS_PER_BAR; s++) {
        const h = drumHits(s, bar, rnd);
        const ts = T(s) + (rnd() - 0.5) * 0.012;
        if (h.kick) kick(ts, h.kick);
        if (h.snare) snare(ts, h.snare);
        if (h.hat) hat(ts, h.hat);
      }
    }

    if (!dream || bar % 2 === 1) {
      chordIdx++;
      if (chordIdx >= prog.length) {
        chordIdx = 0;
        progIdx = pickProgression(progIdx, rnd, PROGRESSIONS.length);
      }
    }
    bar++;
  };

  // Khi tab bị ẩn, trình duyệt làm chậm bộ hẹn giờ nên xếp trước 1,5 giây.
  const AHEAD = 1.5;
  const sched = window.setInterval(() => {
    while (nextBarTime < c.currentTime + AHEAD) {
      scheduleBar(nextBarTime);
      nextBarTime += barLen;
    }
  }, 200);

  // tiếng lách tách của đĩa than
  let crackleTimer = 0;
  if (!dream) {
    const tick = () => {
      noiseHit(root, "bandpass", 2500 + rnd() * 3500, 1.2, 0.025 + rnd() * 0.06, 0.006 + rnd() * 0.012, c.currentTime + 0.01);
      crackleTimer = window.setTimeout(tick, 80 + rnd() * 520);
    };
    crackleTimer = window.setTimeout(tick, 400);
  }

  return {
    stop() {
      window.clearInterval(sched);
      window.clearTimeout(crackleTimer);
      root.gain.cancelScheduledValues(c.currentTime);
      root.gain.setTargetAtTime(0, c.currentTime, 0.15);
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
      }, 1000);
    },
  };
}