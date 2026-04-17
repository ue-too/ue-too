# Utility-Scored Jockey (bt-jockey.ts)

The scripted opponent AI uses a **utility-scored selector** with **committed
maneuvers** and a **reactive defensive overlay**. It reads only the same
observation vector the RL agent sees — no privileged access to race state.

## Architecture at a glance

```
                   ┌──────────────────────┐
                   │   Observation Vector  │
                   │ obs[0]  progress      │
                   │ obs[1]  speed ratio   │
                   │ obs[3]  stamina frac  │
                   │ obs[15] lateral norm  │
                   │ obs[26+] opp slots    │
                   └──────────┬───────────┘
                              │
                   ┌──────────▼───────────┐
                   │   Utility Selector    │
                   │                       │
                   │  scoreCruise(obs)     │
                   │  scorePass(obs)       │
                   │  scoreKick(progress,  │
                   │           stamina)    │
                   │                       │
                   │  highest score wins   │
                   └──────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         ┌─────────┐   ┌──────────┐   ┌──────────┐
         │  CRUISE  │──▶│ PASSING  │──▶│ SETTLING │
         │          │   │(committed│   │(lane lerp│
         │          │   │ min ticks│   │ back)    │
         └────┬─────┘   └──────────┘   └──────────┘
              │
              ▼
         ┌─────────┐
         │  KICK   │  (absorbing — never exits)
         └─────────┘

         ── Defensive overlay applied to ALL outputs ──
```

## States

| State        | Purpose                                                                | Duration                                   |
| ------------ | ---------------------------------------------------------------------- | ------------------------------------------ |
| **CRUISE**   | Hold speed band, steer toward archetype target lane.                   | Until utility selects another action.      |
| **PASSING**  | Swing wide + accelerate to overtake a slower blocker.                  | Committed for `passMinTicks` (default 40). |
| **SETTLING** | After a pass, interpolate lateral position back toward archetype lane. | `settleTicks` (default 40).                |
| **KICK**     | Final sprint at max tangential.                                        | Absorbing — once entered, permanent.       |

KICK can be entered from any state. PASSING and SETTLING can also be
interrupted by the forced kick late-cap (`kickLateCap`).

## Utility scoring

Each tick, when the horse is in CRUISE and not committed to a maneuver, three
scores are computed:

### scoreCruise

```
score = 1.0  (baseline)
if drafting:
    score += (0.2 + (1 - staminaFrac) * 0.3) * wDraft
```

The draft bonus makes cruising behind another horse more attractive, especially
when tired. Archetypes with high `wDraft` (closers, stalkers) are more inclined
to stay tucked in.

### scorePass

Scans opponent slots for a **blocker**: an opponent that is ahead
(`0 < progressDelta < blockProgressMax`), in the same lane
(`|normalOffset| < blockLateralTol`), and moving meaningfully slower
(`tvelDelta < -blockMinSlowness`).

```
score = (0.3 + severity * 5.0 - lateralCost * 2.0) * wPass
```

Returns `-10` (never pass) when no blocker is detected. The pass cooldown and
transition budget further gate when passing is allowed.

### scoreKick

Replaces the old hard threshold `progress >= kickPhase` with a
stamina-aware window:

```
earlyPhase = kickPhase - kickEarlyMargin
latePhase  = min(kickPhase + kickEarlyMargin, kickLateCap)

if progress < earlyPhase  →  -10  (too early, never kick)
if progress >= latePhase  →  10   (forced kick regardless of stamina)

otherwise:
    sustainability = staminaFrac - remaining * 1.5
    if sustainability <= 0  →  -1  (can't sustain, don't kick yet)
    score = (0.5 + sustainability * 3.0) * wKick
```

This gives closers (high `kickPhase`, high `wKick`) a late explosive finish
while other archetypes converge around `kickPhase` 0.70-0.78. The
`kickLateCap` ensures every horse kicks eventually, even if stamina is
depleted.

### Selection rule

```
if kickScore >= cruiseScore AND kickScore >= passScore AND kickScore > 0 → KICK
if passScore > cruiseScore AND passScore > 0 AND canTransition → PASSING
otherwise → stay in CRUISE
```

## Defensive overlay

The defensive overlay is **not** a state — it's a post-process applied to
whatever action the current state produces. It prevents opponents from passing
by contesting their line.

**Detection** — `computeThreatScore` scans opponents for:

- Slightly behind: `-0.03 <= progressDelta < 0`
- Gaining speed: `tvelDelta > 0.03`
- Swinging wide: `normalOffset > 0.05`

**Hysteresis** prevents flickering:

- Activate defense when threat score exceeds `defendOnScore` (default 0.6)
- Deactivate when it drops below `defendOffScore` (default 0.3)

**Effect** when defending (and `staminaFrac >= 0.30`):

- Tangential is raised to at least `defendTangMin` (default 0.5)
- Normal is nudged outward by `defendDrift` (default 0.15)

## Oscillation guardrails

| Mechanism                                                   | What it prevents                   |
| ----------------------------------------------------------- | ---------------------------------- |
| **Pass commitment** (`passMinTicks`)                        | Aborting a pass mid-maneuver.      |
| **Settle period** (`settleTicks`)                           | Rail-snap after completing a pass. |
| **Pass cooldown** (`passCooldownTicks`)                     | Repeated passing attempts.         |
| **Transition budget** (`transitionMinTicks`)                | Rapid CRUISE ↔ PASSING flipping.   |
| **Defense hysteresis** (`defendOnScore` / `defendOffScore`) | Frame-by-frame defense toggling.   |
| **KICK is absorbing**                                       | No exit from the final sprint.     |

## Drafting stamina bonus

Separate from the jockey AI, the simulation itself (`race.ts` / `stamina.ts`)
provides a physics-level drafting bonus:

- **Detection** (`Race.computeDraftBonus`): another horse is 0.5%-5% ahead on
  track progress, within 1 meter laterally, and at similar or higher speed.
- **Effect**: all stamina drain components are reduced by 15% for that tick.
- **Cancelled** when steering hard (`|input.normal| >= 0.3`), so weaving
  through the field doesn't get free draft.

The jockey's `scoreCruise` independently detects drafting via the observation
vector and boosts the cruise score, making the horse _choose_ to stay tucked in.
These are complementary: the jockey decides to draft, the physics rewards it.

## Archetype profiles

Each archetype is a `Partial<BTConfig>` that overrides defaults. The key
differentiators:

| Archetype        | Cruise band | Target lane           | Kick timing | Personality                                                                                                                     |
| ---------------- | ----------- | --------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Stalker**      | 0.55 - 0.70 | -0.85 (near rail)     | 0.75        | Balanced; high `wDraft` (1.3). Tucks in, conserves energy. Dominant on longer / curvier tracks (e.g. kyoto).                    |
| **Front-runner** | 0.72 - 0.85 | -0.92 (rail)          | 0.75        | Runs fast, defends position (`defendDrift` 0.20), standard kick timing. Low draft weight. Dominant on short tracks (test_oval). |
| **Closer**       | 0.48 - 0.64 | -0.75 (just off rail) | 0.78        | Moderate cruise (0.64 keeps contact with the field), explosive late kick (`wKick` 1.5). Competitive on tokyo.                   |
| **Speedball**    | 0.60 - 0.75 | -0.80 (near rail)     | 0.70        | Aggressive passer (`wPass` 1.5, short cooldown), keeps drive while shifting (`offLaneAccelRelief` 0.09).                        |
| **Steady**       | 0.58 - 0.68 | -0.88 (near rail)     | 0.80        | Conservative cruise with selective mid-window kick (`wKick` 0.9), strong defender (`defendOnScore` 0.9). Niche on kyoto 2nd.    |
| **Drifter**      | 0.52 - 0.65 | -0.82 (near rail)     | 0.78        | Mild draft seeker (`wDraft` 1.2), accepts small lane errors with light forward bias. Niche on kyoto 3rd.                        |

### Lane preferences explained

`targetLane` is a normalized lateral offset where -0.95 is the inside rail and
0 is the track center. All current archetypes sit between -0.75 and -0.92 — a
narrow ~0.17 spread near the rail — so personality differentiation comes mostly
from cruise band, kick timing, and the utility weights (`wPass`, `wKick`,
`wDraft`) rather than lane choice. The `steerToLane` helper uses a bang-bang
controller with a 0.05 dead zone, scaled by `lateralAggression`.

After a pass, the SETTLING state smoothly interpolates back toward the
archetype lane over `settleTicks` instead of snapping.

## Configuration reference

| Field                     | Default | Description                                                                                                                            |
| ------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| `cruiseHigh`              | 0.70    | Target speed ratio (tvel/maxSpeed) for the proportional cruise selector. Equilibrium sits below this value.                            |
| `cruiseLow`               | 0.55    | Informational lower-band marker. **Currently unused by the selector** — retained for tuning UI / archetype identity.                   |
| `targetLane`              | -0.90   | Preferred lateral position (normalized; -0.95 = inside rail).                                                                          |
| `lateralAggression`       | 0.6     | Steering strength toward target lane (0-1).                                                                                            |
| `kickPhase`               | 0.75    | Center of the kick timing window.                                                                                                      |
| `kickEarlyMargin`         | 0.10    | How much earlier than `kickPhase` kick can happen.                                                                                     |
| `kickLateCap`             | 0.92    | Forced kick regardless of stamina.                                                                                                     |
| `blockProgressMax`        | 0.03    | Max progress delta to consider an opponent a blocker.                                                                                  |
| `blockLateralTol`         | 0.15    | Max lateral offset for blocker detection.                                                                                              |
| `blockMinSlowness`        | 0.03    | Blocker must be at least this much slower.                                                                                             |
| `conserveThreshold`       | 0.30    | Stamina below this caps tangential at 0.25.                                                                                            |
| `passMinTicks`            | 40      | Minimum committed ticks in PASSING.                                                                                                    |
| `passClearLateral`        | 0.25    | Lateral offset threshold for "clear of blocker".                                                                                       |
| `passCooldownTicks`       | 80      | Ticks after a pass before another can start.                                                                                           |
| `settleTicks`             | 40      | Ticks to interpolate back to archetype lane.                                                                                           |
| `transitionMinTicks`      | 30      | Minimum ticks between non-absorbing transitions.                                                                                       |
| `defendOnScore`           | 0.6     | Threat score to activate defense.                                                                                                      |
| `defendOffScore`          | 0.3     | Threat score to deactivate defense.                                                                                                    |
| `defendTangMin`           | 0.5     | Minimum tangential when defending.                                                                                                     |
| `defendDrift`             | 0.15    | Outward lateral nudge when defending.                                                                                                  |
| `wPass`                   | 1.0     | Weight multiplier on pass utility score.                                                                                               |
| `wKick`                   | 1.0     | Weight multiplier on kick utility score.                                                                                               |
| `wDraft`                  | 1.0     | Weight multiplier on cruise-while-drafting bonus.                                                                                      |
| `offLanePenaltyStart`     | 0.06    | If `                                                                                                                                   | lateral − targetLane | ` exceeds this, tangential is reduced (“rating” while changing lanes). |
| `offLaneTangPenaltyScale` | 0.5     | Extra lateral error beyond start × this = tangential penalty, capped below.                                                            |
| `offLaneTangPenaltyMax`   | 0.18    | Max tangential subtracted during lane convergence (CRUISE / SETTLING only).                                                            |
| `offLaneDecelScale`       | 1.0     | Multiplies geometric lane penalty: **below 1** = less coasting (momentum), **above 1** = more willingness to decelerate into the lane. |
| `offLaneAccelRelief`      | 0.0     | Add-back to tangential after penalty (capped at cruise tang): **positive** = accelerate-through lean while shifting.                   |

### Lane convergence (“rating”)

Without coupling, every horse can hold **full cruise tangential** while **steering** sideways, so the field stays **abreast** on long straights. In **CRUISE** and **SETTLING**, tangential is adjusted when far from lane: penalty = `min(max, excess × scale × offLaneDecelScale)`, then **`offLaneAccelRelief`** adds a small forward bias back (capped). **`offLaneDecelScale`** = prefer coasting vs momentum; **`offLaneAccelRelief`** = keep drive while changing lanes. **PASSING** and **KICK** are unchanged.
