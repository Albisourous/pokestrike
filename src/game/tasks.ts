import { mulberry32 } from '../core/rng';
import { bankBag, taskState, saveTaskState, type TaskState } from './meta';
import { pullSpecies, tierOf, INVADER_IDS, dustCost, type SpeciesDef } from './data';

// Daily/weekly task board — the retention loop that pays bag items. Each
// period's board is seeded off its key so every player rolls the same
// chores that day/week; progress and claims persist in pk_tasks via
// meta.ts. Readers never write: a stale period re-rolls in memory and the
// next tick/claim is what banks it.

export type TaskKind = 'kos' | 'catches' | 'stages' | 'gyms' | 'perks' | 'score' | 'shinies' | 'runs' | 'wins' | 'maxstage' | 'dailies';
export type TaskPeriod = 'daily' | 'weekly';

export interface TaskDef {
  id: string;
  label: string;
  n: number; // target
  kind: TaskKind;
  reward: string; // a BAG_ITEMS id — banked on claim
}

export interface TaskView {
  id: string;
  label: string;
  n: number;
  have: number; // raw counter — can run past n, `done` is the gate
  reward: string;
  desc: string; // 'ko 15 foes' — derived from kind+n, never authored
  done: boolean;
  claimed: boolean;
}

const kindDesc = (kind: TaskKind, n: number): string =>
  ({
    kos: `ko ${n} foes`,
    catches: `catch ${n} mons`,
    stages: `clear ${n} stages`,
    gyms: `beat ${n} gyms`,
    perks: `take ${n} perks`,
    score: `bank ${n} score`,
    shinies: `catch ${n === 1 ? 'a shiny' : `${n} shinies`}`,
    runs: `finish ${n} runs`,
    wins: `win ${n === 1 ? 'a climb' : `${n} climbs`}`,
    maxstage: `reach stage ${n}`,
    dailies: `finish ${n === 1 ? 'a daily climb' : `${n} daily climbs`}`,
  })[kind];

// --- the catalogue ----------------------------------------------------------
// Daily chores are quick hits that pay the easy items; the weekly board
// asks for real commitment and pays the rare stock. One kind per def keeps
// the accumulator honest — progress is tracked by kind, not by task.
export const DAILY_POOL: TaskDef[] = [
  { id: 'd-kos', label: 'BATTLE TESTED', kind: 'kos', n: 15, reward: 'friend-ball' },
  { id: 'd-kos2', label: 'EYE CONTACT', kind: 'kos', n: 8, reward: 'scope-lens' },
  { id: 'd-catch', label: 'GOTTA CATCH', kind: 'catches', n: 2, reward: 'friend-ball' },
  { id: 'd-stages', label: 'FIELD TRIP', kind: 'stages', n: 3, reward: 'macho-brace' },
  { id: 'd-score', label: 'CONTEST STAR', kind: 'score', n: 400, reward: 'macho-brace' },
  { id: 'd-perks', label: 'ITEMFINDER', kind: 'perks', n: 2, reward: 'scope-lens' },
  { id: 'd-gyms', label: 'GYM RAID', kind: 'gyms', n: 1, reward: 'friend-ball' },
  { id: 'd-maxstage', label: 'ROADWORK', kind: 'maxstage', n: 4, reward: 'quick-claw' },
];

export const WEEKLY_POOL: TaskDef[] = [
  { id: 'w-kos', label: 'HORDE BATTLE', kind: 'kos', n: 60, reward: 'exp-share' },
  { id: 'w-catch', label: 'SAFARI', kind: 'catches', n: 6, reward: 'scope-lens' },
  { id: 'w-gyms', label: 'GYM LEADER', kind: 'gyms', n: 3, reward: 'master-ball' },
  { id: 'w-score', label: 'BIG LEAGUE', kind: 'score', n: 8000, reward: 'exp-share' },
  { id: 'w-stage', label: 'DEEP CLIMB', kind: 'maxstage', n: 6, reward: 'macho-brace' },
  { id: 'w-shiny', label: 'SHINY HUNTER', kind: 'shinies', n: 1, reward: 'sacred-ash' },
  { id: 'w-win', label: 'CHAMPION', kind: 'wins', n: 1, reward: 'sacred-ash' },
  { id: 'w-runs', label: 'MARATHON', kind: 'runs', n: 3, reward: 'macho-brace' },
  { id: 'w-dailies', label: 'COMMUTER', kind: 'dailies', n: 2, reward: 'friend-ball' },
  { id: 'w-perks', label: 'RELIC HOARDER', kind: 'perks', n: 10, reward: 'scope-lens' },
  { id: 'w-stages', label: 'TRAILBLAZER', kind: 'stages', n: 15, reward: 'exp-share' },
  { id: 'w-win2', label: 'VICTORY ROAD', kind: 'wins', n: 1, reward: 'dusk-ball' },
  { id: 'w-runs2', label: 'BULK UP', kind: 'runs', n: 5, reward: 'protein' },
];

const POOL: Record<TaskPeriod, TaskDef[]> = { daily: DAILY_POOL, weekly: WEEKLY_POOL };
const COUNT: Record<TaskPeriod, number> = { daily: 3, weekly: 4 };

// --- period keys -------------------------------------------------------------
// daily: UTC YYYY-MM-DD, seeded by the day number; weekly: ISO YYYY-Wnn,
// seeded by the ISO year-week — same key, same board, for everyone.
export const dayKey = (now = Date.now()): string => new Date(now).toISOString().slice(0, 10);
export const daySeed = (now = Date.now()): number => Math.floor(now / 86400000);

// Today's hatcher rate-up species — seeded off the day so everyone sees the
// same mon. Rare+ pool only: a featured Rattata is a bad ad. Lives here, not
// in data.ts, because daySeed does (data → tasks → meta → data would cycle).
export function featuredPull(now = Date.now()): SpeciesDef {
  return pullSpecies(mulberry32(daySeed(now)), { rarePlus: true });
}

// --- the daily chroma raid ---------------------------------------------------
// One seeded epic boss per UTC day, same for everyone — the share link is
// the replay, like every daily here. Each roller gets its own salt
// (arbitrary picks — they only need to differ from each other and from
// featuredPull's bare daySeed) so the boss, the loaner team and the rate-up
// mon roll off three different streams.

export function raidPick(now = Date.now()): SpeciesDef {
  const rng = mulberry32(daySeed(now) * 31 + 7);
  const feat = featuredPull(now).id; // the raid boss can't double as the hatcher ad
  // the seeded sequence is fixed, so looping to the first epic-bucket hit
  // stays deterministic — rarePlus makes every draw rare or epic
  let d: SpeciesDef;
  do {
    d = pullSpecies(rng, { rarePlus: true });
  } while ((tierOf(d) < 3 && !INVADER_IDS.has(d.id)) || d.id === feat);
  return d;
}

export function raidTeam(now = Date.now()): SpeciesDef[] {
  const rng = mulberry32(daySeed(now) * 31 + 19);
  // boss and rate-up ids sit in the skip set too — a loaner that mirrors the
  // raid boss (or the hatcher ad) reads as a bug, ~2 days a month by chance
  const seen = new Set<number>([raidPick(now).id, featuredPull(now).id]);
  const out: SpeciesDef[] = [];
  while (out.length < 3) {
    const d = pullSpecies(rng, { rarePlus: true });
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    // pullSpecies hands out shared pool entries — clone before setting the
    // loaner level, never mutate the roster
    out.push({ ...d, lvl: 30 });
  }
  return out;
}

// --- the daily deal ---------------------------------------------------------
// One seeded rare+ spark mon at 25% off dust — the rotating reason to open
// the exchange. Its own salt so it can't collide with the raid or rate-up.
export function dealPick(now = Date.now()): SpeciesDef {
  const rng = mulberry32(daySeed(now) * 31 + 43);
  const seen = new Set<number>([raidPick(now).id, featuredPull(now).id]);
  let d: SpeciesDef;
  do {
    d = pullSpecies(rng, { rarePlus: true });
  } while (seen.has(d.id));
  return d;
}

export function dealCost(d: SpeciesDef, now = Date.now()): number {
  const base = dustCost(d);
  return d.id === dealPick(now).id ? Math.ceil(base * 0.75) : base;
}

// ISO-8601: the week holding the year's first Thursday; the Thursday's year
// is the ISO year, so late-December days can belong to next year's W01
const isoWeek = (d: Date): { y: number; w: number } => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7; // Mon 1 … Sun 7
  t.setUTCDate(t.getUTCDate() + 4 - day); // shift to this week's Thursday
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return { y, w };
};

export const weekKey = (now = Date.now()): string => {
  const { y, w } = isoWeek(new Date(now));
  return `${y}-W${String(w).padStart(2, '0')}`;
};

export const weekSeed = (now = Date.now()): number => {
  const { y, w } = isoWeek(new Date(now));
  return y * 100 + w;
};

const periodKey = (period: TaskPeriod, now: number) => (period === 'daily' ? dayKey(now) : weekKey(now));
const periodSeed = (period: TaskPeriod, now: number) => (period === 'daily' ? daySeed(now) : weekSeed(now));

// Deterministic board roll — same seed, same picks. Already-picked kinds
// leave the bag so a board never shows two bars filling off one counter.
export function rollTasks(pool: TaskDef[], count: number, seed: number): TaskDef[] {
  const rng = mulberry32(seed);
  const bag = [...pool];
  const out: TaskDef[] = [];
  while (out.length < count && bag.length) {
    const pick = bag.splice(Math.floor(rng() * bag.length), 1)[0];
    out.push(pick);
    for (let i = bag.length - 1; i >= 0; i--) if (bag[i].kind === pick.kind) bag.splice(i, 1);
  }
  return out;
}

// --- state resolution ---------------------------------------------------------
interface LivePeriod {
  defs: TaskDef[];
  prog: Record<string, number>;
  claim: string[];
  rolled: boolean; // the period flipped (or its sel was mangled) on this call
}

// The board a period is currently playing. A key mismatch — or a stored
// selection that doesn't fully resolve (the pool shrank between versions,
// leaving dead ids) — rolls the fresh seeded board and wipes the books
// INSIDE the passed state: writers persist it with
// saveTaskState, readers just drop their copy. Since the roll is seeded
// off the period key, re-rolling always yields the same board anyway.
const livePeriod = (s: TaskState, period: TaskPeriod, now: number): LivePeriod => {
  const pool = POOL[period];
  const sel = period === 'daily' ? s.dsel : s.wsel;
  const prog = period === 'daily' ? s.dp : s.wp;
  const claim = period === 'daily' ? s.dclaim : s.wclaim;
  const key = period === 'daily' ? s.day : s.week;
  let defs = sel.map((id) => pool.find((d) => d.id === id)).filter((d): d is TaskDef => !!d);
  if (key === periodKey(period, now) && defs.length && defs.length === sel.length) return { defs, prog, claim, rolled: false };
  defs = rollTasks(pool, COUNT[period], periodSeed(period, now));
  const ids = defs.map((d) => d.id);
  if (period === 'daily') {
    s.day = periodKey(period, now);
    s.dsel = ids;
    s.dp = {};
    s.dclaim = [];
  } else {
    s.week = periodKey(period, now);
    s.wsel = ids;
    s.wp = {};
    s.wclaim = [];
  }
  const p = period === 'daily' ? s.dp : s.wp;
  const c = period === 'daily' ? s.dclaim : s.wclaim;
  return { defs, prog: p, claim: c, rolled: true };
};

// --- public API ----------------------------------------------------------------
// Every fn takes an optional `now` so tests can pin the clock; prod callers
// leave it at Date.now().

// One call per stat beat — a KO, a catch, a stage clear, run end. The delta
// lands on both periods' boards, but only on kinds those boards asked for:
// unoffered kinds don't accrue, which keeps the blob tiny.
export function taskTick(delta: Partial<Record<TaskKind, number>>, now = Date.now()): void {
  const s = taskState();
  let dirty = false;
  for (const period of ['daily', 'weekly'] as const) {
    const live = livePeriod(s, period, now);
    dirty ||= live.rolled;
    for (const def of live.defs) {
      const v = delta[def.kind];
      if (v == null) continue;
      dirty = true;
      // maxstage tracks the peak reached; everything else accumulates
      live.prog[def.kind] = def.kind === 'maxstage' ? Math.max(live.prog[def.kind] ?? 0, v) : (live.prog[def.kind] ?? 0) + v;
    }
  }
  if (dirty) saveTaskState(s);
}

export function taskViews(period: TaskPeriod, now = Date.now()): TaskView[] {
  const live = livePeriod(taskState(), period, now);
  return live.defs.map((d) => {
    const have = live.prog[d.kind] ?? 0;
    return { id: d.id, label: d.label, n: d.n, have, reward: d.reward, desc: kindDesc(d.kind, d.n), done: have >= d.n, claimed: live.claim.includes(d.id) };
  });
}

// Pays the reward into the bag and returns its item id — once, ever, per
// period. Not done, already claimed, or unknown id all read as null.
export function claimTask(id: string, now = Date.now()): string | null {
  const s = taskState();
  let dirty = false;
  for (const period of ['daily', 'weekly'] as const) {
    const live = livePeriod(s, period, now);
    dirty ||= live.rolled;
    const def = live.defs.find((d) => d.id === id);
    if (!def || live.claim.includes(id) || (live.prog[def.kind] ?? 0) < def.n) continue;
    live.claim.push(id);
    saveTaskState(s);
    bankBag(def.reward);
    return def.reward;
  }
  if (dirty) saveTaskState(s); // a flip still gets persisted by the writer path
  return null;
}

// The badge count for a UI chip — done chores nobody has claimed yet.
export function tasksReady(now = Date.now()): number {
  const s = taskState();
  let n = 0;
  for (const period of ['daily', 'weekly'] as const) {
    const live = livePeriod(s, period, now);
    for (const d of live.defs) if ((live.prog[d.kind] ?? 0) >= d.n && !live.claim.includes(d.id)) n++;
  }
  return n;
}

const nextMondayUTC = (now: number): number => {
  const d = new Date(now);
  const add = (8 - (d.getUTCDay() || 7)) % 7 || 7; // days to the next Monday — a Monday waits a full week
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add);
};

export function taskResetsIn(period: TaskPeriod, now = Date.now()): string {
  const end = period === 'daily' ? (daySeed(now) + 1) * 86400000 : nextMondayUTC(now);
  const h = Math.ceil((end - now) / 3600000);
  return h < 48 ? `IN ${h}H` : `IN ${Math.ceil(h / 24)}D`;
}
