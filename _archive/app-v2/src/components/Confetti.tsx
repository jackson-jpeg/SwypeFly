import { useEffect, useRef } from 'react';

const PARTICLE_COUNT = 90;
const DURATION_MS = 3000;
const GRAVITY = 0.12;

const PALETTE: string[] = [
  '#37654E', // sageDrift green
  '#C9A99A', // borderTint warm
  '#3B2E2A', // deepDusk brown
  '#F0EBE3', // offWhite cream
  '#E8734A', // terracotta accent
  '#FFD700', // gold
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: 'rect' | 'circle';
  opacity: number;
}

function createParticles(canvasW: number, canvasH: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2; // mostly upward, spread ~70deg
    const speed = 8 + Math.random() * 10;
    const size = 5 + Math.random() * 7;
    return {
      x: canvasW * 0.15 + Math.random() * canvasW * 0.7,
      y: canvasH + 10,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 3,
      vy: Math.sin(angle) * speed - 2,
      w: size,
      h: Math.random() > 0.5 ? size : size * (1.2 + Math.random() * 0.6),
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)] ?? '#FFD700',
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      shape: Math.random() > 0.4 ? 'rect' : 'circle',
      opacity: 1,
    };
  });
}

interface ConfettiProps {
  onComplete?: () => void;
}

export default function Confetti({ onComplete }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Size canvas to window
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const particles = createParticles(w, h);
    const startTime = performance.now();
    let rafId: number;

    function draw(now: number) {
      const elapsed = now - startTime;

      // Auto-cleanup after duration
      if (elapsed > DURATION_MS) {
        cancelAnimationFrame(rafId);
        onComplete?.();
        return;
      }

      ctx!.clearRect(0, 0, w, h);

      // Fade out in the last 800ms
      const fadeStart = DURATION_MS - 800;
      const globalAlpha = elapsed > fadeStart ? 1 - (elapsed - fadeStart) / 800 : 1;

      for (const p of particles) {
        // Physics
        p.vy += GRAVITY;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.995; // air resistance
        p.rotation += p.rotationSpeed;

        ctx!.save();
        ctx!.globalAlpha = globalAlpha * p.opacity;
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rotation);
        ctx!.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx!.fill();
        } else {
          ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }

        ctx!.restore();
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [onComplete]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}
