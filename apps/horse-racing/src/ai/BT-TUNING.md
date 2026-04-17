# Manual BT Fine-Tuning Guide

A hand-tuning loop for the BT archetypes in `bt-jockey.ts`. Use this when you
need targeted fixes that the random search in `scripts/tune-bts.ts` can't
produce cheaply or when you want every change to be a named, defensible
hypothesis.

The automated search is better at finding the rough shape of a good
configuration across all six archetypes at once. Manual tuning is better at
polishing specific archetypes, chasing interactions the search missed, or
sanity-checking what the search produced.

## When to use this guide

- You already have a working baseline (no archetype DNFs on any track).
- You can name a concrete problem: "drifter finishes last on every track",
  "front-runner fades on kyoto in the last 20%", etc.
- You want the change log to read like a story of decisions, not a diff of
  magic numbers.

If instead you are starting from scratch, or trying to rebalance all six
archetypes simultaneously, run the random search first (see
`scripts/tune-bts.ts`).

## Setup — one-off diagnostic harness (~15 min)

Create a throwaway script that runs a small number of races per track and
prints per-archetype × per-track stats. The existing `runRace` and `evaluate`
helpers in `scripts/tune-bts.ts` already do the heavy lifting — the harness
is just a thin wrapper that formats output for human reading.

Minimum useful output per archetype × track:

- **mean place** (1.0 = always wins, 6.0 = always last)
- **win rate** (not strictly needed, but sometimes diagnostic)
- **mean stamina at finish** — signals whether a horse is blowing up early vs
  finishing strong
- **mean tangential velocity during cruise** — signals whether `cruiseHigh`
  is actually being reached

Example shape:

```
              test_oval     tokyo        kyoto
                place/stam   place/stam   place/stam
stalker       3.2/52%       3.0/48%      2.8/44%
front-runner  2.1/11%       4.2/ 8%      3.9/ 6%      ← blown stamina on tokyo/kyoto
closer        4.6/38%       2.0/41%      2.4/39%
speedball     3.0/22%       3.3/19%      3.4/18%
steady        3.8/55%       4.1/58%      3.6/52%
drifter       4.3/47%       4.4/46%      4.9/44%      ← always last, no track niche
```

**Budget per cycle:** 5 races × 3 tracks × ~14 s/race ≈ **3 min** wall.
Cheap enough that you can run 10–20 cycles in a session without noticing.

## The loop

```
1. Run diagnostic               (~3 min)
2. Spot ONE concrete problem
3. Hypothesize ONE knob change
4. Edit ARCHETYPES in bt-jockey.ts
5. Re-run diagnostic             (~3 min)
6. Compare to previous table
7. Accept (keep the edit) OR revert (git restore)
8. Repeat from 2
```

Rules:

- **One change at a time.** Never tune two knobs in a single cycle — you
  won't know which one was responsible for the change in the table.
- **Revert aggressively.** If a change didn't help the target metric OR
  broke some other archetype, `git restore` and move on. Don't try to
  rescue it with a second change.
- **Stop when the table looks right.** There is no fitness score. The
  signal is "are the archetypes behaving in a racing-plausible way?"
  You call it, not the numbers.

## How to form a hypothesis

Every knob in `BTConfig` points to a specific behavior. Know which knob
corresponds to which symptom before you reach for the slider.

### Symptom → likely knob table

| Symptom | Likely knob | Direction |
|---|---|---|
| Archetype never wins on any track | `wKick` (too low) or `kickPhase` (too late) | raise `wKick`, lower `kickPhase` |
| Archetype always near the front early then fades | stamina blown: `conserveThreshold` too low, `cruiseHigh` too high | raise `conserveThreshold`, lower `cruiseHigh` |
| Archetype is always last | `wKick` too low, `kickPhase` too late, or `targetLane` stuck on wrong side | start with `wKick` raise |
| Archetype always finishes mid-pack on every track (no niche) | `targetLane` too similar to others; lane identity collapsed | move `targetLane` toward the extreme for the archetype |
| Archetype wins on short track, loses on long one | `cruiseHigh` too high — burning stamina on the long one | lower `cruiseHigh`, raise `conserveThreshold` |
| Archetype wins on long track, loses on short | `kickPhase` too late for short tracks | lower `kickPhase` *or* lower `kickLateCap` |
| Archetype stuck on outer lane, never makes up ground | `lateralAggression` too low | raise `lateralAggression` toward 0.85–1.0 |
| Archetype abandons passes and re-enters CRUISE too fast | `passMinTicks` too low | raise `passMinTicks` to 50–70 |
| Archetype blocks others but never defends its own position | `defendOnScore` too high / `defendTangMin` too low | lower `defendOnScore` to ~0.4, raise `defendTangMin` |

### Interactions to watch for

- **`cruiseHigh` vs `conserveThreshold`**: high `cruiseHigh` burns stamina;
  unless `conserveThreshold` is also high, the horse will blow up. Tune in
  pairs if one moves a lot.
- **`wKick` vs `kickPhase`**: a high `wKick` and low `kickPhase` together
  give an almost-from-the-gate sprint, even if each looks moderate alone.
- **`targetLane` vs `lateralAggression`**: a target far from spawn (e.g.
  `targetLane=-0.30` from a start near `-0.95`) + low `lateralAggression`
  means the horse spends most of the race crabbing sideways instead of
  racing forward. Pair a wide target with higher aggression.

### Knobs the random search skips (so good for manual attention)

The automated search only perturbs 8 "personality core" params. These other
knobs stay at their defaults:

- `kickEarlyMargin`, `kickLateCap`
- `blockProgressMax`, `blockLateralTol`, `blockMinSlowness`
- `passMinTicks`, `passClearLateral`, `passCooldownTicks`
- `settleTicks`, `transitionMinTicks`
- `defendOnScore`, `defendOffScore`, `defendTangMin`, `defendDrift`
- All five `offLane*` knobs

If a problem persists through multiple rounds of tuning the core 8, check
whether one of these is the real culprit.

## Accept vs revert heuristic

Accept the change if **all** of the following are true:

1. The target archetype's mean place improved on the target track by
   ≥ 0.3 places (with 5 races the noise floor is ~0.4 places; be
   skeptical of smaller signals).
2. No other archetype's mean place on any track got worse by > 0.5.
3. No archetype started DNF-ing or hitting `MAX_TICKS`.
4. The front-runner stability test still passes:
   `bunx nx test horse-racing -- --testPathPattern=bt-jockey` — if this
   fails, the change broke cruise-phase oscillation somewhere.

Otherwise **revert** — `git restore apps/horse-racing/src/ai/bt-jockey.ts`
— and try a different hypothesis.

## When to stop

You're done when:

- Every archetype has at least one track where its mean place is ≤ 3.0.
- No archetype has mean place ≥ 4.5 on every track.
- The archetype personalities match their names in the table:
  front-runner is fast early, closer wins late, stalker drafts,
  speedball makes multiple passes, steady is steady, drifter is the
  baseline.

If you're stuck after ~10 cycles and the table still looks wrong, the
answer is probably not one-knob-at-a-time — consider running the random
search instead, or question whether the archetype roles are achievable
with the current physics / track set at all.

## After tuning

1. Run the full test suite: `bunx nx test horse-racing`.
2. Refresh `JOCKEY.md`'s archetype table so the documented personality
   traits match the new values (lane, cruise band, kick timing).
3. Bump the pinned values in the regression test
   (`bt-jockey.test.ts` → `BT archetype rebalance regression`) so the
   new configs are the new regression baseline.
4. Commit with a message naming the change: e.g. `tune(horse-racing):
   closer cruiseHigh 0.60→0.66 to stay closer to leaders before kick`.

## Appendix — knob quick reference

The 8 personality-core knobs (same set the search tunes):

| Knob | Range | Effect |
|---|---|---|
| `cruiseHigh` | 0.25–0.95 | Target speed ratio (fraction of `maxSpeed`). Higher = faster cruise, more stamina burn. |
| `kickPhase` | 0.50–0.96 | Race progress at which kick becomes allowed. Lower = kicks earlier. |
| `wKick` | 0–3 | Weight on kick utility score. Higher = more eager to kick mid-window. |
| `targetLane` | -0.95–0 | Normalized lateral target (−0.95 = inside rail, 0 = middle). |
| `wPass` | 0–3 | Weight on pass utility score. Higher = more aggressive overtaker. |
| `wDraft` | 0–3 | Weight on cruise-while-drafting bonus. Higher = prefers to sit behind. |
| `conserveThreshold` | 0–0.6 | Stamina fraction below which cruise tang is capped at 0.25. |
| `lateralAggression` | 0.1–1.0 | Steering force toward `targetLane`. Higher = sharper lane changes. |

The other 20+ knobs live in `BTConfig` (see `bt-jockey.ts`) and the tuning
UI at `BtWorkbench.tsx` — reach for them only when the core 8 can't
explain the behavior you're seeing.
