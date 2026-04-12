# Phase 3: Observation Vector & Validation Server Design

## Summary

Define a fixed-layout observation vector for RL agents and expose it via a headless HTTP validation server. The observation module is a pure function over `Race` state, independently testable. The server wraps it in a standard `reset`/`step` API so a Python RL environment can validate its reimplemented physics against the TypeScript ground truth.

## Observation Vector

A flat `Float64Array` per horse, 139 elements. All values normalized to roughly [0, 1] or [-1, 1].

### Self State (14 floats)

| Index | Field | Normalization |
|-------|-------|---------------|
| 0 | trackProgress | raw, 0 to 1 |
| 1 | tangentialVel | / baseMaxSpeed |
| 2 | normalVel | / baseMaxSpeed |
| 3 | currentStamina | / maxStamina |
| 4 | effectiveCruiseSpeed | / baseCruiseSpeed |
| 5 | effectiveMaxSpeed | / baseMaxSpeed |
| 6 | effectiveForwardAccel | / baseForwardAccel |
| 7 | effectiveTurnAccel | / baseTurnAccel |
| 8 | baseCruiseSpeed | mapped to [0, 1] via TRAIT_RANGES |
| 9 | baseMaxSpeed | mapped to [0, 1] via TRAIT_RANGES |
| 10 | baseForwardAccel | mapped to [0, 1] via TRAIT_RANGES |
| 11 | baseTurnAccel | mapped to [0, 1] via TRAIT_RANGES |
| 12 | baseCorneringGrip | mapped to [0, 1] via TRAIT_RANGES |
| 13 | baseWeight | mapped to [0, 1] via TRAIT_RANGES |

Base attribute normalization: `(value - min) / (max - min)` using `TRAIT_RANGES` from `attributes.ts`.

### Track Context (10 floats)

| Index | Field | Notes |
|-------|-------|-------|
| 14 | currentCurvature | 1 / turnRadius; 0 on straights |
| 15 | currentSlope | raw grade (0 for now, placeholder for elevation physics) |
| 16-17 | lookahead 25m: curvature, slope | sampled at 25m ahead along centerline |
| 18-19 | lookahead 50m: curvature, slope | |
| 20-21 | lookahead 100m: curvature, slope | |
| 22-23 | lookahead 200m: curvature, slope | |

Curvature encoding: `1 / turnRadius` gives higher values for sharper curves and naturally goes to 0 for straights (`turnRadius = Infinity`). No special-casing needed.

Lookahead: sample the track at fixed distances ahead of the horse's current position along the centerline. Uses `TrackNavigator` to walk forward along segments.

### Opponents (23 slots x 5 floats = 115 floats)

| Offset | Field | Notes |
|--------|-------|-------|
| 0 | active | 1.0 if opponent exists, 0.0 if padding |
| 1 | relativeProgress | opponent.trackProgress - self.trackProgress |
| 2 | relativeTangentialVel | (opponent.tVel - self.tVel) / baseMaxSpeed |
| 3 | relativeNormalOffset | (opponent.normalPos - self.normalPos) / TRACK_HALF_WIDTH, where normalPos is the signed distance from the track centerline |
| 4 | relativeNormalVel | (opponent.nVel - self.nVel) / baseMaxSpeed |

Opponent ordering: sorted by absolute distance in trackProgress to the observing horse (closest first). Padded slots have all zeros.

Max horses per race: **24**. Each horse's observation has 23 opponent slots (everyone except self).

**Total: 14 + 10 + 115 = 139 floats per horse.**

## Action Space

Continuous: `[tangential: number, normal: number]`, both clamped to [-1, 1].

- `tangential`: -1 = full brake, 0 = cruise only, 1 = full forward push
- `normal`: -1 = steer inward, 0 = no steering, 1 = steer outward

`InputState` type changes from `{ tangential: -1|0|1, normal: -1|0|1 }` to `{ tangential: number, normal: number }`. Values are clamped to [-1, 1] in the physics layer. Browser keyboard input continues to send -1/0/1.

## Reward

`deltaProgress` per tick: `trackProgress(t) - trackProgress(t-1)`. Simple, directly incentivizes forward motion. Reward shaping is a Python-side concern.

A `done` flag is set when the horse finishes (`trackProgress >= 1.0`).

## Validation Server

Headless HTTP server using `Bun.serve`. One race instance per server process.

### `GET /health`

Returns `{ "status": "ok" }`.

### `POST /reset`

Creates a new race and returns the initial observation.

Request:
```json
{
    "track": "tokyo",
    "horseCount": 8
}
```

- `track`: track filename without `.json` extension
- `horseCount`: number of horses (1-24)

Response:
```json
{
    "observations": [[...139 floats], ...],
    "horseCount": 8
}
```

All horses start in running phase with no player (all are agents). Returns tick-0 observations before any actions are applied.

### `POST /step`

Advances the simulation by one tick.

Request:
```json
{
    "actions": [[1.0, 0.0], [0.0, 0.0], [-0.5, 0.3], ...]
}
```

- `actions[i]`: `[tangential, normal]` for horse `i`, clamped to [-1, 1]
- Array length must equal `horseCount` from reset

Response:
```json
{
    "observations": [[...139 floats], ...],
    "rewards": [0.012, 0.008, ...],
    "dones": [false, false, ...],
    "tick": 42
}
```

### Error Handling

- `POST /step` before `POST /reset`: 400 `{ "error": "No active race. Call /reset first." }`
- `POST /step` after race finished: 400 `{ "error": "Race is finished. Call /reset." }`
- Unknown track in reset: 404 `{ "error": "Track \"foo\" not found" }`
- Invalid horseCount (<1 or >24): 400 `{ "error": "horseCount must be 1-24" }`
- Wrong action array length: 400 `{ "error": "Expected N actions, got M" }`

## What Changes

| Component | Before | After |
|-----------|--------|-------|
| `InputState` | `tangential: -1\|0\|1, normal: -1\|0\|1` | `tangential: number, normal: number` (clamped [-1, 1]) |
| `spawnHorses` | Hardcoded 4 horses | Accepts `horseCount` parameter (1-24) |
| `server.ts` | v1 `HorseRacingEngine` (broken import) | v2 `Race` class with reset/step API |
| Observation | None | `observation.ts`: pure function, 139-float vector per horse |

## What Stays Unchanged

- `Race` class tick pipeline (exhaustion -> physics -> drain -> finish detection)
- Physics model (computeAccelerations, stepPhysics, RaceWorld)
- Stamina/exhaustion system
- TrackNavigator and track data format
- Browser app (keyboard input still sends -1/0/1)

## File Structure

| File | Purpose |
|------|---------|
| `simulation/observation.ts` | `buildObservations(race) -> Float64Array[]` — pure function |
| `simulation/server.ts` | HTTP validation server — thin wrapper |
| `simulation/types.ts` | `InputState` widened to continuous |
| `simulation/race.ts` | `spawnHorses` accepts variable horse count |
