# Observation Vector & Validation Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define a 139-float observation vector per horse and expose it via a headless HTTP validation server so Python RL can validate its physics against the TS ground truth.

**Architecture:** Pure `observation.ts` module builds flat float arrays from `Race` state. `server.ts` wraps it in `POST /reset` + `POST /step` endpoints. `InputState` widens to continuous `[-1, 1]`. `Race` supports per-horse actions and variable horse count.

**Tech Stack:** TypeScript, Bun.serve, Vitest, existing `Race` class and `TrackNavigator`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/simulation/types.ts` | Modify | Widen `InputState` to `number`, add `MAX_HORSES` |
| `src/simulation/input.ts` | No change | Browser keyboard handler (already produces -1/0/1 which are valid numbers) |
| `src/simulation/physics.ts` | Modify | Remove `playerHorseId` gating — apply input for every horse |
| `src/simulation/race.ts` | Modify | Accept per-horse actions in `tick()`, variable `horseCount` in constructor |
| `src/simulation/observation.ts` | Create | `buildObservations(race) → Float64Array[]` — pure function |
| `src/simulation/server.ts` | Rewrite | `POST /reset`, `POST /step` over `Race` class |
| `src/simulation/sim.ts` | Modify | Adapt to new `Race.tick()` signature |
| `test/observation.test.ts` | Create | Unit tests for observation vector |
| `test/server.test.ts` | Create | Integration tests for HTTP endpoints |

---

### Task 1: Widen InputState and remove playerHorseId gating

Currently `InputState` uses literal union `-1|0|1` and `computeAccelerations` only applies input when `horseId === playerHorseId`. For the server, every horse is an agent and receives continuous input. This task widens the type and removes the gating so all horses receive their own input.

**Files:**
- Modify: `apps/horse-racing/src/simulation/types.ts`
- Modify: `apps/horse-racing/src/simulation/physics.ts`
- Modify: `apps/horse-racing/src/simulation/race.ts`
- Modify: `apps/horse-racing/src/simulation/sim.ts`
- Modify: `apps/horse-racing/test/force-model.test.ts`
- Modify: `apps/horse-racing/test/pacing-strategy.test.ts`

- [ ] **Step 1: Update `InputState` in `types.ts`**

Change `InputState` from discrete to continuous and add `MAX_HORSES`:

```typescript
// In types.ts, replace the InputState interface:
export interface InputState {
    tangential: number; // [-1, 1]
    normal: number;     // [-1, 1]
}

/** Maximum number of horses per race. */
export const MAX_HORSES = 24;
```

- [ ] **Step 2: Clamp input in `computeAccelerations`**

In `apps/horse-racing/src/simulation/physics.ts`, remove the `playerHorseId` parameter and `horseId === playerHorseId` guards. Every horse now receives input directly. Clamp to [-1, 1].

Replace the function signature and body:

```typescript
export function computeAccelerations(
    tangentialVel: number,
    normalVel: number,
    attrs: CoreAttributes,
    input: InputState,
    frame: TrackFrame,
): [number, number] {
    const clampedT = Math.max(-1, Math.min(1, input.tangential));
    const clampedN = Math.max(-1, Math.min(1, input.normal));

    // --- Tangential ---
    let a_t = computeCruiseForce(tangentialVel, attrs.cruiseSpeed);
    a_t += clampedT * F_T_MAX * attrs.forwardAccel;
    a_t -= C_DRAG * tangentialVel;
    if (tangentialVel >= attrs.maxSpeed && a_t > 0) {
        a_t = 0;
    }

    // --- Normal ---
    let a_n = 0;
    if (frame.turnRadius < 1e6 && frame.turnRadius > 1e-3) {
        a_n -= (tangentialVel * tangentialVel) / frame.turnRadius;
    }
    a_n -= NORMAL_DAMP * normalVel;
    a_n += clampedN * F_N_MAX * attrs.turnAccel;
    a_n -= C_DRAG * normalVel;

    return [a_t, a_n];
}
```

- [ ] **Step 3: Update `applyForcesToBody` in `physics.ts`**

Remove `playerHorseId` from `applyForcesToBody` and pass `input` directly through. The function now receives the specific horse's input:

```typescript
function applyForcesToBody(
    horse: Horse,
    body: Polygon,
    attrs: CoreAttributes,
    input: InputState,
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
        frame,
    );

    const mass = attrs.weight;
    body.applyForce({
        x: (a_t * frame.tangential.x + a_n * frame.normal.x) * mass,
        y: (a_t * frame.tangential.y + a_n * frame.normal.y) * mass,
    });

    body.setOrientationAngle(Math.atan2(frame.tangential.y, frame.tangential.x));
    body.angularVelocity = 0;
}
```

- [ ] **Step 4: Update `stepPhysics` to accept per-horse inputs**

Change `stepPhysics` to take a `Map<number, InputState>` instead of a single `InputState` + `playerHorseId`:

```typescript
const ZERO_INPUT: InputState = { tangential: 0, normal: 0 };

export function stepPhysics(
    horses: Horse[],
    inputs: Map<number, InputState>,
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
                inputs.get(h.id) ?? ZERO_INPUT,
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

- [ ] **Step 5: Update `Race.tick()` to accept per-horse actions**

Change `Race.tick()` to accept a `Map<number, InputState>`. The browser caller builds a single-entry map for the player horse:

```typescript
// In race.ts:

tick(inputs: Map<number, InputState>): void {
    if (this.state.phase !== 'running') return;

    // 1. Resolve effective attributes
    for (const h of this.state.horses) {
        if (!h.finished) {
            h.effectiveAttributes = applyExhaustion(h);
        }
    }

    // 2. Physics substeps
    stepPhysics(
        this.state.horses,
        inputs,
        this.raceWorld,
        PHYS_SUBSTEPS,
        FIXED_DT,
    );

    // 3. Stamina drain (once per tick, after physics)
    const zeroInput: InputState = { tangential: 0, normal: 0 };
    for (const h of this.state.horses) {
        if (!h.finished) {
            const frame = h.navigator.getTrackFrame(h.pos);
            const horseInput = inputs.get(h.id) ?? zeroInput;
            drainStamina(h, h.effectiveAttributes, horseInput, frame);
        }
    }

    // 4. Finish detection (unchanged)
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
```

- [ ] **Step 6: Update `V2Sim` to build the inputs map**

In `apps/horse-racing/src/simulation/sim.ts`, update the `tick()` method to build a `Map` from the keyboard input:

```typescript
// In V2Sim.tick():
private tick(): void {
    if (this.disposed) return;
    const prevPhase = this.race.state.phase;

    const inputs = new Map<number, InputState>();
    const pid = this.race.state.playerHorseId;
    if (pid !== null) {
        inputs.set(pid, this.input.state);
    }
    this.race.tick(inputs);

    this.renderer.syncHorses(
        this.race.state.horses,
        this.race.state.playerHorseId,
    );

    if (this.race.state.phase !== prevPhase) {
        this.emitPhase();
    }

    if (pid !== null && this.race.state.phase === 'running') {
        const h = this.race.state.horses[pid];
        this.components.camera.setPosition({ x: h.pos.x, y: h.pos.y });
    }
}
```

- [ ] **Step 7: Update existing tests**

In `apps/horse-racing/test/force-model.test.ts`, update calls to `computeAccelerations` to remove `playerHorseId` and `horseId` parameters. The old signature was:

```typescript
computeAccelerations(tVel, nVel, attrs, input, playerHorseId, horseId, frame)
```

The new signature is:

```typescript
computeAccelerations(tVel, nVel, attrs, input, frame)
```

Update every call in the test file — remove the 5th and 6th arguments (playerHorseId, horseId). Tests that previously set `playerHorseId = 0, horseId = 0` to enable input now just pass `input` directly. Tests that set `playerHorseId = null` (AI horse, no input) should pass `{ tangential: 0, normal: 0 }` as input instead.

In `apps/horse-racing/test/pacing-strategy.test.ts`, update the `runPlayerRace` helper. Change:

```typescript
race.tick(input);
```

To:

```typescript
const inputs = new Map<number, InputState>();
inputs.set(0, input);
race.tick(inputs);
```

Import `InputState` from types (already imported).

In `apps/horse-racing/test/physics.test.ts`, update any calls to `stepPhysics` to use the new `Map<number, InputState>` signature instead of `(input, playerHorseId)`.

- [ ] **Step 8: Run all tests**

Run: `bunx nx test horse-racing`
Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/horse-racing/src/simulation/types.ts \
       apps/horse-racing/src/simulation/physics.ts \
       apps/horse-racing/src/simulation/race.ts \
       apps/horse-racing/src/simulation/sim.ts \
       apps/horse-racing/test/force-model.test.ts \
       apps/horse-racing/test/pacing-strategy.test.ts \
       apps/horse-racing/test/physics.test.ts
git commit -m "refactor(horse-racing): widen InputState to continuous, per-horse actions"
```

---

### Task 2: Variable horse count in spawnHorses

Currently `spawnHorses` hardcodes 4 horses. The server needs to create 1–24 horses per race.

**Files:**
- Modify: `apps/horse-racing/src/simulation/race.ts`
- Create: `apps/horse-racing/test/spawn.test.ts`

- [ ] **Step 1: Write failing tests for variable horse count**

Create `apps/horse-racing/test/spawn.test.ts`:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

import { parseTrackJson } from '../src/simulation/track-from-json';
import { spawnHorses } from '../src/simulation/race';

function loadTrack(name: string) {
    const raw = JSON.parse(
        readFileSync(join(__dirname, '../public/tracks', name), 'utf-8'),
    );
    return parseTrackJson(raw);
}

describe('spawnHorses', () => {
    const segments = loadTrack('test_oval.json');

    it('spawns the requested number of horses', () => {
        const horses = spawnHorses(segments, 8);
        expect(horses).toHaveLength(8);
    });

    it('defaults to 4 horses', () => {
        const horses = spawnHorses(segments);
        expect(horses).toHaveLength(4);
    });

    it('assigns sequential ids starting from 0', () => {
        const horses = spawnHorses(segments, 6);
        expect(horses.map((h) => h.id)).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('spaces horses across available lanes', () => {
        const horses = spawnHorses(segments, 3);
        // All horses should have distinct y-ish positions (different lanes)
        const positions = horses.map((h) => `${h.pos.x.toFixed(2)},${h.pos.y.toFixed(2)}`);
        const unique = new Set(positions);
        expect(unique.size).toBe(3);
    });

    it('clamps to MAX_HORSES', () => {
        const horses = spawnHorses(segments, 30);
        expect(horses).toHaveLength(24);
    });

    it('clamps to minimum 1', () => {
        const horses = spawnHorses(segments, 0);
        expect(horses).toHaveLength(1);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test apps/horse-racing/test/spawn.test.ts`
Expected: FAIL — `spawnHorses` doesn't accept a second parameter.

- [ ] **Step 3: Update `spawnHorses` to accept `horseCount`**

In `apps/horse-racing/src/simulation/race.ts`, modify `spawnHorses`:

```typescript
import {
    FIXED_DT,
    MAX_HORSES,
    PHYS_SUBSTEPS,
    TRACK_HALF_WIDTH,
    type Horse,
    type InputState,
    type RaceState,
} from './types';

// Replace HORSE_COLORS with a function that generates enough colors:
function horseColor(index: number): number {
    const BASE_COLORS = [
        0xc9a227, 0x4169e1, 0xe53935, 0x43a047,
        0x8e24aa, 0xf57c00, 0x00897b, 0xc62828,
        0x1565c0, 0x6a1b9a, 0xef6c00, 0x2e7d32,
        0xad1457, 0x00838f, 0x4e342e, 0x37474f,
        0xfdd835, 0x7cb342, 0x039be5, 0xd81b60,
        0x00acc1, 0x5d4037, 0x546e7a, 0xff8f00,
    ];
    return BASE_COLORS[index % BASE_COLORS.length];
}

export function spawnHorses(
    segments: TrackSegment[],
    horseCount = 4,
): Horse[] {
    if (segments.length === 0) {
        throw new Error('spawnHorses: track has no segments');
    }
    const count = Math.max(1, Math.min(MAX_HORSES, horseCount));
    const first = segments[0];
    const probe = new TrackNavigator(segments, 0, TRACK_HALF_WIDTH);
    const startPoint: Point = { x: first.startPoint.x, y: first.startPoint.y };
    const frame = probe.getTrackFrame(startPoint);

    const laneSpacing =
        count > 1
            ? (TRACK_HALF_WIDTH * 2 * 0.8) / (count - 1)
            : 0;

    return Array.from({ length: count }, (_, id) => {
        const laneOffset =
            count > 1
                ? -TRACK_HALF_WIDTH * 0.8 + id * laneSpacing
                : 0;
        const pos: Point = {
            x: startPoint.x + frame.normal.x * laneOffset,
            y: startPoint.y + frame.normal.y * laneOffset,
        };
        const attrs = createDefaultAttributes();
        return {
            id,
            color: horseColor(id),
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
```

Update the `Race` constructor to pass `horseCount` through:

```typescript
export class Race {
    state: RaceState;
    private segments: TrackSegment[];
    private raceWorld: RaceWorld;

    constructor(segments: TrackSegment[], horseCount = 4) {
        this.segments = segments;
        this.state = {
            phase: 'gate',
            horses: spawnHorses(segments, horseCount),
            playerHorseId: null,
            tick: 0,
            finishOrder: [],
        };
        this.raceWorld = new RaceWorld(segments);
        this.addHorseBodies();
    }

    // ... reset also needs horseCount. Store it:
}
```

Add a `private horseCount: number` field to `Race` so `reset()` can reuse it:

```typescript
export class Race {
    state: RaceState;
    private segments: TrackSegment[];
    private raceWorld: RaceWorld;
    private horseCount: number;

    constructor(segments: TrackSegment[], horseCount = 4) {
        this.segments = segments;
        this.horseCount = horseCount;
        // ... rest unchanged, use horseCount in spawnHorses call
    }

    reset(): void {
        this.raceWorld.dispose();
        this.state = {
            phase: 'gate',
            horses: spawnHorses(this.segments, this.horseCount),
            playerHorseId: null,
            tick: 0,
            finishOrder: [],
        };
        this.raceWorld = new RaceWorld(this.segments);
        this.addHorseBodies();
    }
}
```

- [ ] **Step 4: Run tests**

Run: `bunx nx test horse-racing`
Expected: All tests pass (spawn tests + existing tests).

- [ ] **Step 5: Commit**

```bash
git add apps/horse-racing/src/simulation/race.ts \
       apps/horse-racing/src/simulation/types.ts \
       apps/horse-racing/test/spawn.test.ts
git commit -m "feat(horse-racing): support variable horse count in spawnHorses (1-24)"
```

---

### Task 3: Add `sampleTrackAhead` to TrackNavigator

The observation vector needs lookahead track frames at 25m, 50m, 100m, 200m ahead of a horse's current position. `TrackNavigator` can already compute frames and progress, but has no method to sample at a fixed distance ahead. This task adds that.

**Files:**
- Modify: `apps/horse-racing/src/simulation/track-navigator.ts`
- Create: `apps/horse-racing/test/track-lookahead.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/horse-racing/test/track-lookahead.test.ts`:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

import { parseTrackJson } from '../src/simulation/track-from-json';
import { TrackNavigator } from '../src/simulation/track-navigator';
import { TRACK_HALF_WIDTH } from '../src/simulation/types';

function loadTrack(name: string) {
    const raw = JSON.parse(
        readFileSync(join(__dirname, '../public/tracks', name), 'utf-8'),
    );
    return parseTrackJson(raw);
}

describe('TrackNavigator.sampleTrackAhead', () => {
    const segments = loadTrack('test_oval.json');

    it('returns a TrackFrame at the requested distance ahead', () => {
        const nav = new TrackNavigator(segments, 0, TRACK_HALF_WIDTH);
        const start = segments[0].startPoint;
        const frame = nav.sampleTrackAhead({ x: start.x, y: start.y }, 50);
        expect(frame).toBeDefined();
        expect(frame.turnRadius).toBeDefined();
        expect(frame.slope).toBeDefined();
    });

    it('returns current frame for distance 0', () => {
        const nav = new TrackNavigator(segments, 0, TRACK_HALF_WIDTH);
        const start = segments[0].startPoint;
        const frame0 = nav.getTrackFrame({ x: start.x, y: start.y });
        const frameSample = nav.sampleTrackAhead({ x: start.x, y: start.y }, 0);
        expect(frameSample.turnRadius).toBeCloseTo(frame0.turnRadius, 3);
        expect(frameSample.slope).toBeCloseTo(frame0.slope, 3);
    });

    it('crosses segment boundaries', () => {
        const nav = new TrackNavigator(segments, 0, TRACK_HALF_WIDTH);
        const start = segments[0].startPoint;
        // Sample far enough to cross into a curve segment
        const totalLength = nav.totalLength;
        const frame = nav.sampleTrackAhead(
            { x: start.x, y: start.y },
            totalLength * 0.3,
        );
        // Should get a frame from a different segment (curve)
        expect(frame).toBeDefined();
        expect(frame.turnRadius).toBeLessThan(1e6); // on a curve
    });

    it('clamps to last segment for distance beyond track', () => {
        const nav = new TrackNavigator(segments, 0, TRACK_HALF_WIDTH);
        const start = segments[0].startPoint;
        const frame = nav.sampleTrackAhead(
            { x: start.x, y: start.y },
            nav.totalLength * 2,
        );
        expect(frame).toBeDefined();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test apps/horse-racing/test/track-lookahead.test.ts`
Expected: FAIL — `sampleTrackAhead` doesn't exist.

- [ ] **Step 3: Implement `sampleTrackAhead`**

Add to `apps/horse-racing/src/simulation/track-navigator.ts`:

```typescript
/**
 * Sample the track frame at a point `distance` meters ahead of `position`
 * along the centerline. Walks forward through segments from currentIndex.
 * Does not mutate the navigator's state.
 *
 * If `distance` exceeds the remaining track length, returns the frame
 * at the end of the last segment.
 */
sampleTrackAhead(position: Point, distance: number): TrackFrame {
    if (distance <= 0) {
        return this.getTrackFrame(position);
    }

    // Compute how far along the current segment we are
    const seg = this.segments[this.currentIndex];
    const segLen = this._segmentLengths[this.currentIndex];
    let along = this.distanceAlongSegment(seg, position);
    along = Math.max(0, Math.min(segLen, along));

    let remaining = distance;
    let segIdx = this.currentIndex;

    // Consume rest of current segment
    const restOfCurrent = segLen - along;
    if (remaining <= restOfCurrent) {
        // Target is within current segment
        return this.frameAtSegmentOffset(segIdx, along + remaining);
    }
    remaining -= restOfCurrent;

    // Walk forward through subsequent segments
    segIdx++;
    while (segIdx < this.segments.length) {
        const sl = this._segmentLengths[segIdx];
        if (remaining <= sl) {
            return this.frameAtSegmentOffset(segIdx, remaining);
        }
        remaining -= sl;
        segIdx++;
    }

    // Past end of track — return frame at end of last segment
    const lastIdx = this.segments.length - 1;
    return this.frameAtSegmentOffset(lastIdx, this._segmentLengths[lastIdx]);
}

/** Distance along a segment from its start to the projection of `position`. */
private distanceAlongSegment(seg: TrackSegment, position: Point): number {
    if (seg.tracktype === 'STRAIGHT') {
        const dx = seg.endPoint.x - seg.startPoint.x;
        const dy = seg.endPoint.y - seg.startPoint.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1e-6) return 0;
        const fwdX = dx / len;
        const fwdY = dy / len;
        return (position.x - seg.startPoint.x) * fwdX +
               (position.y - seg.startPoint.y) * fwdY;
    }
    // Curve: arc length from start angle to position angle
    const toPosX = position.x - seg.center.x;
    const toPosY = position.y - seg.center.y;
    const anglePos = Math.atan2(toPosY, toPosX);
    const toStartX = seg.startPoint.x - seg.center.x;
    const toStartY = seg.startPoint.y - seg.center.y;
    const angleStart = Math.atan2(toStartY, toStartX);
    let delta = anglePos - angleStart;
    if (seg.angleSpan >= 0) {
        while (delta < 0) delta += 2 * Math.PI;
        while (delta > 2 * Math.PI) delta -= 2 * Math.PI;
    } else {
        while (delta > 0) delta -= 2 * Math.PI;
        while (delta < -2 * Math.PI) delta += 2 * Math.PI;
    }
    return Math.abs(delta) * seg.radius;
}

/**
 * Compute the centerline track frame at `offset` meters into segment `segIdx`.
 * Uses the centerline (nominalRadius for curves), not the horse's actual position.
 */
private frameAtSegmentOffset(segIdx: number, offset: number): TrackFrame {
    const seg = this.segments[segIdx];
    if (seg.tracktype === 'STRAIGHT') {
        // Frame is constant along a straight — just use the straight frame
        const start: Point = { x: seg.startPoint.x, y: seg.startPoint.y };
        const end: Point = { x: seg.endPoint.x, y: seg.endPoint.y };
        const tangential = PointCal.unitVector(PointCal.subVector(end, start));
        const curve = this.findNearestCurve(segIdx);
        const rotation = curve && curve.angleSpan < 0 ? Math.PI / 2 : -Math.PI / 2;
        const normal = PointCal.unitVector(
            PointCal.rotatePoint(tangential, rotation),
        );
        return {
            tangential,
            normal,
            turnRadius: Infinity,
            nominalRadius: Infinity,
            targetRadius: Infinity,
            slope: seg.slope ?? 0,
        };
    }

    // Curve: compute the point at the given arc distance from start
    const angleAtOffset = offset / seg.radius;
    const toStartX = seg.startPoint.x - seg.center.x;
    const toStartY = seg.startPoint.y - seg.center.y;
    const startAngle = Math.atan2(toStartY, toStartX);
    const angle = seg.angleSpan >= 0
        ? startAngle + angleAtOffset
        : startAngle - angleAtOffset;

    const normal: Point = { x: Math.cos(angle), y: Math.sin(angle) };
    const tangential = PointCal.unitVector(
        PointCal.rotatePoint(
            normal,
            seg.angleSpan >= 0 ? Math.PI / 2 : -Math.PI / 2,
        ),
    );

    return {
        tangential,
        normal,
        turnRadius: seg.radius,
        nominalRadius: seg.radius,
        targetRadius: seg.radius,
        slope: seg.slope ?? 0,
    };
}
```

Note: `findNearestCurve` is currently `private`. It needs to stay accessible to `frameAtSegmentOffset`. Since both are private methods on the same class, this is fine.

Also note: `distanceAlongSegment` replicates the same logic in `computeProgress`. This duplication is acceptable — `computeProgress` uses `this.currentIndex` and produces a normalized fraction, while `distanceAlongSegment` works on an arbitrary segment and produces raw meters.

- [ ] **Step 4: Run tests**

Run: `bunx nx test horse-racing`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/horse-racing/src/simulation/track-navigator.ts \
       apps/horse-racing/test/track-lookahead.test.ts
git commit -m "feat(horse-racing): add sampleTrackAhead to TrackNavigator"
```

---

### Task 4: Build observation vector (TDD)

The core deliverable: a pure function that reads `Race` state and produces a `Float64Array` per horse.

**Files:**
- Create: `apps/horse-racing/src/simulation/observation.ts`
- Create: `apps/horse-racing/test/observation.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/horse-racing/test/observation.test.ts`:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

import { parseTrackJson } from '../src/simulation/track-from-json';
import { Race } from '../src/simulation/race';
import { TRAIT_RANGES } from '../src/simulation/attributes';
import { MAX_HORSES, TRACK_HALF_WIDTH } from '../src/simulation/types';
import {
    buildObservations,
    OBS_SIZE,
    SELF_STATE_SIZE,
    TRACK_CONTEXT_SIZE,
    OPPONENT_SLOT_SIZE,
    OPPONENT_SLOTS,
} from '../src/simulation/observation';

function loadTrack(name: string) {
    const raw = JSON.parse(
        readFileSync(join(__dirname, '../public/tracks', name), 'utf-8'),
    );
    return parseTrackJson(raw);
}

describe('buildObservations', () => {
    const segments = loadTrack('test_oval.json');

    it('returns one Float64Array per horse', () => {
        const race = new Race(segments, 4);
        race.start(null);
        const obs = buildObservations(race);
        expect(obs).toHaveLength(4);
        expect(obs[0]).toBeInstanceOf(Float64Array);
    });

    it('each observation has OBS_SIZE elements', () => {
        const race = new Race(segments, 4);
        race.start(null);
        const obs = buildObservations(race);
        expect(obs[0].length).toBe(OBS_SIZE);
        expect(OBS_SIZE).toBe(139);
    });

    it('trackProgress starts at 0', () => {
        const race = new Race(segments, 4);
        race.start(null);
        const obs = buildObservations(race);
        expect(obs[0][0]).toBeCloseTo(0, 1); // trackProgress
    });

    it('stamina starts at 1.0 (normalized)', () => {
        const race = new Race(segments, 4);
        race.start(null);
        const obs = buildObservations(race);
        expect(obs[0][3]).toBeCloseTo(1.0, 5); // currentStamina / maxStamina
    });

    it('base attributes are normalized to [0, 1] via TRAIT_RANGES', () => {
        const race = new Race(segments, 1);
        race.start(null);
        const obs = buildObservations(race);
        // Default cruiseSpeed = 13, TRAIT_RANGES.cruiseSpeed = [8, 18]
        // normalized = (13 - 8) / (18 - 8) = 0.5
        expect(obs[0][8]).toBeCloseTo(0.5, 5);
    });

    it('opponent slots are zero-padded when fewer than MAX_HORSES-1', () => {
        const race = new Race(segments, 2);
        race.start(null);
        const obs = buildObservations(race);
        const opponentStart = SELF_STATE_SIZE + TRACK_CONTEXT_SIZE;
        // First opponent slot should be active
        expect(obs[0][opponentStart]).toBe(1.0); // active flag
        // Second opponent slot should be padded (inactive)
        expect(obs[0][opponentStart + OPPONENT_SLOT_SIZE]).toBe(0.0);
    });

    it('opponents are sorted by distance in track progress', () => {
        const race = new Race(segments, 4);
        race.start(null);
        // Tick a few times to spread horses out
        const emptyInputs = new Map();
        for (let i = 0; i < 10; i++) {
            race.tick(emptyInputs);
        }
        const obs = buildObservations(race);
        const opponentStart = SELF_STATE_SIZE + TRACK_CONTEXT_SIZE;
        // All 3 opponents should be active
        expect(obs[0][opponentStart]).toBe(1.0);
        expect(obs[0][opponentStart + OPPONENT_SLOT_SIZE]).toBe(1.0);
        expect(obs[0][opponentStart + 2 * OPPONENT_SLOT_SIZE]).toBe(1.0);
        // 4th slot should be padded
        expect(obs[0][opponentStart + 3 * OPPONENT_SLOT_SIZE]).toBe(0.0);
    });

    it('handles single horse (no opponents)', () => {
        const race = new Race(segments, 1);
        race.start(null);
        const obs = buildObservations(race);
        const opponentStart = SELF_STATE_SIZE + TRACK_CONTEXT_SIZE;
        // All opponent slots should be padded
        for (let i = 0; i < OPPONENT_SLOTS; i++) {
            expect(obs[0][opponentStart + i * OPPONENT_SLOT_SIZE]).toBe(0.0);
        }
    });

    it('handles max horses', () => {
        const race = new Race(segments, 24);
        race.start(null);
        const obs = buildObservations(race);
        expect(obs).toHaveLength(24);
        expect(obs[0].length).toBe(OBS_SIZE);
        // Horse 0 should see 23 active opponents
        const opponentStart = SELF_STATE_SIZE + TRACK_CONTEXT_SIZE;
        for (let i = 0; i < 23; i++) {
            expect(obs[0][opponentStart + i * OPPONENT_SLOT_SIZE]).toBe(1.0);
        }
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test apps/horse-racing/test/observation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `observation.ts`**

Create `apps/horse-racing/src/simulation/observation.ts`:

```typescript
import { TRAIT_RANGES, type CoreAttributes } from './attributes';
import type { Race } from './race';
import type { Horse } from './types';
import { MAX_HORSES, TRACK_HALF_WIDTH } from './types';

/** Lookahead distances in meters. */
const LOOKAHEAD_DISTANCES = [25, 50, 100, 200];

// --- Layout constants ---
export const SELF_STATE_SIZE = 14;
export const TRACK_CONTEXT_SIZE = 2 + LOOKAHEAD_DISTANCES.length * 2; // 10
export const OPPONENT_SLOT_SIZE = 5;
export const OPPONENT_SLOTS = MAX_HORSES - 1; // 23
export const OBS_SIZE =
    SELF_STATE_SIZE + TRACK_CONTEXT_SIZE + OPPONENT_SLOTS * OPPONENT_SLOT_SIZE; // 139

/** Normalize a trait value to [0, 1] using its defined range. */
function normalizeTrait(
    value: number,
    key: keyof CoreAttributes,
): number {
    const [min, max] = TRAIT_RANGES[key];
    if (max === min) return 0;
    return (value - min) / (max - min);
}

/** Curvature encoding: 1/turnRadius, 0 for straights. */
function curvature(turnRadius: number): number {
    return turnRadius < 1e6 ? 1 / turnRadius : 0;
}

/**
 * Build one observation vector per horse from the current race state.
 * Pure function — does not mutate the race.
 */
export function buildObservations(race: Race): Float64Array[] {
    const horses = race.state.horses;
    const result: Float64Array[] = [];

    for (const self of horses) {
        const obs = new Float64Array(OBS_SIZE);
        let idx = 0;

        // --- Self state (14 floats) ---
        const base = self.baseAttributes;
        const eff = self.effectiveAttributes;

        obs[idx++] = self.trackProgress;                          // 0
        obs[idx++] = self.tangentialVel / base.maxSpeed;           // 1
        obs[idx++] = self.normalVel / base.maxSpeed;               // 2
        obs[idx++] = self.currentStamina / base.maxStamina;        // 3
        obs[idx++] = eff.cruiseSpeed / base.cruiseSpeed;           // 4
        obs[idx++] = eff.maxSpeed / base.maxSpeed;                 // 5
        obs[idx++] = eff.forwardAccel / base.forwardAccel;         // 6
        obs[idx++] = eff.turnAccel / base.turnAccel;               // 7
        obs[idx++] = normalizeTrait(base.cruiseSpeed, 'cruiseSpeed');   // 8
        obs[idx++] = normalizeTrait(base.maxSpeed, 'maxSpeed');         // 9
        obs[idx++] = normalizeTrait(base.forwardAccel, 'forwardAccel'); // 10
        obs[idx++] = normalizeTrait(base.turnAccel, 'turnAccel');       // 11
        obs[idx++] = normalizeTrait(base.corneringGrip, 'corneringGrip'); // 12
        obs[idx++] = normalizeTrait(base.weight, 'weight');             // 13

        // --- Track context (10 floats) ---
        const frame = self.navigator.getTrackFrame(self.pos);
        obs[idx++] = curvature(frame.turnRadius);                  // 14
        obs[idx++] = frame.slope;                                  // 15

        for (const dist of LOOKAHEAD_DISTANCES) {
            const ahead = self.navigator.sampleTrackAhead(self.pos, dist);
            obs[idx++] = curvature(ahead.turnRadius);              // 16,18,20,22
            obs[idx++] = ahead.slope;                              // 17,19,21,23
        }

        // --- Opponents (23 slots × 5 floats) ---
        const opponents = horses
            .filter((h) => h.id !== self.id)
            .map((h) => ({
                horse: h,
                absDist: Math.abs(h.trackProgress - self.trackProgress),
            }))
            .sort((a, b) => a.absDist - b.absDist);

        for (let i = 0; i < OPPONENT_SLOTS; i++) {
            if (i < opponents.length) {
                const opp = opponents[i].horse;
                obs[idx++] = 1.0;                                          // active
                obs[idx++] = opp.trackProgress - self.trackProgress;       // relativeProgress
                obs[idx++] = (opp.tangentialVel - self.tangentialVel) / base.maxSpeed; // relativeTangentialVel
                obs[idx++] = normalOffset(opp, self) / TRACK_HALF_WIDTH;   // relativeNormalOffset
                obs[idx++] = (opp.normalVel - self.normalVel) / base.maxSpeed; // relativeNormalVel
            } else {
                // Padding: 5 zeros
                idx += 5;
            }
        }

        result.push(obs);
    }

    return result;
}

/**
 * Compute the lateral offset between two horses relative to the track.
 * Projects the position difference onto the track normal at the observing horse.
 */
function normalOffset(opponent: Horse, self: Horse): number {
    const frame = self.navigator.getTrackFrame(self.pos);
    const dx = opponent.pos.x - self.pos.x;
    const dy = opponent.pos.y - self.pos.y;
    return dx * frame.normal.x + dy * frame.normal.y;
}
```

- [ ] **Step 4: Run tests**

Run: `bunx nx test horse-racing`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/horse-racing/src/simulation/observation.ts \
       apps/horse-racing/test/observation.test.ts
git commit -m "feat(horse-racing): add observation vector builder (139 floats per horse)"
```

---

### Task 5: Rewrite validation server

Replace the broken v1 `server.ts` with a v2 server using `Race` + `buildObservations`.

**Files:**
- Rewrite: `apps/horse-racing/src/simulation/server.ts`
- Create: `apps/horse-racing/test/server.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/horse-racing/test/server.test.ts`:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

import { OBS_SIZE } from '../src/simulation/observation';

const PORT = 3457; // Avoid conflict with dev server
let server: ReturnType<typeof Bun.serve>;

// Import the server factory (we'll create a startServer function)
import { startServer } from '../src/simulation/server';

beforeAll(() => {
    server = startServer(PORT);
});

afterAll(() => {
    server.stop();
});

const BASE = `http://localhost:${PORT}`;

describe('validation server', () => {
    it('GET /health returns ok', async () => {
        const res = await fetch(`${BASE}/health`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('ok');
    });

    it('POST /step before /reset returns 400', async () => {
        const res = await fetch(`${BASE}/step`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actions: [] }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/reset/i);
    });

    it('POST /reset creates a race and returns observations', async () => {
        const res = await fetch(`${BASE}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track: 'test_oval', horseCount: 4 }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.horseCount).toBe(4);
        expect(body.observations).toHaveLength(4);
        expect(body.observations[0]).toHaveLength(OBS_SIZE);
    });

    it('POST /step advances the race', async () => {
        // Reset first
        await fetch(`${BASE}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track: 'test_oval', horseCount: 2 }),
        });

        const res = await fetch(`${BASE}/step`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                actions: [[1.0, 0.0], [0.0, 0.0]],
            }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.observations).toHaveLength(2);
        expect(body.observations[0]).toHaveLength(OBS_SIZE);
        expect(body.rewards).toHaveLength(2);
        expect(body.dones).toHaveLength(2);
        expect(body.tick).toBe(1);
    });

    it('POST /reset with invalid track returns 404', async () => {
        const res = await fetch(`${BASE}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track: 'nonexistent', horseCount: 4 }),
        });
        expect(res.status).toBe(404);
    });

    it('POST /reset with horseCount > 24 clamps to 24', async () => {
        const res = await fetch(`${BASE}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track: 'test_oval', horseCount: 30 }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.horseCount).toBe(24);
    });

    it('POST /step with wrong action count returns 400', async () => {
        await fetch(`${BASE}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track: 'test_oval', horseCount: 4 }),
        });

        const res = await fetch(`${BASE}/step`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                actions: [[1.0, 0.0]], // Only 1 action for 4 horses
            }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/Expected 4 actions/);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test apps/horse-racing/test/server.test.ts`
Expected: FAIL — `startServer` doesn't exist.

- [ ] **Step 3: Implement the server**

Rewrite `apps/horse-racing/src/simulation/server.ts`:

```typescript
/**
 * Headless validation server for the horse-racing simulation.
 *
 * Exposes the v2 Race over HTTP so a Python RL environment can validate
 * its reimplemented physics against the TypeScript ground truth.
 *
 * Start with: `bun run apps/horse-racing/src/simulation/server.ts`
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { parseTrackJson } from './track-from-json';
import { Race } from './race';
import { buildObservations } from './observation';
import type { InputState } from './types';

const TRACKS_DIR = join(import.meta.dir, '../../public/tracks');

function loadTrack(name: string) {
    const path = join(TRACKS_DIR, `${name}.json`);
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parseTrackJson(raw);
}

type ResetRequest = {
    track: string;
    horseCount: number;
};

type StepRequest = {
    actions: [number, number][];
};

export function startServer(port: number) {
    let race: Race | null = null;
    let prevProgress: number[] = [];

    return Bun.serve({
        port,
        async fetch(req) {
            const url = new URL(req.url);

            if (url.pathname === '/health') {
                return Response.json({ status: 'ok' });
            }

            if (url.pathname === '/reset' && req.method === 'POST') {
                const body = (await req.json()) as ResetRequest;

                let segments;
                try {
                    segments = loadTrack(body.track);
                } catch {
                    return Response.json(
                        { error: `Track "${body.track}" not found` },
                        { status: 404 },
                    );
                }

                const horseCount = Math.max(1, Math.min(24, body.horseCount));
                race = new Race(segments, horseCount);
                race.start(null); // No player — all agents

                const observations = buildObservations(race);
                prevProgress = race.state.horses.map((h) => h.trackProgress);

                return Response.json({
                    observations: observations.map((o) => Array.from(o)),
                    horseCount,
                });
            }

            if (url.pathname === '/step' && req.method === 'POST') {
                if (!race || race.state.phase !== 'running') {
                    return Response.json(
                        {
                            error: race
                                ? 'Race is finished. Call /reset.'
                                : 'No active race. Call /reset first.',
                        },
                        { status: 400 },
                    );
                }

                const body = (await req.json()) as StepRequest;
                const horseCount = race.state.horses.length;

                if (body.actions.length !== horseCount) {
                    return Response.json(
                        {
                            error: `Expected ${horseCount} actions, got ${body.actions.length}`,
                        },
                        { status: 400 },
                    );
                }

                // Build per-horse input map
                const inputs = new Map<number, InputState>();
                for (let i = 0; i < horseCount; i++) {
                    const [t, n] = body.actions[i];
                    inputs.set(i, { tangential: t, normal: n });
                }

                race.tick(inputs);

                const observations = buildObservations(race);
                const rewards = race.state.horses.map(
                    (h, i) => h.trackProgress - prevProgress[i],
                );
                const dones = race.state.horses.map((h) => h.finished);
                prevProgress = race.state.horses.map((h) => h.trackProgress);

                return Response.json({
                    observations: observations.map((o) => Array.from(o)),
                    rewards,
                    dones,
                    tick: race.state.tick,
                });
            }

            return Response.json({ error: 'Not found' }, { status: 404 });
        },
    });
}

// --- Main entry point ---
if (import.meta.main) {
    const PORT = Number(process.env.PORT) || 3456;
    startServer(PORT);
    console.log(
        `Horse racing validation server running on http://localhost:${PORT}`,
    );
}
```

- [ ] **Step 4: Run tests**

Run: `bunx nx test horse-racing`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/horse-racing/src/simulation/server.ts \
       apps/horse-racing/test/server.test.ts
git commit -m "feat(horse-racing): rewrite validation server with v2 Race + observation vector"
```

---

### Task 6: Export observation module and update simulation index

Wire the new observation module into the simulation barrel export so it's accessible from outside.

**Files:**
- Modify: `apps/horse-racing/src/simulation/index.ts`

- [ ] **Step 1: Update the index**

Add observation exports to `apps/horse-racing/src/simulation/index.ts`:

```typescript
export { V2Sim, attachV2Sim, type V2SimHandle, type PhaseChangeCallback } from './sim';
export type { Horse, InputState, RacePhase, RaceState } from './types';
export { MAX_HORSES } from './types';
export type { CoreAttributes } from './attributes';
export { createDefaultAttributes, TRAIT_RANGES } from './attributes';
export { Race } from './race';
export {
    buildObservations,
    OBS_SIZE,
    SELF_STATE_SIZE,
    TRACK_CONTEXT_SIZE,
    OPPONENT_SLOT_SIZE,
    OPPONENT_SLOTS,
} from './observation';
```

- [ ] **Step 2: Run all tests to verify nothing breaks**

Run: `bunx nx test horse-racing`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/horse-racing/src/simulation/index.ts
git commit -m "feat(horse-racing): export observation module and Race from simulation index"
```

---

## Troubleshooting Guide

**Observation vector has wrong size:**
- Check `OBS_SIZE` constant matches `SELF_STATE_SIZE + TRACK_CONTEXT_SIZE + OPPONENT_SLOTS * OPPONENT_SLOT_SIZE`
- Verify `MAX_HORSES = 24`, `OPPONENT_SLOTS = 23`, `OPPONENT_SLOT_SIZE = 5`

**Lookahead returns wrong segment:**
- `sampleTrackAhead` walks from `currentIndex`, not from segment 0. Make sure `updateSegment` was called before sampling.
- Check `distanceAlongSegment` handles the CCW/CW angle correctly for curves.

**All horses get zero input:**
- After Task 1, input is no longer gated by `playerHorseId`. Verify the `inputs` Map is populated for each horse.
- In the browser, `V2Sim.tick()` must build the Map with the player's keyboard input.

**Server returns stale observations:**
- `buildObservations` is called after `race.tick()`. Verify the server calls tick before building observations.
- `prevProgress` for reward calculation must be saved before tick, not after.

**Base attribute normalization off:**
- Check `TRAIT_RANGES` in `attributes.ts` — the min/max must match the actual attribute generation ranges.
- Default attributes should normalize to 0.5 for traits at the midpoint of their range.
