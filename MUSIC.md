# MUSIC — the standing songbook brief

Feed one unchecked backlog item to a builder per iteration, using the
standard OVERNIGHT.md protocol (no commits, report every file, "Also
noticed" list for extras). Check items off here as they land.

All music is synthesized WebAudio in `src/core/audio.ts` — note arrays +
voice flags, no assets, no dependencies. The sequencer is the spec; read
it before writing.

## Engine notes (the decoder ring)

- `TRACKS: Record<TrackName, Track>` — a song is pure data: `bpm`,
  `lead`/`harm`/`alt`/`altHarm`/`arp`/`bass` midi arrays (`0` = rest),
  `kick`/`snare`/`hat` drum strings (`k`/`s`/`h`/`c` crash/`.` rest),
  `stab` chord rows, and voice flags (`leadWave`, `bassWave`, `guitar`,
  `slap`, `swing`, `vib`, `*Gate`, `echo`, `alt`, `loop`, `next`).
- Steps are 8th notes. **`lead.length` IS the loop length** — every
  array and drum string in a track must be exactly that length. Shorter
  = unintended silence, longer = dead notes nobody hears.
- `loop: true` loops; omit it + set `next` for one-shots that hand off
  (`win` → `title`).
- `alt`/`altHarm` rotate in every other pass — any track heard >15s at
  a stretch needs an A/A' or it grates.
- Selection lives in `battle.ts` `update()` (~line 1484): map phase →
  `'map'`; boss/rival → `'gym'`; trainer → `'trainer'`; else `'battle'`.
  `main.ts` plays `'title'` at boot, `'win'`/`null` at run end.
  `music()` early-returns on the same name, so calling every frame is
  free — but a new name always restarts the song.
- One-off motifs go in `JINGLES` + `playJingle()` — they run on the SFX
  bus and layer OVER the music, so they're the right tool for stings.
  (A `loop:false` track used as an intro sting gets killed next frame
  by the `update()` selector — don't use tracks for stings.)

## Craft rules

- Loop stitch: the last bar must lead into bar 1 — chromatic bass
  walk-up, drum fill, `c` crash on step 0 (see `battle`/`gym`).
- Mix is fixed in `pump()` (lead .055, harm .03, arp .026, bass .13,
  stab .032, kick .45). Write notes, not loudness — never compensate
  by pushing `v`.
- Tessitura: lead ~64–88, bass ~33–53. `echo` ≤0.15 for battles, up to
  0.4 for ambient. `guitar` bus = hot tracks only — everything distorted
  is nothing distorted.
- Harm voice sits a third under the lead; hand-voice it when the lead
  leaves the E-minor pool (`thirdDown` only knows Em).
- ORIGINAL melodies only — Pokémon-flavored, never the actual Nintendo
  tunes. Homage yes, transcription no.
- Momentum rule: a wild-battle track that drags makes the whole game
  feel slow. If torn between pretty and driving for a battle, driving.

## The element map — what the game knows when a wave starts

- `this.theme` (`grove|cavern|volcano|sky`, bg.ts) — the arena biome,
  rotated per wave in `spawnWave`; drives backdrop + fodder pool. **This
  is "the element you're facing" for wild battles** — fodder pools are
  mixed-type, so per-type songs would be wrong granularity.
- `node.ttype` (PokeType) — trainer/elite mono-type and gym leader type.
  11 types is too many songs → use 4 mood families below.
- `waveSpecial`, `weather` — legendary invades, golden/horde, sky gimmick.

Mood families for typed content (default call, adjust by ear):
`forge` = fire/electric/fighting · `shade` = ghost/poison/psychic ·
`earth` = rock/normal/grass · `gale` = flying/water.

## Backlog — one item per iteration, in order

- [x] S0 Songbook validator. Export `TRACKS`/`TrackName` from audio.ts;
  smoke asserts every track: all arrays+drum strings == `lead.length`,
  midi in 21–108 or 0, `next` is a real TrackName, `stab` rows are
  arrays. Protects everything below — off-by-one arrays are silent bugs.
- [x] S1 Biome battle selector + first song. `TrackName` += biome names;
  wild arm of the `update()` selector becomes
  `BIOME_TRACK[this.theme] ?? 'battle'` (gym/trainer overrides unchanged).
  Write `battle_volcano` first (most distinct): E phrygian, ~170bpm,
  `guitar`+`slap`, double-kick chug — metal to battle's J-rock.
  Unwritten biomes fall back to `'battle'`.
- [x] S2 Audition hook: `__dbg.song(name)` in the `?dev` block
  (main.ts:211) — `unlockAudio()` + `music(name)`, prints TrackNames on
  bad input. Builders can't hear; this is the human's taste-check tool.
- [x] S3 `battle_grove`: C lydian, ~140bpm, triangle lead, swing ~0.08,
  no guitar — pastoral bounce.
- [x] S4 `battle_cavern`: D dorian, ~120bpm, sine lead low (60–72),
  echo 0.3, sparse with long rests — drips in a cave.
- [x] S5 `battle_sky`: F lydian/mixo, ~150bpm, high lead, wide `arp`,
  hat-driven kit, light kick — air.
- [x] S6 Trainer type tint: store `this.waveType = ttype` in `spawnWave`
  (it's computed at ~line 830, currently dropped to a boolean). Add 4
  `trainer_<family>` tracks precomputed as DATA from the trainer march
  (transpose ±semitones + `leadWave`/`swing`/`echo` per family) — zero
  sequencer changes. If it still reads samey in audition, hand-write
  the forge variant.
- [x] S7 Gym type stab: `JINGLES` entries `gym_forge|gym_shade|gym_earth|gym_gale`
  (one dark V-stab each, family-colored) fired at boss-wave spawn —
  layers over the gym theme, no conflict.
- [x] S8 Jingle batch: `clear` (stage-clear riff), `fail` (catch-fail
  wha-wha two-note drop), `hatch` (egg), `rest` (Poké Center heal motif).
  Wire at their call sites.
- [x] S9 `invade` sting → jingle: the legendary crash-in deserves a
  1-bar minor stab, not just the sfx rise.

## Later (only when the backlog is dry)

- [x] Draft/reward variant of the title loop so menus don't share one tune.
- [x] Weather rain/sand noise bed — needs a looping noise source (the one
  allowed sequencer addition); weather already rolls per wave.
- Intensity layers (kit drops during aim, returns on launch) — real
  machinery, only with a written design.

## Verify + report

- `npm run typecheck` && `npm run build` && `npm run smoke` (S0's
  validator guards every later item).
- Report every file touched and EVERY new TrackName/JINGLES key so the
  human knows what to audition with `__dbg.song`.
- Music can't be smoke-tested for taste — structure is verified
  headlessly, taste is the human's call.
