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
  pierce?: boolean; // ball passes through enemies instead of bouncing off
  copy?: boolean; // bump super replays the bumper's super (Ditto)
  evolvesTo?: number; // dex id of the evolved form (data only; mechanic lives elsewhere)
}

const st = (hp: number, atk: number, def: number, spa: number, spd: number, spe: number): Stats => ({
  hp, atk, def, spa, spd, spe,
});

// Draft pool: weak starters only — the strong mons are caught mid-run.
export const ROSTER: SpeciesDef[] = [
  { id: 25, name: 'Pikachu', type: 'electric', stats: st(35, 55, 40, 50, 50, 90), pierce: true, evolvesTo: 26 },
  { id: 4, name: 'Charmander', type: 'fire', stats: st(39, 52, 43, 60, 50, 65), evolvesTo: 5 },
  { id: 1, name: 'Bulbasaur', type: 'grass', stats: st(45, 49, 49, 65, 65, 45), healer: true, evolvesTo: 2 },
  { id: 7, name: 'Squirtle', type: 'water', stats: st(44, 48, 65, 50, 64, 43), evolvesTo: 8 },
  { id: 133, name: 'Eevee', type: 'normal', stats: st(55, 55, 50, 45, 65, 55), evolvesTo: 135 },
  { id: 39, name: 'Jigglypuff', type: 'normal', stats: st(115, 45, 20, 45, 25, 20), healer: true, evolvesTo: 40 },
  { id: 52, name: 'Meowth', type: 'normal', stats: st(40, 45, 35, 40, 40, 90), pierce: true, evolvesTo: 53 },
  { id: 54, name: 'Psyduck', type: 'water', stats: st(50, 52, 48, 65, 50, 55), evolvesTo: 55 },
  { id: 95, name: 'Onix', type: 'rock', stats: st(35, 45, 160, 30, 45, 70), evolvesTo: 208 },
  { id: 66, name: 'Machop', type: 'fighting', stats: st(70, 80, 50, 35, 35, 35), evolvesTo: 67 },
  { id: 132, name: 'Ditto', type: 'normal', stats: st(48, 48, 48, 48, 48, 48), copy: true },
  { id: 32, name: 'Nidoran♂', type: 'poison', stats: st(46, 57, 40, 40, 40, 50), evolvesTo: 33 },
  { id: 35, name: 'Clefairy', type: 'normal', stats: st(70, 45, 48, 60, 65, 35), healer: true, evolvesTo: 36 },
  { id: 37, name: 'Vulpix', type: 'fire', stats: st(38, 41, 40, 50, 65, 65), evolvesTo: 38 },
  { id: 60, name: 'Poliwag', type: 'water', stats: st(40, 50, 40, 40, 40, 90), evolvesTo: 61 },
  { id: 92, name: 'Gastly', type: 'ghost', stats: st(30, 35, 30, 100, 35, 80), pierce: true, evolvesTo: 93 },
  { id: 104, name: 'Cubone', type: 'rock', stats: st(50, 50, 95, 40, 50, 35), melee: true, evolvesTo: 105 },
];

export const DRAFT_ROUNDS = 4;
const DRAFT_OFFERS = 3;

// Each draft round offers 3 picks with distinct types — encourages a varied
// team so no single type dominates a run. The roster is dealt without
// replacement across rounds: every species is offered once before a repeat
// can appear (roster 17 >= 12 offer slots, so a full draft never repeats).
export function draftOrder(rng: () => number): number[] {
  const order: number[] = [];
  let pool: number[] = [];
  for (let r = 0; r < DRAFT_ROUNDS; r++) {
    if (pool.length < DRAFT_OFFERS) {
      const fresh = ROSTER.map((_, i) => i);
      for (let i = fresh.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
      }
      pool.push(...fresh);
    }
    const types = new Set<string>();
    for (let k = 0; k < DRAFT_OFFERS; k++) {
      let pick = pool.findIndex((i) => !types.has(ROSTER[i].type));
      if (pick === -1) pick = 0;
      types.add(ROSTER[pool[pick]].type);
      order.push(pool.splice(pick, 1)[0]);
    }
  }
  return order;
}

// Fodder first, the four gym bosses last — pools below slice on that.
// 'Ground-ish' mons (Diglett, Cubone, Rhyhorn, ...) ride the rock type —
// PokeType has no ground.
const ENEMY_DB: SpeciesDef[] = [
  { id: 19, name: 'Rattata', type: 'normal', stats: st(30, 56, 35, 25, 35, 72), melee: true, evolvesTo: 20 },
  { id: 16, name: 'Pidgey', type: 'flying', stats: st(40, 45, 40, 35, 35, 56), melee: true, evolvesTo: 17 },
  { id: 41, name: 'Zubat', type: 'poison', stats: st(40, 45, 35, 30, 40, 55), melee: true, evolvesTo: 42 },
  { id: 74, name: 'Geodude', type: 'rock', stats: st(40, 80, 100, 30, 30, 20), evolvesTo: 75 },
  { id: 81, name: 'Magnemite', type: 'electric', stats: st(25, 35, 70, 95, 55, 45), evolvesTo: 82 },
  { id: 63, name: 'Abra', type: 'psychic', stats: st(25, 20, 15, 105, 55, 90), evolvesTo: 64 },
  { id: 43, name: 'Oddish', type: 'grass', stats: st(45, 50, 55, 75, 65, 30), evolvesTo: 44 },
  { id: 92, name: 'Gastly', type: 'ghost', stats: st(30, 35, 30, 100, 35, 80), evolvesTo: 93 },
  { id: 66, name: 'Machop', type: 'fighting', stats: st(70, 80, 50, 35, 35, 35), melee: true, evolvesTo: 67 },
  { id: 21, name: 'Spearow', type: 'flying', stats: st(40, 60, 30, 31, 31, 70), melee: true, evolvesTo: 22 },
  { id: 163, name: 'Hoothoot', type: 'flying', stats: st(60, 30, 30, 36, 56, 50), melee: true, evolvesTo: 164 },
  { id: 46, name: 'Paras', type: 'grass', stats: st(35, 70, 55, 45, 55, 25), melee: true, evolvesTo: 47 },
  { id: 48, name: 'Venonat', type: 'poison', stats: st(60, 55, 50, 40, 55, 45), evolvesTo: 49 },
  { id: 69, name: 'Bellsprout', type: 'grass', stats: st(50, 75, 35, 70, 30, 40), evolvesTo: 70 },
  { id: 102, name: 'Exeggcute', type: 'grass', stats: st(60, 40, 80, 60, 45, 40), evolvesTo: 103 },
  { id: 50, name: 'Diglett', type: 'rock', stats: st(10, 55, 25, 35, 45, 95), melee: true, evolvesTo: 51 },
  { id: 104, name: 'Cubone', type: 'rock', stats: st(50, 50, 95, 40, 50, 35), melee: true, evolvesTo: 105 },
  { id: 56, name: 'Mankey', type: 'fighting', stats: st(40, 80, 35, 35, 45, 70), melee: true, evolvesTo: 57 },
  { id: 88, name: 'Grimer', type: 'poison', stats: st(80, 80, 50, 40, 50, 25), melee: true, evolvesTo: 89 },
  { id: 109, name: 'Koffing', type: 'poison', stats: st(40, 65, 95, 60, 45, 35), evolvesTo: 110 },
  { id: 37, name: 'Vulpix', type: 'fire', stats: st(38, 41, 40, 50, 65, 65), evolvesTo: 38 },
  { id: 58, name: 'Growlithe', type: 'fire', stats: st(55, 70, 45, 70, 50, 60), melee: true, evolvesTo: 59 },
  { id: 77, name: 'Ponyta', type: 'fire', stats: st(50, 85, 55, 65, 65, 90), evolvesTo: 78 },
  { id: 126, name: 'Magmar', type: 'fire', stats: st(65, 95, 57, 100, 85, 93) },
  { id: 218, name: 'Slugma', type: 'fire', stats: st(40, 40, 40, 70, 40, 20), evolvesTo: 219 },
  { id: 111, name: 'Rhyhorn', type: 'rock', stats: st(80, 85, 95, 30, 30, 25), melee: true, evolvesTo: 112 },
  { id: 100, name: 'Voltorb', type: 'electric', stats: st(40, 30, 50, 55, 55, 100), evolvesTo: 101 },
  { id: 170, name: 'Chinchou', type: 'electric', stats: st(75, 38, 38, 56, 56, 67), evolvesTo: 171 },
  { id: 72, name: 'Tentacool', type: 'water', stats: st(40, 40, 35, 50, 100, 70), evolvesTo: 73 },
  { id: 84, name: 'Doduo', type: 'flying', stats: st(35, 85, 45, 35, 35, 75), melee: true, evolvesTo: 85 },
  { id: 278, name: 'Wingull', type: 'flying', stats: st(40, 30, 30, 55, 30, 85), melee: true, evolvesTo: 279 },
  { id: 333, name: 'Swablu', type: 'flying', stats: st(45, 40, 60, 40, 75, 50), melee: true, evolvesTo: 334 },
  { id: 150, name: 'Mewtwo', type: 'psychic', stats: st(106, 110, 90, 154, 90, 130) },
  { id: 130, name: 'Gyarados', type: 'water', stats: st(95, 125, 79, 60, 100, 81) },
  { id: 149, name: 'Dragonite', type: 'flying', stats: st(91, 134, 95, 100, 100, 80) },
  { id: 6, name: 'Charizard', type: 'fire', stats: st(78, 84, 78, 109, 85, 100) },
];

// Capturable elites: evolved mons that only appear on later waves — the
// reason to keep pushing into deeper depths.
export const ELITES: SpeciesDef[] = [
  { id: 94, name: 'Gengar', type: 'ghost', stats: st(60, 65, 60, 130, 75, 110), pierce: true },
  { id: 143, name: 'Snorlax', type: 'normal', stats: st(160, 110, 65, 65, 110, 30) },
  { id: 68, name: 'Machamp', type: 'fighting', stats: st(90, 130, 80, 65, 85, 55), melee: true },
  { id: 59, name: 'Arcanine', type: 'fire', stats: st(90, 110, 80, 100, 80, 95) },
  { id: 9, name: 'Blastoise', type: 'water', stats: st(79, 83, 100, 85, 105, 78) },
  { id: 3, name: 'Venusaur', type: 'grass', stats: st(80, 82, 83, 100, 100, 80), healer: true },
  { id: 65, name: 'Alakazam', type: 'psychic', stats: st(55, 50, 45, 135, 95, 120), pierce: true },
  { id: 131, name: 'Lapras', type: 'water', stats: st(130, 85, 80, 85, 95, 60), healer: true },
  { id: 76, name: 'Golem', type: 'rock', stats: st(80, 120, 130, 55, 65, 45) },
  { id: 34, name: 'Nidoking', type: 'poison', stats: st(81, 102, 77, 85, 75, 85), melee: true },
  { id: 125, name: 'Electabuzz', type: 'electric', stats: st(65, 83, 57, 95, 85, 105) },
  { id: 135, name: 'Jolteon', type: 'electric', stats: st(65, 65, 60, 110, 95, 130), pierce: true },
  { id: 142, name: 'Aerodactyl', type: 'rock', stats: st(80, 105, 65, 60, 75, 130), melee: true },
  { id: 169, name: 'Crobat', type: 'poison', stats: st(85, 90, 80, 70, 80, 130), melee: true },
];

// Rare invaders: legendaries that crash a normal wave on MS invade stages.
// Strong captures — spawn handled elsewhere; this is just the dex data.
export const INVADERS: SpeciesDef[] = [
  { id: 144, name: 'Articuno', type: 'flying', stats: st(90, 85, 100, 95, 125, 85) },
  { id: 145, name: 'Zapdos', type: 'electric', stats: st(90, 90, 85, 125, 90, 100), pierce: true },
  { id: 146, name: 'Moltres', type: 'fire', stats: st(90, 100, 90, 125, 85, 90) },
  { id: 243, name: 'Raikou', type: 'electric', stats: st(90, 85, 75, 115, 100, 115), pierce: true },
  { id: 244, name: 'Entei', type: 'fire', stats: st(115, 115, 85, 90, 75, 100), melee: true },
  { id: 245, name: 'Suicune', type: 'water', stats: st(100, 75, 115, 90, 115, 85) },
  { id: 151, name: 'Mew', type: 'psychic', stats: st(100, 100, 100, 100, 100, 100), copy: true },
  { id: 251, name: 'Celebi', type: 'grass', stats: st(100, 100, 100, 100, 100, 100), healer: true },
];

// Evolution-only species: targets of evolvesTo that never roll into waves or
// the draft themselves. Mid-stages chain onward where their next form exists.
export const EVOS: SpeciesDef[] = [
  { id: 2, name: 'Ivysaur', type: 'grass', stats: st(60, 62, 63, 80, 80, 60), evolvesTo: 3 },
  { id: 5, name: 'Charmeleon', type: 'fire', stats: st(58, 64, 58, 80, 65, 80), evolvesTo: 6 },
  { id: 8, name: 'Wartortle', type: 'water', stats: st(59, 63, 80, 65, 80, 58), evolvesTo: 9 },
  { id: 17, name: 'Pidgeotto', type: 'flying', stats: st(63, 60, 55, 50, 50, 71), melee: true, evolvesTo: 18 },
  { id: 18, name: 'Pidgeot', type: 'flying', stats: st(83, 80, 75, 70, 70, 101), melee: true },
  { id: 20, name: 'Raticate', type: 'normal', stats: st(55, 81, 60, 50, 70, 97), melee: true },
  { id: 22, name: 'Fearow', type: 'flying', stats: st(65, 90, 65, 61, 61, 100), melee: true },
  { id: 26, name: 'Raichu', type: 'electric', stats: st(60, 90, 55, 90, 80, 110), pierce: true },
  { id: 33, name: 'Nidorino', type: 'poison', stats: st(61, 72, 57, 55, 55, 65), melee: true, evolvesTo: 34 },
  { id: 36, name: 'Clefable', type: 'normal', stats: st(95, 70, 73, 95, 90, 60), healer: true },
  { id: 38, name: 'Ninetales', type: 'fire', stats: st(73, 76, 75, 81, 100, 100) },
  { id: 40, name: 'Wigglytuff', type: 'normal', stats: st(140, 70, 45, 85, 50, 45), healer: true },
  { id: 42, name: 'Golbat', type: 'poison', stats: st(75, 80, 70, 65, 75, 90), melee: true, evolvesTo: 169 },
  { id: 44, name: 'Gloom', type: 'grass', stats: st(60, 65, 70, 85, 75, 40), evolvesTo: 45 },
  { id: 45, name: 'Vileplume', type: 'grass', stats: st(75, 80, 85, 110, 90, 50) },
  { id: 47, name: 'Parasect', type: 'grass', stats: st(60, 95, 80, 60, 80, 30), melee: true },
  { id: 49, name: 'Venomoth', type: 'poison', stats: st(70, 65, 60, 90, 75, 90) },
  { id: 51, name: 'Dugtrio', type: 'rock', stats: st(35, 100, 50, 50, 70, 120), melee: true },
  { id: 53, name: 'Persian', type: 'normal', stats: st(65, 70, 60, 65, 65, 115), pierce: true },
  { id: 55, name: 'Golduck', type: 'water', stats: st(80, 82, 78, 95, 80, 85) },
  { id: 57, name: 'Primeape', type: 'fighting', stats: st(65, 105, 60, 60, 70, 95), melee: true },
  { id: 61, name: 'Poliwhirl', type: 'water', stats: st(65, 65, 65, 50, 50, 90), evolvesTo: 62 },
  { id: 62, name: 'Poliwrath', type: 'water', stats: st(90, 95, 95, 70, 90, 70), melee: true },
  { id: 64, name: 'Kadabra', type: 'psychic', stats: st(40, 35, 30, 120, 70, 105), pierce: true, evolvesTo: 65 },
  { id: 67, name: 'Machoke', type: 'fighting', stats: st(80, 100, 70, 50, 60, 45), melee: true, evolvesTo: 68 },
  { id: 70, name: 'Weepinbell', type: 'grass', stats: st(65, 90, 50, 85, 45, 55), evolvesTo: 71 },
  { id: 71, name: 'Victreebel', type: 'grass', stats: st(80, 105, 65, 100, 70, 70), melee: true },
  { id: 73, name: 'Tentacruel', type: 'water', stats: st(80, 70, 65, 80, 120, 100) },
  { id: 75, name: 'Graveler', type: 'rock', stats: st(55, 95, 115, 45, 45, 35), evolvesTo: 76 },
  { id: 78, name: 'Rapidash', type: 'fire', stats: st(65, 100, 70, 80, 80, 105) },
  { id: 82, name: 'Magneton', type: 'electric', stats: st(50, 60, 95, 120, 70, 70) },
  { id: 85, name: 'Dodrio', type: 'flying', stats: st(60, 110, 70, 60, 60, 110), melee: true },
  { id: 89, name: 'Muk', type: 'poison', stats: st(105, 105, 75, 65, 100, 50), melee: true },
  { id: 93, name: 'Haunter', type: 'ghost', stats: st(45, 50, 45, 115, 55, 95), pierce: true, evolvesTo: 94 },
  { id: 101, name: 'Electrode', type: 'electric', stats: st(60, 50, 70, 80, 80, 150) },
  { id: 103, name: 'Exeggutor', type: 'grass', stats: st(95, 95, 85, 125, 75, 55) },
  { id: 105, name: 'Marowak', type: 'rock', stats: st(60, 80, 110, 50, 80, 45), melee: true },
  { id: 110, name: 'Weezing', type: 'poison', stats: st(65, 90, 120, 85, 70, 60) },
  { id: 112, name: 'Rhydon', type: 'rock', stats: st(105, 130, 120, 45, 45, 40), melee: true },
  { id: 164, name: 'Noctowl', type: 'flying', stats: st(100, 50, 50, 86, 96, 70), melee: true },
  { id: 171, name: 'Lanturn', type: 'electric', stats: st(125, 58, 58, 76, 76, 67) },
  { id: 208, name: 'Steelix', type: 'rock', stats: st(75, 85, 200, 55, 65, 30), melee: true },
  { id: 219, name: 'Magcargo', type: 'fire', stats: st(60, 50, 120, 90, 80, 30) },
  { id: 279, name: 'Pelipper', type: 'flying', stats: st(60, 50, 100, 95, 70, 65) },
  { id: 334, name: 'Altaria', type: 'flying', stats: st(75, 70, 90, 70, 105, 80) },
];

export const ALL_SPRITE_IDS = [
  ...ROSTER.map((r) => r.id),
  ...ENEMY_DB.map((e) => e.id),
  ...ELITES.map((e) => e.id),
  ...EVOS.map((e) => e.id),
  ...INVADERS.map((i) => i.id),
];

const ENEMY_POOL = ENEMY_DB.slice(0, -4);
const BOSS_POOL = ENEMY_DB.slice(-4);
const FOES = [...ENEMY_POOL, ...ELITES];

// Biome pools: waves draw fodder from their stage's theme so each stretch
// feels like a place — grass/bug-ish in the grove, rock/poison/ghost in the
// cavern, fire/rock at the volcano, flying/electric/water in the sky.
const foe = (id: number): SpeciesDef => ENEMY_DB.find((d) => d.id === id)!;
export const ENEMY_THEME: Record<Theme, SpeciesDef[]> = {
  grove: [19, 16, 43, 21, 163, 46, 48, 69, 102].map(foe),
  cavern: [41, 74, 92, 66, 50, 104, 56, 88, 109, 63].map(foe),
  volcano: [37, 58, 77, 126, 218, 74, 50, 104, 111].map(foe),
  sky: [16, 21, 81, 100, 170, 72, 84, 278, 333].map(foe),
};

// A run is 9 stages; every third is a gym boss. Stages 1-3 are the seeded
// stage, 4-9 are rolled as depth 1..6.
export const TOTAL_STAGES = 9;

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
}

const THEME_NAME: Record<Theme, string> = {
  grove: 'Viridian Wilds',
  cavern: 'Echo Cavern',
  volcano: 'Cinder Crag',
  sky: 'Gale Heights',
};

// Spawn positions drawn without replacement from this pool. The tight
// pairs (0.09 apart) overlap enemy radii, so they resolve to touching —
// a wedge you can pinch the ball between for multi-hits.
const SLOTS: [number, number][] = [
  [0.25, 0.2], [0.75, 0.2], [0.5, 0.4], [0.25, 0.55],
  [0.75, 0.55], [0.5, 0.12], [0.15, 0.4], [0.85, 0.4],
  [0.35, 0.72], [0.65, 0.72], [0.5, 0.6], [0.85, 0.62],
  [0.44, 0.3], [0.53, 0.3], [0.44, 0.66], [0.53, 0.66],
];

// Gym flavor: the boss's entourage shares its type when the pools have
// candidates — every gym leader runs a little mono-type gym.
function gymPack(
  boss: SpeciesDef,
  n: number,
  rng: () => number,
  slot: () => { nx: number; ny: number },
  fodder: SpeciesDef[],
): WaveSpawn[] {
  const same = FOES.filter((d) => d.type === boss.type);
  return Array.from({ length: n }, () => {
    const pool = same.length && rng() < 0.7 ? same : fodder;
    return { def: pool[Math.floor(rng() * pool.length)], ...slot() };
  });
}

// A stage def bundles a 3-stage stretch: wild, wild + elite, gym boss.
// Same seed -> same stretch; Free Play rolls a fresh seed each run.
export function makeStage(seed: number, name?: string): StageDef {
  const rng = mulberry32(seed);
  const boss = BOSS_POOL[Math.floor(rng() * BOSS_POOL.length)];
  const theme = THEMES[Math.floor(rng() * THEMES.length)];
  const slots = [...SLOTS];
  const slot = () => {
    const [nx, ny] = slots.splice(Math.floor(rng() * slots.length), 1)[0];
    return { nx: nx + (rng() - 0.5) * 0.1, ny: ny + (rng() - 0.5) * 0.08 };
  };
  const fodder = ENEMY_THEME[theme];
  const add = () => ({ def: fodder[Math.floor(rng() * fodder.length)], ...slot() });
  const elite = () => ({ def: ELITES[Math.floor(rng() * ELITES.length)], ...slot() });
  return {
    name: name ?? THEME_NAME[theme],
    theme,
    waves: [
      [add(), add(), add()],
      [add(), add(), add(), elite()],
      [...gymPack(boss, 2, rng, slot, fodder), { def: boss, nx: 0.5, ny: 0.45, boss: true }],
    ],
  };
}

// Roll the next stage (depth 1..6 = stages 4..9). Bigger packs each depth,
// a gym boss every 3rd. `elite` (picked on the reward screen) packs the
// wave tighter and guarantees a capturable elite.
// `theme` picks the biome pool for fodder; omit it to fall back to the flat pool.
export function rollWave(rng: () => number, depth: number, elite = false, theme?: Theme): WaveSpawn[] {
  const fodder = theme ? ENEMY_THEME[theme] : ENEMY_POOL;
  const slots = [...SLOTS];
  const slot = () => {
    const [nx, ny] = slots.splice(Math.floor(rng() * slots.length), 1)[0];
    return { nx: nx + (rng() - 0.5) * 0.1, ny: ny + (rng() - 0.5) * 0.08 };
  };
  const add = () => ({
    // deeper waves mix in capturable elites (~40%)
    def: depth > 0 && rng() < 0.4
      ? ELITES[Math.floor(rng() * ELITES.length)]
      : fodder[Math.floor(rng() * fodder.length)],
    ...slot(),
  });
  const boss = depth % 3 === 0 ? BOSS_POOL[Math.floor(rng() * BOSS_POOL.length)] : null;
  const n = Math.min(3 + Math.floor(depth / 2), 6) + (elite ? 1 : 0);
  const wave: WaveSpawn[] = boss ? gymPack(boss, n, rng, slot, fodder) : Array.from({ length: n }, add);
  if (elite && !boss) {
    wave.push({ def: ELITES[Math.floor(rng() * ELITES.length)], ...slot() });
  }
  if (boss) wave.push({ def: boss, nx: 0.5, ny: 0.3, boss: true });
  return wave;
}

// Hazard zones: per-theme arena dangers laid out alongside a wave's spawns.
// Same normalized coords as WaveSpawn; r is a fraction of arena width.
// Zones stay out of the bottom 25% (player turf) and inside the side walls.
export type HazardKind = 'lava' | 'grass' | 'gust' | 'spikes';
export interface HazardSpawn {
  kind: HazardKind;
  nx: number;
  ny: number;
  r: number;
  dir?: number; // gust only: -1/1, the way the wind pushes
}

export function hazardsFor(theme: Theme, rng: () => number): HazardSpawn[] {
  // r ~0.08-0.16; ny clamped so the zone's low edge clears the bottom quarter
  const rad = () => 0.08 + rng() * 0.08;
  const spot = (r: number, yLo: number, yHi: number) => ({
    nx: r + rng() * (1 - 2 * r),
    ny: yLo + rng() * (Math.min(yHi, 0.75 - r) - yLo),
    r,
  });
  const n = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  switch (theme) {
    case 'volcano':
      return Array.from({ length: n(1, 3) }, () => {
        const r = rad();
        return { kind: 'lava', ...spot(r, 0.15, 0.6) };
      });
    case 'grove':
      return Array.from({ length: n(2, 4) }, () => {
        const r = rad();
        return { kind: 'grass', ...spot(r, 0.1, 0.7) };
      });
    case 'sky':
      // wide horizontal wind bands, centered-ish, pushing left or right
      return Array.from({ length: n(1, 2) }, () => {
        const r = 0.18 + rng() * 0.05;
        return {
          kind: 'gust',
          nx: 0.5 + (rng() - 0.5) * 0.1,
          ny: 0.2 + rng() * (0.55 - r - 0.2),
          r,
          dir: rng() < 0.5 ? -1 : 1,
        };
      });
    case 'cavern':
      // jagged strips shoved off-center, one side or the other
      return Array.from({ length: n(1, 3) }, () => {
        const r = rad();
        const nx = rng() < 0.5
          ? r + rng() * (0.42 - r)
          : 0.58 + rng() * (1 - 0.58 - r);
        return { kind: 'spikes', nx, ny: 0.15 + rng() * (Math.min(0.6, 0.75 - r) - 0.15), r };
      });
    default:
      return [];
  }
}
