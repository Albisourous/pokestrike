import type { PokeType, Weather } from './types';
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
  shielded?: boolean; // a shell face drifts the rim: front hits glance to 30%, back hits pay a 50% flank
  spiky?: boolean; // contact bites the ball — grazing through the pack costs ~6% of the shooter's HP
  regen?: boolean; // mends ~3% HP a second — must be burst down, not whittled
  split?: boolean; // divides on KO — two half-size spawn take its place
  rage?: boolean; // under 30% HP it enrages — attack cycle drops a third
  sleepy?: boolean; // dozes until hit — timer frozen, +35% to hits on it
  repel?: boolean; // a repulsor field shoves the ball away — bank in or burn through
  raider?: boolean; // ignores the fight to steal field pickups — kill it before the loot's gone
  volley?: boolean; // fans its attack across the three nearest mons — one tank can't soak it
  summon?: boolean; // SOS caller: cries for a weak kid instead of attacking — kill it before the field floods
  mirror?: boolean; // Transform: copies the strongest standing mon's typing + stats (keeps its own HP)
  fuse?: boolean; // self-destructs when its countdown ends — the blast hits BOTH sides; kill it fast or bait it into the pack
  hunter?: boolean; // pack predator — targets the weakest mon, not the nearest; guard the low one
  leech?: boolean; // Leech Life: its hits mend its own wounds — bursts beat chip trades
  drowsy?: boolean; // Sleep Powder: hits can put a mon to sleep — it loses a turn and can't bump
  venom?: boolean; // poison sting: its hits leave the victim bleeding a tick a round
  burn?: boolean; // Will-O-Wisp: hits can burn — the victim hits softer and singes each round
  para?: boolean; // Thunder Wave: hits can paralyze — the victim's launch limps a few rounds
  toxic?: boolean; // Poison Point: merely striking the hide can poison the ball — graze it wide
  shock?: boolean; // Static: striking the crackling hide can paralyze the ball — the launch limps
  flame?: boolean; // Flame Body: striking the hide can burn the ball — its hits lose heat
  menace?: boolean; // Intimidate: while it lives the team's hits lose a fifth — kill it first
  wguard?: boolean; // Wonder Guard: only super-effective hits land — slam it, burn it, or hit SE
  sturdy?: boolean; // Sturdy: hangs on at 1 HP through the first lethal hit
  charm?: boolean; // Cute Charm: a smitten striker nods off — it loses a launch
  scale?: boolean; // Multiscale: halved damage while at full HP — chip it open first
  guts?: boolean; // Guts: statused hits harder — don't poison it, kill it clean
  absorb?: PokeType; // Water/Volt Absorb, Flash Fire: same-type hits heal it
  truant?: boolean; // Truant: fires then loafs a full round — huge stats, half the uptime
  boost?: boolean; // Speed Boost: every attack re-arms a touch faster — kill it early
  spore?: boolean; // Effect Spore: contact scatters a random ailment — poison, shock, or sleep
  sync?: boolean; // Synchronize: contact echoes its ailments back onto the striker
  pressure?: boolean; // Pressure: while it lives, bump supers charge at half speed
  beam?: boolean; // Signal Beam: locks a lane, telegraphs, then burns the channel
  trap?: boolean; // Arena Trap: the ball can't flee its neighborhood while it lives
  skyFor?: Weather; // Drought/Drizzle/Sand Stream: its arrival summons this sky
  counter?: boolean; // Counter: returns a third of contact damage to the striker
  alpha?: boolean; // pack leader: rallying cry — packmates hit harder while it lives
  shed?: boolean; // Shed Skin: each tick it may slough off every ailment
  charge?: boolean; // stampede: paws a beat, then rams across the court at a mon
  prank?: boolean; // Prankster: its opening attack comes early
  huge?: boolean; // Huge Power / Pure Power: doubled contact damage
  pheal?: boolean; // Poison Heal: venom ticks mend instead of bleed
  sleepless?: boolean; // Insomnia/Vital Spirit: sleep effects wash off
  pickup?: boolean; // Pickup: may nose out a bag consumable after each wave
  thickFat?: boolean; // Thick Fat: lava's bite lands at half heat
  limber?: boolean; // Limber: paralysis can't hold the limbs
  grace?: boolean; // Serene Grace: its contact abilities fire at double odds
  damp?: boolean; // Damp: while it lives, fuses fizzle and blasts soften
  blink?: boolean; // teleports mid-fight — a shimmer warns before it vanishes
  thief?: boolean; // drifts toward pickups and pockets them — KO it to re-drop
  lay?: boolean; // lobs spike patches into your half instead of attacking
  confuse?: boolean; // Supersonic: contact can rattle the striker's next aim
  anchor?: boolean; // too heavy to shove — knockback and blast leave it planted
  tempo?: boolean; // Own Tempo: it keeps its head — confusion can't stick
  shiny?: boolean; // alt-palette marker — draft picks and catches carry it
  lvl?: number; // level marker — draft picks roll 5-14, catches keep theirs
  luck?: number; // fusion count — absorbed dupes feed it; team luck pays in the loot fountain
  joined?: number; // waveIndex the species was fielded — bond credits stages it actually fought (draft picks leave it 0)
  evolvesTo?: number | number[]; // dex id(s) — an array asks the player to pick the branch
}

const st = (hp: number, atk: number, def: number, spa: number, spd: number, spe: number): Stats => ({
  hp, atk, def, spa, spd, spe,
});

// Draft pool: weak first-stagers only — the strong mons are caught mid-run.
// Magikarp/Feebas are the lottery tickets: terrible stats, monster evolutions.
export const ROSTER: SpeciesDef[] = [
  { id: 25, name: 'Pikachu', type: 'electric', stats: st(35, 55, 40, 50, 50, 90), pierce: true, shock: true, evolvesTo: 26 },
  { id: 4, name: 'Charmander', type: 'fire', stats: st(39, 52, 43, 60, 50, 65), evolvesTo: 5 },
  { id: 1, name: 'Bulbasaur', type: 'grass', type2: 'poison', stats: st(45, 49, 49, 65, 65, 45), healer: true, evolvesTo: 2 },
  { id: 7, name: 'Squirtle', type: 'water', stats: st(44, 48, 65, 50, 64, 43), evolvesTo: 8 },
  { id: 133, name: 'Eevee', type: 'normal', stats: st(55, 55, 50, 45, 65, 55), evolvesTo: [134, 135, 136, 196] },
  { id: 39, name: 'Jigglypuff', type: 'normal', stats: st(115, 45, 20, 45, 25, 20), healer: true, charm: true, evolvesTo: 40 },
  { id: 52, name: 'Meowth', type: 'normal', stats: st(40, 45, 35, 40, 40, 90), pierce: true, raider: true, pickup: true, evolvesTo: 53 },
  { id: 54, name: 'Psyduck', type: 'water', stats: st(50, 52, 48, 65, 50, 55), damp: true, evolvesTo: 55 },
  { id: 95, name: 'Onix', type: 'rock', stats: st(35, 45, 160, 30, 45, 70), evolvesTo: 208, sturdy: true },
  { id: 66, name: 'Machop', type: 'fighting', stats: st(70, 80, 50, 35, 35, 35), evolvesTo: 67, guts: true },
  { id: 132, name: 'Ditto', type: 'normal', stats: st(48, 48, 48, 48, 48, 48), copy: true },
  { id: 32, name: 'Nidoran♂', type: 'poison', stats: st(46, 57, 40, 40, 40, 50), evolvesTo: 33 },
  { id: 35, name: 'Clefairy', type: 'normal', stats: st(70, 45, 48, 60, 65, 35), healer: true, charm: true, evolvesTo: 36 },
  { id: 37, name: 'Vulpix', type: 'fire', stats: st(38, 41, 40, 50, 65, 65), evolvesTo: 38 },
  { id: 60, name: 'Poliwag', type: 'water', stats: st(40, 50, 40, 40, 40, 90), damp: true, evolvesTo: 61 },
  { id: 92, name: 'Gastly', type: 'ghost', type2: 'poison', stats: st(30, 35, 30, 100, 35, 80), pierce: true, evolvesTo: 93 },
  { id: 104, name: 'Cubone', type: 'rock', stats: st(50, 50, 95, 40, 50, 35), melee: true, evolvesTo: 105 },
  { id: 129, name: 'Magikarp', type: 'water', stats: st(20, 10, 55, 15, 20, 80), evolvesTo: 130 },
  { id: 179, name: 'Mareep', type: 'electric', stats: st(55, 40, 40, 65, 45, 35), evolvesTo: 180, shock: true },
  { id: 183, name: 'Marill', type: 'water', type2: 'normal', stats: st(70, 20, 50, 20, 50, 40), healer: true, evolvesTo: 184 },
  { id: 194, name: 'Wooper', type: 'water', type2: 'rock', stats: st(55, 45, 45, 25, 25, 15), damp: true, evolvesTo: 195 },
  { id: 280, name: 'Ralts', type: 'psychic', type2: 'normal', stats: st(28, 25, 25, 45, 35, 40), sync: true, evolvesTo: 281 },
  { id: 285, name: 'Shroomish', type: 'grass', stats: st(60, 40, 60, 40, 60, 35), evolvesTo: 286, pheal: true },
  { id: 293, name: 'Whismur', type: 'normal', stats: st(64, 51, 23, 51, 23, 28), evolvesTo: 294 },
  { id: 304, name: 'Aron', type: 'rock', stats: st(50, 70, 100, 40, 40, 30), evolvesTo: 305 },
  { id: 328, name: 'Trapinch', type: 'rock', stats: st(45, 100, 45, 45, 45, 10), evolvesTo: 329 },
  { id: 349, name: 'Feebas', type: 'water', stats: st(20, 15, 20, 10, 55, 80), evolvesTo: 350 },
  { id: 361, name: 'Snorunt', type: 'water', stats: st(50, 50, 50, 50, 50, 50), evolvesTo: [362, 478] },
  { id: 363, name: 'Spheal', type: 'water', stats: st(70, 40, 50, 55, 50, 25), evolvesTo: 364, thickFat: true },
  { id: 172, name: 'Pichu', type: 'electric', stats: st(20, 40, 15, 35, 35, 60), evolvesTo: 25 },
  { id: 174, name: 'Igglybuff', type: 'normal', stats: st(90, 30, 15, 40, 20, 15), healer: true, evolvesTo: 39 },
  { id: 191, name: 'Sunkern', type: 'grass', stats: st(30, 30, 30, 30, 30, 30), evolvesTo: 192 },
  { id: 209, name: 'Snubbull', type: 'normal', stats: st(60, 80, 50, 40, 40, 30), melee: true, menace: true, evolvesTo: 210 },
  { id: 223, name: 'Remoraid', type: 'water', stats: st(35, 65, 35, 65, 35, 65), pierce: true, evolvesTo: 224 },
  { id: 236, name: 'Tyrogue', type: 'fighting', stats: st(35, 35, 35, 35, 35, 35), melee: true, guts: true, evolvesTo: [106, 107, 237] },
  { id: 246, name: 'Larvitar', type: 'rock', stats: st(50, 64, 50, 45, 50, 41), melee: true, guts: true, evolvesTo: 247 },
  { id: 298, name: 'Azurill', type: 'normal', stats: st(50, 20, 40, 20, 40, 20), healer: true, evolvesTo: 183 },
  { id: 300, name: 'Skitty', type: 'normal', stats: st(50, 45, 45, 35, 35, 50), evolvesTo: 301, charm: true },
  { id: 307, name: 'Meditite', type: 'fighting', type2: 'psychic', stats: st(30, 40, 55, 40, 55, 60), melee: true, evolvesTo: 308 },
  { id: 325, name: 'Spoink', type: 'psychic', stats: st(60, 25, 35, 70, 80, 60), tempo: true, evolvesTo: 326 },
  { id: 360, name: 'Wynaut', type: 'psychic', stats: st(95, 23, 48, 23, 48, 23), evolvesTo: 202 },
  { id: 371, name: 'Bagon', type: 'flying', stats: st(45, 75, 60, 40, 30, 50), melee: true, evolvesTo: 372 },
  { id: 374, name: 'Beldum', type: 'psychic', stats: st(40, 55, 80, 35, 60, 30), evolvesTo: 375 },
  { id: 152, name: 'Chikorita', type: 'grass', stats: st(45, 49, 65, 49, 65, 45), healer: true, evolvesTo: 153 },
  { id: 155, name: 'Cyndaquil', type: 'fire', stats: st(39, 52, 43, 60, 50, 65), evolvesTo: 156 },
  { id: 158, name: 'Totodile', type: 'water', stats: st(50, 65, 64, 44, 48, 43), evolvesTo: 159 },
  { id: 252, name: 'Treecko', type: 'grass', stats: st(40, 45, 35, 65, 55, 70), evolvesTo: 253 },
  { id: 255, name: 'Torchic', type: 'fire', stats: st(45, 60, 40, 70, 50, 45), evolvesTo: 256 },
  { id: 258, name: 'Mudkip', type: 'water', stats: st(50, 70, 50, 50, 50, 40), damp: true, evolvesTo: 259 },
  { id: 173, name: 'Cleffa', type: 'normal', stats: st(50, 25, 28, 45, 55, 15), healer: true, evolvesTo: 35 },
  { id: 175, name: 'Togepi', type: 'normal', stats: st(35, 20, 65, 40, 65, 20), healer: true, grace: true, evolvesTo: 176 },
  { id: 161, name: 'Sentret', type: 'normal', stats: st(35, 46, 34, 35, 45, 20), evolvesTo: 162 },
  { id: 190, name: 'Aipom', type: 'normal', stats: st(55, 70, 55, 40, 55, 85), evolvesTo: 424, pickup: true },
  { id: 235, name: 'Smeargle', type: 'normal', stats: st(55, 20, 35, 20, 45, 75), copy: true },
  { id: 239, name: 'Elekid', type: 'electric', stats: st(45, 63, 37, 65, 55, 95), evolvesTo: 125, sleepless: true },
  { id: 238, name: 'Smoochum', type: 'psychic', type2: 'water', stats: st(45, 30, 15, 85, 65, 65), evolvesTo: 124 },
  { id: 23, name: 'Ekans', type: 'poison', stats: st(35, 60, 44, 40, 54, 55), evolvesTo: 24, menace: true },
  { id: 96, name: 'Drowzee', type: 'psychic', stats: st(60, 48, 45, 43, 90, 42), sleepy: true, sleepless: true, evolvesTo: 97 },
  { id: 83, name: "Farfetch'd", type: 'flying', type2: 'normal', stats: st(52, 90, 55, 58, 62, 60), melee: true },
  { id: 220, name: 'Swinub', type: 'water', type2: 'rock', stats: st(50, 50, 40, 30, 30, 50), evolvesTo: 221, thickFat: true },
  { id: 120, name: 'Staryu', type: 'water', stats: st(30, 45, 55, 70, 55, 85), evolvesTo: 121 },
  { id: 387, name: 'Turtwig', type: 'grass', stats: st(55, 68, 64, 45, 55, 31), healer: true, evolvesTo: 388 },
  { id: 390, name: 'Chimchar', type: 'fire', stats: st(44, 58, 44, 58, 44, 61), melee: true, evolvesTo: 391 },
  { id: 393, name: 'Piplup', type: 'water', stats: st(53, 51, 53, 61, 56, 40), evolvesTo: 394 },
  { id: 396, name: 'Starly', type: 'flying', stats: st(40, 55, 30, 30, 30, 60), melee: true, evolvesTo: 397 },
  { id: 399, name: 'Bidoof', type: 'normal', stats: st(59, 45, 40, 35, 40, 31), taunt: true, evolvesTo: 400 },
  { id: 403, name: 'Shinx', type: 'electric', stats: st(45, 65, 34, 40, 34, 45), melee: true, guts: true, evolvesTo: 404 },
  { id: 406, name: 'Budew', type: 'grass', stats: st(40, 30, 35, 50, 70, 55), evolvesTo: 315, toxic: true },
  { id: 408, name: 'Cranidos', type: 'rock', stats: st(67, 125, 40, 30, 30, 58), melee: true, evolvesTo: 409 },
  { id: 410, name: 'Shieldon', type: 'rock', stats: st(30, 42, 118, 42, 88, 30), shielded: true, evolvesTo: 411 },
  { id: 417, name: 'Pachirisu', type: 'electric', stats: st(60, 45, 70, 45, 90, 95), pierce: true, taunt: true },
  { id: 418, name: 'Buizel', type: 'water', stats: st(55, 65, 35, 60, 30, 85), pierce: true, evolvesTo: 419 },
  { id: 425, name: 'Drifloon', type: 'ghost', stats: st(90, 50, 34, 60, 44, 70), cursed: true, evolvesTo: 426 },
  { id: 427, name: 'Buneary', type: 'normal', stats: st(55, 66, 44, 44, 56, 85), pierce: true, limber: true, evolvesTo: 428 },
  { id: 431, name: 'Glameow', type: 'normal', stats: st(49, 55, 42, 42, 37, 85), evolvesTo: 432, limber: true },
  { id: 433, name: 'Chingling', type: 'psychic', stats: st(45, 30, 50, 65, 50, 45), healer: true, evolvesTo: 358 },
  { id: 436, name: 'Bronzor', type: 'rock', stats: st(57, 24, 86, 24, 86, 23), taunt: true, evolvesTo: 437 },
  { id: 438, name: 'Bonsly', type: 'rock', stats: st(50, 80, 95, 10, 45, 10), taunt: true, sturdy: true, evolvesTo: 185 },
  { id: 439, name: 'Mime Jr.', type: 'psychic', stats: st(20, 25, 45, 70, 90, 60), evolvesTo: 122 },
  { id: 440, name: 'Happiny', type: 'normal', stats: st(100, 5, 5, 15, 65, 30), healer: true, grace: true, evolvesTo: 113 },
  { id: 443, name: 'Gible', type: 'rock', stats: st(58, 70, 45, 40, 45, 42), melee: true, evolvesTo: 444 },
  { id: 446, name: 'Munchlax', type: 'normal', stats: st(135, 85, 40, 40, 85, 5), taunt: true, pickup: true, thickFat: true, evolvesTo: 143 },
  { id: 447, name: 'Riolu', type: 'fighting', stats: st(40, 70, 40, 35, 40, 60), melee: true, evolvesTo: 448 },
  { id: 451, name: 'Skorupi', type: 'poison', stats: st(40, 50, 90, 30, 55, 65), melee: true, evolvesTo: 452 },
  { id: 453, name: 'Croagunk', type: 'poison', stats: st(48, 61, 40, 61, 40, 50), melee: true, evolvesTo: 454 },
  { id: 456, name: 'Finneon', type: 'water', stats: st(49, 49, 56, 49, 61, 66), evolvesTo: 457 },
  { id: 458, name: 'Mantyke', type: 'water', stats: st(45, 20, 50, 60, 120, 50), evolvesTo: 226 },
  { id: 459, name: 'Snover', type: 'grass', stats: st(60, 62, 50, 62, 60, 40), evolvesTo: 460 },
  // --- gen 5 (unova) ---
  { id: 495, name: 'Snivy', type: 'grass', stats: st(45, 45, 55, 45, 55, 63), evolvesTo: 496 },
  { id: 498, name: 'Tepig', type: 'fire', stats: st(65, 63, 45, 45, 45, 45), evolvesTo: 499, melee: true },
  { id: 501, name: 'Oshawott', type: 'water', stats: st(55, 55, 45, 63, 45, 45), evolvesTo: 502 },
  { id: 504, name: 'Patrat', type: 'normal', stats: st(45, 55, 39, 35, 39, 42), evolvesTo: 505 },
  { id: 506, name: 'Lillipup', type: 'normal', stats: st(45, 60, 45, 25, 45, 55), evolvesTo: 507, pickup: true },
  { id: 509, name: 'Purrloin', type: 'ghost', stats: st(41, 50, 37, 50, 37, 66), evolvesTo: 510 },
  { id: 519, name: 'Pidove', type: 'normal', type2: 'flying', stats: st(50, 55, 50, 36, 30, 43), evolvesTo: 520 },
  { id: 529, name: 'Drilbur', type: 'rock', stats: st(60, 85, 40, 30, 45, 68), evolvesTo: 530, melee: true },
  { id: 532, name: 'Timburr', type: 'fighting', stats: st(75, 80, 55, 25, 35, 35), evolvesTo: 533, melee: true, guts: true },
  { id: 535, name: 'Tympole', type: 'water', stats: st(50, 50, 40, 50, 40, 64), evolvesTo: 536 },
  { id: 540, name: 'Sewaddle', type: 'grass', stats: st(45, 53, 70, 40, 60, 42), evolvesTo: 541 },
  { id: 543, name: 'Venipede', type: 'grass', type2: 'poison', stats: st(30, 45, 59, 30, 39, 57), evolvesTo: 544, toxic: true },
  { id: 546, name: 'Cottonee', type: 'grass', type2: 'normal', stats: st(40, 27, 60, 37, 50, 66), evolvesTo: 547 },
  { id: 548, name: 'Petilil', type: 'grass', stats: st(45, 35, 50, 70, 50, 30), evolvesTo: 549 },
  { id: 551, name: 'Sandile', type: 'rock', type2: 'ghost', stats: st(50, 72, 35, 35, 35, 65), evolvesTo: 552, melee: true },
  { id: 554, name: 'Darumaka', type: 'fire', stats: st(70, 90, 45, 15, 45, 50), evolvesTo: 555 },
  { id: 557, name: 'Dwebble', type: 'grass', type2: 'rock', stats: st(50, 65, 85, 35, 35, 55), evolvesTo: 558 },
  { id: 559, name: 'Scraggy', type: 'ghost', type2: 'fighting', stats: st(50, 75, 70, 35, 70, 48), evolvesTo: 560, melee: true },
  { id: 562, name: 'Yamask', type: 'ghost', stats: st(38, 30, 85, 55, 65, 30), evolvesTo: 563, cursed: true },
  { id: 568, name: 'Trubbish', type: 'poison', stats: st(50, 50, 62, 40, 62, 65), evolvesTo: 569 },
  { id: 570, name: 'Zorua', type: 'ghost', stats: st(40, 65, 40, 80, 40, 65), evolvesTo: 571 },
  { id: 572, name: 'Minccino', type: 'normal', stats: st(55, 50, 40, 40, 40, 75), evolvesTo: 573 },
  { id: 574, name: 'Gothita', type: 'psychic', stats: st(45, 30, 50, 55, 65, 45), evolvesTo: 575 },
  { id: 577, name: 'Solosis', type: 'psychic', stats: st(45, 30, 40, 105, 50, 20), evolvesTo: 578 },
  { id: 580, name: 'Ducklett', type: 'water', type2: 'flying', stats: st(62, 44, 50, 44, 50, 55), evolvesTo: 581 },
  { id: 585, name: 'Deerling', type: 'normal', type2: 'grass', stats: st(60, 60, 50, 40, 50, 75), evolvesTo: 586 },
  { id: 587, name: 'Emolga', type: 'electric', type2: 'flying', stats: st(55, 75, 60, 75, 60, 103), shock: true },
  { id: 590, name: 'Foongus', type: 'grass', type2: 'poison', stats: st(69, 55, 45, 55, 55, 15), evolvesTo: 591, spore: true },
  { id: 592, name: 'Frillish', type: 'water', type2: 'ghost', stats: st(55, 40, 50, 65, 85, 40), evolvesTo: 593, cursed: true },
  { id: 595, name: 'Joltik', type: 'grass', type2: 'electric', stats: st(50, 47, 50, 57, 50, 65), evolvesTo: 596 },
  { id: 599, name: 'Klink', type: 'rock', stats: st(40, 55, 70, 45, 60, 30), split: true, evolvesTo: 600 },
  { id: 602, name: 'Tynamo', type: 'electric', stats: st(35, 55, 40, 45, 40, 60), evolvesTo: 603 },
  { id: 605, name: 'Elgyem', type: 'psychic', stats: st(55, 55, 55, 85, 55, 30), evolvesTo: 606 },
  { id: 607, name: 'Litwick', type: 'ghost', type2: 'fire', stats: st(50, 30, 55, 65, 55, 20), evolvesTo: 608, cursed: true, flame: true },
  { id: 610, name: 'Axew', type: 'flying', stats: st(46, 87, 60, 30, 40, 57), evolvesTo: 611, melee: true },
  { id: 613, name: 'Cubchoo', type: 'water', stats: st(55, 70, 40, 60, 40, 40), evolvesTo: 614, melee: true },
  { id: 616, name: 'Shelmet', type: 'grass', stats: st(50, 40, 85, 40, 65, 25), evolvesTo: 617 },
  { id: 619, name: 'Mienfoo', type: 'fighting', stats: st(45, 85, 50, 55, 50, 65), evolvesTo: 620, melee: true },
  { id: 622, name: 'Golett', type: 'rock', type2: 'ghost', stats: st(59, 74, 50, 35, 50, 35), evolvesTo: 623, melee: true, cursed: true },
  { id: 624, name: 'Pawniard', type: 'ghost', type2: 'rock', stats: st(45, 85, 70, 40, 40, 60), evolvesTo: 625, melee: true },
  { id: 627, name: 'Rufflet', type: 'normal', type2: 'flying', stats: st(70, 83, 50, 37, 50, 60), evolvesTo: 628, melee: true },
  { id: 629, name: 'Vullaby', type: 'ghost', type2: 'flying', stats: st(70, 55, 75, 45, 65, 60), evolvesTo: 630 },
  { id: 633, name: 'Deino', type: 'ghost', type2: 'flying', stats: st(52, 65, 50, 45, 50, 38), evolvesTo: 634, melee: true },
  { id: 636, name: 'Larvesta', type: 'grass', type2: 'fire', stats: st(55, 85, 55, 50, 55, 60), evolvesTo: 637, flame: true },

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

// Fodder first, the gym leaders last — one per PokeType; pools below slice
// on that. Every leader is themed to a badge (BADGES in meta.ts).
// 'Ground-ish' mons (Diglett, Cubone, Rhyhorn, ...) ride the rock type —
// PokeType has no ground.
export const ENEMY_DB: SpeciesDef[] = [
  { id: 19, name: 'Rattata', type: 'normal', stats: st(30, 56, 35, 25, 35, 72), melee: true, raider: true, evolvesTo: 20 },
  { id: 16, name: 'Pidgey', type: 'flying', type2: 'normal', stats: st(40, 45, 40, 35, 35, 56), melee: true, evolvesTo: 17 },
  { id: 41, name: 'Zubat', type: 'poison', type2: 'flying', stats: st(40, 45, 35, 30, 40, 55), melee: true, summon: true, evolvesTo: 42 },
  { id: 74, name: 'Geodude', type: 'rock', stats: st(40, 80, 100, 30, 30, 20), sturdy: true, evolvesTo: 75 },
  { id: 81, name: 'Magnemite', type: 'electric', stats: st(25, 35, 70, 95, 55, 45), repel: true, evolvesTo: 82 },
  { id: 63, name: 'Abra', type: 'psychic', stats: st(25, 20, 15, 105, 55, 90), blink: true, evolvesTo: 64 },
  { id: 43, name: 'Oddish', type: 'grass', type2: 'poison', stats: st(45, 50, 55, 75, 65, 30), drowsy: true, evolvesTo: 44 },
  { id: 92, name: 'Gastly', type: 'ghost', type2: 'poison', stats: st(30, 35, 30, 100, 35, 80), confuse: true, evolvesTo: 93 },
  { id: 66, name: 'Machop', type: 'fighting', stats: st(70, 80, 50, 35, 35, 35), melee: true, evolvesTo: 67 },
  { id: 21, name: 'Spearow', type: 'flying', type2: 'normal', stats: st(40, 60, 30, 31, 31, 70), melee: true, evolvesTo: 22 },
  { id: 163, name: 'Hoothoot', type: 'flying', type2: 'normal', stats: st(60, 30, 30, 36, 56, 50), melee: true, evolvesTo: 164 },
  { id: 46, name: 'Paras', type: 'grass', type2: 'poison', stats: st(35, 70, 55, 45, 55, 25), melee: true, leech: true, evolvesTo: 47 },
  { id: 48, name: 'Venonat', type: 'poison', stats: st(60, 55, 50, 40, 55, 45), evolvesTo: 49 },
  { id: 69, name: 'Bellsprout', type: 'grass', type2: 'poison', stats: st(50, 75, 35, 70, 30, 40), evolvesTo: 70 },
  { id: 102, name: 'Exeggcute', type: 'grass', type2: 'psychic', stats: st(60, 40, 80, 60, 45, 40), split: true, evolvesTo: 103 },
  { id: 50, name: 'Diglett', type: 'rock', stats: st(10, 55, 25, 35, 45, 95), melee: true, trap: true, evolvesTo: 51 },
  { id: 104, name: 'Cubone', type: 'rock', stats: st(50, 50, 95, 40, 50, 35), melee: true, evolvesTo: 105 },
  { id: 56, name: 'Mankey', type: 'fighting', stats: st(40, 80, 35, 35, 45, 70), melee: true, rage: true, evolvesTo: 57 },
  { id: 88, name: 'Grimer', type: 'poison', stats: st(80, 80, 50, 40, 50, 25), melee: true, evolvesTo: 89 },
  { id: 109, name: 'Koffing', type: 'poison', stats: st(40, 65, 95, 60, 45, 35), fuse: true, evolvesTo: 110 },
  { id: 37, name: 'Vulpix', type: 'fire', stats: st(38, 41, 40, 50, 65, 65), burn: true, evolvesTo: 38 },
  { id: 58, name: 'Growlithe', type: 'fire', stats: st(55, 70, 45, 70, 50, 60), melee: true, burn: true, evolvesTo: 59 },
  { id: 77, name: 'Ponyta', type: 'fire', stats: st(50, 85, 55, 65, 65, 90), flame: true, evolvesTo: 78 },
  { id: 126, name: 'Magmar', type: 'fire', stats: st(65, 95, 57, 100, 85, 93), burn: true, flame: true, evolvesTo: 467 },
  { id: 218, name: 'Slugma', type: 'fire', type2: 'rock', stats: st(40, 40, 40, 70, 40, 20), flame: true, evolvesTo: 219 },
  { id: 111, name: 'Rhyhorn', type: 'rock', stats: st(80, 85, 95, 30, 30, 25), melee: true, evolvesTo: 112 },
  { id: 100, name: 'Voltorb', type: 'electric', stats: st(40, 30, 50, 55, 55, 100), fuse: true, evolvesTo: 101 },
  { id: 170, name: 'Chinchou', type: 'electric', type2: 'water', stats: st(75, 38, 38, 56, 56, 67), para: true, evolvesTo: 171 },
  { id: 72, name: 'Tentacool', type: 'water', type2: 'poison', stats: st(40, 40, 35, 50, 100, 70), summon: true, evolvesTo: 73 },
  { id: 84, name: 'Doduo', type: 'flying', type2: 'normal', stats: st(35, 85, 45, 35, 35, 75), melee: true, split: true, evolvesTo: 85 },
  { id: 278, name: 'Wingull', type: 'flying', type2: 'water', stats: st(40, 30, 30, 55, 30, 85), melee: true, evolvesTo: 279 },
  { id: 333, name: 'Swablu', type: 'flying', type2: 'normal', stats: st(45, 40, 60, 40, 75, 50), melee: true, evolvesTo: 334 },
  { id: 98, name: 'Krabby', type: 'water', stats: st(30, 105, 90, 25, 25, 50), melee: true, evolvesTo: 99 },
  { id: 118, name: 'Goldeen', type: 'water', stats: st(45, 67, 60, 35, 50, 63), evolvesTo: 119 },
  { id: 79, name: 'Slowpoke', type: 'psychic', type2: 'water', stats: st(90, 65, 65, 40, 40, 15), sleepy: true, evolvesTo: [80, 199] },
  { id: 108, name: 'Lickitung', type: 'normal', stats: st(90, 55, 75, 60, 75, 30), melee: true, evolvesTo: 463 },
  { id: 128, name: 'Tauros', type: 'normal', stats: st(75, 100, 95, 40, 70, 110), melee: true, rage: true, charge: true },
  { id: 137, name: 'Porygon', type: 'normal', stats: st(65, 60, 70, 85, 75, 40), beam: true },
  { id: 138, name: 'Omanyte', type: 'water', type2: 'rock', stats: st(35, 40, 100, 90, 55, 35), evolvesTo: 139 },
  { id: 140, name: 'Kabuto', type: 'rock', type2: 'water', stats: st(30, 80, 90, 55, 45, 55), evolvesTo: 141 },
  { id: 147, name: 'Dratini', type: 'flying', stats: st(41, 64, 45, 50, 50, 50), evolvesTo: 148 },
  { id: 177, name: 'Natu', type: 'flying', type2: 'psychic', stats: st(40, 50, 45, 70, 45, 70), blink: true, evolvesTo: 178 },
  { id: 198, name: 'Murkrow', type: 'ghost', type2: 'flying', stats: st(60, 85, 42, 85, 42, 91), melee: true, evolvesTo: 430, prank: true },
  { id: 200, name: 'Misdreavus', type: 'ghost', stats: st(60, 60, 60, 85, 85, 85), pierce: true, evolvesTo: 429 },
  { id: 216, name: 'Teddiursa', type: 'normal', stats: st(60, 80, 50, 50, 50, 40), melee: true, evolvesTo: 217 },
  { id: 228, name: 'Houndour', type: 'fire', type2: 'ghost', stats: st(45, 60, 30, 80, 50, 65), evolvesTo: 229 },
  { id: 231, name: 'Phanpy', type: 'rock', stats: st(90, 60, 60, 40, 40, 40), melee: true, evolvesTo: 232 },
  { id: 261, name: 'Poochyena', type: 'ghost', stats: st(35, 55, 35, 30, 30, 35), melee: true, hunter: true, evolvesTo: 262 },
  { id: 263, name: 'Zigzagoon', type: 'normal', stats: st(38, 30, 41, 30, 41, 60), melee: true, raider: true, evolvesTo: 264 },
  { id: 270, name: 'Lotad', type: 'grass', type2: 'water', stats: st(40, 30, 30, 40, 50, 30), evolvesTo: 271 },
  { id: 273, name: 'Seedot', type: 'grass', type2: 'ghost', stats: st(40, 40, 50, 30, 30, 30), evolvesTo: 274 },
  { id: 276, name: 'Taillow', type: 'flying', type2: 'normal', stats: st(40, 55, 30, 30, 30, 85), melee: true, evolvesTo: 277 },
  { id: 296, name: 'Makuhita', type: 'fighting', stats: st(72, 60, 30, 20, 30, 25), melee: true, evolvesTo: 297 },
  { id: 309, name: 'Electrike', type: 'electric', stats: st(40, 45, 40, 65, 40, 65), para: true, evolvesTo: 310 },
  { id: 318, name: 'Carvanha', type: 'water', type2: 'ghost', stats: st(45, 90, 20, 65, 20, 65), melee: true, evolvesTo: 319 },
  { id: 331, name: 'Cacnea', type: 'grass', type2: 'ghost', stats: st(50, 85, 40, 85, 40, 35), lay: true, evolvesTo: 332 },
  { id: 341, name: 'Corphish', type: 'water', stats: st(43, 80, 65, 50, 35, 35), melee: true, evolvesTo: 342 },
  { id: 353, name: 'Shuppet', type: 'ghost', stats: st(44, 75, 35, 63, 33, 45), pierce: true, evolvesTo: 354 },
  { id: 355, name: 'Duskull', type: 'ghost', stats: st(20, 40, 90, 30, 90, 25), evolvesTo: 356 },
  { id: 10, name: 'Caterpie', type: 'grass', stats: st(45, 30, 35, 20, 20, 45), melee: true, evolvesTo: 11 },
  { id: 13, name: 'Weedle', type: 'poison', stats: st(40, 35, 30, 20, 20, 50), melee: true, venom: true, evolvesTo: 14 },
  { id: 27, name: 'Sandshrew', type: 'rock', stats: st(50, 75, 85, 20, 30, 40), melee: true, evolvesTo: 28 },
  { id: 29, name: 'Nidoran♀', type: 'poison', stats: st(55, 47, 52, 40, 40, 41), toxic: true, evolvesTo: 30 },
  { id: 86, name: 'Seel', type: 'water', stats: st(65, 45, 55, 45, 70, 45), evolvesTo: 87 },
  { id: 90, name: 'Shellder', type: 'water', stats: st(30, 65, 100, 45, 25, 40), shielded: true, evolvesTo: 91 },
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
  { id: 299, name: 'Nosepass', type: 'rock', stats: st(30, 45, 135, 45, 90, 30), repel: true, evolvesTo: 476 },
  { id: 302, name: 'Sableye', type: 'ghost', stats: st(50, 75, 75, 65, 65, 50), melee: true, prank: true },
  { id: 313, name: 'Volbeat', type: 'grass', stats: st(65, 73, 55, 47, 75, 85) },
  { id: 314, name: 'Illumise', type: 'grass', stats: st(65, 47, 55, 73, 75, 85) },
  { id: 315, name: 'Roselia', type: 'grass', stats: st(50, 60, 45, 100, 80, 65), healer: true, evolvesTo: 407 },
  { id: 322, name: 'Numel', type: 'fire', type2: 'rock', stats: st(60, 60, 40, 65, 45, 35), evolvesTo: 323 },
  { id: 324, name: 'Torkoal', type: 'fire', stats: st(70, 85, 140, 85, 70, 20), sturdy: true, skyFor: 'sun' },
  { id: 337, name: 'Lunatone', type: 'psychic', type2: 'rock', stats: st(90, 55, 65, 95, 85, 70), pierce: true },
  { id: 338, name: 'Solrock', type: 'psychic', type2: 'rock', stats: st(90, 95, 85, 55, 65, 70), melee: true },
  { id: 343, name: 'Baltoy', type: 'rock', type2: 'psychic', stats: st(40, 40, 55, 40, 70, 55), evolvesTo: 344 },
  { id: 345, name: 'Lileep', type: 'grass', type2: 'rock', stats: st(66, 41, 77, 61, 87, 23), evolvesTo: 346 },
  { id: 347, name: 'Anorith', type: 'rock', stats: st(45, 95, 50, 40, 50, 75), melee: true, evolvesTo: 348 },
  { id: 357, name: 'Tropius', type: 'grass', type2: 'flying', stats: st(99, 68, 83, 72, 87, 51) },
  { id: 366, name: 'Clamperl', type: 'water', stats: st(35, 64, 85, 74, 55, 32), evolvesTo: [367, 368] },
  { id: 370, name: 'Luvdisc', type: 'water', stats: st(43, 30, 55, 40, 65, 97), healer: true },
  { id: 24, name: 'Arbok', type: 'poison', stats: st(60, 95, 69, 65, 79, 80), venom: true },
  { id: 97, name: 'Hypno', type: 'psychic', stats: st(85, 73, 70, 73, 115, 67), sleepy: true },
  { id: 124, name: 'Jynx', type: 'psychic', type2: 'water', stats: st(65, 50, 35, 115, 95, 95) },
  { id: 114, name: 'Tangela', type: 'grass', stats: st(65, 55, 115, 100, 40, 60), regen: true, evolvesTo: 465 },
  { id: 162, name: 'Furret', type: 'normal', stats: st(85, 76, 64, 45, 55, 90) },
  { id: 185, name: 'Sudowoodo', type: 'rock', stats: st(70, 100, 115, 30, 65, 30), taunt: true },
  { id: 201, name: 'Unown', type: 'psychic', stats: st(48, 72, 48, 72, 48, 48) },
  { id: 203, name: 'Girafarig', type: 'psychic', type2: 'normal', stats: st(70, 80, 65, 90, 65, 85) },
  { id: 204, name: 'Pineco', type: 'poison', stats: st(50, 65, 90, 35, 35, 15), shielded: true, evolvesTo: 205 },
  { id: 211, name: 'Qwilfish', type: 'water', type2: 'poison', stats: st(65, 95, 85, 55, 55, 85), spiky: true },
  { id: 213, name: 'Shuckle', type: 'rock', stats: st(20, 10, 230, 10, 230, 5), taunt: true },
  { id: 215, name: 'Sneasel', type: 'ghost', type2: 'water', stats: st(55, 95, 55, 35, 75, 115), pierce: true, melee: true, evolvesTo: 461 },
  { id: 234, name: 'Stantler', type: 'normal', stats: st(73, 95, 62, 85, 65, 85) },
  { id: 264, name: 'Linoone', type: 'normal', stats: st(78, 70, 61, 50, 61, 100), raider: true, thief: true },
  { id: 268, name: 'Cascoon', type: 'poison', stats: st(50, 35, 55, 25, 25, 15), evolvesTo: 269 },
  { id: 269, name: 'Dustox', type: 'poison', stats: st(60, 50, 70, 50, 90, 65) },
  { id: 272, name: 'Ludicolo', type: 'water', type2: 'grass', stats: st(80, 70, 70, 90, 100, 70) },
  { id: 275, name: 'Shiftry', type: 'grass', type2: 'ghost', stats: st(90, 100, 60, 90, 60, 80) },
  { id: 287, name: 'Slakoth', type: 'normal', stats: st(60, 60, 60, 35, 35, 30), sleepy: true, evolvesTo: 288 },
  { id: 288, name: 'Vigoroth', type: 'normal', stats: st(80, 80, 80, 55, 55, 90), melee: true, evolvesTo: 289 },
  { id: 290, name: 'Nincada', type: 'rock', stats: st(31, 45, 90, 30, 30, 40), evolvesTo: 291 },
  { id: 291, name: 'Ninjask', type: 'flying', stats: st(61, 90, 45, 50, 50, 160), pierce: true },
  { id: 292, name: 'Shedinja', type: 'ghost', stats: st(1, 90, 45, 30, 30, 40), cursed: true, wguard: true },
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
  { id: 415, name: 'Combee', type: 'flying', stats: st(30, 30, 42, 30, 42, 70), split: true, evolvesTo: 416 },
  { id: 416, name: 'Vespiquen', type: 'flying', stats: st(70, 80, 102, 80, 102, 40), alpha: true },
  { id: 420, name: 'Cherubi', type: 'grass', stats: st(45, 35, 45, 62, 53, 35), evolvesTo: 421 },
  { id: 421, name: 'Cherrim', type: 'grass', stats: st(70, 60, 70, 87, 78, 85) },
  { id: 422, name: 'Shellos', type: 'water', type2: 'rock', stats: st(76, 48, 48, 57, 62, 34), evolvesTo: 423 },
  { id: 423, name: 'Gastrodon', type: 'water', type2: 'rock', stats: st(111, 83, 68, 92, 82, 39), regen: true },
  { id: 434, name: 'Stunky', type: 'poison', type2: 'ghost', stats: st(63, 63, 47, 41, 41, 74), evolvesTo: 435 },
  { id: 441, name: 'Chatot', type: 'flying', type2: 'normal', stats: st(76, 65, 45, 92, 42, 91) },
  { id: 449, name: 'Hippopotas', type: 'rock', stats: st(68, 72, 78, 38, 42, 32), evolvesTo: 450 },
  { id: 455, name: 'Carnivine', type: 'grass', stats: st(74, 100, 72, 90, 72, 46) },
  { id: 457, name: 'Lumineon', type: 'water', stats: st(69, 69, 76, 69, 86, 91) },
  // --- gen 5 fodder ---
  { id: 511, name: 'Pansage', type: 'grass', stats: st(50, 53, 48, 53, 48, 64), evolvesTo: 512 },
  { id: 513, name: 'Pansear', type: 'fire', stats: st(50, 53, 48, 53, 48, 64), evolvesTo: 514 },
  { id: 515, name: 'Panpour', type: 'water', stats: st(50, 53, 48, 53, 48, 64), evolvesTo: 516 },
  { id: 517, name: 'Munna', type: 'psychic', stats: st(76, 25, 45, 67, 55, 24), evolvesTo: 518 },
  { id: 522, name: 'Blitzle', type: 'electric', stats: st(45, 60, 32, 50, 32, 76), evolvesTo: 523 },
  { id: 524, name: 'Roggenrola', type: 'rock', stats: st(55, 75, 85, 25, 25, 15), evolvesTo: 525 },
  { id: 527, name: 'Woobat', type: 'psychic', type2: 'flying', stats: st(65, 45, 43, 55, 43, 72), evolvesTo: 528 },
  { id: 531, name: 'Audino', type: 'normal', stats: st(103, 60, 86, 60, 86, 50), healer: true },
  { id: 538, name: 'Throh', type: 'fighting', stats: st(120, 100, 85, 30, 85, 45), melee: true },
  { id: 539, name: 'Sawk', type: 'fighting', stats: st(75, 125, 75, 30, 75, 85), melee: true },
  { id: 550, name: 'Basculin', type: 'water', stats: st(70, 92, 65, 80, 55, 98) },
  { id: 556, name: 'Maractus', type: 'grass', stats: st(75, 86, 67, 106, 67, 60), spiky: true },
  { id: 561, name: 'Sigilyph', type: 'psychic', type2: 'flying', stats: st(72, 58, 80, 103, 80, 97), pierce: true },
  { id: 564, name: 'Tirtouga', type: 'water', type2: 'rock', stats: st(54, 78, 103, 53, 45, 22), evolvesTo: 565 },
  { id: 566, name: 'Archen', type: 'rock', type2: 'flying', stats: st(55, 112, 45, 74, 45, 70), evolvesTo: 567 },
  { id: 582, name: 'Vanillite', type: 'water', stats: st(36, 50, 50, 65, 60, 44), evolvesTo: 583 },
  { id: 588, name: 'Karrablast', type: 'grass', stats: st(50, 75, 45, 40, 45, 60), evolvesTo: 589 },
  { id: 594, name: 'Alomomola', type: 'water', stats: st(165, 75, 80, 40, 45, 65), healer: true, regen: true },
  { id: 597, name: 'Ferroseed', type: 'grass', type2: 'rock', stats: st(44, 50, 91, 24, 86, 10), spiky: true, shielded: true, evolvesTo: 598 },
  { id: 615, name: 'Cryogonal', type: 'water', stats: st(80, 50, 50, 95, 135, 105), pierce: true },
  { id: 618, name: 'Stunfisk', type: 'rock', type2: 'electric', stats: st(109, 66, 84, 81, 99, 32), taunt: true },
  { id: 621, name: 'Druddigon', type: 'flying', stats: st(77, 120, 90, 60, 90, 48), melee: true },
  { id: 626, name: 'Bouffalant', type: 'normal', stats: st(95, 110, 95, 40, 95, 55), melee: true, charge: true },
  { id: 631, name: 'Heatmor', type: 'fire', stats: st(85, 97, 66, 105, 66, 65), taunt: true },
  { id: 632, name: 'Durant', type: 'grass', type2: 'rock', stats: st(58, 109, 112, 48, 48, 109), truant: true },
  { id: 132, name: 'Ditto', type: 'normal', stats: st(48, 48, 48, 48, 48, 48), mirror: true },
  { id: 150, name: 'Mewtwo', type: 'psychic', stats: st(106, 110, 90, 154, 90, 130) },
  { id: 130, name: 'Gyarados', type: 'water', type2: 'flying', stats: st(95, 125, 79, 60, 100, 81), rage: true },
  { id: 149, name: 'Dragonite', type: 'flying', stats: st(91, 134, 95, 100, 100, 80), scale: true },
  { id: 6, name: 'Charizard', type: 'fire', type2: 'flying', stats: st(78, 84, 78, 109, 85, 100) },
  { id: 3, name: 'Venusaur', type: 'grass', type2: 'poison', stats: st(80, 82, 83, 100, 100, 80), healer: true },
  { id: 94, name: 'Gengar', type: 'ghost', type2: 'poison', stats: st(60, 65, 60, 130, 75, 110), pierce: true },
  { id: 125, name: 'Electabuzz', type: 'electric', stats: st(65, 83, 57, 95, 85, 105), shock: true },
  { id: 112, name: 'Rhydon', type: 'rock', stats: st(105, 130, 120, 45, 45, 40), melee: true },
  { id: 289, name: 'Slaking', type: 'normal', stats: st(150, 160, 100, 95, 65, 100), taunt: true, truant: true },
  { id: 110, name: 'Weezing', type: 'poison', stats: st(65, 90, 120, 85, 70, 60), split: true },
  { id: 297, name: 'Hariyama', type: 'fighting', stats: st(144, 120, 60, 40, 60, 50), melee: true },
];

// Capturable elites: evolved mons that only appear on later waves — the
// reason to keep pushing into deeper depths.
export const ELITES: SpeciesDef[] = [
  { id: 94, name: 'Gengar', type: 'ghost', type2: 'poison', stats: st(60, 65, 60, 130, 75, 110), pierce: true, cursed: true },
  { id: 143, name: 'Snorlax', type: 'normal', stats: st(160, 110, 65, 65, 110, 30), taunt: true, anchor: true },
  { id: 68, name: 'Machamp', type: 'fighting', stats: st(90, 130, 80, 65, 85, 55), melee: true, guts: true },
  { id: 59, name: 'Arcanine', type: 'fire', stats: st(90, 110, 80, 100, 80, 95), menace: true },
  { id: 9, name: 'Blastoise', type: 'water', stats: st(79, 83, 100, 85, 105, 78) },
  { id: 3, name: 'Venusaur', type: 'grass', type2: 'poison', stats: st(80, 82, 83, 100, 100, 80), healer: true },
  { id: 65, name: 'Alakazam', type: 'psychic', stats: st(55, 50, 45, 135, 95, 120), pierce: true, blink: true },
  { id: 131, name: 'Lapras', type: 'water', stats: st(130, 85, 80, 85, 95, 60), healer: true },
  { id: 76, name: 'Golem', type: 'rock', stats: st(80, 120, 130, 55, 65, 45) },
  { id: 34, name: 'Nidoking', type: 'poison', type2: 'rock', stats: st(81, 102, 77, 85, 75, 85), melee: true, toxic: true },
  { id: 125, name: 'Electabuzz', type: 'electric', stats: st(65, 83, 57, 95, 85, 105), evolvesTo: 466 },
  { id: 135, name: 'Jolteon', type: 'electric', stats: st(65, 65, 60, 110, 95, 130), pierce: true },
  { id: 142, name: 'Aerodactyl', type: 'rock', type2: 'flying', stats: st(80, 105, 65, 60, 75, 130), melee: true },
  { id: 169, name: 'Crobat', type: 'poison', type2: 'flying', stats: st(85, 90, 80, 70, 80, 130), melee: true },
  { id: 123, name: 'Scyther', type: 'flying', stats: st(70, 110, 80, 55, 80, 105), pierce: true, melee: true },
  { id: 113, name: 'Chansey', type: 'normal', stats: st(250, 5, 5, 35, 105, 50), healer: true, evolvesTo: 242 },
  { id: 115, name: 'Kangaskhan', type: 'normal', stats: st(105, 95, 80, 40, 80, 90), taunt: true },
  { id: 134, name: 'Vaporeon', type: 'water', stats: st(130, 65, 60, 110, 95, 65), healer: true, absorb: 'water' },
  { id: 136, name: 'Flareon', type: 'fire', stats: st(65, 130, 60, 95, 110, 65), melee: true, absorb: 'fire' },
  { id: 154, name: 'Meganium', type: 'grass', stats: st(80, 82, 100, 83, 100, 80), healer: true },
  { id: 157, name: 'Typhlosion', type: 'fire', stats: st(78, 84, 78, 109, 85, 100) },
  { id: 160, name: 'Feraligatr', type: 'water', stats: st(85, 105, 100, 79, 83, 78), melee: true },
  { id: 181, name: 'Ampharos', type: 'electric', stats: st(90, 75, 85, 115, 90, 55) },
  { id: 196, name: 'Espeon', type: 'psychic', stats: st(65, 65, 60, 130, 95, 110), pierce: true, sync: true },
  { id: 197, name: 'Umbreon', type: 'ghost', stats: st(95, 65, 110, 60, 130, 65), taunt: true },
  { id: 212, name: 'Scizor', type: 'fighting', stats: st(70, 130, 100, 55, 80, 65), pierce: true, melee: true },
  { id: 229, name: 'Houndoom', type: 'fire', type2: 'ghost', stats: st(75, 90, 50, 110, 80, 95) },
  { id: 257, name: 'Blaziken', type: 'fire', type2: 'fighting', stats: st(80, 120, 70, 110, 70, 80), melee: true, boost: true },
  { id: 282, name: 'Gardevoir', type: 'psychic', type2: 'normal', stats: st(68, 65, 65, 125, 115, 80), healer: true },
  { id: 289, name: 'Slaking', type: 'normal', stats: st(150, 160, 100, 95, 65, 100), taunt: true, truant: true },
  { id: 306, name: 'Aggron', type: 'rock', stats: st(70, 110, 180, 60, 60, 50), melee: true, anchor: true },
  { id: 350, name: 'Milotic', type: 'water', stats: st(95, 60, 79, 100, 125, 81), healer: true, charm: true },
  { id: 373, name: 'Salamence', type: 'flying', stats: st(95, 135, 80, 110, 80, 100), melee: true, menace: true },
  { id: 121, name: 'Starmie', type: 'water', type2: 'psychic', stats: st(60, 75, 85, 100, 85, 115), pierce: true },
  { id: 122, name: 'Mr. Mime', type: 'psychic', stats: st(40, 45, 65, 100, 120, 90), taunt: true },
  { id: 127, name: 'Pinsir', type: 'fighting', stats: st(65, 125, 100, 55, 70, 85), melee: true },
  { id: 186, name: 'Politoed', type: 'water', stats: st(90, 75, 75, 90, 100, 70), healer: true, skyFor: 'rain' },
  { id: 202, name: 'Wobbuffet', type: 'psychic', stats: st(190, 33, 58, 33, 58, 33), taunt: true, counter: true },
  { id: 210, name: 'Granbull', type: 'normal', stats: st(90, 120, 75, 60, 60, 45), melee: true },
  { id: 214, name: 'Heracross', type: 'fighting', stats: st(80, 125, 75, 40, 95, 85), melee: true, guts: true },
  { id: 230, name: 'Kingdra', type: 'water', type2: 'flying', stats: st(75, 95, 95, 95, 95, 85), pierce: true },
  { id: 241, name: 'Miltank', type: 'normal', stats: st(95, 80, 105, 40, 70, 100), healer: true },
  { id: 242, name: 'Blissey', type: 'normal', stats: st(255, 10, 10, 75, 135, 55), healer: true },
  { id: 248, name: 'Tyranitar', type: 'rock', type2: 'ghost', stats: st(100, 134, 110, 95, 100, 61), melee: true, skyFor: 'sand' },
  { id: 295, name: 'Exploud', type: 'normal', stats: st(104, 91, 63, 91, 73, 68) },
  { id: 336, name: 'Seviper', type: 'poison', stats: st(73, 100, 60, 100, 60, 65), melee: true, shed: true },
  { id: 359, name: 'Absol', type: 'ghost', stats: st(65, 130, 60, 75, 60, 75), melee: true },
  { id: 365, name: 'Walrein', type: 'water', stats: st(110, 80, 90, 95, 90, 65) },
  { id: 376, name: 'Metagross', type: 'psychic', stats: st(80, 135, 130, 95, 90, 70), melee: true },
  { id: 254, name: 'Sceptile', type: 'grass', stats: st(70, 85, 65, 105, 85, 120), pierce: true },
  { id: 260, name: 'Swampert', type: 'water', type2: 'rock', stats: st(100, 110, 90, 85, 90, 60), melee: true },
  { id: 182, name: 'Bellossom', type: 'grass', stats: st(75, 80, 95, 90, 100, 50), healer: true },
  { id: 199, name: 'Slowking', type: 'psychic', type2: 'water', stats: st(95, 75, 80, 100, 110, 30), regen: true },
  { id: 205, name: 'Forretress', type: 'rock', stats: st(75, 90, 140, 60, 60, 40), taunt: true },
  { id: 227, name: 'Skarmory', type: 'flying', stats: st(65, 80, 140, 40, 70, 70), sturdy: true, lay: true },
  { id: 226, name: 'Mantine', type: 'water', type2: 'flying', stats: st(85, 40, 70, 80, 140, 70) },
  { id: 233, name: 'Porygon2', type: 'normal', stats: st(85, 80, 90, 105, 95, 60), beam: true },
  { id: 237, name: 'Hitmontop', type: 'fighting', stats: st(50, 95, 95, 35, 110, 70), melee: true },
  { id: 107, name: 'Hitmonchan', type: 'fighting', stats: st(50, 105, 79, 35, 110, 76), melee: true, counter: true },
  { id: 330, name: 'Flygon', type: 'rock', type2: 'flying', stats: st(80, 100, 80, 80, 80, 100) },
  { id: 321, name: 'Wailord', type: 'water', stats: st(170, 90, 45, 90, 45, 60), taunt: true },
  { id: 369, name: 'Relicanth', type: 'water', type2: 'rock', stats: st(100, 90, 130, 45, 65, 55), taunt: true },
  { id: 303, name: 'Mawile', type: 'fighting', stats: st(50, 85, 85, 55, 55, 50), melee: true, menace: true },
  { id: 335, name: 'Zangoose', type: 'normal', stats: st(73, 115, 60, 60, 60, 90), melee: true, rage: true },
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
  { id: 430, name: 'Honchkrow', type: 'flying', type2: 'ghost', stats: st(100, 125, 52, 105, 52, 71), pierce: true, alpha: true },
  { id: 432, name: 'Purugly', type: 'normal', stats: st(71, 82, 64, 64, 59, 112) },
  { id: 435, name: 'Skuntank', type: 'poison', type2: 'ghost', stats: st(103, 93, 67, 71, 61, 84), melee: true },
  { id: 437, name: 'Bronzong', type: 'rock', type2: 'psychic', stats: st(67, 89, 116, 79, 116, 33), taunt: true },
  { id: 442, name: 'Spiritomb', type: 'ghost', stats: st(50, 92, 108, 92, 108, 35), cursed: true },
  { id: 445, name: 'Garchomp', type: 'rock', type2: 'flying', stats: st(108, 130, 95, 80, 85, 102), melee: true, pierce: true },
  { id: 448, name: 'Lucario', type: 'fighting', stats: st(70, 110, 70, 115, 70, 90), melee: true, pierce: true },
  { id: 450, name: 'Hippowdon', type: 'rock', stats: st(108, 112, 118, 68, 72, 47), taunt: true, skyFor: 'sand' },
  { id: 452, name: 'Drapion', type: 'poison', type2: 'ghost', stats: st(70, 90, 110, 60, 75, 95), melee: true },
  { id: 454, name: 'Toxicroak', type: 'poison', type2: 'fighting', stats: st(83, 106, 65, 86, 65, 85), melee: true, spiky: true },
  { id: 460, name: 'Abomasnow', type: 'grass', type2: 'water', stats: st(90, 92, 75, 92, 85, 60), taunt: true },
  { id: 461, name: 'Weavile', type: 'ghost', type2: 'water', stats: st(70, 120, 65, 45, 85, 125), pierce: true, melee: true },
  { id: 462, name: 'Magnezone', type: 'electric', stats: st(70, 70, 115, 130, 90, 60), pierce: true, repel: true },
  { id: 463, name: 'Lickilicky', type: 'normal', stats: st(110, 85, 95, 80, 95, 50) },
  { id: 464, name: 'Rhyperior', type: 'rock', stats: st(115, 140, 130, 55, 55, 40), melee: true },
  { id: 465, name: 'Tangrowth', type: 'grass', stats: st(100, 100, 125, 110, 50, 50), regen: true },
  { id: 466, name: 'Electivire', type: 'electric', stats: st(75, 123, 67, 95, 85, 95), melee: true },
  { id: 467, name: 'Magmortar', type: 'fire', stats: st(75, 95, 67, 125, 95, 83), melee: true },
  { id: 468, name: 'Togekiss', type: 'flying', stats: st(85, 50, 95, 120, 115, 80), healer: true },
  { id: 469, name: 'Yanmega', type: 'flying', stats: st(86, 76, 86, 116, 56, 95), pierce: true },
  { id: 470, name: 'Leafeon', type: 'grass', stats: st(65, 110, 130, 60, 65, 95) },
  { id: 471, name: 'Glaceon', type: 'water', stats: st(65, 60, 110, 130, 95, 65) },
  { id: 472, name: 'Gliscor', type: 'rock', type2: 'flying', stats: st(75, 95, 125, 45, 75, 95), melee: true },
  { id: 473, name: 'Mamoswine', type: 'water', type2: 'rock', stats: st(110, 130, 80, 70, 60, 80), melee: true },
  { id: 474, name: 'Porygon-Z', type: 'normal', stats: st(85, 80, 70, 135, 75, 90), beam: true },
  { id: 475, name: 'Gallade', type: 'psychic', type2: 'fighting', stats: st(68, 125, 65, 65, 115, 80), melee: true },
  { id: 476, name: 'Probopass', type: 'rock', stats: st(60, 55, 145, 75, 150, 40), taunt: true, repel: true },
  { id: 477, name: 'Dusknoir', type: 'ghost', stats: st(45, 100, 135, 65, 135, 45), pressure: true },
  { id: 478, name: 'Froslass', type: 'ghost', type2: 'water', stats: st(70, 80, 70, 80, 70, 110), pierce: true },
  { id: 479, name: 'Rotom', type: 'electric', type2: 'ghost', stats: st(50, 50, 77, 95, 77, 91), cursed: true },
  // --- gen 5 (unova) ---
  { id: 497, name: 'Serperior', type: 'grass', stats: st(75, 75, 95, 75, 95, 113) },
  { id: 500, name: 'Emboar', type: 'fire', type2: 'fighting', stats: st(110, 123, 65, 100, 65, 65), melee: true },
  { id: 503, name: 'Samurott', type: 'water', stats: st(95, 100, 85, 108, 70, 70) },
  { id: 505, name: 'Watchog', type: 'normal', stats: st(60, 85, 69, 60, 69, 77) },
  { id: 508, name: 'Stoutland', type: 'normal', stats: st(85, 110, 90, 45, 90, 80), melee: true },
  { id: 510, name: 'Liepard', type: 'ghost', stats: st(64, 88, 50, 88, 50, 106), thief: true },
  { id: 512, name: 'Simisage', type: 'grass', stats: st(75, 98, 63, 98, 63, 101) },
  { id: 514, name: 'Simisear', type: 'fire', stats: st(75, 98, 63, 98, 63, 101) },
  { id: 516, name: 'Simipour', type: 'water', stats: st(75, 98, 63, 98, 63, 101) },
  { id: 518, name: 'Musharna', type: 'psychic', stats: st(116, 55, 85, 107, 95, 29), healer: true, sleepy: true },
  { id: 521, name: 'Unfezant', type: 'normal', type2: 'flying', stats: st(80, 115, 80, 65, 55, 93) },
  { id: 523, name: 'Zebstrika', type: 'electric', stats: st(75, 100, 63, 80, 63, 116) },
  { id: 526, name: 'Gigalith', type: 'rock', stats: st(85, 135, 130, 60, 80, 25), taunt: true },
  { id: 528, name: 'Swoobat', type: 'psychic', type2: 'flying', stats: st(67, 57, 55, 77, 55, 114), pierce: true },
  { id: 530, name: 'Excadrill', type: 'rock', stats: st(110, 135, 60, 50, 65, 88), melee: true },
  { id: 534, name: 'Conkeldurr', type: 'fighting', stats: st(105, 140, 95, 55, 65, 45), melee: true },
  { id: 537, name: 'Seismitoad', type: 'water', type2: 'rock', stats: st(105, 95, 75, 85, 75, 74) },
  { id: 542, name: 'Leavanny', type: 'grass', stats: st(75, 103, 80, 70, 80, 92) },
  { id: 545, name: 'Scolipede', type: 'grass', type2: 'poison', stats: st(60, 100, 89, 55, 69, 112), boost: true },
  { id: 547, name: 'Whimsicott', type: 'grass', type2: 'normal', stats: st(60, 67, 85, 77, 75, 116), prank: true },
  { id: 549, name: 'Lilligant', type: 'grass', stats: st(70, 60, 75, 110, 75, 90) },
  { id: 553, name: 'Krookodile', type: 'rock', type2: 'ghost', stats: st(95, 117, 80, 65, 70, 92), melee: true },
  { id: 555, name: 'Darmanitan', type: 'fire', stats: st(105, 140, 55, 30, 55, 95) },
  { id: 558, name: 'Crustle', type: 'grass', type2: 'rock', stats: st(70, 105, 125, 65, 75, 45), taunt: true },
  { id: 560, name: 'Scrafty', type: 'ghost', type2: 'fighting', stats: st(65, 90, 115, 45, 115, 58), melee: true, shed: true },
  { id: 563, name: 'Cofagrigus', type: 'ghost', stats: st(58, 50, 145, 95, 105, 30), taunt: true, cursed: true },
  { id: 565, name: 'Carracosta', type: 'water', type2: 'rock', stats: st(74, 108, 133, 83, 65, 32), taunt: true },
  { id: 567, name: 'Archeops', type: 'rock', type2: 'flying', stats: st(75, 140, 65, 112, 65, 110) },
  { id: 569, name: 'Garbodor', type: 'poison', stats: st(80, 95, 82, 60, 82, 75), taunt: true },
  { id: 571, name: 'Zoroark', type: 'ghost', stats: st(60, 105, 60, 120, 60, 105) },
  { id: 573, name: 'Cinccino', type: 'normal', stats: st(75, 95, 60, 65, 60, 115) },
  { id: 576, name: 'Gothitelle', type: 'psychic', stats: st(70, 55, 95, 95, 110, 65) },
  { id: 579, name: 'Reuniclus', type: 'psychic', stats: st(110, 65, 75, 125, 85, 30), taunt: true },
  { id: 581, name: 'Swanna', type: 'water', type2: 'flying', stats: st(75, 87, 63, 87, 63, 98) },
  { id: 584, name: 'Vanilluxe', type: 'water', stats: st(71, 95, 85, 110, 95, 79) },
  { id: 586, name: 'Sawsbuck', type: 'normal', type2: 'grass', stats: st(80, 100, 70, 60, 70, 95), melee: true, healer: true },
  { id: 589, name: 'Escavalier', type: 'grass', type2: 'rock', stats: st(70, 135, 105, 60, 105, 20), melee: true },
  { id: 591, name: 'Amoonguss', type: 'grass', type2: 'poison', stats: st(114, 85, 70, 85, 80, 30), healer: true },
  { id: 593, name: 'Jellicent', type: 'water', type2: 'ghost', stats: st(100, 60, 70, 85, 105, 60), cursed: true },
  { id: 596, name: 'Galvantula', type: 'grass', type2: 'electric', stats: st(70, 77, 60, 97, 60, 108), pierce: true },
  { id: 598, name: 'Ferrothorn', type: 'grass', type2: 'rock', stats: st(74, 94, 131, 54, 116, 20), taunt: true },
  { id: 601, name: 'Klinklang', type: 'rock', stats: st(60, 100, 115, 70, 85, 90) },
  { id: 604, name: 'Eelektross', type: 'electric', stats: st(85, 115, 80, 105, 80, 50), taunt: true },
  { id: 606, name: 'Beheeyem', type: 'psychic', stats: st(75, 75, 75, 125, 95, 40) },
  { id: 609, name: 'Chandelure', type: 'ghost', type2: 'fire', stats: st(60, 55, 90, 145, 90, 80), pierce: true, cursed: true },
  { id: 612, name: 'Haxorus', type: 'flying', stats: st(76, 147, 90, 60, 70, 97), melee: true },
  { id: 614, name: 'Beartic', type: 'water', stats: st(95, 130, 80, 70, 80, 50), melee: true },
  { id: 617, name: 'Accelgor', type: 'grass', stats: st(80, 70, 40, 100, 60, 145), pierce: true },
  { id: 620, name: 'Mienshao', type: 'fighting', stats: st(65, 125, 60, 95, 60, 105), melee: true },
  { id: 623, name: 'Golurk', type: 'rock', type2: 'ghost', stats: st(89, 124, 80, 55, 80, 55), melee: true, cursed: true },
  { id: 625, name: 'Bisharp', type: 'ghost', type2: 'rock', stats: st(65, 125, 100, 60, 70, 70), melee: true, alpha: true },
  { id: 628, name: 'Braviary', type: 'normal', type2: 'flying', stats: st(100, 123, 75, 57, 75, 80), melee: true },
  { id: 630, name: 'Mandibuzz', type: 'ghost', type2: 'flying', stats: st(110, 65, 105, 55, 95, 80), taunt: true },
  { id: 635, name: 'Hydreigon', type: 'ghost', type2: 'flying', stats: st(92, 105, 90, 125, 90, 98), melee: true },
  { id: 637, name: 'Volcarona', type: 'grass', type2: 'fire', stats: st(85, 60, 65, 135, 105, 100) },

];

// Rare invaders: legendaries that crash a normal wave on MS invade stages.
// Strong captures — spawn handled elsewhere; this is just the dex data.
export const INVADERS: SpeciesDef[] = [
  { id: 144, name: 'Articuno', type: 'flying', type2: 'water', stats: st(90, 85, 100, 95, 125, 85) },
  { id: 145, name: 'Zapdos', type: 'electric', type2: 'flying', stats: st(90, 90, 85, 125, 90, 100), pierce: true },
  { id: 146, name: 'Moltres', type: 'fire', type2: 'flying', stats: st(90, 100, 90, 125, 85, 90) },
  { id: 243, name: 'Raikou', type: 'electric', stats: st(90, 85, 75, 115, 100, 115), pierce: true, pressure: true },
  { id: 244, name: 'Entei', type: 'fire', stats: st(115, 115, 85, 90, 75, 100), melee: true, pressure: true },
  { id: 245, name: 'Suicune', type: 'water', stats: st(100, 75, 115, 90, 115, 85), pressure: true },
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
  { id: 249, name: 'Lugia', type: 'psychic', type2: 'flying', stats: st(106, 90, 130, 90, 154, 110), scale: true },
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
  // --- gen 5 (unova) ---
  { id: 494, name: 'Victini', type: 'psychic', type2: 'fire', stats: st(100, 100, 100, 100, 100, 100), healer: true },
  { id: 638, name: 'Cobalion', type: 'rock', type2: 'fighting', stats: st(91, 90, 129, 90, 72, 108), melee: true },
  { id: 639, name: 'Terrakion', type: 'rock', type2: 'fighting', stats: st(91, 129, 90, 72, 90, 108), melee: true },
  { id: 640, name: 'Virizion', type: 'grass', type2: 'fighting', stats: st(91, 90, 72, 90, 129, 108), pierce: true },
  { id: 641, name: 'Tornadus', type: 'flying', stats: st(79, 115, 70, 125, 80, 111), pierce: true },
  { id: 642, name: 'Thundurus', type: 'electric', type2: 'flying', stats: st(79, 115, 70, 125, 80, 111), pierce: true },
  { id: 643, name: 'Reshiram', type: 'flying', type2: 'fire', stats: st(100, 120, 100, 150, 120, 90) },
  { id: 644, name: 'Zekrom', type: 'flying', type2: 'electric', stats: st(100, 150, 120, 120, 100, 90), melee: true },
  { id: 645, name: 'Landorus', type: 'rock', type2: 'flying', stats: st(89, 125, 90, 115, 80, 101) },
  { id: 646, name: 'Kyurem', type: 'flying', type2: 'water', stats: st(125, 130, 90, 130, 90, 95), cursed: true },
  { id: 647, name: 'Keldeo', type: 'water', type2: 'fighting', stats: st(91, 72, 90, 129, 90, 108), melee: true },
  { id: 648, name: 'Meloetta', type: 'normal', type2: 'psychic', stats: st(100, 77, 77, 128, 128, 90), healer: true },
  { id: 649, name: 'Genesect', type: 'grass', type2: 'rock', stats: st(71, 120, 95, 120, 95, 99), pierce: true, cursed: true },

];

// Evolution-only species: targets of evolvesTo that never roll into waves or
// the draft themselves. Mid-stages chain onward where their next form exists.
export const EVOS: SpeciesDef[] = [
  { id: 2, name: 'Ivysaur', type: 'grass', type2: 'poison', stats: st(60, 62, 63, 80, 80, 60), evolvesTo: 3 },
  { id: 5, name: 'Charmeleon', type: 'fire', stats: st(58, 64, 58, 80, 65, 80), evolvesTo: 6 },
  { id: 8, name: 'Wartortle', type: 'water', stats: st(59, 63, 80, 65, 80, 58), evolvesTo: 9 },
  { id: 17, name: 'Pidgeotto', type: 'flying', type2: 'normal', stats: st(63, 60, 55, 50, 50, 71), melee: true, evolvesTo: 18 },
  { id: 18, name: 'Pidgeot', type: 'flying', type2: 'normal', stats: st(83, 80, 75, 70, 70, 101), melee: true },
  { id: 20, name: 'Raticate', type: 'normal', stats: st(55, 81, 60, 50, 70, 97), melee: true, raider: true },
  { id: 22, name: 'Fearow', type: 'flying', stats: st(65, 90, 65, 61, 61, 100), melee: true },
  { id: 26, name: 'Raichu', type: 'electric', stats: st(60, 90, 55, 90, 80, 110), pierce: true },
  { id: 33, name: 'Nidorino', type: 'poison', stats: st(61, 72, 57, 55, 55, 65), melee: true, evolvesTo: 34 },
  { id: 36, name: 'Clefable', type: 'normal', stats: st(95, 70, 73, 95, 90, 60), healer: true },
  { id: 38, name: 'Ninetales', type: 'fire', stats: st(73, 76, 75, 81, 100, 100), burn: true, skyFor: 'sun' },
  { id: 40, name: 'Wigglytuff', type: 'normal', stats: st(140, 70, 45, 85, 50, 45), healer: true },
  { id: 42, name: 'Golbat', type: 'poison', type2: 'flying', stats: st(75, 80, 70, 65, 75, 90), melee: true, evolvesTo: 169 },
  { id: 44, name: 'Gloom', type: 'grass', type2: 'poison', stats: st(60, 65, 70, 85, 75, 40), evolvesTo: [45, 182] },
  { id: 45, name: 'Vileplume', type: 'grass', type2: 'poison', stats: st(75, 80, 85, 110, 90, 50), regen: true, spore: true },
  { id: 47, name: 'Parasect', type: 'grass', type2: 'poison', stats: st(60, 95, 80, 60, 80, 30), melee: true, leech: true },
  { id: 49, name: 'Venomoth', type: 'poison', stats: st(70, 65, 60, 90, 75, 90) },
  { id: 51, name: 'Dugtrio', type: 'rock', stats: st(35, 100, 50, 50, 70, 120), melee: true, trap: true },
  { id: 53, name: 'Persian', type: 'normal', stats: st(65, 70, 60, 65, 65, 115), pierce: true, raider: true },
  { id: 55, name: 'Golduck', type: 'water', stats: st(80, 82, 78, 95, 80, 85) },
  { id: 57, name: 'Primeape', type: 'fighting', stats: st(65, 105, 60, 60, 70, 95), melee: true, rage: true },
  { id: 61, name: 'Poliwhirl', type: 'water', stats: st(65, 65, 65, 50, 50, 90), evolvesTo: [62, 186] },
  { id: 62, name: 'Poliwrath', type: 'water', stats: st(90, 95, 95, 70, 90, 70), melee: true },
  { id: 64, name: 'Kadabra', type: 'psychic', stats: st(40, 35, 30, 120, 70, 105), pierce: true, blink: true, evolvesTo: 65 },
  { id: 67, name: 'Machoke', type: 'fighting', stats: st(80, 100, 70, 50, 60, 45), melee: true, evolvesTo: 68 },
  { id: 70, name: 'Weepinbell', type: 'grass', type2: 'poison', stats: st(65, 90, 50, 85, 45, 55), evolvesTo: 71 },
  { id: 71, name: 'Victreebel', type: 'grass', type2: 'poison', stats: st(80, 105, 65, 100, 70, 70), melee: true },
  { id: 73, name: 'Tentacruel', type: 'water', type2: 'poison', stats: st(80, 70, 65, 80, 120, 100), spiky: true },
  { id: 75, name: 'Graveler', type: 'rock', stats: st(55, 95, 115, 45, 45, 35), evolvesTo: 76 },
  { id: 78, name: 'Rapidash', type: 'fire', stats: st(65, 100, 70, 80, 80, 105) },
  { id: 82, name: 'Magneton', type: 'electric', stats: st(50, 60, 95, 120, 70, 70), repel: true, evolvesTo: 462 },
  { id: 85, name: 'Dodrio', type: 'flying', type2: 'normal', stats: st(60, 110, 70, 60, 60, 110), melee: true },
  { id: 89, name: 'Muk', type: 'poison', stats: st(105, 105, 75, 65, 100, 50), melee: true },
  { id: 93, name: 'Haunter', type: 'ghost', type2: 'poison', stats: st(45, 50, 45, 115, 55, 95), pierce: true, evolvesTo: 94 },
  { id: 101, name: 'Electrode', type: 'electric', stats: st(60, 50, 70, 80, 80, 150) },
  { id: 103, name: 'Exeggutor', type: 'grass', type2: 'psychic', stats: st(95, 95, 85, 125, 75, 55) },
  { id: 105, name: 'Marowak', type: 'rock', stats: st(60, 80, 110, 50, 80, 45), melee: true },
  { id: 110, name: 'Weezing', type: 'poison', stats: st(65, 90, 120, 85, 70, 60), split: true },
  { id: 112, name: 'Rhydon', type: 'rock', stats: st(105, 130, 120, 45, 45, 40), melee: true },
  { id: 164, name: 'Noctowl', type: 'flying', type2: 'normal', stats: st(100, 50, 50, 86, 96, 70), melee: true },
  { id: 171, name: 'Lanturn', type: 'electric', type2: 'water', stats: st(125, 58, 58, 76, 76, 67), absorb: 'electric' },
  { id: 208, name: 'Steelix', type: 'rock', stats: st(75, 85, 200, 55, 65, 30), melee: true },
  { id: 219, name: 'Magcargo', type: 'fire', stats: st(60, 50, 120, 90, 80, 30) },
  { id: 279, name: 'Pelipper', type: 'flying', type2: 'water', stats: st(60, 50, 100, 95, 70, 65) },
  { id: 334, name: 'Altaria', type: 'flying', stats: st(75, 70, 90, 70, 105, 80) },
  { id: 80, name: 'Slowbro', type: 'psychic', type2: 'water', stats: st(95, 75, 110, 100, 80, 30) },
  { id: 99, name: 'Kingler', type: 'water', stats: st(55, 130, 115, 50, 50, 75), melee: true },
  { id: 119, name: 'Seaking', type: 'water', stats: st(80, 92, 65, 65, 80, 68) },
  { id: 139, name: 'Omastar', type: 'water', type2: 'rock', stats: st(70, 60, 125, 115, 70, 55) },
  { id: 141, name: 'Kabutops', type: 'rock', type2: 'water', stats: st(60, 115, 105, 65, 70, 80), melee: true },
  { id: 148, name: 'Dragonair', type: 'flying', stats: st(61, 84, 65, 70, 70, 70), evolvesTo: 149, shed: true },
  { id: 178, name: 'Xatu', type: 'flying', type2: 'psychic', stats: st(65, 75, 70, 95, 70, 95), blink: true },
  { id: 180, name: 'Flaaffy', type: 'electric', stats: st(70, 55, 55, 80, 60, 45), evolvesTo: 181 },
  { id: 184, name: 'Azumarill', type: 'water', type2: 'normal', stats: st(100, 50, 80, 60, 80, 50), healer: true, huge: true },
  { id: 195, name: 'Quagsire', type: 'water', type2: 'rock', stats: st(95, 85, 85, 65, 65, 35) },
  { id: 217, name: 'Ursaring', type: 'normal', stats: st(90, 130, 75, 75, 75, 55), melee: true, rage: true, guts: true },
  { id: 232, name: 'Donphan', type: 'rock', stats: st(90, 120, 120, 60, 60, 50), melee: true, charge: true },
  { id: 262, name: 'Mightyena', type: 'ghost', stats: st(70, 90, 70, 60, 60, 70), melee: true, hunter: true },
  { id: 271, name: 'Lombre', type: 'grass', type2: 'water', stats: st(60, 50, 50, 60, 70, 50) },
  { id: 274, name: 'Nuzleaf', type: 'grass', type2: 'ghost', stats: st(70, 70, 40, 60, 40, 60) },
  { id: 277, name: 'Swellow', type: 'flying', type2: 'normal', stats: st(60, 85, 60, 50, 50, 125), melee: true },
  { id: 281, name: 'Kirlia', type: 'psychic', type2: 'normal', stats: st(38, 35, 35, 65, 55, 50), sync: true, evolvesTo: [282, 475] },
  { id: 286, name: 'Breloom', type: 'grass', stats: st(60, 130, 80, 60, 60, 70), melee: true, spore: true, pheal: true },
  { id: 294, name: 'Loudred', type: 'normal', stats: st(84, 71, 43, 71, 43, 48) },
  { id: 297, name: 'Hariyama', type: 'fighting', stats: st(144, 120, 60, 40, 60, 50), melee: true },
  { id: 305, name: 'Lairon', type: 'rock', stats: st(60, 90, 140, 50, 50, 40), evolvesTo: 306 },
  { id: 310, name: 'Manectric', type: 'electric', stats: st(70, 75, 60, 105, 60, 105), shock: true },
  { id: 319, name: 'Sharpedo', type: 'water', stats: st(70, 120, 40, 95, 40, 95), melee: true, boost: true },
  { id: 329, name: 'Vibrava', type: 'rock', type2: 'flying', stats: st(50, 70, 50, 50, 50, 70) },
  { id: 332, name: 'Cacturne', type: 'grass', type2: 'ghost', stats: st(70, 115, 60, 115, 60, 55), melee: true },
  { id: 342, name: 'Crawdaunt', type: 'water', type2: 'ghost', stats: st(63, 120, 85, 90, 55, 55), melee: true },
  { id: 354, name: 'Banette', type: 'ghost', stats: st(64, 115, 65, 83, 63, 65), pierce: true },
  { id: 356, name: 'Dusclops', type: 'ghost', stats: st(40, 70, 130, 60, 130, 25), taunt: true, evolvesTo: 477 },
  { id: 362, name: 'Glalie', type: 'water', stats: st(80, 80, 80, 80, 80, 80) },
  { id: 364, name: 'Sealeo', type: 'water', stats: st(90, 60, 70, 75, 70, 45) },
  { id: 11, name: 'Metapod', type: 'grass', stats: st(50, 20, 55, 25, 25, 30), shielded: true, evolvesTo: 12 },
  { id: 12, name: 'Butterfree', type: 'flying', stats: st(60, 45, 50, 90, 80, 70), confuse: true },
  { id: 14, name: 'Kakuna', type: 'poison', stats: st(45, 25, 50, 25, 25, 35), shielded: true, evolvesTo: 15 },
  { id: 15, name: 'Beedrill', type: 'poison', stats: st(65, 90, 40, 45, 80, 75), melee: true, venom: true },
  { id: 28, name: 'Sandslash', type: 'rock', stats: st(75, 100, 110, 45, 55, 65), melee: true, spiky: true },
  { id: 30, name: 'Nidorina', type: 'poison', stats: st(70, 62, 67, 55, 55, 56), evolvesTo: 31 },
  { id: 31, name: 'Nidoqueen', type: 'poison', type2: 'rock', stats: st(90, 92, 87, 75, 85, 76), melee: true },
  { id: 87, name: 'Dewgong', type: 'water', stats: st(90, 70, 80, 70, 95, 70) },
  { id: 91, name: 'Cloyster', type: 'water', stats: st(50, 95, 180, 85, 45, 70), shielded: true },
  { id: 106, name: 'Hitmonlee', type: 'fighting', stats: st(50, 120, 53, 35, 110, 87), melee: true, counter: true },
  { id: 117, name: 'Seadra', type: 'water', stats: st(55, 65, 95, 95, 45, 85), toxic: true, evolvesTo: 230 },
  { id: 166, name: 'Ledian', type: 'flying', stats: st(55, 35, 50, 55, 110, 85), melee: true },
  { id: 168, name: 'Ariados', type: 'poison', stats: st(70, 90, 70, 60, 60, 40), melee: true },
  { id: 188, name: 'Skiploom', type: 'grass', type2: 'flying', stats: st(55, 45, 50, 45, 65, 80), evolvesTo: 189 },
  { id: 189, name: 'Jumpluff', type: 'grass', type2: 'flying', stats: st(75, 55, 70, 55, 95, 110) },
  { id: 192, name: 'Sunflora', type: 'grass', stats: st(75, 75, 55, 105, 85, 30) },
  { id: 224, name: 'Octillery', type: 'water', stats: st(75, 105, 75, 105, 75, 45), pierce: true, volley: true },
  { id: 247, name: 'Pupitar', type: 'rock', stats: st(70, 84, 70, 65, 70, 51), evolvesTo: 248 },
  { id: 266, name: 'Silcoon', type: 'grass', stats: st(50, 35, 55, 25, 25, 15), evolvesTo: 267 },
  { id: 267, name: 'Beautifly', type: 'flying', stats: st(60, 70, 50, 100, 50, 65) },
  { id: 284, name: 'Masquerain', type: 'flying', stats: st(70, 60, 62, 100, 82, 80) },
  { id: 301, name: 'Delcatty', type: 'normal', stats: st(70, 65, 65, 55, 55, 90), charm: true },
  { id: 308, name: 'Medicham', type: 'fighting', type2: 'psychic', stats: st(60, 60, 75, 60, 75, 80), melee: true, huge: true },
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
  // --- gen 5 (unova) ---
  { id: 496, name: 'Servine', type: 'grass', stats: st(60, 60, 75, 60, 75, 83), evolvesTo: 497 },
  { id: 499, name: 'Pignite', type: 'fire', type2: 'fighting', stats: st(90, 93, 55, 70, 55, 55), evolvesTo: 500, melee: true },
  { id: 502, name: 'Dewott', type: 'water', stats: st(75, 75, 60, 83, 60, 60), evolvesTo: 503 },
  { id: 507, name: 'Herdier', type: 'normal', stats: st(65, 80, 65, 35, 65, 60), evolvesTo: 508, melee: true },
  { id: 520, name: 'Tranquill', type: 'normal', type2: 'flying', stats: st(62, 77, 62, 50, 42, 65), evolvesTo: 521 },
  { id: 525, name: 'Boldore', type: 'rock', stats: st(70, 105, 105, 50, 40, 20), evolvesTo: 526, taunt: true },
  { id: 533, name: 'Gurdurr', type: 'fighting', stats: st(85, 105, 85, 40, 50, 40), evolvesTo: 534, melee: true },
  { id: 536, name: 'Palpitoad', type: 'water', type2: 'rock', stats: st(75, 65, 55, 65, 55, 69), evolvesTo: 537 },
  { id: 541, name: 'Swadloon', type: 'grass', stats: st(55, 63, 90, 50, 80, 42), evolvesTo: 542 },
  { id: 544, name: 'Whirlipede', type: 'grass', type2: 'poison', stats: st(40, 55, 99, 40, 79, 47), evolvesTo: 545 },
  { id: 552, name: 'Krokorok', type: 'rock', type2: 'ghost', stats: st(60, 82, 45, 45, 45, 74), evolvesTo: 553, melee: true },
  { id: 575, name: 'Gothorita', type: 'psychic', stats: st(60, 45, 70, 75, 85, 55), evolvesTo: 576 },
  { id: 578, name: 'Duosion', type: 'psychic', stats: st(65, 40, 50, 125, 60, 30), evolvesTo: 579 },
  { id: 583, name: 'Vanillish', type: 'water', stats: st(51, 65, 65, 80, 75, 59), evolvesTo: 584 },
  { id: 600, name: 'Klang', type: 'rock', stats: st(60, 80, 95, 70, 85, 50), evolvesTo: 601 },
  { id: 603, name: 'Eelektrik', type: 'electric', stats: st(65, 85, 70, 75, 70, 40), evolvesTo: 604 },
  { id: 608, name: 'Lampent', type: 'ghost', type2: 'fire', stats: st(60, 40, 60, 95, 60, 55), evolvesTo: 609, cursed: true },
  { id: 611, name: 'Fraxure', type: 'flying', stats: st(66, 117, 70, 40, 50, 67), evolvesTo: 612, melee: true },
  { id: 634, name: 'Zweilous', type: 'ghost', type2: 'flying', stats: st(72, 85, 70, 65, 70, 58), evolvesTo: 635, melee: true },

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

// The draft's final pick is an ace: a veteran mid-stager that still has a
// ceiling (it evolves). Three runts and one anchor beats four runts.
export const ACE_POOL = EVOS.filter((d) => d.evolvesTo != null);

// Canon levitators/hoverers — cross water zones like water/flying types.
export const FLOATERS = new Set([
  81, 82, 462, // magnemite line
  92, 93, 94, // gastly line
  109, 110, // koffing line
  200, 429, // misdreavus line
  201, 337, 338, // unown, lunatone, solrock
  343, 344, // baltoy line
  355, 356, 477, // duskull line
  425, 436, 437, // drifloon, bronzor line
  479, 480, 481, 482, 488, 491, // rotom, lake trio, cresselia, darkrai
  602, 603, 604, // tynamo line
  607, 608, 609, // litwick line
  599, 600, 601, // klink line
  151, 150, 251, 385, 386, // hovering mythics
  353, 562, // shuppet, yamask
  137, 233, 474, // porygon line
  577, 578, 579, // solosis line
  374, 375, 376, // beldum line
  605, 606, 358, 351, // elgyem line, chimecho, castform
]);

const ENEMY_POOL = ENEMY_DB.slice(0, -11);
export const BOSS_POOL = ENEMY_DB.slice(-11);

// Competitive-style power tiers by BST — the climb's power curve.
// 0 LC (<360) · 1 low (360-459) · 2 high (460-559) · 3 uber (560+).
// Draft picks are tier ≤1; wild pools unlock heavier bodies with depth
// and the 560+ monsters (Metagross, Tyranitar, Slaking) lurk past depth 3.
export const bst = (d: SpeciesDef) =>
  d.stats.hp + d.stats.atk + d.stats.def + d.stats.spa + d.stats.spd + d.stats.spe;
export const tierOf = (d: SpeciesDef) => (bst(d) >= 560 ? 3 : bst(d) >= 460 ? 2 : bst(d) >= 360 ? 1 : 0);

// --- the hatcher ---------------------------------------------------------------
// Every catchable species can drop — the dedup'd set screens.ts built as
// DEX_LIST; PULLABLE is the canonical home now. Sorted by id for the dex grid.
export const PULLABLE: SpeciesDef[] = [
  ...new Map([...ROSTER, ...ENEMY_DB, ...ELITES, ...INVADERS].map((s) => [s.id, s])).values(),
].sort((a, b) => a.id - b.id);
// the dex's full page: evo-only forms are caught through evolution, not
// the hatcher — without them the count outruns the grid
export const DEX_ALL: SpeciesDef[] = [
  ...new Map([...PULLABLE, ...EVOS].map((s) => [s.id, s])).values(),
].sort((a, b) => a.id - b.id);
export const INVADER_IDS = new Set(INVADERS.map((i) => i.id));

export const PULL_COST = 30;
export const PULL10_COST = 270; // 10% off — any 10 pulls hold a pity roll anyway
export const PULL_PITY = 10;
export const DUST_BY_TIER = [5, 10, 40, 120] as const; // dupe pull → dust, by tier
export const PULL_SHINY = 0.02; // per-pull shiny odds — a lottery on the lottery

// Sat/Sun UTC double the shiny roll — the standing calendar window.
export const shinyOdds = (now = Date.now()): number => {
  const d = new Date(now).getUTCDay();
  return PULL_SHINY * (d === 0 || d === 6 ? 2 : 1);
};

// Rarity is a BUCKET roll, then uniform inside the bucket — pool share never
// sets the rates. Epic also sweeps invaders: tier alone misses Phione (tier 2).
// PULL_RATES is the single source for the cuts — the hatcher prints these
// numbers, so they must always sum to 1.
export const PULL_RATES = { common: 0.72, rare: 0.25, epic: 0.03 } as const;
const PULL_COMMON = PULLABLE.filter((d) => tierOf(d) <= 1 && !INVADER_IDS.has(d.id));
const PULL_RARE = PULLABLE.filter((d) => tierOf(d) === 2 && !INVADER_IDS.has(d.id));
const PULL_EPIC = PULLABLE.filter((d) => tierOf(d) >= 3 || INVADER_IDS.has(d.id));

// rarePlus (pity rolls) drops the common bucket — rare:epic renormalize to
// 25:3. A featuredId inside the rolled bucket weighs 10x there (rate-up).
export function pullSpecies(rng: () => number, opts?: { rarePlus?: boolean; featuredId?: number }): SpeciesDef {
  const r = opts?.rarePlus ? PULL_RATES.common + rng() * (1 - PULL_RATES.common) : rng();
  const bucket = r < PULL_RATES.common ? PULL_COMMON : r < PULL_RATES.common + PULL_RATES.rare ? PULL_RARE : PULL_EPIC;
  const fid = opts?.featuredId;
  const feat = fid == null ? undefined : bucket.find((d) => d.id === fid);
  const i = Math.floor(rng() * (bucket.length + (feat ? 9 : 0)));
  return feat && i < 9 ? feat : bucket[i - (feat ? 9 : 0)];
}

export function dustCost(d: SpeciesDef): number {
  return 80 * (tierOf(d) + 1);
}

// Evolution lines for the collection chase: a line is a root + every
// descendant (branches count together — the EEVEE line is one set).
// Roots are pullable species nothing else evolves into; one-member
// "lines" are skipped — a set needs at least an evolution to chase.
export interface EvoLine {
  root: number;
  ids: number[];
}
export const EVO_LINES: EvoLine[] = (() => {
  const froms = new Set<number>();
  for (const d of PULLABLE) {
    const to = d.evolvesTo;
    (Array.isArray(to) ? to : [to]).forEach((id) => id != null && froms.add(id));
  }
  const seen = new Set<number>();
  const lines: EvoLine[] = [];
  for (const d of PULLABLE) {
    if (!d.evolvesTo || froms.has(d.id) || seen.has(d.id)) continue;
    const ids: number[] = [];
    const walk = (id: number) => {
      if (seen.has(id)) return;
      seen.add(id);
      ids.push(id);
      const to = speciesById(id)?.evolvesTo;
      (Array.isArray(to) ? to : [to]).forEach((e) => e != null && walk(e));
    };
    walk(d.id);
    if (ids.length > 1) lines.push({ root: d.id, ids });
  }
  return lines;
})();

// a completed line pays a one-time star bounty scaled to its length —
// a 3-mon line is worth a pull
export const setPay = (line: EvoLine): number => 10 * line.ids.length;

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
// a missing id throws here at module load — loud at boot, not mid-run
const foe = (id: number): SpeciesDef => {
  const d = ENEMY_DB.find((x) => x.id === id);
  if (!d) throw new Error(`ENEMY_THEME references unknown ENEMY_DB id ${id}`);
  return d;
};
export const ENEMY_THEME: Record<Theme, SpeciesDef[]> = {
  grove: [19, 16, 43, 21, 163, 46, 48, 69, 102, 216, 263, 270, 273, 276, 331, 108, 10, 13, 165, 167, 187, 193, 206, 265, 283, 313, 314, 315, 357, 511, 531, 556, 588, 597, 626, 632, 114, 455, 272, 162, 203, 204, 234, 264, 268, 269, 275, 287, 288, 291, 311, 312, 327, 352, 400, 401, 402, 412, 413, 414, 415, 416, 420, 421].map(foe),
  cavern: [41, 74, 92, 66, 50, 104, 56, 88, 109, 63, 198, 200, 261, 140, 231, 353, 355, 27, 29, 299, 302, 337, 338, 343, 345, 347, 517, 524, 527, 538, 539, 564, 566, 618, 201, 290, 215, 97, 137, 213, 292, 296, 316, 317, 434].map(foe),
  volcano: [37, 58, 77, 126, 218, 74, 50, 104, 111, 228, 128, 231, 240, 322, 324, 513, 631, 449, 185, 339, 24, 138, 340, 345, 347, 564, 566].map(foe),
  sky: [16, 21, 81, 100, 170, 72, 84, 278, 333, 177, 309, 147, 98, 118, 318, 341, 86, 90, 116, 207, 222, 225, 366, 370, 515, 522, 550, 582, 594, 615, 621, 320, 368, 441, 79, 124, 211, 221, 351, 358, 422, 423, 457, 561].map(foe),
};

// A run is 9 stages; every third is a gym boss. Stages 1-3 are the seeded
// stage, 4-9 are rolled as depth 1..6.
export const TOTAL_STAGES = 9;

// Ascension heat, StS-style: battle.asc runs 1-9 and every tier's modifier
// STACKS with the ones below it (index 0 = asc 1). On top of the named
// effect, each level also scales enemy bulk (+15%), enemy damage (+8%) and
// the score premium — `name` is what the in-court tag reads out.
export const ASC_MODS: { id: string; name: string; desc: string }[] = [
  { id: 'roamers', name: 'ROAMERS', desc: 'legendary invades + rival echoes roll twice as often' },
  { id: 'hair-trigger', name: 'HAIR TRIGGER', desc: 'foes wind up 15% faster' },
  { id: 'fortunate', name: 'FORTUNATE', desc: '+1 charm pick' },
  { id: 'thin-centers', name: 'THIN CENTERS', desc: 'poké center rests heal only 75%' },
  { id: 'inflation', name: 'INFLATION', desc: 'score premium deepens to +30%/tier' },
  { id: 'enraged-leaders', name: 'ENRAGED LEADERS', desc: 'gym leaders walk in enraged' },
  { id: 'frenzy', name: 'FRENZY', desc: 'foes press 25% harder on approach' },
  { id: 'storm', name: 'STORM', desc: 'every wave rolls weather' },
  { id: 'tag-team', name: 'TAG TEAM', desc: 'the rival echo is owed one visit' },
];

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

// Archero room canon: a wave's court pulls one hand-authored 9x11
// template from this pool — never procedural geometry. One char per
// cell; the court walls already draw the '1' ring, so the border is
// authored for readability only (the parser reads interior rows 1-9,
// cols 1-7). Tile legend:
//   0 floor · 2 rock slab (ball banks off) · 3 liquid moat · 4 mine
//   5 spike strip (chips ball, walls grounded foes) · 6 gust lane (wind
//   pushes to mid) · 7 grass drag patch · S enemy spawn · 1/E/P dressing
// Layouts [0..2] stay gentle — they're the stage-opener pool. Bosses
// get ROOM_BOSS instead. Normalized arena coords as usual.
export interface BlockDef {
  nx: number;
  ny: number;
  nw: number;
  nh: number;
}
export const ROOM_LAYOUTS: string[][] = [
  // open — the classic clear room; anchors clustered center-north keep
  // shot one a ricochet
  [
    '1111E1111',
    '10S0S0S01',
    '100S0S001',
    '1S00000S1',
    '1000S0001',
    '10S000S01',
    '100000001',
    '100S0S001',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // corner quads — four banks, wide lanes between
  [
    '1111E1111',
    '1S0S0S0S1',
    '102000201',
    '1000S0001',
    '100000001',
    '10S0S0S01',
    '102000201',
    '100000001',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // center pillar — foes tuck behind the stone
  [
    '1111E1111',
    '1S0S0S0S1',
    '100S0S001',
    '100020001',
    '1S00S00S1',
    '100000001',
    '100S0S001',
    '100000001',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // kill box — long center sightline, flanked pockets for tucked spawns
  [
    '1111E1111',
    '1S0S0S0S1',
    '122000221',
    '12S0S0S21',
    '120000021',
    '10S0S0S01',
    '120000021',
    '122000221',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // moat — a liquid band splits the court; non-swimmers thread the bridge
  [
    '1111E1111',
    '1S0S0S0S1',
    '1000S0001',
    '133303331',
    '100000001',
    '14S0S0S41',
    '100000001',
    '1000S0001',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // labyrinth — staggered clusters force a zig-zag approach
  [
    '1111E1111',
    '1S0S0S0S1',
    '102202201',
    '10S0000S1',
    '100020001',
    '1S00S00S1',
    '122000221',
    '10S0000S1',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // fortress — a U-pocket at the door; the pack inside takes banked shots
  [
    '1111E1111',
    '1S0S0S0S1',
    '100000001',
    '102222201',
    '102S0S201',
    '102000201',
    '10S0S0S01',
    '100000001',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // scatter — ricochet pinballs with mined flanks
  [
    '1111E1111',
    '1S0S0S0S1',
    '100000001',
    '102000201',
    '10S020S01',
    '100000001',
    '102000201',
    '14S0S0S41',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // twin moats — two liquid bands with offset bridges; non-swimmers snake
  // the flank crossings while mines fence the detours
  [
    '1111E1111',
    '1S0S0S0S1',
    '14S0S0S41',
    '130333031',
    '10S0S0S01',
    '1S00000S1',
    '133303331',
    '1040S0401',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // funnel — mirrored slabs converge off the door corners; banked shots
  // drop through the spout into the pack
  [
    '1111E1111',
    '1S0S0S0S1',
    '1220S0221',
    '1022S2201',
    '1S02S20S1',
    '10S0S0S01',
    '100S0S001',
    '100000001',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // minefield — three mines seeded mid-court between pocketed corners;
  // anchors thread the rows straight through the field
  [
    '1111E1111',
    '1S0S0S0S1',
    '1220S0221',
    '120S0S021',
    '10S4S4S01',
    '100040001',
    '10S0S0S01',
    '120S0S021',
    '122000221',
    '1000P0001',
    '111111111',
  ],
  // colliery — a worked-out seam: mine pairs fence the flanks and the
  // mid-court crossing, two lone rocks break the center lane
  [
    '1111E1111',
    '1S0S0S0S1',
    '1040S0401',
    '1S00S00S1',
    '142000241',
    '10S000S01',
    '104040401',
    '1S00000S1',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // ambush alley — twin rock walls split the court into three lanes; guards
  // stack the mouths and the mid crossing, a mine pair chokes the junction
  [
    '1111E1111',
    '10S0S0S01',
    '100202001',
    '1S02S20S1',
    '100202001',
    '1S40S04S1',
    '100202001',
    '1S02S20S1',
    '100202001',
    '1000P0001',
    '111111111',
  ],
  // the keep — a moat castle mid-court: gate gaps top and bottom let the
  // ball in, the four anchors inside are the prize
  [
    '1111E1111',
    '1S0S0S0S1',
    '133303331',
    '130S0S031',
    '130000031',
    '130S0S031',
    '133303331',
    '1S0S0S0S1',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // pincer — mine claws rake both flanks; the center lane stays clean till
  // the blast wall closes it
  [
    '1111E1111',
    '1S0S0S0S1',
    '100000001',
    '104000401',
    '10S0S0S01',
    '140000041',
    '10S0S0S01',
    '104000401',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // saltire — two triple-pillar rows make slalom lanes; banked shots thread
  // the gaps into the tucked anchors
  [
    '1111E1111',
    '1S0S0S0S1',
    '102000201',
    '10S0S0S01',
    '102020201',
    '1S00S00S1',
    '102020201',
    '10S0S0S01',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // moat-gate — a water wall splits the court; dry gates at the edges and
  // middle force banked entries while anchors hold the far courtyard
  [
    '1111E1111',
    '1S0S0S0S1',
    '103303301',
    '1S00000S1',
    '103303301',
    '1S0S0S0S1',
    '100000001',
    '10S0S0S01',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // sluice — a broken rock spine runs the middle; S lanes snake around it
  // and mine tips guard the elbow turns
  [
    '1111E1111',
    '1S0S0S0S1',
    '100020001',
    '1S00000S1',
    '104020401',
    '1S00000S1',
    '100020001',
    '10S0S0S01',
    '100000001',
    '1000P0001',
    '111111111',
  ],
  // bramble — spike strips wall both flanks so grounded creeps can't hug
  // the edges; the grass drag kills a dribbling bank dead mid-court
  [
    '1111E1111',
    '1S0S0S0S1',
    '100000001',
    '157000751',
    '1S0S0S0S1',
    '107000701',
    '1S0S0S0S1',
    '100000001',
    '10S0S0S01',
    '1000P0001',
    '111111111',
  ],
  // crosswind — gust lanes converge on mid and mine teeth guard the
  // junction; shots ride the wind in, then get shoved off the exits
  [
    '1111E1111',
    '1S0S0S0S1',
    '160000061',
    '160S0S061',
    '102000201',
    '160404061',
    '1S00S00S1',
    '160000061',
    '10S0S0S01',
    '1000P0001',
    '111111111',
  ],
  // glacier — a frozen band splits the court; shots crossing it keep
  // nearly all their speed, so banks carry clean to the far wall while
  // mistimed entries overshoot into the mine teeth at the exits
  [
    '1111E1111',
    '1S0S0S0S1',
    '102000201',
    '1S00S00S1',
    '188888881',
    '10S0S0S01',
    '100000001',
    '14S000S41',
    '100000001',
    '1000P0001',
    '111111111',
  ],
];
// the keep/pincer/saltire/moat-gate/sluice/bramble/crosswind tail is the
// hard tier — it only rides in from depth 2 (stage ~5 up); append new
// mid-pool rooms before it
export const ROOM_HARD = 7;
// Gym arenas stay open — the leader fight is the spectacle, so no
// furniture; the entourage still enters on the anchor ring.
export const ROOM_BOSS: string[] = [
  '1111E1111',
  '1S0S0S0S1',
  '1000S0001',
  '10S0S0S01',
  '100000001',
  '10S0S0S01',
  '100000001',
  '100000001',
  '100000001',
  '1000P0001',
  '111111111',
];
export interface RoomDef {
  blocks: BlockDef[];
  hazards: HazardSpawn[];
  anchors: { nx: number; ny: number }[];
}

// Gym flavor: the boss's entourage shares its type — every leader runs a
// mono-type gym. All eleven types have fodder/elites, so the fallback only
// covers a future type added without species.
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
    const pool = same.length ? same : fodder;
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
  // the designed triplet keeps its shape language but varies its size —
  // most climbs run 3/3+elite/2+boss, some pull a heavier pack or escort
  const midCount = rng() < 0.3 ? 4 : 3;
  const escort = rng() < 0.3 ? 3 : 2;
  return {
    name: name ?? THEME_NAME[theme],
    theme,
    waves: [
      [opener(), opener(), opener()],
      [...Array.from({ length: midCount }, add), elite()],
      [...gymPack(boss, escort, rng, slot, fodder, 0), { def: boss, nx: 0.5, ny: 0.45, boss: true }],
    ],
  };
}

// Roll the next stage (depth 1..6 = stages 4..9). Bigger packs each depth,
// a gym boss every 3rd.
// `theme` picks the biome pool for fodder; omit it to fall back to the flat pool.
export function rollWave(rng: () => number, depth: number, theme?: Theme, bossType?: PokeType): WaveSpawn[] {
  const fodder = fodderPool(theme, depth);
  const slots = [...SLOTS];
  const slot = () => {
    const [nx, ny] = slots.splice(Math.floor(rng() * slots.length), 1)[0];
    return { nx: nx + (rng() - 0.5) * 0.1, ny: ny + (rng() - 0.5) * 0.08 };
  };
  // ~12% of plain waves are a species pod — a Doduo flock, a Geodude den —
  // the pack's shared flags turn the wave into one focused puzzle
  const pod = depth >= 1 && rng() < 0.12 ? fodder[Math.floor(rng() * fodder.length)] : null;
  const add = () => ({
    // deeper waves mix in capturable elites — odds and tier cap both ramp
    def: pod ?? (depth > 0 && rng() < 0.15 + depth * 0.05
      ? eliteAt(rng, depth)
      : fodder[Math.floor(rng() * fodder.length)]),
    ...slot(),
  });
  // a gym stop's sign calls the leader's type — honor it when the wave
  // rolls; an uncovered type (shouldn't happen) falls back to the pool
  const typed = bossType ? BOSS_POOL.filter((d) => d.type === bossType) : BOSS_POOL;
  const pool = typed.length ? typed : BOSS_POOL;
  const boss = depth % 3 === 0 ? pool[Math.floor(rng() * pool.length)] : null;
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

// Player avatars — the sprite that walks the region map and stands at
// HOME. `id` is the npc-atlas frame prefix (`${id}_down_0` idles,
// `${id}_<dir>_<0..2>` walks). Named heroes plus the atlas's generic
// townie sets keep it Gen-3 canon.
export const AVATARS: { id: string; name: string }[] = [
  { id: 'may', name: 'MAY' },
  { id: 'wally', name: 'WALLY' },
  { id: 'generic_m1', name: 'BOY 1' },
  { id: 'generic_m2', name: 'BOY 2' },
  { id: 'generic_m3', name: 'BOY 3' },
  { id: 'generic_m4', name: 'BOY 4' },
  { id: 'generic_m5', name: 'BOY 5' },
  { id: 'generic_f1', name: 'GIRL 1' },
  { id: 'generic_f2', name: 'GIRL 2' },
  { id: 'generic_f3', name: 'GIRL 3' },
  { id: 'generic_f4', name: 'GIRL 4' },
  { id: 'generic_f5', name: 'GIRL 5' },
  { id: 'generic_c1', name: 'KID 1' },
  { id: 'generic_c2', name: 'KID 2' },
  { id: 'generic_c3', name: 'KID 3' },
];

// The face on each gym: canon leaders where the gracidea atlas has them
// (Norman, Brawly, Roxanne), a trainer-class stand-in for the rest — same
// atlas as TRAINER_CLASS, so the art stays Gen-3.
export const LEADER_NPC: Record<PokeType, string> = {
  normal: 'norman_down_0',
  fire: 'pokemaniac_down_0',
  water: 'sailor_down_0',
  grass: 'aroma_down_0',
  electric: 'guitarist_down_0',
  psychic: 'psychic_down_0',
  rock: 'roxanne_down_0',
  poison: 'scientist_down_0',
  flying: 'ranger_m_down_0',
  fighting: 'brawly_down_0',
  ghost: 'elder_f_down_0',
};

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
export type HazardKind = 'lava' | 'grass' | 'gust' | 'spikes' | 'static' | 'mine' | 'warp' | 'boost' | 'well' | 'power' | 'ice';
export interface HazardSpawn {
  kind: HazardKind;
  nx: number;
  ny: number;
  r: number;
  dir?: number; // gust only: -1/1, the way the wind pushes
  pair?: number; // warp only: pads sharing an id are linked
}

// Compile one room template into court furniture: '2' cells merge into
// horizontal slabs, '3' themes into lava pools (volcano) or silence
// ponds, '4' drops a mine, '5' lays a spike strip (chips the ball, walls
// grounded foes), '6' a gust lane pushing toward mid, '7' a drag patch,
// '8' an ice slick the ball barely slows on,
// 'S' lists the wave's spawn anchors.
export function buildRoom(grid: string[], theme: Theme, rng: () => number): RoomDef {
  const blocks: BlockDef[] = [];
  const hazards: HazardSpawn[] = [];
  const anchors: { nx: number; ny: number }[] = [];
  for (let r = 1; r <= 9; r++) {
    let run = -1;
    for (let c = 1; c <= 7; c++) {
      const ch = grid[r][c];
      if (ch === '2') {
        if (run < 0) run = c;
      } else if (run >= 0) {
        blocks.push({ nx: run / 9, ny: r / 11, nw: (c - run) / 9, nh: 1 / 11 });
        run = -1;
      }
      const at = { nx: (c + 0.5) / 9, ny: (r + 0.5) / 11 };
      if (ch === '3') hazards.push({ kind: theme === 'volcano' ? 'lava' : 'static', ...at, r: 0.062 });
      else if (ch === '4') hazards.push({ kind: 'mine', ...at, r: 0.05 });
      else if (ch === '5') hazards.push({ kind: 'spikes', ...at, r: 0.062 });
      else if (ch === '6') hazards.push({ kind: 'gust', ...at, r: 0.062, dir: c < 4 ? 1 : -1 });
      else if (ch === '7') hazards.push({ kind: 'grass', ...at, r: 0.062 });
      else if (ch === '8') hazards.push({ kind: 'ice', ...at, r: 0.062 });
      else if (ch === 'S') anchors.push(at);
    }
    if (run >= 0) blocks.push({ nx: run / 9, ny: r / 11, nw: (8 - run) / 9, nh: 1 / 11 });
  }
  // roamer gimmick: ~1/3 of rooms get one extra MS-style fixture —
  // a linked warp pair, a boost pad, or a gravity well
  if (rng() < 0.35) {
    const spot = (r: number) => ({
      nx: r + rng() * (1 - 2 * r),
      ny: 0.15 + rng() * (Math.min(0.55, 0.75 - r) - 0.15),
      r,
    });
    const g = rng();
    if (g < 0.4) {
      // MS warp panels: two linked pads — the ball exits the twin keeping
      // its velocity, so a bad lane can become a trick shot
      const a = spot(0.05);
      const b = spot(0.05);
      if (Math.hypot(a.nx - b.nx, a.ny - b.ny) > 0.2) {
        hazards.push({ kind: 'warp', ...a, pair: 1 }, { kind: 'warp', ...b, pair: 1 });
      }
    } else if (g < 0.7) {
      // speed-up panel: crossing it re-launches the ball faster
      hazards.push({ kind: 'boost', ...spot(0.06) });
    } else {
      // gravity barrier: the ball curves toward the well while inside
      hazards.push({ kind: 'well', nx: 0.3 + rng() * 0.4, ny: 0.2 + rng() * 0.35, r: 0.16 + rng() * 0.06 });
    }
  }
  return { blocks, hazards, anchors };
}

// Template guardrails — the rules Archero rooms live by: exact 9x11 dims,
// known tiles only, and a walkable lane from the player row to the door
// and every spawn anchor (liquids wall off anything that can't swim or
// fly; mines don't block). Runs at module load — a bad room fails the
// build, not the player.
for (const grid of [...ROOM_LAYOUTS, ROOM_BOSS]) {
  if (grid.length !== 11 || grid.some((row) => row.length !== 9)) throw new Error('room grid must be 9x11');
  const seen = new Set<string>();
  const q = [[4, 9]];
  while (q.length) {
    const [c, r] = q.pop()!;
    const k = `${c},${r}`;
    if (seen.has(k) || c < 1 || c > 7 || r < 1 || r > 9) continue;
    if (grid[r][c] !== '0' && grid[r][c] !== 'S' && grid[r][c] !== '4' && grid[r][c] !== 'P' && grid[r][c] !== '6' && grid[r][c] !== '7' && grid[r][c] !== '8') continue;
    seen.add(k);
    q.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
  }
  if (!seen.has('4,1')) throw new Error('room has no lane to the door');
  for (let r = 1; r <= 9; r++)
    for (let c = 1; c <= 7; c++) {
      const ch = grid[r][c];
      if (!'02345678SP'.includes(ch)) throw new Error(`bad room tile '${ch}'`);
      if (ch === 'S' && !seen.has(`${c},${r}`)) throw new Error('room anchor is walled in');
    }
}

