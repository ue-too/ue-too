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

## Limitations

- Straight segments use a simple inner/outer rail offset (`halfTrackWidth`); tuning may be needed for other tracks.
- Autonomous steering does not yet follow the full piecewise centerline (only the first segment heading).
