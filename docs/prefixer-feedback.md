# Prefixer: field report from a real first run

Context: first-ever run of the prefixer skill on a small TypeScript game repo
(~30 source files, `src/` holds everything, hand-maintained `AGENTS.md` with a
Layout section). Ran the full loop: scaffold → map edit → scoped searches →
metrics log. Findings ranked by leverage.

## Bugs

### 1. Metrics schema drift — SKILL.md §14 vs `scripts/measure_search.sh`

The skill's required log line uses `tool_calls` and `first_try_hit`:

```json
{"ts":"...","task":"...","searches":3,"tool_calls":4,"first_try_hit":true,"est_tokens":1400}
```

`measure_search.sh` writes `hits` instead, and no `tool_calls`/`first_try_hit`:

```json
{"ts":"...","task":"...","searches":1,"hits":5,"est_tokens":350}
```

Two writers produce different shapes in the same `metrics.jsonl`, so any
aggregation/delta math has to handle both. Pick one schema and make the
script and the doc emit it identically.

### 2. `init_namespaces.sh` doesn't descend into `src/`

The script maps top-level dirs plus monorepo parents
(`packages/apps/services/modules/libs`), but the most common repo shape —
"all the code is under `src/`" — yields a single `src:` row that scopes
nothing. In this repo the useful namespaces were `src/core` (engine
plumbing), `src/game` (play layer), and `src/main.ts` (boot/debug), all
hand-written after scaffolding.

Suggested fix: after mapping top level, descend one level into any dir that
holds the majority of the repo's source files (`src/`, `lib/`, `app/`).
File-level rows are also worth emitting for well-known entry files
(`main.*`, `index.*`, `cli.*`) — boot/entry code is a distinct search intent
from library code.

### 3. Scaffold maps generated-output dirs, violating the skill's own rule

The scaffold emitted `grap: | graphify-out/**` — a generated artifact dir,
which "never map vendored or generated paths" bans. The skip list has
`dist build target out` but misses the `*-out` pattern and other common
output dirs (`coverage`, `storybook-static`, `.turbo`, `.output`).

Suggested fix: add `*-out` and common tool-output dirs to the skip list, or
emit them as an explicit "never search" section instead of as namespaces.

### 4. No baseline mechanism, but the skill demands a delta

§13 says "without a baseline there is no delta" and §14 says "report the
delta against the baseline" — but nothing creates a baseline. A first run
can only log a line and stop.

Suggested fix: a `measure_baseline.sh` that runs one fixed probe search at
repo root and logs `{"baseline":true,...}`, or a `baseline:true` flag
convention on the first metrics line per repo.

## Design feedback

### 5. Overlap with existing agent docs (AGENTS.md / CLAUDE.md)

This repo's `AGENTS.md` already contained a Layout section that is, in
effect, a prose namespace map — and it was richer than the scaffolded one.
Now there are two tables of contents that can drift apart.

Options, cheapest first:
- Have the scaffold grep `AGENTS.md`/`CLAUDE.md`/`README.md` for a
  layout/directory section and seed `contains` descriptions from it.
- Or document the precedence: "if agent docs already map the tree,
  namespaces.md should link them, not duplicate them."
- Either way, say which file is canonical for orientation so one can be
  pruned when they disagree.

### 6. `.prefixer/` git handling is unspecified

First practical question a user hits: commit `namespaces.md` or ignore the
dir? Recommendation worth encoding: commit `namespaces.md` (the map is the
shared prefix — every future session and teammate's agent benefits),
gitignore or treat `metrics.jsonl` as local telemetry. One line in the skill
ends the recurring ambiguity.

### 7. Prefix truncation is crude

`cut -c1-4` produced `grap:`, `publ:`, `scri:` — the reference itself says
"pick the word a searcher would say." Bad prefixes are worse than explicit
`TODO`s because they look finished.

Suggested fix: a small wordlist for common dirs (`src→src`, `docs→doc`,
`test→test`, `public→pub`, `scripts→tool`), plus `TODO:` for unrecognized
names so unfinished rows are visible.

### 8. TODO rows ship silently

The scaffold fills every `contains` cell with `TODO: what lives here`, and
nothing ever flags a map that was scaffolded but never curated. A map full
of TODOs is functionally absent but looks done.

Suggested fix: a one-line lint (`grep -c 'TODO:' .prefixer/namespaces.md`)
run at the end of the orient step, or a note in the workflow that a map with
any TODO row is a draft, not a map.

### 9. Repo-size gate is missing

On ~30 files, root greps were already cheap; the map's search-scoping value
was marginal (the real win was cached orientation for future sessions). The
">2 searches" trigger fires on repos too small to benefit.

Suggested fix: a size heuristic — e.g., the map pays off past ~100 files or
>3 top-level code dirs; below that, scope searches by obvious dir names and
skip the map. Keeps the skill honest about where its cost is worth paying.

## What validated well

- `contains`-for-disambiguation works: `game: play layer` vs `core: engine
  plumbing` genuinely steered which namespace to search.
- Widen-one-level-on-miss behaved as designed (miss in `game:`, widen to
  root, correctly absent).
- The metrics log is cheap and gives the skill its feedback loop — worth
  keeping even on small repos.

## Highest-leverage fixes

1. Descend into `src/`/`lib/`/`app/` in the scaffold (fix #2).
2. Seed `contains` from existing agent docs (fix #5).
3. Sync the metrics schema between doc and script (fix #1).

Those three would have made this run fully mechanical — scaffold, light
edit, done.

---

# Round 2: second pass with the map already in place

Context: same repo, second run — this time starting from the existing
`namespaces.md` (the "orient once" path), using `measure_search.sh` for real,
and exercising the update-incrementally rule. New findings only.

## Bugs

### 10. `measure_search.sh` writes `.prefixer/` relative to CWD — stray dirs

Run it from any subdirectory and it creates `<subdir>/.prefixer/metrics.jsonl`
(confirmed: `test/.prefixer/` appeared after one call). The script should
anchor to the repo root (`git rev-parse --show-toplevel`, falling back to
walking up for an existing `.prefixer/`).

### 11. Metrics lines don't record which namespace was searched

The script logs `task`, `hits`, `est_tokens` — but not the scope. The skill's
core claim is "scoped beats root," yet the telemetry can't compare scoped vs
unscoped searches for the same task. Add a `scope` field (the glob passed,
or `root`), so metrics can actually prove the delta the skill promises.

## Design feedback — round 2

### 12. Jumbo files defeat namespace scoping

`game:` correctly scoped the `ultIn` search — but `src/game/battle.ts` is
10,216 lines. "Narrowest namespace" still lands the searcher inside a file
too big to read. Suggested addition: a jumbo-file convention — annotate
`contains` with hotspots (`battle.ts ~10k: physics 900-2200, render
3800+, spawnWave ~1270`) or emit per-file rows for files over a threshold
(e.g. >3k lines). Line-range hints in the map are still stable enough to be
a prefix.

### 13. Root-level files get no row from the scaffold

`vite.config.ts`, `package.json`, `tsconfig.json`, `index.html`, plus ~8
root markdown docs (`TRACKER.md`, `DESIGN.md`, `LOOP.md`) matched no
namespace — the scaffold only emits directory rows. Fixed by hand with a
`cfg:` row (explicit filenames) and extending `docs:` to `/*.md`.
Scaffold should emit a root-files row automatically.

### 14. Dot-dirs other than `.github` are invisible to the scaffold

`.devin/` (agent tooling/skills/hooks) and `.superpowers/` (execution
ledgers) produced no rows; `.github` is hardcoded. Either emit rows for all
non-skipped dot dirs, or document that agent-tooling dirs get a `dot:` row
by convention.

### 15. The map's best delivery vehicle is already in the repo: SessionStart

This repo's `.devin/hooks` injects a stable skill blob at every session
start — literally the prompt-ordering pattern §10-12 describes, in the
wild. The map itself is the ideal next injection: a 15-line
`namespaces.md` prepended at session start makes every search start
scoped with zero discipline required. Ship a documented hook snippet
(`SessionStart`/`session-start` per harness) as the recommended install
step — reading the map "once" per session is the failure-prone part of
the workflow.

### 16. `ts` granularity is date-only

`date +%F` makes same-day tasks unordered in the log. `date -u +%FT%TZ`
costs nothing and preserves ordering.

### 17. `first_try_hit` can't be measured by a script

The required schema includes a judgment field the shell script can't fill
(it logs `hits` instead — part of the schema drift). Either mark it
agent-reported-only, accept it as an optional arg
(`measure_search.sh <tag> --hit|--miss -- cmd`), or split the schema:
script-measured fields vs session-summary fields.

## Validated in round 2

- Update-incrementally works as designed: added `cfg:` and `/*.md` rows
  in place, kept everything else byte-identical.
- The map survived a second session exactly as intended — "read it and
  start scoped" is a real saving (no tree scan needed).
- SessionStart hook ordering is already stable-first — the repo's own
  config is a positive example worth citing in `cache-ordering.md`.

## Round-2 highest-leverage

1. Repo-root anchoring in `measure_search.sh` (#10) — silent data corruption.
2. `scope` field in metrics (#11) — makes the skill's claim measurable.
3. SessionStart injection recipe (#15) — removes the "remember to read the
   map" failure mode entirely.

---

# Round 3: packaged version, map already curated

Context: third run, current packaged skill (post round-1/2 fixes), installed
via `npx skills add -a devin -y` into `.devin/skills/prefixer`. Ran
check/suggest/eval/search/session_start/install_hook/visualize against the
existing curated map. Confirmed closed: #1-#6, #8-#11, #13-#17 (schema now
optional-fields, scaffold descends `src/`+emits root-file and entry rows,
`*-out` skipped, `--baseline`/`--hit|--miss` exist, repo-root anchoring
works, `scope` logged, `%FT%TZ`, size gate and git-handling lines in
SKILL.md, `install_hook.sh` merged into `hooks.v1.json` cleanly alongside
the existing SessionStart hook). New findings only.

## Bugs

### 18. Coverage pass warns on `.gitignore`d dirs

`check_namespaces.sh` flags `uncovered top dir` for `.playwright-cli/`,
`.shots/`, `.superpowers/`, `.ux/` — all in the repo's `.gitignore`. The
repo already opted those dirs out; no map row can or should cover them
(adding one would fail as generated/dead). The warnings are unactionable,
and worse: `session_start.sh` prints "map needs attention" forever, which
trains users to ignore the health verdict entirely.

Fix: `git check-ignore` each top dir in the coverage loop, or keep a
scratch-dotdir list. The verdict should go quiet on a healthy map.

### 19. One generated row, two FAILs, and a misleading message

The stale `grap: | graphify-out/**` row produced both `generated path
mapped` and `dead scope`. The dir exists with 21 files; `resolve` prunes
`*-out` via `GEN_PRUNE`, so the glob resolves to nothing *for search
purposes* but not on disk. "Dead scope" reads as "path typo" and sends you
checking the wrong thing. Emit the generated-path failure and skip the
dead-scope check for the same row, or reword it: "resolves only into
generated/skipped dirs".

### 20. Report mixes savings into the spend total

`visualize.py` computes the search-log total as
`e.get("est_tokens", e.get("est_tokens_saved", 0))`. eval-scope lines carry
`est_tokens_saved` (819k, 848k, 149k here) and no `est_tokens`, so the
header reads "~1.8M est. tokens total" where ~all of it is tokens *saved*,
not spent. Split the summary: spend and savings are opposite signs.

## Design feedback — round 3

### 21. Own-name probe is still a strawman

`eval_repo.sh` probes each namespace with its own leaf name. On this
hand-curated map, 3 of 10 rows came back n/a (`core:`, `main:`, `cfg:`
never self-name in their files) and the mean is computed only over rows
whose names happen to appear in their own code — a biased sample that
overstates the win. Cheap improvement: an optional `probe:` cell per row,
or probe with the row's dominant filename stem when the leaf name whiffs.

### 22. `suggest_map.sh` exits silently on a healthy map

Output is `log: 7 line(s)` plus the health verdict, then nothing. You
cannot distinguish "no suggestions" from "script didn't run". One closing
line ("no suggestions: recent searches hit inside existing scopes") closes
the loop.

### 23. Three writers, three shapes, still

`search.sh` logs `ns`+`pattern`+`scope`+`first_try_hit`;
`measure_search.sh` logs `scope`+`hits`; hand lines log
`searches`+`tool_calls`; `eval_scope.sh` a fourth shape. Every consumer
(`report_metrics.sh`, `visualize.py`) must know all of them — the
`est_tokens` fallback bug in #20 is exactly that cost surfacing. And
legacy date-only `ts` lines coexist with `%FT%TZ`: same-day ordering still
breaks across the format change. One canonical superset, or a `v` field.

### 24. Quickstart paths assume `.agents/`

README's copy-paste block is `bash .agents/skills/prefixer/scripts/…`, but
`npx skills add -a devin` installs to `.devin/skills/` — the pasted
commands fail on a Devin-only checkout (confirmed this session). The
scripts self-locate via `dirname $0`, so this is pure docs: show the
harness-relative path or a `find . -path '*/skills/prefixer'` one-liner.

## Validated in round 3

- `search.sh` scoped + logged in one step: `catchOdds` → 3 hits inside
  `game:`, metrics line written with correct `scope`.
- The stale-row path works: `check_namespaces.sh` caught `grap:` as
  generated, edit-in-place (not regeneration) fixed the map, lint went
  green. Exactly the designed loop.
- `install_hook.sh` merged into a `hooks.v1.json` that already had a
  SessionStart entry — no clobbering.
- `eval_repo.sh` handles its own blind spots honestly (n/a for 0-hit and
  baseline-excluded rows instead of fake numbers).

## Round-3 highest-leverage

1. `.gitignore`-aware coverage (#18) — the session-start verdict is the
   map's daily touchpoint; a permanently-orange verdict kills it.
2. Split spend vs saved in the report (#20) — the headline number is
   currently wrong by ~1.8M tokens.
3. Fix the quickstart path (#24) — the first command a new user pastes.
