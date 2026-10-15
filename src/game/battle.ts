import { Vec, len, dist, norm, vec } from '../core/vec';
import { drawMon, drawShiny, itemSprite } from '../core/assets';
import { sfx, buzz, cry } from '../core/audio';
import type { Sfx } from '../core/audio';
import { SpeciesDef, StageDef, rollWave, TOTAL_STAGES, ROSTER, ELITES, EVOS, INVADERS, ENEMY_DB, hazardsFor, rivalWave, BLOCK_LAYOUTS } from './data';
import { Perk, rollPerks } from './perks';
import type { Rarity } from './perks';
import { drawBackdrop, drawWall, THEMES } from './bg';
import type { Theme } from './bg';
import { effectiveness, TYPE_COLOR } from './types';
import { genRegion, RegionMap, MapNode, MAP_W, MAP_H, drawTile, T_WATER, T_SAND } from './map';
import * as MT from './maptiles';
import { gracidea } from '../core/assets';
import type { PokeType } from './types';
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
} from './stats';
import type { Role } from './stats';
import { font } from './screens';

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
  wpA: number; // weak-point angle on the body, -1 = none (elites only)
  hzT: number; // last hazard tick — throttles lava/spike chips and burns
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
  big: boolean;
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
  kind: 'lava' | 'grass' | 'gust' | 'spikes' | 'static';
  x: number;
  y: number;
  r: number; // px radius of the zone
  dir?: number; // gust: push direction (+1/-1)
}
// Boss hyper beam: a bright line that fades fast after the shot lands.
interface Beam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
  life: number;
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
export type Phase = 'aim' | 'shot' | 'enemy' | 'reward' | 'map' | 'won' | 'lost';

const STOP_SPEED = 45;
const FINAL_DEPTH = TOTAL_STAGES - 3; // rolled stages: 4..9 are depths 1..6
const BASE_SHOT_SPEED = 190; // base launch speed — pull distance only aims
const POWER = 8;
const WALL_REST = 0.92;
const UNIT_REST = 0.9;
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
  waveIndex = 0;
  activeIdx = 0;
  shots = 0;
  time = 0;
  waveBanner = 0;

  private dragging = false;
  private dragStart: Vec = vec();
  private dragNow: Vec = vec();
  private dragT = 0; // hold time while dragging — drives the timing meter

  private stopTimer = 0;
  private enemyPhaseT = 0;
  private pendingAttacks: Unit[] = [];
  private bumpsThisShot = new Set<number>(); // allies whose super fired this shot
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
  shinyRate = 1; // 2 with the Shiny Charm dex milestone
  scoreMult = 1; // lucky egg: score amplifies — pairs meanly with the mart
  private lastContact = { t: -9, id: -1 }; // pinch window: last thing touched
  private shotHitN = new Map<number, number>(); // per-enemy hits this shot (decay)
  private waveHadGym = false; // scheduled boss wave — gymsBeaten accounting
  private inRival = false; // this wave is the rival echo fight
  private region: RegionMap; // the climb's world map — drawn between stages
  private regionBase: HTMLCanvasElement | null = null; // baked terrain — region never changes
  private pendingNext = 0; // wave the map interstitial leads into
  private mapNote = ''; // stop-flavor line shown on the region map
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
  wpBonus = 0; // weakness policy: extra weak-point damage
  // keyword relics — PINCH (two contacts in one window) / VOLLEY (ally bumps)
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
  eliteWave = false; // the wave just cleared was an elite one (bigger payout)
  lastRecruit: SpeciesDef | null = null; // stage's guaranteed catch, for the reward screen
  private rewardPending = false;
  private hpScale = 1;
  private theme: Theme; // current wave's scene — rotates each wave

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
      const hp = Math.round(playerHp(def.stats) * m.hp);
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
        lvl: 1,
        pow: m.pow,
        rngMul: m.range,
        launch: m.launch,
        cdMod: m.cdMod,
        lastHit: new Map(),
        wallN: 0,
        wpA: -1,
        hzT: -9,
      });
    });
    this.region = genRegion(Math.floor(this.rng() * 2 ** 31));
    this.spawnWave(0);
    this.phase = 'map'; // the climb starts on the region map, not mid-wave
  }

  get active(): Unit {
    return this.players[this.activeIdx];
  }

  get waveCount() {
    return this.stage.waves.length;
  }

  private spawnWave(i: number, elite = false) {
    this.waveIndex = i;
    // rolled rows don't exist until the stop is chosen — the node's kind
    // flavors the fight (elite road = tighter, richer pack)
    if (i >= this.stage.waves.length) {
      this.depth++;
      this.stage.waves.push(rollWave(this.rng, this.depth, elite, this.stage.theme));
    }
    this.eliteWave = elite;
    this.hpScale = 1 + this.depth * 0.25 + i * 0.12 + this.asc * 0.15; // wave 3 mobs are +24% tanky; ascension stacks on top
    // each wave is a new scene — rotate the flat theme
    const others = THEMES.filter((t) => t !== this.theme);
    this.theme = others[Math.floor(this.rng() * others.length)];
    // stale super timers mustn't carry hits into the fresh wave
    this.delays = [];
    this.waves = [];
    this.dashes = [];
    // a legendary can crash any non-boss wave past the first — MS invades;
    // a dead run's team can return as a rival fight — fail-forward echo
    let spawns = this.stage.waves[i];
    this.waveSpecial = null;
    this.waveHadGym = spawns.some((s) => s.boss);
    this.inRival = false;
    if (this.echo?.length && i > 0 && !this.waveHadGym && this.rng() < 0.15) {
      spawns = rivalWave(this.echo.map((e) => e.def), this.rng);
      this.waveSpecial = 'RIVAL BATTLE!';
      this.inRival = true;
      sfx('invade');
    } else if (i > 0 && !this.waveHadGym && this.rng() < 0.09 + this.rank * 0.03) {
      const inv = INVADERS[Math.floor(this.rng() * INVADERS.length)];
      spawns = [{ def: inv, nx: 0.5, ny: 0.3, boss: true }, ...spawns.slice(0, 2)];
      this.waveSpecial = `A WILD ${inv.name.toUpperCase()} APPEARED!`;
      sfx('invade');
    } else if (elite) {
      // elite stops on seeded rows still get their elite — appended here
      if (!this.waveHadGym && !spawns.some((s) => ELITE_IDS.has(s.def.id))) {
        spawns = [...spawns, { def: ELITES[Math.floor(this.rng() * ELITES.length)], nx: 0.25 + this.rng() * 0.5, ny: 0.15 + this.rng() * 0.15 }];
      }
      this.waveSpecial = 'THE ELITE ROAD!';
    }
    if (!this.waveSpecial && this.mapNote) this.waveSpecial = this.mapNote;
    // Archero-style room furniture: seeded stone clusters the ball banks
    // off. Boss rooms stay open — the leader fight is the spectacle;
    // elite roads are always furnished.
    const bossWave = spawns.some((s) => s.boss);
    let li = 0;
    if (!bossWave) {
      if (i === 0) li = Math.floor(this.rng() * 3); // gentle openers
      else if (elite || this.rng() < 0.8) li = 1 + Math.floor(this.rng() * (BLOCK_LAYOUTS.length - 1));
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
    this.enemies = spawns.map((s) => {
      const r = s.boss ? 46 : 26;
      const at = this.unstick(this.arena.x + this.arena.w * s.nx, this.arena.y + this.arena.h * s.ny, r + 2);
      return {
      uid: nextUid++,
      def: s.def,
      side: 'enemy',
      x: at.x,
      y: at.y,
      vx: 0,
      vy: 0,
      r,
      hp: Math.round((s.boss ? bossHp(s.def.stats) : enemyHp(s.def.stats)) * this.hpScale),
      maxHp: Math.round((s.boss ? bossHp(s.def.stats) : enemyHp(s.def.stats)) * this.hpScale),
      timer: (s.def.melee ? MELEE_TIMER : ENEMY_BASE_TIMER) * this.foeCdMult,
      drift: enemyDrift(s.def.stats) * (s.boss ? 0.55 : 1),
      wx: 0,
      wy: 0,
      wT: Math.random() * 0.8,
      wMul: 1,
      lunging: 0,
      boss: !!s.boss,
      // shinies: wild fodder only — bosses and your rival echo stay normal
      // shinies: wild fodder rolls gold; your rival echo keeps the palette
      // it died with — including a shiny if you lost one
      shiny: !s.boss && (this.inRival ? !!s.def.shiny : this.rng() < SHINY_RATE * this.shinyRate),
      dead: false,
      dotTicks: 0,
      dotDmg: 0,
      cd: 0,
      cdMax: 1,
      lastBump: -1,
      role: 'wild',
      sash: false,
      lvl: 0,
      pow: 1,
      rngMul: 1,
      launch: 1,
      cdMod: 0,
      lastHit: new Map(),
      wallN: 0,
      wpA: ELITE_IDS.has(s.def.id) ? this.rng() * Math.PI * 2 : -1,
      hzT: -9,
      };
    });
    // rival echo fights at the levels it earned — the ghost of a stacked
    // run is a real fight, not a victory lap
    if (this.inRival) {
      this.enemies.forEach((e, i) => {
        const lv = this.echo?.[i]?.lvl ?? 1;
        e.lvl = lv;
        e.pow = Math.pow(1.05, lv - 1);
        e.maxHp = Math.round(e.maxHp * Math.pow(1.03, lv - 1));
        e.hp = e.maxHp;
      });
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
    }));
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

  // --- input (logical coords) ---

  pointerDown(p: Vec) {
    if (this.phase === 'map') {
      // a wave is already staged (the start node hosts stage 1) — walk in
      if (this.pendingNext <= this.waveIndex) {
        sfx('ui');
        this.nextTurn();
        return;
      }
      // StS routing: tap one of the linked stops to walk there — its kind
      // flavors the battle (elite road, rest heal, item find, blood shrine)
      const cell = 30;
      const ox = (540 - MAP_W * cell) / 2;
      const oy = 136;
      const cur = this.region.nodes[this.mapNode];
      const hit = cur.links
        .map((li) => this.region.nodes[li])
        .find(
          (n) =>
            Math.hypot(p.x - (ox + n.tx * cell + cell / 2), p.y - (oy + n.ty * cell + cell / 2)) <
            cell * 1.2,
        );
      if (!hit) return; // tapping open island just admires the map
      sfx('ui');
      this.mapNode = this.region.nodes.indexOf(hit);
      this.pendingNext = hit.row;
      this.arriveAtNode(hit);
      this.spawnWave(this.pendingNext, hit.kind === 'elite');
      this.nextTurn();
      return;
    }
    if (this.phase !== 'aim' || this.active.dead) return;
    this.dragging = true;
    this.dragT = 0;

    this.dragStart = { ...p };
    this.dragNow = { ...p };
  }

  pointerMove(p: Vec) {
    if (this.dragging) this.dragNow = { ...p };
  }

  pointerUp() {
    if (!this.dragging) return;
    this.dragging = false;
    const pull = { x: this.dragStart.x - this.dragNow.x, y: this.dragStart.y - this.dragNow.y };
    const pullLen = len(pull);
    if (pullLen < 12) return;
    const dir = norm(pull);
    const u = this.active;
    // direction from the pull; power from release timing on the meter
    const charge = this.charge();
    // hot streak: back-to-back perfects make each shot hit a bit harder —
    // resets the moment a release misses the gold
    this.streak = charge > 0.93 ? this.streak + 1 : 0;
    this.shotStreak = 1 + Math.min(Math.max(this.streak - 1, 0), 4) * 0.07;
    const speed = BASE_SHOT_SPEED * POWER * launchMult(u.def.stats) * this.launchBoost * u.launch * (0.4 + 0.6 * charge);
    u.vx = dir.x * speed;
    u.vy = dir.y * speed;
    this.bumpsThisShot.clear();
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
    this.phase = 'shot';
    this.shots++;
    this.addShake(3);
    sfx('launch');
    buzz(15);
    if (this.lifeDrain > 0) {
      for (const p of this.players) {
        if (!p.dead) p.hp = Math.max(1, p.hp - Math.round(p.maxHp * this.lifeDrain));
      }
    }
    if (charge > 0.93) {
      this.texts.push({ x: u.x, y: u.y - u.r - 14, text: this.streak > 1 ? `PERFECT ×${this.streak}!` : 'PERFECT!', t: 1, color: '#ffd84d', big: true });
      this.screenFlash('#ffd84d', 0.12);
      // slow-mo beat + speedlines streaming off the launch
      this.hitStop = Math.max(this.hitStop, 0.16);
      sfx('perfect');
      buzz(40);
    }
  }

  // Power meter: ping-pongs 0→1→0 while held (0.85s per direction) —
  // release in the gold zone for a full-power launch. Pull distance only
  // aims; it no longer feeds power.
  private charge() {
    const P = 0.85;
    const ph = this.dragT % (2 * P);
    return ph < P ? ph / P : 2 - ph / P;
  }

  // --- simulation ---

  update(dt0: number) {
    // hit-stop: freeze-frame feel on big combos
    const hit = this.hitStop > 0;
    if (hit) this.hitStop -= dt0;
    const dt = hit ? dt0 * 0.3 : dt0;
    this.time += dt;
    if (this.dragging) this.dragT += dt;
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
    this.shake *= Math.exp(-6 * dt);
    if (this.waveBanner > 0) this.waveBanner -= dt;

    this.stepOrbs(dt);
    this.stepWaves(dt);
    this.stepDashes(dt);
    for (const d of this.delays) d.t -= dt;
    const due = this.delays.filter((d) => d.t <= 0);
    this.delays = this.delays.filter((d) => d.t > 0);
    for (const d of due) d.fn();
    if (this.phase === 'shot' || this.phase === 'aim' || this.phase === 'enemy') {
      this.stepEnemyMovement(dt);
    }
    if (this.phase === 'shot') this.stepShot(dt);
    else if (this.phase === 'enemy') {
      this.enemyPhaseT -= dt;
      if (this.enemyPhaseT <= 0) this.resolveEnemyTurn();
    }
  }

  private stepShot(dt: number) {
    const u = this.active;
    // combo momentum kicks can push the ball fast enough to skip a thin
    // slab in one step — substep harder when it's hot
    const sub = u.vx * u.vx + u.vy * u.vy > 1000 * 1000 ? 4 : 2;
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const wave = this.enemies; // spawnWave swaps this array on wave clear
      const damp = Math.exp(-FRICTION * this.frictionMult * h);
      u.vx *= damp;
      u.vy *= damp;
      u.x += u.vx * h;
      u.y += u.vy * h;
      // speed trail while flying fast
      this.hitWalls(u);
      this.hitBlocks(u);
      // court gimmicks — the ball feels the floor it's flying over
      for (const hz of this.hazards) {
        if (dist(u, hz) > u.r + hz.r) continue;
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
      for (const e of wave) {
        if (this.enemies !== wave) break;
        if (e.dead) continue;
        // pierce mons phase through enemies — hit once, keep the line
        if (u.def.pierce) {
          if (dist(u, e) < u.r + e.r) this.strikeEnemy(u, e);
        } else if (this.collide(u, e)) this.strikeEnemy(u, e);
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

    const speed = len({ x: u.vx, y: u.vy });
    if (speed < STOP_SPEED) {
      this.stopTimer += dt;
      if (this.stopTimer > 0.3) this.endShot();
    } else {
      this.stopTimer = 0;
    }
  }

  // Enemies creep toward the nearest player; knockback velocity decays fast.
  private stepEnemyMovement(dt: number) {
    const alive = this.players.filter((p) => !p.dead);
    for (const e of this.enemies) {
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
              this.damagePlayer(target, physDamage(e.def.stats.atk, target.def.stats.def, 1, zapPower * 1.3));
              if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
            }
          }
        } else {
          // erratic approach: seek the player but wander with random darts
          e.wT -= dt;
          if (e.wT <= 0) {
            e.wT = 0.35 + Math.random() * 0.9;
            const a = Math.random() * Math.PI * 2;
            e.wx = Math.cos(a);
            e.wy = Math.sin(a);
            e.wMul = Math.random() < 0.22 ? 2.4 : 0.5 + Math.random();
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
      // lava burns whatever stands in it — enemies included, but bosses
      // shrug it off (a spawn inside a pool shouldn't cook them to death)
      if (!e.dead && !e.boss) {
        for (const hz of this.hazards) {
          if (hz.kind === 'lava' && dist(e, hz) < hz.r + e.r * 0.4 && this.time - e.hzT > 0.6) {
            e.hzT = this.time;
            this.hurt(e, Math.max(1, Math.ceil(e.maxHp * 0.03)), '#f08030');
            break;
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
        }
        this.waves.push({
          x: o.x, y: o.y, r: 0, maxR: 52, t: 0.3, life: 0.3,
          color: '#9df0ff', hits: new Set(),
        });
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
        this.addShake(5);
        this.hitStop = Math.max(this.hitStop, 0.06);
        sfx('hit');
        d.done = true;
        continue;
      }
      const dir = norm({ x: d.e.x - d.u.x, y: d.e.y - d.u.y });
      const step = Math.min(SP * dt, dist(d.u, d.e) - gap);
      d.u.x += dir.x * step;
      d.u.y += dir.y * step;
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
      if (this.pinch(-2) && !this.inStatic(u.x, u.y)) this.onPinch(u.x, u.y);
    }
  }

  // Stone blocks bank the ball like walls — same restitution, same wall-
  // bounce credit, own pinch id so a wall→block wedge still combos.
  private hitBlocks(u: Unit) {
    const fast = u.vx * u.vx + u.vy * u.vy > 150 * 150;
    let bounced = false;
    for (const b of this.blocks) bounced = resolveBlock(u, b) || bounced;
    if (bounced && fast && u.side === 'player') {
      u.wallN++;
      if (this.pinch(-3) && !this.inStatic(u.x, u.y)) this.onPinch(u.x, u.y);
    }
  }

  // Keeps a spawn point (or pickup) out of the blocks — nudge to the
  // nearest face rather than rejecting the spot.
  private unstick(x: number, y: number, r: number) {
    for (const b of this.blocks) {
      const l = x - (b.x - r - 4), rr = b.x + b.w + r + 4 - x;
      const t = y - (b.y - r - 4), bo = b.y + b.h + r + 4 - y;
      if (l > 0 && rr > 0 && t > 0 && bo > 0) {
        const m = Math.min(l, rr, t, bo);
        if (m === l) x = b.x - r - 4;
        else if (m === rr) x = b.x + b.w + r + 4;
        else if (m === t) y = b.y - r - 4;
        else y = b.y + b.h + r + 4;
      }
    }
    return { x, y };
  }

  // PINCH: two distinct contacts (enemy, ally, wall) inside one 0.35s
  // window — the wedge shot is the engine's fuel. Records every contact;
  // callers gate the payoff on static fields so silence absorbs chains.
  private pinch(id: number) {
    const pinched = this.time - this.lastContact.t <= 0.35 && this.lastContact.id !== id;
    this.lastContact = { t: this.time, id };
    return pinched;
  }

  private onPinch(x: number, y: number) {
    this.texts.push({ x, y: y - 30, text: 'PINCH!', t: 0.8, color: '#9df0ff', big: true });
    for (let k = 0; k < this.pinchPip; k++) this.chargeUp(this.active);
  }

  // Static fields silence keyword triggers and bump supers inside them.
  private inStatic(x: number, y: number) {
    return this.hazards.some((hz) => hz.kind === 'static' && dist({ x, y }, hz) < hz.r);
  }

  // Field pickups — the MS heart/sword/hourglass: heal, damage, cooldown.
  private grabPickup(pk: Pickup) {
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
    d = Math.round(d * this.dmgMult);
    // 0x matchups (e.g. normal vs ghost) still chip — a wave must always
    // be finishable even when the whole team is immune-typed
    const immune = d <= 0;
    if (immune) d = 1;
    e.hp -= d;
    // boss enrage: below 30% the leader fights dirty — attacks cycle a
    // third faster, so the last stretch of a gym is the tense one
    if (e.boss && !e.enraged && e.hp > 0 && e.hp / e.maxHp < 0.3) {
      e.enraged = true;
      e.timer = Math.min(e.timer, 2);
      this.texts.push({ x: e.x, y: e.y - e.r - 58, text: 'ENRAGED!', t: 1.2, color: '#ff6b6b', big: true });
      this.screenFlash('#ff6b6b', 0.15);
      sfx('invade');
    }
    this.score += Math.round(d * (1 + this.asc * 0.2) * this.scoreMult); // ascension pays a score premium; lucky egg stacks on
    // the run just became your best — celebrate mid-flight, not just on the card
    if (!this.bested && this.bestScore > 0 && this.score > this.bestScore) {
      this.bested = true;
      this.texts.push({ x: e.x, y: e.y - e.r - 46, text: '★ NEW BEST ★', t: 1.4, color: '#ffd84d', big: true });
      sfx('perfect');
    }
    // king's rock staggers attack timers — capped so a long combo delays
    // one volley instead of locking the enemy out forever
    e.timer = Math.min(e.timer + this.stagger, ENEMY_BASE_TIMER + this.stagger + 1);
    // shell bell: damage feeds the weakest ally
    if (this.leech > 0) {
      const weakest = this.players
        .filter((pl) => !pl.dead && pl.hp < pl.maxHp)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (weakest) {
        weakest.hp = Math.min(weakest.hp + Math.max(1, Math.round(d * this.leech)), weakest.maxHp);
      }
    }
    this.texts.push({
      x: e.x,
      y: e.y - e.r - 8,
      text: immune ? 'IMMUNE' : crit ? `${d} CRIT!` : `${d}${suffix}`,
      t: 0.9,
      color: immune ? '#8a90a8' : crit ? '#ffd84d' : color,
      big: crit || suffix === '!',
    });
    if (crit) this.addShake(4);
    // styler loop wraps the target — every hit is another circle
    if (e.hp <= 0) {
      e.dead = true;
      this.scar(e.x, e.y, e.boss ? 20 : 12); // a KO scorches the court
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
      this.maxKos = Math.max(this.maxKos, this.kosThisShot);
      // EXP: the mon that launched this shot levels up — growth you can
      // watch mid-run; cap keeps the multiplier sane
      const lv = this.active;
      if (lv && !lv.dead && lv.lvl < 20) {
        lv.lvl++;
        lv.pow *= 1.05;
        const gain = Math.round(lv.maxHp * 0.03);
        lv.maxHp += gain;
        lv.hp = Math.min(lv.hp + gain, lv.maxHp);
        this.texts.push({ x: lv.x, y: lv.y - lv.r - 36, text: `LV ${lv.lvl}!`, t: 0.9, color: '#9df0ff', big: false });
        sfx('ready');
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
      // an armed master ball never fails — first KO catches, guaranteed
      const master = this.masterArmed;
      // shinies never break out — KO'ing one always lands it in the box
      const caught = master || e.shiny || this.rng() < this.captureChance + (e.boss ? this.bossCatch : 0);
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
      if (caught) {
        // a dupe feeds the copy you own instead of filling a box slot
        if (!this.absorbDupe(e.def, e.shiny)) {
          this.box.push(e.shiny ? { ...e.def, shiny: true } : e.def);
          this.boxHp.push(1);
          this.boxLvl.push(1);
        }
        if (e.boss) this.caughtBoss = true;
        if (e.shiny) {
          this.shiniesCaught++;
          this.score += 250;
          this.texts.push({ x: e.x, y: e.y - e.r - 56, text: 'SHINY BONUS +250', t: 1.4, color: '#ffd84d', big: true });
        }
        this.screenFlash('#ffd84d', 0.2);
        // real poké ball drops in and does the triple-wiggle
        this.balls.push({ x: e.x, y: e.y, item: master ? 'master-ball' : 'poke-ball', t: 1.15, life: 1.15 });
        sfx('caught');
        cry(e.def.id, 0.45);
        buzz([30, 50, 30, 50, 60]);
      }
      this.addShake(e.boss ? 14 : 5);
      if (this.enemies.every((x) => x.dead)) this.waveCleared();
    }
  }

  private strikeEnemy(shooter: Unit, e: Unit) {
    const last = e.lastHit.get(shooter.uid) ?? -1;
    if (this.time - last < HIT_COOLDOWN) return;
    e.lastHit.set(shooter.uid, this.time);
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
    const mult = effectiveness(shooter.def.type, e.def.type);
    // weak point: striking the marked face triples contact damage. The
    // mark sits on the side facing the incoming ball, so the approach
    // direction is opposite the mark's facing — a ~44° window.
    let weak = false;
    if (e.wpA >= 0) {
      const toE = norm({ x: e.x - shooter.x, y: e.y - shooter.y });
      weak = toE.x * Math.cos(e.wpA) + toE.y * Math.sin(e.wpA) < -0.72;
    }
    // every link in the chain adds momentum: +10% contact damage per pass;
    // grip claw stacks its own ramp per wall bounce this shot
    const dmg = Math.round(
      physDamage(shooter.def.stats.atk, e.def.stats.def, mult, CONTACT_POW) *
        shooter.pow * this.physMult * this.shotPhys * (1 + this.shotCombo * (0.1 + this.comboDmg)) *
        (1 + this.wallRamp * shooter.wallN) *
        (this.typePow[shooter.def.type] ?? 1) *
        this.shotStreak *
        (1 + this.shotVolleyBoost) *
        (pinched ? 1 + this.pinchMult : 1) *
        Math.pow(0.9, hitN) *
        (weak ? 3 + this.wpBonus : 1),
    );
    const color = mult > 1 ? '#ffd84d' : mult < 1 ? '#8a90a8' : '#ffffff';
    this.hurt(e, dmg, color, mult > 1 ? '!' : '');
    this.addShake(mult > 1 ? 4 : 2);
    sfx('hit', 1 + this.shotCombo * 0.12);
    buzz(8);
    if (weak)
      this.texts.push({ x: e.x, y: e.y - e.r - 44, text: 'WEAK POINT!', t: 0.9, color: '#ffd84d', big: true });
    if (shooter.wallN >= 2)
      this.texts.push({ x: e.x, y: e.y - e.r - 58, text: `BANKED ×${shooter.wallN}!`, t: 0.9, color: '#9df0ff', big: false });
    if (mult > 1)
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

  // Bump an ally mid-shot: every pass is a combo link; the signature
  // super fires only when recharged (cd counts down per shot).
  private bumpAlly(p: Unit, u: Unit) {
    if (this.time - p.lastBump < 0.3) return; // once per pass, not per frame
    p.lastBump = this.time;
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
      this.hitStop = Math.min(0.05 * n, 0.3);
      this.addShake(2 * n);
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
    const eff = (e: Unit) => effectiveness(src.def.type, e.def.type);
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
    if (silenced) return; // static field: the link sparks but the super can't fire
    if (p.cd > 0) {
      // super still recharging — link sparks but no attack
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
    this.hitStop = Math.max(this.hitStop, 0.18);
    const color = TYPE_COLOR[src.def.type];
    this.screenFlash(color, 0.08);
    sfx(SUPER_SFX[src.def.type]);
    cry(p.def.id, 0.35);
    buzz(20);

    switch (src.def.type) {
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
            .filter((e) => !e.dead && !hit.has(e.uid) && dist(from, e) <= 190 * p.rngMul)
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
            this.hurt(c.e, bumpDmg(c.e, c.mult), '#9df0ff');
            this.addShake(4);
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
        // meteor fist: the nearest enemy eats a one-two of falling rock —
        // second hit lands a beat later and leaves a crater
        const e = nearest(p, 200);
        if (e) {
          this.hurt(e, bumpDmg(e, 0.8), '#9df0ff');
          this.later(0.14, () => {
            this.scar(e.x, e.y, 14); // the meteor lands whether or not it kills
            if (e.dead) return;
            this.screenFlash('#b8a038', 0.12);
            this.addShake(12);
            this.hurt(e, bumpDmg(e, 2.2), '#9df0ff');
          });
        }
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
      this.hitStop = 0.3;
      this.screenFlash('#ffd84d', 0.3);
      this.addShake(8);
      this.texts.push({ x: p.x, y: p.y - p.r - 40, text: 'TEAM COMBO!', t: 1.2, color: '#ffd84d', big: true });
    }
  }

  private waveCleared() {
    if (this.inRival) this.echoCleared = true; // the echo is beaten — reclaim it
    if (this.waveHadGym) this.gymsBeaten++;
    // last-kill slow-mo — the kill shot gets a beat to land
    this.hitStop = Math.max(this.hitStop, 0.35);
    if (this.waveIndex + 1 >= this.waveCount && this.depth >= FINAL_DEPTH) {
      this.phase = 'won';
      this.screenFlash('#ffd84d', 0.35);
      this.addShake(10);
      sfx('perfect');
      buzz([60, 80, 120]);
      return;
    }
    // let the shot finish rolling out, then offer a relic
    this.rewardPending = true;
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
    const evoId = def.evolvesTo;
    const next = evoId != null ? SPECIES_DB.find((s) => s.id === evoId) : undefined;
    if (next) {
      if (owned) this.evolveUnit(owned, next);
      else this.box[bi] = this.box[bi].shiny || shiny ? { ...next, shiny: true } : next; // shininess survives a boxed evolution
      this.texts.push({
        x: owned ? owned.x : this.arena.x + this.arena.w / 2,
        y: owned ? owned.y - owned.r - 40 : this.arena.y + 70,
        text: `${def.name.toUpperCase()} evolved into ${next.name.toUpperCase()}!`,
        t: 1.4, color: '#ffd84d', big: true,
      });
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

  // Mid-run evolution: same slot, new species — hp fraction carries over
  // and a fainted mon stays fainted (evolving isn't a revive).
  private evolveUnit(p: Unit, nd: SpeciesDef) {
    const frac = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    const role = roleOf(nd.stats, nd.healer);
    const m = ROLE_MODS[role];
    const hp = Math.round(playerHp(nd.stats) * m.hp);
    const lvBoost = Math.max(0, p.lvl - 1); // earned levels survive evolution
    p.def = p.shiny ? { ...nd, shiny: true } : nd; // the marker rides the def into the box
    p.role = role;
    p.pow = m.pow * Math.pow(1.05, lvBoost);
    p.rngMul = m.range;
    p.launch = m.launch;
    p.cdMod = m.cdMod;
    p.maxHp = Math.round(hp * (1 + lvBoost * 0.03));
    p.hp = Math.max(1, Math.round(p.maxHp * frac));
    if (p.dead) p.hp = 0;
    p.cdMax = Math.max(1, Math.round(bumpCooldown(nd.type) * this.cdMult) - p.cdMod);
    p.cd = Math.min(p.cd, p.cdMax);
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
    const role = roleOf(def.stats, def.healer);
    const m = ROLE_MODS[role];
    const lvBoost = lvl - 1;
    const hp = Math.round(playerHp(def.stats) * m.hp * (1 + lvBoost * 0.03));
    p.def = def;
    p.role = role;
    p.lvl = lvl;
    p.shiny = !!def.shiny;
    p.pow = m.pow * Math.pow(1.05, lvBoost);
    p.rngMul = m.range;
    p.launch = m.launch;
    p.cdMod = m.cdMod;
    p.maxHp = hp;
    p.hp = frac <= 0 ? 0 : Math.max(1, Math.round(hp * frac));
    p.dead = p.hp <= 0;
    p.cdMax = Math.max(1, Math.round(bumpCooldown(def.type) * this.cdMult) - p.cdMod);
    p.cd = p.cdMax; // swapped in discharged — it has to earn its first super
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

  // The stage's guaranteed catch — the card reward of the run. Beating a
  // gym always nets the leader's ace (even a dupe — it's the gym's prize);
  // anything else prefers a species you don't already own.
  private rollRecruit() {
    const spawns = this.stage.waves[this.waveIndex];
    const fresh = spawns.filter((s) => !this.box.includes(s.def));
    const boss = fresh.find((s) => s.boss) ?? spawns.find((s) => s.boss);
    if (boss) return boss.def;
    const pool = fresh.length ? fresh : spawns;
    return pool[Math.floor(this.rng() * pool.length)].def;
  }

  // every type on the active team or in the box — charm offers follow it
  teamTypes() {
    return new Set<PokeType>([...this.players.map((p) => p.def.type), ...this.box.map((d) => d.type)]);
  }

  private enterReward() {
    this.boxSel = -1;
    // elite stages pay out uncommon-or-better relics — the risk has a price
    this.rewardOffers = rollPerks(this.rng, this.eliteWave ? 2 : 3, this.rank, this.teamTypes());
    this.eliteWave = false;
    this.lastRecruit = this.rollRecruit();
    if (this.lastRecruit) {
      if (!this.absorbDupe(this.lastRecruit)) {
        this.box.push(this.lastRecruit);
        this.boxHp.push(1);
        this.boxLvl.push(1);
      }
      sfx('caught');
    }
    for (const p of this.players) {
      p.vx = 0;
      p.vy = 0;
    }
    this.phase = 'reward';
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

  // StS map-stop effects resolve on arrival: Poké Center rests heal, item
  // stops cough up a perk, shrines bleed for power — the note becomes the
  // wave banner since we go straight from the map into the fight.
  private arriveAtNode(n: MapNode) {
    this.mapNote = '';
    if (n.kind === 'rest') {
      for (const p of this.players) {
        if (!p.dead) p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.3));
      }
      this.mapNote = 'RESTED AT THE POKÉ CENTER — TEAM +30% HP';
      sfx('heal');
    } else if (n.kind === 'item') {
      const p = rollPerks(this.rng, 1, this.rank, this.teamTypes())[0];
      if (p) {
        p.apply(this);
        this.heldItems.push(p.item);
        this.mapNote = `YOU FOUND ${p.name.toUpperCase()}!`;
      }
      sfx('ready');
    } else if (n.kind === 'shrine') {
      // a deal with the dark: the shrine bleeds the team for a relic —
      // taken right before the last gym, when the offer is sharpest
      for (const p of this.players) {
        if (!p.dead) p.hp = Math.max(1, p.hp - Math.round(p.maxHp * 0.15));
      }
      const p = rollPerks(this.rng, 1, Math.max(1, this.rank), this.teamTypes())[0];
      if (p) {
        p.apply(this);
        this.heldItems.push(p.item);
        this.mapNote = `THE SHRINE TAKES ITS TITHE — ${p.name.toUpperCase()}, TEAM −15% HP`;
      }
      sfx('invade');
    } else if (n.kind === 'mart') {
      // Poké Mart: power bought with the score itself — the record run and
      // the winning run are now in tension
      if (this.score >= 500) {
        this.score -= 500;
        const p = rollPerks(this.rng, 1, Math.max(1, this.rank), this.teamTypes())[0];
        if (p) {
          p.apply(this);
          this.heldItems.push(p.item);
          this.mapNote = `MART SOLD YOU ${p.name.toUpperCase()} — −500 PTS`;
        }
      } else {
        this.mapNote = 'MART — NOT ENOUGH PTS (500)';
      }
      sfx('ui');
    } else if (n.kind === 'mystery') {
      // the wildcard stop — you only learn what it was on arrival
      const roll = this.rng();
      if (roll < 0.4) {
        const p = rollPerks(this.rng, 1, this.rank, this.teamTypes())[0];
        if (p) {
          p.apply(this);
          this.heldItems.push(p.item);
          this.mapNote = `? WAS A CACHE — ${p.name.toUpperCase()}`;
        }
        sfx('ready');
      } else if (roll < 0.7) {
        for (const p of this.players) {
          if (!p.dead) p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.3));
        }
        this.mapNote = '? WAS A HIDDEN SPRING — TEAM +30% HP';
        sfx('heal');
      } else {
        for (const p of this.players) {
          if (!p.dead) p.hp = Math.max(1, p.hp - Math.round(p.maxHp * 0.12));
        }
        const p = rollPerks(this.rng, 1, Math.max(1, this.rank), this.teamTypes())[0];
        if (p) {
          p.apply(this);
          this.heldItems.push(p.item);
          this.mapNote = `? WAS A TRAP — ${p.name.toUpperCase()}, TEAM −12% HP`;
        }
        sfx('invade');
      }
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
    if (this.maxCombo >= 4) b.push({ name: 'COMBO CHAIN', rarity: 'rare' });
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
      sfx('ready');
    }
  }

  private endShot() {
    const u = this.active;
    u.vx = 0;
    u.vy = 0;
    // supers recharge per shot taken; leftovers ticks a small heal
    if (this.healCd > 0) this.healCd--;
    for (const p of this.players) {
      this.chargeUp(p);
      if (!p.dead && this.regen > 0 && p.hp < p.maxHp) {
        p.hp = Math.min(p.hp + Math.ceil(p.maxHp * this.regen), p.maxHp);
      }
    }
    // poison ticks first
    for (const e of this.enemies) {
      if (e.dotTicks > 0) {
        e.dotTicks--;
        this.hurt(e, e.dotDmg, '#a040a0');
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    // dots cleared the wave mid-check: fresh wave keeps full timers
    if (this.phase === 'won') return;
    if (this.rewardPending) {
      this.rewardPending = false;
      this.enterReward();
      return;
    }
    this.pendingAttacks = [];
    for (const e of this.enemies) {
      e.timer--;
      if (e.timer <= 0) {
        this.pendingAttacks.push(e);
      }
    }
    if (this.pendingAttacks.length > 0) {
      this.phase = 'enemy';
      this.enemyPhaseT = ENEMY_TURN_DELAY;
    } else {
      this.nextTurn();
    }
  }

  // Each boss has a signature attack on its countdown; invaders and
  // unknowns fall back to the generic radial blast.
  private bossAttack(e: Unit) {
    const target = this.players.filter((p) => !p.dead).sort((a, b) => dist(e, a) - dist(e, b))[0];
    this.screenFlash('#f85888', 0.18);
    this.addShake(12);
    buzz([30, 40, 60]);
    this.scar(e.x, e.y, 26);
    const hit = (p: Unit, dmg: number) => {
      this.damagePlayer(p, dmg);
      if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
    };
    switch (e.def.id) {
      case 149: { // Dragonite — hyper beam: a burning line through the team
        if (!target) break;
        sfx('beam');
        this.beams.push({ x1: e.x, y1: e.y, x2: target.x, y2: target.y, t: 0.5, life: 0.5 });
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
      case 130: { // Gyarados — thrash: a wall of water sweeping the whole court
        sfx('boom');
        this.waves.push({
          x: e.x, y: e.y, r: 0, maxR: 300, t: 0.5, life: 0.5,
          color: '#6890f0', hits: new Set(), hostile: true,
          onHit: (p) => hit(p, specDamage(e.def.stats.spa, p.def.stats.spd, 1, blastPower)),
        });
        break;
      }
      case 6: { // Charizard — flame ring that scorches the floor on the way out
        sfx('boom');
        this.waves.push({
          x: e.x, y: e.y, r: 0, maxR: 200, t: 0.45, life: 0.45,
          color: '#f08030', hits: new Set(), hostile: true,
          onHit: (p) => hit(p, specDamage(e.def.stats.spa, p.def.stats.spd, 1, blastPower)),
        });
        this.scar(e.x, e.y, 34);
        break;
      }
      case 150: { // Mewtwo — twin psychic orbs that hunt the nearest pair
        sfx('zap');
        this.players
          .filter((p) => !p.dead)
          .sort((a, b) => dist(e, a) - dist(e, b))
          .slice(0, 2)
          .forEach((p, i) => {
            this.orbs.push({
              x: e.x, y: e.y, target: p,
              dmg: Math.round(specDamage(e.def.stats.spa, p.def.stats.spd, 1, blastPower)),
              t: 2.5, wob: i * 2.1, color: '#f85888', hostile: true,
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
    for (const e of this.pendingAttacks) {
      e.timer = (e.def.melee ? MELEE_TIMER : ENEMY_BASE_TIMER) * this.foeCdMult * (e.enraged ? 0.66 : 1);
      if (e.boss) {
        this.bossAttack(e);
      } else if (e.def.healer) {
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
            this.damagePlayer(target, physDamage(e.def.stats.atk, target.def.stats.def, 1, zapPower));
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
          this.damagePlayer(target, physDamage(e.def.stats.atk, target.def.stats.def, 1, zapPower));
          if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
        }
      }
    }
    this.pendingAttacks = [];
    if (this.players.every((p) => p.dead)) {
      this.phase = 'lost';
      this.screenFlash('#ff6b6b', 0.3);
      sfx('lose');
      return;
    }
    this.nextTurn();
  }

  private damagePlayer(p: Unit, dmg: number) {
    // foes hit harder the deeper the run goes — depth 6 lands ~1.7x;
    // +15% base pressure, +8% per wave so wave 3 actually threatens
    dmg = Math.max(1, Math.round(dmg * this.takenMult * 1.15 * (1 + this.depth * 0.12 + this.waveIndex * 0.08 + this.asc * 0.08)));
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
    sfx('hurt');
    buzz(20);
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      this.addShake(6);
      sfx('ko');
      buzz(60);
      // REVENGE: a fallen teammate fuels the rest — small pow/hp surge so
      // a death stings less and a comeback is always live
      for (const q of this.players) {
        if (!q.dead) {
          q.pow *= 1.08;
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
          text: `GO! ${a.def.name.toUpperCase()}`,
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
    this.shake = Math.min(this.shake + amt, 18);
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
    for (const hz of this.hazards) this.drawHazard(ctx, hz);

    // stone blocks — solid cover the ball banks off
    for (const b of this.blocks) this.drawBlock(ctx, b);

    // ambient motes — embers in the volcano, petals in the grove; the
    // little drift that keeps a still room from reading dead
    {
      const MO: Record<string, string> = { grove: '#cfe898', cavern: '#8a94c0', volcano: '#ff9d4d', sky: '#e8f6ff' };
      ctx.fillStyle = MO[this.theme] ?? '#cfe898';
      for (let k = 0; k < 14; k++) {
        const sp = 10 + (k % 4) * 6;
        const mx = a.x + ((k * 97.31 + Math.sin(this.time * 0.4 + k) * 20 + a.w) % a.w);
        const my = a.y + (((k * 61.7 - this.time * sp) % a.h) + a.h) % a.h;
        ctx.globalAlpha = 0.12 + 0.1 * Math.sin(this.time * 2 + k * 1.7);
        ctx.beginPath();
        ctx.arc(mx, my, 1.6 + (k % 3) * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

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

    for (const w of this.waves) this.drawWave(ctx, w);

    for (const e of this.enemies) this.drawUnit(ctx, e);
    for (const p of this.players) this.drawUnit(ctx, p);

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


    // boss beam afterglow — a fading bright line over the field
    for (const bm of this.beams) {
      const alpha = bm.t / bm.life;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ffd84d';
      ctx.lineWidth = 14 * alpha + 2;
      ctx.beginPath();
      ctx.moveTo(bm.x1, bm.y1);
      ctx.lineTo(bm.x2, bm.y2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4 * alpha + 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const t of this.texts) {
      const pop = 1 + Math.max(0, t.t - 0.72) * (t.big ? 3 : 1.6);
      ctx.globalAlpha = Math.min(t.t / 0.3, 1);
      ctx.font = font(16 * pop);
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      const dy = (0.9 - t.t) * 44;
      ctx.strokeText(t.text, t.x, t.y - dy);
      ctx.fillText(t.text, t.x, t.y - dy);
    }
    ctx.globalAlpha = 1;

    if (this.dragging) this.drawAim(ctx);

    ctx.restore();

    // screen flashes render unshaken, on top
    for (const f of this.flashes) {
      ctx.globalAlpha = Math.max(f.t / f.life, 0) * 0.3;
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, W_CANVAS_FALLBACK, 2000);
    }
    ctx.globalAlpha = 1;

    // foes remaining, top-right — the wave's progress bar
    const left = this.enemies.filter((e) => !e.dead).length;
    if ((this.phase === 'aim' || this.phase === 'shot' || this.phase === 'enemy') && left > 0) {
      ctx.font = font(9);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#8890b8';
      ctx.fillText(`${left} LEFT`, a.x + a.w - 8, a.y + 16);
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
      ctx.fillStyle = '#000a';
      ctx.fillRect(bx, by + 5, bw, 7);
      ctx.fillStyle = pct > 0.5 ? '#f0b02f' : pct > 0.25 ? '#f08030' : '#ff6b6b';
      ctx.fillRect(bx, by + 5, bw * pct, 7);
      ctx.strokeStyle = '#f0b02f';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by + 5, bw, 7);
    }

    // ascension tag — why the mobs feel bulkier today
    if (this.asc > 0) {
      ctx.font = font(9);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f0b02f';
      ctx.fillText(`ASC ${this.asc}`, a.x + 8, a.y + 16);
    }

    // onboarding hints for the first couple of shots
    if (this.phase === 'aim' && this.shots < 2 && !this.dragging) {
      ctx.globalAlpha = 0.55 + Math.sin(this.time * 4) * 0.3;
      ctx.font = font(9);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8ecff';
      ctx.fillText(
        this.shots === 0
          ? 'pull back to aim — release in the gold'
          : 'bounce through allies to fire their supers',
        a.x + a.w / 2,
        a.y + a.h - 16,
      );
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
      ctx.font = `bold ${Math.round(34 * scaleIn)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f0e6c8';
      ctx.fillText(label, a.x + a.w / 2, cy + 12);
      ctx.globalAlpha = 1;
    }
  }

  // The climb as a porygion-style region: a seeded island of grass ringed
  // by beach and sea, 9 stops south→north on a carved route — gyms every
  // 3rd, Poké Center rests, item finds — with the next wave's wilds
  // previewed up top like a Monster Strike quest banner.
  private drawRegion(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#0a0e1c';
    ctx.fillRect(0, 0, 540, 960);
    ctx.textAlign = 'center';
    ctx.font = font(18);
    ctx.fillStyle = '#f8d030';
    ctx.fillText(this.stage.name.toUpperCase(), 270, 66);
    ctx.font = font(9);
    ctx.fillStyle = '#8890b8';
    ctx.fillText(`STAGE ${this.pendingNext + 1} OF ${TOTAL_STAGES}`, 270, 84);

    // who's waiting at the next stop — gyms show their boss
    const seen = new Set<number>();
    const preview = (this.stage.waves[this.pendingNext] ?? [])
      .filter((s) => !seen.has(s.def.id) && seen.add(s.def.id))
      .slice(0, 4);
    preview.forEach((s, i) => {
      const x = 270 - preview.length * 15 + i * 30 + 15;
      try {
        drawMon(ctx, s.def.id, x, 108, 26); // unspawned waves may not be loaded yet
      } catch {
        return;
      }
      if (s.boss) {
        ctx.strokeStyle = '#f0b02f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, 108, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    if (!preview.length && this.pendingNext > this.waveIndex) {
      // rolled rows deal their wave when the stop is picked — unknowns for now
      ctx.font = font(14);
      ctx.fillStyle = '#3a4370';
      ctx.fillText('?  ?  ?', 270, 114);
    }

    const cell = 30;
    const ox = (540 - MAP_W * cell) / 2;
    const oy = 136;
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
        const s = kind === 'tree' ? MT.TILE_TREE : kind === 'rock' ? MT.TILE_ROCK : MT.TILE_FLOWER;
        drawTile(g, s, (i % MAP_W) * cell - cell * 0.2, Math.floor(i / MAP_W) * cell - cell * 0.5, cell * 1.4, cell * 1.4);
      }
      this.regionBase = c;
    }
    const sparkle = Math.floor(this.time * 4);
    if (this.regionBase) {
      ctx.drawImage(this.regionBase, ox, oy);
      // only the water glints stay live
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          if (this.region.tiles[y * MAP_W + x] !== T_WATER || this.region.route.has(y * MAP_W + x)) continue;
          if ((x * 7 + y * 11 + sparkle) % 23 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(ox + x * cell + cell * 0.3, oy + y * cell + cell * 0.35, cell * 0.4, 2);
          }
        }
      }
    } else {
      const flat = (c: string, x: number, y: number) => {
        ctx.fillStyle = c;
        ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      };
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          const i = y * MAP_W + x;
          const t = this.region.tiles[i];
          const px = ox + x * cell, py = oy + y * cell;
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
    // your lead mon waits at the current stop, facing the road ahead
    const at = this.region.nodes[this.mapNode];
    const lead = this.players.find((p) => !p.dead);
    if (at && lead) {
      const bob = Math.sin(this.time * 4) * 2;
      drawMon(ctx, lead.def.id, ox + at.tx * cell + cell / 2, oy + at.ty * cell - cell * 0.1 + bob, 30);
    }
    // stops: cleared rows dim out, linked stops pulse bright — those are
    // the actual choices; unreachable future stops sit dim on the island
    const links = this.region.nodes[this.mapNode].links;
    // waypoint dots march along each open link — the affordance that
    // says "these are the stops you can pick"
    const cur0 = this.region.nodes[this.mapNode];
    if (this.pendingNext > this.waveIndex) {
      for (const li of links) {
        const t = this.region.nodes[li];
        const mx = ox + ((cur0.tx + t.tx) / 2) * cell + cell / 2;
        const my = oy + ((cur0.ty + t.ty) / 2) * cell + cell / 2;
        ctx.globalAlpha = 0.45 + Math.sin(this.time * 4) * 0.3;
        ctx.fillStyle = '#ffd84d';
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    this.region.nodes.forEach((n, i) => {
      const nx = ox + n.tx * cell + cell / 2;
      const ny = oy + n.ty * cell + cell / 2;
      const cleared = n.row < this.pendingNext;
      const reachable = links.includes(i);
      const current = i === this.mapNode;
      if (n.kind === 'item') {
        const ball = itemSprite('poke-ball');
        if (ball) ctx.drawImage(ball, nx - 13, ny - 20, 26, 26);
      } else if (n.kind === 'shrine') {
        const orb = itemSprite('life-orb');
        if (orb) ctx.drawImage(orb, nx - 13, ny - 20, 26, 26);
      } else if (n.kind === 'elite') {
        const band = itemSprite('choice-band');
        if (band) ctx.drawImage(band, nx - 13, ny - 20, 26, 26);
      } else if (n.kind === 'mart') {
        const ball = itemSprite('ultra-ball');
        if (ball) ctx.drawImage(ball, nx - 13, ny - 20, 26, 26);
      } else if (n.kind === 'mystery') {
        ctx.font = font(16);
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText('?', nx, ny - 2);
        ctx.fillStyle = '#c05df0';
        ctx.fillText('?', nx, ny - 2);
      } else {
        const icon = n.kind === 'gym' ? MT.TILE_GYM : n.kind === 'start' ? null : MT.TILE_TOWN;
        if (icon) drawTile(ctx, icon, nx - cell, ny - cell * 1.35, cell * 2, cell * 2);
        if (n.kind === 'rest') {
          const potion = itemSprite('max-potion');
          if (potion) ctx.drawImage(potion, nx - 9, ny - cell * 1.9, 18, 18);
        }
      }
      ctx.globalAlpha = cleared ? 0.35 : reachable ? 1 : 0.5;
      ctx.strokeStyle = reachable ? (n.kind === 'elite' || n.kind === 'shrine' ? '#ff6b6b' : n.kind === 'mystery' ? '#c05df0' : '#ffd84d') : current ? '#6fdc6f' : '#c8d0e8';
      ctx.lineWidth = reachable || current ? 3 : 2;
      ctx.beginPath();
      ctx.arc(nx, ny, cell * (reachable ? 0.6 + Math.sin(this.time * 5) * 0.08 : 0.42), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (cleared) {
        ctx.font = font(10);
        ctx.fillStyle = '#6fdc6f';
        ctx.fillText('✓', nx, ny + 4);
      }
      if (reachable || current) {
        ctx.font = font(8);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        const label = n.kind === 'gym' ? 'GYM' : n.kind === 'rest' ? 'REST' : n.kind === 'item' ? 'FIND' : n.kind === 'shrine' ? 'SHRINE' : n.kind === 'elite' ? 'ELITE' : n.kind === 'mart' ? 'MART' : n.kind === 'mystery' ? '???' : n.kind === 'start' ? 'HERE' : 'WILD';
        ctx.strokeText(label, nx, ny - cell * 1.1);
        ctx.fillStyle = reachable ? '#ffd84d' : '#6fdc6f';
        ctx.fillText(label, nx, ny - cell * 1.1);
      }
    });
    ctx.strokeStyle = '#2a3560';
    ctx.lineWidth = 3;
    ctx.strokeRect(ox - 8, oy - 8, MAP_W * cell + 16, MAP_H * cell + 16);
    // soft vignette keeps the eye on the island
    const vg = ctx.createRadialGradient(270, oy + MAP_H * cell / 2, 200, 270, oy + MAP_H * cell / 2, 520);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, 540, 960);
    ctx.font = font(9);
    ctx.fillStyle = '#8890b8';
    ctx.fillText(
      this.pendingNext <= this.waveIndex ? 'tap to begin the climb' : 'choose your route — tap a linked stop',
      270,
      oy + MAP_H * cell + 40,
    );
    ctx.font = font(7);
    ctx.fillStyle = '#5a6488';
    ctx.fillText('WILD fight · ELITE hard+bonus · REST heal · FIND item · SHRINE blood · MART 500pts · ??? unknown', 270, oy + MAP_H * cell + 56);
  }

  // Hazard zones are gameplay overlays (like the court paint), not
  // scenery — translucent pools the ball visibly reacts to.
  private drawHazard(ctx: CanvasRenderingContext2D, hz: Hazard) {
    const TAU = Math.PI * 2;
    ctx.save();
    if (hz.kind === 'lava') {
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
    } else if (hz.kind === 'grass') {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#2f7a2a';
      ctx.beginPath();
      ctx.ellipse(hz.x, hz.y, hz.r, hz.r * 0.6, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#57b04e';
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        const bx = hz.x + Math.cos(a) * hz.r * 0.7;
        const by = hz.y + Math.sin(a) * hz.r * 0.42;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a) * 4, by - 8);
        ctx.stroke();
      }
    } else if (hz.kind === 'gust') {
      const d = hz.dir ?? 1;
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#bfe6ff';
      ctx.beginPath();
      ctx.ellipse(hz.x, hz.y, hz.r, hz.r * 0.5, 0, 0, TAU);
      ctx.fill();
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
      // silence field: a crackling violet pool — keywords can't fire inside
      const pulse = 0.3 + Math.sin(this.time * 3.2) * 0.08;
      ctx.globalAlpha = pulse + 0.2;
      ctx.fillStyle = '#4a2a78';
      ctx.beginPath();
      ctx.ellipse(hz.x, hz.y, hz.r, hz.r * 0.6, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#c8a0ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = this.time * 2 + i * 2.1;
        ctx.beginPath();
        ctx.arc(hz.x + Math.cos(a) * hz.r * 0.4, hz.y + Math.sin(a) * hz.r * 0.3, 7, 0, TAU);
        ctx.stroke();
      }
    } else {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#241f30';
      ctx.beginPath();
      ctx.ellipse(hz.x, hz.y, hz.r, hz.r * 0.55, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#9a9ab0';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.4;
        const sx = hz.x + Math.cos(a) * hz.r * 0.55;
        const sy = hz.y + Math.sin(a) * hz.r * 0.3;
        ctx.beginPath();
        ctx.moveTo(sx - 4, sy);
        ctx.lineTo(sx, sy - 9);
        ctx.lineTo(sx + 4, sy);
        ctx.closePath();
        ctx.fill();
      }
    }
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
      case 149: // hyper beam — the burning line to the nearest mon
        if (targets[0]) {
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(targets[0].x, targets[0].y);
          ctx.stroke();
        }
        break;
      case 150: // hunting orbs — marks on the two nearest mons
        ctx.lineWidth = 3;
        for (const p of targets.slice(0, 2)) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + 8, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      default: { // ring/blast attacks — show the radius they'll sweep
        ctx.lineWidth = 3;
        const R = e.def.id === 130 ? 300 : e.def.id === 6 ? 200 : 170;
        ctx.beginPath();
        ctx.arc(e.x, e.y, R, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawUnit(ctx: CanvasRenderingContext2D, u: Unit) {
    if (u.dead) return;
    // boss telegraph: one turn out, the signature's footprint ghosts in
    if (u.side === 'enemy' && u.boss && u.timer <= 1) this.drawTelegraph(ctx, u);
    // soft shadow grounds the sprite on the court
    ctx.fillStyle = 'rgba(8,10,20,0.3)';
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + u.r * 0.72, u.r * 0.82, u.r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (u.shiny) drawShiny(ctx, u.def.id, u.x, u.y, u.r * 2.6);
    else drawMon(ctx, u.def.id, u.x, u.y, u.r * 2.6);

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

    // weak point: a pulsing gold diamond on the marked face — aim at it
    if (u.wpA >= 0) {
      const s = 6.5 + Math.sin(this.time * 5) * 1.2;
      const wx = u.x + Math.cos(u.wpA) * u.r * 0.55;
      const wy = u.y + Math.sin(u.wpA) * u.r * 0.55;
      ctx.fillStyle = '#ffd84d';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx, wy - s);
      ctx.lineTo(wx + s, wy);
      ctx.lineTo(wx, wy + s);
      ctx.lineTo(wx - s, wy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // hp bar
    const bw = u.r * 2;
    const pct = Math.max(u.hp / u.maxHp, 0);
    ctx.fillStyle = '#000a';
    ctx.fillRect(u.x - bw / 2, u.y + u.r + 4, bw, 5);
    ctx.fillStyle = pct > 0.5 ? '#6fdc6f' : pct > 0.25 ? '#ffd84d' : '#ff6b6b';
    ctx.fillRect(u.x - bw / 2, u.y + u.r + 4, bw * pct, 5);

    if (u.side === 'enemy') {
      // attack countdown — ★ marks a signature attack, red when it fires next
      ctx.font = font(10);
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      const tag = u.boss ? `★${u.timer}` : `${u.timer}`;
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

  private drawAim(ctx: CanvasRenderingContext2D) {
    const u = this.active;
    const pull = { x: this.dragStart.x - this.dragNow.x, y: this.dragStart.y - this.dragNow.y };
    const pullLen = len(pull);
    if (pullLen < 12) return;
    const dir = norm(pull);
    const frac = this.charge();
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
        BASE_SHOT_SPEED * POWER * launchMult(u.def.stats) * this.launchBoost * u.launch * (0.4 + 0.6 * frac);
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
      ctx.fillStyle = color;
      for (const q of dots) {
        ctx.beginPath();
        ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
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
      // puzzle, so the answer is honest: type mult + weak-point window +
      // taunt block, no crits
      if (hit && !hit.dead) {
        const taunted = this.enemies.some((x) => !x.dead && x.def.taunt) && !hit.def.taunt;
        let label: string;
        let lc = '#ffffff';
        if (taunted) {
          label = 'BLOCKED';
          lc = '#8a90a8';
        } else {
          const mult = effectiveness(u.def.type, hit.def.type);
          const toE = norm({ x: hit.x - this.aimCache.hx, y: hit.y - this.aimCache.hy });
          const weak = hit.wpA >= 0 && toE.x * Math.cos(hit.wpA) + toE.y * Math.sin(hit.wpA) < -0.72;
          const est = Math.max(1, Math.round(
            physDamage(u.def.stats.atk, hit.def.stats.def, mult) *
              u.pow * this.physMult * this.dmgMult * (this.typePow[u.def.type] ?? 1) *
              (weak ? 3 + this.wpBonus : 1) * (hit.boss ? 1 + this.bossSlayer : 1),
          ));
          label = est >= hit.hp ? `≈${est} KO` : `≈${est}`;
          lc = est >= hit.hp ? '#ffd84d' : weak ? '#f8d030' : '#ffffff';
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
    {
      const bw = Math.min(320, a.w * 0.64);
      const bh = 16;
      const bx = a.x + (a.w - bw) / 2;
      const by = a.y + 14;
      const maxed = frac > 0.93;
      ctx.fillStyle = 'rgba(10,14,32,0.8)';
      ctx.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
      ctx.strokeStyle = '#0a0e20';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx - 4, by - 4, bw + 8, bh + 8);
      ctx.fillStyle = '#ffffff1c';
      ctx.fillRect(bx, by, bw, bh);
      // gold zone = the perfect-release window the fill ping-pongs into
      ctx.fillStyle = '#ffd84d33';
      ctx.fillRect(bx + bw * 0.93, by, bw * 0.07, bh);
      ctx.save();
      if (maxed) {
        ctx.shadowColor = '#ffd84d';
        ctx.shadowBlur = 14;
      }
      ctx.fillStyle = maxed ? '#ffd84d' : color;
      ctx.fillRect(bx, by, bw * frac, bh);
      ctx.restore();
      // gold tick marks where the max-power window opens
      ctx.fillStyle = '#ffd84d';
      ctx.fillRect(bx + bw * 0.93, by - 3, 2, bh + 6);
    }

    // launch arrow: unit -> opposite direction, length + glow from charge
    const ex = u.x + dir.x * (50 + frac * 160);
    const ey = u.y + dir.y * (50 + frac * 160);
    ctx.save();
    if (frac > 0.93) {
      ctx.shadowColor = '#ffd84d';
      ctx.shadowBlur = 16;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
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
    ctx.globalAlpha = alpha;
    ctx.shadowColor = w.color;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = w.color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha * 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r * 0.82, 0, Math.PI * 2);
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


