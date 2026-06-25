import { useEffect, useRef, useState } from "react";

// Simplex noise (2D) — adapted from Jonas Wagner (public domain)
function makeNoise2D(random = Math.random) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = (random() * 256) | 0;
  function grad2(hash: number, x: number, y: number) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return (h & 1 ? -u : u) + (h & 2 ? -2 * v : 2 * v);
  }
  const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
  const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  return function noise2D(xin: number, yin: number) {
    let n0 = 0,
      n1 = 0,
      n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi0 = p[ii + p[jj]];
      const t0_4 = t0 * t0 * t0 * t0;
      n0 = t0_4 * grad2(gi0, x0, y0);
    }
    const t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi1 = p[ii + i1 + p[jj + j1]];
      const t1_4 = t1 * t1 * t1 * t1;
      n1 = t1_4 * grad2(gi1, x1, y1);
    }
    const t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi2 = p[ii + 1 + p[jj + 1]];
      const t2_4 = t2 * t2 * t2 * t2;
      n2 = t2_4 * grad2(gi2, x2, y2);
    }
    return 40 * (n0 + n1 + n2);
  };
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

export interface BlurredBubblesProps {
  count?: number;
  colors?: string[];
  minRadius?: number;
  maxRadius?: number;
  bottomBandStart?: number;
  speed?: number;
  noiseScale?: number;
  noiseTimeScale?: number;
  targetFps?: number;
  startDelayMs?: number;
}

const DEFAULT_COLORS = ["#a8d8ea", "#aa96da", "#fcbad3", "#ffffd2"];

export function BlurredBubbles({
  count = 5,
  colors = DEFAULT_COLORS,
  minRadius = 200,
  maxRadius = 350,
  bottomBandStart = 0.75,
  speed = 0.1,
  noiseScale = 0.0008,
  noiseTimeScale = 0.00015,
  targetFps = 6,
  startDelayMs = 1000,
}: BlurredBubblesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), startDelayMs);
    return () => clearTimeout(timer);
  }, [startDelayMs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    const noise = makeNoise2D();
    let width = (canvas.width = canvas.clientWidth);
    let height = (canvas.height = canvas.clientHeight);
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(width * DPR);
    canvas.height = Math.floor(height * DPR);
    ctx.scale(DPR, DPR);

    let animRef = 0;
    let resizeTimer: number | null = null;

    const handleResize: ResizeObserverCallback = () => {
      const nextWidth = canvas.clientWidth;
      const nextHeight = canvas.clientHeight;
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.floor(width * DPR);
      canvas.height = Math.floor(height * DPR);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(DPR, DPR);
      allocateGrid();
      draw();
    };

    const onResize: ResizeObserverCallback = (...args) => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        handleResize(...args);
        resizeTimer = null;
      }, 1000);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    // Occupancy grid
    const gridCell = 80;
    let gridCols = 0;
    let gridRows = 0;
    let grid: Float32Array;

    function allocateGrid() {
      gridCols = Math.max(1, Math.ceil(width / gridCell));
      gridRows = Math.max(1, Math.ceil(height / gridCell));
      grid = new Float32Array(gridCols * gridRows);
    }

    function stampOccupancy(x: number, y: number, r: number) {
      const c0 = Math.floor((x - r) / gridCell);
      const c1 = Math.floor((x + r) / gridCell);
      const r0 = Math.floor((y - r) / gridCell);
      const r1 = Math.floor((y + r) / gridCell);
      for (let cy = r0; cy <= r1; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          if (cx < 0 || cy < 0 || cx >= gridCols || cy >= gridRows) continue;
          const idx = cy * gridCols + cx;
          grid[idx] += 0.5;
        }
      }
    }

    function lowestOccupancyTarget() {
      const startRow = Math.floor(gridRows * bottomBandStart);
      let bestIdx = startRow * gridCols;
      let bestVal = Infinity;
      for (let cy = startRow; cy < gridRows; cy++) {
        for (let cx = 0; cx < gridCols; cx++) {
          const idx = cy * gridCols + cx;
          const v = grid[idx];
          if (v < bestVal) {
            bestVal = v;
            bestIdx = idx;
          }
        }
      }
      const ty = (Math.floor(bestIdx / gridCols) + 0.5) * gridCell;
      const tx = ((bestIdx % gridCols) + 0.5) * gridCell;
      return { tx, ty };
    }

    allocateGrid();

    // Poisson-ish initial placement
    type Bubble = { x: number; y: number; r: number; color: string; vx: number; vy: number; jitter: number; blur: number };
    const bubbles: Bubble[] = [];
    const minDist = Math.max(minRadius * 0.2, 80);
    let tries = 0;
    while (bubbles.length < count && tries < 5000) {
      tries++;
      const r = rand(minRadius, maxRadius);
      const x = rand(-r / 2, width + r / 2);
      const y = rand(height * bottomBandStart, height * 1.2);
      let ok = true;
      for (const b of bubbles) {
        const dx = b.x - x;
        const dy = b.y - y;
        if (Math.hypot(dx, dy) < (b.r + r) * 0.6 || Math.hypot(dx, dy) < minDist) {
          ok = false;
          break;
        }
      }
      if (ok) {
        bubbles.push({
          x,
          y,
          r,
          color: colors[bubbles.length % colors.length | 0],
          vx: rand(-0.2, 0.2),
          vy: rand(-0.2, 0.2),
          jitter: rand(0.6, 1.2),
          blur: rand(180, 350),
        });
      }
    }

    const FRAME_INTERVAL = 1000 / Math.max(1, targetFps);
    let lastTime = 0;
    let accumulatedTime = 0;

    function updatePhysics(t: number) {
      const { tx, ty } = lowestOccupancyTarget();
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        const n = noise(b.x * noiseScale, b.y * noiseScale + t * noiseTimeScale);
        const angle = n * Math.PI * 2;
        const fx = Math.cos(angle) * speed * b.jitter;
        const fy = Math.sin(angle) * speed * b.jitter;

        let sx = 0,
          sy = 0;
        for (let j = 0; j < bubbles.length; j++) {
          if (j !== i) {
            const o = bubbles[j];
            const dx = b.x - o.x;
            const dy = b.y - o.y;
            const d2 = dx * dx + dy * dy;
            const minD = (b.r + o.r) * 0.4;
            if (d2 < minD * minD && d2 > 0.001) {
              const d = Math.sqrt(d2);
              const push = (minD - d) / minD;
              sx += (dx / d) * push * 0.8;
              sy += (dy / d) * push * 0.8;
            }
          }
        }

        const dxT = tx - b.x;
        const dyT = ty - b.y;
        const dT = Math.hypot(dxT, dyT) + 1e-3;
        const cx = (dxT / dT) * 0.05;
        const cy = (dyT / dT) * 0.05;

        const bandMin = height * bottomBandStart;
        const bandMax = height * 1.5;
        let bx = 0,
          by = 0;
        if (b.y < bandMin) by += (bandMin - b.y) * 0.01;
        if (b.y > bandMax) by -= (b.y - bandMax) * 0.01;

        b.vx += fx + sx + cx + bx;
        b.vy += fy + sy + cy + by;

        const damping = 0.95;
        b.vx *= damping;
        b.vy *= damping;

        const maxVel = 2;
        const vel = Math.hypot(b.vx, b.vy);
        if (vel > maxVel) {
          b.vx = (b.vx / vel) * maxVel;
          b.vy = (b.vy / vel) * maxVel;
        }

        b.x += b.vx;
        b.y += b.vy;

        if (b.x < -b.r - b.blur / 3) b.x = width + b.r + b.blur / 3;
        if (b.x > width + b.r + b.blur / 3) b.x = -b.r - b.blur / 3;
        b.y = Math.min(Math.max(b.y, bandMin - b.r * 0.25), bandMax + b.r * 0.25);

        stampOccupancy(b.x, b.y, b.r * 0.6);
      }
    }

    function draw() {
      for (const b of bubbles) {
        ctx.save();
        ctx.filter = `blur(${b.blur}px)`;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.fillStyle = b.color;
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function frame(t: number) {
      if (document.hidden) {
        animRef = requestAnimationFrame(frame);
        return;
      }
      const deltaTime = lastTime ? t - lastTime : 0;
      lastTime = t;
      accumulatedTime += deltaTime;

      if (accumulatedTime < FRAME_INTERVAL) {
        animRef = requestAnimationFrame(frame);
        return;
      }
      accumulatedTime = 0;

      ctx.clearRect(0, 0, width, height);
      updatePhysics(t);
      draw();
      animRef = requestAnimationFrame(frame);
    }

    draw();
    animRef = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animRef);
      ro.disconnect();
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    };
  }, [colors, count, minRadius, maxRadius, bottomBandStart, speed, noiseScale, noiseTimeScale, targetFps]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden transition-opacity duration-1000"
      style={{ opacity: visible ? 1 : 0, filter: "blur(50px)" }}
    >
      <canvas ref={canvasRef} className="h-full w-full" style={{ display: "block" }} />
    </div>
  );
}
