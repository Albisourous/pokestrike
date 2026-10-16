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
  return load<number[]>('pk_dex') ?? [...memDex];
}

export function recordCapture(ids: number[]) {
  for (const id of ids) memDex.add(id);
  store('pk_dex', [...new Set([...dexIds(), ...ids])]);
}

// shiny catches get their own ledger — the dex shows them with a gold star
export function shinyIds(): number[] {
  return load<number[]>('pk_dex_shiny') ?? [...memShiny];
}

export function recordShiny(id: number) {
  memShiny.add(id);
  store('pk_dex_shiny', [...new Set([...shinyIds(), id])]);
}

// Shiny Charm — the dex-completion milestone. Fill 100 entries and every
// shiny roll (wild spawns, draft cards) doubles forever after.
export const SHINY_CHARM_AT = 100;
export const shinyCharm = () => dexIds().length >= SHINY_CHARM_AT;

const gyms = () => load<number>('pk_gyms') ?? memGyms;

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

// The echo stores species + earned level — a fallen team comes back at
// the strength it died with. Old saves held bare ids; read those as Lv1.
export function echoIds(): { id: number; lvl: number }[] | null {
  const raw = load<(number | { id: number; lvl: number })[]>('pk_echo') ?? memEcho;
  return raw?.map((e) => (typeof e === 'number' ? { id: e, lvl: 1 } : e)) ?? null;
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
  return (
    load<Best>('pk_best') ??
    memBest ?? { score: 0, stage: 0, wins: 0, runs: 0 }
  );
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
  { id: 'triple', name: 'TRIPLE CROWN', desc: 'Win 3 climbs' },
  { id: 'badge', name: 'GYM BREAKER', desc: 'Beat a gym leader' },
  { id: 'rival', name: 'GRUDGE SETTLED', desc: 'Defeat your rival echo' },
  { id: 'shiny', name: 'SHINING', desc: 'Catch a shiny' },
  { id: 'myth', name: 'MYTH TAMER', desc: 'Catch a legendary invader' },
  { id: 'perfect', name: 'DEAD CENTER', desc: 'Land a PERFECT release' },
  { id: 'pinball', name: 'PINBALL WIZARD', desc: 'Chain 8+ hits in a single shot' },
  { id: 'collector', name: 'COLLECTOR', desc: 'Fill 50 dex entries' },
  { id: 'living', name: 'LIVING DEX', desc: 'Catch every species' },
  { id: 'rampage', name: 'RAMPAGE', desc: 'Score 40+ KOs in one run' },
];

export function unlockedAch(): Set<string> {
  return new Set(load<string[]>('pk_ach') ?? [...memAch]);
}

// Returns true the first time an id unlocks — callers show the toast.
export function unlockAch(id: string): boolean {
  if (memAch.has(id) || unlockedAch().has(id)) return false;
  memAch.add(id);
  store('pk_ach', [...unlockedAch(), id]);
  return true;
}
