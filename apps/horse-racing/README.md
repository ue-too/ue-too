# Horse racing

Canvas demo that loads track data from the legacy `hrphysics-simulation` Python project and runs a small `@ue-too/dynamics` scene: static **Crescent** curve barriers and **Polygon** straight rails, with **Circle** “horses” driven by forward force.

## Track data

- Bundled under `public/tracks/` (e.g. `exp_track_8.json`, `track.json`). Source format: array of `STRAIGHT` / `CURVE` segments with `startPoint`, `endPoint`, and for curves `center`, `radius`, `angleSpan` (radians).
- Parser and builder: `src/simulation/track-from-json.ts`.
- **Fan** rigid bodies exist in `@ue-too/dynamics` for parity with the Python engine but are not emitted by the current JSON.

## Physics

- The world sets `useLinearCollisionResolution = true` so collisions apply **linear** impulses only (closer to the Python demo than full rotational resolution).
- Curve barriers use `Crescent` with the same orientation convention as the Pyglet demo: angle from +x to `(startPoint - center)`.

## Commands

```bash
cd apps/horse-racing
bun run dev
bun run test
bun run build
```

Pan and zoom with the usual board controls. Horses run along the first segment’s forward direction with light lateral damping and collide with rails.

## Observation Vector Sync (Browser ↔ Python)

The browser's ONNX inference and the Python training code must build identical
observation vectors. A shared schema defines the canonical layout.

### Where the schema lives

The source of truth is `obs_schema.json` in the Python training repo
(`hr-training/obs_schema.json`). It defines the field order, count (currently 26),
and types (continuous or binary modifier flags).

### Workflow for changing the observation vector

1. **Update `obs_schema.json` in the Python repo** — add/remove/reorder fields.
2. **Update Python** — `engine.py:obs_to_array()`, env observation space shapes,
   ONNX export scripts.
3. **Update browser** — `ai-jockey.ts:observationToArray()`, tensor shapes in
   `AIJockey` and `AIJockeyManager`. If new data is needed, extend
   `HorseObservation` type and the observation build in `horse-racing-engine.ts`.
4. **Retrain models** — old ONNX files expect the old layout and will not work.

### Key files in this repo

- `src/simulation/ai-jockey.ts` — `observationToArray()` builds the `Float32Array`
  fed to ONNX. Field order must match Python's `obs_to_array()`.
- `src/simulation/horse-racing-engine.ts` — `HorseObservation` type and the
  observation build in `step()`.
- `src/simulation/horse-attributes.ts` — `evaluateModifierConditions()` computes
  which modifiers are active this tick (used for modifier flags at indices 18–25).

### Current layout (v2, 26 elements)

| Index | Field | Type |
|-------|-------|------|
| 0–7 | tangentialVel, normalVel, displacement, trackProgress, curvature, staminaRatio, cruiseSpeed, maxSpeed | continuous |
| 8–13 | 3 × (relHorseTang, relHorseNorm) | continuous |
| 14–17 | corneringMargin, slope, pushingPower, pushResistance | continuous |
| 18–25 | 8 modifier flags: drafting, pack_pressure, pack_anxiety, front_runner, closer, mudder, gate_speed, endurance | binary (0/1) |

## Limitations

- Straight segments use a simple inner/outer rail offset (`halfTrackWidth`); tuning may be needed for other tracks.
- Autonomous steering does not yet follow the full piecewise centerline (only the first segment heading).
