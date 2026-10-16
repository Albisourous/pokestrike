export type PokeType =
  | 'normal'
  | 'fire'
  | 'water'
  | 'grass'
  | 'electric'
  | 'psychic'
  | 'rock'
  | 'poison'
  | 'flying'
  | 'fighting'
  | 'ghost';

// attacker -> { defenderType: multiplier }; unlisted pairs are 1x
const CHART: Record<PokeType, Partial<Record<PokeType, number>>> = {
  fire: { grass: 2, water: 0.5, fire: 0.5, rock: 0.5 },
  water: { fire: 2, rock: 2, water: 0.5, grass: 0.5 },
  grass: { water: 2, rock: 2, grass: 0.5, fire: 0.5, poison: 0.5, flying: 0.5 },
  electric: { water: 2, flying: 2, grass: 0.5, electric: 0.5 },
  psychic: { poison: 2, psychic: 0.5 },
  rock: { fire: 2, flying: 2 },
  poison: { grass: 2, poison: 0.5, rock: 0.5, ghost: 0.5 },
  flying: { grass: 2, fighting: 2, electric: 0.5, rock: 0.5 },
  normal: { rock: 0.5, ghost: 0 },
  fighting: { normal: 2, rock: 2, poison: 0.5, flying: 0.5, ghost: 0, psychic: 0.5 },
  ghost: { psychic: 2, ghost: 2, normal: 0 },
};

export const effectiveness = (atk: PokeType, def: PokeType) => CHART[atk][def] ?? 1;

// Dual-typing: the second type multiplies defensive matchups — 4x
// weaknesses, stacked resists and full immunities all fall out of it.
export interface Typed {
  type: PokeType;
  type2?: PokeType;
}
export const typeMult = (atk: PokeType, def: Typed) =>
  effectiveness(atk, def.type) * (def.type2 ? effectiveness(atk, def.type2) : 1);
// a dual-typed striker leads with whichever of its types hits harder
export const strikeType = (att: Typed, def: Typed): PokeType =>
  att.type2 && typeMult(att.type2, def) > typeMult(att.type, def) ? att.type2 : att.type;

export const TYPE_COLOR: Record<PokeType, string> = {
  normal: '#a8a878',
  fire: '#f08030',
  water: '#6890f0',
  grass: '#78c850',
  electric: '#f8d030',
  psychic: '#f85888',
  rock: '#b8a038',
  poison: '#a040a0',
  flying: '#a890f0',
  fighting: '#c03028',
  ghost: '#705898',
};
