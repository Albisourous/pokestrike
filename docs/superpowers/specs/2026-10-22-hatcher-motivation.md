# Why open the hatcher — the pull loop's value stack

Date: 2026-10-22 · scope: design brief + surface audit · companions:
`2026-10-21-hatcher-gacha-design.md` (the machine), `2026-10-22-home-tabs-design.md`
(the shelf it sits on).

## The question

A pull costs 30 earned stars. Nothing real-money rides on it, so the only
reason to open THE HATCHER is that a pull is worth more than the stars.
Every pull pays out along several tracks at once — the design job is
making each payer visible somewhere the player already looks.

## The value stack — what one pull buys, and who says so

| Hook | Payoff | Surfaced | Missing |
|------|--------|----------|---------|
| New species → draft pool | `recordCapture` makes every pull permanent run variety — pulled mons deal into future drafts | dex overlay footer: "they join future draft pools"; NEW! banner in the pull show | the dex card sells milestones, not variety — no "feeds your drafts" line outside the overlay |
| Dex completion % | `N/CATCHABLE`, milestones: Shiny Charm at 100, `nextDexReward` star tiers | POKÉDEX card (count + % bar + `nextGoal` line), dex overlay header | nothing — this is the most-surfaced hook |
| Set bounties | a completed `EVO_LINES` family pays a one-time ★ bounty (`setPay`) | LINE SETS card: `CLAIM!` banner, per-line pay, nearest-line silhouettes; NEW: gold chip on the dex card + sets count in the dex header | **the claim is dead UI** — `claimSet` exists, no hit-test reaches it; "TAP TO CLAIM" is a lie |
| Dupes → dust → spark → lab | dupe pulls bank dust (`DUST_BY_TIER`); dust buys any chosen species in the spark shop; stars feed `pk_lab` permanent power | `DUPE +N DUST` in the pull show, SPARK DEAL −25% card on SHOP, LAB card `N/9 TRAINED` on TOWN, ★/◆ wallet chip rides every tab | dupe → "N pulls from a spark" math is never stated — dust feels like a consolation, not a savings account |
| Pity | every 10th pull is rare+ | `RARE GUARANTEED IN N` on the hatcher hero, `PITY IN N` fallback on the dex card | nothing cheap left |
| Daily free + rate-up + deal | `freePullLeft` zero-cost pull, `featuredPull` 10× today, `dealPick` −25% spark | `FREE PULL TODAY` + breathing gold ring on the hero, MONS tab's pulsing gold dot, RATE UP sprite + type tag, deal card | the tab dot doesn't say *why* it's gold — one word ("FREE") under the MONS tab would do it |
| Shiny chase | 2% per pull (`PULL_SHINY`), feeds shiny dex + doubles trait counts | ★ on dex cells + latest catches, charm milestone footer, weekend-boost callout in the hatcher | the rate is invisible until a shiny hits — no "2% SHINY" line on the hero |

## The cheap cues, ranked by effort/impact

1. **Wire `SETS_BTN` → `claimSet`.** The card already renders
   "TAP TO CLAIM +★N"; meta pays `addStars(setPay)`. One hit-test +
   `sfx` in `main.ts` (~10 lines) turns a dead promise into the loop's
   loudest payout. Highest impact, lowest effort — currently unowned.
2. **Sets-ready gold chip on the dex card + dex overlay header line** —
   shipped this pass: the dex card carries "N SET BONUSES READY" beside
   `nextGoal`, the overlay header shows `% FOUND · n/N LINES`. Cross-
   links the collection screen to the bounty loop.
3. **"JOINS YOUR DRAFT POOL" tag.** The dex footer already says it for
   catches; the pull show's NEW! banner and the dex card's `nextGoal`
   line are one word away from saying it for pulls. Copy-only.
4. **Label the gold tab dot.** `FREE` under the MONS tab cell when
   `freeNow` — the pulse already pulls the eye, it just doesn't say what
   for.
5. **Dust-as-savings line.** "N DUPE PULLS FROM YOUR SPARK" under the
   wallet chip or spark section — re-frames dupes from consolation to
   progress toward a chosen species.

## Gaps this doc does not fix

- `claimSet`/`setsReady`/`EVO_LINES`/`pk_sets` are fully built on the
  meta + draw side and **unwired on input** — a half-feature until
  cue #1 lands (needs `main.ts`, owned by another agent this pass).
- Hatcher-overlay internals (pull theatre, spark shop, rate-up panel)
  are owned by the hatcher agents — hooks that live inside the overlay
  are flagged here, not changed here.
