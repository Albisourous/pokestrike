// MS treasure drops: each KO'd foe may pop a ball (MS rolls a per-enemy
// self-drop rate, then picks one of its drop slots). Balls bank at stop end;
// the reveal opens them one by one after the CLEAR card.
import { itemSprite, loadItem } from '../core/assets';
import { sfx, buzz } from '../core/audio';
import { mulberry32 } from '../core/rng';
import { BAG_ITEMS } from './perks';
import { addDust, bankBag } from './meta';
import { INK, INK_SOFT, GOLD_HI, PARCH, font, fontB, scrim, uiWindow, uiBand } from './ui';

export const BALL_TIERS = ['poke-ball', 'great-ball', 'ultra-ball', 'master-ball'] as const;
export type BallTier = (typeof BALL_TIERS)[number];
export const DROP_BASE = 0.35; // a plain KO's drop chance
export const DROP_CAP = 0.85;
export const STOP_CAP = 12; // balls per stop, keeps the reveal short
export const TIER_W = [70, 22, 7, 1]; // poke/great/ultra/master before performance
export const OPEN_T = 0.7; // seconds per ball in the reveal
const OPEN_SHAKE = 0.42;
const DROP_ARC = 0.5;

export interface KoPerf { boss: boolean; weak: boolean; finisher: boolean; combo: number; speed: boolean }
export type LootKind = 'stars' | 'dust' | 'item';
export interface LootReward { tier: BallTier; kind: LootKind; n: number; id?: string; got?: number }

// each ball holds one prize — only the existing wallets and the run's bag pool
export const LOOT_TABLE: Record<BallTier, { w: number; kind: LootKind; n: number }[]> = {
  'poke-ball': [{ w: 7, kind: 'stars', n: 1 }, { w: 3, kind: 'dust', n: 2 }],
  'great-ball': [{ w: 6, kind: 'stars', n: 3 }, { w: 4, kind: 'dust', n: 6 }],
  'ultra-ball': [{ w: 5, kind: 'stars', n: 6 }, { w: 3, kind: 'dust', n: 12 }, { w: 2, kind: 'item', n: 1 }],
  'master-ball': [{ w: 4, kind: 'stars', n: 15 }, { w: 6, kind: 'item', n: 1 }],
};

// weak-point KO, finishing blow, speed clear and the shot's combo each lift the odds
export function perfScore(p: KoPerf) {
  return (p.weak ? 1 : 0) + (p.finisher ? 1 : 0) + (p.speed ? 1 : 0) + Math.min(2, Math.max(0, p.combo) / 5);
}

export function dropOdds(p: KoPerf): { chance: number; weights: number[] } {
  const s = perfScore(p);
  const weights = [Math.max(20, TIER_W[0] - 9 * s), TIER_W[1] + 5 * s, TIER_W[2] + 3 * s, TIER_W[3] + 0.6 * s];
  if (p.boss) weights[0] = 0; // bosses never drop below a Great Ball
  return { chance: p.boss ? 1 : Math.min(DROP_CAP, DROP_BASE + 0.1 * s), weights };
}

const pickW = (rng: () => number, ws: number[]) => {
  let r = rng() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ws.length; i++) if ((r -= ws[i]) < 0) return i;
  return ws.length - 1;
};

export function rollDrop(rng: () => number, p: KoPerf): BallTier | null {
  const o = dropOdds(p);
  return rng() < o.chance ? BALL_TIERS[pickW(rng, o.weights)] : null;
}

export function rollReward(rng: () => number, tier: BallTier): LootReward {
  const slot = LOOT_TABLE[tier][pickW(rng, LOOT_TABLE[tier].map((s) => s.w))];
  const r: LootReward = { tier, kind: slot.kind, n: slot.n };
  if (slot.kind === 'item') r.id = BAG_ITEMS[Math.floor(rng() * BAG_ITEMS.length)].id;
  return r;
}

const rewardIcon = (r: LootReward) => (r.kind === 'stars' ? 'star-piece' : r.kind === 'dust' ? 'stardust' : BAG_ITEMS.find((i) => i.id === r.id)?.item ?? 'poke-ball');
const rewardText = (r: LootReward) => {
  const n = r.got ?? r.n;
  if (r.kind === 'stars') return `+${n} STAR PIECE${n > 1 ? 'S' : ''}`;
  if (r.kind === 'dust') return `+${n} DUST`;
  return (BAG_ITEMS.find((i) => i.id === r.id)?.name ?? 'ITEM').toUpperCase();
};

interface FieldBall { tier: BallTier; reward: LootReward; x: number; y: number; dx: number; t0: number; cT?: number; tx?: number; ty?: number; banked?: boolean }

function icon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, s: number) {
  void loadItem(name);
  const img = itemSprite(name);
  if (!img) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
}

export class Treasure {
  field: FieldBall[] = [];
  stop: LootReward[] = []; // collected this stop, not yet banked
  reveal: LootReward[] = []; // banked at stop end, shown after the CLEAR card
  opened = 0; // run tally for the result card
  private t0: number | null = null;
  private popped = 0;

  // one draw stream per foe, seeded off the run so `?seed=` replays never shift
  ko(e: { x: number; y: number; r: number }, seed: number, p: KoPerf & { off?: boolean }, now: number) {
    this.field = this.field.filter((b) => !b.banked);
    if (p.off || this.field.length + this.stop.length >= STOP_CAP) return null;
    const rng = mulberry32(seed);
    const tier = rollDrop(rng, p);
    if (!tier) return null;
    const reward = rollReward(rng, tier);
    this.field.push({ tier, reward, x: e.x, y: e.y + e.r * 0.3, dx: (rng() - 0.5) * 60, t0: now });
    return tier;
  }

  // battle end: balls on court lift off and fly to the top edge
  collect(now: number, tx: number, ty: number) {
    for (const b of this.field) if (b.cT == null) Object.assign(b, { cT: Math.max(now, b.t0 + DROP_ARC) + 0.25, tx, ty });
  }

  // stop end: everything collected banks now, so a skipped reveal loses nothing
  endStop(now: number, tx: number, ty: number, earnStars: (n: number) => number) {
    this.collect(now, tx, ty);
    const all = [...this.stop, ...this.field.filter((b) => !b.banked).map((b) => b.reward)];
    for (const b of this.field) b.banked = true;
    this.stop = [];
    for (const r of all) {
      if (r.kind === 'stars') r.got = earnStars(r.n);
      else if (r.kind === 'dust') addDust(r.n);
      else if (r.id) bankBag(r.id);
    }
    this.reveal = all;
    this.opened += all.length;
    this.t0 = null;
  }

  draw(ctx: CanvasRenderingContext2D, now: number) {
    for (let i = this.field.length - 1; i >= 0; i--) {
      const b = this.field[i];
      const a = Math.min(1, (now - b.t0) / DROP_ARC);
      let x = b.x + b.dx * a;
      let y = b.y - Math.sin(Math.PI * a) * 64 - (a >= 1 ? Math.abs(Math.sin((now - b.t0 - DROP_ARC) * 9)) * 6 * Math.max(0, 1 - (now - b.t0 - DROP_ARC) * 2.5) : 0);
      let alpha = 1, s = 30;
      if (b.cT != null && now > b.cT) {
        const c = Math.min(1, (now - b.cT) / 0.5);
        x += ((b.tx ?? x) - x) * c * c;
        y += ((b.ty ?? y) - y) * c * c;
        alpha = 1 - c;
        s = 30 - 10 * c;
        if (c >= 1) {
          this.field.splice(i, 1);
          if (!b.banked) this.stop.push(b.reward);
          continue;
        }
      }
      ctx.save();
      ctx.globalAlpha = 0.3 * alpha;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(b.x + b.dx * a, b.y + 12, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      icon(ctx, b.tier, x, y, s);
      ctx.restore();
    }
  }

  // --- reveal ---------------------------------------------------------------
  showing() {
    return this.t0 != null;
  }
  show(t: number) {
    if (!this.reveal.length) return;
    this.t0 = t;
    this.popped = 0;
    this.field = [];
  }
  private span() {
    return 0.3 + this.reveal.length * OPEN_T;
  }
  // first tap skips to the summary, the next one closes
  tap(t: number) {
    if (this.t0 == null) return false;
    if (t - this.t0 < this.span()) {
      this.t0 = t - this.span();
      this.popped = this.reveal.length;
    } else {
      this.t0 = null;
      this.reveal = [];
    }
    return true;
  }

  drawReveal(ctx: CanvasRenderingContext2D, t: number) {
    if (this.t0 == null) return;
    const W = 540, age = t - this.t0, list = this.reveal, n = list.length;
    const opened = Math.max(0, Math.min(n, Math.floor((age - 0.3 - OPEN_SHAKE) / OPEN_T) + 1));
    if (opened > this.popped) {
      this.popped = opened;
      sfx(list[opened - 1].tier === 'master-ball' ? 'perfect' : 'caught');
      buzz(20);
    }
    const done = age >= this.span();
    ctx.save();
    scrim(ctx, 0.78);
    const panel = { x: 30, y: 210, w: W - 60, h: 480 };
    uiWindow(ctx, panel, { rad: 10 });
    uiBand(ctx, panel, `TREASURE · ${n} BALL${n > 1 ? 'S' : ''}`, { h: 40 });
    const cx = W / 2;
    ctx.textAlign = 'center';
    // stage: the ball being opened shakes, then pops into its prize
    const cur = Math.min(n - 1, Math.max(0, Math.floor((age - 0.3) / OPEN_T)));
    const local = age - 0.3 - cur * OPEN_T;
    const sy = panel.y + 140;
    if (!done && local >= 0) {
      const r = list[cur];
      if (local < OPEN_SHAKE) {
        ctx.save();
        ctx.translate(cx, sy + 30);
        ctx.rotate(Math.sin(local * 38) * 0.32 * (1 - local / OPEN_SHAKE));
        icon(ctx, r.tier, 0, -30, 120);
        ctx.restore();
      } else {
        const p = Math.min(1, (local - OPEN_SHAKE) / 0.14);
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, sy, 40 + 50 * p, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(cx, sy);
        ctx.scale(0.6 + 0.4 * p, 0.6 + 0.4 * p);
        icon(ctx, rewardIcon(r), 0, 0, 96);
        ctx.restore();
        ctx.font = font(15);
        ctx.fillStyle = INK;
        ctx.fillText(rewardText(r), cx, sy + 80);
      }
    } else if (done) {
      ctx.font = font(30);
      ctx.lineWidth = 6;
      ctx.strokeStyle = INK;
      ctx.strokeText('OPENED!', cx, sy + 10);
      ctx.fillStyle = GOLD_HI;
      ctx.fillText('OPENED!', cx, sy + 10);
    }
    // the strip: every ball of the stop, prizes showing once opened
    const step = Math.min(64, (panel.w - 40) / n), s = Math.min(44, step - 4);
    const x0 = cx - (step * (n - 1)) / 2, by = panel.y + 280;
    list.forEach((r, i) => {
      ctx.globalAlpha = i < opened ? 1 : i === cur && !done ? 0.35 : 0.8;
      icon(ctx, i < opened ? rewardIcon(r) : r.tier, x0 + i * step, by, s);
    });
    ctx.globalAlpha = 1;
    // running tally of what landed
    const got = list.slice(0, opened);
    const sum = (k: LootKind) => got.filter((r) => r.kind === k).reduce((a, r) => a + (r.got ?? r.n), 0);
    const rows: [string, string][] = [];
    if (sum('stars')) rows.push(['star-piece', `+${sum('stars')} STAR PIECES`]);
    if (sum('dust')) rows.push(['stardust', `+${sum('dust')} DUST`]);
    for (const r of got) if (r.kind === 'item') rows.push([rewardIcon(r), `${rewardText(r)} · TO BAG`]);
    ctx.textAlign = 'left';
    rows.slice(0, 4).forEach(([ic, label], i) => {
      const y = panel.y + 350 + i * 40;
      icon(ctx, ic, panel.x + 54, y - 8, 36);
      ctx.font = fontB(22);
      ctx.fillStyle = label.endsWith('BAG') ? INK_SOFT : INK;
      ctx.fillText(label, panel.x + 84, y);
    });
    ctx.restore();
    if (Math.floor(age * 2.2) % 2 === 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = fontB(18);
      ctx.fillStyle = PARCH;
      ctx.fillText(done ? 'TAP TO CONTINUE' : 'TAP TO SKIP', cx, panel.y + panel.h + 44);
      ctx.restore();
    }
  }
}
