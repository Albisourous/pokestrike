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

// Bump supers recharge over SHOTS — bigger effects sit longer.
const BUMP_CD: Record<PokeType, number> = {
  normal: 1, fighting: 2, rock: 2, flying: 2, water: 2,
  electric: 2, grass: 2, poison: 2, fire: 3, ghost: 3, psychic: 3,
};
export const bumpCooldown = (t: PokeType) => BUMP_CD[t];

// Same shaping both directions: base damage, then the defender's matching
// stat shrinks it (60 stat ≈ half damage, 0 stat = full damage).
const mit = (defense: number) => 60 / (60 + defense);
export const physDamage = (atk: number, def: number, mult = 1, power = 1) =>
  Math.round(atk * power * mult * mit(def));
export const specDamage = (spa: number, spd: number, mult = 1, power = 1) =>
  Math.round(spa * power * mult * mit(spd));

// Role-based HP: players need to survive a few rounds, bosses are sponges.
export const playerHp = (s: Stats) => 60 + Math.round(s.hp * 1.15);
export const enemyHp = (s: Stats) => 40 + Math.round(s.hp * 0.9);
export const bossHp = (s: Stats) => Math.round(s.hp * 5.8);

// Speed -> motion. Spe 90 ≈ 1.35x launch; enemies approach at ~30 u/s.
export const launchMult = (s: Stats) => 0.75 + s.spe / 150;
export const enemyDrift = (s: Stats) => 12 + s.spe * 0.22;

// Enemy attacks: zap is physical, boss blast is special.
export const zapPower = 0.22;
export const blastPower = 0.15;

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
export const ROLE_BLURB: Record<Role, string> = {
  speedster: 'fast — triggers combos',
  tank: 'huge HP, soaks hits',
  sniper: 'long-range, but frail',
  bruiser: 'heavy hitter',
  healer: 'super heals the team',
  wild: 'a bit of everything',
};

// What each type's bump super does — shown on draft cards.
export const TYPE_MOVE: Record<PokeType, string> = {
  fire: 'meteor storm, nearby',
  electric: 'chain lightning',
  grass: 'drain foes, heal team',
  water: 'homing orbs x3',
  psychic: 'telekinetic shove',
  flying: 'wide gust knockback',
  poison: 'toxic cloud + dot',
  rock: 'meteor fist',
  fighting: 'meteor fist',
  ghost: 'wisp barrage, all foes',
  normal: 'dash slash',
};
