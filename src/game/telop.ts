// Battle banners ("telops"): one full-width ribbon at a time for the big
// beats of a fight, Monster Strike's idea in FRLG dress. A priority queue
// feeds a short sweep-in, hold and sweep-out. Banners never gate input; a
// tap skips straight to the sweep-out.
import { drawMon, itemSprite, loadItem } from '../core/assets';
import { buzz, sfx, type Sfx } from '../core/audio';
import { fontB, ufit, GOLD, GOLD_HI, PARCH, type Rect } from './ui';

export type TelopKind = 'start' | 'boss' | 'phase' | 'weak' | 'shield' | 'combo' | 'speed' | 'clear' | 'over' | 'ult' | 'foe';

export interface Telop {
  kind: TelopKind;
  title: string;
  sub?: string;
  mon?: number; // front sprite on the left
  icon?: string; // item or `badges/<n>` on the right
}

interface Spec {
  pri: number; // higher jumps the queue; cuts a minor banner short
  dur: number; // seconds, sweeps included
  ttl: number; // longest it may wait in the queue before it goes stale
  minor?: boolean; // slimmer ribbon, upper court
  color: string;
  sfx?: Sfx;
  buzz?: number | number[];
}

const RED = '#ff6b6b';
const CYAN = '#9df0ff';
export const TELOP_SPEC: Record<TelopKind, Spec> = {
  over: { pri: 5, dur: 1, ttl: 9, color: RED, buzz: [80, 60, 120] },
  boss: { pri: 4, dur: 1, ttl: 9, color: RED, sfx: 'warn', buzz: [30, 40, 30] },
  clear: { pri: 4, dur: 1, ttl: 9, color: GOLD_HI, buzz: 40 },
  start: { pri: 3, dur: 0.9, ttl: 9, color: GOLD_HI, buzz: 15 },
  phase: { pri: 3, dur: 0.9, ttl: 9, color: GOLD_HI, buzz: [20, 30, 20] },
  speed: { pri: 3, dur: 0.9, ttl: 9, color: CYAN, sfx: 'perfect', buzz: [30, 40, 60] },
  ult: { pri: 2, dur: 0.9, ttl: 4, color: GOLD_HI },
  foe: { pri: 2, dur: 0.7, ttl: 0.3, minor: true, color: RED, buzz: [25, 25, 25] },
  weak: { pri: 1, dur: 0.7, ttl: 0.4, minor: true, color: '#ffd84d', buzz: 25 },
  shield: { pri: 1, dur: 0.7, ttl: 0.4, minor: true, color: CYAN, sfx: 'zap', buzz: 20 },
  combo: { pri: 1, dur: 0.7, ttl: 0.4, minor: true, color: CYAN, sfx: 'tick', buzz: 15 },
};
const IN = 0.16;
const OUT = 0.14;

// pass-chain tiers: the banner fires as the chain crosses each one
export const COMBO_TIERS: [number, string, string][] = [
  [3, 'NICE COMBO', CYAN],
  [5, 'GREAT COMBO', '#ffd84d'],
  [8, 'EXCELLENT', RED],
];
export const comboTier = (n: number) => COMBO_TIERS.find(([at]) => at === n);

type Live = Telop & { wait: number; color?: string };

export class Telops {
  cur: Live | null = null;
  t = 0;
  queue: Live[] = [];
  private seen = new Set<string>();

  push(b: Telop & { color?: string }) {
    const spec = TELOP_SPEC[b.kind];
    if (b.icon) void loadItem(b.icon);
    if (b.kind === 'over') this.queue = [];
    const item: Live = { ...b, wait: 0 };
    // one of a kind: a fresh push restyles the live or queued copy
    if (this.cur?.kind === b.kind) {
      this.cur = item;
      this.t = Math.min(this.t, IN);
      return;
    }
    const i = this.queue.findIndex((q) => q.kind === b.kind);
    if (i >= 0) this.queue[i] = item;
    else this.queue.push(item);
    // big beats play out in full; minor juice and anything under GAME OVER yields
    const cur = this.cur && TELOP_SPEC[this.cur.kind];
    if (cur && spec.pri > cur.pri && (cur.minor || b.kind === 'over')) this.skip();
  }

  // true the first time a key is asked for: first weak hit per foe and so on
  once(key: string) {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }

  combo(n: number, mon?: number) {
    const tier = comboTier(n);
    if (tier) this.push({ kind: 'combo', title: tier[1], sub: `CHAIN ×${n}`, mon, icon: 'metronome', color: tier[2] });
  }

  skip() {
    if (!this.cur) return false;
    const end = TELOP_SPEC[this.cur.kind].dur - OUT;
    if (this.t >= end) return false;
    this.t = end;
    return true;
  }

  update(dt: number) {
    for (const q of this.queue) q.wait += dt;
    this.queue = this.queue.filter((q) => q.wait <= TELOP_SPEC[q.kind].ttl);
    if (this.cur) {
      this.t += dt;
      if (this.t >= TELOP_SPEC[this.cur.kind].dur) this.cur = null;
    }
    if (!this.cur && this.queue.length) {
      let best = 0;
      for (let i = 1; i < this.queue.length; i++)
        if (TELOP_SPEC[this.queue[i].kind].pri > TELOP_SPEC[this.queue[best].kind].pri) best = i;
      this.cur = this.queue.splice(best, 1)[0];
      this.t = 0;
      const spec = TELOP_SPEC[this.cur.kind];
      if (spec.sfx) sfx(spec.sfx, this.cur.kind === 'combo' ? 1 + COMBO_TIERS.findIndex(([, l]) => l === this.cur!.title) * 0.2 : 1);
      if (spec.buzz) buzz(spec.buzz);
    }
  }

  // every live and waiting line, for tests and the trail
  texts() {
    return [this.cur, ...this.queue].filter((b): b is Live => !!b).map((b) => (b.sub ? `${b.title} · ${b.sub}` : b.title)).join(' | ');
  }

  draw(ctx: CanvasRenderingContext2D, a: Rect, W: number) {
    const b = this.cur;
    if (!b) return;
    const spec = TELOP_SPEC[b.kind];
    const color = b.color ?? spec.color;
    const t = this.t;
    const ease = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;
    const kIn = ease(t / IN);
    const kOut = ease((t - (spec.dur - OUT)) / OUT);
    const slide = (1 - kIn) * -W + kOut * W; // in from the left, out to the right
    const H = spec.minor ? 78 : 108;
    const cy = Math.round(a.y + a.h * (spec.minor ? 0.3 : 0.47));
    ctx.save();
    ctx.globalAlpha = Math.min(1, kIn * 1.4) * (1 - kOut);
    // the ribbon: ink band, type-colored rails, gold hairlines
    ctx.translate(slide, 0);
    ctx.fillStyle = '#101430ee';
    ctx.fillRect(0, cy - H / 2, W, H);
    ctx.fillStyle = color;
    ctx.fillRect(0, cy - H / 2, W, 5);
    ctx.fillRect(0, cy + H / 2 - 5, W, 5);
    ctx.fillStyle = GOLD;
    ctx.fillRect(0, cy - H / 2 + 7, W, 2);
    ctx.fillRect(0, cy + H / 2 - 9, W, 2);
    // speed streaks drift across the band while it holds
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, cy - H / 2 + 9, W, H - 18);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.globalAlpha *= 0.12;
    for (let i = 0; i < 4; i++) {
      const x = ((i * 157 + t * 520) % (W + 120)) - 60;
      ctx.beginPath();
      ctx.moveTo(x, cy + H / 2);
      ctx.lineTo(x + 26, cy + H / 2);
      ctx.lineTo(x + 70, cy - H / 2);
      ctx.lineTo(x + 44, cy - H / 2);
      ctx.fill();
    }
    ctx.restore();
    // art rides in a beat behind the band
    const lag = (1 - ease((t - 0.05) / IN)) * -60;
    const side = H * 0.92;
    const left = b.mon !== undefined ? side + 20 : 24;
    const icon = b.icon ? itemSprite(b.icon) : undefined;
    const right = icon ? side * 0.7 + 24 : 24;
    if (b.mon !== undefined) {
      if (b.kind === 'over') ctx.globalAlpha *= 0.55;
      try {
        drawMon(ctx, b.mon, 14 + side / 2 + lag, cy, side);
      } catch { /* sprite still loading */ }
      if (b.kind === 'over') ctx.globalAlpha /= 0.55;
    }
    if (icon && icon.naturalWidth) {
      const s = side * 0.62;
      const k = s / Math.max(icon.naturalWidth, icon.naturalHeight);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(W - 14 - s / 2 - lag, cy);
      ctx.rotate((1 - kIn) * -2.4); // the ball rolls in with the band
      ctx.drawImage(icon, (-icon.naturalWidth * k) / 2, (-icon.naturalHeight * k) / 2, icon.naturalWidth * k, icon.naturalHeight * k);
      ctx.restore();
    }
    // headline + sub, fitted between the art
    const mid = (left + W - right) / 2;
    const room = W - left - right;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ufit(ctx, b.title, spec.minor ? 20 : 22, room); // font() scales 1.4×: 20 → 28px, 22 → 31px
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    const ty = cy + (b.sub ? (spec.minor ? 2 : 4) : 12);
    ctx.strokeText(b.title, mid, ty);
    ctx.fillStyle = b.kind === 'start' || b.kind === 'ult' || b.kind === 'clear' ? PARCH : color;
    ctx.fillText(b.title, mid, ty);
    if (b.sub) {
      let px = 13;
      ctx.font = fontB(px);
      while (px > 9 && ctx.measureText(b.sub).width > room) ctx.font = fontB(--px);
      ctx.lineWidth = 4;
      ctx.strokeText(b.sub, mid, ty + (spec.minor ? 26 : 32));
      ctx.fillStyle = b.kind === 'start' || b.kind === 'ult' || b.kind === 'clear' ? color : PARCH;
      ctx.fillText(b.sub, mid, ty + (spec.minor ? 26 : 32));
    }
    ctx.restore();
  }
}
