// Procedural stage backdrops: gradient sky, drifting ridge silhouettes,
// rising motes. No image assets — everything is drawn per frame.

export type Theme = 'grove' | 'cavern' | 'volcano' | 'sky';
export const THEMES: Theme[] = ['grove', 'cavern', 'volcano', 'sky'];

const CFG: Record<
  Theme,
  { top: string; bottom: string; ridge1: string; ridge2: string; mote: string }
> = {
  grove: { top: '#16402a', bottom: '#07180f', ridge1: '#0e2a1c', ridge2: '#1a4a30', mote: '#c8f898' },
  cavern: { top: '#1c2150', bottom: '#0a0c1e', ridge1: '#141839', ridge2: '#26306b', mote: '#9db4ff' },
  volcano: { top: '#451512', bottom: '#170605', ridge1: '#2c0e0a', ridge2: '#5e2115', mote: '#ffb060' },
  sky: { top: '#1b3a80', bottom: '#070d20', ridge1: '#10234d', ridge2: '#20447f', mote: '#dfefff' },
};

const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

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

  // two ridge layers parallax-scrolling left
  for (const [color, base, amp, speed, step] of [
    [c.ridge2, 0.82, 0.1, 10, 70],
    [c.ridge1, 0.9, 0.08, 4, 90],
  ] as const) {
    const off = (t * speed) % step;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - step, y + h);
    for (let i = -1; i <= w / step + 1; i++) {
      const peakX = x + i * step - off;
      const peakY = y + h * (base - hash(i * 3 + (color === c.ridge1 ? 11 : 0)) * amp);
      ctx.lineTo(peakX + step / 2, peakY);
      ctx.lineTo(peakX + step, y + h * base);
    }
    ctx.lineTo(x + w + step, y + h);
    ctx.closePath();
    ctx.fill();
  }

  // motes rising with a lazy wobble
  for (let i = 0; i < 26; i++) {
    const mx = x + hash(i * 7 + 1) * w + Math.sin(t * 0.8 + i * 1.7) * 16;
    const my = y + h + 20 - ((hash(i * 13) * h + t * (24 + hash(i) * 30)) % (h + 40));
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
