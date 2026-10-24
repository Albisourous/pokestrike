import { speciesById, TOTAL_STAGES, AVATARS, EVO_LINES, DEX_ALL, setPay } from './data';
import { LV_CAP } from './stats';
import { BAG_ITEMS } from './perks';

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

// meta readers run ~10-15 keys a frame on the title screen — cache each
// key's parse against its raw string: identical raw (incl. both null) skips
// the re-parse, a changed raw (own store() writes, another tab) re-reads.
const loadCache = new Map<string, { raw: string | null; val: unknown }>();

// ?debug=1 — a god-mode sandbox: every pk_* key reads/writes pk_debug_* so
// the real save is never touched while the flag is up. debugSeed() loads it
// once at boot; clear site data to reseed.
const DEBUG =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1';
const liveKey = (key: string) => (DEBUG ? key.replace(/^pk_/, 'pk_debug_') : key);

const load = <T>(key: string): T | null => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(liveKey(key));
  } catch {
    return null; // private mode — memory copy covers it; the entry stays uncached
  }
  const hit = loadCache.get(key);
  if (hit && hit.raw === raw) return hit.val as T | null;
  let val: T | null = null;
  if (raw != null) {
    try {
      val = JSON.parse(raw) as T;
    } catch {
      /* a corrupt value reads as absent — memory copy covers it */
    }
  }
  loadCache.set(key, { raw, val });
  return val;
};

const store = (key: string, value: unknown) => {
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(liveKey(key), raw);
  } catch {
    /* memory copy still covers the session */
  }
  // cache the write even when setItem threw — a getItem that disagrees
  // self-corrects into a re-parse on the next load
  loadCache.set(key, { raw, val: value });
};

export function dexIds(): number[] {
  const raw = load<unknown>('pk_dex');
  // a corrupt save is a bad title screen, not a crash — shape-check reads
  return Array.isArray(raw) ? raw.filter((x): x is number => Number.isFinite(x)) : [...memDex];
}

// Last n caught species, newest first — the MONS tab's LATEST CATCHES strip.
export const dexRecent = (n = 3): number[] => dexIds().slice(-n).reverse();

// --- evolution-line sets: complete a whole line, claim a star bounty -----
let memSets: number[] | null = null; // claimed line roots
const setClaimed = (): number[] => {
  const raw = load<unknown>('pk_sets');
  return Array.isArray(raw) ? raw.filter((x): x is number => Number.isFinite(x)) : (memSets ?? []);
};

// per-line progress vs the dex — [owned, total, root]
export const setProgress = (): { root: number; have: number; need: number }[] => {
  const owned = new Set(dexIds());
  return EVO_LINES.map((l) => ({ root: l.root, have: l.ids.filter((id) => owned.has(id)).length, need: l.ids.length }));
};

// completed-but-unclaimed lines — the CLAIM badge on the MONS tab's SETS card
export const setsReady = (): number[] => {
  const claimed = new Set(setClaimed());
  const owned = new Set(dexIds());
  return EVO_LINES.filter((l) => !claimed.has(l.root) && l.ids.every((id) => owned.has(id))).map((l) => l.root);
};

export function claimSet(root: number): number {
  const line = EVO_LINES.find((l) => l.root === root);
  if (!line || !setsReady().includes(root)) return 0;
  const list = [...setClaimed(), root];
  memSets = list;
  store('pk_sets', list);
  addStars(setPay(line));
  return setPay(line);
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

// --- dex milestones: filling the dex itself pays out ------------------------
// pk_dexrw { n } counts leading tiers claimed — the rewards are ordered, so
// one counter covers the whole ladder. The dex never shrinks and a tier can
// only land once, so re-firing the claim after every catch is safe.
export const DEX_REWARDS: { at: number; pay: number }[] = [
  { at: 10, pay: 30 }, { at: 25, pay: 60 }, { at: 50, pay: 100 },
  { at: 75, pay: 150 }, { at: 100, pay: 200 }, { at: 150, pay: 300 },
  { at: 200, pay: 400 }, { at: 300, pay: 600 }, { at: 400, pay: 800 },
  { at: 514, pay: 1500 },
];
let memDexRw = 0;

const dexRwN = (): number => {
  const raw = load<Partial<{ n: number }>>('pk_dexrw');
  const n = raw && typeof raw === 'object' && typeof raw.n === 'number' && Number.isFinite(raw.n) ? raw.n : memDexRw;
  // a corrupt blob reads as nothing-claimed — a fractional/negative n would
  // index the ladder as undefined, not as a tier
  return Math.max(0, Math.floor(n));
};

// Pays every reachable unclaimed tier and returns what landed — [] when
// nothing's new, so a back-to-back second call is a no-op.
export function claimDexRewards(): { at: number; pay: number }[] {
  const out: { at: number; pay: number }[] = [];
  const dex = dexIds().length;
  let n = dexRwN();
  while (n < DEX_REWARDS.length && dex >= DEX_REWARDS[n].at) {
    addStars(DEX_REWARDS[n].pay);
    out.push(DEX_REWARDS[n]);
    n++;
  }
  if (out.length) {
    memDexRw = n;
    store('pk_dexrw', { n });
  }
  return out;
}

// the next unclaimed tier — the "X TO GO" target, null once all are banked
export function nextDexReward(): { at: number; pay: number } | null {
  return DEX_REWARDS[dexRwN()] ?? null;
}

// --- rookie board: the first-session ladder ---------------------------------
// pk_rookie { n } counts ordered steps done — same one-counter pattern as
// pk_dexrw. Every step reads pure meta state so a check can run anywhere
// (boot, run end, a pull, a task claim) and pay the moment it lands.
export const ROOKIE_STEPS: { id: string; label: string; pay: number }[] = [
  { id: 'run', label: 'PLAY A CLIMB', pay: 15 },
  { id: 'stage', label: 'REACH STAGE 3', pay: 25 },
  { id: 'pull', label: 'HATCH A MON', pay: 50 },
  { id: 'task', label: 'CLAIM A TASK', pay: 60 },
  { id: 'win', label: 'WIN A CLIMB', pay: 100 },
];
let memRookie = 0;

const rookieN = (): number => {
  const raw = load<Partial<{ n: number }>>('pk_rookie');
  const n = raw && typeof raw === 'object' && typeof raw.n === 'number' && Number.isFinite(raw.n) ? raw.n : memRookie;
  return Math.max(0, Math.floor(n));
};

const rookieMet = (id: string): boolean => {
  switch (id) {
    case 'run': return best().runs >= 1;
    case 'stage': return best().stage >= 3;
    case 'pull': return pullCount() >= 1;
    case 'task': { const s = taskState(); return s.dclaim.length + s.wclaim.length > 0; }
    case 'win': return best().wins >= 1;
    default: return false;
  }
};

// Pays each newly-met step in order — idempotent, so callers fire it freely.
export function rookieCheck(): { label: string; pay: number }[] {
  const out: { label: string; pay: number }[] = [];
  let n = rookieN();
  while (n < ROOKIE_STEPS.length && rookieMet(ROOKIE_STEPS[n].id)) {
    addStars(ROOKIE_STEPS[n].pay);
    out.push(ROOKIE_STEPS[n]);
    n++;
  }
  if (out.length) {
    memRookie = n;
    store('pk_rookie', { n });
  }
  return out;
}

// what the ladder wants next — null once the board's cleared
export function nextRookie(): { label: string; pay: number; n: number } | null {
  const n = rookieN();
  const step = ROOKIE_STEPS[n];
  return step ? { ...step, n } : null;
}

// First-run coaching: set once the first wave clears — quit mid-run and the
// ghost pull comes back next launch.
export const coachDone = () => load<boolean>('pk_coach') ?? memCoach;
export function markCoached() {
  memCoach = true;
  store('pk_coach', true);
}
// The help deck's TUTORIAL pill re-arms the kinetic coach — it banks again
// the next time a coached wave clears.
export function resetCoach() {
  memCoach = false;
  store('pk_coach', false);
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
// pays, a clear pays double, and only a run that dies before stage 6 bleeds
// points (16 - stage*3 stays positive through stage 5) — losing deep is still
// a climb.
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
      !!e &&
      Number.isFinite(e.s) &&
      Number.isFinite(e.st) &&
      Array.isArray(e.team) &&
      e.team.every((id: number) => Number.isFinite(id)),
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
    localStorage.removeItem(liveKey('pk_echo'));
  } catch {
    /* nothing to clear */
  }
  loadCache.delete('pk_echo');
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

// --- ascension pick: the player's chosen heat, capped by wins --------------
// Plain unversioned pk_asc blob (like pk_bag/pk_streak — a standalone key,
// no SAVE_VER step). Absent = ride the cap, which is the old auto-ramp:
// every clear raised the heat whether you asked or not.
let memAsc: number | null = null;

// ?asc=N playtest override — same class as ?seed=: lifts the unlock cap so
// the ladder, the stored pick, and the run-start clamp all reach N
const forcedAsc = (() => {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('asc') : null;
  const n = Number(q);
  return q != null && Number.isFinite(n) ? Math.max(0, Math.min(Math.round(n), 9)) : null;
})();

export function ascCap(): number {
  return forcedAsc ?? Math.min(best().wins, 9);
}

export function ascPick(): number {
  const raw = load<unknown>('pk_asc');
  const stored = typeof raw === 'number' && Number.isFinite(raw) ? raw : memAsc;
  // floor at 0 — a negative stored pick would weaken foes and blank ASC_MODS
  return Math.max(0, Math.min(stored ?? ascCap(), ascCap()));
}

export function setAsc(n: number): void {
  memAsc = Math.min(Math.max(Math.round(n), 0), ascCap());
  store('pk_asc', memAsc);
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
  { id: 'hot-streak', name: 'VICTORY STAR', desc: 'Win 3 climbs in a row' },
  { id: 'daily-devotion', name: 'WEEK SIBLING', desc: 'Finish daily climbs 7 days running' },
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
  const next = new Set([...gymBadges(), ...memBadges]); // stored ∪ session —
  next.add(bossId); // the old code stored the stale read, dropping the badge
  memBadges = next;
  store('pk_badges', [...next]);
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

// --- the meta wallet: star pieces, dust, pulls, the lab --------------------
// Four standalone unversioned pk_* keys (like pk_bag — absent reads 0, memX
// covers private mode). Stars are banked every run and spent on hatcher pulls
// + lab levels; dust is the dupe-conversion currency behind the spark shop.

let memStars = 0;
let memDust = 0;
let memPulls = 0;

export function stars(): number {
  const s = load<unknown>('pk_stars');
  // a negative wallet is corruption, not debt — clamp to zero
  return typeof s === 'number' && Number.isFinite(s) ? Math.max(0, s) : memStars;
}

export function addStars(n: number): number {
  memStars = stars() + n;
  store('pk_stars', memStars);
  return memStars;
}

export function spendStars(n: number): boolean {
  const bal = stars();
  if (bal < n) return false;
  memStars = bal - n;
  store('pk_stars', memStars);
  return true;
}

export function dust(): number {
  const d = load<unknown>('pk_dust');
  return typeof d === 'number' && Number.isFinite(d) ? Math.max(0, d) : memDust;
}

export function addDust(n: number): number {
  memDust = dust() + n;
  store('pk_dust', memDust);
  return memDust;
}

export function spendDust(n: number): boolean {
  const bal = dust();
  if (bal < n) return false;
  memDust = bal - n;
  store('pk_dust', memDust);
  return true;
}

// lifetime pull count — the pity meter reads it, so it never resets
export function pullCount(): number {
  const p = load<unknown>('pk_pulls');
  return typeof p === 'number' && Number.isFinite(p) ? Math.max(0, Math.floor(p)) : memPulls;
}

export function bumpPulls(): number {
  memPulls = pullCount() + 1;
  store('pk_pulls', memPulls);
  return memPulls;
}

// one hatcher pull on the house per UTC day — pk_free { day } is the same
// once-per-day stamp as pk_raid; absent means today's pull is still waiting
let memFree = '';

const freeDay = (): string => {
  const raw = load<Partial<{ day: string }>>('pk_free');
  return raw && typeof raw === 'object' && typeof raw.day === 'string' ? raw.day : memFree;
};

export function freePullLeft(now = Date.now()): boolean {
  return freeDay() !== dayKey(now);
}

export function useFreePull(now = Date.now()): void {
  memFree = dayKey(now);
  store('pk_free', { day: memFree });
}

// the hatcher's welcome wagon: an empty wallet gets two pulls on the house
// so the machine teaches itself on first contact — pk_grant makes it
// once-ever (in private mode the store throws, so it re-grants per boot,
// which is session-scoped generosity anyway)
export function starterGrant(): boolean {
  if (stars() !== 0 || load<unknown>('pk_grant') != null) return false;
  addStars(60);
  store('pk_grant', true);
  return true;
}

// --- chroma raid + star boost: the daily's two standalone keys -------------
// Plain unversioned blobs like pk_bag/pk_streak — no RunSave shape, no
// SAVE_VER step. pk_boost { until: epochMs, mult } is the timed earnings
// multiplier a finished daily pays out; pk_raid { day: 'YYYY-MM-DD' } marks
// the UTC day the raid boss went down (retries are free, the win banks once).
// memX covers private mode; readers shape-check, so a corrupt blob reads as
// absent rather than NaN-ing the multiplier.
let memBoost: { until: number; mult: number } | null = null;
let memRaid: string | null = null;

// The blob is atomic: an until with no mult (or vice versa) is corrupt, not
// a partial merge, so it falls back to the session copy whole.
const boost = (): { until: number; mult: number } | null => {
  const raw = load<Partial<{ until: number; mult: number }>>('pk_boost');
  if (
    raw &&
    typeof raw === 'object' &&
    typeof raw.until === 'number' &&
    Number.isFinite(raw.until) &&
    typeof raw.mult === 'number' &&
    Number.isFinite(raw.mult) &&
    raw.mult > 0 // a 0/negative mult stored under a far-future until would zero earnings
  )
    return { until: raw.until, mult: raw.mult };
  return memBoost;
};

export function starBoost(now = Date.now()): number {
  const b = boost();
  return b && b.until > now ? b.mult : 1;
}

export function boostLeft(now = Date.now()): number {
  const b = boost();
  return b ? Math.max(0, b.until - now) : 0;
}

// Only a longer `until` lands — a same-day regrant is idempotent: it can
// never shorten the timer or rewrite the mult under the player's feet.
export function grantBoost(untilMs: number, mult: number): void {
  if (untilMs <= (boost()?.until ?? 0)) return;
  memBoost = { until: untilMs, mult };
  store('pk_boost', memBoost);
}

const raidDay = (): string => {
  const raw = load<Partial<{ day: string }>>('pk_raid');
  return raw && typeof raw === 'object' && typeof raw.day === 'string' ? raw.day : (memRaid ?? '');
};

export function raidDoneToday(now = Date.now()): boolean {
  return raidDay() === dayKey(now);
}

export function markRaidDone(now = Date.now()): void {
  memRaid = dayKey(now);
  store('pk_raid', { day: memRaid });
}

// --- login calendar, comeback gift, first-win: the retention trio -----------
// pk_login {day, n, prize, back}: `day` doubles as last-seen so the gap
// measures itself; prize/back are what today's boot banked, kept in the blob
// so the title can banner them all day. pk_win {day} marks the first-win
// bonus — banks once. Same unversioned-blob pattern as pk_raid/pk_streak.
interface Login {
  day: string; // UTC YYYY-MM-DD
  n: number;
  prize: number;
  back: number;
}
let memLogin: Login = { day: '', n: 0, prize: 0, back: 0 };
let memWinDay = '';

const login = (): Login => {
  const l = { ...memLogin };
  const raw = load<Partial<Login>>('pk_login');
  if (raw && typeof raw === 'object') {
    if (typeof raw.day === 'string') l.day = raw.day;
    // negatives would invert the prize math into a wallet drain — clamp up
    if (typeof raw.n === 'number' && Number.isFinite(raw.n)) l.n = Math.max(0, Math.floor(raw.n));
    if (typeof raw.prize === 'number' && Number.isFinite(raw.prize)) l.prize = Math.max(0, raw.prize);
    if (typeof raw.back === 'number' && Number.isFinite(raw.back)) l.back = Math.max(0, raw.back);
  }
  return l;
};

// One drop per UTC day: +20 on day one, +10 per chained day to a 100 cap, a
// 150 spike every 7th; a gap over 3 days pays a comeback on top. Runs from
// migrateSaves after starterGrant so a first boot pays both.
export function loginCheck(now = Date.now()): void {
  const l = login();
  const today = dayKey(now);
  if (l.day === today) return;
  const gap = l.day
    ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${l.day}T00:00:00Z`)) / 86400000)
    : 0;
  const n = l.day === dayKey(now - 86400000) ? l.n + 1 : 1;
  const prize = n % 7 === 0 ? 150 : Math.min(20 + (n - 1) * 10, 100);
  const back = gap > 3 ? 60 : 0;
  memLogin = { day: today, n, prize, back };
  store('pk_login', memLogin);
  addStars(prize + back);
}

export function loginToday(now = Date.now()): Login | null {
  const l = login();
  return l.day === dayKey(now) ? l : null;
}

// the loss-aversion tell — a chained streak that today hasn't banked yet
export function streakRisky(now = Date.now()): number {
  const s = streak();
  return s.daily >= 2 && s.lastDaily === dayKey(now - 86400000) ? s.daily : 0;
}

// +50 on the day's first clear — the second daily appointment after the
// raid's. The live boost window still multiplies it, same as raid payout.
export function firstWinBonus(now = Date.now()): number {
  const today = dayKey(now);
  const raw = load<Partial<{ day: string }>>('pk_win');
  const last = raw && typeof raw === 'object' && typeof raw.day === 'string' ? raw.day : memWinDay;
  if (last === today) return 0;
  memWinDay = today;
  store('pk_win', { day: today });
  const n = Math.ceil(50 * starBoost());
  addStars(n);
  return n;
}

// --- session escalation: each finished run today pays a little more --------
// pk_grind {day, n} counts finished runs on the UTC day; run n pays
// min(10n, 40), boost-adjusted like the other drops. Run one always pays,
// so "one more run" always has a price tag on it.
let memGrind: { day: string; n: number } = { day: '', n: 0 };

export function grindBonus(now = Date.now()): { n: number; pay: number } {
  const today = dayKey(now);
  const raw = load<Partial<{ day: string; n: number }>>('pk_grind');
  const stored =
    raw && typeof raw === 'object' && typeof raw.day === 'string' && typeof raw.n === 'number' && Number.isFinite(raw.n)
      ? (raw as { day: string; n: number })
      : null;
  const cur = stored ?? memGrind;
  if (cur.n < 0) cur.n = 0; // a corrupt negative count would price runs below zero
  const n = (cur.day === today ? cur.n : 0) + 1;
  memGrind = { day: today, n };
  store('pk_grind', memGrind);
  const pay = Math.ceil(Math.min(10 * n, 40) * starBoost(now));
  addStars(pay);
  return { n, pay };
}

// Permanent upgrades bought with star pieces — the deterministic sink next
// to the hatcher's gamble. TRAINING rows are permanent multis applied at
// battle construction; RUN TEAM rows seed per-run charges/one-shots.
// `skip` from the Oct-20 table became `earnings` — shipped SKIP is free, so
// charging for it would have nerfed current gameplay.
// costs tuned against ~103★ for a full climb win: level 1 is a taste (~20%),
// a maxed track ~2.5 wins, the marquee one-offs ~2 — the old curve charged
// 40% of a win for entry and ~27 wins for the lab
export const LAB_UPGRADES: { id: string; name: string; icon: string; max: number; desc: string; now: (lvl: number) => string; costs: number[] }[] = [
  { id: 'hp', name: 'HP UP', icon: 'hp-up', max: 5, desc: '+8% team max HP /level', now: (l) => `+${8 * l}% team max HP`, costs: [20, 30, 45, 65, 90] },
  { id: 'dmg', name: 'PROTEIN', icon: 'protein', max: 5, desc: '+5% hit damage /level', now: (l) => `+${5 * l}% hit damage`, costs: [20, 30, 45, 65, 90] },
  { id: 'spc', name: 'CALCIUM', icon: 'calcium', max: 5, desc: '+5% super damage /level', now: (l) => `+${5 * l}% super damage`, costs: [20, 30, 45, 65, 90] },
  { id: 'luck', name: 'LUCKY EGG', icon: 'lucky-egg', max: 4, desc: '+2 team luck /level', now: (l) => `+${2 * l} team luck`, costs: [20, 30, 45, 65] },
  { id: 'reroll', name: 'DIRE HIT', icon: 'dire-hit', max: 3, desc: '+1 reroll charge /level', now: (l) => `${1 + l} rerolls each run`, costs: [30, 45, 70] },
  { id: 'earnings', name: 'AMULET COIN', icon: 'amulet-coin', max: 3, desc: '+10% star earnings /level', now: (l) => `+${10 * l}% star earnings`, costs: [35, 50, 75] },
  { id: 'ban', name: 'QUICK CLAW', icon: 'quick-claw', max: 2, desc: '+1 banish charge /level', now: (l) => `${1 + l} banishes each run`, costs: [30, 45] },
  { id: 'fourth', name: 'MASTER BALL', icon: 'master-ball', max: 1, desc: 'perk boards offer 4 cards', now: () => 'perk boards deal 4 cards', costs: [200] },
  { id: 'revive', name: 'REVIVE', icon: 'revive', max: 1, desc: 'first KO each run revives at 50% HP', now: () => 'first KO revives at 50%', costs: [250] },
];

let memLab: Record<string, number> = {};

export const labLevels = (): Record<string, number> => {
  const raw = load<unknown>('pk_lab');
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>))
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = Math.floor(v);
    return out;
  }
  return { ...memLab };
};

export function labLevel(id: string): number {
  return labLevels()[id] ?? 0;
}

export function buyLab(id: string): boolean {
  const lvl = labLevel(id);
  // costs[level] is the next level's price — an unknown id or a maxed
  // upgrade indexes past the array, so there's nothing to charge
  const cost = LAB_UPGRADES.find((u) => u.id === id)?.costs[lvl];
  if (cost == null || !spendStars(cost)) return false;
  const lvls = labLevels();
  lvls[id] = lvl + 1;
  memLab = lvls;
  store('pk_lab', lvls);
  return true;
}

// --- bond: per-species career progress -------------------------------------
// The dex tracks collection breadth; bond tracks depth — a species you field
// in the climb banks points per cleared stage, and each level reached pays
// dust (a play-earned source next to dupe pulls, feeding the spark shop).
// Same unversioned-blob pattern as pk_lab: absent reads as {}, memBond covers
// private mode, corrupt entries drop on read.
export const BOND_LEVELS = [5, 12, 24, 45, 80]; // cumulative pts → LV 1..5
export const BOND_PAY = 5; // dust per level reached, × the level — 75 total to max

let memBond: Record<string, number> = {};

export const bondPts = (): Record<string, number> => {
  const raw = load<unknown>('pk_bond');
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>))
      if (Number.isFinite(+k) && typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = Math.floor(v);
    return out;
  }
  return { ...memBond };
};

export const bondOf = (id: number): number => bondPts()[id] ?? 0;
export const bondLv = (id: number): number => BOND_LEVELS.filter((at) => bondOf(id) >= at).length;

// highest-bonded species, ties broken by id so the PARTNERS card is stable
export const topBond = (n = 3): { id: number; pts: number }[] =>
  Object.entries(bondPts())
    .map(([k, pts]) => ({ id: +k, pts }))
    .sort((a, b) => b.pts - a.pts || a.id - b.id)
    .slice(0, n);

// Called once per finished run — one entry per fielded species with the
// stages it actually fought (cleared − def.joined). A dup species banks
// once; the longest stint counts.
export function bankBond(entries: { id: number; pts: number }[]): { ups: { id: number; lv: number }[]; dust: number } {
  const ups: { id: number; lv: number }[] = [];
  const byId = new Map<number, number>();
  for (const e of entries) if (e.pts > 0) byId.set(e.id, Math.max(byId.get(e.id) ?? 0, e.pts));
  if (!byId.size) return { ups, dust: 0 };
  const cur = bondPts();
  let dust = 0;
  for (const [id, pts] of byId) {
    const before = BOND_LEVELS.filter((at) => (cur[id] ?? 0) >= at).length;
    cur[id] = (cur[id] ?? 0) + pts;
    const after = BOND_LEVELS.filter((at) => cur[id] >= at).length;
    for (let l = before + 1; l <= after; l++) dust += BOND_PAY * l;
    if (after > before) ups.push({ id, lv: after });
  }
  memBond = cur;
  store('pk_bond', cur);
  if (dust) addDust(dust);
  return { ups, dust };
}

// --- save versioning: migrate once at boot so readers stay dumb ------------
// pk_ver stamps the save schema — bump SAVE_VER and add a step whenever a
// pk_* shape changes, instead of coercing old data on every read.
// v2: RunSave gains tools/perkBan — reader defaults cover v1 saves,
// no data transform needed below
// v3: RunSave gains eggIn/eggJustLaid — parked runs get defaults below
// v4: RunSave gains reviveUsed/starsRun — parked runs get defaults below
// v5: team[] gains luck/cdMod, the run gains tagEchoDone/modId — all read
// through ?? defaults, and the lost per-mon fields can't be backfilled, so
// no transform step exists; the bump just documents the shape
// v6: team[] gains joined (bond's fielded-since stage) — same ?? default,
// no transform
const SAVE_VER = 6;

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
    // a valid-JSON primitive (42, "x", true) can't take the property write
    if (typeof s === 'object' && s !== null && s.eggIn == null) {
      s.eggIn = 0;
      s.eggJustLaid = false;
      store('pk_run', s);
    }
  }
  if (v < 4) {
    // v4: the mid-run save gained the revive flag + this run's star tally —
    // fill defaults on a parked climb so the stored blob matches new saves
    const s = load<RunSave>('pk_run');
    // a valid-JSON primitive (42, "x", true) can't take the property write
    if (typeof s === 'object' && s !== null && s.reviveUsed == null) {
      s.reviveUsed = false;
      s.starsRun = 0;
      store('pk_run', s);
    }
  }
  if (v !== SAVE_VER) store('pk_ver', SAVE_VER);
  starterGrant(); // unversioned — a promo, not a shape; pk_grant self-gates
  loginCheck(); // same family — once-per-UTC-day self-gate
  rookieCheck(); // a returning player's old progress may already clear steps
}

// pk_seen marks a booted player — the first launch opens the help deck so
// the tutorial reads itself instead of waiting to be found
let memSeen = false;
export const helpSeen = (): boolean => {
  const raw = load<Partial<{ v: boolean }>>('pk_seen');
  return (raw && typeof raw === 'object' && raw.v === true) || memSeen;
};
export const markHelpSeen = (): void => {
  memSeen = true;
  store('pk_seen', { v: true });
};

// pk_trainer — the player's overworld avatar pick (an AVATARS id). Shape-
// checked like the other unversioned blobs; a junk pick falls back to May.
let memAvatar = 'may';
export const trainerPick = (): string => {
  const raw = load<Partial<{ pick: string }>>('pk_trainer');
  const pick = raw && typeof raw === 'object' ? raw.pick : undefined;
  return AVATARS.some((a) => a.id === pick) ? pick! : memAvatar;
};
export const setTrainer = (id: string): void => {
  if (!AVATARS.some((a) => a.id === id)) return;
  memAvatar = id;
  store('pk_trainer', { pick: id });
};

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
  pulls: Record<string, [number, number]>; // species id -> [dupes, total] — the hatcher's dupe rate
  deaths: Record<string, number>; // stage -> runs that ended there
  wins: number;
  runs: number;
}
let memStats: Stats = { draft: {}, perks: {}, perkban: {}, pulls: {}, deaths: {}, wins: 0, runs: 0 };

const stats = (): Stats => {
  const raw = load<Stats>('pk_stats');
  if (!raw || typeof raw !== 'object' || !raw.draft || typeof raw.draft !== 'object') return memStats;
  // the draft check only proves the oldest key — stored blobs predate the
  // ledgers added since (perkban, pulls, deaths, the counters), so every
  // field a writer touches gets normalized here, once, for all of them.
  // Wrong-type fields (perks: 5, deaths: "x") survive ??= — then a writer's
  // subscript-assign throws on the primitive, so each ledger re-checks type
  for (const k of ['perks', 'perkban', 'pulls', 'deaths'] as const) {
    const v = raw[k];
    if (!v || typeof v !== 'object') raw[k] = {};
  }
  if (typeof raw.wins !== 'number' || !Number.isFinite(raw.wins)) raw.wins = 0;
  if (typeof raw.runs !== 'number' || !Number.isFinite(raw.runs)) raw.runs = 0;
  return raw;
};

// one call per offer board shown — taken=null when the player skips it
export function statOffer(kind: 'draft' | 'perks' | 'perkban', offered: (string | number)[], taken: string | number | null) {
  const s = stats(); // every ledger key is normalized inside stats()
  for (const id of offered) {
    // a stored entry that isn't a [taken, offered] pair ({"25": 5}) re-seats
    // as a clean counter — corruption is a wiped tally, not a TypeError
    let e = s[kind][id];
    if (!Array.isArray(e)) e = s[kind][id] = [0, 0];
    e[1]++;
    if (id === taken) e[0]++;
  }
  memStats = s;
  store('pk_stats', s);
}

// one call per hatched pull — pull volume and the dupe rate audit the economy
export function statPull(id: number, dupe: boolean) {
  const s = stats(); // every ledger key is normalized inside stats()
  let e = s.pulls[id];
  if (!Array.isArray(e)) e = s.pulls[id] = [0, 0]; // same corrupt-entry re-seat as statOffer
  e[1]++;
  if (dupe) e[0]++;
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
  modId?: string; // the daily rule card applied to this run (v4+)
  team: { id: number; lvl: number; shiny?: boolean; hp: number; luck?: number; joined?: number; cdMod?: number; cd?: number; sash?: boolean }[];
  tagEchoDone?: boolean; // ASC 9's owed echo visit — a spent flag stays spent (v5+)
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
  reviveUsed?: boolean; // the lab revive token is one-shot per run — a spent revive stays spent (v4+)
  score: number;
  starsRun?: number; // star pieces banked this run — the result screen's +N row (v4+)
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
  // rows index stage.waves 0..TOTAL_STAGES-1 — pendingNext = TOTAL_STAGES
  // backfills a phantom wave no map node links to
  const row = (v: number) => Number.isInteger(v) && v >= 0 && v < TOTAL_STAGES;
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
    (s.waveIndex === -1 || row(s.waveIndex)) && // -1 = parked at HOME pre-row-0
    row(s.pendingNext) &&
    Array.isArray(s.team) &&
    s.team.length > 0 &&
    s.team.every(
      (e) =>
        !!e &&
        Number.isFinite(e.id) &&
        Number.isFinite(e.hp) &&
        e.hp <= 99999 &&
        (e.lvl == null || (Number.isFinite(e.lvl) && e.lvl >= 1 && e.lvl <= LV_CAP)) &&
        (e.luck == null || Number.isFinite(e.luck)) &&
        (e.cdMod == null || Number.isFinite(e.cdMod)),
    ) &&
    Array.isArray(s.box) &&
    s.box.every((e) => !!e && Number.isFinite(e.id) && (e.lvl == null || (Number.isFinite(e.lvl) && e.lvl <= LV_CAP))) &&
    // hp/lvl ride parallel to the box — positional pairing, every slot a
    // real in-range number (an unbounded hp is a god-mon on resume)
    Array.isArray(s.boxHp) &&
    s.boxHp.length === s.box.length &&
    s.boxHp.every((v) => Number.isFinite(v) && v >= 0 && v <= 99999) &&
    Array.isArray(s.boxLvl) &&
    s.boxLvl.length === s.box.length &&
    s.boxLvl.every((v) => Number.isFinite(v) && v >= 1 && v <= LV_CAP) &&
    // depth is the rolled-wave count — it can't exceed the rows a 9-stop
    // climb rolls, and a huge value would make foes unkillable on resume
    s.depth >= 0 &&
    s.depth <= TOTAL_STAGES - 3 &&
    Array.isArray(s.perks) &&
    Array.isArray(s.heldItems) &&
    (s.bag == null || Array.isArray(s.bag)) &&
    (s.perkBan == null || Array.isArray(s.perkBan)) &&
    (s.tools == null ||
      (typeof s.tools === 'object' && Number.isFinite(s.tools.roll) && Number.isFinite(s.tools.ban))) &&
    (s.eggIn == null || Number.isFinite(s.eggIn)) &&
    (s.starsRun == null || Number.isFinite(s.starsRun));
  return ok ? s : null;
}

export function clearRun() {
  memRun = null;
  try {
    localStorage.removeItem(liveKey('pk_run'));
  } catch {
    /* nothing to clear */
  }
  loadCache.delete('pk_run');
}

export function statRunEnd(stage: number, won: boolean) {
  const s = stats();
  s.runs++;
  if (won) s.wins++;
  else {
    const d = s.deaths[stage];
    s.deaths[stage] = (typeof d === 'number' && Number.isFinite(d) ? d : 0) + 1; // a corrupt stored count re-seats
  }
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
  haptics: boolean; // vibration
  shake: number; // screen shake intensity, 0..1 (v1 stored a bool: true→1, false→0)
  flash: boolean; // full-screen flash frames
  quality: 'high' | 'medium' | 'low'; // particle density trim
  battery: boolean; // render every other rAF
  fps: boolean; // fps counter overlay
  pickupFx: 'complete' | 'simple'; // pickup ring+glow vs bare icon+label
  uiSfx: boolean; // menu clicks and blips
  dmgNums: boolean; // damage floaters over mons
  aimGuide: boolean; // the sling's launch arrow while aiming
  mapGlints: boolean; // sea sparkle pass on the climb map
}

const SETTING_DEFAULTS: Settings = {
  master: 0.8,
  music: 0.5,
  sfx: 0.7,
  haptics: true,
  shake: 1,
  flash: true,
  quality: 'high',
  battery: false,
  fps: false,
  pickupFx: 'complete',
  uiSfx: true,
  dmgNums: true,
  aimGuide: true,
  mapGlints: true,
};
let memSettings: Settings = { ...SETTING_DEFAULTS };

// settings() runs per-frame (the loop's battery check) and per-hit
// (addShake/addPunch) — load() already caches the blob's parse by raw
// string, and the merged object itself holds while the blob identity does.
// setSetting's store() writes a fresh blob, so the next read re-merges on
// its own — no explicit invalidation needed.
let settingsSrc: Partial<Settings> | null | undefined; // blob the merged copy was built from — undefined = not merged yet
let settingsMerged: Settings | null = null;

// no stored blob yet: the OS reduced-motion flag seeds shake/flash defaults —
// once pk_settings exists it stays authoritative
const OS_REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function settings(): Settings {
  const raw = load<Partial<Settings>>('pk_settings');
  if (settingsMerged && settingsSrc === raw) return settingsMerged;
  const s = { ...memSettings };
  if (raw == null && OS_REDUCED) {
    s.shake = 0;
    s.flash = false;
  }
  if (raw && typeof raw === 'object') {
    for (const k of ['master', 'music', 'sfx'] as const) {
      const v = raw[k];
      if (typeof v === 'number' && Number.isFinite(v)) s[k] = Math.min(1, Math.max(0, v));
    }
    for (const k of ['haptics', 'flash', 'battery', 'fps', 'uiSfx', 'dmgNums', 'aimGuide', 'mapGlints'] as const) {
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
  settingsSrc = raw;
  settingsMerged = s;
  return s;
}

export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void {
  const s = settings();
  s[k] = v;
  memSettings = s;
  store('pk_settings', s); // the write lands a new blob — the merge cache re-runs on identity alone
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

// --- ?debug=1 god mode: the sandbox's one-time grant ----------------------
// Fat wallets, the full register (shinies too), the badge case, every
// achievement, a maxed lab, a stocked bag, and nine wins so the ascension
// ladder tops out. Coach + help flags are preset so no first-boot overlays
// interrupt. Everything past this point plays normally — the sandbox records
// its own progress. Self-invoked at module load (after every store it
// touches exists); the guard makes a second call — or a non-debug boot — a
// no-op.
export function debugSeed() {
  if (!DEBUG || load('pk_seeded')) return;
  store('pk_seeded', 1);
  addStars(99999);
  addDust(9999);
  recordCapture(DEX_ALL.map((d) => d.id));
  for (const d of DEX_ALL) recordShiny(d.id);
  for (const b of BADGES) earnBadge(b.boss);
  for (const a of ACHIEVEMENTS) memAch.add(a.id);
  store('pk_ach', [...memAch]);
  memLab = Object.fromEntries(LAB_UPGRADES.map((u) => [u.id, u.max]));
  store('pk_lab', memLab);
  memBest = { score: 99999, stage: TOTAL_STAGES, wins: 9, runs: 9 };
  store('pk_best', memBest);
  memBag = Object.fromEntries(BAG_ITEMS.map((i) => [i.id, 5]));
  store('pk_bag', memBag);
  markCoached();
  markHelpSeen();
  console.info('[debug] sandbox save seeded — real pk_* untouched; drop ?debug to play for real');
}

debugSeed();
