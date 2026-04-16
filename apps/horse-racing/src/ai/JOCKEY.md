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

| State | Purpose | Duration |
|---|---|---|
| **CRUISE** | Hold speed band, steer toward archetype target lane. | Until utility selects another action. |
| **PASSING** | Swing wide + accelerate to overtake a slower blocker. | Committed for `passMinTicks` (default 40). |
| **SETTLING** | After a pass, interpolate lateral position back toward archetype lane. | `settleTicks` (default 40). |
| **KICK** | Final sprint at max tangential. | Absorbing — once entered, permanent. |

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
while front-runners (low `kickPhase`) kick earlier. The `kickLateCap` ensures
every horse kicks eventually, even if stamina is depleted.

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

| Mechanism | What it prevents |
|---|---|
| **Pass commitment** (`passMinTicks`) | Aborting a pass mid-maneuver. |
| **Settle period** (`settleTicks`) | Rail-snap after completing a pass. |
| **Pass cooldown** (`passCooldownTicks`) | Repeated passing attempts. |
| **Transition budget** (`transitionMinTicks`) | Rapid CRUISE ↔ PASSING flipping. |
| **Defense hysteresis** (`defendOnScore` / `defendOffScore`) | Frame-by-frame defense toggling. |
| **KICK is absorbing** | No exit from the final sprint. |

## Drafting stamina bonus

Separate from the jockey AI, the simulation itself (`race.ts` / `stamina.ts`)
provides a physics-level drafting bonus:

- **Detection** (`Race.computeDraftBonus`): another horse is 0.5%-5% ahead on
  track progress, within 1 meter laterally, and at similar or higher speed.
- **Effect**: all stamina drain components are reduced by 15% for that tick.
- **Cancelled** when steering hard (`|input.normal| >= 0.3`), so weaving
  through the field doesn't get free draft.

The jockey's `scoreCruise` independently detects drafting via the observation
vector and boosts the cruise score, making the horse *choose* to stay tucked in.
These are complementary: the jockey decides to draft, the physics rewards it.

## Archetype profiles

Each archetype is a `Partial<BTConfig>` that overrides defaults. The key
differentiators:

| Archetype | Cruise band | Target lane | Kick timing | Personality |
|---|---|---|---|---|
| **Stalker** | 0.55 - 0.70 | -0.60 (just off rail) | 0.75 | Balanced; high draft value. Sits mid-pack, conserves energy. |
| **Front-runner** | 0.72 - 0.85 | -0.80 (inside rail) | 0.65 | Pushes early, defends position, kicks early but may fade. |
| **Closer** | 0.40 - 0.52 | -0.30 (2-3 wide) | 0.85 | Very conservative cruise; sits wide; explosive late kick. |
| **Speedball** | 0.60 - 0.75 | -0.20 (sits wide) | 0.70 | Aggressive passer (high wPass), moves through the field constantly. |
| **Steady** | 0.58 - 0.68 | -0.70 (near rail) | 0.80 | Narrow band, rarely passes, rarely defends. Mid-pack finisher. |

### Lane preferences explained

`targetLane` is a normalized lateral offset where -0.95 is the inside rail and
0 is the track center. The `steerToLane` helper uses a bang-bang controller with
a 0.05 dead zone, scaled by `lateralAggression`.

A closer sitting at -0.30 (2-3 wide) is immediately recognizable to anyone who
watches racing. After a pass, the SETTLING state smoothly interpolates back
toward the archetype lane over `settleTicks` instead of snapping.

## Configuration reference

| Field | Default | Description |
|---|---|---|
| `cruiseLow` / `cruiseHigh` | 0.55 / 0.70 | Speed ratio band (tvel/maxSpeed). |
| `targetLane` | -0.80 | Preferred lateral position (normalized). |
| `lateralAggression` | 0.6 | Steering strength toward target lane (0-1). |
| `kickPhase` | 0.75 | Center of the kick timing window. |
| `kickEarlyMargin` | 0.10 | How much earlier than `kickPhase` kick can happen. |
| `kickLateCap` | 0.92 | Forced kick regardless of stamina. |
| `blockProgressMax` | 0.03 | Max progress delta to consider an opponent a blocker. |
| `blockLateralTol` | 0.15 | Max lateral offset for blocker detection. |
| `blockMinSlowness` | 0.03 | Blocker must be at least this much slower. |
| `conserveThreshold` | 0.30 | Stamina below this caps tangential at 0.25. |
| `passMinTicks` | 40 | Minimum committed ticks in PASSING. |
| `passClearLateral` | 0.25 | Lateral offset threshold for "clear of blocker". |
| `passCooldownTicks` | 80 | Ticks after a pass before another can start. |
| `settleTicks` | 40 | Ticks to interpolate back to archetype lane. |
| `transitionMinTicks` | 30 | Minimum ticks between non-absorbing transitions. |
| `defendOnScore` | 0.6 | Threat score to activate defense. |
| `defendOffScore` | 0.3 | Threat score to deactivate defense. |
| `defendTangMin` | 0.5 | Minimum tangential when defending. |
| `defendDrift` | 0.15 | Outward lateral nudge when defending. |
| `wPass` | 1.0 | Weight multiplier on pass utility score. |
| `wKick` | 1.0 | Weight multiplier on kick utility score. |
| `wDraft` | 1.0 | Weight multiplier on cruise-while-drafting bonus. |
| `offLanePenaltyStart` | 0.06 | If `|lateral − targetLane|` exceeds this, tangential is reduced (“rating” while changing lanes). |
| `offLaneTangPenaltyScale` | 0.5 | Extra lateral error beyond start × this = tangential penalty, capped below. |
| `offLaneTangPenaltyMax` | 0.18 | Max tangential subtracted during lane convergence (CRUISE / SETTLING only). |

### Lane convergence (“rating”)

Without coupling, every horse can hold **full cruise tangential** while **steering** sideways, so the field stays **abreast** on long straights. In **CRUISE** and **SETTLING**, tangential is lowered when the horse is far from its current lane target: horses **ease forward** while sliding to `targetLane`. **PASSING** and **KICK** are unchanged. Archetypes differ (e.g. closer rates more to reach a wide lane; front-runner barely rates).
