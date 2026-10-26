# namespaces
repo: pokestrike

| prefix | scope | contains |
|--------|-------|----------|
| game:  | src/game/** | play layer — battle scene (battle/bg), content data (data/types/traits/perks/stats/tasks/events/daily), overworld map (map/maptiles), screens/ui, meta saves |
| core:  | src/core/** | engine plumbing — assets, audio, loop, rng, vec |
| main:  | src/main.ts | boot, run setup/resume, HUD wiring, ?dev debug tools |
| test:  | test/** | headless smoke + debug suites, shims, asset/dex checks |
| docs:  | docs/**, /*.md | design docs, superpowers specs/plans, root trackers (TRACKER/LOOP/MUSIC/DESIGN/OVERNIGHT), arena review PNGs |
| cfg:   | vite.config.ts, tsconfig.json, package*.json, index.html, skills-lock.json | build/toolchain config at repo root |
| publ:  | public/** | vendored gracidea/FRLG sprite atlases, fonts |
| scri:  | scripts/** | dev scripts — gen-assets, stamp-sw, shots |
| .dev:  | .devin/** | devin skills + project rules |
| .git:  | .github/** | CI workflows |
