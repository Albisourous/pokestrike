import { Vec, len, dist, norm, vec } from '../core/vec';
import { mulberry32 } from '../core/rng';
import { drawMon, drawShiny, whiteSprite, itemSprite, drawNpc, loadItem } from '../core/assets';
import { sfx, buzz, music, playJingle, weatherBed, BIOME_TRACK, TRAINER_TRACK, GYM_STAB } from '../core/audio';
import type { Sfx } from '../core/audio';
import { SpeciesDef, StageDef, WaveSpawn, rollWave, trainerWave, TRAINER_CLASS, LEADER_NPC, TOTAL_STAGES, ROSTER, ELITES, EVOS, INVADERS, ENEMY_DB, BOSS_POOL, buildRoom, rivalWave, ROOM_LAYOUTS, ROOM_BOSS, ROOM_HARD, pickWild, bst, FLOATERS, speciesById } from './data';
import { Perk, rollPerks, PERKS, BAG_ITEMS, perkTick } from './perks';
import type { Rarity } from './perks';
import { rollEvent, martStock } from './events';
import type { EventChoice, EventArt } from './events';
import { taskViews } from './tasks';
import type { TaskKind } from './tasks';
import { teamTraits } from './traits';
import { recordCapture, recordShiny, unlockAch, ACHIEVEMENTS, earnBadge, gymBadges, BADGES, settings, bankBag, addStars, starBoost, labLevel, trainerPick, bondLv, type RunSave, type Settings } from './meta';
import { drawBackdrop, drawWall, drawSlice, THEMES, hash } from './bg';
import { uiWindow } from './ui';
import type { Theme, PropSpec } from './bg';
import { typeMult, strikeType, TYPE_COLOR, weatherMult, WEATHER_LINE, WEATHER_TINT, TYPES } from './types';
import { genRegion, RegionMap, MapNode, MAP_W, MAP_H, drawTile, routePath, T_WATER, T_SAND, T_GRASS } from './map';
import * as MT from './maptiles';
import { gracidea } from '../core/assets';
import type { PokeType, Weather } from './types';

import {
  playerHp,
  enemyHp,
  bossHp,
  enemyDrift,
  launchMult,
  physDamage,
  specDamage,
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
import { font, fontB, fitFont, fitFontB, roundRect, button, pill, wrap2, MAP_MENU } from './screens';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Unit {
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
  drift: number; // enemy approach speed (u/s); players always 0
  // wander state — enemies jitter and occasionally dart
  wx: number;
  wy: number;
  wT: number;
  wMul: number;
  lunging: number; // >0 while mid-lunge (melee attack in flight)
  boss: boolean;
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
  enraged?: boolean; // boss under 30% — attacks cycle faster
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
  sumStage: number; // boss phase summons fired (0..2 — at 2/3 and 1/3 hp)
  atkN: number; // boss attack count — every 3rd is a teleport, not a blast
  weakA: number; // boss weak point angle — rotating gold face, ×3 contact
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
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
  big: boolean;
  size?: number; // scale multiplier — damage numbers grow with the hit
  life?: number; // stamped on first frame so easings know the full span
  tilt?: number; // radians of lean — damage numbers land off-axis for juice
  w?: number; // text width at the pop=1 font — measured once at push
  ff?: string; // fitted font — cached when the banner can't fit the court
  fw?: number; // width at the fitted font
}
interface Orb {
  x: number;
  y: number;
  target: Unit;
  dmg: number;
  t: number;
  wob: number; // spiral phase — each orb corkscrews on its own beat
  color: string;
  hostile?: boolean; // boss orbs hunt players instead of enemies
  src?: Unit; // hostile orbs carry their caster so damage knobs still apply
  drain?: boolean; // the hit feeds the team — grass seed flares
  spd?: number; // override the 620 u/s cruise — aura lock-ons fly faster
}
// Expanding shockwave: the front sweeps outward and hits each enemy once
// when it reaches them — fire blast, psychic ring.
interface Wave {
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
  kind: 'lava' | 'grass' | 'gust' | 'spikes' | 'static' | 'mine' | 'warp' | 'boost' | 'well' | 'power' | 'ice';
  x: number;
  y: number;
  r: number; // px radius of the zone
  dir?: number; // gust: push direction (+1/-1)
  spent?: boolean; // mines fire once
  pair?: number; // warps: pads sharing an id teleport between each other
}
// Boss hyper beam: a bright line that fades fast after the shot lands.
interface Beam {
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
interface Dash {
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
type PickupKind = 'oran-berry' | 'protein' | 'elixir' | 'lum-berry' | 'revival-herb';
interface Pickup {
  x: number;
  y: number;
  kind: PickupKind;
  t: number; // bob phase
}
interface Scar {
  x: number;
  y: number;
  r: number;
  t: number;
  life: number;
}
// One-shot anime particle: spark dots, velocity streaks and four-point
// stars — drawn additively so stacked hits read as real glow.
interface Fx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  size: number;
  color: string;
  shape: 'dot' | 'streak' | 'star' | 'leaf';
  spin: number; // star/leaf rotation rate — doubles as the sway phase
  grav: number; // debris pulls down; sparks/stars fly straight
  sway?: number; // horizontal wobble amplitude — leaves, embers, bubbles
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
  mine: '#ff9a30', warp: '#c890ff', boost: '#2a5a30', well: '#101826', power: '#d83018',
  ice: '#9adcff',
};
const HZ_PROP: Partial<Record<Hazard['kind'], MT.TileRect>> = {
  grass: [1715, 93, 78, 33], // tall-grass tufts
  static: [90, 268, 55, 42], // still pond — keywords go quiet inside
  warp: [292, 140, 40, 23], // cave mouth — enter here, exit the twin
  well: [7, 639, 47, 66], // framed pool — the water drags you in
  boost: MT.TILE_PATH, // dirt pad
  power: MT.TILE_PATH,
};

// Floor scatter — a wave-seeded handful of small atlas bits stamped between
// the wall ring and the hazards; deterministic by waveIndex, so each court
// gets its own dressing with no extra state. Sizes stay in the 12-30px
// dressing band and everything draws under the units.
const DECOR: Record<Theme, { n: number; s: [number, number]; alpha?: number; props: PropSpec[] }> = {
  grove: { n: 12, s: [13, 22], props: [{ r: MT.TILE_FLOWER }, { r: MT.FLOWER_YB }, { r: MT.FLOWER_PK }] },
  cavern: { n: 10, s: [14, 24], props: [{ r: MT.TILE_ROCK }, { r: MT.ROCK_SMALL }, { r: MT.ROCK_SMALL, t: 'rgba(40,40,90,0.30)' }] },
  volcano: {
    n: 9, s: [14, 26],
    props: [{ r: MT.TILE_ROCK, t: 'rgba(70,20,8,0.45)' }, { r: MT.ROCK_SMALL, t: 'rgba(70,20,8,0.45)' }],
  },
  sky: { n: 7, s: [26, 44], alpha: 0.5, props: [{ r: MT.TILE_DRIFT }] },
};

// ambient drift keyed to the court — petals ride the grove breeze, dust
// hangs in cavern shafts, embers climb and flicker in the volcano, snow
// slants through the sky court
const AMBIENT: Record<Theme, { n: number; col: string; vx: number; vy: number; r: number; tw: number; wob: number }> = {
  grove: { n: 16, col: '#cfe898', vx: 18, vy: 16, r: 2.1, tw: 0.1, wob: 26 }, // petals fall on the breeze
  cavern: { n: 12, col: '#8a94c0', vx: 6, vy: 8, r: 1.7, tw: 0.16, wob: 12 }, // dust hangs in the light shafts
  volcano: { n: 20, col: '#ff9d4d', vx: 10, vy: -34, r: 2.0, tw: 0.3, wob: 18 }, // embers climb, flicker hard
  sky: { n: 16, col: '#ffffff', vx: -16, vy: 24, r: 1.9, tw: 0.12, wob: 20 }, // snow slants downwind
};

// theme → its sky: groves rain, caverns swirl sand, the volcano bakes
// under sun, the heights blow. ~Half of rolled courts get weather.
const WEATHER_FOR: Record<Theme, Weather> = { grove: 'rain', cavern: 'sand', volcano: 'sun', sky: 'wind' };
// block boulders take the wall ring's prop tint so cover reads as the same
// stone as the court's edge — scorched at the volcano, iced on the summit
const BLOCK_TINT: Record<Theme, string | undefined> = {
  grove: undefined,
  cavern: 'rgba(40,40,90,0.30)',
  volcano: 'rgba(70,20,8,0.45)',
  sky: 'rgba(150,190,230,0.45)',
};
// the slab face keys to the court too — mossy stone, deep indigo, ember
// dark, steel-blue on the summit (still darker than the floor so the
// cover silhouette never washes out)
const BLOCK_FACE: Record<Theme, string> = {
  grove: 'rgba(22,38,24,0.48)',
  cavern: 'rgba(30,36,70,0.42)',
  volcano: 'rgba(54,22,12,0.52)',
  sky: 'rgba(95,120,155,0.72)',
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
export const FRICTION = 1.7;
const HIT_COOLDOWN = 0.12;
const HEAL_CD = 5; // in-battle mends share this cooldown — one heal per few shots
const SUPER_POW = 0.7; // supers hit softer so clean lines carry the damage
const CONTACT_POW = 1.4; // direct hits are the bread and butter again
const ENEMY_TURN_DELAY = 0.6;
const ENEMY_BASE_TIMER = 3;
const MELEE_TIMER = 2; // melee mons have to close in — they attack sooner
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
  protein: { name: 'PROTEIN', label: 'ATK +50%', color: '#f08030' },
  elixir: { name: 'ELIXIR', label: 'SUPER +1', color: '#9ecbff' },
  'lum-berry': { name: 'LUM BERRY', label: 'CURE ALL', color: '#b8f8f8' },
  'revival-herb': { name: 'REVIVAL HERB', label: 'REVIVE', color: '#f8d030' },
};
export const ULT_SHOTS = 10; // shots to charge the team ultimate — tap any glowing teammate to spend it
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
const ELITE_IDS = new Set(ELITES.map((e) => e.id));

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
const flies = (d: SpeciesDef) => d.type === 'flying' || d.type2 === 'flying' || FLOATERS.has(d.id);
const canSwim = (d: SpeciesDef) => d.type === 'water' || d.type2 === 'water' || flies(d);
const isWater = (hz: Hazard) => hz.kind === 'static' || hz.kind === 'well';
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

// distance-pick helpers for the "who does this hit" sorts — the list is
// copied so the caller's array is never reordered
const nearest = (foes: Unit[], p: Vec) => foes.slice().sort((a, b) => dist(p, a) - dist(p, b))[0];
const farthest = (foes: Unit[], p: Vec) => foes.slice().sort((a, b) => dist(p, b) - dist(p, a))[0];

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

// four-point star: an 8-vertex polygon pinching at `pinch` of the radius —
// the weak-point marker and the spark particle share the shape
const starPath = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, pinch: number) => {
  const k = s * pinch;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + k, y - k);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + k, y + k);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - k, y + k);
  ctx.lineTo(x - s, y);
  ctx.lineTo(x - k, y - k);
  ctx.closePath();
};

// prebuilt unit-radius star paths — the shiny twinkle, weak marker and
// spark stars fill() a Path2D instead of re-pathing 8 vertices per frame.
// Pinches seen below: 0.4 (markers) and 0.28 (spark particles)
const mkStar = (pinch: number): Path2D | null => {
  if (typeof Path2D === 'undefined') return null;
  const p = new Path2D();
  p.moveTo(0, -1);
  p.lineTo(pinch, -pinch);
  p.lineTo(1, 0);
  p.lineTo(pinch, pinch);
  p.lineTo(0, 1);
  p.lineTo(-pinch, pinch);
  p.lineTo(-1, 0);
  p.lineTo(-pinch, -pinch);
  p.closePath();
  return p;
};
const STAR_4 = mkStar(0.4);
const STAR_28 = mkStar(0.28);
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

// one shared context for text metrics — FloatTexts measure once at push,
// not every frame; measureText only ever reads the font string
const MCTX = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');

export class Battle {
  players: Unit[] = [];
  enemies: Unit[] = [];
  blocks: Rect[] = []; // Archero-style stone clusters — bounceable cover
  phase: Phase = 'aim';
  waveIndex = -1; // -1 = still at HOME — stages begin at the row-0 fork
  activeIdx = 0;
  shots = 0;
  time = 0;
  waveBanner = 0;
  private waveIntroT = -9; // spawnWave timestamp — the ! beat plays while <0.6s
  endT = 0; // win/lose beat — the field report waits for the celebration to land
  weather: Weather | null = null; // this wave's sky — null is a clear court

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
  // the fired ult gets a letterboxed cinema beat — banner + type-tinted
  // vignette over the fight while the map-wide attack lands
  private ultFx = { text: '', color: '#ffd84d', t: 0, life: 1.15 };
  // branching evolution: a dupe-fed split waits on the reward screen's pick —
  // unit for a fielded mon, boxDef for a boxed one (re-found at pick time so
  // a mid-queue box swap can't evolve the wrong entry)
  private evoPending: { from: SpeciesDef; options: SpeciesDef[]; unit?: Unit; boxDef?: SpeciesDef }[] = [];
  evoChoice: { from: SpeciesDef; options: SpeciesDef[]; unit?: Unit; boxDef?: SpeciesDef } | null = null;
  // queued evolution cinematics — the arena dims, the sprite whites out and
  // flickers old↔new faster and faster, then the new form lands
  private evoFx: { u: Unit; from: number; to: number; t: number; revealed: boolean }[] = [];
  paused = false; // mid-fight freeze — the pause chip in the arena corner
  static ffPref = false; // ×2 rides the session — a new Battle spawn inherits it
  ff = Battle.ffPref; // ×2 chip beside it — the sim runs two steps a frame, not a stretched dt
  private pendingAttacks: Unit[] = [];
  private bumpsThisShot = new Set<number>(); // allies whose super fired this shot
  private bumpNoted = new Set<number>(); // allies already told "recharging" this shot
  private shotCombo = 0; // pass-through links chained this shot
  private shotDmg = 0; // running damage tally this shot — read under the COMBO meter
  private shotLoot = 0; // pickups grabbed this shot — a loot run isn't a whiff
  private shotKOs = 0; // kills this shot — multi-KOs name themselves mid-flight
  private comboLabel = ''; // COMBO meter string — rebuilt only when the counters move
  private comboLabelN = -1;
  private dmgLabel = '';
  private dmgLabelN = -1;
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
  private scars: Scar[] = []; // impact craters scarring the court
  private hazards: Hazard[] = []; // this wave's court gimmicks
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
  private region: RegionMap; // the climb's world map — drawn between stages
  // read-only window for the seer event + smoke — the field stays private
  // because applySnapshot regens it mid-life
  get regionMap(): RegionMap {
    return this.region;
  }
  private regionBase: HTMLCanvasElement | null = null; // baked terrain — region never changes
  private pendingNext = 0; // wave the map interstitial leads into
  private mapNote = ''; // stop-flavor line shown on the region map
  private mapWalk: { path: { x: number; y: number }[]; t: number; node: MapNode } | null = null; // overworld walk to a tapped stop
  private shake = 0;
  private hitStop = 0; // brief slow-mo on combo hits
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
  rewardOffers: Perk[] = [];
  tools = { roll: 1, ban: 1 }; // offer-tool charges, per-run — REROLL re-deals, BANISH culls
  perkOfferN = 3; // perk cards per board — lab 'fourth' deals a fourth
  // lab multis — read once at construction (the shop lives on the title,
  // a mid-run buy can't happen); perks re-apply on top in applySnapshot
  private labHpMult = 1; // 'hp': team maxHp mult
  private labSpcMult = 1; // 'spc': bump-super damage mult
  private labLuck = 0; // 'luck': flat team luck feeding the gym fountain
  private starMult = 1; // 'earnings': star payout mult, ceil'd per payout
  starsRun = 0; // star pieces banked this run — the result screen's +N row
  reviveToken = false; // 'revive': the first KO each run stands back up
  reviveUsed = false; // spent flag — persisted like ashArmed
  perkBan = new Set<string>(); // perk ids banished this run — filtered out of future boards
  banArmed = false; // armed: the next card tap banishes instead of picks
  private rewardCap = 3; // tier cap the board was dealt at — reroll re-deals the same quality
  mapNode = 0; // index into region.nodes — the stop the team stands on
  hardWave = false; // the wave just cleared was a hard stop — bigger payout (trainers)
  eliteWave = false; // elite stops pay out rare-or-better relics only
  killer: string | null = null; // what felled the run — named on the wipe screen
  lastRecruit: SpeciesDef | null = null; // gym ace prize, for the reward screen
  private rewardPending = false;
  private hpScale = 1;
  private theme: Theme; // current wave's scene — rotates each wave
  traits = new Map<PokeType, number>(); // type-trait tiers — teamTraits, refreshed on composition shifts
  private pendingEventWave: WaveSpawn[] | null = null; // ?-stop ambush replaces the row's wave
  private inEvent = false; // this wave is a scripted event fight (no gym credit)
  private skipWave = false; // a ? event resolved the stop — row clears with no fight
  private curSpawns: WaveSpawn[] = []; // the wave actually fielded (for the recruit roll)
  eggIn = 0; // stops until the egg hatches — the ? pool's slow payoff
  eggJustLaid = false; // the laying arrival doesn't consume a tick
  private waveShots = 0; // shots taken this wave — the anti-stall pressure ramp
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
    this.tools = { roll: 1 + labLevel('reroll'), ban: 1 + labLevel('ban') };
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
      const role = roleOf(def);
      const m = ROLE_MODS[role];
      // draft picks roll lvl 5-14: same scaling curve as mid-run KOs
      const lvl = Math.max(1, Math.min(LV_CAP, def.lvl ?? 1));
      const hp = Math.round(playerHp(def.stats) * m.hp * lvlHp(def.stats.hp, lvl) * this.labHpMult);
      // supers start at zero charge — each shot banks a turn toward firing
      const cd = Math.max(1, Math.round(bumpCooldown(def.type) * this.cdMult) - m.cdMod);
      this.players.push({
        uid: this.uidCtr++,
        def,
        side: 'player',
        // staggered start in the bottom third — not a rigid row
        x: arena.x + (arena.w * (i + 1)) / (n + 1) + (rng() - 0.5) * 50,
        y: arena.y + arena.h - 70 - (i % 2) * 60 - rng() * 40,
        vx: 0,
        vy: 0,
        r: 26,
        hp,
        maxHp: hp,
        timer: 0,
        drift: 0,
        wx: 0,
        wy: 0,
        wT: 0,
        wMul: 0,
        lunging: 0,
        boss: false,
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
        sumStage: 0,
        atkN: 0,
        weakA: 0,
        shieldA: def.shielded ? rng() * Math.PI * 2 : 0,
        shieldN: 0,
        revives: 0,
        gravR: 0,
        repelR: 0,
        warpT: -9,
        boostT: -9,
        blinkT: 0,
        boostN: 0,
      });
    });
    // bag items field after the team does — persistent consumables earned
    // on gym wins, picked on the draft screen (≤2)
    this.bagIds = bag;
    for (const id of bag) BAG_ITEMS.find((i) => i.id === id)?.apply(this);
    const mapSeed = Math.floor(this.rng() * 2 ** 31);
    this.mapSeed = mapSeed;
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
    this.waveSpecial = 'CHROMA RAID'; // the banner names the event, not 'WAVE 1'
    this.log('CHROMA RAID');
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
    this.log(`RELIC — ${p.name.toUpperCase()}`);
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
      ((this.phase === 'reward' || this.phase === 'loot') && !this.evoChoice);
    if (!parked || this.mapWalk || this.eventChoice) return null;
    return {
      seed: 0, // caller stamps the run seed — battle only knows mapSeed
      daily: false,
      asc: this.asc,
      mapSeed: this.mapSeed,
      mapNode: this.mapNode,
      waveIndex: this.waveIndex,
      depth: this.depth,
      // banked mid-reward/loot: the row already fought is resolved, so the
      // resume marker sits past it — the wave can't be refought for a
      // second row pay
      pendingNext: this.phase === 'map' ? this.pendingNext : this.waveIndex + 1,
      mapNote: this.mapNote,
      eggIn: this.eggIn,
      eggJustLaid: this.eggJustLaid,
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
      perkBan: [...this.perkBan],
      // durable items' effects already live in team[].lvl — re-applying on
      // resume would double them; the rest replay like perks
      bag: this.bagIds.filter((id) => !BAG_ITEMS.find((i) => i.id === id)?.durable),
      masterArmed: this.masterArmed,
      ashArmed: this.ashArmed,
      reviveUsed: this.reviveUsed,
      starsRun: this.starsRun,
      score: this.score,
      perksTaken: this.perksTaken,
      gymsBeaten: this.gymsBeaten,
      shiniesCaught: this.shiniesCaught,
      maxCombo: this.maxCombo,
      maxKos: this.maxKos,
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
    this.mapNode = Math.min(s.mapNode, this.region.nodes.length - 1);
    this.waveIndex = s.waveIndex;
    this.depth = s.depth;
    this.pendingNext = s.pendingNext;
    // stage.waves restarts at the seeded 3 — refill the rows this run already
    // passed or the next spawnWave reads waves[i] past the array end. Each
    // row re-rolls at the depth it originally pushed with, gym leaders baked
    while (this.stage.waves.length <= Math.max(s.pendingNext, s.waveIndex)) {
      const r = this.stage.waves.length;
      const gym = this.region.nodes.find((n) => n.row === r && n.kind === 'gym');
      this.stage.waves.push(rollWave(this.rng, r - 2, THEMES[Math.floor(this.rng() * THEMES.length)], gym?.ttype));
    }
    // backfilled rows are rolled waves too — depth must count them or a
    // resumed climb can clear the last gym short of FINAL_DEPTH and stall
    // on the map at "STAGE 10 OF 9" instead of winning
    this.depth = Math.max(this.depth, this.stage.waves.length - 3);
    this.mapNote = s.mapNote;
    this.eggIn = s.eggIn ?? 0; // v2 saves predate the egg timer — no egg
    this.eggJustLaid = s.eggJustLaid ?? false;
    this.asc = s.asc;
    this.perkIds = [...s.perks];
    for (const id of s.perks) PERKS.find((p) => p.id === id)?.apply(this);
    // bag items replay the same door as perks; armed flags come back
    // verbatim so a spent ball/ash stays spent
    this.bagIds = [...(s.bag ?? [])];
    for (const id of this.bagIds) BAG_ITEMS.find((i) => i.id === id)?.apply(this);
    if (s.masterArmed != null) this.masterArmed = s.masterArmed;
    if (s.ashArmed != null) this.ashArmed = s.ashArmed;
    this.reviveUsed = s.reviveUsed ?? false; // a spent token stays spent
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
    this.tools = { ...(s.tools ?? { roll: 1, ban: 1 }) };
    this.perkBan = new Set(s.perkBan ?? []);
    this.score = s.score;
    this.perksTaken = s.perksTaken;
    this.gymsBeaten = s.gymsBeaten;
    this.shiniesCaught = s.shiniesCaught;
    this.maxCombo = s.maxCombo;
    this.maxKos = s.maxKos;
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
    this.waveFlawless = true;
    this.ultIn = ULT_SHOTS; // the ult is per-fight — no banking a charge into the next stop
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
        this.stage.waves.push(rollWave(this.rng, this.depth, THEMES[Math.floor(this.rng() * THEMES.length)]));
      }
    } else {
      while (i >= this.stage.waves.length) {
        this.depth++;
        // a gym's rolled wave fields the leader its sign announced; deep
        // waves roll their biome per row — the climb isn't one species pool
        this.stage.waves.push(
          rollWave(this.rng, this.depth, THEMES[Math.floor(this.rng() * THEMES.length)], node?.kind === 'gym' ? node.ttype : undefined),
        );
      }
      // elite doors field the same mono-type squad but one depth tier hotter
      spawns = ttype ? trainerWave(this.rng, this.depth + (elite ? 1 : 0), ttype) : this.stage.waves[i];
    }
    this.hardWave = this.inTrainer || this.inEvent;
    this.curSpawns = spawns;
    this.hpScale = 1 + this.foeHpBonus + this.depth * 0.25 + i * 0.12 + this.asc * 0.15; // wave 3 mobs are +24% tanky; ascension stacks on top
    // each wave is a new scene — rotate the flat theme; about half roll
    // weather, which tilts the type table until the wave ends
    const others = THEMES.filter((t) => t !== this.theme);
    this.theme = others[Math.floor(this.rng() * others.length)];
    this.weather = this.rng() < (this.dailyWeather ? 1 : 0.5) ? WEATHER_FOR[this.theme] : null;
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
    if (this.waveHadGym) this.weather = WEATHER_FOR[this.theme];
    else if (this.asc >= 8) this.weather = WEATHER_FOR[THEMES[Math.floor(this.rng() * THEMES.length)]];
    // weather summoners own the sky — a drought caller's arrival overrules
    // whatever rolled, and its banner names the sky it brought
    const caller = spawns.find((s) => s.def.skyFor);
    if (caller) {
      this.weather = caller.def.skyFor ?? null;
      const skyLabel = { sun: 'DROUGHT CALLER!', rain: 'DRIZZLE CALLER!', sand: 'SAND STREAM!', wind: 'AIR LOCK!' }[caller.def.skyFor as Weather];
      this.waveSpecial = this.waveSpecial ? `${this.waveSpecial} · ${skyLabel}` : skyLabel;
    }
    this.inRival = false;
    // ASC 1 ROAMERS: echoes and invades hunt twice as hard. ASC 9 TAG
    // TEAM: the echo is owed one guaranteed visit this climb.
    const roam = this.asc >= 1 ? 2 : 1;
    const tagTeam = this.asc >= 9 && !this.tagEchoDone;
    if (ttype) {
      this.waveSpecial = elite
        ? `ACE TRAINER — RARE LOOT ON THE LINE!`
        : `${TRAINER_CLASS[ttype]?.title ?? 'TRAINER'} WANTS TO BATTLE!`;
      sfx('invade');
    } else if (!this.inEvent && this.echo?.length && i > 0 && !this.waveHadGym && (tagTeam || this.rng() < 0.15 * roam)) {
      spawns = this.curSpawns = rivalWave(this.echo.map((e) => e.def), this.rng);
      this.waveSpecial = 'RIVAL BATTLE — YOUR FALLEN TEAM RETURNS!';
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
    const gymFurnished = bossWave && this.rng() < 0.3; // ~1 gym in 3 fights in a furnished court
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
    const room = buildRoom(
      gymFurnished ? ROOM_LAYOUTS[1 + Math.floor(this.rng() * (ROOM_LAYOUTS.length - 1))] : bossWave ? ROOM_BOSS : ROOM_LAYOUTS[li],
      this.theme,
      this.rng,
    );
    this.blocks = room.blocks.map((b) => ({
      x: this.arena.x + this.arena.w * b.nx,
      y: this.arena.y + this.arena.h * b.ny,
      w: this.arena.w * b.nw,
      h: this.arena.h * b.nh,
    }));
    // a fresh layout can land on a standing teammate — nudge them out
    for (const p of this.players) {
      if (!p.dead) {
        const at = this.unstick(p.x, p.y, p.r + 2);
        p.x = at.x;
        p.y = at.y;
      }
    }
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
    this.enemies = spawns.map((s) => this.makeEnemy(s, i));
    // spawn dust — the pack pours in instead of blinking onto the court
    for (const e of this.enemies) this.burst(e.x, e.y, '#8890b8', 5, 200, 0.7);
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
      const MODS = ['swarm', 'swarm', 'swarm', 'hasty', 'hasty', 'volatile', 'volatile', 'big', 'big', 'gold', 'cleric', 'aegis', 'zombie', 'zombie', 'skull', 'grav', 'power', 'warded', 'sky', 'skitter', 'hexed', 'tailwind', 'headwind', 'slick', 'storm', 'thorns', 'armored', 'slumber', 'polarized'];
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
          for (const e of this.enemies) if (!e.def.sleepless) e.asleep = true;
          break;
        case 'polarized': // every foe carries a repulsor halo — the court
          // is bumper cars; bank lanes or burn speed punching through
          for (const e of this.enemies) e.repelR = 80;
          break;
        case 'warded': // every foe carries a one-hit ward — the aegis bubble soak
          for (const e of this.enemies) e.shieldN = 1;
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
          break;
      }
      this.curMod = mod;
      const label = { swarm: 'SWARM!', hasty: 'HASTY FOES!', volatile: 'VOLATILE PACK!', big: 'A BIG ONE!', gold: 'SOMETHING SHINY GLINTS…', cleric: 'A CLERIC HIDES IN THE PACK!', aegis: 'A GUARDIAN WARDS THE PACK!', zombie: 'THEY WON\'T STAY DOWN!', skull: 'A MARKED FOE — BONUS ON KO!', grav: 'GRAVITY AURA!', power: 'POWER ZONE!', warded: 'WARDED PACK!', sky: 'THEY TAKE WING!', skitter: 'SKITTERING FOES!', hexed: 'HEXED FIELD!', tailwind: 'TAILWIND!', headwind: 'HEADWIND!', slick: 'SLICK COURT!', storm: 'A STORM FRONT ROLLS IN!', thorns: 'THORNS BURST FROM THE FIELD!', armored: 'THE PACK IS PLATED!', slumber: 'THE PACK IS NAPPING…', polarized: 'POLARIZED FIELD!' }[mod] ?? 'MUTATED!';
      this.waveSpecial = this.waveSpecial ? `${this.waveSpecial} · ${label}` : label;
    }
    // MS-style field pickups: one per wave, two where a boss or elite lurks
    this.pickups = [];
    this.scars = [];
    const npk = this.enemies.some((e) => e.boss || ELITE_IDS.has(e.def.id)) ? 2 : 1;
    // a lum cure only rolls when the pack carries a status threat — it
    // never crowds out the heal/atk drops on a clean wave, and keeps the
    // seeded stream identical on threat-free waves
    const ailThreat = this.enemies.some((e) => e.def.venom || e.def.para || e.def.burn || e.def.drowsy || e.def.shock || e.def.toxic || e.def.flame);
    // a revival herb only rolls when there's a body to raise — dead mons
    // carry over between waves, so the drop appears the wave after a loss;
    // corpse-free waves skip the extra draw and keep the seeded stream
    const deadMate = this.players.some((p) => p.dead);
    for (let k = 0; k < npk; k++) {
      const at = this.unstick(
        this.arena.x + this.arena.w * (0.15 + this.rng() * 0.7),
        this.arena.y + this.arena.h * (0.2 + this.rng() * 0.45),
        16,
      );
      this.pickups.push({
        x: at.x,
        y: at.y,
        kind: deadMate && this.rng() < 0.4
          ? 'revival-herb'
          : ailThreat && this.rng() < 0.35
            ? 'lum-berry'
            : PICKUP_KINDS[Math.floor(this.rng() * 3)],
        t: this.rng() * 6,
      });
    }
    // the room's hazard cells land as zones — lava ponds, silence pools,
    // mines (normalized layout → arena px)
    this.hazards = room.hazards.map((z) => ({
      kind: z.kind,
      x: this.arena.x + this.arena.w * z.nx,
      y: this.arena.y + this.arena.h * z.ny,
      r: this.arena.w * z.r,
      dir: z.dir,
      pair: z.pair,
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
    this.waveBanner = 1.4;
    // the classic "!" tell as control lands — a challenger spots you
    this.waveIntroT = this.time;
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
  }

  // One enemy builder for everything the field can field: wave spawns,
  // boss phase-summons. wi is the wave row so level curves match the wave
  // the foe arrived on.
  private makeEnemy(s: WaveSpawn, wi: number): Unit {
    const r = s.boss ? 46 : 26;
    const at = this.unstick(this.arena.x + this.arena.w * s.nx, this.arena.y + this.arena.h * s.ny, r + 2);
    // wild level = the climb's depth: route-1 fodder up to champion-tier;
    // the level is honest (bulkier wilds), not just a number
    // raids flat-line at +30 — a one-wave stage has no climb to ride
    const el = Math.min(LV_CAP, 5 + wi * 10 + (this.raid ? 30 : 0) + (this.rng() < 0.35 ? 4 : 0) + (s.boss ? 8 : 0));
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
      const t = { sun: 'fire', rain: 'water', sand: 'rock', wind: 'flying' }[this.weather] as PokeType | undefined;
      if (t) def = { ...def, type: t };
    }
    return {
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
      timer: (s.def.melee ? MELEE_TIMER : ENEMY_BASE_TIMER) * this.foeCdMult * this.ascTimerMult() * (s.def.prank ? 0.55 : 1) + (wi === 0 ? 1 : 0),
      // ASC 7 FRENZY: foes press harder — approach speed ×1.25
      drift: enemyDrift(def.stats) * (s.boss ? 0.55 : 1) * (this.asc >= 7 ? 1.25 : 1),
      wx: 0,
      wy: 0,
      wT: this.rng() * 0.8,
      wMul: 1,
      lunging: 0,
      boss: !!s.boss,
      // ASC 6+: gym leaders walk in furious — fast attack cycle from bell one
      enraged: !!s.boss && this.asc >= 6,
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
      sumStage: 0,
      atkN: 0,
      weakA: s.boss ? this.rng() * Math.PI * 2 : 0,
      shieldA: s.def.shielded ? this.rng() * Math.PI * 2 : 0,
      regenT: 0,
      asleep: !!s.def.sleepy && !s.def.sleepless,
      repelR: s.def.repel ? 90 : 0,
      shieldN: 0,
      revives: 0,
      gravR: 0,
      warpT: -9,
      boostT: -9,
      blinkT: s.def.blink ? 4 + this.rng() * 2.5 : 0,
      boostN: 0,
    };
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
    // header band, top-left — never inside the arena, or a ball resting in
    // that corner gets caught under the chip and can't be pulled. 40px hit
    // floor like every other chip; the drawn circle keeps the same center.
    return { x: 9, y: 25, w: 40, h: 40 };
  }

  pointerDown(p: Vec) {
    if (this.paused) { // any tap unfreezes
      this.paused = false;
      sfx('ui');
      return;
    }
    if (this.phase === 'aim' || this.phase === 'shot' || this.phase === 'enemy' || this.phase === 'loot') {
      const c = this.pauseChip();
      if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) {
        this.paused = true;
        this.pointerCancel(); // a frozen game drops the half-pull (or the leash)
        sfx('ui');
        return;
      }
      const f = { x: c.x + c.w + 4, y: c.y, w: c.w, h: c.h };
      if (p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h) {
        this.ff = Battle.ffPref = !this.ff;
        sfx('ui', this.ff ? 1.3 : 0.8);
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
    if (this.phase !== 'aim' || this.active.dead) return;
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
        if (this.ultArmUid === hit.uid && this.time - this.ultArmT < 2) {
          this.ultArmUid = -1;
          this.fireUlt(hit);
        } else {
          this.ultArmUid = hit.uid;
          this.ultArmT = this.time;
          this.pushText({ x: hit.x, y: hit.y - hit.r - 64, text: 'ULT? TAP AGAIN', t: 2, color: '#ffe76a', big: true });
          sfx('ui', 0.8); // armed, not fired — a lower click than the confirm
        }
        return;
      }
      this.ultArmUid = -1; // a tap anywhere else stands the ult down
      if (hit) {
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
    // hot streak: back-to-back perfects make each shot hit a bit harder —
    // resets the moment a release misses the gold
    this.streak = gold ? this.streak + 1 : 0;
    this.shotStreak = 1 + Math.min(Math.max(this.streak - 1, 0), 4) * 0.07;
    this.shotGold = gold;
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
    this.shotCombo = 0;
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
    this.gustSounded = false;
    this.stopTimer = 0;
    this.slowT = 0;
    this.skipHinted = false;
    this.shotT = this.time;
    // STRIKE SHOT: launch with a recharged super and it fires from the
    // sling — MS's namesake. Spends the cooldown, erupts immediately.
    if (u.cd <= 0) this.bumpAlly(u, u);
    this.phase = 'shot';
    this.shots++;
    if (this.ultIn > 0) this.ultIn--; // every shot banks charge toward the ultimate
    this.waveShots++; // anti-stall pressure counts shots inside the wave
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
      this.pushText({ x: u.x, y: u.y - u.r - 14, text: this.streak > 1 ? `PERFECT ×${this.streak}!` : 'PERFECT!', t: 1, color: '#ffd84d', big: true });
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
      sfx('perfect');
      this.award('perfect');
      buzz([30, 40, 60]);
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
    const P = (0.85 - 0.3 * this.gaugeDifficulty()) * (1 + this.gaugeJit * 0.2);
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
    const n = Math.min(this.active.def.stats.spe / 120, 1);
    const d = this.gaugeDifficulty();
    // the window itself breathes ±30% pull to pull — some releases are
    // generous, some ask for precision; it never lands on the same spec twice
    const hw = Math.max((0.09 - 0.05 * n - 0.04 * d) * (1 + this.gaugeJit2 * 0.3), 0.022);
    const drift = Math.max(d - 0.5, 0) * 0.16 * Math.sin(this.dragT * 2.4);
    const c = Math.min(Math.max(0.68 + 0.27 * n + drift + this.gaugeJit * 0.13, hw), 1 - hw);
    return { c, hw };
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
    // the weather bed rides the same phases the fight does — silence on the map
    weatherBed(
      this.phase !== 'map' && this.phase !== 'won' && this.phase !== 'lost'
        ? this.weather === 'sand' || this.weather === 'wind'
          ? this.weather
          : null
        : null,
    );
    // hit-stop: freeze-frame feel on big combos
    const hit = this.hitStop > 0;
    if (hit) this.hitStop -= dt0;
    const dt = hit ? dt0 * 0.3 : dt0;
    this.time += dt;
    this.cardT += dt;
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
    for (const t of this.texts) t.t -= dt;
    cull(this.texts, (t) => t.t > 0);
    if (this.texts.length > 40) this.texts.splice(0, this.texts.length - 40); // a huge burst shouldn't stack 100 labels
    for (const f of this.flashes) f.t -= dt;
    cull(this.flashes, (f) => f.t > 0);
    if (this.ultFx.t > 0) this.ultFx.t -= dt; // hit-stop stretches the cinema beat
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
    cull(this.beams, (bm) => bm.t > 0);
    for (const f of this.fx) {
      f.t -= dt;
      const damp = Math.exp(-3.2 * dt);
      f.vx *= damp;
      f.vy *= damp;
      f.vy += f.grav * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.sway) f.x += Math.sin(this.time * 6 + f.spin * 7) * f.sway * dt;
    }
    cull(this.fx, (f) => f.t > 0);
    for (const p of this.pops) p.t -= dt;
    cull(this.pops, (p) => p.t > 0);
    this.shake *= Math.exp(-6 * dt);
    this.punch *= Math.exp(-9 * dt);
    if (this.waveBanner > 0) this.waveBanner -= dt;
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
    for (const p of this.players) p.sq *= Math.exp(-9 * dt);
    for (const e of this.enemies) e.sq *= Math.exp(-9 * dt);
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
    if (this.rewardPending && this.phase === 'aim') {
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
      const damp = Math.exp(-FRICTION * this.frictionMult * (this.curMod === 'slick' ? 0.6 : 1) * (onIce ? 0.1 : 1) * h);
      u.vx *= damp;
      u.vy *= damp;
      // gravity auras: inside a carrier's bubble the ball crawls — aim
      // around it or burn a turn punching through
      for (const e of wave) {
        if (e.dead || !e.gravR) continue;
        if (Math.hypot(u.x - e.x, u.y - e.y) < e.gravR + u.r) {
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
      if (e.boss) e.weakA += dt * 0.45; // the weak face drifts — watch it before you commit
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
          if (d < e.r + target.r + 4 || e.lunging <= 0) {
            e.lunging = 0;
            if (d < e.r + target.r + 8) {
              this.damagePlayer(target, physDamage(this.foeAtk(e), target.def.stats.def, 1, zapPower * 1.3), e);
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
            e.x += (nx * 0.55 + e.wx * e.wMul) * e.drift * dt;
            e.y += (ny * 0.55 + e.wy * e.wMul) * e.drift * dt;
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
      // the court herds the pack too — a well's undertow drags swimmers
      // into a clump (the kill-zone you fire into; grounded foes bank off
      // the shore anyway), a gust lane sweeps creeps off their cover.
      // Bosses stay planted; the court is their turf.
      if (!e.dead && !e.boss) {
        for (const hz of this.hazards) {
          if (hz.kind === 'well' && canSwim(e.def) && dist(e, hz) <= hz.r + e.r) {
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
          this.damagePlayer(o.target, o.dmg, o.src);
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
        if (d.hostile) this.damagePlayer(d.e, d.dmg, d.u);
        else this.hurt(d.e, d.dmg, '#9df0ff');
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
      for (const b of this.blocks) resolveBlock(d.u, b); // dashes respect the stones too
      this.hitSolid(d.u); // and the solid prop zones
    }
    cull(this.dashes, (d) => !d.done);
  }

  // A stone slab: slate body under a boulder skin tiled from the gracidea
  // pack (Strength-rock clusters — pure Gen-3 canon), rim + top bevel.
  // A stone slab: darkened cobble face (the wall ring's cliff look at cover
  // scale) with real strength-boulders seated along the top edge.
  private drawBlock(ctx: CanvasRenderingContext2D, b: Rect) {
    ctx.fillStyle = 'rgba(6,8,16,0.4)';
    ctx.fillRect(b.x + 3, b.y + 5, b.w, b.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.w, b.h);
    ctx.clip();
    const cell = 22;
    for (let ty = b.y - cell / 2; ty < b.y + b.h; ty += cell)
      for (let tx = b.x - cell / 2; tx < b.x + b.w; tx += cell)
        drawSlice(ctx, MT.TILE_COBBLE, tx, ty, cell, cell, BLOCK_FACE[this.theme]);
    ctx.restore();
    // the boulders ARE the cover — a clustered row seated on the slab,
    // overhanging its lip like the ring props, small rocks at the foot
    for (let i = 0, tx = b.x + 4; tx < b.x + b.w - 14; i++) {
      const j = hash(b.x * 7.1 + b.y * 3.9 + i * 11.3);
      const bs = 38 + j * 14;
      drawSlice(ctx, MT.TILE_ROCK, tx + (j - 0.5) * 10, b.y - bs * 0.3, bs, bs * (30 / 28), BLOCK_TINT[this.theme]);
      tx += bs * 0.72;
    }
    for (let i = 0, tx = b.x + 10; tx < b.x + b.w - 12; i++) {
      const j = hash(b.x * 3.7 + b.y * 9.2 + i * 5.5);
      if (j > 0.55) drawSlice(ctx, MT.ROCK_SMALL, tx + (j - 0.5) * 12, b.y + b.h - 14 - j * 8, 21, 15, BLOCK_TINT[this.theme]);
      tx += 26 + j * 18;
    }
    ctx.strokeStyle = '#1d2338';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x + 2, b.y + b.h - 2);
    ctx.lineTo(b.x + 2, b.y + 2);
    ctx.lineTo(b.x + b.w - 2, b.y + 2);
    ctx.stroke();
  }

  private hitWalls(u: Unit) {
    const a = this.arena;
    // a bounce only counts when it actually reverses a moving ball —
    // resting contact against the wall isn't a wall hit
    const fast = u.vx * u.vx + u.vy * u.vy > 150 * 150;
    let bounced = false;
    if (u.x - u.r < a.x) {
      u.x = a.x + u.r;
      u.vx = -u.vx * WALL_REST;
      bounced = true;
    } else if (u.x + u.r > a.x + a.w) {
      u.x = a.x + a.w - u.r;
      u.vx = -u.vx * WALL_REST;
      bounced = true;
    }
    if (u.y - u.r < a.y) {
      u.y = a.y + u.r;
      u.vy = -u.vy * WALL_REST;
      bounced = true;
    } else if (u.y + u.r > a.y + a.h) {
      u.y = a.y + a.h - u.r;
      u.vy = -u.vy * WALL_REST;
      bounced = true;
    }
    if (bounced && fast) {
      u.wallN++;
      if (u.side === 'player') this.onBounceFx(u);
      if (this.ricochet(-2) && !this.inStatic(u.x, u.y)) this.onRicochet(u.x, u.y);
    }
  }

  // Stone blocks bank the ball like walls — same restitution, same wall-
  // bounce credit, own contact id so a wall→block squeeze still counts.
  private hitBlocks(u: Unit) {
    const fast = u.vx * u.vx + u.vy * u.vy > 150 * 150;
    let bounced = false;
    for (const b of this.blocks) bounced = resolveBlock(u, b) || bounced;
    if (bounced && fast && u.side === 'player') {
      u.wallN++;
      this.onBounceFx(u);
      if (this.ricochet(-3) && !this.inStatic(u.x, u.y)) this.onRicochet(u.x, u.y);
    }
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
    this.addShake(Math.min(4.5, spd / 500));
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
    this.shotLoot++;
    switch (pk.kind) {
      case 'oran-berry': {
        const hp0 = this.players.reduce((a, p) => a + p.hp, 0);
        this.tryHeal(this.players, (p) => Math.max(1, Math.round(p.maxHp * 0.15)));
        // if nobody needed it (full team, heal on cooldown) still say so —
        // a pickup should never vanish without a word
        if (this.players.reduce((a, p) => a + p.hp, 0) === hp0) {
          this.pushText({ x: pk.x, y: pk.y - 12, text: 'TEAM FULL', t: 0.9, color: '#6fdc6f', big: false });
        }
        break;
      }
      case 'protein':
        sfx('ui');
        this.shotPhys *= 1.5;
        this.pushText({ x: pk.x, y: pk.y - 12, text: 'ATK UP!', t: 0.9, color: '#f08030', big: true });
        break;
      case 'elixir':
        sfx('ready');
        for (const p of this.players) this.chargeUp(p);
        this.pushText({ x: pk.x, y: pk.y - 12, text: 'CD -1!', t: 0.9, color: '#9ecbff', big: true });
        break;
      case 'lum-berry': {
        sfx('ready');
        // canonical lum — every ailment on the team washes off at once
        let cured = false;
        for (const p of this.players) {
          if (p.dead) continue;
          if (p.dotTicks > 0 || p.burnT > 0 || p.paraT > 0 || p.asleep) cured = true;
          p.dotTicks = 0; p.dotDmg = 0; p.burnT = 0; p.paraT = 0; p.asleep = false;
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
  private tryHeal(ps: Unit[], amount: (p: Unit) => number) {
    if (this.healCd > 0) return;
    if (this.enemies.some((e) => !e.dead && e.def.healBlock)) {
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
  private hurt(e: Unit, dmg: number, color: string, suffix = '') {
    if (e.dead) return;
    // absorb: a matching element feeds the hide instead of hurting it —
    // the heal signal travels as negative damage through this one seam
    if (dmg < 0) {
      e.hp = Math.min(e.maxHp, e.hp - dmg);
      this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'ABSORBED!', t: 0.9, color: '#6fdc6f', big: false });
      sfx('heal');
      return;
    }
    let d = dmg;
    if (suffix === '!') d *= 1 + this.belt; // expert belt loves super-effective
    if (e.boss) d *= 1 + this.bossSlayer;
    let crit = false;
    if (this.critCh > 0 && this.rng() < this.critCh) {
      crit = true;
      d *= 2;
    }
    d = Math.round(d * this.dmgMult * (1 + this.t('fire') * 0.1));
    // aegis ward: a shielded foe eats the whole hit — crack the guardian
    // first, or the pack soaks your best lines for free
    if (e.shieldN > 0) {
      e.shieldN--;
      this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'WARD BREAK!', t: 0.9, color: '#9df0ff', big: false });
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
    e.hp -= d;
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
    // boss phase summons: crossing 2/3 then 1/3 hp makes it cry for help —
    // MS add-waves turn the sponge into a fight that escalates
    if (e.boss && !e.dead && e.hp > 0 && e.sumStage < 2) {
      const gate = e.sumStage === 0 ? 0.66 : 0.33;
      if (e.hp / e.maxHp < gate) {
        e.sumStage++;
        this.summonAdds(e);
      }
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
    if (!e.dead && this.t('poison') > 0 && this.rng() < this.t('poison') * 0.25) {
      e.dotTicks = Math.min(e.dotTicks + 1, 6);
      e.dotDmg = Math.max(e.dotDmg, Math.ceil(e.maxHp * 0.08));
    }
    // enrage: below 30% the boss fights dirty — and rage-flagged fodder
    // goes berserk the same way. A wounded Mankey stops being fodder.
    if ((e.boss || e.def.rage) && !e.enraged && e.hp > 0 && e.hp / e.maxHp < 0.3) {
      e.enraged = true;
      e.timer = Math.min(e.timer, 2);
      this.pushText({ x: e.x, y: e.y - e.r - 58, text: 'ENRAGED!', t: 1.2, color: '#ff6b6b', big: true });
      this.burst(e.x, e.y, '#ff6b6b', 16, 440, 1.2);
      this.screenFlash('#ff6b6b', 0.15);
      sfx('invade');
    }
    const ascPremium = this.asc >= 5 ? 0.3 : 0.2; // ASC 5 INFLATION: the score premium deepens
    const gain = Math.round(d * (1 + this.asc * ascPremium) * this.scoreMult); // ascension pays a score premium; lucky egg stacks on
    this.score += gain;
    // action→reward, on screen: every hit feeds its score under the mon
    this.pushText({ x: e.x, y: e.y + e.r + 10, text: `+${gain}`, t: 0.9, color: '#ffe76a', big: false, size: 0.8 });
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
        color: immune ? '#8a90a8' : crit ? '#ffd84d' : color,
        big: crit || suffix === '!',
        // the number sells the hit — chunkier damage pops bigger
        size: Math.min(1.7, 0.85 + d / 90),
        tilt: (Math.random() - 0.5) * 0.16,
      });
    // every landed hit reads on the sprite — orbs, dots and ults squash too
    if (d > 0 && !e.dead) e.sq = Math.max(e.sq, 0.5);
    // the shot's damage tally climbs mid-flight, MS-style — every pop feeds it
    if (d > 0 && e.side === 'enemy') this.shotDmg += d;
    // a chunk of the health bar at once gets the anime flash frame —
    // bumps, orbs and dot ticks all deserve it, not just contact
    if (!immune && d >= Math.max(30, e.maxHp * 0.25)) this.impact(e.x, e.y, color, 0.8);
    if (crit) {
      this.addShake(4);
      this.burst(e.x, e.y, '#ffd84d', 10, 380);
      this.screenFlash('#ffd84d', 0.08);
      this.hitStop = Math.max(this.hitStop, 0.08);
      sfx('perfect', 0.7);
    }
    // styler loop wraps the target — every hit is another circle
    if (e.hp <= 0) {
      e.dead = true;
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
      this.scar(e.x, e.y, e.boss ? 20 : 12); // a KO scorches the court
      // the KO pop is the game's biggest beat — flash frame, star shower,
      // shockwave and a camera lunge all at once
      this.impact(e.x, e.y, TYPE_COLOR[e.def.type] ?? '#ffffff', e.boss ? 2.4 : 1.3);
      this.burst(e.x, e.y, '#ffffff', e.boss ? 26 : 14, e.boss ? 620 : 420, e.boss ? 1.6 : 1);
      this.waves.push({ x: e.x, y: e.y, r: 0, maxR: e.r * 3.2, t: 0.35, life: 0.35, color: TYPE_COLOR[e.def.type] ?? '#ffffff', hits: new Set() });
      this.hitStop = Math.max(this.hitStop, e.boss ? 0.48 : 0.18);
      this.addPunch(e.boss ? 0.2 : 0.09);
      this.addShake(e.boss ? 14 : 6);
      if (e.boss) {
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
      if (this.totalKos >= 40) this.award('rampage');
      this.taskPing('kos', this.totalKos, e.x, e.y - e.r - 90);
      if (this.totalKos % KO_BOUNTY.every === 0) {
        const got = this.earnStars(KO_BOUNTY.pay);
        this.pushText({ x: e.x, y: e.y - e.r - 70, text: `BOUNTY +${got} ★`, t: 1.2, color: '#c9a8ff', big: true });
      }
      this.maxKos = Math.max(this.maxKos, this.kosThisShot);
      // EXP: the mon that launched this shot levels up — growth you can
      // watch mid-run. Bigger foes teach more, and punching up doubles it,
      // like real XP. Cap keeps the multiplier sane.
      const lv = this.active;
      if (lv && !lv.dead && lv.lvl < LV_CAP) {
        this.gainLevels(lv, Math.max(1, Math.round(e.lvl * 0.05)) * (e.lvl > lv.lvl ? 2 : 1));
      }
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
      // shinies never break out — KO'ing one always lands it in the box
      // the KO shot's combo feeds the roll — a pinball kill tires the mon
      // out like a proper weaken-first. (Dots and orbs from this same shot
      // still read this shot's chain — the right value.)
      const caught = master || e.shiny || (!this.inTrainer && this.rng() < this.captureChance + (e.boss ? this.bossCatch : 0) + Math.min(0.12, this.shotCombo * 0.015));
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
        this.catchSeq(e.x, e.y, caught, master ? 'master-ball' : 'poke-ball', () => {
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
            buzz([30, 50, 30, 50, 60]);
          } else {
            // broke out — the escape plays the same faint it always was
            this.pops.push({ x: e.x, y: e.y, id: e.def.id, r: e.r, t: 0.55, life: 0.55 });
            this.burst(e.x, e.y, '#ffffff', 8, 300, 0.9);
            sfx('bounce', 0.6);
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
        if (!this.absorbDupe(e.def, e.shiny)) {
          const cl = this.catchLvl(e.lvl); // it keeps its level — up to the team's pace
          this.boxAdd(e.shiny ? { ...e.def, shiny: true, lvl: cl } : { ...e.def, lvl: cl }, 1, false); // the KO spot already runs the ritual
        }
        // record at capture time — a mid-run tab close keeps the dex honest
        recordCapture([e.def.id]);
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
        if (!this.enemies.some((f) => !f.dead && f.def.healBlock))
          for (const p of this.players) if (!p.dead) p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.12));
        this.pushText({ x: e.x, y: e.y - e.r - 72, text: 'SKULL BONUS!', t: 1.2, color: '#c8ff70', big: true });
        this.burst(e.x, e.y, '#c8ff70', 12, 320, 1);
        sfx('heal');
      }
      // VOLATILE mod: the KO detonates — a chunk of its max hp splashes
      // onto every neighbor, and volatile kills can chain
      // a dead thief coughs up the loot — KO it to take your berry back
      if (e.stolen) this.pickups.push({ x: e.x, y: e.y, kind: e.stolen, t: 0 });
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

  private strikeEnemy(shooter: Unit, e: Unit) {
    const last = e.lastHit.get(shooter.uid) ?? -1;
    if (this.time - last < HIT_COOLDOWN) return;
    e.lastHit.set(shooter.uid, this.time);
    // impact ring in the attacker's type color — every contact pops
    // dual-typed strikers lead with whichever type hits this target harder
    const at = strikeType(shooter.def, e.def);
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
      this.pushText({ x: e.x, y: e.y - e.r - 8, text: 'BLOCKED', t: 0.7, color: '#8a90a8', big: false });
      return;
    }
    // engine cap: repeat hits on the same target decay — variety chains
    const hitN = this.shotHitN.get(e.uid) ?? 0;
    this.shotHitN.set(e.uid, hitN + 1);
    if (rico && !this.inStatic(shooter.x, shooter.y)) this.onRicochet(e.x, e.y);
    const mult = typeMult(at, e.def) * weatherMult(this.weather, at);
    // weak point: the boss's rotating gold face takes triple contact
    // damage — MS's signature precision check. Drifts, so read it first.
    let weak = false;
    if (e.boss) {
      const a = Math.atan2(shooter.y - e.y, shooter.x - e.x);
      let dd = Math.abs(a - e.weakA) % (Math.PI * 2);
      if (dd > Math.PI) dd = Math.PI * 2 - dd;
      weak = dd < 0.62;
    }
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
    // every link in the chain adds momentum: +10% contact damage per pass;
    // grip claw stacks its own ramp per wall bounce this shot
    const dmg = Math.round(
      physDamage(shooter.def.stats.atk, e.def.stats.def, mult, CONTACT_POW) *
        shooter.pow * this.physMult * this.shotPhys * spdMul * (1 + this.shotCombo * (0.1 + this.comboDmg + this.t('electric') * 0.04)) *
        (1 + this.wallRamp * shooter.wallN) *
        (this.typePow[at] ?? 1) *
        this.shotStreak *
        (this.shotGold ? 1.2 : 1) *
        (1 + this.shotVolleyBoost) *
        (rico ? 1 + this.ricoMult : 1) *
        (shooter.burnT > 0 && !shooter.def.guts ? 0.7 : 1) * // a burned striker pulls its punches — guts burns it off
        (shooter.def.guts && (shooter.dotTicks > 0 || shooter.burnT > 0 || shooter.paraT > 0) ? 1.5 : 1) * // Guts: status feeds it
        (shooter.def.huge ? 2 : 1) * // Huge Power: canon attack doubling
        // intimidate: a living menace cowes the whole team — kill it first
        (this.enemies.some((m) => !m.dead && m.def.menace) ? 0.8 : 1) *
        (weak ? 3 : 1) *
        (guarded ? 0.3 : flanked ? 1.5 : 1) *
        // power zone: hits landed while the ball's inside the ATK field
        // carry the field's charge
        (this.inPower(shooter.x, shooter.y) ? 1.5 : 1) *
        (shooter.giant ? 2 : 1) *
        // multiscale: an untouched hide halves the hit — chip it open
        // first, then bring the finisher
        (e.def.scale && e.hp >= e.maxHp && !shooter.def.breaker ? 0.5 : 1) *
        Math.pow(0.9, hitN),
    );
    if (weak) {
      this.pushText({ x: e.x, y: e.y - e.r - 44, text: 'WEAK POINT!', t: 1, color: '#ffd84d', big: true });
      this.hitStop = Math.max(this.hitStop, 0.16);
      this.impact(e.x, e.y, '#ffd84d', 1.7);
      this.addPunch(0.11);
      this.addShake(11);
      sfx('perfect');
    }
    if (flanked) {
      this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'FLANKED!', t: 0.9, color: '#9df0ff', big: true });
      this.impact(e.x, e.y, '#9df0ff', 1.2);
      sfx('hit');
    } else if (guarded) {
      this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'GUARDED', t: 0.7, color: '#8a90a8', big: false });
      sfx('bounce');
    }
    const color = mult > 1 ? '#ffd84d' : mult < 1 ? '#8a90a8' : '#ffffff';
    // wonder guard shrugs off anything that isn't super-effective — the
    // shove still lands, so walls and lava stay on the table
    if (e.def.wguard && mult <= 1 && !shooter.def.breaker) {
      this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'NO EFFECT', t: 0.7, color: '#8a90a8', big: false });
      sfx('bounce');
    } else if (e.def.absorb === at) {
      this.hurt(e, -Math.round(e.maxHp * 0.25), color);
    } else {
      this.hurt(e, dmg, color, mult > 1 ? '!' : '');
      // counter: whatever lands comes back a third as strong — feed it a
      // crit and it feeds you one. Chip it open with the small shots
      if (e.def.counter && !e.dead && dmg > 0 && !shooter.dead) {
        this.damagePlayer(shooter, Math.max(1, Math.round(dmg * 0.3)), e);
        this.pushText({ x: e.x, y: e.y - e.r - 46, text: 'COUNTER!', t: 0.9, color: '#f85888', big: false });
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
    // poison point: brushing the thorn hide can venom the striker —
    // kill it at range with banks, or budget the ticks into the trade
    if (e.def.toxic && !shooter.dead && this.rng() < 0.3) {
      shooter.dotTicks = Math.max(shooter.dotTicks, 4);
      shooter.dotDmg = Math.max(shooter.dotDmg, Math.ceil(shooter.maxHp * 0.06));
      this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'POISONED!', t: 0.9, color: '#a040a0', big: false });
    }
    // static: the crackling hide can discharge into the striker — the
    // next launch limps, so touch it once with a hard kill or not at all
    if (e.def.shock && !shooter.dead && !shooter.def.limber && this.rng() < 0.3 && shooter.paraT <= 0) {
      shooter.paraT = 3;
      this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'STATIC!', t: 0.9, color: '#f8d030', big: false });
    }
    // flame body: the hide singes the striker — burned hits lose heat,
    // so a grazing route through it dulls the whole shot's trade
    if (e.def.flame && !shooter.dead && this.rng() < 0.3) {
      shooter.burnT = Math.max(shooter.burnT, 4);
      this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'BURNED!', t: 0.9, color: '#f08030', big: false });
    }
    // supersonic: the shriek scrambles the next launch — the ghost wobbles
    // honestly, but tight banks get dicey for a round
    if (e.def.confuse && !shooter.dead && !shooter.def.tempo && this.rng() < 0.3) {
      shooter.confuseT = 1;
      this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'CONFUSED!', t: 0.9, color: '#c8a8f8', big: false });
    }
    // cute charm: the smitten striker nods off — a grazed shot can cost
    // the team its next launch, so finish the charm carrier from range
    if (e.def.charm && !shooter.dead && !shooter.asleep && !shooter.def.sleepless && this.rng() < 0.3) {
      shooter.asleep = true;
      this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'SMITTEN!', t: 0.9, color: '#f8b8d0', big: false });
    }
    // effect spore: the puff scatters whatever it carried — venom, a
    // jolt, or a lullaby. You never know which spore you breathed
    if (e.def.spore && !shooter.dead && this.rng() < 0.3) {
      const sporeRoll = this.rng();
      if (sporeRoll < 0.4) {
        shooter.dotTicks = Math.max(shooter.dotTicks, 4);
        shooter.dotDmg = Math.max(shooter.dotDmg, Math.ceil(shooter.maxHp * 0.06));
      } else if (sporeRoll < 0.7) {
        if (!shooter.def.limber) shooter.paraT = Math.max(shooter.paraT, 3);
      } else if (!shooter.def.sleepless) {
        shooter.asleep = true;
      }
      this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'SPORED!', t: 0.9, color: '#a8b820', big: false });
    }
    // synchronize: whatever ails it, ails you — a dotted or singed
    // carrier returns the status to anyone who touches it
    if (e.def.sync && !shooter.dead) {
      let synced = false;
      if (e.dotTicks > 0) { shooter.dotTicks = Math.max(shooter.dotTicks, e.dotTicks); shooter.dotDmg = Math.max(shooter.dotDmg, e.dotDmg); synced = true; }
      if (e.burnT > 0) { shooter.burnT = Math.max(shooter.burnT, e.burnT); synced = true; }
      if (e.paraT > 0 && !shooter.def.limber) { shooter.paraT = Math.max(shooter.paraT, e.paraT); synced = true; }
      if (synced) this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'SYNCED!', t: 0.9, color: '#f85888', big: false });
    }
    // barbed foes bite back — every contact costs the ball a chip of its
    // own HP, so sloppy grazes through the pack bleed the run
    if (e.def.spiky && !shooter.dead) {
      this.damagePlayer(shooter, Math.max(1, Math.round(shooter.maxHp * 0.06)), e);
      this.pushText({ x: shooter.x, y: shooter.y - shooter.r - 12, text: 'SPIKED!', t: 0.7, color: '#f85888', big: false });
    }
    // HEXED FIELD mutator: contacts envenom — the same doT poison supers stack
    if (this.curMod === 'hexed' && !e.dead) {
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
    sfx('hit', 1 + this.shotCombo * 0.12);
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
  // `p` is the bumped ally the blast emanates from.
  private signatureMove(
    src: Unit,
    p: Unit,
    bumpDmg: (e: Unit, power: number) => number,
  ): boolean {
    return this.castSignature(moveOf(src.def.id, src.def.type), src, p, bumpDmg);
  }

  // The money-shot table itself, keyed by move name so METRONOME can
  // re-enter here with a rolled pick instead of the caster's own.
  private castSignature(
    name: string,
    src: Unit,
    p: Unit,
    bumpDmg: (e: Unit, power: number) => number,
  ): boolean {
    const foes = this.enemies.filter((e) => !e.dead);
    if (!foes.length) return false;
    const far = farthest(foes, p);
    const fattest = foes.slice().sort((a, b) => b.maxHp - a.maxHp)[0];
    // a piercing beam from the caster THROUGH the anchor enemy to the far
    // wall — every enemy within `halfW` of the ray eats it
    const lineBlast = (to: Unit, color: string, halfW: number, power: number, w: number, onHit?: (e: Unit) => void) => {
      const d = norm({ x: to.x - p.x, y: to.y - p.y });
      halfW *= 1.4; // hit corridor tracks the fatter drawn beam
      this.beams.push({ x1: p.x, y1: p.y, x2: p.x + d.x * 1400, y2: p.y + d.y * 1400, t: 0.6, life: 0.6, color, w });
      for (const e of foes) {
        const t = (e.x - p.x) * d.x + (e.y - p.y) * d.y;
        if (t < 0) continue; // behind the caster
        const dx = e.x - (p.x + d.x * t), dy = e.y - (p.y + d.y * t);
        if (Math.hypot(dx, dy) < halfW + e.r) {
          this.hurt(e, bumpDmg(e, power), '#ffffff');
          onHit?.(e);
        }
      }
      this.screenFlash(color, 0.3);
      this.hitStop = Math.max(this.hitStop, 0.42);
      this.addPunch(0.22);
      this.addShake(18);
      sfx('beam');
      buzz([40, 30, 60]);
    };
    switch (name) {
      case 'HYPER BEAM': // the golden wall of light — fattest beam in the game
        lineBlast(far, '#ffd84d', 38, 2.6, 2.4);
        return true;
      case 'SOLARBEAM': // same line, photosynthesis green
        lineBlast(far, '#78c850', 32, 2.2, 1.8);
        return true;
      case 'HYDRO CANNON': // a water jet that punches through the pack
        lineBlast(far, '#6890f0', 34, 2.3, 2.0);
        sfx('splash');
        return true;
      case 'ZAP CANNON': { // one fat thunderball tracks the far foe
        this.orbs.push({ x: p.x, y: p.y, target: far, dmg: bumpDmg(far, 2.6), t: 3, wob: 0, color: '#f8d030' });
        this.screenFlash('#f8d030', 0.16);
        sfx('zap');
        return true;
      }
      case 'PSYCHO BOOST': { // Mewtwo's nuke — detonates the biggest target
        this.screenFlash('#f85888', 0.25);
        this.waves.push({
          x: fattest.x, y: fattest.y, r: 0, maxR: 285, t: 0.55, life: 0.55,
          color: '#f85888', hits: new Set(),
          onHit: (e) => this.hurt(e, bumpDmg(e, e === fattest ? 2.6 : 1.3), '#f8b8d0'),
        });
        this.scar(fattest.x, fattest.y, 45);
        this.hitStop = Math.max(this.hitStop, 0.34);
        this.addPunch(0.18);
        this.addShake(15);
        return true;
      }
      case 'ERUPTION': // the whole pack erupts in staggered bursts
        foes.slice(0, 6).forEach((e, i) => {
          this.later(i * 0.12, () => {
            this.burst(e.x, e.y, '#f08030', 22, 560, 1.8);
            this.scar(e.x, e.y, 24);
            this.addShake(9);
            if (!e.dead) this.hurt(e, bumpDmg(e, 1.2), '#ffb088');
            sfx('boom');
          });
        });
        this.screenFlash('#f08030', 0.2);
        return true;
      case 'EXPLOSION': { // everything goes — caster pays 15% recoil
        this.screenFlash('#ffffff', 0.35);
        for (const e of foes) this.hurt(e, bumpDmg(e, 1.5), '#ffffff');
        p.hp = Math.max(1, p.hp - Math.round(p.maxHp * 0.15));
        this.waves.push({ x: p.x, y: p.y, r: 0, maxR: 560, t: 0.6, life: 0.6, color: '#ffd84d', hits: new Set() });
        this.scar(p.x, p.y, 58);
        this.hitStop = Math.max(this.hitStop, 0.4);
        this.addPunch(0.24);
        this.addShake(20);
        sfx('boom');
        buzz([60, 40, 80]);
        return true;
      }
      case 'BLAST BURN': { // a fire wave that scorches every tile it sweeps
        this.screenFlash('#f08030', 0.22);
        this.waves.push({
          x: p.x, y: p.y, r: 0, maxR: 390, t: 0.55, life: 0.55,
          color: '#f08030', hits: new Set(),
          onHit: (e) => { this.scar(e.x, e.y, 20); this.hurt(e, bumpDmg(e, 1.9), '#ffb088'); },
        });
        this.hitStop = Math.max(this.hitStop, 0.28);
        this.addShake(14);
        sfx('boom');
        return true;
      }
      case 'FRENZY PLANT': // drain orbs swarm the four far foes
        foes.slice().sort((a, b) => dist(p, b) - dist(p, a)).slice(0, 4).forEach((e, i) => {
          this.orbs.push({ x: p.x, y: p.y, target: e, dmg: bumpDmg(e, 1.0), t: 3, wob: i * 1.7, color: '#78c850', drain: true });
        });
        return true;
      case 'OUTRAGE': { // rampage — three staggered smashes on the nearest
        const t = nearest(foes, p);
        for (let i = 0; i < 3; i++) {
          this.later(i * 0.16, () => {
            if (t.dead) return;
            this.impact(t.x, t.y, '#7038f8', 1.8);
            this.hurt(t, bumpDmg(t, 1.1), '#c8a8ff');
            const d = norm({ x: t.x - p.x, y: t.y - p.y });
            t.vx += d.x * 300; t.vy += d.y * 300;
            this.addShake(10);
            sfx('hit');
          });
        }
        return true;
      }
      case 'SHEER COLD': { // the arena flash-freezes around the nearest foe
        const t = nearest(foes, p);
        this.screenFlash('#98d8d8', 0.28);
        this.waves.push({
          x: t.x, y: t.y, r: 0, maxR: 240, t: 0.5, life: 0.5,
          color: '#98d8d8', hits: new Set(),
          onHit: (e) => this.hurt(e, bumpDmg(e, e === t ? 2.4 : 0.9), '#d8f0f8'),
        });
        this.hitStop = Math.max(this.hitStop, 0.32);
        this.addShake(13);
        sfx('splash');
        return true;
      }
      case 'METRONOME': { // the finger wag — casts a rolled signature
        // the pool: the flashy half of this table — no METRONOME (no
        // recursion), no SPLASH (the wag deserves a real payoff)
        const pool = [
          'HYPER BEAM', 'SOLARBEAM', 'HYDRO CANNON', 'ZAP CANNON',
          'PSYCHO BOOST', 'ERUPTION', 'EXPLOSION', 'BLAST BURN',
          'FRENZY PLANT', 'OUTRAGE', 'SHEER COLD', 'THUNDERBOLT',
          'ICE BEAM', 'FUTURE SIGHT',
        ];
        const picked = pool[Math.floor(this.rng() * pool.length)];
        this.log(`METRONOME → ${picked}`);
        this.pushText({ x: p.x, y: p.y - p.r - 64, text: `→ ${picked}!`, t: 1.2, color: '#ffd84d', big: true });
        sfx('ready');
        return this.castSignature(picked, src, p, bumpDmg);
      }
      case 'FUTURE SIGHT': { // a hole in time opens where the far foe
        // STANDS — the ring swells over the windup; move and it missed you
        const tx = far.x, ty = far.y;
        this.waves.push({ x: tx, y: ty, r: 0, maxR: 160, t: 1.8, life: 1.8, color: '#f85888', hits: new Set() });
        this.later(1.8, () => {
          this.screenFlash('#f85888', 0.3);
          this.impact(tx, ty, '#f85888', 2.2);
          this.scar(tx, ty, 42);
          this.hitStop = Math.max(this.hitStop, 0.36);
          this.addPunch(0.18);
          this.addShake(16);
          for (const e of this.enemies.slice()) { // hurt can summon adds — don't hit them in this pass
            if (e.dead || Math.hypot(e.x - tx, e.y - ty) > 160 + e.r) continue;
            this.hurt(e, bumpDmg(e, 2.2), '#f8b8d0');
          }
          sfx('boom');
        });
        sfx('warn');
        return true;
      }
      case 'CRUNCH': { // the heavy bite — nearest foe eats fang and flinches
        const t = nearest(foes, p);
        this.impact(t.x, t.y, '#705898', 1.9);
        this.hurt(t, bumpDmg(t, 1.9), '#d8c8f0');
        t.timer += 0.8; // flinched — its attack clock slips a beat
        this.hitStop = Math.max(this.hitStop, 0.2);
        this.addShake(11);
        sfx('hit');
        return true;
      }
      case 'ICE BEAM': // a frozen lance down the ray — everything it spears
        // locks up stiff (no def-down status exists; the chill rides the clock)
        lineBlast(far, '#98d8d8', 30, 2.0, 1.6, (e) => {
          if (!e.dead) e.timer += 0.6;
        });
        return true;
      case 'HYPER VOICE': { // the sound ring rattles the whole court
        this.screenFlash('#f0b6bc', 0.16);
        this.waves.push({
          x: p.x, y: p.y, r: 0, maxR: 260, t: 0.5, life: 0.5,
          color: '#f0b6bc', hits: new Set(),
          onHit: (e) => this.hurt(e, bumpDmg(e, 1.4), '#f8dce0'),
        });
        this.addShake(10);
        sfx('wave');
        return true;
      }
      case 'THUNDERBOLT': { // the mascot bolt — one fat arc on the far
        // foe, then the discharge hops to the two nearest leftovers
        this.beams.push({ x1: p.x, y1: p.y, x2: far.x, y2: far.y, t: 0.32, life: 0.32, color: '#f8d030', w: 7 });
        this.impact(far.x, far.y, '#f8d030', 1.9);
        this.hurt(far, bumpDmg(far, 2.2), '#f8e88a');
        far.timer += 0.5; // stunned stiff
        this.screenFlash('#f8d030', 0.16);
        this.hitStop = Math.max(this.hitStop, 0.3);
        const hit = new Set([far.uid]);
        let from = far;
        for (let i = 0; i < 2; i++) {
          const next = nearest(foes.filter((e) => !hit.has(e.uid)), from);
          if (!next) break;
          hit.add(next.uid);
          const a = { x: from.x, y: from.y };
          this.later(0.14 + i * 0.1, () => {
            if (next.dead) return;
            this.beams.push({ x1: a.x, y1: a.y, x2: next.x, y2: next.y, t: 0.26, life: 0.26 });
            this.impact(next.x, next.y, '#f8d030', 1.3);
            this.hurt(next, bumpDmg(next, 0.9), '#f8e88a');
            sfx('zap');
          });
          from = next;
        }
        this.addShake(11);
        sfx('zap');
        return true;
      }
      case 'FLAMETHROWER': // the cone of flame — everything on the ray burns
        lineBlast(far, '#f08030', 30, 2.1, 1.8, (e) => {
          if (!e.dead) {
            e.dotTicks = Math.min(e.dotTicks + 3, 6);
            e.dotDmg = Math.max(e.dotDmg, Math.ceil(e.maxHp * 0.08));
          }
        });
        return true;
      case 'SPLASH': { // the dud, played straight — a hop, a ripple, nothing
        const t = nearest(foes, p);
        p.sq = 1; // the little hop — up it goes, down it comes
        this.addShake(4);
        this.hurt(t, bumpDmg(t, 0.1), '#bfe8ff'); // the ripple still stings a little
        this.pushText({ x: p.x, y: p.y - p.r - 64, text: '…but nothing happened!', t: 1.1, color: '#9db8d8', big: false });
        this.log(`${src.def.name.toUpperCase()} used SPLASH — nothing happened`);
        sfx('splash', 0.7);
        return true;
      }
      case 'WATER SPOUT': // Kyogre's geyser — the caster's own HP is the
        // reservoir: full HP floods at beam-nuke power, near-faint sputters
        lineBlast(far, '#6890f0', 30, 0.9 + 1.7 * (src.hp / src.maxHp), 2.4);
        sfx('splash');
        return true;
      case 'FISSURE': { // canon OHKO — but the crack only finds GROUNDED prey
        const g = farthest(foes.filter((e) => !e.airborne && !flies(e.def)), p);
        // no grounded mark: the crack still lands, but as plain heavy damage
        lineBlast(g ?? far, '#b8a038', 18, 2.8, 1.3, g ? (e) => {
          if (!e.dead && e.hp < e.maxHp * 0.35) e.timer += 1.2; // left dazed in the crack
        } : undefined);
        this.addShake(12);
        return true;
      }
      case 'SEISMIC TOSS': { // canon fixed damage — the throw pays per level
        const t = nearest(foes, p);
        t.y -= 60; // heaved skyward — the same pop the vortex uses
        t.vy -= 400;
        t.sq = 1;
        this.later(0.5, () => { // the landing is what hurts
          if (t.dead) return;
          this.impact(t.x, t.y, '#c03028', 1.8);
          this.hurt(t, Math.round(src.lvl * t.maxHp * 0.012), '#f0b8a8'); // ~1.2%/lv — Lv50 ≈ 60% maxHp
          this.addShake(12);
          sfx('boom');
        });
        return true;
      }
      case 'ENDEAVOR': { // canon — drags the target to the caster's HP fraction
        const t = nearest(foes, p);
        const d = norm({ x: t.x - p.x, y: t.y - p.y });
        for (let i = -1; i <= 1; i++) // a speed-line fan — the dive reads fast
          this.beams.push({ x1: p.x, y1: p.y, x2: t.x - d.y * i * 14, y2: t.y + d.x * i * 14, t: 0.3, life: 0.3, color: '#f8f8f8', w: 2 });
        const want = Math.max(1, Math.round(t.maxHp * (src.hp / src.maxHp))); // canon can't KO
        const need = t.hp - want;
        this.hurt(t, need > 0 ? need : bumpDmg(t, 0.5), '#f8f8d8'); // under it already — chip, never whiff
        this.impact(t.x, t.y, '#f8f8f8', 1.5);
        sfx('hit');
        return true;
      }
      case 'AURA SPHERE': { // canon never misses — the orb homes on the
        // nearest mark, phases through every rock and retargets on a kill,
        // so the lock-on literally cannot whiff
        const t = nearest(foes, p);
        this.orbs.push({ x: p.x, y: p.y, target: t, dmg: bumpDmg(t, 2.2), t: 3, wob: 0, color: '#30c8f0', spd: 1150 });
        this.pushText({ x: t.x, y: t.y - t.r - 40, text: 'LOCKED ON!', t: 0.9, color: '#9df0ff', big: false });
        this.screenFlash('#30c8f0', 0.14);
        sfx('beam');
        return true;
      }
      case 'SACRED SWORD': { // canon ignores the target's stat changes —
        // the honest port is true damage: the blade pays no heed to defense
        const t =
          foes.filter((e) => dist(p, e) <= 340).sort((a, b) => b.maxHp - a.maxHp)[0] ?? // toughest in reach
          nearest(foes, p); // none close — it still cuts the nearest
        const d = norm({ x: t.x - p.x, y: t.y - p.y });
        for (let i = -1; i <= 1; i++) // one swing, a fan of three cut-lines
          this.beams.push({
            x1: t.x - d.x * 60 + d.y * i * 18, y1: t.y - d.y * 60 - d.x * i * 18,
            x2: t.x + d.x * 60 + d.y * i * 18, y2: t.y + d.y * 60 - d.x * i * 18,
            t: 0.35, life: 0.35, color: '#e8e8f8', w: 3,
          });
        // true damage: back the defender's mit term out of the super's own
        // roll — type, combo and pow still ride along (mit = 60/(60+stat))
        const mitStat = bumpIsPhysical(src.def.type) ? t.def.stats.def : t.def.stats.spd;
        this.hurt(t, Math.round((bumpDmg(t, 1.9) * (60 + mitStat)) / 60), '#e8e8f8');
        this.impact(t.x, t.y, '#e8e8f8', 1.8);
        this.pushText({ x: t.x, y: t.y - t.r - 40, text: 'CUTS THROUGH!', t: 0.9, color: '#e8e8f8', big: false });
        this.hitStop = Math.max(this.hitStop, 0.2);
        this.addShake(11);
        sfx('hit');
        return true;
      }
      case 'DARK VOID': { // the void opens on a beat — everything it
        // swallows oversleeps. `timer` (the attack clock) is the engine's
        // sleep: +2 turns beats any flinch in the table
        const tx = fattest.x, ty = fattest.y; // the dark pulls at the biggest threat
        this.waves.push({ x: tx, y: ty, r: 0, maxR: 250, t: 0.9, life: 0.9, color: '#705898', hits: new Set() });
        this.pushText({ x: tx, y: ty - 130, text: 'THE AIR GOES DARK', t: 1.2, color: '#b098e8', big: true });
        sfx('warn');
        this.later(0.9, () => {
          this.screenFlash('#403050', 0.3);
          this.impact(tx, ty, '#705898', 2);
          this.addShake(12);
          for (const e of this.enemies.slice()) { // hurt can summon adds — don't hit them in this pass
            if (e.dead || Math.hypot(e.x - tx, e.y - ty) > 250 + e.r) continue;
            e.timer += 2; // asleep — its attack clock slips two turns
            this.hurt(e, bumpDmg(e, 0.7), '#b098e8');
            this.pushText({ x: e.x, y: e.y - e.r - 30, text: 'Z Z Z', t: 1.1, color: '#b098e8', big: false });
          }
          sfx('wave');
        });
        return true;
      }
      case 'V-CREATE': { // canon: the hottest flame + a defense drop. The
        // ally rockets through the pack — a two-link dash at nuke power that
        // ends parked on the far mark. No per-unit def-down field exists
        // (takenMult is a run-wide perk knob), so the self-cost stays on the
        // card text — the honest read is the bigger hit.
        const t = nearest(foes, p);
        this.screenFlash('#f08030', 0.2);
        this.burst(p.x, p.y, '#f08030', 20, 640); // takeoff — the V ignites
        this.dashes.push({ u: p, e: t, done: false, dmg: bumpDmg(t, 2.4) });
        // Dash has no land callback — re-push once the lunge should have
        // landed (dashes run at 1100 u/s), the same chain EXTREMESPEED uses
        this.later(dist(p, t) / 1100 + 0.05, () => {
          const t2 = nearest(this.enemies.filter((e) => !e.dead && e !== t), p);
          if (!t2) return;
          this.burst(p.x, p.y, '#f08030', 14, 540);
          this.dashes.push({ u: p, e: t2, done: false, dmg: bumpDmg(t2, 2.4) });
        });
        this.addShake(10);
        sfx('sizzle');
        return true;
      }
      case 'JUDGMENT': { // countless pellets of light rain on the whole
        // pack — one sky-beam per foe, staggered so the volley reads as rain
        this.pushText({
          x: this.arena.x + this.arena.w / 2, y: this.arena.y + 90,
          text: 'JUDGMENT IS DEALT', t: 1.3, color: '#fff0a8', big: true,
        });
        this.screenFlash('#fff0a8', 0.22);
        this.addShake(10);
        sfx('warn');
        foes.forEach((e, i) => {
          this.later(0.15 + i * 0.09, () => {
            if (e.dead) return;
            this.beams.push({ x1: e.x + 40, y1: e.y - 300, x2: e.x, y2: e.y, t: 0.28, life: 0.28, color: '#fff0a8', w: 4 });
            this.impact(e.x, e.y, '#fff0a8', 1.4);
            this.hurt(e, bumpDmg(e, 1.6), '#fff8d0');
            sfx('beam');
          });
        });
        return true;
      }
      case 'ROAR OF TIME': { // the roar takes a beat to cross time — a
        // telegraph ring swells where the fattest foe stands, then the blast
        // lands huge. Canon recharge: the caster's super clock restarts full.
        const tx = fattest.x, ty = fattest.y;
        this.waves.push({ x: tx, y: ty, r: 0, maxR: 230, t: 1.2, life: 1.2, color: '#a8c8f0', hits: new Set() });
        this.pushText({ x: tx, y: ty - 130, text: 'TIME DISTORTS', t: 1.2, color: '#a8c8f0', big: true });
        sfx('warn');
        this.later(1.2, () => {
          this.screenFlash('#a8c8f0', 0.32);
          this.impact(tx, ty, '#a8c8f0', 2.2);
          this.scar(tx, ty, 48);
          this.hitStop = Math.max(this.hitStop, 0.36);
          this.addPunch(0.18);
          this.addShake(17);
          for (const e of this.enemies.slice()) { // hurt can summon adds — don't hit them in this pass
            if (e.dead || Math.hypot(e.x - tx, e.y - ty) > 230 + e.r) continue;
            this.hurt(e, bumpDmg(e, 3.0), '#d8e8ff');
          }
          src.cd = src.cdMax; // spent — the next super earns from zero
          sfx('boom');
        });
        return true;
      }
    }
    return false;
  }

  // Bump an ally mid-shot: every pass is a combo link; the signature
  // super fires only when recharged (cd counts down per shot).
  private bumpAlly(p: Unit, u: Unit) {
    if (this.time - p.lastBump < 0.3) return; // once per pass, not per frame
    p.lastBump = this.time;
    p.sq = 1; // the bumped ally pops — the pass reads as a bump, not a phase
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
    this.shotCombo++;
    this.maxCombo = Math.max(this.maxCombo, this.shotCombo);
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
    const eff = (e: Unit) => typeMult(src.def.type, e.def) * weatherMult(this.weather, src.def.type);
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
    this.impact(p.x, p.y, color, 1.6);
    this.burst(p.x, p.y, color, 22, 540);
    this.flavor(p.x, p.y, src.def.type);
    this.addPunch(0.11);
    this.addShake(10);
    this.screenFlash(color, 0.18);
    sfx(SUPER_SFX[src.def.type], superPitch(src.def.type));
    buzz(20);

    if (!this.signatureMove(src, p, bumpDmg)) switch (src.def.type) {
      case 'fire': {
        // flame burst: a shockwave ring rolls out from the ally — enemies
        // catch fire as the front passes over them
        this.screenFlash('#f08030', 0.15);
        this.addShake(8);
        this.waves.push({
          x: p.x, y: p.y, r: 0, maxR: 255 * p.rngMul, t: 0.45, life: 0.45,
          color, hits: new Set(),
          onHit: (e) => {
            const dir = norm({ x: e.x - p.x, y: e.y - p.y });
            e.vx += dir.x * 170;
            e.vy += dir.y * 170;
            // under sun (or Charcoal) the ring ignites — same cap as toxic
            if (this.weather === 'sun' || this.perkIds.includes('charcoal')) {
              e.dotTicks = Math.min(e.dotTicks + 1, 6);
              e.dotDmg = Math.max(e.dotDmg, Math.ceil(e.maxHp * 0.08));
            }
            this.hurt(e, bumpDmg(e, 1.6), '#9df0ff');
          },
        });
        // + fireball volley: homing fire-orbs arc into the 3 FARTHEST
        // enemies — nobody outruns the burn
        near(Infinity)
          .sort((a, b) => dist(p, b) - dist(p, a))
          .slice(0, this.perkIds.includes('charcoal') ? 4 : 3)
          .forEach((e, i) => {
            this.orbs.push({ x: p.x, y: p.y, target: e, dmg: bumpDmg(e, 0.9), t: 2.5, wob: i * 2.1, color });
          });
        break;
      }
      case 'electric': {
        // chain lightning: hops enemy→enemy, each arc lands a beat apart
        let from: Unit = p;
        const chain: { a: Vec; e: Unit; mult: number }[] = [];
        const hit = new Set<number>();
        let mult = 1.3;
        // the chain grows with the combo it's riding — a hot shot arcs wider
        const links = Math.min(3 + Math.floor(this.shotCombo / 3) + (this.perkIds.includes('magnet') ? 2 : 0), 6);
        for (let i = 0; i < links; i++) {
          const next = this.enemies
            .filter((e) => !e.dead && !hit.has(e.uid) && dist(from, e) <= 340 * p.rngMul)
            .sort((a, b) => dist(from, a) - dist(from, b))[0];
          if (!next) break;
          hit.add(next.uid);
          chain.push({ a: { x: from.x, y: from.y }, e: next, mult });
          mult *= 0.7;
          from = next;
        }
        chain.forEach((c, i) => {
          this.later(i * 0.1, () => {
            if (c.e.dead) return;
            // the arc itself — a bright line jumps from the last link to this one
            this.beams.push({ x1: c.a.x, y1: c.a.y, x2: c.e.x, y2: c.e.y, t: 0.28, life: 0.28 });
            this.impact(c.e.x, c.e.y, '#f8d030', 1.4);
            this.hurt(c.e, bumpDmg(c.e, c.mult), '#9df0ff');
            this.hitStop = Math.max(this.hitStop, 0.05);
            this.addShake(5);
            sfx('zap');
          });
        });
        if (chain.length > 0) {
          this.addShake(6);
          this.screenFlash('#f8d030', 0.12);
        }
        break;
      }
      case 'grass': {
        // drain field: tendrils pull energy from enemies back to the ally
        let dealt = 0;
        for (const e of near(140)) {
          const dmg = bumpDmg(e, 1.1);
          dealt += dmg;
          this.hurt(e, dmg, '#9df0ff');
          e.timer += 0.5; // the tendrils root the drained a beat
        }
        if (dealt > 0) this.tryHeal(this.players, () => Math.max(Math.round(dealt * (this.perkIds.includes('miracle-seed') ? 0.7 : 0.35)), 4));
        this.waves.push({ x: p.x, y: p.y, r: 0, maxR: 210 * p.rngMul, t: 0.4, life: 0.4, color, hits: new Set() });
        // + seed flares: homing spores chase the 2 far enemies and
        // siphon them back to the team on impact
        near(Infinity)
          .sort((a, b) => dist(p, b) - dist(p, a))
          .slice(0, this.perkIds.includes('miracle-seed') ? 3 : 2)
          .forEach((e, i) => {
            this.orbs.push({ x: p.x, y: p.y, target: e, dmg: bumpDmg(e, 0.8), t: 2.5, wob: i * 2.1, color, drain: true });
          });
        break;
      }
      case 'water': {
        // HYDRO PUMP — a firehose jet, not three polite orbs: a fat
        // pressurized beam spears the court on a lane to the nearest foe,
        // hosing everything it crosses and washing them downstream
        const e = nearest(p, Infinity);
        if (!e) break;
        const dir = norm({ x: e.x - p.x, y: e.y - p.y });
        const end = { x: p.x + dir.x * 900, y: p.y + dir.y * 900 }; // pierce — the jet runs the whole court
        this.beams.push({ x1: p.x, y1: p.y, x2: end.x, y2: end.y, t: 0.42, life: 0.42, color, w: 10 });
        this.beams.push({ x1: p.x, y1: p.y, x2: end.x, y2: end.y, t: 0.3, life: 0.3, color: '#dff4ff', w: 4 }); // foam core
        for (const t of near(Infinity)) {
          const dx = t.x - p.x, dy = t.y - p.y;
          const along = dx * dir.x + dy * dir.y; // how far down the jet
          const off = Math.abs(dx * dir.y - dy * dir.x); // how far off the lane
          if (along < 0 || off > t.r + (this.weather === 'rain' ? 48 : 24)) continue; // rain swells the lane
          t.vx += dir.x * 640;
          t.vy += dir.y * 640;
          this.hurt(t, bumpDmg(t, 1.9), '#9df0ff');
          if (this.perkIds.includes('mystic-water')) t.timer += 0.4; // the jet chills their clocks
          this.impact(t.x, t.y, color, 1.7);
        }
        // spray at the nozzle + the mist rings where the jet crossed bodies
        this.burst(p.x + dir.x * p.r, p.y + dir.y * p.r, '#dff4ff', 14, 380);
        this.addShake(12);
        this.screenFlash('#bfe8ff', 0.16);
        break;
      }
      case 'psychic': {
        // telekinetic shove: real knockback impulse — enemies get flung
        // off the ally, off walls, off each other
        const radius = 170;
        this.waves.push({
          x: p.x, y: p.y, r: 0, maxR: radius * 1.5 * p.rngMul, t: 0.4, life: 0.4,
          color, hits: new Set(),
        });
        this.addShake(7);
        const shoved = near(radius);
        for (const e of shoved) {
          const dir = norm({ x: e.x - p.x, y: e.y - p.y });
          e.vx += dir.x * 720;
          e.vy += dir.y * 720;
          this.hurt(e, bumpDmg(e, 1.2), '#9df0ff');
        }
        // wall-slam payoff: whoever the shove pins to an arena wall a beat
        // later eats a bonus hit — fling them somewhere hard
        this.later(0.15, () => {
          const a = this.arena;
          const spoon = this.perkIds.includes('twisted-spoon');
          const m = spoon ? 60 : 40; // wall-slam reach — the spoon grabs wider
          for (const e of shoved) {
            if (e.dead) continue;
            const wall =
              e.x - e.r < a.x + m || e.x + e.r > a.x + a.w - m ||
              e.y - e.r < a.y + m || e.y + e.r > a.y + a.h - m;
            if (!wall) continue;
            this.impact(e.x, e.y, color, 1.5);
            this.hurt(e, bumpDmg(e, spoon ? 1.1 : 0.8), '#9df0ff');
          }
        });
        // + twin psy-orbs hunt the far stragglers the shove misses
        near(Infinity)
          .sort((a, b) => dist(p, b) - dist(p, a))
          .slice(0, 2)
          .forEach((e, i) => {
            this.orbs.push({ x: p.x, y: p.y, target: e, dmg: bumpDmg(e, 0.9), t: 2.5, wob: i * 2.1 + 1, color });
          });
        break;
      }
      case 'flying': {
        // hurricane vortex: drags every nearby enemy into a pile on the
        // ally — sets up the next shot's bump chain
        const radius = 210 * (this.perkIds.includes('sharp-beak') ? 1.4 : 1);
        this.screenFlash(color, 0.1);
        this.addShake(5);
        // the vortex ring — sells the drag-in, since the pull alone is invisible
        this.waves.push({ x: p.x, y: p.y, r: 0, maxR: 240 * p.rngMul, t: 0.45, life: 0.45, color, hits: new Set() });
        const dragged = near(radius);
        for (const e of dragged) {
          const dir = norm({ x: p.x - e.x, y: p.y - e.y });
          e.vx += dir.x * 640;
          e.vy += dir.y * 640;
          this.hurt(e, bumpDmg(e, 0.7), '#9df0ff');
        }
        // second beat: the vortex pops skyward — the gathered pile gets
        // launched and their attack clocks scramble (gather → scatter)
        this.later(0.25, () => {
          for (const e of dragged) {
            if (e.dead) continue;
            e.vy -= 400;
            e.timer += 0.5;
          }
          this.addShake(7);
        });
        break;
      }
      case 'poison':
        // toxic: gas cloud now, then a cut of max HP at the end of each of
        // your shots — re-toxining stacks the timer
        this.screenFlash('#a040a0', 0.12);
        // the gas ring rolling out — toxic had no visible front before
        this.waves.push({ x: p.x, y: p.y, r: 0, maxR: 220 * p.rngMul, t: 0.4, life: 0.4, color, hits: new Set() });
        for (const e of near(140)) {
          // venom detonation: anyone already ticking pops the payload now
          const barb = this.perkIds.includes('poison-barb');
          if (e.dotTicks > 0) this.hurt(e, e.dotDmg * (barb ? 3 : 2), '#a040a0');
          e.dotTicks = Math.min(e.dotTicks + (barb ? 5 : 2), 6);
          e.dotDmg = Math.max(e.dotDmg, Math.ceil(e.maxHp * 0.08));
          this.hurt(e, bumpDmg(e, 1.0), '#9df0ff');
        }
        break;
      case 'rock': {
        // meteor shower: jab the nearest, then rocks rain down on the 3
        // far enemies — anywhere on the court is inside the kill box
        const e = nearest(p, 200);
        if (e) this.hurt(e, bumpDmg(e, 0.8), '#9df0ff');
        near(Infinity)
          .sort((a, b) => dist(p, b) - dist(p, a))
          .slice(0, this.perkIds.includes('hard-stone') ? 5 : 3)
          .forEach((t, i) => {
            this.later(0.14 + i * 0.16, () => {
              this.scar(t.x, t.y, 20); // the meteor lands whether or not it kills
              this.screenFlash('#b8a038', 0.12);
              this.addShake(12);
              if (t.dead) return;
              this.impact(t.x, t.y, '#b8a038', 1.7);
              this.hurt(t, bumpDmg(t, i === 0 ? 2.2 : 1.5), '#9df0ff');
            });
          });
        break;
      }
      case 'fighting': {
        // aura storm: dash to the nearest foe, then a 3-hit jab chain —
        // jab, jab, and an uppercut that staggers its attack clock
        const e = nearest(p, Infinity);
        if (!e) break;
        this.dashes.push({ u: p, e, done: false, dmg: bumpDmg(e, 0.8) });
        // the chain lands as the lunge arrives (dashes run at 1100 u/s)
        const eta = dist(p, e) / 1100;
        const jabs = this.perkIds.includes('black-belt') ? [0.5, 0.5, 0.5, 0.9] : [0.5, 0.5, 0.9];
        jabs.forEach((pow, i) => {
          this.later(eta + i * 0.12, () => {
            if (e.dead) return;
            this.impact(e.x, e.y, color, 1.3);
            this.hurt(e, bumpDmg(e, pow), '#9df0ff');
            if (i === jabs.length - 1) e.timer += 1; // the uppercut flinches
          });
        });
        break;
      }
      case 'ghost': {
        // hex: wisps converge on every foe from the dark — the pack closing
        // in is the scare; hex feasts on the poisoned (×1.5 on venom ticks)
        this.screenFlash('#705898', 0.18);
        // whole-court shadow ring — hex hits everything, so the ring does too
        this.waves.push({ x: p.x, y: p.y, r: 0, maxR: 430, t: 0.5, life: 0.5, color, hits: new Set() });
        const tag = this.perkIds.includes('spell-tag');
        near(Infinity)
          .sort((a, b) => dist(p, a) - dist(p, b))
          .slice(0, tag ? 8 : 6)
          .forEach((e, i) => {
            this.orbs.push({ x: e.x + (i % 2 ? 30 : -30), y: this.arena.y - 40, target: e, dmg: bumpDmg(e, e.dotTicks > 0 ? (tag ? 2.6 : 1.95) : 1.3), t: 2.5, wob: i * 2.6 + 1.3, color });
          });
        break;
      }
      default: {
        // extremespeed: the ally physically dashes to the nearest enemy —
        // anywhere on the court — slams it, then chains into the
        // next-nearest for a 2-link hit. Pure speed, never whiffs.
        const e = nearest(p, Infinity);
        if (e) {
          this.dashes.push({ u: p, e, done: false, dmg: bumpDmg(e, 1.5) });
          // Dash has no land callback — re-push once the lunge should have
          // landed (dashes run at 1100 u/s)
          this.later(dist(p, e) / 1100 + 0.05, () => {
            const e2 = this.enemies
              .filter((t) => !t.dead && t !== e)
              .sort((a, b) => dist(p, a) - dist(p, b))[0];
            if (e2) this.dashes.push({ u: p, e: e2, done: false, dmg: bumpDmg(e2, 1.5) });
            // silk scarf: extremespeed links a third dash off the landing
            if (e2 && this.perkIds.includes('silk-scarf'))
              this.later(dist(p, e2) / 1100 + 0.05, () => {
                const e3 = this.enemies
                  .filter((t) => !t.dead && t !== e && t !== e2)
                  .sort((a, b) => dist(p, a) - dist(p, b))[0];
                if (e3) this.dashes.push({ u: p, e: e3, done: false, dmg: bumpDmg(e3, 1.5) });
              });
          });
        }
      }
    }
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
    this.ultIn = ULT_SHOTS;
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
    const multOf = (e: Unit) => typeMult(u.def.type, e.def) * weatherMult(this.weather, u.def.type);
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
    if (this.coach) this.coachDone = true; // survived a wave — teaching's over
    if (this.inRival) {
      this.echoCleared = true; // the echo is beaten — reclaim it
      this.award('rival');
    }
    if (this.waveHadGym) {
      this.gymsBeaten++;
      this.taskPing('gyms', this.gymsBeaten, this.arena.x + this.arena.w / 2, this.arena.y + 54);
    }
    // last-kill slow-mo — the kill shot gets a beat to land
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
    // pickup ability: scavengers root through the arena after the fight —
    // a living carrier may nose out a consumable for the run's bag
    for (const p of this.players) {
      if (p.dead || !p.def.pickup || this.rng() < 0.85) continue;
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
      (this.waveFlawless ? ' · FLAWLESS!' : '');
    this.waveBanner = 1.1;
    sfx('wave');
    // a raid is the whole fight — the win beat is short and never rolls the
    // climb's reward board, map or clear ledger
    if (this.raid && this.waveIndex + 1 >= this.waveCount) {
      this.phase = 'won';
      this.endT = 1.2;
      this.waveSpecial = 'RAID CLEARED!';
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
      this.log(`CLIMB CLEAR — +${starPay} STAR PIECES`);
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
      y: this.arena.y + 110,
      text: `★ TROPHY: ${a?.name ?? id} ★`,
      t: 2,
      color: '#ffd84d',
      big: true,
    });
    sfx('perfect');
  }

  // A catch can't outpace the team it joins — wild level is foe difficulty,
  // not a free pass. Captures keep their level up to a few over your best,
  // so a boss catch or a rival-echo mon never lands as a run-breaker.
  catchLvl(lvl: number) {
    const best = Math.max(1, ...this.players.map((p) => p.lvl));
    return Math.min(lvl, best + 3);
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
  private catchPayoff(x: number, y: number) {
    return () => {
      this.impact(x, y, '#ffd84d', 0.9);
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
      this.catchSeq(a.x, a.y, true, 'poke-ball', this.catchPayoff(a.x, a.y));
    }
  }

  gainLevels(p: Unit, n: number) {
    if (p.dead || p.lvl >= LV_CAP) return;
    const l0 = p.lvl;
    p.lvl = Math.min(LV_CAP, p.lvl + n);
    p.pow *= lvlPow(offStat(p.def.stats, p.def.type), p.lvl) / lvlPow(offStat(p.def.stats, p.def.type), l0);
    const gain = Math.round(p.maxHp * (lvlHp(p.def.stats.hp, p.lvl) / lvlHp(p.def.stats.hp, l0) - 1));
    p.maxHp += gain;
    p.hp = Math.min(p.hp + gain, p.maxHp);
    this.pushText({ x: p.x, y: p.y - p.r - 36, text: `LV ${p.lvl}!`, t: 0.9, color: '#9df0ff', big: false });
    this.burst(p.x, p.y, '#9df0ff', 6, 240, 0.8);
    sfx('ready');
  }

  // A dupe capture doesn't fill a box slot — it feeds the copy you own:
  // evolves it when the line has a next stage, else it's rare candy.
  // Returns false when the species is genuinely new to the run.
  private absorbDupe(def: SpeciesDef, shiny = false): boolean {
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
    const evoIds = def.evolvesTo == null ? [] : Array.isArray(def.evolvesTo) ? def.evolvesTo : [def.evolvesTo];
    const options = evoIds
      .map((id) => SPECIES_DB.find((s) => s.id === id))
      .filter((s): s is SpeciesDef => !!s);
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
      recordCapture([next.id]); // evo-only species only ever enter the dex here
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
      if (bi >= 0) this.box[bi] = this.evoMerge(c.boxDef, next);
      else {
        // it left the box mid-queue (swapped onto the team) — find the unit
        const u = this.players.find((p) => p.def === c.boxDef);
        if (u) this.evolveUnit(u, next);
      }
    }
    recordCapture([next.id]);
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
    this.evoFx.push({ u: p, from: fromId, to: nd.id, t: 0, revealed: false });
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
  private bankStage(row: number) {
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
        // maxstage is a high-water mark, not a cumulative counter — adding
        // banked have on top would ping "reach stage 8" at stage 5 forever
        if ((v.kind === 'maxstage' ? now : v.have + now) < v.n) continue;
        this.taskDone.add(v.id);
        this.pushText({ x, y, text: `TASK: ${v.label} ✓`, t: 1.5, color: '#ffd84d', big: true });
        sfx('ui', 0.9);
      }
    }
  }

  private enterReward() {
    this.boxSel = -1;
    this.teamSel = -1;
    // hard stops pay out uncommon-or-better relics — the risk has a price;
    // elites go further: rare-or-better only
    this.rewardCap = this.eliteWave ? 1 : this.hardWave ? 2 : 3;
    this.rewardOffers = rollPerks(this.rng, this.rewardCap, this.rank, this.teamTypes(), this.perkBan, this.perkOfferN);
    this.banArmed = false; // a fresh board can't inherit a leftover armed tap
    this.hardWave = false;
    this.eliteWave = false;
    // trainer mons stay with their owner; only a fallen gym pays its ace —
    // ordinary stages earn no free catch
    this.lastRecruit = this.inTrainer || !this.waveHadGym ? null : this.rollRecruit();
    if (this.lastRecruit) {
      const rec = this.lastRecruit;
      if (!this.absorbDupe(rec)) {
        this.boxAdd(rec); // boxAdd runs the ball ritual itself
        recordCapture([rec.id]); // the dex logs it now, not at run end
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
    // fix the lineup before the item — main opens the roster over the board
    // once; only worth the interruption when there's a mon to swap in
    this.wantMenu = this.box.length > 0;
    // a queued split evolution asks its question on the reward screen
    if (!this.evoChoice) this.evoChoice = this.evoPending.shift() ?? null;
  }

  // A fallen gym leader bursts into PokéCoins — a few-second victory lap
  // where you drag your lead mon through the fountain before it fades.
  private enterLoot() {
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
    this.waveBanner = 1.6;
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
            this.burst(c.x, c.y, c.kind === 'gem' ? '#7dd8f8' : '#ffd84d', c.kind === 'gem' ? 9 : 5, c.kind === 'gem' ? 340 : 220, 0.6);
            this.pushText({
              x: c.x,
              y: c.y - 16,
              text: `+${c.val}`,
              t: 0.6,
              color: c.kind === 'gem' ? '#7dd8f8' : '#ffd84d',
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

  // Declining pays score instead — StS reward skips keep dead offers honest.
  declineReward() {
    if (this.phase !== 'reward') return;
    sfx('ui');
    const ascPremium = this.asc >= 5 ? 0.3 : 0.2; // ASC 5 INFLATION — same deeper premium on skips
    this.score += Math.round(150 * (1 + ascPremium * this.asc));
    this.rewardOffers = [];
    this.advanceReward();
  }

  // REROLL spends a charge to re-deal the board at the same tier cap —
  // banished ids stay out of the fresh deal.
  rerollOffers(): boolean {
    if (this.phase !== 'reward' || this.tools.roll <= 0) return false;
    this.rewardOffers = rollPerks(this.rng, this.rewardCap, this.rank, this.teamTypes(), this.perkBan, this.perkOfferN);
    this.tools.roll--;
    return true;
  }

  // BANISH arms instead of firing — the next card tap culls that perk from
  // the run's pool. Tap again to stand down. Returns the armed state.
  toggleBanish(): boolean {
    if (this.phase !== 'reward' || this.tools.ban <= 0) return false;
    this.banArmed = !this.banArmed;
    return this.banArmed;
  }

  // The armed tap: charge paid, the card leaves the board and its id is
  // gone for the run. Returns the banished id for telemetry.
  banishPerk(i: number): string | null {
    const perk = this.rewardOffers[i];
    if (!perk || this.phase !== 'reward' || !this.banArmed || this.tools.ban <= 0) return null;
    this.perkBan.add(perk.id);
    this.rewardOffers.splice(i, 1);
    this.tools.ban--;
    this.banArmed = false;
    if (!this.rewardOffers.length) this.advanceReward(); // emptied the board — they leave empty-handed
    return perk.id;
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
    this.mapNode = this.region.nodes.indexOf(n);
    this.pendingNext = n.row;
    this.arriveAtNode(n);
    this.tickEgg();
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
    this.catchSeq(a.x, a.y, true, 'poke-ball', () => {
      this.impact(a.x, a.y, '#ffd84d', 0.9);
      playJingle('hatch'); // curious arp — a new face, not a fought catch
    });
    recordCapture([def.id]);
    this.mapMsg = `THE EGG HATCHED — ${def.name.toUpperCase()} JOINED YOUR BOX!`;
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
        prompt: 'A POKÉ CENTER — REST THE TEAM, OR TRAIN THROUGH?',
        art: { mon: 113 }, // Chansey keeps the counter
        options: [
          {
            label: `POKÉ CENTER — HEAL${healTo < 1 ? ' 75%' : ''} + REVIVE`,
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
                skip: true,
              };
            },
          },
          {
            label: 'TRAIN HARD — +3 LEVELS, NO HEAL',
            icon: 'macho-brace',
            run: (b) => {
              for (const p of b.players) if (!p.dead) b.gainLevels(p, 3);
              return { note: 'A HARD WORKOUT — EVERYONE +3 LEVELS!', skip: true };
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
      const p = rollPerks(this.rng, 1, this.rank, this.teamTypes(), this.perkBan, 1)[0];
      if (p) {
        this.grantPerk(p);
        this.mapNote = `YOU FOUND ${p.name.toUpperCase()}!`;
      }
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
    for (const e of this.enemies.slice()) { // hurt can summon adds — skip them this pass
      if (e.boss && e.relic === 'leftovers' && !e.dead) {
        e.hp = Math.min(e.maxHp, e.hp + Math.ceil(e.maxHp * 0.04));
      }
      // shed skin: sloughs every ailment before the venom can tick
      if (e.def.shed && !e.dead && (e.dotTicks > 0 || e.burnT > 0 || e.paraT > 0 || e.asleep) && this.rng() < 0.3) {
        e.dotTicks = 0; e.dotDmg = 0; e.burnT = 0; e.paraT = 0; e.asleep = false;
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
    let warned = false;
    for (const e of this.enemies) {
      if (!e.asleep) e.timer--; // a dozing foe's countdown never winds down
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
      } else if (e.timer === 1) {
        warned = true; // it swings after this shot — one soft warning tick
      }
    }
    if (warned) sfx('warn');
    if (this.pendingAttacks.length > 0) {
      this.phase = 'enemy';
      this.enemyPhaseT = ENEMY_TURN_DELAY;
    } else {
      this.nextTurn();
    }
  }

  // Phase summon — the boss howls and fodder floods the upper court.
  // Twice per boss, capped so a slow fight can't overflow the board.
  private summonAdds(boss: Unit) {
    const room = 7 - this.enemies.filter((x) => !x.dead).length;
    const n = Math.min(2, Math.max(0, room));
    if (n <= 0) return;
    this.pushText({ x: boss.x, y: boss.y - boss.r - 20, text: 'CALLED FOR HELP!', t: 1.3, color: '#ff8a8a', big: true });
    this.screenFlash('#f85888', 0.15);
    this.addShake(6);
    sfx('invade');
    for (let i = 0; i < n; i++) {
      const def = pickWild(this.rng, this.depth);
      const e = this.makeEnemy(
        { def, nx: 0.2 + this.rng() * 0.6, ny: 0.12 + this.rng() * 0.35 },
        this.waveIndex,
      );
      e.timer = Math.min(e.timer, 2); // adds arrive hot — they act soon
      e.minion = true; // while any minion lives, the boss takes half hits
      this.enemies.push(e);
      this.waves.push({ x: e.x, y: e.y, r: 0, maxR: e.r * 2.6, t: 0.3, life: 0.3, color: '#ff8a8a', hits: new Set() });
      this.burst(e.x, e.y, '#ff8a8a', 10, 340);
    }
  }

  // Relocation beat — the boss blinks to a fresh spot with a landing
  // sting. The board keeps shifting, so no pocket stays safe to camp in.
  private bossHop(e: Unit) {
    this.waves.push({ x: e.x, y: e.y, r: 0, maxR: e.r * 2.6, t: 0.25, life: 0.25, color: '#f85888', hits: new Set() });
    this.burst(e.x, e.y, '#f85888', 12, 400);
    const at = this.unstick(
      this.arena.x + this.arena.w * (0.15 + this.rng() * 0.7),
      this.arena.y + this.arena.h * (0.12 + this.rng() * 0.4),
      e.r + 2,
    );
    e.x = at.x;
    e.y = at.y;
    e.weakA = this.rng() * Math.PI * 2; // new spot, new face to hunt
    this.waves.push({ x: e.x, y: e.y, r: 0, maxR: e.r * 3, t: 0.3, life: 0.3, color: '#f85888', hits: new Set() });
    this.impact(e.x, e.y, '#f85888', 1.2);
    this.pushText({ x: e.x, y: e.y - e.r - 14, text: 'TELEPORT!', t: 0.9, color: '#f85888', big: false });
    this.addShake(6);
    sfx('zap');
    for (const p of this.players) {
      if (!p.dead && dist(e, p) <= e.r + p.r + 40) {
        this.damagePlayer(p, specDamage(e.def.stats.spa, p.def.stats.spd, 1, zapPower), e);
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
      const d = e.def.hunter ? p.hp : dist(e, p);
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
            hit(p, specDamage(e.def.stats.spa, p.def.stats.spd, 1, blastPower));
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
          onHit: (p) => hit(p, specDamage(e.def.id === 112 ? e.def.stats.atk : e.def.stats.spa, p.def.stats.spd, 1, blastPower)),
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
              dmg: Math.round(specDamage(e.def.stats.spa, p.def.stats.spd, 1, blastPower)),
              t: 2.5, wob: i * 2.1, color, hostile: true, src: e,
            });
          });
        break;
      }
      default: { // generic gym blast — radial nova
        const R = 170;
        sfx('boom');
        for (const p of this.players) {
          if (!p.dead && dist(e, p) <= R + p.r) {
            this.scar(p.x, p.y, 14);
            hit(p, specDamage(e.def.stats.spa, p.def.stats.spd, 1, blastPower));
          }
        }
      }
    }
  }

  private resolveEnemyTurn() {
    const attacks = this.pendingAttacks;
    this.pendingAttacks = [];
    if (!attacks.length) return; // already consumed — the volley's mid-flight
    // staggered volley: each attacker fires on its own beat so every hit
    // is attributable instead of one silent wall of damage
    attacks.forEach((e, i) => this.later(i * 0.28, () => this.fireEnemy(e)));
    this.later(Math.max(0, attacks.length - 1) * 0.28 + 0.35, () => {
      if (this.phase !== 'enemy') return;
      if (this.players.every((p) => p.dead) && !this.ashRevive()) {
        this.wipe();
        return;
      }
      this.nextTurn();
    });
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
    const want = this.weather ? { sun: 'fire', rain: 'water', sand: 'rock', wind: 'flying' }[this.weather] : undefined;
    return want && (u.def.type === want || u.def.type2 === want) ? 1.12 : 1;
  }

  private foeAtk(e: Unit) {
    return e.def.stats.atk
      * (e.burnT > 0 ? 0.75 : 1) // a singed foe swings dulled — same burn rule the ball plays by
      // intimidate on your bench: a living menace mon cowes the whole pack
      * (this.players.some((m) => !m.dead && m.def.menace) ? 0.8 : 1)
      * (e.def.guts && (e.dotTicks > 0 || e.burnT > 0) ? 1.5 : 1)
      // pack alpha: a living leader rallies every packmate's hits — the
      // leader itself doesn't march under its own flag
      * (!e.def.alpha && this.enemies.some((a) => !a.dead && a.def.alpha) ? 1.3 : 1);
  }

  private foeZap(e: Unit, target: Unit) {
    sfx('zap');
    this.orbs.push({
      x: e.x, y: e.y, target,
      dmg: Math.round(physDamage(this.foeAtk(e), target.def.stats.def, 1, zapPower)),
      t: 2.5, wob: e.uid * 1.7, color: '#ff6b6b', hostile: true, src: e,
    });
    if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
  }

  private fireEnemy(e: Unit) {
    if (e.dead) return; // killed during the windup — the corpse stays down
    {
      e.timer = (e.def.melee ? MELEE_TIMER : ENEMY_BASE_TIMER) * this.foeCdMult * this.ascTimerMult() * (e.enraged ? 0.66 : 1) * (e.def.truant ? 2 : 1)
        // speed boost: every launch winds it tighter — floor at half so
        // it never blurs into an unreadable machine gun
        * (e.def.boost ? Math.max(0.5, Math.pow(0.85, e.boostN++)) : 1);
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
          sfx('warn');
          this.later(0.55, () => {
            if (e.dead || target.dead) return;
            this.dashes.push({
              u: e, e: target, done: false, hostile: true,
              dmg: Math.round(physDamage(this.foeAtk(e), target.def.stats.def, 1, zapPower * 1.1)),
            });
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
          sfx('warn');
          this.later(0.7, () => {
            if (e.dead) { lane.t = 0; return; } // killed mid-windup — the channel fizzles
            lane.fired = true;
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
        for (const p of this.playersByDist(e).slice(0, 3)) {
          this.orbs.push({
            x: e.x, y: e.y, target: p,
            dmg: Math.round(physDamage(this.foeAtk(e), p.def.stats.def, 1, zapPower) * 0.55),
            t: 2.5, wob: e.uid * 1.7, color: '#ff9a30', hostile: true, src: e,
          });
        }
        if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
      } else if (e.def.melee) {
        // melee enemies lunge instead of zapping — the dash plays out over
        // the next moments while you're lining up your shot
        const target = this.nearestPlayer(e);
        if (target) {
          // windup crouch first — fodder gets its tell like the bosses do
          e.sq = 0.7;
          sfx('launch');
          this.later(0.25, () => { if (!e.dead) e.lunging = 1.4; });
        }
      } else {
        const target = this.nearestPlayer(e);
        if (target) this.foeZap(e, target);
      }
    }
  }

  private damagePlayer(p: Unit, dmg: number, src?: Unit) {
    // a corpse takes nothing — hazards and stray orbs were re-firing the
    // whole KO beat (REVENGE stack, sash burn, revive spend, killer rewrite)
    if (p.dead) return;
    // flying trait: incoming attacks whiff outright — surfaced so a zero
    // never reads as a bug
    if (this.t('flying') > 0 && this.rng() < Math.min(0.25, this.t('flying') * 0.07)) {
      this.pushText({ x: p.x, y: p.y - p.r - 8, text: 'MISS!', t: 0.8, color: '#a890f0', big: false });
      return;
    }
    // foes hit harder the deeper the run goes — depth 6 lands ~1.7x;
    // +15% base pressure, +8% per wave so wave 3 actually threatens.
    // rock trait shaves every hit; the waveShots ramp is the anti-stall —
    // after 10 unanswered shots a wave fights back harder each turn
    const pressure = 1 + Math.max(0, this.waveShots - 10) * 0.12;
    dmg = Math.max(1, Math.round(dmg * (src?.side === 'enemy' ? foePow : 1) * (src?.boss ? bossPow : 1) * this.takenMult * (1 - this.t('rock') * 0.07) * pressure * 1.15 * (1 + this.depth * 0.12 + this.waveIndex * 0.08 + this.asc * 0.08)));
    if (p.role === 'BULWARK' || p.role === 'WARDEN' || p.role === 'GUARDIAN') dmg = Math.max(1, Math.round(dmg * 0.75));
    if (p.sash && dmg >= p.hp) {
      // focus sash: hang on at 1 HP
      p.sash = false;
      dmg = p.hp - 1;
      this.pushText({ x: p.x, y: p.y - p.r - 20, text: p.def.sturdy ? 'STURDY!' : 'FOCUS SASH!', t: 1.1, color: '#ffd84d', big: false });
    }
    p.hp -= dmg;
    if (dmg > 0) this.waveFlawless = false;
    // leech foes feed on the hit — the wound pays them back a sip of HP
    if (src?.def.leech && !src.dead && dmg > 0) {
      const sip = Math.max(1, Math.round(dmg * 0.5));
      src.hp = Math.min(src.maxHp, src.hp + sip);
      this.pushText({ x: src.x, y: src.y - src.r - 8, text: `+${sip}`, t: 0.8, color: '#6fdc6f', big: false });
    }
    // sleep powder: the dust can drop the victim — loses its next turn
    if (src?.def.drowsy && !p.dead && !p.def.sleepless && dmg > 0 && this.rng() < 0.55) {
      p.asleep = true;
      this.pushText({ x: p.x, y: p.y - p.r - 20, text: 'PUT TO SLEEP!', t: 1, color: '#a890f0', big: false });
    }
    // venom sting: the wound keeps bleeding — ticks down once a round
    if (src?.def.venom && !p.dead && dmg > 0) {
      p.dotTicks = Math.max(p.dotTicks, 4);
      p.dotDmg = Math.max(p.dotDmg, Math.ceil(p.maxHp * 0.06));
      this.pushText({ x: p.x, y: p.y - p.r - 20, text: 'POISONED!', t: 1, color: '#a040a0', big: false });
    }
    // will-o-wisp: the burn singes each round and dulls the victim's hits
    if (src?.def.burn && !p.dead && dmg > 0 && this.rng() < 0.7) {
      p.burnT = Math.max(p.burnT, 6);
      this.pushText({ x: p.x, y: p.y - p.r - 20, text: 'BURNED!', t: 1, color: '#f08030', big: false });
    }
    // thunder wave: the shock locks the sling — launches limp a few rounds
    if (src?.def.para && !p.dead && !p.def.limber && dmg > 0 && this.rng() < 0.6) {
      p.paraT = Math.max(p.paraT, 5);
      this.pushText({ x: p.x, y: p.y - p.r - 20, text: 'PARALYZED!', t: 1, color: '#f8d030', big: false });
    }
    // point abilities fire both ways: a melee hit on a static or poison-
    // point mon answers back — the lunge is the contact, orbs don't count
    if (src?.def.melee && !src.dead && dmg > 0) {
      const grace = p.def.grace ? 2 : 1; // serene grace doubles the contact odds
      if (p.def.shock && this.rng() < 0.3 * grace) {
        src.paraT = Math.max(src.paraT, 3);
        this.pushText({ x: src.x, y: src.y - src.r - 10, text: 'STATIC!', t: 0.9, color: '#f8d030', big: false });
      }
      if (p.def.toxic && this.rng() < 0.3 * grace) {
        src.dotTicks = Math.max(src.dotTicks, 4);
        src.dotDmg = Math.max(src.dotDmg, Math.ceil(src.maxHp * 0.06));
        this.pushText({ x: src.x, y: src.y - src.r - 10, text: 'POISON PT!', t: 0.9, color: '#a040a0', big: false });
      }
      if (p.def.flame && this.rng() < 0.3 * grace) {
        src.burnT = Math.max(src.burnT, 5);
        this.pushText({ x: src.x, y: src.y - src.r - 10, text: 'FLAME BODY!', t: 0.9, color: '#f08030', big: false });
      }
      if (p.def.charm && this.rng() < 0.3 * grace) {
        src.asleep = true;
        this.pushText({ x: src.x, y: src.y - src.r - 10, text: 'SMITTEN!', t: 0.9, color: '#f8b8d0', big: false });
      }
      if (p.def.spore && this.rng() < 0.3 * grace) {
        const roll = this.rng();
        if (roll < 0.4) {
          src.dotTicks = Math.max(src.dotTicks, 4);
          src.dotDmg = Math.max(src.dotDmg, Math.ceil(src.maxHp * 0.06));
        } else if (roll < 0.7) {
          src.paraT = Math.max(src.paraT, 3);
        } else {
          src.asleep = true;
        }
        this.pushText({ x: src.x, y: src.y - src.r - 10, text: 'SPORED!', t: 0.9, color: '#a8b820', big: false });
      }
      if (p.def.sync) {
        // synchronize: whatever ails it echoes onto the striker
        let synced = false;
        if (p.dotTicks > 0) { src.dotTicks = Math.max(src.dotTicks, p.dotTicks); src.dotDmg = Math.max(src.dotDmg, p.dotDmg); synced = true; }
        if (p.burnT > 0) { src.burnT = Math.max(src.burnT, p.burnT); synced = true; }
        if (p.paraT > 0) { src.paraT = Math.max(src.paraT, p.paraT); synced = true; }
        if (synced) this.pushText({ x: src.x, y: src.y - src.r - 10, text: 'SYNCED!', t: 0.9, color: '#f85888', big: false });
      }
    }
    if (settings().dmgNums)
      this.pushText({ x: p.x, y: p.y - p.r - 8, text: `-${dmg}`, t: 0.9, color: '#ff6b6b', big: false });
    // the map early-returns before texts draw — a stray orb hit there
    // would be invisible, so it goes on the field log instead
    if (this.phase === 'map') this.log(`${p.def.name.toUpperCase()} TOOK A STRAY HIT — ${dmg}`);
    // survived on fumes — the clutch beat deserves a callout
    if (p.hp > 0 && p.hp <= p.maxHp * 0.15) {
      this.pushText({ x: p.x, y: p.y - p.r - 34, text: 'BARELY!', t: 0.9, color: '#ffd84d', big: false });
    }
    this.addShake(3);
    this.burst(p.x, p.y, '#ff6b6b', 9, 360);
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
      this.killer = src?.def.name ?? 'the hazards'; // who lands the wipe — the result screen names it
      this.refreshTraits(); // a faint drops its type from the team bonus
      this.impact(p.x, p.y, '#ff6b6b', 1.5);
      this.burst(p.x, p.y, '#ffffff', 14, 420);
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
        const a = this.players[idx];
        this.pushText({
          x: a.x, y: a.y - a.r - 8,
          // a charged super fires on launch — the GO! call is where it's taught
          text: `GO! ${a.def.name.toUpperCase()}${a.cd <= 0 ? ' — SUPER READY!' : ''}`,
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
    this.phase = 'lost';
    this.endT = 1.6; // the sting lands before the field report covers it
    this.screenFlash('#ff6b6b', 0.3);
    sfx('lose');
  }

  // sacred ash: a full team wipe consumes the charm instead — everyone
  // stands back up at 30% and the fight goes on. Once per run.
  private ashRevive(): boolean {
    if (!this.ashArmed || !this.players.every((p) => p.dead)) return false;
    this.ashArmed = false;
    for (const p of this.players) {
      p.dead = false;
      p.hp = Math.round(p.maxHp * 0.3);
    }
    this.refreshTraits(); // the revive fields the whole team again
    this.pushText({
      x: this.arena.x + this.arena.w / 2,
      y: this.arena.y + this.arena.h / 2,
      text: 'SACRED ASH!',
      t: 1.6, color: '#ffd84d', big: true,
    });
    this.log('SACRED ASH — TEAM REVIVED');
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

  // FloatTexts carry their measured width from birth — the string never
  // changes, so the draw pass never re-measures the same glyphs. A banner
  // too wide to ever fit the court caches its fitted font too.
  private pushText(t: FloatText) {
    if (MCTX) {
      MCTX.font = font(16 * (t.size ?? 1));
      t.w = MCTX.measureText(t.text).width;
      if (t.w > W_CANVAS_FALLBACK - 16) {
        const s = fitFont(MCTX, t.text, 37 * (t.size ?? 1), W_CANVAS_FALLBACK - 16); // 37 ≥ the punch-in pop max
        t.ff = font(s);
        t.fw = MCTX.measureText(t.text).width;
      }
    }
    this.texts.push(t);
  }

  // Anime shrapnel: velocity streaks, glow dots and a few stars exploding
  // off a point — the workhorse every impact routes through.
  private burst(x: number, y: number, color: string, n = 10, speed = 340, size = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.3 + Math.random());
      const kind = Math.random();
      this.fx.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        t: 0.3 + Math.random() * 0.4,
        life: 0.7,
        size: (1.6 + Math.random() * 2.8) * size,
        color: kind < 0.2 ? '#ffffff' : color,
        shape: kind < 0.55 ? 'streak' : kind < 0.88 ? 'dot' : 'star',
        spin: (Math.random() - 0.5) * 14,
        grav: kind < 0.5 ? 560 : 0,
      });
    }
    if (this.fx.length > 260) this.fx.splice(0, this.fx.length - 260);
  }

  // The white-hot flash frame anime hits open with: a big white star plus
  // a colored one spinning out under it, then shards on top.
  private impact(x: number, y: number, color: string, scale = 1) {
    this.fx.push(
      { x, y, vx: 0, vy: 0, t: 0.16, life: 0.16, size: 30 * scale, color: '#ffffff', shape: 'star', spin: 0, grav: 0 },
      { x, y, vx: 0, vy: 0, t: 0.32, life: 0.32, size: 17 * scale, color, shape: 'star', spin: 3, grav: 0 },
    );
    this.burst(x, y, color, Math.round(8 * scale) + 4, 400 * Math.sqrt(scale), scale);
  }

  // Cast motes keyed to the super's element — embers climb for fire,
  // leaves flutter for grass, debris flies for rock. One call dresses
  // every bump super in its own type instead of the same generic burst.
  private flavor(x: number, y: number, type: PokeType) {
    const c = TYPE_COLOR[type];
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 220;
      const f: Fx = {
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        t: 0.4 + Math.random() * 0.5,
        life: 0.9,
        size: 1.4 + Math.random() * 2.4,
        color: c,
        shape: 'dot',
        spin: (Math.random() - 0.5) * 10,
        grav: 0,
      };
      switch (type) {
        case 'fire': f.vy = -Math.abs(f.vy) - 60; f.grav = -300; f.sway = 24; break;
        case 'water': f.vy = -Math.abs(f.vy) * 0.7; f.grav = -160; f.sway = 40; f.color = Math.random() < 0.5 ? '#bfe8ff' : c; break;
        case 'grass': f.shape = 'leaf'; f.grav = 90; f.sway = 60; f.vx *= 0.5; f.vy = Math.abs(f.vy) * 0.4 - 40; break;
        case 'electric': f.shape = 'streak'; f.vx *= 1.8; f.vy *= 1.8; f.color = Math.random() < 0.4 ? '#ffffff' : '#f8d030'; break;
        case 'psychic': f.shape = 'star'; f.vx *= 0.4; f.vy = -Math.abs(f.vy) * 0.5 - 30; f.sway = 50; break;
        case 'flying': { // gale streaks swirl tangentially off the cast
          f.shape = 'streak';
          const ta = a + Math.PI / 2;
          const ts = 240 + Math.random() * 260;
          f.vx = Math.cos(ta) * ts;
          f.vy = Math.sin(ta) * ts;
          f.color = '#e8f6ff';
          break;
        }
        case 'poison': f.vy = Math.abs(f.vy) * 0.4 + 60; f.grav = 420; break; // drips fall
        case 'rock':
        case 'fighting': f.shape = 'leaf'; f.grav = 640; f.vy = -Math.abs(f.vy) * 0.8; f.color = Math.random() < 0.5 ? '#c8b090' : c; break; // debris chips
        case 'ghost': f.vy = -Math.abs(f.vy) * 0.4 - 20; f.grav = -60; f.sway = 34; f.size *= 1.5; f.t *= 1.4; f.life = 1.3; break;
        default: f.shape = 'streak'; f.vx *= 2.2; f.vy *= 2.2; f.color = '#ffffff'; break; // normal speed lines
      }
      this.fx.push(f);
    }
  }

  // --- rendering ---

  render(ctx: CanvasRenderingContext2D) {
    if (this.phase === 'map') {
      this.drawRegion(ctx);
      return;
    }
    const a = this.arena;

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

    // arena: theme-tinted backdrop + prop-lined rim — the wave seed moves
    // the light pool and re-dresses the wall ring, so two grove courts in
    // a row don't share one treeline
    const wallSeed = this.waveIndex * 13.7 + this.depth * 3.1;
    drawBackdrop(ctx, a, 18, this.theme, this.time, {
      nx: 0.45 + hash(wallSeed) * 0.4,
      ny: 0.08 + hash(wallSeed + 9) * 0.24,
    });
    drawWall(ctx, a, this.theme, wallSeed);

    // grove courts get 1-2 squashed dirt patches under the dressing —
    // wave-seeded like the scatter, so each fight's court varies
    if (this.theme === 'grove') {
      const pn = 1 + Math.floor(hash(this.waveIndex * 3.3 + 7) * 2);
      for (let i = 0; i < pn; i++) {
        const pw = 62 + hash(this.waveIndex * 5.9 + i * 9.1 + 1) * 38; // 62-100
        const ph = pw * (0.42 + hash(this.waveIndex * 4.3 + i * 7.7 + 2) * 0.22);
        const px = a.x + 70 + pw / 2 + hash(this.waveIndex * 11.1 + i * 5.7 + 20) * (a.w - 140 - pw);
        const py = a.y + 110 + ph / 2 + hash(this.waveIndex * 7.7 + i * 3.3 + 31) * (a.h - 240 - ph);
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(px, py, pw / 2, ph / 2, 0, 0, Math.PI * 2);
        ctx.clip();
        drawSlice(ctx, MT.TILE_PATH, px - pw / 2, py - ph / 2, pw, ph);
        ctx.restore();
      }
    }

    // floor scatter — hash-seeded per wave so the court's dressing is
    // stable for the whole fight; props stay small and under everything
    {
      const d = DECOR[this.theme];
      if (d.alpha) ctx.globalAlpha = d.alpha;
      for (let i = 0; i < d.n; i++) {
        const p = d.props[Math.floor(hash(this.waveIndex * 13.1 + i * 3.7) * d.props.length)];
        const px = a.x + 40 + hash(this.waveIndex * 7.9 + i * 17.3 + 1) * (a.w - 80);
        const py = a.y + 44 + hash(this.waveIndex * 5.3 + i * 11.7 + 2) * (a.h - 100);
        const w = d.s[0] + hash(this.waveIndex * 3.1 + i * 7.1 + 3) * (d.s[1] - d.s[0]);
        drawSlice(ctx, p.r, px - w / 2, py - w / 2, w, w * (p.r[3] / p.r[2]), p.t);
      }
      ctx.globalAlpha = 1;
    }

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
    for (const hz of this.hazards) if (!hz.spent) this.drawHazard(ctx, hz);

    // stone blocks — solid cover the ball banks off
    for (const b of this.blocks) this.drawBlock(ctx, b);

    // ambient drift keyed to the court — petals ride the grove breeze, dust
    // hangs in cavern shafts, embers climb and flicker in the volcano, snow
    // slants through the sky court. Still rooms shouldn't read dead.
    {
      const amb = AMBIENT[this.theme];
      const ambN = Math.max(1, Math.round(amb.n * QUALITY_FX[settings().quality]));
      ctx.fillStyle = amb.col;
      for (let k = 0; k < ambN; k++) {
        const mx = a.x + (((k * 97.31 + this.time * amb.vx + Math.sin(this.time * 1.1 + k * 2.3) * amb.wob) % a.w) + a.w) % a.w;
        const my = a.y + (((k * 61.7 - this.time * amb.vy) % a.h) + a.h) % a.h;
        ctx.globalAlpha = 0.1 + amb.tw * (1 + Math.sin(this.time * 2.4 + k * 1.7));
        ctx.beginPath();
        ctx.arc(mx, my, amb.r * (0.7 + (k % 3) * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    this.drawWeather(ctx);

    // field pickups: a kind-colored ring + tag under the bobbing item icon —
    // you can tell what it is (and that it's worth steering through) before
    // the ball reaches it
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
      if (img) ctx.drawImage(img, pk.x - 13, pk.y - 13 + bob, 26, 26);
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      // the item's name rides above the icon, its payoff below — reads as a
      // real Pokémon drop, not an anonymous orb
      ctx.font = fontB(6.5);
      ctx.strokeText(meta.name, pk.x, pk.y - 19 + bob);
      ctx.fillStyle = '#f4f6ff';
      ctx.fillText(meta.name, pk.x, pk.y - 19 + bob);
      ctx.font = fontB(7);
      ctx.strokeText(meta.label, pk.x, pk.y + 28);
      ctx.fillStyle = meta.color;
      ctx.fillText(meta.label, pk.x, pk.y + 28);
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
    ctx.globalAlpha = 1;

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
      if (e.dead || !e.gravR) continue;
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
      if (e.dead || !e.enraged) continue;
      ctx.globalAlpha = 0.3 + Math.sin(this.time * 11 + e.uid) * 0.18;
      ctx.strokeStyle = '#ff5040';
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
      if (e.dead || !e.def.menace) continue;
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
      if (e.dead || !e.def.trap) continue;
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

    // repulsor fields — a pale gold halo, dashes streaming outward
    for (const e of this.enemies) {
      if (e.dead || !e.repelR) continue;
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
      if (!e.link) continue;
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

    for (const e of this.enemies) this.drawUnit(ctx, e);
    for (const p of this.players) this.drawUnit(ctx, p);

    // KO ghost-pops — the fallen sprite flares white and drifts skyward
    if (this.pops.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.pops) {
        const k = Math.max(p.t / p.life, 0);
        ctx.globalAlpha = k;
        drawMon(ctx, p.id, p.x, p.y - (1 - k) * 30, p.r * 2.6 * (1 + (1 - k) * 0.7));
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
      if (e.dead || !e.skull) continue;
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

    // particle fx — additive so stacked sparks bloom into real glow
    if (this.fx.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const f of this.fx) {
        const a = Math.max(f.t / f.life, 0);
        ctx.globalAlpha = a;
        if (f.shape === 'streak') {
          const s = Math.hypot(f.vx, f.vy);
          const nx = s > 1 ? f.vx / s : 1, ny = s > 1 ? f.vy / s : 0;
          const L = f.size * 4 * (0.4 + a);
          ctx.strokeStyle = f.color;
          ctx.lineWidth = Math.max(0.8, f.size * 0.55 * a);
          ctx.beginPath();
          ctx.moveTo(f.x - nx * L, f.y - ny * L);
          ctx.lineTo(f.x, f.y);
          ctx.stroke();
        } else if (f.shape === 'star') {
          const s = f.size * (0.5 + a * 0.9);
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.spin * (f.life - f.t));
          ctx.scale(s, s);
          ctx.fillStyle = f.color;
          if (STAR_28) ctx.fill(STAR_28);
          else {
            starPath(ctx, 0, 0, 1, 0.28);
            ctx.fill();
          }
          ctx.restore();
        } else if (f.shape === 'leaf') {
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.spin * (f.life - f.t) * 2);
          ctx.fillStyle = f.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, f.size * 1.7, f.size * 0.8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = f.color;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.size * (0.5 + a * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    for (const t of this.texts) {
      const life = (t.life ??= t.t); // first frame stamps the span
      const age = 1 - t.t / life; // 0 at birth → 1 at the fade
      // punch-in: a ~2× spawn snaps to rest with a slight undershoot
      const k = Math.min(age / 0.15, 1);
      const ease = 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;
      const pop = (t.big ? 2.3 : 1.9) * (1 - ease) + ease;
      ctx.globalAlpha = Math.min(t.t / 0.3, 1);
      ctx.font = font(16 * pop * (t.size ?? 1));
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = t.big ? 4 : 3;
      const dy = 52 * (1 - (1 - age) ** 3); // launch up fast, drift to a stop
      ctx.save();
      // a wall-hugging mon's banner must not spill off-canvas — shrink
      // oversized callouts, then clamp the anchor inside the playfield.
      // w is measured once at push (pop=1 font); it scales linearly with pop
      let half = t.w !== undefined ? (t.w * pop) / 2 : ctx.measureText(t.text).width / 2;
      let tx = t.x;
      if (half * 2 > W_CANVAS_FALLBACK - 16) {
        if (t.ff !== undefined) {
          ctx.font = t.ff; // too wide to ever fit — the fitted font was cached at push
          half = t.fw! / 2;
        } else {
          // only overflows mid punch-in — rare enough to measure on the spot
          fitFont(ctx, t.text, 16 * pop * (t.size ?? 1), W_CANVAS_FALLBACK - 16);
          half = ctx.measureText(t.text).width / 2;
        }
        tx = W_CANVAS_FALLBACK / 2;
      } else {
        tx = Math.min(Math.max(t.x, half + 8), W_CANVAS_FALLBACK - half - 8);
      }
      ctx.translate(tx, t.y - dy);
      ctx.rotate(t.tilt ?? 0);
      ctx.strokeText(t.text, 0, 0);
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

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
      ctx.strokeText(this.comboLabel, this.arena.x + this.arena.w / 2, this.arena.y - 18);
      ctx.fillText(this.comboLabel, this.arena.x + this.arena.w / 2, this.arena.y - 18);
      // the shot's running damage tally rides under the meter — MS shows it
      // accumulating mid-flight; small and muted so it supports, not headlines
      if (this.shotDmg > 0) {
        if (this.dmgLabelN !== this.shotDmg) {
          this.dmgLabelN = this.shotDmg;
          this.dmgLabel = `DMG ${this.shotDmg}`;
        }
        ctx.font = font(10);
        ctx.fillStyle = '#8890b8';
        ctx.lineWidth = 3;
        ctx.strokeText(this.dmgLabel, this.arena.x + this.arena.w / 2, this.arena.y - 5);
        ctx.fillText(this.dmgLabel, this.arena.x + this.arena.w / 2, this.arena.y - 5);
      }
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
      ctx.font = fontB(9);
      ctx.lineWidth = 3;
      ctx.strokeText('MAP-WIDE — EVERY FOE TAKES THE HIT', 270, cy + 26);
      ctx.fillStyle = '#e8ecf8';
      ctx.fillText('MAP-WIDE — EVERY FOE TAKES THE HIT', 270, cy + 26);
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

    // foes remaining, top-right — the wave's progress bar. It rides a dark
    // chip under the canopy line: at rim level the trees overhang it, and
    // pale text on treeline green was unreadable
    let left = 0;
    for (const e of this.enemies) if (!e.dead) left++;
    if ((this.phase === 'aim' || this.phase === 'shot' || this.phase === 'enemy') && left > 0) {
      const tag = `${left} LEFT`;
      ctx.font = font(9);
      const tw = ctx.measureText(tag).width + 16;
      uiWindow(ctx, { x: a.x + a.w - 10 - tw, y: a.y + 48, w: tw, h: 18 }, { dark: true, shadow: false, rad: 6 });
      ctx.textAlign = 'center';
      ctx.fillStyle = '#aab4d8';
      ctx.fillText(tag, a.x + a.w - 10 - tw / 2, a.y + 61);
    }
    // pause chip, opposite corner — a quiet brake during the action and the
    // loot lap; the phase list mirrors the pointerDown hit-test
    if (this.phase === 'aim' || this.phase === 'shot' || this.phase === 'enemy' || this.phase === 'loot') {
      const c = this.pauseChip();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#101430';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#8890b8';
      ctx.fillRect(c.x + c.w / 2 - 5, c.y + c.h / 2 - 7, 4, 14);
      ctx.fillRect(c.x + c.w / 2 + 2, c.y + c.h / 2 - 7, 4, 14);
      // fast-forward chip, right of pause — lit gold while ×2 is armed
      const f = { x: c.x + c.w + 4, y: c.y, w: c.w, h: c.h };
      ctx.globalAlpha = this.ff ? 0.9 : 0.6;
      ctx.fillStyle = '#101430';
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2, f.y + f.h / 2, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.ff ? '#ffd84d' : '#8890b8';
      const fx = f.x + f.w / 2, fy = f.y + f.h / 2;
      for (const dx of [-7, 0]) {
        ctx.beginPath();
        ctx.moveTo(fx + dx, fy - 6);
        ctx.lineTo(fx + dx + 7, fy);
        ctx.lineTo(fx + dx, fy + 6);
        ctx.closePath();
        ctx.fill();
      }
    }

    // boss nameplate — the gym fight reads as a real boss encounter
    // (sits below the timing-bar zone so it never overlaps the aim meter)
    const boss = this.enemies.find((e) => e.boss && !e.dead);
    if (boss) {
      const bw = 240, bx = 270 - bw / 2, by = a.y + 40;
      const pct = Math.max(boss.hp / boss.maxHp, 0);
      ctx.textAlign = 'center';
      ctx.font = font(9);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(boss.def.name.toUpperCase(), 270, by - 1);
      ctx.fillStyle = '#f0b02f';
      ctx.fillText(boss.def.name.toUpperCase(), 270, by - 1);
      // held item on the nameplate — the quirk you're about to fight around
      if (boss.relic) {
        const ri = itemSprite(boss.relic);
        if (ri) {
          const w = ctx.measureText(boss.def.name.toUpperCase()).width;
          ctx.drawImage(ri, 270 + w / 2 + 5, by - 10, 14, 14);
        }
      }
      ctx.fillStyle = '#000a';
      ctx.fillRect(bx, by + 5, bw, 7);
      ctx.fillStyle = pct > 0.5 ? '#f0b02f' : pct > 0.25 ? '#f08030' : '#ff6b6b';
      ctx.fillRect(bx, by + 5, bw * pct, 7);
      ctx.strokeStyle = '#f0b02f';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by + 5, bw, 7);
    }

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
      ctx.fillText(this.lootDrag ? 'SCOOP THEM UP!' : 'drag your mon through the coins!', 270, a.y + a.h - 14);
      ctx.globalAlpha = 1;
    }

    // ascension tag — the heat marker only; the ladder on CLIMB names the
    // stacked mods, a marquee of them here just fought the scenery. Same
    // chip-under-canopy treatment as N LEFT
    if (this.asc > 0) {
      const tag = `ASC ${this.asc}`;
      ctx.font = fontB(9);
      const tw = ctx.measureText(tag).width + 16;
      uiWindow(ctx, { x: a.x + 10, y: a.y + 48, w: tw, h: 18 }, { dark: true, shadow: false, rad: 6 });
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f0b02f';
      ctx.fillText(tag, a.x + 10 + tw / 2, a.y + 61);
    }

    // team-trait ribbon — the build-around payoff reads at a glance: a
    // type-colored pip per active trait, tier numeral riding it
    const liveTraits = [...this.traits.entries()].sort((x, y) => y[1] - x[1]);
    if (liveTraits.length) {
      const ty = a.y + 48 + (this.asc > 0 ? 22 : 0);
      const tw2 = liveTraits.length * 24 + 8;
      uiWindow(ctx, { x: a.x + 10, y: ty, w: tw2, h: 18 }, { dark: true, shadow: false, rad: 6 });
      ctx.font = fontB(8);
      ctx.textAlign = 'center';
      liveTraits.forEach(([t, tier], i) => {
        const cx = a.x + 10 + 14 + i * 24;
        ctx.fillStyle = TYPE_COLOR[t];
        ctx.beginPath();
        ctx.arc(cx - 5, ty + 9, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(`${tier}`, cx + 6, ty + 12);
      });
    }

    // tapped-foe scout card — floats while aiming, a pull dismisses it
    if (this.inspect && this.phase === 'aim') this.drawInspect(ctx);

    // onboarding: the first run gets kinetic coaching (a ghost pull on
    // loop); after that the same two faint captions show on any run
    if (this.phase === 'aim' && !this.dragging && !this.active.dead) {
      if (this.coach) this.drawCoach(ctx);
      else if (this.shots < 2) {
        ctx.globalAlpha = 0.55 + Math.sin(this.time * 4) * 0.3;
        ctx.font = fontB(9);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e8ecff';
        ctx.fillText(
          this.shots === 0
            ? 'pull back to aim, release in the gold'
            : 'bounce through allies to fire their supers',
          a.x + a.w / 2,
          a.y + a.h - 16,
        );
        ctx.globalAlpha = 1;
      }
    }

    // the arrival tell — a gold ! pops at arena top as control lands
    const intro = this.time - this.waveIntroT;
    if (this.phase === 'aim' && intro < 0.6) {
      ctx.globalAlpha = Math.min(1, (0.6 - intro) * 5);
      ctx.font = font(Math.round(24 * (1 + Math.sin(intro * 16) * 0.15)));
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd76a';
      ctx.fillText('!', a.x + a.w / 2, a.y + 56);
      ctx.globalAlpha = 1;
    }

    if (this.waveBanner > 0) {
      const pop = Math.min(this.waveBanner, 1);
      const scaleIn = 1 + Math.max(0, this.waveBanner - 1.1) * 2.4;
      const cy = a.y + a.h / 2;
      const gym = this.enemies.find((e) => e.boss);
      const label = this.waveSpecial ?? (gym
        ? `GYM LEADER ${gym.def.name.toUpperCase()}`
        : `STAGE ${this.waveIndex + 1} / ${TOTAL_STAGES}`);
      ctx.globalAlpha = pop;
      // hanging ribbon, conquest-style
      ctx.fillStyle = '#101430ee';
      ctx.fillRect(0, cy - 34, W_CANVAS_FALLBACK, 68);
      ctx.strokeStyle = '#c8a44d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, cy - 34);
      ctx.lineTo(W_CANVAS_FALLBACK, cy - 34);
      ctx.moveTo(0, cy + 34);
      ctx.lineTo(W_CANVAS_FALLBACK, cy + 34);
      ctx.stroke();
      // shrink-to-fit: long specials would overflow the strip — size the
      // fit against the popped scale too, or the pop clips at spawn.
      // a gym label also leaves room for the leader portrait at each end
      const npcMargin = gym && this.waveHadGym && !this.waveSpecial ? 170 : 0;
      ctx.font = `bold 34px Georgia, serif`;
      const fit = Math.min(1, (W_CANVAS_FALLBACK - 48 - npcMargin) / (ctx.measureText(label).width * scaleIn));
      ctx.font = `bold ${Math.round(34 * scaleIn * fit)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f0e6c8';
      ctx.fillText(label, a.x + a.w / 2, cy + 12);
      // the sky calls itself out in the ribbon — weather tilts the matchup
      if (this.weather) {
        ctx.font = font(9);
        ctx.fillStyle = WEATHER_TINT[this.weather];
        ctx.fillText(WEATHER_LINE[this.weather], a.x + a.w / 2, cy - 12);
      }
      // boss weak points are the gym's whole trick — say it on the banner
      if (gym) {
        ctx.font = font(9);
        ctx.fillStyle = '#ffd84d';
        ctx.fillText('HIT THE GOLD SPOT FOR ×3 DAMAGE', a.x + a.w / 2, cy + 52);
        // the leader's face flanks its name — only when the gym label is
        // up (a shiny or special announcement keeps the whole ribbon)
        if (this.waveHadGym && !this.waveSpecial) {
          const npc = LEADER_NPC[gym.def.type];
          drawNpc(ctx, npc, a.x + 44, cy + 34, 62);
          drawNpc(ctx, npc, a.x + a.w - 44, cy + 34, 62);
        }
      }
      ctx.globalAlpha = 1;
    }

    // the freeze frame — drawn dead last so nothing paints over it; a tap
    // anywhere thaws (pointerDown drops it before any other handling)
    if (this.paused) {
      ctx.fillStyle = 'rgba(4,6,16,0.6)';
      ctx.fillRect(0, 0, W_CANVAS_FALLBACK, 2000);
      ctx.textAlign = 'center';
      ctx.font = font(24);
      ctx.fillStyle = '#f0e6c8';
      ctx.fillText('PAUSED', 270, 460);
      ctx.font = font(10);
      ctx.globalAlpha = 0.6 + Math.sin(this.time * 4) * 0.25;
      ctx.fillStyle = '#8890b8';
      ctx.fillText('tap anywhere to resume', 270, 492);
      ctx.globalAlpha = 1;
      // the way out — same pill idiom as the other modal buttons; main.ts
      // hit-tests both rects before the freeze's any-tap thaw
      pill(ctx, PAUSE_SETTINGS, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'SETTINGS' });
      pill(ctx, PAUSE_QUIT, { c: '#e8ecf8', cd: '#aab0c8', tc: '#2a2440', label: 'QUIT TO TITLE' });
    }
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
      e.def.fuse && 'detonates at zero — blast hits everything',
      e.def.hunter && 'hunts your weakest mon',
      e.def.leech && 'heals off every hit it lands',
      e.def.drowsy && 'its hits can put a mon to sleep',
      e.def.venom && 'its sting leaves a bleeding wound',
      e.def.burn && 'its hits can burn — singes and softens',
      e.def.para && 'its hits can paralyze — launches limp',
      e.def.toxic && 'contact can poison the ball',
      e.def.shock && 'contact can paralyze the ball',
      e.def.flame && 'contact can burn the ball',
      e.def.menace && 'intimidates — your hits lose a fifth while it lives',
      e.def.wguard && 'wonder guard — only super-effective hits land',
      e.def.sturdy && 'sturdy — hangs on at 1 HP once',
      e.def.charm && 'cute charm — contact can lull the ball to sleep',
      e.def.scale && 'multiscale — half damage while its hide is whole',
      e.def.guts && 'guts — hits 50% harder while statused',
      e.def.absorb && `${e.def.absorb} hits heal it — absorb`,
      e.def.truant && 'truant — loiters a round after each attack',
      e.def.boost && 'speed boost — re-arms faster every attack',
      e.def.spore && 'effect spore — contact scatters a random ailment',
      e.def.sync && 'synchronize — contact echoes its ailments to you',
      e.def.pressure && 'pressure — supers charge at half speed while it lives',
      e.def.beam && 'signal beam — locks a lane, then burns the channel',
      e.def.trap && 'arena trap — the ball can\'t flee its neighborhood',
      e.def.skyFor && `summons ${e.def.skyFor} — its sky rides the whole wave`,
      e.def.counter && 'counter — returns a third of contact damage',
      e.def.alpha && 'pack leader — rallies packmates\' hits while it lives',
      e.def.shed && 'shed skin — may slough off every ailment each tick',
      e.def.charge && 'stampede — paws the ground, then rams across the court',
      e.def.prank && 'prankster — its opening attack comes early',
      e.def.pheal && 'poison heal — your venom mends it; burn it instead',
      e.def.blink && 'teleports when it shimmers',
      e.def.thief && 'snatches pickups — KO it to take them back',
      e.def.lay && 'lays spikes in your half — kill it before the court fills',
      e.def.confuse && 'supersonic — contact rattles your next aim',
      e.def.anchor && 'too heavy to shove — banks and blasts leave it planted',
      e.def.flank && 'flanks the pack — it drifts wide before it closes',
      e.def.forecast && 'forecast — its type wears the sky',
      e.def.healBlock && 'heal block — your team can\'t mend while it lives',
      e.def.shielded && 'shell glances hits — flank pays',
      e.def.spiky && 'bites the ball on contact',
      e.def.regen && 'mends over time',
      e.def.split && 'divides when KO\'d',
      e.def.rage && 'enrages when wounded',
      e.def.sleepy && 'dozes — the wake-up hit lands big',
      (e.def.repel || e.repelR) && 'repels the ball',
      e.def.raider && 'steals field drops',
      e.def.taunt && 'blocks hits on its allies',
      e.def.cursed && 'its KO taxes your supers',
    ].filter(Boolean) as string[]) : [];
    const a = this.arena;
    const w = 200; // dual-type tags need the room a 176 card never had
    const h = foe ? 76 + (tells.length > 1 ? 10 : 0) : 100; // teammates get two lines for what the super does
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
    ctx.font = fontB(8);
    const typeW = ctx.measureText(typeStr).width;
    ctx.fillStyle = TYPE_COLOR[e.def.type];
    ctx.textAlign = 'right';
    ctx.fillText(typeStr, cx + w - 10, cy + 16);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f0e6c8';
    let nameStr = `${e.shiny ? '★ ' : ''}${e.def.name.toUpperCase()}  LV${e.lvl}`;
    // the LV drops before the name eats the type tag — fitFont floors at 6px
    if (fitFont(ctx, nameStr, 9, w - 60 - typeW - 8) <= 6 && ctx.measureText(nameStr).width > w - 60 - typeW - 8) {
      nameStr = `${e.shiny ? '★ ' : ''}${e.def.name.toUpperCase()}`;
      fitFont(ctx, nameStr, 9, w - 60 - typeW - 8);
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
    ctx.font = fontB(9);
    ctx.fillStyle = '#e8ecf8';
    ctx.fillText(`${Math.ceil(e.hp)}/${e.maxHp}`, cx + 50, cy + 42);
    // the readout — foes show their attack clock; teammates show their super
    ctx.textAlign = 'left';
    ctx.font = fontB(8);
    if (foe) {
      ctx.fillStyle = e.timer <= 1 ? '#ff6b6b' : '#e8ecf8';
      const tag = e.boss
        ? `ATTACKS IN ${Math.ceil(e.timer)} · GOLD SPOT ×3`
        : e.supp === 'medic'
          ? `ATTACKS IN ${Math.ceil(e.timer)} · HEALS ALLIES`
          : e.supp === 'aegis'
            ? `ATTACKS IN ${Math.ceil(e.timer)} · SHIELDS ALLIES`
            : e.volatile
              ? `ATTACKS IN ${Math.ceil(e.timer)} · EXPLODES ON KO`
              : e.link
                ? `ATTACKS IN ${Math.ceil(e.timer)} · RISES UNLESS PAIRED`
                : `ATTACKS IN ${Math.ceil(e.timer)}`;
      fitFont(ctx, tag, 8, w - 60);
      ctx.fillText(tag, cx + 50, cy + 58);
      ctx.fillStyle = '#8890b8';
      const line0 = tells.length ? tells[0] : 'fires a projectile';
      fitFontB(ctx, line0, 7, w - 60);
      ctx.fillText(line0, cx + 50, cy + 70);
      if (tells.length > 1) {
        fitFontB(ctx, tells[1], 7, w - 60);
        ctx.fillText(tells[1], cx + 50, cy + 80);
      }
    } else {
      ctx.fillStyle = '#ffd84d';
      ctx.fillText(`★ ${moveOf(e.def.id, e.def.type)}`, cx + 50, cy + 58);
      ctx.fillStyle = e.cd <= 0 ? '#6fdc6f' : '#8890b8';
      const ready = e.cd <= 0 ? `super ready — launch ${e.def.name} to fire it` : `super ready in ${e.cd} shot${e.cd === 1 ? '' : 's'}`;
      fitFont(ctx, ready, 7, w - 60);
      ctx.fillText(ready, cx + 50, cy + 70);
      ctx.fillStyle = '#6a7498';
      wrap2(ctx, superDesc(e.def.id, e.def.type), w - 60).forEach((l, li) =>
        ctx.fillText(l, cx + 50, cy + 80 + li * 9));
    }
    ctx.restore();
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
      ctx.fillStyle = color;
      ctx.fillText(s, a.x + a.w / 2, a.y + a.h - 16);
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
      line('PULL BACK TO AIM · LET GO IN THE GOLD');
    } else if (this.shots === 1) {
      const ally = this.players.find((p) => p !== u && !p.dead);
      if (ally) {
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
        line('FLY THROUGH A TEAMMATE — THEY FIRE THEIR SUPER');
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
        line('PIPS ALL GOLD — THIS LAUNCH FIRES THE SUPER');
      } else if (this.balls.length) {
        const b = this.balls[0];
        glow(b.x, b.y, 22, '#e8ecf8');
        line('A BALL DROPPED — IF IT CLICKS SHUT, THE CATCH IS YOURS');
      } else if (this.pickups.length) {
        const pk = this.pickups[0];
        glow(pk.x, pk.y, 18);
        line('FLY THROUGH THE GLOWING ITEM — THE PICKUP IS YOURS');
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
      ctx.font = font(9);
      ctx.fillStyle = '#ffb0b0';
      ctx.fillText('STRIKES AT 0', threat.x, threat.y - threat.r - 20);
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
    const links = this.region.nodes[this.mapNode].links;
    // waypoint dots march along each open link — the affordance that
    // says "these are the stops you can pick"
    const cur0 = this.region.nodes[this.mapNode];
    if (this.pendingNext > this.waveIndex && !this.mapWalk) {
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
      const cleared = n.row < this.pendingNext;
      const reachable = links.includes(i);
      const current = i === this.mapNode;
      if (n.kind === 'chest') {
        const ball = itemSprite('poke-ball');
        if (ball) ctx.drawImage(ball, nx - 15, ny - 24, 30, 30);
      } else if (n.kind === 'trainer' || n.kind === 'elite') {
        // the class's overworld sprite stands on the stop — elites get the
        // ace trainer, the colored ring is still the squad's type
        const frame = n.kind === 'elite' ? 'ace_trainer_down_0' : TRAINER_CLASS[n.ttype ?? 'normal'].frame;
        drawNpc(ctx, frame, nx, ny + cell * 0.5, cell * 1.7);
      } else if (n.kind === 'wild') {
        // a flower patch = tall grass — something wild is rustling there
        drawTile(ctx, MT.TILE_FLOWER, nx - cell * 0.6, ny - cell * 0.6, cell * 1.2, cell * 1.2);
      } else if (n.kind === 'event') {
        // the ? stop — a glinting diamond since the tileset has no sign tile
        ctx.save();
        ctx.translate(nx, ny - 6);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#ffd84d';
        ctx.fillRect(-9, -9, 18, 18);
        ctx.restore();
        ctx.font = font(16);
        ctx.fillStyle = '#2a3560';
        // diamond center is ny - 6; the '?' glyph rides ~0.9em over baseline
        ctx.fillText('?', nx + 3, ny + 8);
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
          if (potion) ctx.drawImage(potion, nx - 10, ny - cell * 2, 20, 20);
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
      if (cleared) {
        ctx.font = font(12);
        ctx.fillStyle = '#6fdc6f';
        ctx.fillText('✓', nx, ny + 4);
      }
    });
    // labels in a second pass so buildings can't paint over a neighbor's name
    this.region.nodes.forEach((n, i) => {
      if (n.row < this.pendingNext || n.ty - cam < -2.4 || n.ty - cam > view + 1) return;
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
        : n.kind === 'start' ? 'HOME'
        : 'WILD';
      ctx.strokeText(label, nx, ny - cell * 1.55);
      ctx.fillStyle = reachable
        ? (n.kind === 'elite' ? '#c8b0ff' : n.kind === 'trainer' ? '#ff8a8a' : '#ffd84d')
        : current ? '#6fdc6f' : '#8a94b8';
      ctx.fillText(label, nx, ny - cell * 1.55);
      // trainer squads are mono-type — name it so routing around a bad
      // matchup is a choice, not a coin flip; gyms sign their leader's
      // type the same way
      if (n.kind === 'trainer' || n.kind === 'elite' || n.kind === 'gym') {
        const ty = (n.ttype ?? 'normal').toUpperCase();
        ctx.font = font(8);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(ty, nx, ny - cell * 1.55 + 12);
        ctx.fillStyle = TYPE_COLOR[n.ttype ?? 'normal'];
        ctx.fillText(ty, nx, ny - cell * 1.55 + 12);
      }
    });
    // the trainer draws last — she walks in front of the stops, and at
    // HOME she stands on the cottage's doorstep instead of its roof
    if (at) {
      const bob = this.mapWalk ? 0 : Math.sin(this.time * 4) * 1.5;
      drawNpc(ctx, frame, ox + lx * cell + cell / 2, oy + (ly - cam) * cell + cell * 0.55 + bob, cell * 1.7);
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
    // rows are dead space (taps only ever reach linked stops)
    if (this.fieldLog.length) {
      const lx = ox - 4, ly = oy + view * cell - 52, lw = MAP_W * cell + 8;
      ctx.fillStyle = 'rgba(10,14,28,0.78)';
      ctx.fillRect(lx, ly, lw, 48);
      ctx.strokeStyle = '#2a3560';
      ctx.lineWidth = 2;
      ctx.strokeRect(lx + 1, ly + 1, lw - 2, 46);
      ctx.textAlign = 'left';
      ctx.font = fontB(7);
      ctx.fillStyle = '#ffd84d';
      ctx.fillText('FIELD LOG', lx + 10, ly + 10);
      ctx.font = fontB(8);
      const tail = this.fieldLog.slice(-3);
      tail.forEach((line, i) => {
        ctx.globalAlpha = i === tail.length - 1 ? 1 : i === tail.length - 2 ? 0.6 : 0.35;
        ctx.fillStyle = '#e8ecf8';
        // a runaway note used to ink past the dock's right edge — cap it
        let t2 = line;
        while (t2.length > 3 && ctx.measureText(t2 + '…').width > lw - 20) t2 = t2.slice(0, -1);
        if (t2 !== line) t2 += '…';
        ctx.fillText(t2, lx + 10, ly + 22 + i * 11);
      });
      ctx.globalAlpha = 1;
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

    ctx.font = font(9);
    ctx.fillStyle = '#aab4d8';
    ctx.fillText('choose your route: tap a linked stop', 270, oy + view * cell + 30);
    ctx.font = fontB(9);
    ctx.fillStyle = '#8890b8';
    ctx.fillText('WILD catchable fight · TRAINER mono-type squad — no catches, better loot', 270, oy + view * cell + 48);
    ctx.fillText('CHEST item, then a fight · REST heal+revive · ??? surprise · ELITE rare loot · GYM boss', 270, oy + view * cell + 64);
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
    // active type traits sit above the map — the build the team is running
    if (this.traits.size) {
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
    if (this.eventBox) {
      ctx.fillStyle = 'rgba(4,6,16,0.55)';
      ctx.fillRect(0, 0, 540, 960);
      this.drawEventCard(ctx, this.eventBox.art, this.eventBox.note, null);
    }
    if (this.eventChoice) {
      ctx.fillStyle = 'rgba(4,6,16,0.55)';
      ctx.fillRect(0, 0, 540, 960);
      this.drawEventCard(ctx, this.eventChoice.art, this.eventChoice.prompt, this.eventChoice.options);
    }
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
          fitFont(ctx, o.label, 10, r.w - 50 - 64);
          ctx.textAlign = 'left';
          ctx.fillStyle = afford ? '#f0e6c8' : '#6a7090';
          ctx.fillText(o.label, lx, ty);
          ctx.font = font(9);
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
    const modWash = mod === 'slick' || mod === 'hexed' || mod === 'tailwind' || mod === 'headwind';
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
      ctx.fillStyle = mod === 'hexed' ? '#a040a0' : mod === 'slick' ? '#9dd8f0' : '#b8e8c0';
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
      if (w === 'rain') {
        const y = a.y + ((h1 * a.h + t * 640 + i * 37) % a.h);
        const x = a.x + h2 * a.w;
        ctx.strokeStyle = '#9dc0ff';
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
    ctx.restore();
  }

  // Hazard zones read as overworld props — a gracidea slice squashed to
  // the zone's footprint (vent, grass tufts, ponds, rocks, cave mouth)
  // with the animated cue that sells what it does. The tinted pad keeps
  // the radius readable while the atlas streams in. Mines are Voltorb.
  private drawHazard(ctx: CanvasRenderingContext2D, hz: Hazard) {
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
      // molten pool — no atlas tile, the two-tone pulse reads as lava
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
    } else if (hz.kind === 'well') {
      // whirlpool: arcs spiral inward over the deep pool
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#7ab8ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = this.time * 2 + i * (TAU / 3);
        const rr = hz.r * (0.35 + ((this.time * 0.5 + i / 3) % 1) * 0.65);
        ctx.beginPath();
        ctx.arc(hz.x, hz.y, rr, a, a + 2.2);
        ctx.stroke();
      }
      ctx.fillStyle = '#7ab8ff';
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.r * 0.1, 0, TAU);
      ctx.fill();
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
  private drawTelegraph(ctx: CanvasRenderingContext2D, e: Unit) {
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
        break;
      default: { // ring/blast attacks — show the radius they'll sweep
        ctx.lineWidth = 3;
        const R = { 130: 300, 3: 220, 112: 240, 6: 200 }[e.def.id] ?? 170;
        ctx.beginPath();
        ctx.arc(e.x, e.y, R, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Non-boss "about to strike" tell: a dashed leash to the mon it'll hit.
  private drawFoeTell(ctx: CanvasRenderingContext2D, e: Unit) {
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
  }

  private drawUnit(ctx: CanvasRenderingContext2D, u: Unit) {
    if (u.dead) return;
    // boss telegraph: one turn out, the signature's footprint ghosts in;
    // fodder gets a dashed leash to its target so the zap isn't a surprise
    if (u.side === 'enemy' && u.timer <= 1) {
      if (u.boss) this.drawTelegraph(ctx, u);
      else this.drawFoeTell(ctx, u);
    }
    // soft shadow grounds the sprite on the court
    ctx.fillStyle = 'rgba(8,10,20,0.3)';
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + u.r * 0.72, u.r * 0.82, u.r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
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
        ctx.strokeStyle = '#9df0ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.r * 1.3, 0, Math.PI * 2);
        ctx.stroke();
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
      // boss weak point: a drifting gold star on the rim — contact on that
      // face pays triple. MS's core precision tell.
      if (u.boss && !u.dead) {
        const wx = u.x + Math.cos(u.weakA) * u.r * 0.92;
        const wy = u.y + Math.sin(u.weakA) * u.r * 0.92;
        const s = 7 + Math.sin(this.time * 6) * 2;
        ctx.fillStyle = '#ffd84d';
        ctx.strokeStyle = '#000';
        drawStar(ctx, wx, wy, s, 0.4, 2);
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
      const urgent = u.timer <= 1 || u.enraged;
      ctx.font = font(u.timer <= 1 ? 11 + Math.sin(this.time * 10) * 1.5 + 1.5 : 11);
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      const tag = u.asleep ? 'zZ' : u.boss ? `★${Math.ceil(u.timer)}` : `${Math.ceil(u.timer)}`;
      ctx.strokeText(tag, u.x + u.r - 2, u.y - u.r + 7);
      ctx.fillStyle = urgent ? '#ff6b6b' : u.timer <= 2 ? '#ffb84d' : '#fff';
      ctx.fillText(tag, u.x + u.r - 2, u.y - u.r + 7);
      // keyword flags — the counter-mechanics read at a glance
      // keyword flags — composite so a dual-trait foe never hides a mechanic
      const kws = [
        u.def.taunt && 'MAGNET',
        u.def.cursed && 'CURSE',
        u.def.shielded && 'SHELL',
        u.def.spiky && 'SPIKY',
        u.def.regen && 'REGEN',
        u.def.split && 'SPLIT',
        u.def.rage && 'RAGE',
        u.def.repel && 'REPEL',
        u.def.raider && 'RAIDER',
        u.def.volley && 'VOLLEY',
        u.def.summon && 'SOS',
        u.def.mirror && 'MIRROR',
        u.def.fuse && 'FUSE',
        u.def.hunter && 'HUNTER',
        u.def.leech && 'LEECH',
        u.def.drowsy && 'SLEEP',
        u.def.venom && 'STING',
        u.def.burn && 'WISP',
        u.def.para && 'JOLT',
        u.def.toxic && 'TOXIC',
        u.def.shock && 'STATIC',
        u.def.flame && 'FLAME',
        u.def.menace && 'MENACE',
        u.def.wguard && 'W-GUARD',
        u.def.sturdy && u.sash && 'STURDY',
        u.def.charm && 'CHARM',
        u.def.scale && u.hp >= u.maxHp && 'SCALE',
        u.def.guts && 'GUTS',
        u.def.absorb && `DRAIN:${u.def.absorb.toUpperCase().slice(0, 3)}`,
        u.def.truant && 'LOAF',
        u.def.boost && 'BOOST',
        u.def.spore && 'SPORE',
        u.def.sync && 'SYNC',
        u.def.pressure && 'PRESSURE',
        u.def.beam && 'BEAM',
        u.def.trap && 'TRAP',
        u.def.skyFor && 'SKY',
        u.def.counter && 'COUNTER',
        u.def.alpha && 'ALPHA',
        u.def.shed && 'SHED',
        u.def.charge && 'CHARGE',
        u.def.prank && 'PRANK',
        u.def.thief && 'THIEF',
        u.def.lay && 'SPIKER',
        u.def.confuse && 'SONIC',
        u.def.anchor && 'ANCHOR',
        u.def.flank && 'FLANK',
        u.def.forecast && 'FORECAST',
        u.def.healBlock && 'H-BLOCK',
        u.def.pheal && 'P-HEAL',
        u.def.blink && 'BLINK',
        u.dotTicks > 0 && 'VENOM',
      ].filter(Boolean) as string[];
      // cap the ribbon at three — a stacked vet would spill off the unit,
      // and the scout card already lists every flag it carries
      const kw = kws.length > 3 ? `${kws.slice(0, 3).join('·')}+${kws.length - 3}` : kws.join('·');
      if (kw) {
        ctx.font = font(8);
        ctx.strokeText(kw, u.x, u.y + u.r + 14);
        ctx.fillStyle = u.def.taunt ? '#ffd84d' : u.def.cursed ? '#a868c8' : u.def.regen || u.def.split ? '#a0e060' : u.def.shielded ? '#9aa7b8' : '#f85888';
        ctx.fillText(kw, u.x, u.y + u.r + 14);
      }
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
      if (u.cd <= 0) {
        // ready: the move's name sits overhead — this is the thing to hit
        const label = moveOf(u.def.id, u.def.type);
        const ly = u.y + u.r + 30;
        ctx.font = fontB(8);
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
        ctx.font = font(9);
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
        ctx.font = font(7);
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        // an armed ult marks its own mon — second tap on it fires
        const armed = this.ultArmUid === u.uid && this.time - this.ultArmT < 2;
        ctx.strokeText(armed ? 'ULT — AGAIN!' : 'ULT — TAP!', u.x, u.y - u.r - 52);
        ctx.fillStyle = armed ? '#ff9d4d' : '#ffe76a';
        ctx.fillText(armed ? 'ULT — AGAIN!' : 'ULT — TAP!', u.x, u.y - u.r - 52);
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
    const P = (0.85 - 0.3 * this.gaugeDifficulty()) * (1 + this.gaugeJit * 0.2);
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
      const cache = this.aimCache;
      const sb: Ball = { x: 0, y: 0, r: u.r, vx: 0, vy: 0 };
      sim: for (let i = 0; i < 60; i++) {
        if (bounced) break;
        const step = 1 / 30;
        const onIce = this.hazards.some((hz) => hz.kind === 'ice' && Math.hypot(sx - hz.x, sy - hz.y) < hz.r + u.r);
        const damp = Math.exp(-FRICTION * this.frictionMult * (this.curMod === 'slick' ? 0.6 : 1) * (onIce ? 0.1 : 1) * step);
        svx *= damp;
        svy *= damp;
        // the same field forces live play applies — a ghost that ignores
        // gust lanes and drag patches promises banks the ball can't keep
        for (const hz of this.hazards) {
          if (Math.hypot(sx - hz.x, sy - hz.y) >= hz.r + u.r) continue;
          if (hz.kind === 'gust') svx += (hz.dir ?? 1) * 480 * step;
          else if (hz.kind === 'grass') { svx *= Math.exp(-8 * step); svy *= Math.exp(-8 * step); }
        }
        sx += svx * step;
        sy += svy * step;
        if (len({ x: svx, y: svy }) < 90) break;
        if (sx - u.r < a.x) { sx = a.x + u.r; svx = -svx * WALL_REST; bounced = true; }
        else if (sx + u.r > a.x + a.w) { sx = a.x + a.w - u.r; svx = -svx * WALL_REST; bounced = true; }
        if (sy - u.r < a.y) { sy = a.y + u.r; svy = -svy * WALL_REST; bounced = true; }
        else if (sy + u.r > a.y + a.h) { sy = a.y + a.h - u.r; svy = -svy * WALL_REST; bounced = true; }
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
        const eff = typeMult(at, hit.def) * weatherMult(this.weather, at);
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
        // weak read — contact inside the boss's ±0.62 rad gold face pays
        // triple (same cone test as strikeEnemy); a small star marks it
        if (hit.boss) {
          const wa = Math.atan2(hy - hit.y, hx - hit.x);
          let dd = Math.abs(wa - hit.weakA) % (Math.PI * 2);
          if (dd > Math.PI) dd = Math.PI * 2 - dd;
          if (dd < 0.62) {
            const s = 6;
            ctx.fillStyle = '#ffd84d';
            ctx.strokeStyle = '#000';
            drawStar(ctx, hx, hy, s, 0.4, 1.5);
          }
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
              ctx.font = font(8);
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


