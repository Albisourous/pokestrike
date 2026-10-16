import { Vec, len, dist, norm, vec } from '../core/vec';
import { drawMon, drawShiny, itemSprite, drawNpc } from '../core/assets';
import { sfx, buzz, cry, music } from '../core/audio';
import type { Sfx } from '../core/audio';
import { SpeciesDef, StageDef, WaveSpawn, rollWave, trainerWave, TRAINER_CLASS, TOTAL_STAGES, ROSTER, ELITES, EVOS, INVADERS, ENEMY_DB, hazardsFor, rivalWave, BLOCK_LAYOUTS, pickWild, bst } from './data';
import { Perk, rollPerks } from './perks';
import type { Rarity } from './perks';
import { rollEvent } from './events';
import type { EventChoice } from './events';
import { teamTraits } from './traits';
import { recordCapture, recordShiny, unlockAch, ACHIEVEMENTS, earnBadge, gymBadges, BADGES } from './meta';
import { drawBackdrop, drawWall, THEMES, hash } from './bg';
import type { Theme } from './bg';
import { typeMult, strikeType, TYPE_COLOR, weatherMult, WEATHER_LINE, WEATHER_TINT } from './types';
import { genRegion, RegionMap, MapNode, MAP_W, MAP_H, drawTile, routePath, T_WATER, T_SAND } from './map';
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
  bumpCooldown,
  roleOf,
  ROLE_MODS,
  moveOf,
  SUPER_DESC,
  LV_CAP,
  offStat,
  lvlPow,
  lvlHp,
} from './stats';
import type { Role } from './stats';
import { font, roundRect } from './screens';

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
  relic?: string; // held-item sprite name — gym bosses roll one quirk each
  sq: number; // squash impulse 0..1 — decays in update, flattens the sprite
  sumStage: number; // boss phase summons fired (0..2 — at 2/3 and 1/3 hp)
  atkN: number; // boss attack count — every 3rd is a teleport, not a blast
  weakA: number; // boss weak point angle — rotating gold face, ×3 contact
  minion?: boolean; // summoned add — while any live, the boss is guarded
  volatile?: boolean; // VOLATILE wave mod — a KO bursts, splashing neighbors
  supp?: 'medic' | 'aegis'; // support foe — heals or shields the pack on its turn
  link?: Unit; // zombie pair — falls while its partner lives → resurrects
  revives: number; // soul-link charges left — capped so a weak team can't hard-stall
  skull?: boolean; // skull-marked — the KO pays a bounty (MS skull icon)
  gravR: number; // gravity aura radius — the ball crawls inside the bubble
  shieldN: number; // aegis wards — each stack negates one incoming hit
  warpT: number; // last warp ride — cooldown stops portal ping-pong
  boostT: number; // last boost-pad kick — throttle so pads can't stack hits
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
  big: boolean;
  size?: number; // scale multiplier — damage numbers grow with the hit
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
  drain?: boolean; // the hit feeds the team — grass seed flares
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
  kind: 'lava' | 'grass' | 'gust' | 'spikes' | 'static' | 'mine' | 'warp' | 'boost' | 'well' | 'power';
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
}
interface ScreenFlash {
  t: number;
  life: number;
  color: string;
}
interface BallDrop {
  x: number;
  y: number;
  item: string; // poke-ball / master-ball sprite
  t: number;
  life: number;
}
// Field pickups — the MS heart/sword/hourglass channel. The ball collects
// one by touching it mid-shot.
type PickupKind = 'oran-berry' | 'protein' | 'elixir';
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
};
const HZ_PROP: Partial<Record<Hazard['kind'], MT.TileRect>> = {
  grass: [1715, 93, 78, 33], // tall-grass tufts
  static: [90, 268, 55, 42], // still pond — keywords go quiet inside
  warp: [292, 140, 40, 23], // cave mouth — enter here, exit the twin
  well: [7, 639, 47, 66], // framed pool — the water drags you in
  boost: MT.TILE_PATH, // dirt pad
  power: MT.TILE_PATH,
};

// theme → its sky: groves rain, caverns swirl sand, the volcano bakes
// under sun, the heights blow. ~Half of rolled courts get weather.
const WEATHER_FOR: Record<Theme, Weather> = { grove: 'rain', cavern: 'sand', volcano: 'sun', sky: 'wind' };

const STOP_SPEED = 55; // trims the dribble tail — shots carry ~1.5x energy now
const SHOT_MAX = 14; // seconds — gimmick courts can hold the ball above settle speed forever
const FINAL_DEPTH = TOTAL_STAGES - 3; // rolled stages: 4..9 are depths 1..6
const BASE_SHOT_SPEED = 285; // 1.5x launch — under exponential friction range scales with speed
const POWER = 8;
const WALL_REST = 0.96; // pinball court — walls hand back nearly everything
const UNIT_REST = 0.94; // meatier ricochets off bodies
const FRICTION = 1.7;
const HIT_COOLDOWN = 0.12;
const HEAL_CD = 5; // in-battle mends share this cooldown — one heal per few shots
const SUPER_POW = 0.7; // supers hit softer so clean lines carry the damage
const CONTACT_POW = 1.4; // direct hits are the bread and butter again
const ENEMY_TURN_DELAY = 0.6;
const ENEMY_BASE_TIMER = 3;
const MELEE_TIMER = 2; // melee mons have to close in — they attack sooner
const SHINY_RATE = 1 / 48; // ~2% of wild spawns roll the gold palette
const PICKUP_KINDS: PickupKind[] = ['oran-berry', 'protein', 'elixir'];
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

let nextUid = 1;

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
  weather: Weather | null = null; // this wave's sky — null is a clear court

  private dragging = false;
  private dragStart: Vec = vec();
  private dragNow: Vec = vec();
  private dragT = 0; // hold time while dragging — drives the timing meter
  private wasGold = false; // edge detector for the in-zone tick

  private stopTimer = 0;
  private shotT = 0; // launch timestamp — hard-caps a shot that never settles
  private enemyPhaseT = 0;
  private inspect: { uid: number; t: number } | null = null; // tapped-foe scout card
  // branching evolution: a dupe-fed split waits on the reward screen's pick —
  // unit for a fielded mon, boxDef for a boxed one (re-found at pick time so
  // a mid-queue box swap can't evolve the wrong entry)
  private evoPending: { from: SpeciesDef; options: SpeciesDef[]; unit?: Unit; boxDef?: SpeciesDef }[] = [];
  evoChoice: { from: SpeciesDef; options: SpeciesDef[]; unit?: Unit; boxDef?: SpeciesDef } | null = null;
  paused = false; // mid-fight freeze — the pause chip in the arena corner
  private pendingAttacks: Unit[] = [];
  private bumpsThisShot = new Set<number>(); // allies whose super fired this shot
  private bumpNoted = new Set<number>(); // allies already told "recharging" this shot
  private shotCombo = 0; // pass-through links chained this shot
  private kosThisShot = 0; // enemies downed by the current shot
  private aimCache = { sig: '', dots: [] as Vec[], hit: null as Unit | null, bounced: false, hx: 0, hy: 0 };
  private texts: FloatText[] = [];
  private orbs: Orb[] = [];
  private waves: Wave[] = [];
  private dashes: Dash[] = [];
  private delays: { t: number; fn: () => void }[] = []; // staggered super hits
  private flashes: ScreenFlash[] = [];
  private balls: BallDrop[] = []; // caught mons: ball drops in and wiggles
  private pickups: Pickup[] = []; // touch to collect while the ball flies
  private scars: Scar[] = []; // impact craters scarring the court
  private hazards: Hazard[] = []; // this wave's court gimmicks
  private beams: Beam[] = []; // boss hyper-beam afterglow
  private waveSpecial: string | null = null; // banner override (invade)
  private gustSounded = false; // wind whoosh once per entry
  private shotPhys = 1; // protein pickup: contact damage this shot
  private healCd = 0; // shots until another in-battle mend can land
  // engine state — per-shot keyword bookkeeping
  private volleys = 0; // ally bumps this shot (volleyNth counting)
  private shotVolleyBoost = 0; // volleyBoost accumulated this shot
  streak = 0; // consecutive perfect launches — shown in the HUD
  private shotStreak = 1; // this shot's streak damage bonus
  private shotGold = false; // gold-zone release — MS gauge shot: +20% contact this shot
  shinyRate = 1; // 2 with the Shiny Charm dex milestone
  scoreMult = 1; // lucky egg: score amplifies
  private lastContact = { t: -9, id: -1 }; // pinch window: last thing touched
  private shotHitN = new Map<number, number>(); // per-enemy hits this shot (decay)
  private waveHadGym = false; // scheduled boss wave — gymsBeaten accounting
  private inRival = false; // this wave is the rival echo fight
  private inTrainer = false; // this wave is a trainer squad — their mons can't be caught
  private region: RegionMap; // the climb's world map — drawn between stages
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
  takenMult = 1; // zinc/eviolite: incoming damage multiplier
  foeCdMult = 1; // bright powder: enemy attack-timer multiplier
  slowImmune = false; // air balloon perk flag — kept for perks.ts; no pads remain to slow the ball
  koHeal = 0; // exp share: heal team this fraction on each KO
  lifeDrain = 0; // life orb: team pays this fraction of maxHP per shot
  bossSlayer = 0; // power bracer: bonus damage vs bosses
  wallRamp = 0.08; // banking off walls pays a little contact damage per bounce — grip claw triples it
  // keyword relics — COMBO SHOT (two contacts in one window) / VOLLEY (ally bumps)
  pinchPip = 0; // pips granted to the launcher on each pinch
  pinchMult = 0; // extra contact damage on pinch hits
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
  // run stats for end-of-run badges — RNGdle-style "what did this run earn"
  score = 0; // run score — total damage dealt to enemies
  maxCombo = 0; // best pass-chain in a single shot
  maxKos = 0; // most enemies one shot downed
  totalKos = 0; // enemies downed all run
  caughtBoss = false;
  shiniesCaught = 0; // gold KOs this run — shiny KOs always land in the box
  perksTaken = 0;
  boxSel = -1; // box index picked for swapping
  depth = 0; // rolled stages survived past the opening trio
  rewardOffers: Perk[] = [];
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
  private splashing = false; // psychic trait re-entry guard
  private mapCam = -1; // island-row the viewport starts at — lerps toward mapCamTarget
  private mapMsg = ''; // toast line on the region map (resolved events, egg ticks)
  eventBox: string | null = null; // resolved ? event — modal FRLG text box, tap to close
  private eventChoice: { prompt: string; options: EventChoice[]; node: MapNode } | null = null; // ? that asks — row waits on the pick
  private choiceHit: { x: number; y: number; w: number; h: number }[] = []; // last-drawn option rects
  private mapMsgT = 0;
  // victory loot — a gym boss bursts into PokéCoins; drag the lead mon to
  // scoop them before the lap ends
  private lootCoins: { x: number; y: number; vx: number; vy: number; r: number; spin: number; kind: 'coin' | 'gem' | 'heart' | 'candy'; val: number }[] = [];
  private lootT = 0;
  private lootDrag = false;
  private lootPos: Vec | null = null;
  private lootChain = 0; // consecutive scoops — pitch climbs with the streak
  private lootChainT = -9; // last scoop — the chain decays after ~0.6s
  private lootGot = 0; // score scooped this fountain — tallied at the end
  private bossKilledAt: { x: number; y: number } | null = null; // coin fountain origin
  private trail: { x: number; y: number; t: number }[] = []; // speed smear — ghost positions of the flying ball
  private fx: Fx[] = []; // sparks, streaks and stars from every impact
  private pops: { x: number; y: number; id: number; r: number; t: number; life: number }[] = []; // KO ghost-outs — the sprite flashes skyward
  private punch = 0; // camera zoom-kick — big hits lunge the screen

  constructor(
    public arena: Rect,
    team: SpeciesDef[],
    public stage: StageDef,
    private rng: () => number = Math.random,
  ) {
    this.theme = stage.theme;
    const n = team.length;
    team.forEach((def, i) => {
      const role = roleOf(def.stats, def.healer);
      const m = ROLE_MODS[role];
      // draft picks roll lvl 5-14: same scaling curve as mid-run KOs
      const lvl = Math.max(1, Math.min(LV_CAP, def.lvl ?? 1));
      const hp = Math.round(playerHp(def.stats) * m.hp * lvlHp(def.stats.hp, lvl));
      // supers start at zero charge — each shot banks a turn toward firing
      const cd = Math.max(1, Math.round(bumpCooldown(def.type) * this.cdMult) - m.cdMod);
      this.players.push({
        uid: nextUid++,
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
        cd,
        cdMax: cd,
        lastBump: -1,
        role,
        sash: false,
        lvl,
        pow: m.pow * lvlPow(offStat(def.stats, def.type), lvl),
        rngMul: m.range,
        launch: m.launch,
        cdMod: m.cdMod,
        lastHit: new Map(),
        wallN: 0,
        hzT: -9,
        sq: 0,
        sumStage: 0,
        atkN: 0,
        weakA: 0,
        shieldN: 0,
        revives: 0,
        gravR: 0,
        warpT: -9,
        boostT: -9,
      });
    });
    this.region = genRegion(Math.floor(this.rng() * 2 ** 31));
    this.mapCam = this.mapCamTarget();
    // no staged wave: HOME (row -1) is just the starter pick — the first
    // fight is whichever stage-1 fork you walk to
    this.phase = 'map';
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
    this.eliteWave = elite;
    this.inEvent = false;
    this.waveShots = 0;
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
        this.stage.waves.push(rollWave(this.rng, this.depth, this.stage.theme));
      }
    } else {
      if (i >= this.stage.waves.length) {
        this.depth++;
        this.stage.waves.push(rollWave(this.rng, this.depth, this.stage.theme));
      }
      // elite doors field the same mono-type squad but one depth tier hotter
      spawns = ttype ? trainerWave(this.rng, this.depth + (elite ? 1 : 0), ttype) : this.stage.waves[i];
    }
    this.hardWave = this.inTrainer || this.inEvent;
    this.curSpawns = spawns;
    this.hpScale = 1 + this.depth * 0.25 + i * 0.12 + this.asc * 0.15; // wave 3 mobs are +24% tanky; ascension stacks on top
    // each wave is a new scene — rotate the flat theme; about half roll
    // weather, which tilts the type table until the wave ends
    const others = THEMES.filter((t) => t !== this.theme);
    this.theme = others[Math.floor(this.rng() * others.length)];
    this.weather = this.rng() < 0.5 ? WEATHER_FOR[this.theme] : null;
    // stale super timers mustn't carry hits into the fresh wave — orbs
    // included, or a flight of homers retargets onto the next pack
    this.delays = [];
    this.waves = [];
    this.dashes = [];
    this.orbs = [];
    // a legendary can crash any non-boss wave past the first — MS invades;
    // a dead run's team can return as a rival fight — fail-forward echo
    this.waveSpecial = null;
    this.waveHadGym = spawns.some((s) => s.boss) && !this.inEvent;
    this.inRival = false;
    if (ttype) {
      this.waveSpecial = elite
        ? `ACE TRAINER — RARE LOOT ON THE LINE!`
        : `${TRAINER_CLASS[ttype]?.title ?? 'TRAINER'} WANTS TO BATTLE!`;
      sfx('invade');
    } else if (!this.inEvent && this.echo?.length && i > 0 && !this.waveHadGym && this.rng() < 0.15) {
      spawns = this.curSpawns = rivalWave(this.echo.map((e) => e.def), this.rng);
      this.waveSpecial = 'RIVAL BATTLE — YOUR FALLEN TEAM RETURNS!';
      this.inRival = true;
      sfx('invade');
    } else if (!this.inEvent && i > 0 && !this.waveHadGym && this.rng() < 0.09 + this.rank * 0.03) {
      const inv = INVADERS[Math.floor(this.rng() * INVADERS.length)];
      spawns = [{ def: inv, nx: 0.5, ny: 0.3, boss: true }, ...spawns.slice(0, 2)];
      this.waveSpecial = `A WILD ${inv.name.toUpperCase()} APPEARED!`;
      sfx('invade');
    }
    this.curSpawns = spawns; // rival/invade overrides still feed the recruit roll
    if (!this.waveSpecial && this.mapNote) this.waveSpecial = this.mapNote;
    // Archero-style room furniture: seeded stone clusters the ball banks
    // off. Boss rooms stay open — the leader fight is the spectacle;
    // trainer battles are always furnished.
    const bossWave = spawns.some((s) => s.boss);
    let li = 0;
    if (!bossWave) {
      if (i === 0) li = Math.floor(this.rng() * 3); // gentle openers
      else if (this.inTrainer || this.rng() < 0.8) li = 1 + Math.floor(this.rng() * (BLOCK_LAYOUTS.length - 1));
    }
    this.blocks = BLOCK_LAYOUTS[li].map((b) => ({
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
    if (armed && (this.waveHadGym || this.inEvent)) this.armBoss(armed);
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
    if (i > 0 && !bossWave && !ttype && !this.inEvent && !this.inRival && this.rng() < 0.35) {
      const MODS = ['swarm', 'swarm', 'swarm', 'hasty', 'hasty', 'volatile', 'volatile', 'big', 'big', 'gold', 'cleric', 'aegis', 'zombie', 'zombie', 'skull', 'grav', 'power'];
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
      }
      const label = { swarm: 'SWARM!', hasty: 'HASTY FOES!', volatile: 'VOLATILE PACK!', big: 'A BIG ONE!', gold: 'SOMETHING SHINY GLINTS…', cleric: 'A CLERIC HIDES IN THE PACK!', aegis: 'A GUARDIAN WARDS THE PACK!', zombie: 'THEY WON\'T STAY DOWN!', skull: 'A MARKED FOE — BONUS ON KO!', grav: 'GRAVITY AURA!', power: 'POWER ZONE!' }[mod] ?? 'MUTATED!';
      this.waveSpecial = this.waveSpecial ? `${this.waveSpecial} · ${label}` : label;
    }
    // MS-style field pickups: one per wave, two where a boss or elite lurks
    this.pickups = [];
    this.scars = [];
    const npk = this.enemies.some((e) => e.boss || ELITE_IDS.has(e.def.id)) ? 2 : 1;
    for (let k = 0; k < npk; k++) {
      const at = this.unstick(
        this.arena.x + this.arena.w * (0.15 + this.rng() * 0.7),
        this.arena.y + this.arena.h * (0.2 + this.rng() * 0.45),
        16,
      );
      this.pickups.push({
        x: at.x,
        y: at.y,
        kind: PICKUP_KINDS[Math.floor(this.rng() * PICKUP_KINDS.length)],
        t: this.rng() * 6,
      });
    }
    // court gimmicks for this wave's theme — lava pools, tall grass,
    // wind bands, spike strips (normalized layout → arena px)
    this.hazards = hazardsFor(this.theme, this.rng).map((z) => ({
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
    this.waveBanner = 1.4;
    if (i > 0) {
      this.screenFlash('#ffffff', 0.25);
      sfx('wave');
    }
    const boss = this.enemies.find((e) => e.boss);
    if (boss) cry(boss.def.id, 0.5); // boss roars on entry
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
    const el = Math.min(LV_CAP, 5 + wi * 10 + (this.rng() < 0.35 ? 4 : 0) + (s.boss ? 8 : 0));
    const ehp = Math.round(
      (s.boss ? bossHp(s.def.stats) : enemyHp(s.def.stats)) * this.hpScale * lvlHp(s.def.stats.hp, el),
    );
    return {
      uid: nextUid++,
      def: s.def,
      side: 'enemy',
      x: at.x,
      y: at.y,
      vx: 0,
      vy: 0,
      r,
      hp: ehp,
      maxHp: ehp,
      timer: (s.def.melee ? MELEE_TIMER : ENEMY_BASE_TIMER) * this.foeCdMult * this.ascTimerMult() + (wi === 0 ? 1 : 0),
      drift: enemyDrift(s.def.stats) * (s.boss ? 0.55 : 1),
      wx: 0,
      wy: 0,
      wT: this.rng() * 0.8,
      wMul: 1,
      lunging: 0,
      boss: !!s.boss,
      // ASC 6+: gym leaders walk in furious — fast attack cycle from bell one
      enraged: !!s.boss && this.asc >= 6,
      // shinies: wild fodder rolls gold; your rival echo keeps the palette
      // it died with — including a shiny if you lost one. Trainer mons are
      // owned already: never shiny, never catchable.
      shiny: !s.boss && !this.inTrainer && (this.inRival ? !!s.def.shiny : this.rng() < SHINY_RATE * this.shinyRate),
      dead: false,
      dotTicks: 0,
      dotDmg: 0,
      cd: 0,
      cdMax: 1,
      lastBump: -1,
      role: 'wild',
      sash: false,
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
      shieldN: 0,
      revives: 0,
      gravR: 0,
      warpT: -9,
      boostT: -9,
    };
  }

  // Held-item quirk on a boss — pokelike's curated aces. Rolled on the
  // wave's seed so a daily climb always faces the same kit.
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
    // that corner gets caught under the chip and can't be pulled
    return { x: 14, y: 30, w: 30, h: 30 };
  }

  pointerDown(p: Vec) {
    if (this.paused) { // any tap unfreezes
      this.paused = false;
      sfx('ui');
      return;
    }
    if (this.phase === 'aim' || this.phase === 'shot' || this.phase === 'enemy') {
      const c = this.pauseChip();
      if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) {
        this.paused = true;
        this.dragging = false; // a frozen game shouldn't hold a half-pull
        sfx('ui');
        return;
      }
    }
    if (this.phase === 'loot') { // grab the leash — drag your mon through the coins
      this.lootDrag = true;
      this.lootPos = { ...p };
      return;
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
  }

  pointerUp() {
    if (this.lootDrag) {
      this.lootDrag = false;
      this.lootPos = null;
    }
    if (!this.dragging) return;
    this.dragging = false;
    const pull = { x: this.dragStart.x - this.dragNow.x, y: this.dragStart.y - this.dragNow.y };
    const pullLen = len(pull);
    if (pullLen < 12) {
      // a tap, not a pull — on a mon it pops a scout card instead of a shot
      const hit = [...this.enemies, ...this.players].find(
        (e) => !e.dead && Math.hypot(e.x - this.dragStart.x, e.y - this.dragStart.y) < e.r + 14,
      );
      if (hit) {
        this.inspect = { uid: hit.uid, t: 2.8 };
        sfx('ui');
      }
      return;
    }
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
    const speed = BASE_SHOT_SPEED * POWER * launchMult(u.def.stats) * this.launchBoost * u.launch * (0.4 + 0.6 * (gold ? 1 : charge));
    u.vx = dir.x * speed;
    u.vy = dir.y * speed;
    u.sq = 1; // launch pop — the ball stretches off the sling
    this.bumpsThisShot.clear();
    this.bumpNoted.clear();
    this.shotCombo = 0;
    this.kosThisShot = 0;
    u.wallN = 0;
    this.shotPhys = 1;
    this.volleys = 0;
    this.shotVolleyBoost = 0;
    this.lastContact = { t: -9, id: -1 };
    this.shotHitN.clear();
    this.gustSounded = false;
    this.stopTimer = 0;
    this.shotT = this.time;
    // STRIKE SHOT: launch with a recharged super and it fires from the
    // sling — MS's namesake. Spends the cooldown, erupts immediately.
    if (u.cd <= 0) this.bumpAlly(u, u);
    this.phase = 'shot';
    this.shots++;
    this.waveShots++; // anti-stall pressure counts shots inside the wave
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
      this.texts.push({ x: u.x, y: u.y - u.r - 14, text: this.streak > 1 ? `PERFECT ×${this.streak}!` : 'PERFECT!', t: 1, color: '#ffd84d', big: true });
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
      this.texts.push({
        x: u.x, y: u.y - u.r - 14,
        text: charge < zone.c ? 'TOO EARLY' : 'TOO LATE',
        t: 0.7, color: '#8a90a8', big: false,
      });
    }
  }

  // Power meter: ping-pongs 0→1→0 while held (~0.85s per direction —
  // stronger species sweep faster) — release in the gold zone for a
  // full-power launch. Pull distance only aims; it no longer feeds power.
  private charge() {
    const P = 0.85 - 0.3 * this.gaugeDifficulty();
    const ph = this.dragT % (2 * P);
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
  // you release where the band will be, not where it is.
  private sweetSpot() {
    const n = Math.min(this.active.def.stats.spe / 120, 1);
    const d = this.gaugeDifficulty();
    const hw = Math.max(0.09 - 0.05 * n - 0.04 * d, 0.025);
    const drift = Math.max(d - 0.5, 0) * 0.16 * Math.sin(this.dragT * 2.4);
    const c = Math.min(Math.max(0.68 + 0.27 * n + drift, hw), 1 - hw);
    return { c, hw };
  }

  // --- simulation ---

  update(dt0: number) {
    if (this.paused) {
      this.time += dt0; // the overlay still breathes
      return;
    }
    // scene music follows the phase: ambient on the map, the gym-leader
    // theme under any boss (aces, alphas, invaders, rivals), the march
    // under trainers, the wild loop everywhere else
    if (this.phase === 'map') music('map');
    else if (this.phase !== 'won' && this.phase !== 'lost') {
      music(this.enemies.some((e) => e.boss) || this.inRival ? 'gym' : this.inTrainer ? 'trainer' : 'battle');
    }
    // hit-stop: freeze-frame feel on big combos
    const hit = this.hitStop > 0;
    if (hit) this.hitStop -= dt0;
    const dt = hit ? dt0 * 0.3 : dt0;
    this.time += dt;
    if (this.dragging) {
      this.dragT += dt;
      // a soft tick each time the fill crosses into the gold — the
      // rhythm cue that makes the release a timing game, not a guess
      const z = this.sweetSpot();
      const inGold = Math.abs(this.charge() - z.c) <= z.hw;
      if (inGold && !this.wasGold) sfx('tick');
      this.wasGold = inGold;
    }
    for (const t of this.texts) t.t -= dt;
    this.texts = this.texts.filter((t) => t.t > 0);
    if (this.texts.length > 40) this.texts.splice(0, this.texts.length - 40); // a huge burst shouldn't stack 100 labels
    for (const f of this.flashes) f.t -= dt;
    this.flashes = this.flashes.filter((f) => f.t > 0);
    for (const b of this.balls) b.t -= dt;
    this.balls = this.balls.filter((b) => b.t > 0);
    for (const p of this.pickups) p.t += dt;
    for (const s of this.scars) s.t += dt;
    this.scars = this.scars.filter((s) => s.t < s.life);
    for (const bm of this.beams) bm.t -= dt;
    this.beams = this.beams.filter((bm) => bm.t > 0);
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
    this.fx = this.fx.filter((f) => f.t > 0);
    for (const p of this.pops) p.t -= dt;
    this.pops = this.pops.filter((p) => p.t > 0);
    this.shake *= Math.exp(-6 * dt);
    this.punch *= Math.exp(-9 * dt);
    if (this.waveBanner > 0) this.waveBanner -= dt;
    if (this.mapMsgT > 0) this.mapMsgT -= dt;
    if (this.inspect) {
      this.inspect.t -= dt;
      const alive = [...this.enemies, ...this.players].some((e) => e.uid === this.inspect!.uid && !e.dead);
      if (this.inspect.t <= 0 || !alive) this.inspect = null;
    }
    // squash impulses relax — sprites spring back after impacts
    for (const p of this.players) p.sq *= Math.exp(-9 * dt);
    for (const e of this.enemies) e.sq *= Math.exp(-9 * dt);

    this.stepOrbs(dt);
    this.stepWaves(dt);
    this.stepDashes(dt);
    if (this.phase === 'map' && this.mapWalk) this.stepMapWalk(dt);
    if (this.phase === 'map') this.mapCam += (this.mapCamTarget() - this.mapCam) * Math.min(1, dt * 4.5);
    for (const d of this.delays) d.t -= dt;
    const due = this.delays.filter((d) => d.t <= 0);
    this.delays = this.delays.filter((d) => d.t > 0);
    for (const d of due) d.fn();
    if (this.phase === 'shot' || this.phase === 'aim' || this.phase === 'enemy') {
      this.stepEnemyMovement(dt);
    }
    if (this.phase === 'shot') this.stepShot(dt);
    else if (this.phase === 'loot') this.stepLoot(dt);
    else if (this.phase === 'enemy') {
      this.enemyPhaseT -= dt;
      if (this.enemyPhaseT <= 0) this.resolveEnemyTurn();
    }
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
      const damp = Math.exp(-FRICTION * this.frictionMult * h);
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
      // court gimmicks — the ball feels the floor it's flying over
      for (const hz of this.hazards) {
        if (hz.spent || dist(u, hz) > u.r + hz.r) continue;
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
            if (!e.dead && dist(hz, e) < hz.r * 2.2 + e.r) {
              const d = Math.max(30, dist(hz, e));
              e.vx += ((e.x - hz.x) / d) * 520;
              e.vy += ((e.y - hz.y) / d) * 520;
            }
          }
          this.damagePlayer(u, Math.max(1, Math.round(u.maxHp * 0.05)));
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
        } else if (!this.slowImmune && this.time - u.hzT > 0.5) {
          // lava & spikes chip the ball on contact — MS damage walls
          u.hzT = this.time;
          this.damagePlayer(u, Math.max(1, Math.round(u.maxHp * 0.04)));
          sfx('sizzle');
        }
      }
      // the court can kill the ball mid-flight — a dead mon connects nothing
      if (u.dead) break;
      for (const e of wave) {
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
        if (!p.dead && p !== u && dist(u, p) < u.r + p.r && u.vx * u.vx + u.vy * u.vy > 1600)
          this.bumpAlly(p, u);
      }
      for (let j = this.pickups.length - 1; j >= 0; j--) {
        const pk = this.pickups[j];
        if (dist(u, pk) < u.r + 16) {
          this.pickups.splice(j, 1);
          this.grabPickup(pk);
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
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
    // failsafe: a ball caught orbiting a well or looping boost pads never
    // dips under settle speed — without this the run softlocks mid-shot
    if (this.phase === 'shot' && this.time - this.shotT > SHOT_MAX) this.endShot();
  }

  // Enemies creep toward the nearest player; knockback velocity decays fast.
  private stepEnemyMovement(dt: number) {
    const alive = this.players.filter((p) => !p.dead);
    for (const e of this.enemies) {
      if (e.dead) continue; // corpses don't drift, lunge, or shove
      if (e.boss) e.weakA += dt * 0.45; // the weak face drifts — watch it before you commit
      const kn = Math.exp(-4 * dt);
      e.vx *= kn;
      e.vy *= kn;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (alive.length > 0) {
        const target = alive.reduce((a, b) => (dist(e, a) < dist(e, b) ? a : b));
        const d = dist(e, target);
        const dir = norm({ x: target.x - e.x, y: target.y - e.y });
        if (e.lunging > 0) {
          // melee attack in flight: steer hard at the target, hit on contact
          e.lunging -= dt;
          const sp = 520 + e.def.stats.spe * 3;
          e.x += dir.x * sp * dt;
          e.y += dir.y * sp * dt;
          if (d < e.r + target.r + 4 || e.lunging <= 0) {
            e.lunging = 0;
            if (d < e.r + target.r + 8) {
              this.damagePlayer(target, physDamage(e.def.stats.atk, target.def.stats.def, 1, zapPower * 1.3), e);
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
            e.x += (dir.x * 0.55 + e.wx * e.wMul) * e.drift * dt;
            e.y += (dir.y * 0.55 + e.wy * e.wMul) * e.drift * dt;
          }
        }
      }
      for (const b of this.blocks) resolveBlock(e, b); // creeps slide off the stones
      this.clampToArena(e);
      for (const p of this.players) {
        if (!p.dead) this.separate(e, p);
      }
      // enemies take no environment damage — lava pools, mines and the
      // court's other tricks only ever punish the ball
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
    const d = dist(m, o);
    if (d >= rr || d === 0) return;
    const n = norm({ x: m.x - o.x, y: m.y - o.y });
    m.x = o.x + n.x * rr;
    m.y = o.y + n.y * rr;
  }

  // Push two movers apart, splitting the correction.
  private separatePair(a: Unit, b: Unit) {
    const rr = a.r + b.r;
    const d = dist(a, b);
    if (d >= rr || d === 0) return;
    const n = norm({ x: b.x - a.x, y: b.y - a.y });
    const push = (rr - d) / 2;
    a.x -= n.x * push;
    a.y -= n.y * push;
    b.x += n.x * push;
    b.y += n.y * push;
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
      o.x += (dir.x - dir.y * perp) * 620 * dt;
      o.y += (dir.y + dir.x * perp) * 620 * dt;
      // bubble trail
      if (dist(o, o.target) < o.target.r + 6) {
        if (o.hostile) {
          this.damagePlayer(o.target, o.dmg);
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
          color: '#9df0ff', hits: new Set(),
        });
        this.burst(o.x, o.y, o.color, 10, 320);
        sfx('splash');
        o.t = 0;
      }
    }
    this.orbs = this.orbs.filter((o) => o.t > 0);
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
      for (const e of w.hostile ? this.players : this.enemies) {
        if (e.dead || w.hits.has(e.uid)) continue;
        if (dist(w, e) > w.r + e.r * 0.5) continue;
        w.hits.add(e.uid);
        w.onHit(e);
      }
    }
    this.waves = this.waves.filter((w) => w.t > 0);
  }

  // Quick-attack lunges: the ally streaks to its target, lands the hit,
  // and stays parked beside it.
  private stepDashes(dt: number) {
    const SP = 1100;
    for (const d of this.dashes) {
      if (d.e.dead) {
        d.done = true; // target died mid-lunge — park where it is
        continue;
      }
      // hold just outside the target's radius — never overlap it
      const gap = d.u.r + d.e.r + 2;
      if (dist(d.u, d.e) <= gap + 2) {
        this.hurt(d.e, d.dmg, '#9df0ff');
        this.impact(d.e.x, d.e.y, '#9df0ff', 1.2);
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
    }
    this.dashes = this.dashes.filter((d) => !d.done);
  }

  // A stone slab: slate body under a boulder skin tiled from the gracidea
  // pack (Strength-rock clusters — pure Gen-3 canon), rim + top bevel.
  private drawBlock(ctx: CanvasRenderingContext2D, b: Rect) {
    ctx.fillStyle = 'rgba(6,8,16,0.4)';
    ctx.fillRect(b.x + 3, b.y + 5, b.w, b.h);
    ctx.fillStyle = '#3d4358';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const cell = 26;
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.w, b.h);
    ctx.clip();
    for (let ty = b.y - cell / 2; ty < b.y + b.h; ty += cell)
      for (let tx = b.x - cell / 2; tx < b.x + b.w; tx += cell)
        drawTile(ctx, MT.TILE_ROCK, tx, ty, cell, cell);
    ctx.restore();
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
      if (this.pinch(-2) && !this.inStatic(u.x, u.y)) this.onPinch(u.x, u.y);
    }
  }

  // Stone blocks bank the ball like walls — same restitution, same wall-
  // bounce credit, own contact id so a wall→block squeeze still combos.
  private hitBlocks(u: Unit) {
    const fast = u.vx * u.vx + u.vy * u.vy > 150 * 150;
    let bounced = false;
    for (const b of this.blocks) bounced = resolveBlock(u, b) || bounced;
    if (bounced && fast && u.side === 'player') {
      u.wallN++;
      this.onBounceFx(u);
      if (this.pinch(-3) && !this.inStatic(u.x, u.y)) this.onPinch(u.x, u.y);
    }
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

  // PINCH: two distinct contacts (enemy, ally, wall, stone) inside
  // one 0.35s window — the squeeze shot is the engine's fuel. Records every
  // contact; callers gate the payoff on static fields so silence absorbs
  // chains.
  private pinch(id: number) {
    const pinched = this.time - this.lastContact.t <= 0.35 && this.lastContact.id !== id;
    this.lastContact = { t: this.time, id };
    return pinched;
  }

  private onPinch(x: number, y: number) {
    this.texts.push({ x, y: y - 30, text: 'PINCH!', t: 0.8, color: '#9df0ff', big: true });
    this.impact(x, y, '#9df0ff', 0.9);
    for (let k = 0; k < this.pinchPip; k++) this.chargeUp(this.active);
  }

  // Static fields silence keyword triggers and bump supers inside them.
  private inStatic(x: number, y: number) {
    return this.hazards.some((hz) => hz.kind === 'static' && dist({ x, y }, hz) < hz.r);
  }

  // Field pickups — the MS heart/sword/hourglass: heal, damage, cooldown.
  private grabPickup(pk: Pickup) {
    this.burst(pk.x, pk.y, '#fff8dc', 9, 260, 0.9);
    switch (pk.kind) {
      case 'oran-berry':
        this.tryHeal(this.players, (p) => Math.max(1, Math.round(p.maxHp * 0.15)));
        break;
      case 'protein':
        sfx('ui');
        this.shotPhys *= 1.5;
        this.texts.push({ x: pk.x, y: pk.y - 12, text: 'ATK UP!', t: 0.9, color: '#f08030', big: true });
        break;
      case 'elixir':
        sfx('ready');
        for (const p of this.players) this.chargeUp(p);
        this.texts.push({ x: pk.x, y: pk.y - 12, text: 'CD -1!', t: 0.9, color: '#9ecbff', big: true });
        break;
    }
  }

  // One shared heal window: a mend that lands starts HEAL_CD shots of
  // downtime, so sustain is a drip, not a reset — items still bypass it.
  private tryHeal(ps: Unit[], amount: (p: Unit) => number) {
    if (this.healCd > 0) return;
    let healed = false;
    for (const p of ps) {
      if (p.dead || p.hp >= p.maxHp) continue;
      const heal = amount(p);
      p.hp = Math.min(p.hp + heal, p.maxHp);
      this.texts.push({ x: p.x, y: p.y - p.r - 8, text: `+${heal}`, t: 0.9, color: '#6fdc6f', big: false });
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
    const d = dist(u, o);
    if (d >= rr || d === 0) return false;
    const n = norm({ x: o.x - u.x, y: o.y - u.y });
    u.x = o.x - n.x * rr;
    u.y = o.y - n.y * rr;
    const vn = u.vx * n.x + u.vy * n.y;
    if (vn > 0) {
      u.vx -= (1 + UNIT_REST) * vn * n.x;
      u.vy -= (1 + UNIT_REST) * vn * n.y;
    }
    return true;
  }

  // Central damage path so every source (contact, bump, orb, dot) behaves alike.
  private hurt(e: Unit, dmg: number, color: string, suffix = '') {
    if (e.dead) return;
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
      this.texts.push({ x: e.x, y: e.y - e.r - 30, text: 'WARD BREAK!', t: 0.9, color: '#9df0ff', big: false });
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
    e.hp -= d;
    // enemy focus sash: the gym ace's held item hangs on at 1 HP once
    if (e.sash && e.hp <= 0) {
      e.sash = false;
      e.hp = 1;
      this.texts.push({ x: e.x, y: e.y - e.r - 34, text: 'FOCUS SASH!', t: 1.1, color: '#ffd84d', big: false });
    }
    // ghost trait: execute non-boss foes already on fumes
    if (!e.dead && !e.boss && e.hp > 0 && e.hp <= e.maxHp * this.t('ghost') * 0.06) {
      this.texts.push({ x: e.x, y: e.y - e.r - 34, text: 'EXECUTE!', t: 1, color: '#a868c8', big: true });
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
    // boss enrage: below 30% the leader fights dirty — attacks cycle a
    // third faster, so the last stretch of a gym is the tense one
    if (e.boss && !e.enraged && e.hp > 0 && e.hp / e.maxHp < 0.3) {
      e.enraged = true;
      e.timer = Math.min(e.timer, 2);
      this.texts.push({ x: e.x, y: e.y - e.r - 58, text: 'ENRAGED!', t: 1.2, color: '#ff6b6b', big: true });
      this.burst(e.x, e.y, '#ff6b6b', 16, 440, 1.2);
      this.screenFlash('#ff6b6b', 0.15);
      sfx('invade');
    }
    const gain = Math.round(d * (1 + this.asc * 0.2) * this.scoreMult); // ascension pays a score premium; lucky egg stacks on
    this.score += gain;
    // action→reward, on screen: every hit feeds its score under the mon
    this.texts.push({ x: e.x, y: e.y + e.r + 10, text: `+${gain}`, t: 0.9, color: '#ffe76a', big: false, size: 0.8 });
    // the run just became your best — celebrate mid-flight, not just on the card
    if (!this.bested && this.bestScore > 0 && this.score > this.bestScore) {
      this.bested = true;
      this.texts.push({ x: e.x, y: e.y - e.r - 46, text: '★ NEW BEST ★', t: 1.4, color: '#ffd84d', big: true });
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
    this.texts.push({
      x: e.x,
      y: e.y - e.r - 8,
      text: immune ? 'IMMUNE' : crit ? `${d} CRIT!` : `${d}${suffix}`,
      t: 0.9,
      color: immune ? '#8a90a8' : crit ? '#ffd84d' : color,
      big: crit || suffix === '!',
      // the number sells the hit — chunkier damage pops bigger
      size: Math.min(1.7, 0.85 + d / 90),
    });
    // a chunk of the health bar at once gets the anime flash frame —
    // bumps, orbs and dot ticks all deserve it, not just contact
    if (!immune && d >= Math.max(30, e.maxHp * 0.25)) this.impact(e.x, e.y, color, 0.8);
    if (crit) {
      this.addShake(4);
      this.burst(e.x, e.y, '#ffd84d', 10, 380);
    }
    // styler loop wraps the target — every hit is another circle
    if (e.hp <= 0) {
      e.dead = true;
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
        this.texts.push({ x: e.x, y: e.y - e.r - 60, text: 'CURSED!', t: 1.1, color: '#a868c8', big: true });
      }
      // multi-KO callouts — chaining kills in one shot should feel huge
      this.kosThisShot++;
      this.totalKos++;
      if (this.totalKos >= 40) this.award('rampage');
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
        this.texts.push({ x: e.x, y: e.y - e.r - 46, text: label, t: 1.1, color: '#ffd84d', big: true });
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
      const caught = master || e.shiny || (!this.inTrainer && this.rng() < this.captureChance + (e.boss ? this.bossCatch : 0));
      if (master) this.masterArmed = false;
      sfx('ko');
      buzz(e.boss ? [50, 60, 90] : 30);
      // capture complete: stacked loops + release sparkle
      this.texts.push({
        x: e.x, y: e.y - e.r - 22,
        text: `${e.shiny ? 'SHINY ' : ''}${e.def.name.toUpperCase()} ${caught ? 'CAUGHT!' : 'FAINTED!'}`,
        t: caught ? 1.5 : 1.1,
        color: caught ? '#ffd84d' : '#9df0ff',
        big: true,
      });
      if (e.boss && this.waveHadGym) {
        this.award('badge'); // leader down, caught or not
        // the badge case: each leader pays out its themed badge, once ever
        const badge = earnBadge(e.def.id);
        if (badge) {
          this.texts.push({
            x: e.x, y: e.y - e.r - 74,
            text: `★ EARNED THE ${badge.name}! ★`,
            t: 2.1, color: badge.color, big: true,
          });
          this.burst(e.x, e.y, badge.color, 26, 520, 1.4);
          this.impact(e.x, e.y, badge.color, 2);
          this.screenFlash(badge.color, 0.22);
          this.hitStop = Math.max(this.hitStop, 0.35);
          this.addPunch(0.12);
          sfx('perfect');
          if (gymBadges().size >= BADGES.length) this.award('league');
        }
      }
      if (caught) {
        // a dupe feeds the copy you own instead of filling a box slot
        if (!this.absorbDupe(e.def, e.shiny)) {
          this.box.push(e.shiny ? { ...e.def, shiny: true, lvl: e.lvl } : { ...e.def, lvl: e.lvl });
          this.boxHp.push(1);
          this.boxLvl.push(Math.max(1, e.lvl)); // it keeps its level
        }
        // record at capture time — a mid-run tab close keeps the dex honest
        recordCapture([e.def.id]);
        if (INVADERS.some((i) => i.id === e.def.id)) this.award('myth');
        if (e.boss) this.caughtBoss = true;
        if (e.shiny) {
          recordShiny(e.def.id);
          this.award('shiny');
          this.shiniesCaught++;
          this.score += 250;
          this.texts.push({ x: e.x, y: e.y - e.r - 56, text: 'SHINY BONUS +250', t: 1.4, color: '#ffd84d', big: true });
        }
        this.screenFlash('#ffd84d', 0.2);
        this.burst(e.x, e.y, '#ffd84d', 18, 420, 1.2);
        // real poké ball drops in and does the triple-wiggle
        this.balls.push({ x: e.x, y: e.y, item: master ? 'master-ball' : 'poke-ball', t: 1.15, life: 1.15 });
        // the ball breaks a soul-link — the partner fights on alone
        if (e.link) {
          e.link.link = undefined;
          e.link = undefined;
        }
        sfx('caught');
        cry(e.def.id, 0.45);
        buzz([30, 50, 30, 50, 60]);
      } else {
        // a faint flashes the sprite out — the ghost drifts up and gone
        this.pops.push({ x: e.x, y: e.y, id: e.def.id, r: e.r, t: 0.55, life: 0.55 });
      }
      // skull mark: the bounty pops on the KO — team heal + score
      if (e.skull) {
        this.score += 150;
        for (const p of this.players) if (!p.dead) p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.12));
        this.texts.push({ x: e.x, y: e.y - e.r - 72, text: 'SKULL BONUS!', t: 1.2, color: '#c8ff70', big: true });
        this.burst(e.x, e.y, '#c8ff70', 12, 320, 1);
        sfx('heal');
      }
      // VOLATILE mod: the KO detonates — a chunk of its max hp splashes
      // onto every neighbor, and volatile kills can chain
      if (e.volatile) {
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
    const pinched = this.pinch(e.uid);
    // taunt toll-booth: while a magnet mon lives, contact damage routes
    // through it — pierce still passes, it just can't hurt anything else
    const taunter = this.enemies.find((x) => !x.dead && x.def.taunt);
    if (taunter && e !== taunter) {
      this.texts.push({ x: e.x, y: e.y - e.r - 8, text: 'BLOCKED', t: 0.7, color: '#8a90a8', big: false });
      return;
    }
    // engine cap: repeat hits on the same target decay — variety chains
    const hitN = this.shotHitN.get(e.uid) ?? 0;
    this.shotHitN.set(e.uid, hitN + 1);
    if (pinched && !this.inStatic(shooter.x, shooter.y)) this.onPinch(e.x, e.y);
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
        (pinched ? 1 + this.pinchMult : 1) *
        (weak ? 3 : 1) *
        // power zone: hits landed while the ball's inside the ATK field
        // carry the field's charge
        (this.hazards.some((hz) => hz.kind === 'power' && Math.hypot(shooter.x - hz.x, shooter.y - hz.y) < hz.r) ? 1.5 : 1) *
        Math.pow(0.9, hitN),
    );
    if (weak) {
      this.texts.push({ x: e.x, y: e.y - e.r - 44, text: 'WEAK POINT!', t: 1, color: '#ffd84d', big: true });
      this.hitStop = Math.max(this.hitStop, 0.16);
      this.impact(e.x, e.y, '#ffd84d', 1.7);
      this.addPunch(0.11);
      this.addShake(11);
      sfx('perfect');
    }
    const color = mult > 1 ? '#ffd84d' : mult < 1 ? '#8a90a8' : '#ffffff';
    this.hurt(e, dmg, color, mult > 1 ? '!' : '');
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
      this.texts.push({ x: e.x, y: e.y - e.r - 58, text: `BANKED ×${shooter.wallN}!`, t: 0.9, color: '#9df0ff', big: false });
    if (mult >= 4)
      this.texts.push({ x: e.x, y: e.y - e.r - 30, text: 'ULTRA EFFECTIVE!', t: 1, color: '#ffd84d', big: true });
    else if (mult > 1)
      this.texts.push({ x: e.x, y: e.y - e.r - 30, text: 'SUPER EFFECTIVE!', t: 0.8, color: '#ffd84d', big: false });
  }

  // Passive talent — a small effect on EVERY pass-through, on or off
  // cooldown. This is what makes each role feel different link to link.
  private allyPassive(
    p: Unit,
    near: (radius: number) => Unit[],
    bumpDmg: (e: Unit, power: number) => number,
  ) {
    switch (p.role) {
      case 'speedster': { // lightning-fast jab at the closest enemy
        const t = near(140).sort((a, b) => dist(p, a) - dist(p, b))[0];
        if (t) {
          this.hurt(t, bumpDmg(t, 0.3), '#9df0ff');
        }
        break;
      }
      case 'bruiser': { // point-blank shockwave
        const ts = near(95);
        if (ts.length) {
          for (const e of ts) this.hurt(e, bumpDmg(e, 0.25), '#9df0ff');
        }
        break;
      }
      case 'sniper': { // long-range poke at the farthest target
        const t = near(280).sort((a, b) => dist(p, b) - dist(p, a))[0];
        if (t) {
          this.hurt(t, bumpDmg(t, 0.35), '#9df0ff');
        }
        break;
      }
      case 'tank': // brace: small self-mend on every pass
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
    const foes = this.enemies.filter((e) => !e.dead);
    if (!foes.length) return false;
    const farthest = foes.slice().sort((a, b) => dist(p, b) - dist(p, a))[0];
    const fattest = foes.slice().sort((a, b) => b.maxHp - a.maxHp)[0];
    // a piercing beam from the caster THROUGH the anchor enemy to the far
    // wall — every enemy within `halfW` of the ray eats it
    const lineBlast = (to: Unit, color: string, halfW: number, power: number, w: number) => {
      const d = norm({ x: to.x - p.x, y: to.y - p.y });
      this.beams.push({ x1: p.x, y1: p.y, x2: p.x + d.x * 1400, y2: p.y + d.y * 1400, t: 0.6, life: 0.6, color, w });
      for (const e of foes) {
        const t = (e.x - p.x) * d.x + (e.y - p.y) * d.y;
        if (t < 0) continue; // behind the caster
        const dx = e.x - (p.x + d.x * t), dy = e.y - (p.y + d.y * t);
        if (Math.hypot(dx, dy) < halfW + e.r) this.hurt(e, bumpDmg(e, power), '#ffffff');
      }
      this.screenFlash(color, 0.22);
      this.hitStop = Math.max(this.hitStop, 0.34);
      this.addPunch(0.16);
      this.addShake(14);
      sfx('beam');
      buzz([40, 30, 60]);
    };
    switch (moveOf(src.def.id, src.def.type)) {
      case 'HYPER BEAM': // the golden wall of light — fattest beam in the game
        lineBlast(farthest, '#ffd84d', 38, 2.6, 2.4);
        return true;
      case 'SOLARBEAM': // same line, photosynthesis green
        lineBlast(farthest, '#78c850', 32, 2.2, 1.8);
        return true;
      case 'HYDRO CANNON': // a water jet that punches through the pack
        lineBlast(farthest, '#6890f0', 34, 2.3, 2.0);
        sfx('splash');
        return true;
      case 'ZAP CANNON': { // one fat thunderball tracks the farthest foe
        this.orbs.push({ x: p.x, y: p.y, target: farthest, dmg: bumpDmg(farthest, 2.6), t: 3, wob: 0, color: '#f8d030' });
        this.screenFlash('#f8d030', 0.16);
        sfx('zap');
        return true;
      }
      case 'PSYCHO BOOST': { // Mewtwo's nuke — detonates the biggest target
        this.screenFlash('#f85888', 0.25);
        this.waves.push({
          x: fattest.x, y: fattest.y, r: 0, maxR: 190, t: 0.5, life: 0.5,
          color: '#f85888', hits: new Set(),
          onHit: (e) => this.hurt(e, bumpDmg(e, e === fattest ? 2.6 : 1.3), '#f8b8d0'),
        });
        this.scar(fattest.x, fattest.y, 30);
        this.hitStop = Math.max(this.hitStop, 0.3);
        this.addPunch(0.14);
        this.addShake(12);
        return true;
      }
      case 'ERUPTION': // the whole pack erupts in staggered bursts
        foes.slice(0, 6).forEach((e, i) => {
          this.later(i * 0.12, () => {
            this.burst(e.x, e.y, '#f08030', 16, 460, 1.2);
            this.scar(e.x, e.y, 16);
            this.addShake(6);
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
        this.waves.push({ x: p.x, y: p.y, r: 0, maxR: 400, t: 0.55, life: 0.55, color: '#ffd84d', hits: new Set() });
        this.scar(p.x, p.y, 40);
        this.hitStop = Math.max(this.hitStop, 0.34);
        this.addPunch(0.18);
        this.addShake(16);
        sfx('boom');
        buzz([60, 40, 80]);
        return true;
      }
      case 'BLAST BURN': { // a fire wave that scorches every tile it sweeps
        this.screenFlash('#f08030', 0.22);
        this.waves.push({
          x: p.x, y: p.y, r: 0, maxR: 260, t: 0.5, life: 0.5,
          color: '#f08030', hits: new Set(),
          onHit: (e) => { this.scar(e.x, e.y, 14); this.hurt(e, bumpDmg(e, 1.9), '#ffb088'); },
        });
        this.hitStop = Math.max(this.hitStop, 0.24);
        this.addShake(11);
        sfx('boom');
        return true;
      }
      case 'FRENZY PLANT': // drain orbs swarm the four farthest foes
        foes.slice().sort((a, b) => dist(p, b) - dist(p, a)).slice(0, 4).forEach((e, i) => {
          this.orbs.push({ x: p.x, y: p.y, target: e, dmg: bumpDmg(e, 1.0), t: 3, wob: i * 1.7, color: '#78c850', drain: true });
        });
        return true;
      case 'OUTRAGE': { // rampage — three staggered smashes on the nearest
        const t = foes.slice().sort((a, b) => dist(p, a) - dist(p, b))[0];
        for (let i = 0; i < 3; i++) {
          this.later(i * 0.16, () => {
            if (t.dead) return;
            this.impact(t.x, t.y, '#7038f8', 1.2);
            this.hurt(t, bumpDmg(t, 1.1), '#c8a8ff');
            const d = norm({ x: t.x - p.x, y: t.y - p.y });
            t.vx += d.x * 300; t.vy += d.y * 300;
            this.addShake(8);
            sfx('hit');
          });
        }
        return true;
      }
      case 'SHEER COLD': { // the arena flash-freezes around the nearest foe
        const t = foes.slice().sort((a, b) => dist(p, a) - dist(p, b))[0];
        this.screenFlash('#98d8d8', 0.28);
        this.waves.push({
          x: t.x, y: t.y, r: 0, maxR: 160, t: 0.45, life: 0.45,
          color: '#98d8d8', hits: new Set(),
          onHit: (e) => this.hurt(e, bumpDmg(e, e === t ? 2.4 : 0.9), '#d8f0f8'),
        });
        this.hitStop = Math.max(this.hitStop, 0.28);
        this.addShake(10);
        sfx('splash');
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
    if (this.pinch(p.uid) && !silenced) this.onPinch(p.x, p.y);
    // VOLLEY: the bump itself is the resource — static fields silence it
    if (!silenced) {
      this.volleys++;
      this.shotVolleyBoost += this.volleyBoost;
      if (this.volleyNth > 0 && this.volleys % this.volleyNth === 0) {
        for (const pl of this.players) this.chargeUp(pl);
        this.texts.push({ x: u.x, y: u.y - u.r - 30, text: 'VOLLEY!', t: 1, color: '#f8d030', big: true });
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
    const COMBO_COLORS = ['#9df0ff', '#f8d030', '#f08030', '#f85888', '#ffd84d'];
    this.texts.push({
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
      Math.round(
        (phys
          ? physDamage(src.def.stats.atk, e.def.stats.def, eff(e), power) * this.physMult
          : specDamage(src.def.stats.spa, e.def.stats.spd, eff(e), power) * this.specMult) *
          (this.typePow[src.def.type] ?? 1) *
          p.pow *
          SUPER_POW *
          (1 + (n - 1) * this.comboDmg), // metronome ramps with combo length
      );
    // passive talent: a small role effect on EVERY pass, on or off cooldown
    this.allyPassive(p, near, bumpDmg);
    if (silenced) {
      // the field ate the super — say so or it reads as the shot failing
      this.texts.push({ x: p.x, y: p.y - p.r - 46, text: 'SILENCED', t: 0.8, color: '#b090ff', big: false });
      return;
    }
    if (p.cd > 0) {
      // super still recharging — name the wait once per ally per shot
      if (!this.bumpNoted.has(p.uid)) {
        this.bumpNoted.add(p.uid);
        this.texts.push({ x: p.x, y: p.y - p.r - 46, text: `${Math.ceil(p.cd)} TO GO`, t: 0.7, color: '#8890b8', big: false });
      }
      return;
    }
    // a copy pays the copied move's cooldown, not its own
    p.cd = Math.max(1, Math.round(bumpCooldown(src.def.type) * this.cdMult) - p.cdMod);
    p.cdMax = p.cd;
    this.bumpsThisShot.add(p.uid);
    // move callout and freeze-frame on the cast
    this.texts.push({
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
    this.addShake(7);
    this.screenFlash(color, 0.12);
    sfx(SUPER_SFX[src.def.type]);
    cry(p.def.id, 0.35);
    buzz(20);

    if (!this.signatureMove(src, p, bumpDmg)) switch (src.def.type) {
      case 'fire': {
        // flame burst: a shockwave ring rolls out from the ally — enemies
        // catch fire as the front passes over them
        this.screenFlash('#f08030', 0.15);
        this.addShake(8);
        this.waves.push({
          x: p.x, y: p.y, r: 0, maxR: 170 * p.rngMul, t: 0.4, life: 0.4,
          color, hits: new Set(),
          onHit: (e) => {
            const dir = norm({ x: e.x - p.x, y: e.y - p.y });
            e.vx += dir.x * 170;
            e.vy += dir.y * 170;
            this.hurt(e, bumpDmg(e, 1.6), '#9df0ff');
          },
        });
        // + fireball volley: homing fire-orbs arc into the 3 FARTHEST
        // enemies — nobody outruns the burn
        near(Infinity)
          .sort((a, b) => dist(p, b) - dist(p, a))
          .slice(0, 3)
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
        for (let i = 0; i < 3; i++) {
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
            this.impact(c.e.x, c.e.y, '#f8d030', 0.9);
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
        }
        if (dealt > 0) this.tryHeal(this.players, () => Math.max(Math.round(dealt * 0.35), 4));
        // + seed flares: homing spores chase the 2 farthest enemies and
        // siphon them back to the team on impact
        near(Infinity)
          .sort((a, b) => dist(p, b) - dist(p, a))
          .slice(0, 2)
          .forEach((e, i) => {
            this.orbs.push({ x: p.x, y: p.y, target: e, dmg: bumpDmg(e, 0.8), t: 2.5, wob: i * 2.1, color, drain: true });
          });
        break;
      }
      case 'water':
        // hydro pump: homing orbs corkscrew into the 3 nearest enemies
        near(Infinity)
          .sort((a, b) => dist(p, a) - dist(p, b))
          .slice(0, 3)
          .forEach((e, i) => {
            this.orbs.push({
              x: p.x,
              y: p.y,
              target: e,
              dmg: bumpDmg(e, 1.0),
              t: 2.5,
              wob: i * 2.1,
              color,
            });
          });
        break;
      case 'psychic': {
        // telekinetic shove: real knockback impulse — enemies get flung
        // off the ally, off walls, off each other
        const radius = 170;
        this.waves.push({
          x: p.x, y: p.y, r: 0, maxR: radius * p.rngMul, t: 0.32, life: 0.32,
          color, hits: new Set(),
        });
        this.addShake(7);
        for (const e of near(radius)) {
          const dir = norm({ x: e.x - p.x, y: e.y - p.y });
          e.vx += dir.x * 720;
          e.vy += dir.y * 720;
          this.hurt(e, bumpDmg(e, 1.2), '#9df0ff');
        }
        // + twin psy-orbs hunt the farthest stragglers the shove misses
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
        const radius = 210;
        this.screenFlash(color, 0.1);
        this.addShake(5);
        for (const e of near(radius)) {
          const dir = norm({ x: p.x - e.x, y: p.y - e.y });
          e.vx += dir.x * 640;
          e.vy += dir.y * 640;
          this.hurt(e, bumpDmg(e, 0.7), '#9df0ff');
        }
        break;
      }
      case 'poison':
        // toxic: gas cloud now, then a cut of max HP at the end of each of
        // your shots — re-toxining stacks the timer
        this.screenFlash('#a040a0', 0.12);
        for (const e of near(140)) {
          e.dotTicks = Math.min(e.dotTicks + 2, 6);
          e.dotDmg = Math.max(e.dotDmg, Math.ceil(e.maxHp * 0.08));
          this.hurt(e, bumpDmg(e, 1.0), '#9df0ff');
        }
        break;
      case 'rock':
      case 'fighting': {
        // meteor shower: jab the nearest, then rocks rain down on the 3
        // farthest enemies — anywhere on the court is inside the kill box
        const e = nearest(p, 200);
        if (e) this.hurt(e, bumpDmg(e, 0.8), '#9df0ff');
        near(Infinity)
          .sort((a, b) => dist(p, b) - dist(p, a))
          .slice(0, 3)
          .forEach((t, i) => {
            this.later(0.14 + i * 0.16, () => {
              this.scar(t.x, t.y, 14); // the meteor lands whether or not it kills
              this.screenFlash('#b8a038', 0.12);
              this.addShake(12);
              if (t.dead) return;
              this.impact(t.x, t.y, '#b8a038', 1.1);
              this.hurt(t, bumpDmg(t, i === 0 ? 2.2 : 1.5), '#9df0ff');
            });
          });
        break;
      }
      case 'ghost': {
        // hex: wisps converge on every enemy from the dark
        this.screenFlash('#705898', 0.18);
        for (const e of near(Infinity)) {
          this.hurt(e, bumpDmg(e, 1.1), '#9df0ff');
        }
        break;
      }
      default: {
        // quick attack: the ally physically dashes to the nearest enemy,
        // slams it, and stays put beside it — pure speed
        const e = nearest(p, 240);
        if (e) {
          this.dashes.push({ u: p, e, done: false, dmg: bumpDmg(e, 1.5) });
        }
      }
    }
    // healer role: every super also mends the team
    if (p.role === 'healer') {
      this.tryHeal(this.players, (pl) => Math.max(1, Math.round(pl.maxHp * 0.15)));
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
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
      this.texts.push({ x: p.x, y: p.y - p.r - 40, text: 'TEAM CHAIN!', t: 1.2, color: '#ffd84d', big: true });
    }
  }

  private waveCleared() {
    if (this.coach) this.coachDone = true; // survived a wave — teaching's over
    if (this.inRival) {
      this.echoCleared = true; // the echo is beaten — reclaim it
      this.award('rival');
    }
    if (this.waveHadGym) this.gymsBeaten++;
    // last-kill slow-mo — the kill shot gets a beat to land
    this.hitStop = Math.max(this.hitStop, 0.5);
    this.addPunch(0.08);
    this.addShake(9);
    this.burst(this.arena.x + this.arena.w / 2, this.arena.y + this.arena.h / 2, '#ffd84d', 26, 540, 1.2);
    if (this.waveIndex + 1 >= this.waveCount && this.depth >= FINAL_DEPTH) {
      this.phase = 'won';
      this.award('first-clear');
      if (this.asc > 0) this.award('ascended');
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
    this.texts.push({
      x: this.arena.x + this.arena.w / 2,
      y: this.arena.y + 110,
      text: `★ TROPHY: ${a?.name ?? id} ★`,
      t: 2,
      color: '#ffd84d',
      big: true,
    });
    sfx('perfect');
  }

  gainLevels(p: Unit, n: number) {
    if (p.dead || p.lvl >= LV_CAP) return;
    const l0 = p.lvl;
    p.lvl = Math.min(LV_CAP, p.lvl + n);
    p.pow *= lvlPow(offStat(p.def.stats, p.def.type), p.lvl) / lvlPow(offStat(p.def.stats, p.def.type), l0);
    const gain = Math.round(p.maxHp * (lvlHp(p.def.stats.hp, p.lvl) / lvlHp(p.def.stats.hp, l0) - 1));
    p.maxHp += gain;
    p.hp = Math.min(p.hp + gain, p.maxHp);
    this.texts.push({ x: p.x, y: p.y - p.r - 36, text: `LV ${p.lvl}!`, t: 0.9, color: '#9df0ff', big: false });
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
    this.texts.push({
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
      this.texts.push({
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
      if (owned) this.evolveUnit(owned, next);
      else this.box[bi] = this.evoMerge(this.box[bi], next, shiny); // markers survive a boxed evolution
      recordCapture([next.id]); // evo-only species only ever enter the dex here
      this.texts.push({
        x: owned ? owned.x : this.arena.x + this.arena.w / 2,
        y: owned ? owned.y - owned.r - 40 : this.arena.y + 70,
        text: `${def.name.toUpperCase()} evolved into ${next.name.toUpperCase()}!`,
        t: 1.4, color: '#ffd84d', big: true,
      });
      this.impact(owned ? owned.x : this.arena.x + this.arena.w / 2, owned ? owned.y : this.arena.y + 90, '#ffd84d', 1.4);
      this.burst(owned ? owned.x : this.arena.x + this.arena.w / 2, owned ? owned.y : this.arena.y + 90, '#ffffff', 16, 380);
      sfx('caught');
      cry(next.id, 0.5);
      return true;
    }
    if (owned) {
      // rare candy: a fully-evolved dupe bulks the original
      const gain = Math.max(1, Math.round(owned.maxHp * 0.08));
      owned.maxHp += gain;
      if (!owned.dead) owned.hp = Math.min(owned.maxHp, owned.hp + gain);
      owned.pow *= 1.05;
      this.texts.push({ x: owned.x, y: owned.y - owned.r - 40, text: 'RARE CANDY!', t: 1.1, color: '#f85888', big: true });
    } else {
      // a boxed dupe can't bulk — the team splits the candy as a heal
      for (const p of this.players) {
        if (!p.dead) p.hp = Math.min(p.hp + Math.round(p.maxHp * 0.1), p.maxHp);
      }
      this.texts.push({ x: this.arena.x + this.arena.w / 2, y: this.arena.y + 70, text: 'RARE CANDY!', t: 1.1, color: '#f85888', big: true });
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
    this.texts.push({
      x: this.arena.x + this.arena.w / 2,
      y: this.arena.y + 120,
      text: `${c.from.name.toUpperCase()} evolved into ${next.name.toUpperCase()}!`,
      t: 1.4, color: '#ffd84d', big: true,
    });
    sfx('caught');
    cry(next.id, 0.5);
    this.evoChoice = this.evoPending.shift() ?? null;
  }

  // Mid-run evolution: same slot, new species — hp fraction carries over
  // and a fainted mon stays fainted (evolving isn't a revive).
  private evolveUnit(p: Unit, nd: SpeciesDef) {
    const frac = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    const role = roleOf(nd.stats, nd.healer);
    const m = ROLE_MODS[role];
    const hp = Math.round(playerHp(nd.stats) * m.hp);
    p.def = p.shiny || p.def.luck ? { ...nd, shiny: p.shiny || undefined, luck: p.def.luck } : nd; // markers ride the def into the box
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
  }

  // Reseat a unit on a new species: role/stats recomputed, hp carried as a
  // fraction. Box swaps and wonder-trade both ride this one path.
  applyDef(p: Unit, def: SpeciesDef, lvl: number, frac = 1) {
    const role = roleOf(def.stats, def.healer);
    const m = ROLE_MODS[role];
    const hp = Math.round(playerHp(def.stats) * m.hp * lvlHp(def.stats.hp, lvl));
    p.def = def;
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

  // Swap a boxed mon onto the team — unlimited during a reward break. HP
  // belongs to the mon, not the slot: a hurt mon stays hurt in the box and a
  // fainted one stays fainted, so benching is never a free heal or revive.
  swapFromBox(bi: number, ti: number) {
    if (this.phase !== 'reward') return;
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
    return { ...pick.def, lvl: Math.min(LV_CAP, 5 + this.waveIndex * 10 + (pick.boss ? 8 : 0) + (this.rng() < 0.5 ? 4 : 0)) };
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

  // fusion tally — MS luck: absorbed dupes pay out as bonus gym loot
  teamLuck() {
    return this.players.reduce((a, p) => a + (p.def.luck ?? 0), 0);
  }

  private enterReward() {
    this.boxSel = -1;
    // hard stops pay out uncommon-or-better relics — the risk has a price;
    // elites go further: rare-or-better only
    this.rewardOffers = rollPerks(this.rng, this.eliteWave ? 1 : this.hardWave ? 2 : 3, this.rank, this.teamTypes());
    this.hardWave = false;
    this.eliteWave = false;
    // trainer mons stay with their owner; only a fallen gym pays its ace —
    // ordinary stages earn no free catch
    this.lastRecruit = this.inTrainer || !this.waveHadGym ? null : this.rollRecruit();
    if (this.lastRecruit) {
      if (!this.absorbDupe(this.lastRecruit)) {
        this.box.push(this.lastRecruit);
        this.boxHp.push(1);
        this.boxLvl.push(this.lastRecruit.lvl ?? 1);
        recordCapture([this.lastRecruit.id]); // the dex logs it now, not at run end
      }
      sfx('caught');
    }
    for (const p of this.players) {
      p.vx = 0;
      p.vy = 0;
    }
    this.phase = 'reward';
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
      this.texts.push({ x: ox, y: oy - 70, text: `LUCKY! +${bonus} GEM${bonus > 1 ? 'S' : ''}`, t: 1.4, color: '#9df0ff', big: true });
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
              this.texts.push({ x: hurt.x, y: hurt.y - hurt.r - 10, text: `+${healed}`, t: 0.9, color: '#6fdc6f', big: false });
            }
            this.burst(c.x, c.y, '#ff7096', 10, 300, 0.7);
            sfx('heal');
          } else if (c.kind === 'candy') {
            for (const q of this.players) if (!q.dead) q.cd = Math.max(0, q.cd - 1);
            this.texts.push({ x: c.x, y: c.y - 16, text: 'SUPER CHARGE!', t: 0.9, color: '#9df0ff', big: false });
            this.burst(c.x, c.y, '#9df0ff', 10, 300, 0.7);
            sfx('ready');
          } else {
            this.score += c.val;
            this.lootGot += c.val;
            this.burst(c.x, c.y, c.kind === 'gem' ? '#7dd8f8' : '#ffd84d', c.kind === 'gem' ? 9 : 5, c.kind === 'gem' ? 340 : 220, 0.6);
            this.texts.push({
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
            this.texts.push({ x: c.x, y: c.y - 34, text: `×${this.lootChain + 1}`, t: 0.5, color: '#fff', big: false, size: 0.7 });
          }
          break;
        }
        if (d < 170) { // wider vacuum — the leash feels generous, not stingy
          c.vx += (dx / d) * 3400 * dt;
          c.vy += (dy / d) * 3400 * dt - 720 * dt; // the pull beats gravity
        }
      }
    }
    this.lootCoins = this.lootCoins.filter((c) => c.r > 0);
    if (this.lootT <= 0 || !this.lootCoins.length) {
      this.lootCoins = [];
      this.waveSpecial = null;
      // the haul gets its own beat — you see what the fountain paid
      if (this.lootGot > 0) {
        this.texts.push({
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
    perk.apply(this);
    this.perksTaken++;
    this.heldItems.push(perk.item);
    this.rewardOffers = [];
    this.pendingNext = this.waveIndex + 1;
    this.phase = 'map'; // pick the next stop on the region map
  }

  // Declining pays score instead — StS reward skips keep dead offers honest.
  declineReward() {
    if (this.phase !== 'reward') return;
    sfx('ui');
    this.score += Math.round(150 * (1 + 0.2 * this.asc));
    this.rewardOffers = [];
    this.pendingNext = this.waveIndex + 1;
    this.phase = 'map';
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
        this.stage.waves.push(rollWave(this.rng, this.depth, this.stage.theme));
      }
      this.pendingNext = n.row + 1;
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
      this.stage.waves.push(rollWave(this.rng, this.depth, this.stage.theme));
    }
    this.pendingNext = c.node.row + 1;
    this.eventBox = out.note;
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
    const lvl = Math.min(LV_CAP, 5 + this.waveIndex * 10 + Math.floor(this.rng() * 5));
    this.box.push({ ...def, lvl });
    this.boxHp.push(1);
    this.boxLvl.push(lvl);
    recordCapture([def.id]);
    this.mapMsg = `THE EGG HATCHED — ${def.name.toUpperCase()} JOINED YOUR BOX!`;
    this.mapMsgT = 3;
    sfx('caught');
    cry(def.id, 0.4);
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
        return;
      }
      if (out.wave) {
        this.pendingEventWave = out.wave;
        this.mapNote = out.note;
      } else {
        this.skipWave = out.skip === true;
        this.eventBox = out.note;
      }
      return;
    }
    if (n.kind === 'rest') {
      // a real Poké Center: living mons healed, fainted ones revived —
      // ASC 4+ centers run on fumes (75% heal)
      const healTo = this.asc >= 4 ? 0.75 : 1;
      let revived = 0;
      for (const p of this.players) {
        if (p.dead) {
          p.dead = false;
          revived++;
        }
        p.hp = Math.round(p.maxHp * healTo);
      }
      this.mapNote = (revived
        ? `POKÉ CENTER: TEAM HEALED${healTo < 1 ? ' TO 75%' : ''}, ${revived} REVIVED`
        : `POKÉ CENTER: TEAM HEALED${healTo < 1 ? ' TO 75%' : ''}`);
      sfx('heal');
    } else if (n.kind === 'chest') {
      const p = rollPerks(this.rng, 1, this.rank, this.teamTypes())[0];
      if (p) {
        p.apply(this);
        this.heldItems.push(p.item);
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
    if (p.cd <= 0) return;
    p.cd--;
    if (p.cd === 0 && !p.dead) {
      this.burst(p.x, p.y, '#ffd84d', 6, 220, 0.8);
      sfx('ready');
    }
  }

  private endShot() {
    const u = this.active;
    u.vx = 0;
    u.vy = 0;
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
    for (const e of this.enemies) {
      if (e.boss && e.relic === 'leftovers' && !e.dead) {
        e.hp = Math.min(e.maxHp, e.hp + Math.ceil(e.maxHp * 0.04));
      }
      if (e.dotTicks > 0) {
        e.dotTicks--;
        this.hurt(e, e.dotDmg, '#a040a0');
      }
    }
    // zombie loop: a linked foe rises unless its partner fell too — the
    // pair only stays down if both die inside the same shot
    for (const e of this.enemies) {
      if (e.dead && e.link && !e.link.dead && e.revives > 0) {
        e.dead = false;
        e.revives--;
        e.hp = Math.ceil(e.maxHp * 0.4);
        this.texts.push({ x: e.x, y: e.y - e.r - 20, text: 'REVIVED!', t: 1, color: '#a0e060', big: true });
        this.burst(e.x, e.y, '#a0e060', 10, 260, 0.8);
        sfx('heal');
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    // chain payout: a 4+ link shot cashes out on the spot — the bigger the
    // pinball line, the bigger the bonus, and it reads as earned
    if (this.shotCombo >= 4) {
      const bonus = this.shotCombo * 15;
      this.score += bonus;
      this.texts.push({
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
    if (this.rewardPending) {
      this.rewardPending = false;
      // a fallen gym leader pays out in style — coin shower first, relic after
      if (this.waveHadGym) this.enterLoot();
      else this.enterReward();
      return;
    }
    this.pendingAttacks = [];
    let warned = false;
    for (const e of this.enemies) {
      e.timer--;
      if (e.timer <= 0) {
        this.pendingAttacks.push(e);
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
    this.texts.push({ x: boss.x, y: boss.y - boss.r - 20, text: 'CALLED FOR HELP!', t: 1.3, color: '#ff8a8a', big: true });
    this.screenFlash('#f85888', 0.15);
    this.addShake(6);
    sfx('invade');
    cry(boss.def.id, 0.4);
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
    this.texts.push({ x: e.x, y: e.y - e.r - 14, text: 'TELEPORT!', t: 0.9, color: '#f85888', big: false });
    this.addShake(6);
    sfx('zap');
    for (const p of this.players) {
      if (!p.dead && dist(e, p) <= e.r + p.r + 40) {
        this.damagePlayer(p, specDamage(e.def.stats.spa, p.def.stats.spd, 1, zapPower), e);
        if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
      }
    }
  }

  // Each boss has a signature attack on its countdown; invaders and
  // unknowns fall back to the generic radial blast. Every 3rd attack is a
  // hop instead — the signature stays scary but never gets stale.
  private bossAttack(e: Unit) {
    if (++e.atkN % 3 === 0) {
      this.bossHop(e);
      return;
    }
    const target = this.players.filter((p) => !p.dead).sort((a, b) => dist(e, a) - dist(e, b))[0];
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
        this.players
          .filter((p) => !p.dead)
          .sort((a, b) => dist(e, a) - dist(e, b))
          .slice(0, n)
          .forEach((p, i) => {
            this.orbs.push({
              x: e.x, y: e.y, target: p,
              dmg: Math.round(specDamage(e.def.stats.spa, p.def.stats.spd, 1, blastPower)),
              t: 2.5, wob: i * 2.1, color, hostile: true,
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
      if (this.players.every((p) => p.dead)) {
        this.phase = 'lost';
        this.screenFlash('#ff6b6b', 0.3);
        sfx('lose');
        return;
      }
      this.nextTurn();
    });
  }

  private fireEnemy(e: Unit) {
    if (e.dead) return; // killed during the windup — the corpse stays down
    {
      e.timer = (e.def.melee ? MELEE_TIMER : ENEMY_BASE_TIMER) * this.foeCdMult * this.ascTimerMult() * (e.enraged ? 0.66 : 1);
      if (e.boss) {
        this.bossAttack(e);
      } else if (e.supp === 'aegis') {
        // guardians ward their weakest ally — the bubble eats one whole
        // hit, so the pack keeps its bodies until the ward is broken
        const ward = this.enemies
          .filter((a) => !a.dead && a !== e && a.shieldN <= 0)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (ward) {
          ward.shieldN = 1;
          this.texts.push({ x: ward.x, y: ward.y - ward.r - 8, text: 'WARDED!', t: 0.9, color: '#9df0ff', big: false });
          sfx('heal');
        } else {
          // nobody left to protect — the guardian fights like fodder
          const target = this.players.filter((p) => !p.dead).sort((a, b) => dist(e, a) - dist(e, b))[0];
          if (target) {
            sfx('zap');
            this.damagePlayer(target, physDamage(e.def.stats.atk, target.def.stats.def, 1, zapPower), e);
            if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
          }
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
          this.texts.push({ x: wounded.x, y: wounded.y - wounded.r - 8, text: `+${amt}`, t: 0.9, color: '#9df09d', big: false });
          sfx('heal');
        } else {
          const target = this.players.filter((p) => !p.dead).sort((a, b) => dist(e, a) - dist(e, b))[0];
          if (target) {
            sfx('zap');
            this.damagePlayer(target, physDamage(e.def.stats.atk, target.def.stats.def, 1, zapPower), e);
            if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
          }
        }
      } else if (e.def.melee) {
        // melee enemies lunge instead of zapping — the dash plays out over
        // the next moments while you're lining up your shot
        const target = this.players.filter((p) => !p.dead).sort((a, b) => dist(e, a) - dist(e, b))[0];
        if (target) {
          e.lunging = 1.4;
          sfx('launch');
        }
      } else {
        const target = this.players.filter((p) => !p.dead).sort((a, b) => dist(e, a) - dist(e, b))[0];
        if (target) {
          sfx('zap');
          this.damagePlayer(target, physDamage(e.def.stats.atk, target.def.stats.def, 1, zapPower), e);
          if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
        }
      }
    }
  }

  private damagePlayer(p: Unit, dmg: number, src?: Unit) {
    // flying trait: incoming attacks whiff outright — surfaced so a zero
    // never reads as a bug
    if (this.t('flying') > 0 && this.rng() < Math.min(0.25, this.t('flying') * 0.07)) {
      this.texts.push({ x: p.x, y: p.y - p.r - 8, text: 'MISS!', t: 0.8, color: '#a890f0', big: false });
      return;
    }
    // foes hit harder the deeper the run goes — depth 6 lands ~1.7x;
    // +15% base pressure, +8% per wave so wave 3 actually threatens.
    // rock trait shaves every hit; the waveShots ramp is the anti-stall —
    // after 10 unanswered shots a wave fights back harder each turn
    const pressure = 1 + Math.max(0, this.waveShots - 10) * 0.12;
    dmg = Math.max(1, Math.round(dmg * this.takenMult * (1 - this.t('rock') * 0.07) * pressure * 1.15 * (1 + this.depth * 0.12 + this.waveIndex * 0.08 + this.asc * 0.08)));
    if (p.role === 'tank') dmg = Math.max(1, Math.round(dmg * 0.75));
    if (p.sash && dmg >= p.hp) {
      // focus sash: hang on at 1 HP
      p.sash = false;
      dmg = p.hp - 1;
      this.texts.push({ x: p.x, y: p.y - p.r - 20, text: 'FOCUS SASH!', t: 1.1, color: '#ffd84d', big: false });
    }
    p.hp -= dmg;
    this.texts.push({ x: p.x, y: p.y - p.r - 8, text: `-${dmg}`, t: 0.9, color: '#ff6b6b', big: false });
    // survived on fumes — the clutch beat deserves a callout
    if (p.hp > 0 && p.hp <= p.maxHp * 0.15) {
      this.texts.push({ x: p.x, y: p.y - p.r - 34, text: 'BARELY!', t: 0.9, color: '#ffd84d', big: false });
    }
    this.addShake(3);
    this.burst(p.x, p.y, '#ff6b6b', 9, 360);
    sfx('hurt');
    buzz(20);
    if (p.hp <= 0) {
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
      this.texts.push({ x: p.x, y: p.y - p.r - 30, text: 'REVENGE!', t: 1.1, color: '#f85888', big: true });
      // a KO mid-aim (lunge/orb/wave) strands the turn on a corpse —
      // drop the drag and hand off, or end the run if it was the last
      if (p === this.active && this.phase === 'aim') {
        this.dragging = false;
        this.nextTurn();
      }
    }
  }

  private nextTurn() {
    if (this.phase === 'won' || this.phase === 'lost') return;
    for (let i = 1; i <= this.players.length; i++) {
      const idx = (this.activeIdx + i) % this.players.length;
      if (!this.players[idx].dead) {
        this.activeIdx = idx;
        this.phase = 'aim';
        const a = this.players[idx];
        this.texts.push({
          x: a.x, y: a.y - a.r - 8,
          // a charged super fires on launch — the GO! call is where it's taught
          text: `GO! ${a.def.name.toUpperCase()}${a.cd <= 0 ? ' — SUPER READY!' : ''}`,
          t: 1, color: TYPE_COLOR[a.def.type], big: true,
        });
        return;
      }
    }
    this.phase = 'lost';
  }

  // --- vfx helpers ---

  private screenFlash(color: string, t: number) {
    this.flashes.push({ t, life: t, color });
  }

  private addShake(amt: number) {
    this.shake = Math.min(this.shake + amt, 36);
  }

  private addPunch(amt: number) {
    this.punch = Math.min(this.punch + amt, 0.22);
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

    // arena: theme-tinted backdrop + rim
    drawBackdrop(ctx, a, 18, this.theme, this.time);
    drawWall(ctx, a, this.theme);

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
      const AMBIENT: Record<Theme, { n: number; col: string; vx: number; vy: number; r: number; tw: number; wob: number }> = {
        grove: { n: 16, col: '#cfe898', vx: 18, vy: 16, r: 2.1, tw: 0.1, wob: 26 }, // petals fall on the breeze
        cavern: { n: 12, col: '#8a94c0', vx: 6, vy: 8, r: 1.7, tw: 0.16, wob: 12 }, // dust hangs in the light shafts
        volcano: { n: 20, col: '#ff9d4d', vx: 10, vy: -34, r: 2.0, tw: 0.3, wob: 18 }, // embers climb, flicker hard
        sky: { n: 16, col: '#ffffff', vx: -16, vy: 24, r: 1.9, tw: 0.12, wob: 20 }, // snow slants downwind
      };
      const amb = AMBIENT[this.theme];
      ctx.fillStyle = amb.col;
      for (let k = 0; k < amb.n; k++) {
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

    // field pickups: a soft halo under a bobbing item icon
    for (const pk of this.pickups) {
      const bob = Math.sin(this.time * 3 + pk.t) * 2.5;
      ctx.globalAlpha = 0.22 + Math.sin(this.time * 3 + pk.t) * 0.06;
      ctx.fillStyle = '#fff8dc';
      ctx.beginPath();
      ctx.ellipse(pk.x, pk.y + 9, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      const img = itemSprite(pk.kind);
      if (img) ctx.drawImage(img, pk.x - 13, pk.y - 13 + bob, 26, 26);
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

    // caught mons: real poké ball drops in and does the triple-wiggle
    for (const b of this.balls) {
      const img = itemSprite(b.item);
      if (!img) continue;
      const prog = 1 - b.t / b.life;
      const drop = Math.min(prog * 3.2, 1); // fast drop-in
      ctx.save();
      ctx.translate(b.x, b.y - (1 - drop) * 70);
      if (prog > 0.32) ctx.rotate(Math.sin(prog * 40) * 0.4 * Math.min((prog - 0.3) * 5, 1));
      ctx.drawImage(img, -15, -15, 30, 30);
      ctx.restore();
    }


    for (const o of this.orbs) {
      ctx.save();
      ctx.shadowColor = o.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.arc(o.x, o.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(o.x - 2, o.y - 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }


    // beam afterglow — a fading bright line over the field; signature
    // beams carry their own color and a fat core
    for (const bm of this.beams) {
      const alpha = bm.t / bm.life;
      const w = bm.w ?? 1;
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
          ctx.fillStyle = f.color;
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.28, -s * 0.28);
          ctx.lineTo(s, 0);
          ctx.lineTo(s * 0.28, s * 0.28);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.28, s * 0.28);
          ctx.lineTo(-s, 0);
          ctx.lineTo(-s * 0.28, -s * 0.28);
          ctx.closePath();
          ctx.fill();
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
      const pop = 1 + Math.max(0, t.t - 0.72) * (t.big ? 4.5 : 1.8);
      ctx.globalAlpha = Math.min(t.t / 0.3, 1);
      ctx.font = font(16 * pop * (t.size ?? 1));
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = t.big ? 4 : 3;
      const dy = (0.9 - t.t) * 52;
      ctx.strokeText(t.text, t.x, t.y - dy);
      ctx.fillText(t.text, t.x, t.y - dy);
    }
    ctx.globalAlpha = 1;

    if (this.dragging) this.drawAim(ctx);
    else if (this.phase === 'aim' && !this.active.dead) {
      // ghost sweep sells the timing game before the first touch
      const ph = this.time % 1.7;
      const gfrac = ph < 0.85 ? ph / 0.85 : (1.7 - ph) / 0.85;
      const z = this.sweetSpot();
      ctx.globalAlpha = 0.55;
      this.drawMeter(ctx, gfrac, Math.abs(gfrac - z.c) <= z.hw, TYPE_COLOR[this.active.def.type]);
      ctx.globalAlpha = 1;
    }

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
      const label = `COMBO ×${this.shotCombo}`;
      ctx.strokeText(label, this.arena.x + this.arena.w / 2, this.arena.y - 18);
      ctx.fillText(label, this.arena.x + this.arena.w / 2, this.arena.y - 18);
    }

    // screen flashes render unshaken, on top
    for (const f of this.flashes) {
      ctx.globalAlpha = Math.max(f.t / f.life, 0) * 0.42;
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, W_CANVAS_FALLBACK, 2000);
    }
    ctx.globalAlpha = 1;
    // wipe pressure: a nearly-dead team breathes a red vignette — the danger
    // is felt at the edges before anyone reads a health bar
    if (this.phase === 'aim' || this.phase === 'shot' || this.phase === 'enemy') {
      const alive = this.players.filter((p) => !p.dead);
      if (alive.length) {
        const avg = alive.reduce((s, p) => s + p.hp / p.maxHp, 0) / alive.length;
        if (alive.length === 1 || avg < 0.35) {
          const pulse = 0.10 + Math.sin(this.time * 4) * 0.05;
          const g = ctx.createRadialGradient(270, 480, 220, 270, 480, 560);
          g.addColorStop(0, 'rgba(200,30,30,0)');
          g.addColorStop(1, `rgba(200,30,30,${pulse})`);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W_CANVAS_FALLBACK, 2000);
        }
      }
    }

    // foes remaining, top-right — the wave's progress bar
    const left = this.enemies.filter((e) => !e.dead).length;
    if ((this.phase === 'aim' || this.phase === 'shot' || this.phase === 'enemy') && left > 0) {
      ctx.font = font(9);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#8890b8';
      ctx.fillText(`${left} LEFT`, a.x + a.w - 8, a.y + 16);
      // pause chip, opposite corner — a quiet brake during the action
      const c = this.pauseChip();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#101430';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#8890b8';
      ctx.fillRect(c.x + 10, c.y + 8, 4, 14);
      ctx.fillRect(c.x + 17, c.y + 8, 4, 14);
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

    // ascension tag — why the mobs feel bulkier today, and which
    // named modifiers are stacked on
    if (this.asc > 0) {
      const mods = [`ASC ${this.asc}`];
      if (this.asc >= 2) mods.push('FOES WIND UP FAST');
      if (this.asc >= 4) mods.push('RESTS WEAKENED');
      if (this.asc >= 6) mods.push('BOSSES ENRAGED');
      ctx.font = font(9);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f0b02f';
      ctx.fillText(mods.join(' · '), a.x + 8, a.y + 16);
    }

    // tapped-foe scout card — floats while aiming, a pull dismisses it
    if (this.inspect && this.phase === 'aim') this.drawInspect(ctx);

    // onboarding: the first run gets kinetic coaching (a ghost pull on
    // loop); after that the same two faint captions show on any run
    if (this.phase === 'aim' && !this.dragging && !this.active.dead) {
      if (this.coach) this.drawCoach(ctx);
      else if (this.shots < 2) {
        ctx.globalAlpha = 0.55 + Math.sin(this.time * 4) * 0.3;
        ctx.font = font(9);
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
      // fit against the popped scale too, or the pop clips at spawn
      ctx.font = `bold 34px Georgia, serif`;
      const fit = Math.min(1, (W_CANVAS_FALLBACK - 48) / (ctx.measureText(label).width * scaleIn));
      ctx.font = `bold ${Math.round(34 * scaleIn * fit)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f0e6c8';
      ctx.fillText(label, a.x + a.w / 2, cy + 12);
      // the sky calls itself out in the ribbon — weather tilts the matchup
      if (this.weather) {
        ctx.font = font(11);
        ctx.fillStyle = WEATHER_TINT[this.weather];
        ctx.fillText(WEATHER_LINE[this.weather], a.x + a.w / 2, cy - 12);
      }
      // boss weak points are the gym's whole trick — say it on the banner
      if (gym) {
        ctx.font = font(11);
        ctx.fillStyle = '#ffd84d';
        ctx.fillText('HIT THE GOLD SPOT FOR ×3 DAMAGE', a.x + a.w / 2, cy + 52);
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
    }
  }

  // The scout card: tapping a foe (instead of pulling) answers "what is
  // that thing about to do" — name, bulk, type, and its attack countdown.
  private drawInspect(ctx: CanvasRenderingContext2D) {
    const e = [...this.enemies, ...this.players].find((x) => x.uid === this.inspect!.uid);
    if (!e || e.dead) return;
    const foe = e.side === 'enemy';
    const a = this.arena;
    const w = 176;
    const h = foe ? 76 : 92; // teammates get a line for what the super does
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
    ctx.textAlign = 'left';
    ctx.font = font(10);
    ctx.fillStyle = '#f0e6c8';
    ctx.fillText(`${e.shiny ? '★ ' : ''}${e.def.name.toUpperCase()}  Lv${e.lvl}`, cx + 50, cy + 16);
    // hp bar — the number players actually scout for
    ctx.fillStyle = '#2a3050';
    ctx.fillRect(cx + 50, cy + 24, w - 62, 7);
    ctx.fillStyle = e.hp / e.maxHp > 0.3 ? '#6fdc6f' : '#ff6b6b';
    ctx.fillRect(cx + 50, cy + 24, (w - 62) * Math.max(0, e.hp / e.maxHp), 7);
    ctx.font = font(8);
    ctx.fillStyle = '#8890b8';
    ctx.fillText(`${Math.ceil(e.hp)}/${e.maxHp}`, cx + 50, cy + 42);
    ctx.fillStyle = TYPE_COLOR[e.def.type];
    ctx.textAlign = 'right';
    ctx.fillText(e.def.type2 ? `${e.def.type}/${e.def.type2}`.toUpperCase() : e.def.type.toUpperCase(), cx + w - 10, cy + 16);
    // the readout — foes show their attack clock; teammates show their super
    ctx.textAlign = 'left';
    ctx.font = font(8);
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
      ctx.fillText(tag, cx + 50, cy + 58);
      ctx.fillStyle = '#6a7498';
      ctx.font = font(7);
      ctx.fillText(e.def.melee ? 'melee — lunges into your team' : 'ranged — fires from range', cx + 50, cy + 70);
    } else {
      ctx.fillStyle = '#ffd84d';
      ctx.fillText(`★ ${moveOf(e.def.id, e.def.type)}`, cx + 50, cy + 58);
      ctx.fillStyle = e.cd <= 0 ? '#6fdc6f' : '#8890b8';
      ctx.font = font(7);
      ctx.fillText(
        e.cd <= 0 ? `super ready — launch ${e.def.name} to fire it` : `super ready in ${e.cd} shot${e.cd === 1 ? '' : 's'}`,
        cx + 50,
        cy + 70,
      );
      ctx.fillStyle = '#6a7498';
      ctx.fillText(SUPER_DESC[e.def.type], cx + 50, cy + 82);
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
      ctx.font = font(10);
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
      const tgt = this.enemies
        .filter((e) => !e.dead)
        .sort((x, y) => Math.hypot(x.x - u.x, x.y - u.y) - Math.hypot(y.x - u.x, y.y - u.y))[0];
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
        line('FLY THROUGH A TEAMMATE — THE PASS SPEEDS THE BALL UP');
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
  // 3rd, trainer squads, chests, Poké Center rests — with the next wave's
  // wilds previewed up top like a Monster Strike quest banner.
  private drawRegion(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#0a0e1c';
    ctx.fillRect(0, 0, 540, 960);
    ctx.textAlign = 'center';
    ctx.font = font(22);
    ctx.fillStyle = '#f8d030';
    ctx.fillText(this.stage.name.toUpperCase(), 270, 64);
    ctx.font = font(12);
    ctx.fillStyle = '#8890b8';
    ctx.fillText(`STAGE ${this.pendingNext + 1} OF ${TOTAL_STAGES}`, 270, 88);

    // who's waiting at the next stop — gyms show their boss
    const seen = new Set<number>();
    const preview = (this.stage.waves[this.pendingNext] ?? [])
      .filter((s) => !seen.has(s.def.id) && seen.add(s.def.id))
      .slice(0, 4);
    preview.forEach((s, i) => {
      const x = 270 - preview.length * 17 + i * 34 + 17;
      try {
        drawMon(ctx, s.def.id, x, 112, 30); // unspawned waves may not be loaded yet
      } catch {
        return;
      }
      if (s.boss) {
        ctx.strokeStyle = '#f0b02f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, 112, 18, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    if (!preview.length && this.pendingNext > this.waveIndex) {
      // rolled rows deal their wave when the stop is picked — unknowns for now
      ctx.font = font(16);
      ctx.fillStyle = '#3a4370';
      ctx.fillText('?  ?  ?', 270, 118);
    }

    const cell = MAP_CELL, ox = MAP_OX, oy = MAP_OY;
    const cam = Math.round(this.mapCam * cell) / cell; // pixel-snap keeps the baked tiles crisp
    const view = MAP_VIEW;
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
      // current triplet (battle → utility → gym) is ever on screen
      ctx.drawImage(this.regionBase, 0, cam * cell, MAP_W * cell, view * cell, ox, oy, MAP_W * cell, view * cell);
      // only the water glints stay live
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < MAP_W; x++) {
          if (this.region.tiles[y * MAP_W + x] !== T_WATER || this.region.route.has(y * MAP_W + x)) continue;
          if ((x * 7 + y * 11 + sparkle) % 23 === 0) {
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
            if ((x * 7 + y * 11 + sparkle) % 23 === 0) {
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
    ctx.rect(ox - 6, oy - 6, MAP_W * cell + 12, view * cell + 12);
    ctx.clip();
    // the trainer waits at the current stop, or walks the carved route
    // to the one you tapped — overworld style
    const at = this.region.nodes[this.mapNode];
    let lx = at ? at.tx : 0;
    let ly = at ? at.ty : 0;
    let frame = 'may_down_0';
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
      frame = `may_${dir}_${[1, 0, 2][Math.floor(this.time * 8) % 3]}`;
    }
    if (at) {
      const bob = this.mapWalk ? 0 : Math.sin(this.time * 4) * 1.5;
      drawNpc(ctx, frame, ox + lx * cell + cell / 2, oy + (ly - cam) * cell + cell * 0.55 + bob, cell * 1.7);
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
      if (n.ty - cam < -3 || n.ty - cam > view + 1) return; // offscreen row
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
        ctx.fillText('?', nx, ny - 1);
      } else {
        const icon = n.kind === 'gym' ? MT.TILE_GYM : MT.TILE_TOWN; // start + rest are towns
        drawTile(ctx, icon, nx - cell, ny - cell * 1.35, cell * 2, cell * 2);
        if (n.kind === 'rest') {
          const potion = itemSprite('max-potion');
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
      if (n.row < this.pendingNext || n.ty - cam < -3 || n.ty - cam > view + 1) return;
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
      // matchup is a choice, not a coin flip
      if (n.kind === 'trainer' || n.kind === 'elite') {
        const ty = (n.ttype ?? 'normal').toUpperCase();
        ctx.font = font(8);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(ty, nx, ny - cell * 1.55 + 12);
        ctx.fillStyle = TYPE_COLOR[n.ttype ?? 'normal'];
        ctx.fillText(ty, nx, ny - cell * 1.55 + 12);
      }
    });
    ctx.restore(); // end island clip
    ctx.strokeStyle = '#2a3560';
    ctx.lineWidth = 3;
    ctx.strokeRect(ox - 8, oy - 8, MAP_W * cell + 16, view * cell + 16);
    // sheers at both edges sell the scroll — the island keeps going
    for (const [fy, up] of [[oy, 0], [oy + view * cell, 1]] as const) {
      const g2 = ctx.createLinearGradient(0, fy, 0, up ? fy - cell * 1.6 : fy + cell * 1.6);
      g2.addColorStop(0, 'rgba(10,14,28,0.7)');
      g2.addColorStop(1, 'rgba(10,14,28,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(ox - 4, up ? fy - cell * 1.6 : fy, MAP_W * cell + 8, cell * 1.6);
    }
    // soft vignette keeps the eye on the island
    const vg = ctx.createRadialGradient(270, oy + view * cell / 2, 200, 270, oy + view * cell / 2, 520);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, 540, 960);
    ctx.font = font(12);
    ctx.fillStyle = '#aab4d8';
    ctx.fillText('choose your route: tap a linked stop', 270, oy + view * cell + 30);
    ctx.font = font(9);
    ctx.fillStyle = '#6a7498';
    ctx.fillText('WILD catchable fight · TRAINER mono-type squad — no catches, better loot', 270, oy + view * cell + 48);
    ctx.fillText('CHEST item, then a fight · REST heal+revive · ??? surprise · ELITE rare loot · GYM boss', 270, oy + view * cell + 64);
    // resolved events and egg ticks surface as a toast over the island
    if (this.mapMsgT > 0 && this.mapMsg) {
      ctx.globalAlpha = Math.min(1, this.mapMsgT);
      ctx.font = font(13);
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
    // team strip under the legend — who's hurt decides whether you route
    // the REST; this is the read that makes the map a decision
    {
      const py = oy + view * cell + 114;
      ctx.font = font(8);
      ctx.textAlign = 'center';
      const px0 = 270 - (this.players.length - 1) * 36;
      this.players.forEach((p, i) => {
        const px = px0 + i * 72;
        ctx.globalAlpha = p.dead ? 0.3 : 1;
        (p.shiny ? drawShiny : drawMon)(ctx, p.def.id, px, py, 34);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000a';
        ctx.fillRect(px - 17, py + 21, 34, 5);
        if (p.dead) {
          ctx.fillStyle = '#ff6b6b';
          ctx.fillText('KO', px, py + 25);
        } else {
          const pct = Math.max(0, p.hp / p.maxHp);
          ctx.fillStyle = pct > 0.5 ? '#6fdc6f' : pct > 0.25 ? '#ffd84d' : '#ff6b6b';
          ctx.fillRect(px - 17, py + 21, 34 * pct, 5);
        }
      });
    }
    // a resolved ? event tells its story in a proper FRLG text box —
    // modal: dims the map, waits for a tap
    if (this.eventBox) {
      ctx.fillStyle = 'rgba(4,6,16,0.55)';
      ctx.fillRect(0, 0, 540, 960);
      const by = this.drawMapTextBox(ctx, this.eventBox);
      // FRLG continue arrow — blink so it reads as waiting for the tap
      if (Math.sin(this.time * 6) > -0.3) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffd84d';
        ctx.fillText('▼', 20 + 500 - 18, by + this.textBoxH - 14);
      }
      ctx.textAlign = 'center';
    }
    // a choice ? asks — prompt card up top, tappable option buttons under it
    if (this.eventChoice) {
      ctx.fillStyle = 'rgba(4,6,16,0.55)';
      ctx.fillRect(0, 0, 540, 960);
      const by = this.drawMapTextBox(ctx, this.eventChoice.prompt);
      const bw = 380, bh = 46, gap = 10;
      const opts = this.eventChoice.options;
      const oy = by - 18 - opts.length * bh - (opts.length - 1) * gap;
      this.choiceHit = opts.map((_, i) => ({
        x: (540 - bw) / 2,
        y: oy + i * (bh + gap),
        w: bw,
        h: bh,
      }));
      ctx.font = font(11);
      ctx.textAlign = 'center';
      this.choiceHit.forEach((r, i) => {
        roundRect(ctx, r.x, r.y, r.w, r.h, 10);
        ctx.fillStyle = '#12162b';
        ctx.fill();
        ctx.strokeStyle = i === 0 ? '#ffd84d' : '#c8a44d';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#f0e6c8';
        ctx.fillText(opts[i].label, r.x + r.w / 2, r.y + 28);
      });
    }
  }

  private textBoxH = 0; // last prompt height — the ▼ arrow reads it
  // Shared FRLG text box: word-wraps into the bottom card, returns its top y.
  private drawMapTextBox(ctx: CanvasRenderingContext2D, text: string) {
    const bx = 20, bw = 500;
    ctx.font = font(13);
    const lines: string[] = [];
    let line = '';
    for (const w of text.split(' ')) {
      const t = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(t).width > bw - 56) { lines.push(line); line = w; }
      else line = t;
    }
    lines.push(line);
    const bh = 48 + lines.length * 24;
    const by = 960 - bh - 40;
    this.textBoxH = bh;
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fillStyle = '#12152bf4';
    ctx.fill();
    ctx.strokeStyle = '#ffd84d';
    ctx.lineWidth = 3;
    ctx.stroke();
    roundRect(ctx, bx + 5, by + 5, bw - 10, bh - 10, 6);
    ctx.strokeStyle = '#c8a44d';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f0e6c8';
    lines.forEach((l, i) => ctx.fillText(l, bx + 26, by + 36 + i * 24));
    return by;
  }

  // Court weather: a faint sky-colored wash plus directional motes — rain
  // slants down, embers climb in the sun, sand drifts, wind streaks by.
  private drawWeather(ctx: CanvasRenderingContext2D) {
    const w = this.weather;
    if (!w) return;
    const a = this.arena;
    const TAU = Math.PI * 2;
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, a.x, a.y, a.w, a.h, 18);
    ctx.clip();
    ctx.fillStyle = WEATHER_TINT[w];
    ctx.globalAlpha = 0.06;
    ctx.fillRect(a.x, a.y, a.w, a.h);
    const t = this.time;
    for (let i = 0; i < 24; i++) {
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
    const targets = this.players
      .filter((p) => !p.dead)
      .sort((a, b) => dist(e, a) - dist(e, b));
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
    const t = this.players.filter((p) => !p.dead).sort((a, b) => dist(e, a) - dist(e, b))[0];
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
    // everyone breathes a little — a standing army reads as a dead board
    const bob = Math.sin(this.time * 2.4 + u.uid * 1.7) * 1.2;
    if (st > 0.02) {
      ctx.save();
      ctx.translate(u.x, u.y + bob);
      if (spd > 40) ctx.rotate(Math.atan2(u.vy, u.vx));
      ctx.scale(1 + st, Math.max(0.55, 1 - st * 0.7));
      if (u.shiny) drawShiny(ctx, u.def.id, 0, 0, u.r * 2.6);
      else drawMon(ctx, u.def.id, 0, 0, u.r * 2.6);
      ctx.restore();
    } else {
      if (u.shiny) drawShiny(ctx, u.def.id, u.x, u.y + bob, u.r * 2.6);
      else drawMon(ctx, u.def.id, u.x, u.y + bob, u.r * 2.6);
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
        ctx.beginPath();
        ctx.moveTo(sx, sy - s);
        ctx.lineTo(sx + s * 0.4, sy - s * 0.4);
        ctx.lineTo(sx + s, sy);
        ctx.lineTo(sx + s * 0.4, sy + s * 0.4);
        ctx.lineTo(sx, sy + s);
        ctx.lineTo(sx - s * 0.4, sy + s * 0.4);
        ctx.lineTo(sx - s, sy);
        ctx.lineTo(sx - s * 0.4, sy - s * 0.4);
        ctx.closePath();
        ctx.fill();
      }
    }

    // hp bar
    const bw = u.r * 2;
    const pct = Math.max(u.hp / u.maxHp, 0);
    ctx.fillStyle = '#000a';
    ctx.fillRect(u.x - bw / 2, u.y + u.r + 4, bw, 5);
    ctx.fillStyle = pct > 0.5 ? '#6fdc6f' : pct > 0.25 ? '#ffd84d' : '#ff6b6b';
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
      // boss weak point: a drifting gold star on the rim — contact on that
      // face pays triple. MS's core precision tell.
      if (u.boss && !u.dead) {
        const wx = u.x + Math.cos(u.weakA) * u.r * 0.92;
        const wy = u.y + Math.sin(u.weakA) * u.r * 0.92;
        const s = 7 + Math.sin(this.time * 6) * 2;
        ctx.fillStyle = '#ffd84d';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wx, wy - s);
        ctx.lineTo(wx + s * 0.4, wy - s * 0.4);
        ctx.lineTo(wx + s, wy);
        ctx.lineTo(wx + s * 0.4, wy + s * 0.4);
        ctx.lineTo(wx, wy + s);
        ctx.lineTo(wx - s * 0.4, wy + s * 0.4);
        ctx.lineTo(wx - s, wy);
        ctx.lineTo(wx - s * 0.4, wy - s * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
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
      // attack countdown — ★ marks a signature attack, red when it fires next
      ctx.font = font(10);
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      const tag = u.boss ? `★${Math.ceil(u.timer)}` : `${Math.ceil(u.timer)}`;
      ctx.strokeText(tag, u.x + u.r - 2, u.y - u.r + 7);
      ctx.fillStyle = u.timer <= 1 || u.enraged ? '#ff6b6b' : '#fff';
      ctx.fillText(tag, u.x + u.r - 2, u.y - u.r + 7);
      // keyword flags — the counter-mechanics read at a glance
      const kw = u.def.taunt ? 'MAGNET' : u.def.cursed ? 'CURSE' : '';
      if (kw) {
        ctx.font = font(8);
        ctx.strokeText(kw, u.x, u.y + u.r + 14);
        ctx.fillStyle = u.def.taunt ? '#ffd84d' : '#a868c8';
        ctx.fillText(kw, u.x, u.y + u.r + 14);
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
      // level tag on grown mons — KO'ing with a mon feeds it a level
      if (u.lvl > 1) {
        ctx.font = font(8);
        ctx.textAlign = 'left';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.5;
        ctx.strokeText(`Lv${u.lvl}`, u.x - u.r - 4, u.y + u.r + 16);
        ctx.fillStyle = '#9df0ff';
        ctx.fillText(`Lv${u.lvl}`, u.x - u.r - 4, u.y + u.r + 16);
      }
      if (u.cd <= 0) {
        // ready: the move's name sits overhead — this is the thing to hit
        const label = moveOf(u.def.id, u.def.type);
        const ly = u.y + u.r + 30;
        ctx.font = font(8);
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
        const ty = u.y - u.r - 14;
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
        ctx.font = font(10);
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeText(u.def.name.toUpperCase(), u.x, ty - 17);
        ctx.fillStyle = '#ffd84d';
        ctx.fillText(u.def.name.toUpperCase(), u.x, ty - 17);
      }
    }
  }

  // The release-timing bar — "release in the gold" only teaches if the
  // gold is on screen, so it renders during aim even before the first
  // drag: a ghost fill sweeps the bar to show the ping-pong rhythm.
  private drawMeter(ctx: CanvasRenderingContext2D, frac: number, lit: boolean, color: string) {
    const a = this.arena;
    const zone = this.sweetSpot();
    const bw = Math.min(320, a.w * 0.64);
    const bh = 16;
    const bx = a.x + (a.w - bw) / 2;
    const by = a.y + 14;
    ctx.fillStyle = 'rgba(10,14,32,0.8)';
    ctx.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
    ctx.strokeStyle = '#0a0e20';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 4, by - 4, bw + 8, bh + 8);
    ctx.fillStyle = '#ffffff1c';
    ctx.fillRect(bx, by, bw, bh);
    // gold zone = the perfect-release window the fill ping-pongs into;
    // its spot on the bar is the mon's own (speed-keyed), lit when hit
    ctx.fillStyle = lit ? '#ffd84d55' : '#ffd84d33';
    ctx.fillRect(bx + bw * (zone.c - zone.hw), by, bw * 2 * zone.hw, bh);
    ctx.save();
    if (lit) {
      ctx.shadowColor = '#ffd84d';
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = lit ? '#ffd84d' : color;
    ctx.fillRect(bx, by, bw * frac, bh);
    ctx.restore();
    // gold ticks mark both edges of the max-power window
    ctx.fillStyle = '#ffd84d';
    ctx.fillRect(bx + bw * (zone.c - zone.hw), by - 3, 2, bh + 6);
    ctx.fillRect(bx + bw * (zone.c + zone.hw) - 2, by - 3, 2, bh + 6);
  }

  private drawAim(ctx: CanvasRenderingContext2D) {
    const u = this.active;
    const pull = { x: this.dragStart.x - this.dragNow.x, y: this.dragStart.y - this.dragNow.y };
    const pullLen = len(pull);
    if (pullLen < 12) return;
    const dir = norm(pull);
    const frac = this.charge();
    const zone = this.sweetSpot();
    const maxed = Math.abs(frac - zone.c) <= zone.hw;
    const color = TYPE_COLOR[u.def.type];
    const a = this.arena;

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
        BASE_SHOT_SPEED * POWER * launchMult(u.def.stats) * this.launchBoost * u.launch * (0.4 + 0.6 * (maxed ? 1 : frac));
      let sx = u.x, sy = u.y, svx = dir.x * speed, svy = dir.y * speed;
      const dots: Vec[] = [];
      let hit: Unit | null = null;
      let bounced = false;
      const cache = this.aimCache;
      const sb: Ball = { x: 0, y: 0, r: u.r, vx: 0, vy: 0 };
      sim: for (let i = 0; i < 60; i++) {
        if (bounced) break;
        const step = 1 / 30;
        const damp = Math.exp(-FRICTION * step);
        svx *= damp;
        svy *= damp;
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
      const { dots, hit, bounced } = this.aimCache;
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
      // predicted contact damage over the first catch — the shot is the
      // puzzle, so the answer is honest: type mult + taunt block, no crits
      if (hit && !hit.dead) {
        const taunted = this.enemies.some((x) => !x.dead && x.def.taunt) && !hit.def.taunt;
        let label: string;
        let lc = '#ffffff';
        if (taunted) {
          label = 'BLOCKED';
          lc = '#8a90a8';
        } else {
          const at = strikeType(u.def, hit.def);
          const mult = typeMult(at, hit.def) * weatherMult(this.weather, at);
          const est = Math.max(1, Math.round(
            physDamage(u.def.stats.atk, hit.def.stats.def, mult) *
              u.pow * this.physMult * this.dmgMult * (this.typePow[at] ?? 1) *
              (hit.boss ? 1 + this.bossSlayer : 1),
          ));
          label = est >= hit.hp ? `≈${est} KO` : `≈${est}`;
          lc = est >= hit.hp ? '#ffd84d' : '#ffffff';
        }
        ctx.font = font(9);
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(label, hit.x, hit.y - hit.r - 20);
        ctx.fillStyle = lc;
        ctx.fillText(label, hit.x, hit.y - hit.r - 20);
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
    ctx.save();
    if (maxed) {
      ctx.shadowColor = '#ffd84d';
      ctx.shadowBlur = 12;
    }
    ctx.strokeStyle = maxed ? '#ffd84d' : color;
    ctx.beginPath();
    ctx.arc(u.x, u.y, rr, a0, a0 + Math.PI * 2 * frac);
    ctx.stroke();
    ctx.restore();

    // launch arrow: unit -> opposite direction, length + glow from charge
    const ex = u.x + dir.x * (50 + frac * 160);
    const ey = u.y + dir.y * (50 + frac * 160);
    ctx.save();
    if (maxed) {
      ctx.shadowColor = '#ffd84d';
      ctx.shadowBlur = 16;
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
    const hs = 14;
    const px = -dir.y;
    const py = dir.x;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ex + dir.x * hs, ey + dir.y * hs);
    ctx.lineTo(ex + px * hs * 0.6, ey + py * hs * 0.6);
    ctx.lineTo(ex - px * hs * 0.6, ey - py * hs * 0.6);
    ctx.fill();
    ctx.restore();
  }

  private drawWave(ctx: CanvasRenderingContext2D, w: Wave) {
    const alpha = Math.max(w.t / w.life, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // translucent body — the shockwave's mass, fading as it expands
    ctx.globalAlpha = alpha * 0.16;
    ctx.fillStyle = w.color;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.fill();
    // glowing rim
    ctx.globalAlpha = alpha;
    ctx.shadowColor = w.color;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = w.color;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // hot white leading edge — the anime energy front
    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(w.x, w.y, Math.max(0, w.r - 5), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

}

// flashes are drawn in logical coords; arena is at most this wide
const W_CANVAS_FALLBACK = 540;

// each element's super gets its own sound flavor
const SUPER_SFX: Record<PokeType, Sfx> = {
  fire: 'boom', electric: 'zap', grass: 'heal', water: 'splash',
  psychic: 'zap', flying: 'splash', poison: 'boom', rock: 'boom',
  fighting: 'boom', ghost: 'zap', normal: 'hit',
};


