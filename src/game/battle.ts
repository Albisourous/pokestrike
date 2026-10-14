import { Vec, len, dist, norm, vec } from '../core/vec';
import { drawMon, itemSprite } from '../core/assets';
import { sfx, buzz, cry } from '../core/audio';
import type { Sfx } from '../core/audio';
import { SpeciesDef, StageDef, rollWave } from './data';
import { Perk, rollPerks } from './perks';
import { drawBackdrop, drawWall, THEMES, hash as hashSeed } from './bg';
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
  caught: boolean; // already boxed (master ball) — skip the catch roll
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
  color: string;
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
  kind: 'slow' | 'speed' | 'turn';
  ang: number; // turn pads fling you along this angle
  armed: boolean;
}

export type Phase = 'aim' | 'shot' | 'enemy' | 'reward' | 'won' | 'lost';

const STOP_SPEED = 45;
const SHOT_MAX_DRAG = 190;
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
  private dragT = 0; // hold time while dragging — drives the power meter
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
  private slashes: Slash[] = [];
  private loops: Loop[] = []; // styler capture rings
  private flashes: ScreenFlash[] = [];
  private bolts: Bolt[] = []; // forked lightning
  private ghosts: Ghost[] = []; // KO'd sprites spinning out
  private balls: BallDrop[] = []; // caught mons: ball drops in and wiggles
  private scorch: { x: number; y: number; r: number; a: number }[] = []; // battle scars on the field
  private shake = 0;
  private hitStop = 0; // brief slow-mo on combo hits
  // relic mods + endless depth
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
  box: SpeciesDef[] = []; // captured mons — swap one in between waves
  swapped = false; // one swap per reward break
  boxSel = -1; // box index picked for swapping
  depth = 0; // endless acts survived past the boss wave
  rewardOffers: Perk[] = [];
  private rewardPending = false;
  private hpScale = 1;
  private obstacles: { x: number; y: number; r: number }[];
  private theme: Theme; // current wave's scene — rotates each wave
  private hazards: Hazard[] = [];

  constructor(
    public arena: Rect,
    team: SpeciesDef[],
    public stage: StageDef,
    private rng: () => number = Math.random,
    private endless = false,
  ) {
    this.theme = stage.theme;
    this.obstacles = [];
    this.genObstacles();
    const n = team.length;
    team.forEach((def, i) => {
      const role = roleOf(def.stats, def.healer);
      const m = ROLE_MODS[role];
      const hp = Math.round(playerHp(def.stats) * m.hp);
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
        cd: 0,
        cdMax: 1,
        lastBump: -1,
        role,
        caught: false,
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
        };
        if (this.players.every((p) => p.dead || dist(o, p) > o.r + p.r + 30)) {
          this.obstacles.push(o);
          break;
        }
      }
    }
  }

  // Themed field hazards, upper field, per wave.
  private genHazards() {
    const KINDS: Hazard['kind'][] = ['slow', 'speed', 'turn'];
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
          this.players.every((p) => p.dead || dist(hz, p) > hz.r + p.r + 20) &&
          this.obstacles.every((o) => dist(hz, o) > hz.r + o.r)
        ) {
          this.hazards.push(hz);
          break;
        }
      }
    }
  }

  private spawnWave(i: number) {
    this.waveIndex = i;
    // each wave is a new scene — rotate theme, re-roll obstacles + hazards
    const others = THEMES.filter((t) => t !== this.theme);
    this.theme = others[Math.floor(this.rng() * others.length)];
    this.genObstacles();
    this.genHazards();
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
      caught: false,
      sash: false,
      pow: 1,
      rngMul: 1,
      launch: 1,
      cdMod: 0,
      lastHit: new Map(),
    }));
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
    // direction from the pull; power from release timing on the charge meter
    const charge = this.charge();
    const speed = SHOT_MAX_DRAG * POWER * launchMult(u.def.stats) * this.launchBoost * u.launch * (0.4 + 0.6 * charge);
    u.vx = dir.x * speed;
    u.vy = dir.y * speed;
    u.lastHit.clear();
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

  // Power meter: ping-pongs 0→1→0 while held (1.1s per direction).
  // Release near the top for a full-power launch.
  private charge() {
    const P = 1.1;
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
          this.bruise(u.x, u.y, len({ x: u.vx, y: u.vy }));
        }
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
      o.x += dir.x * 620 * dt;
      o.y += dir.y * 620 * dt;
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
        this.burst(o.x, o.y, 40, '#6890f0', 0.3);
        this.shower(o.x, o.y, 8, '#9df0ff', 160, 'bubble');
        o.t = 0;
      }
    }
    this.orbs = this.orbs.filter((o) => o.t > 0);
  }

  // Pokémon Arena touch: hard impacts bruise the field — a dark scorch
  // patch that stays for the whole battle.
  private bruise(x: number, y: number, speed: number) {
    if (speed < 320) return;
    this.scorch.push({ x, y, r: 14 + Math.min(speed / 60, 22), a: Math.min(speed / 900, 0.4) });
    if (this.scorch.length > 36) this.scorch.shift();
  }

  private hitWalls(u: Unit) {
    const a = this.arena;
    const speed = len({ x: u.vx, y: u.vy });
    if (u.x - u.r < a.x) {
      u.x = a.x + u.r;
      u.vx = -u.vx * WALL_REST;
      this.wallSpark(u.x - u.r, u.y, 1, 0);
      this.bruise(u.x - u.r, u.y, speed);
    } else if (u.x + u.r > a.x + a.w) {
      u.x = a.x + a.w - u.r;
      u.vx = -u.vx * WALL_REST;
      this.wallSpark(u.x + u.r, u.y, -1, 0);
      this.bruise(u.x + u.r, u.y, speed);
    }
    if (u.y - u.r < a.y) {
      u.y = a.y + u.r;
      u.vy = -u.vy * WALL_REST;
      this.wallSpark(u.x, u.y - u.r, 0, 1);
      this.bruise(u.x, u.y - u.r, speed);
    } else if (u.y + u.r > a.y + a.h) {
      u.y = a.y + a.h - u.r;
      u.vy = -u.vy * WALL_REST;
      this.wallSpark(u.x, u.y + u.r, 0, -1);
      this.bruise(u.x, u.y + u.r, speed);
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

  // Central damage path so every source (contact, bump, orb, dot) behaves alike.
  private hurt(e: Unit, dmg: number, color: string, suffix = '') {
    if (e.dead) return;
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
      this.bruise(e.x, e.y, 700); // a mon went down here — the field remembers
      // multi-KO callouts — chaining kills in one shot should feel huge
      this.kosThisShot++;
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
      // faint anim: the sprite spins out and fades while the rings land
      this.ghosts.push({ id: e.def.id, x: e.x, y: e.y, r: e.r, t: e.boss ? 0.8 : 0.45, life: e.boss ? 0.8 : 0.45 });
      sfx('ko');
      buzz(e.boss ? [50, 60, 90] : 30);
      // capture complete: stacked loops + release sparkle
      this.loops.push({ x: e.x, y: e.y, r: e.r + 20, t: 0.7, life: 0.7, color: '#ffffff' });
      this.loops.push({ x: e.x, y: e.y, r: e.r + 30, t: 0.9, life: 0.9, color: '#9df0ff' });
      // small chance it actually joins your team (balls raise this);
      // an armed master ball never fails — first KO catches, guaranteed
      const master = !e.caught && this.masterArmed;
      const caught = master || (!e.caught && this.rng() < this.captureChance + (e.boss ? this.bossCatch : 0));
      if (master) this.masterArmed = false;
      this.texts.push({
        x: e.x, y: e.y - e.r - 22,
        text: `${e.def.name.toUpperCase()} ${caught ? 'CAUGHT!' : 'FAINTED!'}`,
        t: caught ? 1.5 : 1.1,
        color: caught ? '#ffd84d' : '#9df0ff',
        big: true,
      });
      if (caught) {
        this.box.push(e.def);
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
    this.hitStop = Math.max(this.hitStop, 0.09);
    this.converge(p.x, p.y, 7, '#ffffff', 'streak');
    sfx(SUPER_SFX[p.def.type]);
    cry(p.def.id, 0.35);
    buzz(20);
    const color = TYPE_COLOR[p.def.type];

    switch (p.def.type) {
      case 'fire': // meteor storm: fireballs rain down on every nearby enemy
        this.burst(p.x, p.y, 150, color, 0.4);
        this.burst(p.x, p.y, 100, '#ffffff', 0.25);
        this.screenFlash('#f08030', 0.15);
        this.addShake(8);
        for (const e of near(150)) {
          this.skyFall(e.x, color);
          this.burst(e.x, e.y, 46, '#ffffff', 0.25);
          this.hurt(e, bumpDmg(e, 1.0), '#9df0ff');
        }
        break;
      case 'electric': {
        // lightning storm: sky strike on each chained enemy + arc between them
        let from: Unit = p;
        const hit = new Set<number>();
        let mult = 1;
        for (let i = 0; i < 3; i++) {
          const next = this.enemies
            .filter(
              (e) => !e.dead && !hit.has(e.uid) && dist(from, e) <= 190 * p.rngMul &&
                !this.losBlocked(from.x, from.y, e.x, e.y),
            )
            .sort((a, b) => dist(from, a) - dist(from, b))[0];
          if (!next) break;
          hit.add(next.uid);
          this.bolt(next.x, this.arena.y, next.x, next.y, color);
          if (from !== p || i === 0) this.bolt(from.x, from.y, next.x, next.y, color);
          this.shower(next.x, next.y, 8, color, 200, 'dot');
          this.burst(next.x, next.y, 36, '#fffbe0', 0.2);
          this.hurt(next, bumpDmg(next, mult), '#9df0ff');
          mult *= 0.7;
          from = next;
        }
        if (hit.size > 0) {
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
          const dmg = bumpDmg(e, 0.8);
          dealt += dmg;
          this.zap(e.x, e.y, p.x, p.y, '#78c850');
          this.hurt(e, dmg, '#9df0ff');
        }
        const heal = Math.max(Math.round(dealt * 0.25), 4);
        for (const pl of this.players) {
          if (pl.dead) continue;
          pl.hp = Math.min(pl.hp + heal, pl.maxHp);
          pl.flashT = 0.15;
          this.texts.push({ x: pl.x, y: pl.y - pl.r - 8, text: `+${heal}`, t: 0.9, color: '#6fdc6f', big: false });
        }
        break;
      }
      case 'water':
        // homing water orbs at the 3 nearest enemies
        this.burst(p.x, p.y, 80, color, 0.3);
        near(Infinity)
          .sort((a, b) => dist(p, a) - dist(p, b))
          .slice(0, 3)
          .forEach((e) => {
            this.orbs.push({
              x: p.x,
              y: p.y,
              target: e,
              dmg: bumpDmg(e, 0.7),
              t: 2.5,
              color,
            });
          });
        break;
      case 'psychic': // telekinetic shove
      case 'flying': {
        const radius = p.def.type === 'psychic' ? 160 : 200;
        const knock = p.def.type === 'psychic' ? 340 : 280;
        const pow = p.def.type === 'psychic' ? 0.8 : 0.5;
        this.burst(p.x, p.y, radius, color, 0.45);
        this.burst(p.x, p.y, radius * 0.6, '#ffffff', 0.3);
        this.shower(p.x, p.y, 14, color, 340, 'streak');
        this.addShake(6);
        for (const e of near(radius)) {
          const dir = norm({ x: e.x - p.x, y: e.y - p.y });
          e.vx += dir.x * knock;
          e.vy += dir.y * knock;
          this.hurt(e, bumpDmg(e, pow), '#9df0ff');
        }
        break;
      }
      case 'poison':
        // toxin: gas cloud now, plus 2 ticks at the end of your shots
        this.burst(p.x, p.y, 140, color, 0.4);
        this.shower(p.x, p.y, 22, '#c060c0', 110, 'bubble');
        this.screenFlash('#a040a0', 0.12);
        for (const e of near(140)) {
          e.dotTicks = 2;
          e.dotDmg = specDamage(p.def.stats.spa, e.def.stats.spd, eff(e), 0.5);
          this.hurt(e, bumpDmg(e, 0.7), '#9df0ff');
        }
        break;
      case 'rock':
      case 'fighting': {
        // meteor fist: debris falls on the nearest enemy, double slash
        const e = nearest(p, 200);
        if (e) {
          this.skyFall(e.x, '#b8a038');
          this.burst(e.x, e.y, e.r * 2.6, color, 0.35);
          this.slash(e.x, e.y, '#ffffff');
          this.slash(e.x, e.y, color);
          this.shower(e.x, e.y, 14, '#b8a038', 280, 'ember');
          this.screenFlash('#b8a038', 0.1);
          this.addShake(10);
          this.hurt(e, bumpDmg(e, 1.8), '#9df0ff');
        }
        break;
      }
      case 'ghost': {
        // hex: wisps converge on every enemy from the dark
        this.burst(p.x, p.y, 230, color, 0.5);
        this.screenFlash('#705898', 0.18);
        for (const e of near(Infinity)) {
          this.converge(e.x, e.y, 8, '#705898', 'wisp');
          this.hurt(e, bumpDmg(e, 0.7), '#9df0ff');
        }
        break;
      }
      default: {
        // normal: dash slash on the nearest enemy
        const e = nearest(p, 180);
        if (e) {
          this.zap(p.x, p.y, e.x, e.y, color);
          this.slash(e.x, e.y, '#ffffff');
          this.slash(e.x, e.y, color);
          this.shower(e.x, e.y, 8, '#ffffff', 240, 'streak');
          this.hurt(e, bumpDmg(e, 1.05), '#9df0ff');
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
    if (this.waveIndex + 1 >= this.waveCount && !this.endless) {
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

  // Swap a boxed mon onto the team — once per reward break.
  swapFromBox(bi: number, ti: number) {
    if (this.swapped || this.phase !== 'reward') return;
    const def = this.box[bi];
    const p = this.players[ti];
    if (!def || !p) return;
    this.box.splice(bi, 1);
    this.box.push(p.def); // benched ally goes back to the box
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
    p.hp = hp;
    p.dead = false;
    p.cd = 0;
    p.cdMax = Math.max(1, Math.round(bumpCooldown(def.type) * this.cdMult) - p.cdMod);
    this.swapped = true;
    this.boxSel = -1;
    this.burst(p.x, p.y, p.r * 2.4, '#ffd84d', 0.35);
    this.screenFlash('#ffd84d', 0.12);
    sfx('caught');
  }

  private enterReward() {
    this.swapped = false;
    this.boxSel = -1;
    this.rewardOffers = rollPerks(this.rng);
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
    this.rewardOffers = [];
    const next = this.waveIndex + 1;
    if (next >= this.waveCount) {
      // endless: descend a depth — bigger packs, scaled HP
      this.depth++;
      this.hpScale = 1 + this.depth * 0.25;
      this.stage.waves.push(rollWave(this.rng, this.depth));
    }
    this.spawnWave(next);
    this.nextTurn();
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

  private endShot() {
    const u = this.active;
    u.vx = 0;
    u.vy = 0;
    // supers recharge per shot taken; leftovers ticks a small heal
    for (const p of this.players) {
      if (p.cd > 0) p.cd--;
      if (!p.dead && this.regen > 0 && p.hp < p.maxHp) {
        p.hp = Math.min(p.hp + Math.ceil(p.maxHp * this.regen), p.maxHp);
      }
    }
    const waveAt = this.waveIndex;
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
    if (this.waveIndex !== waveAt) {
      this.nextTurn();
      return;
    }

    this.pendingAttacks = [];
    for (const e of this.enemies) {
      e.timer--;
      if (e.timer <= 0) this.pendingAttacks.push(e);
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
    dmg = Math.max(1, Math.round(dmg * this.takenMult));
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

    // arena: overworld-style backdrop + themed sprite wall
    drawBackdrop(ctx, a, 18, this.theme, this.time);
    drawWall(ctx, a, this.theme, this.time);

    for (const b of this.bursts) this.drawBurst(ctx, b);
    for (const z of this.zaps) this.drawZap(ctx, z);
    for (const b of this.bolts) this.drawBolt(ctx, b);

    // battle scars: cracked impact craters under everything — Arena-style
    // field damage that persists the whole battle
    for (const s of this.scorch) {
      ctx.fillStyle = `rgba(20,16,8,${s.a})`;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r, s.r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      // radiating cracks — the "dig left a hole" look
      ctx.strokeStyle = `rgba(20,16,8,${s.a * 0.8})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + s.x * 0.13;
        ctx.beginPath();
        ctx.moveTo(s.x + Math.cos(a) * s.r * 0.7, s.y + Math.sin(a) * s.r * 0.45);
        ctx.lineTo(s.x + Math.cos(a) * s.r * 1.4, s.y + Math.sin(a) * s.r * 0.9);
        ctx.stroke();
      }
    }

    // obstacles are real overworld props — a ball tree in the grove, the
    // smashable boulder elsewhere (extracted RSE metatiles)
    const prop = itemSprite(PROP[this.theme]);
    for (const o of this.obstacles) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(o.x, o.y + o.r * 0.55, o.r * 0.95, o.r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      if (prop) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const s = o.r * 2.1;
        ctx.drawImage(prop, o.x - s / 2, o.y - s / 2, s, s);
        ctx.restore();
      }
    }

    // hazard pads: themed floor zones with a sprite marker on top
    for (const hz of this.hazards) {
      ctx.save();
      if (hz.kind === 'slow') {
        // tall grass — a soft dark tint + dense jagged blades, no flat oval
        ctx.fillStyle = 'rgba(30,60,26,0.4)';
        ctx.beginPath();
        ctx.ellipse(hz.x, hz.y, hz.r, hz.r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        // blade ring around the rim
        ctx.strokeStyle = '#2c5a28';
        ctx.lineWidth = 3;
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * Math.PI * 2;
          const bx = hz.x + Math.cos(a) * hz.r * 0.94;
          const by = hz.y + Math.sin(a) * hz.r * 0.75;
          ctx.beginPath();
          ctx.moveTo(bx - 4, by);
          ctx.quadraticCurveTo(bx, by - 13, bx + 4, by);
          ctx.stroke();
        }
        // inner blades, lighter — dense enough to read as a patch
        ctx.strokeStyle = '#58a848';
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 30; i++) {
          const a = hashSeed(hz.x + i * 13) * Math.PI * 2;
          const rr = hz.r * (0.3 + hashSeed(hz.y + i * 7) * 0.6);
          const gx = hz.x + Math.cos(a) * rr, gy = hz.y + Math.sin(a) * rr * 0.8;
          ctx.beginPath();
          ctx.moveTo(gx - 3, gy);
          ctx.quadraticCurveTo(gx, gy - 9, gx + 3, gy);
          ctx.stroke();
        }
        // tiny flowers poking through
        ctx.fillStyle = '#ffd84d';
        for (let i = 0; i < 3; i++) {
          const a = hashSeed(hz.x + i * 31) * Math.PI * 2;
          const rr = hz.r * (0.4 + hashSeed(hz.y + i * 17) * 0.4);
          ctx.beginPath();
          ctx.arc(hz.x + Math.cos(a) * rr, hz.y + Math.sin(a) * rr * 0.72, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
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
      ctx.translate(g.x, g.y - prog * 30);
      ctx.rotate(prog * 2.8);
      const s = g.r * 2.6 * (1 - prog * 0.7);
      drawMon(ctx, g.id, 0, 0, s);
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
      ctx.font = `bold ${Math.round(20 * pop)}px system-ui`;
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
      ctx.font = 'bold 15px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8ecff';
      ctx.fillText(
        this.shots === 0
          ? 'pull back anywhere — release on a full ring'
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
      const label =
        this.waveIndex + 1 === this.waveCount
          ? 'BOSS BATTLE'
          : `WAVE ${this.waveIndex + 1} / ${this.waveCount}`;
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
    const size = u.r * 2.6;
    // wave entry: staggered delay, then a quick overshoot zoom — the
    // Essentials appear-anim feel
    const pop = u.spawnT <= 0 ? 1 : 1 - Math.min(u.spawnT, 0.3) / 0.3;
    const sc = 0.2 + 0.8 * (1 + 2.7 * Math.pow(pop - 1, 3) + 1.7 * Math.pow(pop - 1, 2));

    // team base ring — gold allies, red enemies, readable at a glance
    ctx.globalAlpha = pop;
    ctx.fillStyle = u.side === 'player' ? 'rgba(248,208,48,0.30)' : 'rgba(255,80,80,0.22)';
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + u.r * 0.62, u.r * 1.05, u.r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = u.side === 'player' ? '#f8d030' : '#ff5050';
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
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = u.timer <= 1 ? '#ff6b6b' : '#fff';
      ctx.fillText(`${u.timer}`, u.x + u.r - 2, u.y - u.r + 7);
    } else {
      // charge pips under the hp bar: cyan fills one per turn banked toward
      // the super; a pulsing gold ring means READY — pass it to fire
      const max = Math.max(1, u.cdMax);
      const filled = u.cd <= 0 ? max : max - Math.ceil(u.cd);
      const px0 = u.x - ((max - 1) * 7) / 2;
      const py = u.y + u.r + 15;
      for (let i = 0; i < max; i++) {
        ctx.beginPath();
        ctx.arc(px0 + i * 7, py, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = i < filled ? (u.cd <= 0 ? '#ffd84d' : '#5adfff') : '#0008';
        ctx.fill();
      }
      if (u.cd <= 0) {
        ctx.strokeStyle = '#ffd84d';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.55 + Math.sin(this.time * 6) * 0.3;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.r + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
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
    // quantized signature so the sim only reruns when the aim actually moves.
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
        SHOT_MAX_DRAG * POWER * launchMult(u.def.stats) * this.launchBoost * u.launch * (0.4 + 0.6 * frac);
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
        for (const e of this.enemies)
          if (!e.dead && Math.hypot(sx - e.x, sy - e.y) < u.r + e.r) { hit = e; break sim; }
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

    // rubber band: unit -> drag point
    ctx.strokeStyle = '#ffffff33';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y);
    ctx.lineTo(this.dragNow.x, this.dragNow.y);
    ctx.stroke();

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

// Each theme's obstacle is a real mon that blocks the way — Snorlax asleep
// on the route, Onix coiled in the cave, Golem rolled up in the caldera,
// Dragonite parked on the cloud.
const PROP: Record<Theme, string> = { grove: 'tree', cavern: 'rock', volcano: 'rock', sky: 'rock' };
