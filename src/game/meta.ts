import { speciesById, TOTAL_STAGES } from './data';

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

// --- the bag: persistent consumables — banked on gym wins, ≤2 spent at ---
// --- run start. Plain pk_bag stock {itemId: count}, unversioned ---------
// (like pk_settings, not the run save).
let memBag: Record<string, number> | null = null;
// First launch gets a starter kit — it stays virtual (readers never write)
// until the first bank/spend lands it in storage.
const BAG_SEED: Record<string, number> = { 'exp-share': 1, 'friend-ball': 1 };

export function bagStock(): Record<string, number> {
  const raw = load<unknown>('pk_bag');
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const stock: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) stock[k] = Math.floor(v);
    }
    return stock;
  }
  // pk_bag never written (null, not {}) — the starter kit, or the session
  // copy once a bank/spend has touched it in private mode
  return { ...(memBag ?? BAG_SEED) };
}

export function bankBag(id: string): void {
  const s = bagStock();
  s[id] = (s[id] ?? 0) + 1;
  memBag = s;
  store('pk_bag', s);
}

// The run-start picks leave together — decrement each, clamp at 0, one write.
export function spendBag(ids: string[]): void {
  const s = bagStock();
  for (const id of ids) s[id] = Math.max(0, (s[id] ?? 0) - 1);
  memBag = s;
  store('pk_bag', s);
}

// --- save versioning: migrate once at boot so readers stay dumb ------------
// pk_ver stamps the save schema — bump SAVE_VER and add a step whenever a
// pk_* shape changes, instead of coercing old data on every read.
// v2: RunSave gains tools/perkBan — reader defaults cover v1 saves,
// no data transform needed below
// v3: RunSave gains eggIn/eggJustLaid — parked runs get defaults below
const SAVE_VER = 3;

export function migrateSaves() {
  const v = load<number>('pk_ver') ?? 0;
  // pk_ver is the once-only gate — this runs at boot, before play can
  // populate the memory copies, so an absent pk_board means "no board"
  if (v < 1 && load<unknown>('pk_board') == null) {
    // v1: the board shipped after pk_best existed — seed a returning
    // player's best as the bar to beat (team and date weren't logged then)
    const b = best();
    if (b.score > 0) {
      memBoard = [{ s: b.score, st: b.stage, w: false, asc: 0, team: [], when: Date.now() }];
      store('pk_board', memBoard);
    }
  }
  if (v < 3) {
    // v3: the mid-run save gained the egg timer — fill defaults on a parked
    // climb so the stored blob matches the shape new saves write
    const s = load<RunSave>('pk_run');
    if (s && s.eggIn == null) {
      s.eggIn = 0;
      s.eggJustLaid = false;
      store('pk_run', s);
    }
  }
  if (v !== SAVE_VER) store('pk_ver', SAVE_VER);
}

// --- decision telemetry ------------------------------------------------------
// MegaCrit balanced StS off pick rates and where runs die, logged per
// decision — no backend here, so pk_stats keeps the same data on-device
// (__dbg.stats() dumps it under ?dev). Deaths key by stage, never global:
// a late-run pool is already filtered for strength (their survivorship-
// bias lesson), so "died on 5" means something "died" alone can't.
interface Stats {
  draft: Record<string, [number, number]>; // species id -> [taken, offered]
  perks: Record<string, [number, number]>; // perk id -> [taken, offered]
  perkban: Record<string, [number, number]>; // perk id -> [banished, offered] — kept apart so perk pick rates stay clean
  deaths: Record<string, number>; // stage -> runs that ended there
  wins: number;
  runs: number;
}
let memStats: Stats = { draft: {}, perks: {}, perkban: {}, deaths: {}, wins: 0, runs: 0 };

const stats = (): Stats => {
  const raw = load<Stats>('pk_stats');
  return raw && typeof raw === 'object' && raw.draft ? raw : memStats;
};

// one call per offer board shown — taken=null when the player skips it
export function statOffer(kind: 'draft' | 'perks' | 'perkban', offered: (string | number)[], taken: string | number | null) {
  const s = stats();
  s.perkban ??= {}; // stored v1 blobs predate the banish ledger — don't crash on the missing key
  for (const id of offered) {
    const e = (s[kind][id] ??= [0, 0]);
    e[1]++;
    if (id === taken) e[0]++;
  }
  memStats = s;
  store('pk_stats', s);
}

// --- mid-run save: one climb can pause between stops and come back ---

export interface RunSave {
  seed: number;
  daily: boolean;
  asc: number;
  mapSeed: number;
  mapNode: number;
  waveIndex: number;
  depth: number;
  pendingNext: number;
  mapNote: string;
  eggIn?: number; // ?-pool egg: stops until it hatches (v3+)
  eggJustLaid?: boolean; // the laying arrival doesn't consume a tick
  team: { id: number; lvl: number; shiny?: boolean; hp: number }[];
  box: { id: number; lvl?: number; shiny?: boolean; luck?: number }[];
  boxHp: number[];
  boxLvl: number[];
  perks: string[]; // perk ids — re-applied on resume
  heldItems: string[];
  tools: { roll: number; ban: number }; // offer-tool charges left this run
  perkBan: string[]; // perk ids banished this run — stay out of every board
  bag?: string[]; // bag item ids replayed on resume (durable ones filtered out)
  masterArmed?: boolean; // armed one-shot flags save verbatim — a spent ball stays spent
  ashArmed?: boolean;
  score: number;
  perksTaken: number;
  gymsBeaten: number;
  shiniesCaught: number;
  maxCombo: number;
  maxKos: number;
  totalKos: number;
  caughtBoss: boolean;
  coachDone: boolean;
  echoCleared: boolean;
  savedAt: number;
}

let memRun: RunSave | null = null;

export function saveRun(s: RunSave) {
  memRun = s;
  store('pk_run', s);
}

export function runSave(): RunSave | null {
  const s = load<RunSave>('pk_run') ?? memRun;
  // shape-check: a stale/corrupt run save is a missing CONTINUE, not a crash.
  // applySnapshot spreads/maps every array verbatim and refills rolled waves
  // up to max(pendingNext, waveIndex), so thin blobs — or a huge row counter
  // that would loop for minutes — must read as "no save" here.
  const row = (v: number) => Number.isInteger(v) && v >= 0 && v <= TOTAL_STAGES;
  const ok =
    !!s &&
    (
      [
        'seed',
        'mapSeed',
        'asc',
        'depth',
        'score',
        'perksTaken',
        'gymsBeaten',
        'shiniesCaught',
        'maxCombo',
        'maxKos',
        'totalKos',
        'savedAt',
      ] as const
    ).every((k) => Number.isFinite(s[k])) &&
    Number.isInteger(s.mapNode) &&
    s.mapNode >= 0 && // index into region.nodes — applySnapshot clamps the top
    row(s.waveIndex) &&
    row(s.pendingNext) &&
    Array.isArray(s.team) &&
    s.team.length > 0 &&
    s.team.every((e) => !!e && Number.isFinite(e.id) && Number.isFinite(e.hp)) &&
    Array.isArray(s.box) &&
    s.box.every((e) => !!e && Number.isFinite(e.id)) &&
    Array.isArray(s.boxHp) &&
    Array.isArray(s.boxLvl) &&
    Array.isArray(s.perks) &&
    Array.isArray(s.heldItems) &&
    (s.bag == null || Array.isArray(s.bag)) &&
    (s.perkBan == null || Array.isArray(s.perkBan)) &&
    (s.tools == null || typeof s.tools === 'object') &&
    (s.eggIn == null || Number.isFinite(s.eggIn));
  return ok ? s : null;
}

export function clearRun() {
  memRun = null;
  try {
    localStorage.removeItem('pk_run');
  } catch {
    /* nothing to clear */
  }
}

export function statRunEnd(stage: number, won: boolean) {
  const s = stats();
  s.runs++;
  if (won) s.wins++;
  else s.deaths[stage] = (s.deaths[stage] ?? 0) + 1;
  memStats = s;
  store('pk_stats', s);
}

export const statsDump = () => stats();

// --- settings: the options screen's store — volume trims + feel toggles ----
// Plain pk_settings blob, unversioned (not part of the run save): defaults
// merge field-by-field over whatever's stored, so old/partial/garbage blobs
// can't NaN the mix — same read pattern as best().

export interface Settings {
  master: number; // every sound, 0..1
  music: number; // sequencer bus, 0..1
  sfx: number; // synth one-shots, 0..1
  cries: number; // species .ogg cries, 0..1
  haptics: boolean; // vibration
  shake: number; // screen shake intensity, 0..1 (v1 stored a bool: true→1, false→0)
  flash: boolean; // full-screen flash frames
  quality: 'high' | 'medium' | 'low'; // particle density trim
  battery: boolean; // render every other rAF
  fps: boolean; // fps counter overlay
  pickupFx: 'complete' | 'simple'; // pickup ring+glow vs bare icon+label
}

const SETTING_DEFAULTS: Settings = {
  master: 0.8,
  music: 0.5,
  sfx: 0.7,
  cries: 0.6,
  haptics: true,
  shake: 1,
  flash: true,
  quality: 'high',
  battery: false,
  fps: false,
  pickupFx: 'complete',
};
let memSettings: Settings = { ...SETTING_DEFAULTS };

// settings() runs per-frame (the loop's battery check) — JSON.parse every
// call would be the hot spot, so the parsed blob caches by raw string and
// only re-parses when the stored text changes; setSetting invalidates.
let settingsRaw: string | null | undefined; // undefined = not read yet
let settingsParsed: Partial<Settings> | null = null;

const settingsBlob = (): Partial<Settings> | null => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem('pk_settings');
  } catch {
    /* private mode — memory copy covers it */
  }
  if (raw !== settingsRaw) {
    settingsRaw = raw;
    settingsParsed = null;
    if (raw != null) {
      try {
        settingsParsed = JSON.parse(raw) as Partial<Settings>;
      } catch {
        /* corrupt blob — defaults cover it */
      }
    }
  }
  return settingsParsed;
};

export function settings(): Settings {
  const s = { ...memSettings };
  const raw = settingsBlob();
  if (raw && typeof raw === 'object') {
    for (const k of ['master', 'music', 'sfx', 'cries'] as const) {
      const v = raw[k];
      if (typeof v === 'number' && Number.isFinite(v)) s[k] = Math.min(1, Math.max(0, v));
    }
    for (const k of ['haptics', 'flash', 'battery', 'fps'] as const) {
      const v = raw[k];
      if (typeof v === 'boolean') s[k] = v;
    }
    // shake moved bool→number: a stored v1 toggle migrates true→1, false→0
    const sh = raw.shake;
    if (typeof sh === 'boolean') s.shake = sh ? 1 : 0;
    else if (typeof sh === 'number' && Number.isFinite(sh)) s.shake = Math.min(1, Math.max(0, sh));
    // enums merge only on a member of the allowed set
    if (raw.quality === 'high' || raw.quality === 'medium' || raw.quality === 'low') s.quality = raw.quality;
    if (raw.pickupFx === 'complete' || raw.pickupFx === 'simple') s.pickupFx = raw.pickupFx;
  }
  return s;
}

export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void {
  const s = settings();
  s[k] = v;
  memSettings = s;
  store('pk_settings', s);
  settingsRaw = undefined; // force the next read to re-parse the fresh blob
}

// --- daily/weekly tasks: rotating seeded chores that pay bag items ---------
// One pk_tasks blob carries both periods: the key each board was rolled
// under, progress by kind, the selected ids and the claimed ones. tasks.ts
// resolves the board — a stale key means a new day/week and a fresh seeded
// roll. Plain unversioned blob like pk_bag/pk_settings; memTasks covers
// private mode, and readers merge field-by-field so a partial blob can't
// wedge a period.

export interface TaskState {
  day: string; // UTC YYYY-MM-DD the daily board belongs to
  dp: Record<string, number>; // daily progress by kind
  dsel: string[]; // selected daily task ids
  dclaim: string[]; // claimed daily task ids
  week: string; // ISO YYYY-Wnn the weekly board belongs to
  wp: Record<string, number>;
  wsel: string[];
  wclaim: string[];
}

const TASK_DEFAULTS: TaskState = { day: '', dp: {}, dsel: [], dclaim: [], week: '', wp: {}, wsel: [], wclaim: [] };
let memTasks: TaskState = { ...TASK_DEFAULTS };

const numMap = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object')
    for (const [k, n] of Object.entries(v as Record<string, unknown>))
      if (typeof n === 'number' && Number.isFinite(n)) out[k] = n;
  return out;
};

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function taskState(): TaskState {
  // merge over the session copy (defaults on first boot) — same pattern as
  // best(): corrupt fields fall back, absent fields keep the memory copy
  const s: TaskState = {
    day: memTasks.day, dp: { ...memTasks.dp }, dsel: [...memTasks.dsel], dclaim: [...memTasks.dclaim],
    week: memTasks.week, wp: { ...memTasks.wp }, wsel: [...memTasks.wsel], wclaim: [...memTasks.wclaim],
  };
  const raw = load<Partial<TaskState>>('pk_tasks');
  if (raw && typeof raw === 'object') {
    if (typeof raw.day === 'string') s.day = raw.day;
    if (raw.dp != null) s.dp = numMap(raw.dp);
    if (raw.dsel != null) s.dsel = strList(raw.dsel);
    if (raw.dclaim != null) s.dclaim = strList(raw.dclaim);
    if (typeof raw.week === 'string') s.week = raw.week;
    if (raw.wp != null) s.wp = numMap(raw.wp);
    if (raw.wsel != null) s.wsel = strList(raw.wsel);
    if (raw.wclaim != null) s.wclaim = strList(raw.wclaim);
  }
  return s;
}

export function saveTaskState(s: TaskState): void {
  memTasks = s;
  store('pk_tasks', s);
}

// --- streaks: the retention counters behind the STREAK badge -----------------
// One plain unversioned pk_streak blob (like pk_bag/pk_tasks): lastDaily is
// the UTC day the chain last counted, daily is consecutive days with ≥1
// daily run finished, wins is consecutive wins across finished runs in any
// mode. memStreak covers private mode; the reader merges field-by-field so
// a partial blob can't wedge a counter.

export interface Streak {
  lastDaily: string; // UTC YYYY-MM-DD
  daily: number;
  wins: number;
}

const STREAK_DEFAULTS: Streak = { lastDaily: '', daily: 0, wins: 0 };
let memStreak: Streak = { ...STREAK_DEFAULTS };

// meta is the base layer (tasks.ts imports from here), so the UTC day key
// is re-derived rather than imported — same math as tasks.ts dayKey
const dayKey = (now: number): string => new Date(now).toISOString().slice(0, 10);

const streak = (): Streak => {
  // merge over the session copy — same pattern as best(): corrupt fields
  // fall back, absent fields keep the memory copy
  const s = { ...memStreak };
  const raw = load<Partial<Streak>>('pk_streak');
  if (raw && typeof raw === 'object') {
    if (typeof raw.lastDaily === 'string') s.lastDaily = raw.lastDaily;
    if (typeof raw.daily === 'number' && Number.isFinite(raw.daily)) s.daily = raw.daily;
    if (typeof raw.wins === 'number' && Number.isFinite(raw.wins)) s.wins = raw.wins;
  }
  return s;
};

// The badge holds while the chain is still live — lastDaily today means it
// counted, yesterday means today hasn't been missed yet. A gap morning
// reads 0: the stored count is only ever moved by bumpStreaks, never here.
export function streakDaily(now = Date.now()): number {
  const s = streak();
  return s.lastDaily === dayKey(now) || s.lastDaily === dayKey(now - 86400000) ? s.daily : 0;
}

export function streakWins(): number {
  return streak().wins;
}

// Call once per finished run. A loss always snaps the win chain; the daily
// chain only moves when a daily run lands on a fresh UTC day — a second
// same-day daily already counted, and a gap restarts the count at 1.
export function bumpStreaks(won: boolean, isDaily: boolean, now = Date.now()): void {
  const s = streak();
  s.wins = won ? s.wins + 1 : 0;
  const today = dayKey(now);
  if (isDaily && s.lastDaily !== today) {
    s.daily = s.lastDaily === dayKey(now - 86400000) ? s.daily + 1 : 1;
    s.lastDaily = today;
  }
  memStreak = s;
  store('pk_streak', s);
}
