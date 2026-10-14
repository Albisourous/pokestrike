import type { PokeType } from './types';
import { mulberry32 } from '../core/rng';

export interface SpeciesDef {
  id: number; // Pokedex number, also the sprite filename
  name: string;
  type: PokeType;
  hp: number;
  atk: number;
}

// Team-select roster: pick 4.
export const ROSTER: SpeciesDef[] = [
  { id: 25, name: 'Pikachu', type: 'electric', hp: 120, atk: 24 },
  { id: 4, name: 'Charmander', type: 'fire', hp: 130, atk: 22 },
  { id: 1, name: 'Bulbasaur', type: 'grass', hp: 150, atk: 18 },
  { id: 7, name: 'Squirtle', type: 'water', hp: 150, atk: 18 },
  { id: 133, name: 'Eevee', type: 'normal', hp: 140, atk: 20 },
  { id: 39, name: 'Jigglypuff', type: 'normal', hp: 200, atk: 12 },
  { id: 52, name: 'Meowth', type: 'normal', hp: 120, atk: 22 },
  { id: 54, name: 'Psyduck', type: 'water', hp: 140, atk: 18 },
];

const ENEMY_DB: SpeciesDef[] = [
  { id: 19, name: 'Rattata', type: 'normal', hp: 60, atk: 6 },
  { id: 16, name: 'Pidgey', type: 'flying', hp: 55, atk: 6 },
  { id: 41, name: 'Zubat', type: 'poison', hp: 70, atk: 7 },
  { id: 74, name: 'Geodude', type: 'rock', hp: 110, atk: 8 },
  { id: 81, name: 'Magnemite', type: 'electric', hp: 90, atk: 8 },
  { id: 63, name: 'Abra', type: 'psychic', hp: 80, atk: 9 },
  { id: 43, name: 'Oddish', type: 'grass', hp: 65, atk: 6 },
  { id: 92, name: 'Gastly', type: 'ghost', hp: 70, atk: 8 },
  { id: 66, name: 'Machop', type: 'fighting', hp: 85, atk: 8 },
  { id: 150, name: 'Mewtwo', type: 'psychic', hp: 620, atk: 12 },
  { id: 130, name: 'Gyarados', type: 'water', hp: 560, atk: 11 },
  { id: 149, name: 'Dragonite', type: 'flying', hp: 580, atk: 12 },
  { id: 6, name: 'Charizard', type: 'fire', hp: 540, atk: 11 },
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
