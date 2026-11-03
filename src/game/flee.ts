import { mulberry32 } from '../core/rng';
import { sfx } from '../core/audio';
import { addDust } from './meta';
import { ENEMY_DB, ELITES, ROOM_LAYOUTS, isGentleRoom } from './data';
import type { SpeciesDef, WaveSpawn } from './data';
import { LV_CAP } from './stats';
import { MOVE_ANIM, ring, spawnAnim } from './anim';
import type { Telops } from './telop';

export const FLEE_RATE = 1 / 6;
export const FLEE_FROM = 4;
export const FLEE_TURNS = 2;
export const FLEE_HP = 0.35;
export const FLEE_DEF = 0.3;
export const FLEE_DUST = 30;
export const FLEE_STARS = 3;
export const FLEE_SHINY = 1 / 8;
export const FLEE_SPOOK = 0.4; // wound it under this share of its own max and it bolts next tick
export const FLEE_DUST_STEP = 8; // dust steps up per stage past FLEE_FROM
const WARN = '#ff5f6d';
// OS reduced-motion seed (same probe as bg/evolve/fame): the warning frame holds steady
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface FleeUnit {
  uid: number;
  def: SpeciesDef;
  maxHp: number;
  hp: number;
  timer: number;
  clocks: unknown[];
  bigT: number;
  shiny: boolean;
  dead: boolean;
  x: number;
  y: number;
  r: number;
}

interface FleeState {
  left: number;
  hits: number;
  paid: boolean;
}

const SPECIES = [{ id: 63, weight: 45 }, { id: 113, weight: 35 }, { id: 132, weight: 20 }];
const SPECIES_DB = [...ENEMY_DB, ...ELITES];

export class Flee {
  at = 0;
  private rng = mulberry32(0);
  private stage = 1;
  private picked: SpeciesDef | null = null;
  private shiny = false;
  private nx = 0.5;
  private ny = 0.3;
  private units = new Map<FleeUnit, FleeState>();

  plan(seed: number, stage: number, battles: number, off: boolean, gentle1 = false): boolean {
    this.at = 0;
    this.stage = stage;
    this.picked = null;
    this.shiny = false;
    this.units.clear();
    this.rng = mulberry32(seed);
    if (off || stage < FLEE_FROM) return false;
    for (let battle = 1; battle <= battles; battle++) {
      if (this.rng() >= FLEE_RATE || (battle === 1 && gentle1)) continue;
      this.at = battle;
      const roll = this.rng() * 100;
      const id = roll < SPECIES[0].weight ? SPECIES[0].id : roll < SPECIES[0].weight + SPECIES[1].weight ? SPECIES[1].id : SPECIES[2].id;
      const def = SPECIES_DB.find((species) => species.id === id)!;
      this.picked = { ...def, blink: undefined, mirror: undefined, healer: undefined, copy: undefined };
      this.shiny = id === 132 && this.rng() < FLEE_SHINY;
      this.nx = 0.1 + this.rng() * 0.8;
      this.ny = 0.1 + this.rng() * 0.8;
      return true;
    }
    return false;
  }

  room(battle: number, grid: string[]): string[] {
    if (this.at !== battle || !isGentleRoom(grid)) return grid;
    const pool = ROOM_LAYOUTS.slice(3);
    return pool[Math.floor(this.rng() * pool.length)];
  }

  spawnAt(): WaveSpawn {
    return { def: this.picked!, nx: this.nx, ny: this.ny, lvl: Math.min(LV_CAP, 5 + (this.stage - 1) * 10) };
  }

  build<T>(host: { rng: () => number }, f: () => T): T {
    const rng = host.rng;
    host.rng = this.rng;
    try {
      return f();
    } finally {
      host.rng = rng;
    }
  }

  spawn<T extends FleeUnit>(e: T): T {
    e.maxHp = e.hp = Math.round(e.maxHp * FLEE_HP);
    e.timer = 99;
    e.clocks = [];
    e.bigT = 0;
    e.shiny = this.shiny;
    this.units.set(e, { left: FLEE_TURNS, hits: 0, paid: false });
    return e;
  }

  is(e: FleeUnit): boolean {
    return this.units.has(e);
  }

  def(e: FleeUnit, damage: number): number {
    const state = this.units.get(e);
    if (!state) return damage;
    const dealt = Math.max(1, Math.round(damage * FLEE_DEF));
    // spooked: a hit that would drop it under FLEE_SPOOK cuts the countdown to its last tick
    if (state.left > 1 && e.hp - dealt <= e.maxHp * FLEE_SPOOK) state.left = 1;
    return dealt;
  }

  turn(enemies: FleeUnit[], telop: Telops): void {
    for (const e of enemies) {
      const state = this.units.get(e);
      if (!state || e.dead) continue;
      if (--state.left === 1) {
        // last-tick warning — the chip blinks red until it bolts
        telop.push({ kind: 'foe', title: `${e.def.name.toUpperCase()} EYES THE EXIT`, mon: e.def.id });
        sfx('warn');
      }
      if (state.left > 0) continue;
      e.dead = true;
      ring(MOVE_ANIM.psychic, e.x, e.y, e.r);
      spawnAnim('wind', e.x, e.y, 0, -24, 1.4, 0.5, 1, 0, 0, 0, 16, false, 0, 0.45);
      sfx('gust');
      telop.push({ kind: 'foe', title: `${e.def.name.toUpperCase()} FLED`, mon: e.def.id });
    }
  }

  ko(e: FleeUnit, earnStars: (n: number) => number): string {
    const state = this.units.get(e);
    if (!state || state.paid) return '';
    state.paid = true;
    const dust = FLEE_DUST + Math.max(0, this.stage - FLEE_FROM) * FLEE_DUST_STEP;
    addDust(dust);
    // star pieces ride Chansey's pouch and any shiny — the two pulls worth chasing
    const stars = e.def.id === 113 || e.shiny ? FLEE_STARS : 0;
    if (stars) earnStars(stars);
    return stars ? `+${dust} DUST · +${stars} STAR PIECES` : `+${dust} DUST`;
  }

  hitSeed(e: FleeUnit, mapSeed: number, waveIndex: number, battle: number): number {
    const state = this.units.get(e);
    if (!state) return 0;
    state.hits++;
    return (mapSeed * 977 + waveIndex * 131 + battle * 17 + e.uid * 7919 + state.hits * 104729) >>> 0;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const blink = REDUCED || Math.floor(Date.now() / 150) % 2 === 0;
    for (const [e, state] of this.units) {
      if (e.dead || state.left <= 0) continue;
      const hot = state.left === 1; // last tick — the frame flashes red on and off
      const x = e.x, y = e.y - e.r - 18;
      ctx.fillStyle = 'rgba(8,10,20,0.82)';
      ctx.fillRect(x - 16, y - 7, 32, 14);
      ctx.strokeStyle = hot && blink ? WARN : '#f0e6c8';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 16, y - 7, 32, 14);
      for (let i = 0; i < FLEE_TURNS; i++) {
        ctx.beginPath();
        ctx.arc(x + (i === 0 ? -6 : 6), y, 3, 0, Math.PI * 2);
        ctx.fillStyle = i < state.left ? (hot ? WARN : '#ffd84d') : '#8890b8';
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
