import { speciesById } from './data';

// Run-to-run persistence: the caught-dex, gym-win count (which sets rank),
// and the last losing team saved as the next run's rival "echo".
// localStorage throws in private mode, so every access falls back to
// in-memory values that still work for the session.

const memDex = new Set<number>();
const memShiny = new Set<number>();
const memAch = new Set<string>();
let memGyms = 0;
let memEcho: { id: number; lvl: number }[] | null = null;
let memBest: Best | null = null;
let memCoach = false;

const load = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw) as T;
  } catch {
    /* private mode or a corrupt value — memory copy covers it */
  }
  return null;
};

const store = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* memory copy still covers the session */
  }
};

export function dexIds(): number[] {
  const raw = load<unknown>('pk_dex');
  // a corrupt save is a bad title screen, not a crash — shape-check reads
  return Array.isArray(raw) ? raw.filter((x): x is number => Number.isFinite(x)) : [...memDex];
}

export function recordCapture(ids: number[]) {
  for (const id of ids) memDex.add(id);
  store('pk_dex', [...new Set([...dexIds(), ...ids])]);
}

// shiny catches get their own ledger — the dex shows them with a gold star
export function shinyIds(): number[] {
  const raw = load<unknown>('pk_dex_shiny');
  return Array.isArray(raw) ? raw.filter((x): x is number => Number.isFinite(x)) : [...memShiny];
}

export function recordShiny(id: number) {
  memShiny.add(id);
  store('pk_dex_shiny', [...new Set([...shinyIds(), id])]);
}

// Shiny Charm — the dex-completion milestone. Fill 100 entries and every
// shiny roll (wild spawns, draft cards) doubles forever after.
export const SHINY_CHARM_AT = 100;
export const shinyCharm = () => dexIds().length >= SHINY_CHARM_AT;

// First-run coaching: set once the first wave clears — quit mid-run and the
// ghost pull comes back next launch.
export const coachDone = () => load<boolean>('pk_coach') ?? memCoach;
export function markCoached() {
  memCoach = true;
  store('pk_coach', true);
}

const gyms = () => {
  const g = load<unknown>('pk_gyms');
  return typeof g === 'number' && Number.isFinite(g) ? g : memGyms;
};

export function recordGymWin() {
  memGyms = gyms() + 1;
  store('pk_gyms', memGyms);
}

export function rank(): number {
  const g = gyms();
  return g < 3 ? 0 : g < 9 ? 1 : 2;
}

export function rankName(r = rank()): string {
  return ['ROOKIE', 'ACE', 'CHAMPION'][r] ?? 'ROOKIE';
}

// --- ranked ladder: a persistent rating that rises on deep runs and ---
// --- falls on early wipes, laddered into ball-tier leagues -------------

let memRating = 0;

export function rating(): number {
  const r = load<unknown>('pk_rating');
  return typeof r === 'number' && Number.isFinite(r) ? r : memRating;
}

export const LADDER: { at: number; name: string; color: string }[] = [
  { at: 0, name: 'POKé BALL', color: '#f05038' },
  { at: 120, name: 'GREAT BALL', color: '#5a9cf8' },
  { at: 280, name: 'ULTRA BALL', color: '#f8d030' },
  { at: 500, name: 'MASTER BALL', color: '#a040f0' },
  { at: 800, name: 'CHAMPION', color: '#ffd84d' },
];

export function tier(r = rating()) {
  let i = 0;
  while (i + 1 < LADDER.length && r >= LADDER[i + 1].at) i++;
  const cur = LADDER[i];
  const next = LADDER[i + 1];
  // progress through the current tier's band; maxed tiers sit at 1
  const prog = next ? Math.min(1, (r - cur.at) / (next.at - cur.at)) : 1;
  return { i, name: cur.name, color: cur.color, prog, next };
}

// Called once per finished run. Depth is the ladder's currency: every stage
// pays, a clear pays double, and only a run that dies before stage 4 bleeds
// points — losing deep is still a climb.
export function applyRunRating(stage: number, won: boolean, asc: number) {
  const before = rating();
  const delta = Math.round(stage * 4 + (won ? 30 + asc * 5 : 0) - (won ? 0 : Math.max(0, 16 - stage * 3)));
  const after = Math.max(0, before + delta);
  memRating = after;
  store('pk_rating', after);
  const t0 = tier(before), t1 = tier(after);
  return { delta: after - before, before, after, promoted: t1.i > t0.i, demoted: t1.i < t0.i, tier: t1 };
}

// --- hall of fame: the local leaderboard — your top climbs by score ------
// no backend here; the board remembers this device, which is the arcade
// answer anyway

export interface BoardEntry {
  s: number; // final score
  st: number; // stage reached, 1-9
  w: boolean; // cleared the whole climb
  asc: number; // ascension the run was played at
  team: number[]; // final lineup, dex ids — the sprites on the plaque
  when: number; // epoch ms
}
export const BOARD_MAX = 8;
let memBoard: BoardEntry[] = [];

export function board(): BoardEntry[] {
  const raw = load<unknown>('pk_board');
  const list = Array.isArray(raw) ? raw : memBoard;
  return list.filter(
    (e): e is BoardEntry =>
      !!e && typeof e.s === 'number' && Array.isArray(e.team) && typeof e.st === 'number',
  );
}

// Returns the entry's 0-based slot on the board, or -1 when it missed.
export function recordBoard(e: BoardEntry): number {
  const list = board();
  list.push(e);
  list.sort((a, b) => b.s - a.s);
  const i = list.indexOf(e);
  list.splice(BOARD_MAX);
  memBoard = list;
  store('pk_board', list);
  return i < BOARD_MAX ? i : -1;
}

// The echo stores species + earned level — a fallen team comes back at
// the strength it died with. Old saves held bare ids; read those as Lv1.
export function echoIds(): { id: number; lvl: number }[] | null {
  const raw = load<unknown>('pk_echo');
  const arr = Array.isArray(raw) ? raw : memEcho;
  return (
    arr
      ?.map((e) => (typeof e === 'number' ? { id: e, lvl: 1 } : e))
      .filter((e): e is { id: number; lvl: number } => !!e && Number.isFinite(e.id) && Number.isFinite(e.lvl)) ?? null
  );
}

export function saveEcho(mons: { id: number; lvl: number }[]) {
  memEcho = mons;
  store('pk_echo', mons);
}

export function clearEcho() {
  memEcho = null;
  try {
    localStorage.removeItem('pk_echo');
  } catch {
    /* nothing to clear */
  }
}

// --- records: the "one more run" ledger ---

export interface Best {
  score: number; // highest run score ever
  stage: number; // deepest stage reached (1-based)
  wins: number; // climbs completed
  runs: number; // runs finished
}

export function best(): Best {
  const b = memBest ?? { score: 0, stage: 0, wins: 0, runs: 0 };
  const raw = load<Partial<Best>>('pk_best');
  // merge over defaults field by field — a malformed save can't NaN the run
  if (raw && typeof raw === 'object')
    for (const k of ['score', 'stage', 'wins', 'runs'] as const) {
      const v = raw[k];
      if (typeof v === 'number' && Number.isFinite(v)) b[k] = v;
    }
  return b;
}

// Call once when a run ends.
export function recordRun(score: number, stage: number, won: boolean) {
  const b = best();
  const newBest = score > b.score;
  b.score = Math.max(b.score, score);
  b.stage = Math.max(b.stage, stage);
  b.runs++;
  if (won) b.wins++;
  memBest = b;
  store('pk_best', b);
  return newBest;
}

// --- the badge case: one canon badge per gym leader ----------------------
// Each badge is themed to its leader's typing; together they're the climb's
// real trophy — a full case means LEAGUE CHAMPION. Declared above the
// achievements so each leader can seed its own trophy.

export interface GymBadge {
  boss: number; // species id of the leader who pays it out
  name: string;
  color: string;
  icon: number; // sprites/badges/<n>.png — PokeAPI canon league order
}

export const BADGES: GymBadge[] = [
  { boss: 130, name: 'CASCADE BADGE', color: '#6890f0', icon: 2 }, // Gyarados
  { boss: 125, name: 'THUNDER BADGE', color: '#f8d030', icon: 3 }, // Electabuzz
  { boss: 3, name: 'RAINBOW BADGE', color: '#78c850', icon: 4 }, // Venusaur
  { boss: 94, name: 'FOG BADGE', color: '#705898', icon: 12 }, // Gengar — Ecruteak's ghost badge
  { boss: 150, name: 'MARSH BADGE', color: '#f85888', icon: 6 }, // Mewtwo
  { boss: 6, name: 'VOLCANO BADGE', color: '#f08030', icon: 7 }, // Charizard
  { boss: 112, name: 'EARTH BADGE', color: '#b8a038', icon: 8 }, // Rhydon
  { boss: 149, name: 'ZEPHYR BADGE', color: '#a890f0', icon: 9 }, // Dragonite
  { boss: 289, name: 'BALANCE BADGE', color: '#a8a878', icon: 21 }, // Slaking (Norman's ace)
  { boss: 110, name: 'SOUL BADGE', color: '#a040a0', icon: 5 }, // Weezing — Fuchsia's poison badge, Koga's own ace
  { boss: 297, name: 'KNUCKLE BADGE', color: '#c03028', icon: 18 }, // Hariyama (Brawly's ace)
];

export const badgeOf = (bossId: number) => BADGES.find((b) => b.boss === bossId);

// --- achievements: the StS-style trophy shelf ---
// Unlocks are permanent and idempotent: unlockAch returns true once, ever.

export interface Achievement {
  id: string;
  name: string;
  desc: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-clear', name: 'HALL OF FAME', desc: 'Finish a full climb' },
  { id: 'ascended', name: 'ASCENDED', desc: 'Win a climb on Ascension I or higher' },
  { id: 'triple', name: 'TRIPLE CROWN', desc: 'Win 3 climbs (+1 draft reroll)' },
  { id: 'badge', name: 'GYM BREAKER', desc: 'Beat a gym leader' },
  { id: 'league', name: 'LEAGUE CHAMPION', desc: 'Collect every gym badge' },
  { id: 'rival', name: 'GRUDGE SETTLED', desc: 'Defeat your rival echo' },
  { id: 'shiny', name: 'SHINING', desc: 'Catch a shiny' },
  { id: 'myth', name: 'MYTH TAMER', desc: 'Catch a legendary invader' },
  { id: 'perfect', name: 'DEAD CENTER', desc: 'Land a PERFECT release' },
  { id: 'pinball', name: 'PINBALL WIZARD', desc: 'Chain 8+ hits in a single shot' },
  { id: 'ult', name: 'FULL POWER', desc: 'Unleash a charged ultimate' },
  { id: 'collector', name: 'COLLECTOR', desc: 'Fill 50 dex entries' },
  { id: 'living', name: 'LIVING DEX', desc: 'Catch every species' },
  { id: 'rampage', name: 'RAMPAGE', desc: 'Score 40+ KOs in one run' },
  // one trophy per leader — generated off the badge case so they stay in sync
  ...BADGES.map((b) => {
    const d = speciesById(b.boss);
    return { id: `gym-${b.boss}`, name: b.name, desc: `Defeat Gym Leader ${d?.name ?? '???'}, the ${d?.type ?? ''} specialist` };
  }),
];

export function unlockedAch(): Set<string> {
  const raw = load<unknown>('pk_ach');
  return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [...memAch]);
}

// Returns true the first time an id unlocks — callers show the toast.
export function unlockAch(id: string): boolean {
  if (memAch.has(id) || unlockedAch().has(id)) return false;
  memAch.add(id);
  store('pk_ach', [...unlockedAch(), id]);
  return true;
}

let memBadges = new Set<number>();

export function gymBadges(): Set<number> {
  const raw = load<unknown>('pk_badges');
  return new Set(Array.isArray(raw) ? raw.filter((x): x is number => Number.isFinite(x)) : [...memBadges]);
}

// The first KO of a leader banks the badge and returns it; repeats return
// null so the celebration only fires once per badge.
export function earnBadge(bossId: number): GymBadge | null {
  const b = badgeOf(bossId);
  if (!b || gymBadges().has(bossId)) return null;
  memBadges.add(bossId);
  store('pk_badges', [...gymBadges()]);
  return b;
}
