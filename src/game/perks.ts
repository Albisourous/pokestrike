import type { Battle } from './battle';

export interface Perk {
  id: string;
  name: string;
  icon: string;
  desc: string;
  apply: (b: Battle) => void;
}

// Between-wave relics — pick 1 of 3. Effects live as multipliers on Battle
// so they never touch the shared SpeciesDef table.
export const PERKS: Perk[] = [
  {
    id: 'mend', name: 'Full Restore', icon: '✚',
    desc: 'heal your team to full',
    apply: (b) => b.players.forEach((p) => { if (!p.dead) p.hp = p.maxHp; }),
  },
  {
    id: 'potion', name: 'Max Potion', icon: '⚗',
    desc: 'heal everyone for 50%',
    apply: (b) => b.players.forEach((p) => { if (!p.dead) p.hp = Math.min(p.hp + p.maxHp / 2, p.maxHp); }),
  },
  {
    id: 'vitality', name: 'HP Up', icon: '❤',
    desc: '+20% max HP (and heal it)',
    apply: (b) => b.players.forEach((p) => {
      if (p.dead) return;
      p.maxHp = Math.round(p.maxHp * 1.2);
      p.hp = Math.min(p.hp + Math.round(p.maxHp * 0.2), p.maxHp);
    }),
  },
  {
    id: 'rage', name: 'Muscle Band', icon: '⚔',
    desc: '+15% all your damage',
    apply: (b) => { b.dmgMult *= 1.15; },
  },
  {
    id: 'overclock', name: 'Quick Claw', icon: '⏱',
    desc: 'bump attacks recharge 20% faster',
    apply: (b) => { b.cdMult *= 0.8; },
  },
  {
    id: 'turbo', name: 'Choice Scarf', icon: '⚡',
    desc: '+12% launch speed',
    apply: (b) => { b.launchBoost *= 1.12; },
  },
  {
    id: 'revive', name: 'Revive', icon: '★',
    desc: 'revive a fallen ally at 40% HP',
    apply: (b) => {
      const dead = b.players.find((p) => p.dead);
      if (dead) {
        dead.dead = false;
        dead.hp = Math.round(dead.maxHp * 0.4);
      } else {
        // nobody to revive — fall back to a heal
        b.players.forEach((p) => { p.hp = Math.min(p.hp + p.maxHp / 2, p.maxHp); });
      }
    },
  },
];

export function rollPerks(rng: () => number): Perk[] {
  const pool = [...PERKS];
  const out: Perk[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}
