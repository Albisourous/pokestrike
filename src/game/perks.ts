import type { Battle } from './battle';
import type { PokeType } from './types';
import { bumpCooldown } from './stats';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface Perk {
  id: string;
  name: string;
  item: string; // sprite name in public/sprites/items/
  desc: string;
  rarity: Rarity;
  minRank?: number; // only offered once run rank reaches this
  apply: (b: Battle) => void;
  // PokéBonk-style periodic clause — dt is seconds; timer state lives in the
  // tickState WeakMap below so apply stays the flat half and tick the trigger
  tick?: (b: Battle, dt: number) => void;
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#a8b0c8',
  uncommon: '#5a9bf0',
  rare: '#f0b02f',
  legendary: '#c05df0',
};

const heal = (frac: number) => (b: Battle) =>
  b.players.forEach((p) => { if (!p.dead) p.hp = Math.min(p.hp + p.maxHp * frac, p.maxHp); });

// Between-wave items — pick 1 of 3, real held-item flavor. Effects live as
// multipliers/flags on Battle so they never touch the shared SpeciesDef table.
export const PERKS: Perk[] = [
  // --- common: vitamins, berries, balls, small bumps ---
  {
    id: 'potion', name: 'Potion', item: 'potion',
    desc: 'heal everyone for 50%',
    rarity: 'common',
    apply: heal(0.5),
  },
  {
    id: 'oran', name: 'Oran Berry', item: 'oran-berry',
    desc: 'heal everyone for 20%',
    rarity: 'common',
    apply: heal(0.2),
  },
  {
    id: 'sitrus', name: 'Sitrus Berry', item: 'sitrus-berry',
    desc: 'heal everyone for 35%',
    rarity: 'common',
    apply: heal(0.35),
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
    id: 'protein', name: 'Protein', item: 'protein',
    desc: '+10% hit damage',
    rarity: 'common',
    apply: (b) => { b.physMult *= 1.1; },
  },
  {
    id: 'iron', name: 'Iron', item: 'iron',
    desc: '+15% max HP',
    rarity: 'common',
    apply: (b) => b.players.forEach((p) => { if (!p.dead) p.maxHp = Math.round(p.maxHp * 1.15); }),
  },
  {
    id: 'calcium', name: 'Calcium', item: 'calcium',
    desc: '+10% super damage',
    rarity: 'common',
    apply: (b) => { b.specMult *= 1.1; },
  },
  {
    id: 'carbos', name: 'Carbos', item: 'carbos',
    desc: '+10% launch speed',
    rarity: 'common',
    apply: (b) => { b.launchBoost *= 1.1; },
  },
  {
    id: 'direhit', name: 'Dire Hit', item: 'dire-hit',
    desc: '+5% chance hits crit x2; every 5th shot: +50% crit',
    rarity: 'common',
    apply: (b) => { b.critCh += 0.05; },
    tick: (b) => {
      const st = tSt(b);
      const on = b.shots > 0 && b.shots % 5 === 0; // the surge rides the whole 5th shot
      if (on === (st.direhit === 1)) return;
      st.direhit = on ? 1 : 0;
      b.critCh += on ? 0.5 : -0.5; // hands the borrowed crit back on the next shot
    },
  },
  {
    id: 'razorclaw', name: 'Razor Claw', item: 'razor-claw',
    desc: '+8% chance hits crit x2',
    rarity: 'common',
    apply: (b) => { b.critCh += 0.08; },
  },
  {
    id: 'muscle', name: 'Muscle Band', item: 'muscle-band',
    desc: '+15% all your damage',
    rarity: 'common',
    apply: (b) => { b.dmgMult *= 1.15; },
  },
  {
    id: 'scarf', name: 'Choice Scarf', item: 'choice-scarf',
    desc: '+12% launch speed',
    rarity: 'common',
    apply: (b) => { b.launchBoost *= 1.12; },
  },
  {
    id: 'cband', name: 'Choice Band', item: 'choice-band',
    desc: '+25% hit damage',
    rarity: 'common',
    apply: (b) => { b.physMult *= 1.25; },
  },
  {
    id: 'greatball', name: 'Great Ball', item: 'great-ball',
    desc: '+5% catch chance',
    rarity: 'common',
    apply: (b) => { b.captureChance += 0.05; },
  },
  {
    id: 'duskball', name: 'Dusk Ball', item: 'dusk-ball',
    desc: '+8% catch chance',
    rarity: 'common',
    apply: (b) => { b.captureChance += 0.08; },
  },
  {
    id: 'helmet', name: 'Rocky Helmet', item: 'rocky-helmet',
    desc: 'attackers take 10 recoil',
    rarity: 'common',
    apply: (b) => { b.thorns += 10; },
  },
  {
    id: 'fstone', name: 'Float Stone', item: 'float-stone',
    desc: 'ball slides 35% further',
    rarity: 'common',
    apply: (b) => { b.frictionMult *= 0.65; },
  },

  // --- uncommon: real held items, mid power ---
  {
    id: 'moomoo', name: 'Moomoo Milk', item: 'moomoo-milk',
    desc: 'heal everyone for 70%',
    rarity: 'uncommon',
    apply: heal(0.7),
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
        heal(0.5)(b);
      }
    },
  },
  {
    id: 'claw', name: 'Quick Claw', item: 'quick-claw',
    desc: 'supers recharge sooner',
    rarity: 'uncommon',
    // cdMult only feeds construction — retune the fielded team in place
    apply: (b) => {
      b.cdMult *= 0.66;
      for (const p of b.players) {
        p.cdMax = Math.max(1, Math.round(bumpCooldown(p.def.type) * b.cdMult) - p.cdMod);
        p.cd = Math.min(p.cd, p.cdMax);
      }
    },
  },
  {
    id: 'leftovers', name: 'Leftovers', item: 'leftovers',
    desc: 'team heals 6% after every shot; every 18s: mends 4%',
    rarity: 'uncommon',
    apply: (b) => { b.regen += 0.06; },
    tick: (b, dt) => {
      const st = tSt(b);
      st.leftovers = (st.leftovers || 0) + dt;
      if (st.leftovers < 18) return;
      st.leftovers -= 18;
      heal(0.04)(b);
    },
  },
  {
    id: 'expshare', name: 'Exp. Share', item: 'exp-share',
    desc: 'team heals 8% on every KO; every 60s: weakest ally +1 level',
    rarity: 'uncommon',
    apply: (b) => { b.koHeal += 0.08; },
    tick: (b, dt) => {
      const st = tSt(b);
      st.expshare = (st.expshare || 0) + dt;
      if (st.expshare < 60) return;
      st.expshare -= 60;
      // canon Exp. Share: experience trickles to the mon falling behind
      const weak = b.players.filter((p) => !p.dead).sort((a, z) => a.lvl - z.lvl)[0];
      if (weak) b.gainLevels(weak, 1);
    },
  },
  {
    id: 'ultraball', name: 'Ultra Ball', item: 'ultra-ball',
    desc: '+10% catch chance',
    rarity: 'uncommon',
    apply: (b) => { b.captureChance += 0.1; },
  },
  {
    id: 'friendball', name: 'Friend Ball', item: 'friend-ball',
    desc: '+12% catch chance',
    rarity: 'uncommon',
    apply: (b) => { b.captureChance += 0.12; },
  },
  {
    id: 'heavyball', name: 'Heavy Ball', item: 'heavy-ball',
    desc: '+25% catch chance vs bosses',
    rarity: 'uncommon',
    apply: (b) => { b.bossCatch += 0.25; },
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
    id: 'metro', name: 'Metronome', item: 'metronome',
    desc: '+10% damage per ally hit in a chain',
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
    id: 'bigroot', name: 'Big Root', item: 'big-root',
    desc: 'heal weakest ally 4% of damage',
    rarity: 'uncommon',
    apply: (b) => { b.leech += 0.04; },
  },
  {
    id: 'ebelt', name: 'Expert Belt', item: 'expert-belt',
    desc: '+30% on super-effective hits',
    rarity: 'uncommon',
    apply: (b) => { b.belt += 0.3; },
  },
  {
    id: 'zinc', name: 'Zinc', item: 'zinc',
    desc: 'team takes 15% less damage',
    rarity: 'uncommon',
    apply: (b) => { b.takenMult *= 0.85; },
  },
  {
    id: 'elixir', name: 'Elixir', item: 'elixir',
    desc: 'all supers are ready now',
    rarity: 'uncommon',
    apply: (b) => b.players.forEach((p) => { p.cd = 0; }),
  },
  {
    id: 'bpowder', name: 'Bright Powder', item: 'bright-powder',
    desc: 'enemies attack 20% slower',
    rarity: 'uncommon',
    apply: (b) => { b.foeCdMult *= 1.2; },
  },
  {
    id: 'balloon', name: 'Air Balloon', item: 'air-balloon',
    desc: 'field hazards ignore your ball',
    rarity: 'uncommon',
    apply: (b) => { b.slowImmune = true; },
  },
  {
    id: 'pbracer', name: 'Power Bracer', item: 'power-bracer',
    desc: '+30% damage vs bosses',
    rarity: 'uncommon',
    apply: (b) => { b.bossSlayer += 0.3; },
  },
  {
    id: 'bband', name: 'Binding Band', item: 'muscle-band',
    desc: '+40% hit damage on ricochet hits',
    rarity: 'uncommon',
    apply: (b) => { b.ricoMult += 0.4; },
  },
  {
    id: 'luckyegg', name: 'Lucky Egg', item: 'lucky-egg',
    desc: '+30% score from damage; every 30s: +25 score',
    rarity: 'uncommon',
    apply: (b) => { b.scoreMult += 0.3; },
    tick: (b, dt) => {
      const st = tSt(b);
      st.luckyegg = (st.luckyegg || 0) + dt;
      if (st.luckyegg < 30) return;
      st.luckyegg -= 30;
      b.score += 25;
    },
  },
  {
    id: 'timerball', name: 'Timer Ball', item: 'poke-ball',
    desc: 'every 3rd ally bump: all cooldowns -1',
    rarity: 'uncommon',
    apply: (b) => { b.volleyNth = 3; },
  },
  // type charms — +50% damage for one type; the drafting hook that makes
  // "all-in on water" or "spread coverage" a real build call
  ...(Object.entries({
    normal: ['Silk Scarf', 'silk-scarf'], fire: ['Charcoal', 'charcoal'],
    water: ['Mystic Water', 'mystic-water'], grass: ['Miracle Seed', 'miracle-seed'],
    electric: ['Magnet', 'magnet'], psychic: ['Twisted Spoon', 'twisted-spoon'],
    rock: ['Hard Stone', 'hard-stone'], poison: ['Poison Barb', 'poison-barb'],
    flying: ['Sharp Beak', 'sharp-beak'], fighting: ['Black Belt', 'black-belt'],
    ghost: ['Spell Tag', 'spell-tag'],
  }) as [PokeType, [string, string]][]).map(([ty, [name, item]]): Perk => ({
    id: `type-${ty}`,
    name,
    item,
    desc: `+50% ${ty}-type damage, stacks`,
    rarity: 'uncommon',
    apply: (b) => { b.typePow[ty] = (b.typePow[ty] ?? 1) * 1.5; },
  })),

  // type relics — the same held items as build-around supers: each adds a
  // rider to its type's bumpAlly case, gated on perkIds, so apply is flat
  ...(Object.entries({
    charcoal: ['Charcoal+', 'charcoal', 'FIRE supers burn +1 orb'],
    'mystic-water': ['Mystic Water+', 'mystic-water', 'WATER jet chills foes'],
    magnet: ['Magnet+', 'magnet', 'SPARK hops +2 further'],
    'miracle-seed': ['Miracle Seed+', 'miracle-seed', 'GRASS drain feeds x2'],
    'hard-stone': ['Hard Stone+', 'hard-stone', 'ROCK rubble +2 chunks'],
    'poison-barb': ['Poison Barb+', 'poison-barb', 'VENOM detonates x3'],
    'sharp-beak': ['Sharp Beak+', 'sharp-beak', 'GALE grabs wider'],
    'spell-tag': ['Spell Tag+', 'spell-tag', 'HEX sends +2 wisps'],
    'twisted-spoon': ['Twisted Spoon+', 'twisted-spoon', 'PSI slam reaches 60px'],
    'black-belt': ['Black Belt+', 'black-belt', 'CLOSE COMBAT adds a jab'],
    'silk-scarf': ['Silk Scarf+', 'silk-scarf', 'EXTREMESPEED links 3rd'],
  }) as [string, [string, string, string]][]).map(([id, [name, item, desc]]): Perk => ({
    id, name, item, desc,
    rarity: 'uncommon',
    apply: () => {},
  })),

  // --- rare: strong single effects ---
  {
    id: 'restore', name: 'Max Potion', item: 'max-potion',
    desc: 'heal your team to full',
    rarity: 'rare',
    apply: heal(1),
  },
  {
    id: 'sash', name: 'Focus Sash', item: 'focus-sash',
    desc: 'each ally survives one KO at 1 HP; every 3rd stage: sashes re-arm',
    rarity: 'rare',
    apply: (b) => b.players.forEach((p) => { p.sash = true; }),
    tick: (b) => {
      const st = tSt(b);
      if (st.sash == null) { st.sash = b.waveIndex; return; } // learn the stage it armed on
      if (b.waveIndex - st.sash < 3) return;
      st.sash = b.waveIndex;
      b.players.forEach((p) => { p.sash = true; });
    },
  },
  {
    id: 'pherb', name: 'Power Herb', item: 'power-herb',
    desc: 'all supers recharge 1 sooner',
    rarity: 'rare',
    // cdMod feeds construction too — but the fielded team needs it now
    apply: (b) => b.players.forEach((p) => {
      p.cdMod += 1;
      p.cdMax = Math.max(1, p.cdMax - 1);
      p.cd = Math.min(p.cd, p.cdMax);
    }),
  },
  {
    id: 'eviolite', name: 'Eviolite', item: 'eviolite',
    desc: 'team takes 25% less damage',
    rarity: 'rare',
    apply: (b) => { b.takenMult *= 0.75; },
  },
  {
    id: 'machobrace', name: 'Macho Brace', item: 'macho-brace',
    desc: '+30% damage, -12% launch speed',
    rarity: 'rare',
    apply: (b) => {
      b.dmgMult *= 1.3;
      b.launchBoost *= 0.88;
    },
  },
  {
    id: 'gclaw', name: 'Grip Claw', item: 'grip-claw',
    desc: 'each wall bounce this shot: +15% hit damage',
    rarity: 'rare',
    apply: (b) => { b.wallRamp += 0.15; },
  },
  {
    id: 'ether', name: 'Ether', item: 'elixir',
    desc: "RICOCHET hits charge the launcher's super; every 25s: all supers -1",
    rarity: 'rare',
    apply: (b) => { b.ricoPip += 1; },
    tick: (b, dt) => {
      const st = tSt(b);
      st.ether = (st.ether || 0) + dt;
      if (st.ether < 25) return;
      st.ether -= 25;
      b.players.forEach((p) => { if (!p.dead) p.cd = Math.max(0, p.cd - 1); });
    },
  },
  {
    id: 'soothebell', name: 'Soothe Bell', item: 'shell-bell',
    desc: 'ally bumps add +15% hit damage this shot; every 4s: team mends 2%',
    rarity: 'rare',
    minRank: 1,
    apply: (b) => { b.volleyBoost += 0.15; },
    tick: (b, dt) => {
      const st = tSt(b);
      st.soothe = (st.soothe || 0) + dt;
      if (st.soothe < 4) return;
      st.soothe -= 4;
      heal(0.02)(b); // the bell's calm knits the team — a slow leftovers
    },
  },
  {
    id: 'wpolicy', name: 'Weakness Policy', item: 'weakness-policy',
    desc: '+25% damage, +10% damage taken',
    rarity: 'rare',
    apply: (b) => {
      b.dmgMult *= 1.25;
      b.takenMult *= 1.1;
    },
  },

  // --- legendary: run-defining items ---
  {
    id: 'mball', name: 'Master Ball', item: 'master-ball',
    desc: 'next enemy you KO joins your box',
    rarity: 'legendary',
    apply: (b) => { b.masterArmed = true; },
  },
  {
    id: 'sacredash', name: 'Sacred Ash', item: 'sacred-ash',
    desc: 'revive all fallen allies at 60%',
    rarity: 'legendary',
    apply: (b) => b.players.forEach((p) => {
      if (p.dead) {
        p.dead = false;
        p.hp = Math.round(p.maxHp * 0.6);
      }
    }),
  },
  {
    id: 'souldew', name: 'Soul Dew', item: 'soul-dew',
    desc: '+20% damage & super range',
    rarity: 'legendary',
    apply: (b) => {
      b.dmgMult *= 1.2;
      b.players.forEach((p) => { p.rngMul *= 1.2; });
    },
  },
  {
    id: 'adamant', name: 'Adamant Orb', item: 'adamant-orb',
    desc: '+30% hits & +15% launch',
    rarity: 'legendary',
    apply: (b) => {
      b.physMult *= 1.3;
      b.launchBoost *= 1.15;
    },
  },
  {
    id: 'lustrous', name: 'Lustrous Orb', item: 'lustrous-orb',
    desc: '+30% super & +15% range',
    rarity: 'legendary',
    apply: (b) => {
      b.specMult *= 1.3;
      b.players.forEach((p) => { p.rngMul *= 1.15; });
    },
  },
  {
    id: 'lifeorb', name: 'Life Orb', item: 'life-orb',
    desc: '+30% damage, team -4% HP per shot',
    rarity: 'legendary',
    minRank: 2,
    apply: (b) => {
      b.dmgMult *= 1.3;
      b.lifeDrain += 0.04;
    },
  },
];

// --- periodic triggers -----------------------------------------------------
// The PokéBonk second half: a perk's tick() fires its triggered clause off a
// clock, a stage count or a shot count — never re-applying the flat bonus.
// Per-perk timer state lives in this WeakMap (one number per perk id), so the
// only surface Battle needs is one perkTick(this, dt) in its update loop;
// a battle's state dies with the battle.
const tickState = new WeakMap<Battle, Record<string, number>>();
const tSt = (b: Battle) => {
  let s = tickState.get(b);
  if (!s) tickState.set(b, (s = {}));
  return s;
};

const PERK_TICK = new Map<string, NonNullable<Perk['tick']>>();
for (const p of PERKS) if (p.tick) PERK_TICK.set(p.id, p.tick);

export function perkTick(b: Battle, dt: number) {
  // dedupe: a DUPE grant shares one state key — two entries would double-fire
  for (const id of new Set(b.perkIds)) PERK_TICK.get(id)?.(b, dt);
}

// --- bag items: persistent consumables -----------------------------------
// Banked on gym wins (pk_bag in meta.ts), ≤2 picked at run start, applied
// when the Battle constructs — same apply() shape as perks but no rarity:
// they never appear on the offer boards.
export interface BagItem {
  id: string;
  name: string;
  item: string; // sprite name in public/sprites/items/
  desc: string;
  apply: (b: Battle) => void;
  // durable items bake their effect into already-saved state (levels ride in
  // team[].lvl), so a resume must skip re-applying them or they'd double
  durable?: boolean;
}

export const BAG_ITEMS: BagItem[] = [
  {
    id: 'exp-share', name: 'Exp Share', item: 'exp-share',
    desc: 'team starts 2 levels up',
    apply: (b) => b.players.forEach((p) => b.gainLevels(p, 2)),
    durable: true, // the +2 lives in team[].lvl — re-applying on resume would double it
  },
  {
    id: 'master-ball', name: 'Master Ball', item: 'master-ball',
    desc: 'first catch of the run is guaranteed',
    apply: (b) => { b.masterArmed = true; },
  },
  {
    id: 'friend-ball', name: 'Friend Ball', item: 'friend-ball',
    desc: '+8% catch chance all run',
    apply: (b) => { b.captureChance += 0.08; },
  },
  {
    id: 'macho-brace', name: 'Macho Brace', item: 'macho-brace',
    desc: '+20% score, -8% launch speed',
    apply: (b) => {
      b.scoreMult += 0.2;
      b.launchBoost *= 0.92;
    },
  },
  {
    id: 'scope-lens', name: 'Scope Lens', item: 'scope-lens',
    desc: '15% chance hits crit x2',
    apply: (b) => { b.critCh += 0.15; },
  },
  {
    id: 'sacred-ash', name: 'Sacred Ash', item: 'sacred-ash',
    desc: 'a wipe revives the team at 30% once',
    apply: (b) => { b.ashArmed = true; },
  },
  {
    id: 'quick-claw', name: 'Quick Claw', item: 'quick-claw',
    desc: '+12% launch speed',
    apply: (b) => { b.launchBoost *= 1.12; },
  },
  {
    id: 'dusk-ball', name: 'Dusk Ball', item: 'dusk-ball',
    desc: '+12% catch chance',
    apply: (b) => { b.captureChance += 0.12; },
  },
  {
    id: 'protein', name: 'Protein', item: 'protein',
    desc: '+8% bump damage',
    // dmgMult is hurt()'s single multiplier — covers phys + spec bumps
    apply: (b) => { b.dmgMult *= 1.08; },
  },
  {
    id: 'razor-claw', name: 'Razor Claw', item: 'razor-claw',
    desc: '+10% crit chance',
    apply: (b) => { b.critCh += 0.1; },
  },
];

// Roll a rarity tier, then pick within it — an empty tier trickles down to
// the next lower one (StS-style), so commons stay common but no slot ever
// comes up blank. Legendary 4% / rare 12% / uncommon 34% / common 50%.
// `cap` clamps the worst tier offered — elite stages pay out uncommon+.
const TIERS: Rarity[] = ['legendary', 'rare', 'uncommon', 'common'];
// `types` filters type charms and relics to types the team actually fields —
// a charm or super rider for a type you don't run is a dead offer
const RELIC_TYPE: Record<string, PokeType> = {
  charcoal: 'fire', 'mystic-water': 'water', magnet: 'electric',
  'miracle-seed': 'grass', 'hard-stone': 'rock', 'poison-barb': 'poison',
  'sharp-beak': 'flying', 'spell-tag': 'ghost', 'twisted-spoon': 'psychic',
  'black-belt': 'fighting', 'silk-scarf': 'normal',
};
export function rollPerks(rng: () => number, cap = 3, rank = 0, types?: Set<string>, ban?: Set<string>): Perk[] {
  const pool = PERKS.filter(
    (p) =>
      (p.minRank == null || p.minRank <= rank) &&
      (!p.id.startsWith('type-') || !types || types.has(p.id.slice(5))) &&
      (!(p.id in RELIC_TYPE) || !types || types.has(RELIC_TYPE[p.id])) &&
      !ban?.has(p.id), // banished ids stay out of every board for the rest of the run
  );
  const out: Perk[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const roll = rng();
    let tier = Math.min(roll < 0.04 ? 0 : roll < 0.16 ? 1 : roll < 0.5 ? 2 : 3, cap);
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
