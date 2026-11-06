// Phần "nhạc lý" thuần của nhạc lofi tự sinh (không phụ thuộc trình duyệt, dễ kiểm thử).

export const STEPS_PER_BAR = 8; // 8 nốt móc kép mỗi ô nhịp 4/4

export interface Chord {
  name: string;
  bass: number; // nốt bass (MIDI)
  notes: number[]; // thế bấm hợp âm (MIDI)
}

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Dm9: Chord = { name: "Dm9", bass: 38, notes: [53, 57, 60, 64] };
const G13: Chord = { name: "G13", bass: 43, notes: [53, 59, 62, 64] };
const Cmaj9: Chord = { name: "Cmaj9", bass: 48, notes: [52, 55, 59, 62] };
const Am9: Chord = { name: "Am9", bass: 45, notes: [55, 59, 60, 64] };
const Fmaj9: Chord = { name: "Fmaj9", bass: 41, notes: [57, 60, 64, 67] };
const Em7: Chord = { name: "Em7", bass: 40, notes: [55, 59, 62, 67] };

// Các dãy hợp âm jazz phổ biến trong cung Đô trưởng (các dãy chung kiểu ii–V–I, không thuộc về ai).
export const PROGRESSIONS: Chord[][] = [
  [Dm9, G13, Cmaj9, Am9],
  [Fmaj9, Em7, Dm9, G13],
  [Am9, Dm9, G13, Cmaj9],
  [Cmaj9, Am9, Dm9, G13],
];

// Giọng ngũ cung Đô trưởng, hợp với mọi hợp âm ở trên.
export const MELODY_POOL = [72, 74, 76, 79, 81, 84];

// Chọn dãy hợp âm kế tiếp, luôn khác dãy hiện tại.
export function pickProgression(prev: number, rnd: () => number, count: number): number {
  if (count <= 1) return 0;
  let n = Math.floor(rnd() * (count - 1));
  if (n >= prev) n++;
  return n;
}

// Thời điểm (giây, tính từ đầu ô nhịp) của nốt móc kép thứ `step`. Nốt lẻ bị đẩy trễ để có nhịp swing.
export function stepTime(step: number, bpm: number, swing: number): number {
  const e = 60 / bpm / 2;
  return step * e + (step % 2 === 1 ? swing * e : 0);
}

export interface DrumHit {
  kick: number;
  snare: number;
  hat: number;
}

// Nhịp trống lofi: kick ở nhịp 1 và "và" của nhịp 3, snare ở nhịp 2 và 4, hi-hat đều tay nhưng thưa ngẫu nhiên.
export function drumHits(step: number, bar: number, rnd: () => number): DrumHit {
  const s = ((step % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
  if (bar % 8 === 7) return { kick: s === 0 ? 0.6 : 0, snare: 0, hat: s % 2 === 0 ? 0.25 : 0 };
  const kick = s === 0 ? 1 : s === 5 ? 0.7 : s === 3 && rnd() < 0.25 ? 0.5 : 0;
  const snare = s === 2 || s === 6 ? 0.8 + rnd() * 0.15 : 0;
  let hat = s % 2 === 0 ? 0.5 : 0.28;
  if (rnd() < 0.12) hat = 0;
  else hat *= 0.8 + rnd() * 0.4;
  return { kick, snare, hat };
}