import { describe, expect, it } from "vitest";
import { SOUNDS, clampVolume, nextSoundId, soundById, volumeGain } from "../lib/sounds";

describe("sounds", () => {
  it("id không trùng và có đủ mô tả", () => {
    expect(new Set(SOUNDS.map((s) => s.id)).size).toBe(SOUNDS.length);
    for (const s of SOUNDS) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.desc.length).toBeGreaterThan(0);
    }
  });

  it("bước tới lui có quay vòng", () => {
    const first = SOUNDS[0].id;
    const last = SOUNDS[SOUNDS.length - 1].id;
    expect(nextSoundId(first, -1)).toBe(last);
    expect(nextSoundId(last, 1)).toBe(first);
    expect(nextSoundId(first, 1)).toBe(SOUNDS[1].id);
  });

  it("id lạ vẫn ra một âm hợp lệ", () => {
    expect(SOUNDS.some((s) => s.id === nextSoundId("khong-co", 1))).toBe(true);
    expect(soundById("khong-co").id).toBe(SOUNDS[0].id);
  });

  it("âm lượng nằm trong 0..1 và tăng dần theo thanh trượt", () => {
    expect(clampVolume(-3)).toBe(0);
    expect(clampVolume(7)).toBe(1);
    expect(clampVolume(Number.NaN)).toBe(0.5);
    expect(volumeGain(0)).toBe(0);
    expect(volumeGain(0.3)).toBeLessThan(volumeGain(0.6));
    expect(volumeGain(1)).toBeLessThanOrEqual(1);
  });
});