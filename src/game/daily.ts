// the daily climb already shares one UTC seed — this is its seeded twist:
// one rule card per UTC day, same pick for everyone (like the seed itself).
import type { Battle } from './battle';

export interface DailyMod {
  id: string;
  name: string;
  desc: string; // one terse clause — second line of the title's rule card
  // flag/field tweaks on the battle, same surface the bag items use; main.ts
  // applies the pick after the metagame sets so multipliers land on top
  apply: (b: Battle) => void;
}

export const DAILY_MODS: DailyMod[] = [
  { id: 'fever', name: 'GOLD FEVER', desc: '3× shiny odds', apply: (b) => { b.shinyRate *= 3; } },
  {
    id: 'hearty', name: 'HEARTY', desc: 'team +25% HP, foes +10%',
    apply: (b) => {
      for (const p of b.players) {
        p.maxHp = Math.round(p.maxHp * 1.25);
        p.hp = p.maxHp;
      }
      b.foeHpBonus += 0.1;
    },
  },
  { id: 'rich', name: 'BIG SPENDER', desc: 'marts 25% off, +20% score', apply: (b) => { b.martMult *= 0.75; b.scoreMult += 0.2; } },
  { id: 'rough', name: 'ROUGH ROAD', desc: 'every rolled wave gains an affix', apply: (b) => { b.allAffix = true; } },
  { id: 'stormy', name: 'STORM CHASER', desc: 'every wave rolls weather', apply: (b) => { b.dailyWeather = true; } },
  { id: 'glass', name: 'GLASS CANNON', desc: 'team +30% dmg, foes +20% HP', apply: (b) => { b.dmgMult *= 1.3; b.foeHpBonus += 0.2; } },
  { id: 'safari', name: 'SAFARI DAY', desc: 'catches come 25% easier', apply: (b) => { b.captureChance *= 1.25; } },
  { id: 'heavy', name: 'HEAVYWEIGHTS', desc: 'foes carry +25% HP', apply: (b) => { b.foeHpBonus += 0.25; } },
  { id: 'ricochet', name: 'RICOCHET', desc: 'ricochets bank +1 super pip', apply: (b) => { b.ricoPip += 1; } },
];

// hashed off the UTC date key — the same 'YYYY-MM-DD' the daily seed rides
// (main.ts dailySeed). The hash stops consecutive days walking the list in
// a fixed rotation, so neighbors differ in kind, not just in number.
// The title re-reads the card every frame — memo on the day key, not the Date.
let modDay = '';
let modPick: DailyMod | undefined;

export function dailyMod(now = Date.now()): DailyMod {
  const key = new Date(now).toISOString().slice(0, 10);
  if (key !== modDay) {
    modDay = key;
    let h = 0;
    for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) | 0;
    modPick = DAILY_MODS[(h >>> 0) % DAILY_MODS.length];
  }
  return modPick!;
}
