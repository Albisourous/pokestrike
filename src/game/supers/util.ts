/* Pure helpers the supers share — picked helpers that used to live as
 * module-level consts in battle.ts. No battle internals: typed against
 * Unit by import-type only, so this file carries no runtime edge back.
 */
import { dist } from '../../core/vec';
import type { Vec } from '../../core/vec';
import { FLOATERS } from '../data';
import type { SpeciesDef } from '../data';
import type { Unit } from '../battle';

// airborne rule: a flying type or a canon floater never touches the ground
export const flies = (d: SpeciesDef) => d.type === 'flying' || d.type2 === 'flying' || FLOATERS.has(d.id);

export const nearest = (foes: Unit[], p: Vec) => foes.slice().sort((a, b) => dist(p, a) - dist(p, b))[0];
export const farthest = (foes: Unit[], p: Vec) => foes.slice().sort((a, b) => dist(p, b) - dist(p, a))[0];
