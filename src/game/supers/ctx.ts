/* The seam between Battle and the supers — same pattern as Field2Fx in
 * gimmicks2.ts: one context object on Battle wired with closures, so
 * extracted super code never touches private fields. Arrays come back as
 * live getters (waves/orbs/enemies re-seat every wave), hitStop is a
 * get/set pair so `ctx.hitStop = Math.max(ctx.hitStop, n)` reads like the
 * old `this.hitStop`. fx/fxRng/act/actHooks expose the vfx lane so new
 * supers can push primitives and author beat lists directly.
 */
import type { Rect, Unit, Orb, Wave, Beam, Dash, FloatText } from '../battle';
import type { Fx, ActBeat, ActHooks } from '../vfx';
import type { PokeType, Weather } from '../types';

// damage roll for one target at a move power — the dispatcher wraps it in
// the cast anim, so handlers just call it
export type BumpDmg = (e: Unit, power: number) => number;
// the ranged scans bumpAlly hands the type supers — both ride the bumped
// ally's role range multiplier (p.rngMul), so they arrive as closures
export type NearFn = (radius: number) => Unit[];
export type NearestFn = (from: Unit, radius: number) => Unit | undefined;

// one bump-super case: src is the mon whose stats/typing the super rolls
// off (copy: the shooter), p the bumped ally it emanates from
export type TypeSuper = (
  ctx: SuperCtx,
  src: Unit,
  p: Unit,
  bumpDmg: BumpDmg,
  near: NearFn,
  nearest: NearestFn,
) => void;

export interface SuperCtx {
  // live battle state — getters, the arrays re-seat every wave
  readonly enemies: Unit[];
  readonly players: Unit[];
  readonly orbs: Orb[];
  readonly waves: Wave[];
  readonly beams: Beam[];
  readonly dashes: Dash[];
  readonly arena: Rect;
  readonly weather: Weather | null;
  readonly perkIds: string[];
  readonly shotCombo: number;
  readonly time: number;
  hitStop: number; // get/set — contact beats Math.max it
  rng(): number;
  // the vfx lane — primitives push straight into the shared particle pool
  readonly fx: Fx[];
  readonly fxRng: () => number;
  act(beats: ActBeat[]): void;
  readonly actHooks: ActHooks;
  // battle plumbing the supers drive
  hurt(e: Unit, dmg: number, color: string, suffix?: string, src?: Unit): void;
  later(t: number, fn: () => void): void;
  screenFlash(color: string, dur: number): void;
  pushText(t: FloatText): void;
  scar(x: number, y: number, r: number): void;
  impact(x: number, y: number, color: string, scale?: number): void;
  burst(x: number, y: number, color: string, n?: number, speed?: number, size?: number, ramp?: string[]): void;
  flavor(x: number, y: number, type: PokeType): void;
  addShake(amt: number): void;
  addPunch(amt: number): void;
  tryHeal(ps: Unit[], amount: (p: Unit) => number): void;
  log(line: string): void;
}
