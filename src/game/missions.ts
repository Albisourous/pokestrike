// MS stop missions: each battle stop draws up to 3 optional goals off its
// own seeded stream. They tick live in a HUD chip and each pays a small
// star-piece or dust bonus on the CLEAR card.
import { itemSprite, loadItem } from '../core/assets';
import { mulberry32 } from '../core/rng';
import { addDust, recordMissions } from './meta';
import type { PokeType } from './types';
import { INK, INK_SOFT, PAPER, font, fontB, uiWindow } from './ui';

export type MissionId = 'par' | 'multiko' | 'weak3' | 'nofaint' | 'ult' | 'finish';
export type MissionState = 'live' | 'done' | 'fail';
export interface Mission { id: MissionId; label: string; state: MissionState; pay: { kind: 'stars' | 'dust'; n: number }; type?: PokeType }
export interface StopStats { shots: number; par: number; weak: number; faints: number }
export const MISSION_N = 3;
export const PREVIEW_T = 3.2; // seconds the stop-start mission card holds
export const MISSION_PAY: Record<MissionId, Mission['pay']> = {
  par: { kind: 'stars', n: 2 },
  multiko: { kind: 'dust', n: 4 },
  weak3: { kind: 'dust', n: 4 },
  nofaint: { kind: 'stars', n: 2 },
  ult: { kind: 'dust', n: 3 },
  finish: { kind: 'stars', n: 1 },
};
const LABEL: Record<Exclude<MissionId, 'finish'>, string> = {
  par: 'SPEED CLEAR',
  multiko: 'KO 2 IN ONE SHOT',
  weak3: 'HIT 3 WEAK POINTS',
  nofaint: 'NO MON FAINTS',
  ult: 'USE A ULT',
};

// deterministic: same seed + stage + team → same three goals. The ULT goal
// only shows when the charge can land inside the stop
export function pickMissions(seed: number, stage: number, teamTypes: PokeType[], ultReady: boolean): Mission[] {
  const rng = mulberry32((seed * 2654435761 + stage * 40503) >>> 0);
  const pool: MissionId[] = ['par', 'multiko', 'weak3', 'nofaint', 'finish'];
  if (ultReady) pool.push('ult');
  const types = [...new Set(teamTypes)].sort();
  if (!types.length) pool.splice(pool.indexOf('finish'), 1);
  const out: Mission[] = [];
  while (out.length < MISSION_N && pool.length) {
    const id = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const type = id === 'finish' ? types[Math.floor(rng() * types.length)] : undefined;
    out.push({ id, type, label: type ? `FINISH WITH ${type.toUpperCase()}` : LABEL[id as keyof typeof LABEL], state: 'live', pay: MISSION_PAY[id] });
  }
  return out;
}

function icon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, s: number) {
  void loadItem(name);
  const img = itemSprite(name);
  if (!img) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
}
const payIcon = (m: Mission) => (m.pay.kind === 'stars' ? 'star-piece' : 'stardust');

export class Missions {
  list: Mission[] = [];
  private t0 = -99;
  private ultUsed = false;
  private banked = false;

  start(seed: number, stage: number, teamTypes: PokeType[], ultReady: boolean, now: number, off = false) {
    this.list = off ? [] : pickMissions(seed, stage, teamTypes, ultReady);
    this.t0 = now;
    this.ultUsed = this.banked = false;
  }
  ult() {
    this.ultUsed = true;
    this.tick();
  }
  // per KO: a 2-KO shot ticks at once; the stop's last KO settles the type goal
  ko(kosThisShot: number, finishType?: PokeType | null) {
    for (const m of this.list) {
      if (m.state !== 'live') continue;
      if (m.id === 'multiko' && kosThisShot >= 2) m.state = 'done';
      if (m.id === 'finish' && finishType !== undefined) m.state = finishType === m.type ? 'done' : 'fail';
    }
  }
  tick(s?: StopStats) {
    for (const m of this.list) {
      if (m.state !== 'live') continue;
      if (m.id === 'ult' && this.ultUsed) m.state = 'done';
      if (!s) continue;
      if (m.id === 'weak3' && s.weak >= 3) m.state = 'done';
      if (m.id === 'par' && s.shots > s.par) m.state = 'fail';
      if (m.id === 'nofaint' && s.faints > 0) m.state = 'fail';
    }
  }
  // stop end: settle every goal and pay the done ones exactly once
  clear(stage: number, s: StopStats, earnStars: (n: number) => number) {
    this.tick(s);
    if (this.banked) return this.list;
    this.banked = true;
    for (const m of this.list) {
      if (m.state === 'live') m.state = m.id === 'par' || m.id === 'nofaint' ? 'done' : 'fail';
      if (m.state !== 'done') continue;
      if (m.pay.kind === 'stars') m.pay = { ...m.pay, n: earnStars(m.pay.n) };
      else addDust(m.pay.n);
    }
    if (this.list.length) recordMissions(stage, this.list.filter((m) => m.state === 'done').length);
    return this.list;
  }

  // the stop-start card, then a small chip of three ticks under the HUD
  draw(ctx: CanvasRenderingContext2D, now: number, arena: { x: number; y: number; w: number; h: number }, s: StopStats) {
    if (!this.list.length) return;
    this.tick(s);
    ctx.save();
    const age = now - this.t0;
    if (age < PREVIEW_T) {
      const a = Math.min(1, age / 0.2, (PREVIEW_T - age) / 0.4);
      ctx.globalAlpha = a;
      const r = { x: arena.x + 40, y: arena.y + arena.h * 0.58, w: arena.w - 80, h: 40 + this.list.length * 40 };
      uiWindow(ctx, r, { rad: 10 });
      ctx.textAlign = 'center';
      ctx.font = font(14);
      ctx.fillStyle = INK;
      ctx.fillText('MISSIONS', r.x + r.w / 2, r.y + 28);
      this.list.forEach((m, i) => {
        const y = r.y + 62 + i * 40;
        ctx.textAlign = 'left';
        ctx.font = fontB(20);
        ctx.fillStyle = INK;
        ctx.fillText(m.label, r.x + 20, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = INK_SOFT;
        ctx.fillText(`+${m.pay.n}`, r.x + r.w - 46, y);
        icon(ctx, payIcon(m), r.x + r.w - 28, y - 7, 26);
      });
    }
    const c = { x: arena.x + arena.w - 98, y: arena.y + 8, w: 90, h: 30 };
    ctx.globalAlpha = 0.92;
    uiWindow(ctx, c, { rad: 8, tint: PAPER });
    this.list.forEach((m, i) => {
      const x = c.x + 18 + i * 27, y = c.y + c.h / 2;
      ctx.globalAlpha = m.state === 'done' ? 1 : m.state === 'live' ? 0.4 : 0.12;
      icon(ctx, payIcon(m), x, y, m.state === 'done' ? 24 : 20);
    });
    ctx.restore();
  }
}

// CLEAR card section: three ticks beside the rank, each with its pay
export function drawMissionTicks(ctx: CanvasRenderingContext2D, list: Mission[], x: number, y: number, alpha: number) {
  if (!list.length) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'left';
  ctx.font = fontB(14);
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(`MISSIONS ${list.filter((m) => m.state === 'done').length}/${list.length}`, x, y - 44);
  list.forEach((m, i) => {
    const ry = y - 16 + i * 30;
    const done = m.state === 'done';
    ctx.globalAlpha = alpha * (done ? 1 : 0.3);
    icon(ctx, payIcon(m), x + 12, ry - 6, 24);
    ctx.font = fontB(18);
    ctx.fillStyle = done ? '#2f9a3a' : INK_SOFT;
    ctx.fillText(done ? `✓ +${m.pay.n}` : '✗', x + 30, ry);
  });
  ctx.restore();
}
