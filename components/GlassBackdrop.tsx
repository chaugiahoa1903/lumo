"use client";

import { useEffect, useRef } from "react";

export type Mood = "idle" | "focus" | "break";

const K = 0.5; // độ phân giải của cảnh gốc so với màn hình
const M = 2.8; // mỗi tấm kính nhìn một đoạn cảnh rộng gấp M lần nó (thu hẹp lại), tạo răng cưa ở mép dải
const ANGLE = -0.55; // hướng các dải: chéo lên về bên phải
const NX = -Math.sin(ANGLE);
const NY = Math.cos(ANGLE);

// o: vị trí dọc theo pháp tuyến (đơn vị đường chéo màn hình), t: độ dày dải, a: độ sáng.
const BANDS = [
  { o: -0.2, t: 0.26, a: 0.9, ph: 0.0 },
  { o: 0.12, t: 0.28, a: 1.0, ph: 2.1 },
  { o: 0.44, t: 0.26, a: 0.95, ph: 4.2 },
];

// Nền kính vân dọc (tự vẽ): dải xanh đến trắng kem, mép gắt. Vẽ một lần, đứng yên, không phản ứng theo nhạc.
export default function GlassBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const off = document.createElement("canvas");
    const ov = document.createElement("canvas");
    let w = 0;
    let h = 0;
    let dpr = 1;
    let sw = 30;
    let pad = 84;

    const buildOverlay = () => {
      const o = ov.getContext("2d");
      if (!o) return;
      o.setTransform(dpr, 0, 0, dpr, 0, 0);
      o.clearRect(0, 0, w, h);

      // độ bóng của từng tấm kính: viền tối bên trái, vệt sáng, bóng bên phải
      const tile = document.createElement("canvas");
      tile.width = sw;
      tile.height = 4;
      const tc = tile.getContext("2d");
      if (tc) {
        const g = tc.createLinearGradient(0, 0, sw, 0);
        g.addColorStop(0, "rgba(0,0,0,0.5)");
        g.addColorStop(0.06, "rgba(0,0,0,0.12)");
        g.addColorStop(0.16, "rgba(255,255,255,0.2)");
        g.addColorStop(0.34, "rgba(255,255,255,0.03)");
        g.addColorStop(0.7, "rgba(0,0,0,0.05)");
        g.addColorStop(1, "rgba(0,0,0,0.32)");
        tc.fillStyle = g;
        tc.fillRect(0, 0, sw, 4);
        const pat = o.createPattern(tile, "repeat");
        if (pat) {
          o.fillStyle = pat;
          o.fillRect(0, 0, w, h);
        }
      }

      // vệt sáng chéo phủ cả màn
      const sheen = o.createLinearGradient(0, 0, w, h);
      sheen.addColorStop(0, "rgba(255,255,255,0.05)");
      sheen.addColorStop(0.5, "rgba(255,255,255,0)");
      sheen.addColorStop(1, "rgba(255,255,255,0.04)");
      o.fillStyle = sheen;
      o.fillRect(0, 0, w, h);

      // vignette
      const vg = o.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.45, Math.max(w, h) * 0.8);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.38)");
      o.fillStyle = vg;
      o.fillRect(0, 0, w, h);

      // lớp tối ở đáy và đầu màn để chữ và nút dễ đọc
      const bot = o.createLinearGradient(0, h * 0.6, 0, h);
      bot.addColorStop(0, "rgba(2,4,14,0)");
      bot.addColorStop(1, "rgba(2,4,14,0.6)");
      o.fillStyle = bot;
      o.fillRect(0, h * 0.6, w, h * 0.4);
      const top = o.createLinearGradient(0, 0, 0, h * 0.16);
      top.addColorStop(0, "rgba(2,4,14,0.4)");
      top.addColorStop(1, "rgba(2,4,14,0)");
      o.fillStyle = top;
      o.fillRect(0, 0, w, h * 0.16);

      // hạt nhiễu
      const n = document.createElement("canvas");
      n.width = 128;
      n.height = 128;
      const nc = n.getContext("2d");
      if (nc) {
        const id = nc.createImageData(128, 128);
        for (let i = 0; i < 128 * 128; i++) {
          const v = Math.random() * 255;
          id.data[i * 4] = v;
          id.data[i * 4 + 1] = v;
          id.data[i * 4 + 2] = v;
          id.data[i * 4 + 3] = 20;
        }
        nc.putImageData(id, 0, 0);
        const gp = o.createPattern(n, "repeat");
        if (gp) {
          o.fillStyle = gp;
          o.fillRect(0, 0, w, h);
        }
      }
    };

    const paintScene = () => {
      const oc = off.getContext("2d");
      if (!oc) return;
      oc.setTransform(K, 0, 0, K, pad * K, 0);
      oc.globalCompositeOperation = "source-over";
      oc.fillStyle = "#02040c";
      oc.fillRect(-pad, 0, w + 2 * pad, h);

      const diag = Math.hypot(w, h);
      const cx = w / 2;
      const cy = h / 2;
      const full = (g: CanvasGradient) => {
        oc.fillStyle = g;
        oc.fillRect(-pad, 0, w + 2 * pad, h);
      };

      oc.globalCompositeOperation = "screen";

      // xanh nền ở góc trên trái
      const amb1 = oc.createRadialGradient(w * 0.08, h * 0.08, 0, w * 0.08, h * 0.08, diag * 0.5);
      amb1.addColorStop(0, "rgba(10,60,170,0.4)");
      amb1.addColorStop(1, "rgba(10,60,170,0)");
      full(amb1);

      // ba dải chéo: xanh đậm, xanh sáng, trắng kem, rồi cắt gắt
      for (const b of BANDS) {
        const o = (b.o + Math.sin(b.ph) * 0.035) * diag;
        const th = b.t * diag * 1.02;
        const g = oc.createLinearGradient(cx + NX * (o - th), cy + NY * (o - th), cx + NX * o, cy + NY * o);
        const k = Math.min(1, b.a * 0.85);
        g.addColorStop(0, "rgba(8,40,130,0)");
        g.addColorStop(0.4, `rgba(14,70,190,${0.55 * k})`);
        g.addColorStop(0.7, `rgba(40,130,240,${0.85 * k})`);
        g.addColorStop(0.9, `rgba(176,218,255,${0.95 * k})`);
        g.addColorStop(0.985, `rgba(250,246,232,${k})`);
        g.addColorStop(1, "rgba(250,246,232,0)");
        full(g);
      }

      // khối trắng kem lớn ở góc dưới phải
      const R = diag * 0.43;
      const mass = oc.createRadialGradient(w * 0.92, h * 1.02, 0, w * 0.92, h * 1.02, R);
      mass.addColorStop(0, "rgba(250,246,232,0.82)");
      mass.addColorStop(0.3, "rgba(130,185,250,0.55)");
      mass.addColorStop(0.7, "rgba(20,70,190,0.22)");
      mass.addColorStop(1, "rgba(20,70,190,0)");
      full(mass);

      oc.globalCompositeOperation = "source-over";
    };

    const render = () => {
      if (!w || !h) return;
      paintScene();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // mỗi tấm kính hiển thị một đoạn cảnh bị thu hẹp ngang: mép dải lặp lại lệch nhau, tạo răng cưa
      for (let x = 0; x < w; x += sw) {
        const cxs = x + sw / 2;
        const sx = (cxs - (sw * M) / 2 + pad) * K;
        const dx = Math.round(x * dpr);
        ctx.drawImage(off, sx, 0, sw * M * K, off.height, dx, 0, Math.ceil(sw * dpr) + 1, canvas.height);
      }
      ctx.drawImage(ov, 0, 0);
    };

    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sw = Math.max(16, Math.round(w / 56));
      pad = Math.ceil(sw * M);
      off.width = Math.round((w + 2 * pad) * K);
      off.height = Math.round(h * K);
      ov.width = canvas.width;
      ov.height = canvas.height;
      buildOverlay();
      render();
    };

    build();
    window.addEventListener("resize", build);
    return () => window.removeEventListener("resize", build);
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-0" />;
}