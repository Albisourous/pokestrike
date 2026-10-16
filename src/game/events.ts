// ?-stop event pool — pokelike's QUESTION_EVENTS adapted to the climb.
// Most events resolve on arrival and the row clears with no fight; the
// ambushes (alpha, thief) swap the row's wave for a scripted one that
// still pays normal battle rewards.
import type { Battle } from './battle';
import { pickWild } from './data';
import type { SpeciesDef, WaveSpawn } from './data';
import { speciesById } from './data';
import { rollPerks } from './perks';
import { recordCapture } from './meta';

export interface EventChoice {
  label: string;
  run: (b: Battle) => EventOutcome;
}

export interface EventOutcome {
  note: string; // flavor line — becomes the wave banner or a map toast
  wave?: WaveSpawn[]; // scripted fight replacing the row's wave
  skip?: boolean; // resolved peacefully — no battle this stop
  // the stop ASKS instead of resolving — the map holds until the player picks
  choices?: { prompt: string; options: EventChoice[] };
}

interface GameEvent {
  w: number;
  skip?: (b: Battle) => boolean;
  run: (b: Battle) => EventOutcome;
}

const healAll = (b: Battle, frac: number) => {
  for (const p of b.players) if (!p.dead) p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * frac));
};

// a boxed catch at wave-appropriate level — wounded mons arrive hurt
const boxCatch = (b: Battle, def: SpeciesDef, lvl: number, hpFrac: number) => {
  b.box.push({ ...def, lvl });
  b.boxHp.push(hpFrac);
  b.boxLvl.push(lvl);
  recordCapture([def.id]); // a mid-run tab close keeps the dex honest
};

const EVENTS: GameEvent[] = [
  {
    w: 3,
    run: (b) => {
      for (const p of b.players) { p.dead = false; p.hp = p.maxHp; }
      return { note: 'A HIDDEN SPRING FULLY RESTORED YOUR TEAM!', skip: true };
    },
  },
  {
    w: 4,
    run: (b) => {
      healAll(b, 0.3);
      return { note: 'YOU FOUND A BERRY BUSH — THE TEAM RECOVERED 30%!', skip: true };
    },
  },
  {
    w: 3,
    run: (b) => {
      for (const p of b.players) b.gainLevels(p, 2);
      return { note: 'YOU DUG UP A RARE CANDY STASH — EVERYONE +2 LEVELS!', skip: true };
    },
  },
  {
    w: 3,
    run: (b) => {
      const p = b.players.filter((x) => !x.dead).sort((a, z) => z.lvl - a.lvl)[0];
      if (!p) return { note: 'THE TUTOR FOUND NOONE TO TEACH.', skip: true };
      p.cdMod += 1; // a real lesson: the super recharges one shot sooner, forever
      p.cdMax = Math.max(1, p.cdMax - 1);
      p.cd = Math.min(p.cd, p.cdMax);
      return { note: `A WANDERING TUTOR DRILLED ${p.def.name.toUpperCase()} — SUPER -1 SHOT!`, skip: true };
    },
  },
  {
    w: 4,
    run: (b) => {
      const def = pickWild(b.roll, b.depth);
      const lvl = Math.min(100, 5 + b.waveIndex * 10 + Math.floor(b.roll() * 5));
      boxCatch(b, def, lvl, 0.35);
      return { note: `A WOUNDED ${def.name.toUpperCase()} TRUSTS YOU — IT JOINED YOUR BOX!`, skip: true };
    },
  },
  {
    w: 3,
    skip: (b) => b.eggIn > 0,
    run: (b) => {
      b.eggIn = 3;
      b.eggJustLaid = true;
      return { note: 'YOU FOUND AN EGG! IT RUSTLES… (HATCHES IN 3 STOPS)', skip: true };
    },
  },
  {
    w: 2,
    run: (b) => {
      // wonder trade: one random mon out, one stranger in — same level,
      // shiny odds tripled like the machine always promised
      const alive = b.players.filter((p) => !p.dead);
      if (!alive.length) return { note: 'THE MACHINE STAYED SILENT.', skip: true };
      const p = alive[Math.floor(b.roll() * alive.length)];
      const def = pickWild(b.roll, b.depth + 1);
      const shiny = b.roll() < (1 / 48) * 3;
      const name = p.def.name.toUpperCase();
      b.applyDef(p, { ...def, shiny: shiny || undefined }, p.lvl, p.hp / p.maxHp);
      return {
        note: `${name} LEFT… AND ${shiny ? 'SHINY ' : ''}${def.name.toUpperCase()} ARRIVED!`,
        skip: true,
      };
    },
  },
  {
    w: 4,
    run: (b) => {
      // alpha mini-boss: one elite guards a treasure — a real fight, so it
      // pays the wave's rewards like any hard stop
      const boss = pickWild(b.roll, b.depth + 2, true);
      const escorts: WaveSpawn[] = [
        { def: pickWild(b.roll, b.depth), nx: 0.3, ny: 0.5 },
        { def: pickWild(b.roll, b.depth), nx: 0.7, ny: 0.5 },
      ];
      return {
        note: `AN ALPHA ${boss.name.toUpperCase()} GUARDS A TREASURE!`,
        wave: [...escorts, { def: boss, nx: 0.5, ny: 0.35, boss: true }],
      };
    },
  },
  {
    w: 3,
    run: (b) => {
      // dark pack ambush — Mightyena and its cronies
      const ids = [262, 198, 353, 261];
      const wave: WaveSpawn[] = ids.map((id, i) => ({
        def: speciesById(id)!,
        nx: 0.25 + (i % 2) * 0.5 + (b.roll() - 0.5) * 0.1,
        ny: 0.2 + Math.floor(i / 2) * 0.3,
      }));
      return { note: 'A WILD PACK AMBUSHES YOU!', wave };
    },
  },
  {
    // StS question marks ask something — a score sink priced like a reward
    w: 3,
    run: () => ({
      note: '',
      choices: {
        prompt: 'A SHADY SALESMAN FLASHES A MYSTERY BOX — 300 SCORE?',
        options: [
          {
            label: 'PAY 300 SCORE',
            run: (bb) => {
              if (bb.score < 300) return { note: 'HE SCOWLED — “COME BACK RICHER.”', skip: true };
              bb.score -= 300;
              const p = rollPerks(bb.roll, 1, bb.rank, bb.teamTypes())[0];
              if (!p) return { note: 'THE BOX WAS EMPTY. HE VANISHED.', skip: true };
              p.apply(bb);
              bb.heldItems.push(p.item);
              return { note: `THE BOX HELD ${p.name.toUpperCase()}!`, skip: true };
            },
          },
          { label: 'WALK AWAY', run: () => ({ note: 'YOU KEPT WALKING.', skip: true }) },
        ],
      },
    }),
  },
  {
    // blood shrine: pay in HP, gain in levels — the classic risk pick
    w: 2,
    run: () => ({
      note: '',
      choices: {
        prompt: 'A STRANGE SHRINE HUMS. OFFER YOUR TEAM’S STRENGTH?',
        options: [
          {
            label: 'OFFER 15% HP — +2 LEVELS',
            run: (bb) => {
              for (const p of bb.players) {
                if (p.dead) continue;
                p.hp = Math.max(1, Math.round(p.hp - p.maxHp * 0.15));
                bb.gainLevels(p, 2);
              }
              return { note: 'THE SHRINE DRANK DEEP — EVERYONE GREW +2 LEVELS.', skip: true };
            },
          },
          { label: 'LEAVE IT', run: () => ({ note: 'THE HUM FADED BEHIND YOU.', skip: true }) },
        ],
      },
    }),
  },
  {
    // the weakest link gets a stranger at +4 — a real team-building call
    w: 2,
    skip: (b) => !b.players.some((p) => !p.dead),
    run: () => ({
      note: '',
      choices: {
        prompt: 'A COLLECTOR WANTS YOUR WEAKEST MON — OFFERS A STRANGER +4 LEVELS.',
        options: [
          {
            label: 'MAKE THE TRADE',
            run: (bb) => {
              const alive = bb.players.filter((p) => !p.dead);
              if (!alive.length) return { note: 'THE DEAL COLLAPSED.', skip: true };
              const weak = alive.sort((a, z) => a.lvl - z.lvl)[0];
              const def = pickWild(bb.roll, bb.depth + 1);
              const shiny = bb.roll() < 1 / 48;
              const name = weak.def.name.toUpperCase();
              bb.applyDef(weak, { ...def, shiny: shiny || undefined }, Math.min(100, weak.lvl + 4), weak.hp / weak.maxHp);
              recordCapture([def.id]); // the stranger lands in the dex
              return { note: `${name} LEFT… ${shiny ? 'SHINY ' : ''}${def.name.toUpperCase()} ARRIVED AT Lv${weak.lvl}!`, skip: true };
            },
          },
          { label: 'DECLINE', run: () => ({ note: 'THE COLLECTOR NODDED AND MOVED ON.', skip: true }) },
        ],
      },
    }),
  },
];

export function rollEvent(b: Battle): EventOutcome {
  const pool = EVENTS.filter((e) => !e.skip?.(b));
  let r = b.roll() * pool.reduce((a, e) => a + e.w, 0);
  for (const e of pool) {
    r -= e.w;
    if (r <= 0) return e.run(b);
  }
  return pool[0].run(b);
}
