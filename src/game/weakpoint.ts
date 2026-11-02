import { mulberry32 } from '../core/rng';

// side stream for hidden weak points: never draws the run rng, so ?seed= replays hold
export const wpRng = (mapSeed: number, battle: number, wave: number) => mulberry32((mapSeed * 97 + battle * 13 + wave * 5 + 0x77a1) >>> 0);

// MS hide_wp_rate by stop third; gentle opener rooms never hide one
export const hideWpRate = (rates: readonly number[], wave: number, gentle: boolean) =>
  gentle ? 0 : rates[Math.min(rates.length - 1, Math.floor(wave / 3))];

export interface WpFoe { boss?: boolean; dead: boolean; wpHidden?: boolean; def: { shielded?: boolean } }
export function hideWeakPoints(foes: WpFoe[], rate: number, rng: () => number) {
  let n = 0;
  if (rate <= 0) return n;
  for (const e of foes) if (!e.boss && !e.dead && !e.def.shielded && rng() < rate) { e.wpHidden = true; n++; }
  return n;
}
