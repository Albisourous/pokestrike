import type { PokeType } from './types';
import type { Stats } from './stats';
import type { Theme } from './bg';
import { THEMES } from './bg';
import { mulberry32 } from '../core/rng';

export interface SpeciesDef {
  id: number; // Pokedex number, also the sprite filename
  name: string;
  type: PokeType;
  stats: Stats; // canonical base stats: hp/atk/def/spa/spd/spe
  melee?: boolean; // enemy lunges at you when its timer hits 0 (instead of zapping)
  healer?: boolean; // bump super also heals the team
}

const st = (hp: number, atk: number, def: number, spa: number, spd: number, spe: number): Stats => ({
  hp, atk, def, spa, spd, spe,
});

// Draft pool: each run offers 1-of-3 for four rounds.
export const ROSTER: SpeciesDef[] = [
  { id: 25, name: 'Pikachu', type: 'electric', stats: st(35, 55, 40, 50, 50, 90) },
  { id: 4, name: 'Charmander', type: 'fire', stats: st(39, 52, 43, 60, 50, 65) },
  { id: 1, name: 'Bulbasaur', type: 'grass', stats: st(45, 49, 49, 65, 65, 45), healer: true },
  { id: 7, name: 'Squirtle', type: 'water', stats: st(44, 48, 65, 50, 64, 43) },
  { id: 133, name: 'Eevee', type: 'normal', stats: st(55, 55, 50, 45, 65, 55) },
  { id: 39, name: 'Jigglypuff', type: 'normal', stats: st(115, 45, 20, 45, 25, 20), healer: true },
  { id: 52, name: 'Meowth', type: 'normal', stats: st(40, 45, 35, 40, 40, 90) },
  { id: 54, name: 'Psyduck', type: 'water', stats: st(50, 52, 48, 65, 50, 55) },
  { id: 94, name: 'Gengar', type: 'ghost', stats: st(60, 65, 60, 130, 75, 110) },
  { id: 143, name: 'Snorlax', type: 'normal', stats: st(160, 110, 65, 65, 110, 30) },
  { id: 95, name: 'Onix', type: 'rock', stats: st(35, 45, 160, 30, 45, 70) },
  { id: 68, name: 'Machamp', type: 'fighting', stats: st(90, 130, 80, 65, 85, 55) },
  { id: 59, name: 'Arcanine', type: 'fire', stats: st(90, 110, 80, 100, 80, 95) },
  { id: 9, name: 'Blastoise', type: 'water', stats: st(79, 83, 100, 85, 105, 78) },
  { id: 3, name: 'Venusaur', type: 'grass', stats: st(80, 82, 83, 100, 100, 80), healer: true },
  { id: 65, name: 'Alakazam', type: 'psychic', stats: st(55, 50, 45, 135, 95, 120) },
  { id: 131, name: 'Lapras', type: 'water', stats: st(130, 85, 80, 85, 95, 60), healer: true },
  { id: 76, name: 'Golem', type: 'rock', stats: st(80, 120, 130, 55, 65, 45) },
];

export const DRAFT_ROUNDS = 4;
export const DRAFT_OFFERS = 3;

// Each draft round offers 3 picks with distinct types — encourages a varied
// team so no single type dominates a run.
export function draftOrder(rng: () => number): number[] {
  const pool = ROSTER.map((_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const order: number[] = [];
  for (let r = 0; r < DRAFT_ROUNDS; r++) {
    const types = new Set<string>();
    for (let k = 0; k < DRAFT_OFFERS; k++) {
      let pick = pool.findIndex((i) => !types.has(ROSTER[i].type));
      if (pick === -1) pick = 0; // pool ran dry of new types — allow a repeat
      types.add(ROSTER[pool[pick]].type);
      order.push(pool.splice(pick, 1)[0]);
    }
  }
  return order;
}

const ENEMY_DB: SpeciesDef[] = [
  { id: 19, name: 'Rattata', type: 'normal', stats: st(30, 56, 35, 25, 35, 72), melee: true },
  { id: 16, name: 'Pidgey', type: 'flying', stats: st(40, 45, 40, 35, 35, 56), melee: true },
  { id: 41, name: 'Zubat', type: 'poison', stats: st(40, 45, 35, 30, 40, 55), melee: true },
  { id: 74, name: 'Geodude', type: 'rock', stats: st(40, 80, 100, 30, 30, 20) },
  { id: 81, name: 'Magnemite', type: 'electric', stats: st(25, 35, 70, 95, 55, 45) },
  { id: 63, name: 'Abra', type: 'psychic', stats: st(25, 20, 15, 105, 55, 90) },
  { id: 43, name: 'Oddish', type: 'grass', stats: st(45, 50, 55, 75, 65, 30) },
  { id: 92, name: 'Gastly', type: 'ghost', stats: st(30, 35, 30, 100, 35, 80) },
  { id: 66, name: 'Machop', type: 'fighting', stats: st(70, 80, 50, 35, 35, 35), melee: true },
  { id: 150, name: 'Mewtwo', type: 'psychic', stats: st(106, 110, 90, 154, 90, 130) },
  { id: 130, name: 'Gyarados', type: 'water', stats: st(95, 125, 79, 60, 100, 81) },
  { id: 149, name: 'Dragonite', type: 'flying', stats: st(91, 134, 95, 100, 100, 80) },
  { id: 6, name: 'Charizard', type: 'fire', stats: st(78, 84, 78, 109, 85, 100) },
];

export const ALL_SPRITE_IDS = [...ROSTER.map((r) => r.id), ...ENEMY_DB.map((e) => e.id)];

const ENEMY_POOL = ENEMY_DB.slice(0, 9);
const BOSS_POOL = ENEMY_DB.slice(9);

// Enemy placement is normalized arena coords (0..1), so stages are
// resolution-independent.
export interface WaveSpawn {
  def: SpeciesDef;
  nx: number;
  ny: number;
  boss?: boolean;
}
export interface StageDef {
  name: string;
  theme: Theme;
  waves: WaveSpawn[][];
  obstacles: Obstacle[]; // rocks your ball banks off — normalized coords
}

export interface Obstacle {
  nx: number;
  ny: number;
  nr: number; // radius as a fraction of arena width
}

const THEME_NAME: Record<Theme, string> = {
  grove: 'Viridian Wilds',
  cavern: 'Echo Cavern',
  volcano: 'Cinder Crag',
  sky: 'Gale Heights',
};

// Spawn positions drawn without replacement from this pool.
const SLOTS: [number, number][] = [
  [0.25, 0.2], [0.75, 0.2], [0.5, 0.4], [0.25, 0.55],
  [0.75, 0.55], [0.5, 0.12], [0.15, 0.4], [0.85, 0.4],
  [0.35, 0.72], [0.65, 0.72], [0.5, 0.6], [0.85, 0.62],
];

// Random stage: 3 waves + a boss. Same seed -> same stage, so the Daily
// Strike is identical for everyone while Free Play rolls a fresh seed.
export function makeStage(seed: number, name?: string): StageDef {
  const rng = mulberry32(seed);
  const boss = BOSS_POOL[Math.floor(rng() * BOSS_POOL.length)];
  const theme = THEMES[Math.floor(rng() * THEMES.length)];
  const slots = [...SLOTS];
  const slot = () => {
    const [nx, ny] = slots.splice(Math.floor(rng() * slots.length), 1)[0];
    return { nx: nx + (rng() - 0.5) * 0.1, ny: ny + (rng() - 0.5) * 0.08 };
  };
  const add = () => ({ def: ENEMY_POOL[Math.floor(rng() * ENEMY_POOL.length)], ...slot() });
  return {
    name: name ?? THEME_NAME[theme],
    theme,
    waves: [
      [add(), add(), add()],
      [add(), add(), add(), add()],
      [add(), add(), { def: boss, nx: 0.5, ny: 0.45, boss: true }],
    ],
    // 1-3 rocks drawn from the same slot pool, so they never overlap spawns
    obstacles: Array.from({ length: 1 + Math.floor(rng() * 3) }, () => ({
      ...slot(),
      nr: 0.05 + rng() * 0.035,
    })),
  };
}

// Endless mode: roll the next wave past the boss. Bigger packs each depth,
// an extra boss every 3rd.
export function rollWave(rng: () => number, depth: number): WaveSpawn[] {
  const slots = [...SLOTS];
  const slot = () => {
    const [nx, ny] = slots.splice(Math.floor(rng() * slots.length), 1)[0];
    return { nx: nx + (rng() - 0.5) * 0.1, ny: ny + (rng() - 0.5) * 0.08 };
  };
  const add = () => ({ def: ENEMY_POOL[Math.floor(rng() * ENEMY_POOL.length)], ...slot() });
  const n = Math.min(3 + Math.floor(depth / 2), 6);
  const wave: WaveSpawn[] = Array.from({ length: n }, add);
  if (depth % 3 === 0) {
    wave.push({ def: BOSS_POOL[Math.floor(rng() * BOSS_POOL.length)], nx: 0.5, ny: 0.3, boss: true });
  }
  return wave;
}
