# Phase 2: Dynamics Collision Design

## Summary

Replace the soft rail clamp in horse-racing physics with real rigid-body collision using `@ue-too/dynamics`. Horses become dynamic `Polygon` bodies (rectangles matching the rendered shape); track rails use the existing `buildTrackIntoWorld` static bodies (`Crescent` for curve inner rails, `Polygon` strips for straights and outer fences).

## Bodies

- **Horses:** `Polygon` rectangles (2.0 × 0.65 m), matching `HORSE_LENGTH` × `HORSE_WIDTH` in the renderer. Mass from per-horse `weight` attribute (400–600 kg). Orientation locked to track tangent each substep — no angular dynamics.
- **Rails:** Static bodies from `buildTrackIntoWorld` — already exists and tested in `track-from-json.test.ts`, not yet wired into the sim.

## Force Model

All forces are computed in track-relative coordinates (tangential/normal), converted to world-space, and applied to the dynamics body as `F = a × mass`.

### Tangential Acceleration

```
a_t = K_CRUISE × (cruiseSpeed − tangentialVel)       // cruise controller
    + input.tangential × F_T_MAX × forwardAccel       // player push
    − C_DRAG × tangentialVel                           // drag
```

If `tangentialVel >= maxSpeed` and `a_t > 0`: clamp `a_t = 0`.

### Normal Acceleration

```
a_n = −(tangentialVel² / turnRadius)                   // centripetal (toward curve center)
    − NORMAL_DAMP × normalVel                          // lateral damping
    + input.normal × F_N_MAX × turnAccel               // player steering
    − C_DRAG × normalVel                               // drag
```

Centripetal uses horse's actual distance from curve center (`frame.turnRadius`). On straights (`turnRadius = Infinity`), centripetal is 0.

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| K_CRUISE | 2.0 | Cruise controller gain (unchanged) |
| C_DRAG | 0.1 | Linear drag (unchanged) |
| NORMAL_DAMP | 0.5 | Lateral velocity damping (new) |
| RESTITUTION | 0.0 | Collision bounciness — tunable (new) |

## Per-Substep Pipeline

1. **Compute forces** per horse: get track frame → compute tangential/normal accelerations → convert to world-space force vector → apply to body
2. **Lock orientation** to track tangent direction; zero angular velocity
3. **`world.step(dt)`** — dynamics engine integrates all bodies + resolves collisions
4. **Sync back** per horse: read body `center`/`linearVelocity` → update `horse.pos` → call `navigator.updateSegment` + `computeProgress` → project world velocity to track-relative `tangentialVel`/`normalVel`

## Collision Behavior

- `useLinearCollisionResolution = true` — no angular impulses
- `sleepingEnabled = false` — horses always active
- Rail bodies have `frictionEnabled = false` (from `buildTrackIntoWorld`)
- Horse bodies have `frictionEnabled = true`
- Restitution starts at 0 (inelastic), exposed as tunable constant

## AI Horse Behavior

AI horses receive no player input. They cruise via the proportional controller and follow curves via explicit centripetal force. `NORMAL_DAMP` kills lateral drift. No lane-holding or overtake logic.

## What Changes

| Component | Before | After |
|-----------|--------|-------|
| Position integration | Manual `pos += vel × dt` in track frame | Dynamics engine (world-space) |
| Rail boundary | Soft clamp (zero normalVel, push back) | Rigid-body collision resolution |
| Horse-horse collision | None | Polygon-Polygon collision |
| Centripetal force | Free (rotating frame trick) | Explicit `v²/r` toward curve center |
| Lateral damping | None | `NORMAL_DAMP = 0.5` |
| Mass/weight attribute | Unused | Affects `F = ma` and collision impulse |

## What Stays Unchanged

- `TrackNavigator` + `getTrackFrame()` — force computation and progress tracking
- Stamina drain system — uses projected `tangentialVel`/`normalVel` (synced from body)
- Exhaustion system — unchanged
- Track JSON format — fully compatible with track maker
- Renderer — reads `horse.pos` (now synced from body center) and computes rotation from track frame
- `buildTrackIntoWorld` — used as-is for rail body creation
