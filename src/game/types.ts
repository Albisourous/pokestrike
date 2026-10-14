export type PokeType =
  | 'normal'
  | 'fire'
  | 'water'
  | 'grass'
  | 'electric'
  | 'psychic'
  | 'rock'
  | 'poison'
  | 'flying';

// attacker -> { defenderType: multiplier }; unlisted pairs are 1x
const CHART: Record<PokeType, Partial<Record<PokeType, number>>> = {
  fire: { grass: 2, water: 0.5, fire: 0.5, rock: 0.5 },
  water: { fire: 2, rock: 2, water: 0.5, grass: 0.5 },
  grass: { water: 2, rock: 2, grass: 0.5, fire: 0.5, poison: 0.5, flying: 0.5 },
  electric: { water: 2, flying: 2, grass: 0.5, electric: 0.5 },
  psychic: { poison: 2, psychic: 0.5 },
  rock: { fire: 2, flying: 2 },
  poison: { grass: 2, poison: 0.5, rock: 0.5 },
  flying: { grass: 2, electric: 0.5, rock: 0.5 },
  normal: { rock: 0.5 },
};

export const effectiveness = (atk: PokeType, def: PokeType) => CHART[atk][def] ?? 1;

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
};
