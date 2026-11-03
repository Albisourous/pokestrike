/* The supers seam — battle.ts calls castTypeSuper for the per-type bump
 * super and castNamedSuper for the ~30 signature nukes; content agents
 * author against SuperCtx (ctx.ts) and never touch battle internals.
 */
import type { Unit } from '../battle';
import type { PokeType } from '../types';
import type { SuperCtx, BumpDmg, NearFn, NearestFn, TypeSuper } from './ctx';
import { normal } from './normal';
import { fighting } from './fighting';
import { rock } from './rock';
import { flying } from './flying';
import { fire } from './fire';
import { water } from './water';
import { grass } from './grass';
import { electric } from './electric';
import { psychic } from './psychic';
import { ghost } from './ghost';
import { poison } from './poison';

export { castNamedSuper } from './signatures';
export type { SigArgs, LineBlast } from './signatures';
export type { SuperCtx, BumpDmg, NearFn, NearestFn, TypeSuper } from './ctx';
export { nearest, farthest, flies } from './util';

const TYPE_SUPERS: Record<PokeType, TypeSuper> = {
  normal, fighting, rock, flying, fire, water, grass, electric, psychic, ghost, poison,
};

// the bump-super half of bumpAlly: src rolls the stats/typing (copy: the
// shooter), p is the bumped ally the blast emanates from
export function castTypeSuper(
  ctx: SuperCtx,
  src: Unit,
  p: Unit,
  bumpDmg: BumpDmg,
  near: NearFn,
  nearest: NearestFn,
): void {
  (TYPE_SUPERS[src.def.type] ?? normal)(ctx, src, p, bumpDmg, near, nearest);
}
