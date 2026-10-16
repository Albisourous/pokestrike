import type { PokeType } from './types';

// Tiered type traits — lifted from pokelike's Battle Tower: fielded mons
// sharing a type unlock team-wide powers. Shinies count double toward the
// count, so a gold catch is build-around bait, not just a palette swap.
// Thresholds fit the 4-mon team: pokelike's 2/4/6 assumed a squad of six.
export const TRAIT_TIERS = [2, 3, 5];

export interface TraitUnit {
  dead: boolean;
  shiny: boolean;
  def: { type: PokeType };
}

export function teamTraits(players: TraitUnit[]): Map<PokeType, number> {
  const counts = new Map<PokeType, number>();
  for (const p of players) {
    if (p.dead) continue;
    counts.set(p.def.type, (counts.get(p.def.type) ?? 0) + (p.shiny ? 2 : 1));
  }
  const out = new Map<PokeType, number>();
  for (const [t, c] of counts) {
    const tier = c >= TRAIT_TIERS[2] ? 3 : c >= TRAIT_TIERS[1] ? 2 : c >= TRAIT_TIERS[0] ? 1 : 0;
    if (tier) out.set(t, tier);
  }
  return out;
}

// One mechanic per type, scaled by tier — every line lands on an existing
// battle modifier so traits need no new systems.
export const TRAIT_DESC: Record<PokeType, string[]> = {
  fire:     ['+10% damage dealt', '+20% damage dealt', '+30% damage dealt'],
  water:    ['team heals 3% after each shot', 'team heals 6% after each shot', 'team heals 9% after each shot'],
  grass:    ['hits heal weakest ally 4%', 'hits heal weakest ally 8%', 'hits heal weakest ally 12%'],
  electric: ['each chain hit +4% damage', 'each chain hit +8% damage', 'each chain hit +12% damage'],
  psychic:  ['10% of each hit splashes', '20% of each hit splashes', '30% of each hit splashes'],
  rock:     ['team takes 7% less damage', 'team takes 14% less damage', 'team takes 21% less damage'],
  poison:   ['hits 25% chance to poison', 'hits 50% chance to poison', 'hits 75% chance to poison'],
  flying:   ['7% chance enemy attacks miss', '14% chance enemy attacks miss', '21% chance enemy attacks miss'],
  fighting: ['a fallen ally grants +5% power', 'a fallen ally grants +10% power', 'a fallen ally grants +15% power'],
  ghost:    ['execute foes under 6% HP', 'execute foes under 12% HP', 'execute foes under 18% HP'],
  normal:   ['heal 5% when a wave begins', 'heal 10% when a wave begins', 'heal 15% when a wave begins'],
};
