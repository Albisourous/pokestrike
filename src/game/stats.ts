import type { PokeType } from './types';

// Canonical Pokémon base stats.
export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

// Physical bump attacks use Attack vs Defense; everything else is special.
const PHYS_BUMP: ReadonlySet<PokeType> = new Set(['normal', 'rock', 'fighting']);
export const bumpIsPhysical = (t: PokeType) => PHYS_BUMP.has(t);

// Bump supers recharge over SHOTS, starting at zero charge — bigger effects
// take longer to build so each firing is an event, not spam.
const BUMP_CD: Record<PokeType, number> = {
  normal: 2, fighting: 3, rock: 3, flying: 3, water: 3,
  electric: 3, grass: 3, poison: 3, fire: 4, ghost: 4, psychic: 4,
};
export const bumpCooldown = (t: PokeType) => BUMP_CD[t];

// What the bump super actually does — surfaced on scout cards and the
// help index. Keep synced with the bumpAlly switch in battle.ts.
export const SUPER_DESC: Record<PokeType, string> = {
  normal: 'dash-slams the nearest foe',
  fighting: 'meteors rain on far foes',
  rock: 'meteors rain on far foes',
  flying: 'vortex piles foes together',
  water: 'orbs hunt the nearest foes',
  electric: 'lightning chains foe to foe',
  grass: 'drains foes, heals the team',
  poison: 'toxins bleed foes each shot',
  fire: 'flame ring + homing fireballs',
  ghost: 'hex hits every foe at once',
  psychic: 'shockwave flings foes away',
};

// Signature supers that replace the type default — keep synced with the
// signatureMove switch in battle.ts.
export const MOVE_DESC: Record<string, string> = {
  'HYPER BEAM': 'a fat beam pierces the farthest foe',
  'SOLARBEAM': 'a fat beam pierces the farthest foe',
  'HYDRO CANNON': 'a fat beam punches through the pack',
  'ZAP CANNON': 'a thunderball hunts the farthest foe',
  'PSYCHO BOOST': 'huge burst on the biggest foe',
  'ERUPTION': 'staggered bursts rock the whole pack',
  'EXPLOSION': 'hits every foe — costs 15% HP',
  'BLAST BURN': 'a fire wave scorches all it sweeps',
  'FRENZY PLANT': 'drain orbs hunt the farthest foes',
  'OUTRAGE': 'three smashes on the nearest foe',
  'SHEER COLD': 'flash-freeze bursts the nearest foe',
};

// Move-aware super description: signature nukes override the type line.
export const superDesc = (id: number, type: PokeType): string =>
  MOVE_DESC[moveOf(id, type)] ?? SUPER_DESC[type];

// Same shaping both directions: base damage, then the defender's matching
// stat shrinks it (60 stat ≈ half damage, 0 stat = full damage).
const mit = (defense: number) => 60 / (60 + defense);
export const physDamage = (atk: number, def: number, mult = 1, power = 1) =>
  Math.round(atk * power * mult * mit(def));
export const specDamage = (spa: number, spd: number, mult = 1, power = 1) =>
  Math.round(spa * power * mult * mit(spd));

// Role-based HP: players need to survive a few rounds, bosses are sponges.
export const playerHp = (s: Stats) => 60 + Math.round(s.hp * 1.15);
export const enemyHp = (s: Stats) => 50 + Math.round(s.hp * 1.0);
// ~2/3 the old bulk — summons, hops and the attack rotation carry the
// fight's difficulty now instead of a long HP wall
export const bossHp = (s: Stats) => Math.round(s.hp * 4.4);

// Speed -> motion. Spe 90 ≈ 1.35x launch; enemies approach at ~30 u/s.
export const launchMult = (s: Stats) => 0.75 + s.spe / 150;
export const enemyDrift = (s: Stats) => 12 + s.spe * 0.22;

// Enemy attacks: zap is physical, boss blast is special.
export const zapPower = 0.28;
export const blastPower = 0.2;

// --- Roles, derived from real stats ---
// Fast mons are combo triggers, defensive mons are tanks, high-SpA frail mons
// are snipers, high-Atk mons are bruisers, flagged species are healers.
export type Role = 'speedster' | 'tank' | 'sniper' | 'bruiser' | 'healer' | 'wild';

export const roleOf = (s: Stats, healer = false): Role => {
  if (healer) return 'healer';
  if (s.spe >= 90) return 'speedster';
  if (s.spa >= 100 && s.hp <= 80) return 'sniper';
  if (s.hp + s.def + s.spd >= 250) return 'tank';
  if (s.atk >= 100) return 'bruiser';
  return 'wild';
};

export interface RoleMods {
  launch: number; // launch speed multiplier on top of the speed formula
  hp: number;
  pow: number; // damage multiplier on contact + supers
  range: number; // super radius multiplier
  cdMod: number; // shots off the super cooldown
}
export const ROLE_MODS: Record<Role, RoleMods> = {
  speedster: { launch: 1.3, hp: 1, pow: 0.9, range: 1, cdMod: 1 },
  tank: { launch: 0.8, hp: 1.4, pow: 0.9, range: 1, cdMod: 0 },
  sniper: { launch: 1, hp: 0.8, pow: 1.35, range: 1.5, cdMod: 0 },
  bruiser: { launch: 0.95, hp: 1.15, pow: 1.3, range: 1, cdMod: 0 },
  healer: { launch: 1, hp: 1, pow: 0.8, range: 1, cdMod: 0 },
  wild: { launch: 1, hp: 1.05, pow: 1.05, range: 1, cdMod: 0 },
};

// Gen 3 stat growth: floor((2*Base + IV + EV/4) * Level/100) + 5, and
// HP adds +Level +10. Wild mons roll IV 31, no EVs, neutral nature.
export const statAt = (base: number, lvl: number) => Math.floor(((2 * base + 31) * lvl) / 100) + 5;
export const hpAt = (base: number, lvl: number) => Math.floor(((2 * base + 31) * lvl) / 100) + lvl + 10;

// Levels run 1-100. Multipliers normalize at Lv5, the lowest a fresh mon
// spawns, so baseline units are unchanged and growth follows the real
// curve. Pow rides the mon's offensive stat (Atk vs SpA by bump type).
export const LV_CAP = 100;
const LV_BASE = 5;
export const offStat = (s: Stats, t: PokeType) => (bumpIsPhysical(t) ? s.atk : s.spa);
export const lvlPow = (base: number, lvl: number) => statAt(base, lvl) / statAt(base, LV_BASE);
export const lvlHp = (base: number, lvl: number) => hpAt(base, lvl) / hpAt(base, LV_BASE);

// Real move names, shouted when the super fires.
export const MOVE_NAME: Record<PokeType, string> = {
  fire: 'FIRE BLAST',
  electric: 'THUNDER',
  grass: 'GIGA DRAIN',
  water: 'HYDRO PUMP',
  psychic: 'PSYCHIC',
  flying: 'HURRICANE',
  poison: 'TOXIC',
  rock: 'STONE EDGE',
  fighting: 'CLOSE COMBAT',
  ghost: 'SHADOW BALL',
  normal: 'QUICK ATTACK',
};

// Per-species signature moves — canon movepool picks, so Pikachu fires
// THUNDERBOLT instead of generic THUNDER. Type table is the fallback.
export const MOVE_OF: Record<number, string> = {
  // roster
  1: 'RAZOR LEAF', 4: 'FLAMETHROWER', 7: 'SKULL BASH', 25: 'THUNDERBOLT',
  32: 'HORN DRILL', 35: 'METRONOME', 37: 'FIRE SPIN', 39: 'HYPER VOICE',
  52: 'PAY DAY', 54: 'ZEN HEADBUTT', 60: 'BUBBLE', 66: 'KARATE CHOP',
  92: 'NIGHT SHADE', 95: 'ROCK SLIDE', 104: 'BONEMERANG', 129: 'SPLASH',
  132: 'TRANSFORM', 133: 'SWIFT', 179: 'THUNDERSHOCK', 183: 'ROLLOUT',
  194: 'MUD SHOT', 280: 'CONFUSION', 285: 'MEGA DRAIN', 293: 'UPROAR',
  304: 'ROCK TOMB', 328: 'CRUNCH', 349: 'SPLASH', 361: 'ICY WIND',
  363: 'AURORA BEAM',
  // elites
  3: 'FRENZY PLANT', 9: 'HYDRO CANNON', 34: 'MEGAHORN', 59: 'EXTREMESPEED',
  65: 'FUTURE SIGHT', 68: 'DYNAMICPUNCH', 76: 'EXPLOSION', 94: 'DREAM EATER',
  113: 'SOFTBOILED', 115: 'DIZZY PUNCH', 123: 'AERIAL ACE', 125: 'THUNDERPUNCH',
  131: 'SHEER COLD', 134: 'AURORA BEAM', 135: 'SHOCK WAVE', 136: 'OVERHEAT',
  142: 'ANCIENT POWER', 143: 'BODY SLAM', 154: 'SOLARBEAM', 157: 'ERUPTION',
  160: 'CRUNCH', 169: 'SLUDGE BOMB', 181: 'ZAP CANNON', 196: 'PSYBEAM',
  197: 'FEINT ATTACK', 212: 'METAL CLAW', 229: 'FIRE FANG', 257: 'BLAZE KICK',
  282: 'HYPNOSIS', 289: 'FOCUS PUNCH', 306: 'IRON TAIL', 350: 'ICE BEAM',
  373: 'DRAGON CLAW',
  // invaders
  144: 'BLIZZARD', 145: 'DRILL PECK', 146: 'HEAT WAVE', 151: 'METRONOME',
  243: 'SPARK', 244: 'FIRE FANG', 245: 'BUBBLEBEAM', 251: 'FUTURE SIGHT',
  377: 'SUPERPOWER', 378: 'ZAP CANNON', 379: 'HYPER BEAM', 380: 'MIST BALL',
  381: 'LUSTER PURGE', 382: 'WATER SPOUT', 383: 'FISSURE', 384: 'OUTRAGE',
  // wild lines & bosses worth a name (catchable → becomes your move too)
  6: 'BLAST BURN', 12: 'SILVER WIND', 18: 'WING ATTACK', 24: 'POISON FANG',
  38: 'EXTRASENSORY', 40: 'DOUBLE EDGE', 45: 'PETAL DANCE', 57: 'CROSS CHOP',
  62: 'BRICK BREAK', 67: 'SEISMIC TOSS', 80: 'WATER PULSE', 89: 'SLUDGE',
  91: 'SPIKE CANNON', 93: 'SHADOW PUNCH', 99: 'CRABHAMMER', 105: 'BONE RUSH',
  110: 'SMOG', 119: 'WATERFALL', 121: 'RAPID SPIN', 127: 'GUILLOTINE',
  130: 'TWISTER', 137: 'TRI ATTACK', 141: 'SLASH', 148: 'DRAGON RAGE',
  149: 'HYPER BEAM', 150: 'PSYCHO BOOST', 180: 'SIGNAL BEAM', 184: 'ICE PUNCH',
  195: 'EARTHQUAKE', 217: 'THRASH', 232: 'MAGNITUDE', 262: 'THIEF',
  271: 'ASTONISH', 274: 'RAZOR WIND', 277: 'ENDEAVOR', 281: 'MAGICAL LEAF',
  286: 'MACH PUNCH', 294: 'HYPER VOICE', 297: 'ARM THRUST', 310: 'SPARK',
  319: 'CRUNCH', 329: 'DRAGONBREATH', 332: 'NEEDLE ARM', 342: 'CRABHAMMER',
  354: 'SHADOW SNEAK', 356: 'SHADOW PUNCH', 362: 'ICE BEAM', 364: 'ICE BALL',
};

export const moveOf = (id: number, type: PokeType): string => MOVE_OF[id] ?? MOVE_NAME[type];

