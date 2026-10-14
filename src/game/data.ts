import type { PokeType } from './types';

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
  { id: 150, name: 'Mewtwo', type: 'psychic', hp: 620, atk: 12 },
];

const foe = (name: string) => ENEMY_DB.find((e) => e.name === name)!;

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
