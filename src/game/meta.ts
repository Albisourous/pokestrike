// Run-to-run persistence: the caught-dex, gym-win count (which sets rank),
// and the last losing team saved as the next run's rival "echo".
// localStorage throws in private mode, so every access falls back to
// in-memory values that still work for the session.

const memDex = new Set<number>();
let memGyms = 0;
let memEcho: number[] | null = null;

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
