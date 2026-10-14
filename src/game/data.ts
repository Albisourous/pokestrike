import type { PokeType } from './types';
import type { Stats } from './stats';
import { mulberry32 } from '../core/rng';

export interface SpeciesDef {
  id: number; // Pokedex number, also the sprite filename
  name: string;
  type: PokeType;
  stats: Stats; // canonical base stats: hp/atk/def/spa/spd/spe
}

const st = (hp: number, atk: number, def: number, spa: number, spd: number, spe: number): Stats => ({
  hp, atk, def, spa, spd, spe,
});

// Team-select roster: pick 4.
export const ROSTER: SpeciesDef[] = [
  { id: 25, name: 'Pikachu', type: 'electric', stats: st(35, 55, 40, 50, 50, 90) },
  { id: 4, name: 'Charmander', type: 'fire', stats: st(39, 52, 43, 60, 50, 65) },
  { id: 1, name: 'Bulbasaur', type: 'grass', stats: st(45, 49, 49, 65, 65, 45) },
  { id: 7, name: 'Squirtle', type: 'water', stats: st(44, 48, 65, 50, 64, 43) },
  { id: 133, name: 'Eevee', type: 'normal', stats: st(55, 55, 50, 45, 65, 55) },
  { id: 39, name: 'Jigglypuff', type: 'normal', stats: st(115, 45, 20, 45, 25, 20) },
  { id: 52, name: 'Meowth', type: 'normal', stats: st(40, 45, 35, 40, 40, 90) },
  { id: 54, name: 'Psyduck', type: 'water', stats: st(50, 52, 48, 65, 50, 55) },
];

const ENEMY_DB: SpeciesDef[] = [
  { id: 19, name: 'Rattata', type: 'normal', stats: st(30, 56, 35, 25, 35, 72) },
  { id: 16, name: 'Pidgey', type: 'flying', stats: st(40, 45, 40, 35, 35, 56) },
  { id: 41, name: 'Zubat', type: 'poison', stats: st(40, 45, 35, 30, 40, 55) },
  { id: 74, name: 'Geodude', type: 'rock', stats: st(40, 80, 100, 30, 30, 20) },
  { id: 81, name: 'Magnemite', type: 'electric', stats: st(25, 35, 70, 95, 55, 45) },
  { id: 63, name: 'Abra', type: 'psychic', stats: st(25, 20, 15, 105, 55, 90) },
  { id: 43, name: 'Oddish', type: 'grass', stats: st(45, 50, 55, 75, 65, 30) },
  { id: 92, name: 'Gastly', type: 'ghost', stats: st(30, 35, 30, 100, 35, 80) },
  { id: 66, name: 'Machop', type: 'fighting', stats: st(70, 80, 50, 35, 35, 35) },
  { id: 150, name: 'Mewtwo', type: 'psychic', stats: st(106, 110, 90, 154, 90, 130) },
  { id: 130, name: 'Gyarados', type: 'water', stats: st(95, 125, 79, 60, 100, 81) },
  { id: 149, name: 'Dragonite', type: 'flying', stats: st(91, 134, 95, 100, 100, 80) },
  { id: 6, name: 'Charizard', type: 'fire', stats: st(78, 84, 78, 109, 85, 100) },
];

const foe = (name: string) => ENEMY_DB.find((e) => e.name === name)!;

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
  waves: WaveSpawn[][];
}

export const STAGE: StageDef = {
  name: 'Viridian Depths',
  waves: [
    [
      { def: foe('Rattata'), nx: 0.3, ny: 0.25 },
      { def: foe('Rattata'), nx: 0.7, ny: 0.25 },
      { def: foe('Pidgey'), nx: 0.5, ny: 0.45 },
    ],
    [
      { def: foe('Zubat'), nx: 0.25, ny: 0.2 },
      { def: foe('Zubat'), nx: 0.75, ny: 0.2 },
      { def: foe('Geodude'), nx: 0.5, ny: 0.4 },
      { def: foe('Magnemite'), nx: 0.5, ny: 0.6 },
    ],
    [
      { def: foe('Abra'), nx: 0.2, ny: 0.3 },
      { def: foe('Abra'), nx: 0.8, ny: 0.3 },
      { def: foe('Mewtwo'), nx: 0.5, ny: 0.45, boss: true },
    ],
  ],
};

// Same stage for everyone on the same day.
const SLOTS: [number, number][] = [
  [0.25, 0.2], [0.75, 0.2], [0.5, 0.4], [0.25, 0.55],
  [0.75, 0.55], [0.5, 0.12], [0.15, 0.4], [0.85, 0.4],
];

export function makeDailyStage(seed: number): StageDef {
  const rng = mulberry32(seed);
  const boss = BOSS_POOL[Math.floor(rng() * BOSS_POOL.length)];
  const slots = [...SLOTS];
  const slot = () => {
    const [nx, ny] = slots.splice(Math.floor(rng() * slots.length), 1)[0];
    return { nx: nx + (rng() - 0.5) * 0.1, ny: ny + (rng() - 0.5) * 0.08 };
  };
  const add = () => ({ def: ENEMY_POOL[Math.floor(rng() * ENEMY_POOL.length)], ...slot() });
  return {
    name: 'Daily Strike',
    waves: [
      [add(), add(), add()],
      [add(), add(), add(), add()],
      [add(), add(), { def: boss, nx: 0.5, ny: 0.45, boss: true }],
    ],
  };
}
