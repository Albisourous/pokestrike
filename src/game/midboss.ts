import { bst, speciesById, type SpeciesDef } from './data';
import { fontB } from './ui';

export const MID_FROM_STOP = 3; // waveIndex, i.e. stop 4
export const MID_SCALE = 1.6;
export const MID_HP = 3; // HP multiplier on top of the wave's hpScale
export const MID_SIG = 3; // turns on the signature countdown (bigT)

export const midBossStop = (o: { stop: number; battle: number; battles: number; gym: boolean; trainer: boolean; event: boolean }) =>
  o.stop >= MID_FROM_STOP && o.battles > 1 && o.battle === o.battles && !o.gym && !o.trainer && !o.event;

export const evolveOnce = (d: SpeciesDef) => {
  const t = d.evolvesTo === undefined ? undefined : [d.evolvesTo].flat()[0];
  return (t !== undefined && speciesById(t)) || d;
};

export function midBossPick<T extends { def: SpeciesDef; boss: boolean; minion?: boolean; dead: boolean }>(foes: T[]): number {
  let pick = -1, power = -1;
  for (let i = 0; i < foes.length; i++) {
    const foe = foes[i];
    if (foe.boss || foe.minion || foe.dead) continue;
    const score = bst(foe.def);
    if (score > power) {
      pick = i;
      power = score;
    }
  }
  return pick;
}

export function drawMidBar(ctx: CanvasRenderingContext2D, u: { def: SpeciesDef; hp: number; maxHp: number }, a: { y: number }) {
  const bw = 240, bx = 270 - bw / 2, by = a.y + 40;
  const pct = Math.max(u.hp / u.maxHp, 0);
  const title = `${u.def.name.toUpperCase()} · MID-BOSS`;
  ctx.textAlign = 'center';
  ctx.font = fontB(10);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(title, 270, by - 1);
  ctx.fillStyle = '#e8ecf4';
  ctx.fillText(title, 270, by - 1);
  ctx.fillStyle = '#000a';
  ctx.fillRect(bx, by + 5, bw, 7);
  ctx.fillStyle = '#c8d0e0';
  ctx.fillRect(bx, by + 5, bw * pct, 7);
  ctx.strokeStyle = '#e8ecf4';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by + 5, bw, 7);
}
