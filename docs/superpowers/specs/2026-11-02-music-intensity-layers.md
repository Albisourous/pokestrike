# Music intensity layers — design

MUSIC.md's last "Later" item: kit drops during aim, returns on launch.
Written design required before implementation. This is it.

## Intent

The battle tracks drive. During the aim hold — the 1-3s where the player
reads the board — the beat should pull back so the fight breathes, then
slam back on launch. Monster Strike does this with filter + density; we
get the cheap version with what the sequencer already routes.

## Mechanism

The pump loop (`pump()` in core/audio.ts) already schedules per-instrument
rows (kick/hat/bass/lead/harm/arp/stab). Add one `intensity` field per
track: a scale map `{ kit: 1, bass: 1, lead: 1, arp: 1 }` — a low state
mutes the kit channels (kick/hat/snare) and halves stab, leaving
bass+lead+arp running. High state = today's behavior.

Two states only: `low` (aim phase, dragging) and `high` (everything
else). A smooth crossfade lives entirely inside `pump()`'s existing
per-row gain math — 150ms ramp on the kit bus, instant on nothing else.
New machinery: one `kitGain` GainNode on the drum bus + one
`setIntensity(level)` export. No new tracks, no new TrackNames.

## Call sites

`battle.ts` owns the phases: aim/drag → `setIntensity('low')`;
launch/enemy/reward/map → `setIntensity('high')`. Cheapest correct hook:
the phase setter sites that already call `sceneMusic`-adjacent state, or
one line in `update()` next to the existing music selector (~line 1484)
that reads `this.phase === 'aim' && this.dragging`. Title/menus stay
high — they never set it.

## Rules (from MUSIC.md craft)

- Loop stitch unchanged — the kit still schedules, just at gain 0; the
  bar count never drifts so the return lands on beat.
- No new `loop:false` tracks, no jingles — jingles layer over music and
  must not duck with it.
- Battery saver halves rate — intensity changes are gain sets, free.
- `music()` early-returns on the same name — setIntensity is orthogonal
  and must not restart the song.
- Audition hook: `__dbg.song` stays; add `__dbg.intensity(level)` so the
  human can flip states without dragging.

## Non-goals

- Per-track intensity maps beyond the defaults (a boss track that drops
  its *bass* instead — later, per-track override field, not v1).
- Ducking for telops/SFX (SFX sit on their own bus, no need).
- Filters/ducking curves — gain states only.

## Verify

- `npm run typecheck && npm run build && npm run smoke` — S0's songbook
  validator already guards track shapes; add an assert that every track
  still pumps at high by default.
- Taste is the human's call via `__dbg.intensity` + `__dbg.song`.
