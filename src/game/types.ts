// the canonical type order — super SFX pitch rides the index, so an
// element keeps its own sound from one run to the next
export const TYPES = [
  'normal',
  'fire',
  'water',
  'grass',
  'electric',
  'psychic',
  'rock',
  'poison',
  'flying',
  'fighting',
  'ghost',
] as const;
export type PokeType = (typeof TYPES)[number];

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

// Court weather — Gen-3 weather wars shrunk to a wave gimmick: each sky
// boosts its type ×1.5 and dulls the counter-type ×0.75 on typed hits.
export type Weather = 'sun' | 'rain' | 'sand' | 'wind';
export const WEATHER_OF: Record<Weather, [PokeType, PokeType]> = {
  sun: ['fire', 'water'],
  rain: ['water', 'fire'],
  sand: ['rock', 'flying'],
  wind: ['flying', 'electric'],
};
export const weatherMult = (w: Weather | null | undefined, at: PokeType) =>
  !w ? 1 : at === WEATHER_OF[w][0] ? 1.5 : at === WEATHER_OF[w][1] ? 0.75 : 1;
export const WEATHER_LINE: Record<Weather, string> = {
  sun: 'THE SUN BEATS DOWN · FIRE ×1.5',
  rain: 'RAIN FALLS · WATER ×1.5',
  sand: 'SANDSTORM RAGES · ROCK ×1.5',
  wind: 'STRONG WINDS · FLYING ×1.5',
};
export const WEATHER_TINT: Record<Weather, string> = {
  sun: '#ff9a30',
  rain: '#6890f0',
  sand: '#c8b060',
  wind: '#a8d8f0',
};

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
