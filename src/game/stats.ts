import type { PokeType } from './types';
import { traitTier } from './traits';

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
  normal: 'an unmissable dash slams the nearest, then chains to the next',
  fighting: 'dashes in for a jab chain · the uppercut launches and flinches',
  rock: 'jabs up close, then meteors rain on the farthest',
  flying: 'a vortex piles foes up, then pops them skyward, scrambled',
  water: 'a firehose jet pierces the court; rain widens the lane',
  electric: 'lightning hops foe to foe · a hot combo arcs wider and bites harder',
  grass: 'drains and roots the pack, spores chase too',
  poison: 'a rolling toxic cloud · the already-poisoned detonate their venom',
  fire: 'flame ring, then fireballs hunt the farthest; sun ignites burns',
  ghost: 'wisps creep in, then dart · they feast on the poisoned',
  psychic: 'a telekinetic lift, then a shockwave fling · walls pay a slam bonus',
};

// Signature supers that replace the type default — keep synced with the
// signatureMove switch in battle.ts.
export const MOVE_DESC: Record<string, string> = {
  'HYPER BEAM': 'a long charge · the fattest beam scorches a lane to the far wall',
  'SOLAR BEAM': 'drinks the light, then a green lance · petals mark the lane',
  'HYDRO CANNON': 'a compressed jet floods the lane and shoves the pack along it',
  'ZAP CANNON': 'a fat thunderball hunts the farthest foe and paralyzes it',
  'PSYCHO BOOST': 'a psychic charge detonates on the biggest target',
  'ERUPTION': 'the court vents, then fire pillars burst under the whole pack',
  'EXPLOSION': 'hits everything on the court · costs the caster 15% HP',
  'BLAST BURN': 'the caster ignites · a rolling fire wave scorches the court',
  'FRENZY PLANT': 'vines spear the four farthest foes · drain orbs ride them',
  'OUTRAGE': 'a rampage of three crescendo smashes on the nearest enemy',
  'SHEER COLD': 'frost converges, then the air shatters around the mark',
  'METRONOME': 'wags a finger and casts a rolled signature nuke',
  'FUTURE SIGHT': 'marks where the far foe stands · a sky-lance lands moments later',
  'CRUNCH': 'fangs close on the nearest enemy · it flinches a beat',
  'ICE BEAM': 'a surgical icy lance · everything speared locks up stiff',
  'HYPER VOICE': 'three echoing rings rattle every enemy',
  'THUNDERBOLT': 'a crackling charge, one fat bolt on the farthest, two chain hops',
  'FLAMETHROWER': 'a widening cone of flame · everything swept keeps burning',
  'SPLASH': '…nothing happens',
  'WATER SPOUT': 'geysers erupt under the pack · fuller HP floods harder',
  'FISSURE': 'the ground growls, then a crack races to the farthest grounded foe',
  'SEISMIC TOSS': 'hurls the nearest foe skyward · the slam scales with level',
  'ENDEAVOR': "drags the nearest foe down to the caster's own HP fraction",
  // more canon picks — names without a SIGNATURES case wear the move on
  // the card while the type super does the work underneath
  'SEED BOMB': 'a hard-shelled seed barrage bursts on the mark',
  'FLAME WHEEL': 'a rolling wheel of fire runs the nearest foe down',
  'BUBBLEBEAM': 'a forceful jet of bubbles sprays the target',
  'DRAGON RAGE': 'a shockwave of pure draconic fury',
  'FORCE PALM': 'a point-blank palm blast that can leave the mark paralyzed',
  'AURA SPHERE': 'an unmissable orb of aura homes in on the mark',
  'ROAR OF TIME': 'a roar that warps time around the target',
  'SPACIAL REND': 'a rend tears the lane · space snaps shut for a second hit',
  'MAGMA STORM': 'a magma vortex drags the pack in and keeps it burning',
  'DARK VOID': 'a pitch-black void drags every foe into sleep',
  'SEED FLARE': 'a seed arcs onto the biggest mark and blooms over the pack',
  'JUDGMENT': 'countless pellets of light rain down on the pack',
  'V-CREATE': 'a blazing V-shaped dive · the hottest flame there is',
  'LEAF TORNADO': 'a cyclone of razor leaves whips through the pack',
  'RAZOR SHELL': 'a scalchop slash peels the nearest foe',
  'NIGHT DAZE': 'a wave of darkness swallows the court',
  'WILL-O-WISP': 'ghostly blue flames flicker onto the mark and burn',
  'FLAME CHARGE': 'the caster charges in cloaked in flame',
  'FIERY DANCE': 'a flaming dance scorches the nearest foe',
  'SACRED SWORD': 'a horn slash that cuts past any defense',
  'BLUE FLARE': 'a beautiful blue jet · the far mark takes the heart of it',
  'BOLT STRIKE': 'a colossal bolt falls from the sky onto the biggest foe',
  'GLACIATE': 'a freezing gale sweeps the court and chills every enemy',
  'TECHNO BLAST': 'a charged techno beam fires down the lane',
  // the late-mythic picks — each maps a species in MOVE_OF and carries a
  // bespoke SIGNATURES act
  'DRACO METEOR': 'meteors rain down on the pack one by one',
  'GIGA IMPACT': 'a full-body charge plows the nearest · the shockwave staggers the rest',
  'MOONBLAST': 'a pale moonbeam falls on the biggest foe · stardust settles after',
  'SHADOW FORCE': "the caster vanishes, then strikes from inside the far foe's shadow",
  'LEAF BLADE': "a razor leaf sweeps everything within a blade's reach",
  'X-SCISSOR': 'two blades cross into an X on the nearest foe',
  'EARTH POWER': 'the ground erupts under the pack · flyers stay out of reach',
  'FLASH CANNON': 'a mirror-bright lance pierces the lane · glints scatter after',
  'DARK PULSE': 'a ring of dark aura rattles the court and flinches the pack',
  'POWER GEM': 'a ray of gem light · shards ricochet into the pack',
  'PSYSTRIKE': "a shockwave that strikes the body's defense · the echo hits twice",
  'SACRED FIRE': 'a sacred fireball arcs to the far mark and leaves it burning',
  'AEROBLAST': 'a vortex of wind hurls everything on the far lane skyward',
  'DOOM DESIRE': 'a wish marked on the biggest foe · sky-rays answer moments later',
  'DRAGON ASCENT': 'the caster rockets off and dives the far mark from the ceiling',
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

// MS hit floor: any connected hit deals at least 1; type immunity (×0) stays 0
export const hitFloor = (raw: number, mult: number) => (mult > 0 ? Math.max(1, Math.round(raw)) : 0);

// Role-based HP: players need to survive a few rounds, bosses are sponges.
export const playerHp = (s: Stats) => 60 + Math.round(s.hp * 1.15);
export const enemyHp = (s: Stats) => 50 + Math.round(s.hp * 1.0);
// ~1/3 the old bulk — summons, hops and the attack rotation carry the
// fight's difficulty now instead of a long HP wall
export const bossHp = (s: Stats) => Math.round(s.hp * 2.2);

// MS clamps the speed curve to 0.7..1.4; Spe 75 = 1.0. The flying trait is
// a team Tailwind — its tier multiplies past the clamp so the dodge type
// also pays on the launch dial (momentum turns raw speed into damage).
export const launchMult = (s: Stats) => {
  const k = s.spe / 75;
  return Math.min(1.4, Math.max(0.7, (0.8 + 0.2 * k) * k)) * (1 + traitTier('flying') * 0.05);
};
export const enemyDrift = (s: Stats) => 12 + s.spe * 0.22;

// Enemy attacks: zap is physical, boss blast is special.
export const zapPower = 0.28;
export const blastPower = 0.2;
// Glass-cannon bosses: half the HP, so each hit has to land harder to keep
// the fight tense over the shorter clock.
export const bossPow = 1.5;
// Everything hostile hits harder — the general difficulty knob.
export const foePow = 1.25;

// --- Roles, derived from real stats ---
// A mon's specialty is its dominant base stat; flagged species are medics.
// Ties pay out to the first stat in the order below. 'wild' stays in the
// union for filler enemies — every real species lands a specialty.
export type Role = 'MEDIC' | 'BULWARK' | 'STRIKER' | 'WARDEN' | 'SNIPER' | 'GUARDIAN' | 'SCOUT' | 'wild';

// the signature is the species-shaped {stats, healer}; a bare Stats arg keeps
// older callers passing (def.stats, def.healer) working
export function roleOf(d: { stats: Stats; healer?: boolean } | Stats, healer = false): Role {
  const s = 'stats' in d ? d.stats : d;
  if ('healer' in d ? d.healer : healer) return 'MEDIC';
  const keys = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
  const roles = ['BULWARK', 'STRIKER', 'WARDEN', 'SNIPER', 'GUARDIAN', 'SCOUT'] as const;
  let best = 0;
  for (let i = 1; i < keys.length; i++) if (s[keys[i]] > s[keys[best]]) best = i;
  return roles[best];
}

export interface RoleMods {
  launch: number; // launch speed multiplier on top of the speed formula
  hp: number;
  pow: number; // damage multiplier on contact + supers
  range: number; // super radius multiplier
  cdMod: number; // shots off the super cooldown
}
export const ROLE_MODS: Record<Role, RoleMods> = {
  MEDIC: { launch: 1, hp: 1, pow: 0.8, range: 1, cdMod: 0 },
  // the defensive trio share the old tank kit — bulk is bulk
  BULWARK: { launch: 0.8, hp: 1.4, pow: 0.9, range: 1, cdMod: 0 },
  STRIKER: { launch: 0.95, hp: 1.15, pow: 1.3, range: 1, cdMod: 0 },
  WARDEN: { launch: 0.8, hp: 1.4, pow: 0.9, range: 1, cdMod: 0 },
  SNIPER: { launch: 1, hp: 0.8, pow: 1.35, range: 1.5, cdMod: 0 },
  GUARDIAN: { launch: 0.8, hp: 1.4, pow: 0.9, range: 1, cdMod: 0 },
  SCOUT: { launch: 1.3, hp: 1, pow: 0.9, range: 1, cdMod: 1 },
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
  normal: 'EXTREMESPEED',
};

// Per-species signature moves — canon movepool picks, so Pikachu fires
// THUNDERBOLT instead of generic THUNDER. Type table is the fallback.
export const MOVE_OF: Record<number, string> = {
  // roster
  1: 'RAZOR LEAF', 4: 'FLAMETHROWER', 7: 'SKULL BASH', 25: 'THUNDERBOLT',
  32: 'HORN DRILL', 35: 'METRONOME', 37: 'FIRE SPIN', 39: 'HYPER VOICE',
  52: 'PAY DAY', 54: 'ZEN HEADBUTT', 60: 'BUBBLE', 66: 'KARATE CHOP',
  92: 'NIGHT SHADE', 95: 'ROCK SLIDE', 104: 'BONEMERANG', 129: 'SPLASH',
  132: 'TRANSFORM', 133: 'SWIFT', 147: 'TWISTER', 179: 'THUNDERSHOCK', 183: 'ROLLOUT',
  194: 'MUD SHOT', 280: 'CONFUSION', 285: 'MEGA DRAIN', 293: 'UPROAR',
  304: 'ROCK TOMB', 328: 'CRUNCH', 349: 'SPLASH', 361: 'ICY WIND',
  363: 'AURORA BEAM',
  // elites
  3: 'FRENZY PLANT', 9: 'HYDRO CANNON', 34: 'MEGAHORN', 59: 'EXTREMESPEED',
  65: 'FUTURE SIGHT', 68: 'DYNAMICPUNCH', 76: 'EXPLOSION', 94: 'DREAM EATER',
  113: 'SOFTBOILED', 115: 'DIZZY PUNCH', 123: 'AERIAL ACE', 125: 'THUNDERPUNCH',
  131: 'SHEER COLD', 134: 'AURORA BEAM', 135: 'SHOCK WAVE', 136: 'OVERHEAT',
  142: 'ANCIENT POWER', 143: 'BODY SLAM', 154: 'SOLAR BEAM', 157: 'ERUPTION',
  160: 'CRUNCH', 169: 'SLUDGE BOMB', 181: 'ZAP CANNON', 196: 'PSYBEAM',
  197: 'FEINT ATTACK', 212: 'X-SCISSOR', 229: 'FIRE FANG', 257: 'BLAZE KICK',
  282: 'MOONBLAST', 289: 'GIGA IMPACT', 306: 'IRON TAIL', 350: 'ICE BEAM',
  373: 'DRACO METEOR',
  // invaders
  144: 'BLIZZARD', 145: 'DRILL PECK', 146: 'HEAT WAVE', 151: 'METRONOME',
  243: 'SPARK', 244: 'FIRE FANG', 245: 'BUBBLEBEAM', 249: 'AEROBLAST',
  250: 'SACRED FIRE', 251: 'FUTURE SIGHT',
  377: 'SUPERPOWER', 378: 'ZAP CANNON', 379: 'FLASH CANNON', 380: 'MIST BALL',
  381: 'LUSTER PURGE', 382: 'WATER SPOUT', 383: 'FISSURE', 384: 'DRAGON ASCENT',
  385: 'DOOM DESIRE', 386: 'PSYCHO BOOST',
  // wild lines & bosses worth a name (catchable → becomes your move too)
  6: 'BLAST BURN', 12: 'SILVER WIND', 18: 'WING ATTACK', 24: 'POISON FANG',
  36: 'MOONBLAST', 38: 'EXTRASENSORY', 40: 'DOUBLE EDGE', 45: 'PETAL DANCE', 57: 'CROSS CHOP',
  62: 'BRICK BREAK', 67: 'SEISMIC TOSS', 80: 'WATER PULSE', 89: 'SLUDGE',
  91: 'SPIKE CANNON', 93: 'SHADOW PUNCH', 99: 'CRABHAMMER', 105: 'BONE RUSH',
  110: 'SMOG', 119: 'WATERFALL', 121: 'POWER GEM', 127: 'GUILLOTINE',
  130: 'TWISTER', 137: 'TRI ATTACK', 141: 'SLASH', 148: 'DRAGON RAGE',
  149: 'HYPER BEAM', 150: 'PSYSTRIKE', 180: 'SIGNAL BEAM', 184: 'ICE PUNCH',
  195: 'EARTHQUAKE', 217: 'THRASH', 232: 'MAGNITUDE', 262: 'THIEF',
  271: 'ASTONISH', 274: 'RAZOR WIND', 277: 'ENDEAVOR', 281: 'MAGICAL LEAF',
  286: 'MACH PUNCH', 294: 'HYPER VOICE', 297: 'ARM THRUST', 310: 'SPARK',
  319: 'CRUNCH', 329: 'DRAGONBREATH', 332: 'NEEDLE ARM', 342: 'CRABHAMMER',
  354: 'SHADOW SNEAK', 356: 'SHADOW PUNCH', 362: 'ICE BEAM', 364: 'ICE BALL',
  // late gen 2-3 bosses
  205: 'EXPLOSION', 248: 'OUTRAGE', 254: 'LEAF BLADE', 295: 'HYPER VOICE',
  321: 'WATER SPOUT', 340: 'FISSURE', 365: 'SHEER COLD',
  // gen 4-5 — names with no castSignature case only brand the card, then
  // fall through to the type super
  387: 'SEED BOMB', 389: 'FRENZY PLANT', 390: 'FLAME WHEEL', 392: 'BLAST BURN',
  393: 'BUBBLEBEAM', 395: 'HYDRO CANNON', 443: 'DRAGON RAGE', 445: 'DRACO METEOR',
  447: 'FORCE PALM', 448: 'AURA SPHERE', 462: 'FLASH CANNON', 470: 'LEAF BLADE',
  471: 'ICE BEAM',
  483: 'ROAR OF TIME', 484: 'SPACIAL REND', 485: 'MAGMA STORM', 487: 'SHADOW FORCE',
  491: 'DARK VOID',
  492: 'SEED FLARE', 493: 'JUDGMENT', 494: 'V-CREATE', 495: 'LEAF TORNADO',
  497: 'FRENZY PLANT', 500: 'BLAST BURN', 501: 'RAZOR SHELL', 503: 'HYDRO CANNON',
  523: 'THUNDERBOLT', 553: 'CRUNCH', 555: 'FLAMETHROWER', 570: 'NIGHT DAZE',
  571: 'NIGHT DAZE', 584: 'ICE BEAM', 596: 'THUNDERBOLT', 604: 'THUNDERBOLT',
  607: 'WILL-O-WISP', 609: 'FLAMETHROWER', 610: 'DRAGON RAGE', 612: 'OUTRAGE',
  614: 'ICE BEAM', 615: 'ICE BEAM', 635: 'DARK PULSE', 636: 'FLAME CHARGE',
  637: 'FIERY DANCE', 638: 'SACRED SWORD', 639: 'SACRED SWORD', 640: 'SACRED SWORD',
  643: 'BLUE FLARE', 644: 'BOLT STRIKE', 645: 'EARTH POWER', 646: 'GLACIATE',
  649: 'TECHNO BLAST',
};

export const moveOf = (id: number, type: PokeType): string => MOVE_OF[id] ?? MOVE_NAME[type];
