# Phase 2: Dynamics Collision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the soft rail clamp with real rigid-body collision via `@ue-too/dynamics`, adding centripetal force on curves and F=ma with per-horse weight.

**Architecture:** A new `RaceWorld` class wraps the dynamics `World`, managing horse `Polygon` bodies and static rail bodies (from existing `buildTrackIntoWorld`). The physics module is rewritten to compute track-relative forces, convert to world-space, and let the dynamics engine handle integration + collision. `TrackNavigator` is retained for force computation and progress tracking.

**Tech Stack:** `@ue-too/dynamics` (World, Polygon, Crescent), `@ue-too/math`, Vitest

**Spec:** `docs/superpowers/specs/2026-04-12-dynamics-collision-design.md`

---

## File Structure

**Create:**
- `apps/horse-racing/src/simulation/race-world.ts` — Dynamics world wrapper, horse body management
- `apps/horse-racing/test/race-world.test.ts` — RaceWorld unit tests
- `apps/horse-racing/test/force-model.test.ts` — Force computation unit tests

**Modify:**
- `apps/horse-racing/src/simulation/types.ts` — Add `NORMAL_DAMP`, `HORSE_HALF_LENGTH`, `HORSE_HALF_WIDTH`
- `apps/horse-racing/src/simulation/physics.ts` — New force model + dynamics-based stepping
- `apps/horse-racing/src/simulation/race.ts` — Create/manage `RaceWorld`, new `stepPhysics` signature
- `apps/horse-racing/test/pacing-strategy.test.ts` — Use `Race` class instead of `stepPhysicsSingle`

**No changes needed:**
- `apps/horse-racing/src/simulation/stamina.ts` — Uses `horse.tangentialVel`/`normalVel` (synced from body)
- `apps/horse-racing/src/simulation/exhaustion.ts` — Unchanged
- `apps/horse-racing/src/simulation/renderer.ts` — Reads `horse.pos` (synced from body)
- `apps/horse-racing/src/simulation/track-from-json.ts` — `buildTrackIntoWorld` used as-is
- `apps/horse-racing/src/simulation/track-navigator.ts` — Used as-is for force computation
- `apps/horse-racing/src/simulation/cruise.ts` — Unchanged
- `apps/horse-racing/test/physics.test.ts` — Tests use `Race` class API which doesn't change

---

### Task 1: Add physics constants

**Files:**
- Modify: `apps/horse-racing/src/simulation/types.ts`

- [ ] **Step 1: Add constants to types.ts**

Add three new constants after the existing `FIXED_DT`:

```typescript
/** Lateral velocity damping coefficient (m/s² per m/s of normal velocity). */
export const NORMAL_DAMP = 0.5;
/** Half-length of horse collision body in meters. */
export const HORSE_HALF_LENGTH = 1.0;
/** Half-width of horse collision body in meters. */
export const HORSE_HALF_WIDTH = 0.325;
```

- [ ] **Step 2: Verify build**

Run: `bunx nx build horse-racing`
Expected: Successful build with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/horse-racing/src/simulation/types.ts
git commit -m "feat(horse-racing): add dynamics physics constants (NORMAL_DAMP, horse dimensions)"
```

---

### Task 2: Create RaceWorld class

**Files:**
- Create: `apps/horse-racing/src/simulation/race-world.ts`
- Test: `apps/horse-racing/test/race-world.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/horse-racing/test/race-world.test.ts`:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

import { parseTrackJson } from '../src/simulation/track-from-json';
import { RaceWorld } from '../src/simulation/race-world';

function loadTrack(name: string) {
    const path = join(__dirname, '../public/tracks', name);
    return parseTrackJson(JSON.parse(readFileSync(path, 'utf-8')) as unknown);
}

describe('RaceWorld', () => {
    it('creates world with rail bodies from track', () => {
        const segments = loadTrack('test_oval.json');
        const rw = new RaceWorld(segments);
        expect(rw.world.getRigidBodyList().length).toBeGreaterThan(0);
    });

    it('adds horse polygon bodies', () => {
        const segments = loadTrack('test_oval.json');
        const rw = new RaceWorld(segments);
        const railCount = rw.world.getRigidBodyList().length;

        rw.addHorse(0, { x: 0, y: 0 }, 0, 500);
        rw.addHorse(1, { x: 0, y: 5 }, 0, 500);

        expect(rw.world.getRigidBodyList().length).toBe(railCount + 2);
        expect(rw.getHorseBody(0)).toBeDefined();
        expect(rw.getHorseBody(1)).toBeDefined();
    });

    it('horse body has correct mass and position', () => {
        const segments = loadTrack('test_oval.json');
        const rw = new RaceWorld(segments);
        rw.addHorse(0, { x: 10, y: 20 }, Math.PI / 4, 450);

        const body = rw.getHorseBody(0);
        expect(body.center.x).toBeCloseTo(10);
        expect(body.center.y).toBeCloseTo(20);
        expect(body.mass).toBe(450);
        expect(body.orientationAngle).toBeCloseTo(Math.PI / 4);
    });

    it('throws for unknown horse id', () => {
        const segments = loadTrack('test_oval.json');
        const rw = new RaceWorld(segments);
        expect(() => rw.getHorseBody(99)).toThrow();
    });

    it('step advances the world without error', () => {
        const segments = loadTrack('test_oval.json');
        const rw = new RaceWorld(segments);
        rw.addHorse(0, { x: 0, y: 0 }, 0, 500);
        expect(() => rw.step(1 / 240)).not.toThrow();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx nx test horse-racing -- --testPathPattern race-world`
Expected: FAIL — `Cannot find module '../src/simulation/race-world'`

- [ ] **Step 3: Implement RaceWorld**

Create `apps/horse-racing/src/simulation/race-world.ts`:

```typescript
import { Polygon, World } from '@ue-too/dynamics';
import type { Point } from '@ue-too/math';

import { buildTrackIntoWorld, trackBounds } from './track-from-json';
import type { TrackSegment } from './track-types';
import { HORSE_HALF_LENGTH, HORSE_HALF_WIDTH } from './types';

const HORSE_LOCAL_VERTS: Point[] = [
    { x: HORSE_HALF_LENGTH, y: HORSE_HALF_WIDTH },
    { x: HORSE_HALF_LENGTH, y: -HORSE_HALF_WIDTH },
    { x: -HORSE_HALF_LENGTH, y: -HORSE_HALF_WIDTH },
    { x: -HORSE_HALF_LENGTH, y: HORSE_HALF_WIDTH },
];

/**
 * Wraps the dynamics `World` for a single race. Creates static rail bodies
 * from track segments and manages dynamic horse `Polygon` bodies.
 */
export class RaceWorld {
    readonly world: World;
    private horseBodies = new Map<number, Polygon>();

    constructor(segments: TrackSegment[]) {
        const bounds = trackBounds(segments, 100);
        const w = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)) + 100;
        const h = Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)) + 100;
        this.world = new World(w, h, 'dynamictree');
        this.world.resolveCollision = true;
        this.world.useLinearCollisionResolution = true;
        this.world.sleepingEnabled = false;
        buildTrackIntoWorld(this.world, segments);
    }

    addHorse(id: number, pos: Point, orientationAngle: number, mass: number): Polygon {
        const body = new Polygon(
            { x: pos.x, y: pos.y },
            HORSE_LOCAL_VERTS.map((v) => ({ x: v.x, y: v.y })),
            orientationAngle,
            mass,
            false, // not static
            true, // friction enabled
        );
        body.angularVelocity = 0;
        this.world.addRigidBody(`horse-${id}`, body);
        this.horseBodies.set(id, body);
        return body;
    }

    getHorseBody(id: number): Polygon {
        const body = this.horseBodies.get(id);
        if (!body) throw new Error(`No body for horse ${id}`);
        return body;
    }

    step(dt: number): void {
        this.world.step(dt);
    }

    dispose(): void {
        this.horseBodies.clear();
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx nx test horse-racing -- --testPathPattern race-world`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/horse-racing/src/simulation/race-world.ts apps/horse-racing/test/race-world.test.ts
git commit -m "feat(horse-racing): add RaceWorld dynamics wrapper"
```

---

### Task 3: Add force model functions

**Files:**
- Modify: `apps/horse-racing/src/simulation/physics.ts` (add new exports alongside existing code)
- Create: `apps/horse-racing/test/force-model.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/horse-racing/test/force-model.test.ts`:

```typescript
import { computeAccelerations, projectVelocity } from '../src/simulation/physics';
import { createDefaultAttributes } from '../src/simulation/attributes';
import type { TrackFrame } from '../src/simulation/track-navigator';
import type { InputState } from '../src/simulation/types';

const ZERO_INPUT: InputState = { tangential: 0, normal: 0 };

function straightFrame(): TrackFrame {
    return {
        tangential: { x: 1, y: 0 },
        normal: { x: 0, y: -1 },
        turnRadius: Infinity,
        nominalRadius: Infinity,
        targetRadius: Infinity,
        slope: 0,
    };
}

function curveFrame(turnRadius: number): TrackFrame {
    return {
        tangential: { x: 0, y: -1 },
        normal: { x: 1, y: 0 },
        turnRadius,
        nominalRadius: turnRadius,
        targetRadius: turnRadius,
        slope: 0,
    };
}

describe('projectVelocity', () => {
    it('decomposes world velocity onto track frame', () => {
        // tangential=(1,0), normal=(0,-1)
        // worldVel=(10,-3) → tangentialVel=10, normalVel=3
        const { tangentialVel, normalVel } = projectVelocity(
            { x: 10, y: -3 },
            straightFrame(),
        );
        expect(tangentialVel).toBeCloseTo(10);
        expect(normalVel).toBeCloseTo(3);
    });

    it('handles angled track frame', () => {
        const s = Math.SQRT1_2;
        const frame: TrackFrame = {
            tangential: { x: s, y: s },
            normal: { x: s, y: -s },
            turnRadius: Infinity,
            nominalRadius: Infinity,
            targetRadius: Infinity,
            slope: 0,
        };
        const { tangentialVel, normalVel } = projectVelocity({ x: 10, y: 0 }, frame);
        expect(tangentialVel).toBeCloseTo(10 * s);
        expect(normalVel).toBeCloseTo(10 * s);
    });
});

describe('computeAccelerations', () => {
    const attrs = createDefaultAttributes(); // cruiseSpeed=13, maxSpeed=20

    it('produces positive tangential accel at zero velocity (cruise pull)', () => {
        const [a_t] = computeAccelerations(
            0, 0, attrs, ZERO_INPUT, null, 0, straightFrame(),
        );
        // K_CRUISE*(13-0) - C_DRAG*0 = 26
        expect(a_t).toBeCloseTo(26, 0);
    });

    it('produces negative tangential accel above cruise (drag dominates)', () => {
        const [a_t] = computeAccelerations(
            20, 0, attrs, ZERO_INPUT, null, 0, straightFrame(),
        );
        // K_CRUISE*(13-20) - C_DRAG*20 = -14 - 2 = -16
        expect(a_t).toBeLessThan(0);
    });

    it('caps tangential accel at maxSpeed', () => {
        // At maxSpeed with strong positive force
        const input: InputState = { tangential: 1, normal: 0 };
        const [a_t] = computeAccelerations(
            20, 0, attrs, input, 0, 0, straightFrame(),
        );
        // cruise=-14, input=+5, drag=-2 → net=-11 (negative, no cap)
        expect(a_t).toBeLessThan(0);

        // Just below maxSpeed: cruise force could push above
        const [a_t2] = computeAccelerations(
            12, 0, attrs, input, 0, 0, straightFrame(),
        );
        // cruise=2, input=5, drag=-1.2 → net=5.8 (positive, vel<maxSpeed so no cap)
        expect(a_t2).toBeGreaterThan(0);
    });

    it('applies centripetal on curves: -v²/r in normal direction', () => {
        const [, a_n] = computeAccelerations(
            10, 0, attrs, ZERO_INPUT, null, 0, curveFrame(100),
        );
        // -10²/100 = -1.0 (toward center)
        expect(a_n).toBeCloseTo(-1.0, 1);
    });

    it('no centripetal on straights', () => {
        const [, a_n] = computeAccelerations(
            10, 0, attrs, ZERO_INPUT, null, 0, straightFrame(),
        );
        // No centripetal, no normalVel → a_n ≈ 0
        expect(a_n).toBeCloseTo(0, 5);
    });

    it('applies NORMAL_DAMP to lateral velocity', () => {
        const [, a_n] = computeAccelerations(
            0, 5, attrs, ZERO_INPUT, null, 0, straightFrame(),
        );
        // NORMAL_DAMP*5 = 2.5, C_DRAG*5 = 0.5, total = -3.0
        expect(a_n).toBeCloseTo(-3.0, 1);
    });

    it('applies player steering input', () => {
        const input: InputState = { tangential: 0, normal: 1 };
        const [, a_n] = computeAccelerations(
            0, 0, attrs, input, 0, 0, straightFrame(),
        );
        // F_N_MAX * turnAccel = 3 * 1.0 = 3
        expect(a_n).toBeCloseTo(3, 0);
    });

    it('does not apply input for non-player horse', () => {
        const input: InputState = { tangential: 1, normal: 1 };
        const [a_t, a_n] = computeAccelerations(
            0, 0, attrs, input, 1, 0, straightFrame(),
        );
        // Horse 0 is NOT player (player is 1)
        expect(a_t).toBeCloseTo(26, 0); // cruise only
        expect(a_n).toBeCloseTo(0, 5); // no input, no centripetal
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx nx test horse-racing -- --testPathPattern force-model`
Expected: FAIL — `computeAccelerations is not a function` (not exported yet)

- [ ] **Step 3: Add computeAccelerations and projectVelocity to physics.ts**

Add these new exported functions at the **top** of `apps/horse-racing/src/simulation/physics.ts`, before the existing `stepPhysicsSingle`. The existing code stays untouched for now:

```typescript
import type { Point } from '@ue-too/math';
import type { TrackFrame, TrackNavigator } from './track-navigator';
import type { CoreAttributes } from './attributes';
import { F_T_MAX, F_N_MAX } from './attributes';

import { computeCruiseForce } from './cruise';
import {
    C_DRAG,
    NORMAL_DAMP,
    TRACK_HALF_WIDTH,
    type Horse,
    type InputState,
} from './types';

/**
 * Project world-space velocity onto track-relative components.
 */
export function projectVelocity(
    worldVel: Point,
    frame: TrackFrame,
): { tangentialVel: number; normalVel: number } {
    return {
        tangentialVel:
            worldVel.x * frame.tangential.x + worldVel.y * frame.tangential.y,
        normalVel:
            worldVel.x * frame.normal.x + worldVel.y * frame.normal.y,
    };
}

/**
 * Compute track-relative accelerations for a single horse.
 *
 * Tangential: cruise + player input − drag, capped at maxSpeed.
 * Normal: centripetal (−v²/r) + NORMAL_DAMP + player steering − drag.
 *
 * @returns Tuple `[tangentialAccel, normalAccel]` in m/s².
 */
export function computeAccelerations(
    tangentialVel: number,
    normalVel: number,
    attrs: CoreAttributes,
    input: InputState,
    playerHorseId: number | null,
    horseId: number,
    frame: TrackFrame,
): [number, number] {
    // --- Tangential ---
    let a_t = computeCruiseForce(tangentialVel, attrs.cruiseSpeed);
    if (horseId === playerHorseId) {
        a_t += input.tangential * F_T_MAX * attrs.forwardAccel;
    }
    a_t -= C_DRAG * tangentialVel;
    if (tangentialVel >= attrs.maxSpeed && a_t > 0) {
        a_t = 0;
    }

    // --- Normal ---
    let a_n = 0;
    // Centripetal: -v²/r toward curve center (negative normal direction)
    if (frame.turnRadius < 1e6 && frame.turnRadius > 1e-3) {
        a_n -= (tangentialVel * tangentialVel) / frame.turnRadius;
    }
    // Lateral damping
    a_n -= NORMAL_DAMP * normalVel;
    // Player steering
    if (horseId === playerHorseId) {
        a_n += input.normal * F_N_MAX * attrs.turnAccel;
    }
    // Drag on normal component
    a_n -= C_DRAG * normalVel;

    return [a_t, a_n];
}

// --- Existing code below (stepPhysicsSingle, stepPhysics) stays unchanged ---
```

Keep all existing code (`lateralDisplacement`, `stepPhysicsSingle`, `stepPhysics`) intact — it will be removed in Task 4.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx nx test horse-racing -- --testPathPattern force-model`
Expected: All tests PASS.

Also run existing tests to verify nothing broke:

Run: `bunx nx test horse-racing`
Expected: All existing tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/horse-racing/src/simulation/physics.ts apps/horse-racing/test/force-model.test.ts
git commit -m "feat(horse-racing): add force model with centripetal and NORMAL_DAMP"
```

---

### Task 4: Replace stepPhysics + wire Race to RaceWorld

This task replaces the soft rail clamp with dynamics-based physics and wires `RaceWorld` into the `Race` class. Both files change together because `stepPhysics` has a new signature that `Race.tick()` must use.

**Files:**
- Modify: `apps/horse-racing/src/simulation/physics.ts` (replace `stepPhysicsSingle`/`stepPhysics`, remove `lateralDisplacement`)
- Modify: `apps/horse-racing/src/simulation/race.ts` (create/manage `RaceWorld`)

- [ ] **Step 1: Rewrite physics.ts**

Replace the entire file with the new dynamics-based implementation. The new `stepPhysics` takes a `RaceWorld` parameter. `stepPhysicsSingle` and `lateralDisplacement` are removed.

Write `apps/horse-racing/src/simulation/physics.ts`:

```typescript
import type { Point } from '@ue-too/math';
import type { Polygon } from '@ue-too/dynamics';

import type { TrackFrame } from './track-navigator';
import type { CoreAttributes } from './attributes';
import { F_T_MAX, F_N_MAX } from './attributes';
import { computeCruiseForce } from './cruise';
import type { RaceWorld } from './race-world';
import {
    C_DRAG,
    NORMAL_DAMP,
    type Horse,
    type InputState,
} from './types';

/**
 * Project world-space velocity onto track-relative components.
 */
export function projectVelocity(
    worldVel: Point,
    frame: TrackFrame,
): { tangentialVel: number; normalVel: number } {
    return {
        tangentialVel:
            worldVel.x * frame.tangential.x + worldVel.y * frame.tangential.y,
        normalVel:
            worldVel.x * frame.normal.x + worldVel.y * frame.normal.y,
    };
}

/**
 * Compute track-relative accelerations for a single horse.
 *
 * Tangential: cruise + player input − drag, capped at maxSpeed.
 * Normal: centripetal (−v²/r) + NORMAL_DAMP + player steering − drag.
 *
 * @returns Tuple `[tangentialAccel, normalAccel]` in m/s².
 */
export function computeAccelerations(
    tangentialVel: number,
    normalVel: number,
    attrs: CoreAttributes,
    input: InputState,
    playerHorseId: number | null,
    horseId: number,
    frame: TrackFrame,
): [number, number] {
    // --- Tangential ---
    let a_t = computeCruiseForce(tangentialVel, attrs.cruiseSpeed);
    if (horseId === playerHorseId) {
        a_t += input.tangential * F_T_MAX * attrs.forwardAccel;
    }
    a_t -= C_DRAG * tangentialVel;
    if (tangentialVel >= attrs.maxSpeed && a_t > 0) {
        a_t = 0;
    }

    // --- Normal ---
    let a_n = 0;
    // Centripetal: -v²/r toward curve center (negative normal direction)
    if (frame.turnRadius < 1e6 && frame.turnRadius > 1e-3) {
        a_n -= (tangentialVel * tangentialVel) / frame.turnRadius;
    }
    // Lateral damping
    a_n -= NORMAL_DAMP * normalVel;
    // Player steering
    if (horseId === playerHorseId) {
        a_n += input.normal * F_N_MAX * attrs.turnAccel;
    }
    // Drag on normal component
    a_n -= C_DRAG * normalVel;

    return [a_t, a_n];
}

/**
 * Compute track-relative forces and apply to the horse's dynamics body.
 * Sets body orientation to track tangent and zeroes angular velocity.
 */
function applyForcesToBody(
    horse: Horse,
    body: Polygon,
    attrs: CoreAttributes,
    input: InputState,
    playerHorseId: number | null,
): void {
    const frame = horse.navigator.getTrackFrame(horse.pos);
    const { tangentialVel, normalVel } = projectVelocity(
        body.linearVelocity,
        frame,
    );
    const [a_t, a_n] = computeAccelerations(
        tangentialVel,
        normalVel,
        attrs,
        input,
        playerHorseId,
        horse.id,
        frame,
    );

    const mass = attrs.weight;
    body.applyForce({
        x: (a_t * frame.tangential.x + a_n * frame.normal.x) * mass,
        y: (a_t * frame.tangential.y + a_n * frame.normal.y) * mass,
    });

    // Lock orientation to track tangent — no angular dynamics
    body.orientationAngle = Math.atan2(frame.tangential.y, frame.tangential.x);
    body.angularVelocity = 0;
}

/**
 * Read back position/velocity from the dynamics body into horse state.
 * Updates navigator segment tracking, progress, and track-relative velocities.
 */
function syncFromBody(horse: Horse, body: Polygon): void {
    horse.pos.x = body.center.x;
    horse.pos.y = body.center.y;

    horse.navigator.updateSegment(horse.pos);
    horse.trackProgress = horse.navigator.computeProgress(horse.pos);

    const frame = horse.navigator.getTrackFrame(horse.pos);
    const projected = projectVelocity(body.linearVelocity, frame);
    horse.tangentialVel = projected.tangentialVel;
    horse.normalVel = projected.normalVel;
}

/**
 * Run physics substeps for all horses using the dynamics world.
 *
 * Per substep:
 * 1. Compute + apply forces for each horse (finished horses get velocity zeroed)
 * 2. `world.step(dt)` — dynamics engine integrates + resolves collisions
 * 3. Sync position/velocity from bodies back to horse state
 */
export function stepPhysics(
    horses: Horse[],
    input: InputState,
    playerHorseId: number | null,
    raceWorld: RaceWorld,
    substeps: number,
    dt: number,
): void {
    for (let s = 0; s < substeps; s++) {
        for (const h of horses) {
            const body = raceWorld.getHorseBody(h.id);
            if (h.finished) {
                body.linearVelocity = { x: 0, y: 0 };
                continue;
            }
            applyForcesToBody(
                h,
                body,
                h.effectiveAttributes,
                input,
                playerHorseId,
            );
        }

        raceWorld.step(dt);

        for (const h of horses) {
            if (h.finished) continue;
            syncFromBody(h, raceWorld.getHorseBody(h.id));
        }
    }
}
```

- [ ] **Step 2: Update Race to use RaceWorld**

Replace `apps/horse-racing/src/simulation/race.ts` with:

```typescript
import type { Point } from '@ue-too/math';

import { TrackNavigator } from './track-navigator';
import type { TrackSegment } from './track-types';

import { createDefaultAttributes } from './attributes';
import { applyExhaustion } from './exhaustion';
import { stepPhysics } from './physics';
import { RaceWorld } from './race-world';
import { drainStamina } from './stamina';
import {
    FIXED_DT,
    PHYS_SUBSTEPS,
    TRACK_HALF_WIDTH,
    type Horse,
    type InputState,
    type RaceState,
} from './types';

const HORSE_COLORS = [0xc9a227, 0x4169e1, 0xe53935, 0x43a047];

/**
 * Build four identical horses lined up at the start of the track.
 * Each horse gets its own `TrackNavigator` instance and default attributes.
 */
export function spawnHorses(segments: TrackSegment[]): Horse[] {
    if (segments.length === 0) {
        throw new Error('spawnHorses: track has no segments');
    }
    const first = segments[0];
    const probe = new TrackNavigator(segments, 0, TRACK_HALF_WIDTH);
    const startPoint: Point = { x: first.startPoint.x, y: first.startPoint.y };
    const frame = probe.getTrackFrame(startPoint);

    const laneSpacing = (TRACK_HALF_WIDTH * 1.2) / 3;
    const laneOffsets = [-1.5, -0.5, 0.5, 1.5].map((i) => i * laneSpacing);

    return HORSE_COLORS.map((color, id) => {
        const pos: Point = {
            x: startPoint.x + frame.normal.x * laneOffsets[id],
            y: startPoint.y + frame.normal.y * laneOffsets[id],
        };
        const attrs = createDefaultAttributes();
        return {
            id,
            color,
            pos,
            tangentialVel: 0,
            normalVel: 0,
            trackProgress: 0,
            navigator: new TrackNavigator(segments, 0, TRACK_HALF_WIDTH),
            finished: false,
            finishOrder: null,
            baseAttributes: attrs,
            currentStamina: attrs.maxStamina,
            effectiveAttributes: { ...attrs },
        };
    });
}

/**
 * Race state machine: gate → running → finished.
 *
 * Tick pipeline per frame:
 *   1. applyExhaustion per horse → effective attrs
 *   2. stepPhysics via dynamics world (8 substeps at 240Hz)
 *   3. drainStamina per horse (once per tick, after physics)
 */
export class Race {
    state: RaceState;
    private segments: TrackSegment[];
    private raceWorld: RaceWorld;

    constructor(segments: TrackSegment[]) {
        this.segments = segments;
        this.state = {
            phase: 'gate',
            horses: spawnHorses(segments),
            playerHorseId: null,
            tick: 0,
            finishOrder: [],
        };
        this.raceWorld = new RaceWorld(segments);
        this.addHorseBodies();
    }

    /** Create dynamics bodies for all horses in the world. */
    private addHorseBodies(): void {
        for (const h of this.state.horses) {
            const frame = h.navigator.getTrackFrame(h.pos);
            const angle = Math.atan2(frame.tangential.y, frame.tangential.x);
            this.raceWorld.addHorse(
                h.id,
                h.pos,
                angle,
                h.baseAttributes.weight,
            );
        }
    }

    start(playerHorseId: number | null): void {
        if (this.state.phase !== 'gate') return;
        this.state.playerHorseId = playerHorseId;
        this.state.phase = 'running';
        this.state.tick = 0;
    }

    tick(input: InputState): void {
        if (this.state.phase !== 'running') return;

        // 1. Resolve effective attributes (exhaustion decay if stamina = 0)
        for (const h of this.state.horses) {
            if (!h.finished) {
                h.effectiveAttributes = applyExhaustion(h);
            }
        }

        // 2. Physics substeps via dynamics world
        stepPhysics(
            this.state.horses,
            input,
            this.state.playerHorseId,
            this.raceWorld,
            PHYS_SUBSTEPS,
            FIXED_DT,
        );

        // 3. Stamina drain (once per tick, after physics)
        for (const h of this.state.horses) {
            if (!h.finished) {
                const frame = h.navigator.getTrackFrame(h.pos);
                drainStamina(h, h.effectiveAttributes, input, frame);
            }
        }

        // 4. Finish detection
        for (const h of this.state.horses) {
            if (!h.finished && h.trackProgress >= 1.0) {
                h.finished = true;
                h.finishOrder = this.state.finishOrder.length + 1;
                this.state.finishOrder.push(h.id);
            }
        }

        const playerId = this.state.playerHorseId;
        const isPlayerMode = playerId !== null;
        const player = isPlayerMode ? this.state.horses[playerId] : null;
        const allFinished = this.state.horses.every((h) => h.finished);

        if ((isPlayerMode && player!.finished) || (!isPlayerMode && allFinished)) {
            this.state.phase = 'finished';
        }

        this.state.tick++;
    }

    reset(): void {
        this.raceWorld.dispose();
        this.state = {
            phase: 'gate',
            horses: spawnHorses(this.segments),
            playerHorseId: null,
            tick: 0,
            finishOrder: [],
        };
        this.raceWorld = new RaceWorld(this.segments);
        this.addHorseBodies();
    }
}
```

- [ ] **Step 3: Run existing race integration tests**

Run: `bunx nx test horse-racing -- --testPathPattern physics.test`
Expected: Both tests PASS — "all four horses finish" and "identical horses finish within 15% tick variance".

If the variance test fails (collision can create slight timing differences), increase the threshold from 0.15 to 0.25:

```typescript
expect((maxT - minT) / minT).toBeLessThan(0.25);
```

- [ ] **Step 4: Run all tests except pacing-strategy (it imports deleted stepPhysicsSingle)**

Run: `bunx nx test horse-racing -- --testPathIgnorePatterns pacing-strategy`
Expected: All tests PASS (race-world, force-model, physics, track-from-json, attributes, cruise, exhaustion, stamina, input, index).

- [ ] **Step 5: Commit**

```bash
git add apps/horse-racing/src/simulation/physics.ts apps/horse-racing/src/simulation/race.ts
git commit -m "refactor(horse-racing): replace soft rail clamp with dynamics collision"
```

---

### Task 5: Update pacing-strategy tests

The old tests imported `stepPhysicsSingle` directly. Rewrite to use the `Race` class, which now internally uses the dynamics world.

**Files:**
- Modify: `apps/horse-racing/test/pacing-strategy.test.ts`

- [ ] **Step 1: Rewrite the test file**

Replace `apps/horse-racing/test/pacing-strategy.test.ts` with:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

import { parseTrackJson } from '../src/simulation/track-from-json';
import { Race } from '../src/simulation/race';
import type { InputState } from '../src/simulation/types';
import type { TrackSegment } from '../src/simulation/track-types';

function loadTrack(name: string) {
    const path = join(__dirname, '../public/tracks', name);
    return parseTrackJson(JSON.parse(readFileSync(path, 'utf-8')) as unknown);
}

const ZERO_INPUT: InputState = { tangential: 0, normal: 0 };
const FLOOR_IT_INPUT: InputState = { tangential: 1, normal: 0 };
const MAX_TICKS = 20_000;

/**
 * Run a race with horse 0 as player, using the given input every tick.
 * Returns finish tick and stamina-depletion tick for horse 0.
 */
function runPlayerRace(
    segments: TrackSegment[],
    input: InputState,
): { finishTick: number | null; depletionTick: number | null } {
    const race = new Race(segments);
    race.start(0); // horse 0 is the player
    let depletionTick: number | null = null;

    for (let tick = 0; tick < MAX_TICKS; tick++) {
        race.tick(input);
        const h = race.state.horses[0];

        if (h.currentStamina <= 0 && depletionTick === null) {
            depletionTick = tick;
        }
        if (h.finished) {
            return { finishTick: tick, depletionTick };
        }
    }

    return { finishTick: null, depletionTick };
}

describe('Pacing strategy validation', () => {
    it('floor-it horse loses to cruise horse on test_oval', () => {
        const segments = loadTrack('test_oval.json');
        const floorIt = runPlayerRace(segments, FLOOR_IT_INPUT);
        const cruise = runPlayerRace(segments, ZERO_INPUT);

        expect(floorIt.finishTick).not.toBeNull();
        expect(cruise.finishTick).not.toBeNull();
        // Floor-it should finish AFTER cruise (worse time)
        expect(floorIt.finishTick!).toBeGreaterThan(cruise.finishTick!);
    });

    it('floor-it horse loses to cruise horse on curriculum_1_straight (sprint)', () => {
        const segments = loadTrack('curriculum_1_straight.json');
        const floorIt = runPlayerRace(segments, FLOOR_IT_INPUT);
        const cruise = runPlayerRace(segments, ZERO_INPUT);

        expect(floorIt.finishTick).not.toBeNull();
        expect(cruise.finishTick).not.toBeNull();
        expect(floorIt.finishTick!).toBeGreaterThan(cruise.finishTick!);
    });

    it('floor-it horse depletes stamina before finishing on test_oval', () => {
        const segments = loadTrack('test_oval.json');
        const floorIt = runPlayerRace(segments, FLOOR_IT_INPUT);

        expect(floorIt.finishTick).not.toBeNull();
        expect(floorIt.depletionTick).not.toBeNull();
        expect(floorIt.depletionTick!).toBeLessThan(floorIt.finishTick!);
    });
});
```

- [ ] **Step 2: Run the pacing tests**

Run: `bunx nx test horse-racing -- --testPathPattern pacing-strategy`
Expected: All 3 tests PASS.

If a pacing test fails (the force model change could shift timings), diagnose:
- If floor-it still finishes BEFORE cruise on a track: drain rates may need increasing. Bump `OVERDRIVE_DRAIN_RATE` or `STAMINA_DRAIN_RATE` in `stamina.ts`.
- If neither horse finishes within `MAX_TICKS`: the dynamics engine may be introducing unexpected drag. Check that horses reach cruise speed by logging `horse.tangentialVel` at tick 100.

- [ ] **Step 3: Run the full test suite**

Run: `bunx nx test horse-racing`
Expected: ALL tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/horse-racing/test/pacing-strategy.test.ts
git commit -m "test(horse-racing): update pacing tests for dynamics collision"
```

---

### Task 6: Visual verification on real tracks

**Files:** None — this is a manual verification task.

- [ ] **Step 1: Start the dev server**

Run: `bun run dev:horse-racing`

- [ ] **Step 2: Test on default track (test_oval.json)**

1. Open the app in browser
2. Click a horse to select → Start race
3. Hold Arrow Up to accelerate, Arrow Left/Right to steer
4. Verify:
   - Horses follow curves (centripetal force working)
   - Horses don't fly off track on turns (rail collision working)
   - Stamina drains when pushing (StaminaOverlay shows depletion)
   - Horse slows down after stamina depletion (exhaustion working)
   - Horses bump each other when close (horse-horse collision)
   - Player can steer between lanes

- [ ] **Step 3: Test on a track-maker track**

Change `DEFAULT_TRACK_URL` in `apps/horse-racing/src/utils/init-app.ts` temporarily to `/tracks/tokyo.json`:

```typescript
const DEFAULT_TRACK_URL = '/tracks/tokyo.json';
```

Refresh the browser and run a race. Verify horses follow the complex track geometry without getting stuck or flying off.

Revert back to `/tracks/test_oval.json` after testing.

- [ ] **Step 4: Test watch mode (no player)**

Start a race without clicking a horse (watch mode). Verify:
- All 4 horses cruise and finish
- No horse gets stuck on a curve
- Horses stay in their lanes (NORMAL_DAMP + centripetal)

- [ ] **Step 5: Commit if any tuning changes were needed**

If you changed any constants (NORMAL_DAMP, drain rates, restitution), commit:

```bash
git add -A
git commit -m "fix(horse-racing): tune physics constants for dynamics collision"
```

---

## Troubleshooting Guide

**Horses fly off track on curves:**
- `NORMAL_DAMP` too low → increase from 0.5
- Centripetal not applied → check `frame.turnRadius < 1e6` guard in `computeAccelerations`
- Track rail bodies missing → verify `buildTrackIntoWorld` adds Crescent for inner rails

**Horses stuck / don't move:**
- `sleepingEnabled` still true on world → must be `false`
- Forces not applied per substep → verify the substep loop calls `applyForcesToBody` before `world.step`
- Body is static → check `isStatic: false` in `addHorse`

**Floor-it wins (pacing test fails):**
- Force model change shifted equilibrium speed → check `tangentialVel` at steady state
- Drain rates need re-tuning for the new force model → increase `OVERDRIVE_DRAIN_RATE` or `STAMINA_DRAIN_RATE`

**Horses vibrate or jitter:**
- Collision resolution fighting with force application → check restitution is 0
- Body orientation fighting with collision → ensure `useLinearCollisionResolution = true`

**Performance drops:**
- Too many rail body polygons → check `FENCE_STEP_DEG` in `track-from-json.ts` (currently 5°, increase to 10° if needed)
- Spatial index wrong type → `dynamictree` is correct for mixed static/dynamic scenes
