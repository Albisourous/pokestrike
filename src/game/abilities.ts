import type { SpeciesDef, HazardKind } from './data';
import type { PokeType, Weather } from './types';

const CANONICAL_ABILITIES = [
  'adaptability',
  'aftermath',
  'air-lock',
  'anticipation',
  'bad-dreams',
  'battle-armor',
  'big-pecks',
  'blaze',
  'chlorophyll',
  'clear-body',
  'color-change',
  'compound-eyes',
  'cute-charm',
  'damp',
  'defeatist',
  'download',
  'drizzle',
  'drought',
  'early-bird',
  'effect-spore',
  'flame-body',
  'flash-fire',
  'flower-gift',
  'forecast',
  'forewarn',
  'frisk',
  'gluttony',
  'guts',
  'healer',
  'honey-gather',
  'huge-power',
  'hustle',
  'hydration',
  'hyper-cutter',
  'ice-body',
  'illuminate',
  'illusion',
  'immunity',
  'inner-focus',
  'insomnia',
  'intimidate',
  'iron-barbs',
  'iron-fist',
  'justified',
  'keen-eye',
  'leaf-guard',
  'levitate',
  'lightning-rod',
  'limber',
  'liquid-ooze',
  'magma-armor',
  'marvel-scale',
  'minus',
  'mold-breaker',
  'motor-drive',
  'multitype',
  'mummy',
  'natural-cure',
  'oblivious',
  'overcoat',
  'overgrow',
  'own-tempo',
  'pickup',
  'plus',
  'poison-point',
  'prankster',
  'pressure',
  'pure-power',
  'reckless',
  'rivalry',
  'rock-head',
  'rough-skin',
  'run-away',
  'sand-force',
  'sand-rush',
  'sand-stream',
  'sand-veil',
  'serene-grace',
  'shadow-tag',
  'shed-skin',
  'sheer-force',
  'shell-armor',
  'shield-dust',
  'simple',
  'slow-start',
  'snow-cloak',
  'snow-warning',
  'soundproof',
  'speed-boost',
  'static',
  'steadfast',
  'stench',
  'sticky-hold',
  'sturdy',
  'suction-cups',
  'swarm',
  'swift-swim',
  'synchronize',
  'technician',
  'telepathy',
  'teravolt',
  'thick-fat',
  'torrent',
  'trace',
  'truant',
  'turboblaze',
  'unaware',
  'victory-star',
  'vital-spirit',
  'volt-absorb',
  'water-absorb',
  'water-veil',
  'white-smoke',
  'wonder-guard',
  'wonder-skin',
] as const;

export interface AbilityDef {
  name: string;
  hint: string;
  hazards?: readonly HazardKind[];
  wall?: PokeType;
  reflect?: boolean;
}

// Canonical names include the later-generation species already in the dex.
// Only the counters below add mechanics; existing species flags keep their jobs.
const COUNTERS: Record<string, AbilityDef> = {
  levitate: { name: 'LEVITATE', hint: 'MINES · PULL', hazards: ['mine', 'well', 'gravity', 'spikes'] },
  'flash-fire': { name: 'FLASH FIRE', hint: 'FIRE WALL HEALS', wall: 'fire' },
  'water-absorb': { name: 'WATER ABSORB', hint: 'WATER WALL HEALS', wall: 'water' },
  'volt-absorb': { name: 'VOLT ABSORB', hint: 'ELECTRIC WALL HEALS', wall: 'electric' },
  'lightning-rod': { name: 'LIGHTNING ROD', hint: 'ELECTRIC WALL HEALS', wall: 'electric' },
  'own-tempo': { name: 'OWN TEMPO', hint: 'IGNORE WARP', hazards: ['warp'] },
  sturdy: { name: 'STURDY', hint: 'SURVIVE ONCE' },
  'swift-swim': { name: 'SWIFT SWIM', hint: 'RAIN SPEED UP' },
  chlorophyll: { name: 'CHLOROPHYLL', hint: 'SUN SPEED UP' },
  'huge-power': { name: 'HUGE POWER', hint: 'ATK ×2 · BREAK REFLECT', reflect: true },
  'pure-power': { name: 'PURE POWER', hint: 'ATK ×2 · BREAK REFLECT', reflect: true },
  guts: { name: 'GUTS', hint: 'STATUS ATK UP' },
  intimidate: { name: 'INTIMIDATE', hint: 'FOE ATK DOWN' },
  swarm: { name: 'SWARM', hint: 'GRASS/PSYCHIC KILLER' },
  // hint stays '' — smoke pins the hinted set at fourteen. These still
  // announce in battle and feed door/court counter checks.
  damp: { name: 'DAMP', hint: '', hazards: ['mine'] }, // canon snuffs out explosions
  anticipation: { name: 'ANTICIPATION', hint: '', hazards: ['mine'] }, // senses the danger under the pad
  'suction-cups': { name: 'SUCTION CUPS', hint: '', hazards: ['well', 'gust'] }, // too grippy to pull or shove
  'run-away': { name: 'RUN AWAY', hint: '', hazards: ['well', 'grass'] }, // slips traps and tangles
  'white-smoke': { name: 'WHITE SMOKE', hint: '', hazards: ['gravity', 'grass'] }, // reductions slide off the shroud
  'magma-armor': { name: 'MAGMA ARMOR', hint: '', hazards: ['ice'] }, // can't ice over — glides stay dirt
  'water-veil': { name: 'WATER VEIL', hint: '', hazards: ['lava'] }, // a burn that never lands
  'motor-drive': { name: 'MOTOR DRIVE', hint: '', wall: 'electric' }, // canon electric immunity
  'mold-breaker': { name: 'MOLD BREAKER', hint: '', reflect: true }, // the breaker family ignores granted protection
  teravolt: { name: 'TERAVOLT', hint: '', reflect: true },
  turboblaze: { name: 'TURBOBLAZE', hint: '', reflect: true },
  unaware: { name: 'UNAWARE', hint: '', reflect: true }, // reads the mon, not its boost — Reflect included
};

export const ABILITIES: Readonly<Record<string, AbilityDef>> = Object.fromEntries(
  CANONICAL_ABILITIES.map((id) => [id, COUNTERS[id] ?? { name: id.replaceAll('-', ' ').toUpperCase(), hint: '' }]),
);
export function abilityOf(def: Pick<SpeciesDef, 'ability'>): AbilityDef | undefined {
  return ABILITIES[def.ability];
}
export function countersHazard(ability: string, kind: HazardKind): boolean {
  return ABILITIES[ability]?.hazards?.includes(kind) ?? false;
}
export function wallHeal(ability: string, type: PokeType, hp: number, maxHp: number): number | undefined {
  if (ABILITIES[ability]?.wall !== type) return undefined;
  return Math.max(0, Math.min(maxHp - hp, Math.max(1, Math.round(maxHp * 0.04))));
}
export function sturdyDamage(hp: number, damage: number, used: boolean): number {
  return !used && damage >= hp ? hp - 1 : damage;
}
export function weatherSpeed(ability: string, weather: Weather | null): number {
  if ((ability === 'swift-swim' && weather === 'rain') || (ability === 'chlorophyll' && weather === 'sun')
    || (ability === 'sand-rush' && weather === 'sand')) return 1.5;
  // speed boost winds up every turn in canon; the sling reads it as a standing kick
  return ability === 'speed-boost' ? 1.25 : 1;
}
// MS Killer's family check becomes a Bug specialist's Grass/Psychic matchup.
export function killerMult(ability: string, target: Pick<SpeciesDef, 'type' | 'type2'>): number {
  return ability === 'swarm' && [target.type, target.type2].some((t) => t === 'grass' || t === 'psychic') ? 1.5 : 1;
}
// the Gen-3 pinch trio: matching-type moves bite half again under a third of HP
const PINCH = new Set(['blaze', 'torrent', 'overgrow']);
export function attackMult(ability: string, statused: boolean, hpFrac = 1): number {
  if (ability === 'huge-power' || ability === 'pure-power') return 2;
  if (ability === 'guts' && statused) return 1.5;
  if (PINCH.has(ability) && hpFrac <= 1 / 3) return 1.5;
  if (ability === 'defeatist' && hpFrac < 0.5) return 0.5; // canon wilts below half
  return 1;
}

type Gimmick = { kind: HazardKind | 'damage-wall' | 'barrier'; label: string; type: PokeType };
export function countersGimmick(def: SpeciesDef, gimmick: Gimmick): boolean {
  const a = abilityOf(def);
  return !!a && (gimmick.kind === 'damage-wall' ? a.wall === gimmick.type
    : gimmick.kind === 'barrier' ? !!a.reflect : countersHazard(def.ability, gimmick.kind));
}
export function counterHint(gimmick: Gimmick): string {
  const id = Object.keys(COUNTERS).find((ability) => countersGimmick({ ability } as SpeciesDef, gimmick));
  return id ? `${gimmick.label} · ${ABILITIES[id].name} HELPS` : gimmick.label;
}
export function abilityLabel(def: SpeciesDef): string {
  return abilityOf(def)?.name ?? '';
}

interface AbilityUnit {
  uid: number;
  def: SpeciesDef;
  side: 'player' | 'enemy';
  dead: boolean;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  r: number;
  sash: boolean;
  dotTicks: number;
  burnT: number;
  paraT: number;
  asleep?: boolean;
}
interface AbilityBattle { weather?: Weather | null }
type Notice = (text: string, unit: AbilityUnit) => void;
const battles = new WeakMap<AbilityBattle, { seen: Set<string>; sturdy: Set<number>; hits: Map<number, number>; shotN: number }>();
export function resetAbilities(b: AbilityBattle) { battles.delete(b); }
function state(b: AbilityBattle) {
  let s = battles.get(b);
  if (!s) {
    s = { seen: new Set(), sturdy: new Set(), hits: new Map(), shotN: 0 };
    battles.set(b, s);
  }
  return s;
}
function announce(b: AbilityBattle, u: AbilityUnit, notice: Notice) {
  const s = state(b), key = `${u.uid}:${u.def.ability}`;
  if (s.seen.has(key)) return;
  s.seen.add(key);
  notice(abilityLabel(u.def), u);
}
export function abilityHazard(b: AbilityBattle, u: AbilityUnit, kind: HazardKind, notice: Notice): boolean {
  if (u.side !== 'player' || !countersHazard(u.def.ability, kind)) return false;
  announce(b, u, notice);
  return true;
}
// field gimmicks outside HazardKind (gimmicks2.ts) reuse the once-per-battle callout
export function abilityNotice(b: AbilityBattle, u: AbilityUnit, notice: Notice) {
  announce(b, u, notice);
}
export function abilityWall(b: AbilityBattle, u: AbilityUnit, type: PokeType, notice: Notice): boolean {
  const heal = wallHeal(u.def.ability, type, u.hp, u.maxHp);
  if (heal === undefined) return false;
  u.hp += heal;
  announce(b, u, notice);
  return true;
}
export function abilitySturdy(b: AbilityBattle, u: AbilityUnit, damage: number, notice: Notice): number {
  if (u.def.ability === 'sturdy') {
    const s = state(b), reduced = sturdyDamage(u.hp, damage, s.sturdy.has(u.uid));
    if (reduced !== damage) {
      s.sturdy.add(u.uid);
      u.sash = false; // the legacy Sturdy sash must not grant a second survival
      announce(b, u, notice);
    }
    return reduced;
  }
  // soak family: marvel scale hardens while statused, sand veil only whiffs in its own sky
  const ailment = u.dotTicks > 0 || u.burnT > 0 || u.paraT > 0 || !!u.asleep;
  const soak = u.def.ability === 'marvel-scale' && ailment ? 0.67
    : u.def.ability === 'sand-veil' && b.weather === 'sand' ? 0.8 : 1;
  if (soak === 1) return damage;
  announce(b, u, notice);
  return Math.max(1, Math.round(damage * soak));
}
export function abilityReflect(b: AbilityBattle, source: AbilityUnit, target: { shieldN: number }, notice: Notice) {
  if (target.shieldN < 2 || !abilityOf(source.def)?.reflect) return;
  target.shieldN--; // the normal hit consumes the other layer, still blocking this hit
  announce(b, source, notice);
}
export function abilityAttack(b: AbilityBattle, u: AbilityUnit, target: SpeciesDef, notice: Notice): number {
  const statused = u.dotTicks > 0 || u.burnT > 0 || u.paraT > 0;
  const s = state(b), n = s.hits.get(u.uid) ?? 0;
  s.hits.set(u.uid, n + 1);
  const attack = attackMult(u.def.ability, statused, u.hp / u.maxHp), killer = killerMult(u.def.ability, target);
  // swing tax/bonus riding the hit counter: slow start pays five half-strength
  // rounds, truant loafs every other swing, download's first contact hits hot
  const swing = u.def.ability === 'slow-start' && n < 5 ? 0.5
    : u.def.ability === 'truant' && n % 2 === 1 ? 0.3
    : u.def.ability === 'download' && n === 0 ? 1.5 : 1;
  if (attack > 1 || killer > 1 || swing !== 1) announce(b, u, notice);
  const legacy = (u.def.huge && attack === 2) || (u.def.guts && u.def.ability === 'guts');
  return (legacy ? 1 : attack) * killer * swing;
}
// Ailment immunities wake at the sling: the ailment lands but the carrier
// shakes it off on its next launch — the same fields Battle.cleanse wipes.
// Sleep and confuse are out of reach here: a sleeper loses the turn before it
// can launch, and the confuse veer is spent before this hook runs.
const ailment = (u: AbilityUnit) => u.dotTicks > 0 || u.burnT > 0 || u.paraT > 0;
const washOff = (u: AbilityUnit) => { u.dotTicks = 0; u.burnT = 0; u.paraT = 0; };
function launchCleanse(u: AbilityUnit, weather: Weather | null, shotN: number): boolean {
  const a = u.def.ability;
  const single = a === 'limber' ? 'paraT' : a === 'immunity' ? 'dotTicks' : a === 'water-veil' ? 'burnT' : undefined;
  if (single) {
    if (u[single] <= 0) return false;
    u[single] = 0;
    return true;
  }
  // shed skin's 30% roll reads here as a deterministic every-third-shot slough
  const all = a === 'natural-cure' || (a === 'hydration' && weather === 'rain') || (a === 'leaf-guard' && weather === 'sun')
    || (a === 'shed-skin' && shotN % 3 === 0);
  if (!all || !ailment(u)) return false;
  washOff(u);
  return true;
}
export function abilitySpeed(b: AbilityBattle, u: AbilityUnit, weather: Weather | null, notice: Notice): number {
  const s = state(b);
  const mult = weatherSpeed(u.def.ability, weather);
  if (mult > 1 || launchCleanse(u, weather, ++s.shotN)) announce(b, u, notice);
  return mult;
}
export function abilityIntimidate(b: AbilityBattle, team: AbilityUnit[], notice: Notice): number {
  const carrier = team.find((p) => !p.dead && p.def.ability === 'intimidate');
  if (!carrier) return 1;
  announce(b, carrier, notice);
  return team.some((p) => !p.dead && p.def.menace) ? 1 : 0.8;
}
