# Pokéstrike — Beta Tester Guide

Play here: <https://albisourous.github.io/pokestrike/>

A pull-and-bounce roguelite: flick your team into enemy Pokémon, chain
bumps off your own mons, and climb a 9-stage branching map to the league
champion.

## Getting started

1. Open the link in a browser — phone or desktop both work. Portrait is
   the intended shape; on desktop the game letterboxes.
2. The HOW TO PLAY deck opens on first boot. Read it or close it — the
   sling is simpler than it reads: drag back, release.
3. You start with 80 Star Pieces. Tap **HATCHER** and spend your free
   pull (or 40 pieces) to grow the draft pool — the draft only offers
   species you've caught or hatched.
4. **START CLIMB** → draft three rounds of offers (team members, items,
   charms) → the map → tap the next stop to play it. Fights are the gold
   doors; `?` stops are events; bonfires heal.
5. Every third stage is a **gym leader** — the boss waves hit harder and
   pay a badge. Reach the end, and the climb banks out to a result card
   you can share.

## What a run looks like

- Each of your mons takes a turn as the ball: drag anywhere, release to
  fire. Bounce off your *own* mons to trigger their bump supers (burn,
  heal, speed up, and more). Enemies answer on their countdowns — the
  number under each is shots-to-fire.
- Catching a defeated wild mon adds it to your dex and can offer it to
  your team after the wave.
- Death is the run — you'll bank a continue next climb. Mute, help, and
  settings live in the top-right chips; pause mid-battle for the same.

## Filing a bug

We collect no telemetry — your report **is** the log.

1. Tap **REPORT BUGS** (bottom-left of the title screen) — it shows the
   exact receipt line a report needs: `SEED nnn · BUILD xxx`.
2. Screenshot the broken screen. If the game crashed, the crash card
   already prints the same line — screenshot that.
3. Add one line on what you tapped last ("pulled back to fire, hit the
   pond edge") and post it where you found the build.

Repro tip: every run is seeded. A shared `?seed=NNN` link replays the
same climb, so include it if your bug is stage-specific.

## Known beta notes

- Progress lives in this browser's localStorage — clearing site data
  wipes your save, and there's no cross-device sync.
- Touch targets follow the 44px guideline; if anything feels cramped on
  your device, that's a bug — report it.
- Fan content: this is a non-commercial homage. Enjoy it while it's up.
