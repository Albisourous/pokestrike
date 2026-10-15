// Run-to-run persistence: the caught-dex, gym-win count (which sets rank),
// and the last losing team saved as the next run's rival "echo".
// localStorage throws in private mode, so every access falls back to
// in-memory values that still work for the session.

const memDex = new Set<number>();
let memGyms = 0;
let memEcho: number[] | null = null;
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

export function echoIds(): number[] | null {
  return load<number[]>('pk_echo') ?? memEcho;
}

export function saveEcho(ids: number[]) {
  memEcho = ids;
  store('pk_echo', ids);
}

export function clearEcho() {
  memEcho = null;
  try {
    localStorage.removeItem('pk_echo');
  } catch {
    /* nothing to clear */
  }
}

// --- records & daily streak: the "one more run" ledger ---

export interface Best {
  score: number; // highest run score ever
  stage: number; // deepest stage reached (1-based)
  wins: number; // climbs completed
  runs: number; // runs finished
  streak: number; // consecutive days with a finished Daily Climb
  lastDaily: number; // dailySeed int of the streak's last day, 0 = none
}

export function best(): Best {
  return (
    load<Best>('pk_best') ??
    memBest ?? { score: 0, stage: 0, wins: 0, runs: 0, streak: 0, lastDaily: 0 }
  );
}

// Call once when a run ends. `daily` is the day's seed when the run was a
// Daily Climb — a finished daily (win or wipe) keeps the streak alive, and
// the streak only counts each calendar day once.
export function recordRun(score: number, stage: number, won: boolean, daily: number | null) {
  const b = best();
  const newBest = score > b.score;
  b.score = Math.max(b.score, score);
  b.stage = Math.max(b.stage, stage);
  b.runs++;
  if (won) b.wins++;
  if (daily != null && daily !== b.lastDaily) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const ySeed = y.getFullYear() * 10000 + (y.getMonth() + 1) * 100 + y.getDate();
    b.streak = b.lastDaily === ySeed ? b.streak + 1 : 1;
    b.lastDaily = daily;
  }
  memBest = b;
  store('pk_best', b);
  return newBest;
}
