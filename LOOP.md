# Pokéstrike improvement loop — run until told to stop

Each iteration: pick the SINGLE highest-leverage item from the backlog,
implement the smallest complete change, verify, log, commit+push. Repeat.

Priorities, in order:
1. Battle-scene gameplay: new shot-skill expressions (angles, banks,
   passes), enemy counterplay, wave pressure — the sling must stay the star
2. Engagement/feel: feedback juice, telegraphs, readability at a glance
3. Replayability: run variety → wave mods/rooms → mutators/handicaps
4. Cleanup: dead code, unbounded text, hot-path waste

Rules:
- Monster Strike physics · FRLG pixel-art · StS progression — nothing else
- Real asset before drawn asset (drawMon/itemSprite/drawNpc/atlas slices)
- Authored 9×11 room grids only, seeded RNG only, 60 FPS, mobile-first
- No new systems for single features; deletion beats addition
- Verify: typecheck + smoke + build, live shot when visuals change
- TRACKER row per iteration, commit+push per iteration
- Leave parallel-session file changes you didn't make uncommitted
