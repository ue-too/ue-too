# Horse Racing v2: Attributes + Stamina System

Phase 1 of the horse-racing rebuild. Adds per-horse attributes and a drain-only stamina system onto the existing v2 sim, designed so that pacing strategy matters on both sprint and long races.

## Context

The v2 rebuild is a clean minimal sim: proportional cruise, linear drag, soft rail clamp, 4 hardcoded horses with identical physics. All horses behave the same.

The previous iteration had a full attribute/stamina/modifier system (~3,500 lines) but was scrapped because:
1. **Reward signal too noisy** for RL training
2. **Floor-it was always optimal** — a horse that burned all stamina still won because exhaustion penalties were too gradual

This design fixes the core game-design problem: stamina depletion must create a sharp, punishing collapse that makes pacing a real strategic decision.

## Design Philosophy

- **v2 is the ground truth** — Python RL port matches this, not the other way around
- **Build small, validate mechanically** before adding AI
- **Pacing must matter on every track length** — drain scales with effort intensity, not distance
- **Binary stamina model** — above 0% you're fine, at 0% you collapse fast

## 1. Per-Horse Attributes

### CoreAttributes

```ts
interface CoreAttributes {
    cruiseSpeed: number;    // sustainable speed without input (default 13, range 8-18)
    maxSpeed: number;       // absolute speed ceiling (default 20, range 15-25)
    forwardAccel: number;   // multiplier on tangential input (default 1.0, range 0.5-1.5)
    turnAccel: number;      // multiplier on normal input (default 1.0, range 0.5-1.5)
    corneringGrip: number;  // stamina drain threshold for cornering (default 1.0, range 0.5-1.5)
    maxStamina: number;     // total energy pool (default 100, range 50-150)
    drainRateMult: number;  // multiplier on all drain (default 1.0, range 0.7-1.3)
    weight: number;         // mass in kg for F=ma (default 500, range 400-600)
}
```

Trait ranges are defined for future genome expression. For phase 1, all horses use `createDefaultAttributes()` which returns the default values above.

### Replaces Global Constants

- `TARGET_CRUISE` → `attrs.cruiseSpeed`
- `F_T_MAX` → scaled by `attrs.forwardAccel`
- `F_N_MAX` → scaled by `attrs.turnAccel`

`K_CRUISE`, `C_DRAG`, `TRACK_HALF_WIDTH` remain global (physics properties, not horse properties).

## 2. Stamina Drain

Fixed pool, drain only, no recovery. Computed once per game tick (not per substep), after physics.

### Drain Sources

| Source | Condition | Formula |
|---|---|---|
| Overdrive | speed > cruiseSpeed | `(speed - cruiseSpeed) * OVERDRIVE_DRAIN_RATE` |
| Jockey push | tangential input > 0 | `abs(extraTangential) * STAMINA_DRAIN_RATE` |
| Lateral steering | normal input != 0 | `abs(extraNormal) * LATERAL_STEERING_DRAIN_RATE` |
| Cornering | required force > grip threshold | `(required - tolerated) * CORNERING_DRAIN_RATE` |
| Speed tax | always | `speed * SPEED_DRAIN_RATE` |
| Lateral velocity | always | `abs(normalVel) * LATERAL_VELOCITY_DRAIN_RATE` |

All drain multiplied by `drainRateMult` at the end. Stamina clamped to >= 0.

### Drain Rate Constants

Initial values (to be tuned via integration tests):

```ts
const OVERDRIVE_DRAIN_RATE = 0.005;
const STAMINA_DRAIN_RATE = 0.01;
const LATERAL_STEERING_DRAIN_RATE = 0.006;
const CORNERING_DRAIN_RATE = 0.002;
const SPEED_DRAIN_RATE = 0.0014;
const LATERAL_VELOCITY_DRAIN_RATE = 0.0008;
const GRIP_FORCE_BASELINE = 150.0;
```

### Tuning Goal

A horse running at max speed for an entire race should deplete stamina at roughly 60-70% of the track, regardless of track length. This is validated empirically by running test sims, not solved analytically. The integration test ("floor-it vs paced, does paced horse win?") is the acceptance criterion.

### Function Signature

```ts
function drainStamina(
    horse: Horse,
    effectiveAttrs: CoreAttributes,
    input: InputState,
    trackFrame: TrackFrame,
): void
```

## 3. Exhaustion

### Binary Model with Fast Collapse

**Above 0% stamina:** No degradation. Full attributes. Horse at 1% stamina performs identically to 100%.

**At 0% stamina:** Fast exponential decay to floor values over ~1-2 seconds of race time. Not instant, but not gradual — the horse visibly crumbles.

### Decay Mechanics

When stamina reaches 0%, effective attributes decay each tick toward floor values:

```
effective = floor + (current_effective - floor) * EXHAUSTION_DECAY
```

`EXHAUSTION_DECAY` ≈ 0.95 per tick (at 60 ticks/sec: ~95% of the drop within 1 second, effectively at floor by 2 seconds).

### Floor Values

| Attribute | Floor |
|---|---|
| maxSpeed | 55% of cruiseSpeed (not maxSpeed) |
| forwardAccel | 15% of base |
| turnAccel | 30% of base |

### State Tracking

The `Horse` interface gains an `effectiveAttributes` field that tracks the current decaying values. When stamina > 0, effective equals base. When stamina hits 0, effective decays toward floors each tick.

### Function Signature

```ts
function applyExhaustion(
    horse: Horse,
    dt: number,
): CoreAttributes
```

Reads `horse.currentStamina`, `horse.baseAttributes`, and `horse.effectiveAttributes`. Returns the effective attributes to pass to physics. Mutates `horse.effectiveAttributes` when decaying.

## 4. Physics Changes

### Timestep

Change from 60Hz single-step to 240Hz with 8 substeps per game tick:

```ts
const PHYS_HZ = 240;
const PHYS_SUBSTEPS = 8;
const FIXED_DT = 1 / PHYS_HZ;  // ~4.17ms per substep
```

### stepPhysics Changes

`stepPhysics` takes per-horse `CoreAttributes` instead of reading global constants:

- Cruise force uses `attrs.cruiseSpeed` instead of `TARGET_CRUISE`
- Player tangential force scaled by `attrs.forwardAccel`
- Player normal force scaled by `attrs.turnAccel`
- Speed capped at `attrs.maxSpeed`

The function is called 8 times per tick (once per substep) with `dt = 1/240`.

## 5. Tick Pipeline

The `Race.tick()` method becomes:

```
For each horse:
  1. applyExhaustion(horse) → effectiveAttrs
  2. For each substep (8x):
     stepPhysics(horse, effectiveAttrs, input, 1/240)
  3. drainStamina(horse, effectiveAttrs, input, trackFrame)
```

Exhaustion is resolved once per tick (before substeps). Drain happens once per tick (after substeps). Physics runs 8 substeps with the same effective attributes.

## 6. File Structure

### New Files

- `src/simulation/attributes.ts` — `CoreAttributes` interface, `createDefaultAttributes()`, trait ranges, constants
- `src/simulation/stamina.ts` — `drainStamina()`, drain rate constants
- `src/simulation/exhaustion.ts` — `applyExhaustion()`, decay logic, floor values

### Modified Files

- `src/simulation/types.ts` — `Horse` gains `baseAttributes: CoreAttributes`, `currentStamina: number`, `effectiveAttributes: CoreAttributes`
- `src/simulation/physics.ts` — `stepPhysics` parameterized by `CoreAttributes` per horse, no global constant reads
- `src/simulation/race.ts` — `tick()` runs the exhaustion → substeps → drain pipeline. `spawnHorses` assigns default attributes.
- `src/simulation/cruise.ts` — `computeCruiseForce` takes `cruiseSpeed` parameter instead of importing `TARGET_CRUISE`

### Removed Constants

`TARGET_CRUISE`, `F_T_MAX`, `F_N_MAX` removed from `types.ts` (replaced by per-horse attributes).

## 7. Testing Strategy

### Unit Tests

- **`drainStamina`**: verify drain rates for push, cruise, overdrive, cornering. Verify `drainRateMult` scales correctly.
- **`applyExhaustion`**: verify no penalty when stamina > 0. Verify fast decay when stamina = 0. Verify floor values are reached within ~120 ticks (~2 seconds).
- **`stepPhysics`**: verify per-horse attributes are respected (different cruise speeds → different steady-state velocities).

### Integration Tests

- **"Floor-it vs paced"**: Two horses on the same track. Horse A at max input every tick. Horse B at cruise (no extra input). Verify Horse B wins. Run on:
  - A sprint track (e.g. `curriculum_1_straight`)
  - A longer track (e.g. `simple_oval`)
- **"Stamina depletion point"**: Horse at max speed, verify stamina reaches 0 at approximately 60-70% track progress.

These tests validate the core design question: does pacing matter?

## 8. Future Phases (Out of Scope)

Listed for context on how this phase feeds into later work:

- **Phase 2**: `@ue-too/dynamics` collision (circle horses, crescent/polygon rails), replacing soft rail clamp
- **Phase 3**: Observation vector + validation server (RL integration surface)
- **Phase 4**: ONNX AI jockey inference
- **Phase 5**: Modifier system (8 conditional modifiers, genome-driven)
- **Phase 6**: Genome / breeding
