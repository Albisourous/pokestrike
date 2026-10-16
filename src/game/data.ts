import type { PokeType } from './types';
import type { Stats } from './stats';
import type { Theme } from './bg';
import { THEMES } from './bg';
import { mulberry32 } from '../core/rng';

export interface SpeciesDef {
  id: number; // Pokedex number, also the sprite filename
  name: string;
  type: PokeType;
  type2?: PokeType; // canon second type — multiplies defensive matchups; strikes lead with the better type
  stats: Stats; // canonical base stats: hp/atk/def/spa/spd/spe
  melee?: boolean; // enemy lunges at you when its timer hits 0 (instead of zapping)
  healer?: boolean; // bump super also heals the team
  pierce?: boolean; // ball passes through enemies instead of bouncing off
  copy?: boolean; // bump super replays the bumper's super (Ditto)
  taunt?: boolean; // while it lives, contact hits vs other enemies are blocked
  cursed?: boolean; // on KO, all ally supers gain +1 cooldown pip
  shiny?: boolean; // alt-palette marker — draft picks and catches carry it
  lvl?: number; // level marker — draft picks roll 5-14, catches keep theirs
  luck?: number; // fusion count — absorbed dupes feed it; team luck pays in the loot fountain
  evolvesTo?: number | number[]; // dex id(s) — an array asks the player to pick the branch
}

const st = (hp: number, atk: number, def: number, spa: number, spd: number, spe: number): Stats => ({
  hp, atk, def, spa, spd, spe,
});

// Draft pool: weak first-stagers only — the strong mons are caught mid-run.
// Magikarp/Feebas are the lottery tickets: terrible stats, monster evolutions.
export const ROSTER: SpeciesDef[] = [
  { id: 25, name: 'Pikachu', type: 'electric', stats: st(35, 55, 40, 50, 50, 90), pierce: true, evolvesTo: 26 },
  { id: 4, name: 'Charmander', type: 'fire', stats: st(39, 52, 43, 60, 50, 65), evolvesTo: 5 },
  { id: 1, name: 'Bulbasaur', type: 'grass', type2: 'poison', stats: st(45, 49, 49, 65, 65, 45), healer: true, evolvesTo: 2 },
  { id: 7, name: 'Squirtle', type: 'water', stats: st(44, 48, 65, 50, 64, 43), evolvesTo: 8 },
  { id: 133, name: 'Eevee', type: 'normal', stats: st(55, 55, 50, 45, 65, 55), evolvesTo: [134, 135, 136] },
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
  { id: 92, name: 'Gastly', type: 'ghost', type2: 'poison', stats: st(30, 35, 30, 100, 35, 80), pierce: true, evolvesTo: 93 },
  { id: 104, name: 'Cubone', type: 'rock', stats: st(50, 50, 95, 40, 50, 35), melee: true, evolvesTo: 105 },
  { id: 129, name: 'Magikarp', type: 'water', stats: st(20, 10, 55, 15, 20, 80), evolvesTo: 130 },
  { id: 179, name: 'Mareep', type: 'electric', stats: st(55, 40, 40, 65, 45, 35), evolvesTo: 180 },
  { id: 183, name: 'Marill', type: 'water', type2: 'normal', stats: st(70, 20, 50, 20, 50, 40), healer: true, evolvesTo: 184 },
  { id: 194, name: 'Wooper', type: 'water', type2: 'rock', stats: st(55, 45, 45, 25, 25, 15), evolvesTo: 195 },
  { id: 280, name: 'Ralts', type: 'psychic', type2: 'normal', stats: st(28, 25, 25, 45, 35, 40), evolvesTo: 281 },
  { id: 285, name: 'Shroomish', type: 'grass', stats: st(60, 40, 60, 40, 60, 35), evolvesTo: 286 },
  { id: 293, name: 'Whismur', type: 'normal', stats: st(64, 51, 23, 51, 23, 28), evolvesTo: 294 },
  { id: 304, name: 'Aron', type: 'rock', stats: st(50, 70, 100, 40, 40, 30), evolvesTo: 305 },
  { id: 328, name: 'Trapinch', type: 'rock', stats: st(45, 100, 45, 45, 45, 10), evolvesTo: 329 },
  { id: 349, name: 'Feebas', type: 'water', stats: st(20, 15, 20, 10, 55, 80), evolvesTo: 350 },
  { id: 361, name: 'Snorunt', type: 'water', stats: st(50, 50, 50, 50, 50, 50), evolvesTo: [362, 478] },
  { id: 363, name: 'Spheal', type: 'water', stats: st(70, 40, 50, 55, 50, 25), evolvesTo: 364 },
  { id: 172, name: 'Pichu', type: 'electric', stats: st(20, 40, 15, 35, 35, 60), evolvesTo: 25 },
  { id: 174, name: 'Igglybuff', type: 'normal', stats: st(90, 30, 15, 40, 20, 15), healer: true, evolvesTo: 39 },
  { id: 191, name: 'Sunkern', type: 'grass', stats: st(30, 30, 30, 30, 30, 30), evolvesTo: 192 },
  { id: 209, name: 'Snubbull', type: 'normal', stats: st(60, 80, 50, 40, 40, 30), melee: true, evolvesTo: 210 },
  { id: 223, name: 'Remoraid', type: 'water', stats: st(35, 65, 35, 65, 35, 65), pierce: true, evolvesTo: 224 },
  { id: 236, name: 'Tyrogue', type: 'fighting', stats: st(35, 35, 35, 35, 35, 35), melee: true, evolvesTo: [106, 107, 237] },
  { id: 246, name: 'Larvitar', type: 'rock', stats: st(50, 64, 50, 45, 50, 41), melee: true, evolvesTo: 247 },
  { id: 298, name: 'Azurill', type: 'normal', stats: st(50, 20, 40, 20, 40, 20), healer: true, evolvesTo: 183 },
  { id: 300, name: 'Skitty', type: 'normal', stats: st(50, 45, 45, 35, 35, 50), evolvesTo: 301 },
  { id: 307, name: 'Meditite', type: 'fighting', type2: 'psychic', stats: st(30, 40, 55, 40, 55, 60), melee: true, evolvesTo: 308 },
  { id: 325, name: 'Spoink', type: 'psychic', stats: st(60, 25, 35, 70, 80, 60), evolvesTo: 326 },
  { id: 360, name: 'Wynaut', type: 'psychic', stats: st(95, 23, 48, 23, 48, 23), evolvesTo: 202 },
  { id: 371, name: 'Bagon', type: 'flying', stats: st(45, 75, 60, 40, 30, 50), melee: true, evolvesTo: 372 },
  { id: 374, name: 'Beldum', type: 'psychic', stats: st(40, 55, 80, 35, 60, 30), evolvesTo: 375 },
  { id: 152, name: 'Chikorita', type: 'grass', stats: st(45, 49, 65, 49, 65, 45), healer: true, evolvesTo: 153 },
  { id: 155, name: 'Cyndaquil', type: 'fire', stats: st(39, 52, 43, 60, 50, 65), evolvesTo: 156 },
  { id: 158, name: 'Totodile', type: 'water', stats: st(50, 65, 64, 44, 48, 43), evolvesTo: 159 },
  { id: 252, name: 'Treecko', type: 'grass', stats: st(40, 45, 35, 65, 55, 70), evolvesTo: 253 },
  { id: 255, name: 'Torchic', type: 'fire', stats: st(45, 60, 40, 70, 50, 45), evolvesTo: 256 },
  { id: 258, name: 'Mudkip', type: 'water', stats: st(50, 70, 50, 50, 50, 40), evolvesTo: 259 },
  { id: 173, name: 'Cleffa', type: 'normal', stats: st(50, 25, 28, 45, 55, 15), healer: true, evolvesTo: 35 },
  { id: 175, name: 'Togepi', type: 'normal', stats: st(35, 20, 65, 40, 65, 20), healer: true, evolvesTo: 176 },
  { id: 161, name: 'Sentret', type: 'normal', stats: st(35, 46, 34, 35, 45, 20), evolvesTo: 162 },
  { id: 190, name: 'Aipom', type: 'normal', stats: st(55, 70, 55, 40, 55, 85), evolvesTo: 424 },
  { id: 235, name: 'Smeargle', type: 'normal', stats: st(55, 20, 35, 20, 45, 75), copy: true },
  { id: 239, name: 'Elekid', type: 'electric', stats: st(45, 63, 37, 65, 55, 95), evolvesTo: 125 },
  { id: 238, name: 'Smoochum', type: 'psychic', type2: 'water', stats: st(45, 30, 15, 85, 65, 65), evolvesTo: 124 },
  { id: 23, name: 'Ekans', type: 'poison', stats: st(35, 60, 44, 40, 54, 55), evolvesTo: 24 },
  { id: 96, name: 'Drowzee', type: 'psychic', stats: st(60, 48, 45, 43, 90, 42), evolvesTo: 97 },
  { id: 83, name: "Farfetch'd", type: 'flying', type2: 'normal', stats: st(52, 90, 55, 58, 62, 60), melee: true },
  { id: 220, name: 'Swinub', type: 'water', type2: 'rock', stats: st(50, 50, 40, 30, 30, 50), evolvesTo: 221 },
  { id: 120, name: 'Staryu', type: 'water', stats: st(30, 45, 55, 70, 55, 85), evolvesTo: 121 },
  { id: 387, name: 'Turtwig', type: 'grass', stats: st(55, 68, 64, 45, 55, 31), healer: true, evolvesTo: 388 },
  { id: 390, name: 'Chimchar', type: 'fire', stats: st(44, 58, 44, 58, 44, 61), melee: true, evolvesTo: 391 },
  { id: 393, name: 'Piplup', type: 'water', stats: st(53, 51, 53, 61, 56, 40), evolvesTo: 394 },
  { id: 396, name: 'Starly', type: 'flying', stats: st(40, 55, 30, 30, 30, 60), melee: true, evolvesTo: 397 },
  { id: 399, name: 'Bidoof', type: 'normal', stats: st(59, 45, 40, 35, 40, 31), taunt: true, evolvesTo: 400 },
  { id: 403, name: 'Shinx', type: 'electric', stats: st(45, 65, 34, 40, 34, 45), melee: true, evolvesTo: 404 },
  { id: 406, name: 'Budew', type: 'grass', stats: st(40, 30, 35, 50, 70, 55), evolvesTo: 315 },
  { id: 408, name: 'Cranidos', type: 'rock', stats: st(67, 125, 40, 30, 30, 58), melee: true, evolvesTo: 409 },
  { id: 410, name: 'Shieldon', type: 'rock', stats: st(30, 42, 118, 42, 88, 30), evolvesTo: 411 },
  { id: 417, name: 'Pachirisu', type: 'electric', stats: st(60, 45, 70, 45, 90, 95), pierce: true },
  { id: 418, name: 'Buizel', type: 'water', stats: st(55, 65, 35, 60, 30, 85), pierce: true, evolvesTo: 419 },
  { id: 425, name: 'Drifloon', type: 'ghost', stats: st(90, 50, 34, 60, 44, 70), cursed: true, evolvesTo: 426 },
  { id: 427, name: 'Buneary', type: 'normal', stats: st(55, 66, 44, 44, 56, 85), pierce: true, evolvesTo: 428 },
  { id: 431, name: 'Glameow', type: 'normal', stats: st(49, 55, 42, 42, 37, 85), evolvesTo: 432 },
  { id: 433, name: 'Chingling', type: 'psychic', stats: st(45, 30, 50, 65, 50, 45), healer: true, evolvesTo: 358 },
  { id: 436, name: 'Bronzor', type: 'rock', stats: st(57, 24, 86, 24, 86, 23), taunt: true, evolvesTo: 437 },
  { id: 438, name: 'Bonsly', type: 'rock', stats: st(50, 80, 95, 10, 45, 10), taunt: true, evolvesTo: 185 },
  { id: 439, name: 'Mime Jr.', type: 'psychic', stats: st(20, 25, 45, 70, 90, 60), evolvesTo: 122 },
  { id: 440, name: 'Happiny', type: 'normal', stats: st(100, 5, 5, 15, 65, 30), healer: true, evolvesTo: 113 },
  { id: 443, name: 'Gible', type: 'rock', stats: st(58, 70, 45, 40, 45, 42), melee: true, evolvesTo: 444 },
  { id: 446, name: 'Munchlax', type: 'normal', stats: st(135, 85, 40, 40, 85, 5), taunt: true, evolvesTo: 143 },
  { id: 447, name: 'Riolu', type: 'fighting', stats: st(40, 70, 40, 35, 40, 60), melee: true, evolvesTo: 448 },
  { id: 451, name: 'Skorupi', type: 'poison', stats: st(40, 50, 90, 30, 55, 65), melee: true, evolvesTo: 452 },
  { id: 453, name: 'Croagunk', type: 'poison', stats: st(48, 61, 40, 61, 40, 50), melee: true, evolvesTo: 454 },
  { id: 456, name: 'Finneon', type: 'water', stats: st(49, 49, 56, 49, 61, 66), evolvesTo: 457 },
  { id: 458, name: 'Mantyke', type: 'water', stats: st(45, 20, 50, 60, 120, 50), evolvesTo: 226 },
  { id: 459, name: 'Snover', type: 'grass', stats: st(60, 62, 50, 62, 60, 40), evolvesTo: 460 },
];

export const DRAFT_ROUNDS = 4;
const DRAFT_OFFERS = 3;

// Each draft round offers 3 picks with distinct types — encourages a varied
// team so no single type dominates a run. The roster is dealt without
// replacement across rounds: every species is offered once before a repeat
// can appear (roster >> 12 offer slots, so a full draft never repeats).
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

// Fodder first, the eight gym leaders last — pools below slice on that.
// Every leader is themed to a badge (BADGES in meta.ts).
// 'Ground-ish' mons (Diglett, Cubone, Rhyhorn, ...) ride the rock type —
// PokeType has no ground.
export const ENEMY_DB: SpeciesDef[] = [
  { id: 19, name: 'Rattata', type: 'normal', stats: st(30, 56, 35, 25, 35, 72), melee: true, evolvesTo: 20 },
  { id: 16, name: 'Pidgey', type: 'flying', type2: 'normal', stats: st(40, 45, 40, 35, 35, 56), melee: true, evolvesTo: 17 },
  { id: 41, name: 'Zubat', type: 'poison', type2: 'flying', stats: st(40, 45, 35, 30, 40, 55), melee: true, evolvesTo: 42 },
  { id: 74, name: 'Geodude', type: 'rock', stats: st(40, 80, 100, 30, 30, 20), evolvesTo: 75 },
  { id: 81, name: 'Magnemite', type: 'electric', stats: st(25, 35, 70, 95, 55, 45), evolvesTo: 82 },
  { id: 63, name: 'Abra', type: 'psychic', stats: st(25, 20, 15, 105, 55, 90), evolvesTo: 64 },
  { id: 43, name: 'Oddish', type: 'grass', type2: 'poison', stats: st(45, 50, 55, 75, 65, 30), evolvesTo: 44 },
  { id: 92, name: 'Gastly', type: 'ghost', type2: 'poison', stats: st(30, 35, 30, 100, 35, 80), evolvesTo: 93 },
  { id: 66, name: 'Machop', type: 'fighting', stats: st(70, 80, 50, 35, 35, 35), melee: true, evolvesTo: 67 },
  { id: 21, name: 'Spearow', type: 'flying', type2: 'normal', stats: st(40, 60, 30, 31, 31, 70), melee: true, evolvesTo: 22 },
  { id: 163, name: 'Hoothoot', type: 'flying', type2: 'normal', stats: st(60, 30, 30, 36, 56, 50), melee: true, evolvesTo: 164 },
  { id: 46, name: 'Paras', type: 'grass', type2: 'poison', stats: st(35, 70, 55, 45, 55, 25), melee: true, evolvesTo: 47 },
  { id: 48, name: 'Venonat', type: 'poison', stats: st(60, 55, 50, 40, 55, 45), evolvesTo: 49 },
  { id: 69, name: 'Bellsprout', type: 'grass', type2: 'poison', stats: st(50, 75, 35, 70, 30, 40), evolvesTo: 70 },
  { id: 102, name: 'Exeggcute', type: 'grass', type2: 'psychic', stats: st(60, 40, 80, 60, 45, 40), evolvesTo: 103 },
  { id: 50, name: 'Diglett', type: 'rock', stats: st(10, 55, 25, 35, 45, 95), melee: true, evolvesTo: 51 },
  { id: 104, name: 'Cubone', type: 'rock', stats: st(50, 50, 95, 40, 50, 35), melee: true, evolvesTo: 105 },
  { id: 56, name: 'Mankey', type: 'fighting', stats: st(40, 80, 35, 35, 45, 70), melee: true, evolvesTo: 57 },
  { id: 88, name: 'Grimer', type: 'poison', stats: st(80, 80, 50, 40, 50, 25), melee: true, evolvesTo: 89 },
  { id: 109, name: 'Koffing', type: 'poison', stats: st(40, 65, 95, 60, 45, 35), evolvesTo: 110 },
  { id: 37, name: 'Vulpix', type: 'fire', stats: st(38, 41, 40, 50, 65, 65), evolvesTo: 38 },
  { id: 58, name: 'Growlithe', type: 'fire', stats: st(55, 70, 45, 70, 50, 60), melee: true, evolvesTo: 59 },
  { id: 77, name: 'Ponyta', type: 'fire', stats: st(50, 85, 55, 65, 65, 90), evolvesTo: 78 },
  { id: 126, name: 'Magmar', type: 'fire', stats: st(65, 95, 57, 100, 85, 93), evolvesTo: 467 },
  { id: 218, name: 'Slugma', type: 'fire', type2: 'rock', stats: st(40, 40, 40, 70, 40, 20), evolvesTo: 219 },
  { id: 111, name: 'Rhyhorn', type: 'rock', stats: st(80, 85, 95, 30, 30, 25), melee: true, evolvesTo: 112 },
  { id: 100, name: 'Voltorb', type: 'electric', stats: st(40, 30, 50, 55, 55, 100), evolvesTo: 101 },
  { id: 170, name: 'Chinchou', type: 'electric', type2: 'water', stats: st(75, 38, 38, 56, 56, 67), evolvesTo: 171 },
  { id: 72, name: 'Tentacool', type: 'water', type2: 'poison', stats: st(40, 40, 35, 50, 100, 70), evolvesTo: 73 },
  { id: 84, name: 'Doduo', type: 'flying', type2: 'normal', stats: st(35, 85, 45, 35, 35, 75), melee: true, evolvesTo: 85 },
  { id: 278, name: 'Wingull', type: 'flying', type2: 'water', stats: st(40, 30, 30, 55, 30, 85), melee: true, evolvesTo: 279 },
  { id: 333, name: 'Swablu', type: 'flying', type2: 'normal', stats: st(45, 40, 60, 40, 75, 50), melee: true, evolvesTo: 334 },
  { id: 98, name: 'Krabby', type: 'water', stats: st(30, 105, 90, 25, 25, 50), melee: true, evolvesTo: 99 },
  { id: 118, name: 'Goldeen', type: 'water', stats: st(45, 67, 60, 35, 50, 63), evolvesTo: 119 },
  { id: 79, name: 'Slowpoke', type: 'psychic', type2: 'water', stats: st(90, 65, 65, 40, 40, 15), evolvesTo: [80, 199] },
  { id: 108, name: 'Lickitung', type: 'normal', stats: st(90, 55, 75, 60, 75, 30), melee: true, evolvesTo: 463 },
  { id: 128, name: 'Tauros', type: 'normal', stats: st(75, 100, 95, 40, 70, 110), melee: true },
  { id: 137, name: 'Porygon', type: 'normal', stats: st(65, 60, 70, 85, 75, 40) },
  { id: 138, name: 'Omanyte', type: 'water', type2: 'rock', stats: st(35, 40, 100, 90, 55, 35), evolvesTo: 139 },
  { id: 140, name: 'Kabuto', type: 'rock', type2: 'water', stats: st(30, 80, 90, 55, 45, 55), evolvesTo: 141 },
  { id: 147, name: 'Dratini', type: 'flying', stats: st(41, 64, 45, 50, 50, 50), evolvesTo: 148 },
  { id: 177, name: 'Natu', type: 'flying', type2: 'psychic', stats: st(40, 50, 45, 70, 45, 70), evolvesTo: 178 },
  { id: 198, name: 'Murkrow', type: 'ghost', type2: 'flying', stats: st(60, 85, 42, 85, 42, 91), melee: true, evolvesTo: 430 },
  { id: 200, name: 'Misdreavus', type: 'ghost', stats: st(60, 60, 60, 85, 85, 85), pierce: true, evolvesTo: 429 },
  { id: 216, name: 'Teddiursa', type: 'normal', stats: st(60, 80, 50, 50, 50, 40), melee: true, evolvesTo: 217 },
  { id: 228, name: 'Houndour', type: 'fire', type2: 'ghost', stats: st(45, 60, 30, 80, 50, 65), evolvesTo: 229 },
  { id: 231, name: 'Phanpy', type: 'rock', stats: st(90, 60, 60, 40, 40, 40), melee: true, evolvesTo: 232 },
  { id: 261, name: 'Poochyena', type: 'ghost', stats: st(35, 55, 35, 30, 30, 35), melee: true, evolvesTo: 262 },
  { id: 263, name: 'Zigzagoon', type: 'normal', stats: st(38, 30, 41, 30, 41, 60), melee: true, evolvesTo: 264 },
  { id: 270, name: 'Lotad', type: 'grass', type2: 'water', stats: st(40, 30, 30, 40, 50, 30), evolvesTo: 271 },
  { id: 273, name: 'Seedot', type: 'grass', type2: 'ghost', stats: st(40, 40, 50, 30, 30, 30), evolvesTo: 274 },
  { id: 276, name: 'Taillow', type: 'flying', type2: 'normal', stats: st(40, 55, 30, 30, 30, 85), melee: true, evolvesTo: 277 },
  { id: 296, name: 'Makuhita', type: 'fighting', stats: st(72, 60, 30, 20, 30, 25), melee: true, evolvesTo: 297 },
  { id: 309, name: 'Electrike', type: 'electric', stats: st(40, 45, 40, 65, 40, 65), evolvesTo: 310 },
  { id: 318, name: 'Carvanha', type: 'water', type2: 'ghost', stats: st(45, 90, 20, 65, 20, 65), melee: true, evolvesTo: 319 },
  { id: 331, name: 'Cacnea', type: 'grass', type2: 'ghost', stats: st(50, 85, 40, 85, 40, 35), evolvesTo: 332 },
  { id: 341, name: 'Corphish', type: 'water', stats: st(43, 80, 65, 50, 35, 35), melee: true, evolvesTo: 342 },
  { id: 353, name: 'Shuppet', type: 'ghost', stats: st(44, 75, 35, 63, 33, 45), pierce: true, evolvesTo: 354 },
  { id: 355, name: 'Duskull', type: 'ghost', stats: st(20, 40, 90, 30, 90, 25), evolvesTo: 356 },
  { id: 10, name: 'Caterpie', type: 'grass', stats: st(45, 30, 35, 20, 20, 45), melee: true, evolvesTo: 11 },
  { id: 13, name: 'Weedle', type: 'poison', stats: st(40, 35, 30, 20, 20, 50), melee: true, evolvesTo: 14 },
  { id: 27, name: 'Sandshrew', type: 'rock', stats: st(50, 75, 85, 20, 30, 40), melee: true, evolvesTo: 28 },
  { id: 29, name: 'Nidoran♀', type: 'poison', stats: st(55, 47, 52, 40, 40, 41), evolvesTo: 30 },
  { id: 86, name: 'Seel', type: 'water', stats: st(65, 45, 55, 45, 70, 45), evolvesTo: 87 },
  { id: 90, name: 'Shellder', type: 'water', stats: st(30, 65, 100, 45, 25, 40), evolvesTo: 91 },
  { id: 116, name: 'Horsea', type: 'water', stats: st(30, 40, 70, 70, 25, 60), evolvesTo: 117 },
  { id: 165, name: 'Ledyba', type: 'flying', stats: st(40, 20, 30, 40, 80, 55), melee: true, evolvesTo: 166 },
  { id: 167, name: 'Spinarak', type: 'poison', stats: st(40, 60, 40, 40, 40, 30), melee: true, evolvesTo: 168 },
  { id: 187, name: 'Hoppip', type: 'grass', type2: 'flying', stats: st(35, 35, 40, 35, 55, 50), evolvesTo: 188 },
  { id: 193, name: 'Yanma', type: 'flying', stats: st(65, 65, 45, 75, 45, 95), pierce: true, evolvesTo: 469 },
  { id: 206, name: 'Dunsparce', type: 'normal', stats: st(100, 70, 70, 65, 65, 45), melee: true },
  { id: 207, name: 'Gligar', type: 'flying', type2: 'rock', stats: st(65, 75, 105, 35, 65, 85), melee: true, evolvesTo: 472 },
  { id: 222, name: 'Corsola', type: 'water', type2: 'rock', stats: st(65, 55, 85, 65, 95, 35), healer: true },
  { id: 225, name: 'Delibird', type: 'flying', stats: st(45, 55, 45, 65, 45, 75), melee: true },
  { id: 240, name: 'Magby', type: 'fire', stats: st(45, 75, 37, 70, 55, 83), evolvesTo: 126 },
  { id: 265, name: 'Wurmple', type: 'grass', stats: st(45, 45, 35, 20, 30, 20), evolvesTo: [266, 268] },
  { id: 283, name: 'Surskit', type: 'water', stats: st(40, 30, 32, 50, 52, 65), evolvesTo: 284 },
  { id: 299, name: 'Nosepass', type: 'rock', stats: st(30, 45, 135, 45, 90, 30), evolvesTo: 476 },
  { id: 302, name: 'Sableye', type: 'ghost', stats: st(50, 75, 75, 65, 65, 50), melee: true },
  { id: 313, name: 'Volbeat', type: 'grass', stats: st(65, 73, 55, 47, 75, 85) },
  { id: 314, name: 'Illumise', type: 'grass', stats: st(65, 47, 55, 73, 75, 85) },
  { id: 315, name: 'Roselia', type: 'grass', stats: st(50, 60, 45, 100, 80, 65), healer: true, evolvesTo: 407 },
  { id: 322, name: 'Numel', type: 'fire', type2: 'rock', stats: st(60, 60, 40, 65, 45, 35), evolvesTo: 323 },
  { id: 324, name: 'Torkoal', type: 'fire', stats: st(70, 85, 140, 85, 70, 20) },
  { id: 337, name: 'Lunatone', type: 'psychic', type2: 'rock', stats: st(90, 55, 65, 95, 85, 70), pierce: true },
  { id: 338, name: 'Solrock', type: 'psychic', type2: 'rock', stats: st(90, 95, 85, 55, 65, 70), melee: true },
  { id: 343, name: 'Baltoy', type: 'rock', type2: 'psychic', stats: st(40, 40, 55, 40, 70, 55), evolvesTo: 344 },
  { id: 345, name: 'Lileep', type: 'grass', type2: 'rock', stats: st(66, 41, 77, 61, 87, 23), evolvesTo: 346 },
  { id: 347, name: 'Anorith', type: 'rock', stats: st(45, 95, 50, 40, 50, 75), melee: true, evolvesTo: 348 },
  { id: 357, name: 'Tropius', type: 'grass', type2: 'flying', stats: st(99, 68, 83, 72, 87, 51) },
  { id: 366, name: 'Clamperl', type: 'water', stats: st(35, 64, 85, 74, 55, 32), evolvesTo: [367, 368] },
  { id: 370, name: 'Luvdisc', type: 'water', stats: st(43, 30, 55, 40, 65, 97), healer: true },
  { id: 24, name: 'Arbok', type: 'poison', stats: st(60, 95, 69, 65, 79, 80) },
  { id: 97, name: 'Hypno', type: 'psychic', stats: st(85, 73, 70, 73, 115, 67) },
  { id: 124, name: 'Jynx', type: 'psychic', type2: 'water', stats: st(65, 50, 35, 115, 95, 95) },
  { id: 114, name: 'Tangela', type: 'grass', stats: st(65, 55, 115, 100, 40, 60), evolvesTo: 465 },
  { id: 162, name: 'Furret', type: 'normal', stats: st(85, 76, 64, 45, 55, 90) },
  { id: 185, name: 'Sudowoodo', type: 'rock', stats: st(70, 100, 115, 30, 65, 30), taunt: true },
  { id: 201, name: 'Unown', type: 'psychic', stats: st(48, 72, 48, 72, 48, 48) },
  { id: 203, name: 'Girafarig', type: 'psychic', type2: 'normal', stats: st(70, 80, 65, 90, 65, 85) },
  { id: 204, name: 'Pineco', type: 'poison', stats: st(50, 65, 90, 35, 35, 15), evolvesTo: 205 },
  { id: 211, name: 'Qwilfish', type: 'water', type2: 'poison', stats: st(65, 95, 85, 55, 55, 85) },
  { id: 213, name: 'Shuckle', type: 'rock', stats: st(20, 10, 230, 10, 230, 5), taunt: true },
  { id: 215, name: 'Sneasel', type: 'ghost', type2: 'water', stats: st(55, 95, 55, 35, 75, 115), pierce: true, melee: true, evolvesTo: 461 },
  { id: 234, name: 'Stantler', type: 'normal', stats: st(73, 95, 62, 85, 65, 85) },
  { id: 264, name: 'Linoone', type: 'normal', stats: st(78, 70, 61, 50, 61, 100) },
  { id: 268, name: 'Cascoon', type: 'poison', stats: st(50, 35, 55, 25, 25, 15), evolvesTo: 269 },
  { id: 269, name: 'Dustox', type: 'poison', stats: st(60, 50, 70, 50, 90, 65) },
  { id: 272, name: 'Ludicolo', type: 'water', type2: 'grass', stats: st(80, 70, 70, 90, 100, 70) },
  { id: 275, name: 'Shiftry', type: 'grass', type2: 'ghost', stats: st(90, 100, 60, 90, 60, 80) },
  { id: 287, name: 'Slakoth', type: 'normal', stats: st(60, 60, 60, 35, 35, 30), evolvesTo: 288 },
  { id: 288, name: 'Vigoroth', type: 'normal', stats: st(80, 80, 80, 55, 55, 90), melee: true, evolvesTo: 289 },
  { id: 290, name: 'Nincada', type: 'rock', stats: st(31, 45, 90, 30, 30, 40), evolvesTo: 291 },
  { id: 291, name: 'Ninjask', type: 'flying', stats: st(61, 90, 45, 50, 50, 160), pierce: true },
  { id: 292, name: 'Shedinja', type: 'ghost', stats: st(1, 90, 45, 30, 30, 40), cursed: true },
  { id: 311, name: 'Plusle', type: 'electric', stats: st(60, 50, 40, 85, 75, 95) },
  { id: 312, name: 'Minun', type: 'electric', stats: st(60, 40, 50, 75, 85, 95) },
  { id: 316, name: 'Gulpin', type: 'poison', stats: st(70, 43, 53, 43, 53, 40), evolvesTo: 317 },
  { id: 317, name: 'Swalot', type: 'poison', stats: st(100, 73, 83, 73, 83, 55), taunt: true },
  { id: 320, name: 'Wailmer', type: 'water', stats: st(130, 70, 35, 70, 35, 60), evolvesTo: 321 },
  { id: 327, name: 'Spinda', type: 'normal', stats: st(60, 60, 60, 60, 60, 60) },
  { id: 339, name: 'Barboach', type: 'water', type2: 'rock', stats: st(50, 48, 43, 46, 41, 60), evolvesTo: 340 },
  { id: 340, name: 'Whiscash', type: 'water', type2: 'rock', stats: st(110, 78, 73, 76, 71, 60), taunt: true },
  { id: 351, name: 'Castform', type: 'normal', stats: st(70, 70, 70, 70, 70, 70) },
  { id: 352, name: 'Kecleon', type: 'normal', stats: st(60, 90, 70, 60, 120, 40) },
  { id: 358, name: 'Chimecho', type: 'psychic', stats: st(75, 50, 80, 95, 90, 65) },
  { id: 368, name: 'Gorebyss', type: 'water', stats: st(55, 84, 105, 114, 75, 52) },
  { id: 221, name: 'Piloswine', type: 'water', type2: 'rock', stats: st(100, 100, 80, 70, 60, 50), evolvesTo: 473 },
  { id: 400, name: 'Bibarel', type: 'normal', type2: 'water', stats: st(79, 85, 60, 55, 60, 71) },
  { id: 401, name: 'Kricketot', type: 'poison', stats: st(37, 25, 41, 25, 41, 25), evolvesTo: 402 },
  { id: 402, name: 'Kricketune', type: 'poison', stats: st(77, 85, 51, 55, 51, 65) },
  { id: 412, name: 'Burmy', type: 'poison', stats: st(40, 29, 45, 29, 45, 36), evolvesTo: 413 },
  { id: 413, name: 'Wormadam', type: 'grass', stats: st(60, 59, 85, 79, 105, 36) },
  { id: 414, name: 'Mothim', type: 'flying', stats: st(70, 94, 50, 94, 50, 66) },
  { id: 415, name: 'Combee', type: 'flying', stats: st(30, 30, 42, 30, 42, 70), evolvesTo: 416 },
  { id: 416, name: 'Vespiquen', type: 'flying', stats: st(70, 80, 102, 80, 102, 40) },
  { id: 420, name: 'Cherubi', type: 'grass', stats: st(45, 35, 45, 62, 53, 35), evolvesTo: 421 },
  { id: 421, name: 'Cherrim', type: 'grass', stats: st(70, 60, 70, 87, 78, 85) },
  { id: 422, name: 'Shellos', type: 'water', type2: 'rock', stats: st(76, 48, 48, 57, 62, 34), evolvesTo: 423 },
  { id: 423, name: 'Gastrodon', type: 'water', type2: 'rock', stats: st(111, 83, 68, 92, 82, 39) },
  { id: 434, name: 'Stunky', type: 'poison', type2: 'ghost', stats: st(63, 63, 47, 41, 41, 74), evolvesTo: 435 },
  { id: 441, name: 'Chatot', type: 'flying', type2: 'normal', stats: st(76, 65, 45, 92, 42, 91) },
  { id: 449, name: 'Hippopotas', type: 'rock', stats: st(68, 72, 78, 38, 42, 32), evolvesTo: 450 },
  { id: 455, name: 'Carnivine', type: 'grass', stats: st(74, 100, 72, 90, 72, 46) },
  { id: 457, name: 'Lumineon', type: 'water', stats: st(69, 69, 76, 69, 86, 91) },
  { id: 150, name: 'Mewtwo', type: 'psychic', stats: st(106, 110, 90, 154, 90, 130) },
  { id: 130, name: 'Gyarados', type: 'water', type2: 'flying', stats: st(95, 125, 79, 60, 100, 81) },
  { id: 149, name: 'Dragonite', type: 'flying', stats: st(91, 134, 95, 100, 100, 80) },
  { id: 6, name: 'Charizard', type: 'fire', type2: 'flying', stats: st(78, 84, 78, 109, 85, 100) },
  { id: 3, name: 'Venusaur', type: 'grass', type2: 'poison', stats: st(80, 82, 83, 100, 100, 80), healer: true },
  { id: 94, name: 'Gengar', type: 'ghost', type2: 'poison', stats: st(60, 65, 60, 130, 75, 110), pierce: true },
  { id: 125, name: 'Electabuzz', type: 'electric', stats: st(65, 83, 57, 95, 85, 105) },
  { id: 112, name: 'Rhydon', type: 'rock', stats: st(105, 130, 120, 45, 45, 40), melee: true },
];

// Capturable elites: evolved mons that only appear on later waves — the
// reason to keep pushing into deeper depths.
export const ELITES: SpeciesDef[] = [
  { id: 94, name: 'Gengar', type: 'ghost', type2: 'poison', stats: st(60, 65, 60, 130, 75, 110), pierce: true, cursed: true },
  { id: 143, name: 'Snorlax', type: 'normal', stats: st(160, 110, 65, 65, 110, 30), taunt: true },
  { id: 68, name: 'Machamp', type: 'fighting', stats: st(90, 130, 80, 65, 85, 55), melee: true },
  { id: 59, name: 'Arcanine', type: 'fire', stats: st(90, 110, 80, 100, 80, 95) },
  { id: 9, name: 'Blastoise', type: 'water', stats: st(79, 83, 100, 85, 105, 78) },
  { id: 3, name: 'Venusaur', type: 'grass', type2: 'poison', stats: st(80, 82, 83, 100, 100, 80), healer: true },
  { id: 65, name: 'Alakazam', type: 'psychic', stats: st(55, 50, 45, 135, 95, 120), pierce: true },
  { id: 131, name: 'Lapras', type: 'water', stats: st(130, 85, 80, 85, 95, 60), healer: true },
  { id: 76, name: 'Golem', type: 'rock', stats: st(80, 120, 130, 55, 65, 45) },
  { id: 34, name: 'Nidoking', type: 'poison', type2: 'rock', stats: st(81, 102, 77, 85, 75, 85), melee: true },
  { id: 125, name: 'Electabuzz', type: 'electric', stats: st(65, 83, 57, 95, 85, 105), evolvesTo: 466 },
  { id: 135, name: 'Jolteon', type: 'electric', stats: st(65, 65, 60, 110, 95, 130), pierce: true },
  { id: 142, name: 'Aerodactyl', type: 'rock', type2: 'flying', stats: st(80, 105, 65, 60, 75, 130), melee: true },
  { id: 169, name: 'Crobat', type: 'poison', type2: 'flying', stats: st(85, 90, 80, 70, 80, 130), melee: true },
  { id: 123, name: 'Scyther', type: 'flying', stats: st(70, 110, 80, 55, 80, 105), pierce: true, melee: true },
  { id: 113, name: 'Chansey', type: 'normal', stats: st(250, 5, 5, 35, 105, 50), healer: true, evolvesTo: 242 },
  { id: 115, name: 'Kangaskhan', type: 'normal', stats: st(105, 95, 80, 40, 80, 90), taunt: true },
  { id: 134, name: 'Vaporeon', type: 'water', stats: st(130, 65, 60, 110, 95, 65), healer: true },
  { id: 136, name: 'Flareon', type: 'fire', stats: st(65, 130, 60, 95, 110, 65), melee: true },
  { id: 154, name: 'Meganium', type: 'grass', stats: st(80, 82, 100, 83, 100, 80), healer: true },
  { id: 157, name: 'Typhlosion', type: 'fire', stats: st(78, 84, 78, 109, 85, 100) },
  { id: 160, name: 'Feraligatr', type: 'water', stats: st(85, 105, 100, 79, 83, 78), melee: true },
  { id: 181, name: 'Ampharos', type: 'electric', stats: st(90, 75, 85, 115, 90, 55) },
  { id: 196, name: 'Espeon', type: 'psychic', stats: st(65, 65, 60, 130, 95, 110), pierce: true },
  { id: 197, name: 'Umbreon', type: 'ghost', stats: st(95, 65, 110, 60, 130, 65), taunt: true },
  { id: 212, name: 'Scizor', type: 'fighting', stats: st(70, 130, 100, 55, 80, 65), pierce: true, melee: true },
  { id: 229, name: 'Houndoom', type: 'fire', type2: 'ghost', stats: st(75, 90, 50, 110, 80, 95) },
  { id: 257, name: 'Blaziken', type: 'fire', type2: 'fighting', stats: st(80, 120, 70, 110, 70, 80), melee: true },
  { id: 282, name: 'Gardevoir', type: 'psychic', type2: 'normal', stats: st(68, 65, 65, 125, 115, 80), healer: true },
  { id: 289, name: 'Slaking', type: 'normal', stats: st(150, 160, 100, 95, 65, 100), taunt: true },
  { id: 306, name: 'Aggron', type: 'rock', stats: st(70, 110, 180, 60, 60, 50), melee: true },
  { id: 350, name: 'Milotic', type: 'water', stats: st(95, 60, 79, 100, 125, 81), healer: true },
  { id: 373, name: 'Salamence', type: 'flying', stats: st(95, 135, 80, 110, 80, 100), melee: true },
  { id: 121, name: 'Starmie', type: 'water', type2: 'psychic', stats: st(60, 75, 85, 100, 85, 115), pierce: true },
  { id: 122, name: 'Mr. Mime', type: 'psychic', stats: st(40, 45, 65, 100, 120, 90), taunt: true },
  { id: 127, name: 'Pinsir', type: 'fighting', stats: st(65, 125, 100, 55, 70, 85), melee: true },
  { id: 186, name: 'Politoed', type: 'water', stats: st(90, 75, 75, 90, 100, 70), healer: true },
  { id: 202, name: 'Wobbuffet', type: 'psychic', stats: st(190, 33, 58, 33, 58, 33), taunt: true },
  { id: 210, name: 'Granbull', type: 'normal', stats: st(90, 120, 75, 60, 60, 45), melee: true },
  { id: 214, name: 'Heracross', type: 'fighting', stats: st(80, 125, 75, 40, 95, 85), melee: true },
  { id: 230, name: 'Kingdra', type: 'water', type2: 'flying', stats: st(75, 95, 95, 95, 95, 85), pierce: true },
  { id: 241, name: 'Miltank', type: 'normal', stats: st(95, 80, 105, 40, 70, 100), healer: true },
  { id: 242, name: 'Blissey', type: 'normal', stats: st(255, 10, 10, 75, 135, 55), healer: true },
  { id: 248, name: 'Tyranitar', type: 'rock', type2: 'ghost', stats: st(100, 134, 110, 95, 100, 61), melee: true },
  { id: 295, name: 'Exploud', type: 'normal', stats: st(104, 91, 63, 91, 73, 68) },
  { id: 336, name: 'Seviper', type: 'poison', stats: st(73, 100, 60, 100, 60, 65), melee: true },
  { id: 359, name: 'Absol', type: 'ghost', stats: st(65, 130, 60, 75, 60, 75), melee: true },
  { id: 365, name: 'Walrein', type: 'water', stats: st(110, 80, 90, 95, 90, 65) },
  { id: 376, name: 'Metagross', type: 'psychic', stats: st(80, 135, 130, 95, 90, 70), melee: true },
  { id: 254, name: 'Sceptile', type: 'grass', stats: st(70, 85, 65, 105, 85, 120), pierce: true },
  { id: 260, name: 'Swampert', type: 'water', type2: 'rock', stats: st(100, 110, 90, 85, 90, 60), melee: true },
  { id: 182, name: 'Bellossom', type: 'grass', stats: st(75, 80, 95, 90, 100, 50), healer: true },
  { id: 199, name: 'Slowking', type: 'psychic', type2: 'water', stats: st(95, 75, 80, 100, 110, 30) },
  { id: 205, name: 'Forretress', type: 'rock', stats: st(75, 90, 140, 60, 60, 40), taunt: true },
  { id: 227, name: 'Skarmory', type: 'flying', stats: st(65, 80, 140, 40, 70, 70) },
  { id: 226, name: 'Mantine', type: 'water', type2: 'flying', stats: st(85, 40, 70, 80, 140, 70) },
  { id: 233, name: 'Porygon2', type: 'normal', stats: st(85, 80, 90, 105, 95, 60) },
  { id: 237, name: 'Hitmontop', type: 'fighting', stats: st(50, 95, 95, 35, 110, 70), melee: true },
  { id: 107, name: 'Hitmonchan', type: 'fighting', stats: st(50, 105, 79, 35, 110, 76), melee: true },
  { id: 330, name: 'Flygon', type: 'rock', type2: 'flying', stats: st(80, 100, 80, 80, 80, 100) },
  { id: 321, name: 'Wailord', type: 'water', stats: st(170, 90, 45, 90, 45, 60), taunt: true },
  { id: 369, name: 'Relicanth', type: 'water', type2: 'rock', stats: st(100, 90, 130, 45, 65, 55), taunt: true },
  { id: 303, name: 'Mawile', type: 'fighting', stats: st(50, 85, 85, 55, 55, 50), melee: true },
  { id: 335, name: 'Zangoose', type: 'normal', stats: st(73, 115, 60, 60, 60, 90), melee: true },
  { id: 389, name: 'Torterra', type: 'grass', type2: 'rock', stats: st(95, 109, 105, 75, 85, 56), taunt: true },
  { id: 392, name: 'Infernape', type: 'fire', type2: 'fighting', stats: st(76, 104, 71, 104, 71, 108), melee: true, pierce: true },
  { id: 395, name: 'Empoleon', type: 'water', stats: st(84, 86, 88, 111, 101, 60), taunt: true },
  { id: 398, name: 'Staraptor', type: 'flying', type2: 'normal', stats: st(85, 120, 70, 50, 60, 100), melee: true },
  { id: 405, name: 'Luxray', type: 'electric', stats: st(80, 120, 79, 95, 79, 70), melee: true },
  { id: 407, name: 'Roserade', type: 'grass', type2: 'poison', stats: st(60, 70, 65, 125, 105, 90), healer: true },
  { id: 409, name: 'Rampardos', type: 'rock', stats: st(97, 165, 60, 65, 50, 58), melee: true },
  { id: 411, name: 'Bastiodon', type: 'rock', stats: st(60, 52, 168, 47, 138, 30), taunt: true },
  { id: 419, name: 'Floatzel', type: 'water', stats: st(85, 105, 55, 85, 50, 115) },
  { id: 424, name: 'Ambipom', type: 'normal', stats: st(75, 100, 66, 60, 66, 115), melee: true },
  { id: 426, name: 'Drifblim', type: 'ghost', type2: 'flying', stats: st(150, 80, 44, 90, 54, 80), cursed: true },
  { id: 428, name: 'Lopunny', type: 'normal', stats: st(65, 76, 84, 54, 96, 105), pierce: true },
  { id: 429, name: 'Mismagius', type: 'ghost', stats: st(60, 60, 60, 105, 105, 105), healer: true },
  { id: 430, name: 'Honchkrow', type: 'flying', type2: 'ghost', stats: st(100, 125, 52, 105, 52, 71), pierce: true },
  { id: 432, name: 'Purugly', type: 'normal', stats: st(71, 82, 64, 64, 59, 112) },
  { id: 435, name: 'Skuntank', type: 'poison', type2: 'ghost', stats: st(103, 93, 67, 71, 61, 84), melee: true },
  { id: 437, name: 'Bronzong', type: 'rock', type2: 'psychic', stats: st(67, 89, 116, 79, 116, 33), taunt: true },
  { id: 442, name: 'Spiritomb', type: 'ghost', stats: st(50, 92, 108, 92, 108, 35), cursed: true },
  { id: 445, name: 'Garchomp', type: 'rock', type2: 'flying', stats: st(108, 130, 95, 80, 85, 102), melee: true, pierce: true },
  { id: 448, name: 'Lucario', type: 'fighting', stats: st(70, 110, 70, 115, 70, 90), melee: true, pierce: true },
  { id: 450, name: 'Hippowdon', type: 'rock', stats: st(108, 112, 118, 68, 72, 47), taunt: true },
  { id: 452, name: 'Drapion', type: 'poison', type2: 'ghost', stats: st(70, 90, 110, 60, 75, 95), melee: true },
  { id: 454, name: 'Toxicroak', type: 'poison', type2: 'fighting', stats: st(83, 106, 65, 86, 65, 85), melee: true },
  { id: 460, name: 'Abomasnow', type: 'grass', type2: 'water', stats: st(90, 92, 75, 92, 85, 60), taunt: true },
  { id: 461, name: 'Weavile', type: 'ghost', type2: 'water', stats: st(70, 120, 65, 45, 85, 125), pierce: true, melee: true },
  { id: 462, name: 'Magnezone', type: 'electric', stats: st(70, 70, 115, 130, 90, 60), pierce: true },
  { id: 463, name: 'Lickilicky', type: 'normal', stats: st(110, 85, 95, 80, 95, 50) },
  { id: 464, name: 'Rhyperior', type: 'rock', stats: st(115, 140, 130, 55, 55, 40), melee: true },
  { id: 465, name: 'Tangrowth', type: 'grass', stats: st(100, 100, 125, 110, 50, 50) },
  { id: 466, name: 'Electivire', type: 'electric', stats: st(75, 123, 67, 95, 85, 95), melee: true },
  { id: 467, name: 'Magmortar', type: 'fire', stats: st(75, 95, 67, 125, 95, 83), melee: true },
  { id: 468, name: 'Togekiss', type: 'flying', stats: st(85, 50, 95, 120, 115, 80), healer: true },
  { id: 469, name: 'Yanmega', type: 'flying', stats: st(86, 76, 86, 116, 56, 95), pierce: true },
  { id: 470, name: 'Leafeon', type: 'grass', stats: st(65, 110, 130, 60, 65, 95) },
  { id: 471, name: 'Glaceon', type: 'water', stats: st(65, 60, 110, 130, 95, 65) },
  { id: 472, name: 'Gliscor', type: 'rock', type2: 'flying', stats: st(75, 95, 125, 45, 75, 95), melee: true },
  { id: 473, name: 'Mamoswine', type: 'water', type2: 'rock', stats: st(110, 130, 80, 70, 60, 80), melee: true },
  { id: 474, name: 'Porygon-Z', type: 'normal', stats: st(85, 80, 70, 135, 75, 90) },
  { id: 475, name: 'Gallade', type: 'psychic', type2: 'fighting', stats: st(68, 125, 65, 65, 115, 80), melee: true },
  { id: 476, name: 'Probopass', type: 'rock', stats: st(60, 55, 145, 75, 150, 40), taunt: true },
  { id: 477, name: 'Dusknoir', type: 'ghost', stats: st(45, 100, 135, 65, 135, 45) },
  { id: 478, name: 'Froslass', type: 'ghost', type2: 'water', stats: st(70, 80, 70, 80, 70, 110), pierce: true },
  { id: 479, name: 'Rotom', type: 'electric', type2: 'ghost', stats: st(50, 50, 77, 95, 77, 91), cursed: true },
];

// Rare invaders: legendaries that crash a normal wave on MS invade stages.
// Strong captures — spawn handled elsewhere; this is just the dex data.
export const INVADERS: SpeciesDef[] = [
  { id: 144, name: 'Articuno', type: 'flying', type2: 'water', stats: st(90, 85, 100, 95, 125, 85) },
  { id: 145, name: 'Zapdos', type: 'electric', type2: 'flying', stats: st(90, 90, 85, 125, 90, 100), pierce: true },
  { id: 146, name: 'Moltres', type: 'fire', type2: 'flying', stats: st(90, 100, 90, 125, 85, 90) },
  { id: 243, name: 'Raikou', type: 'electric', stats: st(90, 85, 75, 115, 100, 115), pierce: true },
  { id: 244, name: 'Entei', type: 'fire', stats: st(115, 115, 85, 90, 75, 100), melee: true },
  { id: 245, name: 'Suicune', type: 'water', stats: st(100, 75, 115, 90, 115, 85) },
  { id: 151, name: 'Mew', type: 'psychic', stats: st(100, 100, 100, 100, 100, 100), copy: true },
  { id: 251, name: 'Celebi', type: 'grass', type2: 'psychic', stats: st(100, 100, 100, 100, 100, 100), healer: true },
  { id: 377, name: 'Regirock', type: 'rock', stats: st(80, 100, 200, 50, 100, 50), taunt: true },
  { id: 378, name: 'Regice', type: 'water', stats: st(80, 50, 100, 100, 200, 50) },
  { id: 379, name: 'Registeel', type: 'rock', stats: st(80, 75, 150, 75, 150, 50) },
  { id: 380, name: 'Latias', type: 'psychic', type2: 'flying', stats: st(80, 80, 90, 110, 130, 110), healer: true },
  { id: 381, name: 'Latios', type: 'psychic', type2: 'flying', stats: st(80, 90, 80, 130, 110, 110), pierce: true },
  { id: 382, name: 'Kyogre', type: 'water', stats: st(100, 100, 90, 150, 140, 90) },
  { id: 383, name: 'Groudon', type: 'rock', stats: st(100, 150, 140, 100, 90, 90), melee: true },
  { id: 384, name: 'Rayquaza', type: 'flying', stats: st(105, 150, 90, 150, 90, 95) },
  { id: 249, name: 'Lugia', type: 'psychic', type2: 'flying', stats: st(106, 90, 130, 90, 154, 110) },
  { id: 250, name: 'Ho-Oh', type: 'fire', type2: 'flying', stats: st(106, 130, 90, 110, 154, 90) },
  { id: 385, name: 'Jirachi', type: 'psychic', stats: st(100, 100, 100, 100, 100, 100), healer: true },
  { id: 386, name: 'Deoxys', type: 'psychic', stats: st(50, 150, 50, 150, 50, 150), pierce: true },
  { id: 480, name: 'Uxie', type: 'psychic', stats: st(75, 75, 130, 75, 130, 95) },
  { id: 481, name: 'Mesprit', type: 'psychic', stats: st(80, 105, 105, 105, 105, 80), healer: true },
  { id: 482, name: 'Azelf', type: 'psychic', stats: st(75, 125, 70, 125, 70, 115), pierce: true },
  { id: 483, name: 'Dialga', type: 'rock', stats: st(100, 120, 120, 150, 100, 90), taunt: true },
  { id: 484, name: 'Palkia', type: 'water', type2: 'flying', stats: st(90, 120, 100, 150, 120, 100) },
  { id: 485, name: 'Heatran', type: 'fire', stats: st(91, 90, 106, 130, 106, 77) },
  { id: 486, name: 'Regigigas', type: 'normal', stats: st(110, 160, 110, 80, 110, 100), melee: true },
  { id: 487, name: 'Giratina', type: 'ghost', type2: 'flying', stats: st(150, 100, 120, 100, 120, 90), cursed: true },
  { id: 488, name: 'Cresselia', type: 'psychic', stats: st(120, 70, 120, 75, 130, 85), healer: true },
  { id: 489, name: 'Phione', type: 'water', stats: st(80, 80, 80, 80, 80, 80) },
  { id: 490, name: 'Manaphy', type: 'water', stats: st(100, 100, 100, 100, 100, 100), healer: true },
  { id: 491, name: 'Darkrai', type: 'ghost', stats: st(70, 90, 90, 135, 90, 125), pierce: true },
  { id: 492, name: 'Shaymin', type: 'grass', stats: st(100, 100, 100, 100, 100, 100), healer: true },
  { id: 493, name: 'Arceus', type: 'normal', stats: st(120, 120, 120, 120, 120, 120) },
];

// Evolution-only species: targets of evolvesTo that never roll into waves or
// the draft themselves. Mid-stages chain onward where their next form exists.
export const EVOS: SpeciesDef[] = [
  { id: 2, name: 'Ivysaur', type: 'grass', type2: 'poison', stats: st(60, 62, 63, 80, 80, 60), evolvesTo: 3 },
  { id: 5, name: 'Charmeleon', type: 'fire', stats: st(58, 64, 58, 80, 65, 80), evolvesTo: 6 },
  { id: 8, name: 'Wartortle', type: 'water', stats: st(59, 63, 80, 65, 80, 58), evolvesTo: 9 },
  { id: 17, name: 'Pidgeotto', type: 'flying', type2: 'normal', stats: st(63, 60, 55, 50, 50, 71), melee: true, evolvesTo: 18 },
  { id: 18, name: 'Pidgeot', type: 'flying', type2: 'normal', stats: st(83, 80, 75, 70, 70, 101), melee: true },
  { id: 20, name: 'Raticate', type: 'normal', stats: st(55, 81, 60, 50, 70, 97), melee: true },
  { id: 22, name: 'Fearow', type: 'flying', stats: st(65, 90, 65, 61, 61, 100), melee: true },
  { id: 26, name: 'Raichu', type: 'electric', stats: st(60, 90, 55, 90, 80, 110), pierce: true },
  { id: 33, name: 'Nidorino', type: 'poison', stats: st(61, 72, 57, 55, 55, 65), melee: true, evolvesTo: 34 },
  { id: 36, name: 'Clefable', type: 'normal', stats: st(95, 70, 73, 95, 90, 60), healer: true },
  { id: 38, name: 'Ninetales', type: 'fire', stats: st(73, 76, 75, 81, 100, 100) },
  { id: 40, name: 'Wigglytuff', type: 'normal', stats: st(140, 70, 45, 85, 50, 45), healer: true },
  { id: 42, name: 'Golbat', type: 'poison', type2: 'flying', stats: st(75, 80, 70, 65, 75, 90), melee: true, evolvesTo: 169 },
  { id: 44, name: 'Gloom', type: 'grass', type2: 'poison', stats: st(60, 65, 70, 85, 75, 40), evolvesTo: [45, 182] },
  { id: 45, name: 'Vileplume', type: 'grass', type2: 'poison', stats: st(75, 80, 85, 110, 90, 50) },
  { id: 47, name: 'Parasect', type: 'grass', type2: 'poison', stats: st(60, 95, 80, 60, 80, 30), melee: true },
  { id: 49, name: 'Venomoth', type: 'poison', stats: st(70, 65, 60, 90, 75, 90) },
  { id: 51, name: 'Dugtrio', type: 'rock', stats: st(35, 100, 50, 50, 70, 120), melee: true },
  { id: 53, name: 'Persian', type: 'normal', stats: st(65, 70, 60, 65, 65, 115), pierce: true },
  { id: 55, name: 'Golduck', type: 'water', stats: st(80, 82, 78, 95, 80, 85) },
  { id: 57, name: 'Primeape', type: 'fighting', stats: st(65, 105, 60, 60, 70, 95), melee: true },
  { id: 61, name: 'Poliwhirl', type: 'water', stats: st(65, 65, 65, 50, 50, 90), evolvesTo: [62, 186] },
  { id: 62, name: 'Poliwrath', type: 'water', stats: st(90, 95, 95, 70, 90, 70), melee: true },
  { id: 64, name: 'Kadabra', type: 'psychic', stats: st(40, 35, 30, 120, 70, 105), pierce: true, evolvesTo: 65 },
  { id: 67, name: 'Machoke', type: 'fighting', stats: st(80, 100, 70, 50, 60, 45), melee: true, evolvesTo: 68 },
  { id: 70, name: 'Weepinbell', type: 'grass', type2: 'poison', stats: st(65, 90, 50, 85, 45, 55), evolvesTo: 71 },
  { id: 71, name: 'Victreebel', type: 'grass', type2: 'poison', stats: st(80, 105, 65, 100, 70, 70), melee: true },
  { id: 73, name: 'Tentacruel', type: 'water', type2: 'poison', stats: st(80, 70, 65, 80, 120, 100) },
  { id: 75, name: 'Graveler', type: 'rock', stats: st(55, 95, 115, 45, 45, 35), evolvesTo: 76 },
  { id: 78, name: 'Rapidash', type: 'fire', stats: st(65, 100, 70, 80, 80, 105) },
  { id: 82, name: 'Magneton', type: 'electric', stats: st(50, 60, 95, 120, 70, 70), evolvesTo: 462 },
  { id: 85, name: 'Dodrio', type: 'flying', type2: 'normal', stats: st(60, 110, 70, 60, 60, 110), melee: true },
  { id: 89, name: 'Muk', type: 'poison', stats: st(105, 105, 75, 65, 100, 50), melee: true },
  { id: 93, name: 'Haunter', type: 'ghost', type2: 'poison', stats: st(45, 50, 45, 115, 55, 95), pierce: true, evolvesTo: 94 },
  { id: 101, name: 'Electrode', type: 'electric', stats: st(60, 50, 70, 80, 80, 150) },
  { id: 103, name: 'Exeggutor', type: 'grass', type2: 'psychic', stats: st(95, 95, 85, 125, 75, 55) },
  { id: 105, name: 'Marowak', type: 'rock', stats: st(60, 80, 110, 50, 80, 45), melee: true },
  { id: 110, name: 'Weezing', type: 'poison', stats: st(65, 90, 120, 85, 70, 60) },
  { id: 112, name: 'Rhydon', type: 'rock', stats: st(105, 130, 120, 45, 45, 40), melee: true },
  { id: 164, name: 'Noctowl', type: 'flying', type2: 'normal', stats: st(100, 50, 50, 86, 96, 70), melee: true },
  { id: 171, name: 'Lanturn', type: 'electric', type2: 'water', stats: st(125, 58, 58, 76, 76, 67) },
  { id: 208, name: 'Steelix', type: 'rock', stats: st(75, 85, 200, 55, 65, 30), melee: true },
  { id: 219, name: 'Magcargo', type: 'fire', stats: st(60, 50, 120, 90, 80, 30) },
  { id: 279, name: 'Pelipper', type: 'flying', type2: 'water', stats: st(60, 50, 100, 95, 70, 65) },
  { id: 334, name: 'Altaria', type: 'flying', stats: st(75, 70, 90, 70, 105, 80) },
  { id: 80, name: 'Slowbro', type: 'psychic', type2: 'water', stats: st(95, 75, 110, 100, 80, 30) },
  { id: 99, name: 'Kingler', type: 'water', stats: st(55, 130, 115, 50, 50, 75), melee: true },
  { id: 119, name: 'Seaking', type: 'water', stats: st(80, 92, 65, 65, 80, 68) },
  { id: 139, name: 'Omastar', type: 'water', type2: 'rock', stats: st(70, 60, 125, 115, 70, 55) },
  { id: 141, name: 'Kabutops', type: 'rock', type2: 'water', stats: st(60, 115, 105, 65, 70, 80), melee: true },
  { id: 148, name: 'Dragonair', type: 'flying', stats: st(61, 84, 65, 70, 70, 70), evolvesTo: 149 },
  { id: 178, name: 'Xatu', type: 'flying', type2: 'psychic', stats: st(65, 75, 70, 95, 70, 95) },
  { id: 180, name: 'Flaaffy', type: 'electric', stats: st(70, 55, 55, 80, 60, 45), evolvesTo: 181 },
  { id: 184, name: 'Azumarill', type: 'water', type2: 'normal', stats: st(100, 50, 80, 60, 80, 50), healer: true },
  { id: 195, name: 'Quagsire', type: 'water', type2: 'rock', stats: st(95, 85, 85, 65, 65, 35) },
  { id: 217, name: 'Ursaring', type: 'normal', stats: st(90, 130, 75, 75, 75, 55), melee: true },
  { id: 232, name: 'Donphan', type: 'rock', stats: st(90, 120, 120, 60, 60, 50), melee: true },
  { id: 262, name: 'Mightyena', type: 'ghost', stats: st(70, 90, 70, 60, 60, 70), melee: true },
  { id: 271, name: 'Lombre', type: 'grass', type2: 'water', stats: st(60, 50, 50, 60, 70, 50) },
  { id: 274, name: 'Nuzleaf', type: 'grass', type2: 'ghost', stats: st(70, 70, 40, 60, 40, 60) },
  { id: 277, name: 'Swellow', type: 'flying', type2: 'normal', stats: st(60, 85, 60, 50, 50, 125), melee: true },
  { id: 281, name: 'Kirlia', type: 'psychic', type2: 'normal', stats: st(38, 35, 35, 65, 55, 50), evolvesTo: [282, 475] },
  { id: 286, name: 'Breloom', type: 'grass', stats: st(60, 130, 80, 60, 60, 70), melee: true },
  { id: 294, name: 'Loudred', type: 'normal', stats: st(84, 71, 43, 71, 43, 48) },
  { id: 297, name: 'Hariyama', type: 'fighting', stats: st(144, 120, 60, 40, 60, 50), melee: true },
  { id: 305, name: 'Lairon', type: 'rock', stats: st(60, 90, 140, 50, 50, 40), evolvesTo: 306 },
  { id: 310, name: 'Manectric', type: 'electric', stats: st(70, 75, 60, 105, 60, 105) },
  { id: 319, name: 'Sharpedo', type: 'water', stats: st(70, 120, 40, 95, 40, 95), melee: true },
  { id: 329, name: 'Vibrava', type: 'rock', type2: 'flying', stats: st(50, 70, 50, 50, 50, 70) },
  { id: 332, name: 'Cacturne', type: 'grass', type2: 'ghost', stats: st(70, 115, 60, 115, 60, 55), melee: true },
  { id: 342, name: 'Crawdaunt', type: 'water', type2: 'ghost', stats: st(63, 120, 85, 90, 55, 55), melee: true },
  { id: 354, name: 'Banette', type: 'ghost', stats: st(64, 115, 65, 83, 63, 65), pierce: true },
  { id: 356, name: 'Dusclops', type: 'ghost', stats: st(40, 70, 130, 60, 130, 25), taunt: true, evolvesTo: 477 },
  { id: 362, name: 'Glalie', type: 'water', stats: st(80, 80, 80, 80, 80, 80) },
  { id: 364, name: 'Sealeo', type: 'water', stats: st(90, 60, 70, 75, 70, 45) },
  { id: 11, name: 'Metapod', type: 'grass', stats: st(50, 20, 55, 25, 25, 30), evolvesTo: 12 },
  { id: 12, name: 'Butterfree', type: 'flying', stats: st(60, 45, 50, 90, 80, 70) },
  { id: 14, name: 'Kakuna', type: 'poison', stats: st(45, 25, 50, 25, 25, 35), evolvesTo: 15 },
  { id: 15, name: 'Beedrill', type: 'poison', stats: st(65, 90, 40, 45, 80, 75), melee: true },
  { id: 28, name: 'Sandslash', type: 'rock', stats: st(75, 100, 110, 45, 55, 65), melee: true },
  { id: 30, name: 'Nidorina', type: 'poison', stats: st(70, 62, 67, 55, 55, 56), evolvesTo: 31 },
  { id: 31, name: 'Nidoqueen', type: 'poison', type2: 'rock', stats: st(90, 92, 87, 75, 85, 76), melee: true },
  { id: 87, name: 'Dewgong', type: 'water', stats: st(90, 70, 80, 70, 95, 70) },
  { id: 91, name: 'Cloyster', type: 'water', stats: st(50, 95, 180, 85, 45, 70) },
  { id: 106, name: 'Hitmonlee', type: 'fighting', stats: st(50, 120, 53, 35, 110, 87), melee: true },
  { id: 117, name: 'Seadra', type: 'water', stats: st(55, 65, 95, 95, 45, 85), evolvesTo: 230 },
  { id: 166, name: 'Ledian', type: 'flying', stats: st(55, 35, 50, 55, 110, 85), melee: true },
  { id: 168, name: 'Ariados', type: 'poison', stats: st(70, 90, 70, 60, 60, 40), melee: true },
  { id: 188, name: 'Skiploom', type: 'grass', type2: 'flying', stats: st(55, 45, 50, 45, 65, 80), evolvesTo: 189 },
  { id: 189, name: 'Jumpluff', type: 'grass', type2: 'flying', stats: st(75, 55, 70, 55, 95, 110) },
  { id: 192, name: 'Sunflora', type: 'grass', stats: st(75, 75, 55, 105, 85, 30) },
  { id: 224, name: 'Octillery', type: 'water', stats: st(75, 105, 75, 105, 75, 45), pierce: true },
  { id: 247, name: 'Pupitar', type: 'rock', stats: st(70, 84, 70, 65, 70, 51), evolvesTo: 248 },
  { id: 266, name: 'Silcoon', type: 'grass', stats: st(50, 35, 55, 25, 25, 15), evolvesTo: 267 },
  { id: 267, name: 'Beautifly', type: 'flying', stats: st(60, 70, 50, 100, 50, 65) },
  { id: 284, name: 'Masquerain', type: 'flying', stats: st(70, 60, 62, 100, 82, 80) },
  { id: 301, name: 'Delcatty', type: 'normal', stats: st(70, 65, 65, 55, 55, 90) },
  { id: 308, name: 'Medicham', type: 'fighting', type2: 'psychic', stats: st(60, 60, 75, 60, 75, 80), melee: true },
  { id: 323, name: 'Camerupt', type: 'fire', stats: st(70, 100, 70, 105, 75, 40), melee: true },
  { id: 326, name: 'Grumpig', type: 'psychic', stats: st(80, 45, 65, 90, 110, 80) },
  { id: 344, name: 'Claydol', type: 'psychic', type2: 'rock', stats: st(60, 70, 105, 70, 120, 75) },
  { id: 346, name: 'Cradily', type: 'grass', type2: 'rock', stats: st(86, 81, 97, 81, 107, 43) },
  { id: 348, name: 'Armaldo', type: 'rock', stats: st(75, 125, 100, 70, 80, 45), melee: true },
  { id: 367, name: 'Huntail', type: 'water', stats: st(55, 104, 105, 94, 75, 52) },
  { id: 372, name: 'Shelgon', type: 'flying', stats: st(65, 95, 100, 60, 50, 50), evolvesTo: 373 },
  { id: 375, name: 'Metang', type: 'psychic', stats: st(60, 75, 100, 55, 80, 50), evolvesTo: 376 },
  { id: 153, name: 'Bayleef', type: 'grass', stats: st(60, 62, 80, 63, 80, 60), healer: true, evolvesTo: 154 },
  { id: 156, name: 'Quilava', type: 'fire', stats: st(58, 64, 58, 80, 65, 80), evolvesTo: 157 },
  { id: 159, name: 'Croconaw', type: 'water', stats: st(65, 80, 80, 59, 63, 58), evolvesTo: 160 },
  { id: 253, name: 'Grovyle', type: 'grass', stats: st(50, 65, 45, 85, 65, 95), evolvesTo: 254 },
  { id: 256, name: 'Combusken', type: 'fire', type2: 'fighting', stats: st(60, 85, 60, 85, 60, 55), evolvesTo: 257 },
  { id: 259, name: 'Marshtomp', type: 'water', type2: 'rock', stats: st(70, 85, 70, 60, 70, 50), evolvesTo: 260 },
  { id: 176, name: 'Togetic', type: 'flying', type2: 'normal', stats: st(55, 40, 85, 80, 105, 40), healer: true, evolvesTo: 468 },
  { id: 388, name: 'Grotle', type: 'grass', stats: st(75, 89, 85, 55, 65, 36), healer: true, evolvesTo: 389 },
  { id: 391, name: 'Monferno', type: 'fire', type2: 'fighting', stats: st(64, 78, 52, 78, 52, 81), melee: true, evolvesTo: 392 },
  { id: 394, name: 'Prinplup', type: 'water', stats: st(64, 66, 68, 81, 76, 50), evolvesTo: 395 },
  { id: 397, name: 'Staravia', type: 'flying', type2: 'normal', stats: st(55, 75, 50, 40, 40, 80), melee: true, evolvesTo: 398 },
  { id: 404, name: 'Luxio', type: 'electric', stats: st(60, 85, 49, 60, 49, 60), melee: true, evolvesTo: 405 },
  { id: 444, name: 'Gabite', type: 'rock', type2: 'flying', stats: st(68, 90, 65, 50, 55, 82), melee: true, evolvesTo: 445 },
];

export const ALL_SPRITE_IDS = [
  ...ROSTER.map((r) => r.id),
  ...ENEMY_DB.map((e) => e.id),
  ...ELITES.map((e) => e.id),
  ...EVOS.map((e) => e.id),
  ...INVADERS.map((i) => i.id),
];

export const ALL_SPECIES = [...ROSTER, ...ENEMY_DB, ...ELITES, ...EVOS, ...INVADERS];
// any dex id -> its def; dupes exist across pools, first match (ROSTER) wins
export const speciesById = (id: number): SpeciesDef | undefined =>
  ALL_SPECIES.find((d) => d.id === id);

const ENEMY_POOL = ENEMY_DB.slice(0, -8);
export const BOSS_POOL = ENEMY_DB.slice(-8);

// Competitive-style power tiers by BST — the climb's power curve.
// 0 LC (<360) · 1 low (360-459) · 2 high (460-559) · 3 uber (560+).
// Draft picks are tier ≤1; wild pools unlock heavier bodies with depth
// and the 560+ monsters (Metagross, Tyranitar, Slaking) lurk past depth 3.
export const bst = (d: SpeciesDef) =>
  d.stats.hp + d.stats.atk + d.stats.def + d.stats.spa + d.stats.spd + d.stats.spe;
export const tierOf = (d: SpeciesDef) => (bst(d) >= 560 ? 3 : bst(d) >= 460 ? 2 : bst(d) >= 360 ? 1 : 0);
// depth 0 (seeded stages 1-3) → tier ≤1; rolled depth 1-2 → ≤2; deeper → all
const tierCap = (depth: number) => (depth <= 0 ? 1 : depth < 3 ? 2 : 3);
const capped = (src: SpeciesDef[], depth: number) => {
  const p = src.filter((d) => tierOf(d) <= tierCap(depth));
  return p.length ? p : src;
};
const fodderPool = (theme: Theme | undefined, depth: number) =>
  capped(theme ? ENEMY_THEME[theme] : ENEMY_POOL, depth);
const elitePool = (depth: number) => capped(ELITES, depth);
const eliteAt = (rng: () => number, depth: number) => {
  const p = elitePool(depth);
  return p[Math.floor(rng() * p.length)];
};

// Biome pools: waves draw fodder from their stage's theme so each stretch
// feels like a place — grass/bug-ish in the grove, rock/poison/ghost in the
// cavern, fire/rock at the volcano, flying/electric/water in the sky.
const foe = (id: number): SpeciesDef => ENEMY_DB.find((d) => d.id === id)!;
export const ENEMY_THEME: Record<Theme, SpeciesDef[]> = {
  grove: [19, 16, 43, 21, 163, 46, 48, 69, 102, 216, 263, 270, 273, 276, 331, 108, 10, 13, 165, 167, 187, 193, 206, 265, 283, 313, 314, 315, 357].map(foe),
  cavern: [41, 74, 92, 66, 50, 104, 56, 88, 109, 63, 198, 200, 261, 140, 231, 353, 355, 27, 29, 299, 302, 337, 338, 343, 345, 347].map(foe),
  volcano: [37, 58, 77, 126, 218, 74, 50, 104, 111, 228, 128, 231, 240, 322, 324].map(foe),
  sky: [16, 21, 81, 100, 170, 72, 84, 278, 333, 177, 309, 147, 98, 118, 318, 341, 86, 90, 116, 207, 222, 225, 366, 370].map(foe),
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
// a pocket you can squeeze the ball through for multi-hits.
const SLOTS: [number, number][] = [
  [0.25, 0.2], [0.75, 0.2], [0.5, 0.4], [0.25, 0.55],
  [0.75, 0.55], [0.5, 0.12], [0.15, 0.4], [0.85, 0.4],
  [0.35, 0.72], [0.65, 0.72], [0.5, 0.6], [0.85, 0.62],
  [0.44, 0.3], [0.53, 0.3], [0.44, 0.66], [0.53, 0.66],
];

// Archero-style room blocks: sparse stone clusters the ball banks off.
// Normalized arena coords; stays out of the bottom spawn band (y < 0.7)
// and open layouts stay common — a gym leader's room is always clear.
export interface BlockDef {
  nx: number;
  ny: number;
  nw: number;
  nh: number;
}
export const BLOCK_LAYOUTS: BlockDef[][] = [
  [],
  // twin slabs — the classic Archero room divider
  [{ nx: 0.16, ny: 0.3, nw: 0.09, nh: 0.2 }, { nx: 0.75, ny: 0.3, nw: 0.09, nh: 0.2 }],
  [{ nx: 0.44, ny: 0.4, nw: 0.12, nh: 0.12 }], // center pillar
  // corner quads — four banks, wide lanes between
  [
    { nx: 0.13, ny: 0.24, nw: 0.08, nh: 0.09 },
    { nx: 0.79, ny: 0.24, nw: 0.08, nh: 0.09 },
    { nx: 0.13, ny: 0.5, nw: 0.08, nh: 0.09 },
    { nx: 0.79, ny: 0.5, nw: 0.08, nh: 0.09 },
  ],
  // staggered gates — forces the ball through a chicane
  [{ nx: 0.28, ny: 0.24, nw: 0.08, nh: 0.18 }, { nx: 0.64, ny: 0.46, nw: 0.08, nh: 0.18 }],
  [{ nx: 0.28, ny: 0.42, nw: 0.44, nh: 0.05 }], // mid bar, gaps at the edges
  // scatter stones — ricochet pinballs
  [
    { nx: 0.24, ny: 0.5, nw: 0.06, nh: 0.06 },
    { nx: 0.47, ny: 0.28, nw: 0.06, nh: 0.06 },
    { nx: 0.7, ny: 0.5, nw: 0.06, nh: 0.06 },
  ],
  // top pocket — foes can tuck into the alcove
  [
    { nx: 0.4, ny: 0.18, nw: 0.2, nh: 0.05 },
    { nx: 0.4, ny: 0.18, nw: 0.05, nh: 0.15 },
    { nx: 0.55, ny: 0.18, nw: 0.05, nh: 0.15 },
  ],
  // fortress — U opening upward; enemies inside take banked approaches
  [
    { nx: 0.38, ny: 0.5, nw: 0.24, nh: 0.05 },
    { nx: 0.38, ny: 0.34, nw: 0.05, nh: 0.21 },
    { nx: 0.57, ny: 0.34, nw: 0.05, nh: 0.21 },
  ],
  // twin bars — two staggered lanes, forces the low line or the high bank
  [
    { nx: 0.18, ny: 0.32, nw: 0.22, nh: 0.05 },
    { nx: 0.6, ny: 0.5, nw: 0.22, nh: 0.05 },
  ],
  // side pockets + center stone — edge banks and a mid ricochet
  [
    { nx: 0.08, ny: 0.34, nw: 0.06, nh: 0.16 },
    { nx: 0.86, ny: 0.34, nw: 0.06, nh: 0.16 },
    { nx: 0.47, ny: 0.42, nw: 0.06, nh: 0.06 },
  ],
  // double lanes — top and bottom bars split the room horizontally
  [
    { nx: 0.3, ny: 0.26, nw: 0.4, nh: 0.05 },
    { nx: 0.3, ny: 0.56, nw: 0.4, nh: 0.05 },
  ],
];

// Gym flavor: the boss's entourage shares its type when the pools have
// candidates — every gym leader runs a little mono-type gym.
function gymPack(
  boss: SpeciesDef,
  n: number,
  rng: () => number,
  slot: () => { nx: number; ny: number },
  fodder: SpeciesDef[],
  depth: number,
): WaveSpawn[] {
  const same = [...ENEMY_POOL, ...elitePool(depth)].filter((d) => d.type === boss.type);
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
  const fodder = fodderPool(theme, 0); // the opening stretch is tier ≤1 only
  const add = () => ({ def: fodder[Math.floor(rng() * fodder.length)], ...slot() });
  const elite = () => ({ def: eliteAt(rng, 0), ...slot() });
  // designed opener: the first pack a run pulls into is clustered around a
  // seeded point, so the ricochet that defines the genre shows on shot one
  const cx = 0.3 + rng() * 0.4;
  const cy = 0.2 + rng() * 0.18;
  const opener = () => ({
    def: fodder[Math.floor(rng() * fodder.length)],
    nx: Math.min(0.88, Math.max(0.12, cx + (rng() - 0.5) * 0.24)),
    ny: Math.min(0.68, Math.max(0.1, cy + (rng() - 0.5) * 0.2)),
  });
  return {
    name: name ?? THEME_NAME[theme],
    theme,
    waves: [
      [opener(), opener(), opener()],
      [add(), add(), add(), elite()],
      [...gymPack(boss, 2, rng, slot, fodder, 0), { def: boss, nx: 0.5, ny: 0.45, boss: true }],
    ],
  };
}

// Roll the next stage (depth 1..6 = stages 4..9). Bigger packs each depth,
// a gym boss every 3rd.
// `theme` picks the biome pool for fodder; omit it to fall back to the flat pool.
export function rollWave(rng: () => number, depth: number, theme?: Theme): WaveSpawn[] {
  const fodder = fodderPool(theme, depth);
  const slots = [...SLOTS];
  const slot = () => {
    const [nx, ny] = slots.splice(Math.floor(rng() * slots.length), 1)[0];
    return { nx: nx + (rng() - 0.5) * 0.1, ny: ny + (rng() - 0.5) * 0.08 };
  };
  const add = () => ({
    // deeper waves mix in capturable elites — odds and tier cap both ramp
    def: depth > 0 && rng() < 0.15 + depth * 0.05
      ? eliteAt(rng, depth)
      : fodder[Math.floor(rng() * fodder.length)],
    ...slot(),
  });
  const boss = depth % 3 === 0 ? BOSS_POOL[Math.floor(rng() * BOSS_POOL.length)] : null;
  const n = Math.min(3 + Math.floor(depth / 2), 6);
  const wave: WaveSpawn[] = boss ? gymPack(boss, n, rng, slot, fodder, depth) : Array.from({ length: n }, add);
  if (boss) wave.push({ def: boss, nx: 0.5, ny: 0.3, boss: true });
  return wave;
}

// Trainer battles: map stops where an overworld trainer fields a mono-type
// squad. Their mons are already trained — uncatchable — but the fight pays
// elite-tier loot. Class sprite + title come from the gracidea npc atlas.
export const TRAINER_CLASS: Record<PokeType, { frame: string; title: string }> = {
  normal: { frame: 'youngster_down_0', title: 'YOUNGSTER' },
  fire: { frame: 'pokemaniac_down_0', title: 'POKÉMANIAC' },
  water: { frame: 'fisher_down_0', title: 'FISHERMAN' },
  grass: { frame: 'aroma_down_0', title: 'AROMA LADY' },
  electric: { frame: 'guitarist_down_0', title: 'GUITARIST' },
  psychic: { frame: 'psychic_left_0', title: 'PSYCHIC' },
  rock: { frame: 'hiker_down_0', title: 'HIKER' },
  poison: { frame: 'scientist_down_0', title: 'SCIENTIST' },
  flying: { frame: 'ranger_m_down_0', title: 'RANGER' },
  fighting: { frame: 'black_belt_down_1', title: 'BLACK BELT' },
  ghost: { frame: 'elder_f_down_0', title: 'CHANNELER' },
};
export const TRAINER_TYPES = Object.keys(TRAINER_CLASS) as PokeType[];

// A trainer fields a whole squad of one type — evo-lines welcome, the way
// real NPC teams mix stages. The ace (highest BST) anchors center-top.
export function trainerWave(rng: () => number, depth: number, type: PokeType): WaveSpawn[] {
  // same depth gate as wild waves — a stage-2 youngster can't field ubers
  const pool = [...fodderPool(undefined, depth), ...elitePool(depth), ...capped(EVOS, depth)].filter(
    (d) => d.type === type,
  );
  const fodder = pool.length ? pool : ENEMY_POOL;
  const slots = [...SLOTS];
  const slot = () => {
    const [nx, ny] = slots.splice(Math.floor(rng() * slots.length), 1)[0];
    return { nx: nx + (rng() - 0.5) * 0.1, ny: ny + (rng() - 0.5) * 0.08 };
  };
  const bst = (d: SpeciesDef) => d.stats.hp + d.stats.atk + d.stats.def + d.stats.spa + d.stats.spd + d.stats.spe;
  const ace = [...fodder].sort((a, b) => bst(b) - bst(a))[0];
  const n = Math.min(3 + Math.floor(depth / 2), 6) + 1; // a full squad, like an elite road
  const wave: WaveSpawn[] = Array.from({ length: n }, () => ({ def: fodder[Math.floor(rng() * fodder.length)], ...slot() }));
  wave.push({ def: ace, nx: 0.5, ny: 0.28 });
  return wave;
}

// Random catchable species for events (wounded mon, egg, wonder trade).
// Depth tilts fodder→elite the same way rolled waves do; `elite` forces
// the deep pool (alpha bosses deserve a monster).
export function pickWild(rng: () => number, depth: number, elite = false): SpeciesDef {
  if (elite || (depth > 0 && rng() < 0.4)) return eliteAt(rng, depth);
  const p = fodderPool(undefined, depth);
  return p[Math.floor(rng() * p.length)];
}

// Rival-echo wave: the player's own team turns up on the enemy side — ace
// parked near center-top, the rest jittered through the upper/mid arena.
export function rivalWave(defs: SpeciesDef[], rng: () => number): WaveSpawn[] {
  return defs.slice(0, 4).map((def, i) => ({
    def,
    nx: 0.5 + (rng() - 0.5) * (i === 0 ? 0.1 : 0.6),
    ny: i === 0 ? 0.15 + rng() * 0.05 : 0.35 + (rng() - 0.5) * 0.4,
    boss: false,
  }));
}

// Hazard zones: per-theme arena dangers laid out alongside a wave's spawns.
// Same normalized coords as WaveSpawn; r is a fraction of arena width.
// Zones stay out of the bottom 25% (player turf) and inside the side walls.
export type HazardKind = 'lava' | 'grass' | 'gust' | 'spikes' | 'static' | 'mine' | 'warp' | 'boost' | 'well' | 'power';
export interface HazardSpawn {
  kind: HazardKind;
  nx: number;
  ny: number;
  r: number;
  dir?: number; // gust only: -1/1, the way the wind pushes
  pair?: number; // warp only: pads sharing an id are linked
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
  const out = themeHazards(theme, rng, rad, spot, n);
  // roamer gimmick: ~1/3 of any court gets one extra MS-style fixture —
  // a linked warp pair, a boost pad, or a gravity well
  if (rng() < 0.35) {
    const g = rng();
    if (g < 0.4) {
      // MS warp panels: two linked pads — the ball exits the twin keeping
      // its velocity, so a bad lane can become a trick shot
      const a = spot(0.05, 0.15, 0.5);
      const b = spot(0.05, 0.15, 0.5);
      if (Math.hypot(a.nx - b.nx, a.ny - b.ny) > 0.2) {
        out.push({ kind: 'warp', ...a, pair: 1 }, { kind: 'warp', ...b, pair: 1 });
      }
    } else if (g < 0.7) {
      // speed-up panel: crossing it re-launches the ball faster
      out.push({ kind: 'boost', ...spot(0.06, 0.15, 0.55) });
    } else {
      // gravity barrier: the ball curves toward the well while inside
      out.push({ kind: 'well', nx: 0.3 + rng() * 0.4, ny: 0.2 + rng() * 0.35, r: 0.16 + rng() * 0.06 });
    }
  }
  return out;
}

function themeHazards(
  theme: Theme,
  rng: () => number,
  rad: () => number,
  spot: (r: number, yLo: number, yHi: number) => { nx: number; ny: number; r: number },
  n: (lo: number, hi: number) => number,
): HazardSpawn[] {
  switch (theme) {
    case 'volcano': {
      const lavas: HazardSpawn[] = Array.from({ length: n(1, 3) }, () => {
        const r = rad();
        return { kind: 'lava', ...spot(r, 0.15, 0.6) };
      });
      // MS mines: small pads that detonate when the ball touches them —
      // a trap you can weaponize against the pack
      const mines: HazardSpawn[] = Array.from({ length: n(0, 2) }, () => ({ kind: 'mine' as const, ...spot(0.05, 0.15, 0.6) }));
      return lavas.concat(mines);
    }
    case 'grove':
      return Array.from({ length: n(2, 4) }, () => {
        const r = rad();
        return { kind: 'grass', ...spot(r, 0.1, 0.7) };
      });
    case 'sky': {
      // wide horizontal wind bands, centered-ish, pushing left or right
      const gusts: HazardSpawn[] = Array.from({ length: n(1, 2) }, () => {
        const r = 0.18 + rng() * 0.05;
        return {
          kind: 'gust',
          nx: 0.5 + (rng() - 0.5) * 0.1,
          ny: 0.2 + rng() * (0.55 - r - 0.2),
          r,
          dir: rng() < 0.5 ? -1 : 1,
        };
      });
      // static pools: silence fields — keywords & bump supers go dead inside
      const pools: HazardSpawn[] = Array.from({ length: n(0, 2) }, () => {
        const r = rad();
        return { kind: 'static', ...spot(r, 0.2, 0.55) };
      });
      return gusts.concat(pools);
    }
    case 'cavern':
      // jagged strips shoved off-center, one side or the other, plus
      // the odd buried mine — a trap the ball can weaponize
      return [
        ...Array.from({ length: n(1, 3) }, () => {
          const r = rad();
          const nx = rng() < 0.5
            ? r + rng() * (0.42 - r)
            : 0.58 + rng() * (1 - 0.58 - r);
          return { kind: 'spikes' as const, nx, ny: 0.15 + rng() * (Math.min(0.6, 0.75 - r) - 0.15), r };
        }),
        ...Array.from({ length: n(0, 2) }, () => ({ kind: 'mine' as const, ...spot(0.05, 0.15, 0.6) })),
      ];
    default:
      return [];
  }
}
