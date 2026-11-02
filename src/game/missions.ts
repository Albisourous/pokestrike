// MS stop missions: each battle stop draws up to 3 optional goals off its
// own seeded stream. They tick live in a HUD chip and each pays a small
// star-piece or dust bonus on the CLEAR card.
import { drawMon, itemSprite, loadItem } from '../core/assets';
import { counterHint, countersGimmick } from './abilities';
import { drawBackdrop, type Theme } from './bg';
import { STAGE_GIMMICKS, bulletHints, type SpeciesDef } from './data';
import { STAGE_GIMMICKS2, countersGimmick2 } from './gimmicks2';
import { fitFontB, fitWrap, monShadow, roundRect } from './screens';
import { TYPE_COLOR } from './types';
import { mulberry32 } from '../core/rng';
import { addDust, recordMissions } from './meta';
import type { PokeType } from './types';
import { GOLD, INK, INK_FAINT, INK_SOFT, PAPER, PARCH, font, fontB, uiPanel, uiWindow } from './ui';

export type MissionId = 'par' | 'multiko' | 'weak3' | 'nofaint' | 'ult' | 'finish';
export type MissionState = 'live' | 'done' | 'fail';
export interface Mission { id: MissionId; label: string; state: MissionState; pay: { kind: 'stars' | 'dust'; n: number }; type?: PokeType }
export interface StopStats { shots: number; par: number; weak: number; faints: number }
export const MISSION_N = 3;
const CARD_FADE = 0.2; // s the quest card takes to fade in and out
export interface StopCard { theme: Theme; name: string; sub: string; foes: SpeciesDef[]; team: SpeciesDef[] }
// the same item art the arena props use where one exists
const GIMMICK_ICON: Record<string, string> = {
  heal: 'oran-berry', gravity: 'hard-stone', warp: 'twisted-spoon', boost: 'quick-claw', power: 'muscle-band',
  mine: 'poison-barb', 'damage-wall': 'rocky-helmet', barrier: 'bright-powder', DRAIN: 'big-root', SAFEGUARD: 'lum-berry',
};
interface GimmickCell { label: string; hint?: string; icon?: string; mon?: number; color: string; counters: SpeciesDef[] }
function gimmickCells(c: StopCard): GimmickCell[] {
  const g = STAGE_GIMMICKS[c.theme];
  const out: GimmickCell[] = [{ label: g.label, hint: counterHint(g).split(' · ')[1], icon: GIMMICK_ICON[g.kind], color: TYPE_COLOR[g.type], counters: c.team.filter((d) => countersGimmick(d, g)) }];
  const g2 = STAGE_GIMMICKS2[c.theme];
  // Pidgeot blows the wind strip, Magnemite holds the laser posts
  if (g2) out.push({ label: g2.label, hint: g2.hint, mon: g2.kind === 'wind' ? 18 : 81, color: TYPE_COLOR[g2.type], counters: c.team.filter((d) => countersGimmick2(d, g2)) });
  for (const h of new Set(c.foes.flatMap((f) => bulletHints(c.theme, f.type)))) out.push({ label: h, icon: GIMMICK_ICON[h], color: INK_FAINT, counters: [] });
  return out;
}
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
  rare = false;
  private t0 = -99;
  private ultUsed = false;
  private banked = false;
  private cardOn = false;
  private cardOut = -99;
  private cardDrawn = -99; // a card nobody has seen can't eat a tap (headless runs)

  start(seed: number, stage: number, teamTypes: PokeType[], ultReady: boolean, now: number, off = false) {
    this.rare = false;
    this.list = off ? [] : pickMissions(seed, stage, teamTypes, ultReady);
    this.t0 = now;
    this.ultUsed = this.banked = false;
    this.cardOn = this.list.length > 0;
  }
  // tap anywhere drops the quest card; true = the tap was spent on it
  dismiss(now: number) {
    if (!this.cardOn || now - this.cardDrawn > 0.5) return false;
    this.cardOn = false;
    this.cardOut = now;
    return true;
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
  draw(ctx: CanvasRenderingContext2D, now: number, arena: { x: number; y: number; w: number; h: number }, s: StopStats, card?: StopCard) {
    if (!this.list.length) return;
    this.tick(s);
    if (this.cardOn && !card) this.dismiss(now); // the shot left aim without a tap (keys)
    ctx.save();
    const a = this.cardOn ? Math.min(1, (now - this.t0) / CARD_FADE) : 1 - (now - this.cardOut) / CARD_FADE;
    if (card && a > 0) drawStopCard(ctx, card, this.list, arena, a, now, this.rare);
    if (card && this.cardOn) this.cardDrawn = now;
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

// MS quest card: court strip with the foes on it, gimmick icons with the
// team's counters beside each, three mission chips. Held until a tap.
function drawStopCard(ctx: CanvasRenderingContext2D, c: StopCard, list: Mission[], arena: { x: number; y: number; w: number; h: number }, alpha: number, now: number, rare: boolean) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10,14,30,0.6)';
  ctx.fillRect(arena.x, arena.y, arena.w, arena.h);
  const r = { x: arena.x + 12, y: arena.y + 136, w: arena.w - 24, h: 436 };
  const ir = uiPanel(ctx, r, c.name.toUpperCase(), { sub: c.sub });
  ctx.textAlign = 'center';

  const strip = { x: ir.x, y: ir.y, w: ir.w, h: 104 };
  drawBackdrop(ctx, strip, 8, c.theme);
  const foes = c.foes.slice(0, 5);
  const step = Math.min(84, strip.w / Math.max(1, foes.length));
  foes.forEach((f, i) => {
    const fx = strip.x + strip.w / 2 + (i - (foes.length - 1) / 2) * step;
    monShadow(ctx, fx, strip.y + 42, 64);
    drawMon(ctx, f.id, fx, strip.y + 48, 72);
  });

  const head = (t: string, y: number) => {
    ctx.textAlign = 'left';
    ctx.font = fontB(12);
    ctx.fillStyle = INK_FAINT;
    ctx.fillText(t, ir.x + 2, y);
    ctx.textAlign = 'center';
  };
  const cells = gimmickCells(c);
  const gy = strip.y + strip.h + 24;
  head('GIMMICKS', gy);
  const gw = (ir.w - (cells.length - 1) * 8) / cells.length;
  cells.forEach((g, i) => {
    const x = ir.x + i * (gw + 8), y = gy + 8, mid = x + gw / 2;
    roundRect(ctx, x, y, gw, 92, 8);
    ctx.fillStyle = 'rgba(42,36,64,0.08)';
    ctx.fill();
    ctx.fillStyle = g.color;
    ctx.fillRect(x + 8, y + 88, gw - 16, 3);
    const mons = g.counters.slice(0, 2);
    const extra = g.counters.length - mons.length;
    let px = mid - (mons.length * 42 + (extra ? 20 : 0)) / 2;
    if (g.mon) drawMon(ctx, g.mon, px, y + 24, 52);
    else if (g.icon) icon(ctx, g.icon, px, y + 24, 40);
    mons.forEach((d) => drawMon(ctx, d.id, (px += 42), y + 24, 48));
    if (extra) {
      ctx.font = fontB(12);
      ctx.fillStyle = INK_SOFT;
      ctx.fillText(`+${extra}`, px + 28, y + 29);
    }
    ctx.fillStyle = INK;
    fitFontB(ctx, g.label, 14, gw - 10);
    ctx.fillText(g.label, mid, y + 58);
    if (g.hint) {
      ctx.fillStyle = INK_SOFT;
      fitWrap(ctx, g.hint, gw - 10, 11, 2).forEach((l, li) => ctx.fillText(l, mid, y + 73 + li * 12));
    }
  });

  const my = gy + 8 + 92 + 26;
  head('MISSIONS', my);
  const mw = (ir.w - 16) / 3;
  list.slice(0, 3).forEach((m, i) => {
    const x = ir.x + i * (mw + 8), y = my + 8;
    uiWindow(ctx, { x, y, w: mw, h: 62 }, { rad: 8, dark: true });
    ctx.fillStyle = PARCH;
    const lines = fitWrap(ctx, m.label, mw - 14, 13, 2);
    lines.forEach((l, li) => ctx.fillText(l, x + mw / 2, y + (lines.length > 1 ? 20 : 27) + li * 14));
    ctx.font = fontB(13);
    ctx.fillStyle = GOLD;
    ctx.fillText(`+${m.pay.n}`, x + mw / 2 - 10, y + 52);
    icon(ctx, payIcon(m), x + mw / 2 + 14, y + 47, 20);
  });

  if (rare) {
    ctx.textAlign = 'left';
    ctx.font = fontB(16);
    ctx.fillStyle = INK;
    ctx.fillText('? · SOMETHING RARE NEARBY', ir.x + 4, my + 94);
  }

  ctx.globalAlpha = alpha * (0.6 + 0.4 * Math.sin(now * 5));
  ctx.font = font(10);
  ctx.fillStyle = INK;
  ctx.fillText('TAP TO START', r.x + r.w / 2, r.y + r.h - 16);
  ctx.restore();
}
