# Train Simulation Performance Analysis

## Current Limits

- **Comfortable range**: ~20-30 trains with 3-5 cars each
- **Upper bound before frame drops**: ~50-100 trains (depending on car count and hardware)

## Per-frame Costs

| Work | Cost per unit | Scales with |
|------|--------------|-------------|
| `Train.update()` — throttle + advance | O(1) per train | # trains |
| `getPosition()` — Bezier curve eval | O(1) per bogie | # bogies (≈ 2×cars + 1 per train) |
| Bogie rendering + band assignment | O(1) per bogie | # bogies |
| Car half rendering + texture lookup | O(1) per car half | 2 × # cars |
| **`sortChildren()` — called 2× per frame** | O(n log n) per elevation band | total rendered objects |

## Main Bottlenecks

1. **`sortChildren()` called twice per frame** (`train-render-system.ts` lines ~323, ~374) — once after bogies, once after cars — across all 11 elevation bands. With 100 trains × 5 cars = ~2100 renderable objects × 11 bands × 2 calls. This is likely the first wall.

2. **Bezier `advanceAtTWithLength()`** — Newton-Raphson iteration (2-4 iters) per bogie per frame. 100 trains × 11 bogies = 1100 calls/frame. Numerically intensive but manageable.

3. **Train collision prevention** — `CollisionGuard` runs per-frame after occupancy rebuild. Uses `OccupancyRegistry` colocated pairs for same-track broad-phase and a reactive `CrossingMap` (built from `TrackSegmentWithCollision` data, filtered to same-elevation) for crossing detection. Two-tier response: emergency brake at braking distance, hard stop at critical distance (~5 world units). Throttle lock prevents overrides during collision events. Block signals additionally enforce train separation for auto-driven trains, and proximity detection exists for coupling (detecting nearby stationary train endpoints).

4. **`Array.unshift()` in `getPosition()`** — prepends to arrays when crossing joints. Minor but adds up at junctions.

5. **Occupied segment check** in branch resolution (`occupiedTrackSegments.some(...)`) — O(n) linear scan per junction decision instead of a Set lookup.

## Quick Wins

- **Call `sortChildren()` once** at the end of `update()` instead of twice (easy 2× improvement on the biggest cost)
- **Use a `Set`** for `_occupiedTrackSegments` lookups in branch resolution (O(1) vs O(n))
- **Batch bogie position calculation** instead of per-train sequential

## Frame Budget (60fps = 16.67ms)

With 10 trains, rough breakdown:

- Train updates: ~0.2ms
- Bogie position calc: ~0.5ms
- Bogie + car rendering: ~0.6ms
- `sortChildren()` (2× calls): ~1-2ms
- Terrain + tracks + UI: ~10ms
- Overhead: ~2-3ms

## Key Files

- `src/trains/train-render-system.ts` — Main train rendering system
- `src/trains/formation.ts` — Train, Formation, Car classes + `getPosition()`
- `src/trains/train-manager.ts` — Train lifecycle management
- `src/time/time-manager.ts` — Main game loop timer
- `src/world-render-system.ts` — Elevation-based draw ordering
- `src/utils/init-app.ts` — App initialization & loop hookup
- `src/trains/input-state-machine/train-kmt-state-machine.ts` — Joint direction manager & train placement
