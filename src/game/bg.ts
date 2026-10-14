// Procedural stage backdrops: gradient sky, themed silhouette layers,
// drifting motes. No image assets — everything is drawn per frame.

export type Theme = 'grove' | 'cavern' | 'volcano' | 'sky';
export const THEMES: Theme[] = ['grove', 'cavern', 'volcano', 'sky'];

const CFG: Record<
  Theme,
  {
    top: string;
    bottom: string;
    ridge1: string;
    ridge2: string;
    mote: string;
    fall: boolean; // leaves fall, embers/sparks rise
  }
> = {
  grove: { top: '#16402a', bottom: '#07180f', ridge1: '#0e2a1c', ridge2: '#1a4a30', mote: '#c8f898', fall: true },
  cavern: { top: '#1c2150', bottom: '#0a0c1e', ridge1: '#141839', ridge2: '#26306b', mote: '#9db4ff', fall: false },
  volcano: { top: '#451512', bottom: '#170605', ridge1: '#2c0e0a', ridge2: '#5e2115', mote: '#ffb060', fall: false },
  sky: { top: '#1b3a80', bottom: '#070d20', ridge1: '#10234d', ridge2: '#20447f', mote: '#dfefff', fall: false },
};

const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

function tri(ctx: CanvasRenderingContext2D, cx: number, baseY: number, w: number, h: number, down = false) {
  ctx.beginPath();
  if (down) {
    ctx.moveTo(cx - w / 2, baseY);
    ctx.lineTo(cx + w / 2, baseY);
    ctx.lineTo(cx, baseY + h);
  } else {
    ctx.moveTo(cx - w / 2, baseY);
    ctx.lineTo(cx + w / 2, baseY);
    ctx.lineTo(cx, baseY - h);
  }
  ctx.closePath();
  ctx.fill();
}

// Theme-specific silhouette rows — pines, stalactites, crags, clouds.
function silhouettes(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  c: (typeof CFG)[Theme],
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
) {
  for (const [color, base, amp, speed, step] of [
    [c.ridge2, 0.86, 0.1, 10, 86],
    [c.ridge1, 0.93, 0.07, 4, 110],
  ] as const) {
    const off = (t * speed) % step;
    ctx.fillStyle = color;
    const layer = color === c.ridge1 ? 1 : 0;
    for (let i = -1; i <= w / step + 1; i++) {
      const cx = x + i * step - off;
      const hgt = h * (0.09 + hash(i * 3 + layer * 11) * amp);
      const baseY = y + h * base;
      switch (theme) {
        case 'grove': // pine trees: two stacked triangles
          tri(ctx, cx, baseY + hgt * 0.45, step * 0.9, hgt * 1.1);
          tri(ctx, cx, baseY + hgt * 0.05, step * 0.6, hgt * 0.85);
          break;
        case 'cavern': // stalagmites up, stalactites down
          tri(ctx, cx, baseY + hgt, step * 0.55, hgt * 1.7);
          if (i % 2 === layer) tri(ctx, cx + step / 2, y, step * 0.4, h * 0.16 + hash(i) * h * 0.1, true);
          break;
        case 'volcano': // jagged crags + lava glow handled below
          tri(ctx, cx, baseY + hgt * 0.3, step, hgt * 1.5);
          break;
        case 'sky': // cloud blobs
          ctx.beginPath();
          ctx.arc(cx, baseY - hgt * 0.4, step * 0.42, 0, Math.PI * 2);
          ctx.arc(cx + step * 0.34, baseY - hgt * 0.3, step * 0.3, 0, Math.PI * 2);
          ctx.arc(cx - step * 0.34, baseY - hgt * 0.28, step * 0.34, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
    }
    // fill the strip under the shapes so the silhouette reads solid
    ctx.fillRect(x - step, y + h * base, w + step * 2, h * (1 - base) + 2);
  }
}

export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  r: number,
  theme: Theme,
  t: number,
) {
  const c = CFG[theme];
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.clip();

  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, c.top);
  g.addColorStop(1, c.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  if (theme === 'volcano') {
    // lava glow pooling at the bottom
    const lava = ctx.createLinearGradient(0, y + h * 0.8, 0, y + h);
    lava.addColorStop(0, 'rgba(255,110,40,0)');
    lava.addColorStop(1, 'rgba(255,120,50,0.4)');
    ctx.fillStyle = lava;
    ctx.fillRect(x, y + h * 0.8, w, h * 0.2);
  }

  silhouettes(ctx, theme, c, x, y, w, h, t);

  // motes — leaves drift down in the grove, embers/sparks rise elsewhere
  for (let i = 0; i < 26; i++) {
    const mx = x + hash(i * 7 + 1) * w + Math.sin(t * 0.8 + i * 1.7) * 16;
    const prog = (hash(i * 13) * h + t * (24 + hash(i) * 30)) % (h + 40);
    const my = c.fall ? y - 20 + prog : y + h + 20 - prog;
    const a = 0.25 + 0.55 * Math.abs(Math.sin(t * 1.3 + i));
    ctx.globalAlpha = a * 0.7;
    ctx.fillStyle = c.mote;
    ctx.beginPath();
    ctx.arc(mx, my, 1.5 + hash(i * 31) * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // bottom vignette
  const v = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(x, y + h * 0.55, w, h * 0.45);

  ctx.restore();
}
