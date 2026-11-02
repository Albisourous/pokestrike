import { mulberry32 } from '../core/rng';
import { playJingle } from '../core/audio';
import { speciesById, TOTAL_STAGES } from './data';
import type { SpeciesDef, WaveSpawn } from './data';
import { markSecret, recordCapture } from './meta';
import type { ClearRank } from './meta';
import type { Battle, Unit } from './battle';
import { MAP_W, MAP_H, T_GRASS, drawTile } from './map';
import type { MapNode, RegionMap } from './map';
import * as MT from './maptiles';
import { font } from './ui';

export const SECRET_ODDS: Partial<Record<ClearRank, number>> = { S: 0.35, A: 0.15 };
export const SECRET_STARS = [40, 60] as const;
export const SECRET_HP = 1.25;
const POOL_0 = [144, 145, 146];
const POOL_1_A = [243, 244, 245];
const POOL_1_S = [249, 250, 381];
export const SECRET_IDS = [...POOL_0, ...POOL_1_A, ...POOL_1_S];
const secretRoutes = new WeakMap<MapNode, number[]>();

export const secretRng = (mapSeed: number, row: number) =>
  mulberry32(((mapSeed ^ 0x5ec2e7) + row * 7919) >>> 0);

export function rollSecret(
  mapSeed: number,
  row: number,
  rank: ClearRank,
  rng = secretRng(mapSeed, row),
): SpeciesDef | null {
  const odds = SECRET_ODDS[rank];
  if (row % 3 !== 2 || row >= TOTAL_STAGES - 1 || odds == null || rng() >= odds) return null;
  const pool = row < 3 ? POOL_0 : rank === 'S' ? POOL_1_S : POOL_1_A;
  return speciesById(pool[Math.floor(rng() * pool.length)]) ?? null;
}

const carve = (region: RegionMap, a: MapNode, b: MapNode, added: number[]) => {
  const seg = (x1: number, y1: number, x2: number, y2: number) => {
    while (x1 !== x2 || y1 !== y2) {
      const i = y1 * MAP_W + x1;
      if (!region.route.has(i)) { region.route.add(i); added.push(i); }
      if (x1 !== x2) x1 += Math.sign(x2 - x1);
      else y1 += Math.sign(y2 - y1);
    }
    const i = y2 * MAP_W + x2;
    if (!region.route.has(i)) { region.route.add(i); added.push(i); }
  };
  if ((a.tx + b.ty) % 2) {
    seg(a.tx, a.ty, b.tx, a.ty);
    seg(b.tx, a.ty, b.tx, b.ty);
  } else {
    seg(a.tx, a.ty, a.tx, b.ty);
    seg(a.tx, b.ty, b.tx, b.ty);
  }
};

export function placeSecret(region: RegionMap, gymIdx: number): MapNode {
  const gym = region.nodes[gymIdx];
  if (!gym || gym.kind !== 'gym') throw new Error('secret lair requires a gym node');
  const forks = region.nodes.map((node, i) => ({ node, i })).filter(({ node }) => node.row === gym.row + 1);
  const node: MapNode = {
    kind: 'secret',
    row: gym.row,
    tx: Math.round((MAP_W - 1) / 2),
    ty: forks[0]?.node.ty ?? gym.ty - 2,
    links: forks.map(({ i }) => i),
  };
  const added: number[] = [];
  region.nodes.push(node);
  const secretIdx = region.nodes.length - 1;
  gym.links.push(secretIdx);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (Math.abs(dx) + Math.abs(dy) > 1) continue;
    const x = node.tx + dx, y = node.ty + dy;
    if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) {
      const i = y * MAP_W + x;
      region.tiles[i] = T_GRASS;
      region.decor.delete(i);
    }
  }
  for (const i of [...region.decor.keys()]) {
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    if (Math.abs(x - node.tx) <= 1 && Math.abs(y - node.ty) <= 1) region.decor.delete(i);
  }
  carve(region, gym, node, added);
  for (const { node: fork } of forks) carve(region, node, fork, added);
  secretRoutes.set(node, added);
  return node;
}

type SecretBattle = {
  secret: SecretState | null;
  regionMap: RegionMap;
  mapSeed: number;
  waveIndex: number;
  mapNode: number;
  pendingNext: number;
  phase: string;
  players: Unit[];
  enemies: Unit[];
  box: SpeciesDef[];
  pendingEventWave: WaveSpawn[] | null;
  mapNote: string;
  waveSpecial: string | null;
  waveHadGym: boolean;
  rng: () => number;
  clearCard: unknown;
  starsRun: number;
  boxSel: number;
  teamSel: number;
  fieldLog: string[];
  eventBox: { note: string; art?: { mon?: number } } | null;
  telop: { push: (x: unknown) => void };
  spawnWave: (i: number, node?: MapNode) => void;
  nextTurn: () => void;
  screenFlash: (color: string, t: number) => void;
  absorbDupe: (d: SpeciesDef) => boolean;
  boxAdd: (d: SpeciesDef, hp?: number, theatre?: boolean) => void;
  catchLvl: (n: number) => number;
  earnStars: (n: number) => number;
  log: (s: string) => void;
  pendingAttacks: Unit[];
  pendingBig: Unit[];
  pendingMoves: unknown[];
  orbs: unknown[];
  waves: unknown[];
  dashes: unknown[];
  delays: unknown[];
};

export interface SecretState {
  node: MapNode;
  gymIdx: number;
  def: SpeciesDef;
  row: number;
  rank: ClearRank;
  phase: 'open' | 'fight';
  added: number[];
  hpSnap: { hp: number; dead: boolean }[];
  rngSaved: () => number;
  had: boolean;
}

const internals = (b: Battle) => b as unknown as SecretBattle;

export function closeSecret(b: Battle) {
  const x = internals(b);
  const s = x.secret;
  if (!s) return;
  const region = x.regionMap;
  const idx = region.nodes.indexOf(s.node);
  if (idx === region.nodes.length - 1) region.nodes.pop();
  const gym = region.nodes[s.gymIdx];
  if (gym) gym.links = gym.links.filter((i) => i !== idx);
  // shortcut: lair not saved in pk_run, add a RunSave field if players park runs on it
  for (const i of new Set([...s.added, ...(secretRoutes.get(s.node) ?? [])])) region.route.delete(i);
  secretRoutes.delete(s.node);
  x.secret = null;
}

export function maybeSecret(b: Battle) {
  const x = internals(b);
  if (!x.waveHadGym || !x.clearCard || x.secret) return;
  const card = x.clearCard as { rank: ClearRank };
  const def = rollSecret(x.mapSeed, x.waveIndex, card.rank);
  if (!def) return;
  const gymIdx = x.regionMap.nodes.findIndex((n) => n.row === x.waveIndex && n.kind === 'gym');
  if (gymIdx < 0) return;
  const node = placeSecret(x.regionMap, gymIdx);
  x.secret = { node, gymIdx, def, row: x.waveIndex, rank: card.rank, phase: 'open', added: secretRoutes.get(node) ?? [], hpSnap: [], rngSaved: x.rng, had: false };
  x.telop.push({ kind: 'phase', title: 'SECRET LAIR', sub: 'A LEGEND STIRS · CHECK THE MAP', icon: 'poke-ball' });
}

export function enterSecret(b: Battle, node: MapNode) {
  const x = internals(b);
  const s = x.secret;
  if (!s || s.node !== node) return;
  x.mapNode = x.regionMap.nodes.indexOf(node);
  s.phase = 'fight';
  s.hpSnap = x.players.map((p) => ({ hp: p.hp, dead: p.dead }));
  s.had = x.box.some((d) => d.id === s.def.id) || x.players.some((p) => p.def.id === s.def.id);
  s.rngSaved = x.rng;
  x.rng = secretRng(x.mapSeed, s.row + 101);
  x.pendingEventWave = [{ def: s.def, nx: 0.5, ny: 0.28, boss: true }];
  x.mapNote = `A LEGENDARY ${s.def.name.toUpperCase()} · SECRET LAIR`;
  x.spawnWave(s.row, node);
  const boss = x.enemies.find((e) => e.boss);
  if (boss) {
    boss.maxHp = Math.round(boss.maxHp * SECRET_HP);
    boss.hp = boss.maxHp;
    boss.bars = [0.35, 0.65];
    const clock = boss.clocks.slice().sort((a, b) => b.turn - a.turn)[0];
    if (clock) { clock.turn = Math.max(2, clock.turn - 1); clock.t = 2; }
  }
  x.screenFlash('#ffd84d', 0.28);
  playJingle('invade');
  if (markSecret(s.def.id)) (b as Battle & { secretsRun: number }).secretsRun++;
  x.nextTurn();
}

export function secretWon(b: Battle) {
  const x = internals(b);
  const s = x.secret;
  if (!s) return;
  const boss = x.enemies.find((e) => e.boss) ?? x.enemies[0];
  const rec = { ...s.def, lvl: x.catchLvl(boss?.lvl ?? 1) };
  x.rng = s.rngSaved;
  if (s.had) x.absorbDupe(rec);
  else if (!x.box.some((d) => d.id === rec.id) && !x.players.some((p) => p.def.id === rec.id)) {
    x.boxAdd(rec);
    recordCapture([rec.id]);
  }
  const tier = s.row >= 3 ? 1 : 0;
  const pay = x.earnStars(SECRET_STARS[tier]);
  x.eventBox = { note: `${rec.name.toUpperCase()} CAUGHT · +${pay} STAR PIECES`, art: { mon: rec.id } };
  x.log(x.eventBox.note);
  x.boxSel = -1;
  x.teamSel = -1;
  x.players.forEach((p) => { p.vx = 0; p.vy = 0; });
  x.waveIndex = s.row;
  x.pendingNext = s.row + 1;
  x.mapNode = s.gymIdx;
  closeSecret(b);
  x.phase = 'map';
}

export function secretFled(b: Battle) {
  const x = internals(b);
  const s = x.secret;
  if (!s) return;
  x.rng = s.rngSaved;
  s.hpSnap.forEach((v, i) => { const p = x.players[i]; if (p) { p.hp = v.hp; p.dead = v.dead; } });
  x.enemies.length = 0;
  x.pendingAttacks.length = 0; x.pendingBig.length = 0; x.pendingMoves.length = 0;
  x.orbs.length = 0; x.waves.length = 0; x.dashes.length = 0; x.delays.length = 0;
  x.telop.push({ kind: 'over', title: 'IT FLED', sub: `${s.def.name.toUpperCase()} VANISHED · LAIR SEALED`, mon: s.def.id, icon: 'poke-ball' });
  x.log('IT FLED');
  x.log(`${s.def.name.toUpperCase()} VANISHED · LAIR SEALED`);
  x.eventBox = { note: `IT FLED · ${s.def.name.toUpperCase()} VANISHED · LAIR SEALED`, art: { mon: s.def.id } };
  x.boxSel = -1;
  x.teamSel = -1;
  x.waveIndex = s.row;
  x.pendingNext = s.row + 1;
  x.mapNode = s.gymIdx;
  closeSecret(b);
  x.phase = 'map';
}

export function drawSecretNode(ctx: CanvasRenderingContext2D, nx: number, ny: number, cell: number, time: number) {
  drawTile(ctx, MT.WALL_RUIN, nx - cell, ny - cell * 1.35, cell * 2, cell * 2);
  ctx.save();
  ctx.globalAlpha = 0.7 + Math.sin(time * 5) * 0.25;
  ctx.font = font(Math.max(14, Math.round(cell * 0.9)));
  ctx.fillStyle = '#ffd84d';
  ctx.fillText('?', nx - cell * 0.18, ny + cell * 0.2);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#fff4a8';
  ctx.fillRect(nx + cell * 0.62, ny - cell * 0.7, 3, 3);
  ctx.restore();
}
