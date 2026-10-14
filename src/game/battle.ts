import { Vec, len, dist, norm, vec } from '../core/vec';
import { sprite } from '../core/assets';
import { SpeciesDef, StageDef } from './data';
import { effectiveness, TYPE_COLOR } from './types';
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
} from './stats';

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
  boss: boolean;
  dead: boolean;
  dotTicks: number; // poison ticks remaining
  dotDmg: number;
  lastHit: Map<number, number>; // shooter uid -> game time
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
}
interface Zap {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
}
interface Burst {
  x: number;
  y: number;
  r: number;
  t: number;
  color: string;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  color: string;
}
interface Orb {
  x: number;
  y: number;
  target: Unit;
  dmg: number;
  t: number;
  color: string;
}

export type Phase = 'aim' | 'shot' | 'enemy' | 'won' | 'lost';

const STOP_SPEED = 45;
const SHOT_MAX_DRAG = 190;
const POWER = 8;
const WALL_REST = 0.92;
const UNIT_REST = 0.9;
const FRICTION = 1.7;
const HIT_COOLDOWN = 0.12;
const ENEMY_TURN_DELAY = 0.6;
const ENEMY_BASE_TIMER = 3;

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
  private stopTimer = 0;
  private enemyPhaseT = 0;
  private pendingAttacks: Unit[] = [];
  private bumpsThisShot = new Set<number>();
  private texts: FloatText[] = [];
  private zaps: Zap[] = [];
  private bursts: Burst[] = [];
  private particles: Particle[] = [];
  private orbs: Orb[] = [];

  constructor(
    public arena: Rect,
    team: SpeciesDef[],
    public stage: StageDef,
  ) {
    const n = team.length;
    team.forEach((def, i) => {
      this.players.push({
        uid: nextUid++,
        def,
        side: 'player',
        x: arena.x + (arena.w * (i + 1)) / (n + 1),
        y: arena.y + arena.h - 70,
        vx: 0,
        vy: 0,
        r: 26,
        hp: playerHp(def.stats),
        maxHp: playerHp(def.stats),
        timer: 0,
        drift: 0,
        boss: false,
        dead: false,
        dotTicks: 0,
        dotDmg: 0,
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

  private spawnWave(i: number) {
    this.waveIndex = i;
    this.enemies = this.stage.waves[i].map((s) => ({
      uid: nextUid++,
      def: s.def,
      side: 'enemy',
      x: this.arena.x + this.arena.w * s.nx,
      y: this.arena.y + this.arena.h * s.ny,
      vx: 0,
      vy: 0,
      r: s.boss ? 46 : 26,
      hp: s.boss ? bossHp(s.def.stats) : enemyHp(s.def.stats),
      maxHp: s.boss ? bossHp(s.def.stats) : enemyHp(s.def.stats),
      timer: ENEMY_BASE_TIMER,
      drift: enemyDrift(s.def.stats) * (s.boss ? 0.55 : 1),
      boss: !!s.boss,
      dead: false,
      dotTicks: 0,
      dotDmg: 0,
      lastHit: new Map(),
    }));
    this.waveBanner = 1.4;
  }

  // --- input (logical coords) ---

  pointerDown(p: Vec) {
    if (this.phase !== 'aim') return;
    this.dragging = true;
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
    const speed = Math.min(pullLen, SHOT_MAX_DRAG) * POWER * launchMult(u.def.stats);
    u.vx = dir.x * speed;
    u.vy = dir.y * speed;
    u.lastHit.clear();
    this.bumpsThisShot.clear();
    this.stopTimer = 0;
    this.phase = 'shot';
    this.shots++;
  }

  // --- simulation ---

  update(dt: number) {
    this.time += dt;
    for (const t of this.texts) t.t -= dt;
    this.texts = this.texts.filter((t) => t.t > 0);
    for (const z of this.zaps) z.t -= dt;
    this.zaps = this.zaps.filter((z) => z.t > 0);
    for (const b of this.bursts) b.t -= dt;
    this.bursts = this.bursts.filter((b) => b.t > 0);
    for (const p of this.particles) {
      p.t -= dt;
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
      const damp = Math.exp(-FRICTION * h);
      u.vx *= damp;
      u.vy *= damp;
      u.x += u.vx * h;
      u.y += u.vy * h;
      this.hitWalls(u);
      for (const e of wave) {
        if (this.enemies !== wave) break;
        if (!e.dead && this.collide(u, e)) this.strikeEnemy(u, e);
      }
      for (const p of this.players) {
        if (!p.dead && p !== u && this.collide(u, p)) this.bumpAlly(p);
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
        if (d > e.r + target.r + 6) {
          const dir = norm({ x: target.x - e.x, y: target.y - e.y });
          e.x += dir.x * e.drift * dt;
          e.y += dir.y * e.drift * dt;
        }
      }
      this.clampToArena(e);
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

  // Push mover m out of static o.
  private separate(m: Unit, o: Unit) {
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
      if (dist(o, o.target) < o.target.r + 6) {
        this.hurt(o.target, o.dmg, '#9df0ff');
        this.spark(o.x, o.y, '#6890f0');
        o.t = 0;
      }
    }
    this.orbs = this.orbs.filter((o) => o.t > 0);
  }

  private hitWalls(u: Unit) {
    const a = this.arena;
    if (u.x - u.r < a.x) {
      u.x = a.x + u.r;
      u.vx = -u.vx * WALL_REST;
      this.spark(u.x - u.r, u.y, '#5adfff');
    } else if (u.x + u.r > a.x + a.w) {
      u.x = a.x + a.w - u.r;
      u.vx = -u.vx * WALL_REST;
      this.spark(u.x + u.r, u.y, '#5adfff');
    }
    if (u.y - u.r < a.y) {
      u.y = a.y + u.r;
      u.vy = -u.vy * WALL_REST;
      this.spark(u.x, u.y - u.r, '#5adfff');
    } else if (u.y + u.r > a.y + a.h) {
      u.y = a.y + a.h - u.r;
      u.vy = -u.vy * WALL_REST;
      this.spark(u.x, u.y + u.r, '#5adfff');
    }
  }

  // Push moving unit out of a static unit and reflect its velocity.
  private collide(u: Unit, o: Unit): boolean {
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
    e.hp -= dmg;
    this.texts.push({
      x: e.x,
      y: e.y - e.r - 8,
      text: `${dmg}${suffix}`,
      t: 0.9,
      color,
    });
    if (e.hp <= 0) {
      e.dead = true;
      this.bursts.push({ x: e.x, y: e.y, r: e.r * 2.5, t: 0.4, color: '#ffffff' });
      if (this.enemies.every((x) => x.dead)) this.waveCleared();
    }
  }

  private strikeEnemy(shooter: Unit, e: Unit) {
    const last = e.lastHit.get(shooter.uid) ?? -1;
    if (this.time - last < HIT_COOLDOWN) return;
    e.lastHit.set(shooter.uid, this.time);
    const mult = effectiveness(shooter.def.type, e.def.type);
    const dmg = physDamage(shooter.def.stats.atk, e.def.stats.def, mult);
    const color = mult > 1 ? '#ffd84d' : mult < 1 ? '#8a90a8' : '#ffffff';
    this.hurt(e, dmg, color, mult > 1 ? '!' : '');
    this.spark(e.x, e.y, TYPE_COLOR[shooter.def.type]);
  }

  // Bump an ally mid-shot: it fires its type's signature attack.
  private bumpAlly(p: Unit) {
    if (this.bumpsThisShot.has(p.uid)) return;
    this.bumpsThisShot.add(p.uid);
    const near = (radius: number) =>
      this.enemies.filter((e) => !e.dead && dist(p, e) <= radius + e.r);
    const nearest = (from: Unit, radius: number) =>
      this.enemies
        .filter((e) => !e.dead && dist(from, e) <= radius + e.r)
        .sort((a, b) => dist(from, a) - dist(from, b))[0];
    const phys = bumpIsPhysical(p.def.type);
    const eff = (e: Unit) => effectiveness(p.def.type, e.def.type);
    // Physical bump attacks roll Attack vs Defense; elemental ones SpA vs SpD.
    const bumpDmg = (e: Unit, power: number) =>
      phys
        ? physDamage(p.def.stats.atk, e.def.stats.def, eff(e), power)
        : specDamage(p.def.stats.spa, e.def.stats.spd, eff(e), power);
    const color = TYPE_COLOR[p.def.type];

    switch (p.def.type) {
      case 'fire': // radial blast
        this.bursts.push({ x: p.x, y: p.y, r: 150, t: 0.35, color });
        for (const e of near(150)) this.hurt(e, bumpDmg(e, 0.9), '#9df0ff');
        break;
      case 'electric': {
        // chain lightning: up to 3 jumps between enemies
        let from: Unit = p;
        const hit = new Set<number>();
        let mult = 1;
        for (let i = 0; i < 3; i++) {
          const next = this.enemies
            .filter((e) => !e.dead && !hit.has(e.uid) && dist(from, e) <= 190)
            .sort((a, b) => dist(from, a) - dist(from, b))[0];
          if (!next) break;
          hit.add(next.uid);
          this.zaps.push({ x1: from.x, y1: from.y, x2: next.x, y2: next.y, t: 0.35 });
          this.hurt(next, bumpDmg(next, mult), '#9df0ff');
          mult *= 0.7;
          from = next;
        }
        break;
      }
      case 'grass': {
        // drain field: damage nearby enemies, heal the team
        this.bursts.push({ x: p.x, y: p.y, r: 140, t: 0.35, color });
        let dealt = 0;
        for (const e of near(140)) {
          const dmg = bumpDmg(e, 0.8);
          dealt += dmg;
          this.hurt(e, dmg, '#9df0ff');
        }
        const heal = Math.max(Math.round(dealt * 0.25), 4);
        for (const pl of this.players) {
          if (pl.dead) continue;
          pl.hp = Math.min(pl.hp + heal, pl.maxHp);
          this.texts.push({ x: pl.x, y: pl.y - pl.r - 8, text: `+${heal}`, t: 0.9, color: '#6fdc6f' });
        }
        break;
      }
      case 'water':
        // homing water orbs at the 3 nearest enemies
        near(Infinity)
          .sort((a, b) => dist(p, a) - dist(p, b))
          .slice(0, 3)
          .forEach((e) => {
            this.orbs.push({
              x: p.x,
              y: p.y,
              target: e,
              dmg: bumpDmg(e, 0.9),
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
        this.bursts.push({ x: p.x, y: p.y, r: radius, t: 0.35, color });
        for (const e of near(radius)) {
          const dir = norm({ x: e.x - p.x, y: e.y - p.y });
          e.vx += dir.x * knock;
          e.vy += dir.y * knock;
          this.hurt(e, bumpDmg(e, pow), '#9df0ff');
        }
        break;
      }
      case 'poison':
        // toxin: small hit now, plus 2 ticks at the end of your shots
        this.bursts.push({ x: p.x, y: p.y, r: 140, t: 0.35, color });
        for (const e of near(140)) {
          e.dotTicks = 2;
          e.dotDmg = specDamage(p.def.stats.spa, e.def.stats.spd, eff(e), 0.5);
          this.hurt(e, bumpDmg(e, 0.7), '#9df0ff');
        }
        break;
      case 'rock':
      case 'fighting': {
        // heavy hit on the nearest enemy
        const e = nearest(p, 200);
        if (e) {
          this.bursts.push({ x: e.x, y: e.y, r: e.r * 2, t: 0.3, color });
          this.hurt(e, bumpDmg(e, 1.8), '#9df0ff');
        }
        break;
      }
      case 'ghost': {
        // hex: hit every enemy weakly
        for (const e of near(Infinity)) this.hurt(e, bumpDmg(e, 0.55), '#9df0ff');
        this.bursts.push({ x: p.x, y: p.y, r: 220, t: 0.4, color });
        break;
      }
      default: {
        // normal: quick tackle on the nearest enemy
        const e = nearest(p, 180);
        if (e) {
          this.zaps.push({ x1: p.x, y1: p.y, x2: e.x, y2: e.y, t: 0.25 });
          this.hurt(e, bumpDmg(e, 1.4), '#9df0ff');
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.enemies.length === 0 && this.phase !== 'won') this.waveCleared();
  }

  private waveCleared() {
    if (this.waveIndex + 1 < this.waveCount) {
      this.spawnWave(this.waveIndex + 1);
    } else {
      this.phase = 'won';
    }
  }

  private endShot() {
    const u = this.active;
    u.vx = 0;
    u.vy = 0;
    const waveAt = this.waveIndex;
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
      e.timer = ENEMY_BASE_TIMER;
      if (e.boss) {
        const R = 170;
        this.bursts.push({ x: e.x, y: e.y, r: R, t: 0.5, color: '#f85888' });
        for (const p of this.players) {
          if (!p.dead && dist(e, p) <= R + p.r)
            this.damagePlayer(p, specDamage(e.def.stats.spa, p.def.stats.spd, 1, blastPower));
        }
      } else {
        const target = this.players.filter((p) => !p.dead).sort((a, b) => dist(e, a) - dist(e, b))[0];
        if (target) {
          this.zaps.push({ x1: e.x, y1: e.y, x2: target.x, y2: target.y, t: 0.35 });
          this.damagePlayer(target, physDamage(e.def.stats.atk, target.def.stats.def, 1, zapPower));
        }
      }
    }
    this.pendingAttacks = [];
    if (this.players.every((p) => p.dead)) {
      this.phase = 'lost';
      return;
    }
    this.nextTurn();
  }

  private damagePlayer(p: Unit, dmg: number) {
    p.hp -= dmg;
    this.texts.push({ x: p.x, y: p.y - p.r - 8, text: `-${dmg}`, t: 0.9, color: '#ff6b6b' });
    this.spark(p.x, p.y, '#ff6b6b');
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      this.bursts.push({ x: p.x, y: p.y, r: p.r * 2, t: 0.4, color: '#ff6b6b' });
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

  private spark(x: number, y: number, color: string) {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 140;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.35, color });
    }
  }

  // --- rendering ---

  render(ctx: CanvasRenderingContext2D) {
    const a = this.arena;

    // arena
    ctx.fillStyle = '#12162b';
    this.roundRect(ctx, a.x, a.y, a.w, a.h, 18);
    ctx.fill();
    ctx.strokeStyle = '#2a3560';
    ctx.lineWidth = 3;
    ctx.stroke();

    for (const z of this.zaps) this.drawZap(ctx, z);
    for (const b of this.bursts) this.drawBurst(ctx, b);

    for (const e of this.enemies) this.drawUnit(ctx, e);
    for (const p of this.players) this.drawUnit(ctx, p);

    for (const o of this.orbs) {
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.arc(o.x, o.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(p.t / 0.35, 0);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(t.t / 0.3, 1);
      ctx.font = 'bold 20px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      const dy = (0.9 - t.t) * 40;
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

    if (this.waveBanner > 0) {
      ctx.globalAlpha = Math.min(this.waveBanner, 1);
      ctx.font = 'bold 34px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(
        this.waveIndex + 1 === this.waveCount
          ? 'BOSS'
          : `WAVE ${this.waveIndex + 1} / ${this.waveCount}`,
        a.x + a.w / 2,
        a.y + a.h / 2,
      );
      ctx.globalAlpha = 1;
    }
  }

  private drawUnit(ctx: CanvasRenderingContext2D, u: Unit) {
    if (u.dead) return;
    const img = sprite(u.def.id);
    const size = u.r * 2.6;
    ctx.drawImage(img, u.x - size / 2, u.y - size / 2, size, size);

    // hp bar
    const bw = u.r * 2;
    const pct = Math.max(u.hp / u.maxHp, 0);
    ctx.fillStyle = '#000a';
    ctx.fillRect(u.x - bw / 2, u.y + u.r + 4, bw, 5);
    ctx.fillStyle = pct > 0.5 ? '#6fdc6f' : pct > 0.25 ? '#ffd84d' : '#ff6b6b';
    ctx.fillRect(u.x - bw / 2, u.y + u.r + 4, bw * pct, 5);

    if (u.side === 'enemy') {
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
    }
  }

  private drawAim(ctx: CanvasRenderingContext2D) {
    const u = this.active;
    const pull = { x: this.dragStart.x - this.dragNow.x, y: this.dragStart.y - this.dragNow.y };
    const pullLen = len(pull);
    if (pullLen < 12) return;
    const dir = norm(pull);
    const power = Math.min(pullLen, SHOT_MAX_DRAG);
    const color = TYPE_COLOR[u.def.type];

    // rubber band: unit -> drag point
    ctx.strokeStyle = '#ffffff33';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y);
    ctx.lineTo(this.dragNow.x, this.dragNow.y);
    ctx.stroke();

    // launch arrow: unit -> opposite direction
    const ex = u.x + dir.x * power * 1.4;
    const ey = u.y + dir.y * power * 1.4;
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
  }

  private drawZap(ctx: CanvasRenderingContext2D, z: Zap) {
    const alpha = Math.max(z.t / 0.35, 0);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffe66d';
    ctx.lineWidth = 3;
    const mx = (z.x1 + z.x2) / 2;
    const my = (z.y1 + z.y2) / 2;
    ctx.beginPath();
    ctx.moveTo(z.x1, z.y1);
    ctx.lineTo(mx + 14, my - 10);
    ctx.lineTo(mx - 12, my + 12);
    ctx.lineTo(z.x2, z.y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawBurst(ctx: CanvasRenderingContext2D, b: Burst) {
    const progress = 1 - b.t / (b.r > 60 ? 0.5 : 0.35);
    ctx.globalAlpha = Math.max(b.t, 0);
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * progress, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
