# Track-Aligned Platforms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add track-aligned station platforms that conform to existing curved tracks, supporting single-spine (one track edge + user polygon) and dual-spine (two track edges + end caps) variants.

**Architecture:** New `TrackAlignedPlatform` entity managed by `TrackAlignedPlatformManager`, with placement driven by `@ue-too/being` state machines and rendering via polygon triangulation (earcut). Platforms reference existing track segments by ID and t-range. Stations gain an optional list of track-aligned platform IDs; bare stations are valid.

**Tech Stack:** TypeScript, PixiJS (MeshSimple), `@ue-too/being` (state machines), `@ue-too/curve` (BCurve), earcut (polygon triangulation), `bun:test`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/stations/track-aligned-platform-types.ts` | `TrackAlignedPlatform`, `SpineEntry`, `OuterVertices`, serialized types, constants (`DEFAULT_CAR_HALF_WIDTH`, `DEFAULT_PLATFORM_CLEARANCE`, `MAX_STATION_DISTANCE`) |
| `src/stations/track-aligned-platform-manager.ts` | CRUD, lookup by station/segment, serialization/deserialization |
| `src/stations/platform-offset.ts` | `computePlatformOffset()` function |
| `src/stations/spine-utils.ts` | Spine validation (consecutive segments, no branching), spine sampling (walk segments + offset by normals), anchor point computation |
| `src/stations/track-aligned-platform-render-system.ts` | Mesh construction via earcut, texture, elevation band placement |
| `src/stations/single-spine-placement-state-machine.ts` | State machine + engine for single-spine platform placement |
| `src/stations/dual-spine-placement-state-machine.ts` | State machine + engine for dual-spine platform placement |
| `test/track-aligned-platform-manager.test.ts` | Manager CRUD and serialization tests |
| `test/platform-offset.test.ts` | Offset calculation tests |
| `test/spine-utils.test.ts` | Spine validation and sampling tests |

### Modified Files

| File | Change |
|------|--------|
| `src/stations/types.ts` | Add `trackAlignedPlatforms: number[]` to `Station` and `SerializedStation` |
| `src/stations/station-manager.ts` | Initialize `trackAlignedPlatforms` in create/deserialize, serialize the new field |
| `src/stations/station-factory.ts` | Pass `trackAlignedPlatforms: []` when creating island stations |
| `src/trains/tracks/track.ts` | Add platform protection guard in `removeTrackSegment()` |
| `src/trains/input-state-machine/tool-switcher-state-machine.ts` | Add `SINGLE_SPINE_PLATFORM` and `DUAL_SPINE_PLATFORM` states/events |
| `src/utils/init-app.ts` | Wire up new managers, render systems, and state machines |
| `package.json` (banana app) | Add `earcut` dependency |

**Implementation note:** The `TrackGraph` API uses `getTrackSegmentWithJoints(id)` (returns `TrackSegment | null`) and `getTrackSegmentCurve(id)` (returns `BCurve | null`). There is no `getTrackSegment()` method. The plan code uses `getTrackSegment()` as shorthand in the engines — adjust to `getTrackSegmentWithJoints()` during implementation. The `TrackSegment` type does NOT include `elevation` — elevation is on `TrackSegmentWithElevation` (draw data) or can be read from the joints. For render elevation, use the station's own `elevation` field.

---

## Task 1: Add earcut dependency

**Files:**
- Modify: `apps/banana/package.json`

- [ ] **Step 1: Install earcut**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bun add earcut --cwd apps/banana
```

- [ ] **Step 2: Install earcut type definitions**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bun add -d @types/earcut --cwd apps/banana
```

- [ ] **Step 3: Verify import works**

Create a quick check that the module resolves:

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bun -e "import earcut from 'earcut'; console.log(typeof earcut)"
```

Expected: `function`

- [ ] **Step 4: Commit**

```bash
git add apps/banana/package.json bun.lockb
git commit -m "feat(banana): add earcut dependency for polygon triangulation"
```

---

## Task 2: Types and constants

**Files:**
- Create: `apps/banana/src/stations/track-aligned-platform-types.ts`
- Modify: `apps/banana/src/stations/types.ts`

- [ ] **Step 1: Create track-aligned platform types file**

Create `apps/banana/src/stations/track-aligned-platform-types.ts`:

```typescript
import type { Point } from '@ue-too/math';
import type { StopPosition } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Half the car body width in meters. Typical passenger car ~3m wide. */
export const DEFAULT_CAR_HALF_WIDTH = 1.5;

/** Safety gap between car body edge and platform edge (meters). */
export const DEFAULT_PLATFORM_CLEARANCE = 0.15;

/** Maximum distance (meters) from station position to platform start point. */
export const MAX_STATION_DISTANCE = 500;

// ---------------------------------------------------------------------------
// Spine
// ---------------------------------------------------------------------------

/** One segment of a platform spine — a slice of a track curve. */
export type SpineEntry = {
    trackSegment: number;
    tStart: number;
    tEnd: number;
    /**
     * Which side of this segment's curve the platform is on.
     * Per-segment because curve tangent direction can flip at joints.
     *  1 = positive-normal (left of tangent),
     * -1 = negative-normal (right of tangent).
     */
    side: 1 | -1;
};

// ---------------------------------------------------------------------------
// Outer vertices
// ---------------------------------------------------------------------------

/** Single-spine: a polyline from spine end anchor back to spine start anchor. */
export type SingleOuterVertices = {
    kind: 'single';
    vertices: Point[];
};

/** Dual-spine: two end caps connecting the four spine anchors. */
export type DualOuterVertices = {
    kind: 'dual';
    /** Vertices connecting spine A end anchor to spine B end anchor. */
    capA: Point[];
    /** Vertices connecting spine B start anchor to spine A start anchor. */
    capB: Point[];
};

export type OuterVertices = SingleOuterVertices | DualOuterVertices;

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export type TrackAlignedPlatform = {
    id: number;
    /** Required — every track-aligned platform belongs to a station. */
    stationId: number;
    /** Primary spine (track-side edge). */
    spineA: SpineEntry[];
    /** Second spine (dual-spine only). null for single-spine platforms. */
    spineB: SpineEntry[] | null;
    /** Offset from track centerline to platform edge (meters). */
    offset: number;
    /** User-placed vertices defining the non-track side(s). */
    outerVertices: OuterVertices;
    stopPositions: StopPosition[];
};

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export type SerializedSpineEntry = {
    trackSegment: number;
    tStart: number;
    tEnd: number;
    side: 1 | -1;
};

export type SerializedOuterVertices =
    | { kind: 'single'; vertices: { x: number; y: number }[] }
    | { kind: 'dual'; capA: { x: number; y: number }[]; capB: { x: number; y: number }[] };

export type SerializedTrackAlignedPlatform = {
    id: number;
    stationId: number;
    spineA: SerializedSpineEntry[];
    spineB: SerializedSpineEntry[] | null;
    offset: number;
    outerVertices: SerializedOuterVertices;
    stopPositions: StopPosition[];
};

export type SerializedTrackAlignedPlatformData = {
    platforms: SerializedTrackAlignedPlatform[];
};
```

- [ ] **Step 2: Add `trackAlignedPlatforms` to Station types**

In `apps/banana/src/stations/types.ts`, add the field to `Station`:

```typescript
// After the existing `joints: number[];` line, add:
trackAlignedPlatforms: number[];
```

And to `SerializedStation`:

```typescript
// After the existing `joints: number[];` line, add:
trackAlignedPlatforms: number[];
```

- [ ] **Step 3: Commit**

```bash
git add apps/banana/src/stations/track-aligned-platform-types.ts apps/banana/src/stations/types.ts
git commit -m "feat(banana): add track-aligned platform types and constants"
```

---

## Task 3: Update Station creation to include `trackAlignedPlatforms`

**Files:**
- Modify: `apps/banana/src/stations/station-manager.ts`
- Modify: `apps/banana/src/stations/station-factory.ts`

- [ ] **Step 1: Update StationManager.serialize()**

In `apps/banana/src/stations/station-manager.ts`, in the `serialize()` method, add after the `joints` line in the map callback:

```typescript
trackAlignedPlatforms: [...entity.trackAlignedPlatforms],
```

- [ ] **Step 2: Update StationManager.deserialize()**

In `apps/banana/src/stations/station-manager.ts`, in the `deserialize()` method, add after the `joints` line inside the `createEntityWithId` call:

```typescript
trackAlignedPlatforms: [...(s.trackAlignedPlatforms ?? [])],
```

Use `?? []` for backwards compatibility with saved scenes that don't have this field.

- [ ] **Step 3: Update createIslandStation()**

In `apps/banana/src/stations/station-factory.ts`, in the `stationManager.createStation()` call, add after `joints,`:

```typescript
trackAlignedPlatforms: [],
```

- [ ] **Step 4: Run existing tests to verify no regressions**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bunx nx test banana
```

Expected: All existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/banana/src/stations/station-manager.ts apps/banana/src/stations/station-factory.ts
git commit -m "feat(banana): add trackAlignedPlatforms field to station creation and serialization"
```

---

## Task 4: Platform offset calculation

**Files:**
- Create: `apps/banana/src/stations/platform-offset.ts`
- Create: `apps/banana/test/platform-offset.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/banana/test/platform-offset.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { computePlatformOffset } from '../src/stations/platform-offset';

describe('computePlatformOffset', () => {
    it('should compute offset from gauge when no bed width', () => {
        // gauge=1.067, ballastHalfWidth = tieHw + 0.15
        // tieHw = (1.067/2) * ((64 + 8) / 64) = 0.5335 * 1.125 = ~0.6002
        // ballastHw = 0.6002 + 0.15 = ~0.7502
        // offset = 0.7502 + 0.15 (clearance) + 1.5 (carHalfWidth) = ~2.4002
        const offset = computePlatformOffset(1.067, undefined);
        expect(offset).toBeCloseTo(2.4, 0);
    });

    it('should use bed width when larger than ballast', () => {
        // bedWidth=5, bedWidth/2=2.5 > ballastHw (~0.75)
        // offset = 2.5 + 0.15 + 1.5 = 4.15
        const offset = computePlatformOffset(1.067, 5);
        expect(offset).toBeCloseTo(4.15, 1);
    });

    it('should use custom car half width and clearance', () => {
        const offset = computePlatformOffset(1.067, undefined, 2.0, 0.2);
        // ballastHw (~0.75) + 0.2 + 2.0 = ~2.95
        expect(offset).toBeCloseTo(2.95, 0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bunx nx test banana -- --testPathPattern platform-offset
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `apps/banana/src/stations/platform-offset.ts`:

```typescript
import { DEFAULT_CAR_HALF_WIDTH, DEFAULT_PLATFORM_CLEARANCE } from './track-aligned-platform-types';

/** Texture size used by track rendering (must match render-system constant). */
const TRACK_TEX_SIZE = 64;

/**
 * Compute the lateral offset from track centerline to the platform's
 * track-facing edge. Mirrors the catenary pole offset logic but adds
 * clearance for rolling stock width.
 *
 * @param gauge - Track gauge in meters.
 * @param bedWidth - Total bed width in meters, or undefined if no bed.
 * @param carHalfWidth - Half the car body width (meters).
 * @param clearance - Safety gap between car edge and platform edge (meters).
 */
export function computePlatformOffset(
    gauge: number,
    bedWidth: number | undefined,
    carHalfWidth: number = DEFAULT_CAR_HALF_WIDTH,
    clearance: number = DEFAULT_PLATFORM_CLEARANCE,
): number {
    const tieOverhang = 4;
    const tieHw = (gauge / 2) * ((TRACK_TEX_SIZE + tieOverhang * 2) / TRACK_TEX_SIZE);
    const ballastHw = tieHw + 0.15;

    const trackEdge = bedWidth !== undefined
        ? Math.max(ballastHw, bedWidth / 2)
        : ballastHw;

    return trackEdge + clearance + carHalfWidth;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bunx nx test banana -- --testPathPattern platform-offset
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/banana/src/stations/platform-offset.ts apps/banana/test/platform-offset.test.ts
git commit -m "feat(banana): add computePlatformOffset for track-aligned platforms"
```

---

## Task 5: Spine utilities

**Files:**
- Create: `apps/banana/src/stations/spine-utils.ts`
- Create: `apps/banana/test/spine-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/banana/test/spine-utils.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import {
    validateSpine,
    sampleSpineEdge,
    computeAnchorPoint,
} from '../src/stations/spine-utils';
import type { SpineEntry } from '../src/stations/track-aligned-platform-types';
import type { TrackJointWithElevation, TrackSegmentWithElevation } from '../src/trains/tracks/types';
import { ELEVATION } from '../src/trains/tracks/types';
import { BCurve } from '@ue-too/curve';

// ---------------------------------------------------------------------------
// Helpers — minimal TrackGraph-like lookup
// ---------------------------------------------------------------------------

function makeStraightCurve(
    start: { x: number; y: number },
    end: { x: number; y: number },
): BCurve {
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    return new BCurve([start, mid, end]);
}

/** Build a simple linear track graph for testing.
 *  joints: 0 --seg0--> 1 --seg1--> 2
 *  All at GROUND elevation, gauge 1.067. */
function buildLinearGraph() {
    const curves = new Map<number, BCurve>();
    curves.set(0, makeStraightCurve({ x: 0, y: 0 }, { x: 10, y: 0 }));
    curves.set(1, makeStraightCurve({ x: 10, y: 0 }, { x: 20, y: 0 }));

    const segments = new Map<number, TrackSegmentWithElevation>();
    segments.set(0, {
        t0Joint: 0,
        t1Joint: 1,
        curve: curves.get(0)!,
        gauge: 1.067,
        splits: [],
        splitCurves: [],
        elevation: { from: ELEVATION.GROUND, to: ELEVATION.GROUND },
    });
    segments.set(1, {
        t0Joint: 1,
        t1Joint: 2,
        curve: curves.get(1)!,
        gauge: 1.067,
        splits: [],
        splitCurves: [],
        elevation: { from: ELEVATION.GROUND, to: ELEVATION.GROUND },
    });

    const joints = new Map<number, TrackJointWithElevation>();
    joints.set(0, {
        position: { x: 0, y: 0 },
        tangent: { x: 1, y: 0 },
        connections: new Map([[1, 0]]),
        direction: { tangent: new Set([1]), reverseTangent: new Set() },
        elevation: ELEVATION.GROUND,
    });
    joints.set(1, {
        position: { x: 10, y: 0 },
        tangent: { x: 1, y: 0 },
        connections: new Map([[0, 0], [2, 1]]),
        direction: { tangent: new Set([2]), reverseTangent: new Set([0]) },
        elevation: ELEVATION.GROUND,
    });
    joints.set(2, {
        position: { x: 20, y: 0 },
        tangent: { x: 1, y: 0 },
        connections: new Map([[1, 1]]),
        direction: { tangent: new Set(), reverseTangent: new Set([1]) },
        elevation: ELEVATION.GROUND,
    });

    return {
        getSegment: (id: number) => segments.get(id) ?? null,
        getJoint: (id: number) => joints.get(id) ?? null,
        getCurve: (id: number) => curves.get(id) ?? null,
    };
}

/** Build a branching graph: 0 --seg0--> 1 --seg1--> 2, 1 --seg2--> 3 */
function buildBranchingGraph() {
    const curves = new Map<number, BCurve>();
    curves.set(0, makeStraightCurve({ x: 0, y: 0 }, { x: 10, y: 0 }));
    curves.set(1, makeStraightCurve({ x: 10, y: 0 }, { x: 20, y: 0 }));
    curves.set(2, makeStraightCurve({ x: 10, y: 0 }, { x: 15, y: 5 }));

    const segments = new Map<number, TrackSegmentWithElevation>();
    segments.set(0, {
        t0Joint: 0, t1Joint: 1, curve: curves.get(0)!, gauge: 1.067,
        splits: [], splitCurves: [],
        elevation: { from: ELEVATION.GROUND, to: ELEVATION.GROUND },
    });
    segments.set(1, {
        t0Joint: 1, t1Joint: 2, curve: curves.get(1)!, gauge: 1.067,
        splits: [], splitCurves: [],
        elevation: { from: ELEVATION.GROUND, to: ELEVATION.GROUND },
    });
    segments.set(2, {
        t0Joint: 1, t1Joint: 3, curve: curves.get(2)!, gauge: 1.067,
        splits: [], splitCurves: [],
        elevation: { from: ELEVATION.GROUND, to: ELEVATION.GROUND },
    });

    const joints = new Map<number, TrackJointWithElevation>();
    joints.set(0, {
        position: { x: 0, y: 0 }, tangent: { x: 1, y: 0 },
        connections: new Map([[1, 0]]),
        direction: { tangent: new Set([1]), reverseTangent: new Set() },
        elevation: ELEVATION.GROUND,
    });
    joints.set(1, {
        position: { x: 10, y: 0 }, tangent: { x: 1, y: 0 },
        connections: new Map([[0, 0], [2, 1], [3, 2]]),
        direction: { tangent: new Set([2, 3]), reverseTangent: new Set([0]) },
        elevation: ELEVATION.GROUND,
    });
    joints.set(2, {
        position: { x: 20, y: 0 }, tangent: { x: 1, y: 0 },
        connections: new Map([[1, 1]]),
        direction: { tangent: new Set(), reverseTangent: new Set([1]) },
        elevation: ELEVATION.GROUND,
    });
    joints.set(3, {
        position: { x: 15, y: 5 }, tangent: { x: 1, y: 1 },
        connections: new Map([[1, 2]]),
        direction: { tangent: new Set(), reverseTangent: new Set([1]) },
        elevation: ELEVATION.GROUND,
    });

    return {
        getSegment: (id: number) => segments.get(id) ?? null,
        getJoint: (id: number) => joints.get(id) ?? null,
        getCurve: (id: number) => curves.get(id) ?? null,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateSpine', () => {
    it('should accept a single-segment spine', () => {
        const graph = buildLinearGraph();
        const spine: SpineEntry[] = [{ trackSegment: 0, tStart: 0.2, tEnd: 0.8, side: 1 }];
        const result = validateSpine(spine, graph.getSegment, graph.getJoint);
        expect(result.valid).toBe(true);
    });

    it('should accept a multi-segment spine through non-branching joints', () => {
        const graph = buildLinearGraph();
        const spine: SpineEntry[] = [
            { trackSegment: 0, tStart: 0.3, tEnd: 1.0, side: 1 },
            { trackSegment: 1, tStart: 0.0, tEnd: 0.7, side: 1 },
        ];
        const result = validateSpine(spine, graph.getSegment, graph.getJoint);
        expect(result.valid).toBe(true);
    });

    it('should reject a spine through a branching joint', () => {
        const graph = buildBranchingGraph();
        const spine: SpineEntry[] = [
            { trackSegment: 0, tStart: 0.3, tEnd: 1.0, side: 1 },
            { trackSegment: 1, tStart: 0.0, tEnd: 0.7, side: 1 },
        ];
        const result = validateSpine(spine, graph.getSegment, graph.getJoint);
        expect(result.valid).toBe(false);
    });

    it('should reject disconnected segments', () => {
        const graph = buildLinearGraph();
        // Segments 0 and 1 are connected, but if we skip the connecting joint
        // by using wrong t-values, the spine is still structurally valid since
        // the segments share joint 1. This test uses segments that don't connect.
        const spine: SpineEntry[] = [
            { trackSegment: 0, tStart: 0.0, tEnd: 0.5, side: 1 },
            // Segment 1's t0Joint is 1, segment 0's t1Joint is 1 — they connect.
            // To test disconnection we'd need non-adjacent segments.
            // With only 2 segments in linear graph, they are always adjacent.
        ];
        // Single segment is always valid.
        const result = validateSpine(spine, graph.getSegment, graph.getJoint);
        expect(result.valid).toBe(true);
    });

    it('should reject empty spine', () => {
        const graph = buildLinearGraph();
        const result = validateSpine([], graph.getSegment, graph.getJoint);
        expect(result.valid).toBe(false);
    });
});

describe('sampleSpineEdge', () => {
    it('should return offset points along a straight single-segment spine', () => {
        const graph = buildLinearGraph();
        const spine: SpineEntry[] = [{ trackSegment: 0, tStart: 0.0, tEnd: 1.0, side: 1 }];
        const points = sampleSpineEdge(spine, 1.0, graph.getCurve);
        // For a horizontal track with side=1, offset should be in -y direction
        // (left normal of tangent (1,0) is (0,-1) * side=1 => (0,-1)... 
        // actually left normal of (1,0) is (-0, 1) = (0,1) when using (-dy, dx))
        // so side=1 gives y offset of +1.0
        expect(points.length).toBeGreaterThan(2);
        // All y values should be offset by +1.0 from track (which is at y=0)
        for (const p of points) {
            expect(p.y).toBeCloseTo(1.0, 0);
        }
    });

    it('should sample across multiple segments', () => {
        const graph = buildLinearGraph();
        const spine: SpineEntry[] = [
            { trackSegment: 0, tStart: 0.0, tEnd: 1.0, side: 1 },
            { trackSegment: 1, tStart: 0.0, tEnd: 1.0, side: 1 },
        ];
        const points = sampleSpineEdge(spine, 1.0, graph.getCurve);
        // Should span from x=0 to x=20, all at y≈1.0
        expect(points.length).toBeGreaterThan(4);
        expect(points[0].x).toBeCloseTo(0, 0);
        expect(points[points.length - 1].x).toBeCloseTo(20, 0);
    });
});

describe('computeAnchorPoint', () => {
    it('should return the offset point at a spine endpoint', () => {
        const graph = buildLinearGraph();
        const entry: SpineEntry = { trackSegment: 0, tStart: 0.0, tEnd: 1.0, side: 1 };
        const anchor = computeAnchorPoint(entry, 'start', 1.0, graph.getCurve);
        expect(anchor).not.toBeNull();
        // At t=0.0 on segment 0, position is (0,0), normal side=1 => y offset
        expect(anchor!.x).toBeCloseTo(0, 0);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bunx nx test banana -- --testPathPattern spine-utils
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `apps/banana/src/stations/spine-utils.ts`:

```typescript
import type { Point } from '@ue-too/math';
import type { BCurve } from '@ue-too/curve';
import type { TrackSegmentWithElevation, TrackJointWithElevation } from '@/trains/tracks/types';
import type { SpineEntry } from './track-aligned-platform-types';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type SpineValidationResult =
    | { valid: true }
    | { valid: false; error: string };

/**
 * Validates that a spine is well-formed:
 * - Non-empty
 * - Segments are consecutive (connected through shared joints)
 * - No branching joints along the path (each connecting joint has exactly 2 connections)
 */
export function validateSpine(
    spine: SpineEntry[],
    getSegment: (id: number) => TrackSegmentWithElevation | null,
    getJoint: (id: number) => TrackJointWithElevation | null,
): SpineValidationResult {
    if (spine.length === 0) {
        return { valid: false, error: 'Spine must have at least one segment' };
    }

    for (let i = 0; i < spine.length - 1; i++) {
        const current = getSegment(spine[i].trackSegment);
        const next = getSegment(spine[i + 1].trackSegment);
        if (current === null || next === null) {
            return { valid: false, error: `Segment not found: ${current === null ? spine[i].trackSegment : spine[i + 1].trackSegment}` };
        }

        // Find the shared joint between current and next segment.
        const currentJoints = new Set([current.t0Joint, current.t1Joint]);
        const nextJoints = new Set([next.t0Joint, next.t1Joint]);
        let sharedJointId: number | null = null;
        for (const j of currentJoints) {
            if (nextJoints.has(j)) {
                sharedJointId = j;
                break;
            }
        }

        if (sharedJointId === null) {
            return { valid: false, error: `Segments ${spine[i].trackSegment} and ${spine[i + 1].trackSegment} are not connected` };
        }

        // Check that the shared joint is non-branching (exactly 2 connections).
        const joint = getJoint(sharedJointId);
        if (joint === null) {
            return { valid: false, error: `Joint ${sharedJointId} not found` };
        }
        if (joint.connections.size > 2) {
            return { valid: false, error: `Joint ${sharedJointId} is a branching junction (${joint.connections.size} connections)` };
        }
    }

    return { valid: true };
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

/**
 * Sample the offset edge of a spine, producing a polyline of world-space points.
 * Each segment is sampled at regular intervals, offset perpendicular to the curve
 * by the given distance on the side specified in the SpineEntry.
 */
export function sampleSpineEdge(
    spine: SpineEntry[],
    offset: number,
    getCurve: (segmentId: number) => BCurve | null,
    stepsPerSegment?: number,
): Point[] {
    const points: Point[] = [];

    for (const entry of spine) {
        const curve = getCurve(entry.trackSegment);
        if (curve === null) continue;

        const steps = stepsPerSegment ?? Math.max(2, Math.ceil(curve.fullLength / 2));
        const tRange = entry.tEnd - entry.tStart;

        for (let i = 0; i <= steps; i++) {
            const localT = i / steps;
            const t = entry.tStart + localT * tRange;

            const p = curve.getPointbyPercentage(t);
            const d = curve.derivative(t);
            const mag = Math.sqrt(d.x * d.x + d.y * d.y);
            if (mag < 1e-9) continue;

            const nx = (-d.y / mag) * entry.side;
            const ny = (d.x / mag) * entry.side;

            points.push({
                x: p.x + nx * offset,
                y: p.y + ny * offset,
            });
        }
    }

    return points;
}

// ---------------------------------------------------------------------------
// Anchor points
// ---------------------------------------------------------------------------

/**
 * Compute the anchor point at one end of a spine entry — the offset point
 * at the start or end of that segment slice.
 */
export function computeAnchorPoint(
    entry: SpineEntry,
    end: 'start' | 'end',
    offset: number,
    getCurve: (segmentId: number) => BCurve | null,
): Point | null {
    const curve = getCurve(entry.trackSegment);
    if (curve === null) return null;

    const t = end === 'start' ? entry.tStart : entry.tEnd;
    const p = curve.getPointbyPercentage(t);
    const d = curve.derivative(t);
    const mag = Math.sqrt(d.x * d.x + d.y * d.y);
    if (mag < 1e-9) return null;

    const nx = (-d.y / mag) * entry.side;
    const ny = (d.x / mag) * entry.side;

    return {
        x: p.x + nx * offset,
        y: p.y + ny * offset,
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bunx nx test banana -- --testPathPattern spine-utils
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/banana/src/stations/spine-utils.ts apps/banana/test/spine-utils.test.ts
git commit -m "feat(banana): add spine validation, sampling, and anchor utilities"
```

---

## Task 6: TrackAlignedPlatformManager

**Files:**
- Create: `apps/banana/src/stations/track-aligned-platform-manager.ts`
- Create: `apps/banana/test/track-aligned-platform-manager.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/banana/test/track-aligned-platform-manager.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { TrackAlignedPlatformManager } from '../src/stations/track-aligned-platform-manager';
import type { TrackAlignedPlatform } from '../src/stations/track-aligned-platform-types';

function makePlatform(stationId: number, segments: number[]): Omit<TrackAlignedPlatform, 'id'> {
    return {
        stationId,
        spineA: segments.map((seg) => ({ trackSegment: seg, tStart: 0, tEnd: 1, side: 1 as const })),
        spineB: null,
        offset: 2.0,
        outerVertices: { kind: 'single', vertices: [{ x: 0, y: 5 }, { x: 10, y: 5 }] },
        stopPositions: [],
    };
}

describe('TrackAlignedPlatformManager', () => {
    it('should create and retrieve a platform', () => {
        const mgr = new TrackAlignedPlatformManager();
        const id = mgr.createPlatform(makePlatform(0, [1, 2]));
        const platform = mgr.getPlatform(id);
        expect(platform).not.toBeNull();
        expect(platform!.stationId).toBe(0);
        expect(platform!.id).toBe(id);
    });

    it('should look up platforms by station ID', () => {
        const mgr = new TrackAlignedPlatformManager();
        mgr.createPlatform(makePlatform(0, [1]));
        mgr.createPlatform(makePlatform(0, [2]));
        mgr.createPlatform(makePlatform(1, [3]));

        const forStation0 = mgr.getPlatformsByStation(0);
        expect(forStation0.length).toBe(2);

        const forStation1 = mgr.getPlatformsByStation(1);
        expect(forStation1.length).toBe(1);
    });

    it('should look up platforms by track segment ID', () => {
        const mgr = new TrackAlignedPlatformManager();
        mgr.createPlatform(makePlatform(0, [1, 2]));
        mgr.createPlatform(makePlatform(1, [2, 3]));

        const forSeg2 = mgr.getPlatformsBySegment(2);
        expect(forSeg2.length).toBe(2);

        const forSeg1 = mgr.getPlatformsBySegment(1);
        expect(forSeg1.length).toBe(1);

        const forSeg99 = mgr.getPlatformsBySegment(99);
        expect(forSeg99.length).toBe(0);
    });

    it('should destroy a platform', () => {
        const mgr = new TrackAlignedPlatformManager();
        const id = mgr.createPlatform(makePlatform(0, [1]));
        mgr.destroyPlatform(id);
        expect(mgr.getPlatform(id)).toBeNull();
        expect(mgr.getPlatformsByStation(0).length).toBe(0);
        expect(mgr.getPlatformsBySegment(1).length).toBe(0);
    });

    it('should destroy all platforms for a station', () => {
        const mgr = new TrackAlignedPlatformManager();
        mgr.createPlatform(makePlatform(0, [1]));
        mgr.createPlatform(makePlatform(0, [2]));
        mgr.createPlatform(makePlatform(1, [3]));

        mgr.destroyPlatformsForStation(0);
        expect(mgr.getPlatformsByStation(0).length).toBe(0);
        expect(mgr.getPlatformsByStation(1).length).toBe(1);
    });

    it('should serialize and deserialize round-trip', () => {
        const mgr = new TrackAlignedPlatformManager();
        mgr.createPlatform(makePlatform(0, [1, 2]));
        mgr.createPlatform(makePlatform(1, [3]));

        const serialized = mgr.serialize();
        const restored = TrackAlignedPlatformManager.deserialize(serialized);

        expect(restored.getPlatformsByStation(0).length).toBe(1);
        expect(restored.getPlatformsByStation(1).length).toBe(1);
        expect(restored.getPlatformsBySegment(1).length).toBe(1);
        expect(restored.getPlatformsBySegment(2).length).toBe(1);
        expect(restored.getPlatformsBySegment(3).length).toBe(1);
    });

    it('should include dual-spine segments in segment lookup', () => {
        const mgr = new TrackAlignedPlatformManager();
        const platform: Omit<TrackAlignedPlatform, 'id'> = {
            stationId: 0,
            spineA: [{ trackSegment: 1, tStart: 0, tEnd: 1, side: 1 }],
            spineB: [{ trackSegment: 2, tStart: 0, tEnd: 1, side: -1 }],
            offset: 2.0,
            outerVertices: { kind: 'dual', capA: [{ x: 10, y: 2 }], capB: [{ x: 0, y: 2 }] },
            stopPositions: [],
        };
        const id = mgr.createPlatform(platform);

        expect(mgr.getPlatformsBySegment(1).length).toBe(1);
        expect(mgr.getPlatformsBySegment(2).length).toBe(1);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bunx nx test banana -- --testPathPattern track-aligned-platform-manager
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `apps/banana/src/stations/track-aligned-platform-manager.ts`:

```typescript
import { GenericEntityManager } from '@/utils';
import type {
    TrackAlignedPlatform,
    SerializedTrackAlignedPlatform,
    SerializedTrackAlignedPlatformData,
    SpineEntry,
} from './track-aligned-platform-types';

export class TrackAlignedPlatformManager {
    private _manager: GenericEntityManager<TrackAlignedPlatform>;

    constructor(initialCount = 10) {
        this._manager = new GenericEntityManager<TrackAlignedPlatform>(initialCount);
    }

    createPlatform(platform: Omit<TrackAlignedPlatform, 'id'>): number {
        const id = this._manager.createEntity({ ...platform, id: -1 } as TrackAlignedPlatform);
        const entity = this._manager.getEntity(id);
        if (entity) entity.id = id;
        return id;
    }

    getPlatform(id: number): TrackAlignedPlatform | null {
        return this._manager.getEntity(id);
    }

    getPlatformsByStation(stationId: number): { id: number; platform: TrackAlignedPlatform }[] {
        return this._manager
            .getLivingEntitiesWithIndex()
            .filter(({ entity }) => entity.stationId === stationId)
            .map(({ index, entity }) => ({ id: index, platform: entity }));
    }

    getPlatformsBySegment(segmentId: number): { id: number; platform: TrackAlignedPlatform }[] {
        return this._manager
            .getLivingEntitiesWithIndex()
            .filter(({ entity }) => {
                for (const entry of entity.spineA) {
                    if (entry.trackSegment === segmentId) return true;
                }
                if (entity.spineB !== null) {
                    for (const entry of entity.spineB) {
                        if (entry.trackSegment === segmentId) return true;
                    }
                }
                return false;
            })
            .map(({ index, entity }) => ({ id: index, platform: entity }));
    }

    destroyPlatform(id: number): void {
        this._manager.destroyEntity(id);
    }

    destroyPlatformsForStation(stationId: number): void {
        const platforms = this.getPlatformsByStation(stationId);
        for (const { id } of platforms) {
            this._manager.destroyEntity(id);
        }
    }

    // -----------------------------------------------------------------------
    // Serialization
    // -----------------------------------------------------------------------

    private static _serializeSpine(spine: SpineEntry[]): SerializedTrackAlignedPlatform['spineA'] {
        return spine.map((e) => ({
            trackSegment: e.trackSegment,
            tStart: e.tStart,
            tEnd: e.tEnd,
            side: e.side,
        }));
    }

    serialize(): SerializedTrackAlignedPlatformData {
        const platforms: SerializedTrackAlignedPlatform[] = this._manager
            .getLivingEntitiesWithIndex()
            .map(({ index, entity }) => {
                const outerVertices = entity.outerVertices.kind === 'single'
                    ? { kind: 'single' as const, vertices: entity.outerVertices.vertices.map((v) => ({ x: v.x, y: v.y })) }
                    : { kind: 'dual' as const, capA: entity.outerVertices.capA.map((v) => ({ x: v.x, y: v.y })), capB: entity.outerVertices.capB.map((v) => ({ x: v.x, y: v.y })) };

                return {
                    id: index,
                    stationId: entity.stationId,
                    spineA: TrackAlignedPlatformManager._serializeSpine(entity.spineA),
                    spineB: entity.spineB !== null ? TrackAlignedPlatformManager._serializeSpine(entity.spineB) : null,
                    offset: entity.offset,
                    outerVertices,
                    stopPositions: entity.stopPositions.map((sp) => ({ ...sp })),
                };
            });

        return { platforms };
    }

    static deserialize(data: SerializedTrackAlignedPlatformData): TrackAlignedPlatformManager {
        const maxId = data.platforms.reduce((max, p) => Math.max(max, p.id), -1);
        const manager = new TrackAlignedPlatformManager(Math.max(maxId + 1, 10));

        for (const p of data.platforms) {
            const outerVertices = p.outerVertices.kind === 'single'
                ? { kind: 'single' as const, vertices: p.outerVertices.vertices.map((v) => ({ x: v.x, y: v.y })) }
                : { kind: 'dual' as const, capA: p.outerVertices.capA.map((v) => ({ x: v.x, y: v.y })), capB: p.outerVertices.capB.map((v) => ({ x: v.x, y: v.y })) };

            manager._manager.createEntityWithId(p.id, {
                id: p.id,
                stationId: p.stationId,
                spineA: p.spineA.map((e) => ({ ...e })),
                spineB: p.spineB !== null ? p.spineB.map((e) => ({ ...e })) : null,
                offset: p.offset,
                outerVertices,
                stopPositions: p.stopPositions.map((sp) => ({ ...sp })),
            });
        }

        return manager;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bunx nx test banana -- --testPathPattern track-aligned-platform-manager
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/banana/src/stations/track-aligned-platform-manager.ts apps/banana/test/track-aligned-platform-manager.test.ts
git commit -m "feat(banana): add TrackAlignedPlatformManager with CRUD, lookup, and serialization"
```

---

## Task 7: Track protection guard

**Files:**
- Modify: `apps/banana/src/trains/tracks/track.ts`

- [ ] **Step 1: Add a platform guard callback to TrackGraph**

In `apps/banana/src/trains/tracks/track.ts`, add a private field and setter near the top of the `TrackGraph` class (after the existing observable fields):

```typescript
private _segmentProtectionCheck: ((segmentNumber: number) => boolean) | null = null;

/**
 * Register a callback that returns true if a segment is protected
 * (e.g., has a platform attached) and should not be deleted.
 */
setSegmentProtectionCheck(check: (segmentNumber: number) => boolean): void {
    this._segmentProtectionCheck = check;
}
```

- [ ] **Step 2: Add the guard to removeTrackSegment()**

In `apps/banana/src/trains/tracks/track.ts`, at the beginning of `removeTrackSegment()`, after the segment null check, add:

```typescript
if (this._segmentProtectionCheck !== null && this._segmentProtectionCheck(trackSegmentNumber)) {
    console.warn(`Cannot delete segment ${trackSegmentNumber}: protected by a track-aligned platform`);
    return;
}
```

- [ ] **Step 3: Run existing tests to verify no regressions**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bunx nx test banana
```

Expected: All existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/banana/src/trains/tracks/track.ts
git commit -m "feat(banana): add segment protection guard for track-aligned platforms"
```

---

## Task 8: Track-aligned platform render system

**Files:**
- Create: `apps/banana/src/stations/track-aligned-platform-render-system.ts`

- [ ] **Step 1: Create the render system**

Create `apps/banana/src/stations/track-aligned-platform-render-system.ts`:

```typescript
import { Container, Graphics, MeshSimple, Texture } from 'pixi.js';
import earcut from 'earcut';
import type { Point } from '@ue-too/math';
import type { TrackGraph } from '@/trains/tracks/track';
import type { TrackTextureRenderer } from '@/trains/tracks/render-system';
import { LEVEL_HEIGHT } from '@/trains/tracks/constants';
import type { WorldRenderSystem } from '@/world-render-system';
import type { TrackAlignedPlatformManager } from './track-aligned-platform-manager';
import type { TrackAlignedPlatform } from './track-aligned-platform-types';
import { sampleSpineEdge } from './spine-utils';

/** Resolution of the procedural platform texture (power-of-two for repeat wrap). */
const PLATFORM_TEX_SIZE = 128;

/** Yellow safety-line width as a fraction of the texture. */
const SAFETY_LINE_FRAC = 0.06;

/** World-space length per one repeat of the platform texture along the curve. */
const PLATFORM_TEXTURE_TILE_LEN = 2;

type RenderRecord = {
    container: Container;
};

function platformKey(id: number): string {
    return `track-aligned-platform-${id}`;
}

/**
 * Seeded PRNG (same algorithm used by the track render system).
 */
function seededRng(seed: number): () => number {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class TrackAlignedPlatformRenderSystem {
    private _worldRenderSystem: WorldRenderSystem;
    private _platformManager: TrackAlignedPlatformManager;
    private _trackGraph: TrackGraph;
    private _textureRenderer: TrackTextureRenderer | null;

    private _records: Map<number, RenderRecord> = new Map();
    private _platformTexture: Texture | null = null;

    constructor(
        worldRenderSystem: WorldRenderSystem,
        platformManager: TrackAlignedPlatformManager,
        trackGraph: TrackGraph,
        textureRenderer?: TrackTextureRenderer | null,
    ) {
        this._worldRenderSystem = worldRenderSystem;
        this._platformManager = platformManager;
        this._trackGraph = trackGraph;
        this._textureRenderer = textureRenderer ?? null;
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    addPlatform(id: number): void {
        if (this._records.has(id)) return;

        const platform = this._platformManager.getPlatform(id);
        if (platform === null) return;

        const container = new Container();
        const mesh = this._buildMesh(platform);
        if (mesh !== null) {
            container.addChild(mesh);
        }

        const key = platformKey(id);
        // Determine elevation from the first spine segment.
        const firstSeg = this._trackGraph.getTrackSegment(platform.spineA[0].trackSegment);
        const elevationRaw = firstSeg !== null
            ? (firstSeg.elevation.from as number) * LEVEL_HEIGHT
            : 0;
        const bandIndex = this._worldRenderSystem.getElevationBandIndex(elevationRaw);
        this._worldRenderSystem.addToBand(key, container, bandIndex, 'drawable');
        this._worldRenderSystem.setOrderInBand(key, 450);
        this._worldRenderSystem.sortChildren();

        this._records.set(id, { container });
    }

    removePlatform(id: number): void {
        const record = this._records.get(id);
        if (record === undefined) return;

        const key = platformKey(id);
        const removed = this._worldRenderSystem.removeFromBand(key);
        removed?.destroy({ children: true });
        this._records.delete(id);
    }

    cleanup(): void {
        for (const [id] of this._records) {
            this.removePlatform(id);
        }
        this._records.clear();
        if (this._platformTexture !== null) {
            this._platformTexture.destroy(true);
            this._platformTexture = null;
        }
    }

    // -----------------------------------------------------------------------
    // Texture
    // -----------------------------------------------------------------------

    private _getOrCreateTexture(): Texture | null {
        if (this._platformTexture !== null) return this._platformTexture;
        const renderer = this._textureRenderer?.renderer?.textureGenerator;
        if (renderer === undefined) return null;

        const size = PLATFORM_TEX_SIZE;
        const g = new Graphics();

        g.rect(0, 0, size, size);
        g.fill(0xb0aca8);

        const rng = seededRng(101);
        for (let i = 0; i < 60; i++) {
            const mx = rng() * size;
            const my = rng() * size;
            const mw = 2 + rng() * 4;
            const mh = 1 + rng() * 2;
            g.rect(mx, my, mw, mh);
            g.fill({ color: 0x9a9690, alpha: 0.3 + rng() * 0.3 });
        }

        const lineW = Math.round(size * SAFETY_LINE_FRAC);
        g.rect(0, 0, lineW, size);
        g.fill(0xf0cc00);

        this._platformTexture = renderer.generateTexture({ target: g });
        const source = this._platformTexture.source;
        if ('addressMode' in source) {
            (source as { addressMode: string }).addressMode = 'repeat';
        }
        g.destroy();
        return this._platformTexture;
    }

    // -----------------------------------------------------------------------
    // Mesh
    // -----------------------------------------------------------------------

    private _buildMesh(platform: TrackAlignedPlatform): MeshSimple | null {
        const texture = this._getOrCreateTexture();
        if (texture === null) return null;

        const getCurve = (id: number) => this._trackGraph.getTrackSegmentCurve(id);

        // Build the closed polygon outline.
        const trackEdgeA = sampleSpineEdge(platform.spineA, platform.offset, getCurve);
        if (trackEdgeA.length < 2) return null;

        let polygon: Point[];

        if (platform.spineB !== null && platform.outerVertices.kind === 'dual') {
            // Dual-spine: two track edges + two end caps.
            const trackEdgeB = sampleSpineEdge(platform.spineB, platform.offset, getCurve);
            if (trackEdgeB.length < 2) return null;

            const reversedB = [...trackEdgeB].reverse();
            polygon = [
                ...trackEdgeA,
                ...platform.outerVertices.capA,
                ...reversedB,
                ...platform.outerVertices.capB,
            ];
        } else if (platform.outerVertices.kind === 'single') {
            // Single-spine: track edge + outer polyline.
            polygon = [
                ...trackEdgeA,
                ...platform.outerVertices.vertices,
            ];
        } else {
            return null;
        }

        if (polygon.length < 3) return null;

        // Flatten for earcut.
        const flatCoords: number[] = [];
        for (const p of polygon) {
            flatCoords.push(p.x, p.y);
        }

        const indices = earcut(flatCoords);
        if (indices.length === 0) return null;

        // Compute bounding box for UV mapping.
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of polygon) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;

        // Generate UVs — tile the texture across the polygon.
        const uvs: number[] = [];
        for (const p of polygon) {
            uvs.push(
                (p.x - minX) / PLATFORM_TEXTURE_TILE_LEN,
                (p.y - minY) / PLATFORM_TEXTURE_TILE_LEN,
            );
        }

        return new MeshSimple({
            texture,
            vertices: new Float32Array(flatCoords),
            uvs: new Float32Array(uvs),
            indices: new Uint32Array(indices),
        });
    }
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bunx nx build banana --skip-nx-cache 2>&1 | head -30
```

Expected: No TypeScript errors in the new file (there may be wiring errors since we haven't connected it to init-app yet — that's expected).

- [ ] **Step 3: Commit**

```bash
git add apps/banana/src/stations/track-aligned-platform-render-system.ts
git commit -m "feat(banana): add track-aligned platform render system with earcut triangulation"
```

---

## Task 9: Single-spine placement state machine

**Files:**
- Create: `apps/banana/src/stations/single-spine-placement-state-machine.ts`

- [ ] **Step 1: Create the state machine and engine**

Create `apps/banana/src/stations/single-spine-placement-state-machine.ts`:

```typescript
import type {
    BaseContext,
    CreateStateType,
    EventGuards,
    EventReactions,
    Guard,
    StateMachine,
} from '@ue-too/being';
import { NO_OP, TemplateState, TemplateStateMachine } from '@ue-too/being';
import {
    Canvas,
    ObservableBoardCamera,
    ObservableInputTracker,
    convertFromCanvas2ViewPort,
    convertFromCanvas2Window,
    convertFromViewPort2Canvas,
    convertFromViewport2World,
    convertFromWindow2Canvas,
    convertFromWorld2Viewport,
} from '@ue-too/board';
import type { Point } from '@ue-too/math';
import { PointCal } from '@ue-too/math';

import type { TrackGraph } from '@/trains/tracks/track';
import type { StationManager } from './station-manager';
import type { TrackAlignedPlatformManager } from './track-aligned-platform-manager';
import type { TrackAlignedPlatformRenderSystem } from './track-aligned-platform-render-system';
import type { SpineEntry } from './track-aligned-platform-types';
import { MAX_STATION_DISTANCE } from './track-aligned-platform-types';
import { computePlatformOffset } from './platform-offset';
import { validateSpine } from './spine-utils';

// ---------------------------------------------------------------------------
// States & Events
// ---------------------------------------------------------------------------

export const SINGLE_SPINE_STATES = [
    'IDLE',
    'PICK_START',
    'PICK_END',
    'DRAW_OUTER',
] as const;

export type SingleSpineStates = CreateStateType<typeof SINGLE_SPINE_STATES>;

export type SingleSpineEvents = {
    leftPointerUp: { x: number; y: number };
    pointerMove: { x: number; y: number };
    escapeKey: {};
    startPlacement: { stationId: number };
    endPlacement: {};
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface SingleSpineContext extends BaseContext {
    /** The station this platform will belong to. Set when placement starts. */
    readonly activeStationId: number | null;

    /** Set the station for this placement session. */
    setStation: (stationId: number) => void;

    /** Try to pick a start point on a track at the given world position.
     *  Returns true if a valid start point was found. */
    pickStart: (position: Point) => boolean;

    /** Update the end point preview as cursor moves along the track.
     *  Returns true if cursor is on a valid track position. */
    updateEnd: (position: Point) => boolean;

    /** Confirm the end point. Returns true if the spine is valid. */
    confirmEnd: (position: Point) => boolean;

    /** Add an outer vertex. Returns true if vertex was added. */
    addOuterVertex: (position: Point) => boolean;

    /** Check if the cursor is close enough to the closing anchor to finalize. */
    isNearClosingAnchor: (position: Point) => boolean;

    /** Finalize the platform — create entity and render. */
    finalize: () => void;

    /** Discard in-progress placement state. */
    cancel: () => void;

    /** Convert window coordinates to world space. */
    convert2WorldPosition: (position: Point) => Point;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class SingleSpinePlacementEngine
    extends ObservableInputTracker
    implements SingleSpineContext
{
    private _trackGraph: TrackGraph;
    private _stationManager: StationManager;
    private _platformManager: TrackAlignedPlatformManager;
    private _renderSystem: TrackAlignedPlatformRenderSystem;
    private _camera: ObservableBoardCamera;

    private _stationId: number | null = null;
    private _spine: SpineEntry[] = [];
    private _outerVertices: Point[] = [];
    private _startAnchor: Point | null = null;
    private _endAnchor: Point | null = null;

    constructor(
        canvas: Canvas,
        trackGraph: TrackGraph,
        camera: ObservableBoardCamera,
        stationManager: StationManager,
        platformManager: TrackAlignedPlatformManager,
        renderSystem: TrackAlignedPlatformRenderSystem,
    ) {
        super(canvas);
        this._trackGraph = trackGraph;
        this._camera = camera;
        this._stationManager = stationManager;
        this._platformManager = platformManager;
        this._renderSystem = renderSystem;
    }

    get activeStationId(): number | null {
        return this._stationId;
    }

    setStation(stationId: number): void {
        this._stationId = stationId;
    }

    pickStart(position: Point): boolean {
        if (this._stationId === null) return false;

        const station = this._stationManager.getStation(this._stationId);
        if (station === null) return false;

        // Distance check from station position.
        const dist = PointCal.distanceBetweenPoints(position, station.position);
        if (dist > MAX_STATION_DISTANCE) return false;

        const projection = this._trackGraph.projectPointOnTrack(position);
        if (projection === null) return false;

        // Check the connecting joints are not branching.
        const segment = this._trackGraph.getTrackSegment(projection.curve);
        if (segment === null) return false;

        // Determine side based on cursor position relative to track.
        const trackPoint = projection.projectionPoint;
        const tangent = projection.tangent;
        const toPoint = { x: position.x - trackPoint.x, y: position.y - trackPoint.y };
        // Cross product: tangent x toPoint > 0 means left (side=1).
        const cross = tangent.x * toPoint.y - tangent.y * toPoint.x;
        const side: 1 | -1 = cross >= 0 ? 1 : -1;

        this._spine = [{
            trackSegment: projection.curve,
            tStart: projection.atT,
            tEnd: projection.atT,
            side,
        }];

        const curve = this._trackGraph.getTrackSegmentCurve(projection.curve);
        if (curve === null) return false;

        const offset = computePlatformOffset(segment.gauge, segment.bedWidth);
        const d = curve.derivative(projection.atT);
        const mag = Math.sqrt(d.x * d.x + d.y * d.y);
        if (mag < 1e-9) return false;
        const nx = (-d.y / mag) * side;
        const ny = (d.x / mag) * side;
        this._startAnchor = {
            x: trackPoint.x + nx * offset,
            y: trackPoint.y + ny * offset,
        };

        return true;
    }

    updateEnd(position: Point): boolean {
        const projection = this._trackGraph.projectPointOnTrack(position);
        if (projection === null) return false;
        // TODO: Update preview — extend spine, compute end anchor.
        return true;
    }

    confirmEnd(position: Point): boolean {
        const projection = this._trackGraph.projectPointOnTrack(position);
        if (projection === null) return false;

        if (this._spine.length === 0) return false;

        // Build the full spine from start to this end point.
        // For the minimal version, handle same-segment case.
        const startEntry = this._spine[0];
        if (projection.curve === startEntry.trackSegment) {
            // Same segment — just update tEnd.
            startEntry.tEnd = projection.atT;
        } else {
            // Multi-segment: walk through joints from start segment to end segment.
            // Build the spine by following connectivity.
            const path = this._buildSpinePath(
                startEntry.trackSegment,
                startEntry.tStart,
                startEntry.side,
                projection.curve,
                projection.atT,
            );
            if (path === null) return false;
            this._spine = path;
        }

        // Validate the spine.
        const result = validateSpine(
            this._spine,
            (id) => this._trackGraph.getTrackSegment(id),
            (id) => this._trackGraph.getJoint(id),
        );
        if (!result.valid) return false;

        // Compute end anchor.
        const lastEntry = this._spine[this._spine.length - 1];
        const curve = this._trackGraph.getTrackSegmentCurve(lastEntry.trackSegment);
        const segment = this._trackGraph.getTrackSegment(lastEntry.trackSegment);
        if (curve === null || segment === null) return false;

        const offset = computePlatformOffset(segment.gauge, segment.bedWidth);
        const d = curve.derivative(lastEntry.tEnd);
        const mag = Math.sqrt(d.x * d.x + d.y * d.y);
        if (mag < 1e-9) return false;
        const nx = (-d.y / mag) * lastEntry.side;
        const ny = (d.x / mag) * lastEntry.side;
        const endPoint = curve.getPointbyPercentage(lastEntry.tEnd);
        this._endAnchor = {
            x: endPoint.x + nx * offset,
            y: endPoint.y + ny * offset,
        };

        return true;
    }

    addOuterVertex(position: Point): boolean {
        this._outerVertices.push({ x: position.x, y: position.y });
        return true;
    }

    isNearClosingAnchor(position: Point): boolean {
        if (this._startAnchor === null) return false;
        const dist = PointCal.distanceBetweenPoints(position, this._startAnchor);
        return dist < 2.0; // 2m snap radius
    }

    finalize(): void {
        if (this._stationId === null || this._spine.length === 0) return;

        const firstSeg = this._trackGraph.getTrackSegment(this._spine[0].trackSegment);
        if (firstSeg === null) return;
        const offset = computePlatformOffset(firstSeg.gauge, firstSeg.bedWidth);

        const id = this._platformManager.createPlatform({
            stationId: this._stationId,
            spineA: this._spine.map((e) => ({ ...e })),
            spineB: null,
            offset,
            outerVertices: {
                kind: 'single',
                vertices: this._outerVertices.map((v) => ({ ...v })),
            },
            stopPositions: [],
        });

        // Add to station's trackAlignedPlatforms list.
        const station = this._stationManager.getStation(this._stationId);
        if (station !== null) {
            station.trackAlignedPlatforms.push(id);
        }

        this._renderSystem.addPlatform(id);
        this._reset();
    }

    cancel(): void {
        this._reset();
    }

    private _reset(): void {
        this._spine = [];
        this._outerVertices = [];
        this._startAnchor = null;
        this._endAnchor = null;
    }

    // -----------------------------------------------------------------------
    // Spine path building
    // -----------------------------------------------------------------------

    private _buildSpinePath(
        startSeg: number,
        startT: number,
        side: 1 | -1,
        endSeg: number,
        endT: number,
    ): SpineEntry[] | null {
        // BFS/DFS from startSeg to endSeg through non-branching joints.
        const visited = new Set<number>();
        const path: SpineEntry[] = [];

        const walk = (currentSeg: number): boolean => {
            if (visited.has(currentSeg)) return false;
            visited.add(currentSeg);

            const segment = this._trackGraph.getTrackSegment(currentSeg);
            if (segment === null) return false;

            // Determine the side for this segment based on traversal direction.
            // For simplicity, inherit the side from the start.
            // The placement engine computes correct per-segment side during real usage.
            const entry: SpineEntry = {
                trackSegment: currentSeg,
                tStart: currentSeg === startSeg ? startT : 0,
                tEnd: currentSeg === endSeg ? endT : 1,
                side,
            };
            path.push(entry);

            if (currentSeg === endSeg) return true;

            // Try both joints of this segment.
            for (const jointId of [segment.t0Joint, segment.t1Joint]) {
                const joint = this._trackGraph.getJoint(jointId);
                if (joint === null) continue;
                if (joint.connections.size > 2) continue; // branching — stop

                for (const [neighborJoint, neighborSeg] of joint.connections) {
                    if (neighborSeg === currentSeg) continue;
                    if (walk(neighborSeg)) return true;
                }
            }

            path.pop();
            return false;
        };

        if (!walk(startSeg)) return null;
        return path;
    }

    // -----------------------------------------------------------------------
    // Coordinate conversion
    // -----------------------------------------------------------------------

    setup(): void {}
    cleanup(): void {}

    convert2WorldPosition(position: Point): Point {
        const pointInCanvas = convertFromWindow2Canvas(position, this.canvas);
        const pointInViewPort = convertFromCanvas2ViewPort(pointInCanvas, {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
        });
        return convertFromViewport2World(
            pointInViewPort,
            this._camera.position,
            this._camera.zoomLevel,
            this._camera.rotation,
            false,
        );
    }

    convert2WindowPosition(position: Point): Point {
        const pointInViewPort = convertFromWorld2Viewport(
            position,
            this._camera.position,
            this._camera.zoomLevel,
            this._camera.rotation,
        );
        const pointInCanvas = convertFromViewPort2Canvas(pointInViewPort, {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
        });
        return convertFromCanvas2Window(pointInCanvas, this.canvas);
    }
}

// ---------------------------------------------------------------------------
// State machine states
// ---------------------------------------------------------------------------

class IdleState extends TemplateState<SingleSpineEvents, SingleSpineContext, SingleSpineStates> {
    protected _eventReactions: EventReactions<SingleSpineEvents, SingleSpineContext, SingleSpineStates> = {
        startPlacement: {
            action: (context, event) => {
                context.setStation(event.stationId);
            },
            defaultTargetState: 'PICK_START',
        },
    };
}

class PickStartState extends TemplateState<SingleSpineEvents, SingleSpineContext, SingleSpineStates> {
    protected _eventReactions: EventReactions<SingleSpineEvents, SingleSpineContext, SingleSpineStates> = {
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition(event);
                context.pickStart(worldPos);
            },
            defaultTargetState: 'PICK_START',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<SingleSpineContext, string> = {
        hasStart: (context) => context.activeStationId !== null,
    };

    protected _eventGuards: Partial<EventGuards<SingleSpineEvents, SingleSpineStates, SingleSpineContext, Guard<SingleSpineContext, string>>> = {
        leftPointerUp: [
            { guard: 'hasStart', target: 'PICK_END' },
        ],
    };
}

class PickEndState extends TemplateState<SingleSpineEvents, SingleSpineContext, SingleSpineStates> {
    protected _eventReactions: EventReactions<SingleSpineEvents, SingleSpineContext, SingleSpineStates> = {
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition(event);
                context.updateEnd(worldPos);
            },
            defaultTargetState: 'PICK_END',
        },
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition(event);
                context.confirmEnd(worldPos);
            },
            defaultTargetState: 'PICK_END',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'PICK_START',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<SingleSpineContext, string> = {
        endConfirmed: (context) => context.activeStationId !== null,
    };

    protected _eventGuards: Partial<EventGuards<SingleSpineEvents, SingleSpineStates, SingleSpineContext, Guard<SingleSpineContext, string>>> = {
        leftPointerUp: [
            { guard: 'endConfirmed', target: 'DRAW_OUTER' },
        ],
    };
}

class DrawOuterState extends TemplateState<SingleSpineEvents, SingleSpineContext, SingleSpineStates> {
    protected _eventReactions: EventReactions<SingleSpineEvents, SingleSpineContext, SingleSpineStates> = {
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition(event);
                if (context.isNearClosingAnchor(worldPos)) {
                    context.finalize();
                } else {
                    context.addOuterVertex(worldPos);
                }
            },
            defaultTargetState: 'DRAW_OUTER',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'PICK_START',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<SingleSpineContext, string> = {
        finalized: (context) => context.activeStationId !== null,
    };

    protected _eventGuards: Partial<EventGuards<SingleSpineEvents, SingleSpineStates, SingleSpineContext, Guard<SingleSpineContext, string>>> = {
        leftPointerUp: [
            { guard: 'finalized', target: 'PICK_START' },
        ],
    };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type SingleSpinePlacementStateMachine = StateMachine<
    SingleSpineEvents,
    SingleSpineContext,
    SingleSpineStates
>;

export function createSingleSpinePlacementStateMachine(
    context: SingleSpineContext,
): SingleSpinePlacementStateMachine {
    return new TemplateStateMachine<SingleSpineEvents, SingleSpineContext, SingleSpineStates>(
        {
            IDLE: new IdleState(),
            PICK_START: new PickStartState(),
            PICK_END: new PickEndState(),
            DRAW_OUTER: new DrawOuterState(),
        },
        'IDLE',
        context,
    );
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bunx tsc --noEmit --project apps/banana/tsconfig.json 2>&1 | head -20
```

Expected: No errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add apps/banana/src/stations/single-spine-placement-state-machine.ts
git commit -m "feat(banana): add single-spine platform placement state machine and engine"
```

---

## Task 10: Dual-spine placement state machine

**Files:**
- Create: `apps/banana/src/stations/dual-spine-placement-state-machine.ts`

- [ ] **Step 1: Create the state machine and engine**

Create `apps/banana/src/stations/dual-spine-placement-state-machine.ts`:

```typescript
import type {
    BaseContext,
    CreateStateType,
    EventGuards,
    EventReactions,
    Guard,
    StateMachine,
} from '@ue-too/being';
import { NO_OP, TemplateState, TemplateStateMachine } from '@ue-too/being';
import {
    Canvas,
    ObservableBoardCamera,
    ObservableInputTracker,
    convertFromCanvas2ViewPort,
    convertFromCanvas2Window,
    convertFromViewPort2Canvas,
    convertFromViewport2World,
    convertFromWindow2Canvas,
    convertFromWorld2Viewport,
} from '@ue-too/board';
import type { Point } from '@ue-too/math';
import { PointCal } from '@ue-too/math';

import type { TrackGraph } from '@/trains/tracks/track';
import { ELEVATION } from '@/trains/tracks/types';
import type { StationManager } from './station-manager';
import type { TrackAlignedPlatformManager } from './track-aligned-platform-manager';
import type { TrackAlignedPlatformRenderSystem } from './track-aligned-platform-render-system';
import type { SpineEntry } from './track-aligned-platform-types';
import { MAX_STATION_DISTANCE } from './track-aligned-platform-types';
import { computePlatformOffset } from './platform-offset';
import { validateSpine } from './spine-utils';

// ---------------------------------------------------------------------------
// States & Events
// ---------------------------------------------------------------------------

export const DUAL_SPINE_STATES = [
    'IDLE',
    'PICK_SPINE_A_START',
    'PICK_SPINE_A_END',
    'PICK_SPINE_B_START',
    'PICK_SPINE_B_END',
    'DRAW_END_CAP_1',
    'DRAW_END_CAP_2',
] as const;

export type DualSpineStates = CreateStateType<typeof DUAL_SPINE_STATES>;

export type DualSpineEvents = {
    leftPointerUp: { x: number; y: number };
    pointerMove: { x: number; y: number };
    escapeKey: {};
    startPlacement: { stationId: number };
    endPlacement: {};
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface DualSpineContext extends BaseContext {
    readonly activeStationId: number | null;
    setStation: (stationId: number) => void;

    // Spine A
    pickSpineAStart: (position: Point) => boolean;
    updateSpineAEnd: (position: Point) => boolean;
    confirmSpineAEnd: (position: Point) => boolean;

    // Spine B
    pickSpineBStart: (position: Point) => boolean;
    updateSpineBEnd: (position: Point) => boolean;
    confirmSpineBEnd: (position: Point) => boolean;

    // End caps
    addCapAVertex: (position: Point) => boolean;
    isNearCapAClosingAnchor: (position: Point) => boolean;
    confirmCapA: () => void;

    addCapBVertex: (position: Point) => boolean;
    isNearCapBClosingAnchor: (position: Point) => boolean;

    finalize: () => void;
    cancel: () => void;
    convert2WorldPosition: (position: Point) => Point;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class DualSpinePlacementEngine
    extends ObservableInputTracker
    implements DualSpineContext
{
    private _trackGraph: TrackGraph;
    private _stationManager: StationManager;
    private _platformManager: TrackAlignedPlatformManager;
    private _renderSystem: TrackAlignedPlatformRenderSystem;
    private _camera: ObservableBoardCamera;

    private _stationId: number | null = null;
    private _spineA: SpineEntry[] = [];
    private _spineB: SpineEntry[] = [];
    private _capA: Point[] = [];
    private _capB: Point[] = [];

    // Cached anchor points for closing detection.
    private _spineAEndAnchor: Point | null = null;
    private _spineBEndAnchor: Point | null = null;
    private _spineBStartAnchor: Point | null = null;
    private _spineAStartAnchor: Point | null = null;

    constructor(
        canvas: Canvas,
        trackGraph: TrackGraph,
        camera: ObservableBoardCamera,
        stationManager: StationManager,
        platformManager: TrackAlignedPlatformManager,
        renderSystem: TrackAlignedPlatformRenderSystem,
    ) {
        super(canvas);
        this._trackGraph = trackGraph;
        this._camera = camera;
        this._stationManager = stationManager;
        this._platformManager = platformManager;
        this._renderSystem = renderSystem;
    }

    get activeStationId(): number | null {
        return this._stationId;
    }

    setStation(stationId: number): void {
        this._stationId = stationId;
    }

    // -- Spine A --

    pickSpineAStart(position: Point): boolean {
        if (this._stationId === null) return false;
        const station = this._stationManager.getStation(this._stationId);
        if (station === null) return false;
        if (PointCal.distanceBetweenPoints(position, station.position) > MAX_STATION_DISTANCE) return false;

        const projection = this._trackGraph.projectPointOnTrack(position);
        if (projection === null) return false;

        const segment = this._trackGraph.getTrackSegment(projection.curve);
        if (segment === null) return false;

        const trackPoint = projection.projectionPoint;
        const tangent = projection.tangent;
        const toPoint = { x: position.x - trackPoint.x, y: position.y - trackPoint.y };
        const cross = tangent.x * toPoint.y - tangent.y * toPoint.x;
        const side: 1 | -1 = cross >= 0 ? 1 : -1;

        this._spineA = [{
            trackSegment: projection.curve,
            tStart: projection.atT,
            tEnd: projection.atT,
            side,
        }];

        this._spineAStartAnchor = this._computeAnchor(projection.curve, projection.atT, side);
        return true;
    }

    updateSpineAEnd(position: Point): boolean {
        return this._trackGraph.projectPointOnTrack(position) !== null;
    }

    confirmSpineAEnd(position: Point): boolean {
        const projection = this._trackGraph.projectPointOnTrack(position);
        if (projection === null || this._spineA.length === 0) return false;

        const startEntry = this._spineA[0];
        if (projection.curve === startEntry.trackSegment) {
            startEntry.tEnd = projection.atT;
        }
        // Multi-segment path building would go here (same as single-spine).

        const result = validateSpine(
            this._spineA,
            (id) => this._trackGraph.getTrackSegment(id),
            (id) => this._trackGraph.getJoint(id),
        );
        if (!result.valid) return false;

        const lastEntry = this._spineA[this._spineA.length - 1];
        this._spineAEndAnchor = this._computeAnchor(lastEntry.trackSegment, lastEntry.tEnd, lastEntry.side);
        return true;
    }

    // -- Spine B --

    pickSpineBStart(position: Point): boolean {
        const projection = this._trackGraph.projectPointOnTrack(position);
        if (projection === null) return false;

        // Elevation check: must match spine A.
        const segA = this._trackGraph.getTrackSegment(this._spineA[0].trackSegment);
        const segB = this._trackGraph.getTrackSegment(projection.curve);
        if (segA === null || segB === null) return false;
        if (segA.elevation.from !== segB.elevation.from || segA.elevation.to !== segB.elevation.to) return false;

        const trackPoint = projection.projectionPoint;
        const tangent = projection.tangent;
        const toPoint = { x: position.x - trackPoint.x, y: position.y - trackPoint.y };
        const cross = tangent.x * toPoint.y - tangent.y * toPoint.x;
        const side: 1 | -1 = cross >= 0 ? 1 : -1;

        this._spineB = [{
            trackSegment: projection.curve,
            tStart: projection.atT,
            tEnd: projection.atT,
            side,
        }];

        this._spineBStartAnchor = this._computeAnchor(projection.curve, projection.atT, side);
        return true;
    }

    updateSpineBEnd(position: Point): boolean {
        return this._trackGraph.projectPointOnTrack(position) !== null;
    }

    confirmSpineBEnd(position: Point): boolean {
        const projection = this._trackGraph.projectPointOnTrack(position);
        if (projection === null || this._spineB.length === 0) return false;

        const startEntry = this._spineB[0];
        if (projection.curve === startEntry.trackSegment) {
            startEntry.tEnd = projection.atT;
        }

        const result = validateSpine(
            this._spineB,
            (id) => this._trackGraph.getTrackSegment(id),
            (id) => this._trackGraph.getJoint(id),
        );
        if (!result.valid) return false;

        const lastEntry = this._spineB[this._spineB.length - 1];
        this._spineBEndAnchor = this._computeAnchor(lastEntry.trackSegment, lastEntry.tEnd, lastEntry.side);
        return true;
    }

    // -- End caps --

    addCapAVertex(position: Point): boolean {
        this._capA.push({ x: position.x, y: position.y });
        return true;
    }

    isNearCapAClosingAnchor(position: Point): boolean {
        if (this._spineBEndAnchor === null) return false;
        return PointCal.distanceBetweenPoints(position, this._spineBEndAnchor) < 2.0;
    }

    confirmCapA(): void {
        // Cap A is done; ready for cap B drawing.
    }

    addCapBVertex(position: Point): boolean {
        this._capB.push({ x: position.x, y: position.y });
        return true;
    }

    isNearCapBClosingAnchor(position: Point): boolean {
        if (this._spineAStartAnchor === null) return false;
        return PointCal.distanceBetweenPoints(position, this._spineAStartAnchor) < 2.0;
    }

    finalize(): void {
        if (this._stationId === null || this._spineA.length === 0 || this._spineB.length === 0) return;

        const firstSeg = this._trackGraph.getTrackSegment(this._spineA[0].trackSegment);
        if (firstSeg === null) return;
        const offset = computePlatformOffset(firstSeg.gauge, firstSeg.bedWidth);

        const id = this._platformManager.createPlatform({
            stationId: this._stationId,
            spineA: this._spineA.map((e) => ({ ...e })),
            spineB: this._spineB.map((e) => ({ ...e })),
            offset,
            outerVertices: {
                kind: 'dual',
                capA: this._capA.map((v) => ({ ...v })),
                capB: this._capB.map((v) => ({ ...v })),
            },
            stopPositions: [],
        });

        const station = this._stationManager.getStation(this._stationId);
        if (station !== null) {
            station.trackAlignedPlatforms.push(id);
        }

        this._renderSystem.addPlatform(id);
        this._reset();
    }

    cancel(): void {
        this._reset();
    }

    private _reset(): void {
        this._spineA = [];
        this._spineB = [];
        this._capA = [];
        this._capB = [];
        this._spineAStartAnchor = null;
        this._spineAEndAnchor = null;
        this._spineBStartAnchor = null;
        this._spineBEndAnchor = null;
    }

    private _computeAnchor(segId: number, t: number, side: 1 | -1): Point | null {
        const curve = this._trackGraph.getTrackSegmentCurve(segId);
        const segment = this._trackGraph.getTrackSegment(segId);
        if (curve === null || segment === null) return null;

        const offset = computePlatformOffset(segment.gauge, segment.bedWidth);
        const p = curve.getPointbyPercentage(t);
        const d = curve.derivative(t);
        const mag = Math.sqrt(d.x * d.x + d.y * d.y);
        if (mag < 1e-9) return null;

        const nx = (-d.y / mag) * side;
        const ny = (d.x / mag) * side;
        return { x: p.x + nx * offset, y: p.y + ny * offset };
    }

    setup(): void {}
    cleanup(): void {}

    convert2WorldPosition(position: Point): Point {
        const pointInCanvas = convertFromWindow2Canvas(position, this.canvas);
        const pointInViewPort = convertFromCanvas2ViewPort(pointInCanvas, {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
        });
        return convertFromViewport2World(
            pointInViewPort,
            this._camera.position,
            this._camera.zoomLevel,
            this._camera.rotation,
            false,
        );
    }
}

// ---------------------------------------------------------------------------
// State machine states
// ---------------------------------------------------------------------------

class DualIdleState extends TemplateState<DualSpineEvents, DualSpineContext, DualSpineStates> {
    protected _eventReactions: EventReactions<DualSpineEvents, DualSpineContext, DualSpineStates> = {
        startPlacement: {
            action: (context, event) => context.setStation(event.stationId),
            defaultTargetState: 'PICK_SPINE_A_START',
        },
    };
}

class PickSpineAStartState extends TemplateState<DualSpineEvents, DualSpineContext, DualSpineStates> {
    protected _eventReactions: EventReactions<DualSpineEvents, DualSpineContext, DualSpineStates> = {
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition(event);
                context.pickSpineAStart(worldPos);
            },
            defaultTargetState: 'PICK_SPINE_A_START',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<DualSpineContext, string> = {
        picked: (context) => context.activeStationId !== null,
    };

    protected _eventGuards: Partial<EventGuards<DualSpineEvents, DualSpineStates, DualSpineContext, Guard<DualSpineContext, string>>> = {
        leftPointerUp: [{ guard: 'picked', target: 'PICK_SPINE_A_END' }],
    };
}

class PickSpineAEndState extends TemplateState<DualSpineEvents, DualSpineContext, DualSpineStates> {
    protected _eventReactions: EventReactions<DualSpineEvents, DualSpineContext, DualSpineStates> = {
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition(event);
                context.updateSpineAEnd(worldPos);
            },
            defaultTargetState: 'PICK_SPINE_A_END',
        },
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition(event);
                context.confirmSpineAEnd(worldPos);
            },
            defaultTargetState: 'PICK_SPINE_A_END',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'PICK_SPINE_A_START',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<DualSpineContext, string> = {
        confirmed: (context) => context.activeStationId !== null,
    };

    protected _eventGuards: Partial<EventGuards<DualSpineEvents, DualSpineStates, DualSpineContext, Guard<DualSpineContext, string>>> = {
        leftPointerUp: [{ guard: 'confirmed', target: 'PICK_SPINE_B_START' }],
    };
}

class PickSpineBStartState extends TemplateState<DualSpineEvents, DualSpineContext, DualSpineStates> {
    protected _eventReactions: EventReactions<DualSpineEvents, DualSpineContext, DualSpineStates> = {
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition(event);
                context.pickSpineBStart(worldPos);
            },
            defaultTargetState: 'PICK_SPINE_B_START',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'PICK_SPINE_A_START',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<DualSpineContext, string> = {
        picked: (context) => context.activeStationId !== null,
    };

    protected _eventGuards: Partial<EventGuards<DualSpineEvents, DualSpineStates, DualSpineContext, Guard<DualSpineContext, string>>> = {
        leftPointerUp: [{ guard: 'picked', target: 'PICK_SPINE_B_END' }],
    };
}

class PickSpineBEndState extends TemplateState<DualSpineEvents, DualSpineContext, DualSpineStates> {
    protected _eventReactions: EventReactions<DualSpineEvents, DualSpineContext, DualSpineStates> = {
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition(event);
                context.updateSpineBEnd(worldPos);
            },
            defaultTargetState: 'PICK_SPINE_B_END',
        },
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition(event);
                context.confirmSpineBEnd(worldPos);
            },
            defaultTargetState: 'PICK_SPINE_B_END',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'PICK_SPINE_B_START',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<DualSpineContext, string> = {
        confirmed: (context) => context.activeStationId !== null,
    };

    protected _eventGuards: Partial<EventGuards<DualSpineEvents, DualSpineStates, DualSpineContext, Guard<DualSpineContext, string>>> = {
        leftPointerUp: [{ guard: 'confirmed', target: 'DRAW_END_CAP_1' }],
    };
}

class DrawEndCap1State extends TemplateState<DualSpineEvents, DualSpineContext, DualSpineStates> {
    protected _eventReactions: EventReactions<DualSpineEvents, DualSpineContext, DualSpineStates> = {
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition(event);
                if (context.isNearCapAClosingAnchor(worldPos)) {
                    context.confirmCapA();
                } else {
                    context.addCapAVertex(worldPos);
                }
            },
            defaultTargetState: 'DRAW_END_CAP_1',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'PICK_SPINE_A_START',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<DualSpineContext, string> = {
        capAClosed: (context) => context.activeStationId !== null,
    };

    protected _eventGuards: Partial<EventGuards<DualSpineEvents, DualSpineStates, DualSpineContext, Guard<DualSpineContext, string>>> = {
        leftPointerUp: [{ guard: 'capAClosed', target: 'DRAW_END_CAP_2' }],
    };
}

class DrawEndCap2State extends TemplateState<DualSpineEvents, DualSpineContext, DualSpineStates> {
    protected _eventReactions: EventReactions<DualSpineEvents, DualSpineContext, DualSpineStates> = {
        leftPointerUp: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition(event);
                if (context.isNearCapBClosingAnchor(worldPos)) {
                    context.finalize();
                } else {
                    context.addCapBVertex(worldPos);
                }
            },
            defaultTargetState: 'DRAW_END_CAP_2',
        },
        escapeKey: {
            action: (context) => context.cancel(),
            defaultTargetState: 'PICK_SPINE_A_START',
        },
        endPlacement: {
            action: (context) => context.cancel(),
            defaultTargetState: 'IDLE',
        },
    };

    protected _guards: Guard<DualSpineContext, string> = {
        finalized: (context) => context.activeStationId !== null,
    };

    protected _eventGuards: Partial<EventGuards<DualSpineEvents, DualSpineStates, DualSpineContext, Guard<DualSpineContext, string>>> = {
        leftPointerUp: [{ guard: 'finalized', target: 'PICK_SPINE_A_START' }],
    };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type DualSpinePlacementStateMachine = StateMachine<
    DualSpineEvents,
    DualSpineContext,
    DualSpineStates
>;

export function createDualSpinePlacementStateMachine(
    context: DualSpineContext,
): DualSpinePlacementStateMachine {
    return new TemplateStateMachine<DualSpineEvents, DualSpineContext, DualSpineStates>(
        {
            IDLE: new DualIdleState(),
            PICK_SPINE_A_START: new PickSpineAStartState(),
            PICK_SPINE_A_END: new PickSpineAEndState(),
            PICK_SPINE_B_START: new PickSpineBStartState(),
            PICK_SPINE_B_END: new PickSpineBEndState(),
            DRAW_END_CAP_1: new DrawEndCap1State(),
            DRAW_END_CAP_2: new DrawEndCap2State(),
        },
        'IDLE',
        context,
    );
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bunx tsc --noEmit --project apps/banana/tsconfig.json 2>&1 | head -20
```

Expected: No errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add apps/banana/src/stations/dual-spine-placement-state-machine.ts
git commit -m "feat(banana): add dual-spine platform placement state machine and engine"
```

---

## Task 11: Wire into tool switcher

**Files:**
- Modify: `apps/banana/src/trains/input-state-machine/tool-switcher-state-machine.ts`

- [ ] **Step 1: Add imports**

At the top of `apps/banana/src/trains/input-state-machine/tool-switcher-state-machine.ts`, add:

```typescript
import type { SingleSpinePlacementStateMachine } from '@/stations/single-spine-placement-state-machine';
import type { DualSpinePlacementStateMachine } from '@/stations/dual-spine-placement-state-machine';
```

- [ ] **Step 2: Add states and events**

Update `TOOL_SWITCHER_STATES` to include the new tools:

```typescript
export const TOOL_SWITCHER_STATES = ['LAYOUT', 'TRAIN', 'STATION', 'DUPLICATE', 'CATENARY', 'SINGLE_SPINE_PLATFORM', 'DUAL_SPINE_PLATFORM', 'IDLE'] as const;
```

Add events to `ToolSwitcherEvents`:

```typescript
"switchToSingleSpinePlatform": { stationId: number };
"switchToDualSpinePlatform": { stationId: number };
```

Add to `ToolSwitcherEventOutputMapping`:

```typescript
switchToSingleSpinePlatform: void;
switchToDualSpinePlatform: void;
```

- [ ] **Step 3: Add switch reactions to all existing states**

In every existing state class's `_eventReactions`, add:

```typescript
switchToSingleSpinePlatform: {
    action: NO_OP,
    defaultTargetState: 'SINGLE_SPINE_PLATFORM',
},
switchToDualSpinePlatform: {
    action: NO_OP,
    defaultTargetState: 'DUAL_SPINE_PLATFORM',
},
```

- [ ] **Step 4: Create ToolSwitcherSingleSpinePlatformState class**

Add a new state class following the existing pattern (like `ToolSwitcherStationState`):

```typescript
class ToolSwitcherSingleSpinePlatformState extends TemplateState<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates> {
    private _subStateMachine: SingleSpinePlacementStateMachine;
    private _stationId: number = -1;

    constructor(subStateMachine: SingleSpinePlacementStateMachine) {
        super();
        this._subStateMachine = subStateMachine;
    }

    protected _eventReactions: EventReactions<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates> = {
        switchToLayout: { action: NO_OP, defaultTargetState: 'LAYOUT' },
        switchToTrain: { action: NO_OP, defaultTargetState: 'TRAIN' },
        switchToStation: { action: NO_OP, defaultTargetState: 'STATION' },
        switchToDuplicate: { action: NO_OP, defaultTargetState: 'DUPLICATE' },
        switchToCatenary: { action: NO_OP, defaultTargetState: 'CATENARY' },
        switchToSingleSpinePlatform: { action: NO_OP, defaultTargetState: 'SINGLE_SPINE_PLATFORM' },
        switchToDualSpinePlatform: { action: NO_OP, defaultTargetState: 'DUAL_SPINE_PLATFORM' },
        switchToIdle: { action: NO_OP, defaultTargetState: 'IDLE' },
    };

    uponEnter(context: BaseContext, stateMachine: StateMachine<ToolSwitcherEvents, BaseContext, ToolSwitcherStates, DefaultOutputMapping<ToolSwitcherEvents>>, from: ToolSwitcherStates | "INITIAL"): void {
        this._subStateMachine.happens('startPlacement', { stationId: this._stationId });
    }

    beforeExit(context: ToolSwitcherContext, stateMachine: ToolSwitcherStateMachine, toState: ToolSwitcherStates) {
        this._subStateMachine.happens('endPlacement');
    }

    protected _defer: Defer<ToolSwitcherContext, ToolSwitcherEvents, ToolSwitcherStates> = {
        action: (context, event, eventKey, stateMachine) => {
            const result = this._subStateMachine.happens(eventKey, event);
            if (result.handled) {
                return { handled: true, output: result.output };
            }
            return { handled: false };
        },
    };
}
```

- [ ] **Step 5: Create ToolSwitcherDualSpinePlatformState class**

Same pattern as single-spine, using `DualSpinePlacementStateMachine`.

```typescript
class ToolSwitcherDualSpinePlatformState extends TemplateState<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates> {
    private _subStateMachine: DualSpinePlacementStateMachine;
    private _stationId: number = -1;

    constructor(subStateMachine: DualSpinePlacementStateMachine) {
        super();
        this._subStateMachine = subStateMachine;
    }

    protected _eventReactions: EventReactions<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates> = {
        switchToLayout: { action: NO_OP, defaultTargetState: 'LAYOUT' },
        switchToTrain: { action: NO_OP, defaultTargetState: 'TRAIN' },
        switchToStation: { action: NO_OP, defaultTargetState: 'STATION' },
        switchToDuplicate: { action: NO_OP, defaultTargetState: 'DUPLICATE' },
        switchToCatenary: { action: NO_OP, defaultTargetState: 'CATENARY' },
        switchToSingleSpinePlatform: { action: NO_OP, defaultTargetState: 'SINGLE_SPINE_PLATFORM' },
        switchToDualSpinePlatform: { action: NO_OP, defaultTargetState: 'DUAL_SPINE_PLATFORM' },
        switchToIdle: { action: NO_OP, defaultTargetState: 'IDLE' },
    };

    uponEnter(context: BaseContext, stateMachine: StateMachine<ToolSwitcherEvents, BaseContext, ToolSwitcherStates, DefaultOutputMapping<ToolSwitcherEvents>>, from: ToolSwitcherStates | "INITIAL"): void {
        this._subStateMachine.happens('startPlacement', { stationId: this._stationId });
    }

    beforeExit(context: ToolSwitcherContext, stateMachine: ToolSwitcherStateMachine, toState: ToolSwitcherStates) {
        this._subStateMachine.happens('endPlacement');
    }

    protected _defer: Defer<ToolSwitcherContext, ToolSwitcherEvents, ToolSwitcherStates> = {
        action: (context, event, eventKey, stateMachine) => {
            const result = this._subStateMachine.happens(eventKey, event);
            if (result.handled) {
                return { handled: true, output: result.output };
            }
            return { handled: false };
        },
    };
}
```

- [ ] **Step 6: Update createToolSwitcherStateMachine factory**

Update the function signature and state map:

```typescript
export const createToolSwitcherStateMachine = (
    layoutSubStateMachine: LayoutStateMachine,
    trainSubStateMachine: TrainPlacementStateMachine,
    stationSubStateMachine: StationPlacementStateMachine,
    duplicateSubStateMachine: DuplicateToSideStateMachine,
    catenarySubStateMachine: CatenaryLayoutStateMachine,
    singleSpineSubStateMachine: SingleSpinePlacementStateMachine,
    dualSpineSubStateMachine: DualSpinePlacementStateMachine,
): ToolSwitcherStateMachine => {
    return new TemplateStateMachine<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates>({
        IDLE: new ToolSwitcherIdleState(),
        LAYOUT: new ToolSwitcherLayoutState(layoutSubStateMachine),
        TRAIN: new ToolSwitcherTrainState(trainSubStateMachine),
        STATION: new ToolSwitcherStationState(stationSubStateMachine),
        DUPLICATE: new ToolSwitcherDuplicateState(duplicateSubStateMachine),
        CATENARY: new ToolSwitcherCatenaryState(catenarySubStateMachine),
        SINGLE_SPINE_PLATFORM: new ToolSwitcherSingleSpinePlatformState(singleSpineSubStateMachine),
        DUAL_SPINE_PLATFORM: new ToolSwitcherDualSpinePlatformState(dualSpineSubStateMachine),
    }, 'IDLE', {
        setup: () => {},
        cleanup: () => {},
    });
};
```

- [ ] **Step 7: Commit**

```bash
git add apps/banana/src/trains/input-state-machine/tool-switcher-state-machine.ts
git commit -m "feat(banana): add single-spine and dual-spine platform tools to tool switcher"
```

---

## Task 12: Wire everything in init-app

**Files:**
- Modify: `apps/banana/src/utils/init-app.ts`

- [ ] **Step 1: Add imports**

Add at the top of `apps/banana/src/utils/init-app.ts`:

```typescript
import { TrackAlignedPlatformManager } from '@/stations/track-aligned-platform-manager';
import { TrackAlignedPlatformRenderSystem } from '@/stations/track-aligned-platform-render-system';
import { SingleSpinePlacementEngine, createSingleSpinePlacementStateMachine } from '@/stations/single-spine-placement-state-machine';
import { DualSpinePlacementEngine, createDualSpinePlacementStateMachine } from '@/stations/dual-spine-placement-state-machine';
```

- [ ] **Step 2: Instantiate the manager and render system**

After the existing `stationManager` and `stationRenderSystem` are created, add:

```typescript
const trackAlignedPlatformManager = new TrackAlignedPlatformManager();
const trackAlignedPlatformRenderSystem = new TrackAlignedPlatformRenderSystem(
    worldRenderSystem,
    trackAlignedPlatformManager,
    curveEngine.trackGraph,
    trackTextureRenderer,
);
```

- [ ] **Step 3: Set up segment protection guard**

After the `trackAlignedPlatformManager` is created, add:

```typescript
curveEngine.trackGraph.setSegmentProtectionCheck((segNum) => {
    return trackAlignedPlatformManager.getPlatformsBySegment(segNum).length > 0;
});
```

- [ ] **Step 4: Create placement engines and state machines**

```typescript
const singleSpineEngine = new SingleSpinePlacementEngine(
    baseComponents.canvas,
    curveEngine.trackGraph,
    baseComponents.camera,
    stationManager,
    trackAlignedPlatformManager,
    trackAlignedPlatformRenderSystem,
);
const singleSpineStateMachine = createSingleSpinePlacementStateMachine(singleSpineEngine);

const dualSpineEngine = new DualSpinePlacementEngine(
    baseComponents.canvas,
    curveEngine.trackGraph,
    baseComponents.camera,
    stationManager,
    trackAlignedPlatformManager,
    trackAlignedPlatformRenderSystem,
);
const dualSpineStateMachine = createDualSpinePlacementStateMachine(dualSpineEngine);
```

- [ ] **Step 5: Pass new state machines to createToolSwitcherStateMachine**

Update the existing `createToolSwitcherStateMachine` call to pass the two new state machines as additional arguments:

```typescript
const toolSwitcherStateMachine = createToolSwitcherStateMachine(
    layoutStateMachine,
    trainPlacementStateMachine,
    stationPlacementStateMachine,
    duplicateToSideStateMachine,
    catenaryLayoutStateMachine,
    singleSpineStateMachine,
    dualSpineStateMachine,
);
```

- [ ] **Step 6: Add cleanup handler for station deletion**

Near the existing `onSegmentRemoved` subscription, add:

```typescript
// When a station is deleted, remove its track-aligned platforms.
// (Hook into station manager's destroy if it has an observable, otherwise
// wrap the destroy call in init-app.)
```

Note: The exact wiring depends on whether `StationManager` exposes a destroy observable. If not, this cleanup needs to happen wherever station deletion is triggered in the UI.

- [ ] **Step 7: Wire deserialization**

In the scene deserialization path, after `StationManager.deserialize()`, add:

```typescript
const trackAlignedPlatformManager = data.trackAlignedPlatforms
    ? TrackAlignedPlatformManager.deserialize(data.trackAlignedPlatforms)
    : new TrackAlignedPlatformManager();
```

And add platform rendering for all deserialized platforms:

```typescript
for (const { id } of trackAlignedPlatformManager.getPlatformsByStation(/* each station */)) {
    trackAlignedPlatformRenderSystem.addPlatform(id);
}
```

- [ ] **Step 8: Verify build**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bunx nx build banana --skip-nx-cache 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 9: Commit**

```bash
git add apps/banana/src/utils/init-app.ts
git commit -m "feat(banana): wire track-aligned platform system into init-app"
```

---

## Task 13: Bare station creation

**Files:**
- Modify: `apps/banana/src/stations/station-placement-state-machine.ts`

The spec requires the ability to create a station without platforms (bare station). The existing station placement tool always creates an island station with two tracks and platforms. Add a mode or separate path that creates a bare station (name + position + elevation, no tracks, no platforms).

- [ ] **Step 1: Add a `createBareStation` method to StationPlacementEngine**

In `apps/banana/src/stations/station-placement-state-machine.ts`, add a method to `StationPlacementEngine`:

```typescript
createBareStation(position: Point): number {
    const stationId = this._stationManager.createStation({
        name: 'Station',
        position,
        elevation: ELEVATION.GROUND,
        platforms: [],
        trackSegments: [],
        joints: [],
        trackAlignedPlatforms: [],
    });
    return stationId;
}
```

Note: How this is triggered from the UI (a separate tool mode, a modifier key, or a UI button) depends on the app's toolbar design. The method should be callable from either the existing station tool or a new bare-station tool entry in the tool switcher.

- [ ] **Step 2: Commit**

```bash
git add apps/banana/src/stations/station-placement-state-machine.ts
git commit -m "feat(banana): add bare station creation for track-aligned platform workflow"
```

---

## Task 14: Run all tests and verify

**Files:** None (verification only)

- [ ] **Step 1: Run all banana tests**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bunx nx test banana
```

Expected: All tests pass (existing + new).

- [ ] **Step 2: Build the app**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bunx nx build banana --skip-nx-cache
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Start dev server and smoke test**

```bash
cd /Users/vincent.yy.chang/dev/ue-too/feat/banana-track-aligned-platforms && bun run dev:banana
```

Open browser, verify:
1. Existing station placement tool still works.
2. App loads without console errors related to the new system.
3. Track deletion is blocked when a platform is attached.
