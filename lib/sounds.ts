export interface SoundDef {
  id: string;
  name: string;
  desc: string;
}

export type MusicKind = "lofi" | "lofi-rain" | "dream";
const MUSIC_IDS: readonly string[] = ["lofi", "lofi-rain", "dream"];

export function isMusicId(id: string): id is MusicKind {
  return MUSIC_IDS.includes(id);
}

export const SOUNDS: SoundDef[] = [
  { id: "lofi", name: "Lofi chill", desc: "Lofi do Lumo tự sáng tác: piano điện, trống nhẹ" },
  { id: "lofi-rain", name: "Lofi mưa đêm", desc: "Lofi chill kèm tiếng mưa" },
  { id: "dream", name: "Ambient mơ màng", desc: "Nền pad êm, không có trống" },
  { id: "brown", name: "Brown noise", desc: "Âm trầm, che bớt tiếng ồn xung quanh" },
  { id: "pink", name: "Pink noise", desc: "Cân bằng, êm tai" },
  { id: "rain", name: "Tiếng mưa", desc: "Mưa đều trên mái" },
  { id: "cafe", name: "Quán cafe", desc: "Tiếng xì xào, lách cách ly tách (mô phỏng)" },
  { id: "waves", name: "Sóng biển", desc: "Sóng vỗ nhịp chậm" },
  { id: "fire", name: "Lửa trại", desc: "Lửa cháy lách tách" },
  { id: "none", name: "Không nhạc", desc: "Chỉ có đồng hồ, không phát âm thanh" },
];

export const DEFAULT_SOUND = "lofi";

export function soundById(id: string): SoundDef {
  return SOUNDS.find((s) => s.id === id) ?? SOUNDS[0];
}

export function nextSoundId(current: string, dir: 1 | -1): string {
  const i = SOUNDS.findIndex((s) => s.id === current);
  const base = i < 0 ? 0 : i;
  return SOUNDS[(base + dir + SOUNDS.length) % SOUNDS.length].id;
}

export function clampVolume(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
}

// Đường cong âm lượng: bình phương cho cảm giác to nhỏ đều hơn.
export function volumeGain(v: number): number {
  const c = clampVolume(v);
  return c * c * 0.9;
}