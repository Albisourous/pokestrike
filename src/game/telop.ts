// Battle banners ("telops"): one full-width ribbon at a time for the big
// beats of a fight, Monster Strike's idea in FRLG dress. A priority queue
// feeds a short sweep-in, hold and sweep-out. Banners never gate input; a
// tap skips straight to the sweep-out.
import { drawMon, itemSprite, loadItem } from '../core/assets';
import { buzz, sfx, type Sfx } from '../core/audio';
import { fontB, ufit, GOLD, GOLD_HI, PARCH, type Rect } from './ui';
import { speciesById } from './data';
import { settings } from './meta';
import { TYPE_COLOR } from './types';

export type TelopKind = 'start' | 'boss' | 'phase' | 'weak' | 'shield' | 'combo' | 'speed' | 'clear' | 'over' | 'ult' | 'foe' | 'connect';

export interface Telop {
  kind: TelopKind;
  title: string;
  sub?: string;
  mon?: number; // front sprite on the left
  icon?: string; // item or `badges/<n>` on the right
  mons?: number[]; // a row of fronts under the title (ALL CONNECT)
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
  connect: { pri: 2, dur: 1, ttl: 1, color: '#7cf29a', sfx: 'chime' },
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

type Live = Telop & { wait: number; color?: string; tint?: string };

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
    const still = settings().shake === 0; // reduced-motion seed: new flourishes land settled
    // hairlines take the portrait's primary type — a foe banner reads its type at a glance
    if (b.tint === undefined) {
      const d = b.mon !== undefined ? speciesById(b.mon) : undefined;
      b.tint = d ? TYPE_COLOR[d.type] : GOLD;
    }
    const t = this.t;
    const ease = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;
    const kIn = ease(t / IN);
    const kOut = ease((t - (spec.dur - OUT)) / OUT);
    const slide = (1 - kIn) * -W + kOut * W; // in from the left, out to the right
    const H = spec.minor ? 78 : b.kind === 'boss' ? 120 : 108;
    const cy = Math.round(a.y + a.h * (spec.minor ? 0.3 : 0.47));
    ctx.save();
    ctx.globalAlpha = Math.min(1, kIn * 1.4) * (1 - kOut);
    // the ribbon: ink band, type-colored rails, type-tinted hairlines
    ctx.translate(slide, 0);
    ctx.fillStyle = b.kind === 'over' ? '#0a0d1af2' : '#101430ee';
    ctx.fillRect(0, cy - H / 2, W, H);
    ctx.fillStyle = color;
    ctx.fillRect(0, cy - H / 2, W, 5);
    ctx.fillRect(0, cy + H / 2 - 5, W, 5);
    if (b.kind === 'boss') {
      // hazard tape: dark slashes across the rails mark the boss band
      ctx.fillStyle = '#101430';
      for (const ry of [cy - H / 2, cy + H / 2 - 5])
        for (let x = -8; x < W; x += 24) {
          ctx.beginPath();
          ctx.moveTo(x, ry);
          ctx.lineTo(x + 10, ry);
          ctx.lineTo(x + 17, ry + 5);
          ctx.lineTo(x + 7, ry + 5);
          ctx.fill();
        }
    }
    ctx.fillStyle = b.tint;
    ctx.fillRect(0, cy - H / 2 + 7, W, 2);
    ctx.fillRect(0, cy + H / 2 - 9, W, 2);
    // the mon's type bleeds in off both ribbon ends — a foe banner's element
    // reads before the name does; no mon, the fallback gold ends
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = b.tint;
    const glow = ctx.globalAlpha;
    for (const [gx, gw, ga] of [[0, 36, 0.18], [36, 22, 0.07], [W - 36, 36, 0.18], [W - 58, 22, 0.07]] as const) {
      ctx.globalAlpha = glow * ga;
      ctx.fillRect(gx, cy - H / 2, gw, H);
    }
    ctx.restore();
    // speed streaks drift across the band while it holds — speed runs them hotter, GAME OVER holds them dead still
    const streak = b.kind === 'over' ? 0 : b.kind === 'speed' ? 1.6 : 1;
    if (streak) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, cy - H / 2 + 9, W, H - 18);
      ctx.clip();
      const bandA = ctx.globalAlpha; // banner fade — the sparks scale off it
      ctx.fillStyle = color;
      ctx.globalAlpha = bandA * 0.12;
      for (let i = 0; i < 4; i++) {
        const x = ((i * 157 + t * 520 * streak) % (W + 120)) - 60;
        ctx.beginPath();
        ctx.moveTo(x, cy + H / 2);
        ctx.lineTo(x + 26, cy + H / 2);
        ctx.lineTo(x + 70, cy - H / 2);
        ctx.lineTo(x + 44, cy - H / 2);
        ctx.fill();
      }
      // ult and boss bands carry a finer spark streak on top — type-tinted
      // motes with a white mix; reduced motion parks them mid-flight
      if (b.kind === 'ult' || b.kind === 'boss') {
        const g = still ? 0.5 : t;
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i % 2 ? b.tint : '#ffffff';
          ctx.globalAlpha = bandA * (0.3 + 0.18 * Math.sin(i * 2.4 + g * 9));
          ctx.fillRect(((i * 97 + g * 680) % (W + 40)) - 20, cy - H / 2 + 12 + ((i * 41) % (H - 24)), 3, 3);
        }
      }
      ctx.restore();
    }
    // art rides in a beat behind the band; a boss front bursts the ribbon
    const lag = (1 - ease((t - 0.05) / IN)) * -60;
    const side = H * (b.kind === 'boss' ? 1.14 : 0.92);
    const left = b.mon !== undefined ? side + 20 : 24;
    const icon = b.icon ? itemSprite(b.icon) : undefined;
    const right = icon ? Math.min(side, H * 0.92) * 0.7 + 24 : 24;
    if (b.mon !== undefined) {
      if (b.kind === 'over') ctx.globalAlpha *= 0.55;
      try {
        drawMon(ctx, b.mon, 14 + side / 2 + lag, cy, side);
      } catch { /* sprite still loading */ }
      if (b.kind === 'over') ctx.globalAlpha /= 0.55;
    }
    if (icon && icon.naturalWidth) {
      const s = Math.min(side, H * 0.92) * 0.62;
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
    ufit(ctx, b.title, spec.minor ? 20 : b.kind === 'boss' ? 25 : 22, room); // font() scales 1.4×: 20 → 28px, 22 → 31px
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    const ty = cy + (b.sub || b.mons ? (spec.minor ? 2 : 4) : 12);
    // the scale kick climbs with the chain tier — NICE pops, EXCELLENT slams
    const tier = b.kind === 'combo' ? Math.max(0, COMBO_TIERS.findIndex(([, l]) => l === b.title)) : 0;
    const pop = !still && (b.kind === 'combo' || b.kind === 'connect' || b.kind === 'boss' || b.kind === 'ult') ? 1 + (1 - kIn) * (0.45 + tier * 0.18) : 1;
    ctx.fillStyle = b.kind === 'start' || b.kind === 'ult' || b.kind === 'clear' ? PARCH : color;
    ctx.save();
    ctx.translate(mid, ty);
    if (pop !== 1) ctx.scale(pop, pop);
    ctx.strokeText(b.title, 0, 0);
    ctx.fillText(b.title, 0, 0);
    ctx.restore();
    if (b.sub) {
      let px = 13;
      ctx.font = fontB(px);
      while (px > 9 && ctx.measureText(b.sub).width > room) ctx.font = fontB(--px);
      // the fontB floor can't shrink past 12 — a still-wide sub ellipsizes
      // at the art's edge instead of inking over the mon
      let sub = b.sub;
      if (ctx.measureText(sub).width > room) {
        while (sub.length > 3 && ctx.measureText(sub.trimEnd() + '…').width > room) sub = sub.slice(0, -1);
        sub = sub.trimEnd() + '…';
      }
      ctx.lineWidth = 4;
      ctx.strokeText(sub, mid, ty + (spec.minor ? 26 : 32));
      ctx.fillStyle = b.kind === 'start' || b.kind === 'ult' || b.kind === 'clear' ? color : PARCH;
      ctx.fillText(sub, mid, ty + (spec.minor ? 26 : 32));
    }
    if (b.mons && b.mons.length > 1) {
      // ALL CONNECT: the chain literally links the fronts
      const half = ((b.mons.length - 1) / 2) * 52;
      ctx.save();
      ctx.globalAlpha *= 0.55 * (still ? 1 : ease((t - 0.12) / 0.3));
      ctx.fillStyle = color;
      ctx.fillRect(mid - half, cy + 26, half * 2, 4);
      ctx.restore();
    }
    b.mons?.forEach((id, i, all) => {
      const d = still ? 0 : (1 - ease((t - 0.04 - i * 0.05) / IN)) * -34;
      try {
        drawMon(ctx, id, mid + (i - (all.length - 1) / 2) * 52 + d, cy + 28, 40);
      } catch { /* sprite still loading */ }
    });
    ctx.restore();
  }
}
