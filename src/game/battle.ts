import { Vec, len, dist, norm, vec } from '../core/vec';
import { mulberry32 } from '../core/rng';
import { Treasure } from './loot';
import { Missions } from './missions';
import { Connect } from './connect';
import { Flee } from './flee';
import { drawMon, drawShiny, whiteSprite, itemSprite, drawNpc, loadItem } from '../core/assets';
import { sfx, buzz, music, playJingle, weatherBed, BIOME_TRACK, TRAINER_TRACK, GYM_STAB, cry, setIntensity } from '../core/audio';
import type { Sfx } from '../core/audio';
import { SpeciesDef, StageDef, WaveSpawn, rollWave, trainerWave, TRAINER_CLASS, TOTAL_STAGES, ROSTER, ELITES, EVOS, INVADERS, ENEMY_DB, BOSS_POOL, buildRoom, genRoom, rivalWave, ROOM_LAYOUTS, ROOM_HARD, pickWild, bst, speciesById, RAID_MODS, TYPE_THEME, THEME_NAME, foeClocks, TYPE_MOVE, EVO_LINES, LEADER_NPC, type FoeMoveKind } from './data';
import { Perk, rollPerks, PERKS, BAG_ITEMS, perkTick } from './perks';
import type { Rarity } from './perks';
import { rollEvent, martStock, tickDaycare } from './events';
import type { EventChoice, EventArt, EventOutcome } from './events';
import { drawStopScene } from './stops';
import { taskViews, taskTick } from './tasks';
import type { TaskKind } from './tasks';
import { teamTraits } from './traits';
import { recordCapture, recordShiny, unlockAch, ACHIEVEMENTS, earnBadge, gymBadges, BADGES, settings, bankBag, addStars, starBoost, labLevel, trainerPick, bondLv, itemTier, ultHintSeen, markUltHintSeen, clearRank, recordClear, RANK_PAY, best, teamSlots, type ClearCard, type ClearRank, type RunSave, type Settings } from './meta';
import { drawBackdrop, drawWall, drawAmbient, drawSlice, drawCover, drawMoat, THEMES, hash } from './bg';
import { uiWindow, INK, PAPER, PARCH, GOLD_HI, SP, overlayPop } from './ui';
import type { Theme } from './bg';
import { typeMult, strikeType, TYPE_COLOR, weatherMult, WEATHER_LINE, WEATHER_TINT, WEATHER_OF, TYPES } from './types';
import { genRegion, RegionMap, MapNode, MAP_W, MAP_H, drawTile, routePath, T_WATER, T_SAND, T_GRASS } from './map';
import * as MT from './maptiles';
import { gracidea } from '../core/assets';
import type { PokeType, Weather } from './types';
import { STAGE_GIMMICKS, BULLET_GIMMICKS, DRAIN_MOVE, DRAIN_PCT, isGentleRoom, bulletHints, type BulletGimmick, fieldRoomReachable, type BlockDef, type DamageWall, type HazardKind } from './data';
import { Telops } from './telop';
import { startEvo } from './evolve';
import { installField2, stepField2, drawField2, drawField2Floor, blockField2, labelField2, type Field2, type Field2Fx } from './gimmicks2';
import { abilityNotice } from './abilities';
import { abilityHazard, abilityWall, abilitySturdy, abilityReflect, abilityAttack, abilitySpeed, abilityIntimidate, abilityLabel, weatherSpeed, resetAbilities, countersGimmick } from './abilities';
import { poisonProof, sleepProof, paraProof, burnProof, confuseProof, charmProof, dustProof, statWall, pierceShroud, barbHide, barbChip, aftermathKO, oozeBlood, rockSkull, graceOdds, scavenger, absorbType, clockDrag, nightmare } from './abilities';
import { gaugeCounter, counterLive, quietOpener, GAUGE_ICON } from './gauge';
import { recipeFor, beam as animBeam, burst as animBurst, rain as animRain, ring as animRing, stepAnims, drawAnims, drawTell, drawTellRing, drainAnimRequests, clearAnims, type Recipe } from './anim';
import { stepFx, drawFx, burst as fxBurst, impact as fxImpact, flavor as fxFlavor, act as vfxAct, chargeMotes, impactRing, pixelExplosion, pillarSpout, slashArc, smokeColumn, screenLines, aura, pickRamp, TYPE_RAMP, FX_MAX, starPath, STAR_4, STAR_28, type Fx, type ActBeat, type ActHooks } from './vfx';
import { wpRng, hideWpRate, hideWeakPoints } from './weakpoint';
import { maybeSecret, enterSecret, secretWon, secretFled, closeSecret, drawSecretNode, secretSave, secretLoad, bossRooms, secretTheme, type SecretState } from './secret';
import { MID_SCALE, MID_HP, MID_SIG, midBossStop, evolveOnce, midBossPick, drawMidBar } from './midboss';
import { castTypeSuper, castNamedSuper, flies, type SuperCtx } from './supers';

import {
  playerHp,
  enemyHp,
  bossHp,
  enemyDrift,
  launchMult,
  physDamage,
  specDamage,
  hitFloor,
  bumpIsPhysical,
  zapPower,
  blastPower,
  bossPow,
  foePow,
  bumpCooldown,
  roleOf,
  ROLE_MODS,
  moveOf,
  superDesc,
  LV_CAP,
  offStat,
  lvlPow,
  lvlHp,
} from './stats';
import type { Role } from './stats';
import { font, fontB, fitFont, fitFontB, fitCenter, roundRect, button, wrap2, MAP_MENU, drawPauseCard } from './screens';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Unit {
  uid: number;
  def: SpeciesDef;
  side: 'player' | 'enemy';
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  timer: number; // enemy countdown; attacks when it hits 0
  clocks: { kind: FoeMoveKind; move: string; turn: number; t: number; drain?: boolean; type?: PokeType }[];
  safeguard?: boolean; // heart barrier: immune until a berry is grabbed
  drift: number; // enemy approach speed (u/s); players always 0
  // wander state — enemies jitter and occasionally dart
  wx: number;
  wy: number;
  wT: number;
  wMul: number;
  lunging: number; // >0 while mid-lunge (melee attack in flight)
  boss: boolean;
  bars?: readonly number[];
  mid?: boolean; // MS mid-boss: the last battle's strongest foe, evolved
  bigT: number; // boss heavy-attack countdown (MS bosses run several clocks); 0 = none
  shiny: boolean; // rare alt-palette spawn — always caught when KO'd
  dead: boolean;
  dotTicks: number; // poison ticks remaining
  dotDmg: number;
  burnT: number; // burn rounds left — softens hits and singes each round
  paraT: number; // paralysis rounds left — the launch limps while it lasts
  confuseT: number; // confusion rounds — the next launch veers off-line
  cd: number; // player bump-super recharge in shots; 0 = ready
  cdMax: number; // threshold the pips count up to
  lastBump: number; // last time a pass-through triggered this ally
  role: Role; // stat-derived archetype
  sash: boolean; // focus sash: survive one lethal hit at 1 HP
  enraged?: boolean; // ascension, raid or wounded berserker attack boost
  phaseRage?: boolean; // final-bar power and clock boost, applied once
  lvl: number; // player level — KOs feed the shooter (0 = enemy)
  pow: number; // role damage multiplier
  rngMul: number; // role super-range multiplier
  launch: number; // role launch-speed multiplier
  cdMod: number; // shots off the super cooldown
  lastHit: Map<number, number>; // shooter uid -> game time
  wallN: number; // wall bounces so far this shot (grip claw ramp)
  hzT: number; // last hazard tick — throttles lava/spike chips and burns
  giant?: boolean; // GIGA ROMP'd — swollen hitbox until its shot ends, ×2 contact
  relic?: string; // held-item sprite name — gym bosses roll one quirk each
  sq: number; // squash impulse 0..1 — decays in update, flattens the sprite
  flashT: number; // hit-flash clock — the sprite redraws white-hot on impact
  sumStage: number; // boss bar index (0..2)
  atkN: number; // boss attack count — every 3rd is a teleport, not a blast
  weakA: number; // weak point angle — regular foes ×2, bosses ×3
  weakA2?: number; // bosses carry a second weak face (MS multi-circle hitboxes)
  wpHidden?: boolean; // MS hidden weak point: unmarked until the first contact
  wpPopT?: number; // reveal time — the WEAK POINT! label fades off it
  shieldA: number; // shelled foes: the shell's facing — front hits glance, back hits flank
  regenT: number; // regen foes: sparkle throttle — a green puff every ~1.5s of mending
  minion?: boolean; // summoned add — while any live, the boss is guarded
  volatile?: boolean; // VOLATILE wave mod — a KO bursts, splashing neighbors
  supp?: 'medic' | 'aegis'; // support foe — heals or shields the pack on its turn
  link?: Unit; // zombie pair — falls while its partner lives → resurrects
  revives: number; // soul-link charges left — capped so a weak team can't hard-stall
  skull?: boolean; // skull-marked — the KO pays a bounty (MS skull icon)
  gravR: number; // gravity aura radius — the ball crawls inside the bubble
  repelR: number; // repulsor field radius — the ball gets shoved off approach
  shieldN: number; // aegis wards — each stack negates one incoming hit
  airborne?: boolean; // SKY wave mod — the pack takes wing: creeps cross moats/boulders
  asleep?: boolean; // SLEEPY species — timer frozen till the first hit lands
  warpT: number; // last warp ride — cooldown stops portal ping-pong
  boostT: number; // last boost-pad kick — throttle so pads can't stack hits
  hpLag?: number; // display-only wound trail — drains toward hp so hits read
  blinkT: number;
  stolen?: PickupKind; // a thief's pocket — re-drops when the body drops // BLINK foes: countdown to the next teleport — shimmer tells first
  boostN: number; // SPEED BOOST foes: attacks launched — each re-arm winds it tighter
  armorN: number; // WEAK ARMOR: shell cracks — faster but softer each hit
  atkMul: number; // MOXIE: kills it causes sharpen its own attacks
  lastStand: boolean; // final-gym ace: already burned its one refusal
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
  big: boolean;
  gold?: boolean; // weak-point damage: gold face, amber rim
  size?: number; // scale multiplier — damage numbers grow with the hit
  life?: number; // stamped on first frame so easings know the full span
  tilt?: number; // radians of lean — damage numbers land off-axis for juice
  w?: number; // width at the last measured font
  wf?: string;
  ff?: string; // fitted font — cached when the banner can't fit the court
  fw?: number; // width at the fitted font
  key?: string; // the callout before a ×N repeat count
  n?: number; // repeats coalesced into this callout
}
export interface Orb {
  x: number;
  y: number;
  target: Unit;
  dmg: number;
  t: number;
  wob: number; // spiral phase — each orb corkscrews on its own beat
  color: string;
  hostile?: boolean; // boss orbs hunt players instead of enemies
  src?: Unit; // hostile orbs carry their caster so damage knobs still apply
  flat?: boolean; // dmg already priced through the foe stack — damagePlayer skips it
  drain?: boolean; // the hit feeds the team — grass seed flares
  spd?: number; // override the 620 u/s cruise — aura lock-ons fly faster
}
// Expanding shockwave: the front sweeps outward and hits each enemy once
// when it reaches them — fire blast, psychic ring.
export interface Wave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  t: number;
  life: number;
  color: string;
  hits: Set<number>;
  onHit?: (e: Unit) => void;
  hostile?: boolean; // boss waves damage players
}
// A themed hazard zone on the court — MS damage-wall/gimmick analog.
interface Hazard {
  kind: HazardKind;
  x: number;
  y: number;
  r: number; // px radius of the zone
  dir?: number; // gust: push direction (+1/-1)
  spent?: boolean; // mines fire once
  pair?: number; // warps: pads sharing an id teleport between each other
  moat?: boolean; // authored liquid cell, separate from roamer gimmicks
  healShot?: number;
}
// Boss hyper beam: a bright line that fades fast after the shot lands.
export interface Beam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
  life: number;
  color?: string; // default gold — signature nukes tint it
  w?: number; // width multiplier — hyper beam is FAT
}
// Normal-type quick attack: the bumped ally physically lunges at the
// target, slams it, and holds position next to it.
export interface Dash {
  u: Unit;
  e: Unit;
  done: boolean;
  dmg: number;
  hostile?: boolean; // an enemy stampede — the mover rams its target
}
interface ScreenFlash {
  t: number;
  life: number;
  color: string;
}
// One capture ritual: the mon sucks into the ball, it rocks side to side,
// then clicks shut (ok) or bursts open — theatre over an already-banked
// result; `resolve` fires the site's deferred payoff once at the verdict.
interface BallDrop {
  x: number;
  y: number;
  item: string; // poke-ball / master-ball sprite
  t: number;
  life: number;
  ok: boolean; // click shut (catch) vs break out (the roll refused)
  rocks: number; // swings to play before the verdict — 3 catch / 2 escape
  rocked: number; // ticks already sounded
  at: number; // elapsed time of the click/burst
  id?: number; // the caught mon — drawn shrinking into the ball on the drop
  r?: number; // its draw radius for the suck-in
  resolve?: () => void; // payoff at the click/burst — fires once
}
// Field pickups — the MS heart/sword/hourglass channel. The ball collects
// one by touching it mid-shot.
type PickupKind = 'oran-berry' | 'sitrus-berry' | 'protein' | 'x-attack' | 'elixir' | 'max-elixir' | 'lum-berry' | 'revival-herb' | 'pp-up' | 'chesto-berry' | 'great-ball' | 'ultra-ball';
interface Pickup {
  x: number;
  y: number;
  kind: PickupKind;
  t: number; // bob phase
  age: number; // enemy turns survived
  tag?: number; // s its first-of-this-battle label still shows
}
interface Scar {
  x: number;
  y: number;
  r: number;
  t: number;
  life: number;
}
export type Phase = 'aim' | 'shot' | 'enemy' | 'reward' | 'map' | 'loot' | 'won' | 'lost';


// region-map layout — shared by drawRegion, the tap hit-test, and smoke
export const MAP_CELL = 32;
export const MAP_OX = (540 - MAP_W * MAP_CELL) / 2;
export const MAP_OY = 128;
// tile rows on screen at once — sized so the current triplet
// (battle → utility → gym) fills the view as the climb scrolls north
export const MAP_VIEW = 20;

// island dressing — decor tiles are mons that *are* the scenery: palm
// groves, boulders dozing in the sun, weed-mons rustling the grass.
// [dex id, draw size, lift above tile center]; tile index picks the variant
const DECOR_MONS: Record<'tree' | 'rock' | 'flower', [number, number, number][]> = {
  tree: [[103, 46, 10]], // exeggutor
  rock: [
    [74, 30, 2], // geodude
    [75, 34, 2], // graveler
  ],
  flower: [
    [43, 26, 0], // oddish
    [187, 24, 2], // hoppip
    [192, 28, 0], // sunflora
    [191, 22, 2], // sunkern
  ],
};

// hazard zones draw as overworld props — gracidea slices squashed to the
// footprint; the tint pad underlays each so its radius stays readable
const HZ_TINT: Record<Hazard['kind'], string> = {
  lava: '#c23a0e', grass: '#2f7a2a', gust: '#bfe6ff', spikes: '#241f30', static: '#4a2a78',
  mine: '#ff9a30', warp: '#c890ff', boost: '#2a5a30', well: TYPE_COLOR.psychic, power: '#d83018',
  ice: '#9adcff', heal: '#6fdc6f', gravity: '#9aa7b8',
};
const HZ_PROP: Partial<Record<Hazard['kind'], MT.TileRect>> = {
  grass: [1715, 93, 78, 33], // tall-grass tufts
  static: [90, 268, 55, 42], // still pond — keywords go quiet inside
  warp: [292, 140, 40, 23], // cave mouth — enter here, exit the twin
  boost: MT.TILE_PATH, // dirt pad
  power: MT.TILE_PATH,
};

// every sky in the deck — courts that promise weather on a wave with no
// canon sky (storm chaser, ASC 8, STORM CALLER) roll from this pool
const ALL_SKIES: Weather[] = ['sun', 'rain', 'sand', 'wind', 'storm'];
const rolledSky = (rng: () => number): Weather => ALL_SKIES[Math.floor(rng() * ALL_SKIES.length)];

// theme → its sky: groves rain, caverns swirl sand, the volcano bakes
// under sun, the heights blow, the plant crackles under a thunderstorm.
// Courts with no canon sky run clear — ~half of rolled courts get weather.
export const WEATHER_FOR: Partial<Record<Theme, Weather>> = {
  grove: 'rain',
  cavern: 'sand',
  volcano: 'sun',
  sky: 'wind',
  shore: 'rain',
  plant: 'storm',
  marsh: 'rain',
};
// graphics quality → ambient/weather particle density multiplier — low
// trims to a quarter but never to zero; a still court shouldn't read dead
const QUALITY_FX: Record<Settings['quality'], number> = { high: 1, medium: 0.55, low: 0.25 };

export const STOP_SPEED = 55; // trims the dribble tail — shots carry ~1.5x energy now
const SHOT_MAX = 14; // seconds — gimmick courts can hold the ball above settle speed forever
const FINAL_DEPTH = TOTAL_STAGES - 3; // rolled stages: 4..9 are depths 1..6
export const BASE_SHOT_SPEED = 285; // 1.5x launch — under exponential friction range scales with speed
export const POWER = 8;
export const WALL_REST = 0.96; // pinball court — walls hand back nearly everything
export const UNIT_REST = 0.94; // meatier ricochets off bodies
const ECHO_REST = 1.12; // ECHO WALLS affix: a bank comes back hotter than it left
const MS_FRAME = 60; // MS multiplies velocity once per 60 Hz frame
export const SHOT_T = 1.5; // s — MS time-boxed shot: v *= 1 - (t/T)^4 each frame
export const shotDamp = (t: number, h: number, mult = 1) => Math.exp(-MS_FRAME * (t / SHOT_T) ** 4 * mult * h);
export function dmgNumSize(d: number, maxHp: number, weak: boolean) {
  return Math.min(1.7, 0.85 + d / 90 + Math.min(0.35, d / Math.max(1, maxHp)) + (weak ? 0.25 : 0));
}
export function comboPitch(hits: number, links: number) {
  return Math.min(1.9, 1 + hits * 0.06 + links * 0.12);
}
const HIT_COOLDOWN = 0.12;
const SMASH_HITS = 3;
const CUT_HITS = 2;
const FIELD_HIT_SPEED = STOP_SPEED;
const FIELD_UNIT_GAP = 4;
const MAX_TEXTS = 5; // floating callouts on court at once — more reads as noise
export const LABEL_PX = 22; // field labels: phone-readable floor
const CALLOUT_PX = 18; // Press Start 2P caps run 0.875em, so 18 matches a 22px rc label
export const LABEL_INTRO = 2.2; // s a pickup/hazard/foe tag shows before the icon carries the read
const LABEL_SLOTS = 32;

// Nudges a label's baseline vertically until its box clears every box already
// placed this frame, within [top, bottom]; records the box. Returns the new y.
export function placeLabel(boxes: Float32Array, n: number, x: number, y: number, w: number, asc: number, desc: number, top: number, bottom: number, up: boolean): number {
  let flipped = false;
  for (let i = 0; i < LABEL_SLOTS + 2; i++) {
    const clamped = Math.min(Math.max(y, top + asc + 2), bottom - desc - 2);
    if (clamped !== y) {
      y = clamped;
      if (!flipped) {
        up = !up;
        flipped = true;
      }
      continue;
    }
    const x0 = x - w / 2 - 2;
    const x1 = x + w / 2 + 2;
    const y0 = y - asc - 2;
    const y1 = y + desc + 2;
    let hit = -1;
    for (let j = 0; j < n && j < boxes.length / 4; j++) {
      const at = j * 4;
      if (x0 < boxes[at + 2] && x1 > boxes[at] && y0 < boxes[at + 3] && y1 > boxes[at + 1]) {
        hit = at;
        break;
      }
    }
    if (hit < 0) break;
    const next = up ? boxes[hit + 1] - desc - 3 : boxes[hit + 3] + asc + 3;
    y = next;
  }
  if (n < boxes.length / 4) {
    const at = n * 4;
    boxes[at] = x - w / 2 - 2;
    boxes[at + 1] = y - asc - 2;
    boxes[at + 2] = x + w / 2 + 2;
    boxes[at + 3] = y + desc + 2;
  }
  return y;
}

const FOE_TAGS: [keyof SpeciesDef, string][] = [
  ['cursed', 'CURSE'],
  ['regen', 'REGEN'],
  ['split', 'SPLIT'],
  ['rage', 'RAGE'],
  ['raider', 'RAIDER'],
  ['volley', 'VOLLEY'],
  ['summon', 'SOS'],
  ['mirror', 'MIRROR'],
  ['fuse', 'FUSE'],
  ['hunter', 'HUNTER'],
  ['leech', 'LEECH'],
  ['drowsy', 'SLEEP'],
  ['venom', 'STING'],
  ['burn', 'WISP'],
  ['para', 'JOLT'],
  ['toxic', 'TOXIC'],
  ['shock', 'STATIC'],
  ['flame', 'FLAME'],
  ['menace', 'MENACE'],
  ['charm', 'CHARM'],
  ['guts', 'GUTS'],
  ['truant', 'LOAF'],
  ['boost', 'BOOST'],
  ['spore', 'SPORE'],
  ['sync', 'SYNC'],
  ['pressure', 'PRESSURE'],
  ['beam', 'BEAM'],
  ['trap', 'TRAP'],
  ['skyFor', 'SKY'],
  ['alpha', 'ALPHA'],
  ['shed', 'SHED'],
  ['charge', 'CHARGE'],
  ['prank', 'PRANK'],
  ['thief', 'THIEF'],
  ['lay', 'SPIKER'],
  ['confuse', 'SONIC'],
  ['anchor', 'ANCHOR'],
  ['flank', 'FLANK'],
  ['forecast', 'FORECAST'],
  ['healBlock', 'H-BLOCK'],
  ['bond', 'BOND'],
  ['armor', 'ARMOR'],
  ['chameleon', 'CAMO'],
  ['weakArmor', 'W-ARMOR'],
  ['moxie', 'MOXIE'],
  ['veil', 'VEIL'],
  ['filter', 'FILTER'],
  ['snipe', 'SNIPE'],
  ['unaware', 'UNAWARE'],
  ['swift', 'SWIFT'],
  ['pheal', 'P-HEAL'],
  ['blink', 'BLINK'],
];
const FOE_TAG_COLOR: Record<string, string> = {
  SAFEGUARD: '#f8a8d8',
  MAGNET: '#ffd84d',
  SHELL: '#c8d4e4',
  'W-GUARD': '#c8a8f8',
  REGEN: '#a0e060',
  SPLIT: '#a0e060',
  CURSE: '#c890e0',
};
const HEAL_CD = 5; // in-battle mends share this cooldown — one heal per few shots
const SUPER_POW = 0.7; // supers hit softer so clean lines carry the damage
const CONTACT_POW = 1.4; // direct hits are the bread and butter again
const ENEMY_TURN_DELAY = 0.6;
const ENEMY_BASE_TIMER = 3;
const MELEE_TIMER = 2; // melee mons have to close in — they attack sooner
const FINISH_T = 0.8;
const FINISH_SLOW = 0.25;
const FINISH_ZOOM = 0.14;
const BOSS_BARS = [0.3, 0.3, 0.4]; // MS stage data: boss HP split into bars, one battle per bar
// MS stage_phases: a plain wild stop runs extra battles after the first, each
// skipped at its skip_rate, so the same stop plays 2 to 4 battles long
const BATTLE_SKIP = [0, 0.5, 0.7];
const ENEMY_MAX = 5; // MS enemy_max: live foes per extra battle
// MS stages.bonus_turn: a per-stage turn par (10 to 24) for the SPEED CLEAR
// bonus. Ours scales with the stop: 4 turns a battle, +10 for a boss
const PAR_PER_BATTLE = 6;
const PAR_BOSS = 8;
const BOSS_BIG_TIMER = 7; // MS long boss clocks are mostly 7 or 11 turns
const BOSS_BIG_POW = 2;
const BOSS_WEAK_SHIFT = Math.PI * 2 / 3;
export const HIDE_WP_RATE = [0, 0.2, 0.35]; // MS hide_wp_rate: non-boss weak points hidden, stops 1-3 / 4-6 / 7-9
const WEAK_TALLY = 3; // weak hits in one shot before the WEAK POINT ×n banner
const WEAK_SFX_PITCH = 1.5; // weak hits ring a higher 'perfect'
const WP_POP_T = 0.9; // reveal label life, s
const BOSS_RAGE_STAT = 1.2;
const BOSS_RAGE_TURN_CUT = 1;
const BOSS_GUARDS = [0, 1, 2];
const LASER_HALF_W = 22;
const QUAKE_R = 150;
const FOE_MOVE_POW = 0.8;
const DAMAGE_WALL_HP = 0.04;
type LiveWall = DamageWall & { t0?: number; outT?: number };
const WALL_DELAY = 0.2; // s before a lit wall starts fading in (MS code.bin round 3)
const WALL_FADE = 1; // s fade-in
const WALL_LIVE = 1.5; // s after lighting the wall starts to hurt
const WALL_OUT = 0.2; // s fade-out when a cycle turns it off
const WALL_DASH = [6, 4];
const NO_DASH: number[] = [];
const REFLECT_HITS = 2;
const REFLECT_BOSS_HITS = 3;
const HEAL_PANEL_HP = 0.06;
const GRAVITY_PANEL_DRAG = 7;
const BOSS_MOVE_POW = 1;
const COURT_SCROLL = 0.55; // s — the court slides in from above on each new battle
const FOE_DROP = 0.32; // s — foes fall onto the court once it settles
const FOE_DROP_H = 150; // px — how high they fall from
const SHINY_RATE = 1 / 48; // ~2% of wild spawns roll the gold palette
// the catch ritual's clock — a fast drop-in, ±0.5rad rocks, then the
// verdict. Worst case runs 1.75s so a volley of catches stays snappy.
const BALL_ROCK0 = 0.3; // drop-in seconds before the first swing
const BALL_ROCK_T = 0.4; // one full side-to-side swing
const BALL_TAIL = 0.25; // linger after the click/burst before fading
const PICKUP_KINDS: PickupKind[] = ['oran-berry', 'protein', 'elixir']; // lum rolls separately — see spawnWave
// every pickup gets a color + one-word tag so the drop reads before the
// ball reaches it
const PICKUP_META: Record<PickupKind, { name: string; label: string; color: string }> = {
  'oran-berry': { name: 'ORAN BERRY', label: 'HEAL 15%', color: '#6fdc6f' },
  'sitrus-berry': { name: 'SITRUS BERRY', label: 'HEAL 30%', color: '#f8d030' },
  protein: { name: 'PROTEIN', label: 'ATK +50%', color: '#f08030' },
  'x-attack': { name: 'X ATTACK', label: 'ATK +100%', color: '#e84818' },
  elixir: { name: 'ELIXIR', label: 'SUPER +1', color: '#9ecbff' },
  'max-elixir': { name: 'MAX ELIXIR', label: 'SUPER +2', color: '#5e9fff' },
  'lum-berry': { name: 'LUM BERRY', label: 'CURE ALL', color: '#b8f8f8' },
  'revival-herb': { name: 'REVIVAL HERB', label: 'REVIVE', color: '#f8d030' },
  'pp-up': { name: 'PP UP', label: 'ULT +1', color: '#f8a8f8' },
  'chesto-berry': { name: 'CHESTO BERRY', label: 'CLOCK RESET', color: '#a890f0' },
  'great-ball': { name: 'GREAT BALL', label: 'CATCH +15%', color: '#4a90e2' },
  'ultra-ball': { name: 'ULTRA BALL', label: 'CATCH +30%', color: '#f8c830' },
};
// loot-fountain drops each glint their own color on the trail and collect
const LOOT_TINT = { coin: '#ffd84d', gem: '#7dd8f8', heart: '#ff7096', candy: '#9df0ff', star: '#c9a8ff' } as const;
// MS field items grow if left on the field: heal ripens in 1 turn,
// power and charge take 3 (field_items rows 5→6 and 7→8).
const PICKUP_RIPEN: Partial<Record<PickupKind, { to: PickupKind; turns: number }>> = {
  'oran-berry': { to: 'sitrus-berry', turns: 1 },
  protein: { to: 'x-attack', turns: 3 },
  elixir: { to: 'max-elixir', turns: 3 },
  'great-ball': { to: 'ultra-ball', turns: 3 },
};
// MS self_drop_rate: a species can carry its canonical wild hold into the
// fight and leaves it where it falls — data per species id, not a pool
export const SPECIES_DROPS: Record<number, { kind: PickupKind; rate: number }> = {
  25: { kind: 'oran-berry', rate: 0.25 },   // Pikachu — FRLG held oran
  63: { kind: 'pp-up', rate: 0.3 },         // Abra — twisted spoon
  83: { kind: 'x-attack', rate: 0.3 },      // Farfetch'd — leek
  104: { kind: 'x-attack', rate: 0.3 },     // Cubone — thick club
  113: { kind: 'sitrus-berry', rate: 0.4 }, // Chansey — lucky egg pays out
  120: { kind: 'max-elixir', rate: 0.25 },  // Staryu — star piece
  132: { kind: 'lum-berry', rate: 0.3 },    // Ditto — quick/metal powder
  143: { kind: 'sitrus-berry', rate: 0.4 }, // Snorlax — leftovers
  213: { kind: 'oran-berry', rate: 0.5 },   // Shuckle — berry juice
  236: { kind: 'x-attack', rate: 0.3 },     // Tyrogue — black belt
  241: { kind: 'sitrus-berry', rate: 0.4 }, // Miltank — moomoo milk
};
// a stocked ball is flat bonus odds on the next catch roll this wave —
// thrown once and spent either way, like the real thing
const BALL_CATCH: Partial<Record<PickupKind, number>> = { 'great-ball': 0.15, 'ultra-ball': 0.3 };
// EXP per KO: the launcher learns foe Lv × KO_LV_RATE (+1 punching up); the
// rest of the living team learns KO_LV_SHARE of that, so the bench keeps pace
const KO_LV_RATE = 0.05;
const KO_LV_SHARE = 0.5;
// MS fusion leveling: KO exp is floored — fodder teaches nothing, so real
// growth comes from feeding dupes (FEED_*), trainer events and the lab.
// A dupe only triggers evolution once the owned copy earns the gate:
// canon-ish Lv16 out of a base form, Lv32 for an already-evolved one.
const FEED_RATE = 0.15; // levels a dupe grants per level it had
const FEED_MIN = 2;
const EVO_LV1 = 16;
const EVO_LV2 = 32;
const evoGate = (from: SpeciesDef) => (EVOS.some((e) => e.id === from.id) ? EVO_LV2 : EVO_LV1);
export const TEAM_CAP = 4; // field slots ever — the back two stay locked until the career record deepens (teamSlots)
export const ULT_SHOTS = 10; // shots to charge the team ultimate — tap any glowing teammate to spend it
// JUST frame: a bump inside the flight's opening beat pays a timed-combo
// bonus — the window is early enough that banking off a wall first still counts
const JUST_WIN = 0.8;
// FEVER: a deep perfect-release streak arms a fevered NEXT shot — gold
// court glow, a climbing jingle pitch, and a score premium on its hits
const FEVER_AT = 3; // perfect-streak length that arms FEVER
const FEVER_SCORE = 1.5; // score multiplier paid on fever-shot hits
const FEVER_PITCH = 0.12; // perfect-SFX pitch step per streak past 2, capped
const FEVER_PITCH_CAP = 6; // streak steps that still raise the pitch — beyond it the jingle squeaks

// ?debug=arena1..11 or ?dev&arena=<name|index> — pin every wave's court
// for arena review. debugArena() parses once, dev/debug-gated; node-smoke
// has no location so it always nulls.
export function parseArenaPin(q: URLSearchParams): Theme | null {
  let raw = q.get('arena');
  const m = /^arena(\d{1,2})$/.exec(q.get('debug') ?? '');
  if (!raw && m) raw = String(Math.max(0, Number(m[1]) - 1)); // arena1 → court 0
  if (!raw || !(q.has('dev') || q.has('debug'))) return null;
  return /^\d+$/.test(raw)
    ? THEMES[Number(raw) % THEMES.length]
    : (THEMES as readonly string[]).includes(raw)
      ? (raw as Theme)
      : null;
}
let dbgArena: Theme | null | undefined;
export function debugArena(): Theme | null {
  if (dbgArena === undefined)
    dbgArena = typeof location === 'undefined' ? null : parseArenaPin(new URLSearchParams(location.search));
  return dbgArena;
}
// ?debug&room=gen|authored — pin which pool courts pull from for review
let dbgRoom: 'gen' | 'authored' | null | undefined;
export function debugRoom(): 'gen' | 'authored' | null {
  if (dbgRoom === undefined) {
    dbgRoom = null;
    if (typeof location !== 'undefined') {
      const q = new URLSearchParams(location.search);
      const raw = q.get('room');
      if ((q.has('dev') || q.has('debug')) && (raw === 'gen' || raw === 'authored')) dbgRoom = raw;
    }
  }
  return dbgRoom;
}
// star pieces — the meta wallet paid by run progress (Oct-20/21 specs;
// rates are guesses pending playtesting): a cleared map row pays
// 2 + stage#, a climb win pays a lump, gym fountains spill a few shards
const STAR_ROW = 2; // a cleared map row pays this + its 1-based stage number
const STAR_WIN = 40; // climb-clear lump
const LOOT_STAR = [2, 4]; // star pickups per gym fountain, worth +1 each
const KO_BOUNTY = { every: 5, pay: 5 }; // every Nth KO banks star pieces — keeps the run economy ticking inside fights
// the lab's per-level rates (meta.ts LAB_UPGRADES owns names/costs)
const LAB_HP_LV = 0.08; // hp: team maxHp mult /level
const LAB_DMG_LV = 0.05; // dmg: hit damage mult /level
const LAB_SPC_LV = 0.05; // spc: bump-super damage mult /level
const LAB_LUCK_LV = 2; // luck: flat team luck /level
const LAB_EARN_LV = 0.1; // earnings: star payout mult /level
const REVIVE_FRAC = 0.5; // revive token: the first KO stands back up at half
// pass-through combo heat ramp — cyan→gold as the chain climbs; the bump
// pops, the shot meter and the ball's wake all read the same ladder
const COMBO_COLORS = ['#9df0ff', '#f8d030', '#f08030', '#f85888', '#ffd84d'];
// every species a mon can evolve into must be resolvable here — includes
// enemy/invader pools so catches like Magikarp→Gyarados actually work
const SPECIES_DB: SpeciesDef[] = [...ROSTER, ...ELITES, ...EVOS, ...ENEMY_DB, ...INVADERS];

// Circle-vs-rect resolution shared by the live physics and the aim
// preview — pushes a ball out along the least-penetrating face and
// reflects that axis. Returns true when it touched anything.
interface Ball { x: number; y: number; r: number; vx: number; vy: number }
function resolveBlock(u: Ball, b: Rect): boolean {
  const l = u.x - (b.x - u.r), rr = b.x + b.w + u.r - u.x;
  const t = u.y - (b.y - u.r), bo = b.y + b.h + u.r - u.y;
  if (l <= 0 || rr <= 0 || t <= 0 || bo <= 0) return false;
  const m = Math.min(l, rr, t, bo);
  if (m === l) { u.x = b.x - u.r; u.vx = -Math.abs(u.vx) * WALL_REST; }
  else if (m === rr) { u.x = b.x + b.w + u.r; u.vx = Math.abs(u.vx) * WALL_REST; }
  else if (m === t) { u.y = b.y - u.r; u.vy = -Math.abs(u.vy) * WALL_REST; }
  else { u.y = b.y + b.h + u.r; u.vy = Math.abs(u.vy) * WALL_REST; }
  return true;
}

// Zones drawn as solid props are solid: water walls off anything that
// can't swim/fly/hover, spike boulders wall off anything that can't hop
// them — everything else banks off the surface like a stone slab.
// flies() lives in supers/util.ts — the signature table shares it
const canSwim = (d: SpeciesDef) => d.type === 'water' || d.type2 === 'water' || flies(d);
const isWater = (hz: Hazard) => hz.kind === 'static' || (hz.kind === 'well' && !!hz.moat);
const isSolid = (hz: Hazard, d: SpeciesDef) =>
  (isWater(hz) && !canSwim(d)) || (hz.kind === 'spikes' && !flies(d));

// Circle-vs-circle: push the unit back to the shoreline and reflect the
// incoming velocity — same restitution as the court walls.
function resolveZone(u: Ball, hz: Hazard): boolean {
  const dx = u.x - hz.x, dy = u.y - hz.y, lim = u.r + hz.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= lim * lim) return false;
  const d = Math.sqrt(d2);
  const nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : -1; // dead center pops out upward
  u.x = hz.x + nx * lim;
  u.y = hz.y + ny * lim;
  const dot = u.vx * nx + u.vy * ny;
  if (dot < 0) {
    u.vx -= (1 + WALL_REST) * dot * nx;
    u.vy -= (1 + WALL_REST) * dot * ny;
  }
  return true;
}

// order-preserving in-place compaction — a filter() that doesn't realloc a
// fresh array per frame; writes only start once the first dead element drops
const cull = <T>(arr: T[], keep: (e: T) => boolean) => {
  let w = 0;
  for (let i = 0; i < arr.length; i++) {
    const e = arr[i];
    if (keep(e)) {
      if (w !== i) arr[w] = e;
      w++;
    }
  }
  arr.length = w;
};

// fill (and optionally stroke, at device-space width strokeW) a 4-point
// star of radius s at (x, y)
const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, pinch: number, strokeW = 0) => {
  const p = pinch === 0.28 ? STAR_28 : STAR_4;
  if (p) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fill(p);
    if (strokeW) {
      ctx.lineWidth = strokeW / s; // the scale would thicken the caller's width
      ctx.stroke(p);
    }
    ctx.restore();
    return;
  }
  starPath(ctx, x, y, s, pinch);
  ctx.fill();
  if (strokeW) {
    ctx.lineWidth = strokeW; // unscaled path — device-space width, no /s
    ctx.stroke();
  }
};

// shadowBlur is a full blur pass per draw per frame — bake each glow once
// into a small canvas and blit it instead (same recipe as silCache/slice)
const orbGlows = new Map<string, HTMLCanvasElement>();
const orbGlow = (color: string) => {
  let c = orbGlows.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 80; // the 12px orb + its 22px halo, centered
    const g = c.getContext('2d')!;
    g.shadowColor = color;
    g.shadowBlur = 22;
    g.fillStyle = color;
    g.beginPath();
    g.arc(40, 40, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(36.5, 36.5, 4.5, 0, Math.PI * 2);
    g.fill();
    orbGlows.set(color, c);
  }
  return c;
};
// a damage wall's tile strip is static per (tile, span) — bake it once and
// blit; ~56 drawTile calls per wall per frame collapse into one drawImage.
// TileRects are frozen constants, so identity keys the cache.
const wallStrips = new WeakMap<MT.TileRect, Map<number, HTMLCanvasElement>>();
const wallStrip = (tile: MT.TileRect, span: number) => {
  let bySpan = wallStrips.get(tile);
  if (!bySpan) wallStrips.set(tile, (bySpan = new Map()));
  let c = bySpan.get(span);
  if (!c) {
    c = document.createElement('canvas');
    c.width = Math.ceil(span);
    c.height = 12;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    for (let at = 0; at < span; at += 16) drawTile(g, tile, at, 0, Math.min(16, span - at), 12);
    bySpan.set(span, c);
  }
  return c;
};
// headless smoke has no document — blit the bake, or draw tiles live
const wallBlit = (ctx: CanvasRenderingContext2D, tile: MT.TileRect, span: number) => {
  if (typeof document === 'undefined') {
    for (let at = 0; at < span; at += 16) drawTile(ctx, tile, at, -6, Math.min(16, span - at), 12);
  } else {
    ctx.drawImage(wallStrip(tile, span), 0, -6);
  }
};

// the evolution white-out: blur halo baked once per silhouette, keyed on
// the cached sprite itself — from/to forms each bake a single entry
const WHITE_GLOW_PAD = 36; // blur 24 + bleed
const whiteGlows = new Map<HTMLCanvasElement, HTMLCanvasElement>();
const whiteGlow = (img: HTMLCanvasElement) => {
  let c = whiteGlows.get(img);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.width + WHITE_GLOW_PAD * 2;
    c.height = img.height + WHITE_GLOW_PAD * 2;
    const g = c.getContext('2d')!;
    g.shadowColor = '#ffffff';
    g.shadowBlur = 24;
    g.drawImage(img, WHITE_GLOW_PAD, WHITE_GLOW_PAD);
    whiteGlows.set(img, c);
  }
  return c;
};

// map-phase chrome never changes: the edge sheers and the island vignette
// are built once, not per frame (the top one's window scales with `over`)
let mapTopG: CanvasGradient | null = null;
let mapBotG: CanvasGradient | null = null;
let mapVig: CanvasGradient | null = null;
// the wipe-pressure vignette: same baked gradient every frame, the pulse
// rides on globalAlpha instead of a rebuilt color stop
let dangerG: CanvasGradient | null = null;
let feverG: CanvasGradient | null = null; // FEVER rim — same bake-once pattern

// Shared context for initial text metrics; live widths refresh on font changes.
const MCTX = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');

export class Battle {
  players: Unit[] = [];
  enemies: Unit[] = [];
  blocks: (Rect & { field?: BlockDef['field']; hp?: number })[] = []; // Archero-style stone clusters — bounceable cover
  private roomGrid: string[] | null = null;
  private bulletN: Record<BulletGimmick, number> = { drain: 0, heart: 0, 'pp-up': 0, chesto: 0, safeguard: 0 };
  private bulletRng = mulberry32(0); // side stream so bullet rolls never shift the run's seeded order
  phase: Phase = 'aim';
  waveIndex = -1; // -1 = still at HOME — stages begin at the row-0 fork
  activeIdx = 0;
  shots = 0;
  time = 0;
  private abilityText = (text: string, u: { x: number; y: number; r: number }) => this.pushText({ x: u.x, y: u.y - u.r - 40, text, t: 1.1, color: '#ffd848', big: false });
  telop = new Telops(); // battle banners: start, boss, clears, ULT READY
  treasure = new Treasure(); // MS treasure drops + the stop-end reveal
  missions = new Missions(); // MS stop missions: 3 optional goals per battle stop
  connect = new Connect(); // MS ALL CONNECT: link every ally in one shot, next shot ×1.25
  flee = new Flee();
  private waveIntroT = -9; // spawnWave timestamp — the ! beat plays while <0.6s
  private courtT = -9;
  private foesLanded = true; // the drop-in landing beat fired for this court
  endT = 0; // win/lose beat — the field report waits for the celebration to land
  weather: Weather | null = null; // this wave's sky — null is a clear court
  private gymFurnished = false;
  private barBreak = false;
  private battle = 1; // battle k of this stop's battles
  private battles = 1;
  private battleBreak = false; // the stop's next battle loads after this shot
  private lastKoType?: PokeType | null; // last KO's shot type — settles FINISH if the rare foe just flees

  private dragging = false;
  private dragStart: Vec = vec();
  private dragNow: Vec = vec();
  private dragT = 0; // hold time while dragging — drives the timing meter
  private wasGold = false; // edge detector for the in-zone tick

  private stopTimer = 0;
  private slowT = 0; // crawl time this shot — gates the tap-to-skip hint
  private skipHinted = false; // TAP TO SKIP pushed once per shot
  private shotT = 0; // launch timestamp — hard-caps a shot that never settles
  private enemyPhaseT = 0;
  // uids are per-battle on purpose: a session-global counter made orb wobble
  // phases depend on how many mons the session had already fielded, so a
  // ?seed= run diverged between a fresh load and a post-run retry
  private uidCtr = 0;
  private inspect: { uid: number; t: number } | null = null; // tapped-foe scout card
  // the ult tap is a two-tap confirm: first tap arms that uid for 2s, a
  // second tap inside the window fires — anything else stands it down
  private ultArmUid = -1;
  private ultArmT = -9;
  private ultFill = 0;
  private ultHintPending = !ultHintSeen();
  ultHint = false;
  // the fired ult gets a letterboxed cinema beat — banner + type-tinted
  // vignette over the fight while the map-wide attack lands
  private ultFx = { text: '', color: '#ffd84d', t: 0, life: 1.15 };
  private cutin = { t: 0, life: 0.32, color: '#ffffff' }; // signature cut-in — a scrim + type rake every named ult wears
  private skyAcc = 0; // ambient sky particle debt — an accumulator, not a per-frame roll
  // branching evolution: a dupe-fed split waits on the reward screen's pick —
  // unit for a fielded mon, boxDef for a boxed one (re-found at pick time so
  // a mid-queue box swap can't evolve the wrong entry)
  private evoPending: { from: SpeciesDef; options: SpeciesDef[]; unit?: Unit; boxDef?: SpeciesDef }[] = [];
  evoChoice: { from: SpeciesDef; options: SpeciesDef[]; unit?: Unit; boxDef?: SpeciesDef } | null = null;
  // queued evolution cinematics — the arena dims, the sprite whites out and
  // flickers old↔new faster and faster, then the new form lands
  private evoFx: { u: Unit; from: number; to: number; t: number; revealed: boolean }[] = [];
  paused = false; // mid-fight freeze — the pause chip in the arena corner
  private pauseT0 = -9; // stamped on freeze — the card pops in, not snaps
  private wasPaused = false;
  private modalT0 = -9; // ?-stop cabinet cards share the same entrance stamp
  private wasModal = false;
  static ffPref = false; // ×2 rides the session — a new Battle spawn inherits it
  ff = Battle.ffPref; // ×2 chip beside it — the sim runs two steps a frame, not a stretched dt
  private pendingAttacks: Unit[] = [];
  private pendingBig: Unit[] = [];
  private pendingMoves: { e: Unit; c: Unit['clocks'][number] }[] = [];
  private firstFoeU?: Unit; // lowest clock on the board — wears the ACTS FIRST tag during intro
  private bumpsThisShot = new Set<number>(); // allies whose super fired this shot
  private bumpNoted = new Set<number>(); // allies already told "recharging" this shot
  private shotCombo = 0; // pass-through links chained this shot
  private shotHits = 0;
  private shotDmg = 0; // running damage tally this shot — read under the COMBO meter
  private shotLoot = 0; // pickups grabbed this shot — a loot run isn't a whiff
  private shotKOs = 0; // kills this shot — multi-KOs name themselves mid-flight
  private comboLabel = ''; // COMBO meter string — rebuilt only when the counters move
  private comboLabelN = -1;
  private kosThisShot = 0; // enemies downed by the current shot
  private taskDone = new Set<string>(); // a task pings once per run
  private aimCache = { sig: '', dots: [] as Vec[], hit: null as Unit | null, bounced: false, hx: 0, hy: 0 };
  private texts: FloatText[] = [];
  private orbs: Orb[] = [];
  private waves: Wave[] = [];
  // beam telegraphs: a lane locks, the line glows for a beat, then the
  // beam fires through it — park nobody in the channel
  private lanes: { horiz: boolean; at: number; t: number; fired: boolean }[] = [];
  private dashes: Dash[] = [];
  private delays: { t: number; fn: () => void }[] = []; // staggered super hits
  private dueQ: { t: number; fn: () => void }[] = []; // scratch for the update sweep — the due list isn't a per-frame alloc
  private aliveP: Unit[] = []; // scratch: living players snapshotted at stepEnemyMovement's top — a mid-pass death still targets the body
  private flashes: ScreenFlash[] = [];
  private balls: BallDrop[] = []; // live capture rituals — ball drops, rocks, clicks or bursts
  private pickups: Pickup[] = []; // touch to collect while the ball flies
  private stockedBall: 'great-ball' | 'ultra-ball' | null = null; // pocket ball — flies at the next catch roll, then it's gone
  private pickupSeen = new Set<PickupKind>();
  private lblBox = new Float32Array(LABEL_SLOTS * 4);
  private lblN = 0;
  private field2: Field2 | null = null;
  // public: perk ticks dress their procs through the same seam (perks.ts)
  public field2Fx: Field2Fx = {
    hurt: (u, n) => this.damagePlayer(u as Unit, n),
    burst: (x, y, c, ramp) => this.burst(x, y, c, 10, 320, 1, ramp),
    notice: (u) => abilityNotice(this, u as Unit, this.abilityText),
    shake: (n) => this.addShake(n),
    live: (u) => this.counterOn(u as Unit),
    motes: (x, y, ramp) => {
      for (let i = 0; i < 5; i++) this.fx.push({
        x: x + (this.fxRng() - 0.5) * 20, y: y + this.fxRng() * 6,
        vx: (this.fxRng() - 0.5) * 24, vy: -46 - this.fxRng() * 60,
        t: 0.28 + this.fxRng() * 0.12, life: 0.4, size: 1.4 + this.fxRng() * 1.8,
        color: pickRamp(ramp, this.fxRng), shape: i % 2 ? 'sparkle' : 'dot',
        spin: (this.fxRng() - 0.5) * 8, grav: -40, sway: 16,
      });
      if (this.fx.length > FX_MAX) this.fx.splice(0, this.fx.length - FX_MAX);
    },
    ring: (x, y, ramp, r = 30) => impactRing(this.fx, this.fxRng, x, y, ramp, { radius: r, width: 3, life: 0.3, motes: 2 }),
    glint: (x, y, ramp) => {
      this.glint(x, y, 9, pickRamp(ramp, this.fxRng));
      this.glint(x - 9, y + 5, 5, pickRamp(ramp, this.fxRng));
      this.glint(x + 9, y - 4, 5, '#ffffff');
    },
  };
  // the supers' window into battle internals — same seam as field2Fx.
  // Arrays come back through getters because enemies/waves/orbs re-seat
  // every wave; hitStop is a get/set pair so `ctx.hitStop = Math.max(...)`
  // reads like the old `this.hitStop`.
  private superFx: SuperCtx = (() => {
    const b = this;
    return {
      get enemies() { return b.enemies; },
      get players() { return b.players; },
      get orbs() { return b.orbs; },
      get waves() { return b.waves; },
      get beams() { return b.beams; },
      get dashes() { return b.dashes; },
      get arena() { return b.arena; },
      get weather() { return b.weather; },
      get perkIds() { return b.perkIds; },
      get shotCombo() { return b.shotCombo; },
      get time() { return b.time; },
      get hitStop() { return b.hitStop; },
      set hitStop(n: number) { b.hitStop = n; },
      rng: () => b.rng(),
      get fx() { return b.fx; },
      get fxRng() { return b.fxRng; },
      act: (beats) => b.act(beats),
      get actHooks() { return b.hooks; },
      hurt: (e, dmg, color, suffix, src) => b.hurt(e, dmg, color, suffix, src),
      later: (t, fn) => b.later(t, fn),
      screenFlash: (color, dur) => b.screenFlash(color, dur),
      pushText: (t) => b.pushText(t),
      scar: (x, y, r) => b.scar(x, y, r),
      impact: (x, y, color, scale) => b.impact(x, y, color, scale),
      burst: (x, y, color, n, speed, size, ramp) => b.burst(x, y, color, n, speed, size, ramp),
      flavor: (x, y, type) => b.flavor(x, y, type),
      addShake: (amt) => b.addShake(amt),
      addPunch: (amt) => b.addPunch(amt),
      tryHeal: (ps, amount) => b.tryHeal(ps, amount),
      log: (line) => b.log(line),
    };
  })();
  private lblW = new Map<string, number>();
  private scars: Scar[] = []; // impact craters scarring the court
  private hazards: Hazard[] = []; // this wave's court gimmicks
  private damageWalls: LiveWall[] = [];
  private wallTurn = 0;
  private wallShot0 = 0;
  private powerHz: Hazard[] = []; // cached 'power' zones — rebuilt only when the hazards list swaps or grows
  private powerRef: Hazard[] | null = null;
  private powerLen = -1;
  private tauntFoe: Unit | null = null; // cached first live magnet mon — rescanned on death or roster change
  private tauntRef: Unit[] | null = null;
  private tauntLen = -1;
  private beams: Beam[] = []; // boss hyper-beam afterglow
  private waveSpecial: string | null = null; // banner override (invade)
  private curMod: string | null = null; // this wave's rolled affix — hexed/tailwind ride it
  private pressureN = 0; // parity gate — every other charge tick dies under PRESSURE
  private gustSounded = false; // wind whoosh once per entry
  private shotPhys = 1; // protein pickup: contact damage this shot
  private healCd = 0; // shots until another in-battle mend can land
  // engine state — per-shot keyword bookkeeping
  private volleys = 0; // ally bumps this shot (volleyNth counting)
  private shotVolleyBoost = 0; // volleyBoost accumulated this shot
  streak = 0; // consecutive perfect launches — shown in the HUD
  private shotStreak = 1; // this shot's streak damage bonus
  private shotGold = false; // gold-zone release — MS gauge shot: +20% contact this shot
  private fever = false; // streak armed FEVER — the next launch runs hot
  private shotFever = false; // this launch is fevered — hits pay FEVER_SCORE
  ultIn = ULT_SHOTS; // shots until the map-wide ultimate — a team charge, tap any teammate to spend it
  private gaugeJit = 0; // per-pull variance: shifts the gold band and sweep pace
  private gaugeJit2 = 0; // per-pull variance: the band's width breathes too
  private gaugeStart = 0; // per-pull variance: where on the cycle the needle starts
  shinyRate = 1; // 2 with the Shiny Charm dex milestone
  scoreMult = 1; // lucky egg: score amplifies
  // daily-climb rule switches — a DAILY_MODS card flips them at run start
  allAffix = false; // every eligible rolled wave draws a mutator
  dailyWeather = false; // every wave rolls a sky, not just half of them
  martMult = 1; // poké mart price multiplier — BIG SPENDER pays less
  foeHpBonus = 0; // flat foe bulk folded into hpScale on every wave
  private lastContact = { t: -9, id: -1 }; // ricochet window: last thing touched
  private shotHitN = new Map<number, number>(); // per-enemy hits this shot (decay)
  private waveHadGym = false; // scheduled boss wave — gymsBeaten accounting
  private inRival = false; // this wave is the rival echo fight
  private tagEchoDone = false; // ASC 9 TAG TEAM — the echo's one owed visit is spent
  private inTrainer = false; // this wave is a trainer squad — their mons can't be caught
  private waveType: PokeType | null = null; // the trainer squad's mono-type — tints their march
  mapSeed = 0; // region's seed — saved so a resumed run regens the same island
  private fxRng: () => number = Math.random; // seeded off mapSeed at construction — vfx own stream
  private region: RegionMap; // the climb's world map — drawn between stages
  // read-only window for the seer event + smoke — the field stays private
  // because applySnapshot regens it mid-life
  get regionMap(): RegionMap {
    return this.region;
  }
  private regionBase: HTMLCanvasElement | null = null; // baked terrain — region never changes
  private roomLayer: HTMLCanvasElement | null = null; // baked moats + stone cover — re-bakes only on install/smash/shove
  private roomTheme = ''; // bake key — lair fights reskin the same court
  private pendingNext = 0; // wave the map interstitial leads into
  private mapNote = ''; // stop-flavor line shown on the region map
  private mapWalk: { path: { x: number; y: number }[]; t: number; node: MapNode } | null = null; // overworld walk to a tapped stop
  private shake = 0;
  private wallHitFx: { edge: DamageWall['edge']; t0: number; type: DamageWall['type'] } | null = null; // the edge that just bit the ball — flashes so the hit reads
  private hurtPulse = -9; // stamped on team damage — a red rim beat over the court
  private hitStop = 0; // brief slow-mo on combo hits
  // act() hooks ride the same later/hit-stop/shake/punch/flash kit the
  // loose calls use, so a beat list and hand-rolled code interleave freely
  private readonly hooks: ActHooks = {
    later: (t, fn) => this.later(t, fn),
    stop: (n) => { this.hitStop = Math.max(this.hitStop, n); },
    shake: (n) => this.addShake(n),
    punch: (n) => this.addPunch(n),
    flash: (c, d) => this.screenFlash(c, d),
  };
  // relic mods
  dmgMult = 1;
  cdMult = 1;
  launchBoost = 1;
  regen = 0; // leftovers: fraction of maxHp healed after each shot
  physMult = 1; // choice band: contact damage
  specMult = 1; // choice specs: special bump damage
  typePow: Partial<Record<PokeType, number>> = {}; // type-charm multipliers — the build-identity hooks
  thorns = 0; // rocky helmet: flat recoil to attackers
  comboDmg = 0; // metronome: per-link damage ramp
  critCh = 0; // scope lens: crit chance (x2)
  stagger = 0; // king's rock: hits push enemy attack timers back
  leech = 0; // shell bell: fraction of damage heals weakest ally
  frictionMult = 1; // float stone: lower = ball slides further
  belt = 0; // expert belt: bonus on super-effective hits
  captureChance = 0.06; // odds a defeated enemy joins your box
  bossCatch = 0; // heavy ball: extra catch chance vs bosses
  masterArmed = false; // master ball relic: next KO is a guaranteed catch
  ashArmed = false; // sacred ash bag charm: the first team wipe revives instead
  ashPct = 0.3; // revive fraction — shop pack tiers raise it +4% each
  private bagIds: string[] = []; // this run's bag picks — the save replays them
  takenMult = 1; // zinc/eviolite: incoming damage multiplier
  foeCdMult = 1; // bright powder: enemy attack-timer multiplier
  slowImmune = false; // air balloon perk flag — kept for perks.ts; no pads remain to slow the ball
  koHeal = 0; // exp share: heal team this fraction on each KO
  lifeDrain = 0; // life orb: team pays this fraction of maxHP per shot
  bossSlayer = 0; // power bracer: bonus damage vs bosses
  wallRamp = 0.08; // banking off walls pays a little contact damage per bounce — grip claw triples it
  // keyword relics — RICOCHET (two contacts in one window) / VOLLEY (ally bumps)
  ricoPip = 0; // pips granted to the launcher on each ricochet
  ricoMult = 0; // extra contact damage on ricochet hits
  volleyNth = 0; // every Nth volley: all cooldowns -1
  volleyBoost = 0; // per-volley contact bonus for the rest of the shot
  // metagame — set by main.ts from the persistent record
  rank = 0; // trainer rank: shifts invade odds + relic pool
  asc = 0; // ascension tier (wins so far) — enemy bulk/damage scale up
  bestScore = 0; // saved best — crossing it mid-run pops NEW BEST!
  private bested = false;
  heldItems: string[] = []; // item icons picked up this run — the build receipt
  echo: { def: SpeciesDef; lvl: number }[] | null = null; // last run's fallen team → rival wave
  echoCleared = false; // set when the rival wave was fought and won
  gymsBeaten = 0; // gym waves cleared this run — feeds trainer rank
  coach = false; // first-run teaching: ghost pull + contextual beats (main.ts)
  coachDone = false; // raised when the first coached wave clears → meta
  box: SpeciesDef[] = []; // captured mons — swap in between stages
  boxHp: number[] = []; // each boxed mon's hp fraction — benching never heals
  boxLvl: number[] = []; // each boxed mon's level — benching keeps earned levels
  boxPing = false; // a fresh catch waits in the box — the map's TEAM · ITEMS ball bounces until you look
  boxGain: SpeciesDef | null = null; // newest box member — the reward banner names it
  wantMenu = false; // reward asks main to open the roster first — swap comes before the item pick
  // run stats for end-of-run badges — RNGdle-style "what did this run earn"
  score = 0; // run score — total damage dealt to enemies
  maxCombo = 0; // best pass-chain in a single shot
  maxKos = 0; // most enemies one shot downed
  totalKos = 0; // enemies downed all run
  caughtBoss = false;
  shiniesCaught = 0; // gold KOs this run — shiny KOs always land in the box
  perksTaken = 0;
  perkIds: string[] = []; // every granted perk — the save re-applies them in order on resume
  boxSel = -1; // box index picked for swapping
  teamSel = -1; // team index picked — a swap starts from either side
  depth = 0; // rolled stages survived past the opening trio
  raid = false; // standalone one-boss fight — never touches 'reward'/'map' or the climb-clear ledger
  secret: SecretState | null = null;
  secretsRun = 0;
  raidMod = ''; // the day's seeded handicap — a RAID_MODS id, spent in spawnWave/makeEnemy
  rewardOffers: Perk[] = [];
  tools = { roll: 1 }; // offer-tool charges, per-run — REROLL re-deals the board
  perkOfferN = 3; // perk cards per board — lab 'fourth' deals a fourth
  // lab multis — read once at construction (the shop lives on the title,
  // a mid-run buy can't happen); perks re-apply on top in applySnapshot
  private labHpMult = 1; // 'hp': team maxHp mult
  private labSpcMult = 1; // 'spc': bump-super damage mult
  private labLuck = 0; // 'luck': flat team luck feeding the gym fountain
  starMult = 1; // 'earnings' lab + amulet coin: star payout mult, ceil'd per payout
  starsRun = 0; // star pieces banked this run — the result screen's +N row
  reviveToken = false; // 'revive': the first KO each run stands back up
  reviveUsed = false; // spent flag — persisted like ashArmed
  private rewardCap = 3; // tier cap the board was dealt at — reroll re-deals the same quality
  mapNode = 0; // index into region.nodes — the stop the team stands on
  hardWave = false; // the wave just cleared was a hard stop — bigger payout (trainers)
  eliteWave = false; // elite stops pay out rare-or-better relics only
  killer: string | null = null; // what felled the run — named on the wipe screen
  lastRecruit: SpeciesDef | null = null; // gym ace prize, for the reward screen
  private rewardPending = false;
  private hpScale = 1;
  private theme: Theme; // current wave's scene — the element of the battle
  get themeName(): string {
    return THEME_NAME[this.theme];
  }
  private deepThemes = new Map<number, Theme>(); // rolled rows remember the biome their pool was drawn from
  traits = new Map<PokeType, number>(); // type-trait tiers — teamTraits, refreshed on composition shifts
  private pendingEventWave: WaveSpawn[] | null = null; // ?-stop ambush replaces the row's wave
  private inEvent = false; // this wave is a scripted event fight (no gym credit)
  private skipWave = false; // a ? event resolved the stop — row clears with no fight
  private curSpawns: WaveSpawn[] = []; // the wave actually fielded (for the recruit roll)
  eggIn = 0; // stops until the egg hatches — the ? pool's slow payoff
  eggJustLaid = false; // the laying arrival doesn't consume a tick
  daycare: { def: SpeciesDef; hp: number; lvl: number; back: number } | null = null;
  doubleChest = false; // the old couple's ?-blessing — the next map chest rolls two relics
  private waveShots = 0; // shots taken this wave — the anti-stall pressure ramp
  private stopShots = 0; // shots across every battle of this stop
  private par = 10; // this stop's SPEED CLEAR turn target
  private stopCombo = 0; // best pass-chain this stop — the clear card's MAX COMBO
  private stopWeak = 0; // weak-point hits this stop
  private shotWeak = 0; // weak-point hits this shot — 3+ fire the tally banner
  private stopKos = 0; // foes downed this stop
  private stopTaken = 0; // damage the team took this stop
  private stopFaints = 0; // team faints this stop — any faint costs a rank step
  rankStreak = 0; // consecutive A-or-better stop clears
  bestRankStreak = 0; // the run's longest such streak — the run report row
  runRanks: ClearRank[] = []; // stop ranks by stage index — the share card's gym balls; not saved, a resumed run starts blank
  clearCard: ClearCard | null = null; // last stop's summary — drawn over the reward board until tapped
  private sweepStreak = 0; // consecutive one-shot clears — the streak pays
  private waveFlawless = true; // no hit taken this wave — the clear ribbon pays it out
  private splashing = false; // psychic trait re-entry guard
  private mapCam = -1; // island-row the viewport starts at — lerps toward mapCamTarget
  private mapMsg = ''; // toast line on the region map (resolved events, egg ticks)
  eventBox: { note: string; art?: EventArt } | null = null; // resolved ? event — modal card, tap to close
  private eventChoice: { prompt: string; options: EventChoice[]; art?: EventArt; node: MapNode } | null = null; // ? that asks — row waits on the pick
  // a modal card or a walk-in-progress owns map taps — the team menu
  // stays shut under them
  get mapModal() {
    return !!(this.eventBox || this.eventChoice || this.mapWalk);
  }
  private cardT = 0; // event-card pop timer — the card scales in when it opens
  private choiceHit: { x: number; y: number; w: number; h: number }[] = []; // last-drawn option rects
  private mapMsgT = 0;
  // the run's visible trail — session flavour, capped, not saved in the snapshot
  fieldLog: string[] = [];
  // victory loot — a gym boss bursts into PokéCoins; drag the lead mon to
  // scoop them before the lap ends
  private lootCoins: { x: number; y: number; vx: number; vy: number; r: number; spin: number; kind: 'coin' | 'gem' | 'heart' | 'candy' | 'star'; val: number }[] = [];
  private lootT = 0;
  private lootDrag = false;
  private lootDown: Vec | null = null; // where the leash was grabbed — an unmoved release is a tap, not a scoop
  private lootPos: Vec | null = null;
  private lootChain = 0; // consecutive scoops — pitch climbs with the streak
  private lootChainT = -9; // last scoop — the chain decays after ~0.6s
  private lootGot = 0; // score scooped this fountain — tallied at the end
  private bossKilledAt: { x: number; y: number } | null = null; // coin fountain origin
  private trail: { x: number; y: number; t: number }[] = []; // speed smear — ghost positions of the flying ball
  private lastPath: { x: number; y: number }[] = []; // the previous shot's arc — echoes faintly under the next aim
  private fx: Fx[] = []; // sparks, streaks and stars from every impact
  private pops: { x: number; y: number; id: number; r: number; t: number; life: number }[] = []; // KO ghost-outs — the sprite flashes skyward
  private punch = 0; // camera zoom-kick — big hits lunge the screen
  private fin = { x: 0, y: 0, t: 0 };
  private finishN = 0;
  private koX = 0;
  private koY = 0;
  private koSeen = false;
  private hitWeak = false;

  constructor(
    public arena: Rect,
    team: SpeciesDef[],
    public stage: StageDef,
    private rng: () => number,
    bag: string[] = [], // run-start bag picks (pk_bag ids) — applied below
  ) {
    this.theme = stage.theme;
    // the lab's permanent training — apply BEFORE perks replay in
    // applySnapshot, so a maxHp bump can't stomp banked hp (Oct-20 ordering)
    this.labHpMult = 1 + LAB_HP_LV * labLevel('hp');
    this.dmgMult *= 1 + LAB_DMG_LV * labLevel('dmg');
    this.labSpcMult = 1 + LAB_SPC_LV * labLevel('spc');
    this.labLuck = LAB_LUCK_LV * labLevel('luck');
    this.starMult = 1 + LAB_EARN_LV * labLevel('earnings');
    this.tools = { roll: 1 + labLevel('reroll') };
    this.perkOfferN = 3 + (labLevel('fourth') ? 1 : 0);
    this.reviveToken = !!labLevel('revive');
    // bought levels announce themselves — the field log names what the lab
    // is actually doing this run so a purchase never feels dead
    const labBits = [
      labLevel('hp') && `+${Math.round(LAB_HP_LV * labLevel('hp') * 100)}%HP`,
      labLevel('dmg') && `+${Math.round(LAB_DMG_LV * labLevel('dmg') * 100)}%DMG`,
      labLevel('spc') && `+${Math.round(LAB_SPC_LV * labLevel('spc') * 100)}%SPC`,
      labLevel('luck') && `+${LAB_LUCK_LV * labLevel('luck')}LUCK`,
      labLevel('earnings') && `+${Math.round(LAB_EARN_LV * labLevel('earnings') * 100)}%★`,
    ].filter(Boolean);
    if (labBits.length) this.log(`LAB ${labBits.join(' · ')}`);
    const n = team.length;
    team.forEach((def, i) => {
      this.players.push(this.makeUnit(def, Math.max(1, Math.min(LV_CAP, def.lvl ?? 1)), i, n));
    });
    // bag items field after the team does — persistent consumables earned
    // on gym wins, picked on the draft screen (≤1)
    this.bagIds = bag;
    for (const id of bag) {
      const it = BAG_ITEMS.find((i) => i.id === id);
      it?.apply(this);
      for (let n = itemTier(id); n > 0; n--) it?.perTier?.(this);
    }
    const mapSeed = Math.floor(this.rng() * 2 ** 31);
    this.mapSeed = mapSeed;
    // vfx roll off their own stream: seeded so replays match, but particle
    // spam can never shift the gameplay rng (a pull keeps its three draws)
    this.fxRng = mulberry32(mapSeed ^ 0x5f3759df);
    this.region = genRegion(mapSeed);
    this.assignGymSigns(mapSeed);
    this.mapCam = this.mapCamTarget();
    // no staged wave: HOME (row -1) is just the starter pick — the first
    // fight is whichever stage-1 fork you walk to
    this.phase = 'map';
  }

  // A raid skips the island — the constructor always parks on 'map', so the
  // caller jumps the lone staged wave straight into the fight.
  startFight() {
    this.spawnWave(0);
    this.nextTurn();
    // the banner names the event + the day's handicap, not 'WAVE 1'
    const modName = RAID_MODS.find((m) => m.id === this.raidMod)?.name;
    this.waveSpecial = modName ? `CHROMA RAID · ${modName}` : 'CHROMA RAID';
    this.log(this.waveSpecial);
    this.waveTelop();
  }

  // ?debug=arenaN — jump the pinned court without the raid banner;
  // &wave=M previews a deeper row (generated courts live past wave 0)
  debugSpawn(i = 0) {
    this.spawnWave(i);
    this.nextTurn();
  }

  // gym stops wear their leader's type on the sign, like trainer doors —
  // a staged gym reads the boss it already rolled; a rolled gym picks a
  // boss type now so the wave honors the sign when it's dealt. The pick
  // runs on a map-seeded stream so the run's roll order never shifts.
  private assignGymSigns(mapSeed: number) {
    const gymRng = mulberry32(mapSeed);
    for (const n of this.region.nodes) {
      if (n.kind !== 'gym') continue;
      const staged = this.stage.waves[n.row]?.find((s) => s.boss);
      n.ttype = staged?.def.type ?? BOSS_POOL[Math.floor(gymRng() * BOSS_POOL.length)].type;
    }
  }

  // the trail feed — newest at the tail, 24-deep before old lines shift out
  log(line: string) {
    this.fieldLog.push(line);
    if (this.fieldLog.length > 24) this.fieldLog.shift();
  }

  // Perks come through one door so the save can replay the same list:
  // apply + record id + bank the item icon.
  grantPerk(p: Perk) {
    p.apply(this);
    this.perkIds.push(p.id);
    this.heldItems.push(p.item);
    this.log(`RELIC · ${p.name.toUpperCase()}`);
  }

  // The run is safe to bank on the map — and at the reward/loot break,
  // where the row is already resolved. Refusing to save there let a
  // quit-at-reward resume BEFORE the fight and re-pay its KOs and row.
  // Resuming past it costs the unclaimed board pick — the honest price
  // of a mid-choice park. Mid-fight, mid-walk or mid-choice frames still
  // return null.
  snapshot(): RunSave | null {
    const parked =
      this.phase === 'map' ||
      ((this.phase === 'reward' || this.phase === 'loot') && !this.evoChoice && !this.evoPending.length);
    if (!parked || this.mapWalk || this.eventChoice) return null;
    // a reward/loot park never reopens the board, so the cleared row's
    // payday would die with advanceReward — pay it into the save now
    if (this.phase !== 'map') this.bankStage(this.waveIndex);
    return {
      seed: 0, // caller stamps the run seed — battle only knows mapSeed
      daily: false,
      asc: this.asc,
      mapSeed: this.mapSeed,
      mapNode: this.mapNode,
      secret: secretSave(this),
      waveIndex: this.waveIndex,
      depth: this.depth,
      // banked mid-reward/loot: the row already fought is resolved, so the
      // resume marker sits past it — the wave can't be refought for a
      // second row pay
      pendingNext: this.phase === 'map' ? this.pendingNext : this.waveIndex + 1,
      mapNote: this.mapNote,
      eggIn: this.eggIn,
      eggJustLaid: this.eggJustLaid,
      daycare: this.daycare
        ? {
            id: this.daycare.def.id,
            lvl: this.daycare.lvl,
            shiny: this.daycare.def.shiny || undefined,
            luck: this.daycare.def.luck,
            hp: this.daycare.hp,
            back: this.daycare.back,
          }
        : undefined,
      doubleChest: this.doubleChest,
      team: this.players.map((p) => ({
        id: p.def.id,
        lvl: p.lvl,
        shiny: p.shiny || undefined,
        hp: p.hp,
        luck: p.def.luck,
        joined: p.def.joined,
        cdMod: p.cdMod,
        cd: p.cd,
        sash: p.sash,
      })),
      tagEchoDone: this.tagEchoDone,
      box: this.box.map((d) => ({ id: d.id, lvl: d.lvl, shiny: d.shiny || undefined, luck: d.luck })),
      boxHp: [...this.boxHp],
      boxLvl: [...this.boxLvl],
      perks: [...this.perkIds],
      heldItems: [...this.heldItems],
      tools: { ...this.tools },
      // durable items' effects already live in team[].lvl — re-applying on
      // resume would double them; the rest replay like perks
      bag: this.bagIds.filter((id) => !BAG_ITEMS.find((i) => i.id === id)?.durable),
      masterArmed: this.masterArmed,
      ashArmed: this.ashArmed,
      reviveUsed: this.reviveUsed,
      ultIn: this.ultIn,
      starsRun: this.starsRun,
      score: this.score,
      perksTaken: this.perksTaken,
      gymsBeaten: this.gymsBeaten,
      shiniesCaught: this.shiniesCaught,
      maxCombo: this.maxCombo,
      maxKos: this.maxKos,
      treasure: this.treasure.opened,
      totalKos: this.totalKos,
      caughtBoss: this.caughtBoss,
      coachDone: this.coachDone,
      echoCleared: this.echoCleared,
      savedAt: Date.now(),
    };
  }

  // Rebuild run state on a fresh Battle (same team defs, fresh rng): region
  // regens from mapSeed so the island is identical; perks re-apply so every
  // multiplier/flag comes through the same code path it was picked through.
  applySnapshot(s: RunSave) {
    this.mapSeed = s.mapSeed;
    this.region = genRegion(s.mapSeed);
    this.assignGymSigns(s.mapSeed);
    this.regionBase = null; // terrain canvas rebakes
    // a saved node past the tree's end can't just clamp to the last node —
    // that leaf has no forward links and strands the run on the map; fall
    // back to the row the player last fought (always a real node)
    this.mapNode =
      s.mapNode < this.region.nodes.length
        ? s.mapNode
        : Math.max(0, this.region.nodes.findIndex((n) => n.row === s.waveIndex));
    this.waveIndex = s.waveIndex;
    this.depth = s.depth;
    this.pendingNext = s.pendingNext;
    secretLoad(this, s.secret);
    // stage.waves restarts at the seeded 3 — refill the rows this run already
    // passed or the next spawnWave reads waves[i] past the array end. Each
    // row re-rolls at the depth it originally pushed with, gym leaders baked
    while (this.stage.waves.length <= Math.max(s.pendingNext, s.waveIndex)) {
      const r = this.stage.waves.length;
      const gym = this.region.nodes.find((n) => n.row === r && n.kind === 'gym');
      const th = THEMES[Math.floor(this.rng() * THEMES.length)];
      this.deepThemes.set(r, th); // a resumed row keeps the biome its pool rolled
      this.stage.waves.push(rollWave(this.rng, r - 2, th, gym?.ttype));
    }
    // backfilled rows are rolled waves too — depth must count them or a
    // resumed climb can clear the last gym short of FINAL_DEPTH and stall
    // on the map at "STAGE 10 OF 9" instead of winning
    this.depth = Math.max(this.depth, this.stage.waves.length - 3);
    this.mapNote = s.mapNote;
    this.eggIn = s.eggIn ?? 0; // v2 saves predate the egg timer — no egg
    this.eggJustLaid = s.eggJustLaid ?? false;
    const daycare = s.daycare;
    const daycareDef = daycare && speciesById(daycare.id);
    this.daycare = daycare && daycareDef
      ? {
          def: { ...daycareDef, shiny: daycare.shiny || undefined, luck: daycare.luck },
          hp: daycare.hp,
          lvl: daycare.lvl,
          back: daycare.back,
        }
      : null;
    this.doubleChest = s.doubleChest ?? false;
    this.asc = s.asc;
    this.perkIds = [...s.perks];
    for (const id of s.perks) PERKS.find((p) => p.id === id)?.apply(this);
    // bag items replay the same door as perks; armed flags come back
    // verbatim so a spent ball/ash stays spent
    this.bagIds = [...(s.bag ?? [])];
    for (const id of this.bagIds) {
      const it = BAG_ITEMS.find((i) => i.id === id);
      it?.apply(this);
      for (let n = itemTier(id); n > 0; n--) it?.perTier?.(this);
    }
    if (s.masterArmed != null) this.masterArmed = s.masterArmed;
    if (s.ashArmed != null) this.ashArmed = s.ashArmed;
    this.reviveUsed = s.reviveUsed ?? false; // a spent token stays spent
    this.ultIn = s.ultIn ?? ULT_SHOTS; // older saves re-arm the charge
    this.ultFill = ULT_SHOTS - this.ultIn;
    this.starsRun = s.starsRun ?? 0;
    // a spent echo visit stays spent — without this a park/resume re-arms it
    this.tagEchoDone = s.tagEchoDone ?? false;
    // stamp saved per-mon state last so perk replays (heals, elixir's
    // cd = 0, focus-sash re-arm) can't double-fire on top of it
    this.players.forEach((p, i) => {
      const t = s.team[i];
      if (!t) return;
      p.hp = Math.max(0, Math.min(t.hp, p.maxHp));
      p.dead = p.hp <= 0;
      if (t.luck != null || t.joined != null) p.def = { ...p.def, luck: t.luck, joined: t.joined };
      if (t.cdMod != null) p.cdMod = t.cdMod;
      if (t.cd != null) p.cd = Math.max(0, Math.min(t.cd, p.cdMax));
      if (t.sash != null) p.sash = t.sash;
    });
    // hp/lvl ride parallel to the box — drop each dead species WITH its
    // pair, or one filtered slot shifts every later mon's numbers
    const boxed = s.box
      .map((e, i): { def: SpeciesDef; hp: number; lvl: number } | null => {
        const base = speciesById(e.id);
        return base
          ? { def: { ...base, lvl: e.lvl, shiny: e.shiny || undefined, luck: e.luck }, hp: s.boxHp[i], lvl: s.boxLvl[i] }
          : null;
      })
      .filter((x): x is { def: SpeciesDef; hp: number; lvl: number } => !!x);
    this.box = boxed.map((x) => x.def);
    this.boxHp = boxed.map((x) => x.hp);
    this.boxLvl = boxed.map((x) => x.lvl);
    this.heldItems = [...s.heldItems];
    // v1 run saves predate offer tools — default them rather than coerce
    this.tools = { roll: s.tools?.roll ?? 1 };
    this.score = s.score;
    this.perksTaken = s.perksTaken;
    this.gymsBeaten = s.gymsBeaten;
    this.shiniesCaught = s.shiniesCaught;
    this.maxCombo = s.maxCombo;
    this.maxKos = s.maxKos;
    this.treasure.opened = s.treasure ?? 0;
    this.totalKos = s.totalKos;
    this.caughtBoss = s.caughtBoss;
    this.coachDone = s.coachDone;
    this.echoCleared = s.echoCleared;
    this.phase = 'map';
    this.mapCam = this.mapCamTarget();
    this.refreshTraits();
    // a resumed run starts a fresh trail — but not a silent one
    this.log('CONTINUED THE CLIMB');
  }

  get active(): Unit {
    return this.players[this.activeIdx];
  }

  get waveCount() {
    return this.stage.waves.length;
  }

  // the ?-event pool shares the run's seeded roll source — a property, so
  // callers can hand `b.roll` to pickWild without losing `this`
  roll = () => this.rng();

  // tier of a team trait — 0 when the type isn't fielded enough
  private t(ty: PokeType) {
    return this.traits.get(ty) ?? 0;
  }

  private refreshTraits() {
    this.traits = teamTraits(this.players);
  }

  // ASC 2+: foes don't wait politely — their attack cycle shortens
  private ascTimerMult() {
    return this.asc >= 2 ? 0.85 : 1;
  }

  private spawnWave(i: number, node?: MapNode) {
    this.koSeen = false;
    this.fin.t = 0;
    clearAnims();
    this.waveIndex = i;
    // trainer stops field a mono-type squad — the node's ttype picks it;
    // rolled rows still don't exist until the stop is chosen
    const elite = node?.kind === 'elite';
    const ttype = node?.kind === 'trainer' || elite ? node.ttype ?? 'normal' : null;
    this.inTrainer = ttype != null;
    this.waveType = ttype;
    this.eliteWave = elite;
    this.inEvent = false;
    this.waveShots = 0;
    this.stopShots = 0;
    this.stopCombo = this.stopWeak = this.stopKos = this.stopTaken = this.stopFaints = 0;
    this.connect.reset();
    this.lastKoType = undefined;
    this.missions.start(this.mapSeed, i + 1, this.players.map((p) => p.def.type), this.ultIn <= 6, this.time, this.raid || this.coach || !!this.pendingEventWave || !!debugArena());
    this.clearCard = null;
    this.waveFlawless = true;
    this.fever = this.shotFever = false; // a fresh pack cools the streak's fever
    // ultIn banks across the whole run — pips earned in one fight spend at the next
    this.boxGain = null;
    this.refreshTraits();
    let spawns: WaveSpawn[];
    if (this.pendingEventWave) {
      // a ?-stop ambush: scripted wave — a hard stop, but never a gym badge
      spawns = this.pendingEventWave;
      this.pendingEventWave = null;
      this.inEvent = true;
      if (i >= this.stage.waves.length) {
        this.depth++;
        // keep waves[i] indexed by row even though the event replaced it —
        // the next row reads stage.waves[i+1] off this slot
        const th = THEMES[Math.floor(this.rng() * THEMES.length)];
        this.deepThemes.set(this.stage.waves.length, th);
        this.stage.waves.push(rollWave(this.rng, this.depth, th));
      }
    } else {
      while (i >= this.stage.waves.length) {
        this.depth++;
        // a gym's rolled wave fields the leader its sign announced; deep
        // waves roll their biome per row — the climb isn't one species pool.
        // The biome is remembered so the arena draws the same element.
        const th = THEMES[Math.floor(this.rng() * THEMES.length)];
        this.deepThemes.set(this.stage.waves.length, th);
        this.stage.waves.push(
          rollWave(this.rng, this.depth, th, node?.kind === 'gym' ? node.ttype : undefined),
        );
      }
      // elite doors field the same mono-type squad but one depth tier hotter
      spawns = ttype ? trainerWave(this.rng, this.depth + (elite ? 1 : 0), ttype) : this.stage.waves[i];
    }
    this.hardWave = this.inTrainer || this.inEvent;
    this.curSpawns = spawns;
    this.hpScale = 1 + this.foeHpBonus + this.depth * 0.25 + i * 0.12 + this.asc * 0.15; // wave 3 mobs are +24% tanky; ascension stacks on top
    // the arena IS the element of the battle: a typed stop (trainer /
    // elite / gym boss) fights in its type's court, wild waves in the
    // biome their pool was drawn from — never a mid-battle scene swap
    const bossType = spawns.find((s) => s.boss)?.def.type;
    this.theme =
      debugArena() ??
      (ttype ? TYPE_THEME[ttype] : bossType ? TYPE_THEME[bossType] : this.deepThemes.get(i) ?? this.stage.theme);
    this.weather = this.rng() < (this.dailyWeather ? 1 : 0.5) ? (WEATHER_FOR[this.theme] ?? rolledSky(this.rng)) : null;
    // stale super timers mustn't carry hits into the fresh wave — orbs
    // included, or a flight of homers retargets onto the next pack
    this.delays = [];
    this.waves = [];
    this.dashes = [];
    this.orbs = [];
    // a legendary can crash any non-boss wave past the first — MS invades;
    // a dead run's team can return as a rival fight — fail-forward echo
    this.waveSpecial = null;
    this.curMod = null; // mutators live and die with the wave they rolled on
    this.waveHadGym = spawns.some((s) => s.boss) && !this.inEvent && !this.raid; // a raid boss isn't a leader — no badge, bag stock or gymsBeaten
    // the family stab lands under the gym march — colored by the leader's type
    if (this.waveHadGym) playJingle(GYM_STAB[spawns.find((s) => s.boss)?.def.type ?? 'normal'] ?? 'gym_earth');
    // gym leaders own their sky — every gym court runs weather. ASC 8
    // STORM: the sky never clears — every other wave rolls the pool too.
    if (this.waveHadGym) this.weather = WEATHER_FOR[this.theme] ?? null;
    else if (this.asc >= 8) this.weather = rolledSky(this.rng); // rung 8 promises a sky — a weatherless court borrows one
    // weather summoners own the sky — a drought caller's arrival overrules
    // whatever rolled, and its banner names the sky it brought
    const caller = spawns.find((s) => s.def.skyFor);
    if (caller) {
      this.weather = caller.def.skyFor ?? null;
      const skyLabel = { sun: 'DROUGHT CALLER!', rain: 'DRIZZLE CALLER!', sand: 'SAND STREAM!', wind: 'AIR LOCK!', storm: 'LIGHTNING CALLER!' }[caller.def.skyFor as Weather];
      this.waveSpecial = this.waveSpecial ? `${this.waveSpecial} · ${skyLabel}` : skyLabel;
    }
    // STORM CALLER raid: the boss's own typing owns the court's sky all
    // fight — a caller escort may narrate, but the mod's sky wins
    if (this.raid && this.raidMod === 'storm') {
      const bt = spawns.find((s) => s.boss)?.def.type;
      this.weather = ({ water: 'rain', fire: 'sun', rock: 'sand', flying: 'wind', electric: 'storm' } as Partial<Record<PokeType, Weather>>)[bt ?? 'normal'] ?? WEATHER_FOR[this.theme] ?? 'storm';
    }
    // the storm chaser's contract outranks every override — no clear courts
    if (this.dailyWeather) this.weather ??= rolledSky(this.rng);
    this.inRival = false;
    // ASC 1 ROAMERS: echoes and invades hunt twice as hard. ASC 9 TAG
    // TEAM: the echo is owed one guaranteed visit this climb.
    const roam = this.asc >= 1 ? 2 : 1;
    const tagTeam = this.asc >= 9 && !this.tagEchoDone;
    if (ttype) {
      this.waveSpecial = elite
        ? `ACE TRAINER · RARE LOOT ON THE LINE!`
        : `${TRAINER_CLASS[ttype]?.title ?? 'TRAINER'} WANTS TO BATTLE!`;
      sfx('invade');
    } else if (!this.inEvent && this.echo?.length && i > 0 && !this.waveHadGym && (tagTeam || this.rng() < 0.15 * roam)) {
      spawns = this.curSpawns = rivalWave(this.echo.map((e) => e.def), this.rng);
      this.waveSpecial = 'RIVAL BATTLE · YOUR FALLEN TEAM RETURNS!';
      this.inRival = true;
      this.tagEchoDone = true; // echo fought — the owed visit is spent
      sfx('invade');
    } else if (!this.inEvent && i > 0 && !this.waveHadGym && this.rng() < (0.09 + this.rank * 0.03) * roam) {
      const inv = INVADERS[Math.floor(this.rng() * INVADERS.length)];
      spawns = [{ def: inv, nx: 0.5, ny: 0.3, boss: true }, ...spawns.slice(0, 2)];
      this.waveSpecial = `A WILD ${inv.name.toUpperCase()} APPEARED!`;
      sfx('invade');
      playJingle('invade'); // the minor stab under the rise — a legendary just walked in
    }
    this.curSpawns = spawns; // rival/invade overrides still feed the recruit roll
    if (!this.waveSpecial && this.mapNote) this.waveSpecial = this.mapNote;
    // a species pod names itself — three-plus of one species is a flock,
    // not a coincidence. Shared flags make the wave one focused puzzle.
    if (!this.waveSpecial && !spawns.some((s) => s.boss) && spawns.length >= 3
        && spawns.every((s) => s.def === spawns[0].def)) {
      this.waveSpecial = `A PACK OF ${spawns[0].def.name.toUpperCase()}!`;
    }
    // whatever the banner says — trainer, rival, invade or event note — is the trail line
    if (this.waveSpecial) this.log(this.waveSpecial);
    // Archero room pull: the wave's court is one hand-authored template —
    // slabs, moats, mines and spawn anchors all come with the room. Boss
    // waves take the open gym arena; openers stay gentle; trainer battles
    // are always furnished.
    const bossWave = spawns.some((s) => s.boss);
    // ~1 gym in 3 fights in a furnished court — a FORTRESS raid is always one
    const gymFurnished = bossWave && this.secret?.phase !== 'fight' && (this.raidMod === 'fortress' || this.rng() < 0.3);
    this.gymFurnished = gymFurnished;
    this.barBreak = false;
    let li = 0;
    if (!bossWave) {
      if (i === 0) li = Math.floor(this.rng() * 3); // gentle openers
      else if (this.inTrainer || this.rng() < 0.8) {
        // the hard tail (keep/pincer/saltire) rides in from depth 2 — the
        // early climb keeps the mid pool
        const hi = this.depth >= 2 ? ROOM_LAYOUTS.length : ROOM_LAYOUTS.length - ROOM_HARD;
        li = 1 + Math.floor(this.rng() * (hi - 1));
      }
    }
    const grid =
      gymFurnished
        ? ROOM_LAYOUTS[1 + Math.floor(this.rng() * (ROOM_LAYOUTS.length - 1))]
        : bossWave
          ? bossRooms(this)[0]
          : debugRoom() === 'gen' ||
              (debugRoom() !== 'authored' && i !== 0 && li > 0 && this.rng() < 0.4) // generated courts share the mid/hard pull; gentle openers stay authored
            ? genRoom(this.theme, this.rng)
            : ROOM_LAYOUTS[li];
    this.roomGrid = grid;
    const room = buildRoom(grid, this.theme, this.rng);
    this.installRoom(room);
    // spawn anchors drive enemy placement — Archero foes enter where the
    // room designer put the hooks, not on scattered slots. Bosses keep
    // their authored entrance; leftovers keep rolled positions.
    const anchors = [...room.anchors];
    for (const s of spawns) {
      if (s.boss || !anchors.length) continue;
      let best = 0;
      for (let k = 1; k < anchors.length; k++) {
        const d = (anchors[k].nx - s.nx) ** 2 + (anchors[k].ny - s.ny) ** 2;
        if (d < (anchors[best].nx - s.nx) ** 2 + (anchors[best].ny - s.ny) ** 2) best = k;
      }
      const a = anchors.splice(best, 1)[0];
      s.nx = a.nx;
      s.ny = a.ny;
    }
    // staggered first volley: fodder enters on a spread clock so the strike
    // order reads; reloads stay synced (enemyReload) so the rhythm is learnable
    this.enemies = spawns.map((s, si) => {
      const e = this.makeEnemy(s, i);
      if (!e.boss) e.timer += si % 3;
      return e;
    });
    this.battle = 1;
    resetAbilities(this);
    this.battles = 1;
    this.battleBreak = false;
    if (i > 0 && !bossWave && !this.inTrainer && !this.inEvent && !this.inRival && !this.raid && !this.coach)
      for (const skip of BATTLE_SKIP) if (this.rng() >= skip) this.battles++;
    this.missions.rare = this.flee.plan((Math.imul(this.mapSeed, 2654435761) + Math.imul(i, 40503) + 0xf1ee) >>> 0, i + 1, this.battles, bossWave || this.raid || this.inEvent || this.inTrainer || this.inRival || this.coach || !!this.pendingEventWave, isGentleRoom(this.roomGrid));
    if (this.flee.at === this.battle && !isGentleRoom(this.roomGrid)) this.enemies.push(this.flee.spawn(this.flee.build(this as any, () => this.makeEnemy(this.flee.spawnAt(), this.waveIndex))));
    this.par = Math.min(24, Math.max(10, this.battles * PAR_PER_BATTLE + (bossWave ? PAR_BOSS : 0)));
    // rival echo fights at the levels it earned — the ghost of a stacked
    // run is a real fight, not a victory lap
    if (this.inRival) {
      this.enemies.forEach((e, i) => {
        const lv = this.echo?.[i]?.lvl ?? 1;
        e.lvl = lv;
        e.pow = lvlPow(offStat(e.def.stats, e.def.type), lv);
        e.maxHp = Math.round(e.maxHp * lvlHp(e.def.stats.hp, lv));
        e.hp = e.maxHp;
      });
    }
    // gym aces and event alphas carry a held item — pokelike's curated
    // boss kit, one rolled quirk per fight
    const armed = this.enemies.find((e) => e.boss);
    if (armed && (this.waveHadGym || this.inEvent || this.raid)) this.armBoss(armed); // the raid boss keeps its rolled quirk
    // the raid's day-seeded handicap spends itself here — every flag is one
    // the wave mutators already use, applied by name to the whole pack
    if (this.raid) switch (this.raidMod) {
      case 'plated':
        for (const e of this.enemies) {
          e.def = { ...e.def, shielded: true };
          e.shieldA = this.rng() * Math.PI * 2;
        }
        break;
      case 'warded':
        for (const e of this.enemies) e.shieldN = Math.max(e.shieldN, 1);
        break;
      case 'volatile':
        for (const e of this.enemies) e.volatile = true;
        break;
      case 'frenzy':
        for (const e of this.enemies) e.drift *= 1.25;
        break;
      case 'guardian': {
        const esc = this.enemies.filter((e) => !e.boss);
        if (esc[0]) esc[0].supp = 'aegis';
        if (esc[1]) esc[1].supp = 'medic';
        break;
      }
      // 'storm'/'fortress'/'enraged'/'hasty'/'horde' land earlier — sky, room
      // pick, boss flags and the escort count all set before this point
    }
    // normal trait: the squad mends as the wave forms
    const mend = this.t('normal') * 0.05;
    if (mend > 0) {
      for (const p of this.players) {
        if (!p.dead) p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * mend));
      }
    }
    // wave mutators: a third of rolled non-boss waves get an affix —
    // same stop, different fight (StS hallway affixes)
    let powerZoneSpawn = false; // 'power' mutator pushes its zone once hazards land
    let stormSpawn = false; // 'storm' lays two converging gust lanes
    let thornSpawn = false; // 'thorns' seeds a spike field mid-court
    if (i > 0 && !bossWave && !ttype && !this.inEvent && !this.inRival && this.rng() < (this.allAffix ? 1 : 0.35)) {
      const MODS = ['swarm', 'swarm', 'swarm', 'hasty', 'hasty', 'volatile', 'volatile', 'big', 'big', 'gold', 'cleric', 'aegis', 'zombie', 'zombie', 'skull', 'grav', 'power', 'warded', 'sky', 'skitter', 'hexed', 'tailwind', 'headwind', 'slick', 'storm', 'thorns', 'armored', 'slumber', 'polarized', 'echo'];
      const mod = MODS[Math.floor(this.rng() * MODS.length)];
      switch (mod) {
        case 'swarm': // two extra fodder pour in, each softened up
          for (let k = 0; k < 2; k++) {
            const e = this.makeEnemy(
              { def: pickWild(this.rng, this.depth), nx: 0.15 + this.rng() * 0.7, ny: 0.1 + this.rng() * 0.4 },
              i,
            );
            e.maxHp = Math.round(e.maxHp * 0.8);
            e.hp = e.maxHp;
            this.enemies.push(e);
          }
          break;
        case 'hasty': // everyone acts a turn sooner — pressure wave
          for (const e of this.enemies) e.timer = Math.max(1, e.timer - 1);
          break;
        case 'volatile': // KOs burst and splash the pack — chains are live
          for (const e of this.enemies) e.volatile = true;
          break;
        case 'big': { // one fodder supersizes — a mini-boss body
          const e = this.enemies[Math.floor(this.rng() * this.enemies.length)];
          if (e) {
            e.r = Math.round(e.r * 1.45);
            e.maxHp = Math.round(e.maxHp * 1.6);
            e.hp = e.maxHp;
            e.pow *= 1.3;
            const at = this.unstick(e.x, e.y, e.r + 2); // the bigger body may now touch a slab
            e.x = at.x;
            e.y = at.y;
          }
          break;
        }
        case 'gold': { // one guaranteed shiny in the pack — catch bait
          const e = this.enemies[Math.floor(this.rng() * this.enemies.length)];
          if (e) e.shiny = true;
          break;
        }
        case 'cleric': // a medic hides in the pack — kill it or the fight drags
        case 'aegis': { // a guardian wards allies — crack it or hits fizzle
          const e = this.enemies[Math.floor(this.rng() * this.enemies.length)];
          if (e) e.supp = mod === 'cleric' ? 'medic' : 'aegis';
          break;
        }
        case 'zombie': { // soul-linked pair — fell one and its partner drags it back
          const pool = this.enemies.filter((e) => !e.boss);
          if (pool.length >= 2) {
            const a = pool[Math.floor(this.rng() * pool.length)];
            let z = pool[Math.floor(this.rng() * pool.length)];
            while (z === a) z = pool[Math.floor(this.rng() * pool.length)];
            a.link = z;
            z.link = a;
            a.revives = z.revives = 2;
          }
          break;
        }
        case 'skull': { // a marked fodder — the KO pays a bounty
          const e = this.enemies.find((x) => !x.boss);
          if (e) e.skull = true;
          break;
        }
        case 'grav': { // gravity aura — shots crawl inside the bubble
          const e = this.enemies[Math.floor(this.rng() * this.enemies.length)];
          if (e) e.gravR = 110;
          break;
        }
        case 'power': // an ATK field — hits landed from inside hit harder
          powerZoneSpawn = true;
          break;
        case 'storm': // gust lanes converge on mid — shots ride the wind
          stormSpawn = true;
          break;
        case 'thorns': // a spike field erupts — grounded foes get fenced too
          thornSpawn = true;
          break;
        case 'armored': // the whole pack rolls plated — every contact is a
          // flanking exam. def is the shared DB row — clone before flagging.
          for (const e of this.enemies) {
            e.def = { ...e.def, shielded: true };
            e.shieldA = this.rng() * Math.PI * 2;
          }
          break;
        case 'slumber': // the whole pack dozes — assassinate quietly, but
          // splash and stray hits wake the neighbors into a bad night
          for (const e of this.enemies) if (!sleepProof(e.def)) e.asleep = true;
          break;
        case 'polarized': // every foe carries a repulsor halo — the court
          // is bumper cars; bank lanes or burn speed punching through
          for (const e of this.enemies) e.repelR = 80;
          break;
        case 'warded': // every foe carries a one-hit ward — the aegis bubble soak
          for (const e of this.enemies) e.shieldN = Math.max(e.shieldN, 1);
          break;
        case 'sky': // the pack takes wing — airborne creeps cross moats/boulders
          for (const e of this.enemies) e.airborne = true;
          break;
        case 'skitter': // +40% approach speed — the pack never stops moving
          for (const e of this.enemies) e.drift *= 1.4;
          break;
        case 'hexed': // your contacts envenom — rides curMod in strikeEnemy
        case 'tailwind': // +15% launch speed this wave — rides curMod on the sling
        case 'headwind': // -15% launch speed — banks need a longer pull
        case 'slick': // 40% less friction — the ball carries farther, settle comes late
        case 'echo': // the walls answer — banks return with interest
          break;
      }
      this.curMod = mod;
      const label = { swarm: 'SWARM!', hasty: 'HASTY FOES!', volatile: 'VOLATILE PACK!', big: 'A BIG ONE!', gold: 'SOMETHING SHINY GLINTS…', cleric: 'A CLERIC HIDES IN THE PACK!', aegis: 'A GUARDIAN WARDS THE PACK!', zombie: 'THEY WON\'T STAY DOWN!', skull: 'A MARKED FOE · BONUS ON KO!', grav: 'GRAVITY AURA!', power: 'POWER ZONE!', warded: 'WARDED PACK!', sky: 'THEY TAKE WING!', skitter: 'SKITTERING FOES!', hexed: 'HEXED FIELD!', tailwind: 'TAILWIND!', headwind: 'HEADWIND!', slick: 'SLICK COURT!', storm: 'A STORM FRONT ROLLS IN!', thorns: 'THORNS BURST FROM THE FIELD!', armored: 'THE PACK IS PLATED!', slumber: 'THE PACK IS NAPPING…', polarized: 'POLARIZED FIELD!', echo: 'ECHO WALLS!' }[mod] ?? 'MUTATED!';
      this.waveSpecial = this.waveSpecial ? `${this.waveSpecial} · ${label}` : label;
    }
    // MS-style field pickups: one per wave, period — two crowded the court
    this.pickups = [];
    this.stockedBall = null; // the pocket empties with the wave that stocked it
    this.scars = [];
    const npk = 1;
    // a lum cure only rolls when the pack carries a status threat — it
    // never crowds out the heal/atk drops on a clean wave, and keeps the
    // seeded stream identical on threat-free waves
    const ailThreat = this.enemies.some((e) => e.def.venom || e.def.para || e.def.burn || e.def.drowsy || e.def.shock || e.def.toxic || e.def.flame);
    // a revival herb only rolls when there's a body to raise — dead mons
    // carry over between waves, so the drop appears the wave after a loss;
    // corpse-free waves skip the extra draw and keep the seeded stream
    const deadMate = this.players.some((p) => p.dead);
    // a pocket ball only pays where a catch can land — trainer mons are owned
    const catchLive = !this.inTrainer;
    for (let k = 0; k < npk; k++) {
      const at = this.unstick(
        this.arena.x + this.arena.w * (0.15 + this.rng() * 0.7),
        this.arena.y + this.arena.h * (0.2 + this.rng() * 0.45),
        16,
      );
      const kind: PickupKind =
        deadMate && this.rng() < 0.4
          ? 'revival-herb'
          : ailThreat && this.rng() < 0.35
            ? 'lum-berry'
            : catchLive && this.rng() < 0.25
              ? 'great-ball'
              : PICKUP_KINDS[Math.floor(this.rng() * PICKUP_KINDS.length)];
      void loadItem(kind);
      this.pickups.push({
        x: at.x,
        y: at.y,
        kind,
        t: this.rng() * 6,
        age: 0,
      });
    }
    this.armBullets();
    this.armWeakPoints();
    // the room's hazard cells land as zones — lava ponds, silence pools,
    // mines (normalized layout → arena px)
    this.hazards = room.hazards.map((z) => ({
      kind: z.kind,
      x: this.arena.x + this.arena.w * z.nx,
      y: this.arena.y + this.arena.h * z.ny,
      r: this.arena.w * z.r,
      dir: z.dir,
      pair: z.pair,
      moat: z.moat,
    }));
    if (powerZoneSpawn) { // the 'power' mutator's ATK field, dropped mid-court
      const pr = this.arena.w * 0.14;
      const at = this.unstick(
        this.arena.x + this.arena.w * (0.2 + this.rng() * 0.6),
        this.arena.y + this.arena.h * (0.18 + this.rng() * 0.4),
        pr,
      );
      this.hazards.push({ kind: 'power', x: at.x, y: at.y, r: pr });
    }
    if (stormSpawn) { // twin gust lanes flank mid, both blowing inward
      const gr = this.arena.w * 0.1;
      const gy = this.arena.y + this.arena.h * (0.28 + this.rng() * 0.2);
      this.hazards.push(
        { kind: 'gust', x: this.arena.x + this.arena.w * 0.28, y: gy, r: gr, dir: 1 },
        { kind: 'gust', x: this.arena.x + this.arena.w * 0.72, y: gy, r: gr, dir: -1 },
      );
    }
    if (thornSpawn) { // spike strips erupt mid-court — chip the ball, fence the pack
      for (let k = 0; k < 2; k++) {
        const sr = this.arena.w * 0.062;
        const at = this.unstick(
          this.arena.x + this.arena.w * (0.2 + this.rng() * 0.6),
          this.arena.y + this.arena.h * (0.2 + this.rng() * 0.35),
          sr,
        );
        this.hazards.push({ kind: 'spikes', x: at.x, y: at.y, r: sr });
      }
    }
    // new ponds/boulders can land on parked bodies — units that can't
    // cross them get waded out to the shoreline before anyone sees
    // them standing inside the prop
    for (const u of [...this.players, ...this.enemies])
      if (!u.dead) {
        for (const hz of this.hazards) if (!u.airborne && isSolid(hz, u.def)) resolveZone(u, hz);
        const at = this.unstick(u.x, u.y, u.r + 2); // wading out can land on a slab
        u.x = at.x;
        u.y = at.y;
      }
    // the classic "!" tell as control lands — a challenger spots you
    this.waveIntroT = this.time;
    this.courtT = this.time;
    this.pickupSeen.clear();
    this.foesLanded = false;
    sfx('warn');
    if (i > 0) {
      this.screenFlash('#ffffff', 0.25);
      sfx('wave');
    }
    // a shiny announces itself in the banner — the rarest sight on the climb
    const shiny = this.enemies.find((e) => e.shiny);
    if (shiny) {
      if (!this.waveSpecial) this.waveSpecial = `A SHINY ${shiny.def.name.toUpperCase()} APPEARED!`;
      sfx('perfect'); // the triple-note ping — rarer than any recharge cue
    }
    this.waveTelop();
  }

  // the stop's opening banner, then the boss call if one is on the court
  private waveTelop() {
    const boss = this.enemies.find((e) => e.boss);
    const label = this.waveSpecial?.replace(/!/g, '') ?? (boss && this.waveHadGym ? `GYM LEADER ${boss.def.name.toUpperCase()}` : `STAGE ${this.waveIndex + 1}/${TOTAL_STAGES}`);
    this.telop.push({ kind: 'start', title: `BATTLE ${this.battle}/${this.battles}`, sub: [label, STAGE_GIMMICKS[this.theme].label, this.weather && WEATHER_LINE[this.weather].split(' · ')[1]].filter(Boolean).join(' · '), mon: this.active.def.id, icon: 'poke-ball' });
    if (boss) this.telop.push({ kind: 'boss', title: 'BOSS INCOMING', sub: `${boss.def.name.toUpperCase()} · WEAK SPOT ×3`, mon: boss.def.id, icon: this.bossIcon(boss) });
    if (boss) cry(boss.def.id, 'boss');
  }

  private bossIcon(boss: Unit) {
    const badge = this.waveHadGym ? BADGES.find((b) => b.boss === boss.def.id) : undefined;
    return badge ? `badges/${badge.icon}` : 'ultra-ball';
  }

  private drawBossIntro(ctx: CanvasRenderingContext2D) {
    if (!this.waveHadGym || this.telop.cur?.kind !== 'boss') return;
    const boss = this.enemies.find((e) => e.boss && !e.dead);
    if (!boss) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, this.telop.t / 0.16, (1 - this.telop.t) / 0.14));
    drawNpc(ctx, LEADER_NPC[boss.def.type], 64, this.arena.y + this.arena.h * 0.47 - 60, 80);
    ctx.restore();
  }

  private clearTelop(speed: boolean) {
    const [title, ...sub] = (this.waveSpecial ?? '').replace(/!/g, '').replace('SWEEP x', 'SWEEP ×').split(' · ').filter((t) => t !== 'SPEED CLEAR');
    this.telop.push({ kind: 'clear', title, sub: sub.join(' · '), mon: this.active.def.id, icon: 'poke-ball' });
    if (speed) this.telop.push({ kind: 'speed', title: 'SPEED CLEAR', sub: `${this.stopShots}/${this.par} TURNS`, mon: this.active.def.id, icon: 'quick-claw' });
  }

  // the stop's MS-style result: rank off turns vs par + faints, bests banked, rank pays a few stars
  private stopSummary(): ClearCard {
    const rank = clearRank(this.stopShots, this.par, this.stopFaints);
    this.rankStreak = rank === 'S' || rank === 'A' ? this.rankStreak + 1 : 0;
    this.bestRankStreak = Math.max(this.bestRankStreak, this.rankStreak);
    const stage = this.waveIndex + 1;
    this.runRanks[stage - 1] = rank;
    const best = recordClear(stage, rank, this.stopShots, this.stopCombo);
    const pay = RANK_PAY[rank] ? this.earnStars(RANK_PAY[rank]) : 0;
    return { stage, turns: this.stopShots, par: this.par, combo: this.stopCombo, weak: this.stopWeak, kos: this.stopKos, taken: Math.round(this.stopTaken), faints: this.stopFaints, rank, pay, best };
  }

  // first weak-point hit per foe gets the banner; repeats keep the float
  private weakTelop(e: Unit) {
    // one shot through 3+ weak points: a single tally banner, restyled in place as it climbs
    if (this.shotWeak >= WEAK_TALLY) {
      this.telop.push({ kind: 'weak', title: `WEAK POINT ×${this.shotWeak}`, sub: 'ONE SHOT', mon: this.active.def.id, icon: 'scope-lens' });
      return true;
    }
    if (!this.telop.once(`weak${e.uid}`)) return false;
    this.telop.push({ kind: 'weak', title: 'WEAK POINT', sub: `${e.def.name.toUpperCase()} · ${e.boss ? '×3' : '×2'}`, mon: e.def.id, icon: 'scope-lens' });
    return true;
  }

  // One enemy builder for everything the field can field: wave spawns,
  // wi is the wave row so level curves match the wave the foe arrived on.
  private makeEnemy(s: WaveSpawn, wi: number): Unit {
    const r = s.boss ? 46 : 26;
    const at = this.unstick(this.arena.x + this.arena.w * s.nx, this.arena.y + this.arena.h * s.ny, r + 2);
    // wild level = the climb's depth: route-1 fodder up to champion-tier;
    // the level is honest (bulkier wilds), not just a number
    // raids flat-line at +30 — a one-wave stage has no climb to ride —
    // unless the spawn pins its level, which a raid does so the card's
    // LV promise is the field's truth
    const el = Math.min(LV_CAP, s.lvl ?? (5 + wi * 10 + (this.raid ? 30 : 0) + (this.rng() < 0.35 ? 4 : 0) + (s.boss ? 8 : 0)));
    const ehp = Math.round(
      (s.boss ? bossHp(s.def.stats) : enemyHp(s.def.stats)) * this.hpScale * lvlHp(s.def.stats.hp, el),
    );
    // mirror foes Transform on entry — they wear the strongest standing
    // mon's typing and moves, but canon keeps the blob's own HP
    let def = s.def;
    if (s.def.mirror) {
      const lead = this.players.filter((p) => !p.dead).sort((a, b) => bst(b.def) - bst(a.def))[0];
      if (lead) def = { ...s.def, type: lead.def.type, type2: lead.def.type2, stats: { ...lead.def.stats, hp: s.def.stats.hp } };
    }
    // forecast: the chameleon wears the sky — its type (and its weakness)
    // follows whatever weather the wave is under
    if (def.forecast && this.weather) {
      const t = { sun: 'fire', rain: 'water', sand: 'rock', wind: 'flying', storm: 'electric' }[this.weather] as PokeType | undefined;
      if (t) def = { ...def, type: t };
    }
    const u: Unit = {
      uid: this.uidCtr++,
      def,
      side: 'enemy',
      x: at.x,
      y: at.y,
      vx: 0,
      vy: 0,
      r,
      hp: ehp,
      maxHp: ehp,
      timer: (s.def.melee ? MELEE_TIMER : ENEMY_BASE_TIMER) * this.foeCdMult * this.ascTimerMult() * (this.raidMod === 'hasty' ? 0.85 : 1) * (s.def.prank ? 0.55 : 1) + (wi === 0 ? 1 : 0),
      clocks: def.fuse ? [] : foeClocks(def.type, !!s.boss, 0, def.type2).map(({ kind, move, turn, first, type }) => ({ kind, move, turn, t: first, type })),
      // ASC 7 FRENZY: foes press harder — approach speed ×1.25
      drift: enemyDrift(def.stats) * (s.boss ? 0.55 : 1) * (this.asc >= 7 ? 1.25 : 1),
      wx: 0,
      wy: 0,
      wT: this.rng() * 0.8,
      wMul: 1,
      lunging: 0,
      boss: !!s.boss,
      bigT: s.boss ? BOSS_BIG_TIMER : 0,
      // ASC 6+: gym leaders walk in furious — fast attack cycle from bell
      // one; an ENRAGED raid boss takes the same bell
      enraged: !!s.boss && (this.asc >= 6 || this.raidMod === 'enraged'),
      // shinies: wild fodder rolls gold; a scripted spawn can force the
      // palette via def.shiny (golden-mon event), and your rival echo keeps
      // the palette it died with — including a shiny if you lost one.
      // Trainer mons are owned already: never shiny, never catchable.
      shiny: !this.inTrainer && (!!s.def.shiny || (!s.boss && !this.inRival && this.rng() < SHINY_RATE * this.shinyRate)),
      dead: false,
      dotTicks: 0,
      dotDmg: 0,
      burnT: 0,
      paraT: 0,
      confuseT: 0,
      cd: 0,
      cdMax: 1,
      lastBump: -1,
      role: 'wild',
      sash: !!s.def.sturdy, // sturdy species carry the hang-on natively
      lvl: el,
      pow: lvlPow(offStat(s.def.stats, s.def.type), el),
      rngMul: 1,
      launch: 1,
      cdMod: 0,
      lastHit: new Map(),
      wallN: 0,
      hzT: -9,
      sq: 0,
      flashT: 0,
      sumStage: 0,
      atkN: 0,
      weakA: s.boss ? this.rng() * Math.PI * 2 : this.uidCtr * 2.39996,
      shieldA: s.def.shielded ? this.rng() * Math.PI * 2 : 0,
      regenT: 0,
      asleep: !!s.def.sleepy && !s.def.sleepless,
      repelR: s.def.repel ? 90 : 0,
      shieldN: STAGE_GIMMICKS[this.theme].kind === 'barrier' ? (s.boss ? REFLECT_BOSS_HITS : REFLECT_HITS) : 0,
      revives: 0,
      gravR: 0,
      warpT: -9,
      boostT: -9,
      blinkT: s.def.blink ? 4 + this.rng() * 2.5 : 0,
      boostN: 0,
      armorN: 0,
      atkMul: 1,
      lastStand: false,
    };
    // the second face sits 120° off the first — a gym ace asks for a second angle
    if (u.boss) u.weakA2 = (u.weakA + (Math.PI * 2) / 3) % (Math.PI * 2);
    return u;
  }

  // Held-item quirk on a boss — pokelike's curated aces. Rolled on the
  // wave's seed so a pinned ?seed= run always faces the same kit.
  private armBoss(e: Unit) {
    const GYM_RELICS = ['focus-sash', 'leftovers', 'choice-band', 'eviolite'];
    e.relic = GYM_RELICS[Math.floor(this.rng() * GYM_RELICS.length)];
    const st = e.def.stats;
    switch (e.relic) {
      case 'focus-sash':
        e.sash = true; // one hit at full hp can't KO — enforced in hurt()
        break;
      case 'choice-band':
        e.def = { ...e.def, stats: { ...st, atk: Math.round(st.atk * 1.25), spa: Math.round(st.spa * 1.25) } };
        break;
      case 'eviolite':
        e.def = { ...e.def, stats: { ...st, def: Math.round(st.def * 1.35), spd: Math.round(st.spd * 1.35) } };
        break;
      // 'leftovers' regenerates in endShot
    }
  }

  // --- input (logical coords) ---

  // pause chip lives just inside the arena's top-left corner
  private pauseChip() {
    return { x: SP.lg, y: this.arena.y - 64, w: 48, h: 52 };
  }

  private ultChip() {
    return { x: 76, y: this.arena.y - 64, w: 244, h: 52 };
  }

  private tapUlt(u: Unit) {
    if (this.ultArmUid === u.uid && this.time - this.ultArmT < 2) {
      this.ultArmUid = -1;
      this.fireUlt(u);
    } else {
      this.ultArmUid = u.uid;
      this.ultArmT = this.time;
      sfx('ui', 0.8);
    }
  }

  pointerDown(p: Vec) {
    this.telop.skip();
    if (this.missions.dismiss(this.time)) return;
    if (this.fin.t > 0) { this.fin.t = 0; return; }
    if (this.paused) { // any tap unfreezes
      if (p.x >= PAUSE_SPEED.x && p.x <= PAUSE_SPEED.x + PAUSE_SPEED.w && p.y >= PAUSE_SPEED.y && p.y <= PAUSE_SPEED.y + PAUSE_SPEED.h) {
        this.ff = Battle.ffPref = !this.ff;
        sfx('ui');
        return;
      }
      this.paused = false;
      sfx('ui');
      return;
    }
    // the coach scrim owns the court before the first pull — the chips
    // can't eat taps under it (same gate the scout card got below)
    if (!(this.coach && this.shots <= 1) && (this.phase === 'aim' || this.phase === 'shot' || this.phase === 'enemy' || this.phase === 'loot')) {
      const c = this.pauseChip();
      if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) {
        this.paused = true;
        this.pointerCancel(); // a frozen game drops the half-pull (or the leash)
        sfx('ui');
        return;
      }
      const ult = this.ultChip();
      if (p.x >= ult.x && p.x <= ult.x + ult.w && p.y >= ult.y && p.y <= ult.y + ult.h) {
        if (this.phase === 'aim' && !this.active.dead) {
          if (this.ultIn <= 0) {
            const armed = this.players.find((u) => u.uid === this.ultArmUid && !u.dead && this.time - this.ultArmT < 2);
            this.tapUlt(armed ?? this.active);
          } else this.ultHint = !this.ultHint;
        }
        return;
      }
    }
    if (this.phase === 'loot') { // grab the leash — drag your mon through the coins
      this.lootDrag = true;
      this.lootPos = { ...p };
      this.lootDown = { ...p };
      return;
    }
    if (this.phase === 'shot') {
      // a dribbling ball doesn't deserve the wait — a tap settles it early.
      // The gate keeps a live ricochet from eating accidental taps.
      const a = this.active;
      if (a.vx * a.vx + a.vy * a.vy < 260 * 260) {
        this.endShot();
        return;
      }
    }
    if (this.phase === 'map') {
      if (this.eventChoice) {
        // a ? with options swallows taps until the player picks one
        const i = this.choiceHit.findIndex(
          (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h,
        );
        if (i >= 0) this.pickEventChoice(i);
        return;
      }
      if (this.eventBox) { // event text box is up — a tap dismisses it first
        this.eventBox = null;
        sfx('ui');
        return;
      }
      if (this.mapWalk) return; // mid-walk — let the lead mon get there
      // StS routing: tap one of the linked stops to walk there — its kind
      // flavors the battle (trainer squad, rest heal, chest find)
      const cell = MAP_CELL, ox = MAP_OX, oy = MAP_OY;
      const cam = Math.round(this.mapCam * cell) / cell;
      const cur = this.region.nodes[this.mapNode];
      if (!cur) return;
      const hit = cur.links
        .map((li) => this.region.nodes[li])
        .find(
          (n) =>
            Math.hypot(p.x - (ox + n.tx * cell + cell / 2), p.y - (oy + (n.ty - cam) * cell + cell / 2)) <
            cell * 1.2,
        );
      if (!hit) return; // tapping open island just admires the map
      sfx('ui');
      const path = routePath(this.region, cur, hit);
      if (path.length > 1) this.mapWalk = { path, t: 0, node: hit };
      else this.finishMapWalk(hit);
      return;
    }
    if (this.phase !== 'aim' || this.active.dead || this.foeDrop() < 1) return;
    this.dragging = true;
    this.dragT = 0;
    this.wasGold = false;
    // every pull re-rolls the gauge's rhythm — the band and sweep don't sit
    // where muscle memory left them
    this.gaugeJit = this.rng() * 2 - 1;
    this.gaugeJit2 = this.rng() * 2 - 1;
    this.gaugeStart = this.rng();

    this.dragStart = { ...p };
    this.dragNow = { ...p };
  }

  pointerMove(p: Vec) {
    if (this.lootDrag && this.phase === 'loot') this.lootPos = { ...p };
    if (this.dragging) this.dragNow = { ...p };
  }

  // an OS interrupt (call, pull-down shade, scroll takeover) is not a
  // release — drop the drag so a cancelled gesture can't fire a shot
  pointerCancel() {
    this.dragging = false;
    this.lootDrag = false;
    this.lootPos = null;
    this.lootDown = null;
  }

  pointerUp() {
    if (this.lootDrag) {
      // a release that never left the grab point is a tap — tap skips the
      // victory lap; a real sweep doesn't
      if (this.phase === 'loot' && this.lootPos && this.lootDown && dist(this.lootPos, this.lootDown) <= 6) this.lootT = 0;
      this.lootDrag = false;
      this.lootPos = null;
      this.lootDown = null;
    }
    if (!this.dragging) return;
    this.dragging = false;
    // the wave resolved while the pull was held (loot/reward/wipe) — a
    // release off-aim dissolves the drag, never starts a shot
    if (this.phase !== 'aim') return;
    const pull = { x: this.dragStart.x - this.dragNow.x, y: this.dragStart.y - this.dragNow.y };
    const pullLen = len(pull);
    if (pullLen < 18) {
      // a tap, not a pull — on a mon it pops a scout card instead of a shot
      const hit = [...this.enemies, ...this.players].find(
        (e) => !e.dead && Math.hypot(e.x - this.dragStart.x, e.y - this.dragStart.y) < e.r + 14,
      );
      // the ult is a team charge — any living teammate can spend it, and
      // the tapped mon's own signature is the one that detonates. One tap
      // arms it for 2s; the second tap on the same mon fires.
      if (hit && hit.side === 'player' && this.ultIn <= 0 && this.phase === 'aim') {
        this.tapUlt(hit);
        return;
      }
      this.ultArmUid = -1; // a tap anywhere else stands the ult down
      // coached first pull: a stray tap can't bury the lesson under a card
      if (hit && !(this.coach && this.shots <= 1)) {
        this.inspect = { uid: hit.uid, t: 2.8 };
        sfx('ui');
      }
      return;
    }
    this.ultArmUid = -1; // a real pull stands it down too
    this.inspect = null; // a real pull dismisses the scout card
    const dir = norm(pull);
    const u = this.active;
    // direction from the pull; power from release timing on the meter
    const charge = this.charge();
    const zone = this.sweetSpot();
    const gold = Math.abs(charge - zone.c) <= zone.hw;
    const quiet = quietOpener(this.waveIndex, isGentleRoom(this.roomGrid));
    // hot streak: back-to-back perfects make each shot hit a bit harder —
    // resets the moment a release misses the gold; the coached opener's
    // fiat gold isn't a real release, so it doesn't touch the count
    this.shotFever = this.fever; // armed on the last release — this launch is fevered
    if (!quiet) this.streak = gold ? this.streak + 1 : 0;
    this.shotStreak = 1 + Math.min(Math.max(this.streak - 1, 0), 4) * 0.07;
    this.shotGold = gold && !quiet;
    // FEVER arms off the release that hits the streak and rides the next
    // launch — the arming shot itself is never fevered, a miss disarms it
    this.fever = !quiet && gold && this.streak >= FEVER_AT;
    if (this.shotGold && gaugeCounter(u.def)) this.gaugeOn(u);
    const speed = BASE_SHOT_SPEED * POWER * launchMult(u.def.stats) * this.launchBoost * (this.curMod === 'tailwind' ? 1.15 : this.curMod === 'headwind' ? 0.85 : 1) * u.launch * (u.paraT > 0 ? 0.65 : 1) * (0.4 + 0.6 * (gold ? 1 : charge)) * this.swiftMult(u);
    u.vx = dir.x * speed;
    u.vy = dir.y * speed;
    if (u.confuseT > 0) {
      // supersonic bite: the release veers inside the wobble cone the ghost
      // was showing — you aimed honestly, the launch still jitters ±10°
      const j = (this.rng() - 0.5) * 0.35;
      const c = Math.cos(j), s = Math.sin(j);
      const vx = u.vx * c - u.vy * s, vy = u.vx * s + u.vy * c;
      u.vx = vx;
      u.vy = vy;
      u.confuseT = 0;
      this.pushText({ x: u.x, y: u.y - u.r - 14, text: 'DIZZY!', t: 0.8, color: '#c8a8f8', big: false });
    }
    u.sq = 1; // launch pop — the ball stretches off the sling
    this.bumpsThisShot.clear();
    this.bumpNoted.clear();
    this.connect.launch();
    this.shotCombo = 0;
    this.shotHits = 0;
    this.shotDmg = 0;
    this.shotLoot = 0;
    this.shotKOs = 0;
    this.kosThisShot = 0;
    u.wallN = 0;
    this.shotPhys = 1;
    this.volleys = 0;
    this.shotVolleyBoost = 0;
    this.lastContact = { t: -9, id: -1 };
    this.shotHitN.clear();
    this.shotWeak = 0;
    this.gustSounded = false;
    this.stopTimer = 0;
    this.slowT = 0;
    this.skipHinted = false;
    this.shotT = this.time;
    // STRIKE SHOT: launch with a recharged super and it fires from the
    // sling — MS's namesake. Spends the cooldown, erupts immediately.
    if (u.cd <= 0) this.bumpAlly(u, u);
    this.phase = 'shot';
    abilitySpeed(this, u, this.weather, this.abilityText);
    this.ultHint = false;
    this.shots++;
    if (this.ultIn > 0 && --this.ultIn === 0) {
      // the charge just armed — the chip's gold pulse is the tell, backed
      // by a flash so it doesn't read as decoration
      this.screenFlash('#ffd84d', 0.15);
      sfx('ready');
      buzz([20, 30, 40]);
    }
    this.waveShots++; // anti-stall pressure counts shots inside the wave
    this.stopShots++;
    if (this.waveShots === 8) {
      // three shots of runway before the ramp bites — warn early so a
      // dawdling climb reads as the player's own choice, not a surprise
      this.pushText({
        x: this.arena.x + this.arena.w / 2,
        y: this.arena.y + this.arena.h / 2 - 30,
        text: 'THE PACK GROWS RESTLESS…',
        t: 1.2, color: '#ffb84d', big: false,
      });
      sfx('warn');
    }
    if (this.waveShots === 11) {
      // the pressure ramp just went live — say so once, or the heavier
      // volleys read as a bug (waveShots past 10 is what feeds it)
      this.pushText({
        x: this.arena.x + this.arena.w / 2,
        y: this.arena.y + this.arena.h / 2,
        text: 'THE PACK FIGHTS BACK HARDER!',
        t: 1.4, color: '#ff6b6b', big: true,
      });
      this.screenFlash('#ff6b6b', 0.15);
      sfx('invade');
    }
    this.addShake(5);
    this.addPunch(0.03);
    this.burst(u.x, u.y, TYPE_COLOR[u.def.type], 14, 400);
    sfx('launch');
    buzz(15);
    if (this.lifeDrain > 0) {
      for (const p of this.players) {
        if (!p.dead) p.hp = Math.max(1, p.hp - Math.round(p.maxHp * this.lifeDrain));
      }
    }
    if (gold) {
      this.pushText({ x: u.x, y: u.y - u.r - 14, text: (this.streak > 1 ? `PERFECT ×${this.streak}!` : 'PERFECT!') + (this.shotGold ? ' +20%' : ''), t: 1, color: '#ffd84d', big: true });
      this.screenFlash('#ffd84d', 0.2);
      // gold shockwave + launch streak sell the full-power release
      this.waves.push({ x: u.x, y: u.y, r: 0, maxR: 130, t: 0.4, life: 0.4, color: '#ffd84d', hits: new Set() });
      this.beams.push({ x1: u.x, y1: u.y, x2: u.x + dir.x * 200, y2: u.y + dir.y * 200, t: 0.22, life: 0.22 });
      // slow-mo beat + speedlines streaming off the launch
      this.hitStop = Math.max(this.hitStop, 0.3);
      this.impact(u.x, u.y, '#ffd84d', 1.8);
      this.burst(u.x, u.y, '#ffd84d', 22, 620, 1.3);
      this.addPunch(0.16);
      this.addShake(10);
      sfx('perfect', 1 + Math.min(Math.max(this.streak - 2, 0), FEVER_PITCH_CAP) * FEVER_PITCH);
      this.award('perfect');
      buzz([30, 40, 60]);
      if (this.fever && !this.shotFever) {
        // just armed — the next shot runs hot, the banner says what it pays
        this.telop.push({ kind: 'ult', title: 'FEVER!', sub: `NEXT SHOT · SCORE ×${FEVER_SCORE}`, mon: u.def.id });
        playJingle('fever');
      }
    } else {
      // missed the band — say which side so the next release adjusts
      this.pushText({
        x: u.x, y: u.y - u.r - 14,
        text: charge < zone.c ? 'TOO EARLY' : 'TOO LATE',
        t: 0.7, color: '#8a90a8', big: false,
      });
    }
  }

  // Power meter: ping-pongs 0→1→0 while held (~0.85s per direction —
  // stronger species sweep faster) — release in the gold zone for a
  // full-power launch. Pull distance only aims; it no longer feeds power.
  // The pace and needle start re-roll every pull, so the window is never
  // the same shot twice.
  private charge() {
    const P = (0.85 - 0.3 * this.gaugeDifficulty()) * (1 + this.gaugeJit * 0.28);
    const ph = (this.dragT + this.gaugeStart * 2 * P) % (2 * P);
    return ph < P ? ph / P : 2 - ph / P;
  }

  // How hard a mon's gauge is, 0→1, keyed off base-stat total: fodder
  // releases are forgiving, aces and legendaries fight you.
  private gaugeDifficulty() {
    return Math.min(Math.max((bst(this.active.def) - 320) / 300, 0), 1);
  }

  // The gold zone sits where base Speed puts it: fast mons release high
  // and tight, slow mons get a lower, wider target. Stronger species
  // narrow the window further, and the top end drifts while you hold —
  // you release where the band will be, not where it is. Each pull also
  // nudges the band a little, so the timing never becomes memorized.
  private sweetSpot() {
    // coached first pull can't whiff — the whole meter is gold; the real
    // band shows up from the second shot on
    if (this.coach && this.shots === 0) return { c: 0.5, hw: 0.5 };
    const n = Math.min(this.active.def.stats.spe / 120, 1);
    const d = this.gaugeDifficulty();
    // the window itself breathes ±30% pull to pull — some releases are
    // generous, some ask for precision; it never lands on the same spec twice
    const hw = Math.max((0.09 - 0.05 * n - 0.04 * d) * (1 + this.gaugeJit2 * 0.45), 0.02);
    const drift = Math.max(d - 0.5, 0) * 0.16 * Math.sin(this.dragT * 2.4);
    const c = Math.min(Math.max(0.66 + 0.27 * n + drift + this.gaugeJit * 0.18, hw), 1 - hw);
    return { c, hw };
  }

  // MS gauge ability: a gauge mon's counter is live only on its own gold shot
  private counterOn(u: Unit) {
    return counterLive(u.def, u === this.active && this.phase === 'shot' && this.shotGold);
  }

  private gaugeOn(u: Unit) {
    this.pushText({ x: u.x, y: u.y - u.r - 30, text: `${abilityLabel(u.def)} ON`, t: 1, color: '#ffd84d', big: false });
    this.waves.push({ x: u.x, y: u.y, r: 0, maxR: u.r * 2.2, t: 0.25, life: 0.25, color: '#ffd84d', hits: new Set() });
    sfx('perfect', 1.3);
  }

  // --- simulation ---

  // every stamp on the shared clock — pad/hazard cooldowns, the bump
  // throttle, ricochet + per-shooter hit windows — moves with the pause
  private agePause(u: Unit, dt: number) {
    u.warpT += dt;
    u.boostT += dt;
    u.hzT += dt;
    u.lastBump += dt;
    for (const [k, v] of u.lastHit) u.lastHit.set(k, v + dt);
  }

  update(dt0: number) {
    if (this.paused) {
      this.time += dt0; // the overlay still breathes
      // shotT and lootChainT stamp this.time — advance them too or the
      // pause eats the shot clock and the scoop-chain window
      this.shotT += dt0;
      this.lootChainT += dt0;
      // same for every stamp on this clock — pad/hazard cooldowns, the
      // bump throttle, ricochet + per-shooter hit windows, the ult arm
      this.lastContact.t += dt0;
      this.ultArmT += dt0;
      for (const u of this.players) this.agePause(u, dt0);
      for (const u of this.enemies) this.agePause(u, dt0);
      return;
    }
    // scene music follows the phase: ambient on the map, the calm theme over
    // the offer board, the gym-leader theme under any boss (aces, alphas,
    // invaders, rivals), the march under trainers, the wild loop everywhere else
    if (this.phase === 'map') music('map');
    else if (this.phase === 'reward') music('reward_theme');
    else if (this.phase !== 'won' && this.phase !== 'lost') {
      music(this.enemies.some((e) => e.boss) || this.inRival ? 'gym' : this.inTrainer ? TRAINER_TRACK[this.waveType ?? ''] ?? 'trainer' : BIOME_TRACK[this.theme] ?? 'battle');
    }
    // the kit ducks while the player holds the sling and reads the board —
    // a gain move on the drum bus, so the song never restarts or drifts
    setIntensity(this.phase === 'aim' && this.dragging ? 'low' : 'high');
    // the weather bed rides the same phases the fight does — silence on the map
    weatherBed(
      this.phase !== 'map' && this.phase !== 'won' && this.phase !== 'lost'
        ? this.weather === 'sand' || this.weather === 'wind'
          ? this.weather
          : this.weather === 'storm'
            ? 'rain' // thunderstorm rides the rain bed — rumble without a new loop
            : null
        : null,
    );
    // hit-stop: freeze-frame feel on big combos
    const hit = this.hitStop > 0;
    if (hit) this.hitStop -= dt0;
    if (this.fin.t > 0) this.fin.t = Math.max(0, this.fin.t - dt0);
    const k = this.fin.t > 0 ? 1 - this.fin.t / FINISH_T : 1;
    const slow = FINISH_SLOW + (1 - FINISH_SLOW) * k * k;
    const dt = dt0 * Math.min(hit ? 0.3 : 1, slow);
    this.time += dt;
    if (this.time - this.ultArmT >= 2) this.ultArmUid = -1;
    this.ultFill += (ULT_SHOTS - Math.max(0, this.ultIn) - this.ultFill) * Math.min(1, dt0 * 12);
    if (this.ultHintPending && this.phase === 'aim' && this.time - this.courtT > 0.75) {
      this.ultHintPending = false;
      this.ultHint = true;
      markUltHintSeen();
    }
    this.cardT += dt;
    if (!this.foesLanded && this.foeDrop() >= 1) this.landFoes();
    // periodic perk triggers only tick while the ball/enemies move — parking
    // in aim shouldn't be a free rest for clocked heals either
    if (this.phase === 'shot' || this.phase === 'enemy') perkTick(this, dt);
    if (this.dragging) {
      this.dragT += dt;
      // a soft tick each time the fill crosses into the gold — the
      // rhythm cue that makes the release a timing game, not a guess
      const z = this.sweetSpot();
      const inGold = Math.abs(this.charge() - z.c) <= z.hw;
      if (inGold && !this.wasGold) { sfx('tick'); buzz(8); } // haptic nod on the gold edge
      this.wasGold = inGold;
    }
    for (const pk of this.pickups) {
      if (pk.tag === undefined) {
        pk.tag = this.pickupSeen.has(pk.kind) ? 0 : LABEL_INTRO;
        this.pickupSeen.add(pk.kind);
      } else pk.tag = Math.max(0, pk.tag - dt);
    }
    for (const t of this.texts) t.t -= dt;
    cull(this.texts, (t) => t.t > 0);
    for (const f of this.flashes) f.t -= dt;
    cull(this.flashes, (f) => f.t > 0);
    if (this.ultFx.t > 0) this.ultFx.t -= dt; // hit-stop stretches the cinema beat
    if (this.cutin.t > 0) this.cutin.t -= dt;
    // capture rituals tick in any phase — a tick lands on each swing's far
    // tilt, then the click/burst fires the site's deferred payoff once
    for (const b of this.balls) {
      b.t -= dt;
      const el = b.life - b.t;
      while (b.rocked < b.rocks && el >= BALL_ROCK0 + (b.rocked + 0.25) * BALL_ROCK_T) {
        b.rocked++;
        sfx('tick');
      }
      if (b.resolve && el >= b.at) {
        const r = b.resolve;
        b.resolve = undefined;
        r();
      }
    }
    cull(this.balls, (b) => b.t > 0);
    // evolution cinematics tick with the fight — the payoff (burst, sfx)
    // lands the moment the flicker resolves, not when the dupe was absorbed
    for (const f of this.evoFx) {
      f.t += dt;
      if (!f.revealed && f.t >= 1.0) {
        f.revealed = true;
        this.impact(f.u.x, f.u.y, '#ffd84d', 1.4);
        this.burst(f.u.x, f.u.y, '#ffffff', 16, 380);
        sfx('caught');
      }
    }
    cull(this.evoFx, (f) => f.t < 1.35);
    for (const p of this.pickups) p.t += dt;
    for (const s of this.scars) s.t += dt;
    cull(this.scars, (s) => s.t < s.life);
    for (const bm of this.beams) bm.t -= dt;
    stepAnims(dt);
    { const fx = drainAnimRequests(); if (fx.duration) this.screenFlash(fx.color, fx.duration); }
    cull(this.beams, (bm) => bm.t > 0);
    stepFx(this.fx, dt, this.time);
    this.stepSkyFx(dt);
    for (const p of this.pops) p.t -= dt;
    cull(this.pops, (p) => p.t > 0);
    this.shake *= Math.exp(-6 * dt);
    this.punch *= Math.exp(-9 * dt);
    this.telop.update(dt);
    if (this.endT > 0) this.endT -= dt;
    if (this.mapMsgT > 0) this.mapMsgT -= dt;
    if (this.inspect) {
      const ins = this.inspect;
      ins.t -= dt;
      let alive = false;
      for (const e of this.enemies) if (e.uid === ins.uid && !e.dead) { alive = true; break; }
      if (!alive) for (const p of this.players) if (p.uid === ins.uid && !p.dead) { alive = true; break; }
      if (ins.t <= 0 || !alive) this.inspect = null;
    }
    // an armed ult nobody confirms stands itself down — once, audibly
    if (this.ultArmUid !== -1 && this.time - this.ultArmT >= 2) {
      const u = this.players.find((p) => p.uid === this.ultArmUid);
      this.ultArmUid = -1;
      if (u) {
        this.pushText({ x: u.x, y: u.y - u.r - 52, text: 'STOOD DOWN', t: 0.8, color: '#8890b8', big: false });
        sfx('ui', 0.4);
      }
    }
    // squash impulses relax — sprites spring back after impacts
    for (const p of this.players) { p.sq *= Math.exp(-9 * dt); p.flashT = Math.max(0, p.flashT - dt); }
    for (const e of this.enemies) { e.sq *= Math.exp(-9 * dt); e.flashT = Math.max(0, e.flashT - dt); }
    // wound bars drain after the hit — heals snap, damage bleeds off
    for (const p of this.players) { const l = p.hpLag ?? p.hp; p.hpLag = l > p.hp ? Math.max(p.hp, l - p.maxHp * 1.6 * dt) : p.hp; }
    for (const e of this.enemies) { const l = e.hpLag ?? e.hp; e.hpLag = l > e.hp ? Math.max(e.hp, l - e.maxHp * 1.6 * dt) : e.hp; }

    this.stepOrbs(dt);
    this.stepWaves(dt);
    this.stepDashes(dt);
    for (const l of this.lanes) l.t -= dt;
    cull(this.lanes, (l) => l.t > 0);
    if (this.phase === 'map' && this.mapWalk) this.stepMapWalk(dt);
    if (this.phase === 'map') this.mapCam += (this.mapCamTarget() - this.mapCam) * Math.min(1, dt * 4.5);
    for (const d of this.delays) d.t -= dt;
    // compact survivors in place and run the due callbacks in order after
    // the sweep — a callback that re-queues via later() must not fire this
    // pass or get clobbered by the compaction
    const dq = this.dueQ;
    dq.length = 0;
    {
      let w = 0;
      for (const d of this.delays) {
        if (d.t <= 0) dq.push(d);
        else this.delays[w++] = d;
      }
      this.delays.length = w;
    }
    for (const d of dq) d.fn();
    if (this.phase === 'shot' || this.phase === 'aim' || this.phase === 'enemy') {
      this.stepEnemyMovement(dt);
    }
    if (this.phase === 'shot') this.stepShot(dt);
    else if (this.phase === 'loot') this.stepLoot(dt);
    else if (this.phase === 'enemy') {
      this.enemyPhaseT -= dt;
      if (this.enemyPhaseT <= 0) this.resolveEnemyTurn();
    }
    // a wave can strand mid-aim when the last kill lands through a delayed
    // path whose own close-out check missed (ult beams gated on 'aim', chip
    // kills between phases) — field's clear, so the wave's over
    if (this.phase === 'aim' && this.enemies.every((e) => e.dead)) this.waveCleared();
    // orbs and delayed supers can clear a wave while you're just aiming —
    // pay out on the spot instead of making the player shoot at nothing
    if (this.rewardPending && this.phase === 'aim' && this.fin.t <= 0) {
      this.rewardPending = false;
      if (this.waveHadGym) this.enterLoot();
      else this.enterReward();
    }
  }

  private stepShot(dt: number) {
    const u = this.active;
    // combo momentum kicks can push the ball fast enough to skip a thin
    // slab in one step — substep harder when it's hot
    const v2 = u.vx * u.vx + u.vy * u.vy;
    const sub = v2 > 1800 * 1800 ? 6 : v2 > 1000 * 1000 ? 4 : 2;
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const wave = this.enemies; // spawnWave swaps this array on wave clear
      const onIce = this.hazards.some((hz) => hz.kind === 'ice' && Math.hypot(u.x - hz.x, u.y - hz.y) < hz.r + u.r);
      const damp = shotDamp(this.time - this.shotT + i * h, h, this.frictionMult * (this.curMod === 'slick' ? 0.6 : 1) * (onIce ? 0.1 : 1));
      u.vx *= damp;
      u.vy *= damp;
      // gravity auras: inside a carrier's bubble the ball crawls — aim
      // around it or burn a turn punching through
      for (const e of wave) {
        if (e.dead || !e.gravR) continue;
        if (Math.hypot(u.x - e.x, u.y - e.y) < e.gravR + u.r) {
          if (this.counterOn(u) && abilityHazard(this, u, 'gravity', this.abilityText)) continue;
          const gd = Math.exp(-5 * h);
          u.vx *= gd;
          u.vy *= gd;
        }
      }
      // repulsor fields: inside the rim the ball is shoved outward — bank
      // around the face or burn speed punching straight through
      for (const e of wave) {
        if (e.dead || !e.repelR) continue;
        const rd = Math.hypot(u.x - e.x, u.y - e.y);
        if (rd > 0 && rd < e.repelR + u.r) {
          u.vx += ((u.x - e.x) / rd) * 1600 * h;
          u.vy += ((u.y - e.y) / rd) * 1600 * h;
        }
      }
      // arena traps: past the pit's rim the earth drags the ball back —
      // while the trapper lives, the neighborhood is a one-way door
      for (const e of wave) {
        if (e.dead || !e.def.trap) continue;
        const rd = Math.hypot(u.x - e.x, u.y - e.y);
        if (rd > 150 && rd < 300) {
          u.vx += ((e.x - u.x) / rd) * 2400 * h;
          u.vy += ((e.y - u.y) / rd) * 2400 * h;
        }
      }
      u.x += u.vx * h;
      u.y += u.vy * h;
      // speed trail while flying fast — ghost positions smear the path
      if (u.vx * u.vx + u.vy * u.vy > 500 * 500) {
        const last = this.trail[this.trail.length - 1];
        if (!last || Math.hypot(u.x - last.x, u.y - last.y) > 14) {
          this.trail.push({ x: u.x, y: u.y, t: this.time });
          if (this.trail.length > 18) this.trail.shift();
        }
      }
      this.hitWalls(u);
      this.hitBlocks(u);
      this.hitSolid(u);
      // court gimmicks — the ball feels the floor it's flying over
      for (const hz of this.hazards) {
        // a hazard can kill mid-pass (mine, lava chip) — a corpse stops
        // feeling the floor instead of warping/sizzling through the rest
        if (u.dead) break;
        if (hz.spent || dist(u, hz) > u.r + hz.r + 1) continue;
        // a landlocked ball never enters the water — hitSolid banks it
        // off the surface, so its effects only touch swimmers
        if (isWater(hz) && !canSwim(u.def)) continue;
        if (this.counterOn(u) && abilityHazard(this, u, hz.kind, this.abilityText)) continue;
        if (hz.kind === 'mine') {
          // MS mine: the ball's touch detonates it — the blast SHOVES the
          // pack around (enemies take no environment damage; the court is
          // their turf) and still chips the ball — commit
          hz.spent = true;
          this.addShake(14);
          this.addPunch(0.15);
          this.hitStop = Math.max(this.hitStop, 0.12);
          this.burst(hz.x, hz.y, '#ff9a30', 26, 600, 1.4);
          this.screenFlash('#ff9a30', 0.12);
          this.scar(hz.x, hz.y, 30);
          this.waves.push({ x: hz.x, y: hz.y, r: 0, maxR: hz.r * 3.2, t: 0.35, life: 0.35, color: '#ff9a30', hits: new Set() });
          for (const e of this.enemies) {
            if (!e.dead && !e.def.anchor && dist(hz, e) < hz.r * 2.2 + e.r) {
              const d = Math.max(30, dist(hz, e));
              e.vx += ((e.x - hz.x) / d) * 520;
              e.vy += ((e.y - hz.y) / d) * 520;
            }
          }
          this.damagePlayer(u, Math.max(1, Math.round(u.maxHp * 0.05 * (u.def.damp ? 0.5 : 1))));
          sfx('boom');
          continue;
        }
        if (hz.kind === 'warp') {
          // MS warp: ride one pad, exit its twin still carrying your
          // velocity — the trick-shot lane. Cooldown stops ping-pong.
          if (this.time - u.warpT > 0.45) {
            const twin = this.hazards.find((w) => w !== hz && w.kind === 'warp' && w.pair === hz.pair);
            if (twin) {
              u.warpT = this.time;
              const sp = Math.max(60, Math.hypot(u.vx, u.vy));
              const nx = u.vx / sp, ny = u.vy / sp;
              this.waves.push({ x: u.x, y: u.y, r: 0, maxR: 50, t: 0.3, life: 0.3, color: '#c890ff', hits: new Set() });
              this.burst(u.x, u.y, '#c890ff', 10, 320);
              u.x = twin.x + nx * (twin.r + u.r + 6);
              u.y = twin.y + ny * (twin.r + u.r + 6);
              this.waves.push({ x: u.x, y: u.y, r: 0, maxR: 50, t: 0.3, life: 0.3, color: '#c890ff', hits: new Set() });
              this.burst(u.x, u.y, '#c890ff', 10, 320);
              sfx('gust');
            }
          }
          continue;
        }
        if (hz.kind === 'boost') {
          // speed-up panel: crossing it re-launches — capped so pads can't
          // compound every substep into escape velocity
          if (this.time - u.boostT > 0.4) {
            u.boostT = this.time;
            const sp = Math.hypot(u.vx, u.vy);
            if (sp > 60 && sp < 2400) {
              u.vx *= 1.35;
              u.vy *= 1.35;
              u.sq = 0.7;
              this.waves.push({ x: hz.x, y: hz.y, r: 0, maxR: hz.r * 1.6, t: 0.25, life: 0.25, color: '#9df09d', hits: new Set() });
              this.burst(u.x, u.y, '#9df09d', 8, 420);
              sfx('gust');
            }
          }
          continue;
        }
        if (hz.kind === 'gravity') {
          if (!this.slowImmune && !u.airborne && !flies(u.def)) {
            const drag = Math.exp(-GRAVITY_PANEL_DRAG * h);
            u.vx *= drag;
            u.vy *= drag;
          }
          continue;
        }
        if (hz.kind === 'heal') {
          if (hz.healShot !== this.stopShots && u.hp < u.maxHp) {
            hz.healShot = this.stopShots;
            const heal = Math.min(u.maxHp - u.hp, Math.max(1, Math.round(u.maxHp * HEAL_PANEL_HP)));
            u.hp += heal;
            this.pushText({ x: u.x, y: u.y - u.r - 8, text: `HEAL +${heal}`, t: 0.8, color: '#6fdc6f', big: false });
            sfx('heal');
          }
          continue;
        }
        if (hz.kind === 'well') {
          // gravity barrier: the ball curves toward the core while inside —
          // slings get slingshot paths through the pocket
          if (!this.slowImmune) {
            const d = Math.max(50, dist(u, hz));
            const pull = 1400 * h;
            u.vx += ((hz.x - u.x) / d) * pull;
            u.vy += ((hz.y - u.y) / d) * pull;
          }
          continue;
        }
        if (hz.kind === 'gust') {
          if (!this.slowImmune) u.vx += (hz.dir ?? 1) * 480 * h;
          if (!this.gustSounded) {
            this.gustSounded = true;
            sfx('gust');
          }
        } else if (hz.kind === 'grass') {
          if (!this.slowImmune) {
            u.vx *= Math.exp(-8 * h);
            u.vy *= Math.exp(-8 * h);
          }
        } else if ((hz.kind === 'lava' || hz.kind === 'spikes') && !this.slowImmune && this.time - u.hzT > 0.5
            && !(hz.kind === 'lava' && (u.def.type === 'fire' || u.def.type2 === 'fire'))
            && !(hz.kind === 'spikes' && flies(u.def))) {
          // lava & spikes chip the ball on contact — MS damage walls.
          // Fire mons bathe in lava; flyers sail over the boulder strip.
          // Field zones (static/power/well) must not land here: they work
          // by being entered, and chip turned them into disguised lava.
          u.hzT = this.time;
          this.damagePlayer(u, Math.max(1, Math.round(u.maxHp * 0.04 * (hz.kind === 'lava' && u.def.thickFat ? 0.5 : 1))));
          sfx('sizzle');
        }
      }
      this.shotT += stepField2(this.field2, u, h, this.time, this.field2Fx, this.shots);
      // the court can kill the ball mid-flight — a dead mon connects nothing
      if (u.dead) break;
      // snapshot: strikeEnemy→hurt can summon boss adds mid-loop — fresh
      // minions don't get struck in the pass that spawned them
      const waveN = wave.length;
      for (let ei = 0; ei < waveN; ei++) {
        const e = wave[ei];
        if (this.enemies !== wave) break;
        if (e.dead) continue;
        // pierce mons phase through enemies — hit once, keep the line
        if (u.def.pierce) {
          if (dist(u, e) < u.r + e.r) {
            e.sq = 1;
            this.strikeEnemy(u, e);
          }
        } else if (this.collide(u, e)) {
          u.sq = 0.8;
          e.sq = 1;
          // pinball knockback — the body you hit slides and shoves its
          // neighbors, so one good line can cascade through the pack
          const kb = Math.min(0.3, Math.hypot(u.vx, u.vy) / 4000) * (e.boss ? 0.15 : 1);
          e.vx += u.vx * kb;
          e.vy += u.vy * kb;
          this.strikeEnemy(u, e);
        }
      }
      for (const p of this.players) {
        // pass through teammates — each pass is a link-bump combo tick
        if (p.dead || p === u || dist(u, p) >= u.r + p.r || u.vx * u.vx + u.vy * u.vy <= 1600) continue;
        if (u === this.active) this.connect.touch(p, u, this.players, this.telop);
        if (p.asleep) {
          // a hard nudge shakes the sleeper out of it — no super, but the
          // bump buys back its turn before the pack closes in
          p.asleep = false;
          this.pushText({ x: p.x, y: p.y - p.r - 10, text: 'WOKE!', t: 0.8, color: '#f8f8f8', big: false });
          continue;
        }
        this.bumpAlly(p, u);
      }
      for (let j = this.pickups.length - 1; j >= 0; j--) {
        const pk = this.pickups[j];
        const dd = dist(u, pk);
        // soft magnet — a ball that just misses still drifts into the drop,
        // so threading a lane to loot feels generous, not pixel-perfect
        if (dd < u.r + 64 && dd > 1) {
          u.vx += ((pk.x - u.x) / dd) * 260 * dt;
          u.vy += ((pk.y - u.y) / dd) * 260 * dt;
        }
        if (dd < u.r + 30) {
          this.pickups.splice(j, 1);
          this.grabPickup(pk);
        }
      }
      // swat: a live ball punches hostile orbs out of the air — shooting
      // through the volley is real cover for the parked team
      for (const o of this.orbs) {
        if (!o.hostile || o.t <= 0) continue;
        if (Math.hypot(o.x - u.x, o.y - u.y) < u.r + 12) {
          o.t = 0;
          this.score += 10;
          this.burst(o.x, o.y, o.color, 8, 300);
          this.pushText({ x: o.x, y: o.y - 10, text: 'SWAT!', t: 0.7, color: '#9df0ff', big: false });
          sfx('bounce');
        }
      }
    }
    cull(this.enemies, (e) => !e.dead);
    if (u.dead) {
      this.endShot();
      return;
    }

    const speed = len({ x: u.vx, y: u.vy });
    if (speed < STOP_SPEED) {
      this.stopTimer += dt;
      if (this.stopTimer > 0.3) this.endShot();
    } else {
      this.stopTimer = 0;
    }
    // crawling but not settled — surface the tap-to-skip once it lingers
    if (speed < 260 && !this.skipHinted) {
      this.slowT += dt;
      if (this.slowT > 1.2) {
        this.skipHinted = true;
        this.pushText({ x: this.arena.x + this.arena.w / 2, y: this.arena.y + this.arena.h - 60, text: 'TAP TO SKIP THE DRIBBLE', t: 1.3, color: '#8a90a8', big: false });
      }
    } else if (speed >= 260) this.slowT = 0;
    // failsafe: a ball caught orbiting a well or looping boost pads never
    // dips under settle speed — without this the run softlocks mid-shot
    if (this.phase === 'shot' && this.time - this.shotT > SHOT_MAX) this.endShot();
  }

  // Enemies creep toward the nearest player; knockback velocity decays fast.
  private stepEnemyMovement(dt: number) {
    // snapshot once at the top — a mid-pass KO still reads as a target for
    // the creeps behind it (the old filter() gave the same frozen roster)
    const alive = this.aliveP;
    alive.length = 0;
    for (const p of this.players) if (!p.dead) alive.push(p);
    // snapshot: thorns→hurt can summon boss adds mid-loop — fresh minions
    // don't drift or shove in the pass that spawned them
    const wave = this.enemies;
    const wn = wave.length;
    for (let i = 0; i < wn; i++) {
      const e = wave[i];
      if (e.dead) continue; // corpses don't drift, lunge, or shove
      if (e.def.shielded) e.shieldA += dt * 0.22; // the shell turns slower — the flank window roams the rim
      // regen foes mend steadily — a slow fight is a losing fight vs these
      if (e.def.regen && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03 * dt);
        e.regenT += dt;
        if (e.regenT > 1.5) {
          e.regenT = 0;
          this.burst(e.x, e.y - e.r, '#a0e060', 3, 140, 0.6);
        }
      }
      // blink foes teleport on a cycle — the shimmer warn is drawn; the
      // hop itself lands here. Sleepy blinkers don't dream of elsewhere.
      if (e.def.blink && !e.asleep && e.blinkT > 0) {
        e.blinkT -= dt;
        if (e.blinkT <= 0) {
          e.blinkT = 4.5 + this.rng() * 2.5;
          const a2 = this.arena;
          this.waves.push({ x: e.x, y: e.y, r: 0, maxR: e.r * 2.4, t: 0.3, life: 0.3, color: '#c890ff', hits: new Set() });
          this.burst(e.x, e.y, '#c890ff', 8, 300);
          // blinkers haunt the foe half — the chase stays on their turf
          const at = this.unstick(
            a2.x + (0.12 + this.rng() * 0.76) * a2.w,
            a2.y + (0.08 + this.rng() * 0.42) * a2.h,
            e.r + 2,
          );
          e.x = at.x;
          e.y = at.y;
          this.waves.push({ x: e.x, y: e.y, r: 0, maxR: e.r * 2.4, t: 0.3, life: 0.3, color: '#c890ff', hits: new Set() });
          this.burst(e.x, e.y, '#c890ff', 8, 300);
          sfx('gust');
        }
      }
      // a shoved foe skates on ice — knockback across the slick carries it
      // like the ball, so the rink doubles as a bowling lane
      const kn = Math.exp(-4 * (this.hazards.some((hz) => hz.kind === 'ice' && dist(e, hz) < hz.r + e.r) ? 0.15 : 1) * dt);
      e.vx *= kn;
      e.vy *= kn;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      blockField2(this.field2, e);
      if (alive.length > 0) {
        // nearest living player — squared scan, one sqrt for the whole pick
        let target: Unit = alive[0];
        let best = Infinity;
        for (const p of alive) {
          const pdx = p.x - e.x, pdy = p.y - e.y;
          const q = pdx * pdx + pdy * pdy;
          if (q < best) { best = q; target = p; }
        }
        const d = Math.sqrt(best);
        let nx = (target.x - e.x) / (d || 1);
        let ny = (target.y - e.y) / (d || 1);
        if (e.def.thief && !e.stolen && this.pickups.length > 0 && e.lunging <= 0) {
          // thieves nose toward the loot, not the fight — steer the drift
          // at the nearest pickup and pocket it on contact
          let bp: Pickup | null = null;
          let bq = Infinity;
          for (const pk of this.pickups) {
            const q = (pk.x - e.x) * (pk.x - e.x) + (pk.y - e.y) * (pk.y - e.y);
            if (q < bq) { bq = q; bp = pk; }
          }
          if (bp) {
            const pd = Math.sqrt(bq) || 1;
            nx = (bp.x - e.x) / pd;
            ny = (bp.y - e.y) / pd;
            if (pd < e.r + 10) {
              e.stolen = bp.kind;
              this.pickups.splice(this.pickups.indexOf(bp), 1);
              this.pushText({ x: e.x, y: e.y - e.r - 10, text: 'STOLE!', t: 0.9, color: '#f8d030', big: false });
              this.burst(e.x, e.y, '#f8d030', 6, 240, 0.7);
              sfx('tick');
            }
          }
        }
        if (e.def.flank && e.lunging <= 0 && d > e.r + target.r + 130) {
          // flanker: far out it steers at a point beside the pack, not the
          // body — zappers drift straight, these come in on an arc. Close
          // in and it fights like anything else.
          const px = -ny, py = nx;
          const side = e.uid % 2 ? 1 : -1;
          const fx = target.x + px * 120 * side - e.x;
          const fy = target.y + py * 120 * side - e.y;
          const fd = Math.hypot(fx, fy) || 1;
          nx = fx / fd;
          ny = fy / fd;
        }
        if (e.lunging > 0) {
          // melee attack in flight: steer hard at the target, hit on contact
          e.lunging -= dt;
          const sp = 520 + e.def.stats.spe * 3;
          e.x += nx * sp * dt;
          e.y += ny * sp * dt;
          // the rush kicks up a dust trail — reduced motion skips trails
          if (settings().shake > 0 && this.fx.length < FX_MAX && this.fxRng() < dt * 30) {
            this.fx.push({
              x: e.x, y: e.y + e.r * 0.5,
              vx: (this.fxRng() - 0.5) * 26, vy: -16 - this.fxRng() * 26,
              t: 0.4, life: 0.5, size: 3 + this.fxRng() * 3,
              color: '#a89070', shape: 'smoke', spin: (this.fxRng() - 0.5) * 4, grav: -30, sway: 10,
            });
          }
          if (d < e.r + target.r + 4 || e.lunging <= 0) {
            e.lunging = 0;
            if (d < e.r + target.r + 8) {
              this.damagePlayer(target, physDamage(this.foeAtk(e), target.def.stats.def, 1, zapPower * 1.3), e);
              slashArc(this.fx, this.fxRng, target.x, target.y, '#ff8a8a', { angle: Math.atan2(target.y - e.y, target.x - e.x), radius: target.r * 1.5 });
              if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
            }
          }
        } else {
          // erratic approach: seek the player but wander with random darts
          e.wT -= dt;
          if (e.wT <= 0) {
            e.wT = 0.35 + this.rng() * 0.9;
            const a = this.rng() * Math.PI * 2;
            e.wx = Math.cos(a);
            e.wy = Math.sin(a);
            e.wMul = this.rng() < 0.22 ? 2.4 : 0.5 + this.rng();
          }
          if (d > e.r + target.r + 6) {
            // swift swim / chlorophyll: in its own sky the carrier presses
            // at 1.5× — a caller's weather makes the whole pack faster
            const swim = e.def.swift === this.weather ? 1.5 : 1;
            e.x += (nx * 0.55 + e.wx * e.wMul) * e.drift * swim * dt;
            e.y += (ny * 0.55 + e.wy * e.wMul) * e.drift * swim * dt;
          }
        }
      }
      // wall-slam: capture impact speed before the resolve kills it — a
      // knockback-flung foe pays for the rocks and shorelines it hits
      const spd0 = Math.hypot(e.vx, e.vy);
      let slammed = false;
      for (const b of this.blocks) slammed = resolveBlock(e, b) || slammed;
      const zoneHit = this.hitSolid(e); // creeps bank off water/boulders they can't cross
      if ((slammed || zoneHit) && spd0 > 220 && !e.dead) {
        this.hurt(e, Math.max(1, Math.round(spd0 * 0.02)), '#c8c8d8');
      }
      this.clampToArena(e);
      for (const p of this.players) {
        if (!p.dead) this.separate(e, p);
      }
      // court chip: lava burns whatever stands in it, the spike strip
      // nicks the grounded — fire types bathe, flyers sail over both.
      if (!e.dead && !e.airborne && !flies(e.def) && this.time - e.hzT > 0.8) {
        for (const hz of this.hazards) {
          if (hz.kind === 'lava' && (e.def.type === 'fire' || e.def.type2 === 'fire')) continue;
          if ((hz.kind === 'lava' || hz.kind === 'spikes') && dist(e, hz) <= hz.r + e.r) {
            e.hzT = this.time;
            this.hurt(e, Math.max(1, Math.round(e.maxHp * 0.04)), hz.kind === 'lava' ? '#f08030' : '#b8b8d0');
            break;
          }
        }
      }
      // Wells gather foes into a kill-zone; only swimmers enter moat wells.
      // Gust lanes sweep creeps off their cover.
      // Bosses stay planted; the court is their turf.
      if (!e.dead && !e.boss) {
        for (const hz of this.hazards) {
          if (hz.kind === 'well' && (!isWater(hz) || canSwim(e.def)) && dist(e, hz) <= hz.r + e.r) {
            const d = Math.max(30, dist(e, hz));
            e.x += ((hz.x - e.x) / d) * 160 * dt;
            e.y += ((hz.y - e.y) / d) * 160 * dt;
          } else if (hz.kind === 'gust' && dist(e, hz) <= hz.r + e.r) {
            e.x += (hz.dir ?? 1) * 42 * dt;
          }
        }
      }
    }
    // pairwise separation between enemies
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        this.separatePair(this.enemies[i], this.enemies[j]);
      }
    }
  }

  private clampToArena(u: Unit) {
    const a = this.arena;
    u.x = Math.min(Math.max(u.x, a.x + u.r), a.x + a.w - u.r);
    u.y = Math.min(Math.max(u.y, a.y + u.r), a.y + a.h - u.r);
  }

  // Push mover m out of static circle o.
  private separate(m: Unit, o: { x: number; y: number; r: number }) {
    const rr = m.r + o.r;
    const dx = m.x - o.x, dy = m.y - o.y;
    if (dx * dx + dy * dy >= rr * rr) return;
    const d = Math.hypot(dx, dy);
    if (d === 0) return;
    m.x = o.x + (dx / d) * rr;
    m.y = o.y + (dy / d) * rr;
  }

  // Push two movers apart, splitting the correction.
  private separatePair(a: Unit, b: Unit) {
    const rr = a.r + b.r;
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx * dx + dy * dy >= rr * rr) return;
    const d = Math.hypot(dx, dy);
    if (d === 0) return;
    const nx = dx / d, ny = dy / d;
    // billiards: a knockback-shoved foe slams its packmate — momentum
    // transfers, both eat the collision. A hard bank can bowl a whole pod;
    // drift-speed nudges stay below the bar so packs don't self-harm.
    if (!a.dead && !b.dead) {
      const rel = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
      if (rel > 220) {
        const fast = a.vx * a.vx + a.vy * a.vy > b.vx * b.vx + b.vy * b.vy ? a : b;
        const slow = fast === a ? b : a;
        slow.vx += fast.vx * 0.45;
        slow.vy += fast.vy * 0.45;
        fast.vx *= 0.55;
        fast.vy *= 0.55;
        const chip = Math.max(1, Math.round(rel * 0.03));
        this.hurt(slow, chip, '#c8c8d8');
        if (!fast.dead) this.hurt(fast, Math.round(chip * 0.5), '#c8c8d8');
        this.burst((a.x + b.x) / 2, (a.y + b.y) / 2, '#c8c8d8', 4, 180, 0.5);
        sfx('bounce');
      }
    }
    const push = (rr - d) / 2;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
  }

  // Homing orbs from water bump attacks — and boss orbs that hunt you.
  private stepOrbs(dt: number) {
    for (const o of this.orbs) {
      o.t -= dt;
      if (o.target.dead) {
        const pool = o.hostile ? this.players : this.enemies;
        const next = pool.find((e) => !e.dead);
        if (next) o.target = next;
        else {
          o.t = 0;
          continue;
        }
      }
      // lightning rod: a live rod bends hostile electric bolts onto itself —
      // the carrier drinks the hit as a heal through the absorb path
      if (o.hostile && o.src && (o.src.def.type === 'electric' || o.src.def.type2 === 'electric')) {
        const rod = this.players.find((p) => !p.dead && p.def.ability === 'lightning-rod');
        if (rod && o.target !== rod) {
          o.target = rod;
          abilityNotice(this, rod, this.abilityText);
          this.burst(o.x, o.y, TYPE_COLOR.electric, 6, 260, 0.7, TYPE_RAMP.electric);
        }
      }
      const dir = norm({ x: o.target.x - o.x, y: o.target.y - o.y });
      // corkscrew in — each orb wobbles off-axis so the trio reads as
      // three separate swimmers, not a blob
      const perp = Math.sin(this.time * 14 + o.wob) * 0.45;
      const v = o.spd ?? 620;
      o.x += (dir.x - dir.y * perp) * v * dt;
      o.y += (dir.y + dir.x * perp) * v * dt;
      // bubble trail
      if (dist(o, o.target) < o.target.r + 6) {
        if (o.hostile) {
          this.damagePlayer(o.target, o.dmg, o.src, o.flat);
        } else {
          this.hurt(o.target, o.dmg, '#9df0ff');
          if (o.drain) this.tryHeal(this.players, () => Math.max(1, Math.round(o.dmg * 0.35)));
          // every orb landing is a mini hit — small stop + shake
          this.hitStop = Math.max(this.hitStop, 0.05);
          this.addShake(4);
          this.addPunch(0.03);
        }
        this.waves.push({
          x: o.x, y: o.y, r: 0, maxR: 52, t: 0.3, life: 0.3,
          color: o.hostile ? '#ff6b6b' : '#9df0ff', hits: new Set(),
        });
        impactRing(this.fx, this.fxRng, o.x, o.y, o.hostile ? '#ff6b6b' : '#9df0ff', { radius: 42, width: 3, life: 0.26, motes: 2 });
        this.burst(o.x, o.y, o.color, 10, 320);
        sfx('splash');
        o.t = 0;
      }
    }
    cull(this.orbs, (o) => o.t > 0);
  }

  private later(t: number, fn: () => void) {
    this.delays.push({ t, fn });
  }

  get actHooks(): ActHooks {
    return this.hooks;
  }

  // a super's wind-up → contact → recovery as one declarative beat list
  act(beats: ActBeat[]): void {
    vfxAct(this.hooks, beats);
  }

  // Expanding super shockwaves: the ring front damages each enemy once
  // when it reaches them — damage ripples outward from the caster.
  private stepWaves(dt: number) {
    for (const w of this.waves) {
      w.t -= dt;
      w.r = w.maxR * (1 - Math.max(w.t, 0) / w.life);
      if (!w.onHit) continue;
      // snapshot: onHit→hurt can summon boss adds mid-loop — fresh minions
      // don't eat the ring in the pass that spawned them
      const pool = w.hostile ? this.players : this.enemies;
      const poolN = pool.length;
      for (let ei = 0; ei < poolN; ei++) {
        const e = pool[ei];
        if (e.dead || w.hits.has(e.uid)) continue;
        if (dist(w, e) > w.r + e.r * 0.5) continue;
        w.hits.add(e.uid);
        w.onHit(e);
      }
    }
    cull(this.waves, (w) => w.t > 0);
  }

  // Quick-attack lunges: the ally streaks to its target, lands the hit,
  // and stays parked beside it.
  private stepDashes(dt: number) {
    const SP = 1100;
    for (const d of this.dashes) {
      if (d.e.dead || d.u.dead) {
        d.done = true; // target or mover died mid-lunge — park where it is
        continue;
      }
      // hold just outside the target's radius — never overlap it
      const gap = d.u.r + d.e.r + 2;
      if (dist(d.u, d.e) <= gap + 2) {
        if (d.hostile) {
          this.damagePlayer(d.e, d.dmg, d.u);
          // the ram lands with the same crescent cut the melee lunge wears
          slashArc(this.fx, this.fxRng, d.e.x, d.e.y, '#ff8a8a', { angle: Math.atan2(d.e.y - d.u.y, d.e.x - d.u.x), radius: d.e.r * 1.5 });
        } else this.hurt(d.e, d.dmg, '#9df0ff');
        this.impact(d.e.x, d.e.y, d.hostile ? '#f87070' : '#9df0ff', 1.2);
        this.addShake(8);
        this.addPunch(0.04);
        this.hitStop = Math.max(this.hitStop, 0.09);
        sfx('hit');
        d.done = true;
        continue;
      }
      const dir = norm({ x: d.e.x - d.u.x, y: d.e.y - d.u.y });
      const step = Math.min(SP * dt, dist(d.u, d.e) - gap);
      d.u.x += dir.x * step;
      d.u.y += dir.y * step;
      // stampede approach: dust kicks up behind and speed lines stream with it
      if (d.hostile && settings().shake > 0 && this.fx.length < FX_MAX - 2) {
        if (this.fxRng() < dt * 30) {
          this.fx.push({
            x: d.u.x, y: d.u.y + d.u.r * 0.5,
            vx: (this.fxRng() - 0.5) * 26, vy: -16 - this.fxRng() * 26,
            t: 0.4, life: 0.5, size: 3 + this.fxRng() * 3,
            color: '#a89070', shape: 'smoke', spin: (this.fxRng() - 0.5) * 4, grav: -30, sway: 10,
          });
        }
        if (this.fxRng() < dt * 22) {
          this.fx.push({
            x: d.u.x - dir.x * d.u.r, y: d.u.y - dir.y * d.u.r + (this.fxRng() - 0.5) * d.u.r,
            vx: dir.x * 420, vy: dir.y * 420,
            t: 0.12, life: 0.16, size: 1.4 + this.fxRng() * 1.2,
            color: '#ffd8d8', shape: 'streak', spin: 0, grav: 0,
          });
        }
      }
      for (const b of this.blocks) resolveBlock(d.u, b); // dashes respect the stones too
      this.hitSolid(d.u); // and the solid prop zones
    }
    cull(this.dashes, (d) => !d.done);
  }

  // moat cells + stone cover are hundreds of atlas-slice blits a frame —
  // bake them once into an arena-sized layer; only a room swap, a themed
  // reskin, or a smashed/shoved block asks for another
  private bakeRoom() {
    const a = this.arena;
    const c = (this.roomLayer ??= document.createElement('canvas'));
    c.width = Math.ceil(a.w) + 16;
    c.height = Math.ceil(a.h) + 16;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.translate(8 - a.x, 8 - a.y); // draw in live arena coords, blit back at (a-8)
    this.roomTheme = this.skinTheme;
    for (const hz of this.hazards) if (hz.moat) this.drawHazard(g, hz);
    for (const b of this.blocks) this.drawBlock(g, b);
  }

  private drawBlock(ctx: CanvasRenderingContext2D, b: typeof this.blocks[number]) {
    if (b.field) { drawCover(ctx, b, this.skinTheme, []); return; }
    const w = this.arena.w / 9;
    const occupied = (x: number, y: number) => this.blocks.some((r) =>
      x > r.x - 0.1 && x < r.x + r.w + 0.1 && y > r.y - 0.1 && y < r.y + r.h + 0.1);
    for (let i = 0; i < Math.round(b.w / w); i++) {
      const cell = { x: b.x + i * w, y: b.y, w, h: b.h };
      drawCover(ctx, cell, this.skinTheme, [
        occupied(cell.x + w / 2, cell.y - 1),
        occupied(cell.x + w + 1, cell.y + cell.h / 2),
        occupied(cell.x + w / 2, cell.y + cell.h + 1),
        occupied(cell.x - 1, cell.y + cell.h / 2),
      ]);
    }
  }

  private get skinTheme() { return secretTheme(this.theme, this.secret?.phase === 'fight'); }

  // Air Lock parks the sky — every weatherMult read goes through the perk gate
  private get sky(): Weather | null {
    return this.perkIds.includes('air-lock') ? null : this.weather;
  }

  private hitWalls(u: Unit) {
    const a = this.arena;
    // ECHO WALLS: an echo court pays interest on every bank — stones and
    // zones stay honest, only the walls answer
    const rest = this.curMod === 'echo' ? ECHO_REST : WALL_REST;
    // a bounce only counts when it actually reverses a moving ball —
    // resting contact against the wall isn't a wall hit
    const fast = u.vx * u.vx + u.vy * u.vy > 150 * 150;
    let bounced = false;
    let wall: DamageWall | undefined;
    if (u.x - u.r < a.x) {
      u.x = a.x + u.r;
      if (u.vx < 0) {
        u.vx = -u.vx * rest;
        bounced = true;
        wall = this.damageWallAt('left', (u.y - a.y) / a.h);
      }
    } else if (u.x + u.r > a.x + a.w) {
      u.x = a.x + a.w - u.r;
      if (u.vx > 0) {
        u.vx = -u.vx * rest;
        bounced = true;
        wall = this.damageWallAt('right', (u.y - a.y) / a.h);
      }
    }
    if (u.y - u.r < a.y) {
      u.y = a.y + u.r;
      if (u.vy < 0) {
        u.vy = -u.vy * rest;
        bounced = true;
        wall ??= this.damageWallAt('top', (u.x - a.x) / a.w);
      }
    } else if (u.y + u.r > a.y + a.h) {
      u.y = a.y + a.h - u.r;
      if (u.vy > 0) {
        u.vy = -u.vy * rest;
        bounced = true;
        wall ??= this.damageWallAt('bottom', (u.x - a.x) / a.w);
      }
    }
    if (wall && u.side === 'player' && !(this.counterOn(u) && abilityWall(this, u, wall.type, this.abilityText)) && !this.slowImmune
        && u.def.type !== wall.type && u.def.type2 !== wall.type
        && typeMult(wall.type, u.def) > 0
        && !(wall.type === 'grass' && (u.airborne || flies(u.def)))) {
      this.damagePlayer(u, Math.max(1, Math.round(u.maxHp * DAMAGE_WALL_HP * (wall.type === 'fire' && u.def.thickFat ? 0.5 : 1))));
      this.wallHitFx = { edge: wall.edge, t0: this.time, type: wall.type };
      if (settings().shake > 0 && this.fx.length < FX_MAX - 12) // the bite sheds type-colored shards — chunky debris, not soft circles
        pixelExplosion(this.fx, this.fxRng, u.x, u.y, TYPE_RAMP[wall.type], { scale: 0.6 });
      sfx('crack'); // the stone split — visual flash plus a sharp crack
      this.pushText({ x: u.x, y: u.y - u.r - 26, text: 'DMG WALL', t: 0.7, color: TYPE_COLOR[wall.type], big: false });
    }
    if (bounced && fast) {
      u.wallN++;
      if (u.side === 'player') this.onBounceFx(u);
      if (this.ricochet(-2) && !this.inStatic(u.x, u.y)) this.onRicochet(u.x, u.y);
    }
  }

  private damageWallAt(edge: DamageWall['edge'], at: number) {
    return this.damageWalls.find((w) => this.wallLive(w) && w.edge === edge && at >= w.start && at <= w.end);
  }

  private wallLit(w: LiveWall): boolean {
    return !w.on || this.wallTurn % (w.on + (w.off ?? 0)) < w.on;
  }

  private wallWarn(w: LiveWall): boolean {
    return !!w.on && this.wallTurn % (w.on + (w.off ?? 0)) === w.on + (w.off ?? 0) - 1;
  }

  private wallLive(w: LiveWall): boolean {
    return this.wallLit(w) && this.time - (w.t0 ?? -9) >= WALL_LIVE;
  }

  private syncWalls(): void {
    const turn = this.shots - this.wallShot0;
    if (turn === this.wallTurn) return;
    for (let i = 0; i < this.damageWalls.length; i++) {
      const w = this.damageWalls[i];
      if (!w.on) continue;
      const period = w.on + (w.off ?? 0);
      const wasLit = this.wallTurn % period < w.on;
      const lit = turn % period < w.on;
      if (!wasLit && lit) {
        w.t0 = this.time;
        w.outT = undefined;
      } else if (wasLit && !lit) {
        w.outT = this.time;
      }
    }
    this.wallTurn = turn;
  }

  // Stone blocks bank the ball like walls — same restitution, same wall-
  // bounce credit, own contact id so a wall→block squeeze still counts.
  private hitBlocks(u: Unit) {
    const fast = u.vx * u.vx + u.vy * u.vy > 150 * 150;
    let bounced = false;
    for (let i = 0; i < this.blocks.length; i++) {
      const b = this.blocks[i];
      const x = u.x, y = u.y, vx = u.vx, vy = u.vy;
      if (!resolveBlock(u, b)) continue;
      bounced = true;
      if (!b.field || u.side !== 'player' || vx * vx + vy * vy < FIELD_HIT_SPEED ** 2
          || vx * (u.x - x) + vy * (u.y - y) >= 0) continue;
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      let broken = false;
      if (b.field === 'strength') {
        if (!this.pushBlock(b, Math.sign(x - u.x), Math.sign(y - u.y))) continue;
      } else {
        const cut = b.field === 'cut' && (u.def.type === 'grass' || u.def.type2 === 'grass');
        b.hp = cut ? 0 : b.hp! - 1;
        this.roomLayer = null; // chipped/broken cover redraws
        if (b.hp <= 0) { this.blocks.splice(i--, 1); broken = true; }
      }
      animBurst({ ...recipeFor('rock', 'EARTHQUAKE'), shake: broken ? 3 : 1 }, cx, cy, false);
      this.addShake(broken ? 3 : 1);
      sfx(broken ? 'ko' : 'bounce', 0.85);
    }
    if (bounced && fast && u.side === 'player') {
      u.wallN++;
      this.onBounceFx(u);
      if (this.ricochet(-3) && !this.inStatic(u.x, u.y)) this.onRicochet(u.x, u.y);
    }
  }

  private pushBlock(b: typeof this.blocks[number], dc: number, dr: number): boolean {
    if (!this.roomGrid || Math.abs(dc) + Math.abs(dr) !== 1) return false;
    const a = this.arena, w = a.w / 9, h = a.h / 11;
    const c = Math.round((b.x - a.x) / w) + dc, r = Math.round((b.y - a.y) / h) + dr;
    if (c < 1 || c > 7 || r < 1 || r > 9 || !'0RTB'.includes(this.roomGrid[r][c])) return false;
    const x = a.x + c * w, y = a.y + r * h;
    if (this.blocks.some((other) => other !== b && x < other.x + other.w - 0.1 && x + w > other.x + 0.1
        && y < other.y + other.h - 0.1 && y + h > other.y + 0.1)) return false;
    const overlaps = (u: { x: number; y: number; r: number }, gap = 0) =>
      u.x + u.r + gap > x && u.x - u.r - gap < x + w && u.y + u.r + gap > y && u.y - u.r - gap < y + h;
    if ([...this.players, ...this.enemies].some((u) => !u.dead && overlaps(u, FIELD_UNIT_GAP))
        || this.hazards.some((hz) => overlaps(hz))) return false;
    const grid = this.roomGrid.map((row) => [...row].map((ch) => 'RTB'.includes(ch) ? '0' : ch));
    for (const other of this.blocks) {
      if (other === b || other.field === 'smash' || other.field === 'cut') continue;
      const col = Math.round((other.x - a.x) / w), row = Math.round((other.y - a.y) / h);
      for (let i = 0; i < Math.round(other.w / w); i++) grid[row][col + i] = '2';
    }
    grid[r][c] = '2';
    if (!fieldRoomReachable(grid.map((row) => row.join('')))) return false;
    b.x = x; b.y = y;
    this.roomLayer = null;
    return true;
  }

  // Solid prop zones (ponds, spike boulders) are walls to bodies that
  // can't cross them — swim/fly/hover over, otherwise bank off the
  // surface and take the bounce credit a stone slab would pay.
  private hitSolid(u: Unit): Hazard['kind'] | null {
    const fast = u.vx * u.vx + u.vy * u.vy > 150 * 150;
    let kind: Hazard['kind'] | null = null;
    for (const hz of this.hazards) if (!u.airborne && isSolid(hz, u.def) && resolveZone(u, hz)) kind = hz.kind;
    if (kind && fast && u.side === 'player') {
      u.wallN++;
      this.onBounceFx(u);
      if (this.ricochet(kind === 'spikes' ? -5 : -4) && !this.inStatic(u.x, u.y)) this.onRicochet(u.x, u.y);
    }
    return kind;
  }

  // Pinball feedback on a real bounce: squash pulse, expanding ring, a
  // shake scaled to impact speed and a pitched thock — faster = sharper.
  private onBounceFx(u: Unit) {
    u.sq = Math.max(u.sq, 0.7);
    const spd = Math.hypot(u.vx, u.vy);
    this.waves.push({ x: u.x, y: u.y, r: 0, maxR: u.r * 2.4, t: 0.22, life: 0.22, color: '#cfe4ff', hits: new Set() });
    this.burst(u.x, u.y, '#cfe4ff', Math.min(9, 3 + Math.floor(spd / 500)), spd * 0.26, 0.9);
    smokeColumn(this.fx, this.fxRng, u.x, u.y + u.r * 0.4, '#9aa2b8', { n: 2, spread: u.r }); // wall-hit dust
    // banks rattle only on real speed or a live chain — a graze keeps the
    // dust, ring and thock but skips the screen kick
    if (spd > 1100 || this.shotCombo >= 3) this.addShake(Math.min(4.5, spd / 500));
    sfx('bounce', Math.min(1.7, 0.6 + spd / 1200));
  }

  // Keeps a spawn point (or pickup) out of the blocks — nudge to the
  // nearest face rather than rejecting the spot.
  private unstick(x: number, y: number, r: number) {
    // repeat until stable — a cluster can push the point out of one slab
    // and into an already-checked neighbor
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (const b of this.blocks) {
        const l = x - (b.x - r - 4), rr = b.x + b.w + r + 4 - x;
        const t = y - (b.y - r - 4), bo = b.y + b.h + r + 4 - y;
        if (l > 0 && rr > 0 && t > 0 && bo > 0) {
          const m = Math.min(l, rr, t, bo);
          if (m === l) x = b.x - r - 4;
          else if (m === rr) x = b.x + b.w + r + 4;
          else if (m === t) y = b.y - r - 4;
          else y = b.y + b.h + r + 4;
          moved = true;
        }
      }
      if (!moved) break;
    }
    // corridor narrower than the body can ping-pong the passes and still
    // end inside a slab — spiral out to the first spot clear of them all
    const inside = (px: number, py: number) =>
      this.blocks.some((b) => px > b.x - r - 4 && px < b.x + b.w + r + 4 && py > b.y - r - 4 && py < b.y + b.h + r + 4);
    if (inside(x, y)) {
      const ox = x, oy = y;
      for (let ring = 8; ring <= 260 && inside(x, y); ring += 8)
        for (let a = 0; a < 16 && inside(x, y); a++) {
          const ang = (a / 16) * Math.PI * 2;
          const px = ox + Math.cos(ang) * ring, py = oy + Math.sin(ang) * ring;
          if (!inside(px, py)) { x = px; y = py; }
        }
    }
    return { x, y };
  }

  // RICOCHET: two distinct contacts (enemy, ally, wall, stone) inside
  // one 0.35s window — the deflection shot is the engine's fuel. Records every
  // contact; callers gate the payoff on static fields so silence absorbs
  // chains.
  private ricochet(id: number) {
    const chained = this.time - this.lastContact.t <= 0.35 && this.lastContact.id !== id;
    this.lastContact = { t: this.time, id };
    return chained;
  }

  private onRicochet(x: number, y: number) {
    this.pushText({ x, y: y - 30, text: 'RICOCHET!', t: 0.8, color: '#9df0ff', big: true });
    this.impact(x, y, '#9df0ff', 0.9);
    for (let k = 0; k < this.ricoPip; k++) this.chargeUp(this.active);
  }

  // Static fields silence keyword triggers and bump supers inside them.
  private inStatic(x: number, y: number) {
    for (const hz of this.hazards) {
      if (hz.kind !== 'static') continue;
      const dx = x - hz.x, dy = y - hz.y;
      if (dx * dx + dy * dy < hz.r * hz.r) return true;
    }
    return false;
  }

  // The 'power' mutator's ATK field: hits landed while the ball's inside it
  // carry the field's charge. The zone list caches — only a hazards swap or
  // push (new wave, mutator spawn) rebuilds it.
  private inPower(x: number, y: number) {
    if (this.powerRef !== this.hazards || this.powerLen !== this.hazards.length) {
      this.powerRef = this.hazards;
      this.powerLen = this.hazards.length;
      this.powerHz = this.hazards.filter((hz) => hz.kind === 'power');
    }
    for (const hz of this.powerHz) {
      const dx = x - hz.x, dy = y - hz.y;
      if (dx * dx + dy * dy < hz.r * hz.r) return true;
    }
    return false;
  }

  // Field pickups — the MS heart/sword/hourglass: heal, damage, cooldown.
  private grabPickup(pk: Pickup) {
    this.burst(pk.x, pk.y, '#fff8dc', 9, 260, 0.9);
    impactRing(this.fx, this.fxRng, pk.x, pk.y, PICKUP_META[pk.kind].color, { radius: 30, width: 3, life: 0.28, motes: 3 }); // the collect pop
    this.glint(pk.x, pk.y - 8, 9);
    this.shotLoot++;
    switch (pk.kind) {
      case 'oran-berry':
      case 'sitrus-berry': {
        this.breakSafeguard();
        const fraction = pk.kind === 'sitrus-berry' ? 0.3 : 0.15;
        const hp0 = this.players.reduce((a, p) => a + p.hp, 0);
        this.tryHeal(this.players, (p) => Math.max(1, Math.round(p.maxHp * fraction)));
        // if nobody needed it (full team, heal on cooldown) still say so —
        // a pickup should never vanish without a word
        if (this.players.reduce((a, p) => a + p.hp, 0) === hp0) {
          this.pushText({ x: pk.x, y: pk.y - 12, text: 'TEAM FULL', t: 0.9, color: '#6fdc6f', big: false });
        }
        break;
      }
      case 'protein':
      case 'x-attack':
        sfx('ui');
        this.shotPhys *= pk.kind === 'x-attack' ? 2 : 1.5;
        this.pushText({ x: pk.x, y: pk.y - 12, text: 'ATK UP!', t: 0.9, color: PICKUP_META[pk.kind].color, big: true });
        break;
      case 'pp-up':
        sfx('ready');
        this.pushText({ x: pk.x, y: pk.y - 12, text: 'ULT +1!', t: 0.9, color: PICKUP_META[pk.kind].color, big: true });
        if (this.telop.once('pk:pp-up')) this.telop.push({ kind: 'combo', title: 'PP UP', sub: 'ULT CHARGE +1', icon: 'pp-up' });
        if (this.ultIn > 0) this.ultIn--;
        break;
      case 'chesto-berry':
        sfx('ready');
        // every live clock winds back to full; a clock already full stays put
        for (const e of this.enemies) {
          if (e.dead) continue;
          const boosts = e.boostN;
          e.timer = Math.max(e.timer, this.enemyReload(e));
          e.boostN = boosts; // a reload peek, not a real reload
          for (const c of e.clocks) c.t = Math.max(c.t, c.turn);
        }
        this.pushText({ x: pk.x, y: pk.y - 12, text: 'CLOCKS RESET!', t: 0.9, color: PICKUP_META[pk.kind].color, big: true });
        if (this.telop.once('pk:chesto')) this.telop.push({ kind: 'combo', title: 'CHESTO BERRY', sub: 'FOE CLOCKS RESET', icon: 'chesto-berry' });
        break;
      case 'great-ball':
      case 'ultra-ball':
        sfx('ready');
        // the pocket keeps the better ball — grabbing great over ultra loses nothing
        if (this.stockedBall !== 'ultra-ball') this.stockedBall = pk.kind;
        this.pushText({ x: pk.x, y: pk.y - 12, text: 'BALL READY!', t: 0.9, color: PICKUP_META[pk.kind].color, big: true });
        if (this.telop.once('pk:ball')) this.telop.push({ kind: 'combo', title: PICKUP_META[pk.kind].name, sub: `NEXT CATCH +${Math.round(this.ballOdds() * 100)}%`, icon: pk.kind });
        break;
      case 'elixir':
      case 'max-elixir': {
        sfx('ready');
        const ticks = pk.kind === 'max-elixir' ? 2 : 1;
        for (const p of this.players) for (let i = 0; i < ticks; i++) this.chargeUp(p);
        if (this.waveIndex >= 2) this.pushText({ x: pk.x, y: pk.y - 12, text: `CD -${ticks}!`, t: 0.9, color: PICKUP_META[pk.kind].color, big: true });
        break;
      }
      case 'lum-berry': {
        sfx('ready');
        // canonical lum — every ailment on the team washes off at once
        let cured = false;
        for (const p of this.players) {
          if (p.dead) continue;
          if (p.dotTicks > 0 || p.burnT > 0 || p.paraT > 0 || p.asleep) cured = true;
          this.cleanse(p);
        }
        this.pushText({
          x: pk.x, y: pk.y - 12,
          text: cured ? 'CURED!' : 'FRESH', t: 0.9, color: '#b8f8f8', big: cured,
        });
        break;
      }
      case 'revival-herb': {
        const corpse = this.players.find((p) => p.dead);
        if (!corpse) break; // the drop was rolled at spawn — the team mended since
        corpse.dead = false;
        corpse.hp = Math.max(1, Math.round(corpse.maxHp * 0.25));
        sfx('heal');
        this.burst(corpse.x, corpse.y, '#f8d030', 12, 300);
        this.pushText({ x: corpse.x, y: corpse.y - corpse.r - 14, text: 'BACK IN!', t: 1.1, color: '#f8d030', big: true });
        break;
      }
    }
  }

  // One shared heal window: a mend that lands starts HEAL_CD shots of
  // downtime, so sustain is a drip, not a reset — items still bypass it.
  private healBlocked() {
    return this.enemies.some((e) => !e.dead && e.def.healBlock);
  }

  private tryHeal(ps: Unit[], amount: (p: Unit) => number) {
    if (this.healCd > 0) return;
    if (this.healBlocked()) {
      // heal block: a living carrier keeps the wounds open — say so, or the
      // berry just vanishes and reads as a bug. Kill the blocker to mend.
      const p0 = ps.find((p) => !p.dead && p.hp < p.maxHp);
      if (p0) this.pushText({ x: p0.x, y: p0.y - p0.r - 8, text: 'HEAL BLOCKED!', t: 0.9, color: '#a868c8', big: false });
      return;
    }
    let healed = false;
    for (const p of ps) {
      if (p.dead || p.hp >= p.maxHp) continue;
      const heal = amount(p);
      p.hp = Math.min(p.hp + heal, p.maxHp);
      this.pushText({ x: p.x, y: p.y - p.r - 8, text: `+${heal}`, t: 0.9, color: '#6fdc6f', big: false });
      this.burst(p.x, p.y, '#6fdc6f', 6, 200, 0.8);
      healed = true;
    }
    if (healed) {
      this.healCd = HEAL_CD;
      sfx('heal');
    }
  }

  // A scorch mark on the court — heavy hits leave the floor scarred.
  private scar(x: number, y: number, r: number) {
    this.scars.push({ x, y, r, t: 0, life: 7 });
    if (this.scars.length > 24) this.scars.shift();
  }

  // Push moving unit out of a static circle and reflect its velocity.
  private collide(u: Unit, o: { x: number; y: number; r: number }): boolean {
    const rr = u.r + o.r;
    const dx = o.x - u.x, dy = o.y - u.y;
    if (dx * dx + dy * dy >= rr * rr) return false;
    const d = Math.hypot(dx, dy);
    // dead-center overlap: norm() is 0/0 — pop apart on a fixed axis or the
    // pair stays stacked forever
    const nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : -1;
    u.x = o.x - nx * rr;
    u.y = o.y - ny * rr;
    const vn = u.vx * nx + u.vy * ny;
    if (vn > 0) {
      u.vx -= (1 + UNIT_REST) * vn * nx;
      u.vy -= (1 + UNIT_REST) * vn * ny;
    }
    return true;
  }

  // Central damage path so every source (contact, bump, orb, dot) behaves alike.
  private hurt(e: Unit, dmg: number, color: string, suffix = '', src?: Unit) {
    if (e.dead || (e.boss && this.barBreak)) return;
    // absorb: a matching element feeds the hide instead of hurting it —
    // the heal signal travels as negative damage through this one seam
    if (dmg < 0) {
      e.hp = Math.min(e.maxHp, e.hp - dmg);
      this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'ABSORBED!', t: 0.9, color: '#6fdc6f', big: false });
      sfx('heal');
      return;
    }
    if (e.safeguard) {
      this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'SAFEGUARD', t: 0.9, color: '#f8a8d8', big: false });
      if (this.telop.once('safeguard')) this.telop.push({ kind: 'shield', title: 'SAFEGUARD', sub: 'GRAB A BERRY · BREAK IT', mon: e.def.id, icon: 'oran-berry' });
      sfx('bounce');
      return;
    }
    let d = dmg;
    // filter/solid rock: super-effective hits lose their edge — STAB spam
    // isn't the whole answer, bring a neutral hitter too. Mold Breaker
    // canonically punches straight through it.
    if (suffix === '!' && e.def.filter && !src?.def.breaker) d *= 0.7;
    if (suffix === '!') d *= 1 + this.belt; // expert belt loves super-effective
    if (e.boss) d *= 1 + this.bossSlayer;
    let crit = false;
    if (this.critCh > 0 && this.rng() < this.critCh) {
      if (e.def.armor) {
        // battle armor: the crit glances off the shell — crit-built teams
        // get a counter, and the tag warns before you commit the angle
        this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'SHELL ARMOR!', t: 0.8, color: '#9aa7b8', big: false });
      } else {
        crit = true;
        d *= 2;
      }
    }
    d = Math.round(d * this.dmgMult * (1 + this.t('fire') * 0.1) * (1 + e.armorN * 0.12)); // a cracked shell reads softer
    d = Math.round(d * this.connect.mult());
    d = this.flee.def(e, d);
    // aegis ward: a shielded foe eats the whole hit — crack the guardian
    // first, or the pack soaks your best lines for free
    if (e.shieldN > 0) {
      if (src && this.counterOn(src)) abilityReflect(this, src, e, this.abilityText);
      e.shieldN--;
      if (e.shieldN) this.pushText({ x: e.x, y: e.y - e.r - 30, text: `REFLECT ${e.shieldN}`, t: 0.9, color: TYPE_COLOR[e.def.type], big: false });
      else this.telop.push({ kind: 'shield', title: 'REFLECT BROKEN', sub: e.def.name.toUpperCase(), mon: e.def.id, icon: 'hard-stone' });
      this.waves.push({ x: e.x, y: e.y, r: 0, maxR: e.r * 2, t: 0.3, life: 0.3, color: '#9df0ff', hits: new Set() });
      sfx('bounce');
      return;
    }
    // minion guard: while a summoned add lives, the boss hides behind the
    // pack — crack the adds first or chip at half rate
    if (e.boss && this.enemies.some((m) => m.minion && !m.dead)) d = Math.max(1, Math.round(d * 0.5));
    // 0x matchups (e.g. normal vs ghost) still chip — a wave must always
    // be finishable even when the whole team is immune-typed
    const immune = d <= 0;
    if (immune) d = 1;
    // sleep bonus: a dozing foe takes the hit like a free crit — and the
    // hit wakes it, so the ambush is one clean swing per fight
    if (e.asleep) d = Math.max(1, Math.round(d * 1.35));
    const hpBefore = e.hp;
    e.hp -= d;
    if (this.flee.is(e) && e.hp > 0 && !e.dead) this.treasure.hit(e, this.flee.hitSeed(e, this.mapSeed, this.waveIndex, this.battle), this.time);
    if (e.boss && !e.dead && hpBefore > 0 && e.sumStage < (e.bars ?? BOSS_BARS).length - 1) {
      const floor = 1 - (e.bars ?? BOSS_BARS).slice(0, e.sumStage + 1).reduce((sum, bar) => sum + bar, 0);
      if (e.hp < Math.ceil(e.maxHp * floor)) {
        e.hp = Math.ceil(e.maxHp * floor);
        e.sumStage++;
        if (STAGE_GIMMICKS[this.theme].kind === 'barrier') e.shieldN = REFLECT_BOSS_HITS;
        this.barBreak = true;
        buzz([40, 40, 70]);
      }
    }
    e.flashT = 0.12; // the sprite burns white for a beat — every hit confirms
    // weak armor: every landed hit cracks the shell — it sheds weight and
    // presses faster, but the next hit finds a softer hide. Burst it, don't chip.
    if (e.def.weakArmor && e.hp > 0 && e.armorN < 6) {
      e.armorN++;
      e.drift *= 1.1;
      if (e.armorN === 1) this.pushText({ x: e.x, y: e.y - e.r - 44, text: 'SHELL CRACKS!', t: 0.9, color: '#9aa7b8', big: false });
    }
    if (e.asleep && e.hp > 0) {
      e.asleep = false;
      this.pushText({ x: e.x, y: e.y - e.r - 22, text: 'IT WOKE UP!', t: 1, color: '#c8d0e8', big: false });
      sfx('warn');
    }
    // enemy focus sash / sturdy: hangs on at 1 HP through the lethal hit
    if (e.sash && e.hp <= 0) {
      e.sash = false;
      e.hp = 1;
      this.pushText({ x: e.x, y: e.y - e.r - 34, text: e.def.sturdy ? 'STURDY!' : 'FOCUS SASH!', t: 1.1, color: '#ffd84d', big: false });
    }
    // ghost trait: execute non-boss foes already on fumes
    if (!e.dead && !e.boss && e.hp > 0 && e.hp <= e.maxHp * this.t('ghost') * 0.06) {
      this.pushText({ x: e.x, y: e.y - e.r - 34, text: 'EXECUTE!', t: 1, color: '#a868c8', big: true });
      e.hp = 0;
    }
    // psychic trait: a cut of every hit splashes onto another foe —
    // re-entry guarded so the splash can't splash
    if (!this.splashing && this.t('psychic') > 0) {
      const other = this.enemies.find((x) => !x.dead && x !== e);
      if (other) {
        this.splashing = true;
        this.hurt(other, Math.max(1, Math.round(d * this.t('psychic') * 0.1)), '#f85888');
        this.splashing = false;
      }
    }
    // poison trait: player hits can envenom — stacks the same doT the
    // toxic super applies
    if (!e.dead && this.t('poison') > 0 && !poisonProof(e.def) && this.rng() < this.t('poison') * 0.25) {
      e.dotTicks = Math.min(e.dotTicks + 1, 6);
      e.dotDmg = Math.max(e.dotDmg, Math.ceil(e.maxHp * 0.08));
    }
    if (e.boss && e.hp > 0) this.enrageBoss(e);
    // Rage-flagged fodder goes berserk below 30% HP.
    if (!e.boss && e.def.rage && !e.enraged && e.hp > 0 && e.hp / e.maxHp < 0.3) {
      e.enraged = true;
      e.timer = Math.min(e.timer, 2);
      this.pushText({ x: e.x, y: e.y - e.r - 58, text: 'ENRAGED!', t: 1.2, color: '#ff6b6b', big: true });
      this.burst(e.x, e.y, '#ff6b6b', 16, 440, 1.2);
      this.screenFlash('#ff6b6b', 0.15);
      sfx('invade');
    }
    const ascPremium = this.asc >= 5 ? 0.3 : 0.2; // ASC 5 INFLATION: the score premium deepens
    const gain = Math.round(d * (1 + this.asc * ascPremium) * this.scoreMult * (this.shotFever && this.phase === 'shot' ? FEVER_SCORE : 1)); // ascension pays a score premium; lucky egg and fever shots stack on
    this.score += gain;
    // the run just became your best — celebrate mid-flight, not just on the card
    if (!this.bested && this.bestScore > 0 && this.score > this.bestScore) {
      this.bested = true;
      this.pushText({ x: e.x, y: e.y - e.r - 46, text: '★ NEW BEST ★', t: 1.4, color: '#ffd84d', big: true });
      sfx('perfect');
    }
    // king's rock staggers attack timers — capped so a long combo delays
    // one volley instead of locking the enemy out forever
    e.timer = Math.min(e.timer + this.stagger, ENEMY_BASE_TIMER + this.stagger + 1);
    // shell bell + grass trait: damage feeds the weakest ally
    const leech = this.leech + this.t('grass') * 0.04;
    if (leech > 0) {
      const weakest = this.players
        .filter((pl) => !pl.dead && pl.hp < pl.maxHp)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (weakest) {
        weakest.hp = Math.min(weakest.hp + Math.max(1, Math.round(d * leech)), weakest.maxHp);
      }
    }
    if (settings().dmgNums)
      this.pushText({
        x: e.x + (Math.random() - 0.5) * e.r * 1.2,
        y: e.y - e.r - 8,
        text: immune ? 'IMMUNE' : crit ? `${d} CRIT!` : `${d}${suffix}`,
        t: 0.9,
        color: immune ? '#8a90a8' : crit || this.hitWeak ? '#ffd84d' : color,
        big: crit || suffix === '!',
        gold: this.hitWeak && !immune,
        // the number sells the hit — chunkier damage pops bigger
        size: dmgNumSize(d, e.maxHp, this.hitWeak),
        tilt: (Math.random() - 0.5) * 0.16,
      });
    // every landed hit reads on the sprite — orbs, dots and ults squash too
    if (d > 0 && !e.dead) e.sq = Math.max(e.sq, 0.5);
    // the shot's damage tally climbs mid-flight, MS-style — every pop feeds it
    if (d > 0 && e.side === 'enemy') this.shotDmg += d;
    // per-hit weight: a chunk of the health bar at once gets the anime
    // flash frame plus a beat of stop scaled to the wound — bumps, orbs
    // and dot ticks all deserve it, not just contact. Chip hits only spark.
    if (!immune && d >= Math.max(30, e.maxHp * 0.25)) {
      this.impact(e.x, e.y, color, Math.min(1.5, 0.8 + (d / e.maxHp) * 1.6));
      this.hitStop = Math.max(this.hitStop, Math.min(0.09, (d / e.maxHp) * 0.25));
    } else if (!immune && d > 0) {
      this.burst(e.x, e.y, color, 2, 200, 0.5); // the weak-hit spark
    }
    if (crit) {
      this.addShake(4);
      this.burst(e.x, e.y, '#ffd84d', 10, 380);
      this.screenFlash('#ffd84d', 0.08);
      this.hitStop = Math.max(this.hitStop, 0.08);
      sfx('perfect', 0.7);
    }
    // styler loop wraps the target — every hit is another circle
    if (e.hp <= 0) {
      // the champion's last stand: the final gym's ace refuses once —
      // back up at ~45% and already enraged. The run's last fight earns
      // a second wind the other gyms never get — a LAST STAND raid boss
      // borrows the same refusal.
      if (e.boss && !e.lastStand && (this.depth >= FINAL_DEPTH || (this.raid && this.raidMod === 'laststand'))) {
        e.lastStand = true;
        e.hp = Math.ceil(e.maxHp * 0.45);
        e.enraged = true;
        e.timer = Math.min(e.timer, 1.5);
        this.pushText({ x: e.x, y: e.y - e.r - 58, text: 'LAST STAND!', t: 1.5, color: '#ffd84d', big: true });
        this.burst(e.x, e.y, '#ffd84d', 22, 460, 1.3);
        this.screenFlash('#ffd84d', 0.2);
        this.addShake(8);
        sfx('invade');
        return;
      }
      this.treasure.ko(e, (this.mapSeed * 977 + this.waveIndex * 131 + this.battle * 17 + e.uid * 7919) >>> 0, { boss: e.boss || !!e.mid, weak: !!src && this.weakHit(e, src.x, src.y), finisher: this.battle >= this.battles && this.enemies.every((x) => x === e || x.dead), combo: this.shotCombo, speed: this.stopShots <= this.par, off: this.raid, rare: this.flee.is(e) }, this.time);
      if (this.flee.is(e)) this.pushText({ x: e.x, y: e.y - e.r - 60, text: this.flee.ko(e, (n) => this.earnStars(n)), t: 1.4, color: '#ffd84d', big: false });
      e.dead = true;
      cry(e.def.id, 'ko');
      this.koX = e.x;
      this.koY = e.y;
      this.koSeen = true;
      // destiny bond: a direct hit that finishes the carrier drags the
      // striker down with it — hazards, splashes, catches and bump supers
      // (no src) are the safe ways to close a bond foe
      if (e.def.bond && src && !src.dead) {
        this.pushText({ x: src.x, y: src.y - src.r - 34, text: 'DESTINY BOND!', t: 1.3, color: '#a868c8', big: true });
        // bond damage ignores mitigation — only sash/revive cheat it
        this.damagePlayer(src, src.maxHp * 9, e);
      }
      // aftermath: a finished carrier blows back on whatever closed it —
      // a quarter of the striker's own HP. Indirect kills stay safe
      if (aftermathKO(e.def) && src && !src.dead) {
        this.pushText({ x: src.x, y: src.y - src.r - 34, text: 'AFTERMATH!', t: 1.1, color: '#a868c8', big: false });
        this.damagePlayer(src, Math.max(1, Math.round(src.maxHp * 0.25)), e);
        this.burst(e.x, e.y, '#a868c8', 12, 380, 1, TYPE_RAMP.ghost);
      }
      this.shotKOs++;
      // multi-kills name themselves mid-flight — the pinball line earns the pop
      if (this.shotKOs === 2) {
        this.pushText({ x: e.x, y: e.y - e.r - 42, text: 'DOUBLE KO!', t: 1.1, color: '#ffd84d', big: true });
        sfx('perfect', 0.8);
      } else if (this.shotKOs === 3) {
        this.pushText({ x: e.x, y: e.y - e.r - 42, text: 'TRIPLE KO!', t: 1.1, color: '#ffd84d', big: true });
        sfx('perfect', 1);
      } else if (this.shotKOs > 3) {
        this.pushText({ x: e.x, y: e.y - e.r - 42, text: `${this.shotKOs} KO!`, t: 1.1, color: '#ffd84d', big: true });
        sfx('perfect', 1.1);
      }
      this.scar(e.x, e.y, e.boss ? 32 : 14); // a KO scorches the court — bosses crater deeper
      // the KO pop is the game's biggest beat — flash frame, pixel shatter,
      // shockwave and a camera lunge all at once
      animBurst(recipeFor(e.def.type), e.x, e.y, e.boss);
      this.impact(e.x, e.y, TYPE_COLOR[e.def.type] ?? '#ffffff', e.boss ? 2.6 : 1.5);
      this.pops.push({ x: e.x, y: e.y, id: e.def.id, r: e.r, t: 0.2, life: 0.2 });
      this.shatter(e.x, e.y, e.r, e.def.type, e.boss ? 18 : 9); // the body bursts into chips
      this.burst(e.x, e.y, '#ffffff', e.boss ? 26 : 14, e.boss ? 620 : 420, e.boss ? 1.6 : 1);
      this.waves.push({ x: e.x, y: e.y, r: 0, maxR: e.r * 3.2, t: 0.35, life: 0.35, color: TYPE_COLOR[e.def.type] ?? '#ffffff', hits: new Set() });
      this.hitStop = Math.max(this.hitStop, e.boss ? 0.58 : 0.18);
      this.addPunch(e.boss ? 0.2 : 0.09);
      this.addShake(e.boss ? 14 : 6);
      if (e.boss) {
        // a leader dies in acts — the boom, a beat of slow-mo, the soot settling
        this.act([
          { t: 0, run: () => pixelExplosion(this.fx, this.fxRng, e.x, e.y, TYPE_RAMP[e.def.type], { scale: 1.4 }), sfx: 'boom' },
          { t: 0.32, run: () => smokeColumn(this.fx, this.fxRng, e.x, e.y, TYPE_RAMP[e.def.type], { n: 4, spread: e.r * 1.2 }), shake: 7 },
        ]);
        this.screenFlash('#ffffff', 0.28);
        this.bossKilledAt = { x: e.x, y: e.y }; // the coin fountain erupts here
      }
      // every KO feeds the team's supers — kills are the fast lane to READY
      for (const p of this.players) this.chargeUp(p);
      // fatigue curse: farming a cursed KO costs every super a pip back
      if (e.def.cursed) {
        for (const p of this.players) p.cd = Math.min(p.cd + 1, p.cdMax);
        this.pushText({ x: e.x, y: e.y - e.r - 60, text: 'CURSED!', t: 1.1, color: '#a868c8', big: true });
      }
      // split foes divide on KO — two half-size spawn take its place;
      // kids lose the flag (cloned def) so it can't recurse
      if (e.def.split) {
        for (const s of [-1, 1]) {
          const kid = this.makeEnemy(
            { def: { ...e.def, split: undefined }, nx: (e.x - this.arena.x) / this.arena.w, ny: (e.y - this.arena.y) / this.arena.h },
            this.waveIndex,
          );
          kid.maxHp = kid.hp = Math.max(8, Math.round(e.maxHp * 0.35));
          kid.r = Math.max(10, Math.round(e.r * 0.7));
          const at = this.unstick(e.x + s * e.r * 0.9, e.y, kid.r + 2);
          kid.x = at.x;
          kid.y = at.y;
          this.enemies.push(kid);
          this.burst(kid.x, kid.y, '#a0e060', 5, 160, 0.7);
        }
        this.pushText({ x: e.x, y: e.y - e.r - 34, text: 'SPLIT!', t: 0.9, color: '#a0e060', big: false });
      }
      // multi-KO callouts — chaining kills in one shot should feel huge
      this.kosThisShot++;
      this.totalKos++;
      this.stopKos++;
      if (this.totalKos >= 40) this.award('rampage');
      this.taskPing('kos', this.totalKos, e.x, e.y - e.r - 90);
      if (this.totalKos % KO_BOUNTY.every === 0) {
        const got = this.earnStars(KO_BOUNTY.pay);
        this.pushText({ x: e.x, y: e.y - e.r - 70, text: `BOUNTY +${got} ★`, t: 1.2, color: '#c9a8ff', big: true });
      }
      this.maxKos = Math.max(this.maxKos, this.kosThisShot);
      this.lastKoType = src?.def.type ?? null;
      this.missions.ko(this.kosThisShot, this.battle >= this.battles && this.enemies.every((x) => x.dead) ? src?.def.type ?? null : undefined);
      // EXP: the mon that launched this shot levels up — growth you can
      // watch mid-run. floor() makes fodder teach nothing: KOs under ~Lv20
      // grant zero, punching up still pays +1, and deep foes give real
      // chunks. Feeding dupes is the main level path (MS fusion).
      const lv = this.active;
      if (lv && !lv.dead && lv.lvl < LV_CAP) {
        const n = Math.floor(e.lvl * KO_LV_RATE) + (e.lvl > lv.lvl ? 1 : 0);
        if (n > 0) this.gainLevels(lv, n);
      }
      // bench learns at the floored share rate — a trickle only deep foes pay
      const share = Math.floor(e.lvl * KO_LV_RATE * KO_LV_SHARE);
      const shared = share > 0 ? this.players.filter((p) => p !== lv && this.gainLevels(p, share, true)) : [];
      if (shared.length && lv) this.pushText({ x: lv.x, y: lv.y - lv.r - 54, text: 'TEAM LV UP', t: 0.8, color: '#9df0ff', big: false });
      if (this.kosThisShot >= 2) {
        const label = this.kosThisShot === 2 ? 'DOUBLE KO!' : this.kosThisShot === 3 ? 'TRIPLE KO!' : 'MEGA KO!';
        this.pushText({ x: e.x, y: e.y - e.r - 46, text: label, t: 1.1, color: '#ffd84d', big: true });
      }
      // exp share: every KO feeds the team a little
      if (this.koHeal > 0) {
        for (const p of this.players) {
          if (!p.dead) p.hp = Math.min(p.hp + Math.round(p.maxHp * this.koHeal), p.maxHp);
        }
      }
      // small chance it actually joins your team (balls raise this);
      // an armed master ball never fails — first KO catches, guaranteed.
      // Trainer mons stay with their owner — the ball never comes out.
      const master = this.masterArmed && !this.inTrainer;
      const thrown = this.stockedBall ?? 'poke-ball'; // the pocket's ball is the one that flies
      // shinies never break out — KO'ing one always lands it in the box
      // the KO shot's combo feeds the roll — a pinball kill tires the mon
      // out like a proper weaken-first. (Dots and orbs from this same shot
      // still read this shot's chain — the right value.)
      const caught = master || e.shiny || (!this.inTrainer && this.rng() < this.catchOdds(e) + Math.min(0.12, this.shotCombo * 0.015) + this.ballOdds());
      // a thrown ball is spent, catch or bust — master balls and shinies
      // skip the roll, so the pocket stays stocked for a real throw
      const flew = !master && !e.shiny && !this.inTrainer; // the roll ran — the pocket ball actually left your hand
      if (flew) this.stockedBall = null;
      if (master) {
        this.masterArmed = false;
        this.pushText({ x: e.x, y: e.y - e.r - 58, text: '★ MASTER BALL!', t: 1.5, color: '#c96bff', big: true });
        this.log('★ MASTER BALL!');
      }
      sfx('ko');
      buzz(e.boss ? [50, 60, 90] : 30);
      // the verdict card — held back for the ball's click/burst whenever a
      // capture was attempted so the rocks land before the reveal
      const verdict: FloatText = {
        x: e.x, y: e.y - e.r - 22,
        text: `${e.shiny ? 'SHINY ' : ''}${e.def.name.toUpperCase()} ${caught ? 'CAUGHT!' : 'FAINTED!'}`,
        t: caught ? 1.5 : 1.1,
        color: caught ? '#ffd84d' : '#9df0ff',
        big: true,
      };
      if (e.boss && this.waveHadGym) {
        this.award('badge'); // leader down, caught or not
        this.award(`gym-${e.def.id}`); // the leader's own trophy
        // the badge case: each leader pays out its themed badge, once ever
        const badge = earnBadge(e.def.id);
        if (badge) {
          const badgeLine = `★ EARNED THE ${badge.name}! ★`;
          this.pushText({
            x: e.x, y: e.y - e.r - 74,
            text: badgeLine,
            t: 2.1, color: badge.color, big: true,
          });
          this.log(badgeLine);
          this.burst(e.x, e.y, badge.color, 26, 520, 1.4);
          this.impact(e.x, e.y, badge.color, 2);
          this.screenFlash(badge.color, 0.22);
          this.hitStop = Math.max(this.hitStop, 0.35);
          this.addPunch(0.12);
          sfx('perfect');
          if (gymBadges().size >= BADGES.length) this.award('league');
          // every first-time badge stocks the bag — a random consumable
          // for a future run's opening picks
          const item = BAG_ITEMS[Math.floor(this.rng() * BAG_ITEMS.length)];
          bankBag(item.id);
          playJingle('item');
          this.pushText({
            x: e.x, y: e.y - e.r - 92,
            text: `BAG +1 ${item.name.toUpperCase()}`,
            t: 1.8, color: '#9df0ff', big: true,
          });
        }
      }
      // the ball comes out whenever a capture was rolled — trainer mons
      // stay with their owner, so their KOs still faint on the spot
      if (caught || !this.inTrainer) {
        this.catchSeq(e.x, e.y, caught, master ? 'master-ball' : flew ? thrown : 'poke-ball', () => {
          this.pushText(verdict);
          if (caught) {
            // click shut: the gotcha flash then the same payoff as always
            this.impact(e.x, e.y, '#ffd84d', 1);
            this.screenFlash('#ffd84d', 0.2);
            this.burst(e.x, e.y, '#ffd84d', 18, 420, 1.2);
            if (e.shiny) {
              this.pushText({ x: e.x, y: e.y - e.r - 56, text: 'SHINY BONUS +250', t: 1.4, color: '#ffd84d', big: true });
            }
            playJingle('catch');
            cry(e.def.id, 'catch');
            buzz([30, 50, 30, 50, 60]);
          } else {
            // broke out — the escape plays the same faint it always was
            this.pops.push({ x: e.x, y: e.y, id: e.def.id, r: e.r, t: 0.55, life: 0.55 });
            this.burst(e.x, e.y, '#ffffff', 8, 300, 0.9);
            sfx('bounce', 0.6);
            buzz(30);
            playJingle('fail'); // the wha-wha — broke free
          }
        }, e.def.id, e.r);
      } else {
        this.pushText(verdict);
        // a faint flashes the sprite out — the ghost drifts up and gone
        this.pops.push({ x: e.x, y: e.y, id: e.def.id, r: e.r, t: 0.55, life: 0.55 });
      }
      if (caught) {
        // a dupe feeds the copy you own instead of filling a box slot
        if (!this.absorbDupe(e.def, e.shiny, e.lvl)) {
          const cl = this.catchLvl(e.lvl); // it keeps its level — up to the team's pace
          this.boxAdd(e.shiny ? { ...e.def, shiny: true, lvl: cl } : { ...e.def, lvl: cl }, 1, false); // the KO spot already runs the ritual
        }
        // record at capture time — a mid-run tab close keeps the dex honest
        if (recordCapture([e.def.id])) taskTick({ dex: 1 });
        this.log(`${e.shiny ? '★ SHINY ' : ''}${e.def.name.toUpperCase()} CAUGHT`);
        if (INVADERS.some((i) => i.id === e.def.id)) this.award('myth');
        if (e.boss) this.caughtBoss = true;
        if (e.shiny) {
          recordShiny(e.def.id);
          this.award('shiny');
          this.shiniesCaught++;
          this.score += 250;
        }
        // the ball breaks a soul-link — the partner fights on alone
        if (e.link) {
          e.link.link = undefined;
          e.link = undefined;
        }
      }
      // skull mark: the bounty pops on the KO — team heal + score
      if (e.skull) {
        this.score += 150;
        if (!this.healBlocked())
          for (const p of this.players) if (!p.dead) p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.12));
        this.pushText({ x: e.x, y: e.y - e.r - 72, text: 'SKULL BONUS!', t: 1.2, color: '#c8ff70', big: true });
        this.burst(e.x, e.y, '#c8ff70', 12, 320, 1);
        sfx('heal');
      }
      // VOLATILE mod: the KO detonates — a chunk of its max hp splashes
      // onto every neighbor, and volatile kills can chain
      // a dead thief coughs up the loot — KO it to take your berry back
      if (e.stolen) this.pickups.push({ x: e.x, y: e.y, kind: e.stolen, t: 0, age: 0 });
      // species drop table: the carrier's held item lands where it fell
      const drop = SPECIES_DROPS[e.def.id];
      if (drop && this.bulletRng() < drop.rate) {
        this.pickups.push({ x: e.x, y: e.y, kind: drop.kind, t: 0, age: 0 });
        this.pushText({ x: e.x, y: e.y - e.r - 40, text: 'ITEM DROP', t: 0.9, color: PICKUP_META[drop.kind].color, big: false });
      }
      this.heartDrop(e);
      if (e.volatile && !this.players.some((p) => !p.dead && p.def.damp)) {
        const BR = 110;
        this.waves.push({ x: e.x, y: e.y, r: 0, maxR: BR, t: 0.3, life: 0.3, color: '#ff9a30', hits: new Set() });
        this.burst(e.x, e.y, '#ff9a30', 18, 520, 1.2);
        this.addShake(5);
        sfx('boom');
        for (const o of this.enemies) {
          if (!o.dead && o !== e && dist(e, o) < o.r + BR) {
            this.hurt(o, Math.max(1, Math.round(e.maxHp * 0.14)), '#ff9a30');
          }
        }
      }
      this.addShake(e.boss ? 14 : 5);
      if (this.enemies.every((x) => x.dead)) this.waveCleared();
    }
  }

  // MS battle entry: the court scrolls in empty, then the foes fall onto it.
  // 0 = still hidden, 0..1 = falling, 1 = on the court
  private foeDrop() {
    return Math.min(1, Math.max(0, (this.time - this.courtT - COURT_SCROLL) / FOE_DROP));
  }

  private landFoes() {
    this.foesLanded = true;
    for (const e of this.enemies) {
      if (e.dead) continue;
      this.burst(e.x, e.y + e.r * 0.6, '#8890b8', e.boss ? 14 : 6, e.boss ? 320 : 220, 0.7);
      if (e.boss) this.waves.push({ x: e.x, y: e.y, r: 0, maxR: e.r * 2.6, t: 0.3, life: 0.3, color: '#ff8a8a', hits: new Set() });
    }
    this.addShake(this.enemies.some((e) => e.boss) ? 12 : 6);
    sfx('boom');
  }

  private weakFace(e: Unit, x: number, y: number): number | null {
    if (e.dead || (!e.boss && e.def.shielded)) return null;
    const a = Math.atan2(y - e.y, x - e.x);
    for (const face of e.weakA2 === undefined ? [e.weakA] : [e.weakA, e.weakA2]) {
      let dd = Math.abs(a - face) % (Math.PI * 2);
      if (dd > Math.PI) dd = Math.PI * 2 - dd;
      if (dd < (e.boss ? 0.62 : 0.45)) return face;
    }
    return null;
  }

  private weakHit(e: Unit, x: number, y: number): boolean {
    return this.weakFace(e, x, y) !== null;
  }

  // hidden weak point: first contact pops it into view, no banner
  private revealWeak(e: Unit) {
    e.wpHidden = false;
    e.wpPopT = this.time;
    animRing(recipeFor('psychic'), e.x + Math.cos(e.weakA) * e.r * 0.92, e.y + Math.sin(e.weakA) * e.r * 0.92, 24);
    sfx('tick', WEAK_SFX_PITCH);
  }

  private strikeEnemy(shooter: Unit, e: Unit) {
    const last = e.lastHit.get(shooter.uid) ?? -1;
    if (this.time - last < HIT_COOLDOWN) return;
    e.lastHit.set(shooter.uid, this.time);
    if (e.wpHidden) this.revealWeak(e);
    // impact ring in the attacker's type color — every contact pops
    // dual-typed strikers lead with whichever type hits this target harder;
    // forecast wears the sky — a castform's strike is whatever the weather is
    const at = shooter.def.forecast && this.weather ? WEATHER_OF[this.weather][0] : strikeType(shooter.def, e.def);
    this.waves.push({ x: e.x, y: e.y, r: 0, maxR: e.r * 1.7, t: 0.2, life: 0.2, color: TYPE_COLOR[at] ?? '#ffffff', hits: new Set() });
    const rico = this.ricochet(e.uid);
    // taunt toll-booth: while a magnet mon lives, contact damage routes
    // through it — pierce still passes, it just can't hurt anything else.
    // The scan caches: death or a roster change (summon, cull) rescans it
    let taunter = this.tauntFoe;
    if (this.tauntRef !== this.enemies || this.tauntLen !== this.enemies.length || (taunter && taunter.dead)) {
      this.tauntRef = this.enemies;
      this.tauntLen = this.enemies.length;
      taunter = this.tauntFoe = this.enemies.find((x) => !x.dead && x.def.taunt) ?? null;
    }
    if (taunter && e !== taunter) {
      // quiet in the early stages — the shrug-off needs no footnote yet
      if (this.waveIndex >= 2) this.pushText({ x: e.x, y: e.y - e.r - 8, text: 'BLOCKED', t: 0.7, color: '#8a90a8', big: false });
      return;
    }
    // engine cap: repeat hits on the same target decay — variety chains
    const hitN = this.shotHitN.get(e.uid) ?? 0;
    this.shotHitN.set(e.uid, hitN + 1);
    if (rico && !this.inStatic(shooter.x, shooter.y)) this.onRicochet(e.x, e.y);
    const mult = typeMult(at, e.def) * weatherMult(this.sky, at);
    // read the marked face before damage — every foe has one, except shells
    const weakFace = this.weakFace(e, shooter.x, shooter.y);
    const weak = weakFace !== null;
    // shelled foes face their shell into the fight: hits arriving on it
    // glance to 30%, hits landing behind it pay the flank
    let guarded = false;
    let flanked = false;
    if (e.def.shielded) {
      const a = Math.atan2(shooter.y - e.y, shooter.x - e.x);
      let dd = Math.abs(a - e.shieldA) % (Math.PI * 2);
      if (dd > Math.PI) dd = Math.PI * 2 - dd;
      guarded = dd < 0.85;
      flanked = dd > 2.4;
    }
    // momentum pays: impact speed is a damage input, so a max-pull launch
    // or a whip-around-a-well hits harder than a dribble. Capped +40% —
    // physics skill converts to power, not double damage
    const spd = Math.hypot(shooter.vx, shooter.vy);
    const spdMul = 1 + Math.min(0.4, Math.max(0, spd - 450) / 3000);
    // a stat-walled striker shrugs the menace aura off — say so once
    if (statWall(shooter.def) && this.enemies.some((m) => !m.dead && m.def.menace)) abilityNotice(this, shooter, this.abilityText);
    // every link in the chain adds momentum: +10% contact damage per pass;
    // grip claw stacks its own ramp per wall bounce this shot
    const dmg = hitFloor(
      physDamage(shooter.def.stats.atk, e.def.stats.def, mult, CONTACT_POW) *
        // unaware: the carrier reads the mon, not the buffs — protein and
        // pow stacks wash off at its hide
        (e.def.unaware ? 1 : shooter.pow) * this.physMult * (e.def.unaware ? 1 : this.shotPhys) * spdMul * (1 + this.shotCombo * (0.1 + this.comboDmg + this.t('electric') * 0.04)) *
        (1 + this.wallRamp * shooter.wallN) *
        (this.typePow[at] ?? 1) *
        this.shotStreak *
        (this.shotGold ? 1.2 : 1) *
        (1 + this.shotVolleyBoost) *
        (rico ? 1 + this.ricoMult : 1) *
        (shooter.burnT > 0 && !shooter.def.guts ? 0.7 : 1) * // a burned striker pulls its punches — guts burns it off
        (shooter.def.guts && (shooter.dotTicks > 0 || shooter.burnT > 0 || shooter.paraT > 0) ? 1.5 : 1) * // Guts: status feeds it
        (shooter.def.huge ? 2 : 1) * // Huge Power: canon attack doubling
        abilityAttack(this, shooter, e.def, this.abilityText) *
        // intimidate: a living menace cowes the whole team — kill it first.
        // stat walls (hyper cutter, clear body, white smoke) read off,
        // their attack can't be lowered
        (this.enemies.some((m) => !m.dead && m.def.menace) && !statWall(shooter.def) ? 0.8 : 1) *
        (weak ? (e.boss ? 3 : 2) : 1) *
        (guarded ? 0.3 : flanked ? 1.5 : 1) *
        // power zone: hits landed while the ball's inside the ATK field
        // carry the field's charge
        (this.inPower(shooter.x, shooter.y) ? 1.5 : 1) *
        (shooter.giant ? 2 : 1) *
        // multiscale: an untouched hide halves the hit — chip it open
        // first, then bring the finisher
        (e.def.scale && e.hp >= e.maxHp && !shooter.def.breaker ? 0.5 : 1) *
        Math.pow(0.9, hitN),
      mult,
    );
    if (weak) {
      this.stopWeak++;
      this.shotWeak++;
      this.waves.push({ x: e.x + Math.cos(weakFace) * e.r * 0.92, y: e.y + Math.sin(weakFace) * e.r * 0.92, r: 0, maxR: e.r * 1.5, t: 0.22, life: 0.22, color: '#fff3a0', hits: new Set() });
      if (e.boss) {
        if (!this.weakTelop(e)) this.pushText({ x: e.x, y: e.y - e.r - 44, text: 'WEAK POINT!', t: 1, color: '#ffd84d', big: true });
        this.hitStop = Math.max(this.hitStop, 0.16);
        this.impact(e.x, e.y, '#ffd84d', 1.7);
        this.addPunch(0.11);
        this.addShake(11);
        sfx('perfect', WEAK_SFX_PITCH);
      } else {
        if (!this.weakTelop(e)) this.pushText({ x: e.x, y: e.y - e.r - 44, text: 'WEAK POINT!', t: 1, color: '#ffd84d', big: false });
        this.hitStop = Math.max(this.hitStop, 0.1);
        this.impact(e.x, e.y, '#ffd84d', 1.3);
        this.addPunch(0.06);
        this.addShake(6);
        sfx('perfect', WEAK_SFX_PITCH);
      }
    }
    if (flanked) {
      this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'FLANKED!', t: 0.9, color: '#9df0ff', big: true });
      this.impact(e.x, e.y, '#9df0ff', 1.2);
      sfx('hit');
    } else if (guarded) {
      if (this.waveIndex >= 2) this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'GUARDED', t: 0.7, color: '#8a90a8', big: false });
      sfx('bounce');
    }
    const color = mult > 1 ? '#ffd84d' : mult < 1 ? '#8a90a8' : '#ffffff';
    // sand veil: in its own weather the carrier's a mirage — the strike
    // whiffs clean (the collider still bounces the ball off its body).
    // keen eye / compound eyes pierce the shroud; victory star spreads
    // the same sure aim to the whole line
    if (e.def.veil === this.weather && this.rng() < 0.25) {
      const mark = pierceShroud(shooter.def) ? shooter
        : this.players.find((p) => !p.dead && p.def.ability === 'victory-star');
      if (mark) abilityNotice(this, mark, this.abilityText);
      else {
        if (this.waveIndex >= 2) this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'MISS!', t: 0.7, color: '#c8b88a', big: false });
        sfx('bounce');
        return;
      }
    }
    // wonder guard shrugs off anything that isn't super-effective — the
    // shove still lands, so walls and lava stay on the table
    if (e.def.wguard && mult <= 1 && !shooter.def.breaker) {
      this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'NO EFFECT', t: 0.7, color: '#8a90a8', big: false });
      sfx('bounce');
    } else if (absorbType(e.def) === at) {
      this.hurt(e, -Math.round(e.maxHp * 0.25), color);
    } else {
      this.hitWeak = weak;
      this.hurt(e, dmg, color, mult > 1 ? '!' : '', shooter);
      this.hitWeak = false;
      // counter: whatever lands comes back a third as strong — feed it a
      // crit and it feeds you one. Chip it open with the small shots.
      // rock head recoil can't crack the skull — the payback glances
      if (e.def.counter && !e.dead && dmg > 0 && !shooter.dead) {
        if (rockSkull(shooter.def)) abilityNotice(this, shooter, this.abilityText);
        else {
          this.damagePlayer(shooter, Math.max(1, Math.round(dmg * 0.3)), e);
          this.pushText({ x: e.x, y: e.y - e.r - 46, text: 'COUNTER!', t: 0.9, color: '#f85888', big: false });
        }
      }
      // color change: the hide takes on whatever type just struck it —
      // repeat hits hit resisted hide, so alternate your strikers
      if (e.def.chameleon && !e.dead && e.def.type !== at) {
        e.def = { ...e.def, type: at };
        this.pushText({ x: e.x, y: e.y - e.r - 46, text: `BECAME ${at.toUpperCase()}!`, t: 0.9, color: TYPE_COLOR[at] ?? '#fff', big: false });
      }
    }
    // knockback: the ball's momentum shoves the foe along the shot's line —
    // bank a hit to push a raider off the loot, split a taunter from its
    // pack, or feed the whole crowd to the lava. Bosses stay planted.
    if (!e.dead && spd > 120) {
      const kb = Math.min(300, spd * 0.35) * (e.boss ? 0.25 : 1) * (e.def.anchor ? 0 : 1);
      const n = norm({ x: shooter.vx, y: shooter.vy });
      e.vx += n.x * kb;
      e.vy += n.y * kb;
    }
    // contact riders: the foe's hide tries to mark the striker. Ward
    // abilities (immunity, limber, water veil, own tempo, soundproof,
    // oblivious) shrug their matching ailment off; shield dust shrugs
    // every added effect; serene grace doubles the foe's odds
    const ward = (ok: boolean) => { if (!ok) abilityNotice(this, shooter, this.abilityText); return ok; };
    const dust = dustProof(shooter.def);
    // poison point: brushing the thorn hide can venom the striker —
    // kill it at range with banks, or budget the ticks into the trade
    if (e.def.toxic && !shooter.dead && ward(!poisonProof(shooter.def) && !dust) && this.rng() < 0.3 * graceOdds(e.def)) {
      shooter.dotTicks = Math.max(shooter.dotTicks, 4);
      shooter.dotDmg = Math.max(shooter.dotDmg, Math.ceil(shooter.maxHp * 0.06));
      this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'POISONED!', t: 0.9, color: '#a040a0', big: false });
    }
    // static: the crackling hide can discharge into the striker — the
    // next launch limps, so touch it once with a hard kill or not at all
    if (e.def.shock && !shooter.dead && shooter.paraT <= 0 && ward(!paraProof(shooter.def) && !dust) && this.rng() < 0.3 * graceOdds(e.def)) {
      shooter.paraT = 3;
      this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'STATIC!', t: 0.9, color: '#f8d030', big: false });
    }
    // flame body: the hide singes the striker — burned hits lose heat,
    // so a grazing route through it dulls the whole shot's trade
    if (e.def.flame && !shooter.dead && ward(!burnProof(shooter.def) && !dust) && this.rng() < 0.3 * graceOdds(e.def)) {
      shooter.burnT = Math.max(shooter.burnT, 4);
      this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'BURNED!', t: 0.9, color: '#f08030', big: false });
    }
    // supersonic: the shriek scrambles the next launch — the ghost wobbles
    // honestly, but tight banks get dicey for a round
    if (e.def.confuse && !shooter.dead && ward(!confuseProof(shooter.def) && !dust) && this.rng() < 0.3 * graceOdds(e.def)) {
      shooter.confuseT = 1;
      this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'CONFUSED!', t: 0.9, color: '#c8a8f8', big: false });
    }
    // cute charm: the smitten striker nods off — a grazed shot can cost
    // the team its next launch, so finish the charm carrier from range
    if (e.def.charm && !shooter.dead && !shooter.asleep && ward(!charmProof(shooter.def) && !dust) && this.rng() < 0.3 * graceOdds(e.def)) {
      shooter.asleep = true;
      this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'SMITTEN!', t: 0.9, color: '#f8b8d0', big: false });
    }
    // effect spore: the puff scatters whatever it carried — venom, a
    // jolt, or a lullaby. You never know which spore you breathed
    if (e.def.spore && !shooter.dead && ward(!dust) && this.rng() < 0.3 * graceOdds(e.def)) {
      const sporeRoll = this.rng();
      if (sporeRoll < 0.4 && !poisonProof(shooter.def)) {
        shooter.dotTicks = Math.max(shooter.dotTicks, 4);
        shooter.dotDmg = Math.max(shooter.dotDmg, Math.ceil(shooter.maxHp * 0.06));
      } else if (sporeRoll >= 0.4 && sporeRoll < 0.7 && !paraProof(shooter.def)) {
        shooter.paraT = Math.max(shooter.paraT, 3);
      } else if (sporeRoll >= 0.7 && !sleepProof(shooter.def)) {
        shooter.asleep = true;
      }
      this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'SPORED!', t: 0.9, color: '#a8b820', big: false });
    }
    // synchronize: whatever ails it, ails you — a dotted or singed
    // carrier returns the status to anyone who touches it
    if (e.def.sync && !shooter.dead && !dust) {
      let synced = false;
      if (e.dotTicks > 0 && !poisonProof(shooter.def)) { shooter.dotTicks = Math.max(shooter.dotTicks, e.dotTicks); shooter.dotDmg = Math.max(shooter.dotDmg, e.dotDmg); synced = true; }
      if (e.burnT > 0 && !burnProof(shooter.def)) { shooter.burnT = Math.max(shooter.burnT, e.burnT); synced = true; }
      if (e.paraT > 0 && !paraProof(shooter.def)) { shooter.paraT = Math.max(shooter.paraT, e.paraT); synced = true; }
      if (synced) this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'SYNCED!', t: 0.9, color: '#f85888', big: false });
    }
    // barbed foes bite back — spiky, rough skin and iron barbs all cost
    // the ball a chip of its own HP. Rock head takes the chips for free
    if (barbHide(e.def) && !shooter.dead) {
      if (rockSkull(shooter.def)) abilityNotice(this, shooter, this.abilityText);
      else {
        this.damagePlayer(shooter, Math.max(1, Math.round(shooter.maxHp * 0.06)), e);
        this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'SPIKED!', t: 0.7, color: '#f85888', big: false });
      }
    }
    // HEXED FIELD mutator: contacts envenom — the same doT poison supers
    // stack. An immune hide shrugs the hex off clean
    if (this.curMod === 'hexed' && !e.dead && !poisonProof(e.def)) {
      e.dotTicks = Math.min(e.dotTicks + 2, 6);
      e.dotDmg = Math.max(e.dotDmg, Math.ceil(e.maxHp * 0.08));
    }
    // contact sparks in the attacker's type color — every hit showers
    if (!e.dead || !weak) this.impact(e.x, e.y, TYPE_COLOR[at] ?? '#ffffff', (weak ? 1.3 : mult > 1 ? 1.1 : 0.8) * Math.min(1.5, 0.7 + spd / 1800));
    // gacha hit-stop: a frame of slowdown on EVERY hit, heavier on SE —
    // combos feel like chains of little freezes, not a smear
    this.hitStop = Math.max(this.hitStop, mult > 1 ? 0.055 : 0.03);
    this.addPunch(mult > 1 ? 0.04 : 0.015);
    this.addShake(mult > 1 ? 8 : 3.5);
    sfx('hit', comboPitch(this.shotHits++, this.shotCombo));
    buzz(8);
    if (shooter.wallN >= 2)
      this.pushText({ x: e.x, y: e.y - e.r - 58, text: `BANKED ×${shooter.wallN}!`, t: 0.9, color: '#9df0ff', big: false });
    if (mult >= 4)
      this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'ULTRA EFFECTIVE!', t: 1, color: '#ffd84d', big: true });
    else if (mult > 1)
      this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'SUPER EFFECTIVE!', t: 0.8, color: '#ffd84d', big: false });
  }

  // Passive talent — a small effect on EVERY pass-through, on or off
  // cooldown. This is what makes each role feel different link to link.
  private allyPassive(
    p: Unit,
    near: (radius: number) => Unit[],
    bumpDmg: (e: Unit, power: number) => number,
  ) {
    switch (p.role) {
      case 'SCOUT': { // lightning-fast jab at the closest enemy
        const t = near(140).sort((a, b) => dist(p, a) - dist(p, b))[0];
        if (t) {
          this.hurt(t, bumpDmg(t, 0.3), '#9df0ff');
        }
        break;
      }
      case 'STRIKER': { // point-blank shockwave
        const ts = near(95);
        if (ts.length) {
          for (const e of ts) this.hurt(e, bumpDmg(e, 0.25), '#9df0ff');
        }
        break;
      }
      case 'SNIPER': { // long-range poke at the far target
        const t = near(280).sort((a, b) => dist(p, b) - dist(p, a))[0];
        if (t) {
          this.hurt(t, bumpDmg(t, 0.35), '#9df0ff');
        }
        break;
      }
      case 'BULWARK': // brace: small self-mend on every pass
      case 'WARDEN':
      case 'GUARDIAN':
        this.tryHeal([p], (x) => Math.ceil(x.maxHp * 0.03));
        break;
      default: { // wild: opportunistic nip at the closest enemy
        const t = near(120).sort((a, b) => dist(p, a) - dist(p, b))[0];
        if (t) this.hurt(t, bumpDmg(t, 0.25), '#9df0ff');
      }
    }
  }

  // Iconic signature nukes: a curated set of canon moves get bespoke FX
  // instead of the generic type super — the gacha-game money shots.
  // Returns true when one fired. `src` is the move owner (copy replays it),
  // `p` is the bumped ally the blast emanates from. The ~30-case table
  // lives in supers/signatures.ts — METRONOME re-enters it by name.
  private signatureMove(
    src: Unit,
    p: Unit,
    bumpDmg: (e: Unit, power: number) => number,
  ): boolean {
    const name = moveOf(src.def.id, src.def.type);
    const fired = castNamedSuper(this.superFx, name, src, p, bumpDmg);
    if (fired) { // the scrim + type rake every named ult wears for its first beat
      this.cutin.t = this.cutin.life;
      this.cutin.color = TYPE_COLOR[src.def.type];
    }
    return fired;
  }

  // Bump an ally mid-shot: every pass is a combo link; the signature
  // super fires only when recharged (cd counts down per shot).
  private bumpAlly(p: Unit, u: Unit) {
    if (this.time - p.lastBump < 0.3) return; // once per pass, not per frame
    p.lastBump = this.time;
    p.sq = 1; // the bumped ally pops — the pass reads as a bump, not a phase
    // the friendly flare — every pass rings the ally in its own type color
    impactRing(this.fx, this.fxRng, p.x, p.y, TYPE_RAMP[p.def.type], { radius: p.r * 2, width: 3, life: 0.26, motes: 3 });
    const silenced = this.inStatic(u.x, u.y);
    if (this.ricochet(p.uid) && !silenced) this.onRicochet(p.x, p.y);
    // VOLLEY: the bump itself is the resource — static fields silence it
    if (!silenced) {
      this.volleys++;
      this.shotVolleyBoost += this.volleyBoost;
      if (this.volleyNth > 0 && this.volleys % this.volleyNth === 0) {
        for (const pl of this.players) this.chargeUp(pl);
        this.pushText({ x: u.x, y: u.y - u.r - 30, text: 'VOLLEY!', t: 1, color: '#f8d030', big: true });
        sfx('ready');
      }
    }
    // just-frame bump: an early pass pays an extra combo tick
    if (this.time - this.shotT < JUST_WIN) {
      this.shotCombo++;
      this.pushText({ x: p.x, y: p.y - p.r - 56, text: 'JUST!', t: 0.9, color: '#ffd84d', big: true });
    }
    this.shotCombo++;
    this.telop.combo(this.shotCombo, this.active.def.id);
    if (this.shotCombo > this.maxCombo) {
      this.maxCombo = this.shotCombo;
      this.taskPing('combo', this.maxCombo, p.x, p.y - p.r - 90); // a new peak pings live — taskTick only banks at run end
    }
    this.stopCombo = Math.max(this.stopCombo, this.shotCombo);
    if (this.maxCombo >= 8) this.award('pinball');
    // the bump feeds the launch: a momentum kick so every teammate passed
    // through literally speeds the ball up (damage ramps in strikeEnemy)
    u.vx *= 1.12;
    u.vy *= 1.12;
    const n = this.shotCombo;
    const c = TYPE_COLOR[p.def.type];
    // combo counter pops over the ally — every pass reads as a hit
    this.pushText({
      x: p.x,
      y: p.y - p.r - 26 - Math.min(n, 6) * 5,
      text: `×${n}`,
      t: 0.9,
      color: n >= 2 ? COMBO_COLORS[n % COMBO_COLORS.length] : c,
      big: n >= 4,
    });
    if (n >= 2) {
      this.hitStop = Math.min(0.07 * n, 0.42);
      this.addShake(3 * n);
      this.addPunch(Math.min(0.02 * n, 0.12));
      this.screenFlash(c, 0.07);
    }
    const near = (radius: number) =>
      this.enemies.filter((e) => !e.dead && dist(p, e) <= radius * p.rngMul + e.r);
    const nearest = (from: Unit, radius: number) =>
      this.enemies
        .filter((e) => !e.dead && dist(from, e) <= radius * p.rngMul + e.r)
        .sort((a, b) => dist(from, a) - dist(from, b))[0];
    // copy (Ditto): the bumped ally replays the shooter's super — the
    // shooter's stats and typing, fired from the copier's position
    const src = p.def.copy ? u : p;
    const phys = bumpIsPhysical(src.def.type);
    const eff = (e: Unit) => typeMult(src.def.type, e.def) * weatherMult(this.sky, src.def.type);
    // Physical bump attacks roll Attack vs Defense; elemental ones SpA vs SpD.
    const bumpDmg = (e: Unit, power: number) =>
      e.def.absorb === src.def.type ? -Math.round(e.maxHp * 0.25)
      : Math.round(
        (phys
          ? physDamage(src.def.stats.atk, e.def.stats.def, eff(e), power) * this.physMult
          : specDamage(src.def.stats.spa, e.def.stats.spd, eff(e), power) * this.specMult) *
          (this.typePow[src.def.type] ?? 1) *
          p.pow *
          SUPER_POW *
          this.labSpcMult * // lab CALCIUM — a straight super amp
          (1 + (n - 1) * this.comboDmg), // metronome ramps with combo length
      );
    // passive talent: a small role effect on EVERY pass, on or off cooldown
    this.allyPassive(p, near, bumpDmg);
    if (silenced) {
      // the field ate the super — say so or it reads as the shot failing
      this.pushText({ x: p.x, y: p.y - p.r - 46, text: 'SILENCED', t: 0.8, color: '#b090ff', big: false });
      return;
    }
    if (p.cd > 0) {
      // super still recharging — name the wait once per ally per shot
      if (!this.bumpNoted.has(p.uid)) {
        this.bumpNoted.add(p.uid);
        this.pushText({ x: p.x, y: p.y - p.r - 46, text: `${Math.ceil(p.cd)} TO GO`, t: 0.7, color: '#8890b8', big: false });
      }
      return;
    }
    // a copy pays the copied move's cooldown, not its own
    p.cd = Math.max(1, Math.round(bumpCooldown(src.def.type) * this.cdMult) - p.cdMod);
    p.cdMax = p.cd;
    this.bumpsThisShot.add(p.uid);
    // move callout and freeze-frame on the cast
    this.pushText({
      x: p.x, y: p.y - p.r - 46,
      text: `${p.def.name.toUpperCase()} used ${moveOf(src.def.id, src.def.type)}!`,
      t: 1.05, color: TYPE_COLOR[src.def.type], big: true,
    });
    this.hitStop = Math.max(this.hitStop, 0.26);
    const color = TYPE_COLOR[src.def.type];
    animBurst(recipeFor(src.def.type, moveOf(src.def.id, src.def.type)), p.x, p.y, false);
    this.impact(p.x, p.y, color, 1.6);
    this.burst(p.x, p.y, color, 22, 540);
    this.flavor(p.x, p.y, src.def.type);
    this.addPunch(0.11);
    this.addShake(10);
    this.screenFlash(color, 0.18);
    sfx(SUPER_SFX[src.def.type], superPitch(src.def.type));
    buzz(20);

    // the per-type super lives in supers/ — one file per type behind the
    // SuperCtx seam; near/nearest carry this ally's role range multiplier
    if (!this.signatureMove(src, p, bumpDmg))
      castTypeSuper(this.superFx, src, p, bumpDmg, near, nearest);
    // medic role: every super also mends the team
    if (p.role === 'MEDIC') {
      this.tryHeal(this.players, (pl) => Math.max(1, Math.round(pl.maxHp * 0.15)));
    }
    cull(this.enemies, (e) => !e.dead);
    if (this.enemies.length === 0 && this.phase !== 'won') this.waveCleared();

    // TEAM COMBO: every living ally fired its super in this one shot
    const firedAll =
      this.bumpsThisShot.size === this.players.filter((x) => !x.dead).length &&
      this.bumpsThisShot.size >= 3;
    if (firedAll) {
      this.hitStop = 0.45;
      this.screenFlash('#ffd84d', 0.38);
      this.impact(p.x, p.y, '#ffd84d', 2.4);
      this.burst(p.x, p.y, '#ffd84d', 32, 640, 1.4);
      this.addPunch(0.18);
      this.addShake(14);
      this.pushText({ x: p.x, y: p.y - p.r - 40, text: 'TEAM CHAIN!', t: 1.2, color: '#ffd84d', big: true });
    }
  }

  // The run's ultimate: after ULT_SHOTS launches the charge is armed — tap
  // any teammate and ITS signature detonates across the whole court, one
  // staggered beam per enemy. Z-move energy: a flash, then everything pays.
  private fireUlt(u: Unit) {
    cry(u.def.id, 'ult');
    const anim = recipeFor(u.def.type, moveOf(u.def.id, u.def.type));
    animBurst(anim, u.x, u.y, true);
    this.ultIn = ULT_SHOTS;
    this.ultFill = 0;
    this.ultHint = false;
    this.missions.ult();
    const color = TYPE_COLOR[u.def.type];
    this.pushText({
      x: u.x, y: u.y - u.r - 48,
      text: `ULTIMATE ${moveOf(u.def.id, u.def.type)}!`,
      t: 1.5, color, big: true,
    });
    this.hitStop = Math.max(this.hitStop, 0.55);
    this.screenFlash('#ffffff', 0.3);
    this.screenFlash(color, 0.28);
    this.ultFx = { text: moveOf(u.def.id, u.def.type), color, t: 1.15, life: 1.15 };
    this.impact(u.x, u.y, color, 2.4);
    this.burst(u.x, u.y, color, 34, 720, 1.5);
    // the eruption ring sweeps the court — pure spectacle, beams do the work
    this.waves.push({ x: u.x, y: u.y, r: 0, maxR: Math.max(this.arena.w, this.arena.h), t: 0.6, life: 0.6, color, hits: new Set() });
    this.addPunch(0.2);
    this.addShake(16);
    this.flavor(u.x, u.y, u.def.type);
    sfx(SUPER_SFX[u.def.type], superPitch(u.def.type));
    buzz([50, 40, 90]);
    const phys = bumpIsPhysical(u.def.type);
    const multOf = (e: Unit) => typeMult(u.def.type, e.def) * weatherMult(this.sky, u.def.type);
    const dmgOf = (e: Unit, power = 1) =>
      // wonder guard: only super-effective damage lands — supers included
      e.def.wguard && multOf(e) <= 1 && !u.def.breaker
        ? 0
        : e.def.absorb === u.def.type
          ? -Math.round(e.maxHp * 0.25)
          : Math.round(
            (phys
              ? physDamage(u.def.stats.atk, e.def.stats.def, multOf(e))
              : specDamage(u.def.stats.spa, e.def.stats.spd, multOf(e))) *
              u.pow * SUPER_POW * 4.5 * power * (e.boss ? 0.55 : 1) * (e.def.scale && e.hp >= e.maxHp && !u.def.breaker ? 0.5 : 1),
          );
    const targets = this.enemies.filter((e) => !e.dead);
    const a = this.arena;
    switch (u.def.type) {
      case 'fire': {
        // FLARE RAIN — a fireball streaks down onto each foe's head, craters
        // the court, and leaves a short burn ticking
        targets.forEach((e, i) => {
          this.orbs.push({ x: e.x + (i % 2 ? 30 : -30), y: a.y - 40, target: e, dmg: dmgOf(e), t: 3, wob: i * 1.9, color });
          this.flavor(e.x, e.y, 'fire'); // embers rise off each marked foe
          this.later(0.2 + i * 0.09, () => {
            if (e.dead) return;
            animRain(anim, e.x, e.y);
            this.scar(e.x, e.y, 22);
            e.dotTicks = Math.min(e.dotTicks + 2, 6);
            e.dotDmg = Math.max(e.dotDmg, Math.ceil(e.maxHp * 0.05));
          });
        });
        break;
      }
      case 'water': {
        // TIDAL WAVE — the front sweeps in off the left wall and shoves every
        // foe into a pile on the right; the next shot cashes the pileup
        animRing(anim, u.x, u.y, a.w * 0.6);
        this.waves.push({
          x: a.x - 30, y: a.y + a.h / 2, r: 0, maxR: a.w + 160, t: 0.7, life: 0.7,
          color, hits: new Set(),
          onHit: (e) => {
            e.vx += 560;
            e.vy += (a.y + a.h / 2 - e.y) * 1.2;
            this.hurt(e, dmgOf(e, 0.7), color);
          },
        });
        this.addShake(10);
        break;
      }
      case 'grass': {
        // FRENZY PLANT — the floor erupts under every foe: a fat vine
        // column, leaf spray and a crater, rooting their countdown while a
        // third of the damage drains back to the team
        let dealt = 0;
        targets.forEach((e, i) => {
          this.later(0.08 + i * 0.08, () => {
            if (e.dead) return;
            animBeam(anim, u.x, u.y, e.x, e.y);
            this.beams.push({ x1: e.x, y1: e.y - e.r - 10, x2: e.x, y2: Math.min(e.y + e.r + 30, a.y + a.h - 4), t: 0.45, life: 0.45, color, w: 7 });
            this.impact(e.x, e.y, color, 1.6);
            this.flavor(e.x, e.y, 'grass');
            this.scar(e.x, Math.min(e.y + e.r + 22, a.y + a.h - 6), 15);
            this.addShake(6);
            e.timer += 1.5;
            const d = dmgOf(e, 0.7);
            dealt += d;
            this.hurt(e, d, color);
          });
        });
        this.later(0.12 + targets.length * 0.08, () => {
          if (dealt > 0) this.tryHeal(this.players, () => Math.max(Math.round(dealt * 0.35), 4));
        });
        break;
      }
      case 'electric': {
        // VOLT SURGE — the bolt hops foe to foe, nearest first, each arc
        // weaker than the last
        const chain = [...targets].sort((x, y) => dist(u, x) - dist(u, y));
        let from: Vec = u;
        let pw = 1;
        chain.forEach((e, i) => {
          const a0 = from;
          const p = pw;
          from = e;
          pw = Math.max(pw * 0.8, 0.4); // the far end of a pack still eats a real hit
          this.later(0.08 + i * 0.1, () => {
            if (e.dead) return;
            animBeam(anim, u.x, u.y, e.x, e.y);
            this.beams.push({ x1: a0.x, y1: a0.y, x2: e.x, y2: e.y, t: 0.3, life: 0.3, color, w: 3 });
            this.impact(e.x, e.y, color, 1.9);
            this.flavor(e.x, e.y, 'electric');
            this.screenFlash('#f8d030', 0.08);
            this.hurt(e, dmgOf(e, p), color);
            this.hitStop = Math.max(this.hitStop, 0.06);
            this.addShake(6);
            sfx('zap');
          });
        });
        // the discharge — one thunderclap ring after the last hop lands
        this.later(0.14 + chain.length * 0.1, () => {
          this.waves.push({ x: u.x, y: u.y, r: 0, maxR: Math.max(a.w, a.h), t: 0.4, life: 0.4, color, hits: new Set() });
          this.screenFlash('#ffffff', 0.2);
          this.addPunch(0.1);
        });
        break;
      }
      case 'psychic': {
        // MIND GRIP — five pulses drag every foe to the court's centre, then
        // the implosion pays out; the pile is a gift to the next ricochet
        const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
        for (let k = 0; k < 5; k++) {
          this.later(k * 0.11, () => {
            for (const e of this.enemies) {
              if (e.dead) continue;
              e.vx += (cx - e.x) * 1.1;
              e.vy += (cy - e.y) * 1.1;
            }
            this.waves.push({ x: cx, y: cy, r: 0, maxR: 150 + k * 60, t: 0.3, life: 0.3, color, hits: new Set() });
            this.flavor(cx, cy, 'psychic');
          });
        }
        this.later(0.62, () => {
          for (const e of targets) if (!e.dead) animBeam(anim, u.x, u.y, e.x, e.y);
          this.impact(cx, cy, color, 3);
          this.burst(cx, cy, color, 26, 620, 1.4);
          this.screenFlash(color, 0.22);
          this.addPunch(0.12);
          this.addShake(14);
          for (const e of this.enemies.slice()) if (!e.dead) this.hurt(e, dmgOf(e, 0.75), color); // snapshot — hurt can summon adds
        });
        break;
      }
      case 'rock': {
        // ROCK SLIDE — boulders tear out of the sky, one per foe; the orb
        // carries the hit, the court keeps the crater and the rubble. The
        // landslide hits harder than fire's rain and every survivor eats a
        // flinch — their countdown stalls while they dig out.
        targets.forEach((e, i) => {
          this.orbs.push({ x: e.x + (i % 2 ? 26 : -26), y: a.y - 40, target: e, dmg: dmgOf(e, 1.1), t: 3, wob: i * 1.3, color });
          this.later(0.55 + i * 0.1, () => {
            animRain(anim, e.x, e.y);
            this.scar(e.x, e.y, 26);
            this.screenFlash(color, 0.12);
            this.flavor(e.x, e.y, 'rock');
            this.addShake(11);
            if (!e.dead) e.timer += 1; // flinched — a beat behind schedule
          });
        });
        break;
      }
      case 'poison': {
        // VENOM BURST — a toxic front sweeps the court, then the miasma
        // slams back; every survivor keeps paying the DoT off
        this.screenFlash(color, 0.18);
        const venom = (delay: number, pw: number) =>
          this.later(delay, () =>
            this.waves.push({
              x: u.x, y: u.y, r: 0, maxR: Math.max(a.w, a.h), t: 0.55, life: 0.55,
              color, hits: new Set(),
              onHit: (e) => {
                this.hurt(e, dmgOf(e, pw), color);
                this.burst(e.x, e.y, color, 12, 380, 1.2);
                e.dotTicks = Math.min(e.dotTicks + 3, 6);
                e.dotDmg = Math.max(e.dotDmg, Math.ceil(e.maxHp * 0.08));
              },
            }),
          );
        venom(0, 0.5);
        venom(0.3, 0.35);
        for (const e of targets) this.flavor(e.x, e.y, 'poison');
        for (const e of targets) animBeam(anim, u.x, u.y, e.x, e.y);
        break;
      }
      case 'flying': {
        // SKY DIVE — the comet sweeps a full orbit of the court: a gale
        // front rings the arena, then clips each foe in angular order and
        // knocks them a step toward the middle
        const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
        this.waves.push({ x: cx, y: cy, r: 0, maxR: Math.max(a.w, a.h), t: 0.6, life: 0.6, color, hits: new Set() });
        [...targets]
          .sort((x, y) => Math.atan2(x.y - u.y, x.x - u.x) - Math.atan2(y.y - u.y, y.x - u.x))
          .forEach((e, i) => {
            this.later(0.08 + i * 0.11, () => {
              if (e.dead) return;
              animBeam(anim, u.x, u.y, e.x, e.y);
              this.beams.push({ x1: u.x, y1: u.y, x2: e.x, y2: e.y, t: 0.26, life: 0.26, color, w: 5 });
              this.impact(e.x, e.y, '#e8f6ff', 1.6);
              this.flavor(e.x, e.y, 'flying');
              e.vx += (cx - e.x) * 0.6;
              e.vy += (cy - e.y) * 0.6;
              this.hurt(e, dmgOf(e, 0.8), color);
              this.addShake(6);
            });
          });
        break;
      }
      case 'fighting': {
        // FINAL RUSH — real dashes, foe to foe, finishing on the bulkhead
        const order = [...targets].sort((x, y) => dist(u, x) - dist(u, y));
        order.forEach((e, i) => {
          this.later(0.1 + i * 0.3, () => {
            if (e.dead) return;
            animBeam(anim, u.x, u.y, e.x, e.y);
            const last = i === order.length - 1;
            this.dashes.push({ u, e, done: false, dmg: dmgOf(e, last ? 1.9 : 0.7) });
            if (last) this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'FINISHER!', t: 1, color: '#f08030', big: true });
          });
        });
        break;
      }
      case 'ghost': {
        // OMINOUS WIND — wisps converge on every foe; above half HP they
        // pay extra — a culler's ult, best early in the wave
        this.screenFlash('#201830', 0.3);
        targets.forEach((e, i) => {
          // two wisps per foe — the pack closing in is the scare
          animBeam(anim, u.x, u.y, e.x, e.y);
          this.orbs.push({ x: u.x, y: u.y, target: e, dmg: dmgOf(e, e.hp > e.maxHp * 0.5 ? 1.4 : 0.7), t: 3, wob: i * 2.6 + 1.3, color });
          this.orbs.push({ x: u.x, y: u.y, target: e, dmg: Math.max(1, Math.round(dmgOf(e, 0.3))), t: 3, wob: i * 2.6 + 2.9, color: '#705898' });
          this.flavor(e.x, e.y, 'ghost');
        });
        break;
      }
      case 'normal': {
        // GIGA ROMP — giant mode: the mon swells until its next launch, when
        // the bigger hitbox and ×2 contact do the squashing themselves.
        // re-ulting an already-giant mon must not compound the swell
        if (!u.giant) {
          u.r *= 1.7;
          u.giant = true;
        }
        this.pushText({ x: u.x, y: u.y - u.r - 20, text: 'GIANT MODE!', t: 1.2, color: '#ffd84d', big: true });
        // the swell itself is the spectacle — stomp ring + speed lines
        this.waves.push({ x: u.x, y: u.y, r: 0, maxR: Math.max(a.w, a.h) * 0.7, t: 0.45, life: 0.45, color: '#ffd84d', hits: new Set() });
        this.flavor(u.x, u.y, 'normal');
        this.addPunch(0.15);
        this.addShake(14);
        // the landing quake — GIGA ROMP always does something, even if the
        // follow-up launch whiffs: every foe eats the stomp and staggers
        this.later(0.35, () => {
          for (const e of targets) if (!e.dead) animBeam(anim, u.x, u.y, e.x, e.y);
          this.addShake(18);
          this.addPunch(0.15);
          for (const e of this.enemies.slice()) { // hurt can summon adds — don't hit them in this pass
            if (e.dead) continue;
            const d = Math.atan2(e.y - u.y, e.x - u.x);
            e.vx += Math.cos(d) * 160;
            e.vy += Math.sin(d) * 160;
            this.hurt(e, dmgOf(e, 0.35), color);
          }
        });
        break;
      }
      default: {
        // beam fan — the classic: one staggered beam per foe
        targets.forEach((e, i) => {
          this.later(0.1 + i * 0.09, () => {
            if (e.dead) return;
            animBeam(anim, u.x, u.y, e.x, e.y);
            this.beams.push({ x1: u.x, y1: u.y, x2: e.x, y2: e.y, t: 0.34, life: 0.34, color, w: 2 });
            this.impact(e.x, e.y, color, 1.9);
            this.screenFlash(color, 0.06);
            this.hurt(e, dmgOf(e), color, multOf(e) > 1 ? '!' : '');
            this.addShake(7);
            this.hitStop = Math.max(this.hitStop, 0.06);
          });
        });
      }
    }
    this.award('ult');
    // hurt() marks kills but doesn't chain the wave check — close it out
    // after the last beam lands
    this.later(0.15 + targets.length * 0.09, () => {
      cull(this.enemies, (e) => !e.dead);
      if (!this.enemies.length && this.phase !== 'won' && this.phase === 'aim') this.waveCleared();
    });
  }

  private waveCleared() {
    // a wave's clear registers once — the aim failsafe and the kill paths
    // both reach here while the reward's still pending; ceremony and
    // gymsBeaten must never replay
    if (this.rewardPending || this.phase === 'won' || this.phase === 'lost') return;
    if (this.battle < this.battles) {
      // mid-stop: no ceremony, the next battle scrolls in. Inside a shot it
      // waits for endShot, like a boss bar break
      if (this.phase === 'aim') this.nextBattle();
      else this.battleBreak = true;
      return;
    }
    if (this.coach) {
      this.coachDone = true; // survived a wave — teaching's over
      // first-win milestone: one instant payout anchors the loop
      if (best().runs === 0) {
        const v = this.earnStars(20);
        this.pushText({ x: this.arena.x + this.arena.w / 2, y: this.arena.y + this.arena.h / 2, text: `FIRST WIN! +${v}★`, t: 1.8, color: '#ffd84d', big: true });
      }
    }
    if (this.inRival) {
      this.echoCleared = true; // the echo is beaten — reclaim it
      this.award('rival');
    }
    if (this.waveHadGym) {
      this.gymsBeaten++;
      this.taskPing('gyms', this.gymsBeaten, this.arena.x + this.arena.w / 2, this.arena.y + 54);
    }
    // last-kill slow-mo — the kill shot gets a beat to land
    if (this.koSeen) {
      const cx = this.arena.x + this.arena.w / 2, cy = this.arena.y + this.arena.h / 2;
      this.fin.x = this.koX + (cx - this.koX) * 0.35;
      this.fin.y = this.koY + (cy - this.koY) * 0.35;
      this.fin.t = FINISH_T;
      this.finishN++;
      this.screenFlash('#ffffff', 0.22);
      buzz([40, 30, 80]);
    }
    this.hitStop = Math.max(this.hitStop, 0.5);
    this.addPunch(0.08);
    this.addShake(9);
    this.burst(this.arena.x + this.arena.w / 2, this.arena.y + this.arena.h / 2, '#ffd84d', 26, 540, 1.2);
    // the clear calls itself out — same ribbon the wave intro rides in on;
    // back-to-back one-shot clears streak into a score bonus
    this.sweepStreak = this.waveShots === 1 ? this.sweepStreak + 1 : 0;
    if (this.sweepStreak > 1) this.score += 60 * this.sweepStreak;
    // flawless carrot — an untouched wave pays a depth-scaled bonus
    if (this.waveFlawless) this.score += 50 + this.depth * 15;
    const speedClear = this.stopShots <= this.par;
    if (speedClear) this.score += 100 + this.depth * 25;
    if (!this.raid && !this.secret) this.clearCard = this.stopSummary();
    if (this.clearCard) this.clearCard.chain = { best: this.connect.best, alls: this.connect.alls };
    if (this.waveHadGym && this.clearCard) maybeSecret(this);
    if (this.clearCard) this.clearCard.missions = this.missions.clear(this.waveIndex + 1, { shots: this.stopShots, par: this.par, weak: this.stopWeak, faints: this.stopFaints }, (n) => this.earnStars(n));
    this.treasure.endStop(this.time, this.arena.x + this.arena.w / 2, this.arena.y, (n) => this.earnStars(n));
    // pickup ability: scavengers root through the arena after the fight —
    // a living carrier may nose out a consumable for the run's bag
    for (const p of this.players) {
      if (p.dead || !scavenger(p.def) || this.rng() < 0.85) continue;
      const found = BAG_ITEMS[Math.floor(this.rng() * BAG_ITEMS.length)];
      bankBag(found.id);
      this.pushText({ x: p.x, y: p.y - p.r - 30, text: `FOUND ${found.name.toUpperCase()}!`, t: 1.4, color: '#ffd84d', big: false });
      sfx('heal');
    }
    this.waveSpecial =
      (this.waveIndex + 1 >= this.waveCount ? 'STAGE CLEAR!' : 'WAVE CLEAR!') +
      (this.waveShots === 1
        ? this.sweepStreak > 1 ? ` · SWEEP x${this.sweepStreak}!` : ' · SWEEP!'
        : ` · ${this.waveShots} SHOTS`) +
      (this.waveFlawless ? ' · FLAWLESS!' : '') +
      (speedClear ? ' · SPEED CLEAR!' : '');
    this.clearTelop(speedClear);
    sfx('wave');
    // a raid is the whole fight — the win beat is short and never rolls the
    // climb's reward board, map or clear ledger
    if (this.raid && this.waveIndex + 1 >= this.waveCount) {
      this.phase = 'won';
      this.endT = 1.2;
      this.waveSpecial = 'RAID CLEARED!';
      this.clearTelop(false);
      this.log('RAID CLEARED!');
      this.screenFlash('#ffd84d', 0.35);
      this.addPunch(0.14);
      this.addShake(10);
      sfx('perfect');
      buzz([60, 80, 120]);
      return;
    }
    if (this.waveIndex + 1 >= this.waveCount && this.depth >= FINAL_DEPTH) {
      this.phase = 'won';
      this.endT = 1.6; // let the star shower play out before the report lands
      this.award('first-clear');
      if (this.asc > 0) this.award('ascended');
      // the last row clears too — its stage payday rides on the win lump
      this.bankStage(this.waveIndex);
      const starPay = this.earnStars(STAR_WIN);
      this.pushText({
        x: this.arena.x + this.arena.w / 2,
        y: this.arena.y + 140,
        text: `+${starPay} ★`,
        t: 1.6, color: '#c9a8ff', big: true,
      });
      this.log(`CLIMB CLEAR · +${starPay} STAR PIECES`);
      this.screenFlash('#ffd84d', 0.35);
      this.addPunch(0.14);
      // victory star-shower — the whole court celebrates
      for (let i = 0; i < 3; i++) {
        this.burst(
          this.arena.x + this.arena.w * (0.25 + i * 0.25),
          this.arena.y + this.arena.h * (0.3 + (i % 2) * 0.3),
          i === 1 ? '#ffffff' : '#ffd84d',
          16, 520, 1.3,
        );
      }
      this.addShake(10);
      sfx('perfect');
      buzz([60, 80, 120]);
      return;
    }
    // let the shot finish rolling out, then offer a relic
    this.rewardPending = true;
  }

  // Earned level growth: pow rides the offensive stat, maxHp rides hp —
  // KOs, rare candy events and tutor drills all grow through this one path.
  // unlockAch fires once per save ever — first unlock pops a trophy banner
  private award(id: string) {
    if (!unlockAch(id)) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    this.pushText({
      x: this.arena.x + this.arena.w / 2,
      // spawns deep — its 52px rise then parks below the N-LEFT chip
      // instead of ending stamped under it
      y: this.arena.y + 148,
      text: `★ TROPHY: ${a?.name ?? id} ★`,
      t: 2,
      color: '#ffd84d',
      big: true,
    });
    sfx('perfect');
  }

  // A catch lands at the team's pace, never above it — wild level is foe
  // difficulty, not a free upgrade. Joining at the team average keeps the
  // swap a real choice: new type + move vs your ace's levels.
  catchLvl(lvl: number) {
    const n = this.players.length || 1;
    const avg = Math.max(1, Math.round(this.players.reduce((a, p) => a + p.lvl, 0) / n));
    return Math.min(lvl, avg);
  }

  // Catch odds ride the level gap to your ace: fodder jumps in the ball, a
  // mon far above the team's pace all but refuses — the % reads as a gate,
  // not a flat roll. Balls + boss relics still widen it; master ball and
  // shinies skip the check entirely.
  catchOdds(e: Unit) {
    const best = Math.max(1, ...this.players.map((p) => p.lvl));
    const over = e.lvl - best;
    const lvlOdds = over <= -5 ? 3 : over <= 0 ? 2 : over <= 3 ? 0.7 : over <= 6 ? 0.25 : 0.05;
    return this.captureChance * lvlOdds + (e.boss ? this.bossCatch : 0);
  }

  // the pocket ball's flat bonus on the next catch roll — 0 when empty
  private ballOdds() {
    return this.stockedBall ? (BALL_CATCH[this.stockedBall] ?? 0) : 0;
  }

  // Queue the capture ritual: ball drops in, rocks `rocks` times over the
  // tick loop, then clicks shut (ok) or bursts open. Pure theatre — the
  // catch result is already banked; `resolve` fires the site's payoff at
  // the verdict so the suspense reads before the celebration. `id`/`r`
  // draw the mon shrinking into the ball when a KO'd foe is caught.
  private catchSeq(x: number, y: number, ok: boolean, item = 'poke-ball', resolve?: () => void, id?: number, r?: number) {
    const rocks = ok ? 3 : 2;
    const at = BALL_ROCK0 + rocks * BALL_ROCK_T;
    this.balls.push({ x, y, item, ok, rocks, rocked: 0, at, life: at + BALL_TAIL, t: at + BALL_TAIL, id, r, resolve });
  }

  // Where a box-bound catch performs when there's no KO spot to own — on
  // the map the ball lands by the trainer, anywhere else mid-court.
  private catchAnchor() {
    if (this.phase === 'map') {
      const n = this.region.nodes[this.mapNode];
      if (n) {
        return { x: MAP_OX + n.tx * MAP_CELL + MAP_CELL / 2, y: MAP_OY + (n.ty - this.mapCam) * MAP_CELL - MAP_CELL };
      }
    }
    return { x: this.arena.x + this.arena.w / 2, y: this.arena.y + 120 };
  }

  // The generic click payoff for catches without their own fanfare.
  // The generic click payoff for catches without their own fanfare —
  // the success burst wears the caught mon's type color when it can.
  private catchPayoff(x: number, y: number, def?: SpeciesDef) {
    return () => {
      const c = def ? TYPE_COLOR[def.type] : '#ffd84d';
      this.impact(x, y, c, 0.9);
      if (def) this.burst(x, y, c, 8, 320, 1, TYPE_RAMP[def.type]);
      playJingle('catch');
    };
  }

  // Every NEW face in the box lands here — names the recruit on the reward
  // banner and pings the map's TEAM · ITEMS button until you look.
  boxAdd(def: SpeciesDef, hpFrac = 1, theatre = true) {
    this.box.push(def);
    this.boxHp.push(hpFrac);
    this.boxLvl.push(Math.max(1, def.lvl ?? 1));
    this.boxGain = def;
    this.boxPing = true;
    // the chore board is live mid-run — a catch task pings the moment it lands
    this.taskPing('catches', this.box.length, this.arena.x + this.arena.w / 2, this.arena.y + 54);
    // every new box face earns the ritual — the KO catch passes theatre:
    // false because it runs its own sequence on the KO spot instead
    if (theatre) {
      const a = this.catchAnchor();
      // the mon shrinks into the ball, rocks, then pops in its type color
      this.catchSeq(a.x, a.y, true, 'poke-ball', this.catchPayoff(a.x, a.y, def), def.id, 18);
    }
  }

  // quiet: shared EXP levels the bench with no popup, burst or sfx
  gainLevels(p: Unit, n: number, quiet = false) {
    if (p.dead || p.lvl >= LV_CAP) return false;
    const l0 = p.lvl;
    p.lvl = Math.min(LV_CAP, p.lvl + n);
    p.pow *= lvlPow(offStat(p.def.stats, p.def.type), p.lvl) / lvlPow(offStat(p.def.stats, p.def.type), l0);
    const gain = Math.round(p.maxHp * (lvlHp(p.def.stats.hp, p.lvl) / lvlHp(p.def.stats.hp, l0) - 1));
    p.maxHp += gain;
    p.hp = Math.min(p.hp + gain, p.maxHp);
    if (quiet) return true;
    this.pushText({ x: p.x, y: p.y - p.r - 36, text: `LV ${p.lvl}!`, t: 0.9, color: '#9df0ff', big: false });
    this.burst(p.x, p.y, '#9df0ff', 6, 240, 0.8);
    sfx('ready');
    return true;
  }

  // A dupe capture doesn't fill a box slot — it feeds the copy you own
  // (MS fusion): +1 luck, the dupe's level poured in as earned levels, and
  // evolution only once the fed level clears the gate. A fully-evolved
  // dupe is rare candy. Returns false when the species is new to the run.
  private absorbDupe(def: SpeciesDef, shiny = false, dupLvl?: number): boolean {
    const owned = this.players.find((p) => p.def.id === def.id);
    const bi = this.box.findIndex((b) => b.id === def.id);
    if (!owned && bi < 0) return false;
    // a shiny dupe gilds the copy you already own
    if (shiny && owned && !owned.shiny) {
      owned.shiny = true;
      owned.def = { ...owned.def, shiny: true }; // marker rides the def into the box
    }
    // fusion: every absorbed dupe banks a luck point — MS's drop-rate stat,
    // spent on bonus gems in the gym loot fountain
    if (owned) owned.def = { ...owned.def, luck: Math.min(99, (owned.def.luck ?? 0) + 1) };
    else this.box[bi] = { ...this.box[bi], luck: Math.min(99, (this.box[bi].luck ?? 0) + 1) };
    this.pushText({
      x: owned ? owned.x : this.arena.x + this.arena.w / 2,
      y: owned ? owned.y - owned.r - 58 : this.arena.y + 50,
      text: '+1 LUCK!',
      t: 0.9, color: '#6fdc6f', big: false,
    });
    // fusion feed: the dupe pours its level into the copy you keep — fodder
    // dupes barely teach, deep wilds push real growth. A feed that clears
    // the gate can evolve in the same gulp, like a level-up evo.
    const feed = Math.max(FEED_MIN, Math.round((dupLvl ?? def.lvl ?? 5) * FEED_RATE));
    if (owned) this.gainLevels(owned, feed);
    else {
      const nl = Math.min(LV_CAP, (this.boxLvl[bi] ?? 1) + feed);
      this.boxLvl[bi] = nl;
      this.box[bi] = { ...this.box[bi], lvl: nl };
      this.pushText({
        x: this.arena.x + this.arena.w / 2,
        y: this.arena.y + 70,
        text: `+${feed} LV`,
        t: 0.9, color: '#9df0ff', big: false,
      });
    }
    const evoIds = def.evolvesTo == null ? [] : Array.isArray(def.evolvesTo) ? def.evolvesTo : [def.evolvesTo];
    const options = evoIds
      .map((id) => SPECIES_DB.find((s) => s.id === id))
      .filter((s): s is SpeciesDef => !!s);
    const gate = evoGate(def);
    // under the gate the dupe still fed and banked luck — the line just
    // isn't ready, so the copy levels toward it instead of evolving free
    if (options.length && (owned ? owned.lvl : this.boxLvl[bi]) < gate) {
      this.pushText({
        x: owned ? owned.x : this.arena.x + this.arena.w / 2,
        y: owned ? owned.y - owned.r - 40 : this.arena.y + 90,
        text: `LV ${gate} TO EVOLVE`,
        t: 1.1, color: '#9df0ff', big: false,
      });
      return true;
    }
    if (options.length > 1) {
      // a split path asks, not answers — the pick waits on the reward screen
      this.evoPending.push({ from: def, options, unit: owned, boxDef: owned ? undefined : this.box[bi] });
      this.pushText({
        x: owned ? owned.x : this.arena.x + this.arena.w / 2,
        y: owned ? owned.y - owned.r - 40 : this.arena.y + 70,
        text: `${def.name.toUpperCase()} IS EVOLVING…`,
        t: 1.4, color: '#ffd84d', big: true,
      });
      sfx('ready');
      return true;
    }
    const next = options[0];
    if (next) {
      if (owned) this.evolveUnit(owned, next); // the flicker cinematic owns the payoff
      else this.box[bi] = this.evoMerge(this.box[bi], next, shiny); // markers survive a boxed evolution
      if (recordCapture([next.id])) taskTick({ dex: 1 }); // evo-only species only ever enter the dex here
      if (!owned) startEvo(def.id, next.id, !!this.box[bi].shiny);
      const evoLine = `${def.name.toUpperCase()} evolved into ${next.name.toUpperCase()}!`;
      this.pushText({
        x: owned ? owned.x : this.arena.x + this.arena.w / 2,
        y: owned ? owned.y - owned.r - 40 : this.arena.y + 70,
        text: evoLine,
        t: 1.4, color: '#ffd84d', big: true,
      });
      this.log(evoLine);
      // boxed merges get the instant fanfare — no sprite on the field to flicker
      if (!owned) {
        this.impact(this.arena.x + this.arena.w / 2, this.arena.y + 90, '#ffd84d', 1.4);
        this.burst(this.arena.x + this.arena.w / 2, this.arena.y + 90, '#ffffff', 16, 380);
        sfx('caught');
      }
      return true;
    }
    if (owned) {
      // rare candy: a fully-evolved dupe bulks the original
      const gain = Math.max(1, Math.round(owned.maxHp * 0.08));
      owned.maxHp += gain;
      if (!owned.dead) owned.hp = Math.min(owned.maxHp, owned.hp + gain);
      owned.pow *= 1.05;
      this.pushText({ x: owned.x, y: owned.y - owned.r - 40, text: 'RARE CANDY!', t: 1.1, color: '#f85888', big: true });
    } else {
      // a boxed dupe can't bulk — the team splits the candy as a heal
      for (const p of this.players) {
        if (!p.dead) p.hp = Math.min(p.hp + Math.round(p.maxHp * 0.1), p.maxHp);
      }
      this.pushText({ x: this.arena.x + this.arena.w / 2, y: this.arena.y + 70, text: 'RARE CANDY!', t: 1.1, color: '#f85888', big: true });
    }
    sfx('heal');
    return true;
  }

  // Boxed evolution: shininess and banked luck ride the new form's def.
  private evoMerge(from: SpeciesDef, to: SpeciesDef, shiny = false): SpeciesDef {
    return from.shiny || shiny || from.luck
      ? { ...to, shiny: from.shiny || shiny || undefined, luck: from.luck }
      : to;
  }

  // The player's pick on a branching evolution — deferred to the reward
  // screen, then the next queued split steps up
  pickEvo(i: number) {
    const c = this.evoChoice;
    if (!c || this.phase !== 'reward') return;
    const next = c.options[i];
    if (!next) return;
    if (c.unit) this.evolveUnit(c.unit, next);
    else if (c.boxDef) {
      const bi = this.box.indexOf(c.boxDef);
      if (bi >= 0) (this.box[bi] = this.evoMerge(c.boxDef, next)), startEvo(c.boxDef.id, next.id, !!c.boxDef.shiny);
      else {
        // it left the box mid-queue (swapped onto the team) — find the unit
        const u = this.players.find((p) => p.def === c.boxDef);
        if (u) this.evolveUnit(u, next);
      }
    }
    if (recordCapture([next.id])) taskTick({ dex: 1 });
    const evoLine = `${c.from.name.toUpperCase()} evolved into ${next.name.toUpperCase()}!`;
    this.pushText({
      x: this.arena.x + this.arena.w / 2,
      y: this.arena.y + 120,
      text: evoLine,
      t: 1.4, color: '#ffd84d', big: true,
    });
    this.log(evoLine);
    // a fielded pick plays out in the cinematic — boxed picks need the cue here
    if (!c.unit) {
      sfx('caught');
    }
    this.evoChoice = this.evoPending.shift() ?? null;
  }

  // The modal's other honest answer: keep the current form — the next
  // queued split steps up exactly like a resolved pick.
  declineEvo() {
    const c = this.evoChoice;
    if (!c || this.phase !== 'reward') return;
    this.log(`KEPT ${c.from.name.toUpperCase()}`);
    this.evoChoice = this.evoPending.shift() ?? null;
  }

  // Mid-run evolution: same slot, new species — hp fraction carries over
  // and a fainted mon stays fainted (evolving isn't a revive).
  private evolveUnit(p: Unit, nd: SpeciesDef) {
    const fromId = p.def.id; // the cinematic flickers from this sprite
    const frac = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    const role = roleOf(nd);
    const m = ROLE_MODS[role];
    const hp = Math.round(playerHp(nd.stats) * m.hp);
    // markers ride the def into the box — joined too: the evolved form keeps
    // the family's fielded history
    p.def = p.shiny || p.def.luck || p.def.joined != null ? { ...nd, shiny: p.shiny || undefined, luck: p.def.luck, joined: p.def.joined } : nd;
    p.role = role;
    p.pow = m.pow * lvlPow(offStat(nd.stats, nd.type), p.lvl); // earned levels survive evolution
    p.rngMul = m.range;
    p.launch = m.launch;
    p.cdMod = m.cdMod;
    p.maxHp = Math.round(hp * lvlHp(nd.stats.hp, p.lvl));
    p.hp = Math.max(1, Math.round(p.maxHp * frac));
    if (p.dead) p.hp = 0;
    p.cdMax = Math.max(1, Math.round(bumpCooldown(nd.type) * this.cdMult) - p.cdMod);
    p.cd = Math.min(p.cd, p.cdMax);
    this.refreshTraits(); // evolving can change type — retally immediately
    startEvo(fromId, nd.id, p.shiny);
  }

  // One unit-construction path — the constructor fields the draft through it
  // and joinFromBox deploys a boxed catch through the same shape.
  private makeUnit(def: SpeciesDef, lvl: number, i: number, n: number): Unit {
    const role = roleOf(def);
    const m = ROLE_MODS[role];
    // draft picks roll lvl 5-14: same scaling curve as mid-run KOs
    const hp = Math.round(playerHp(def.stats) * m.hp * lvlHp(def.stats.hp, lvl) * this.labHpMult);
    // supers start at zero charge — each shot banks a turn toward firing
    const cd = Math.max(1, Math.round(bumpCooldown(def.type) * this.cdMult) - m.cdMod);
    return {
      uid: this.uidCtr++,
      def,
      side: 'player',
      // staggered start in the bottom third — not a rigid row
      x: this.arena.x + (this.arena.w * (i + 1)) / (n + 1) + (this.rng() - 0.5) * 50,
      y: this.arena.y + this.arena.h - 70 - (i % 2) * 60 - this.rng() * 40,
      vx: 0,
      vy: 0,
      r: 26,
      hp,
      maxHp: hp,
      timer: 0,
      clocks: [],
      drift: 0,
      wx: 0,
      wy: 0,
      wT: 0,
      wMul: 0,
      lunging: 0,
      boss: false,
      bigT: 0,
      shiny: !!def.shiny, // a shiny draft pick stays gold
      dead: false,
      dotTicks: 0,
      dotDmg: 0,
      burnT: 0,
      paraT: 0,
      confuseT: 0,
      cd,
      cdMax: cd,
      lastBump: -1,
      role,
      sash: !!def.sturdy, // sturdy species hang on natively — no item needed
      lvl,
      pow: m.pow * lvlPow(offStat(def.stats, def.type), lvl),
      rngMul: m.range,
      launch: m.launch,
      cdMod: m.cdMod,
      lastHit: new Map(),
      wallN: 0,
      regenT: 0,
      hzT: -9,
      sq: 0,
      flashT: 0,
      sumStage: 0,
      atkN: 0,
      weakA: 0,
      shieldA: def.shielded ? this.rng() * Math.PI * 2 : 0,
      shieldN: 0,
      revives: 0,
      gravR: 0,
      repelR: 0,
      warpT: -9,
      boostT: -9,
      blinkT: 0,
      boostN: 0,
      armorN: 0,
      atkMul: 1,
      lastStand: false,
    };
  }

  // Reseat a unit on a new species: role/stats recomputed, hp carried as a
  // fraction. Box swaps and wonder-trade both ride this one path.
  applyDef(p: Unit, def: SpeciesDef, lvl: number, frac = 1) {
    const role = roleOf(def);
    const m = ROLE_MODS[role];
    const hp = Math.round(playerHp(def.stats) * m.hp * lvlHp(def.stats.hp, lvl));
    // the new species starts its bond clock now — waveIndex is the stage
    // count already cleared, so pts at run end = cleared - joined
    p.def = { ...def, joined: this.waveIndex };
    p.role = role;
    p.lvl = lvl;
    p.shiny = !!def.shiny;
    p.pow = m.pow * lvlPow(offStat(def.stats, def.type), lvl);
    p.rngMul = m.range;
    p.launch = m.launch;
    p.cdMod = m.cdMod;
    p.maxHp = hp;
    p.hp = frac <= 0 ? 0 : Math.max(1, Math.round(hp * frac));
    p.dead = p.hp <= 0;
    p.cdMax = Math.max(1, Math.round(bumpCooldown(def.type) * this.cdMult) - p.cdMod);
    p.cd = p.cdMax; // swapped/retrained — it has to earn its first super
    this.refreshTraits(); // a new face can break or make a type pair
  }

  // Swap a boxed mon onto the team — the TEAM · ITEMS panel is the only
  // place, and it's modal over the map AND the reward break. Both phases
  // park the units, so the same applyDef path serves either. HP belongs to
  // the mon, not the slot: a hurt mon stays hurt in the box and a fainted
  // one stays fainted, so benching is never a free heal or revive.
  swapFromBox(bi: number, ti: number) {
    if (this.phase !== 'map' && this.phase !== 'reward') return;
    const def = this.box[bi];
    const frac = this.boxHp[bi] ?? 1;
    const lvl = this.boxLvl[bi] ?? 1;
    const p = this.players[ti];
    if (!def || !p) return;
    this.box.splice(bi, 1);
    this.boxHp.splice(bi, 1);
    this.boxLvl.splice(bi, 1);
    this.box.push(p.def); // benched ally goes back to the box
    this.boxHp.push(p.maxHp ? p.hp / p.maxHp : 0);
    this.boxLvl.push(Math.max(1, p.lvl)); // earned levels ride back to the bench
    this.applyDef(p, def, lvl, frac);
    this.boxSel = -1;
    this.teamSel = -1;
    this.screenFlash('#ffd84d', 0.12);
    sfx('caught');
  }

  // how many field slots this save has earned — the locked back pair
  // refuses joins until the career stage record opens them (teamSlots)
  get teamCap() { return Math.min(TEAM_CAP, teamSlots()); }

  // A lean draft leaves open slots — a boxed catch deploys outright instead
  // of benched-for-benched. Same rules as a swap: KO'd catches stay in the
  // box, joined species start their bond clock now.
  joinFromBox(bi: number) {
    if (this.phase !== 'map' && this.phase !== 'reward') return;
    if (this.players.length >= this.teamCap) return;
    const def = this.box[bi];
    if (!def || (this.boxHp[bi] ?? 1) <= 0) return;
    const lvl = this.boxLvl[bi] ?? 1;
    const frac = this.boxHp[bi] ?? 1;
    this.box.splice(bi, 1);
    this.boxHp.splice(bi, 1);
    this.boxLvl.splice(bi, 1);
    const u = this.makeUnit({ ...def, joined: this.waveIndex }, lvl, this.players.length, this.teamCap);
    u.hp = Math.max(1, Math.round(u.maxHp * frac));
    this.players.push(u);
    this.refreshTraits();
    this.boxSel = -1;
    this.teamSel = -1;
    this.screenFlash('#ffd84d', 0.12);
    sfx('caught');
  }

  // What comes after the reward break — for the next-stage preview.
  get nextIsGym() {
    const n = this.waveIndex + 1;
    return this.region.nodes.some((nd) => nd.row === n && nd.kind === 'gym');
  }
  get nextIsRolled() {
    return this.waveIndex + 1 >= this.waveCount;
  }

  // The gym's prize: beating a leader always nets their ace (even a dupe) —
  // the only guaranteed catch left in the run.
  private rollRecruit() {
    const spawns = this.curSpawns; // what was actually fielded — rival/invade/event overrides included
    const fresh = spawns.filter((s) => !this.box.some((b) => b.id === s.def.id));
    const pool = fresh.length ? fresh : spawns;
    const pick = fresh.find((s) => s.boss) ?? spawns.find((s) => s.boss) ?? pool[Math.floor(this.rng() * pool.length)];
    // recruits arrive at wave-appropriate level — deep runs yield real mons
    return { ...pick.def, lvl: this.catchLvl(Math.min(LV_CAP, 5 + this.waveIndex * 10 + (pick.boss ? 8 : 0) + (this.rng() < 0.5 ? 4 : 0))) };
  }

  // every type on the active team or in the box — charm offers follow it
  teamTypes() {
    const s = new Set<PokeType>();
    for (const d of [...this.players.map((p) => p.def), ...this.box]) {
      s.add(d.type);
      if (d.type2) s.add(d.type2);
    }
    return s;
  }

  // fusion tally — MS luck: absorbed dupes pay out as bonus gym loot;
  // the lab's LUCKY EGG adds flat luck on top, and a trusted partner pays
  // a point every other bond level (LV2–3 +1, LV4–5 +2)
  teamLuck() {
    return this.players.reduce((a, p) => a + (p.def.luck ?? 0) + Math.floor(bondLv(p.def.id) / 2), this.labLuck);
  }

  // star pieces: every payout passes the AMULET COIN multiplier and banks
  // into both the persistent wallet and this run's tally. Returns the
  // credited amount for the pickup's +N text.
  private earnStars(n: number) {
    const v = Math.ceil(n * this.starMult * starBoost()); // boost reads live — a mid-session grant applies
    addStars(v);
    this.starsRun += v;
    return v;
  }

  // a cleared map row pays 2 + stage# (stage 1 = row 0 pays 3) — utility
  // stops pay too; progress is progress
  private bankedRow = -1;
  private bankStage(row: number) {
    if (this.bankedRow === row) return; // a row pays once — park-bank, walk-bank and board-advance all reach here
    this.bankedRow = row;
    this.earnStars(STAR_ROW + row + 1);
    const cx = this.arena.x + this.arena.w / 2;
    this.taskPing('score', this.score, cx, this.arena.y + 54);
    // row just cleared = row + 1 stages beaten — same count taskTick banks
    this.taskPing('stages', row + 1, cx, this.arena.y + 54);
    this.taskPing('maxstage', row + 1, cx, this.arena.y + 54);
  }

  // the chore board goes live mid-run — a counter crossing its goal pings the
  // moment it happens instead of surfacing as paperwork on the run report.
  // v.have is banked progress; `now` is this run's unbanked contribution.
  private taskPing(kind: TaskKind, now: number, x: number, y: number) {
    if (this.raid) return; // raids bank nothing — no pings either
    for (const period of ['daily', 'weekly'] as const) {
      for (const v of taskViews(period)) {
        if (v.kind !== kind || v.done || this.taskDone.has(v.id)) continue;
        // maxstage/combo are high-water marks, not cumulative counters —
        // adding banked have on top would ping "reach stage 8" at stage 5
        if ((v.kind === 'maxstage' || v.kind === 'combo' ? now : v.have + now) < v.n) continue;
        this.taskDone.add(v.id);
        this.pushText({ x, y, text: `TASK: ${v.label} ✓`, t: 1.5, color: '#ffd84d', big: true });
        sfx('ui', 0.9);
      }
    }
  }

  private enterReward() {
    if (this.secret?.phase === 'fight') return secretWon(this);
    this.fin.t = 0;
    this.boxSel = -1;
    this.teamSel = -1;
    // hard stops pay out uncommon-or-better relics — the risk has a price;
    // elites go further: rare-or-better only
    this.rewardCap = this.eliteWave ? 1 : this.hardWave ? 2 : 3;
    this.rewardOffers = rollPerks(this.rng, this.rewardCap, this.rank, this.teamTypes(), this.perkOfferN);
    this.hardWave = false;
    this.eliteWave = false;
    // trainer mons stay with their owner; only a fallen gym pays its ace —
    // ordinary stages earn no free catch
    this.lastRecruit = this.inTrainer || !this.waveHadGym ? null : this.rollRecruit();
    if (this.lastRecruit) {
      const rec = this.lastRecruit;
      if (!this.absorbDupe(rec)) {
        this.boxAdd(rec); // boxAdd runs the ball ritual itself
        if (recordCapture([rec.id])) taskTick({ dex: 1 }); // the dex logs it now, not at run end
      } else {
        // a prize dupe never reaches boxAdd — run the ritual anyway so the
        // catch chime still waits on the click
        const a = this.catchAnchor();
        this.catchSeq(a.x, a.y, true, 'poke-ball', this.catchPayoff(a.x, a.y));
      }
      this.log(`${rec.name.toUpperCase()} RECRUITED`);
    }
    for (const p of this.players) {
      p.vx = 0;
      p.vy = 0;
    }
    this.phase = 'reward';
    if (!this.waveHadGym) playJingle('clear'); // gyms already played their badge stab
    // open slots pull from the box before the roster prompt — a catch
    // fields itself; KO'd catches stay boxed until they're healed
    while (this.players.length < this.teamCap) {
      const bi = this.boxHp.findIndex((hp) => hp > 0);
      if (bi < 0) break;
      const def = this.box[bi];
      const frac = this.boxHp[bi];
      const lvl = this.boxLvl[bi] ?? 1;
      this.box.splice(bi, 1);
      this.boxHp.splice(bi, 1);
      this.boxLvl.splice(bi, 1);
      const u = this.makeUnit({ ...def, joined: this.waveIndex }, lvl, this.players.length, this.teamCap);
      u.hp = Math.max(1, Math.round(u.maxHp * frac));
      this.players.push(u);
      this.refreshTraits();
      this.log(`${def.name.toUpperCase()} JOINED THE TEAM`);
    }
    if (!this.box.length) this.boxPing = false; // nothing boxed means nothing to nag about
    // fix the lineup before the item — main opens the roster over the board
    // once; only worth the interruption when there's a mon to swap in
    this.wantMenu = this.box.length > 0;
    // a queued split evolution asks its question on the reward screen
    if (!this.evoChoice) this.evoChoice = this.evoPending.shift() ?? null;
  }

  // A fallen gym leader bursts into PokéCoins — a few-second victory lap
  // where you drag your lead mon through the fountain before it fades.
  private enterLoot() {
    this.fin.t = 0;
    this.phase = 'loot';
    this.lootT = 6;
    this.lootDrag = false;
    this.lootPos = null;
    this.lootDown = null;
    this.pickups = [];
    this.lootCoins = [];
    const ox = this.bossKilledAt?.x ?? this.arena.x + this.arena.w / 2;
    const oy = this.bossKilledAt?.y ?? this.arena.y + this.arena.h / 2;
    this.bossKilledAt = null;
    this.lootChain = 0;
    this.lootChainT = -9;
    this.lootGot = 0;
    const n = 24 + this.depth * 3; // deeper gyms burst bigger
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rng() * 0.5;
      const sp = 280 + this.rng() * 560;
      this.lootCoins.push({
        x: ox,
        y: oy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 300, // fountain arc — coins kick upward first
        r: 11,
        spin: this.rng() * Math.PI * 2,
        kind: 'coin',
        val: 25,
      });
    }
    // the rare drops: gems are score-dense, a heart patches the team,
    // a candy banks a turn of super charge — each reads its own color
    const extra = Math.max(2, Math.round(n * 0.18));
    for (let i = 0; i < extra; i++) {
      const a = this.rng() * Math.PI * 2;
      const sp = 200 + this.rng() * 380;
      this.lootCoins.push({
        x: ox,
        y: oy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 340,
        r: 14,
        spin: this.rng() * Math.PI * 2,
        kind: 'gem',
        val: 100,
      });
    }
    // team luck pays: MS's drop-rate stat — every ~10 fusion points rolls a
    // bonus gem into the fountain
    const luck = this.teamLuck();
    const bonus = Math.min(6, Math.floor(luck / 10) + (this.rng() < (luck % 10) / 10 ? 1 : 0));
    for (let i = 0; i < bonus; i++) {
      const a = this.rng() * Math.PI * 2;
      const sp = 200 + this.rng() * 380;
      this.lootCoins.push({
        x: ox, y: oy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 340,
        r: 14,
        spin: this.rng() * Math.PI * 2,
        kind: 'gem',
        val: 100,
      });
    }
    if (bonus > 0)
      this.pushText({ x: ox, y: oy - 70, text: `LUCKY! +${bonus} GEM${bonus > 1 ? 'S' : ''}`, t: 1.4, color: '#9df0ff', big: true });
    for (const kind of ['heart', 'candy'] as const) {
      const a = this.rng() * Math.PI * 2;
      const sp = 220 + this.rng() * 300;
      this.lootCoins.push({
        x: ox,
        y: oy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 360,
        r: 13,
        spin: this.rng() * Math.PI * 2,
        kind,
        val: 0,
      });
    }
    // star pieces mixed into the burst — the pull machine's purple shards,
    // worth +1 apiece, same arc and bounce as the coins
    const starN = LOOT_STAR[0] + Math.floor(this.rng() * (LOOT_STAR[1] - LOOT_STAR[0] + 1));
    for (let i = 0; i < starN; i++) {
      const a = this.rng() * Math.PI * 2;
      const sp = 240 + this.rng() * 320;
      this.lootCoins.push({
        x: ox,
        y: oy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 350,
        r: 13,
        spin: this.rng() * Math.PI * 2,
        kind: 'star',
        val: 1,
      });
    }
    this.waveSpecial = 'VICTORY LOOT!';
    this.telop.push({ kind: 'clear', title: 'VICTORY LOOT', sub: 'SCOOP THE STARS', mon: this.active.def.id, icon: 'star-piece' });
    this.screenFlash('#ffd84d', 0.25);
    sfx('perfect');
  }

  private stepLoot(dt: number) {
    this.lootT -= dt;
    const a = this.arena;
    // the leash: lead mon chases your finger
    const mon = this.players.find((p) => !p.dead);
    if (mon && this.lootDrag && this.lootPos) {
      mon.x += (this.lootPos.x - mon.x) * Math.min(1, dt * 9);
      mon.y += (this.lootPos.y - mon.y) * Math.min(1, dt * 9);
      mon.x = Math.max(a.x + mon.r, Math.min(a.x + a.w - mon.r, mon.x));
      mon.y = Math.max(a.y + mon.r, Math.min(a.y + a.h - mon.r, mon.y));
    }
    for (const c of this.lootCoins) {
      c.vy += 720 * dt; // gravity — coins arc, bounce, and settle
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= Math.exp(-1.1 * dt);
      c.spin += dt * 11;
      // sparkle trail while the drop still flies — settled loot stops glinting
      if (c.vx * c.vx + c.vy * c.vy > 300 * 300 && this.fxRng() < dt * 5) this.glint(c.x, c.y, 4, LOOT_TINT[c.kind]);
      if (c.x < a.x + c.r) { c.x = a.x + c.r; c.vx = Math.abs(c.vx) * 0.7; }
      if (c.x > a.x + a.w - c.r) { c.x = a.x + a.w - c.r; c.vx = -Math.abs(c.vx) * 0.7; }
      if (c.y < a.y + c.r) { c.y = a.y + c.r; c.vy = Math.abs(c.vy) * 0.7; }
      if (c.y > a.y + a.h - c.r) { // floor bounce with friction — coins pool up
        c.y = a.y + a.h - c.r;
        c.vy = -Math.abs(c.vy) * 0.55;
        c.vx *= 0.85;
      }
      // a living mon vacuums whatever comes close, scoops on contact
      for (const p of this.players) {
        if (p.dead) continue;
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < p.r + c.r + 2) {
          c.r = -1; // collected — swept below
          this.glint(c.x, c.y, c.kind === 'coin' ? 6 : 9); // the collect pop
          if (c.kind !== 'coin') impactRing(this.fx, this.fxRng, c.x, c.y, LOOT_TINT[c.kind], { radius: 24, width: 2.5, life: 0.24, motes: 2 });
          // scoop streak: rapid pickups climb the pitch ladder like rings
          this.lootChain = this.time - this.lootChainT < 0.6 ? this.lootChain + 1 : 0;
          this.lootChainT = this.time;
          if (c.kind === 'heart') {
            // patches the most-hurt survivor — a mid-climb mend you earned
            const hurt = this.players.filter((q) => !q.dead).sort((a2, b2) => a2.hp / a2.maxHp - b2.hp / b2.maxHp)[0];
            if (hurt) {
              const healed = Math.ceil(hurt.maxHp * 0.15);
              hurt.hp = Math.min(hurt.maxHp, hurt.hp + healed);
              this.pushText({ x: hurt.x, y: hurt.y - hurt.r - 10, text: `+${healed}`, t: 0.9, color: '#6fdc6f', big: false });
            }
            this.burst(c.x, c.y, '#ff7096', 10, 300, 0.7);
            sfx('heal');
          } else if (c.kind === 'candy') {
            for (const q of this.players) if (!q.dead) q.cd = Math.max(0, q.cd - 1);
            this.pushText({ x: c.x, y: c.y - 16, text: 'SUPER CHARGE!', t: 0.9, color: '#9df0ff', big: false });
            this.burst(c.x, c.y, '#9df0ff', 10, 300, 0.7);
            sfx('ready');
          } else if (c.kind === 'star') {
            // star piece — feeds the hatcher, not the score
            const got = this.earnStars(c.val);
            this.burst(c.x, c.y, '#c9a8ff', 8, 300, 0.7);
            this.pushText({ x: c.x, y: c.y - 16, text: `+${got} ★`, t: 0.9, color: '#c9a8ff', big: false });
            sfx('tick', 1.1 + Math.min(1.2, this.lootChain * 0.07));
          } else {
            this.score += c.val;
            this.lootGot += c.val;
            this.burst(c.x, c.y, LOOT_TINT[c.kind], c.kind === 'gem' ? 9 : 5, c.kind === 'gem' ? 340 : 220, 0.6);
            this.pushText({
              x: c.x,
              y: c.y - 16,
              text: `+${c.val}`,
              t: 0.6,
              color: LOOT_TINT[c.kind],
              big: false,
              size: c.kind === 'gem' ? 1.1 : 0.75,
            });
            sfx('tick', 0.9 + Math.min(1.2, this.lootChain * 0.07)); // streak pitch climbs
          }
          if (this.lootChain >= 3) {
            this.pushText({ x: c.x, y: c.y - 34, text: `×${this.lootChain + 1}`, t: 0.5, color: '#fff', big: false, size: 0.7 });
          }
          break;
        }
        if (d < 170) { // wider vacuum — the leash feels generous, not stingy
          c.vx += (dx / d) * 3400 * dt;
          c.vy += (dy / d) * 3400 * dt - 720 * dt; // the pull beats gravity
        }
      }
    }
    cull(this.lootCoins, (c) => c.r > 0);
    if (this.lootT <= 0 || !this.lootCoins.length) {
      this.lootCoins = [];
      this.waveSpecial = null;
      // the haul gets its own beat — you see what the fountain paid
      if (this.lootGot > 0) {
        this.pushText({
          x: this.arena.x + this.arena.w / 2,
          y: this.arena.y + 120,
          text: `LOOTED +${this.lootGot}!`,
          t: 1.4,
          color: '#ffd84d',
          big: true,
        });
      }
      this.enterReward();
    }
  }

  pickPerk(i: number) {
    const perk = this.rewardOffers[i];
    if (!perk || this.phase !== 'reward') return;
    sfx('ui');
    this.grantPerk(perk);
    this.perksTaken++;
    this.taskPing('perks', this.perksTaken, this.arena.x + this.arena.w / 2, this.arena.y + 54);
    this.rewardOffers = [];
    this.advanceReward(); // relic banked — the map's TEAM · ITEMS handles swaps now
  }

  // The reward break is one job — take or skip the relic — then straight to
  // the region map. Callers already played the pick sound.
  advanceReward() {
    if (this.phase !== 'reward' || this.evoChoice) return;
    this.boxSel = -1;
    this.teamSel = -1;
    this.pendingNext = this.waveIndex + 1;
    this.bankStage(this.waveIndex); // the row just fought through pays out
    this.phase = 'map'; // pick the next stop on the region map
  }

  // REROLL spends a charge to re-deal the board at the same tier cap.
  rerollOffers(): boolean {
    if (this.phase !== 'reward' || this.tools.roll <= 0) return false;
    this.rewardOffers = rollPerks(this.rng, this.rewardCap, this.rank, this.teamTypes(), this.perkOfferN);
    this.tools.roll--;
    return true;
  }

  // Map camera: the viewport trails the walker's tile row — while you're
  // standing on a stop it holds that row near the bottom third so the
  // next couple of rows are what's on screen
  private mapCamTarget() {
    let ty = this.region.nodes[this.mapNode]?.ty ?? 0;
    const mw = this.mapWalk;
    if (mw) {
      const i = Math.min(Math.floor(mw.t), mw.path.length - 2);
      const f = mw.t - i;
      ty = mw.path[i].y + (mw.path[i + 1].y - mw.path[i].y) * f;
    }
    return Math.min(Math.max(ty - (MAP_VIEW - 5), 0), MAP_H - MAP_VIEW);
  }

  // Overworld walk: the lead mon travels the carved route to the stop you
  // tapped, then the stop's effect and its battle fire on arrival.
  private stepMapWalk(dt: number) {
    const mw = this.mapWalk;
    if (!mw) return;
    mw.t += dt * 6; // ~6 tiles a second — brisk but readable
    if (mw.t < mw.path.length - 1) return;
    const n = mw.node;
    this.mapWalk = null;
    this.finishMapWalk(n);
  }

  private finishMapWalk(n: MapNode) {
    if (n.kind === 'secret') return enterSecret(this, n);
    if (this.secret?.phase === 'open') closeSecret(this); // walking past an open lair seals it
    this.mapNode = this.region.nodes.indexOf(n);
    this.pendingNext = n.row;
    this.arriveAtNode(n);
    this.tickEgg();
    const dc = tickDaycare(this); if (dc) { this.mapMsg = dc; this.mapMsgT = 3; this.log(dc); }
    if (this.eventChoice) return; // a ? is asking — resolve the row on the pick
    if (this.skipWave) {
      // the event resolved the stop — row clears with no fight, at the
      // cost of the wave's recruits and perk draft (StS ?-node trade).
      // The row's wave is still generated (and discarded) so waves[i]
      // stays indexed by row for the next spawnWave call.
      this.skipWave = false;
      this.waveIndex = n.row;
      if (n.row >= this.stage.waves.length) {
        this.depth++;
        // same draw shape as the live roll — applySnapshot's backfill replays
        // it draw-for-draw
        this.stage.waves.push(rollWave(this.rng, this.depth, THEMES[Math.floor(this.rng() * THEMES.length)]));
      }
      this.pendingNext = n.row + 1;
      this.bankStage(n.row); // a peaceful stop still cleared its row
      return;
    }
    this.spawnWave(this.pendingNext, n);
    this.nextTurn();
  }

  // The player's answer to a choice ? — runs the picked option, then resolves
  // the row the same way finishMapWalk would have: a staged wave fights now,
  // a peaceful outcome clears the row and waits on the map.
  private pickEventChoice(i: number) {
    const c = this.eventChoice;
    if (!c || this.phase !== 'map') return;
    const out = c.options[i]?.run(this);
    if (!out) return;
    this.playEventFx(out); // the pick's beat — even when the mart re-prompts
    this.eventChoice = null;
    this.choiceHit = [];
    sfx('ui');
    if (out.choices) {
      // a pick can ask again — marts keep the board open until LEAVE
      this.eventChoice = { ...out.choices, node: c.node };
      this.cardT = 0; // the board re-pops with the result
      return;
    }
    if (out.wave) {
      this.pendingEventWave = out.wave;
      this.mapNote = out.note;
      this.spawnWave(c.node.row, c.node);
      this.nextTurn();
      return;
    }
    // peaceful pick — the same row bookkeeping as a skip resolution
    this.waveIndex = c.node.row;
    if (c.node.row >= this.stage.waves.length) {
      this.depth++;
      this.stage.waves.push(rollWave(this.rng, this.depth, THEMES[Math.floor(this.rng() * THEMES.length)]));
    }
    this.pendingNext = c.node.row + 1;
    this.bankStage(c.node.row);
    // the result card keeps the event's face when the pick brings none
    this.eventBox = { note: out.note, art: out.art ?? c.art };
    if (out.note) this.log(out.note);
    this.cardT = 0;
  }

  // Egg from the ? pool: rustles on every stop advance, then hatches a
  // depth-appropriate catch straight into the box.
  private tickEgg() {
    if (!this.eggIn) return;
    if (this.eggJustLaid) {
      this.eggJustLaid = false;
      return;
    }
    this.eggIn--;
    if (this.eggIn > 0) {
      this.mapMsg = `THE EGG RUSTLES… (${this.eggIn} TO GO)`;
      this.mapMsgT = 2.5;
      return;
    }
    const def = pickWild(this.rng, this.depth);
    const lvl = this.catchLvl(Math.min(LV_CAP, 5 + this.waveIndex * 10 + Math.floor(this.rng() * 5)));
    this.boxAdd({ ...def, lvl }, 1, false); // the hatch runs its own seq, not boxAdd's
    const a = this.catchAnchor();
    // the shell cracks in time with the rocks — sparks before the click
    for (const t of [0.55, 0.95, 1.35]) this.later(t, () => this.burst(a.x, a.y, '#fff0b0', 5, 180, 0.7));
    this.catchSeq(a.x, a.y, true, 'poke-ball', () => {
      this.impact(a.x, a.y, '#ffd84d', 0.9);
      playJingle('hatch'); // curious arp — a new face, not a fought catch
    });
    if (recordCapture([def.id])) taskTick({ dex: 1 });
    this.mapMsg = `THE EGG HATCHED · ${def.name.toUpperCase()} JOINED YOUR BOX!`;
    this.log(this.mapMsg);
    this.mapMsgT = 3;
  }

  // StS map-stop effects resolve on arrival: Poké Center rests heal, chests
  // cough up a relic — the note becomes the wave banner since we go straight
  // from the map into the fight.
  private arriveAtNode(n: MapNode) {
    this.mapNote = '';
    if (n.kind === 'event') {
      // the ? pool: heals and finds resolve on the spot; ambushes stage a
      // scripted wave that replaces whatever the row would have rolled
      const out = rollEvent(this);
      this.playEventFx(out); // resolved stops (and staged ambushes) play their beat on arrival
      if (out.choices) {
        // the ? asks — the row stays unresolved until pickEventChoice lands
        this.eventChoice = { ...out.choices, node: n };
        this.cardT = 0;
        return;
      }
      if (out.wave) {
        this.pendingEventWave = out.wave;
        this.mapNote = out.note;
      } else {
        this.skipWave = out.skip === true;
        this.eventBox = { note: out.note, art: out.art };
        if (out.note) this.log(out.note);
        this.cardT = 0;
      }
      return;
    }
    if (n.kind === 'rest') {
      // a real StS rest-site call: mend at the Poké Center, or skip the heal
      // and drill the team instead — the ?-choice board holds the row until
      // the pick lands. ASC 4+ centers run on fumes (75% heal)
      const healTo = this.asc >= 4 ? 0.75 : 1;
      this.eventChoice = {
        prompt: 'A POKÉ CENTER · REST THE TEAM, OR TRAIN THROUGH?',
        art: { mon: 113 }, // Chansey keeps the counter
        options: [
          {
            label: `POKÉ CENTER · HEAL${healTo < 1 ? ' 75%' : ''} + REVIVE`,
            icon: 'potion',
            run: (b) => {
              let revived = 0;
              for (const p of b.players) {
                if (p.dead) {
                  p.dead = false;
                  revived++;
                }
                p.hp = Math.round(p.maxHp * healTo);
                // the center's full course — status washes off too
                p.asleep = false;
                p.dotTicks = 0;
                p.burnT = 0;
                p.paraT = 0;
              }
              playJingle('rest'); // the center motif — gentle triad, homage not the tune
              return {
                note: revived
                  ? `POKÉ CENTER: TEAM HEALED${healTo < 1 ? ' TO 75%' : ''}, ${revived} REVIVED`
                  : `POKÉ CENTER: TEAM HEALED${healTo < 1 ? ' TO 75%' : ''}`,
                fx: 'heal',
                skip: true,
              };
            },
          },
          {
            label: 'TRAIN HARD · +3 LEVELS, NO HEAL',
            icon: 'macho-brace',
            run: (b) => {
              for (const p of b.players) if (!p.dead) b.gainLevels(p, 3);
              return { note: 'A HARD WORKOUT · EVERYONE +3 LEVELS!', fx: 'gold', skip: true };
            },
          },
        ],
        node: n,
      };
      this.cardT = 0;
    } else if (n.kind === 'mart') {
      // Poké Mart: the ?-choice box doubles as a shop board — buys re-prompt
      // the shelf until LEAVE, score is the wallet
      this.eventChoice = { ...martStock(this), node: n };
      this.cardT = 0;
    } else if (n.kind === 'chest') {
      // the old couple's blessing doubles the pull, then lapses
      const ps = rollPerks(this.rng, 1, this.rank, this.teamTypes(), this.doubleChest ? 2 : 1);
      this.doubleChest = false;
      for (const p of ps) this.grantPerk(p);
      if (ps.length) this.mapNote = `YOU FOUND ${ps.map((p) => p.name.toUpperCase()).join(' + ')}!`;
      sfx('ready');
    }
  }

  // RNGdle-style run analysis: scan what the run did, award badges with
  // rarities, rarest first. Every run earns at least TRAINER.
  runBadges(won: boolean): { name: string; rarity: Rarity }[] {
    const faints = this.players.filter((u) => u.dead).length;
    const b: { name: string; rarity: Rarity }[] = [];
    if (won && this.asc > 0) b.push({ name: `ASCENSION ${this.asc}`, rarity: 'legendary' });
    if (this.maxKos >= 4) b.push({ name: 'MEGA KO', rarity: 'legendary' });
    else if (this.maxKos >= 3) b.push({ name: 'TRIPLE KO', rarity: 'rare' });
    else if (this.maxKos >= 2) b.push({ name: 'DOUBLE KO', rarity: 'common' });
    if (this.maxCombo >= 4) b.push({ name: 'LONG CHAIN', rarity: 'rare' });
    if (this.caughtBoss) b.push({ name: 'BOSS THIEF', rarity: 'legendary' });
    if (this.shiniesCaught > 0) b.push({ name: 'SHINY HUNTER', rarity: 'legendary' });
    if (this.box.length >= 3) b.push({ name: 'SAFARI ZONE', rarity: 'rare' });
    else if (this.box.length >= 2) b.push({ name: 'COLLECTOR', rarity: 'uncommon' });
    if (this.totalKos >= 8) b.push({ name: 'RAMPAGE', rarity: 'common' });
    if (this.perksTaken >= 3) b.push({ name: 'ITEM HUNTER', rarity: 'uncommon' });
    if (won && faints === 0) b.push({ name: 'FLAWLESS', rarity: 'legendary' });
    if (won && faints === this.players.length - 1 && faints > 0) b.push({ name: 'LAST STAND', rarity: 'rare' });
    if (won && this.shots <= 12) b.push({ name: 'SPEED CLEAR', rarity: 'rare' });
    if (!won && this.depth >= 5) b.push({ name: 'ABYSS DIVER', rarity: 'rare' });
    else if (!won && this.depth >= 2) b.push({ name: 'DEEP DIVER', rarity: 'uncommon' });
    // a wipe still shows what you cleared — waveIndex = waves survived
    if (!won && this.waveIndex >= 1) {
      b.push({ name: `STAGE ${this.waveIndex} CLEAR`, rarity: this.waveIndex >= 5 ? 'rare' : 'uncommon' });
    }
    if (!b.length) b.push({ name: 'TRAINER', rarity: 'common' });
    const ORD: Rarity[] = ['legendary', 'rare', 'uncommon', 'common'];
    return b.sort((a, z) => ORD.indexOf(a.rarity) - ORD.indexOf(z.rarity));
  }


  // one notch of super charge — burst + sound when it flips to READY so the
  // moment reads whether it came from a shot or a KO
  private chargeUp(p: Unit) {
    // pressure: a living legend bends the super economy — every other
    // charge tick is eaten, so bump supers recharge at half speed
    if (this.enemies.some((e) => !e.dead && e.def.pressure) && (this.pressureN = (this.pressureN + 1) % 2)) return;
    if (p.cd <= 0) return;
    p.cd--;
    if (p.cd === 0 && !p.dead) {
      this.burst(p.x, p.y, '#ffd84d', 6, 220, 0.8);
      sfx('ready');
    }
  }

  // one sponge bath — shed-skin procs and the lum perk share it so
  // "cleansed" always means the same five fields
  cleanse(u: Unit) {
    u.dotTicks = 0; u.dotDmg = 0; u.burnT = 0; u.paraT = 0; u.asleep = false;
  }

  private endShot() {
    const u = this.active;
    if (u.giant) {
      u.giant = false; // giant mode lives exactly one shot — shrink back
      u.r /= 1.7;
    }
    u.vx = 0;
    u.vy = 0;
    // bank the flight path before the smear dies — next aim draws the echo
    this.lastPath = this.trail.length > 4 ? this.trail.map((p) => ({ x: p.x, y: p.y })) : [];
    this.trail = []; // smear dies with the shot
    this.connect.live = false; // the boosted shot is spent — chip and glow stop promising it
    // supers recharge per shot taken; leftovers ticks a small heal
    if (this.healCd > 0) this.healCd--;
    for (const p of this.players) {
      this.chargeUp(p);
      // leftover perk + water trait both regen each shot taken
      const regen = this.regen + this.t('water') * 0.03;
      if (!p.dead && regen > 0 && p.hp < p.maxHp) {
        p.hp = Math.min(p.hp + Math.ceil(p.maxHp * regen), p.maxHp);
      }
    }
    // held leftovers tick before poison — a healing boss keeps the
    // anti-stall pressure honest
    for (const e of this.enemies.slice()) { // hurt can split foes — skip them this pass
      if (e.boss && e.relic === 'leftovers' && !e.dead) {
        e.hp = Math.min(e.maxHp, e.hp + Math.ceil(e.maxHp * 0.04));
      }
      // shed skin: sloughs every ailment before the venom can tick
      if (e.def.shed && !e.dead && (e.dotTicks > 0 || e.burnT > 0 || e.paraT > 0 || e.asleep) && this.rng() < 0.3) {
        this.cleanse(e);
        this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'SHED!', t: 0.8, color: '#78c850', big: false });
      }
      if (e.dotTicks > 0) {
        e.dotTicks--;
        // poison heal on a foe: your venom feeds it — burn it down instead
        if (e.def.pheal) e.hp = Math.min(e.maxHp, e.hp + e.dotDmg);
        else this.hurt(e, e.dotDmg, '#a040a0');
      }
      if (e.burnT > 0 && !e.dead) {
        e.burnT--;
        this.hurt(e, Math.max(1, Math.round(e.maxHp * 0.04)), '#f08030');
      }
    }
    // venom works both ways — a poisoned mon bleeds out the same ticks,
    // and a burned one singes until the flame wears out
    for (const p of this.players) {
      // natural cure / shed skin: the carrier sloughs its ailments before
      // they can tick — same rhythm as the foe version
      if (p.def.shed && !p.dead && (p.dotTicks > 0 || p.burnT > 0 || p.paraT > 0 || p.asleep) && this.rng() < 0.3) {
        this.cleanse(p);
        this.pushText({ x: p.x, y: p.y - p.r - 8, text: 'SHED!', t: 0.8, color: '#78c850', big: false });
      }
      if (p.dotTicks > 0 && !p.dead) {
        p.dotTicks--;
        // poison heal: the venom feeds it — Breloom-line turns the sting
        // into a steady mend
        if (p.def.pheal) p.hp = Math.min(p.maxHp, p.hp + p.dotDmg);
        else this.damagePlayer(p, p.dotDmg);
      }
      if (p.burnT > 0 && !p.dead) {
        p.burnT--;
        this.damagePlayer(p, Math.max(1, Math.ceil(p.maxHp * 0.04)), undefined);
      }
      if (p.paraT > 0) p.paraT--;
      // regenerator: a sip each turn — canon heals on switch-out, and the
      // turn cadence is the closest thing a sling court has to a bench
      if (p.def.regen && !p.dead && p.hp < p.maxHp && !this.healBlocked()) {
        p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.round(p.maxHp * 0.04)));
      }
    }
    // zombie loop: a linked foe rises unless its partner fell too — the
    // pair only stays down if both die inside the same shot
    for (const e of this.enemies) {
      if (e.dead && e.link && !e.link.dead && e.revives > 0) {
        e.dead = false;
        e.revives--;
        e.hp = Math.ceil(e.maxHp * 0.4);
        this.pushText({ x: e.x, y: e.y - e.r - 20, text: 'REVIVED!', t: 1, color: '#a0e060', big: true });
        this.burst(e.x, e.y, '#a0e060', 10, 260, 0.8);
        sfx('heal');
      }
    }
    cull(this.enemies, (e) => !e.dead);
    // chain payout: a 4+ link shot cashes out on the spot — the bigger the
    // pinball line, the bigger the bonus, and it reads as earned
    if (this.shotCombo >= 4) {
      const bonus = this.shotCombo * 15;
      this.score += bonus;
      this.pushText({
        x: this.arena.x + this.arena.w / 2,
        y: this.arena.y + 90,
        text: `CHAIN BONUS +${bonus}`,
        t: 1.2,
        color: '#9df0ff',
        big: true,
      });
      sfx('ready');
    }
    // dots cleared the wave mid-check: fresh wave keeps full timers
    if (this.phase === 'won') return;
    // the kill shot can still lose its last mon to mine/lava chip — a wiped
    // team never walks the loot lap; nextTurn owns the ash revive + 'lost'
    if (this.players.every((p) => p.dead)) {
      this.nextTurn();
      return;
    }
    if (this.rewardPending) {
      this.rewardPending = false;
      // a fallen gym leader pays out in style — coin shower first, relic after
      if (this.waveHadGym) this.enterLoot();
      else this.enterReward();
      return;
    }
    // a shot that lands nothing — no contact, no bump chain, no loot —
    // calls itself out so the dead air reads as feedback, not a shrug
    if (this.shotDmg === 0 && this.shotCombo === 0 && this.shotLoot === 0) {
      this.pushText({ x: u.x, y: u.y - u.r - 18, text: 'WHIFF!', t: 0.9, color: '#8a90a8', big: false });
    }
    this.pendingAttacks = [];
    this.pendingBig = [];
    this.pendingMoves = [];
    if (this.barBreak) {
      this.bossBarBreak();
      this.nextTurn();
      return;
    }
    if (this.battleBreak) {
      this.nextBattle();
      this.nextTurn();
      return;
    }
    let warned = false;
    let bigWarned = false;
    this.flee.turn(this.enemies, this.telop);
    // a fled rare still ends the stop — FINISH settles on the last real KO's type
    if (this.battle >= this.battles && this.enemies.every((x) => x.dead)) this.missions.ko(0, this.lastKoType);
    // pressure: a living dread legend drags the pack's whole attack cycle —
    // every clock winds a third slower while the carrier stands
    const drag = clockDrag(this.players) ? 0.66 : 1;
    if (drag < 1) abilityNotice(this, clockDrag(this.players)!, this.abilityText);
    for (const e of this.enemies.slice()) { // bad dreams can KO — skip fresh corpses this pass
      // bad dreams: the nightmare leaks into every dozing foe — sleeping
      // mons bleed a tick while the carrier stands
      const dreamer = !e.dead && e.asleep ? nightmare(this.players) : undefined;
      if (dreamer) {
        this.hurt(e, Math.max(1, Math.round(e.maxHp * 0.08)), '#705898');
        abilityNotice(this, dreamer, this.abilityText);
      }
      if (!e.asleep) e.timer -= drag; // a dozing foe's countdown never winds down
      if (!e.asleep && e.bigT > 0) {
        e.bigT -= drag;
        if (e.bigT <= 0) this.pendingBig.push(e);
        else if (e.bigT <= 1) bigWarned = true;
      }
      if (!e.asleep) for (const c of e.clocks) {
        c.t -= drag;
        if (c.t <= 0) {
          this.pendingMoves.push({ e, c });
          c.t = c.turn;
        } else if (c.t <= 1) bigWarned = true;
      }
      if (e.timer <= 0) {
        // full para: the jolt eats the swing — the wind-up restarts a
        // round out, and the charge burns one tick of what held it
        if (e.paraT > 0 && this.rng() < 0.5) {
          e.paraT--;
          e.timer = 1;
          this.pushText({ x: e.x, y: e.y - e.r - 10, text: 'CAN\'T MOVE!', t: 0.8, color: '#f8d030', big: false });
        } else {
          this.pendingAttacks.push(e);
        }
      } else if (e.timer <= 1) {
        warned = true; // it swings after this shot — one soft warning tick
        // the first live 1-clock a run: name the counter before it bites
        if (!e.dead && this.telop.once('clock1'))
          this.telop.push({ kind: 'foe', title: 'IT ATTACKS NEXT', sub: 'ITS NUMBER TICKS WHEN YOU SHOOT · DOWN IT BEFORE 0', mon: e.def.id });
      }
    }
    if (warned || bigWarned) sfx('warn');
    if (this.pendingAttacks.length > 0 || this.pendingBig.length > 0 || this.pendingMoves.length > 0) {
      this.phase = 'enemy';
      this.enemyPhaseT = ENEMY_TURN_DELAY;
    } else {
      this.nextTurn();
    }
  }

  private installRoom(room: ReturnType<typeof buildRoom>) {
    this.field2 = installField2(this.roomGrid, this.theme, this.arena, this.battle, room.hazards);
    this.damageWalls = room.damageWalls.map((w) => ({ ...w, t0: this.time }));
    this.wallShot0 = this.shots;
    this.wallTurn = 0;
    for (const z of room.hazards) {
      if (z.kind === 'heal') void loadItem('oran-berry');
      if (z.kind === 'gravity') void loadItem('hard-stone');
      if (z.kind === 'well' && !z.moat) void loadItem('twisted-spoon');
    }
    this.blocks = room.blocks.map((b) => ({
      x: this.arena.x + this.arena.w * b.nx,
      y: this.arena.y + this.arena.h * b.ny,
      w: this.arena.w * b.nw,
      h: this.arena.h * b.nh,
      field: b.field,
      hp: b.field === 'smash' ? SMASH_HITS : b.field === 'cut' ? CUT_HITS : undefined,
    }));
    this.roomLayer = null; // new room — the furniture bake is stale
    for (const p of this.players) {
      if (!p.dead) {
        const at = this.unstick(p.x, p.y, p.r + 2);
        p.x = at.x;
        p.y = at.y;
      }
    }
  }

  // a fresh room scrolls in under the team: furniture, hazards, drop-in clock
  private swapCourt(grid: string[]) {
    this.roomGrid = grid;
    const phase = this.enemies.find((e) => e.boss && !e.dead)?.sumStage ?? this.battle - 1;
    const room = buildRoom(grid, this.theme, this.rng, phase);
    this.installRoom(room);
    this.courtT = this.time;
    this.pickupSeen.clear();
    this.foesLanded = false;
    this.hazards = room.hazards.map((z) => ({
      kind: z.kind,
      x: this.arena.x + this.arena.w * z.nx,
      y: this.arena.y + this.arena.h * z.ny,
      r: this.arena.w * z.r,
      dir: z.dir,
      pair: z.pair,
      moat: z.moat,
    }));
    return room;
  }

  private pickNextRoom() {
    const pool = ROOM_LAYOUTS.slice(1).filter((grid) => grid !== this.roomGrid);
    return pool[Math.floor(this.rng() * pool.length)];
  }

  private nextBattle() {
    this.treasure.collect(this.time, this.arena.x + this.arena.w / 2, this.arena.y);
    this.koSeen = false;
    this.fin.t = 0;
    this.battleBreak = false;
    this.battle++;
    resetAbilities(this);
    const room = this.swapCourt(this.flee.room(this.battle, this.pickNextRoom()));
    const anchors = [...room.anchors];
    const spawns = rollWave(this.rng, this.depth, this.theme).filter((s) => !s.boss).slice(0, ENEMY_MAX);
    this.enemies = spawns.map((s, si) => {
      const a = anchors.splice(Math.floor(this.rng() * anchors.length), 1)[0];
      const e = this.makeEnemy(a ? { ...s, nx: a.nx, ny: a.ny } : s, this.waveIndex);
      if (!e.boss) e.timer += si % 3; // same staggered opener as spawnWave
      return e;
    });
    if (this.flee.at === this.battle && !isGentleRoom(this.roomGrid)) this.enemies.push(this.flee.spawn(this.flee.build(this as any, () => this.makeEnemy(this.flee.spawnAt(), this.waveIndex))));
    this.armWeakPoints();
    this.waveShots = 0;
    this.telop.push({ kind: 'start', title: `BATTLE ${this.battle}/${this.battles}`, sub: STAGE_GIMMICKS[this.theme].label, mon: this.active.def.id, icon: 'poke-ball' });
    this.makeMidBoss();
    sfx('invade');
  }

  private makeMidBoss() {
    if (!midBossStop({ stop: this.waveIndex, battle: this.battle, battles: this.battles, gym: this.waveHadGym, trainer: this.inTrainer, event: this.inEvent })) return;
    const i = midBossPick(this.enemies);
    if (i < 0) return;
    const mid = this.enemies[i];
    mid.def = evolveOnce(mid.def);
    mid.r *= MID_SCALE;
    mid.maxHp = mid.hp = Math.round(mid.maxHp * MID_HP);
    mid.mid = true;
    mid.bigT = MID_SIG;
    mid.timer = (mid.def.melee ? MELEE_TIMER : ENEMY_BASE_TIMER) * this.foeCdMult * this.ascTimerMult() * (this.raidMod === 'hasty' ? 0.85 : 1) * (mid.def.prank ? 0.55 : 1) + (this.waveIndex === 0 ? 1 : 0);
    mid.clocks = mid.def.fuse ? [] : foeClocks(mid.def.type, false, 0, mid.def.type2).map(({ kind, move, turn, first, type }) => ({ kind, move, turn, t: first, type }));
    mid.drift = enemyDrift(mid.def.stats) * (this.asc >= 7 ? 1.25 : 1);
    mid.sash = !!mid.def.sturdy;
    mid.pow = lvlPow(offStat(mid.def.stats, mid.def.type), mid.lvl);
    mid.asleep = !!mid.def.sleepy && !mid.def.sleepless;
    mid.repelR = mid.def.repel ? 90 : 0;
    this.telop.push({ kind: 'boss', title: 'MID-BOSS', sub: `${mid.def.name.toUpperCase()} · SIGNATURE IN ${MID_SIG}`, mon: mid.def.id, icon: 'great-ball' });
    cry(mid.def.id, 'boss');
  }

  private bossBarBreak() {
    const boss = this.enemies.find((e) => e.boss && !e.dead && e.hp > 0);
    if (!boss) {
      this.barBreak = false;
      return;
    }
    for (const e of this.enemies) {
      if (e.boss || e.dead) continue;
      if (e.stolen) this.pickups.push({ x: e.x, y: e.y, kind: e.stolen, t: 0, age: 0 });
      this.burst(e.x, e.y, '#8890b8', 10, 340);
      this.pushText({ x: e.x, y: e.y - e.r - 20, text: 'FLED', t: 0.9, color: '#c8d0e8', big: false });
      e.dead = true;
    }
    cull(this.enemies, (e) => e.boss && !e.dead);
    const grid = this.gymFurnished
      ? this.pickNextRoom()
      : bossRooms(this)[Math.min(boss.sumStage, bossRooms(this).length - 1)];
    const room = this.swapCourt(grid);
    // no teleport beat: the boss is off court until the drop-in lands it
    const at = this.unstick(
      this.arena.x + this.arena.w * (0.15 + this.rng() * 0.7),
      this.arena.y + this.arena.h * (0.12 + this.rng() * 0.4),
      boss.r + 2,
    );
    boss.x = at.x;
    boss.y = at.y;
    boss.weakA = (boss.weakA + BOSS_WEAK_SHIFT) % (Math.PI * 2);
    if (boss.weakA2 !== undefined) boss.weakA2 = (boss.weakA2 + BOSS_WEAK_SHIFT) % (Math.PI * 2);
    boss.timer = this.enemyReload(boss);
    boss.bigT = BOSS_BIG_TIMER;
    boss.clocks = foeClocks(boss.def.type, true, boss.sumStage).map(({ kind, move, turn, first, type }) => ({ kind, move,
      turn: Math.max(1, turn - (boss.phaseRage ? BOSS_RAGE_TURN_CUT : 0)), t: Math.max(1, first - (boss.phaseRage ? BOSS_RAGE_TURN_CUT : 0)), type }));
    this.summonBossAdds(boss, room.anchors);
    this.telop.push({ kind: 'phase', title: boss.phaseRage ? 'RAGE' : 'PHASE CLEAR', sub: `BATTLE ${boss.sumStage + 1}/${(boss.bars ?? BOSS_BARS).length} · WEAK SPOT MOVED`, mon: boss.def.id, icon: this.bossIcon(boss), color: boss.phaseRage ? TYPE_COLOR[boss.def.type] : undefined });
    this.screenFlash('#ffd84d', 0.2);
    this.addShake(10);
    sfx('invade');
    this.barBreak = false;
  }

  private enrageBoss(e: Unit) {
    if (e.sumStage !== (e.bars ?? BOSS_BARS).length - 1 || e.phaseRage) return;
    e.phaseRage = e.enraged = true;
    const st = e.def.stats;
    e.def = { ...e.def, stats: { ...st, atk: Math.round(st.atk * BOSS_RAGE_STAT), spa: Math.round(st.spa * BOSS_RAGE_STAT) } };
    e.timer = Math.max(1, e.timer - BOSS_RAGE_TURN_CUT);
    for (const c of e.clocks) {
      c.turn = Math.max(1, c.turn - BOSS_RAGE_TURN_CUT);
      c.t = Math.max(1, c.t - BOSS_RAGE_TURN_CUT);
    }
    this.screenFlash(TYPE_COLOR[e.def.type], 0.15);
  }

  private summonBossAdds(boss: Unit, anchors: { nx: number; ny: number }[]) {
    const n = Math.min(BOSS_GUARDS[boss.sumStage], Math.max(0, ENEMY_MAX - this.enemies.filter((e) => !e.dead).length));
    const line = EVO_LINES.find((l) => l.ids.includes(boss.def.id));
    const guards = ENEMY_DB.filter((d) => d.id !== boss.def.id && !BOSS_POOL.includes(d) && !d.fuse && (line?.ids.includes(d.id) || d.type === boss.def.type));
    for (let i = 0; i < n; i++) {
      const def = guards[i % guards.length] ?? boss.def;
      const at = anchors[i % anchors.length] ?? { nx: i % 2 ? 0.75 : 0.25, ny: 0.3 + Math.floor(i / 2) * 0.18 };
      const e = this.makeEnemy(
        { def, nx: at.nx, ny: at.ny },
        this.waveIndex,
      );
      e.shieldN = Math.max(e.shieldN, REFLECT_HITS);
      e.timer = Math.min(e.timer, 2); // adds arrive hot — they act soon
      e.minion = true; // while any minion lives, the boss takes half hits
      this.enemies.push(e);
    }
  }

  // Relocation beat — the boss blinks to a fresh spot with a landing
  // sting. The board keeps shifting, so no pocket stays safe to camp in.
  private relocateBoss(e: Unit) {
    this.waves.push({ x: e.x, y: e.y, r: 0, maxR: e.r * 2.6, t: 0.25, life: 0.25, color: '#f85888', hits: new Set() });
    this.burst(e.x, e.y, '#f85888', 12, 400);
    const at = this.unstick(
      this.arena.x + this.arena.w * (0.15 + this.rng() * 0.7),
      this.arena.y + this.arena.h * (0.12 + this.rng() * 0.4),
      e.r + 2,
    );
    e.x = at.x;
    e.y = at.y;
    this.waves.push({ x: e.x, y: e.y, r: 0, maxR: e.r * 3, t: 0.3, life: 0.3, color: '#f85888', hits: new Set() });
    this.impact(e.x, e.y, '#f85888', 1.2);
    this.pushText({ x: e.x, y: e.y - e.r - 14, text: 'TELEPORT!', t: 0.9, color: '#f85888', big: false });
    this.addShake(6);
    sfx('zap');
  }

  private bossHop(e: Unit) {
    this.relocateBoss(e);
    for (const p of this.players) {
      if (!p.dead && dist(e, p) <= e.r + p.r + 40) {
        this.damagePlayer(p, specDamage(this.foeSpa(e), p.def.stats.spd, 1, zapPower), e);
        if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
      }
    }
  }

  // Enemy targeting: living players sorted near→far — foes aim at the
  // closest, multi-target attacks take the front of the list.
  private playersByDist(e: Unit) {
    return this.players.filter((p) => !p.dead).sort((a, b) => dist(e, a) - dist(e, b));
  }

  private nearestPlayer(e: Unit) {
    // min-scan — the sorted list exists for multi-target attacks; the
    // per-frame telegraph only ever wants the closest one. Pack hunters
    // smell blood instead: they track the weakest link, and the leash
    // telegraph rides the same pick so the warning stays honest. A living
    // bait mon (Follow Me) pulls every lock — even hunters take the bait
    let best: Unit | undefined;
    let bd = Infinity;
    for (const p of this.players) {
      if (p.dead) continue;
      if (p.def.taunt) return p;
      // snipers pick the FARTHEST mon — camping the back row stops working
      const d = e.def.hunter ? p.hp : e.def.snipe ? -dist(e, p) : dist(e, p);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // Each boss has a signature attack on its countdown; invaders and
  // unknowns fall back to the generic radial blast. Every 3rd attack is a
  // hop instead — the signature stays scary but never gets stale.
  private bossAttack(e: Unit) {
    if (++e.atkN % 3 === 0) {
      this.bossHop(e);
      return;
    }
    const target = this.nearestPlayer(e);
    this.screenFlash('#f85888', 0.18);
    this.impact(e.x, e.y, '#f85888', 1.6);
    this.burst(e.x, e.y, '#f85888', 18, 500, 1.2);
    this.addPunch(0.1);
    this.addShake(12);
    buzz([30, 40, 60]);
    this.scar(e.x, e.y, 26);
    const hit = (p: Unit, dmg: number) => {
      this.damagePlayer(p, dmg, e);
      if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
    };
    switch (e.def.id) {
      case 149: // Dragonite — hyper beam
      case 125: { // Electabuzz — thunderbolt: same line, faster arc
        if (!target) break;
        sfx('beam');
        const zap = e.def.id === 125;
        this.beams.push({
          x1: e.x, y1: e.y, x2: target.x, y2: target.y,
          t: zap ? 0.5 : 0.7, life: zap ? 0.5 : 0.7,
          color: zap ? '#f8ff70' : '#f8d030', w: zap ? 1.7 : 2.2,
        });
        this.hitStop = Math.max(this.hitStop, zap ? 0.18 : 0.25);
        const dx = target.x - e.x, dy = target.y - e.y;
        const dl = Math.max(dx * dx + dy * dy, 1);
        for (const p of this.players) {
          if (p.dead) continue;
          const t = Math.max(0, Math.min(1, ((p.x - e.x) * dx + (p.y - e.y) * dy) / dl));
          const px = e.x + dx * t, py = e.y + dy * t;
          if (Math.hypot(p.x - px, p.y - py) < p.r + 26) {
            hit(p, specDamage(this.foeSpa(e), p.def.stats.spd, 1, blastPower));
          }
        }
        break;
      }
      case 130: // Gyarados — thrash: a wall of water sweeping the whole court
      case 6: // Charizard — flame ring that scorches the floor on the way out
      case 3: // Venusaur — frenzy plant: a creeping green ring
      case 112: { // Rhydon — earthquake: the widest slam, hits off raw atk
        const [R, color, scorched] =
          e.def.id === 130 ? [300, '#6890f0', false]
          : e.def.id === 6 ? [200, '#f08030', true]
          : e.def.id === 3 ? [220, '#78c850', false]
          : [240, '#b8a038', true];
        sfx('boom');
        this.waves.push({
          x: e.x, y: e.y, r: 0, maxR: R, t: 0.5, life: 0.5,
          color, hits: new Set(), hostile: true,
          onHit: (p) => hit(p, specDamage(e.def.id === 112 ? this.foeAtk(e) : this.foeSpa(e), p.def.stats.spd, 1, blastPower)),
        });
        if (scorched) this.scar(e.x, e.y, 38);
        break;
      }
      case 150: // Mewtwo — twin psychic orbs that hunt the nearest pair
      case 94: { // Gengar — shadow ball: a third orb joins the hunt
        sfx('zap');
        const n = e.def.id === 94 ? 3 : 2;
        const color = e.def.id === 94 ? '#705898' : '#f85888';
        this.playersByDist(e)
          .slice(0, n)
          .forEach((p, i) => {
            this.orbs.push({
              x: e.x, y: e.y, target: p,
              dmg: Math.round(specDamage(this.foeSpa(e), p.def.stats.spd, 1, blastPower)),
              t: 2.5, wob: i * 2.1, color, hostile: true, src: e,
            });
            this.glint(e.x + (i - (n - 1) / 2) * 12, e.y - e.r * 0.3, 7, color); // a muzzle glint per orb
          });
        break;
      }
      default: { // generic gym blast — radial nova
        const R = 170;
        sfx('boom');
        for (const p of this.players) {
          if (!p.dead && dist(e, p) <= R + p.r) {
            this.scar(p.x, p.y, 14);
            hit(p, specDamage(this.foeSpa(e), p.def.stats.spd, 1, blastPower));
          }
        }
      }
    }
  }

  private fireMove(e: Unit, c: Unit['clocks'][number]) {
    if (e.dead) return;
    const anim = recipeFor(c.type ?? e.def.type, c.move);
    const color = TYPE_COLOR[c.type ?? e.def.type];
    this.pushText({ x: e.x, y: e.y - e.r - 20, text: c.move, t: 1, color, big: false });
    const pow = e.boss ? BOSS_MOVE_POW : FOE_MOVE_POW;
    let thorns = false;
    const hit = (p: Unit) => {
      const dmg = Math.round(specDamage(this.foeSpa(e), p.def.stats.spd, 1, blastPower) * pow * (c.kind === 'meteor' ? 0.6 : 1));
      const hp0 = p.hp;
      this.damagePlayer(p, dmg, e);
      impactRing(this.fx, this.fxRng, p.x, p.y, color, { radius: p.r * 1.7, width: 3, life: 0.26, motes: 2 }); // the land
      if (c.drain) this.drainHit(e, c.move, Math.max(0, hp0 - Math.max(0, p.hp)));
      if (!thorns && this.thorns > 0) {
        this.hurt(e, this.thorns, '#c8a44d');
        thorns = true;
      }
    };
    if (c.kind === 'laser') {
      const target = this.nearestPlayer(e);
      if (!target) return;
      const dir = norm({ x: target.x - e.x, y: target.y - e.y });
      const x2 = e.x + dir.x * 1400;
      const y2 = e.y + dir.y * 1400;
      const a = this.arena;
      const reach = Math.min(dir.x > 0 ? (a.x + a.w - e.x) / dir.x : dir.x < 0 ? (a.x - e.x) / dir.x : Infinity,
        dir.y > 0 ? (a.y + a.h - e.y) / dir.y : dir.y < 0 ? (a.y - e.y) / dir.y : Infinity);
      animBeam(anim, e.x, e.y, e.x + dir.x * reach, e.y + dir.y * reach);
      this.beams.push({ x1: e.x, y1: e.y, x2, y2, t: 0.5, life: 0.5, color, w: 0.6 });
      this.beams.push({ x1: e.x, y1: e.y, x2, y2, t: 0.35, life: 0.35, color: '#fff', w: 0.25 });
      for (const p of this.players) {
        if (p.dead) continue;
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const along = dx * dir.x + dy * dir.y;
        const across = Math.abs(dx * dir.y - dy * dir.x);
        if (along > 0 && across < p.r + LASER_HALF_W) hit(p);
      }
      this.screenFlash(color, 0.12);
      this.addShake(8);
      this.hitStop = Math.max(this.hitStop, 0.12);
      sfx('beam');
    } else if (c.kind === 'cross') {
      const a = this.arena;
      animBeam(anim, a.x, e.y, a.x + a.w, e.y);
      animBeam(anim, e.x, a.y, e.x, a.y + a.h);
      this.beams.push({ x1: a.x, y1: e.y, x2: a.x + a.w, y2: e.y, t: 0.5, life: 0.5, color, w: 1.6 });
      this.beams.push({ x1: e.x, y1: a.y, x2: e.x, y2: a.y + a.h, t: 0.5, life: 0.5, color, w: 1.6 });
      for (const p of this.players) {
        if (!p.dead && (Math.abs(p.y - e.y) < p.r + LASER_HALF_W || Math.abs(p.x - e.x) < p.r + LASER_HALF_W)) hit(p);
      }
      this.screenFlash(color, 0.12);
      this.addShake(8);
      this.hitStop = Math.max(this.hitStop, 0.12);
      sfx('beam');
    } else if (c.kind === 'quake') {
      animRing(anim, e.x, e.y, QUAKE_R);
      pillarSpout(this.fx, this.fxRng, e.x, e.y + e.r * 0.4, TYPE_RAMP[c.type ?? e.def.type], { n: 12, spread: e.r * 2.4 }); // the slam kicks debris
      this.waves.push({
        x: e.x, y: e.y, r: 0, maxR: QUAKE_R, t: 0.5, life: 0.5, color,
        hits: new Set(), hostile: true, onHit: (p) => hit(p),
      });
      this.burst(e.x, e.y, color, 16, 420);
      this.scar(e.x, e.y, 30);
      this.screenFlash(color, 0.12);
      this.addShake(12);
      sfx('boom');
    } else {
      this.screenFlash(color, 0.12);
      sfx('boom');
      this.players.filter((p) => !p.dead).forEach((p, i) => this.later(i * 0.12, () => {
        if (p.dead) return;
        animRain(anim, p.x, p.y);
        this.burst(p.x, p.y, color, 14, 380, 1);
        impactRing(this.fx, this.fxRng, p.x, p.y, TYPE_RAMP[c.type ?? e.def.type], { radius: 50, motes: 3 });
        smokeColumn(this.fx, this.fxRng, p.x, p.y + 4, '#7a6248', { n: 2, spread: 22 }); // the crater coughs dirt
        this.waves.push({ x: p.x, y: p.y, r: 0, maxR: 46, t: 0.3, life: 0.3, color, hits: new Set() });
        this.scar(p.x, p.y, 18);
        this.addShake(8);
        hit(p);
      }));
    }
  }

  private resolveEnemyTurn() {
    const attacks = this.pendingAttacks;
    this.pendingAttacks = [];
    const bigAttacks = this.pendingBig;
    this.pendingBig = [];
    const moves = this.pendingMoves;
    this.pendingMoves = [];
    if (!attacks.length && !bigAttacks.length && !moves.length) return; // already consumed — the volley is mid-flight
    // staggered volley: each attacker fires on its own beat so every hit
    // is attributable instead of one silent wall of damage. Every swing
    // telegraphs a beat early — the attacker flares white, and each move
    // kind stages its own read on top: meteors paint the ground they'll
    // hit, quakes crack the court early, beams swell a charge flare.
    const windup = (e: Unit, at: number, type?: PokeType, kind?: FoeMoveKind) => {
      const at0 = Math.max(0, at - 0.24);
      this.later(at0, () => {
        if (e.dead) return;
        e.flashT = 0.16; // the wind-up flare — same white the hit-flash wears
        e.sq = Math.max(e.sq, 0.65);
        const ramp = TYPE_RAMP[type ?? e.def.type];
        const life = at - at0;
        if (kind === 'meteor') {
          // sky fire marks its targets, not the caster — each ring finishes
          // blooming the frame its rock lands (strikes stagger i*0.12)
          this.players.filter((p) => !p.dead).forEach((p, i) => {
            const lag = life + i * 0.12;
            this.fx.push({ x: p.x, y: p.y, vx: 0, vy: 0, t: lag, life: lag, size: 44, color: '#ff6b6b', shape: 'ring', spin: 0, grav: 0, width: 2.5 });
            chargeMotes(this.fx, this.fxRng, p.x, p.y, ramp, { r: 30, n: 4, life: lag });
          });
        } else if (kind === 'quake') {
          // the court starts cracking before the slam — soot vents and
          // dirt chips off the caster's footing, a ground line crawling out
          smokeColumn(this.fx, this.fxRng, e.x, e.y + e.r * 0.5, '#8a6a48', { n: 3, spread: e.r * 2.2 });
          for (let i = 0; i < 4; i++) {
            const ang = this.fxRng() * Math.PI * 2, rr = e.r * (0.8 + this.fxRng());
            this.fx.push({
              x: e.x + Math.cos(ang) * rr, y: e.y + Math.sin(ang) * rr,
              vx: (this.fxRng() - 0.5) * 60, vy: -80 - this.fxRng() * 80,
              t: 0.4, life: 0.4, size: 1.6 + this.fxRng() * 1.6,
              color: '#a08858', shape: 'shard', spin: (this.fxRng() - 0.5) * 14, grav: 500, seed: this.fxRng(),
            });
          }
          this.fx.push({ x: e.x, y: e.y, vx: 0, vy: 0, t: life, life, size: QUAKE_R * 0.55, color: pickRamp(ramp, this.fxRng), shape: 'ring', spin: 0, grav: 0, width: 3 });
        } else {
          chargeMotes(this.fx, this.fxRng, e.x, e.y, ramp, { r: e.r * 2.4, n: e.boss ? 10 : 6, life });
          if (kind === 'laser' || kind === 'cross') {
            // charge-up flare: lines pull into the muzzle as a glint swells
            screenLines(this.fx, this.fxRng, e.x, e.y, ramp, { n: 6, speed: 420, inward: true });
            this.fx.push({ x: e.x, y: e.y - e.r * 0.3, vx: 0, vy: 0, t: life, life, size: e.r * 1.1, color: '#ffffff', shape: 'sparkle', spin: 3, grav: 0 });
          }
        }
      });
    };
    attacks.forEach((e, i) => { const at = 0.18 + i * 0.28; windup(e, at); this.later(at, () => this.fireEnemy(e)); });
    bigAttacks.forEach((e, i) => { const at = 0.18 + (attacks.length + i) * 0.28; windup(e, at, e.def.type, TYPE_MOVE[e.def.type].kind); this.later(at, () => this.bossBigAttack(e)); });
    moves.forEach(({ e, c }, i) => { const at = 0.18 + (attacks.length + bigAttacks.length + i) * 0.28; windup(e, at, c.type, c.kind); this.later(at, () => this.fireMove(e, c)); });
    this.later(Math.max(0, attacks.length + bigAttacks.length + moves.length - 1) * 0.28 + 0.35, () => {
      if (this.phase !== 'enemy') return;
      if (this.players.every((p) => p.dead) && !this.ashRevive()) {
        this.wipe();
        return;
      }
      this.ripenPickups();
      this.nextTurn();
    });
  }

  private ripenPickups() {
    for (const pk of this.pickups) {
      pk.age++;
      const ripen = PICKUP_RIPEN[pk.kind];
      if (!ripen || pk.age < ripen.turns) continue;
      pk.kind = ripen.to;
      pk.age = 0;
      this.burst(pk.x, pk.y, PICKUP_META[pk.kind].color, 8, 240, 0.8);
      this.pushText({ x: pk.x, y: pk.y - 12, text: 'RIPE', t: 0.9, color: PICKUP_META[pk.kind].color, big: false });
    }
    // a Safeguard always leaves a berry on court to break it
    if (this.enemies.some((e) => e.safeguard && !e.dead) && !this.pickups.some((pk) => pk.kind === 'oran-berry' || pk.kind === 'sitrus-berry')) this.dropAt('oran-berry');
  }

  // per-battle rolls for the bullet gimmicks (BULLET_GIMMICKS); gentle
  // opener rooms stay plain
  private armBullets(rng = mulberry32((this.mapSeed * 31 + this.battle * 7 + this.waveIndex) >>> 0)) {
    this.bulletRng = rng;
    this.bulletN = { drain: 0, heart: 0, 'pp-up': 0, chesto: 0, safeguard: 0 };
    if (isGentleRoom(this.roomGrid)) return;
    const roll = (g: BulletGimmick) => rng() < BULLET_GIMMICKS[g].rate;
    if (roll('drain')) {
      for (const e of this.enemies) {
        const move = DRAIN_MOVE[e.def.type];
        if (!move || e.boss || !e.clocks[0] || this.bulletN.drain >= BULLET_GIMMICKS.drain.cap) continue;
        e.clocks[0].move = move;
        e.clocks[0].drain = true;
        this.bulletN.drain++;
      }
    }
    if (roll('pp-up')) { this.dropAt('pp-up'); this.bulletN['pp-up']++; }
    if (roll('chesto')) { this.dropAt('chesto-berry'); this.bulletN.chesto++; }
    const guard = this.enemies.filter((e) => !e.boss && !e.dead).sort((a, b) => b.maxHp - a.maxHp)[0];
    if (guard && BULLET_GIMMICKS.safeguard.themes?.includes(this.theme) && roll('safeguard')) {
      guard.safeguard = true;
      this.bulletN.safeguard++;
      this.dropAt('oran-berry');
    }
  }

  private armWeakPoints(rng = wpRng(this.mapSeed, this.battle, this.waveIndex)) {
    hideWeakPoints(this.enemies, hideWpRate(HIDE_WP_RATE, this.waveIndex, isGentleRoom(this.roomGrid)), rng);
  }

  private dropAt(kind: PickupKind) {
    void loadItem(kind);
    const at = this.unstick(
      this.arena.x + this.arena.w * (0.15 + this.bulletRng() * 0.7),
      this.arena.y + this.arena.h * (0.2 + this.bulletRng() * 0.45),
      16,
    );
    this.pickups.push({ x: at.x, y: at.y, kind, t: this.bulletRng() * 6, age: 0 });
    this.burst(at.x, at.y, '#fff8dc', 5, 160, 0.7); // the drop lands soft
  }

  // a fainted foe can leave a berry where it fell
  private heartDrop(e: Unit) {
    const g = BULLET_GIMMICKS.heart;
    if (isGentleRoom(this.roomGrid) || this.bulletN.heart >= g.cap || this.enemies.every((x) => x.dead) || this.bulletRng() >= g.rate) return;
    this.bulletN.heart++;
    this.pickups.push({ x: e.x, y: e.y, kind: 'oran-berry', t: 0, age: 0 });
    this.glint(e.x, e.y - 10, 8, '#6fdc6f');
    this.pushText({ x: e.x, y: e.y - 24, text: 'BERRY DROP', t: 0.9, color: '#6fdc6f', big: false });
    if (this.telop.once('pk:heart')) this.telop.push({ kind: 'combo', title: 'BERRY DROP', sub: 'GRAB IT · TEAM HEAL', icon: 'oran-berry' });
  }

  private drainHit(e: Unit, move: string, dealt: number) {
    if (e.dead || dealt <= 0) return;
    const sip = Math.max(1, Math.round(dealt * DRAIN_PCT));
    e.hp = Math.min(e.maxHp, e.hp + sip);
    this.pushText({ x: e.x, y: e.y - e.r - 8, text: `+${sip}`, t: 0.8, color: '#6fdc6f', big: false });
    if (this.telop.once('drain')) this.telop.push({ kind: 'foe', title: move, sub: 'FOE HEALS OFF ITS HIT', mon: e.def.id, icon: 'big-root' });
  }

  private breakSafeguard() {
    for (const e of this.enemies) {
      if (!e.safeguard || e.dead) continue;
      e.safeguard = false;
      this.waves.push({ x: e.x, y: e.y, r: 0, maxR: e.r * 2.4, t: 0.3, life: 0.3, color: '#f8a8d8', hits: new Set() });
      this.telop.push({ kind: 'shield', title: 'SAFEGUARD BROKEN', sub: e.def.name.toUpperCase(), mon: e.def.id, icon: 'oran-berry' });
    }
  }

  private bossBigAttack(e: Unit) {
    if (e.dead || this.barBreak || e.bigT > 0) return;
    const move = TYPE_MOVE[e.def.type];
    const anim = recipeFor(e.def.type, move.move);
    const color = TYPE_COLOR[e.def.type];
    this.screenFlash(color, 0.25);
    this.burst(e.x, e.y, color, 24, 520, 1.2);
    this.waves.push({
      x: e.x, y: e.y, r: 0, maxR: Math.max(this.arena.w, this.arena.h),
      t: 0.55, life: 0.55, color, hits: new Set(),
    });
    this.addShake(14);
    sfx('boom');
    for (const p of this.players) {
      if (p.dead) continue;
      if (move.kind === 'meteor') {
        animRain(anim, p.x, p.y);
        smokeColumn(this.fx, this.fxRng, p.x, p.y + 4, '#7a6248', { n: 2, spread: 22 }); // rockfall leaves dust on the mark
      } else if (move.kind === 'quake') animBurst(anim, p.x, p.y, true);
      else animBeam(anim, e.x, e.y, p.x, p.y);
      this.damagePlayer(p, specDamage(this.foeSpa(e), p.def.stats.spd, 1, zapPower) * BOSS_BIG_POW, e);
      impactRing(this.fx, this.fxRng, p.x, p.y, TYPE_RAMP[e.def.type], { radius: p.r * 2, motes: 3 }); // each landing blooms
    }
    if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
    e.bigT = BOSS_BIG_TIMER;
  }

  // Fodder artillery: the old instant zap is a hostile orb now — the bolt
  // is visible, hunts its mark and lands when it connects, same as the
  // boss kit. Damage matches the hit it replaces; thorns still prick the
  // caster for committing to the attack.
  // guts: a statused brawler gets angrier — every attack it throws while
  // poisoned or burned lands half again. The trap: dotting it speeds the
  // kill but sharpens the reprisal
  // swift swim / chlorophyll / sand rush: a ball that matches the sky
  // launches a touch faster — drafting into the weather pays twice
  private swiftMult(u: Unit) {
    const want = this.weather ? { sun: 'fire', rain: 'water', sand: 'rock', wind: 'flying', storm: 'electric' }[this.weather] : undefined;
    return (want && (u.def.type === want || u.def.type2 === want) ? 1.12 : 1) * weatherSpeed(u.def.ability, this.weather);
  }

  // The level tax every enemy hit pays — pow carries the Gen-3 growth
  // curve that lvlHp always spent but raw atk never did. sqrt-damped so
  // route-1 fodder (pow 1) is unchanged while a deep-climb ace finally
  // bites: ~x2.5 at Lv50, ~x3.2 at Lv85.
  private foeLvl(e: Unit) {
    return Math.sqrt(e.pow);
  }

  private foeAtk(e: Unit) {
    return e.def.stats.atk
      * this.foeLvl(e)
      * e.atkMul // moxie: a fed predator swings that much harder
      * (e.burnT > 0 ? 0.75 : 1) // a singed foe swings dulled — same burn rule the ball plays by
      // intimidate on your bench: a living menace mon cowes the whole pack —
      // stat walls (hyper cutter, clear body, white smoke) can't be lowered
      * (this.players.some((m) => !m.dead && m.def.menace) && !statWall(e.def) ? 0.8 : 1)
      * abilityIntimidate(this, this.players, this.abilityText)
      * (e.def.guts && (e.dotTicks > 0 || e.burnT > 0) ? 1.5 : 1)
      // pack alpha: a living leader rallies every packmate's hits — the
      // leader itself doesn't march under its own flag
      * (!e.def.alpha && this.enemies.some((a) => !a.dead && a.def.alpha) ? 1.3 : 1);
  }

  // The special side of the same number — burn, intimidate and guts are
  // physical-only levers, so boss blasts and clock moves pay the bare
  // level tax and nothing else.
  private foeSpa(e: Unit) {
    return e.def.stats.spa * this.foeLvl(e);
  }

  // The multiplier stack every enemy hit pays on the way in — foe/boss
  // pressure, depth ramp, asc tax, anti-stall heat. damagePlayer applies
  // it at land time; foeDmg prices the same stack up front so the leash
  // tag and scout card show the number the hit will actually land for.
  private foeHitMult(src?: Unit) {
    const pressure = 1 + Math.max(0, this.waveShots - 10) * 0.12;
    return (src?.side === 'enemy' ? foePow : 1) * (src?.boss ? bossPow : 1) * this.takenMult * (1 - this.t('rock') * 0.07) * pressure * 1.15 * (1 + this.depth * 0.12 + this.waveIndex * 0.08 + this.asc * 0.08);
  }

  // Priced estimate of one incoming hit — same roll damagePlayer would
  // make. Sash/guard trims, absorb and the MISS die stay out: it's a
  // read, not a promise.
  private foeDmg(e: Unit, target: Unit, pow = zapPower, spec = false) {
    const raw = spec ? specDamage(this.foeSpa(e), target.def.stats.spd, 1, pow) : physDamage(this.foeAtk(e), target.def.stats.def, 1, pow);
    return Math.max(1, Math.round(raw * this.foeHitMult(e)));
  }

  // The timer attack's power — each special carries its own multiplier
  private zapPow(e: Unit) {
    // fireEnemy precedence: fuse → support → charge → beam → volley →
    // melee → zap — the shown number prices the same branch that lands
    return e.def.fuse ? zapPower * 1.8 : e.def.charge ? zapPower * 1.1 : e.def.beam ? zapPower * 1.2 : e.def.volley ? zapPower * 0.55 : e.def.melee ? zapPower * 1.3 : zapPower;
  }

  private foeZap(e: Unit, target: Unit) {
    sfx('zap');
    this.pushText({ x: e.x, y: e.y - e.r - 10, text: `${e.def.name.toUpperCase()}!`, t: 0.8, color: '#ff6b6b', big: false });
    this.burst(e.x, e.y, '#ff6b6b', 5, 240, 0.7); // the muzzle pop as the bolt leaves
    this.glint(e.x, e.y - e.r * 0.3, 7, '#ff6b6b'); // a muzzle glint as the orb spawns
    this.orbs.push({
      x: e.x, y: e.y, target,
      dmg: this.foeDmg(e, target),
      flat: true, // priced at fire time — the shown number is the landed number
      t: 2.5, wob: e.uid * 1.7, color: '#ff6b6b', hostile: true, src: e,
    });
    if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
  }

  private enemyReload(e: Unit) {
    const timer = (e.def.melee ? MELEE_TIMER : ENEMY_BASE_TIMER) * this.foeCdMult * this.ascTimerMult() * (e.enraged && !e.phaseRage ? 0.66 : 1) * (e.def.truant ? 2 : 1)
      // speed boost winds each launch tighter, with a half-speed floor
      * (e.def.boost ? Math.max(0.5, Math.pow(0.85, e.boostN++)) : 1);
    return e.phaseRage ? Math.max(1, timer - BOSS_RAGE_TURN_CUT) : timer;
  }

  private fireEnemy(e: Unit) {
    if (e.dead) return; // killed during the windup — the corpse stays down
    {
      e.timer = this.enemyReload(e);
      if (e.boss) {
        this.bossAttack(e);
      } else if (e.def.fuse) {
        // self-destruct: the countdown was a fuse. The blast hurts BOTH
        // sides — kill it before the zero, or herd it next to its pack and
        // let the explosion do your work. First in the chain: a bomber
        // with a support role still answers its fuse.
        if (this.players.some((p) => !p.dead && p.def.damp)) {
          // damp: a living carrier keeps the powder wet — the whole
          // detonation fizzles and the bomber's turn is spent
          this.pushText({ x: e.x, y: e.y - e.r - 10, text: 'DAMP!', t: 1, color: '#6890f0', big: false });
          sfx('bounce');
        } else {
        this.pushText({ x: e.x, y: e.y - e.r - 10, text: 'BOOM!', t: 1.1, color: '#ff9a30', big: true });
        this.burst(e.x, e.y, '#ff9a30', 22, 460, 1.1);
        this.waves.push({ x: e.x, y: e.y, r: 0, maxR: 130, t: 0.4, life: 0.4, color: '#ff9a30', hits: new Set() });
        this.addShake(12);
        this.screenFlash('#ff9a30', 0.25);
        sfx('hit', 0.7);
        for (const p of this.players) {
          if (!p.dead && dist(e, p) < 130) {
            this.damagePlayer(p, Math.round(physDamage(this.foeAtk(e), p.def.stats.def, 1, zapPower) * 1.8), e);
          }
        }
        for (const f of [...this.enemies]) {
          // the pack takes the blast too — hurt() may split, so snapshot
          if (!f.dead && f !== e && dist(e, f) < 130) this.hurt(f, Math.max(20, Math.round(e.maxHp * 0.55)), '#ff9a30');
        }
        this.hurt(e, e.maxHp + 999, '#ff9a30'); // the bomber never survives its own fuse
        }
      } else if (e.supp === 'aegis') {
        // guardians ward their weakest ally — the bubble eats one whole
        // hit, so the pack keeps its bodies until the ward is broken
        const ward = this.enemies
          .filter((a) => !a.dead && a !== e && a.shieldN <= 0)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (ward) {
          ward.shieldN = 1;
          this.pushText({ x: ward.x, y: ward.y - ward.r - 8, text: 'WARDED!', t: 0.9, color: '#9df0ff', big: false });
          sfx('heal');
        } else {
          // nobody left to protect — the guardian fights like fodder
          const target = this.nearestPlayer(e);
          if (target) this.foeZap(e, target);
        }
      } else if (e.def.healer || e.supp === 'medic') {
        // clerics patch their most-wounded ally; an untouched squad still
        // gets zapped — kill the healer first or the fight drags
        const wounded = this.enemies
          .filter((a) => !a.dead && a.hp < a.maxHp)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (wounded) {
          const amt = Math.max(30, Math.round(wounded.maxHp * 0.18));
          wounded.hp = Math.min(wounded.maxHp, wounded.hp + amt);
          this.pushText({ x: wounded.x, y: wounded.y - wounded.r - 8, text: `+${amt}`, t: 0.9, color: '#9df09d', big: false });
          sfx('heal');
        } else {
          const target = this.nearestPlayer(e);
          if (target) this.foeZap(e, target);
        }
      } else if (e.def.raider && this.pickups.length) {
        // raiders ditch the fight for the loot — each turn they dash at the
        // nearest field drop; in reach they swallow it and mend. Route the
        // ball through the drop first or thin the thief out.
        const pk = this.pickups.reduce((a, b) => (dist(e, a) < dist(e, b) ? a : b));
        const dd = dist(e, pk);
        if (dd < e.r + 34) {
          this.pickups.splice(this.pickups.indexOf(pk), 1);
          e.hp = Math.min(e.maxHp, e.hp + Math.max(1, Math.round(e.maxHp * 0.08)));
          this.pushText({ x: e.x, y: e.y - e.r - 10, text: 'SNATCHED!', t: 1, color: '#ffd84d', big: true });
          this.burst(pk.x, pk.y, '#ffd84d', 8, 280);
          sfx('heal');
        } else {
          const d = norm({ x: pk.x - e.x, y: pk.y - e.y });
          const at = this.unstick(e.x + d.x * Math.min(dd, 120), e.y + d.y * Math.min(dd, 120), e.r + 2);
          e.sq = 0.7; // the lunge crouch — same tell the melee dash wears
          e.x = at.x;
          e.y = at.y;
          sfx('launch');
        }
      } else if (e.def.summon && this.enemies.filter((a) => !a.dead).length < 7) {
        // SOS caller: cries for help instead of attacking — a weak kid
        // warps in at its side. Flood-capped at seven living; past that it
        // drops the act and fights like anything else.
        const kid = this.makeEnemy(
          { def: { ...e.def, summon: undefined }, nx: 0, ny: 0 },
          this.waveIndex,
        );
        kid.maxHp = kid.hp = Math.max(8, Math.round(e.maxHp * 0.4));
        const at = this.unstick(e.x + e.r * 2.5, e.y, kid.r + 2);
        kid.x = at.x;
        kid.y = at.y;
        this.enemies.push(kid);
        this.burst(kid.x, kid.y, '#c8e0ff', 7, 220, 0.7);
        this.pushText({ x: e.x, y: e.y - e.r - 10, text: 'SOS!', t: 0.9, color: '#c8e0ff', big: true });
        sfx('warn');
      } else if (e.def.lay) {
        // spiker: instead of attacking it lobs a spike patch into your
        // half — the court slowly fills with denial. Layer the field out
        // and your lanes shrink; cap the yard so it can't bury the arena
        if (this.hazards.filter((h) => h.kind === 'spikes').length < 5) {
          const a = this.arena;
          const at = this.unstick(
            a.x + a.w * (0.15 + this.rng() * 0.7),
            a.y + a.h * (0.55 + this.rng() * 0.38),
            30,
          );
          this.hazards.push({ kind: 'spikes', x: at.x, y: at.y, r: 34 });
          this.pushText({ x: e.x, y: e.y - e.r - 10, text: 'SPIKES!', t: 0.9, color: '#8a90a8', big: false });
          this.burst(at.x, at.y, '#8a90a8', 8, 240, 0.8);
          sfx('warn');
        } else {
          const target = this.nearestPlayer(e);
          if (target) this.foeZap(e, target);
        }
      } else if (e.def.charge) {
        // stampede: a pawing windup, then it rams across the court at the
        // nearest mon — the rush lands where the target stood, so the ball
        // shoving it off-line mid-windup sends the charge wide
        const target = this.nearestPlayer(e);
        if (target) {
          e.sq = 0.55; // the paw-and-lean tell — same squash the melee lunge wears
          chargeMotes(this.fx, this.fxRng, e.x, e.y, TYPE_RAMP[e.def.type], { r: e.r * 2.6, n: 8, life: 0.5 });
          smokeColumn(this.fx, this.fxRng, e.x, e.y + e.r * 0.6, '#a89070', { n: 3, spread: e.r * 1.8 }); // pawing kicks dust
          sfx('warn');
          this.later(0.55, () => {
            if (e.dead || target.dead) return;
            this.dashes.push({
              u: e, e: target, done: false, hostile: true,
              dmg: Math.round(physDamage(this.foeAtk(e), target.def.stats.def, 1, zapPower * 1.1)),
            });
            screenLines(this.fx, this.fxRng, e.x, e.y, '#ffd8d8', { n: 6, speed: 460 }); // the rush tears off the mark
            sfx('launch');
          });
        }
      } else if (e.def.beam) {
        // beam caster: locks the lane through its target — the channel
        // glows for a beat, then burns. Spread the team off the line
        const target = this.nearestPlayer(e);
        if (target) {
          const horiz = Math.abs(target.x - e.x) >= Math.abs(target.y - e.y);
          const at = horiz ? e.y : e.x;
          const lane = { horiz, at, t: 1.0, fired: false };
          this.lanes.push(lane);
          chargeMotes(this.fx, this.fxRng, e.x, e.y, TYPE_RAMP[e.def.type], { r: e.r * 2.4, n: 8, life: 0.62 });
          // charge-up flare — the channel gets a muzzle glint to gather on
          screenLines(this.fx, this.fxRng, e.x, e.y, TYPE_RAMP[e.def.type], { n: 5, speed: 380, inward: true });
          this.fx.push({ x: e.x, y: e.y, vx: 0, vy: 0, t: 0.62, life: 0.62, size: e.r * 1.05, color: '#ffffff', shape: 'sparkle', spin: 3, grav: 0 });
          sfx('warn');
          this.later(0.7, () => {
            if (e.dead) { lane.t = 0; return; } // killed mid-windup — the channel fizzles
            lane.fired = true;
            impactRing(this.fx, this.fxRng, e.x, e.y, TYPE_RAMP[e.def.type], { radius: e.r * 1.8, width: 3, life: 0.22, motes: 2 }); // the muzzle pops as the ray leaves
            for (const p of this.players) {
              if (!p.dead && Math.abs((horiz ? p.y : p.x) - at) < 26)
                this.damagePlayer(p, Math.round(physDamage(this.foeAtk(e), p.def.stats.def, 1, zapPower * 1.2)), e);
            }
            this.addShake(6);
            sfx('zap');
          });
        }
      } else if (e.def.volley) {
        // artillery: the shot fans across the three nearest mons at a
        // haircut per orb — the tank can't body-block a spread, so the
        // counterplay is killing the cannon, not positioning the wall
        sfx('zap');
        this.burst(e.x, e.y, '#ff9a30', 7, 300, 0.8); // the muzzle coughs as the fan leaves
        screenLines(this.fx, this.fxRng, e.x, e.y, '#ff9a30', { n: 5, speed: 420 });
        for (const p of this.playersByDist(e).slice(0, 3)) {
          this.orbs.push({
            x: e.x, y: e.y, target: p,
            dmg: Math.round(physDamage(this.foeAtk(e), p.def.stats.def, 1, zapPower) * 0.55),
            t: 2.5, wob: e.uid * 1.7, color: '#ff9a30', hostile: true, src: e,
          });
          this.glint(e.x + (this.fxRng() - 0.5) * 14, e.y - e.r * 0.3, 6, '#ff9a30'); // a muzzle glint per orb
        }
        if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
      } else if (e.def.melee) {
        // melee enemies lunge instead of zapping — the dash plays out over
        // the next moments while you're lining up your shot
        const target = this.nearestPlayer(e);
        if (target) {
          // windup crouch first — fodder gets its tell like the bosses do
          e.sq = 0.7;
          smokeColumn(this.fx, this.fxRng, e.x, e.y + e.r * 0.5, '#a89070', { n: 2, spread: e.r }); // the crouch scuffs dirt
          this.pushText({ x: e.x, y: e.y - e.r - 10, text: `${e.def.name.toUpperCase()}!`, t: 0.8, color: '#ff6b6b', big: false });
          sfx('launch');
          this.later(0.25, () => {
            if (e.dead) return;
            e.lunging = 1.4;
            screenLines(this.fx, this.fxRng, e.x, e.y, '#ffd8d8', { n: 6, speed: 460 }); // the lunge tears off the mark
          });
        }
      } else {
        const target = this.nearestPlayer(e);
        if (target) this.foeZap(e, target);
      }
    }
  }

  private damagePlayer(p: Unit, dmg: number, src?: Unit, flat = false) {
    // a corpse takes nothing — hazards and stray orbs were re-firing the
    // whole KO beat (REVENGE stack, sash burn, revive spend, killer rewrite)
    if (p.dead) return;
    this.hurtPulse = this.time;
    // flying trait: incoming attacks whiff outright — surfaced so a zero
    // never reads as a bug
    if (this.t('flying') > 0 && this.rng() < Math.min(0.25, this.t('flying') * 0.07)) {
      this.pushText({ x: p.x, y: p.y - p.r - 8, text: 'MISS!', t: 0.8, color: '#a890f0', big: false });
      return;
    }
    // absorb on your side: a same-type hit feeds the hide — mirrored on the
    // foe seam as a heal through hurt(); here it's a direct sip. The flag
    // and the absorb-family abilities drink the same way
    const sop = absorbType(p.def);
    if (sop && src && !src.dead && dmg > 0 && (src.def.type === sop || src.def.type2 === sop)) {
      const sip = Math.max(1, Math.round(p.maxHp * 0.15));
      p.hp = Math.min(p.maxHp, p.hp + sip);
      this.pushText({ x: p.x, y: p.y - p.r - 8, text: `ABSORBED +${sip}`, t: 0.9, color: '#6fdc6f', big: false });
      this.burst(p.x, p.y, '#6fdc6f', 5, 200, 0.7, TYPE_RAMP[sop]);
      abilityNotice(this, p, this.abilityText);
      sfx('heal');
      return;
    }
    // foes hit harder the deeper the run goes — depth 6 lands ~1.7x;
    // +15% base pressure, +8% per wave so wave 3 actually threatens.
    // rock trait shaves every hit; the waveShots ramp is the anti-stall —
    // after 10 unanswered shots a wave fights back harder each turn
    dmg = Math.max(1, Math.round(dmg * (flat ? 1 : this.foeHitMult(src))));
    if (p.role === 'BULWARK' || p.role === 'WARDEN' || p.role === 'GUARDIAN') dmg = Math.max(1, Math.round(dmg * 0.75));
    // friend guard: a living carrier covers its teammates — the tag reads
    // at draft time, so protect the guard or the team folds soft
    if (this.players.some((q) => q !== p && !q.dead && q.def.friendGuard)) dmg = Math.max(1, Math.round(dmg * 0.75));
    const soaked = abilitySturdy(this, p, dmg, this.abilityText, src);
    // thick fat soaking a fire-type strike gets the ember puff it earned
    if (soaked < dmg && src && (src.def.type === 'fire' || src.def.type2 === 'fire') && (p.def.thickFat || p.def.ability === 'thick-fat'))
      this.burst(p.x, p.y, TYPE_COLOR.fire, 8, 320, 0.8, TYPE_RAMP.fire);
    dmg = soaked;
    if (p.sash && dmg >= p.hp) {
      // focus sash: hang on at 1 HP
      p.sash = false;
      dmg = p.hp - 1;
      this.pushText({ x: p.x, y: p.y - p.r - 20, text: p.def.sturdy ? 'STURDY!' : 'FOCUS SASH!', t: 1.1, color: '#ffd84d', big: false });
    }
    const hpBefore = p.hp;
    p.hp -= dmg;
    if (dmg > 0) { p.flashT = 0.12; this.waveFlawless = false; this.stopTaken += Math.min(dmg, hpBefore); }
    // leech foes feed on the hit — the wound pays them back a sip of HP.
    // liquid ooze turns the drain foul: the drainer swallows poison instead
    if (src?.def.leech && !src.dead && dmg > 0) {
      const sip = Math.max(1, Math.round(dmg * 0.5));
      if (oozeBlood(p.def)) {
        this.hurt(src, sip, '#a040a0');
        this.pushText({ x: src.x, y: src.y - src.r - 8, text: 'OOZED!', t: 0.9, color: '#a040a0', big: false });
        this.burst(src.x, src.y, '#a040a0', 8, 300, 0.8, TYPE_RAMP.poison);
        abilityNotice(this, p, this.abilityText);
      } else {
        src.hp = Math.min(src.maxHp, src.hp + sip);
        this.pushText({ x: src.x, y: src.y - src.r - 8, text: `+${sip}`, t: 0.8, color: '#6fdc6f', big: false });
      }
    }
    // incoming ailment riders: the ward abilities shrug their matching
    // status clean off — shield dust shrugs every added effect at once
    const dust = dustProof(p.def);
    const ward = (ok: boolean) => { if (!ok) abilityNotice(this, p, this.abilityText); return ok; };
    // sleep powder: the dust can drop the victim — loses its next turn
    if (src?.def.drowsy && !p.dead && dmg > 0 && ward(!sleepProof(p.def) && !dust) && this.rng() < 0.55) {
      p.asleep = true;
      this.pushText({ x: p.x, y: p.y - p.r - 20, text: 'PUT TO SLEEP!', t: 1, color: '#a890f0', big: false });
    }
    // venom sting: the wound keeps bleeding — ticks down once a round
    if (src?.def.venom && !p.dead && dmg > 0 && ward(!poisonProof(p.def) && !dust)) {
      p.dotTicks = Math.max(p.dotTicks, 4);
      p.dotDmg = Math.max(p.dotDmg, Math.ceil(p.maxHp * 0.06));
      this.pushText({ x: p.x, y: p.y - p.r - 20, text: 'POISONED!', t: 1, color: '#a040a0', big: false });
    }
    // will-o-wisp: the burn singes each round and dulls the victim's hits
    if (src?.def.burn && !p.dead && dmg > 0 && ward(!burnProof(p.def) && !dust) && this.rng() < 0.7) {
      p.burnT = Math.max(p.burnT, 6);
      this.pushText({ x: p.x, y: p.y - p.r - 20, text: 'BURNED!', t: 1, color: '#f08030', big: false });
    }
    // thunder wave: the shock locks the sling — launches limp a few rounds
    if (src?.def.para && !p.dead && dmg > 0 && ward(!paraProof(p.def) && !dust) && this.rng() < 0.6) {
      p.paraT = Math.max(p.paraT, 5);
      this.pushText({ x: p.x, y: p.y - p.r - 20, text: 'PARALYZED!', t: 1, color: '#f8d030', big: false });
    }
    // point abilities fire both ways: a melee hit on a static or poison-
    // point mon answers back — the lunge is the contact, orbs don't count.
    // The attacker's own wards hold: an immune hide can't catch the echo
    if (src?.def.melee && !src.dead && dmg > 0) {
      const grace = graceOdds(p.def); // serene grace doubles the contact odds
      const srcDust = dustProof(src.def);
      if (p.def.shock && !paraProof(src.def) && !srcDust && this.rng() < 0.3 * grace) {
        src.paraT = Math.max(src.paraT, 3);
        this.pushText({ x: src.x, y: src.y - src.r - 10, text: 'STATIC!', t: 0.9, color: '#f8d030', big: false });
      }
      if (p.def.toxic && !poisonProof(src.def) && !srcDust && this.rng() < 0.3 * grace) {
        src.dotTicks = Math.max(src.dotTicks, 4);
        src.dotDmg = Math.max(src.dotDmg, Math.ceil(src.maxHp * 0.06));
        this.pushText({ x: src.x, y: src.y - src.r - 10, text: 'POISON PT!', t: 0.9, color: '#a040a0', big: false });
      }
      if (p.def.flame && !burnProof(src.def) && !srcDust && this.rng() < 0.3 * grace) {
        src.burnT = Math.max(src.burnT, 5);
        this.pushText({ x: src.x, y: src.y - src.r - 10, text: 'FLAME BODY!', t: 0.9, color: '#f08030', big: false });
      }
      if (p.def.charm && !charmProof(src.def) && !srcDust && this.rng() < 0.3 * grace) {
        src.asleep = true;
        this.pushText({ x: src.x, y: src.y - src.r - 10, text: 'SMITTEN!', t: 0.9, color: '#f8b8d0', big: false });
      }
      if (p.def.spore && !srcDust && this.rng() < 0.3 * grace) {
        const roll = this.rng();
        if (roll < 0.4 && !poisonProof(src.def)) {
          src.dotTicks = Math.max(src.dotTicks, 4);
          src.dotDmg = Math.max(src.dotDmg, Math.ceil(src.maxHp * 0.06));
        } else if (roll >= 0.4 && roll < 0.7 && !paraProof(src.def)) {
          src.paraT = Math.max(src.paraT, 3);
        } else if (roll >= 0.7 && !sleepProof(src.def)) {
          src.asleep = true;
        }
        this.pushText({ x: src.x, y: src.y - src.r - 10, text: 'SPORED!', t: 0.9, color: '#a8b820', big: false });
      }
      if (p.def.sync && !srcDust) {
        // synchronize: whatever ails it echoes onto the striker
        let synced = false;
        if (p.dotTicks > 0 && !poisonProof(src.def)) { src.dotTicks = Math.max(src.dotTicks, p.dotTicks); src.dotDmg = Math.max(src.dotDmg, p.dotDmg); synced = true; }
        if (p.burnT > 0 && !burnProof(src.def)) { src.burnT = Math.max(src.burnT, p.burnT); synced = true; }
        if (p.paraT > 0 && !paraProof(src.def)) { src.paraT = Math.max(src.paraT, p.paraT); synced = true; }
        if (synced) this.pushText({ x: src.x, y: src.y - src.r - 10, text: 'SYNCED!', t: 0.9, color: '#f85888', big: false });
      }
      // barbed hides bite back — rough skin and iron barbs pay a melee
      // mouthful out of the attacker's own HP
      const chip = barbChip(p);
      if (chip > 0) {
        this.hurt(src, chip, '#f85888');
        this.pushText({ x: src.x, y: src.y - src.r - 10, text: 'BARBED!', t: 0.8, color: '#f85888', big: false });
        this.burst(src.x, src.y, '#f85888', 8, 300, 0.8, TYPE_RAMP.fighting);
        abilityNotice(this, p, this.abilityText);
      }
    }
    if (settings().dmgNums)
      this.pushText({ x: p.x, y: p.y - p.r - 8, text: `-${dmg}`, t: 0.9, color: '#ff6b6b', big: false });
    // the map early-returns before texts draw — a stray orb hit there
    // would be invisible, so it goes on the field log instead
    if (this.phase === 'map') this.log(`${p.def.name.toUpperCase()} TOOK A STRAY HIT · ${dmg}`);
    // survived on fumes — the clutch beat deserves a callout
    if (p.hp > 0 && p.hp <= p.maxHp * 0.15) {
      this.pushText({ x: p.x, y: p.y - p.r - 34, text: 'BARELY!', t: 0.9, color: '#ffd84d', big: false });
    }
    this.addShake(3);
    this.burst(p.x, p.y, '#ff6b6b', 9, 360);
    // a real wound earns the flash frame — scrapes stay a red spark
    if (dmg >= Math.max(24, p.maxHp * 0.2)) this.impact(p.x, p.y, '#ff6b6b', 0.8);
    sfx('hurt');
    buzz(20);
    if (p.hp <= 0) {
      // the lab's revive token eats the first KO of the run — the mon
      // stands back up at half instead of fainting (once per run, saved
      // like ashArmed so a parked climb can't re-spend it)
      if (this.reviveToken && !this.reviveUsed) {
        this.reviveUsed = true;
        p.hp = Math.ceil(p.maxHp * REVIVE_FRAC);
        this.pushText({ x: p.x, y: p.y - p.r - 30, text: 'REVIVE!', t: 1.4, color: '#a0e060', big: true });
        this.burst(p.x, p.y, '#a0e060', 14, 420);
        this.log(`${p.def.name.toUpperCase()} REVIVED AT 50%`);
        sfx('heal');
        return;
      }
      p.hp = 0;
      p.dead = true;
      this.stopFaints++;
      // aftermath: a melee finisher catches the carrier's death-burst —
      // a quarter of the striker's HP back. Ranged kills stay safe
      if (aftermathKO(p.def) && src?.def.melee && !src.dead) {
        this.hurt(src, Math.max(1, Math.round(src.maxHp * 0.25)), '#a868c8');
        this.pushText({ x: p.x, y: p.y - p.r - 44, text: 'AFTERMATH!', t: 1.1, color: '#a868c8', big: false });
        this.burst(p.x, p.y, '#a868c8', 12, 380, 1, TYPE_RAMP.ghost);
      }
      // grudge: a cursed mon's faint hexes the pack — every living foe's
      // next attack winds up a beat slower. Mirrors the foe-side curse
      // that taxes your supers on its KO.
      if (p.def.cursed) {
        for (const e of this.enemies) if (!e.dead) e.timer += 1;
        this.pushText({ x: p.x, y: p.y - p.r - 44, text: 'GRUDGE!', t: 1.1, color: '#a868c8', big: true });
      }
      // moxie: the killer rides the faint — every mon it drops makes the
      // next swing worse. Kill the predator before it feeds.
      if (src?.def.moxie && !src.dead) {
        src.atkMul = Math.min(src.atkMul * 1.3, 3);
        this.pushText({ x: src.x, y: src.y - src.r - 30, text: 'MOXIE!', t: 0.9, color: '#f85888', big: false });
      }
      this.killer = src?.def.name ?? 'the hazards'; // who lands the wipe — the result screen names it
      this.refreshTraits(); // a faint drops its type from the team bonus
      this.impact(p.x, p.y, '#ff6b6b', 1.5);
      this.burst(p.x, p.y, '#ffffff', 14, 420);
      this.shatter(p.x, p.y, p.r, p.def.type, 8);
      this.pops.push({ x: p.x, y: p.y, id: p.def.id, r: p.r, t: 0.55, life: 0.55 });
      this.addPunch(0.08);
      this.hitStop = Math.max(this.hitStop, 0.15);
      this.addShake(6);
      sfx('ko');
      buzz(60);
      // REVENGE: a fallen teammate fuels the rest — small pow/hp surge so
      // a death stings less and a comeback is always live
      for (const q of this.players) {
        if (!q.dead) {
          q.pow *= 1.08 + this.t('fighting') * 0.05; // fighting trait: the squad digs deeper
          q.hp = Math.min(q.maxHp, q.hp + Math.round(q.maxHp * 0.05));
        }
      }
      this.pushText({ x: p.x, y: p.y - p.r - 30, text: 'REVENGE!', t: 1.1, color: '#f85888', big: true });
      // a KO mid-aim (lunge/orb/wave) strands the turn on a corpse —
      // drop the drag and hand off, or end the run if it was the last
      if (p === this.active && this.phase === 'aim') {
        this.dragging = false;
        this.nextTurn();
      } else if (this.players.every((q) => q.dead) && this.phase !== 'won' && this.phase !== 'lost') {
        // orbs/waves still fly through loot, reward and map — a last-standing
        // kill there has no nextTurn to catch it, so the wipe lands here
        if (!this.ashRevive()) this.wipe();
      }
    }
  }

  private nextTurn(): void {
    if (this.phase === 'won' || this.phase === 'lost') return;
    for (let i = 1; i <= this.players.length; i++) {
      const idx = (this.activeIdx + i) % this.players.length;
      const c = this.players[idx];
      if (c.dead) continue;
      // the nap costs the turn — wakes as it sits out so it's ready next round
      if (c.asleep) {
        c.asleep = false;
        this.pushText({ x: c.x, y: c.y - c.r - 8, text: `${c.def.name.toUpperCase()} DOZES`, t: 1, color: '#a890f0', big: false });
        continue;
      }
      {
        this.activeIdx = idx;
        this.phase = 'aim';
        this.syncWalls();
        const a = this.players[idx];
        this.pushText({
          x: a.x, y: a.y - a.r - 8,
          // a charged super fires on launch — the GO! call is where it's taught
          text: `GO! ${a.def.name.toUpperCase()}${a.cd <= 0 ? ' · SUPER READY!' : ''}`,
          t: 1, color: TYPE_COLOR[a.def.type], big: true,
        });
        return;
      }
    }
    // the whole bench dozed — everyone's awake now, the first one goes
    if (this.players.some((p) => !p.dead)) return this.nextTurn();
    // nobody left standing — a stocked sacred ash burns to undo the wipe
    if (this.ashRevive()) return this.nextTurn();
    this.wipe();
  }

  // the wipe lands the same wherever it's routed from — the red flash and
  // the sting are how a run says it's over
  private wipe() {
    if (this.secret?.phase === 'fight') return secretFled(this);
    this.phase = 'lost';
    this.telop.push({ kind: 'over', title: 'GAME OVER', sub: 'YOUR TEAM FAINTED', mon: this.active.def.id });
    this.endT = 1.6; // the sting lands before the field report covers it
    this.screenFlash('#ff6b6b', 0.3);
    sfx('lose');
    buzz([60, 80, 120]);
  }

  // sacred ash: a full team wipe consumes the charm instead — everyone
  // stands back up at 30% and the fight goes on. Once per run.
  private ashRevive(): boolean {
    if (!this.ashArmed || !this.players.every((p) => p.dead)) return false;
    this.ashArmed = false;
    for (const p of this.players) {
      p.dead = false;
      p.hp = Math.round(p.maxHp * this.ashPct);
    }
    this.refreshTraits(); // the revive fields the whole team again
    this.pushText({
      x: this.arena.x + this.arena.w / 2,
      y: this.arena.y + this.arena.h / 2,
      text: 'SACRED ASH!',
      t: 1.6, color: '#ffd84d', big: true,
    });
    this.log('SACRED ASH · TEAM REVIVED');
    this.screenFlash('#ffd84d', 0.3);
    sfx('heal');
    return true;
  }

  // --- vfx helpers ---

  private screenFlash(color: string, t: number) {
    this.flashes.push({ t, life: t, color });
  }

  private addShake(amt: number) {
    this.shake = Math.min(this.shake + amt * settings().shake, 36);
  }

  private addPunch(amt: number) {
    this.punch = Math.min(this.punch + amt * settings().shake, 0.22); // shake 0 kills the zoom kick too
  }

  // Oversized banners cache their fitted font before the draw pass.
  // public so perk ticks can float their own proc callouts (perks.ts)
  pushText(t: FloatText) {
    // a repeat callout near a live copy re-pops that copy with a ×N count
    // instead of stacking (RICOCHET!, WEAK POINT! on every bounce). Numbers
    // stay separate: two hits are two damage values, not one
    if (!/\d/.test(t.text)) {
      const twin = this.texts.find((o) => (o.key ?? o.text) === t.text && Math.abs(o.x - t.x) < 90 && Math.abs(o.y - t.y) < 90);
      if (twin) {
        twin.n = (twin.n ?? 1) + 1;
        twin.key ??= t.text;
        t = { ...twin, ...t, text: `${twin.key} ×${twin.n}`, key: twin.key, n: twin.n, size: Math.min((t.size ?? 1) * (1 + 0.08 * twin.n), 1.4), life: undefined };
        this.texts.splice(this.texts.indexOf(twin), 1);
      }
    }
    // small labels fade faster; banners keep their beat
    t.t = t.big ? Math.min(t.t, 1.2) : Math.min(t.t * 0.8, 0.9);
    t.size = Math.max(t.size ?? 1, 1);
    if (MCTX) {
      MCTX.font = font(CALLOUT_PX * t.size);
      t.w = MCTX.measureText(t.text).width;
      t.wf = MCTX.font;
      if (t.w > W_CANVAS_FALLBACK - 16) {
        const s = fitFont(MCTX, t.text, 42 * t.size, W_CANVAS_FALLBACK - 16); // 42 ≥ the punch-in pop max
        t.ff = font(s);
        t.fw = MCTX.measureText(t.text).width;
      }
    }
    this.texts.push(t);
    // at most MAX_TEXTS on court: the oldest small label yields first
    if (this.texts.length > MAX_TEXTS) {
      const i = this.texts.findIndex((o) => !o.big);
      this.texts.splice(i >= 0 ? i : 0, 1);
    }
  }

  // Anime shrapnel: velocity streaks, glow dots and a few stars exploding
  // off a point — the workhorse every impact routes through.
  private burst(x: number, y: number, color: string, n = 10, speed = 340, size = 1, ramp?: string[]) {
    fxBurst(this.fx, this.fxRng, x, y, color, n, speed, size, ramp);
  }

  // The white-hot flash frame anime hits open with: a big white star plus
  // a colored one spinning out under it, then shards on top.
  private impact(x: number, y: number, color: string, scale = 1) {
    fxImpact(this.fx, this.fxRng, x, y, color, scale);
  }

  // Cast motes keyed to the super's element — embers climb for fire,
  // leaves flutter for grass, debris flies for rock. One call dresses
  // every bump super in its own type instead of the same generic burst.
  private flavor(x: number, y: number, type: PokeType) {
    fxFlavor(this.fx, this.fxRng, x, y, type);
  }

  // ?-stop theatre: an outcome's fx tag choreographs the beat at the
  // stop's anchor (the ball-drop spot over the current node). Everything
  // routes through the shared fx pool + flashes — drawRegion paints both
  // over the cards, so the read lands even when the anchor hides behind
  // the event card. Reduced motion: shake=0 swaps the speed-line rake
  // for a slow ring; addShake/flash gate themselves downstream.
  private playEventFx(out: EventOutcome) {
    if (!out.fx) return;
    const a = this.catchAnchor();
    const q = QUALITY_FX[settings().quality];
    const n = (k: number) => Math.max(2, Math.round(k * q));
    const GOLD = ['#8a6410', '#e8b830', '#ffd84d', '#fff8c8'];
    const HEAL = ['#2f7830', '#78c850', '#b8f088', '#fff8c8'];
    const RED = ['#581010', '#c03028', '#f06858', '#ffd0b8'];
    switch (out.fx) {
      case 'heal': // soft green/gold aura, motes climbing off the stop
        aura(this.fx, this.fxRng, a.x, a.y, HEAL, { r: 30, n: n(14), life: 1.2 });
        this.later(0.42, () => aura(this.fx, this.fxRng, a.x, a.y, GOLD, { r: 22, n: n(8) }));
        this.screenFlash('#b8f088', 0.12);
        break;
      case 'gold': // a find, levels, luck — ring bloom + coin-gold sparks
        impactRing(this.fx, this.fxRng, a.x, a.y, GOLD, { radius: 42, motes: n(6) });
        this.burst(a.x, a.y, '#ffd84d', n(10), 300, 1, GOLD);
        this.screenFlash('#ffd84d', 0.1);
        break;
      case 'ambush': // menace — a red pulse and a converging rake before the drop
        this.screenFlash('#c03028', 0.22);
        if (settings().shake === 0) impactRing(this.fx, this.fxRng, a.x, a.y, RED, { radius: 46 });
        else screenLines(this.fx, this.fxRng, a.x, a.y, RED, { n: n(12), inward: true });
        this.addShake(7);
        sfx('warn');
        this.later(0.3, () => {
          this.screenFlash('#c03028', 0.14);
          this.burst(a.x, a.y, '#f06858', n(8), 280, 1, RED);
        });
        break;
      case 'mystic': // seers, shrines, trades — motes converge, then lift off
        chargeMotes(this.fx, this.fxRng, a.x, a.y, TYPE_RAMP.psychic, { n: n(10) });
        this.later(0.4, () => aura(this.fx, this.fxRng, a.x, a.y, TYPE_RAMP.psychic, { n: n(8) }));
        this.screenFlash('#a890f0', 0.1);
        break;
      case 'blood': // a price paid in HP — dark motes siphon into the stop
        chargeMotes(this.fx, this.fxRng, a.x, a.y, RED, { n: n(10), r: 70 });
        this.screenFlash('#c03028', 0.12);
        break;
      case 'egg': { // warm glow + shell sparks — the fossil crack shares it
        aura(this.fx, this.fxRng, a.x, a.y, GOLD, { r: 20, n: n(8) });
        const r = this.fxRng;
        for (let i = 0; i < n(5); i++) {
          this.fx.push({
            x: a.x, y: a.y, vx: (r() - 0.5) * 200, vy: -60 - r() * 160,
            t: 0.3 + r() * 0.2, life: 0.5, size: 2 + r() * 1.5,
            color: r() < 0.4 ? '#ffffff' : '#ffd84d', shape: 'shard',
            spin: (r() - 0.5) * 16, grav: 520, seed: r(),
          });
        }
        this.screenFlash('#ffd84d', 0.1);
        break;
      }
      case 'treasure': // coin spray — a gold spout off the dig site
        pillarSpout(this.fx, this.fxRng, a.x, a.y, GOLD, { n: n(14) });
        impactRing(this.fx, this.fxRng, a.x, a.y, GOLD, { radius: 38, motes: n(6) });
        this.screenFlash('#ffd84d', 0.14);
        sfx('perfect');
        break;
    }
  }

  // One glint — the collect pop and the coin-trail sparkle share it.
  private glint(x: number, y: number, size = 6, color = '#fff8dc') {
    this.fx.push({ x, y, vx: 0, vy: -26, t: 0.3, life: 0.3, size, color, shape: 'sparkle', spin: 6, grav: 0 });
    if (this.fx.length > FX_MAX) this.fx.splice(0, this.fx.length - FX_MAX);
  }

  // Pixel-shatter KO: the sprite bursts into chips off its own silhouette —
  // shards spawn across the body disc so the break reads as the mon, not a point
  private shatter(x: number, y: number, r: number, type: PokeType, n = 9) {
    const ramp = TYPE_RAMP[type];
    for (let i = 0; i < n; i++) {
      const a = this.fxRng() * Math.PI * 2, rr = this.fxRng() * r * 1.1;
      const va = a + (this.fxRng() - 0.5) * 1.2, sp = 120 + this.fxRng() * 340;
      this.fx.push({
        x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr,
        vx: Math.cos(va) * sp, vy: Math.sin(va) * sp - 140,
        t: 0.4 + this.fxRng() * 0.5, life: 0.9,
        size: 1.8 + this.fxRng() * 2.8,
        color: this.fxRng() < 0.3 ? '#ffffff' : pickRamp(ramp, this.fxRng),
        shape: 'shard', spin: (this.fxRng() - 0.5) * 18, grav: 660, rot: this.fxRng() * Math.PI * 2, seed: this.fxRng(),
      });
    }
    if (this.fx.length > FX_MAX) this.fx.splice(0, this.fx.length - FX_MAX);
  }

  // ambient sky — a thin drizzle of weather motes keeps the court's sky
  // alive. The accumulator pays particles at a quality-scaled rate: calm
  // dressing, never a storm, and always well under the fx cap.
  private stepSkyFx(dt: number) {
    if (!this.weather || this.phase === 'map') { this.skyAcc = 0; return; }
    const a = this.arena, w = this.weather;
    const rate = (settings().shake === 0 ? 7 : 14) * QUALITY_FX[settings().quality];
    this.skyAcc += dt * rate;
    while (this.skyAcc >= 1 && this.fx.length < FX_MAX - 24) {
      this.skyAcc--;
      const r = this.fxRng;
      const f: Fx = { x: a.x + r() * a.w, y: a.y + 8, vx: 0, vy: 0, t: 0,
        life: 0.9, size: 1.4, color: '#ffffff', shape: 'dot', spin: 0, grav: 0 };
      switch (w) {
        case 'rain': f.shape = 'streak'; f.vx = -60 - r() * 60; f.vy = 480 + r() * 220; f.color = '#9dd8f0'; f.life = 0.8; f.size = 1.2 + r(); break;
        case 'storm': f.shape = 'streak'; f.vx = -140 - r() * 120; f.vy = 560 + r() * 240; f.color = r() < 0.2 ? '#f8e878' : '#8fc8f0'; f.life = 0.7; f.size = 1.4 + r(); break;
        case 'sand': f.shape = 'streak'; f.x = a.x + a.w; f.y = a.y + r() * a.h; f.vx = -(220 + r() * 160); f.vy = (r() - 0.5) * 60; f.color = '#e0c068'; f.size = 1.2 + r() * 0.8; break;
        case 'wind': f.shape = 'streak'; f.x = r() < 0.5 ? a.x : a.x + a.w; f.y = a.y + r() * a.h;
          f.vx = (f.x === a.x ? 1 : -1) * (320 + r() * 200); f.vy = (r() - 0.5) * 40; f.color = '#cfe8ff'; f.life = 0.8; f.size = 1 + r(); break;
        case 'sun': f.y = a.y + a.h - r() * a.h * 0.5; f.vy = -(30 + r() * 60); f.vx = (r() - 0.5) * 30;
          f.color = r() < 0.5 ? '#ffd84d' : '#fff0b0'; f.sway = 20 + r() * 20; f.life = 1.4 + r() * 0.6; f.size = 1 + r() * 1.2; break;
      }
      this.fx.push(f);
    }
  }

  // --- rendering ---

  render(ctx: CanvasRenderingContext2D) {
    if (this.phase === 'map') {
      ctx.save();
      // an ambush's warning beat rattles the whole map — settings().shake
      // already gates the impulse inside addShake, so reduced motion holds
      if (this.shake > 0.3) {
        ctx.translate(
          (Math.random() - 0.5) * this.shake,
          (Math.random() - 0.5) * this.shake,
        );
      }
      this.drawRegion(ctx);
      ctx.restore();
      return;
    }
    const a = this.arena;
    const fall = this.foeDrop();

    ctx.save();
    if (this.shake > 0.3) {
      ctx.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
    }
    // anime zoom-kick — big hits lunge the whole frame toward the action
    if (this.punch > 0.004) {
      const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
      ctx.translate(cx, cy);
      ctx.scale(1 + this.punch, 1 + this.punch);
      ctx.translate(-cx, -cy);
    }
    const fz = this.finZoom();
    if (fz > 0.004) {
      ctx.translate(this.fin.x, this.fin.y);
      ctx.scale(1 + fz, 1 + fz);
      ctx.translate(-this.fin.x, -this.fin.y);
    }

    // The tiled court scrolls underneath a fixed, grounded border.
    const scrollK = Math.min(1, (this.time - this.courtT) / COURT_SCROLL);
    const scrolling = scrollK < 1;
    if (scrolling) {
      const e = 1 - (1 - scrollK) ** 3;
      const dy = -(1 - e) * a.h;
      ctx.save();
      ctx.beginPath();
      ctx.rect(a.x, a.y, a.w, a.h);
      ctx.clip();
      ctx.translate(0, dy);
    }
    drawBackdrop(ctx, a, 18, this.skinTheme);

    // scars left by heavy hits — dark scorches fading on the floor
    for (const s of this.scars) {
      ctx.globalAlpha = 0.3 * (1 - s.t / s.life);
      ctx.fillStyle = '#0a0810';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r, s.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // court gimmicks — the themed hazard zones under everything else
    drawField2Floor(ctx, this.field2, this.time, this.shots);
    for (const hz of this.hazards) if (!hz.spent && !hz.moat) this.drawHazard(ctx, hz);
    drawField2(ctx, this.field2, this.time);

    // moats + stone cover — the static furniture bakes into one layer;
    // a smash/cut/strength mutation re-bakes on the next frame
    if (!this.roomLayer || this.roomTheme !== this.skinTheme) this.bakeRoom();
    ctx.drawImage(this.roomLayer!, a.x - 8, a.y - 8);
    if (scrolling) {
      ctx.save();
      ctx.translate(0, a.h);
      drawBackdrop(ctx, a, 18, this.skinTheme);
      ctx.restore();
      ctx.restore();
    }
    drawWall(ctx, a, this.skinTheme);
    this.drawDamageWalls(ctx);

    drawAmbient(ctx, a, this.skinTheme, this.time, QUALITY_FX[settings().quality]);

    this.drawWeather(ctx);

    this.lblN = 0;
    // turn-clock digits claim their boxes first so foe tags push off them
    for (const u of this.enemies) {
      if (u.dead || this.lblN >= LABEL_SLOTS) continue;
      const at = this.lblN++ * 4, cx = u.x + u.r - 2, cy = u.y - u.r + 7;
      this.lblBox[at] = cx - 16;
      this.lblBox[at + 1] = cy - 16;
      this.lblBox[at + 2] = cx + 16;
      this.lblBox[at + 3] = cy + 3;
    }
    this.drawWallWarnings(ctx);
    this.treasure.draw(ctx, this.time);
    labelField2(this.field2, this.introAlpha(), (t, x, y, c, al) => this.fieldLabel(ctx, t, x, y, c, al));
    // field pickups: the icon is the read; the effect tag shows once per
    // kind per battle
    for (const pk of this.pickups) {
      const bob = Math.sin(this.time * 3 + pk.t) * 2.5;
      const meta = PICKUP_META[pk.kind];
      // pickupFx 'simple' drops the glow pool + kind ring — icon + tag only
      if (settings().pickupFx === 'complete') {
        ctx.globalAlpha = 0.22 + Math.sin(this.time * 3 + pk.t) * 0.06;
        ctx.fillStyle = '#fff8dc';
        ctx.beginPath();
        ctx.ellipse(pk.x, pk.y + 9, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.45 + Math.sin(this.time * 4 + pk.t) * 0.18;
        ctx.strokeStyle = meta.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(pk.x, pk.y + 9, 16, 7.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const img = itemSprite(pk.kind);
      if (!img) void loadItem(pk.kind); // a kind that rolled in late warms the cache on sight
      if (img) ctx.drawImage(img, pk.x - 13, pk.y - 13 + bob, 26, 26);
      if ((pk.tag ?? 0) > 0)
        this.fieldLabel(ctx, meta.label, pk.x, pk.y + 32, meta.color, Math.min(1, (pk.tag ?? 0) / 0.3));
    }

    // victory loot — each kind reads at a glance: gold coins, cyan gems,
    // a pink heart, a blue candy; all spin on the squash-flip
    for (const c of this.lootCoins) {
      const flip = Math.cos(c.spin);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(Math.max(0.18, Math.abs(flip)), 1);
      if (c.kind === 'coin') {
        ctx.fillStyle = '#e8a010';
        ctx.beginPath();
        ctx.arc(0, 0, c.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd84d';
        ctx.beginPath();
        ctx.arc(0, 0, c.r - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8a010';
        ctx.font = font(10);
        ctx.textAlign = 'center';
        ctx.fillText('★', 0, 3);
      } else if (c.kind === 'gem') {
        ctx.fillStyle = '#7dd8f8';
        ctx.beginPath();
        ctx.moveTo(0, -c.r);
        ctx.lineTo(c.r * 0.8, 0);
        ctx.lineTo(0, c.r);
        ctx.lineTo(-c.r * 0.8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#d8f6ff';
        ctx.beginPath();
        ctx.moveTo(0, -c.r * 0.55);
        ctx.lineTo(c.r * 0.4, 0);
        ctx.lineTo(0, c.r * 0.55);
        ctx.lineTo(-c.r * 0.4, 0);
        ctx.closePath();
        ctx.fill();
      } else if (c.kind === 'heart') {
        ctx.fillStyle = '#ff7096';
        ctx.beginPath();
        ctx.arc(-c.r * 0.35, -c.r * 0.2, c.r * 0.42, 0, Math.PI * 2);
        ctx.arc(c.r * 0.35, -c.r * 0.2, c.r * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-c.r * 0.68, -c.r * 0.05);
        ctx.lineTo(0, c.r * 0.72);
        ctx.lineTo(c.r * 0.68, -c.r * 0.05);
        ctx.closePath();
        ctx.fill();
      } else if (c.kind === 'star') {
        // star piece — the meta wallet's purple shard, same coin silhouette
        ctx.fillStyle = '#5a34b8';
        ctx.beginPath();
        ctx.arc(0, 0, c.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c9a8ff';
        ctx.beginPath();
        ctx.arc(0, 0, c.r - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a34b8';
        ctx.font = font(10);
        ctx.textAlign = 'center';
        ctx.fillText('★', 0, 3);
      } else {
        // candy — a wrapped drop: blue orb with twisted ends
        ctx.fillStyle = '#58b0f8';
        ctx.beginPath();
        ctx.arc(0, 0, c.r * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9df0ff';
        ctx.beginPath();
        ctx.moveTo(-c.r * 0.5, -c.r * 0.3);
        ctx.lineTo(-c.r, 0);
        ctx.lineTo(-c.r * 0.5, c.r * 0.3);
        ctx.moveTo(c.r * 0.5, -c.r * 0.3);
        ctx.lineTo(c.r, 0);
        ctx.lineTo(c.r * 0.5, c.r * 0.3);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const w of this.waves) this.drawWave(ctx, w);

    // beam lanes — the locked channel glows a warning, then the beam
    // itself burns bright for the rest of its life
    for (const l of this.lanes) {
      const a = this.arena;
      ctx.save();
      if (!l.fired) {
        // warning: thin pulsing dashes down the locked lane
        ctx.globalAlpha = 0.35 + Math.sin(this.time * 14) * 0.15;
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        if (l.horiz) { ctx.moveTo(a.x, l.at); ctx.lineTo(a.x + a.w, l.at); }
        else { ctx.moveTo(l.at, a.y); ctx.lineTo(l.at, a.y + a.h); }
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // fired: a fat hot bar fading over its last stretch
        ctx.globalAlpha = Math.min(0.85, l.t * 3);
        ctx.strokeStyle = '#ffb0b0';
        ctx.lineWidth = 9;
        ctx.beginPath();
        if (l.horiz) { ctx.moveTo(a.x, l.at); ctx.lineTo(a.x + a.w, l.at); }
        else { ctx.moveTo(l.at, a.y); ctx.lineTo(l.at, a.y + a.h); }
        ctx.stroke();
        ctx.globalAlpha = Math.min(0.5, l.t * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const e of this.enemies) {
      if (e.dead || e.asleep) continue;
      for (const c of e.clocks) {
        if (c.t !== 1) continue;
        ctx.save();
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(this.time * 10);
        ctx.strokeStyle = TYPE_COLOR[e.def.type];
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        if (c.kind === 'laser') {
          const target = this.nearestPlayer(e);
          if (target) {
            const dir = norm({ x: target.x - e.x, y: target.y - e.y });
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(e.x + dir.x * 1400, e.y + dir.y * 1400);
          }
        } else if (c.kind === 'cross') {
          const a = this.arena;
          ctx.moveTo(a.x, e.y);
          ctx.lineTo(a.x + a.w, e.y);
          ctx.moveTo(e.x, a.y);
          ctx.lineTo(e.x, a.y + a.h);
        } else if (c.kind === 'quake') {
          ctx.arc(e.x, e.y, QUAKE_R, 0, Math.PI * 2);
        } else {
          for (const p of this.players) {
            if (p.dead) continue;
            ctx.moveTo(p.x + 26, p.y);
            ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
            ctx.moveTo(p.x - 8, p.y);
            ctx.lineTo(p.x + 8, p.y);
            ctx.moveTo(p.x, p.y - 8);
            ctx.lineTo(p.x, p.y + 8);
          }
        }
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    // last-shot echo — the previous arc lingers as a faint dotted line so
    // bank angles are learnable, not guessed (Angry Birds' old-arc trick)
    if (this.phase === 'aim' && this.waveShots > 0 && this.lastPath.length > 2) {
      ctx.save();
      ctx.strokeStyle = '#fff8e0';
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 7]);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.lastPath[0].x, this.lastPath[0].y);
      for (const p of this.lastPath) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
    }

    // afterimage — fading ghost sprites smear the flight path, anime-style
    if (this.trail.length) {
      const au = this.active;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.trail.length; i++) {
        const p = this.trail[i];
        const age = this.time - p.t;
        const f = i / this.trail.length;
        const al = Math.max(0, 0.4 - age * 0.65) * (0.3 + 0.7 * f);
        if (al <= 0.015) continue;
        ctx.globalAlpha = al;
        // a live chain warms the wake — each ghost rides a halo off the
        // combo ramp, so the smear heats cyan→gold as the links climb
        if (this.shotCombo >= 2) {
          ctx.fillStyle = COMBO_COLORS[this.shotCombo % COMBO_COLORS.length];
          ctx.beginPath();
          ctx.arc(p.x, p.y, au.r * 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
        if (au.shiny) drawShiny(ctx, au.def.id, p.x, p.y, au.r * 2.3);
        else drawMon(ctx, au.def.id, p.x, p.y, au.r * 2.3);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // gravity auras — a dark bubble around the carrier, teal rim
    for (const e of this.enemies) {
      if (e.dead || !e.gravR || fall < 1) continue;
      ctx.globalAlpha = 0.1 + Math.sin(this.time * 2.5) * 0.03;
      ctx.fillStyle = '#0a1420';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.gravR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#58c8d8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.gravR, this.time * 0.8, this.time * 0.8 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;

    // enrage embers — a wounded berserker keeps steaming after the pop,
    // a flickering red collar tight on the sprite (bosses + RAGE fodder)
    for (const e of this.enemies) {
      if (e.dead || !e.enraged || fall < 1) continue;
      ctx.globalAlpha = 0.3 + Math.sin(this.time * 11 + e.uid) * 0.18;
      ctx.strokeStyle = e.boss ? TYPE_COLOR[e.def.type] : '#ff5040';
      ctx.lineWidth = 3;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 5, this.time * 2.4, this.time * 2.4 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;

    // menace pressure — a slow violet ring that breathes while the
    // intimidator lives; your hits lose a fifth until it falls
    for (const e of this.enemies) {
      if (e.dead || !e.def.menace || fall < 1) continue;
      ctx.globalAlpha = 0.16 + Math.sin(this.time * 2.2 + e.uid) * 0.08;
      ctx.strokeStyle = '#7038f8';
      ctx.lineWidth = 3;
      ctx.setLineDash([2, 7]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 9 + Math.sin(this.time * 2.2 + e.uid) * 3, this.time * 0.9, this.time * 0.9 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;

    // arena traps — a dark earthen leash ring: inside is free, the rim
    // drags the ball back. The deadliest read is its absence after the KO
    for (const e of this.enemies) {
      if (e.dead || !e.def.trap || fall < 1) continue;
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#705030';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 150, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#907050';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 9]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, 150, this.time * 0.8, this.time * 0.8 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;

    // color change — the ring wears the hide's CURRENT type, so a striker
    // reads what it's about to hit before committing the angle
    for (const e of this.enemies) {
      if (e.dead || !e.def.chameleon || fall < 1) continue;
      ctx.globalAlpha = 0.5 + Math.sin(this.time * 4 + e.uid) * 0.15;
      ctx.strokeStyle = TYPE_COLOR[e.def.type] ?? '#fff';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 6, -this.time * 1.4, -this.time * 1.4 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;

    // repulsor fields — a pale gold halo, dashes streaming outward
    for (const e of this.enemies) {
      if (e.dead || !e.repelR || fall < 1) continue;
      ctx.globalAlpha = 0.07 + Math.sin(this.time * 3) * 0.02;
      ctx.fillStyle = '#ffd84d';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.repelR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#ffd84d';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.repelR, -this.time * 1.2, -this.time * 1.2 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;

    // soul-link tethers — the zombie pair must read before you shoot
    ctx.strokeStyle = '#a0e060';
    for (const e of this.enemies) {
      if (!e.link || fall < 1) continue;
      ctx.globalAlpha = 0.35 + Math.sin(this.time * 6) * 0.15;
      ctx.setLineDash([5, 7]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.link.x, e.link.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // opening read: the lowest clock on the board wears the first-strike tag
    const nextOf = (e: Unit) => Math.min(e.timer, ...e.clocks.map((c) => c.t));
    this.firstFoeU = this.introLeft() > 0
      ? this.enemies.filter((e) => !e.dead && !e.asleep).sort((a, b) => nextOf(a) - nextOf(b))[0]
      : undefined;
    for (const e of this.enemies) {
      if (fall >= 1) this.drawUnit(ctx, e);
      else if (fall > 0 && !e.dead) {
        // drop-in: the shadow grows on the landing spot as the mon falls
        ctx.fillStyle = `rgba(8,10,20,${0.35 * fall})`;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + e.r * 0.72, e.r * 0.82 * fall, e.r * 0.3 * fall, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.globalAlpha = Math.min(1, fall * 2);
        ctx.translate(0, -((1 - fall) ** 2) * FOE_DROP_H);
        this.drawUnit(ctx, e);
        ctx.restore();
      }
    }
    if (fall >= 1) this.flee.draw(ctx);
    for (const p of this.players) this.drawUnit(ctx, p);

    // KO ghost-pops — the fallen sprite flares white and drifts skyward
    if (this.pops.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.pops) {
        const k = Math.max(p.t / p.life, 0);
        const u = 1 - k;
        const sq = Math.max(0, 1 - u / 0.3);
        ctx.globalAlpha = k;
        ctx.save();
        ctx.translate(p.x, p.y - u * 30);
        ctx.scale(1 + 0.3 * sq, 1 - 0.25 * sq);
        drawMon(ctx, p.id, 0, 0, p.r * 2.6 * (1 + u * 0.7));
        ctx.restore();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // evolution cinematic: the arena dims, the mon whites out and flickers
    // old↔new at an accelerating clip — the GBA silhouette swap — then the
    // new form pops in under a gold ring
    if (this.evoFx.length) {
      const a = this.arena;
      ctx.fillStyle = 'rgba(6,10,20,0.4)';
      ctx.fillRect(a.x, a.y, a.w, a.h);
      for (const f of this.evoFx) {
        const u = f.u;
        const size = u.r * 2.6;
        if (f.t < 1.0) {
          const ph = Math.min(1, Math.max(0, (f.t - 0.15) / 0.85));
          const period = 0.16 - 0.11 * ph; // swaps speed up as it resolves
          const which = f.t < 0.15 ? 0 : Math.floor((f.t - 0.15) / period) % 2;
          const img = whiteSprite(which ? f.to : f.from);
          const gs = whiteGlow(img);
          const gk = size / img.width;
          ctx.drawImage(gs, u.x - size / 2 - WHITE_GLOW_PAD * gk, u.y - size / 2 - WHITE_GLOW_PAD * gk, gs.width * gk, gs.height * gk);
          ctx.strokeStyle = '#ffd84d';
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.5 + ph * 0.5;
          ctx.beginPath();
          ctx.arc(u.x, u.y, u.r * (1.1 + ph * 0.5), 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else {
          const rp = Math.min(1, (f.t - 1.0) / 0.35);
          const pop = 1.5 - 0.5 * (1 - Math.pow(1 - rp, 3)); // overshoot in, settle
          drawMon(ctx, f.to, u.x, u.y, size * pop);
          ctx.strokeStyle = '#ffd84d';
          ctx.lineWidth = 3;
          ctx.globalAlpha = 1 - rp;
          ctx.beginPath();
          ctx.arc(u.x, u.y, u.r * (1.1 + rp * 1.6), 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }

    // skull marks — a tiny bone-white badge pinned on the bounty foe
    for (const e of this.enemies) {
      if (e.dead || !e.skull || fall < 1) continue;
      const sx = e.x + e.r * 0.7;
      const sy = e.y - e.r - 10 + Math.sin(this.time * 4) * 1.5;
      ctx.fillStyle = '#f0f0e8';
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(sx - 3, sy + 3, 6, 4); // jaw
      ctx.fillStyle = '#101018';
      ctx.beginPath();
      ctx.arc(sx - 2.2, sy - 0.5, 1.6, 0, Math.PI * 2);
      ctx.arc(sx + 2.2, sy - 0.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // anime speedlines — a blazing shot drags the whole frame along
    if (this.phase === 'shot' && !this.active.dead) {
      const u = this.active;
      const sp = Math.hypot(u.vx, u.vy);
      if (sp > 850) {
        const d = norm({ x: u.vx, y: u.vy });
        const px = -d.y, py = d.x;
        const k = Math.min(1, (sp - 850) / 1300);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (let i = 0; i < 12; i++) {
          // deterministic lanes streaming backward past the ball
          const off = (((i * 97.3 + this.time * 60) % 320) + 320) % 320 - 160;
          const back = ((i * 61.7 + this.time * (900 + i * 40)) % 420);
          const lx = u.x - d.x * (u.r + back) + px * off;
          const ly = u.y - d.y * (u.r + back) + py * off;
          const L = 30 + (i % 3) * 22;
          ctx.globalAlpha = 0.4 * k;
          ctx.strokeStyle = i % 4 === 0 ? TYPE_COLOR[u.def.type] : '#ffffff';
          ctx.lineWidth = 1.5 + (i % 3);
          ctx.beginPath();
          ctx.moveTo(lx - d.x * L, ly - d.y * L);
          ctx.lineTo(lx, ly);
          ctx.stroke();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    this.drawCatchBalls(ctx);


    for (const o of this.orbs) {
      ctx.drawImage(orbGlow(o.color), o.x - 40, o.y - 40);
    }


    // beam afterglow — a fading bright line over the field; signature
    // beams carry their own color and a fat core
    for (const bm of this.beams) {
      const alpha = bm.t / bm.life;
      const w = (bm.w ?? 1) * 1.5; // supers read oversized — anime-scale beams
      ctx.globalAlpha = alpha;
      // outer glow halo
      ctx.strokeStyle = bm.color ?? '#ffd84d';
      ctx.globalAlpha = alpha * 0.4;
      ctx.lineWidth = 30 * w * alpha + 4;
      ctx.beginPath();
      ctx.moveTo(bm.x1, bm.y1);
      ctx.lineTo(bm.x2, bm.y2);
      ctx.stroke();
      // colored body
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 14 * w * alpha + 2;
      ctx.stroke();
      // white-hot core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5 * w * alpha + 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawAnims(ctx);

    // particle fx — additive so stacked sparks bloom into real glow
    drawFx(ctx, this.fx);

    for (const t of this.texts) {
      const life = (t.life ??= t.t); // first frame stamps the span
      const age = 1 - t.t / life; // 0 at birth → 1 at the fade
      // punch-in: a ~2× spawn snaps to rest with a slight undershoot —
      // banners slam harder so crits and KO calls read at a glance
      const k = Math.min(age / 0.15, 1);
      const ease = 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;
      const pop = (t.big ? 2.7 : 1.9) * (1 - ease) + ease;
      ctx.globalAlpha = Math.min(t.t / 0.3, 1);
      ctx.font = font(CALLOUT_PX * pop * (t.size ?? 1));
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.strokeStyle = t.gold ? '#7a3c00' : '#000';
      ctx.lineWidth = (t.big ? 4 : 3) + (t.gold ? 1 : 0);
      const dy = 52 * (1 - (1 - age) ** 3); // launch up fast, drift to a stop
      ctx.save();
      // a wall-hugging mon's banner must not spill off-canvas — shrink
      // oversized callouts, then clamp the anchor inside the playfield.
      // Rounded font sizes do not scale linearly; reserve room for camera motion.
      if (t.wf !== ctx.font) {
        t.w = ctx.measureText(t.text).width;
        t.wf = ctx.font;
      }
      const cx = a.x + a.w / 2;
      const inset = 12 + this.shake / 2 + Math.max(cx, W_CANVAS_FALLBACK - cx) * (this.punch + 2 * this.finZoom());
      const textW = W_CANVAS_FALLBACK - inset * 2;
      let half = t.w! / 2;
      let tx = t.x;
      if (half * 2 > textW) {
        if (t.ff !== undefined && t.fw! <= textW) {
          ctx.font = t.ff; // too wide to ever fit — the fitted font was cached at push
          half = t.fw! / 2;
        } else {
          // only overflows mid punch-in — rare enough to measure on the spot
          fitFont(ctx, t.text, CALLOUT_PX * pop * (t.size ?? 1), textW);
          half = ctx.measureText(t.text).width / 2;
        }
        tx = W_CANVAS_FALLBACK / 2;
      } else {
        tx = Math.min(Math.max(t.x, half + inset), W_CANVAS_FALLBACK - half - inset);
      }
      const glyph = ctx.measureText(t.text);
      const y = this.calloutY(t.y - dy, glyph.actualBoundingBoxAscent, glyph.actualBoundingBoxDescent, Math.abs(Math.sin(t.tilt ?? 0)) * half);
      ctx.translate(tx, this.place(tx, y, half * 2, glyph.actualBoundingBoxAscent, glyph.actualBoundingBoxDescent, true));
      ctx.rotate(t.tilt ?? 0);
      ctx.strokeText(t.text, 0, 0);
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // team damage paints the rim red for a beat — a hit on your side reads
    // even while your eye is on the ball
    const hurtAge = this.time - this.hurtPulse;
    if (hurtAge < 0.35) {
      const g = ctx.createRadialGradient(a.x + a.w / 2, a.y + a.h / 2, Math.min(a.w, a.h) * 0.35, a.x + a.w / 2, a.y + a.h / 2, Math.max(a.w, a.h) * 0.72);
      g.addColorStop(0, 'rgba(255,60,60,0)');
      g.addColorStop(1, 'rgba(255,60,60,1)');
      ctx.globalAlpha = (1 - hurtAge / 0.35) * 0.25 * (settings().flash ? 1 : 0.4);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W_CANVAS_FALLBACK, 960);
      ctx.globalAlpha = 1;
    }

    if (this.dragging && this.phase === 'aim') this.drawAim(ctx);

    ctx.restore();

    // live combo meter — the chain count climbs while the ball flies so
    // the player reads the line they built, not just the aftermath
    if (this.phase === 'shot' && this.shotCombo >= 2) {
      const heat = Math.min(1, this.shotCombo / 8);
      const pop = 1 + Math.sin(this.time * 12) * 0.06 * heat;
      ctx.textAlign = 'center';
      ctx.font = font(20 * pop);
      ctx.fillStyle = this.shotCombo >= 8 ? '#ff6b6b' : this.shotCombo >= 5 ? '#ffd84d' : '#9df0ff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      if (this.comboLabelN !== this.shotCombo) {
        this.comboLabelN = this.shotCombo;
        this.comboLabel = `COMBO ×${this.shotCombo}`;
      }
      ctx.strokeText(this.comboLabel, this.arena.x + this.arena.w / 2, this.arena.y + 140);
      ctx.fillText(this.comboLabel, this.arena.x + this.arena.w / 2, this.arena.y + 140);
      // the chain's payoff reads under it — +10% contact damage a link,
      // same ramp the damage formula applies (metronome/electric included)
      ctx.font = font(10);
      ctx.lineWidth = 3;
      const pay = `+${Math.round(this.shotCombo * (0.1 + this.comboDmg + this.t('electric') * 0.04) * 100)}% DMG`;
      ctx.strokeText(pay, this.arena.x + this.arena.w / 2, this.arena.y + 160);
      ctx.fillText(pay, this.arena.x + this.arena.w / 2, this.arena.y + 160);
    }

    // signature cut-in — scrim + type rake under the flashes; every named
    // ult wears it for its first 0.32s. Reduced motion dims it to a still wash.
    if (this.cutin.t > 0) {
      const c = this.cutin, k = Math.max(c.t / c.life, 0), still = settings().shake === 0;
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, a.x, a.y, a.w, a.h, 18);
      ctx.clip();
      ctx.globalAlpha = (still ? 0.2 : 0.34) * k;
      ctx.fillStyle = '#04060e';
      ctx.fillRect(a.x, a.y, a.w, a.h);
      if (!still) { // the rake: a type-colored band sweeping the court
        const sweep = (1 - k) * (a.w + 340) - 170;
        ctx.globalAlpha = 0.5 * k;
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.moveTo(a.x + sweep, a.y + a.h);
        ctx.lineTo(a.x + sweep + 60, a.y + a.h);
        ctx.lineTo(a.x + sweep + 200, a.y);
        ctx.lineTo(a.x + sweep + 140, a.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // screen flashes render unshaken, on top — the accessibility toggle
    // keeps the telegraph but caps how hard it hits
    for (const f of this.flashes) {
      ctx.globalAlpha = Math.max(f.t / f.life, 0) * (settings().flash ? 0.42 : 0.25);
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, W_CANVAS_FALLBACK, 2000);
    }
    ctx.globalAlpha = 1;
    // the ult's cinema beat — letterbox bars drop in, the arena edges take
    // the move's type color, and its name hammers the center. Sits over the
    // flashes so it still reads through the white-out
    if (this.ultFx.t > 0) {
      const u = this.ultFx;
      const el = u.life - u.t;
      const k = Math.min(1, el * 7) * Math.min(1, Math.max(0, u.t) * 3.5);
      // type-colored vignette bleeding in from every edge
      ctx.globalAlpha = 0.5 * k;
      const vg = ctx.createRadialGradient(270, 480, 200, 270, 480, 640);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, u.color);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W_CANVAS_FALLBACK, 960);
      ctx.globalAlpha = k;
      const bh = 40 * Math.min(1, el * 8);
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, W_CANVAS_FALLBACK, bh);
      ctx.fillRect(0, 960 - bh, W_CANVAS_FALLBACK, bh);
      // banner: ULTIMATE kicker, then the move's name slammed in its color
      const cy = a.y + a.h * 0.4;
      const pop = 1 + Math.max(0, 0.18 - el) * 3;
      ctx.textAlign = 'center';
      ctx.font = font(12);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText('U L T I M A T E', 270, cy - 34);
      ctx.fillStyle = '#ffd84d';
      ctx.fillText('U L T I M A T E', 270, cy - 34);
      ctx.font = font(Math.round(24 * pop));
      ctx.lineWidth = 6;
      ctx.strokeText(u.text, 270, cy);
      ctx.fillStyle = u.color;
      ctx.fillText(u.text, 270, cy);
      ctx.font = fontB(10);
      ctx.lineWidth = 3;
      ctx.strokeText('MAP-WIDE · EVERY FOE TAKES THE HIT', 270, cy + 26);
      ctx.fillStyle = '#e8ecf8';
      ctx.fillText('MAP-WIDE · EVERY FOE TAKES THE HIT', 270, cy + 26);
      ctx.globalAlpha = 1;
    }
    // wipe pressure: a nearly-dead team breathes a red vignette — the danger
    // is felt at the edges before anyone reads a health bar
    if (this.phase === 'aim' || this.phase === 'shot' || this.phase === 'enemy') {
      let alive = 0, hpSum = 0;
      for (const p of this.players) if (!p.dead) { alive++; hpSum += p.hp / p.maxHp; }
      if (alive) {
        const avg = hpSum / alive;
        if (alive === 1 || avg < 0.35) {
          const pulse = 0.10 + Math.sin(this.time * 4) * 0.05;
          if (!dangerG) {
            dangerG = ctx.createRadialGradient(270, 480, 220, 270, 480, 560);
            dangerG.addColorStop(0, 'rgba(200,30,30,0)');
            dangerG.addColorStop(1, 'rgba(200,30,30,1)');
          }
          ctx.globalAlpha = pulse;
          ctx.fillStyle = dangerG;
          ctx.fillRect(0, 0, W_CANVAS_FALLBACK, 2000);
          ctx.globalAlpha = 1;
        }
      }
    }

    // FEVER tell — while a fever shot is armed (aim) or in flight, gold
    // bleeds in off the edges and corner ticks breathe over the court.
    // shake 0 (reduced-motion seed) holds the glow steady instead of pulsing
    if ((this.phase === 'aim' && this.fever) || (this.phase === 'shot' && this.shotFever)) {
      const pulse = settings().shake > 0 ? 0.3 + Math.sin(this.time * 6) * 0.14 : 0.28;
      if (!feverG) {
        feverG = ctx.createRadialGradient(270, 480, 240, 270, 480, 560);
        feverG.addColorStop(0, 'rgba(255,216,77,0)');
        feverG.addColorStop(1, 'rgba(255,216,77,1)');
      }
      ctx.globalAlpha = pulse;
      ctx.fillStyle = feverG;
      ctx.fillRect(0, 0, W_CANVAS_FALLBACK, 2000);
      ctx.globalAlpha = Math.min(1, pulse + 0.45);
      ctx.strokeStyle = '#ffd84d';
      ctx.lineWidth = 5;
      const o = 10, c = 30;
      ctx.beginPath();
      ctx.moveTo(a.x + o, a.y + o + c); ctx.lineTo(a.x + o, a.y + o); ctx.lineTo(a.x + o + c, a.y + o);
      ctx.moveTo(a.x + a.w - o - c, a.y + o); ctx.lineTo(a.x + a.w - o, a.y + o); ctx.lineTo(a.x + a.w - o, a.y + o + c);
      ctx.moveTo(a.x + a.w - o, a.y + a.h - o - c); ctx.lineTo(a.x + a.w - o, a.y + a.h - o); ctx.lineTo(a.x + a.w - o - c, a.y + a.h - o);
      ctx.moveTo(a.x + o + c, a.y + a.h - o); ctx.lineTo(a.x + o, a.y + a.h - o); ctx.lineTo(a.x + o, a.y + a.h - o - c);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    this.drawBattleHud(ctx);
    // boss nameplate — the gym fight reads as a real boss encounter
    // (sits below the timing-bar zone so it never overlaps the aim meter)
    const boss = this.enemies.find((e) => e.boss && !e.dead);
    if (boss) {
      const bw = 240, bx = 270 - bw / 2, by = a.y + 40;
      const pct = Math.max(boss.hp / boss.maxHp, 0);
      const title = `${boss.def.name.toUpperCase()} · x${(boss.bars ?? BOSS_BARS).length - boss.sumStage}`;
      ctx.textAlign = 'center';
      ctx.font = fontB(10);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(title, 270, by - 1);
      ctx.fillStyle = '#f0b02f';
      ctx.fillText(title, 270, by - 1);
      // held item on the nameplate — the quirk you're about to fight around
      if (boss.relic) {
        const ri = itemSprite(boss.relic);
        if (ri) {
          const w = ctx.measureText(title).width;
          ctx.drawImage(ri, 270 + w / 2 + 5, by - 10, 14, 14);
        }
      }
      ctx.fillStyle = '#000a';
      ctx.fillRect(bx, by + 5, bw, 7);
      ctx.fillStyle = pct > 0.5 ? '#f0b02f' : pct > 0.25 ? '#f08030' : '#ff6b6b';
      ctx.fillRect(bx, by + 5, bw * pct, 7);
      ctx.strokeStyle = '#f0b02f';
      ctx.lineWidth = 1;
      let boundary = 1;
      for (const bar of (boss.bars ?? BOSS_BARS).slice(0, -1)) {
        boundary -= bar;
        ctx.fillStyle = '#fff9';
        ctx.fillRect(bx + bw * boundary - 0.5, by + 3, 1, 11);
      }
      ctx.strokeRect(bx, by + 5, bw, 7);
    } else { const mid = this.enemies.find((e) => e.mid && !e.dead); if (mid) drawMidBar(ctx, mid, a); }

    // victory loot HUD — a gold fuse draining over the court
    if (this.phase === 'loot') {
      const bx = 150, bw = 240;
      ctx.fillStyle = '#000a';
      ctx.fillRect(bx, a.y + 24, bw, 8);
      ctx.fillStyle = '#ffd84d';
      ctx.fillRect(bx, a.y + 24, bw * Math.max(this.lootT / 6, 0), 8);
      ctx.strokeStyle = '#f0b02f';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, a.y + 24, bw, 8);
      ctx.font = font(10);
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.6 + Math.sin(this.time * 5) * 0.25;
      ctx.fillStyle = '#ffe89d';
      ctx.fillText(this.lootDrag ? 'SCOOP THEM UP!' : 'Drag through the coins', 270, a.y + a.h - 14);
      ctx.globalAlpha = 1;
    }

    if (this.phase === 'aim') this.drawTurnCue(ctx);

    // tapped-foe scout card — floats while aiming, a pull dismisses it
    if (this.inspect && this.phase === 'aim') this.drawInspect(ctx);

    // the arrival tell — a gold ! pops at arena top as control lands. Drawn
    // under the coach scrim so the guided beats can dim it with the court.
    const intro = this.time - this.waveIntroT;
    if (this.phase === 'aim' && intro < 0.6) {
      ctx.globalAlpha = Math.min(1, (0.6 - intro) * 5);
      ctx.font = font(Math.round(24 * (1 + Math.sin(intro * 16) * 0.15)));
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd76a';
      ctx.fillText('!', a.x + a.w / 2, a.y + 56);
      ctx.globalAlpha = 1;
    }

    if (this.phase === 'aim' && !this.dragging && !this.active.dead && this.coach) this.drawCoach(ctx);

    this.telop.draw(ctx, a, W_CANVAS_FALLBACK);
    this.drawBossIntro(ctx);

    // the freeze frame — drawn dead last so nothing paints over it; a tap
    // anywhere thaws (pointerDown drops it before any other handling)
    if (this.paused !== this.wasPaused) {
      this.wasPaused = this.paused;
      if (this.paused) this.pauseT0 = this.time;
    }
    if (this.paused) {
      const info = [STAGE_GIMMICKS[this.theme].label, ...(this.asc > 0 ? [`ASC ${this.asc}`] : []), `SCORE ${this.score.toLocaleString('en-US')}`].join(' · ');
      overlayPop(ctx, this.time - this.pauseT0, () =>
        drawPauseCard(ctx, this.themeName.toUpperCase(), info, this.ff, this.time, { settings: PAUSE_SETTINGS, quit: PAUSE_QUIT, speed: PAUSE_SPEED }),
      );
    }
  }

  private finZoom() {
    if (this.fin.t <= 0) return 0;
    const k = 1 - this.fin.t / FINISH_T;
    return FINISH_ZOOM * Math.max(0, Math.min(1, k / 0.2, (1 - k) / 0.4));
  }

  private calloutY(y: number, ascent: number, descent: number, rotatedHalf = 0) {
    const a = this.arena;
    const inset = 12 + this.shake / 2 + a.h / 2 * (this.punch + 2 * this.finZoom()) + rotatedHalf;
    return Math.min(Math.max(y, a.y + ascent + inset), a.y + a.h - 64 - descent - inset);
  }

  private place(x: number, y: number, w: number, asc: number, desc: number, up: boolean) {
    const placed = placeLabel(this.lblBox, this.lblN, x, y, w, asc, desc, this.arena.y, this.arena.y + this.arena.h - 64, up);
    this.lblN++;
    return placed;
  }

  private fieldLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, alpha: number, up = false) {
    ctx.font = fontB(LABEL_PX);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#000';
    let w = this.lblW.get(text);
    if (w === undefined) {
      w = ctx.measureText(text).width;
      this.lblW.set(text, w);
    }
    x = Math.min(Math.max(x, this.arena.x + w / 2 + 6), this.arena.x + this.arena.w - w / 2 - 6);
    y = this.place(x, y, w, LABEL_PX * 0.75, LABEL_PX * 0.12, up);
    ctx.globalAlpha = alpha;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
  }

  private introLeft() { return this.courtT + COURT_SCROLL + FOE_DROP + LABEL_INTRO - this.time; }
  private introAlpha() { return Math.min(1, Math.max(0, this.introLeft() / 0.3)); }

  private drawBattleHud(ctx: CanvasRenderingContext2D) {
    const c = this.pauseChip();
    uiWindow(ctx, c, { rad: 10 });
    ctx.fillStyle = INK;
    ctx.fillRect(c.x + 16, c.y + 17, 5, 18);
    ctx.fillRect(c.x + 27, c.y + 17, 5, 18);

    const r = this.ultChip();
    const ready = this.ultIn <= 0;
    const armed = this.time - this.ultArmT < 2 && this.players.some((u) => u.uid === this.ultArmUid && !u.dead);
    uiWindow(ctx, r, { rad: 10, tint: ready ? GOLD_HI : PAPER });
    if (ready) {
      ctx.save();
      ctx.strokeStyle = GOLD_HI;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.5 + Math.sin(this.time * 6) * 0.25;
      roundRect(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 12);
      ctx.stroke();
      ctx.restore();
    }
    const caster = armed ? this.players.find((u) => u.uid === this.ultArmUid)! : this.active;
    drawMon(ctx, caster.def.id, r.x + 28, r.y + 27, 44);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = fontB(13);
    const banked = ULT_SHOTS - Math.max(0, this.ultIn);
    ctx.fillText(ready ? this.phase === 'aim' ? armed ? 'TAP AGAIN' : 'TAP ULT' : 'ULT READY' : 'ULT · ' + banked + '/' + ULT_SHOTS, r.x + 54, r.y + 23);
    for (let i = 0; i < ULT_SHOTS; i++) {
      const x = r.x + 54 + i * 17;
      ctx.fillStyle = PARCH;
      ctx.fillRect(x, r.y + 32, 14, 10);
      ctx.fillStyle = '#c58d20';
      ctx.fillRect(x, r.y + 32, 14 * Math.max(0, Math.min(1, this.ultFill - i)), 10);
    }

    const f = { x: 332, y: r.y, w: 192, h: r.h };
    uiWindow(ctx, f, { rad: 10 });
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = fontB(12);
    ctx.fillText(this.enemies.filter((e) => !e.dead).length + ' FOES LEFT', f.x + f.w / 2, f.y + 22);
    ctx.fillText(this.phase === 'enemy' ? 'FOES ATTACK' : this.phase === 'shot' ? 'IN FLIGHT' : 'TURN ' + (this.stopShots + 1) + '/' + this.par, f.x + f.w / 2, f.y + 42);
    this.connect.draw(ctx, this.arena);
    this.missions.draw(ctx, this.time, this.arena, { shots: this.stopShots, par: this.par, weak: this.stopWeak, faints: this.stopFaints }, this.phase === 'aim' ? { theme: this.theme, name: this.themeName, sub: `STAGE ${this.waveIndex + 1}/${TOTAL_STAGES}`, foes: this.enemies.filter((e) => !e.dead).map((e) => e.def), team: this.players.filter((p) => !p.dead).map((p) => p.def) } : undefined);

    if (this.ultHint && this.phase === 'aim') {
      const h = { x: 76, y: this.arena.y + 60, w: 388, h: 64 };
      uiWindow(ctx, h, { rad: 10 });
      ctx.fillStyle = INK;
      ctx.font = fontB(13);
      ctx.fillText('Every shot charges ULT', 270, h.y + 26);
      ctx.fillText('Full? Tap ULT, then tap again to unleash', 270, h.y + 49);
    }
  }

  // aim phase only: a small NEXT cell — the FOES chip already names the
  // phase and the active mon wears its own arrow + name tag
  private drawTurnCue(ctx: CanvasRenderingContext2D) {
    const next = this.players.slice(this.activeIdx + 1).concat(this.players.slice(0, this.activeIdx)).find((p) => !p.dead);
    if (!next) return;
    const a = this.arena;
    const r = { x: a.x + a.w - 148, y: a.y + a.h - 56, w: 140, h: 48 };
    uiWindow(ctx, r, { rad: 10 });
    ctx.fillStyle = INK;
    ctx.font = fontB(11);
    ctx.textAlign = 'right';
    ctx.fillText('NEXT', r.x + r.w - 52, r.y + 20);
    ctx.fillText(next.def.name, r.x + r.w - 52, r.y + 38);
    drawMon(ctx, next.def.id, r.x + r.w - 27, r.y + 24, 38);
  }

  // The capture ritual: the mon sucks into the ball as it drops in, the
  // ball rocks on each tick, then a catch holds shut under a gotcha star
  // while a break-out tips the spent ball off. Runs over the fight and —
  // for map-phase catches like the egg or a ?-stop find — over the map.
  private drawCatchBalls(ctx: CanvasRenderingContext2D) {
    for (const b of this.balls) {
      const img = itemSprite(b.item);
      if (!img) continue;
      const el = b.life - b.t;
      const tail = el - b.at; // >0 once the click/burst has landed
      ctx.save();
      // the mon shrinks into the ball's landing spot — first 0.3s only
      if (b.id !== undefined && el < BALL_ROCK0) {
        const k = Math.max(0, 1 - el / BALL_ROCK0);
        ctx.globalAlpha = k;
        try {
          drawMon(ctx, b.id, b.x, b.y - el * 50, (b.r ?? 16) * 2.6 * k);
        } catch { /* sprite still loading */ }
        ctx.globalAlpha = 1;
      }
      const drop = Math.min(el / 0.24, 1); // fast drop-in
      ctx.translate(b.x, b.y - (1 - drop) * 70);
      if (el > BALL_ROCK0) {
        const rt = Math.min(el - BALL_ROCK0, b.rocks * BALL_ROCK_T);
        ctx.rotate(Math.sin((rt / BALL_ROCK_T) * Math.PI * 2) * 0.5 * Math.min((el - BALL_ROCK0) * 8, 1));
      }
      if (tail >= 0 && !b.ok) {
        // burst: the spent ball tips off and fades
        const k = Math.min(tail / BALL_TAIL, 1);
        ctx.globalAlpha = 1 - k;
        ctx.translate(0, k * 30);
        ctx.rotate(k * 0.9);
      }
      ctx.drawImage(img, -15, -15, 30, 30);
      ctx.restore();
      // the gotcha — a quick four-point star flares on the click shut
      if (tail >= 0 && b.ok) {
        const k = Math.min(tail / BALL_TAIL, 1);
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#ffffff';
        const s = 10 + k * 26;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
  }

  // Same ritual, clamped into a band: main.ts replays the ball layer over
  // the reward board (its anchor sits under the cards) and needs it inside
  // the open strip under the tool row. b.y is always restored, even if a
  // sprite draw throws mid-pass.
  drawBalls(ctx: CanvasRenderingContext2D, yMin: number, yMax: number) {
    const ys: number[] = [];
    for (const b of this.balls) {
      ys.push(b.y);
      b.y = Math.min(Math.max(b.y, yMin), yMax);
    }
    try {
      this.drawCatchBalls(ctx);
    } finally {
      const bs = this.balls;
      for (let i = 0; i < ys.length && i < bs.length; i++) bs[i].y = ys[i];
    }
  }

  // The scout card: tapping a foe (instead of pulling) answers "what is
  // that thing about to do" — name, bulk, type, and its attack countdown.
  private drawInspect(ctx: CanvasRenderingContext2D) {
    const e = this.enemies.find((x) => x.uid === this.inspect!.uid) ?? this.players.find((x) => x.uid === this.inspect!.uid);
    if (!e || e.dead) return;
    const foe = e.side === 'enemy';
    // the scout card names the counters — the kw tag shows the flag, these
    // lines say what it does. First two read; the rest is fieldwork.
    const tells = foe ? ([
      e.def.melee && 'lunges into your team',
      e.def.volley && 'fans its shot across three',
      e.def.summon && 'calls for help instead of attacking',
      e.def.mirror && 'transformed into your strongest mon',
      e.def.fuse && 'detonates at zero · blast hits everything',
      e.def.hunter && 'hunts your weakest mon',
      e.def.leech && 'heals off every hit it lands',
      e.clocks.some((c) => c.drain) && 'drain move · heals off its hit',
      !e.boss && e.clocks.length > 1 && 'dual typing · second wind-up on its own clock',
      e.safeguard && 'safeguard · grab a berry to break it',
      e.def.drowsy && 'its hits can put a mon to sleep',
      e.def.venom && 'its sting leaves a bleeding wound',
      e.def.burn && 'its hits can burn · singes and softens',
      e.def.para && 'its hits can paralyze · launches limp',
      e.def.toxic && 'contact can poison the ball',
      e.def.shock && 'contact can paralyze the ball',
      e.def.flame && 'contact can burn the ball',
      e.def.menace && 'intimidates · your hits lose a fifth while it lives',
      e.def.wguard && 'wonder guard · only super-effective hits land',
      e.def.sturdy && 'sturdy · hangs on at 1 HP once',
      e.def.charm && 'cute charm · contact can lull the ball to sleep',
      e.def.scale && 'multiscale · half damage while its hide is whole',
      e.def.guts && 'guts · hits 50% harder while statused',
      e.def.absorb && `${e.def.absorb} hits heal it · absorb`,
      e.def.truant && 'truant · loiters a round after each attack',
      e.def.boost && 'speed boost · re-arms faster every attack',
      e.def.spore && 'effect spore · contact scatters a random ailment',
      e.def.sync && 'synchronize · contact echoes its ailments to you',
      e.def.pressure && 'pressure · supers charge at half speed while it lives',
      e.def.beam && 'signal beam · locks a lane, then burns the channel',
      e.def.trap && 'arena trap · the ball can\'t flee its neighborhood',
      e.def.skyFor && `summons ${e.def.skyFor} · its sky rides the whole wave`,
      e.def.counter && 'counter · returns a third of contact damage',
      e.def.alpha && 'pack leader · rallies packmates\' hits while it lives',
      e.def.shed && 'shed skin · may slough off every ailment each tick',
      e.def.charge && 'stampede · paws the ground, then rams across the court',
      e.def.prank && 'prankster · its opening attack comes early',
      e.def.pheal && 'poison heal · your venom mends it; burn it instead',
      e.def.blink && 'teleports when it shimmers',
      e.def.thief && 'snatches pickups · KO it to take them back',
      e.def.lay && 'lays spikes in your half · kill it before the court fills',
      e.def.confuse && 'supersonic · contact rattles your next aim',
      e.def.anchor && 'too heavy to shove · banks and blasts leave it planted',
      e.def.flank && 'flanks the pack · it drifts wide before it closes',
      e.def.forecast && 'forecast · its type wears the sky',
      e.def.healBlock && 'heal block · your team can\'t mend while it lives',
      e.def.bond && 'destiny bond · a direct KO takes the striker with it',
      e.def.armor && 'shell armor · critical hits glance off',
      e.def.chameleon && 'color change · its hide becomes the type that hit it',
      e.def.weakArmor && 'weak armor · hits crack it: faster but softer',
      e.def.moxie && 'moxie · every KO it lands sharpens its bite',
      e.def.veil && 'sand veil · strikes whiff in a sandstorm',
      e.def.filter && 'filter · super-effective hits lose their edge',
      e.def.snipe && 'sniper · marks your farthest mon',
      e.def.unaware && 'unaware · your attack buffs wash off at its hide',
      e.def.swift && 'swift swim · presses 1.5× in its own sky',
      e.def.shielded && 'shell glances hits · flank pays',
      e.def.spiky && 'bites the ball on contact',
      !e.def.spiky && barbHide(e.def) && 'rough hide · contact bites back',
      aftermathKO(e.def) && 'aftermath · a direct KO blasts the striker',
      oozeBlood(e.def) && 'liquid ooze · drain hits swallow poison',
      poisonProof(e.def) && 'immunity · poison can\'t take',
      e.def.regen && 'mends over time',
      e.def.split && 'divides when KO\'d',
      e.def.rage && 'enrages when wounded',
      e.def.sleepy && 'dozes · the wake-up hit lands big',
      (e.def.repel || e.repelR) && 'repels the ball',
      e.def.raider && 'steals field drops',
      e.def.taunt && 'blocks hits on its allies',
      e.def.cursed && 'its KO taxes your supers',
    ].filter(Boolean) as string[]) : [];
    const a = this.arena;
    const w = Math.min(400, a.w - 24);
    const h = 140;
    const cx = Math.min(Math.max(e.x - w / 2, a.x + 6), a.x + a.w - w - 6);
    const cy = Math.max(a.y + 8, e.y - e.r - h - 16);
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.inspect!.t * 2.5);
    ctx.fillStyle = '#101430ee';
    ctx.strokeStyle = '#c8a44d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx, cy, w, h, 8);
    ctx.fill();
    ctx.stroke();
    // a tick anchored under the card points at the scouted foe
    ctx.beginPath();
    ctx.moveTo(Math.min(Math.max(e.x, cx + 12), cx + w - 12) - 6, cy + h);
    ctx.lineTo(Math.min(Math.max(e.x, cx + 12), cx + w - 12) + 6, cy + h);
    ctx.lineTo(Math.min(Math.max(e.x, cx + 12), cx + w - 12), cy + h + 8);
    ctx.closePath();
    ctx.fill();
    if (e.shiny) drawShiny(ctx, e.def.id, cx + 26, cy + 28, 36);
    else drawMon(ctx, e.def.id, cx + 26, cy + 28, 36);
    // the type tag owns the right edge — measure it first so a long name
    // shrinks into what's left instead of colliding off the card
    const typeStr = e.def.type2 ? `${e.def.type}/${e.def.type2}`.toUpperCase() : e.def.type.toUpperCase();
    ctx.font = fontB(10);
    const typeW = ctx.measureText(typeStr).width;
    ctx.fillStyle = TYPE_COLOR[e.def.type];
    ctx.textAlign = 'right';
    ctx.fillText(typeStr, cx + w - 10, cy + 16);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f0e6c8';
    let nameStr = `${e.shiny ? '★ ' : ''}${e.def.name.toUpperCase()}  LV${e.lvl}`;
    // the LV drops before the name eats the type tag — fitFont floors at 6px
    if (fitFontB(ctx, nameStr, 10, w - 60 - typeW - 8) <= 6 && ctx.measureText(nameStr).width > w - 60 - typeW - 8) {
      nameStr = `${e.shiny ? '★ ' : ''}${e.def.name.toUpperCase()}`;
      fitFontB(ctx, nameStr, 10, w - 60 - typeW - 8);
    }
    ctx.fillText(nameStr, cx + 50, cy + 16);
    // hp bar — the number players actually scout for
    ctx.fillStyle = '#2a3050';
    ctx.fillRect(cx + 50, cy + 24, w - 62, 7);
    const eLag = Math.max((e.hpLag ?? e.hp) / e.maxHp, 0);
    if (eLag > e.hp / e.maxHp) {
      ctx.fillStyle = '#fff9';
      ctx.fillRect(cx + 50, cy + 24, (w - 62) * eLag, 7);
    }
    ctx.fillStyle = e.hp / e.maxHp > 0.3 ? '#6fdc6f' : '#ff6b6b';
    ctx.fillRect(cx + 50, cy + 24, (w - 62) * Math.max(0, e.hp / e.maxHp), 7);
    ctx.font = fontB(10);
    ctx.fillStyle = '#e8ecf8';
    ctx.fillText(`${Math.ceil(e.hp)}/${e.maxHp}`, cx + 50, cy + 42);
    // the readout — foes show their attack clock; teammates show their super
    ctx.textAlign = 'left';
    ctx.font = fontB(10);
    if (foe) {
      ctx.fillStyle = e.timer <= 1 ? '#ff6b6b' : '#e8ecf8';
      // the priced read: ~N is the hit its next strike lands for, priced
      // through the same stack damagePlayer applies at land time
      const tgt = this.nearestPlayer(e);
      const zap = tgt ? ` ~${this.foeDmg(e, tgt, e.boss ? blastPower : this.zapPow(e), e.boss)}` : '';
      const hits = tgt && !e.supp ? ` · HITS${zap}` : ''; // support foes name their act — a price on a heal turn lies
      const heavy = tgt && (e.boss || e.mid) ? ` ~${this.foeDmg(e, tgt, zapPower * BOSS_BIG_POW, true)}` : '';
      const tag = this.flee.is(e) ? 'FLEEING' : e.boss
        ? `ATTACKS IN ${Math.ceil(e.timer)}${hits} · HEAVY IN ${Math.ceil(e.bigT)}${heavy} · WEAK ×3`
        : e.mid
          ? `ATTACKS IN ${Math.ceil(e.timer)}${hits} · HEAVY IN ${Math.ceil(e.bigT)}${heavy}`
          : e.supp === 'medic'
          ? `ATTACKS IN ${Math.ceil(e.timer)}${hits} · HEALS ALLIES`
          : e.supp === 'aegis'
            ? `ATTACKS IN ${Math.ceil(e.timer)}${hits} · SHIELDS ALLIES`
            : e.volatile
              ? `ATTACKS IN ${Math.ceil(e.timer)}${hits} · EXPLODES ON KO`
              : e.link
                ? `ATTACKS IN ${Math.ceil(e.timer)}${hits} · RISES UNLESS PAIRED`
                : `ATTACKS IN ${Math.ceil(e.timer)}${hits}`;
      const weakTag = !e.boss && !e.def.shielded ? (e.wpHidden ? ' · WEAK HIDDEN' : ' · WEAK ×2') : '';
      const readTag = tag + weakTag;
      const tagPx = fitFontB(ctx, readTag, 10, w - 60);
      // the fontB floor can't shrink a long read — ATK abbreviates ATTACKS
      // IN for everyone now, and a still-spilling line ellipsizes at the
      // card edge instead of inking past it
      let readout = tagPx < 8
        ? e.boss || e.mid
          ? `ATK ${Math.ceil(e.timer)}${zap} · HEAVY ${Math.ceil(e.bigT)}${heavy}${e.boss ? ' · WEAK ×3' : weakTag}`
          : `ATK ${Math.ceil(e.timer)}${zap}${weakTag}`
        : readTag;
      if (ctx.measureText(readout).width > w - 60) {
        while (readout.length > 3 && ctx.measureText(readout.trimEnd() + '…').width > w - 60) readout = readout.slice(0, -1);
        readout = readout.trimEnd() + '…';
      }
      ctx.fillText(readout, cx + 50, cy + 58);
      ctx.fillStyle = '#8890b8';
      const line0 = tells.length ? tells.slice(0, 2).join(' · ') : 'fires a projectile';
      ctx.font = fontB(10);
      wrap2(ctx, line0, w - 60).slice(0, 2).forEach((l, li) =>
        ctx.fillText(l, cx + 50, cy + 80 + li * 18));
      // the catch read — weaklings jump in the ball, aces above the team's
      // pace read locked. The % is live: balls + combo already folded in.
      const pct = this.inTrainer ? 0 : Math.round(Math.min(0.95, this.catchOdds(e)) * 100);
      ctx.fillStyle = this.inTrainer ? '#6a7090' : pct >= 15 ? '#6fdc6f' : pct >= 5 ? '#ffd84d' : '#8890b8';
      fitFontB(ctx, this.inTrainer ? 'STAYS WITH ITS TRAINER' : `KO MAY JOIN · ~${pct}%`, 10, w - 60);
      ctx.fillText(this.inTrainer ? 'STAYS WITH ITS TRAINER' : `KO MAY JOIN · ~${pct}%`, cx + 50, cy + h - 8);
    } else {
      ctx.fillStyle = '#ffd84d';
      ctx.fillText(`★ ${moveOf(e.def.id, e.def.type)}`, cx + 50, cy + 58);
      ctx.fillStyle = e.cd <= 0 ? '#6fdc6f' : '#8890b8';
      const ready = e.cd <= 0 ? `super ready · launch ${e.def.name} to fire it` : `super ready in ${e.cd} shot${e.cd === 1 ? '' : 's'}`;
      fitFontB(ctx, ready, 10, w - 60);
      ctx.fillText(ready, cx + 50, cy + 70);
      ctx.fillStyle = '#6a7498';
      ctx.font = fontB(10);
      wrap2(ctx, superDesc(e.def.id, e.def.type), w - 60).slice(0, 2).forEach((l, li) =>
        ctx.fillText(l, cx + 50, cy + 94 + li * 18));
    }
    ctx.restore();
  }

  // Forced focus for the guided beats: dim the court, soft holes over the
  // actors — everything else waits its turn. Evenodd clip + a feather ring
  // instead of destination-out, which would erase the art under the scrim too.
  private coachDim(ctx: CanvasRenderingContext2D, holes: [number, number, number][]) {
    const SC = 'rgba(6,8,18,0.55)';
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W_CANVAS_FALLBACK, 960);
    for (const [x, y, r] of holes) {
      // moveTo starts each arc as its own subpath — without it the clip path
      // chords hole-to-hole and evenodd carves a wedge corridor between them
      ctx.moveTo(x + r * 2.5, y);
      ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
    }
    ctx.clip('evenodd');
    ctx.fillStyle = SC;
    ctx.fillRect(0, 0, W_CANVAS_FALLBACK, 960);
    ctx.restore();
    for (const [x, y, r] of holes) {
      const g = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 2.5);
      g.addColorStop(0, 'rgba(6,8,18,0)');
      g.addColorStop(1, SC);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // First-run teaching — kinetic beats, each dismissed by doing the thing.
  // Beat 1 loops a ghost pull-back until the first launch; beat 2 routes a
  // shot through a teammate; beat 3 rings the foe whose counter sits at 0.
  private drawCoach(ctx: CanvasRenderingContext2D) {
    const a = this.arena;
    const u = this.active;
    const line = (s: string, color = '#ffe89d') => {
      ctx.font = fontB(10);
      ctx.globalAlpha = 0.55 + Math.sin(this.time * 4) * 0.3;
      ctx.strokeStyle = 'rgba(10,13,24,0.85)'; // units can stand under the band — halo keeps the beat legible
      ctx.lineWidth = 4;
      ctx.strokeText(s, a.x + a.w / 2, a.y + a.h - 58);
      ctx.fillStyle = color;
      ctx.fillText(s, a.x + a.w / 2, a.y + a.h - 58); // above the rim's low props, which ink over the floor's last strip
      ctx.globalAlpha = 1;
    };
    ctx.save();
    ctx.textAlign = 'center';
    if (this.shots === 0) {
      // the gesture itself on loop: elastic pull + fingertip ring, flight
      // dotted the other way — aimed at the nearest foe so it also aims
      let tgt: Unit | null = null;
      let tq = Infinity;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const edx = e.x - u.x, edy = e.y - u.y, q = edx * edx + edy * edy;
        if (q < tq) { tq = q; tgt = e; }
      }
      let px = 0, py = 1;
      if (tgt) {
        const d = Math.hypot(u.x - tgt.x, u.y - tgt.y) || 1;
        px = (u.x - tgt.x) / d;
        py = (u.y - tgt.y) / d;
      }
      this.coachDim(ctx, tgt ? [[u.x, u.y, u.r], [tgt.x, tgt.y, tgt.r]] : [[u.x, u.y, u.r]]);
      const ph = this.time % 1.7;
      const ease = 1 - (1 - Math.min(ph / 0.9, 1)) ** 2;
      const fade = ph > 1.2 ? Math.max(0, 1 - (ph - 1.2) / 0.5) : 1;
      const gx = u.x + px * ease * 90;
      const gy = u.y + py * ease * 90;
      ctx.globalAlpha = 0.85 * fade;
      ctx.strokeStyle = '#e8ecf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(u.x - px * 26, u.y - py * 26);
      ctx.lineTo(u.x - px * 140, u.y - py * 140);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = '#ffd84d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(gx, gy);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(gx, gy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (this.shots === 1) {
      const ally = this.players.find((p) => p !== u && !p.dead);
      if (ally) {
        this.coachDim(ctx, [[u.x, u.y, u.r], [ally.x, ally.y, ally.r]]);
        ctx.globalAlpha = 0.55 + Math.sin(this.time * 5) * 0.3;
        ctx.strokeStyle = '#ffd84d';
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 7]);
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.lineTo(ally.x, ally.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(ally.x, ally.y, ally.r + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    } else {
      // beats past the pull itself: teach what the field offers — first one
      // that applies wins the bottom line (they never stack)
      const glow = (x: number, y: number, r: number, color = '#ffd84d') => {
        ctx.globalAlpha = 0.55 + Math.sin(this.time * 5) * 0.3;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      };
      if (!u.dead && u.cd <= 0 && u.cdMax > 0) {
        glow(u.x, u.y, u.r + 10);
        line('PIPS ALL GOLD · THIS LAUNCH FIRES THE SUPER');
      } else if (this.balls.length) {
        const b = this.balls[0];
        glow(b.x, b.y, 22, '#e8ecf8');
        line('A BALL DROPPED · IF IT CLICKS SHUT, THE CATCH IS YOURS');
      } else if (this.pickups.length) {
        const pk = this.pickups[0];
        glow(pk.x, pk.y, 18);
        line('FLY THROUGH THE GLOWING ITEM · THE PICKUP IS YOURS');
      }
    }
    const threat = this.enemies.find((e) => !e.dead && e.timer <= 1);
    if (threat && this.shots > 0 && this.shots <= 3) {
      ctx.globalAlpha = 0.5 + Math.sin(this.time * 7) * 0.35;
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(threat.x, threat.y, threat.r + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // The climb as a town-map region: a seeded island of grass ringed by
  // beach and sea, 9 stops south→north on a carved route — gyms every
  // 3rd, trainer squads, chests, Poké Center rests.
  private drawRegion(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#0a0e1c';
    ctx.fillRect(0, 0, 540, 960);
    ctx.textAlign = 'center';

    const cell = MAP_CELL, ox = MAP_OX, oy = MAP_OY;
    const cam = Math.round(this.mapCam * cell) / cell; // pixel-snap keeps the baked tiles crisp
    const view = MAP_VIEW;
    // the island overhangs the frame's top edge so rooftops slide in under
    // the fade instead of being sliced flat by the clip
    const over = Math.min(2.2, Math.max(cam, 0));
    const y0 = Math.max(0, Math.floor(cam));
    const y1 = Math.min(MAP_H, Math.ceil(cam + view));
    const img = gracidea();
    // bake the island once — the region is fixed per run, so 350 tile
    // blits + save/restores per frame collapse into a single drawImage
    if (!this.regionBase && img) {
      const c = document.createElement('canvas');
      c.width = MAP_W * cell;
      c.height = MAP_H * cell;
      const g = c.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          const i = y * MAP_W + x;
          const t = this.region.tiles[i];
          const tile = this.region.route.has(i) ? MT.TILE_PATH : t === T_WATER ? MT.TILE_WATER : t === T_SAND ? MT.TILE_SAND : MT.TILE_GRASS;
          drawTile(g, tile, x * cell, y * cell, cell, cell);
        }
      }
      // carved dirt edges where a route meets open land — the trail reads
      // as cut ground, not painted sand
      g.fillStyle = 'rgba(44,28,12,0.32)';
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          const i = y * MAP_W + x;
          if (!this.region.route.has(i)) continue;
          const px = x * cell, py = y * cell;
          const open = (dx: number, dy: number) => {
            const nx = x + dx, ny = y + dy;
            return nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || !this.region.route.has(ny * MAP_W + nx);
          };
          if (open(-1, 0)) g.fillRect(px, py, 3, cell);
          if (open(1, 0)) g.fillRect(px + cell - 3, py, 3, cell);
          if (open(0, -1)) g.fillRect(px, py, cell, 3);
          if (open(0, 1)) g.fillRect(px, py + cell - 3, cell, 3);
        }
      }
      // faint dapples break up the big flat grass fill — deterministic
      // hash so the bake is identical every frame
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          const i = y * MAP_W + x;
          if (this.region.tiles[i] !== T_GRASS || this.region.route.has(i)) continue;
          if ((x * 31 + y * 17) % 19 < 2) {
            g.fillStyle = 'rgba(24,64,24,0.13)';
            g.fillRect(x * cell + 6 + ((x * 13 + y * 7) % 14), y * cell + 6 + ((x * 11 + y * 5) % 14), 7, 5);
          }
        }
      }
      for (const [i, kind] of this.region.decor) {
        const [id, size, lift] = DECOR_MONS[kind][i % DECOR_MONS[kind].length];
        const mx = (i % MAP_W) * cell + cell / 2, my = Math.floor(i / MAP_W) * cell + cell / 2;
        g.fillStyle = 'rgba(20,40,20,0.3)';
        g.beginPath();
        g.ellipse(mx, my + cell * 0.32, size * 0.36, size * 0.14, 0, 0, Math.PI * 2);
        g.fill();
        try {
          drawMon(g, id, mx, my - lift, size); // decor mons are preloaded via ALL_SPRITE_IDS
        } catch {
          continue;
        }
      }
      this.regionBase = c;
    }
    const sparkle = Math.floor(this.time * 4);
    if (this.regionBase) {
      // a slice of the island — the camera tracks the climb so only the
      // current triplet (battle → utility → gym) is ever on screen; `over`
      // rows above the frame stay drawn so building tops have land to sit on
      ctx.drawImage(this.regionBase, 0, (cam - over) * cell, MAP_W * cell, (view + over) * cell, ox, oy - over * cell, MAP_W * cell, (view + over) * cell);
      // only the water glints stay live
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < MAP_W; x++) {
          if (this.region.tiles[y * MAP_W + x] !== T_WATER || this.region.route.has(y * MAP_W + x)) continue;
          if (settings().mapGlints && (x * 7 + y * 11 + sparkle) % 23 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(ox + x * cell + cell * 0.3, oy + (y - cam) * cell + cell * 0.35, cell * 0.4, 2);
          }
        }
      }
    } else {
      const flat = (c: string, x: number, y: number) => {
        ctx.fillStyle = c;
        ctx.fillRect(ox + x * cell, oy + (y - cam) * cell, cell, cell);
      };
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < MAP_W; x++) {
          const i = y * MAP_W + x;
          const t = this.region.tiles[i];
          const px = ox + x * cell, py = oy + (y - cam) * cell;
          if (this.region.route.has(i)) flat('#c8a868', x, y);
          else if (t === T_WATER) {
            flat('#3060b0', x, y);
            if (settings().mapGlints && (x * 7 + y * 11 + sparkle) % 23 === 0) {
              ctx.fillStyle = 'rgba(255,255,255,0.25)';
              ctx.fillRect(px + cell * 0.3, py + cell * 0.35, cell * 0.4, 2);
            }
          } else if (t === T_SAND) flat('#d8c080', x, y);
          else flat('#4c9844', x, y);
        }
      }
    }
    // everything island-space lives inside the viewport — walking mons
    // and offscreen stops clip at the frame instead of bleeding over the HUD
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox - 6, oy - over * cell - 6, MAP_W * cell + 12, view * cell + 12 + over * cell);
    ctx.clip();
    // the trainer waits at the current stop, or walks the carved route
    // to the one you tapped — overworld style
    const at = this.region.nodes[this.mapNode];
    let lx = at ? at.tx : 0;
    let ly = at ? at.ty : 0;
    let frame = `${trainerPick()}_down_0`;
    if (this.mapWalk) {
      const { path, t } = this.mapWalk;
      const i = Math.min(Math.floor(t), path.length - 2);
      const f = t - i;
      const dx = path[i + 1].x - path[i].x;
      const dy = path[i + 1].y - path[i].y;
      lx = path[i].x + dx * f;
      ly = path[i].y + dy * f;
      // walk cycle: face the travel direction, cycle step frames
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      frame = `${trainerPick()}_${dir}_${[1, 0, 2][Math.floor(this.time * 8) % 3]}`;
    }
    // stops: cleared rows dim out, linked stops pulse bright — those are
    // the actual choices; unreachable future stops sit dim on the island
    const links = this.region.nodes[this.mapNode]?.links ?? [];
    // waypoint dots march along each open link — the affordance that
    // says "these are the stops you can pick"
    const cur0 = this.region.nodes[this.mapNode];
    if (cur0 && this.pendingNext > this.waveIndex && !this.mapWalk) {
      for (const li of links) {
        const t = this.region.nodes[li];
        const mx = ox + ((cur0.tx + t.tx) / 2) * cell + cell / 2;
        const my = oy + ((cur0.ty + t.ty) / 2 - cam) * cell + cell / 2;
        ctx.globalAlpha = 0.45 + Math.sin(this.time * 4) * 0.3;
        ctx.fillStyle = '#ffd84d';
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    this.region.nodes.forEach((n, i) => {
      if (n.ty - cam < -2.4 || n.ty - cam > view + 1) return; // offscreen row
      const nx = ox + n.tx * cell + cell / 2;
      const ny = oy + (n.ty - cam) * cell + cell / 2;
      const cleared = n.row < this.pendingNext && n.kind !== 'secret';
      const reachable = links.includes(i);
      const current = i === this.mapNode;
      if (n.kind === 'chest' || n.kind === 'event' || n.kind === 'wild') {
        // pickups stand on the stop like the trainers do — shadow first
        ctx.fillStyle = 'rgba(8,14,24,0.35)';
        ctx.beginPath();
        ctx.ellipse(nx, ny + cell * 0.4, cell * 0.5, cell * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        if (n.kind === 'chest') {
          // an item ball on the ground is the canon "loot here" read
          const ball = itemSprite('poke-ball');
          if (ball) ctx.drawImage(ball, nx - 13, ny - 18, 26, 26);
          else void loadItem('poke-ball');
        } else if (n.kind === 'event') {
          // a signpost = the ? stop — the real Gen 3 prop, not a drawn diamond
          const sign = itemSprite('sign');
          if (sign) ctx.drawImage(sign, nx - 14, ny - 30, 28, 30);
          else void loadItem('sign');
        } else {
          // a bush clump = tall grass — something wild is rustling there
          drawTile(ctx, MT.WALL_BUSH, nx - cell * 0.75, ny - cell * 0.65, cell * 1.5, cell * 1.5 * 26 / 48);
        }
      } else if (n.kind === 'trainer' || n.kind === 'elite') {
        // the class's overworld sprite stands on the stop — elites get the
        // ace trainer, the colored ring is still the squad's type
        const frame = n.kind === 'elite' ? 'ace_trainer_down_0' : TRAINER_CLASS[n.ttype ?? 'normal'].frame;
        // stop-guardians read as figures on the path — a person looms wrong
        // when they're taller than the buildings beside them
        drawNpc(ctx, frame, nx, ny + cell * 0.5, cell * 1.15);
      } else if (n.kind === 'secret') {
        drawSecretNode(ctx, nx, ny, cell, this.time);
      } else {
        const icon = n.kind === 'gym' ? MT.TILE_GYM : MT.TILE_TOWN; // start + rest are towns
        // HOME's cottage backs onto the tile above the stop so the player
        // (drawn over everything, below) stands at its door, not its roof
        const up = n.kind === 'start';
        // ground shadow first — the building stands on the island, not on it floats
        ctx.fillStyle = 'rgba(8,14,24,0.35)';
        ctx.beginPath();
        ctx.ellipse(nx, ny + cell * (up ? -0.5 : 0.55), cell * 0.85, cell * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();
        drawTile(ctx, icon, nx - cell, ny - cell * (up ? 2.5 : 1.35), cell * 2, cell * 2);
        if (n.kind === 'rest' || n.kind === 'mart') {
          const potion = itemSprite(n.kind === 'rest' ? 'max-potion' : 'potion');
          if (potion) ctx.drawImage(potion, nx + cell * 0.5, ny - 4, 20, 20);
        }
      }
      ctx.globalAlpha = cleared ? 0.35 : reachable ? 1 : 0.5;
      ctx.strokeStyle = reachable
        ? (n.kind === 'elite' ? '#b090ff' : n.kind === 'trainer' ? '#ff6b6b' : '#ffd84d')
        : current ? '#6fdc6f' : '#c8d0e8';
      ctx.lineWidth = reachable || current ? 3 : 2;
      ctx.beginPath();
      ctx.arc(nx, ny, cell * (reachable ? 0.6 + Math.sin(this.time * 5) * 0.08 : 0.42), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // the coached first screen is the map — ring the picks with the
      // same pulse the battle coach uses before the first shot lands
      if (reachable && this.coach && this.shots === 0) {
        ctx.globalAlpha = 0.55 + Math.sin(this.time * 5) * 0.3;
        ctx.strokeStyle = '#ffd84d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(nx, ny, cell * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (cleared) {
        ctx.font = font(12);
        ctx.fillStyle = '#6fdc6f';
        ctx.fillText('✓', nx, ny + 4);
      }
    });
    // labels in a second pass so buildings can't paint over a neighbor's name
    this.region.nodes.forEach((n, i) => {
      if ((n.row < this.pendingNext && n.kind !== 'secret') || n.ty - cam < -2.4 || n.ty - cam > view + 1) return;
      const nx = ox + n.tx * cell + cell / 2;
      const ny = oy + (n.ty - cam) * cell + cell / 2;
      const reachable = links.includes(i);
      const current = i === this.mapNode;
      // town-map style: every stop is named, choices glow brightest
      ctx.font = font(10);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      const label =
        n.kind === 'gym' ? 'GYM'
        : n.kind === 'event' ? '???'
        : n.kind === 'rest' ? 'REST'
        : n.kind === 'mart' ? 'MART'
        : n.kind === 'chest' ? 'CHEST'
        : n.kind === 'elite' ? 'ELITE'
        : n.kind === 'trainer' ? TRAINER_CLASS[n.ttype ?? 'normal'].title
        : n.kind === 'secret' ? 'SECRET'
        : n.kind === 'start' ? 'HOME'
        : 'WILD';
      // the sign stack hangs above the stop — top-edge doors would slice
      // on the island clip, so those flip and hang below instead
      const lift = n.kind === 'secret' ? 1.75 : 0.95;
      const flip = ny - cell * lift - 12 < oy - over * cell - 6;
      const sy = flip ? ny + cell * 0.78 : ny - cell * lift;
      ctx.strokeText(label, nx, sy);
      ctx.fillStyle = reachable
        ? (n.kind === 'elite' ? '#c8b0ff' : n.kind === 'trainer' ? '#ff8a8a' : '#ffd84d')
        : current ? '#6fdc6f' : '#8a94b8';
      ctx.fillText(label, nx, sy);
      // trainer squads are mono-type — name it so routing around a bad
      // matchup is a choice, not a coin flip; gyms sign their leader's
      // type the same way
      if (n.kind === 'trainer' || n.kind === 'elite' || n.kind === 'gym') {
        const ty = (n.ttype ?? 'normal').toUpperCase();
        ctx.font = fontB(10);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        const tyY = flip ? sy + 12 : ny - cell * 0.95 + 12;
        ctx.strokeText(ty, nx, tyY);
        ctx.fillStyle = TYPE_COLOR[n.ttype ?? 'normal'];
        ctx.fillText(ty, nx, tyY);
        const gimmick = STAGE_GIMMICKS[TYPE_THEME[n.ttype ?? 'normal']];
        // three lines max (name · type · one hint) so nothing draws over the building:
        // the team's counter mons if any, else the court gimmick
        const counters = this.players.filter((p) => !p.dead && countersGimmick(p.def, gimmick));
        let hint = counters.length
          ? `${counters[0].def.name.toUpperCase()}${counters.length > 1 ? ` +${counters.length - 1}` : ''} HELPS`
          : [gimmick.label, ...bulletHints(TYPE_THEME[n.ttype ?? 'normal'], n.ttype ?? 'normal')].join(' · ');
        ctx.font = fontB(10);
        // the fontB floor can't shrink a long hint — ellipsize at ~5½ cells
        // before it inks over a neighbor's sign
        const hintMax = cell * 5.5;
        if (ctx.measureText(hint).width > hintMax) {
          while (hint.length > 3 && ctx.measureText(hint.trimEnd() + '…').width > hintMax) hint = hint.slice(0, -1);
          hint = hint.trimEnd() + '…';
        }
        const hintY = flip ? sy + 25 : ny - cell * 0.95 + 25;
        ctx.strokeText(hint, nx, hintY);
        ctx.fillStyle = counters.length ? '#ffd84d' : TYPE_COLOR[gimmick.type];
        ctx.fillText(hint, nx, hintY);
      }
    });
    // the trainer draws last — she walks in front of the stops, and at
    // HOME she stands on the cottage's doorstep instead of its roof
    if (at) {
      const bob = this.mapWalk ? 0 : Math.sin(this.time * 4) * 1.5;
      drawNpc(ctx, frame, ox + lx * cell + cell / 2, oy + (ly - cam) * cell + cell * 0.55 + bob, cell * 1.3);
    }
    ctx.restore(); // end island clip
    ctx.strokeStyle = '#2a3560';
    ctx.lineWidth = 3;
    ctx.strokeRect(ox - 8, oy - 8, MAP_W * cell + 16, view * cell + 16);
    // sheers at both edges sell the scroll — the island keeps going; the
    // top one runs deep over the overhang so rooftops slide out of shadow
    if (!mapTopG) {
      mapTopG = ctx.createLinearGradient(0, oy - 6, 0, oy + cell * 1.4);
      mapTopG.addColorStop(0, 'rgba(10,14,28,0.97)');
      mapTopG.addColorStop(1, 'rgba(10,14,28,0)');
    }
    ctx.save();
    // `over` stretches the top edge as the island overhangs — scaling the
    // cached gradient's window from its fixed bottom anchor is exact
    ctx.translate(0, oy + cell * 1.4);
    ctx.scale(1, (over * cell + cell * 1.4 + 6) / (cell * 1.4 + 6));
    ctx.translate(0, -(oy + cell * 1.4));
    ctx.fillStyle = mapTopG;
    ctx.fillRect(ox - 8, oy - 6, MAP_W * cell + 16, cell * 1.4 + 6);
    ctx.restore();
    if (!mapBotG) {
      mapBotG = ctx.createLinearGradient(0, oy + view * cell, 0, oy + view * cell - cell * 1.6);
      mapBotG.addColorStop(0, 'rgba(10,14,28,0.7)');
      mapBotG.addColorStop(1, 'rgba(10,14,28,0)');
    }
    ctx.fillStyle = mapBotG;
    ctx.fillRect(ox - 4, oy + view * cell - cell * 1.6, MAP_W * cell + 8, cell * 1.6);
    // soft vignette keeps the eye on the island
    if (!mapVig) {
      mapVig = ctx.createRadialGradient(270, oy + view * cell / 2, 200, 270, oy + view * cell / 2, 520);
      mapVig.addColorStop(0, 'rgba(0,0,0,0)');
      mapVig.addColorStop(1, 'rgba(0,0,0,0.45)');
    }
    ctx.fillStyle = mapVig;
    ctx.fillRect(0, 0, 540, 960);

    // the field log docks along the viewport's bottom edge — cleared island
    // rows are dead space (taps only ever reach linked stops). One strip:
    // the freshest note, the rest is scrollback
    if (this.fieldLog.length) {
      const lx = ox - 4, ly = oy + view * cell - 30, lw = MAP_W * cell + 8;
      ctx.fillStyle = 'rgba(10,14,28,0.78)';
      ctx.fillRect(lx, ly, lw, 26);
      ctx.strokeStyle = '#2a3560';
      ctx.lineWidth = 2;
      ctx.strokeRect(lx + 1, ly + 1, lw - 2, 24);
      ctx.textAlign = 'left';
      ctx.font = fontB(10);
      ctx.fillStyle = '#ffd84d';
      ctx.fillText('FIELD LOG', lx + 10, ly + 16);
      const tx = lx + 18 + ctx.measureText('FIELD LOG').width;
      const line = this.fieldLog[this.fieldLog.length - 1];
      ctx.fillStyle = '#e8ecf8';
      // a runaway note used to ink past the dock's right edge — cap it
      let t2 = line;
      while (t2.length > 3 && tx + ctx.measureText(t2 + '…').width > lx + lw - 10) t2 = t2.slice(0, -1);
      if (t2 !== line) t2 += '…';
      ctx.fillText(t2, tx, ly + 16);
      ctx.textAlign = 'center';
    }

    // header rides over the faded island edge — text stays crisp while
    // rooftops scroll beneath it
    ctx.fillStyle = '#f8d030';
    // long region names shrink instead of running under the corner chips —
    // 236px keeps the cap inside the gear chip's left edge
    fitFont(ctx, this.stage.name.toUpperCase(), 22, 236);
    ctx.fillText(this.stage.name.toUpperCase(), 270, 64);
    ctx.font = font(12);
    ctx.fillStyle = '#8890b8';
    ctx.fillText(`STAGE ${this.pendingNext + 1} OF ${TOTAL_STAGES}`, 270, 88);

    ctx.font = fontB(10);
    if (this.coach && this.shots === 0) {
      ctx.globalAlpha = 0.55 + Math.sin(this.time * 4) * 0.3;
      ctx.strokeStyle = 'rgba(10,13,24,0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText('TAP A STOP · YOUR CLIMB STARTS', 270, oy + view * cell + 30);
      ctx.fillStyle = '#ffe89d';
      ctx.fillText('TAP A STOP · YOUR CLIMB STARTS', 270, oy + view * cell + 30);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#aab4d8';
      ctx.fillText('choose your route: tap a linked stop', 270, oy + view * cell + 30);
    }
    // the stop legend is onboarding text — the signs carry it after the
    // first couple of rows
    if (this.waveIndex < 2) {
      ctx.font = fontB(10);
      ctx.fillStyle = '#8890b8';
      fitCenter(ctx, 'WILD catchable fight · TRAINER mono-type squad · no catches, better loot', 270, oy + view * cell + 48, 516);
      fitCenter(ctx, 'CHEST item, then a fight · REST heal+revive · ??? surprise · ELITE rare loot · GYM boss', 270, oy + view * cell + 64, 516);
    }
    // resolved events and egg ticks surface as a toast over the island
    if (this.mapMsgT > 0 && this.mapMsg) {
      ctx.globalAlpha = Math.min(1, this.mapMsgT);
      fitFont(ctx, this.mapMsg, 13, 500);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText(this.mapMsg, 270, oy - 20);
      ctx.fillStyle = '#ffd84d';
      ctx.fillText(this.mapMsg, 270, oy - 20);
      ctx.globalAlpha = 1;
    }
    // active type traits sit above the map — onboarding chrome like the
    // legend lines: the first rows only, then the map stays clean
    if (this.waveIndex < 2 && this.traits.size) {
      let tx = ox;
      ctx.font = font(10);
      ctx.textAlign = 'left';
      for (const [ty, tier] of this.traits) {
        const name = `${ty.toUpperCase()} T${tier}`;
        ctx.fillStyle = 'rgba(20,26,48,0.85)';
        ctx.fillRect(tx - 3, oy + view * cell + 78, ctx.measureText(name).width + 8, 14);
        ctx.fillStyle = TYPE_COLOR[ty];
        ctx.fillText(name, tx + 1, oy + view * cell + 88);
        tx += ctx.measureText(name).width + 14;
      }
      ctx.textAlign = 'center';
    }
    // roster lives behind the menu button — the map stays clean; items, hp
    // and box swaps are one tap away. A fresh catch bounces the ball until
    // the panel's been opened.
    button(ctx, MAP_MENU, 'TEAM · ITEMS', true, 'poke-ball', this.boxPing ? -Math.abs(Math.sin(this.time * 6)) * 7 : 0);
    if (this.boxPing) {
      // new-catch alert: a breathing gold frame + a ! pip on the corner
      const glow = 0.5 + Math.sin(this.time * 6) * 0.35;
      ctx.strokeStyle = `rgba(255,216,77,${glow})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(MAP_MENU.x - 3, MAP_MENU.y - 3, MAP_MENU.w + 6, MAP_MENU.h + 6);
      ctx.fillStyle = '#ffd84d';
      ctx.beginPath();
      ctx.arc(MAP_MENU.x + MAP_MENU.w - 4, MAP_MENU.y - 2, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b2140';
      ctx.font = font(11);
      ctx.textAlign = 'center';
      ctx.fillText('!', MAP_MENU.x + MAP_MENU.w - 4, MAP_MENU.y + 7);
    }
    // ?-stop theatre: a resolved event or an open question pops a cabinet
    // card center-screen — art window up top, the words beneath, chunky
    // buttons or a blinking ▼
    const modalUp = !!(this.eventBox || this.eventChoice);
    if (modalUp !== this.wasModal) {
      this.wasModal = modalUp;
      if (modalUp) this.modalT0 = this.time;
    }
    if (modalUp)
      overlayPop(ctx, this.time - this.modalT0, () => {
        if (this.eventBox) {
          ctx.fillStyle = 'rgba(4,6,16,0.55)';
          ctx.fillRect(0, 0, 540, 960);
          this.drawEventCard(ctx, this.eventBox.art, this.eventBox.note, null);
        }
        if (this.eventChoice) {
          const k = this.eventChoice.node.kind;
          if (k === 'rest' || k === 'mart') {
            this.choiceHit = drawStopScene(ctx, {
              kind: k,
              t: this.time,
              cardT: this.cardT,
              prompt: this.eventChoice.prompt,
              options: this.eventChoice.options,
              score: this.score,
            });
          } else {
            ctx.fillStyle = 'rgba(4,6,16,0.55)';
            ctx.fillRect(0, 0, 540, 960);
            this.drawEventCard(ctx, this.eventChoice.art, this.eventChoice.prompt, this.eventChoice.options);
          }
        }
      });
    // event beats ride over the card scrim: the same additive pass the
    // court gets, plus the flash wash so an ambush's red pulse lands on
    // top of the reveal, not under it
    for (const f of this.flashes) {
      ctx.globalAlpha = Math.max(f.t / f.life, 0) * (settings().flash ? 0.42 : 0.25);
      ctx.fillStyle = f.color;
      ctx.fillRect(-40, -40, 620, 1040); // overscan so a map shake can't unmask an edge
    }
    ctx.globalAlpha = 1;
    drawFx(ctx, this.fx);
    this.drawCatchBalls(ctx); // map-phase catches rock on top of the card
  }

  // The pop-up event card: hard-cornered, gold-framed, offset shadow — same
  // cabinet language as the buttons. Scales in with a small overshoot.
  private drawEventCard(
    ctx: CanvasRenderingContext2D,
    art: EventArt | undefined,
    prompt: string,
    options: EventChoice[] | null,
  ) {
    // wrap first — card height depends on the line count
    ctx.font = fontB(13);
    const lines: string[] = [];
    let line = '';
    for (const w of prompt.split(' ')) {
      const t = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(t).width > 396) { lines.push(line); line = w; }
      else line = t;
    }
    if (line) lines.push(line);

    const CW = 460, PAD = 22, AH = 132;
    const mart = this.eventChoice?.node.kind === 'mart';
    const optH = options ? options.length * 56 + (mart ? 34 : 0) + 8 : 30;
    const ch = PAD + AH + 16 + lines.length * 24 + (options ? 12 + optH : 0) + PAD;
    const cx0 = (540 - CW) / 2, cy0 = (960 - ch) / 2 - 20;

    const pop = Math.min(1, this.cardT / 0.24);
    const ease = 1 + 2.2 * (pop - 1) ** 3 + 1.4 * (pop - 1) ** 2;
    ctx.save();
    ctx.globalAlpha = pop;
    ctx.translate(270, cy0 + ch / 2);
    ctx.scale(0.72 + 0.28 * ease, 0.72 + 0.28 * ease);
    ctx.translate(-270, -(cy0 + ch / 2));

    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(cx0 + 6, cy0 + 6, CW, ch);
    ctx.fillStyle = '#12152b';
    ctx.fillRect(cx0, cy0, CW, ch);
    ctx.strokeStyle = '#ffd84d';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx0 + 1.5, cy0 + 1.5, CW - 3, ch - 3);
    ctx.strokeStyle = '#c8a44d';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx0 + 7, cy0 + 7, CW - 14, ch - 14);

    // art window — an inset dark stage, the event's face bobs in it
    const ax = cx0 + PAD, ay = cy0 + PAD, aw = CW - PAD * 2;
    ctx.fillStyle = '#0a0f22';
    ctx.fillRect(ax, ay, aw, AH);
    ctx.strokeStyle = '#3a4370';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ax, ay, aw, AH);
    const axc = ax + aw / 2;
    const bob = Math.sin(this.time * 3) * 3;
    ctx.imageSmoothingEnabled = false;
    ctx.textAlign = 'center';
    if (art?.npc) drawNpc(ctx, art.npc, axc, ay + AH - 10 + bob * 0.4, 108);
    else if (art?.mon !== undefined) {
      try { drawMon(ctx, art.mon, axc, ay + AH / 2 + 8 + bob, 92); } catch { /* sprite still loading */ }
    } else if (art?.item || art?.slot) {
      const pool = art.slot ?? [art.item!];
      for (const n of pool) void loadItem(n);
      const img = itemSprite(art.slot ? pool[Math.floor(this.time * 5) % pool.length] : pool[0]);
      if (img) ctx.drawImage(img, axc - 34, ay + AH / 2 - 34 + bob * 0.6, 68, 68);
      if (art.slot) {
        ctx.fillStyle = '#ffd84d';
        for (let i = 0; i < 3; i++) ctx.fillRect(axc - 18 + i * 14, ay + AH - 24, 8, 4);
      }
    } else {
      // no art claimed — the glinting ? diamond the stop wears on the map
      ctx.save();
      ctx.translate(axc, ay + AH / 2 + bob * 0.4);
      ctx.rotate(Math.PI / 4);
      const d = 26 + Math.sin(this.time * 4) * 3;
      ctx.fillStyle = '#ffd84d';
      ctx.fillRect(-d, -d, d * 2, d * 2);
      ctx.restore();
      ctx.font = font(26);
      ctx.fillStyle = '#2a3560';
      ctx.fillText('?', axc + 4, ay + AH / 2 + 23 + bob * 0.4);
    }

    ctx.font = fontB(13);
    ctx.fillStyle = '#f0e6c8';
    lines.forEach((l, i) => ctx.fillText(l, 270, ay + AH + 34 + i * 24));

    if (!options) {
      if (Math.sin(this.time * 6) > -0.3) {
        ctx.fillStyle = '#ffd84d';
        ctx.fillText('▼', cx0 + CW - 32, cy0 + ch - 18);
      }
    } else {
      let oy = ay + AH + 16 + lines.length * 24 + 14;
      if (mart) {
        // the mart's wallet is run score — keep it over the shelf so a buy
        // is always weighed against what's in hand
        ctx.font = font(11);
        ctx.fillStyle = '#ffd84d';
        ctx.fillText(`WALLET: ${this.score} SCORE`, 270, oy + 10);
        oy += 34;
      }
      const bw = 380, bh = 46;
      this.choiceHit = options.map((_, i) => ({ x: (540 - bw) / 2, y: oy + i * (bh + 10), w: bw, h: bh }));
      options.forEach((o, i) => {
        const r = this.choiceHit[i];
        const afford = o.cost === undefined || o.cost <= this.score;
        if (o.cost !== undefined) {
          // priced picks: label sits left of the price tag — button()'s
          // centered text ran its tail into the cost
          button(ctx, r, '', afford, o.icon);
          const lx = r.x + 50;
          const ty = r.y + r.h / 2 + 4;
          // fitFont floors at 6px — a still-long label ellipsizes before it
          // runs into the price tag
          const lw = r.w - 50 - 64;
          let lab = o.label;
          if (fitFont(ctx, lab, 10, lw) <= 6) {
            while (lab.length > 3 && ctx.measureText(lab + '…').width > lw) lab = lab.slice(0, -1);
            lab += '…';
          }
          ctx.textAlign = 'left';
          ctx.fillStyle = afford ? '#f0e6c8' : '#6a7090';
          ctx.fillText(lab, lx, ty);
          ctx.font = fontB(10);
          ctx.textAlign = 'right';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 3;
          ctx.strokeText(`${o.cost}`, r.x + r.w - 10, ty);
          ctx.fillStyle = afford ? '#ffd84d' : '#6a7090';
          ctx.fillText(`${o.cost}`, r.x + r.w - 10, ty);
          ctx.textAlign = 'center';
        } else {
          button(ctx, r, o.label, afford, o.icon);
        }
      });
    }
    ctx.restore();
  }

  // Court weather: a faint sky-colored wash plus directional motes — rain
  // slants down, embers climb in the sun, sand drifts, wind streaks by.
  private drawWeather(ctx: CanvasRenderingContext2D) {
    const w = this.weather;
    const mod = this.curMod;
    // court-state mutators get the same ambient read — a slick floor
    // should look slick, a hexed court should feel cursed
    const modWash = mod === 'slick' || mod === 'hexed' || mod === 'tailwind' || mod === 'headwind' || mod === 'echo';
    if (!w && !modWash) return;
    const a = this.arena;
    const TAU = Math.PI * 2;
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, a.x, a.y, a.w, a.h, 18);
    ctx.clip();
    if (w) {
      ctx.fillStyle = WEATHER_TINT[w];
      ctx.globalAlpha = 0.06;
      ctx.fillRect(a.x, a.y, a.w, a.h);
    }
    if (modWash) {
      ctx.fillStyle = mod === 'hexed' ? '#a040a0' : mod === 'slick' ? '#9dd8f0' : mod === 'echo' ? '#b8c8ff' : '#b8e8c0';
      ctx.globalAlpha = mod === 'hexed' ? 0.07 : 0.045;
      ctx.fillRect(a.x, a.y, a.w, a.h);
      const t2 = this.time;
      for (let i = 0; i < 12; i++) {
        const h1 = hash(i * 5.3 + 2), h2 = hash(i * 3.1 + 7), h3 = hash(i * 7.7 + 1);
        if (mod === 'hexed') {
          // wisps climb out of the floorboards
          const y = a.y + a.h - ((h1 * a.h + t2 * 26 + i * 41) % a.h);
          const x = a.x + h2 * a.w + Math.sin(t2 * 1.1 + i * 2) * 10;
          ctx.globalAlpha = 0.12 + h3 * 0.12;
          ctx.fillStyle = '#c080e0';
          ctx.beginPath();
          ctx.arc(x, y, 1.8 + h3 * 1.4, 0, TAU);
          ctx.fill();
        } else if (mod === 'echo') {
          // rim glints ride the walls — the court edge itself is the gimmick
          const rim = 2 * (a.w + a.h);
          const s = (h1 * rim + t2 * 170 + i * 137) % rim;
          let gx = a.x, gy = a.y, horiz = true;
          if (s < a.w) { gx = a.x + s; }
          else if (s < a.w + a.h) { gx = a.x + a.w; gy = a.y + s - a.w; horiz = false; }
          else if (s < 2 * a.w + a.h) { gx = a.x + a.w - (s - a.w - a.h); gy = a.y + a.h; }
          else { gy = a.y + a.h - (s - 2 * a.w - a.h); horiz = false; }
          ctx.globalAlpha = 0.14 + h3 * 0.14;
          ctx.fillStyle = '#cfe0ff';
          ctx.fillRect(gx - (horiz ? 5 : 1.5), gy - (horiz ? 1.5 : 5), horiz ? 10 : 3, horiz ? 3 : 10);
        } else if (mod === 'slick') {
          // gloss streaks slide downcourt
          const x = a.x + ((h1 * a.w + t2 * 30 + i * 53) % a.w);
          const y = a.y + h2 * a.h;
          ctx.globalAlpha = 0.10 + h3 * 0.08;
          ctx.strokeStyle = '#d8f4ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x - 14, y);
          ctx.lineTo(x + 14, y);
          ctx.stroke();
        } else {
          // wind lanes — tailwind streams upcourt, headwind presses down
          const dirW = mod === 'tailwind' ? -1 : 1;
          const y = a.y + ((h1 * a.h + t2 * 120 * dirW + i * 61 + a.h * 8) % a.h);
          const x = a.x + h2 * a.w;
          ctx.globalAlpha = 0.10 + h3 * 0.1;
          ctx.strokeStyle = mod === 'tailwind' ? '#a8e8b8' : '#e8a8a8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, y + 8 * -dirW);
          ctx.lineTo(x, y + 8 * dirW);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    const t = this.time;
    const motes = Math.max(1, Math.round(24 * QUALITY_FX[settings().quality]));
    for (let i = 0; i < motes; i++) {
      const h1 = hash(i * 7.3 + 1), h2 = hash(i * 3.7 + 5), h3 = hash(i * 9.1 + 2);
      ctx.globalAlpha = 0.16 + h3 * 0.2;
      if (w === 'rain' || w === 'storm') {
        const y = a.y + ((h1 * a.h + t * (w === 'storm' ? 760 : 640) + i * 37) % a.h);
        const x = a.x + h2 * a.w;
        ctx.strokeStyle = w === 'storm' ? '#c8b8ff' : '#9dc0ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + 11);
        ctx.stroke();
      } else if (w === 'sun') {
        const y = a.y + a.h - ((h1 * a.h + t * 38 + i * 29) % a.h);
        const x = a.x + h2 * a.w + Math.sin(t * 1.4 + i) * 8;
        ctx.fillStyle = '#ffd060';
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, TAU);
        ctx.fill();
      } else if (w === 'sand') {
        const x = a.x + ((h1 * a.w + t * 80 + i * 53) % a.w);
        const y = a.y + h2 * a.h + Math.sin(t * 2 + i) * 5;
        ctx.fillStyle = '#e0c070';
        ctx.fillRect(x, y, 2, 2);
      } else {
        const x = a.x + ((h1 * a.w + t * 300 + i * 61) % a.w);
        const y = a.y + h2 * a.h;
        ctx.strokeStyle = '#e8f6ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 18 + h3 * 12, y - 3);
        ctx.stroke();
      }
    }
    // the thunderhead's tell — a hard violet-white flash rolls across the
    // court every few seconds
    if (w === 'storm' && t % 6 < 0.18) {
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#e8e0ff';
      ctx.fillRect(a.x, a.y, a.w, a.h);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // Hazard zones read as overworld props — a gracidea slice squashed to
  // the zone's footprint (vent, grass tufts, ponds, rocks, cave mouth)
  // with the animated cue that sells what it does. The tinted pad keeps
  // the radius readable while the atlas streams in. Mines are Voltorb.
  private drawDamageWalls(ctx: CanvasRenderingContext2D) {
    const a = this.arena;
    const labelAlpha = this.introAlpha();
    for (const w of this.damageWalls) {
      const vertical = w.edge === 'left' || w.edge === 'right';
      const span = (vertical ? a.h : a.w) * (w.end - w.start);
      const x = vertical ? (w.edge === 'left' ? a.x : a.x + a.w) : a.x + a.w * w.start;
      const y = vertical ? a.y + a.h * w.start : (w.edge === 'top' ? a.y : a.y + a.h);
      const tile = w.type === 'fire' ? MT.TILE_LAVA : w.type === 'grass' ? MT.TILE_HEDGE_TRIM : MT.TILE_FENCE;
      const age = this.time - (w.t0 ?? -9);
      const lit = this.wallLit(w);
      const live = this.wallLive(w);
      ctx.save();
      ctx.translate(x, y);
      if (vertical) ctx.rotate(Math.PI / 2);
      if (lit && !live) {
        const k = Math.max(0, Math.min(1, (age - WALL_DELAY) / WALL_FADE));
        ctx.globalAlpha = 0.45 * k;
        wallBlit(ctx, tile, span);
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#aab4d8';
        ctx.lineWidth = 2;
        ctx.setLineDash(WALL_DASH);
        ctx.strokeRect(0, -10, span, 20);
      } else if (live) {
        ctx.globalAlpha = 0.22 + Math.sin(this.time * 5) * 0.1;
        ctx.fillStyle = TYPE_COLOR[w.type];
        ctx.fillRect(0, -10, span, 20);
        ctx.globalAlpha = 0.8 + Math.sin(this.time * 5) * 0.2;
        wallBlit(ctx, tile, span);
        ctx.globalAlpha = 1;
      } else if (this.wallWarn(w)) {
        ctx.globalAlpha = 0.35 + 0.45 * (Math.sin(this.time * 12) > 0 ? 1 : 0);
        ctx.strokeStyle = TYPE_COLOR[w.type];
        ctx.lineWidth = 2;
        ctx.setLineDash(WALL_DASH);
        ctx.strokeRect(0, -10, span, 20);
      } else if (w.outT !== undefined && this.time - w.outT < WALL_OUT) {
        ctx.globalAlpha = 1 - (this.time - w.outT) / WALL_OUT;
        wallBlit(ctx, tile, span);
      } else {
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = '#aab4d8';
        ctx.lineWidth = 1;
        ctx.setLineDash(WALL_DASH);
        ctx.strokeRect(0, -10, span, 20);
      }
      if (labelAlpha > 0 && live) {
        ctx.globalAlpha = labelAlpha;
        ctx.font = fontB(LABEL_PX);
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#101826';
        ctx.lineWidth = 5;
        const ly = w.edge === 'top' ? 26 : -10; // the top rim sits under the HUD, so its tag hangs inside
        ctx.strokeText('DMG WALL', span / 2, ly);
        ctx.fillStyle = TYPE_COLOR[w.type];
        ctx.fillText('DMG WALL', span / 2, ly);
      }
      ctx.setLineDash(NO_DASH);
      ctx.restore();
    }
    // the wall that just bit the ball flashes its full edge — cause→effect
    // at a glance, no chasing a floating number
    const fx = this.wallHitFx;
    if (fx) {
      const k = (this.time - fx.t0) / 0.3;
      if (k >= 1) this.wallHitFx = null;
      else {
        ctx.globalAlpha = (1 - k) * 0.6;
        ctx.fillStyle = TYPE_COLOR[fx.type];
        const ew = 10;
        if (fx.edge === 'left') ctx.fillRect(a.x - ew + 2, a.y - 6, ew, a.h + 12);
        else if (fx.edge === 'right') ctx.fillRect(a.x + a.w - 2, a.y - 6, ew, a.h + 12);
        else if (fx.edge === 'top') ctx.fillRect(a.x - 6, a.y - ew + 2, a.w + 12, ew);
        else ctx.fillRect(a.x - 6, a.y + a.h - 2, a.w + 12, ew);
        ctx.globalAlpha = 1;
      }
    }
  }

  private drawWallWarnings(ctx: CanvasRenderingContext2D) {
    const a = this.arena;
    for (const w of this.damageWalls) {
      if (this.wallLit(w) || !this.wallWarn(w)) continue;
      const vertical = w.edge === 'left' || w.edge === 'right';
      const lx = vertical ? (w.edge === 'left' ? a.x : a.x + a.w) : a.x + a.w * (w.start + w.end) / 2;
      const ly = vertical ? a.y + a.h * (w.start + w.end) / 2 : w.edge === 'top' ? a.y + 24 : a.y + a.h - 12;
      const alpha = 0.35 + 0.45 * (Math.sin(this.time * 12) > 0 ? 1 : 0);
      this.fieldLabel(ctx, 'NEXT TURN', lx, ly, TYPE_COLOR[w.type], alpha);
    }
  }

  private drawFieldPanel(ctx: CanvasRenderingContext2D, hz: Hazard) {
    const healing = hz.kind === 'heal';
    const pulling = hz.kind === 'well';
    const color = HZ_TINT[hz.kind];
    ctx.save();
    if (!pulling) drawTile(ctx, MT.TILE_PATH, hz.x - hz.r, hz.y - hz.r * 0.6, hz.r * 2, hz.r * 1.2);
    ctx.globalAlpha = healing && hz.healShot === this.stopShots ? 0.35 : 0.7 + Math.sin(this.time * 4) * 0.15;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(hz.x, hz.y, hz.r, hz.r * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (pulling) {
      const radius = hz.r * (1 - (this.time * 0.7) % 1);
      ctx.globalAlpha *= radius / hz.r;
      ctx.beginPath();
      ctx.ellipse(hz.x, hz.y, radius, radius * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const img = itemSprite(healing ? 'oran-berry' : pulling ? 'twisted-spoon' : 'hard-stone');
    if (img) ctx.drawImage(img, hz.x - 14, hz.y - 18, 28, 28);
    const alpha = this.introAlpha();
    if (alpha > 0) {
      const label = healing ? 'HEAL' : pulling ? 'PULL' : 'GRAVITY';
      this.fieldLabel(ctx, label, hz.x, hz.y + 26, color, alpha);
    }
    ctx.restore();
  }

  private drawHazard(ctx: CanvasRenderingContext2D, hz: Hazard) {
    if (hz.moat) {
      const w = this.arena.w / 9, h = this.arena.h / 11;
      const adjacent = (x: number, y: number) => this.hazards.some((z) =>
        z.moat && Math.abs(z.x - x) < 1 && Math.abs(z.y - y) < 1);
      drawMoat(ctx, { x: hz.x - w / 2, y: hz.y - h / 2, w, h }, this.skinTheme, [
        adjacent(hz.x, hz.y - h), adjacent(hz.x + w, hz.y),
        adjacent(hz.x, hz.y + h), adjacent(hz.x - w, hz.y),
      ]);
      return;
    }
    if (hz.kind === 'heal' || hz.kind === 'gravity' || hz.kind === 'well') {
      this.drawFieldPanel(ctx, hz);
      return;
    }
    const TAU = Math.PI * 2;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = HZ_TINT[hz.kind];
    ctx.beginPath();
    ctx.ellipse(hz.x, hz.y, hz.r, hz.r * 0.6, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    const prop = HZ_PROP[hz.kind];
    if (prop) {
      const dw = hz.r * 2.1;
      const dh = Math.min(hz.r * 1.5, dw * (prop[3] / prop[2]) * 0.85);
      drawTile(ctx, prop, hz.x - dw / 2, hz.y - dh / 2, dw, dh);
    }
    if (hz.kind === 'lava') {
      // molten pool — scorched rock ring (atlas slice, seeded off the
      // pool's own coords), the two-tone pulse reads as lava
      for (let i = 0; i < 4; i++) {
        const a0 = i * 1.73 + hz.x * 0.013 + hz.y * 0.007;
        const rs = hz.r * (0.3 + ((i * 0.37) % 0.25));
        drawSlice(ctx, MT.ROCK_SMALL,
          hz.x + Math.cos(a0) * hz.r * 0.95 - rs / 2,
          hz.y + Math.sin(a0) * hz.r * 0.55 - rs / 2,
          rs, rs * 0.7, 'rgba(80,24,6,0.55)');
      }
      const pulse = 0.34 + Math.sin(this.time * 2.4) * 0.07;
      ctx.globalAlpha = pulse + 0.2;
      ctx.fillStyle = '#c23a0e';
      ctx.beginPath();
      ctx.ellipse(hz.x, hz.y, hz.r, hz.r * 0.68, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = pulse + 0.45;
      ctx.fillStyle = '#ff9a30';
      ctx.beginPath();
      ctx.ellipse(hz.x, hz.y, hz.r * 0.55, hz.r * 0.36, 0, 0, TAU);
      ctx.fill();
    } else if (hz.kind === 'gust') {
      const d = hz.dir ?? 1;
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#e8f6ff';
      ctx.lineWidth = 2.5;
      for (let i = -2; i <= 2; i++) {
        // chevrons stream in the push direction
        const off = (((this.time * 90 * d + i * 45) % (hz.r * 2)) + hz.r * 2) % (hz.r * 2) - hz.r;
        const cx = hz.x + off;
        if (Math.abs(cx - hz.x) > hz.r * 0.85) continue;
        ctx.beginPath();
        ctx.moveTo(cx - 6 * d, hz.y - 8);
        ctx.lineTo(cx + 6 * d, hz.y);
        ctx.lineTo(cx - 6 * d, hz.y + 8);
        ctx.stroke();
      }
    } else if (hz.kind === 'ice') {
      // frozen slick — sheen streaks drift across the pad so it reads as
      // slippery before the ball ever touches it
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#e8faff';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const off = ((this.time * 40 + i * hz.r * 0.7) % (hz.r * 1.6)) - hz.r * 0.8;
        ctx.beginPath();
        ctx.moveTo(hz.x + off - 7, hz.y + hz.r * 0.2 - i * hz.r * 0.25);
        ctx.lineTo(hz.x + off + 7, hz.y + hz.r * 0.2 - i * hz.r * 0.25);
        ctx.stroke();
      }
    } else if (hz.kind === 'static') {
      // silence pool: arcs rippling the surface — keywords go dead inside
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#c8a0ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = this.time * 2 + i * 2.1;
        ctx.beginPath();
        ctx.arc(hz.x + Math.cos(a) * hz.r * 0.4, hz.y + Math.sin(a) * hz.r * 0.3, 7, 0, TAU);
        ctx.stroke();
      }
    } else if (hz.kind === 'warp') {
      // linked pads: a violet ring pulses around each cave mouth
      const pulse = 0.7 + Math.sin(this.time * 4) * 0.3;
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#c890ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.r * (1 + pulse * 0.15), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#e0b0ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = this.time * 3 + i * (TAU / 3);
        ctx.beginPath();
        ctx.arc(hz.x, hz.y, hz.r * (0.25 + i * 0.14), a, a + 1.6);
        ctx.stroke();
      }
    } else if (hz.kind === 'boost') {
      // speed-up pad: chevrons chase around the dirt patch
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#9df09d';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const a = this.time * 2.5 + i * (TAU / 3);
        const cx = hz.x + Math.cos(a) * hz.r * 0.55;
        const cy = hz.y + Math.sin(a) * hz.r * 0.3;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy + 4);
        ctx.lineTo(cx, cy - 4);
        ctx.lineTo(cx + 5, cy + 4);
        ctx.stroke();
      }
    } else if (hz.kind === 'mine') {
      // Voltorb IS the mine — the dashed rim marks the blast reach
      const pulse = 0.6 + Math.sin(this.time * 5) * 0.4;
      ctx.globalAlpha = 0.3 + pulse * 0.15;
      ctx.strokeStyle = '#ff9a30';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.r * 2.2, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      try {
        drawMon(ctx, 100, hz.x, hz.y - hz.r * 0.2, hz.r * 1.7);
      } catch {
        // sprite still streaming — the tinted pad + rim still read
      }
    } else if (hz.kind === 'spikes') {
      // a cluster of Strength-rock boulders is the jagged strip
      for (const [ox, oy] of [[-0.55, 0.05], [0.05, -0.18], [0.5, 0.1]] as const) {
        drawTile(ctx, MT.TILE_ROCK, hz.x + ox * hz.r - hz.r * 0.45, hz.y + oy * hz.r - hz.r * 0.45, hz.r * 0.9, hz.r * 0.9);
      }
    } else if (hz.kind === 'power') {
      // ATK field: chevrons march upward over the dirt ring
      const pulse = 0.16 + Math.sin(this.time * 3) * 0.04;
      ctx.globalAlpha = pulse + 0.14;
      ctx.fillStyle = '#d83018';
      ctx.beginPath();
      ctx.ellipse(hz.x, hz.y, hz.r, hz.r * 0.68, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#ffb040';
      for (let i = 0; i < 3; i++) {
        const cy = hz.y + hz.r * 0.3 - ((this.time * 40 + i * 26) % (hz.r * 0.9));
        ctx.globalAlpha = 0.75 * (1 - (hz.y + hz.r * 0.3 - cy) / (hz.r * 0.9));
        ctx.beginPath();
        ctx.moveTo(hz.x - 14, cy);
        ctx.lineTo(hz.x, cy - 10);
        ctx.lineTo(hz.x + 14, cy);
        ctx.lineTo(hz.x, cy - 4);
        ctx.closePath();
        ctx.fill();
      }
    }
    // grass tufts carry the read on their own
    ctx.restore();
  }

  // StS intent made spatial: the turn before a boss fires, ghost its
  // signature so the next shot can reposition out of the line.
  private drawTelegraph(ctx: CanvasRenderingContext2D, e: Unit, anim: Recipe) {
    ctx.save();
    ctx.globalAlpha = 0.28 + Math.sin(this.time * 6) * 0.08;
    ctx.strokeStyle = '#ff6b6b';
    ctx.setLineDash([7, 6]);
    const targets = this.playersByDist(e);
    switch (e.def.id) {
      case 149: // hyper beam / thunderbolt — the burning line to the nearest mon
      case 125:
        if (targets[0]) {
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(targets[0].x, targets[0].y);
          ctx.stroke();
          ctx.globalAlpha = 1; drawTell(ctx, anim, e.x, e.y, targets[0].x, targets[0].y, this.time);
        }
        break;
      case 150: // hunting orbs — marks on the mons they'll chase
      case 94:
        ctx.lineWidth = 3;
        for (const p of targets.slice(0, e.def.id === 94 ? 3 : 2)) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + 8, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        for (let i = 0; i < Math.min(targets.length, e.def.id === 94 ? 3 : 2); i++) drawTellRing(ctx, anim, targets[i].x, targets[i].y, targets[i].r + 8, this.time);
        break;
      default: { // ring/blast attacks — show the radius they'll sweep
        ctx.lineWidth = 3;
        const R = { 130: 300, 3: 220, 112: 240, 6: 200 }[e.def.id] ?? 170;
        ctx.beginPath();
        ctx.arc(e.x, e.y, R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1; drawTellRing(ctx, anim, e.x, e.y, R, this.time);
      }
    }
    ctx.restore();
  }

  // Non-boss "about to strike" tell: a dashed leash to the mon it'll hit.
  private drawFoeTell(ctx: CanvasRenderingContext2D, e: Unit, anim: Recipe) {
    const t = this.nearestPlayer(e);
    if (!t) return;
    ctx.save();
    ctx.globalAlpha = 0.4 + Math.sin(this.time * 8) * 0.2;
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    drawTell(ctx, anim, e.x, e.y, t.x, t.y, this.time);
    // the priced hit rides the leash — same stack the landed orb pays
    const dmg = `-${this.foeDmg(e, t, this.zapPow(e))}`;
    ctx.font = fontB(10);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(dmg, t.x, t.y - t.r - 10);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText(dmg, t.x, t.y - t.r - 10);
  }

  // one tag per foe: what changes the next pull first; the full set only for the intro beat
  private foeTag(u: Unit, pullOnly: boolean): string | undefined {
    const d = u.def;
    if (u.safeguard) return 'SAFEGUARD';
    if (d.shielded) return 'SHELL';
    if (d.wguard) return 'W-GUARD';
    if (d.taunt) return 'MAGNET';
    if (d.repel) return 'REPEL';
    if (d.spiky) return 'SPIKY';
    if (d.counter) return 'COUNTER';
    if (d.sturdy && u.sash) return 'STURDY';
    if (pullOnly) return undefined;
    for (let i = 0; i < FOE_TAGS.length; i++) if (d[FOE_TAGS[i][0]]) return FOE_TAGS[i][1];
    if (d.scale && u.hp >= u.maxHp) return 'SCALE';
    if (d.absorb) return 'DRAIN';
    for (let i = 0; i < u.clocks.length; i++) if (u.clocks[i].drain) return u.clocks[i].move;
    if (u.dotTicks > 0) return 'VENOM';
  }

  private drawUnit(ctx: CanvasRenderingContext2D, u: Unit) {
    if (u.dead) return;
    // boss telegraph: one turn out, the signature's footprint ghosts in;
    // fodder gets a dashed leash to its target so the zap isn't a surprise
    if (u.side === 'enemy' && u.timer <= 1) {
      // a move clock on its last tick lands the same beat — the warn wears
      // its own sheet (type2 rows, override moves), not the primary's
      const clk = u.clocks.filter((c) => c.t <= 1).sort((a, b) => a.t - b.t)[0];
      const anim = recipeFor(clk?.type ?? u.def.type, clk?.move);
      if (u.boss) this.drawTelegraph(ctx, u, anim);
      else this.drawFoeTell(ctx, u, anim);
    }
    // ally pad — a flat disc under every friendly so your mons read as yours
    // at a glance; enemies carry their telegraphs instead
    if (u.side === 'player') {
      ctx.fillStyle = 'rgba(88,148,250,0.42)';
      ctx.beginPath();
      ctx.ellipse(u.x, u.y + u.r * 0.72, u.r * 1.06, u.r * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // soft shadow grounds the sprite on the court
    ctx.fillStyle = 'rgba(8,10,20,0.3)';
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + u.r * 0.72, u.r * 0.82, u.r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (u === this.active) this.connect.glow(ctx, u, this.time);
    // READY aura — a charged super rings its mon in type color
    if (u.side === 'player' && u.cd <= 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4 + Math.sin(this.time * 7) * 0.18;
      ctx.strokeStyle = TYPE_COLOR[u.def.type];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(u.x, u.y + u.r * 0.35, u.r * 1.02 + Math.sin(this.time * 7) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // squash & stretch: speed smears the sprite along its flight and
    // impacts squash it flat — the pinball pop is most of the feel
    const spd = Math.hypot(u.vx, u.vy);
    const st = Math.min(0.25, spd / 6000) + Math.min(u.sq, 1) * 0.22;
    // the mon on deck reads a touch bigger — same whose-up cue as the title
    const grow = u === this.active && this.phase === 'aim' ? 1.18 : 1;
    // everyone breathes a little — a standing army reads as a dead board
    const bob = Math.sin(this.time * 2.4 + u.uid * 1.7) * 1.2;
    // winged units ride a deeper bob — the SKY wave's whole tell is that
    // these foes float over the floor hazards
    const lift = u.airborne ? 5 + Math.sin(this.time * 2.2 + u.uid * 1.3) * 2.5 : 0;
    if (u.airborne) {
      // a detached ground shadow sells the hover better than any badge
      ctx.fillStyle = '#00000033';
      ctx.beginPath();
      ctx.ellipse(u.x, u.y + u.r * 0.85, u.r * 0.65, u.r * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // mid-evolution the cinematic owns the sprite — a white silhouette
    // flickering old↔new — so the settled new form doesn't peek through
    const evolving = this.evoFx.some((f) => f.u === u);
    // blink telegraph — the last half-second before the hop it flickers
    // half-there: read it and hold the shot
    const blinking = u.side === 'enemy' && u.def.blink && u.blinkT > 0 && u.blinkT < 0.45;
    if (blinking) ctx.globalAlpha = 0.3 + Math.abs(Math.sin(this.time * 18)) * 0.45;
    if (!evolving) {
      if (st > 0.02) {
        ctx.save();
        ctx.translate(u.x, u.y + bob - lift);
        if (spd > 40) ctx.rotate(Math.atan2(u.vy, u.vx));
        ctx.scale(1 + st, Math.max(0.55, 1 - st * 0.7));
        if (u.shiny) drawShiny(ctx, u.def.id, 0, 0, u.r * 2.6 * grow);
        else drawMon(ctx, u.def.id, 0, 0, u.r * 2.6 * grow);
        ctx.restore();
      } else {
        if (u.shiny) drawShiny(ctx, u.def.id, u.x, u.y + bob - lift, u.r * 2.6 * grow);
        else drawMon(ctx, u.def.id, u.x, u.y + bob - lift, u.r * 2.6 * grow);
      }
    }
    if (blinking) ctx.globalAlpha = 1;

    // hit flash — the sprite burns out white for a tenth of a second;
    // 'lighter' doubles the sprite on itself so the silhouette goes hot
    if (u.flashT > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, u.flashT * 8);
      if (u.shiny) drawShiny(ctx, u.def.id, u.x, u.y + bob - lift, u.r * 2.6 * grow);
      else drawMon(ctx, u.def.id, u.x, u.y + bob - lift, u.r * 2.6 * grow);
      ctx.restore();
    }

    // protein-fed shot — the buffed ball burns orange until it parks
    if (u === this.active && this.phase === 'shot' && this.shotPhys > 1) {
      ctx.strokeStyle = '#f08030';
      ctx.globalAlpha = 0.55 + Math.sin(this.time * 10) * 0.2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(u.x, u.y + bob - lift, u.r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // a paralyzed mon crackles — static sparks jitter while the launch limps
    if (u.paraT > 0 && !u.dead) {
      ctx.strokeStyle = '#f8d030';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 2; k++) {
        const ph = this.time * 6 + k * 2.4;
        const px = u.x + Math.sin(ph) * u.r * 0.8;
        const py = u.y - u.r * 0.5 + Math.cos(ph * 1.3) * u.r * 0.5;
        ctx.globalAlpha = 0.35 + Math.abs(Math.sin(ph * 2)) * 0.4;
        ctx.beginPath();
        ctx.moveTo(px - 4, py - 4);
        ctx.lineTo(px + 2, py);
        ctx.lineTo(px - 2, py + 2);
        ctx.lineTo(px + 4, py + 6);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // a burned mon flickers embers — the wisp's mark while it singes
    if (u.burnT > 0 && !u.dead) {
      ctx.fillStyle = '#f08030';
      for (let k = 0; k < 3; k++) {
        const ph = (this.time * 0.9 + k * 0.3) % 1;
        ctx.globalAlpha = 0.6 * (1 - ph);
        ctx.beginPath();
        ctx.arc(u.x + (k - 1) * u.r * 0.45 + Math.sin(this.time * 5 + k * 2.3) * 3, u.y - u.r * 0.4 - ph * u.r, 3 - ph * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // a dozing player gets the same zZ the sleepy foes wear — the nap is
    // readable at a glance, not a turn-order surprise
    if (u.asleep && u.side === 'player') {
      ctx.font = font(11);
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText('zZ', u.x + u.r - 2, u.y - u.r + 7);
      ctx.fillStyle = '#a890f0';
      ctx.fillText('zZ', u.x + u.r - 2, u.y - u.r + 7);
    }

    // a rattled player wears the dizzy mark — the next launch can veer, and
    // the wobbling ghost is the same honest read in a different register
    if (u.confuseT > 0 && u.side === 'player') {
      ctx.font = font(11);
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText('?', u.x - u.r + 2, u.y - u.r + 7);
      ctx.fillStyle = '#c8a8f8';
      ctx.fillText('?', u.x - u.r + 2, u.y - u.r + 7);
    }

    // focus sash — the white headband reads on both sides: a one-shot plan
    // should be visible before the shot commits, not after the pop.
    // sturdy foes skip the band — it's an ability, not a held item
    if (u.sash && !u.def.sturdy) {
      ctx.strokeStyle = '#f0f0e8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(u.x, u.y - u.r * 0.3 + bob - lift, u.r * 0.62, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    }

    // volatile — a sputtering ember crown: this one bursts when it falls
    if (u.side === 'enemy' && u.volatile) {
      const fl = 0.55 + Math.sin(this.time * 13 + u.uid * 1.7) * 0.35;
      ctx.fillStyle = '#ff9a30';
      ctx.globalAlpha = fl;
      drawStar(ctx, u.x + u.r * 0.6, u.y - u.r - 4, 4.5 + Math.sin(this.time * 17 + u.uid) * 1.5, 0.45);
      ctx.globalAlpha = fl * 0.5;
      ctx.beginPath();
      ctx.arc(u.x + u.r * 0.6, u.y - u.r - 4, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // envenomed — poison bubbles rise off the sprite while ticks remain
    if (u.dotTicks > 0) {
      ctx.fillStyle = '#a040a0';
      for (let k = 0; k < 3; k++) {
        const ph = (this.time * 0.7 + k * 0.34) % 1;
        ctx.globalAlpha = 0.55 * (1 - ph);
        ctx.beginPath();
        ctx.arc(
          u.x + (k - 1) * u.r * 0.5 + Math.sin(this.time * 3 + k * 2.1) * 4,
          u.y - u.r * 0.3 - ph * u.r * 1.3,
          3.5 - ph * 1.8, 0, Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // shinies twinkle — three gold four-point stars drift around the sprite
    if (u.shiny) {
      ctx.fillStyle = '#ffe76a';
      for (let k = 0; k < 3; k++) {
        const a = this.time * 1.6 + k * 2.1;
        const sx = u.x + Math.cos(a) * u.r * 0.9;
        const sy = u.y + Math.sin(a) * u.r * 0.7 - u.r * 0.2;
        const s = 4 + Math.sin(this.time * 5 + k * 1.7) * 1.6;
        if (s <= 0.5) continue;
        drawStar(ctx, sx, sy, s, 0.4);
      }
    }

    // hp bar
    const bw = u.r * 2;
    const pct = Math.max(u.hp / u.maxHp, 0);
    ctx.fillStyle = '#000a';
    ctx.fillRect(u.x - bw / 2, u.y + u.r + 4, bw, 5);
    // the wound trail — a pale slice bleeds down to the new hp so hits read
    const lagPct = Math.max((u.hpLag ?? u.hp) / u.maxHp, 0);
    if (lagPct > pct) {
      ctx.fillStyle = '#fff9';
      ctx.fillRect(u.x - bw / 2, u.y + u.r + 4, bw * lagPct, 5);
    }
    // enemies read hostile flat red; allies keep the health ramp
    ctx.fillStyle =
      u.side === 'enemy' ? '#e05050'
        : pct > 0.5 ? '#6fdc6f' : pct > 0.25 ? '#ffd84d' : '#ff6b6b';
    ctx.fillRect(u.x - bw / 2, u.y + u.r + 4, bw * pct, 5);

    if (u.side === 'enemy') {
      // aegis ward: a cyan bubble eats the next hit entirely
      if (u.shieldN > 0) {
        ctx.globalAlpha = 0.35 + Math.sin(this.time * 5) * 0.1;
        ctx.strokeStyle = TYPE_COLOR[u.def.type];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.r * 1.3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.font = fontB(11);
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#101826';
        ctx.lineWidth = 3;
        const reflectY = this.place(u.x, u.y + (u.minion ? u.r + 36 : u.r * 1.65), ctx.measureText(`REFLECT ${u.shieldN}`).width, 9, 2, false);
        ctx.strokeText(`REFLECT ${u.shieldN}`, u.x, reflectY);
        ctx.fillStyle = TYPE_COLOR[u.def.type];
        ctx.fillText(`REFLECT ${u.shieldN}`, u.x, reflectY);
      }
      if (u.safeguard) {
        ctx.globalAlpha = 0.25 + Math.sin(this.time * 4) * 0.1;
        ctx.fillStyle = '#f8a8d8';
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.r * 1.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // support marks: clerics carry a green cross, guardians a cyan
      // diamond — target priority readable at a glance
      if (u.supp) {
        ctx.fillStyle = u.supp === 'medic' ? '#7de87d' : '#9df0ff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        const iy = u.y - u.r - 16;
        if (u.supp === 'medic') {
          ctx.fillRect(u.x - 2, iy - 6, 4, 12);
          ctx.fillRect(u.x - 6, iy - 2, 12, 4);
          ctx.strokeRect(u.x - 2, iy - 6, 4, 12);
          ctx.strokeRect(u.x - 6, iy - 2, 12, 4);
        } else {
          ctx.beginPath();
          ctx.moveTo(u.x, iy - 6);
          ctx.lineTo(u.x + 6, iy);
          ctx.lineTo(u.x, iy + 6);
          ctx.lineTo(u.x - 6, iy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
      // shelled foes wear a plate on their facing — the flank window is
      // the unguarded rim. Drifts slowly; read it before the pull.
      if (u.def.shielded && !u.dead) {
        ctx.strokeStyle = '#9aa7b8';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.r + 3, u.shieldA - 0.85, u.shieldA + 0.85);
        ctx.stroke();
        ctx.strokeStyle = '#5c6478';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.r + 6, u.shieldA - 0.7, u.shieldA + 0.7);
        ctx.stroke();
      }
      // Weak points hold their face through a bar so the next pull can line up.
      if (!u.dead && !u.wpHidden && (u.boss || !u.def.shielded)) {
        const s = u.boss ? 7 + Math.sin(this.time * 6) * 2 : 5 + Math.sin(this.time * 6) * 1.5;
        const pop = u.wpPopT === undefined ? 0 : Math.max(0, 1 - (this.time - u.wpPopT) / 0.35);
        ctx.fillStyle = '#ffd84d';
        ctx.strokeStyle = '#000';
        for (const face of u.weakA2 === undefined ? [u.weakA] : [u.weakA, u.weakA2])
          drawStar(ctx, u.x + Math.cos(face) * u.r * 0.92, u.y + Math.sin(face) * u.r * 0.92, s * (1 + pop * 1.5), 0.4, 2);
      }
      if (u.boss && !u.dead) {
        // minion guard: while summoned adds live, a shield ring orbits —
        // the fight's order of operations at a glance
        if (this.enemies.some((m) => m.minion && !m.dead)) {
          ctx.globalAlpha = 0.4 + Math.sin(this.time * 4) * 0.15;
          ctx.strokeStyle = '#9df0ff';
          ctx.lineWidth = 4;
          ctx.setLineDash([10, 8]);
          ctx.beginPath();
          ctx.arc(u.x, u.y, u.r * 1.25, this.time * 1.2, this.time * 1.2 + Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      }
      // attack countdown — ★ marks a signature attack; urgency reads in
      // color AND size: amber at 2, a throbbing red swell on the last tick
      const next = Math.min(u.timer, ...u.clocks.map((c) => c.t));
      const urgent = next <= 1 || u.enraged;
      ctx.font = font(next <= 1 ? 15 : 14);
      ctx.textAlign = 'center';
      const tag = this.flee.is(u) ? '' : u.asleep ? 'zZ' : u.boss ? `★${Math.ceil(next)}` : `${Math.ceil(next)}`;
      // the disc rides top-right of the sprite — clamped inside the court
      // so a rim-hugging foe's clock doesn't tuck under the frame
      const tagX = Math.max(this.arena.x + 14, Math.min(this.arena.x + this.arena.w - 14, u.x + u.r - 2));
      const tagY = Math.max(this.arena.y + 17, u.y - u.r + 3);
      if (next <= 2) {
        // dark disc behind the last ticks — urgency readable at a glance;
        // a type-colored rim means a move clock, not the plain zap, lands
        ctx.fillStyle = 'rgba(8,10,20,0.85)';
        ctx.beginPath();
        ctx.arc(tagX, tagY, Math.max(9, ctx.measureText(tag).width / 2 + 4), 0, Math.PI * 2);
        ctx.fill();
        const clk = u.clocks.find((c) => c.t === next && c.t < u.timer);
        if (clk) {
          ctx.strokeStyle = TYPE_COLOR[clk.type ?? u.def.type];
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(tag, tagX, tagY + 4);
      ctx.fillStyle = urgent ? '#ff6b6b' : next <= 2 ? '#ffb84d' : '#fff';
      ctx.fillText(tag, tagX, tagY + 4);
      if (u.boss || u.mid) {
        const heavy = `${TYPE_MOVE[u.def.type].move} · ${Math.ceil(u.bigT)} · ALL`;
        ctx.font = fontB(13);
        const w = ctx.measureText(heavy).width + 16;
        const x = Math.max(this.arena.x + w / 2, Math.min(this.arena.x + this.arena.w - w / 2, u.x));
        const y = u.y + u.r + 38;
        ctx.fillStyle = INK;
        roundRect(ctx, x - w / 2, y - 18, w, 26, 8);
        ctx.fill();
        ctx.fillStyle = u.bigT <= 1 ? '#ff6b6b' : PAPER;
        ctx.fillText(heavy, x, y);
        if (this.lblN < this.lblBox.length / 4) {
          const at = this.lblN++ * 4;
          this.lblBox[at] = x - w / 2;
          this.lblBox[at + 1] = y - 18;
          this.lblBox[at + 2] = x + w / 2;
          this.lblBox[at + 3] = y + 8;
        }
      }
      const intro = this.introAlpha();
      // no intro tag pass — the scout card + this aim-phase pull tag carry it
      const traitTag = intro <= 0 && this.phase === 'aim' ? this.foeTag(u, true) : undefined;
      if (traitTag) this.fieldLabel(ctx, traitTag, u.x, u.y + u.r + 22, FOE_TAG_COLOR[traitTag] ?? '#ff8aa8', 1);
      if (u === this.firstFoeU) this.fieldLabel(ctx, 'ACTS FIRST', u.x, u.y - u.r - 22, '#ff6b6b', intro, true);
      if (u.wpPopT !== undefined && !u.dead && this.time - u.wpPopT < WP_POP_T) this.fieldLabel(ctx, 'WEAK POINT!', u.x, u.y - u.r - 22, '#ffd84d', Math.min(1, (WP_POP_T - (this.time - u.wpPopT)) / 0.3), true);
      // a loaded thief wears its take — the loot floats at its shoulder so
      // you can see exactly what KOing it buys back
      if (u.stolen) {
        const li = itemSprite(u.stolen);
        const bx = u.x + u.r * 0.85, by = u.y - u.r - 8 + Math.sin(this.time * 3 + u.uid) * 2;
        ctx.fillStyle = 'rgba(8,10,20,0.75)';
        ctx.beginPath();
        ctx.arc(bx, by, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f8d030';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (li) ctx.drawImage(li, bx - 8, by - 8, 16, 16);
      }
    } else {
      // charge meter: a row of pips under the hp bar — dark pips are
      // charge still owed, type-colored are earned, all-gold = READY
      const dots = Math.max(1, u.cdMax);
      const filled = u.cd <= 0 ? dots : dots - u.cd;
      for (let i = 0; i < dots; i++) {
        ctx.fillStyle = i < filled ? (u.cd <= 0 ? '#ffd84d' : TYPE_COLOR[u.def.type]) : 'rgba(0,0,0,0.45)';
        ctx.fillRect(u.x + (i - (dots - 1) / 2) * 7 - 2.5, u.y + u.r + 12, 5, 5);
      }
      if (u === this.active && u.cd <= 0) {
        // ready: only the active mon names its move — the bench stays quiet
        const label = moveOf(u.def.id, u.def.type);
        const ly = u.y + u.r + 30;
        ctx.font = fontB(10);
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(label, u.x, ly);
        ctx.fillStyle = TYPE_COLOR[u.def.type];
        ctx.fillText(label, u.x, ly);
      }
      // whose turn it is — arrow + name tag over the active mon, up only
      // while lining up the shot
      if (u === this.active && this.phase === 'aim') {
        const ty = u.y - u.r - 14 + Math.sin(this.time * 4) * 3;
        ctx.fillStyle = '#ffd84d';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(u.x - 11, ty - 11);
        ctx.lineTo(u.x + 11, ty - 11);
        ctx.lineTo(u.x, ty);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.font = fontB(10);
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeText(u.def.name.toUpperCase(), u.x, ty - 17);
        ctx.fillStyle = '#ffd84d';
        ctx.fillText(u.def.name.toUpperCase(), u.x, ty - 17);
      }
      // charged ultimate — the whole team glows, any of them can spend it
      if (u.side === 'player' && !u.dead && this.phase === 'aim' && this.ultIn <= 0) {
        const pulse = 0.5 + Math.sin(this.time * 6) * 0.5;
        ctx.globalAlpha = 0.35 + pulse * 0.45;
        ctx.strokeStyle = '#ffd84d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.r + 7 + pulse * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.font = fontB(10);
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        // an armed ult marks its own mon — second tap on it fires. Only
        // that tag draws: the chip says TAP ULT, the gold ring marks the
        // rest, and during the fire cinema the banner owns the court.
        const armed = this.ultArmUid === u.uid && this.time - this.ultArmT < 2;
        if (this.ultFx.t > 0 || !armed) return;
        const uly = Math.max(u.y - u.r - 52, this.arena.y + 12); // rim-hugging mons keep the tag on-canvas
        ctx.strokeText('TAP AGAIN', u.x, uly);
        ctx.fillStyle = '#ff9d4d';
        ctx.fillText('TAP AGAIN', u.x, uly);
      }
    }
  }

  // The release-timing bar — only exists while a pull is on, so the
  // court stays clean until the player starts aiming.
  private drawMeter(ctx: CanvasRenderingContext2D, frac: number, lit: boolean, color: string) {
    const a = this.arena;
    const zone = this.sweetSpot();
    const bw = Math.min(320, a.w * 0.64);
    const bh = 16;
    const bx = a.x + (a.w - bw) / 2;
    const by = a.y + 14;
    const zx = bx + bw * zone.c, zw = bw * 2 * zone.hw;
    const gaugeIcon = gaugeCounter(this.active.def) ? itemSprite(GAUGE_ICON) : null;
    if (gaugeIcon) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(gaugeIcon, bx - 24, by - 1, 18, 18);
      ctx.restore();
    }
    // bezel plate + a lighter top edge — the FRLG meter bevel
    ctx.fillStyle = 'rgba(10,14,32,0.8)';
    ctx.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
    ctx.strokeStyle = '#0a0e20';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 4, by - 4, bw + 8, bh + 8);
    ctx.fillStyle = '#ffffff1c';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#ffffff14';
    ctx.fillRect(bx, by, bw, 2);
    // ruler notches — tenths along the track's bottom lip
    ctx.fillStyle = '#ffffff26';
    for (let i = 1; i < 10; i++) ctx.fillRect(bx + bw * i * 0.1, by + bh - 3, 1, 3);
    // the hot rail — a release past this line launches over 450 u/s, the
    // momentum bonus contact damage pays (spdMul). Thin strip on the
    // track's top edge; the needle in it lights the tag. A gold release
    // launches at frac 1, so it's hot even below the line.
    {
      const u0 = this.active;
      const full =
        BASE_SHOT_SPEED * POWER * launchMult(u0.def.stats) * this.launchBoost * (this.curMod === 'tailwind' ? 1.15 : this.curMod === 'headwind' ? 0.85 : 1) * u0.launch * this.swiftMult(u0);
      const hotAt = (450 / full - 0.4) / 0.6;
      if (hotAt < 1) {
        const inHot = lit || frac >= Math.max(hotAt, 0);
        ctx.save();
        ctx.globalAlpha = inHot ? 0.85 : 0.4;
        ctx.fillStyle = '#ff8a5c';
        ctx.fillRect(bx + bw * Math.max(hotAt, 0), by - 2, bw * (1 - Math.max(hotAt, 0)), 2);
        ctx.globalAlpha = 1;
        ctx.font = font(8);
        ctx.textAlign = 'right';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        // tuck left of the missions chip — its left edge sits at arena right -98
        const hx = Math.min(bx + bw + 1, a.x + a.w - 102);
        ctx.strokeText('HOT', hx, by - 5);
        ctx.fillStyle = inHot ? '#ff8a5c' : '#8a90a8';
        ctx.fillText('HOT', hx, by - 5);
        ctx.restore();
      }
    }
    // the gold zone — bracketed band, pulsing while the needle sits inside
    const pulse = lit ? 0.9 + 0.1 * Math.sin(this.time * 18) : 1;
    ctx.globalAlpha = (lit ? 0.34 : 0.2) * pulse;
    ctx.fillStyle = '#ffd84d';
    ctx.fillRect(zx - zw / 2, by, zw, bh);
    ctx.globalAlpha = 1;
    ctx.fillStyle = lit ? '#ffd84d' : '#b89a3e';
    // bracket caps — ⌈ ⌉ at both edges of the window
    ctx.fillRect(zx - zw / 2, by - 3, 2, bh + 6);
    ctx.fillRect(zx + zw / 2 - 2, by - 3, 2, bh + 6);
    ctx.fillRect(zx - zw / 2, by - 3, 7, 2);
    ctx.fillRect(zx - zw / 2, by + bh + 1, 7, 2);
    ctx.fillRect(zx + zw / 2 - 7, by - 3, 7, 2);
    ctx.fillRect(zx + zw / 2 - 7, by + bh + 1, 7, 2);
    // the needle — a bright hand sweeping the track, trailing ghosts
    // behind it (dir re-derived from the same phase math as charge())
    const P = (0.85 - 0.3 * this.gaugeDifficulty()) * (1 + this.gaugeJit * 0.28);
    const ph = (this.dragT + this.gaugeStart * 2 * P) % (2 * P);
    const dir = ph < P ? 1 : -1;
    for (const [g, al] of [[0.028, 0.14], [0.014, 0.3]] as const) {
      const gx = bx + bw * Math.min(Math.max(frac - dir * g, 0), 1);
      ctx.globalAlpha = al;
      ctx.fillStyle = color;
      ctx.fillRect(gx - 1, by - 1, 3, bh + 2);
    }
    ctx.globalAlpha = 1;
    const nx = bx + bw * frac;
    if (lit) {
      // halo pass standing in for shadowBlur — one wide faint stamp
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#ffd84d';
      ctx.fillRect(nx - 6, by - 5, 12, bh + 10);
      ctx.beginPath();
      ctx.arc(nx, by - 5, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = lit ? '#ffd84d' : color;
    ctx.fillRect(nx - 2, by - 2, 4, bh + 4);
    ctx.beginPath();
    ctx.arc(nx, by - 5, lit ? 4 : 3, 0, Math.PI * 2);
    ctx.fillStyle = lit ? '#fff2c0' : '#ffffff';
    ctx.fill();
  }

  private drawAim(ctx: CanvasRenderingContext2D) {
    const u = this.active;
    const pull = { x: this.dragStart.x - this.dragNow.x, y: this.dragStart.y - this.dragNow.y };
    const pullLen = len(pull);
    if (pullLen < 18) return; // same tap floor as pointerUp
    const dir = norm(pull);
    if (u.confuseT > 0) {
      // the confused ghost wanders inside the real launch cone — the line
      // shivers, so you know the release can drift about ±10°
      const w = Math.sin(this.time * 7) * 0.17;
      const c = Math.cos(w), s = Math.sin(w);
      const dx = dir.x * c - dir.y * s, dy = dir.x * s + dir.y * c;
      dir.x = dx;
      dir.y = dy;
    }
    const frac = this.charge();
    const zone = this.sweetSpot();
    const maxed = Math.abs(frac - zone.c) <= zone.hw;
    const color = TYPE_COLOR[u.def.type];
    const a = this.arena;

    // sling anticipation — the pull strains the sprite, squash riding the
    // same frac that scales launch speed (power is release timing, not
    // pull distance, so a "full pull" is the needle topping out). max()
    // keeps it from fighting contact squashes mid-flight.
    u.sq = Math.max(u.sq, frac * 0.45);

    // the in-zone tell lives on the ball, not the bar — eyes stay on the
    // court when the needle's golden. Pulsing ring + a pair of orbiting
    // sparks; the release flash is what it promises
    if (maxed) {
      const pr = u.r + 7 + Math.sin(this.time * 18) * 2.5;
      ctx.save();
      // a wide faint pass under the crisp ring stands in for the blur halo
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#ffd84d';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(u.x, u.y, pr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(u.x, u.y, pr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff2c0';
      for (let k = 0; k < 2; k++) {
        const a0 = this.time * 5 + k * Math.PI;
        const sx2 = u.x + Math.cos(a0) * pr;
        const sy2 = u.y + Math.sin(a0) * pr;
        drawStar(ctx, sx2, sy2, 3.5, 0.4);
      }
      ctx.restore();
    }

    // predicted path: one bounce worth — banking off walls, stopping at the
    // first contact. Any further is noise. Cached on a quantized signature;
    // the ping-pong frac churns it while held, but it still skips
    // recomputing on frames where nothing moved.
    const sig = [
      Math.round(this.dragNow.x / 6),
      Math.round(this.dragNow.y / 6),
      Math.round(frac * 25),
      this.enemies.map((e) => `${Math.round(e.x / 10)},${Math.round(e.y / 10)},${e.dead ? 0 : 1}`).join(';'),
    ].join('|');
    if (sig !== this.aimCache.sig) {
      this.aimCache.sig = sig;
      const speed =
        BASE_SHOT_SPEED * POWER * launchMult(u.def.stats) * this.launchBoost * (this.curMod === 'tailwind' ? 1.15 : this.curMod === 'headwind' ? 0.85 : 1) * u.launch * (0.4 + 0.6 * (maxed ? 1 : frac)) * this.swiftMult(u);
      let sx = u.x, sy = u.y, svx = dir.x * speed, svy = dir.y * speed;
      const dots: Vec[] = [];
      let hit: Unit | null = null;
      let bounced = false;
      let boostT = -1;
      let warpT = -1;
      const cache = this.aimCache;
      const sb: Ball = { x: 0, y: 0, r: u.r, vx: 0, vy: 0 };
      const rest = this.curMod === 'echo' ? ECHO_REST : WALL_REST; // the ghost must promise the same echo
      sim: for (let i = 0; i < 60; i++) {
        if (bounced) break;
        const step = 1 / 30;
        const onIce = this.hazards.some((hz) => hz.kind === 'ice' && Math.hypot(sx - hz.x, sy - hz.y) < hz.r + u.r);
        const damp = shotDamp((i + 1) * step, step, this.frictionMult * (this.curMod === 'slick' ? 0.6 : 1) * (onIce ? 0.1 : 1));
        svx *= damp;
        svy *= damp;
        // the same field forces live play applies — a ghost that ignores
        // gust lanes and drag patches promises banks the ball can't keep
        for (const hz of this.hazards) {
          if (Math.hypot(sx - hz.x, sy - hz.y) >= hz.r + u.r) continue;
          if (hz.kind === 'gust') svx += (hz.dir ?? 1) * 480 * step;
          else if (hz.kind === 'gravity' && !this.slowImmune && !u.airborne && !flies(u.def)) {
            const drag = Math.exp(-GRAVITY_PANEL_DRAG * step);
            svx *= drag; svy *= drag;
          }
          else if (hz.kind === 'grass') { svx *= Math.exp(-8 * step); svy *= Math.exp(-8 * step); }
          else if (hz.kind === 'well' && !this.slowImmune) {
            const d = Math.max(50, Math.hypot(sx - hz.x, sy - hz.y));
            svx += ((hz.x - sx) / d) * 1400 * step;
            svy += ((hz.y - sy) / d) * 1400 * step;
          } else if (hz.kind === 'boost' && i / 30 - boostT > 0.4) {
            const sp = Math.hypot(svx, svy);
            if (sp > 60 && sp < 2400) { svx *= 1.35; svy *= 1.35; boostT = i / 30; }
          } else if (hz.kind === 'warp' && i / 30 - warpT > 0.45) {
            const twin = this.hazards.find((w) => w !== hz && w.kind === 'warp' && w.pair === hz.pair);
            if (twin) {
              warpT = i / 30;
              const sp = Math.max(60, Math.hypot(svx, svy));
              sx = twin.x + (svx / sp) * (twin.r + u.r + 6);
              sy = twin.y + (svy / sp) * (twin.r + u.r + 6);
            }
          }
        }
        sx += svx * step;
        sy += svy * step;
        if (len({ x: svx, y: svy }) < 90) break;
        if (sx - u.r < a.x) { sx = a.x + u.r; svx = -svx * rest; bounced = true; }
        else if (sx + u.r > a.x + a.w) { sx = a.x + a.w - u.r; svx = -svx * rest; bounced = true; }
        if (sy - u.r < a.y) { sy = a.y + u.r; svy = -svy * rest; bounced = true; }
        else if (sy + u.r > a.y + a.h) { sy = a.y + a.h - u.r; svy = -svy * rest; bounced = true; }
        // the stones bank the ball too — same shared resolver as live play
        for (const b of this.blocks) {
          sb.x = sx; sb.y = sy; sb.vx = svx; sb.vy = svy;
          if (resolveBlock(sb, b)) { sx = sb.x; sy = sb.y; svx = sb.vx; svy = sb.vy; bounced = true; }
        }
        for (const hz of this.hazards) {
          if (u.airborne || !isSolid(hz, u.def)) continue;
          sb.x = sx; sb.y = sy; sb.vx = svx; sb.vy = svy;
          if (resolveZone(sb, hz)) { sx = sb.x; sy = sb.y; svx = sb.vx; svy = sb.vy; bounced = true; }
        }
        for (const e of this.enemies)
          if (!e.dead && Math.hypot(sx - e.x, sy - e.y) < u.r + e.r) {
            // pierce sails through — note the first catch, keep tracing
            if (u.def.pierce) {
              if (!hit) { hit = e; cache.hx = sx; cache.hy = sy; }
              continue;
            }
            hit = e;
            cache.hx = sx;
            cache.hy = sy;
            break sim;
          }
        // allies aren't checked — the ball passes through them, and figuring
        // out which ones you'll link is the skill
        if (i % 2 === 0) dots.push({ x: sx, y: sy });
      }
      this.aimCache.dots = dots;
      this.aimCache.hit = hit;
      this.aimCache.bounced = bounced;
    }
    {
      const { dots, hit, bounced, hx, hy } = this.aimCache;
      ctx.globalAlpha = 0.5;
      // pierce reads as hollow rings — the path has no mass, it sails through;
      // bounce mons get solid dots that dead-end on first contact
      if (u.def.pierce) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        for (const q of dots) {
          ctx.beginPath();
          ctx.arc(q.x, q.y, 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = color;
        for (const q of dots) {
          ctx.beginPath();
          ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // small impact diamond where the path dies
      if (bounced && !hit && dots.length) {
        const q = dots[dots.length - 1];
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y - 7);
        ctx.lineTo(q.x + 7, q.y);
        ctx.lineTo(q.x, q.y + 7);
        ctx.lineTo(q.x - 7, q.y);
        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // payoff preview — the first catch rings its contact point, tinted
      // by the launcher's effectiveness into it: gold = super effective,
      // gray = resisted, pale = a neutral trade
      if (hit) {
        const at = strikeType(u.def, hit.def);
        const eff = typeMult(at, hit.def) * weatherMult(this.sky, at);
        ctx.strokeStyle = eff >= 2 ? '#ffd84d' : eff <= 0.5 ? '#8a90a8' : '#e8ecf8';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.85;
        // shape is the second channel: resisted reads dashed, super-effective
        // a double ring — gold vs pale aren't distinguishable alone
        if (eff <= 0.5) ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(hx, hy, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        if (eff >= 2) {
          ctx.beginPath();
          ctx.arc(hx, hy, 12, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // weak read — the same cone check the contact damage uses
        if (!hit.wpHidden && this.weakHit(hit, hx, hy)) {
          const s = 6;
          ctx.fillStyle = '#ffd84d';
          ctx.strokeStyle = '#000';
          drawStar(ctx, hx, hy, s, 0.4, 1.5);
        }
      }
    }

    // timing bar under the HUD — this is what you read to release on max
    this.drawMeter(ctx, frac, maxed, color);

    // charge ring on the ball — same timing read at the spot eyes are on
    const rr = u.r + 16, a0 = -Math.PI / 2;
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffffff22';
    ctx.beginPath();
    ctx.arc(u.x, u.y, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffd84d66';
    ctx.beginPath();
    ctx.arc(u.x, u.y, rr, a0 + Math.PI * 2 * (zone.c - zone.hw), a0 + Math.PI * 2 * (zone.c + zone.hw));
    ctx.stroke();
    // notch ticks at the window's edges — crop marks for the release
    ctx.strokeStyle = maxed ? '#ffd84d' : '#b89a3e';
    ctx.lineWidth = 3;
    for (const edge of [zone.c - zone.hw, zone.c + zone.hw]) {
      const ea = a0 + Math.PI * 2 * edge;
      ctx.beginPath();
      ctx.moveTo(u.x + Math.cos(ea) * (rr - 5), u.y + Math.sin(ea) * (rr - 5));
      ctx.lineTo(u.x + Math.cos(ea) * (rr + 5), u.y + Math.sin(ea) * (rr + 5));
      ctx.stroke();
    }
    if (maxed) {
      // ghost pass standing in for shadowBlur — a fat halo under the sweep
      const na0 = a0 + Math.PI * 2 * frac;
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#ffd84d';
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.arc(u.x, u.y, rr, a0, na0);
      ctx.stroke();
      ctx.fillStyle = '#ffd84d';
      ctx.beginPath();
      ctx.arc(u.x + Math.cos(na0) * rr, u.y + Math.sin(na0) * rr, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = maxed ? '#ffd84d' : color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(u.x, u.y, rr, a0, a0 + Math.PI * 2 * frac);
    ctx.stroke();
    // the hand's tip — a bright orb riding the sweep point
    const na = a0 + Math.PI * 2 * frac;
    ctx.beginPath();
    ctx.arc(u.x + Math.cos(na) * rr, u.y + Math.sin(na) * rr, maxed ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = maxed ? '#fff2c0' : '#ffffff';
    ctx.fill();

    // launch arrow: unit -> opposite direction, length + glow from charge
    if (settings().aimGuide) {
      const ex = u.x + dir.x * (50 + frac * 160);
      const ey = u.y + dir.y * (50 + frac * 160);
      const hs = 14;
      const px = -dir.y;
      const py = dir.x;
      if (maxed) {
        // ghost pass standing in for shadowBlur on the gold read
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#ffd84d';
        ctx.lineWidth = 12;
        ctx.setLineDash(u.def.pierce ? [8, 6] : []);
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffd84d';
        ctx.beginPath();
        ctx.moveTo(ex + dir.x * hs * 1.5, ey + dir.y * hs * 1.5);
        ctx.lineTo(ex + px * hs * 0.95, ey + py * hs * 0.95);
        ctx.lineTo(ex - px * hs * 0.95, ey - py * hs * 0.95);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      // dashed = pierce (phases through foes), solid = bounce
      ctx.setLineDash(u.def.pierce ? [8, 6] : []);
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ex + dir.x * hs, ey + dir.y * hs);
      ctx.lineTo(ex + px * hs * 0.6, ey + py * hs * 0.6);
      ctx.lineTo(ex - px * hs * 0.6, ey - py * hs * 0.6);
      ctx.fill();

      // first-contact preview: the ray rides past the arrow — a ring marks
      // the foe you'd open on, and a wall/block hit throws the bank angle
      // back as a short ghost leg. Teaches the bank shot without a word.
      if (dir.x !== 0 || dir.y !== 0) {
        const a = this.arena;
        let best = Infinity;
        let nx = 0;
        let ny = 0;
        let hitFoe = false;
        const wall = (t: number, nX: number, nY: number) => {
          if (t > 0 && t < best) {
            best = t;
            nx = nX;
            ny = nY;
            hitFoe = false;
          }
        };
        if (dir.x < 0) wall((a.x + u.r - u.x) / dir.x, 1, 0);
        else if (dir.x > 0) wall((a.x + a.w - u.r - u.x) / dir.x, -1, 0);
        if (dir.y < 0) wall((a.y + u.r - u.y) / dir.y, 0, 1);
        else if (dir.y > 0) wall((a.y + a.h - u.r - u.y) / dir.y, 0, -1);
        // shortcut: stone slabs read as four faces each — slab test, no
        // corner rounding; upgrade if aim-ghost misses on block corners
        for (const b of this.blocks) {
          const inv = (v: number) => 1 / (v === 0 ? 1e-9 : v);
          const tx1 = (b.x - u.r - u.x) * inv(dir.x);
          const tx2 = (b.x + b.w + u.r - u.x) * inv(dir.x);
          const ty1 = (b.y - u.r - u.y) * inv(dir.y);
          const ty2 = (b.y + b.h + u.r - u.y) * inv(dir.y);
          const tEnter = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2));
          const tExit = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2));
          if (tEnter < tExit && tEnter > 0 && tEnter < best) {
            best = tEnter;
            const xEntry = Math.min(tx1, tx2) > Math.min(ty1, ty2);
            nx = xEntry ? Math.sign(tx1 - tx2) : 0;
            ny = xEntry ? 0 : Math.sign(ty1 - ty2);
            hitFoe = false;
          }
        }
        let firstHz: Hazard | null = null;
        for (const hz of this.hazards) {
          // a live mine or warp pad on the lane is contact too — the ball
          // detonates one and rides the other, it never passes through
          if ((hz.kind !== 'mine' && hz.kind !== 'warp') || hz.spent) continue;
          const R = u.r + hz.r;
          const ox = hz.x - u.x;
          const oy = hz.y - u.y;
          const proj = ox * dir.x + oy * dir.y;
          if (proj <= 0) continue;
          const d2 = ox * ox + oy * oy - proj * proj;
          if (d2 > R * R) continue;
          const t = proj - Math.sqrt(R * R - d2);
          if (t > 0 && t < best) {
            best = t;
            hitFoe = false;
            firstHz = hz;
          }
        }
        let foeHit: Unit | null = null;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const R = u.r + e.r;
          const ox = e.x - u.x;
          const oy = e.y - u.y;
          const proj = ox * dir.x + oy * dir.y;
          if (proj <= 0) continue;
          const d2 = ox * ox + oy * oy - proj * proj;
          if (d2 > R * R) continue;
          const t = proj - Math.sqrt(R * R - d2);
          if (t > 0 && t < best) {
            best = t;
            hitFoe = true;
            foeHit = e;
          }
        }
        if (best < Infinity) {
          const hx = u.x + dir.x * best;
          const hy = u.y + dir.y * best;
          ctx.globalAlpha = 0.4;
          // a shelled opening target colors by outcome — red the plate,
          // bright the flank — so the bank angle is planned, not guessed
          let foeColor = '#ffd84d';
          if (hitFoe && foeHit?.def.shielded) {
            const a2 = Math.atan2(hy - foeHit.y, hx - foeHit.x);
            let dd = Math.abs(a2 - foeHit.shieldA) % (Math.PI * 2);
            if (dd > Math.PI) dd = Math.PI * 2 - dd;
            foeColor = dd < 0.85 ? '#ff6b6b' : dd > 2.4 ? '#9df0ff' : '#ffd84d';
          } else if (foeHit?.repelR) {
            // the ghost promises contact the field will bend away — orange
            // flags the repel before the pull, not after the deflection
            foeColor = '#ff9a30';
          } else if (foeHit?.gravR) {
            // same honesty for the gravity bubble — the ball crawls inside
            foeColor = '#58c8d8';
          }
          ctx.strokeStyle = hitFoe ? foeColor : firstHz ? (firstHz.kind === 'mine' ? '#ff9a30' : '#c890ff') : color;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 5]);
          ctx.beginPath();
          ctx.moveTo(u.x, u.y);
          ctx.lineTo(hx, hy);
          ctx.stroke();
          // allies the ray crosses glow — the bump chain reads before the pull
          for (const p of this.players) {
            if (p.dead || p === u) continue;
            const R = u.r + p.r;
            const ox = p.x - u.x;
            const oy = p.y - u.y;
            const proj = ox * dir.x + oy * dir.y;
            if (proj <= 0 || proj >= best) continue;
            const d2 = ox * ox + oy * oy - proj * proj;
            if (d2 > R * R) continue;
            ctx.setLineDash([]);
            ctx.strokeStyle = p.cd <= 0 ? '#9df0ff' : '#8a90a8';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r + 5 + Math.sin(this.time * 8) * 1.5, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (hitFoe) {
            // gold ring on the opening target — the shot's first read
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(hx, hy, 6 + Math.sin(this.time * 8) * 1.5, 0, Math.PI * 2);
            ctx.stroke();
            // the matchup badge rides the ring — the aim phase is when
            // the type chart can still change your mind
            const eff = typeMult(strikeType(u.def, foeHit!.def), foeHit!.def);
            if (eff > 1.01 || eff < 0.99) {
              const tag = eff > 1.01 ? 'SE' : 'NVE';
              ctx.font = fontB(10);
              ctx.lineWidth = 3;
              ctx.strokeStyle = '#000';
              ctx.strokeText(tag, hx, hy - 12);
              ctx.fillStyle = eff > 1.01 ? '#9df0ff' : '#ff6b6b';
              ctx.fillText(tag, hx, hy - 12);
            }
            // rebound leg: the ball banks off the foe's face the way
            // circle-contact does — second target plans before the pull
            if (foeHit && !u.def.pierce) {
              const nx2 = (hx - foeHit.x) / (u.r + foeHit.r);
              const ny2 = (hy - foeHit.y) / (u.r + foeHit.r);
              const d = dir.x * nx2 + dir.y * ny2;
              const rx = dir.x - 2 * d * nx2;
              const ry = dir.y - 2 * d * ny2;
              ctx.setLineDash([4, 5]);
              ctx.strokeStyle = color;
              ctx.beginPath();
              ctx.moveTo(hx, hy);
              ctx.lineTo(hx + rx * 55, hy + ry * 55);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          } else if (firstHz?.kind === 'mine') {
            // the lane ends in a blast, not a bank — a blast ring marks the
            // mine and the ghost leg stays honest by staying home
            ctx.beginPath();
            ctx.arc(hx, hy, 9 + Math.sin(this.time * 8) * 1.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(hx - 5, hy);
            ctx.lineTo(hx + 5, hy);
            ctx.moveTo(hx, hy - 5);
            ctx.lineTo(hx, hy + 5);
            ctx.stroke();
          } else if (firstHz?.kind === 'warp') {
            // the lane dives into a portal — ring the pad, then ghost the
            // exit leg out of the twin so the trick shot previews true
            ctx.beginPath();
            ctx.arc(hx, hy, 8 + Math.sin(this.time * 8) * 1.5, 0, Math.PI * 2);
            ctx.stroke();
            const twin = this.hazards.find((w) => w !== firstHz && w.kind === 'warp' && w.pair === firstHz.pair);
            if (twin) {
              const ex2 = twin.x + dir.x * (twin.r + u.r + 6);
              const ey2 = twin.y + dir.y * (twin.r + u.r + 6);
              ctx.setLineDash([4, 5]);
              ctx.strokeStyle = '#c890ff';
              ctx.beginPath();
              ctx.arc(ex2, ey2, 6, 0, Math.PI * 2);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(ex2, ey2);
              ctx.lineTo(ex2 + dir.x * 55, ey2 + dir.y * 55);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          } else {
            // ghost leg banks off the surface the way the ball will
            ctx.beginPath();
            const rx = dir.x - 2 * (dir.x * nx + dir.y * ny) * nx;
            const ry = dir.y - 2 * (dir.x * nx + dir.y * ny) * ny;
            ctx.moveTo(hx, hy);
            ctx.lineTo(hx + rx * 70, hy + ry * 70);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  private drawWave(ctx: CanvasRenderingContext2D, w: Wave) {
    const alpha = Math.max(w.t / w.life, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // translucent body — the shockwave's mass, fading as it expands
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = w.color;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.fill();
    // glowing rim — stacked strokes fake the blur falloff; a real
    // shadowBlur here was a blur pass per ring per frame
    ctx.strokeStyle = w.color;
    ctx.globalAlpha = alpha * 0.24;
    ctx.lineWidth = 32;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.5;
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();
    // hot white leading edge — the anime energy front
    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(w.x, w.y, Math.max(0, w.r - 7), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

}

// flashes are drawn in logical coords; arena is at most this wide
const W_CANVAS_FALLBACK = 540;

// the freeze frame's escape rows, centered under PAUSED — drawn by the
// overlay, hit-tested in main.ts where the paused tap is routed (any other
// tap still thaws). 46px tall like the MAP_MENU/TOOL row buttons.
const PAUSE_SPEED = { x: W_CANVAS_FALLBACK / 2 - 120, y: 636, w: 240, h: 46 };
export const PAUSE_SETTINGS = { x: W_CANVAS_FALLBACK / 2 - 120, y: 520, w: 240, h: 46 };
export const PAUSE_QUIT = { x: W_CANVAS_FALLBACK / 2 - 120, y: 578, w: 240, h: 46 };

// each element's super gets its own sound flavor
const SUPER_SFX: Record<PokeType, Sfx> = {
  fire: 'boom', electric: 'zap', grass: 'heal', water: 'splash',
  psychic: 'zap', flying: 'splash', poison: 'boom', rock: 'boom',
  fighting: 'boom', ghost: 'zap', normal: 'hit',
};

// several types share a blip — the type's index pitches it (normal low,
// ghost high) so every element still reads distinct
const superPitch = (t: PokeType) => 0.9 + TYPES.indexOf(t) * 0.05;
