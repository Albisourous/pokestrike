import type { Battle } from './battle';

export type Rarity = 'common' | 'uncommon' | 'rare';

export interface Perk {
  id: string;
  name: string;
  item: string; // sprite name in public/sprites/items/
  desc: string;
  rarity: Rarity;
  apply: (b: Battle) => void;
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#a8b0c8',
  uncommon: '#5a9bf0',
  rare: '#f0b02f',
};

// Between-wave relics — pick 1 of 3, real held-item flavor. Effects live as
// multipliers/flags on Battle so they never touch the shared SpeciesDef table.
export const PERKS: Perk[] = [
  {
    id: 'restore', name: 'Max Potion', item: 'max-potion',
    desc: 'heal your team to full',
    rarity: 'rare',
    apply: (b) => b.players.forEach((p) => { if (!p.dead) p.hp = p.maxHp; }),
  },
  {
    id: 'potion', name: 'Potion', item: 'potion',
    desc: 'heal everyone for 50%',
    rarity: 'common',
    apply: (b) => b.players.forEach((p) => { if (!p.dead) p.hp = Math.min(p.hp + p.maxHp / 2, p.maxHp); }),
  },
  {
    id: 'hpup', name: 'HP Up', item: 'hp-up',
    desc: '+20% max HP (and heal it)',
    rarity: 'common',
    apply: (b) => b.players.forEach((p) => {
      if (p.dead) return;
      p.maxHp = Math.round(p.maxHp * 1.2);
      p.hp = Math.min(p.hp + Math.round(p.maxHp * 0.2), p.maxHp);
    }),
  },
  {
    id: 'muscle', name: 'Muscle Band', item: 'muscle-band',
    desc: '+15% all your damage',
    rarity: 'common',
    apply: (b) => { b.dmgMult *= 1.15; },
  },
  {
    id: 'claw', name: 'Quick Claw', item: 'quick-claw',
    desc: 'supers recharge 1 shot sooner',
    rarity: 'uncommon',
    apply: (b) => { b.cdMult *= 0.66; },
  },
  {
    id: 'scarf', name: 'Choice Scarf', item: 'choice-scarf',
    desc: '+12% launch speed',
    rarity: 'common',
    apply: (b) => { b.launchBoost *= 1.12; },
  },
  {
    id: 'leftovers', name: 'Leftovers', item: 'leftovers',
    desc: 'team heals 6% after every shot',
    rarity: 'uncommon',
    apply: (b) => { b.regen += 0.06; },
  },
  {
    id: 'greatball', name: 'Great Ball', item: 'great-ball',
    desc: '+5% catch chance',
    rarity: 'common',
    apply: (b) => { b.captureChance += 0.05; },
  },
  {
    id: 'ultraball', name: 'Ultra Ball', item: 'ultra-ball',
    desc: '+10% catch chance',
    rarity: 'uncommon',
    apply: (b) => { b.captureChance += 0.1; },
  },
  {
    id: 'revive', name: 'Revive', item: 'revive',
    desc: 'revive a fallen ally at 40% HP',
    rarity: 'uncommon',
    apply: (b) => {
      const dead = b.players.find((p) => p.dead);
      if (dead) {
        dead.dead = false;
        dead.hp = Math.round(dead.maxHp * 0.4);
      } else {
        b.players.forEach((p) => { p.hp = Math.min(p.hp + p.maxHp / 2, p.maxHp); });
      }
    },
  },
  {
    id: 'mball', name: 'Master Ball', item: 'master-ball',
    desc: 'auto-catch the strongest enemy next wave',
    rarity: 'rare',
    apply: (b) => { b.masterArmed = true; },
  },
  {
    id: 'cband', name: 'Choice Band', item: 'choice-band',
    desc: '+25% contact damage',
    rarity: 'common',
    apply: (b) => { b.physMult *= 1.25; },
  },
  {
    id: 'cspecs', name: 'Choice Specs', item: 'choice-specs',
    desc: '+25% super damage',
    rarity: 'uncommon',
    apply: (b) => { b.specMult *= 1.25; },
  },
  {
    id: 'wlens', name: 'Wide Lens', item: 'wide-lens',
    desc: '+25% super range for all',
    rarity: 'uncommon',
    apply: (b) => b.players.forEach((p) => { p.rngMul *= 1.25; }),
  },
  {
    id: 'sash', name: 'Focus Sash', item: 'focus-sash',
    desc: 'each ally survives one KO at 1 HP',
    rarity: 'rare',
    apply: (b) => b.players.forEach((p) => { p.sash = true; }),
  },
  {
    id: 'helmet', name: 'Rocky Helmet', item: 'rocky-helmet',
    desc: 'attackers take 10 recoil',
    rarity: 'common',
    apply: (b) => { b.thorns += 10; },
  },
  {
    id: 'metro', name: 'Metronome', item: 'metronome',
    desc: 'each combo link +10% damage',
    rarity: 'uncommon',
    apply: (b) => { b.comboDmg += 0.1; },
  },
  {
    id: 'scope', name: 'Scope Lens', item: 'scope-lens',
    desc: '18% chance hits crit x2',
    rarity: 'uncommon',
    apply: (b) => { b.critCh += 0.18; },
  },
  {
    id: 'krock', name: "King's Rock", item: 'kings-rock',
    desc: 'your hits delay enemy attacks',
    rarity: 'uncommon',
    apply: (b) => { b.stagger += 1; },
  },
  {
    id: 'sbell', name: 'Shell Bell', item: 'shell-bell',
    desc: 'heal weakest ally 5% of damage',
    rarity: 'uncommon',
    apply: (b) => { b.leech += 0.05; },
  },
  {
    id: 'fstone', name: 'Float Stone', item: 'float-stone',
    desc: 'ball slides 35% further',
    rarity: 'common',
    apply: (b) => { b.frictionMult *= 0.65; },
  },
  {
    id: 'ebelt', name: 'Expert Belt', item: 'expert-belt',
    desc: '+30% on super-effective hits',
    rarity: 'uncommon',
    apply: (b) => { b.belt += 0.3; },
  },
  {
    id: 'pherb', name: 'Power Herb', item: 'power-herb',
    desc: 'all supers recharge 1 sooner',
    rarity: 'rare',
    apply: (b) => b.players.forEach((p) => { p.cdMod += 1; }),
  },
];

// Roll a rarity tier, then pick within it — an empty tier trickles down to
// the next lower one (StS-style), so commons stay common but no slot ever
// comes up blank. Rare 10% / uncommon 35% / common 55%.
const TIERS: Rarity[] = ['rare', 'uncommon', 'common'];
export function rollPerks(rng: () => number): Perk[] {
  const pool = [...PERKS];
  const out: Perk[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const roll = rng();
    let tier = roll < 0.1 ? 0 : roll < 0.45 ? 1 : 2;
    let cands: Perk[] = [];
    for (; tier < TIERS.length; tier++) {
      cands = pool.filter((p) => p.rarity === TIERS[tier]);
      if (cands.length) break;
    }
    const pick = cands[Math.floor(rng() * cands.length)];
    out.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }
  return out;
}
