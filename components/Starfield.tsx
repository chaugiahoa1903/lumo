"use client";

import { useEffect, useRef } from "react";
import { useSettings } from "@/lib/settings";

interface Star {
  x: number;
  y: number;
  r: number;
  base: number;
  speed: number;
  phase: number;
  warm: boolean;
  big: boolean;
}
interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [settings] = useSettings();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = settings.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let nextMeteor = 4000;
    let stars: Star[] = [];
    const meteors: Meteor[] = [];

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const a = reduce ? s.base : s.base * (0.65 + 0.35 * Math.sin((t / 1000) * s.speed + s.phase));
        const rgb = s.warm ? "255,224,190" : "210,232,255";
        if (s.big) {
          ctx.fillStyle = `rgba(${rgb},${a * 0.12})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(${rgb},${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const m of meteors) {
        const alpha = Math.max(0, 1 - m.life / m.max);
        ctx.strokeStyle = `rgba(220,240,255,${alpha * 0.8})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.vx * 5, m.y - m.vy * 5);
        ctx.stroke();
      }
    };

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(120, Math.min(420, Math.round((w * h) / 5500)));
      stars = Array.from({ length: n }, () => {
        const big = Math.random() < 0.08;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: big ? 1.3 + Math.random() * 0.8 : 0.4 + Math.random() * 0.8,
          base: 0.35 + Math.random() * 0.6,
          speed: 0.4 + Math.random() * 1.4,
          phase: Math.random() * Math.PI * 2,
          warm: Math.random() < 0.15,
          big,
        };
      });
      draw(0);
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 33) return; // khoảng 30 khung hình mỗi giây là đủ cho nền sao
      last = now;
      if (now > nextMeteor && meteors.length < 2) {
        const speed = 7 + Math.random() * 4;
        meteors.push({
          x: w * 0.1 + Math.random() * w * 0.7,
          y: Math.random() * h * 0.4,
          vx: speed * Math.cos(0.6),
          vy: speed * Math.sin(0.6),
          life: 0,
          max: 45,
        });
        nextMeteor = now + 9000 + Math.random() * 12000;
      }
      for (const m of meteors) {
        m.x += m.vx;
        m.y += m.vy;
        m.life += 1;
      }
      for (let i = meteors.length - 1; i >= 0; i--) if (meteors[i].life > meteors[i].max) meteors.splice(i, 1);
      draw(now);
    };

    build();
    window.addEventListener("resize", build);
    if (!reduce) raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", build);
    };
  }, [settings.reduceMotion]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0" />;
}