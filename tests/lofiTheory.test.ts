import { describe, expect, it } from "vitest";
import { MELODY_POOL, PROGRESSIONS, drumHits, midiToHz, mulberry32, pickProgression, stepTime } from "../lib/lofiTheory";

describe("lofiTheory", () => {
  it("đổi nốt MIDI sang tần số", () => {
    expect(midiToHz(69)).toBeCloseTo(440, 5);
    expect(midiToHz(57)).toBeCloseTo(220, 5);
  });

  it("các dãy hợp âm hợp lệ", () => {
    expect(PROGRESSIONS.length).toBeGreaterThanOrEqual(3);
    for (const p of PROGRESSIONS) {
      expect(p.length).toBe(4);
      for (const c of p) {
        expect(c.bass).toBeGreaterThanOrEqual(36);
        expect(c.bass).toBeLessThanOrEqual(48);
        expect(c.notes.length).toBeGreaterThanOrEqual(4);
        for (const n of c.notes) {
          expect(n).toBeGreaterThanOrEqual(50);
          expect(n).toBeLessThanOrEqual(70);
        }
      }
    }
    for (const n of MELODY_POOL) expect(n).toBeGreaterThan(70);
  });

  it("nốt lẻ bị đẩy trễ để có swing", () => {
    expect(stepTime(0, 60, 0.2)).toBe(0);
    expect(stepTime(1, 60, 0.2)).toBeCloseTo(0.6, 5);
    expect(stepTime(2, 60, 0.2)).toBeCloseTo(1.0, 5);
    expect(stepTime(1, 60, 0)).toBeCloseTo(0.5, 5);
  });

  it("nhịp trống: kick nhịp 1, snare nhịp 2 và 4, ô thứ 8 thì thưa", () => {
    const rnd = mulberry32(7);
    for (let bar = 0; bar < 7; bar++) {
      expect(drumHits(0, bar, rnd).kick).toBe(1);
      expect(drumHits(2, bar, rnd).snare).toBeGreaterThan(0);
      expect(drumHits(6, bar, rnd).snare).toBeGreaterThan(0);
      expect(drumHits(1, bar, rnd).snare).toBe(0);
      expect(drumHits(4, bar, rnd).kick).toBe(0);
    }
    for (let s = 0; s < 8; s++) expect(drumHits(s, 7, rnd).snare).toBe(0);
  });

  it("chọn dãy hợp âm kế tiếp luôn khác dãy hiện tại, kết quả theo seed ổn định", () => {
    const rnd = mulberry32(3);
    for (let i = 0; i < 200; i++) {
      const prev = i % PROGRESSIONS.length;
      const n = pickProgression(prev, rnd, PROGRESSIONS.length);
      expect(n).not.toBe(prev);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(PROGRESSIONS.length);
    }
    const a = mulberry32(11);
    const b = mulberry32(11);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});