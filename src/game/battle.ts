import { Vec, len, dist, norm, vec } from '../core/vec';
import { drawMon, itemSprite } from '../core/assets';
import { sfx, buzz, cry } from '../core/audio';
import type { Sfx } from '../core/audio';
import { SpeciesDef, StageDef, rollWave, TOTAL_STAGES, ELITES } from './data';
import { Perk, rollPerks } from './perks';
import type { Rarity } from './perks';
import { drawBackdrop, drawWall, THEMES } from './bg';
import type { Theme } from './bg';
import { effectiveness, TYPE_COLOR } from './types';
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
  MOVE_NAME,
} from './stats';
import type { Role } from './stats';
import { PIXEL_FONT } from './screens';

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
  dead: boolean;
  dotTicks: number; // poison ticks remaining
  dotDmg: number;
  flashT: number; // white hit flash
  spawnT: number; // wave-entry pop-in countdown (includes stagger delay)
  cd: number; // player bump-super recharge in shots; 0 = ready
  cdMax: number; // threshold the pips count up to
  lastBump: number; // last time a pass-through triggered this ally
  role: Role; // stat-derived archetype
  revealed?: boolean; // enemies: flushed out of tall grass — until then they're hidden
  sash: boolean; // focus sash: survive one lethal hit at 1 HP
  pow: number; // role damage multiplier
  rngMul: number; // role super-range multiplier
  launch: number; // role launch-speed multiplier
  cdMod: number; // shots off the super cooldown
  lastHit: Map<number, number>; // shooter uid -> game time
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
  big: boolean;
}
interface Zap {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
  color: string;
}
interface Burst {
  x: number;
  y: number;
  r: number;
  t: number;
  life: number;
  color: string;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  size: number;
  color: string;
  shape: 'dot' | 'ember' | 'leaf' | 'bubble' | 'streak' | 'wisp' | 'meteor';
  grav: number;
}
interface Orb {
  x: number;
  y: number;
  target: Unit;
  dmg: number;
  t: number;
  wob: number; // spiral phase — each orb corkscrews on its own beat
  color: string;
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
}
// Normal-type quick attack: the bumped ally physically lunges at the
// target, slams it, then snaps back to its spot.
interface Dash {
  u: Unit;
  ox: number;
  oy: number;
  e: Unit;
  back: boolean;
  done: boolean;
  dmg: number;
}
interface Slash {
  x: number;
  y: number;
  ang: number;
  t: number;
  color: string;
}
interface Loop {
  x: number;
  y: number;
  r: number;
  t: number;
  life: number;
  color: string;
}
interface ScreenFlash {
  t: number;
  life: number;
  color: string;
}
interface Bolt {
  pts: Vec[]; // jagged main path
  branches: Vec[][]; // short fork stubs off the middle
  t: number;
  life: number;
  color: string;
}
interface Ghost {
  id: number; // sprite id — KO'd mon spins out and fades
  x: number;
  y: number;
  r: number;
  t: number;
  life: number;
  absorb?: boolean; // caught mon shrinks into the ball instead of spinning out
}
interface BallDrop {
  x: number;
  y: number;
  item: string; // poke-ball / master-ball sprite
  t: number;
  life: number;
}
interface Hazard {
  x: number;
  y: number;
  r: number;
  kind: 'slow' | 'speed' | 'turn' | 'ice';
  ang: number; // turn pads fling you along this angle
  armed: boolean;
}
interface Ledge {
  x: number;
  y: number;
  ang: number; // the one legal crossing direction — against it it's a wall
  len: number;
  armed: boolean; // re-arms once the ball is clear, so each hop sparks once
}

export type Phase = 'aim' | 'shot' | 'enemy' | 'reward' | 'won' | 'lost';

const STOP_SPEED = 45;
const FINAL_DEPTH = TOTAL_STAGES - 3; // rolled stages: 4..9 are depths 1..6
const BASE_SHOT_SPEED = 190; // base launch speed — pull distance only aims
const POWER = 8;
const WALL_REST = 0.92;
const UNIT_REST = 0.9;
const FRICTION = 1.7;
const HIT_COOLDOWN = 0.12;
const ENEMY_TURN_DELAY = 0.6;
const ENEMY_BASE_TIMER = 3;
const MELEE_TIMER = 2; // melee mons have to close in — they attack sooner
const MAX_PARTICLES = 260;

let nextUid = 1;

export class Battle {
  players: Unit[] = [];
  enemies: Unit[] = [];
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
  private aimCache = { sig: '', dots: [] as Vec[], hit: null as Unit | null, bounced: false };
  private texts: FloatText[] = [];
  private zaps: Zap[] = [];
  private bursts: Burst[] = [];
  private particles: Particle[] = [];
  private orbs: Orb[] = [];
  private waves: Wave[] = [];
  private dashes: Dash[] = [];
  private delays: { t: number; fn: () => void }[] = []; // staggered super hits
  private slashes: Slash[] = [];
  private loops: Loop[] = []; // styler capture rings
  private flashes: ScreenFlash[] = [];
  private bolts: Bolt[] = []; // forked lightning
  private ghosts: Ghost[] = []; // KO'd sprites spinning out
  private balls: BallDrop[] = []; // caught mons: ball drops in and wiggles
  private shake = 0;
  private hitStop = 0; // brief slow-mo on combo hits
  // relic mods
  dmgMult = 1;
  cdMult = 1;
  launchBoost = 1;
  regen = 0; // leftovers: fraction of maxHp healed after each shot
  physMult = 1; // choice band: contact damage
  specMult = 1; // choice specs: special bump damage
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
  slowImmune = false; // air balloon: tall grass doesn't slow the ball
  koHeal = 0; // exp share: heal team this fraction on each KO
  lifeDrain = 0; // life orb: team pays this fraction of maxHP per shot
  box: SpeciesDef[] = []; // captured mons — swap in between stages
  boxHp: number[] = []; // each boxed mon's hp fraction — benching never heals
  // run stats for end-of-run badges — RNGdle-style "what did this run earn"
  maxCombo = 0; // best pass-chain in a single shot
  maxKos = 0; // most enemies one shot downed
  totalKos = 0; // enemies downed all run
  caughtBoss = false;
  perksTaken = 0;
  boxSel = -1; // box index picked for swapping
  depth = 0; // rolled stages survived past the opening trio
  rewardOffers: Perk[] = [];
  pathElite = false; // reward-screen choice: take the elite road next
  eliteWave = false; // the wave just cleared was an elite one (bigger payout)
  lastRecruit: SpeciesDef | null = null; // stage's guaranteed catch, for the reward screen
  private rewardPending = false;
  private hpScale = 1;
  private obstacles: { x: number; y: number; r: number; prop: 'tree' | 'rock' }[];
  private theme: Theme; // current wave's scene — rotates each wave
  private hazards: Hazard[] = [];
  private ledges: Ledge[] = []; // one-way jump ledges, RSE-style
  private pool: { x: number; y: number; rx: number; ry: number } | null = null; // pond/lava region
  private wasInPool = false; // ball pool-entry edge detect for the splash

  constructor(
    public arena: Rect,
    team: SpeciesDef[],
    public stage: StageDef,
    private rng: () => number = Math.random,
  ) {
    this.theme = stage.theme;
    this.setPool();
    this.obstacles = [];
    this.genObstacles();
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
        dead: false,
        dotTicks: 0,
        dotDmg: 0,
        flashT: 0,
        spawnT: 0.3 + i * 0.06,
        cd,
        cdMax: cd,
        lastBump: -1,
        role,
        sash: false,
        pow: m.pow,
        rngMul: m.range,
        launch: m.launch,
        cdMod: m.cdMod,
        lastHit: new Map(),
      });
    });
    this.spawnWave(0);
  }

  get active(): Unit {
    return this.players[this.activeIdx];
  }

  get waveCount() {
    return this.stage.waves.length;
  }

  // Roll a fresh obstacle layout in the upper field, clear of players.
  private genObstacles() {
    this.obstacles = [];
    const count = 1 + Math.floor(this.rng() * 3);
    for (let k = 0; k < count; k++) {
      for (let tries = 0; tries < 8; tries++) {
        const o = {
          x: this.arena.x + this.arena.w * (0.15 + this.rng() * 0.7),
          y: this.arena.y + this.arena.h * (0.15 + this.rng() * 0.45),
          r: this.arena.w * (0.05 + this.rng() * 0.04),
          // region props: groves and the tree-top sky get trees, cave and
          // caldera get boulders; a stray of the other kind keeps it organic
          prop: this.rng() < (this.theme === 'grove' || this.theme === 'sky' ? 0.75 : 0.25)
            ? ('tree' as const)
            : ('rock' as const),
        };
        if (
          !this.inPool(o.x, o.y, o.r) &&
          this.players.every((p) => p.dead || dist(o, p) > o.r + p.r + 30)
        ) {
          this.obstacles.push(o);
          break;
        }
      }
    }
  }

  // Themed field hazards, upper field, per wave.
  private genHazards() {
    const KINDS: Hazard['kind'][] = ['slow', 'speed', 'turn', 'ice'];
    this.hazards = [];
    const count = 1 + Math.floor(this.rng() * 2);
    for (let k = 0; k < count; k++) {
      for (let tries = 0; tries < 8; tries++) {
        const hz: Hazard = {
          x: this.arena.x + this.arena.w * (0.15 + this.rng() * 0.7),
          y: this.arena.y + this.arena.h * (0.15 + this.rng() * 0.55),
          r: 55 + this.rng() * 25,
          kind: KINDS[Math.floor(this.rng() * KINDS.length)],
          ang: this.rng() * Math.PI * 2,
          armed: true,
        };
        if (
          !this.inPool(hz.x, hz.y, hz.r * 0.7) &&
          this.players.every((p) => p.dead || dist(hz, p) > hz.r + p.r + 20) &&
          this.obstacles.every((o) => dist(hz, o) > hz.r + o.r)
        ) {
          this.hazards.push(hz);
          break;
        }
      }
    }
  }

  // The pool the backdrop paints is fixed at nx .78, ny .2 — mirror it as a
  // real region. Pond (most themes) only swimmers cross; lava (volcano) only
  // fire/rock/fliers.
  private setPool() {
    this.pool = {
      x: this.arena.x + this.arena.w * 0.78,
      y: this.arena.y + this.arena.h * 0.2,
      rx: this.theme === 'volcano' ? 40 : 42,
      ry: this.theme === 'volcano' ? 27 : 30,
    };
  }

  private canCrossPool(u: Unit) {
    const t = u.def.type;
    return this.theme === 'volcano'
      ? t === 'fire' || t === 'rock' || t === 'flying'
      : t === 'water' || t === 'flying';
  }

  private inPool(x: number, y: number, pad = 0) {
    const w = this.pool;
    if (!w) return false;
    const dx = (x - w.x) / (w.rx + pad), dy = (y - w.y) / (w.ry + pad);
    return dx * dx + dy * dy < 1;
  }

  // One-way ledges: a dirt bank you can only hop in `ang`'s direction.
  private genLedges() {
    this.ledges = [];
    if (this.rng() < 0.4) return; // some waves get none
    const n = this.rng() < 0.35 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      for (let tries = 0; tries < 8; tries++) {
        const L: Ledge = {
          x: this.arena.x + this.arena.w * (0.2 + this.rng() * 0.6),
          y: this.arena.y + this.arena.h * (0.28 + this.rng() * 0.4),
          ang: Math.floor(this.rng() * 8) * (Math.PI / 4),
          len: 95 + this.rng() * 50,
          armed: true,
        };
        if (
          !this.inPool(L.x, L.y, L.len / 2 + 20) &&
          this.obstacles.every((o) => dist(L, o) > L.len / 2 + o.r) &&
          this.players.every((p) => p.dead || dist(L, p) > L.len / 2 + p.r + 40)
        ) {
          this.ledges.push(L);
          break;
        }
      }
    }
  }

  private spawnWave(i: number) {
    this.waveIndex = i;
    this.hpScale = 1 + this.depth * 0.25 + i * 0.12; // wave 3 mobs are +24% tanky
    // each wave is a new scene — rotate theme, re-roll obstacles + hazards
    const others = THEMES.filter((t) => t !== this.theme);
    this.theme = others[Math.floor(this.rng() * others.length)];
    this.setPool();
    this.genObstacles();
    this.genHazards();
    this.genLedges();
    // stale super timers mustn't carry hits into the fresh wave
    this.delays = [];
    this.waves = [];
    this.dashes = [];
    this.enemies = this.stage.waves[i].map((s, k) => ({
      uid: nextUid++,
      def: s.def,
      side: 'enemy',
      x: this.arena.x + this.arena.w * s.nx,
      y: this.arena.y + this.arena.h * s.ny,
      vx: 0,
      vy: 0,
      r: s.boss ? 46 : 26,
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
      dead: false,
      dotTicks: 0,
      dotDmg: 0,
      flashT: 0,
      spawnT: 0.3 + k * 0.08,
      cd: 0,
      cdMax: 1,
      lastBump: -1,
      role: 'wild',
      sash: false,
      pow: 1,
      rngMul: 1,
      launch: 1,
      cdMod: 0,
      lastHit: new Map(),
    }));
    // mons that can't cross the pond/lava shouldn't stand in it
    for (const e of this.enemies)
      if (!this.canCrossPool(e) && this.inPool(e.x, e.y, e.r)) this.poolPush(e);
    this.waveBanner = 1.4;
    if (i > 0) {
      this.screenFlash('#ffffff', 0.25);
      sfx('wave');
    }
    const boss = this.enemies.find((e) => e.boss);
    if (boss) cry(boss.def.id, 0.5); // boss roars on entry
  }

  // --- input (logical coords) ---

  pointerDown(p: Vec) {
    if (this.phase !== 'aim') return;
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
    const speed = BASE_SHOT_SPEED * POWER * launchMult(u.def.stats) * this.launchBoost * u.launch * (0.4 + 0.6 * charge);
    u.vx = dir.x * speed;
    u.vy = dir.y * speed;
    this.bumpsThisShot.clear();
    this.shotCombo = 0;
    this.kosThisShot = 0;
    this.stopTimer = 0;
    this.phase = 'shot';
    this.shots++;
    const c = TYPE_COLOR[u.def.type];
    this.burst(u.x, u.y, u.r * 2.2, c, 0.3);
    this.shower(u.x, u.y, 8, c, 220, 'streak');
    this.addShake(3);
    sfx('launch');
    buzz(15);
    if (this.lifeDrain > 0) {
      for (const p of this.players) {
        if (!p.dead) p.hp = Math.max(1, p.hp - Math.round(p.maxHp * this.lifeDrain));
      }
    }
    if (charge > 0.93) {
      this.texts.push({ x: u.x, y: u.y - u.r - 14, text: 'PERFECT!', t: 1, color: '#ffd84d', big: true });
      this.screenFlash('#ffd84d', 0.12);
      this.burst(u.x, u.y, u.r * 3.2, '#ffd84d', 0.35);
      // slow-mo beat + speedlines streaming off the launch
      this.hitStop = Math.max(this.hitStop, 0.16);
      sfx('perfect');
      buzz(40);
      for (let i = 0; i < 14 && this.particles.length < MAX_PARTICLES; i++) {
        const a = Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * 2.2;
        const sp = 700 + Math.random() * 500;
        this.particles.push({
          x: u.x - dir.x * 40 + (Math.random() - 0.5) * 120,
          y: u.y - dir.y * 40 + (Math.random() - 0.5) * 120,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          t: 0.3, life: 0.3, size: 3, color: '#ffffff', shape: 'streak', grav: 0,
        });
      }
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
    for (const z of this.zaps) z.t -= dt;
    this.zaps = this.zaps.filter((z) => z.t > 0);
    for (const b of this.bursts) b.t -= dt;
    this.bursts = this.bursts.filter((b) => b.t > 0);
    for (const s of this.slashes) s.t -= dt;
    this.slashes = this.slashes.filter((s) => s.t > 0);
    for (const l of this.loops) l.t -= dt;
    this.loops = this.loops.filter((l) => l.t > 0);
    for (const f of this.flashes) f.t -= dt;
    this.flashes = this.flashes.filter((f) => f.t > 0);
    for (const b of this.bolts) b.t -= dt;
    this.bolts = this.bolts.filter((b) => b.t > 0);
    for (const g of this.ghosts) g.t -= dt;
    this.ghosts = this.ghosts.filter((g) => g.t > 0);
    for (const b of this.balls) b.t -= dt;
    this.balls = this.balls.filter((b) => b.t > 0);
    for (const u of [...this.players, ...this.enemies]) {
      if (u.flashT > 0) u.flashT -= dt;
      if (u.spawnT > 0) u.spawnT -= dt;
    }
    this.shake *= Math.exp(-6 * dt);
    for (const p of this.particles) {
      p.t -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.t > 0);
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
    const sub = 2;
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const wave = this.enemies; // spawnWave swaps this array on wave clear
      const damp = Math.exp(-FRICTION * this.frictionMult * h);
      u.vx *= damp;
      u.vy *= damp;
      u.x += u.vx * h;
      u.y += u.vy * h;
      // speed trail while flying fast
      if (len({ x: u.vx, y: u.vy }) > 260 && this.particles.length < MAX_PARTICLES) {
        this.particles.push({
          x: u.x, y: u.y, vx: 0, vy: 0,
          t: 0.28, life: 0.28, size: u.r * 0.55,
          color: TYPE_COLOR[u.def.type], shape: 'dot', grav: 0,
        });
      }
      this.hitWalls(u);
      for (const o of this.obstacles) {
        if (this.collide(u, o)) {
          this.shower(u.x, u.y, 4, '#8a94c8', 160, 'streak');
        }
      }
      // one-way ledges — hop through going `ang`, wall coming back
      for (const L of this.ledges) {
        const nx = Math.cos(L.ang), ny = Math.sin(L.ang);
        const s = (u.x - L.x) * nx + (u.y - L.y) * ny;
        const t = -(u.x - L.x) * ny + (u.y - L.y) * nx;
        if (Math.abs(s) > u.r + 14 || Math.abs(t) > L.len / 2 + u.r) {
          L.armed = true;
          continue;
        }
        const vn = u.vx * nx + u.vy * ny;
        if (vn < 0 && s > 0 && Math.abs(t) < L.len / 2 + u.r * 0.3 && s < u.r + 5) {
          u.x += nx * (u.r + 5 - s);
          u.y += ny * (u.r + 5 - s);
          u.vx -= (1 + WALL_REST) * vn * nx;
          u.vy -= (1 + WALL_REST) * vn * ny;
          this.wallSpark(u.x, u.y, nx, ny);
          this.shower(u.x, u.y, 4, '#a08050', 140, 'streak');
        } else if (vn > 0 && Math.abs(s) < u.r && Math.abs(t) < L.len / 2 && L.armed) {
          L.armed = false; // hopped the ledge — dust puff + a little kick
          u.vx += nx * 90;
          u.vy += ny * 90;
          this.shower(u.x - nx * u.r, u.y - ny * u.r, 7, '#e8d8a8', 180, 'dot');
          sfx('hit', 1.7);
        }
      }
      // pond / lava — a wall unless this mon can cross it
      if (this.pool) {
        const w = this.pool;
        const rx = w.rx + u.r * 0.55, ry = w.ry + u.r * 0.55;
        const qx = (u.x - w.x) / rx, qy = (u.y - w.y) / ry;
        const inside = qx * qx + qy * qy < 1;
        if (inside && !this.canCrossPool(u)) {
          const q = Math.hypot(qx, qy) || 1;
          u.x = w.x + (qx / q) * rx;
          u.y = w.y + (qy / q) * ry;
          let nx = qx / rx, ny = qy / ry;
          const nl = Math.hypot(nx, ny) || 1;
          nx /= nl;
          ny /= nl;
          const vn = u.vx * nx + u.vy * ny;
          if (vn < 0) {
            u.vx -= (1 + WALL_REST) * vn * nx;
            u.vy -= (1 + WALL_REST) * vn * ny;
          }
          const wet = this.theme === 'volcano';
          this.shower(u.x, u.y, 5, wet ? '#ffb060' : '#9df0ff', 170, 'dot');
          if (!this.wasInPool) sfx('splash');
        }
        if (inside && !this.wasInPool && this.canCrossPool(u)) {
          // swimmer dives in — ring splash + sparkle trail
          this.burst(u.x, u.y, 30, '#9df0ff', 0.35);
          sfx('splash');
        }
        this.wasInPool = inside;
      }
      for (const hz of this.hazards) {
        const inside = dist(u, hz) < hz.r;
        if (hz.kind === 'turn') {
          // warp pad: on entry, fling the ball along the pad's arrow
          if (!inside) hz.armed = true;
          else if (hz.armed && u.vx * u.vx + u.vy * u.vy > 3600) {
            hz.armed = false;
            const sp = len({ x: u.vx, y: u.vy }) * 1.15;
            u.vx = Math.cos(hz.ang) * sp;
            u.vy = Math.sin(hz.ang) * sp;
            this.burst(u.x, u.y, hz.r * 0.9, '#b86fd8', 0.3);
            this.shower(u.x, u.y, 8, '#b86fd8', 260, 'streak');
            this.addShake(3);
            sfx('zap');
          }
        } else if (inside) {
          if (hz.kind === 'slow') {
            if (this.slowImmune) continue; // air balloon floats over grass
            // tall grass: heavy drag + kicked-up leaves
            const dmp = Math.exp(-4.5 * h);
            u.vx *= dmp;
            u.vy *= dmp;
            if (this.particles.length < MAX_PARTICLES && Math.random() < 0.3)
              this.particles.push({ x: u.x, y: u.y, vx: -u.vx * 0.2, vy: -u.vy * 0.2 - 40, t: 0.4, life: 0.4, size: 4, color: '#58a848', shape: 'leaf', grav: 200 });
          } else if (hz.kind === 'ice') {
            // ice sheet — undo most of the friction, you keep sliding
            const und = Math.exp(FRICTION * this.frictionMult * h * 0.92);
            u.vx *= und;
            u.vy *= und;
            if (this.particles.length < MAX_PARTICLES && Math.random() < 0.35)
              this.particles.push({ x: u.x, y: u.y, vx: -u.vx * 0.05, vy: -u.vy * 0.05 - 20, t: 0.4, life: 0.4, size: 3, color: '#c8f0ff', shape: 'streak', grav: 0 });
          } else {
            // charge pad: accelerate along current heading
            const dir = norm({ x: u.vx, y: u.vy });
            u.vx += dir.x * 2400 * h;
            u.vy += dir.y * 2400 * h;
            if (this.particles.length < MAX_PARTICLES && Math.random() < 0.4)
              this.particles.push({ x: u.x, y: u.y, vx: dir.x * 200, vy: dir.y * 200, t: 0.25, life: 0.25, size: 3, color: '#f8d030', shape: 'streak', grav: 0 });
          }
        }
      }
      for (const e of wave) {
        if (this.enemies !== wave) break;
        // getting close flushes hidden mons out of the tall grass — regular
        // foes keep their '?' chip until they take a hit or attack
        if (this.hidden(e) && dist(u, e) < u.r + e.r + 68) this.reveal(e);
        if (!e.dead && this.collide(u, e)) this.strikeEnemy(u, e);
      }
      for (const p of this.players) {
        // pass through teammates — each pass is a link-bump combo tick
        if (!p.dead && p !== u && dist(u, p) < u.r + p.r && u.vx * u.vx + u.vy * u.vy > 1600)
          this.bumpAlly(p, u);
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
              this.slash(target.x, target.y, TYPE_COLOR[e.def.type]);
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
      this.clampToArena(e);
      for (const o of this.obstacles) this.separate(e, o);
      // wild mons can't hop ledges — the bank is a wall both ways for them
      for (const L of this.ledges) {
        const nx = Math.cos(L.ang), ny = Math.sin(L.ang);
        const s = (e.x - L.x) * nx + (e.y - L.y) * ny;
        const t = -(e.x - L.x) * ny + (e.y - L.y) * nx;
        if (Math.abs(s) < e.r + 4 && Math.abs(t) < L.len / 2 + e.r * 0.5) {
          const side = s >= 0 ? 1 : -1;
          e.x += nx * (side * (e.r + 4) - s);
          e.y += ny * (side * (e.r + 4) - s);
        }
      }
      if (!this.canCrossPool(e) && this.inPool(e.x, e.y, e.r * 0.5)) this.poolPush(e);
      for (const p of this.players) {
        if (!p.dead) this.separate(e, p);
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

  // Homing orbs from water bump attacks.
  private stepOrbs(dt: number) {
    for (const o of this.orbs) {
      o.t -= dt;
      if (o.target.dead) {
        const next = this.enemies.find((e) => !e.dead);
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
      if (this.particles.length < MAX_PARTICLES && Math.random() < 0.5) {
        this.particles.push({
          x: o.x, y: o.y, vx: 0, vy: -30,
          t: 0.4, life: 0.4, size: 4,
          color: '#9df0ff', shape: 'bubble', grav: 0,
        });
      }
      if (dist(o, o.target) < o.target.r + 6) {
        this.hurt(o.target, o.dmg, '#9df0ff');
        this.burst(o.x, o.y, 44, '#6890f0', 0.3);
        this.shower(o.x, o.y, 12, '#9df0ff', 200, 'bubble');
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
      for (const e of this.enemies) {
        if (e.dead || w.hits.has(e.uid)) continue;
        if (dist(w, e) > w.r + e.r * 0.5) continue;
        w.hits.add(e.uid);
        if (!this.losBlocked(w.x, w.y, e.x, e.y)) w.onHit(e);
      }
    }
    this.waves = this.waves.filter((w) => w.t > 0);
  }

  // Quick-attack lunges: the ally streaks to its target, lands the hit,
  // then zips back — position never actually changes hands.
  private stepDashes(dt: number) {
    const SP = 1100;
    for (const d of this.dashes) {
      const tx = d.back ? d.ox : d.e.x;
      const ty = d.back ? d.oy : d.e.y;
      const dir = norm({ x: tx - d.u.x, y: ty - d.u.y });
      const left = dist(d.u, { x: tx, y: ty });
      if (left <= SP * dt) {
        d.u.x = tx;
        d.u.y = ty;
      } else {
        d.u.x += dir.x * SP * dt;
        d.u.y += dir.y * SP * dt;
      }
      if (this.particles.length < MAX_PARTICLES) {
        this.particles.push({
          x: d.u.x, y: d.u.y, vx: 0, vy: 0,
          t: 0.22, life: 0.22, size: d.u.r * 0.5,
          color: '#ffffff', shape: 'streak', grav: 0,
        });
      }
      if (d.back) {
        if (d.u.x === d.ox && d.u.y === d.oy) d.done = true;
      } else if (!d.e.dead && dist(d.u, d.e) < d.u.r + d.e.r + 4) {
        this.hurt(d.e, d.dmg, '#9df0ff');
        this.slash(d.e.x, d.e.y, '#ffffff');
        this.slash(d.e.x, d.e.y, '#e8e8a8');
        this.addShake(5);
        this.hitStop = Math.max(this.hitStop, 0.06);
        sfx('hit');
        d.back = true;
      } else if (dist(d.u, { x: tx, y: ty }) < 8) {
        d.back = true; // target died mid-lunge — just come home
      }
    }
    this.dashes = this.dashes.filter((d) => !d.done);
  }

  private hitWalls(u: Unit) {
    const a = this.arena;
    if (u.x - u.r < a.x) {
      u.x = a.x + u.r;
      u.vx = -u.vx * WALL_REST;
      this.wallSpark(u.x - u.r, u.y, 1, 0);
    } else if (u.x + u.r > a.x + a.w) {
      u.x = a.x + a.w - u.r;
      u.vx = -u.vx * WALL_REST;
      this.wallSpark(u.x + u.r, u.y, -1, 0);
    }
    if (u.y - u.r < a.y) {
      u.y = a.y + u.r;
      u.vy = -u.vy * WALL_REST;
      this.wallSpark(u.x, u.y - u.r, 0, 1);
    } else if (u.y + u.r > a.y + a.h) {
      u.y = a.y + a.h - u.r;
      u.vy = -u.vy * WALL_REST;
      this.wallSpark(u.x, u.y + u.r, 0, -1);
    }
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

  // An enemy sitting inside a tall-grass pad is concealed until flushed out.
  private hidden(e: Unit) {
    return (
      e.side === 'enemy' &&
      !e.dead &&
      !e.revealed &&
      e.spawnT <= 0 &&
      this.hazards.some((hz) => hz.kind === 'slow' && dist(e, hz) < hz.r * 0.85)
    );
  }

  private reveal(e: Unit) {
    if (e.revealed) return;
    e.revealed = true;
    this.shower(e.x, e.y, 10, '#58a848', 220, 'leaf');
    this.texts.push({ x: e.x, y: e.y - e.r - 10, text: '!', t: 0.7, color: '#ffd84d', big: true });
    sfx('hit', 1.6);
    cry(e.def.id, 0.4); // flushed out of the grass, it cries as it lands
  }

  // Shove a unit radially out of the pond/lava region.
  private poolPush(u: Unit) {
    const w = this.pool;
    if (!w) return;
    const dx = u.x - w.x, dy = u.y - w.y;
    const q = Math.hypot(dx / w.rx, dy / w.ry) || 1;
    u.x = w.x + (dx / (w.rx * q)) * (w.rx + u.r);
    u.y = w.y + (dy / (w.ry * q)) * (w.ry + u.r);
  }

  // Central damage path so every source (contact, bump, orb, dot) behaves alike.
  private hurt(e: Unit, dmg: number, color: string, suffix = '') {
    if (e.dead) return;
    e.revealed = true; // any damage flushes it out of the grass
    let d = dmg;
    if (suffix === '!') d *= 1 + this.belt; // expert belt loves super-effective
    let crit = false;
    if (this.critCh > 0 && this.rng() < this.critCh) {
      crit = true;
      d *= 2;
    }
    d = Math.round(d * this.dmgMult);
    e.hp -= d;
    e.flashT = 0.12;
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
        weakest.flashT = Math.max(weakest.flashT, 0.1);
      }
    }
    this.texts.push({
      x: e.x,
      y: e.y - e.r - 8,
      text: crit ? `${d} CRIT!` : `${d}${suffix}`,
      t: 0.9,
      color: crit ? '#ffd84d' : color,
      big: crit || suffix === '!',
    });
    if (crit) this.addShake(4);
    // styler loop wraps the target — every hit is another circle
    this.loops.push({ x: e.x, y: e.y, r: e.r + 12, t: 0.5, life: 0.5, color: '#9df0ff' });
    if (e.hp <= 0) {
      e.dead = true;
      // every KO feeds the team's supers — kills are the fast lane to READY
      for (const p of this.players) this.chargeUp(p);
      // multi-KO callouts — chaining kills in one shot should feel huge
      this.kosThisShot++;
      this.totalKos++;
      this.maxKos = Math.max(this.maxKos, this.kosThisShot);
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
      const caught = master || this.rng() < this.captureChance + (e.boss ? this.bossCatch : 0);
      if (master) this.masterArmed = false;
      if (caught) {
        // absorbed by the ball — shrinks in place, no faint spin
        this.ghosts.push({ id: e.def.id, x: e.x, y: e.y, r: e.r, t: 0.4, life: 0.4, absorb: true });
      } else {
        // faint anim: the sprite spins out and fades while the rings land
        this.ghosts.push({ id: e.def.id, x: e.x, y: e.y, r: e.r, t: e.boss ? 0.8 : 0.45, life: e.boss ? 0.8 : 0.45 });
      }
      sfx('ko');
      buzz(e.boss ? [50, 60, 90] : 30);
      // capture complete: stacked loops + release sparkle
      this.loops.push({ x: e.x, y: e.y, r: e.r + 20, t: 0.7, life: 0.7, color: '#ffffff' });
      this.loops.push({ x: e.x, y: e.y, r: e.r + 30, t: 0.9, life: 0.9, color: '#9df0ff' });
      this.texts.push({
        x: e.x, y: e.y - e.r - 22,
        text: `${e.def.name.toUpperCase()} ${caught ? 'CAUGHT!' : 'FAINTED!'}`,
        t: caught ? 1.5 : 1.1,
        color: caught ? '#ffd84d' : '#9df0ff',
        big: true,
      });
      if (caught) {
        this.box.push(e.def);
        this.boxHp.push(1);
        if (e.boss) this.caughtBoss = true;
        this.screenFlash('#ffd84d', 0.2);
        this.converge(e.x, e.y, 10, '#ffd84d', 'wisp');
        // real poké ball drops in and does the triple-wiggle
        this.balls.push({ x: e.x, y: e.y, item: master ? 'master-ball' : 'poke-ball', t: 1.15, life: 1.15 });
        sfx('caught');
        cry(e.def.id, 0.45);
        buzz([30, 50, 30, 50, 60]);
      }
      for (let i = 0; i < 5; i++) {
        this.particles.push({
          x: e.x + (Math.random() - 0.5) * e.r, y: e.y,
          vx: (Math.random() - 0.5) * 60, vy: -140 - Math.random() * 80,
          t: 0.9, life: 0.9, size: 4, color: '#dff4ff', shape: 'wisp', grav: -60,
        });
      }
      this.burst(e.x, e.y, e.r * 3, '#ffffff', 0.45);
      this.burst(e.x, e.y, e.r * 1.8, TYPE_COLOR[e.def.type], 0.3);
      this.shower(e.x, e.y, 14, TYPE_COLOR[e.def.type], 240, 'ember');
      this.addShake(e.boss ? 14 : 5);
      if (this.enemies.every((x) => x.dead)) this.waveCleared();
    }
  }

  private strikeEnemy(shooter: Unit, e: Unit) {
    const last = e.lastHit.get(shooter.uid) ?? -1;
    if (this.time - last < HIT_COOLDOWN) return;
    e.lastHit.set(shooter.uid, this.time);
    const mult = effectiveness(shooter.def.type, e.def.type);
    // every link in the chain adds momentum: +5% contact damage per pass
    const dmg = Math.round(
      physDamage(shooter.def.stats.atk, e.def.stats.def, mult) *
        shooter.pow * this.physMult * (1 + this.shotCombo * (0.05 + this.comboDmg)),
    );
    const color = mult > 1 ? '#ffd84d' : mult < 1 ? '#8a90a8' : '#ffffff';
    this.hurt(e, dmg, color, mult > 1 ? '!' : '');
    const c = TYPE_COLOR[shooter.def.type];
    this.slash(e.x, e.y, c);
    this.shower(e.x, e.y, 6, c, 200, 'ember');
    this.addShake(mult > 1 ? 4 : 2);
    sfx('hit', 1 + this.shotCombo * 0.12);
    buzz(8);
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
    const c = TYPE_COLOR[p.def.type];
    switch (p.role) {
      case 'speedster': { // lightning-fast jab at the closest enemy
        const t = near(140).sort((a, b) => dist(p, a) - dist(p, b))[0];
        if (t) {
          this.zap(p.x, p.y, t.x, t.y, c);
          this.hurt(t, bumpDmg(t, 0.3), '#9df0ff');
        }
        break;
      }
      case 'bruiser': { // point-blank shockwave
        const ts = near(95);
        if (ts.length) {
          this.burst(p.x, p.y, 60, c, 0.2);
          for (const e of ts) this.hurt(e, bumpDmg(e, 0.25), '#9df0ff');
        }
        break;
      }
      case 'sniper': { // long-range poke at the farthest target
        const t = near(280).sort((a, b) => dist(p, b) - dist(p, a))[0];
        if (t) {
          this.zap(p.x, p.y, t.x, t.y, c);
          this.hurt(t, bumpDmg(t, 0.35), '#9df0ff');
        }
        break;
      }
      case 'tank': // brace: small self-mend on every pass
        if (p.hp < p.maxHp) {
          p.hp = Math.min(p.hp + Math.ceil(p.maxHp * 0.03), p.maxHp);
          this.converge(p.x, p.y, 4, '#6fdc6f', 'leaf');
        }
        break;
      case 'healer': { // splash health to whoever needs it most
        const w = this.players
          .filter((x) => !x.dead && x.hp < x.maxHp)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (w) {
          w.hp = Math.min(w.hp + Math.ceil(w.maxHp * 0.04), w.maxHp);
          this.zap(p.x, p.y, w.x, w.y, '#6fdc6f');
        }
        break;
      }
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
    this.shotCombo++;
    this.maxCombo = Math.max(this.maxCombo, this.shotCombo);
    const n = this.shotCombo;
    const c = TYPE_COLOR[p.def.type];
    // link arc between ball and ally + pulse — every pass reads as a hit
    this.zap(u.x, u.y, p.x, p.y, '#ffd84d');
    this.burst(p.x, p.y, p.r * (1.7 + n * 0.3), c, 0.25);
    this.shower(p.x, p.y, 4 + n * 2, c, 160 + n * 30, 'streak');
    p.flashT = 0.2;
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
    // rocks give cover: supers can't hit targets they can't see
    const near = (radius: number) =>
      this.enemies.filter(
        (e) => !e.dead && dist(p, e) <= radius * p.rngMul + e.r && !this.losBlocked(p.x, p.y, e.x, e.y),
      );
    const nearest = (from: Unit, radius: number) =>
      this.enemies
        .filter((e) => !e.dead && dist(from, e) <= radius * p.rngMul + e.r && !this.losBlocked(from.x, from.y, e.x, e.y))
        .sort((a, b) => dist(from, a) - dist(from, b))[0];
    const phys = bumpIsPhysical(p.def.type);
    const eff = (e: Unit) => effectiveness(p.def.type, e.def.type);
    // Physical bump attacks roll Attack vs Defense; elemental ones SpA vs SpD.
    const bumpDmg = (e: Unit, power: number) =>
      Math.round(
        (phys
          ? physDamage(p.def.stats.atk, e.def.stats.def, eff(e), power) * this.physMult
          : specDamage(p.def.stats.spa, e.def.stats.spd, eff(e), power) * this.specMult) *
          p.pow *
          (1 + (n - 1) * this.comboDmg), // metronome ramps with combo length
      );
    // passive talent: a small role effect on EVERY pass, on or off cooldown
    this.allyPassive(p, near, bumpDmg);
    if (p.cd > 0) {
      // super still recharging — link sparks but no attack
      this.shower(p.x, p.y, 5, '#8890b8', 90, 'dot');
      return;
    }
    p.cd = Math.max(1, Math.round(bumpCooldown(p.def.type) * this.cdMult) - p.cdMod);
    p.cdMax = p.cd;
    this.bumpsThisShot.add(p.uid);
    p.flashT = 0.25;
    // move callout, freeze-frame, and a white converge flash on the caster
    this.texts.push({
      x: p.x, y: p.y - p.r - 46,
      text: `${p.def.name.toUpperCase()} used ${MOVE_NAME[p.def.type]}!`,
      t: 1.05, color: TYPE_COLOR[p.def.type], big: true,
    });
    this.hitStop = Math.max(this.hitStop, 0.18);
    this.converge(p.x, p.y, 10, '#ffffff', 'streak');
    const color = TYPE_COLOR[p.def.type];
    this.screenFlash(color, 0.08);
    sfx(SUPER_SFX[p.def.type]);
    cry(p.def.id, 0.35);
    buzz(20);

    switch (p.def.type) {
      case 'fire': {
        // flame burst: a shockwave ring rolls out from the ally — enemies
        // catch fire as the front passes over them
        this.burst(p.x, p.y, 70, '#ffffff', 0.25);
        this.screenFlash('#f08030', 0.15);
        this.addShake(8);
        this.shower(p.x, p.y, 18, color, 320, 'ember');
        this.waves.push({
          x: p.x, y: p.y, r: 0, maxR: 170 * p.rngMul, t: 0.4, life: 0.4,
          color, hits: new Set(),
          onHit: (e) => {
            const dir = norm({ x: e.x - p.x, y: e.y - p.y });
            e.vx += dir.x * 170;
            e.vy += dir.y * 170;
            this.burst(e.x, e.y, 34, '#f08030', 0.22);
            this.shower(e.x, e.y, 6, '#ffb060', 220, 'ember');
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
            .filter(
              (e) => !e.dead && !hit.has(e.uid) && dist(from, e) <= 190 * p.rngMul &&
                !this.losBlocked(from.x, from.y, e.x, e.y),
            )
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
            this.bolt(c.a.x, c.a.y, c.e.x, c.e.y, color);
            this.bolt(c.e.x, this.arena.y, c.e.x, c.e.y, color); // sky strike
            this.shower(c.e.x, c.e.y, 8, color, 200, 'dot');
            this.burst(c.e.x, c.e.y, 36, '#fffbe0', 0.2);
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
        this.burst(p.x, p.y, 140, color, 0.4);
        this.converge(p.x, p.y, 14, color, 'leaf');
        let dealt = 0;
        for (const e of near(140)) {
          const dmg = bumpDmg(e, 1.1);
          dealt += dmg;
          this.zap(e.x, e.y, p.x, p.y, '#78c850');
          this.hurt(e, dmg, '#9df0ff');
        }
        const heal = Math.max(Math.round(dealt * 0.35), 4);
        for (const pl of this.players) {
          if (pl.dead) continue;
          pl.hp = Math.min(pl.hp + heal, pl.maxHp);
          pl.flashT = 0.15;
          this.texts.push({ x: pl.x, y: pl.y - pl.r - 8, text: `+${heal}`, t: 0.9, color: '#6fdc6f', big: false });
        }
        break;
      }
      case 'water':
        // hydro pump: homing orbs corkscrew into the 3 nearest enemies
        this.burst(p.x, p.y, 80, color, 0.3);
        this.shower(p.x, p.y, 10, '#9df0ff', 180, 'bubble');
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
        this.burst(p.x, p.y, radius * 0.6, '#ffffff', 0.3);
        this.shower(p.x, p.y, 14, color, 340, 'streak');
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
        this.burst(p.x, p.y, radius, color, 0.5);
        this.converge(p.x, p.y, 16, color, 'wisp');
        this.screenFlash(color, 0.1);
        this.addShake(5);
        // spiral wind streaks
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = 50 + Math.random() * radius;
          const px = p.x + Math.cos(a) * r;
          const py = p.y + Math.sin(a) * r;
          this.particles.push({
            x: px, y: py,
            vx: Math.cos(a + Math.PI / 2) * 260 - (px - p.x) * 2.4,
            vy: Math.sin(a + Math.PI / 2) * 260 - (py - p.y) * 2.4,
            t: 0.5, life: 0.5, size: 4, color: '#d8f0ff', shape: 'streak', grav: 0,
          });
        }
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
        this.burst(p.x, p.y, 140, color, 0.4);
        this.shower(p.x, p.y, 22, '#c060c0', 110, 'bubble');
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
          this.skyFall(e.x, '#b8a038');
          this.burst(e.x, e.y, e.r * 2, '#ffffff', 0.22);
          this.hurt(e, bumpDmg(e, 0.8), '#9df0ff');
          this.later(0.14, () => {
            if (e.dead) return;
            this.skyFall(e.x, '#b8a038');
            this.burst(e.x, e.y, e.r * 3, color, 0.4);
            this.slash(e.x, e.y, '#ffffff');
            this.slash(e.x, e.y, color);
            this.slash(e.x, e.y, '#ffd84d');
            this.shower(e.x, e.y, 16, '#b8a038', 300, 'ember');
            this.screenFlash('#b8a038', 0.12);
            this.addShake(12);
            this.hurt(e, bumpDmg(e, 2.2), '#9df0ff');
          });
        }
        break;
      }
      case 'ghost': {
        // hex: wisps converge on every enemy from the dark
        this.burst(p.x, p.y, 230, color, 0.5);
        this.screenFlash('#705898', 0.18);
        for (const e of near(Infinity)) {
          this.converge(e.x, e.y, 8, '#705898', 'wisp');
          this.hurt(e, bumpDmg(e, 1.1), '#9df0ff');
        }
        break;
      }
      default: {
        // quick attack: the ally physically dashes to the nearest enemy,
        // slams it, and snaps back — pure speed
        const e = nearest(p, 240);
        if (e) {
          this.zap(p.x, p.y, e.x, e.y, color);
          this.dashes.push({ u: p, ox: p.x, oy: p.y, e, back: false, done: false, dmg: bumpDmg(e, 1.5) });
        }
      }
    }
    // healer role: every super also mends the team
    if (p.role === 'healer') {
      for (const pl of this.players) {
        if (pl.dead) continue;
        const heal = Math.max(1, Math.round(pl.maxHp * 0.15));
        pl.hp = Math.min(pl.hp + heal, pl.maxHp);
        pl.flashT = 0.15;
        this.texts.push({ x: pl.x, y: pl.y - pl.r - 8, text: `+${heal}`, t: 0.9, color: '#6fdc6f', big: false });
        this.converge(pl.x, pl.y, 5, '#6fdc6f', 'leaf');
      }
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
      this.burst(p.x, p.y, 140, '#ffffff', 0.35);
      this.shower(p.x, p.y, 24, '#ffd84d', 320, 'ember');
      this.addShake(8);
      this.texts.push({ x: p.x, y: p.y - p.r - 40, text: 'TEAM COMBO!', t: 1.2, color: '#ffd84d', big: true });
    }
  }

  private waveCleared() {
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

  // Swap a boxed mon onto the team — unlimited during a reward break. HP
  // belongs to the mon, not the slot: a hurt mon stays hurt in the box and a
  // fainted one stays fainted, so benching is never a free heal or revive.
  swapFromBox(bi: number, ti: number) {
    if (this.phase !== 'reward') return;
    const def = this.box[bi];
    const frac = this.boxHp[bi] ?? 1;
    const p = this.players[ti];
    if (!def || !p) return;
    this.box.splice(bi, 1);
    this.boxHp.splice(bi, 1);
    this.box.push(p.def); // benched ally goes back to the box
    this.boxHp.push(p.maxHp ? p.hp / p.maxHp : 0);
    const role = roleOf(def.stats, def.healer);
    const m = ROLE_MODS[role];
    const hp = Math.round(playerHp(def.stats) * m.hp);
    p.def = def;
    p.role = role;
    p.pow = m.pow;
    p.rngMul = m.range;
    p.launch = m.launch;
    p.cdMod = m.cdMod;
    p.maxHp = hp;
    p.hp = frac <= 0 ? 0 : Math.max(1, Math.round(hp * frac));
    p.dead = p.hp <= 0;
    p.cdMax = Math.max(1, Math.round(bumpCooldown(def.type) * this.cdMult) - p.cdMod);
    p.cd = p.cdMax; // swapped in discharged — it has to earn its first super
    this.boxSel = -1;
    this.burst(p.x, p.y, p.r * 2.4, '#ffd84d', 0.35);
    this.screenFlash('#ffd84d', 0.12);
    sfx('caught');
  }

  // What comes after the reward break — for the path-choice UI.
  get nextIsGym() {
    const n = this.waveIndex + 1;
    return n < this.waveCount
      ? this.stage.waves[n].some((s) => s.boss)
      : (this.depth + 1) % 3 === 0;
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

  private enterReward() {
    this.boxSel = -1;
    // elite stages pay out uncommon-or-better relics — the risk has a price
    this.rewardOffers = rollPerks(this.rng, this.eliteWave ? 2 : 3);
    this.eliteWave = false;
    this.lastRecruit = this.rollRecruit();
    if (this.lastRecruit) {
      this.box.push(this.lastRecruit);
      this.boxHp.push(1);
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
    this.rewardOffers = [];
    const next = this.waveIndex + 1;
    if (next >= this.waveCount) {
      // next stage is rolled, not fixed — descend, maybe via the elite road
      this.depth++;
      this.hpScale = 1 + this.depth * 0.25;
      this.eliteWave = this.pathElite;
      this.pathElite = false;
      this.stage.waves.push(rollWave(this.rng, this.depth, this.eliteWave));
    }
    this.spawnWave(next);
    this.nextTurn();
  }

  // RNGdle-style run analysis: scan what the run did, award badges with
  // rarities, rarest first. Every run earns at least TRAINER.
  runBadges(won: boolean): { name: string; rarity: Rarity }[] {
    const faints = this.players.filter((u) => u.dead).length;
    const b: { name: string; rarity: Rarity }[] = [];
    if (this.maxKos >= 4) b.push({ name: 'MEGA KO', rarity: 'legendary' });
    else if (this.maxKos >= 3) b.push({ name: 'TRIPLE KO', rarity: 'rare' });
    else if (this.maxKos >= 2) b.push({ name: 'DOUBLE KO', rarity: 'common' });
    if (this.maxCombo >= 4) b.push({ name: 'COMBO CHAIN', rarity: 'rare' });
    if (this.caughtBoss) b.push({ name: 'BOSS THIEF', rarity: 'legendary' });
    if (this.box.length >= 3) b.push({ name: 'SAFARI ZONE', rarity: 'rare' });
    else if (this.box.length >= 2) b.push({ name: 'COLLECTOR', rarity: 'uncommon' });
    if (this.totalKos >= 8) b.push({ name: 'RAMPAGE', rarity: 'common' });
    if (this.perksTaken >= 3) b.push({ name: 'RELIC HUNTER', rarity: 'uncommon' });
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


  // true if a rock blocks the straight line a→b (cover blocks abilities)
  private losBlocked(ax: number, ay: number, bx: number, by: number) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy || 1;
    for (const o of this.obstacles) {
      const t = Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.y - ay) * dy) / lenSq));
      const px = ax + dx * t - o.x, py = ay + dy * t - o.y;
      if (px * px + py * py < o.r * o.r) return o;
    }
    return null;
  }

  // one notch of super charge — burst + sound when it flips to READY so the
  // moment reads whether it came from a shot or a KO
  private chargeUp(p: Unit) {
    if (p.cd <= 0) return;
    p.cd--;
    if (p.cd === 0 && !p.dead) {
      sfx('ready');
      this.burst(p.x, p.y, p.r * 2.2, TYPE_COLOR[p.def.type], 0.3);
      this.shower(p.x, p.y, 8, '#ffd84d', 160, 'streak');
    }
  }

  private endShot() {
    const u = this.active;
    u.vx = 0;
    u.vy = 0;
    // supers recharge per shot taken; leftovers ticks a small heal
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
        this.burst(e.x, e.y, 30, '#a040a0', 0.25);
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
        e.revealed = true; // attacking gives away your hiding spot
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

  private resolveEnemyTurn() {
    for (const e of this.pendingAttacks) {
      e.timer = (e.def.melee ? MELEE_TIMER : ENEMY_BASE_TIMER) * this.foeCdMult;
      if (e.boss) {
        const R = 170;
        this.burst(e.x, e.y, R, '#f85888', 0.55);
        this.burst(e.x, e.y, R * 0.5, '#ffffff', 0.3);
        this.shower(e.x, e.y, 22, '#f85888', 320, 'ember');
        this.screenFlash('#f85888', 0.18);
        this.addShake(12);
        sfx('boom');
        buzz([30, 40, 60]);
        for (const p of this.players) {
          if (!p.dead && dist(e, p) <= R + p.r && !this.losBlocked(e.x, e.y, p.x, p.y)) {
            this.damagePlayer(p, specDamage(e.def.stats.spa, p.def.stats.spd, 1, blastPower));
            if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
          }
        }
      } else if (e.def.melee) {
        // melee enemies lunge instead of zapping — the dash plays out over
        // the next moments while you're lining up your shot
        const target = this.players.filter((p) => !p.dead).sort((a, b) => dist(e, a) - dist(e, b))[0];
        if (target) {
          e.lunging = 1.4;
          this.burst(e.x, e.y, e.r * 1.6, '#ffffff', 0.25);
          this.shower(e.x, e.y, 6, TYPE_COLOR[e.def.type], 200, 'streak');
          sfx('launch');
        }
      } else {
        const target = this.players.filter((p) => !p.dead).sort((a, b) => dist(e, a) - dist(e, b))[0];
        if (target) {
          const rock = this.losBlocked(e.x, e.y, target.x, target.y);
          if (rock) {
            // shot absorbed by the obstacle — zap fizzles on the rock face
            const dir = norm({ x: target.x - e.x, y: target.y - e.y });
            this.bolt(e.x, e.y, rock.x - dir.x * rock.r * 0.5, rock.y - dir.y * rock.r * 0.5, '#8a94c8');
            this.burst(rock.x - dir.x * rock.r * 0.5, rock.y - dir.y * rock.r * 0.5, 18, '#8a94c8', 0.25);
            sfx('zap');
          } else {
            this.bolt(e.x, e.y, target.x, target.y, '#ffe66d');
            sfx('zap');
            this.damagePlayer(target, physDamage(e.def.stats.atk, target.def.stats.def, 1, zapPower));
            if (this.thorns > 0) this.hurt(e, this.thorns, '#c8a44d');
          }
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
    dmg = Math.max(1, Math.round(dmg * this.takenMult * 1.15 * (1 + this.depth * 0.12 + this.waveIndex * 0.08)));
    if (p.role === 'tank') dmg = Math.max(1, Math.round(dmg * 0.75));
    if (p.sash && dmg >= p.hp) {
      // focus sash: hang on at 1 HP
      p.sash = false;
      dmg = p.hp - 1;
      this.texts.push({ x: p.x, y: p.y - p.r - 20, text: 'FOCUS SASH!', t: 1.1, color: '#ffd84d', big: false });
      this.burst(p.x, p.y, p.r * 2, '#ffd84d', 0.3);
    }
    p.hp -= dmg;
    p.flashT = 0.15;
    this.texts.push({ x: p.x, y: p.y - p.r - 8, text: `-${dmg}`, t: 0.9, color: '#ff6b6b', big: false });
    this.shower(p.x, p.y, 5, '#ff6b6b', 160, 'ember');
    this.addShake(3);
    sfx('hurt');
    buzz(20);
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      this.burst(p.x, p.y, p.r * 2.4, '#ff6b6b', 0.4);
      this.addShake(6);
      sfx('ko');
      buzz(60);
    }
  }

  private nextTurn() {
    if (this.phase === 'won' || this.phase === 'lost') return;
    for (let i = 1; i <= this.players.length; i++) {
      const idx = (this.activeIdx + i) % this.players.length;
      if (!this.players[idx].dead) {
        this.activeIdx = idx;
        this.phase = 'aim';
        return;
      }
    }
    this.phase = 'lost';
  }

  // --- vfx helpers ---

  private burst(x: number, y: number, r: number, color: string, life: number) {
    this.bursts.push({ x, y, r, t: life, life, color });
  }

  private zap(x1: number, y1: number, x2: number, y2: number, color: string) {
    this.zaps.push({ x1, y1, x2, y2, t: 0.32, color });
  }

  // Forked lightning: midpoint displacement gives the main bolt, plus a
  // couple of short branches snapped off the middle — reads as a real strike.
  private bolt(x1: number, y1: number, x2: number, y2: number, color: string) {
    const pts: Vec[] = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
    for (let it = 0; it < 4; it++) {
      for (let i = pts.length - 1; i > 0; i--) {
        const a = pts[i - 1], b = pts[i];
        const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const off = (Math.random() - 0.5) * d * 0.3;
        pts.splice(i, 0, {
          x: (a.x + b.x) / 2 + (-(b.y - a.y) / d) * off,
          y: (a.y + b.y) / 2 + ((b.x - a.x) / d) * off,
        });
      }
    }
    const branches: Vec[][] = [];
    for (let k = 0; k < 2; k++) {
      const s = pts[Math.floor(pts.length * (0.3 + Math.random() * 0.4))];
      const a = Math.random() * Math.PI * 2;
      const L = 18 + Math.random() * 28;
      branches.push([
        s,
        { x: s.x + Math.cos(a) * L * 0.6, y: s.y + Math.sin(a) * L * 0.6 },
        { x: s.x + Math.cos(a + 0.7) * L, y: s.y + Math.sin(a + 0.7) * L },
      ]);
    }
    this.bolts.push({ pts, branches, t: 0.3, life: 0.3, color });
  }

  private slash(x: number, y: number, color: string) {
    this.slashes.push({ x, y, ang: Math.random() * Math.PI, t: 0.22, color });
  }

  private screenFlash(color: string, t: number) {
    this.flashes.push({ t, life: t, color });
  }

  private addShake(amt: number) {
    this.shake = Math.min(this.shake + amt, 18);
  }

  private shower(
    x: number,
    y: number,
    n: number,
    color: string,
    speed: number,
    shape: Particle['shape'],
  ) {
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      const life = 0.3 + Math.random() * 0.35;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - (shape === 'wisp' || shape === 'bubble' ? 60 : 0),
        t: life, life,
        size: 3 + Math.random() * 4,
        color, shape,
        grav: shape === 'ember' ? 220 : shape === 'leaf' ? 60 : 0,
      });
    }
  }

  // Debris/meteors rain down from the top of the arena onto a column.
  private skyFall(x: number, color: string) {
    for (let i = 0; i < 7 && this.particles.length < MAX_PARTICLES; i++) {
      const px = x + (Math.random() - 0.5) * 60;
      this.particles.push({
        x: px,
        y: this.arena.y + Math.random() * 24,
        vx: (x - px) * 2.2,
        vy: 420 + Math.random() * 180,
        t: 0.5,
        life: 0.5,
        size: 4 + Math.random() * 5,
        color,
        shape: 'meteor',
        grav: 0,
      });
    }
  }

  // Particles spawned on a ring around a point, flying inward — dies on arrival.
  private converge(x: number, y: number, n: number, color: string, shape: Particle['shape']) {
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 70 + Math.random() * 60;
      const speed = 230;
      this.particles.push({
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r,
        vx: -Math.cos(a) * speed,
        vy: -Math.sin(a) * speed,
        t: r / speed,
        life: r / speed,
        size: 3 + Math.random() * 4,
        color,
        shape,
        grav: 0,
      });
    }
  }

  private wallSpark(x: number, y: number, nx: number, ny: number) {
    for (let i = 0; i < 4 && this.particles.length < MAX_PARTICLES; i++) {
      const spread = (Math.random() - 0.5) * 1.4;
      const vx = (nx + spread * (ny !== 0 ? 1 : 0)) * 180;
      const vy = (ny + spread * (nx !== 0 ? 1 : 0)) * 180;
      this.particles.push({
        x, y, vx, vy, t: 0.25, life: 0.25, size: 3, color: '#5adfff', shape: 'streak', grav: 0,
      });
    }
  }

  // --- rendering ---

  render(ctx: CanvasRenderingContext2D) {
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

    for (const b of this.bursts) this.drawBurst(ctx, b);
    for (const w of this.waves) this.drawWave(ctx, w);
    for (const z of this.zaps) this.drawZap(ctx, z);
    for (const b of this.bolts) this.drawBolt(ctx, b);

    // obstacles — flat discs until the real prop pass lands
    for (const o of this.obstacles) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(o.x, o.y + o.r * 0.55, o.r * 0.95, o.r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = o.prop === 'tree' ? '#2e6b2e' : '#7a7568';
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // one-way ledges — dirt bank with the cliff face on the blocked side and
    // chevrons showing the direction you can hop, like the RSE jump ledges
    for (const L of this.ledges) {
      ctx.save();
      ctx.translate(L.x, L.y);
      ctx.rotate(L.ang); // local +x = allowed direction, strip runs along +y
      const hl = L.len / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(-6, -hl + 4, 18, L.len);
      // flat dirt bank until the real prop pass lands
      ctx.fillStyle = '#c9a877';
      ctx.fillRect(-9, -hl, 9, L.len);
      ctx.fillStyle = '#6b4a26';
      ctx.fillRect(0, -hl, 8, L.len);
      // chevrons point the legal hop direction
      ctx.strokeStyle = '#ffe9b0';
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.85;
      for (let y = -hl + 12; y < hl - 6; y += 26) {
        ctx.beginPath();
        ctx.moveTo(2, y - 5);
        ctx.lineTo(9, y);
        ctx.lineTo(2, y + 5);
        ctx.stroke();
      }
      ctx.restore();
    }

    // hazard pads: themed floor zones with a sprite marker on top
    for (const hz of this.hazards) {
      ctx.save();
      if (hz.kind === 'slow') {
        // tall grass — flat dark patch until the real tuft pass lands
        ctx.fillStyle = 'rgba(30,60,26,0.4)';
        ctx.beginPath();
        ctx.ellipse(hz.x, hz.y, hz.r, hz.r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        // something's rustling in there — darker blades shiver
        if (this.enemies.some((e) => this.hidden(e) && dist(e, hz) < hz.r)) {
          ctx.strokeStyle = '#1e4020';
          ctx.lineWidth = 3.5;
          for (let i = 0; i < 8; i++) {
            const a = this.time * 6 + i * 0.8;
            const gx = hz.x + Math.cos(i * 2.4) * hz.r * 0.4;
            const gy = hz.y + Math.sin(i * 1.9) * hz.r * 0.3;
            ctx.beginPath();
            ctx.moveTo(gx - 4, gy + 6);
            ctx.quadraticCurveTo(gx + Math.sin(a) * 4, gy - 10, gx + 4, gy + 4);
            ctx.stroke();
          }
        }
      } else if (hz.kind === 'ice') {
        // ice sheet — flat pale patch under a gloss pass
        const pulse = 0.85 + Math.sin(this.time * 3) * 0.08;
        ctx.fillStyle = 'rgba(160,216,239,0.28)';
        ctx.beginPath();
        ctx.ellipse(hz.x, hz.y, hz.r * pulse, hz.r * 0.78 * pulse, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c8f0ff';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.ellipse(hz.x, hz.y, hz.r * 0.92, hz.r * 0.74, 0, 0, Math.PI * 2);
        ctx.stroke();
        // glossy slide streaks
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 3;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(hz.x - hz.r * 0.6, hz.y + i * hz.r * 0.28 + hz.r * 0.2);
          ctx.lineTo(hz.x + hz.r * 0.55, hz.y + i * hz.r * 0.28 - hz.r * 0.18);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // sparkle
        ctx.fillStyle = '#fff';
        const tw = (this.time * 2.2) % 1;
        ctx.globalAlpha = Math.max(0, 0.8 - tw);
        ctx.beginPath();
        ctx.arc(hz.x + hz.r * 0.3, hz.y - hz.r * 0.3, 3 + tw * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (hz.kind === 'speed') {
        // charge pad — soft electric glow + pulsing rings + Magnemite
        const pulse = 0.75 + Math.sin(this.time * 5) * 0.15;
        ctx.fillStyle = 'rgba(248,208,48,0.14)';
        ctx.beginPath();
        ctx.ellipse(hz.x, hz.y, hz.r, hz.r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f8d030';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.ellipse(hz.x, hz.y, hz.r * pulse, hz.r * 0.8 * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.ellipse(hz.x, hz.y, hz.r * 0.55 * pulse, hz.r * 0.44 * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // a little lightning bolt marks the pad
        ctx.fillStyle = '#f8d030';
        ctx.beginPath();
        const bx = hz.x, by = hz.y - hz.r * 0.35;
        ctx.moveTo(bx + 4, by - 16);
        ctx.lineTo(bx - 8, by + 4);
        ctx.lineTo(bx, by + 4);
        ctx.lineTo(bx - 4, by + 18);
        ctx.lineTo(bx + 10, by - 2);
        ctx.lineTo(bx + 2, by - 2);
        ctx.closePath();
        ctx.fill();
      } else {
        // warp pad — soft psychic glow + swirl + exit arrow + Abra
        ctx.fillStyle = 'rgba(150,80,190,0.16)';
        ctx.beginPath();
        ctx.ellipse(hz.x, hz.y, hz.r, hz.r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b86fd8';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -this.time * 60;
        ctx.beginPath();
        ctx.ellipse(hz.x, hz.y, hz.r * 0.9, hz.r * 0.72, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // exit arrow showing where it flings you
        const ax = hz.x + Math.cos(hz.ang) * hz.r * 0.55;
        const ay = hz.y + Math.sin(hz.ang) * hz.r * 0.55;
        ctx.strokeStyle = '#e8c8ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(hz.x, hz.y);
        ctx.lineTo(ax, ay);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - Math.cos(hz.ang - 0.5) * 10, ay - Math.sin(hz.ang - 0.5) * 10);
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - Math.cos(hz.ang + 0.5) * 10, ay - Math.sin(hz.ang + 0.5) * 10);
        ctx.stroke();
      }
      ctx.restore();
    }

    for (const e of this.enemies) this.drawUnit(ctx, e);
    for (const p of this.players) this.drawUnit(ctx, p);

    // KO'd mons: sprite spins out, shrinks, floats up — GBA faint style
    for (const g of this.ghosts) {
      const prog = 1 - g.t / g.life;
      ctx.save();
      ctx.globalAlpha = Math.max(1 - prog, 0) * 0.9;
      if (g.absorb) {
        // caught: shrinks straight down into the spot the ball lands on
        ctx.translate(g.x, g.y + prog * 8);
        drawMon(ctx, g.id, 0, 0, g.r * 2.6 * Math.max(1 - prog, 0));
      } else {
        ctx.translate(g.x, g.y - prog * 30);
        ctx.rotate(prog * 2.8);
        const s = g.r * 2.6 * (1 - prog * 0.7);
        drawMon(ctx, g.id, 0, 0, s);
      }
      ctx.restore();
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

    for (const s of this.slashes) this.drawSlash(ctx, s);
    for (const l of this.loops) {
      // sweeping styler ring: draws fast, lingers, fades
      const prog = 1 - l.t / l.life;
      const sweep = Math.min(prog / 0.45, 1) * Math.PI * 2;
      ctx.save();
      ctx.globalAlpha = Math.min(l.t / 0.25, 1);
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r, -Math.PI / 2, -Math.PI / 2 + sweep);
      ctx.stroke();
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

    for (const p of this.particles) this.drawParticle(ctx, p);

    for (const t of this.texts) {
      const pop = 1 + Math.max(0, t.t - 0.72) * (t.big ? 3 : 1.6);
      ctx.globalAlpha = Math.min(t.t / 0.3, 1);
      ctx.font = `${Math.round(16 * pop)}px ${PIXEL_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      const dy = (0.9 - t.t) * 44;
      ctx.strokeText(t.text, t.x, t.y - dy);
      ctx.fillText(t.text, t.x, t.y - dy);
    }
    ctx.globalAlpha = 1;

    if (this.phase === 'aim' && !this.active.dead) {
      const u = this.active;
      ctx.strokeStyle = TYPE_COLOR[u.def.type];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(u.x, u.y, u.r + 6 + Math.sin(this.time * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.dragging) this.drawAim(ctx);

    ctx.restore();

    // screen flashes render unshaken, on top
    for (const f of this.flashes) {
      ctx.globalAlpha = Math.max(f.t / f.life, 0) * 0.3;
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, W_CANVAS_FALLBACK, 2000);
    }
    ctx.globalAlpha = 1;

    // onboarding hints for the first couple of shots
    if (this.phase === 'aim' && this.shots < 2 && !this.dragging) {
      ctx.globalAlpha = 0.55 + Math.sin(this.time * 4) * 0.3;
      ctx.font = `9px ${PIXEL_FONT}`;
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
      const label = gym
        ? `GYM LEADER ${gym.def.name.toUpperCase()}`
        : `STAGE ${this.waveIndex + 1} / ${TOTAL_STAGES}`;
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

  private drawUnit(ctx: CanvasRenderingContext2D, u: Unit) {
    if (u.dead) return;
    // concealed in tall grass — a rustling dark shape, no timer or HP until
    // you get close enough to flush it out
    if (this.hidden(u)) {
      const pop = 1;
      ctx.save();
      ctx.translate(u.x, u.y);
      ctx.globalAlpha = 0.3 * pop;
      drawMon(ctx, u.def.id, 0, 0, u.r * 2.6);
      ctx.restore();
      ctx.globalAlpha = 1;
      // flat grass blades thrown over it, swaying — the rustle is the tell
      const wig = Math.sin(this.time * 9 + u.x) * 2;
      ctx.strokeStyle = '#2c5a28';
      ctx.lineWidth = 3;
      for (let i = -2; i <= 2; i++) {
        const bx = u.x + i * u.r * 0.45;
        ctx.beginPath();
        ctx.moveTo(bx - 4, u.y + u.r * 0.7);
        ctx.quadraticCurveTo(bx + wig, u.y - u.r * 0.9, bx + 4 + wig, u.y + u.r * 0.5);
        ctx.stroke();
      }
      if (Math.random() < 0.02 && this.particles.length < MAX_PARTICLES)
        this.particles.push({ x: u.x + (Math.random() - 0.5) * u.r, y: u.y - u.r, vx: (Math.random() - 0.5) * 60, vy: -60, t: 0.5, life: 0.5, size: 4, color: '#58a848', shape: 'leaf', grav: 200 });
      return;
    }
    const size = u.r * 2.6;
    // wave entry: staggered delay, then a quick overshoot zoom — the
    // Essentials appear-anim feel
    const pop = u.spawnT <= 0 ? 1 : 1 - Math.min(u.spawnT, 0.3) / 0.3;
    const sc = 0.2 + 0.8 * (1 + 2.7 * Math.pow(pop - 1, 3) + 1.7 * Math.pow(pop - 1, 2));

    // team base ring — gold allies, red enemies, gold elites, readable at a glance
    const elite = u.side === 'enemy' && !u.boss && ELITES.includes(u.def);
    ctx.globalAlpha = pop;
    ctx.fillStyle = u.side === 'player' ? 'rgba(248,208,48,0.30)' : elite ? 'rgba(255,216,77,0.22)' : 'rgba(255,80,80,0.22)';
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + u.r * 0.62, u.r * 1.05, u.r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = u.side === 'player' ? '#f8d030' : elite ? '#ffd84d' : '#ff5050';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + u.r * 0.62, u.r * 1.05, u.r * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // glow under units about to act
    if (u.side === 'enemy' && u.timer <= 1) {
      ctx.fillStyle = '#ff6b6b22';
      ctx.beginPath();
      ctx.arc(u.x, u.y, u.r + 10 + Math.sin(this.time * 10) * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // squash while the slingshot is charged — classic anticipation
    const sq = u === this.active && this.dragging && this.phase === 'aim' ? this.charge() : 0;
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.globalAlpha = pop;
    ctx.scale(sc * (1 + sq * 0.12), sc * (1 - sq * 0.16));
    drawMon(ctx, u.def.id, 0, 0, size);
    ctx.restore();

    // hit flash
    if (u.flashT > 0) {
      ctx.globalAlpha = Math.min(u.flashT / 0.12, 1) * 0.75;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(u.x, u.y, u.r * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // hp bar
    const bw = u.r * 2;
    const pct = Math.max(u.hp / u.maxHp, 0);
    ctx.fillStyle = '#000a';
    ctx.fillRect(u.x - bw / 2, u.y + u.r + 4, bw, 5);
    ctx.fillStyle = pct > 0.5 ? '#6fdc6f' : pct > 0.25 ? '#ffd84d' : '#ff6b6b';
    ctx.fillRect(u.x - bw / 2, u.y + u.r + 4, bw * pct, 5);

    if (u.side === 'enemy') {
      // capture progress: Ranger-style ring that fills as hp drops
      ctx.strokeStyle = '#9df0ff';
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(u.x, u.y, u.r + 7, -Math.PI / 2, -Math.PI / 2 + (1 - pct) * Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // poisoned indicator
      if (u.dotTicks > 0) {
        ctx.fillStyle = '#a040a0';
        ctx.beginPath();
        ctx.arc(u.x - u.r + 4, u.y - u.r + 2, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      // attack countdown
      ctx.fillStyle = '#000a';
      ctx.beginPath();
      ctx.arc(u.x + u.r - 2, u.y - u.r + 2, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `9px ${PIXEL_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = u.timer <= 1 ? '#ff6b6b' : '#fff';
      ctx.fillText(`${u.timer}`, u.x + u.r - 2, u.y - u.r + 7);
      // typing stays unknown until the mon is flushed out — a '?' chip that
      // flips to its type the first time it takes a hit or attacks
      const tx = u.x - u.r - 4;
      const ty = u.y - u.r + 2;
      ctx.fillStyle = u.revealed ? TYPE_COLOR[u.def.type] : '#101430';
      ctx.strokeStyle = u.revealed ? '#0a0e20' : '#5a6284';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tx, ty, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = `7px ${PIXEL_FONT}`;
      ctx.fillStyle = u.revealed ? '#fff' : '#8890b8';
      ctx.fillText(u.revealed ? u.def.type.slice(0, 2).toUpperCase() : '?', tx, ty + 3);
    } else {
      // charge pips: one dot per shot of charge around the mon — dark dots
      // are charge still owed, type-colored dots are earned, all-gold = READY
      const rr = u.r + 9;
      const dots = Math.max(1, u.cdMax);
      const filled = u.cd <= 0 ? dots : dots - u.cd;
      for (let i = 0; i < dots; i++) {
        const a = -Math.PI / 2 + (i / dots) * Math.PI * 2;
        ctx.fillStyle = i < filled ? (u.cd <= 0 ? '#ffd84d' : TYPE_COLOR[u.def.type]) : 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.arc(u.x + Math.cos(a) * rr, u.y + Math.sin(a) * rr, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (u.cd <= 0 && !u.dead) {
        // ready: pulsing aura, orbiting sparks, and the move's name overhead
        // — this is the thing you want to hit
        const pulse = 0.55 + Math.sin(this.time * 6) * 0.3;
        ctx.strokeStyle = '#ffd84d';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.r + 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        for (let i = 0; i < 3; i++) {
          const a = this.time * 3 + (i * Math.PI * 2) / 3;
          ctx.fillStyle = '#ffd84d';
          ctx.beginPath();
          ctx.arc(u.x + Math.cos(a) * rr, u.y + Math.sin(a) * rr, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        const label = MOVE_NAME[u.def.type];
        const ly = u.y + u.r + 30;
        ctx.font = `7px ${PIXEL_FONT}`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.globalAlpha = Math.min(1, pulse + 0.25);
        ctx.strokeText(label, u.x, ly);
        ctx.fillStyle = TYPE_COLOR[u.def.type];
        ctx.fillText(label, u.x, ly);
        ctx.globalAlpha = 1;
      }
      // whose turn it is — bouncing marker + name tag + bright white ring,
      // up only while you're lining up the shot
      if (u === this.active && this.phase === 'aim') {
        const bob = Math.sin(this.time * 5) * 3;
        const ty = u.y - u.r - 14 - bob;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.5 + Math.sin(this.time * 6) * 0.3;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.r + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(u.x - 7, ty - 8);
        ctx.lineTo(u.x + 7, ty - 8);
        ctx.lineTo(u.x, ty);
        ctx.closePath();
        ctx.fill();
        ctx.font = `8px ${PIXEL_FONT}`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(u.def.name.toUpperCase(), u.x, ty - 14);
        ctx.fillStyle = '#ffd84d';
        ctx.fillText(u.def.name.toUpperCase(), u.x, ty - 14);
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

    // predicted path: one bounce worth — banking off walls + rocks,
    // stopping at the first contact. Any further is noise. Cached on a
    // quantized signature; the ping-pong frac churns it while held, but it
    // still skips recomputing on frames where nothing moved.
    const sig = [
      Math.round(this.dragNow.x / 6),
      Math.round(this.dragNow.y / 6),
      Math.round(frac * 25),
      this.enemies.map((e) => `${Math.round(e.x / 10)},${Math.round(e.y / 10)},${e.dead ? 0 : 1}`).join(';'),
      this.obstacles.length,
    ].join('|');
    if (sig !== this.aimCache.sig) {
      this.aimCache.sig = sig;
      const speed =
        BASE_SHOT_SPEED * POWER * launchMult(u.def.stats) * this.launchBoost * u.launch * (0.4 + 0.6 * frac);
      let sx = u.x, sy = u.y, svx = dir.x * speed, svy = dir.y * speed;
      const dots: Vec[] = [];
      let hit: Unit | null = null;
      let bounced = false;
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
        for (const o of this.obstacles) {
          const d = Math.hypot(sx - o.x, sy - o.y);
          const rr = u.r + o.r;
          if (d >= rr || d === 0) continue;
          const nx = (o.x - sx) / d, ny = (o.y - sy) / d;
          sx = o.x - nx * rr;
          sy = o.y - ny * rr;
          const vn = svx * nx + svy * ny;
          if (vn > 0) {
            svx -= (1 + UNIT_REST) * vn * nx;
            svy -= (1 + UNIT_REST) * vn * ny;
          }
          bounced = true;
        }
        // ledges + pool play by the same rules in the preview — a wall is a wall
        for (const L of this.ledges) {
          const nx = Math.cos(L.ang), ny = Math.sin(L.ang);
          const s = (sx - L.x) * nx + (sy - L.y) * ny;
          const t = -(sx - L.x) * ny + (sy - L.y) * nx;
          if (s > 0 && s < u.r + 5 && Math.abs(t) < L.len / 2 + u.r * 0.3 && svx * nx + svy * ny < 0) {
            sx += nx * (u.r + 5 - s);
            sy += ny * (u.r + 5 - s);
            const vn = svx * nx + svy * ny;
            svx -= (1 + WALL_REST) * vn * nx;
            svy -= (1 + WALL_REST) * vn * ny;
            bounced = true;
          }
        }
        if (this.pool && !this.canCrossPool(u)) {
          const w = this.pool;
          const qx = (sx - w.x) / (w.rx + u.r * 0.55), qy = (sy - w.y) / (w.ry + u.r * 0.55);
          if (qx * qx + qy * qy < 1) { bounced = true; break sim; }
        }
        for (const e of this.enemies)
          if (!e.dead && Math.hypot(sx - e.x, sy - e.y) < u.r + e.r) {
            if (!this.hidden(e)) hit = e; // concealed mons don't give a lock-on
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
      if (hit) {
        // target marker: gold ring pulses on the enemy hit first
        ctx.strokeStyle = '#ffd84d';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(hit.x, hit.y, hit.r + 8 + Math.sin(this.time * 8) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // styler rings: two counter-rotating dashed circles while aiming
    for (const [rr, sp, dash] of [[u.r + 18, 2.2, 14], [u.r + 26, -1.6, 22]] as const) {
      ctx.save();
      ctx.strokeStyle = '#9df0ff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.65;
      ctx.setLineDash([dash, dash * 0.7]);
      ctx.lineDashOffset = this.time * 60 * sp;
      ctx.beginPath();
      ctx.arc(u.x, u.y, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // charge meter arc around the unit — full sweep = max power
    ctx.strokeStyle = '#ffffff22';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(u.x, u.y, u.r + 10, -Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = frac > 0.93 ? '#ffd84d' : color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(u.x, u.y, u.r + 10, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();

    // timing bar under the HUD — the ring is subtle; this is what you
    // actually read to release on max
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

  private drawZap(ctx: CanvasRenderingContext2D, z: Zap) {
    const alpha = Math.max(z.t / 0.32, 0);
    const d = Math.hypot(z.x2 - z.x1, z.y2 - z.y1);
    const segs = Math.max(3, Math.round(d / 60));
    ctx.globalAlpha = alpha;
    // colored outer bolt + white core
    for (const [w, col] of [[5, z.color], [2, '#ffffff']] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(z.x1, z.y1);
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const jitter = (Math.sin(t * 91 + z.x1) * 18) | 0;
        const px = z.x1 + (z.x2 - z.x1) * t - ((z.y2 - z.y1) / d) * jitter;
        const py = z.y1 + (z.y2 - z.y1) * t + ((z.x2 - z.x1) / d) * jitter;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(z.x2, z.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawBolt(ctx: CanvasRenderingContext2D, b: Bolt) {
    const alpha = Math.max(b.t / b.life, 0);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 12;
    const stroke = (pts: Vec[], w: number, col: string) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    };
    stroke(b.pts, 4.5, b.color);
    for (const br of b.branches) stroke(br, 2, b.color);
    ctx.shadowBlur = 0;
    stroke(b.pts, 1.8, '#ffffff');
    ctx.restore();
  }

  private drawBurst(ctx: CanvasRenderingContext2D, b: Burst) {
    const progress = 1 - b.t / b.life;
    const alpha = Math.max(1 - progress, 0);
    // filled glow disc + two expanding rings
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * progress, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * progress, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * 0.6;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * progress * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
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

  private drawSlash(ctx: CanvasRenderingContext2D, s: Slash) {
    const progress = 1 - s.t / 0.22;
    const alpha = Math.max(1 - progress, 0);
    const L = 30 + progress * 40;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    for (const off of [0, Math.PI / 2]) {
      const a = s.ang + off;
      const dx = Math.cos(a) * L;
      const dy = Math.sin(a) * L;
      ctx.beginPath();
      ctx.moveTo(s.x - dx, s.y - dy);
      ctx.lineTo(s.x + dx, s.y + dy);
      ctx.stroke();
    }
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    const a = s.ang;
    const dx = Math.cos(a) * L * 1.2;
    const dy = Math.sin(a) * L * 1.2;
    ctx.beginPath();
    ctx.moveTo(s.x - dx, s.y - dy);
    ctx.lineTo(s.x + dx, s.y + dy);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
    const alpha = Math.max(p.t / p.life, 0);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    switch (p.shape) {
      case 'ember':
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.shadowBlur = 0;
        break;
      case 'leaf':
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.size);
        ctx.lineTo(p.x + p.size, p.y);
        ctx.lineTo(p.x, p.y + p.size);
        ctx.lineTo(p.x - p.size, p.y);
        ctx.fill();
        break;
      case 'bubble':
      case 'wisp':
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'meteor':
        // glowing head + hot tail streaking toward the target
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.55;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.14, p.y - p.vy * 0.14);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      case 'streak':
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
        ctx.stroke();
        break;
      default:
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
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


