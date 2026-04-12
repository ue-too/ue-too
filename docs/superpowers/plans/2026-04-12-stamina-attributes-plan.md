# Attributes + Stamina System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-horse attributes and a drain-only stamina system to the v2 horse-racing sim so that pacing strategy matters — flooring it must lose to smart energy management on every track length.

**Architecture:** Pipeline approach — `applyExhaustion(horse) → stepPhysics(horse, attrs, input, dt) × 8 substeps → drainStamina(horse, attrs, input, frame)`. New modules (`attributes.ts`, `stamina.ts`, `exhaustion.ts`) are layered onto the existing v2 sim. `stepPhysics` is parameterized by per-horse `CoreAttributes` instead of reading global constants.

**Tech Stack:** TypeScript, Vitest (via `bun test`), existing v2 simulation modules

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `apps/horse-racing/src/simulation/attributes.ts` | `CoreAttributes` interface, `TRAIT_RANGES`, `createDefaultAttributes()`, `F_T_MAX`, `F_N_MAX` constants |
| `apps/horse-racing/src/simulation/stamina.ts` | `drainStamina()`, all drain rate constants, `GRIP_FORCE_BASELINE` |
| `apps/horse-racing/src/simulation/exhaustion.ts` | `applyExhaustion()`, `EXHAUSTION_DECAY`, floor value constants |
| `apps/horse-racing/test/attributes.test.ts` | Tests for `createDefaultAttributes()` and trait ranges |
| `apps/horse-racing/test/stamina.test.ts` | Tests for `drainStamina()` |
| `apps/horse-racing/test/exhaustion.test.ts` | Tests for `applyExhaustion()` |

### Modified Files

| File | Changes |
|---|---|
| `apps/horse-racing/src/simulation/types.ts` | Add `baseAttributes`, `currentStamina`, `effectiveAttributes` to `Horse`. Remove `TARGET_CRUISE`, `F_T_MAX`, `F_N_MAX`. Change `FIXED_DT` to `1/240`. Add `PHYS_SUBSTEPS`. |
| `apps/horse-racing/src/simulation/cruise.ts` | `computeCruiseForce` takes `cruiseSpeed` param instead of importing `TARGET_CRUISE` |
| `apps/horse-racing/src/simulation/physics.ts` | `stepPhysics` takes per-horse `CoreAttributes`. Uses `attrs.cruiseSpeed`, `attrs.forwardAccel`, `attrs.turnAccel`, `attrs.maxSpeed`. Processes one horse at a time. |
| `apps/horse-racing/src/simulation/race.ts` | `spawnHorses` assigns `baseAttributes`, `currentStamina`, `effectiveAttributes`. `tick()` runs exhaustion → 8 substeps → drain pipeline. |
| `apps/horse-racing/src/simulation/index.ts` | Re-export `CoreAttributes` |
| `apps/horse-racing/test/cruise.test.ts` | Update to pass `cruiseSpeed` instead of importing `TARGET_CRUISE` |
| `apps/horse-racing/test/physics.test.ts` | Update to work with new `stepPhysics` signature and substep model |

---

### Task 1: CoreAttributes and Default Factory

**Files:**
- Create: `apps/horse-racing/src/simulation/attributes.ts`
- Create: `apps/horse-racing/test/attributes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/horse-racing/test/attributes.test.ts`:

```ts
import { createDefaultAttributes, TRAIT_RANGES } from '../src/simulation/attributes';
import type { CoreAttributes } from '../src/simulation/attributes';

describe('createDefaultAttributes', () => {
    it('returns an object with all 8 traits', () => {
        const attrs = createDefaultAttributes();
        const keys: (keyof CoreAttributes)[] = [
            'cruiseSpeed',
            'maxSpeed',
            'forwardAccel',
            'turnAccel',
            'corneringGrip',
            'maxStamina',
            'drainRateMult',
            'weight',
        ];
        for (const k of keys) {
            expect(typeof attrs[k]).toBe('number');
        }
    });

    it('default values match spec', () => {
        const attrs = createDefaultAttributes();
        expect(attrs.cruiseSpeed).toBe(13);
        expect(attrs.maxSpeed).toBe(20);
        expect(attrs.forwardAccel).toBe(1.0);
        expect(attrs.turnAccel).toBe(1.0);
        expect(attrs.corneringGrip).toBe(1.0);
        expect(attrs.maxStamina).toBe(100);
        expect(attrs.drainRateMult).toBe(1.0);
        expect(attrs.weight).toBe(500);
    });

    it('every default falls within its TRAIT_RANGES', () => {
        const attrs = createDefaultAttributes();
        for (const [key, [min, max]] of Object.entries(TRAIT_RANGES)) {
            const val = attrs[key as keyof CoreAttributes];
            expect(val).toBeGreaterThanOrEqual(min);
            expect(val).toBeLessThanOrEqual(max);
        }
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx nx test horse-racing -- --testPathPattern=attributes`
Expected: FAIL — cannot find module `../src/simulation/attributes`

- [ ] **Step 3: Write the implementation**

Create `apps/horse-racing/src/simulation/attributes.ts`:

```ts
export interface CoreAttributes {
    cruiseSpeed: number;
    maxSpeed: number;
    forwardAccel: number;
    turnAccel: number;
    corneringGrip: number;
    maxStamina: number;
    drainRateMult: number;
    weight: number;
}

export const TRAIT_RANGES: Record<keyof CoreAttributes, [min: number, max: number]> = {
    cruiseSpeed: [8, 18],
    maxSpeed: [15, 25],
    forwardAccel: [0.5, 1.5],
    turnAccel: [0.5, 1.5],
    corneringGrip: [0.5, 1.5],
    maxStamina: [50, 150],
    drainRateMult: [0.7, 1.3],
    weight: [400, 600],
};

/** Base tangential force cap in m/s^2 (scaled by forwardAccel). */
export const F_T_MAX = 5;
/** Base normal force cap in m/s^2 (scaled by turnAccel). */
export const F_N_MAX = 3;

export function createDefaultAttributes(): CoreAttributes {
    return {
        cruiseSpeed: 13,
        maxSpeed: 20,
        forwardAccel: 1.0,
        turnAccel: 1.0,
        corneringGrip: 1.0,
        maxStamina: 100,
        drainRateMult: 1.0,
        weight: 500,
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx nx test horse-racing -- --testPathPattern=attributes`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/horse-racing/src/simulation/attributes.ts apps/horse-racing/test/attributes.test.ts
git commit -m "feat(horse-racing): add CoreAttributes interface and default factory"
```

---

### Task 2: Update Horse Type and types.ts Constants

**Files:**
- Modify: `apps/horse-racing/src/simulation/types.ts`

- [ ] **Step 1: Update types.ts**

Replace the full contents of `apps/horse-racing/src/simulation/types.ts`:

```ts
import type { Point } from '@ue-too/math';
import type { TrackNavigator } from './track-navigator';
import type { CoreAttributes } from './attributes';

// --- Physics constants ---

/** Cruise controller proportional gain, 1/s. */
export const K_CRUISE = 2.0;
/** Linear drag coefficient, 1/s. */
export const C_DRAG = 0.1;
/** Half-width of the track in meters. Rails are at +/- this distance. */
export const TRACK_HALF_WIDTH = 10.325;
/** Physics substep frequency in Hz. */
export const PHYS_HZ = 240;
/** Number of physics substeps per game tick. */
export const PHYS_SUBSTEPS = 8;
/** Fixed physics timestep in seconds (one substep). */
export const FIXED_DT = 1 / PHYS_HZ;

// --- State shapes ---

export interface Horse {
    id: number;
    color: number;
    pos: Point;
    tangentialVel: number;
    normalVel: number;
    trackProgress: number;
    navigator: TrackNavigator;
    finished: boolean;
    finishOrder: number | null;
    baseAttributes: CoreAttributes;
    currentStamina: number;
    effectiveAttributes: CoreAttributes;
}

export interface InputState {
    tangential: -1 | 0 | 1;
    normal: -1 | 0 | 1;
}

export type RacePhase = 'gate' | 'running' | 'finished';

export interface RaceState {
    phase: RacePhase;
    horses: Horse[];
    playerHorseId: number | null;
    tick: number;
    finishOrder: number[];
}
```

Note: `TARGET_CRUISE`, `F_T_MAX`, `F_N_MAX` are removed. `F_T_MAX` and `F_N_MAX` now live in `attributes.ts`. `FIXED_DT` changes from `1/60` to `1/240`. `PHYS_HZ` and `PHYS_SUBSTEPS` are added.

- [ ] **Step 2: Run all tests to see what breaks**

Run: `bunx nx test horse-racing`
Expected: FAIL — `cruise.test.ts` imports `TARGET_CRUISE` which no longer exists, `physics.test.ts` and `race.ts` don't supply the new `Horse` fields.

- [ ] **Step 3: Commit the type change (tests broken intentionally, will fix in next tasks)**

```bash
git add apps/horse-racing/src/simulation/types.ts
git commit -m "refactor(horse-racing): add attributes and stamina fields to Horse, update physics constants"
```

---

### Task 3: Update cruise.ts and Its Tests

**Files:**
- Modify: `apps/horse-racing/src/simulation/cruise.ts`
- Modify: `apps/horse-racing/test/cruise.test.ts`

- [ ] **Step 1: Update cruise.ts to take cruiseSpeed as parameter**

Replace the full contents of `apps/horse-racing/src/simulation/cruise.ts`:

```ts
import { K_CRUISE } from './types';

/**
 * Proportional cruise controller. Returns the tangential force the engine
 * must apply to drag `currentVel` toward `cruiseSpeed`.
 */
export function computeCruiseForce(currentVel: number, cruiseSpeed: number): number {
    return K_CRUISE * (cruiseSpeed - currentVel);
}
```

Note: The function signature is the same (`currentVel`, `targetVel`) but the parameter is renamed to `cruiseSpeed` for clarity. The implementation is identical — this is just a rename. The caller (`physics.ts`) will pass per-horse `attrs.cruiseSpeed` instead of the deleted `TARGET_CRUISE`.

- [ ] **Step 2: Update cruise.test.ts**

Replace the full contents of `apps/horse-racing/test/cruise.test.ts`:

```ts
import { computeCruiseForce } from '../src/simulation/cruise';
import { K_CRUISE } from '../src/simulation/types';

const CRUISE_SPEED = 13;

describe('computeCruiseForce', () => {
    it('returns zero at the cruise velocity', () => {
        expect(computeCruiseForce(CRUISE_SPEED, CRUISE_SPEED)).toBeCloseTo(0);
    });

    it('returns positive force when below cruise', () => {
        expect(computeCruiseForce(0, CRUISE_SPEED)).toBeCloseTo(K_CRUISE * CRUISE_SPEED);
    });

    it('returns negative force when above cruise', () => {
        expect(computeCruiseForce(2 * CRUISE_SPEED, CRUISE_SPEED))
            .toBeCloseTo(-K_CRUISE * CRUISE_SPEED);
    });
});
```

- [ ] **Step 3: Run cruise tests**

Run: `bunx nx test horse-racing -- --testPathPattern=cruise`
Expected: PASS (3 tests)

- [ ] **Step 4: Commit**

```bash
git add apps/horse-racing/src/simulation/cruise.ts apps/horse-racing/test/cruise.test.ts
git commit -m "refactor(horse-racing): parameterize computeCruiseForce by cruiseSpeed"
```

---

### Task 4: Update stepPhysics for Per-Horse Attributes and Substeps

**Files:**
- Modify: `apps/horse-racing/src/simulation/physics.ts`
- Modify: `apps/horse-racing/test/physics.test.ts`

- [ ] **Step 1: Update physics.ts**

Replace the full contents of `apps/horse-racing/src/simulation/physics.ts`:

```ts
import type { Point } from '@ue-too/math';
import type { TrackFrame, TrackNavigator } from './track-navigator';
import type { CoreAttributes } from './attributes';
import { F_T_MAX, F_N_MAX } from './attributes';

import { computeCruiseForce } from './cruise';
import {
    C_DRAG,
    TRACK_HALF_WIDTH,
    type Horse,
    type InputState,
} from './types';

/**
 * Signed lateral displacement from the centerline, in meters.
 * Positive = outside (toward outer rail); negative = inside (toward inner rail).
 */
function lateralDisplacement(
    frame: TrackFrame,
    pos: Point,
    navigator: TrackNavigator,
): number {
    const seg = navigator.segment;
    if (seg.tracktype === 'CURVE') {
        const toHorseX = pos.x - seg.center.x;
        const toHorseY = pos.y - seg.center.y;
        const currentRadius = Math.sqrt(toHorseX * toHorseX + toHorseY * toHorseY);
        const target = Number.isFinite(frame.targetRadius)
            ? frame.targetRadius
            : seg.radius;
        return currentRadius - target;
    }
    const offX = pos.x - seg.startPoint.x;
    const offY = pos.y - seg.startPoint.y;
    return offX * frame.normal.x + offY * frame.normal.y;
}

/**
 * Advance a single horse by one physics substep. Mutates horse in place.
 *
 * Force model per horse: F_total = F_cruise + F_player - F_drag, using
 * per-horse effective attributes for cruise speed, force caps, and max speed.
 */
export function stepPhysicsSingle(
    h: Horse,
    attrs: CoreAttributes,
    input: InputState,
    playerHorseId: number | null,
    dt: number,
): void {
    if (h.finished) return;

    // 1. Forces — cruise toward per-horse cruise speed
    let F_t = computeCruiseForce(h.tangentialVel, attrs.cruiseSpeed);
    let F_n = 0;
    if (h.id === playerHorseId) {
        F_t += input.tangential * F_T_MAX * attrs.forwardAccel;
        F_n += input.normal * F_N_MAX * attrs.turnAccel;
    }

    // 2. Drag
    F_t -= C_DRAG * h.tangentialVel;
    F_n -= C_DRAG * h.normalVel;

    // 3. Integrate velocity
    h.tangentialVel += F_t * dt;
    h.normalVel += F_n * dt;

    // 4. Max speed cap
    if (h.tangentialVel > attrs.maxSpeed) {
        h.tangentialVel = attrs.maxSpeed;
    }

    // 5. Integrate position using the horse's current track frame
    const frame = h.navigator.getTrackFrame(h.pos);
    h.pos.x += (frame.tangential.x * h.tangentialVel + frame.normal.x * h.normalVel) * dt;
    h.pos.y += (frame.tangential.y * h.tangentialVel + frame.normal.y * h.normalVel) * dt;

    // 6. Segment advance + progress refresh
    h.navigator.updateSegment(h.pos);
    h.trackProgress = h.navigator.computeProgress(h.pos);

    // 7. Rail clamp (soft wall)
    const postFrame = h.navigator.getTrackFrame(h.pos);
    const disp = lateralDisplacement(postFrame, h.pos, h.navigator);
    if (Math.abs(disp) > TRACK_HALF_WIDTH) {
        h.normalVel = 0;
        const excess = disp - Math.sign(disp) * TRACK_HALF_WIDTH;
        h.pos.x -= postFrame.normal.x * excess;
        h.pos.y -= postFrame.normal.y * excess;
    }
}

/**
 * Run 8 physics substeps for all horses in one game tick.
 */
export function stepPhysics(
    horses: Horse[],
    input: InputState,
    playerHorseId: number | null,
    substeps: number,
    dt: number,
): void {
    for (let s = 0; s < substeps; s++) {
        for (const h of horses) {
            stepPhysicsSingle(h, h.effectiveAttributes, input, playerHorseId, dt);
        }
    }
}
```

- [ ] **Step 2: Update physics.test.ts**

Replace the full contents of `apps/horse-racing/test/physics.test.ts`:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';

import { parseTrackJson } from '../src/simulation/track-from-json';
import { Race } from '../src/simulation/race';
import type { InputState } from '../src/simulation/types';

function loadTrack(name: string) {
    const path = join(__dirname, '../public/tracks', name);
    return parseTrackJson(JSON.parse(readFileSync(path, 'utf-8')) as unknown);
}

const ZERO_INPUT: InputState = { tangential: 0, normal: 0 };
const MAX_TICKS = 10_000;

describe('Race physics integration', () => {
    it('all four horses finish in watch mode on test_oval.json', () => {
        const segments = loadTrack('test_oval.json');
        const race = new Race(segments);
        race.start(null);

        let safety = 0;
        while (race.state.phase !== 'finished' && safety < MAX_TICKS) {
            race.tick(ZERO_INPUT);
            safety++;
        }

        expect(race.state.phase).toBe('finished');
        expect(race.state.horses.every((h) => h.finished)).toBe(true);
        expect(race.state.finishOrder).toHaveLength(4);
    });

    it('identical horses finish within 15% tick variance', () => {
        const segments = loadTrack('test_oval.json');
        const race = new Race(segments);
        race.start(null);

        const finishTicks = new Map<number, number>();
        let safety = 0;
        while (race.state.phase !== 'finished' && safety < MAX_TICKS) {
            race.tick(ZERO_INPUT);
            safety++;
            for (const h of race.state.horses) {
                if (h.finished && !finishTicks.has(h.id)) {
                    finishTicks.set(h.id, race.state.tick);
                }
            }
        }

        expect(finishTicks.size).toBe(4);
        const ticks = [...finishTicks.values()];
        const minT = Math.min(...ticks);
        const maxT = Math.max(...ticks);
        expect((maxT - minT) / minT).toBeLessThan(0.15);
    });
});
```

Note: The test file content is nearly identical — the only change is that `Race` internally now runs substeps and uses per-horse attributes. The tests validate the same behavior (all horses finish, within tolerance) which confirms the refactor is correct.

- [ ] **Step 3: The tests won't pass yet — they depend on race.ts being updated (Task 5). Commit physics.ts only.**

```bash
git add apps/horse-racing/src/simulation/physics.ts apps/horse-racing/test/physics.test.ts
git commit -m "refactor(horse-racing): parameterize stepPhysics by CoreAttributes, add substep loop"
```

---

### Task 5: Update race.ts — Spawn with Attributes, Tick Pipeline

**Files:**
- Modify: `apps/horse-racing/src/simulation/race.ts`

- [ ] **Step 1: Update race.ts**

Replace the full contents of `apps/horse-racing/src/simulation/race.ts`:

```ts
import type { Point } from '@ue-too/math';
import { TrackNavigator } from './track-navigator';
import type { TrackSegment } from './track-types';

import { createDefaultAttributes } from './attributes';
import { applyExhaustion } from './exhaustion';
import { stepPhysics } from './physics';
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
 *   2. stepPhysics (8 substeps at 240Hz) using effective attrs
 *   3. drainStamina per horse (once per tick, after physics)
 */
export class Race {
    state: RaceState;
    private segments: TrackSegment[];

    constructor(segments: TrackSegment[]) {
        this.segments = segments;
        this.state = {
            phase: 'gate',
            horses: spawnHorses(segments),
            playerHorseId: null,
            tick: 0,
            finishOrder: [],
        };
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

        // 2. Physics substeps
        stepPhysics(
            this.state.horses,
            input,
            this.state.playerHorseId,
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
        this.state = {
            phase: 'gate',
            horses: spawnHorses(this.segments),
            playerHorseId: null,
            tick: 0,
            finishOrder: [],
        };
    }
}
```

Note: This depends on `applyExhaustion` and `drainStamina` which don't exist yet. They will be created in Tasks 6 and 7. The compile will fail until then.

- [ ] **Step 2: Commit**

```bash
git add apps/horse-racing/src/simulation/race.ts
git commit -m "refactor(horse-racing): wire exhaustion/drain pipeline into Race.tick"
```

---

### Task 6: Exhaustion Module

**Files:**
- Create: `apps/horse-racing/src/simulation/exhaustion.ts`
- Create: `apps/horse-racing/test/exhaustion.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/horse-racing/test/exhaustion.test.ts`:

```ts
import { applyExhaustion, EXHAUSTION_DECAY } from '../src/simulation/exhaustion';
import { createDefaultAttributes } from '../src/simulation/attributes';
import type { CoreAttributes } from '../src/simulation/attributes';
import type { Horse } from '../src/simulation/types';

function makeHorse(overrides: Partial<Horse> = {}): Horse {
    const attrs = createDefaultAttributes();
    return {
        id: 0,
        color: 0,
        pos: { x: 0, y: 0 },
        tangentialVel: 0,
        normalVel: 0,
        trackProgress: 0,
        navigator: null as any,
        finished: false,
        finishOrder: null,
        baseAttributes: attrs,
        currentStamina: attrs.maxStamina,
        effectiveAttributes: { ...attrs },
        ...overrides,
    };
}

describe('applyExhaustion', () => {
    it('returns base attributes when stamina > 0', () => {
        const horse = makeHorse({ currentStamina: 50 });
        const eff = applyExhaustion(horse);
        expect(eff.cruiseSpeed).toBe(horse.baseAttributes.cruiseSpeed);
        expect(eff.maxSpeed).toBe(horse.baseAttributes.maxSpeed);
        expect(eff.forwardAccel).toBe(horse.baseAttributes.forwardAccel);
        expect(eff.turnAccel).toBe(horse.baseAttributes.turnAccel);
    });

    it('returns base attributes when stamina = 1 (barely above zero)', () => {
        const horse = makeHorse({ currentStamina: 1 });
        const eff = applyExhaustion(horse);
        expect(eff.maxSpeed).toBe(horse.baseAttributes.maxSpeed);
    });

    it('begins decaying when stamina = 0', () => {
        const horse = makeHorse({ currentStamina: 0 });
        const eff = applyExhaustion(horse);
        // After one tick of decay, maxSpeed should be less than base
        expect(eff.maxSpeed).toBeLessThan(horse.baseAttributes.maxSpeed);
    });

    it('reaches floor values within 120 ticks (~2 seconds at 60fps)', () => {
        const horse = makeHorse({ currentStamina: 0 });
        const base = horse.baseAttributes;
        const floorMaxSpeed = base.cruiseSpeed * 0.55;
        const floorForwardAccel = base.forwardAccel * 0.15;
        const floorTurnAccel = base.turnAccel * 0.30;

        for (let i = 0; i < 120; i++) {
            const eff = applyExhaustion(horse);
            // applyExhaustion mutates horse.effectiveAttributes
            horse.effectiveAttributes = eff;
        }

        expect(horse.effectiveAttributes.maxSpeed).toBeCloseTo(floorMaxSpeed, 1);
        expect(horse.effectiveAttributes.forwardAccel).toBeCloseTo(floorForwardAccel, 1);
        expect(horse.effectiveAttributes.turnAccel).toBeCloseTo(floorTurnAccel, 1);
    });

    it('does not decay cruiseSpeed or other non-degraded traits', () => {
        const horse = makeHorse({ currentStamina: 0 });
        for (let i = 0; i < 120; i++) {
            horse.effectiveAttributes = applyExhaustion(horse);
        }
        expect(horse.effectiveAttributes.cruiseSpeed).toBe(horse.baseAttributes.cruiseSpeed);
        expect(horse.effectiveAttributes.maxStamina).toBe(horse.baseAttributes.maxStamina);
        expect(horse.effectiveAttributes.weight).toBe(horse.baseAttributes.weight);
    });

    it('resets to base if stamina goes back above 0 (edge case)', () => {
        const horse = makeHorse({ currentStamina: 0 });
        // Decay a few ticks
        for (let i = 0; i < 30; i++) {
            horse.effectiveAttributes = applyExhaustion(horse);
        }
        expect(horse.effectiveAttributes.maxSpeed).toBeLessThan(horse.baseAttributes.maxSpeed);

        // Stamina restored (shouldn't happen in drain-only, but test the guard)
        horse.currentStamina = 10;
        horse.effectiveAttributes = applyExhaustion(horse);
        expect(horse.effectiveAttributes.maxSpeed).toBe(horse.baseAttributes.maxSpeed);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx nx test horse-racing -- --testPathPattern=exhaustion`
Expected: FAIL — cannot find module `../src/simulation/exhaustion`

- [ ] **Step 3: Write the implementation**

Create `apps/horse-racing/src/simulation/exhaustion.ts`:

```ts
import type { CoreAttributes } from './attributes';
import type { Horse } from './types';

/**
 * Per-tick decay factor when stamina = 0.
 * At 60 ticks/sec: ~95% of the gap closes in 1 second,
 * effectively at floor by 2 seconds.
 */
export const EXHAUSTION_DECAY = 0.95;

/** Floor: maxSpeed drops to 55% of cruiseSpeed. */
const MAX_SPEED_FLOOR_RATIO = 0.55;
/** Floor: forwardAccel drops to 15% of base. */
const FORWARD_ACCEL_FLOOR_RATIO = 0.15;
/** Floor: turnAccel drops to 30% of base. */
const TURN_ACCEL_FLOOR_RATIO = 0.30;

/**
 * Resolve effective attributes based on stamina state.
 *
 * - Above 0% stamina: returns base attributes (no penalty).
 * - At 0% stamina: exponentially decays effective attributes toward
 *   floor values. Mutates `horse.effectiveAttributes` to track the
 *   decaying state across ticks.
 */
export function applyExhaustion(horse: Horse): CoreAttributes {
    const base = horse.baseAttributes;

    // Above 0: no penalty, snap to base
    if (horse.currentStamina > 0) {
        return { ...base };
    }

    // At 0: decay toward floor values
    const eff = horse.effectiveAttributes;
    const floorMaxSpeed = base.cruiseSpeed * MAX_SPEED_FLOOR_RATIO;
    const floorForwardAccel = base.forwardAccel * FORWARD_ACCEL_FLOOR_RATIO;
    const floorTurnAccel = base.turnAccel * TURN_ACCEL_FLOOR_RATIO;

    return {
        ...base,
        maxSpeed: floorMaxSpeed + (eff.maxSpeed - floorMaxSpeed) * EXHAUSTION_DECAY,
        forwardAccel: floorForwardAccel + (eff.forwardAccel - floorForwardAccel) * EXHAUSTION_DECAY,
        turnAccel: floorTurnAccel + (eff.turnAccel - floorTurnAccel) * EXHAUSTION_DECAY,
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx nx test horse-racing -- --testPathPattern=exhaustion`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/horse-racing/src/simulation/exhaustion.ts apps/horse-racing/test/exhaustion.test.ts
git commit -m "feat(horse-racing): add exhaustion module with binary collapse at 0% stamina"
```

---

### Task 7: Stamina Drain Module

**Files:**
- Create: `apps/horse-racing/src/simulation/stamina.ts`
- Create: `apps/horse-racing/test/stamina.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/horse-racing/test/stamina.test.ts`:

```ts
import {
    drainStamina,
    OVERDRIVE_DRAIN_RATE,
    STAMINA_DRAIN_RATE,
    SPEED_DRAIN_RATE,
    LATERAL_STEERING_DRAIN_RATE,
    LATERAL_VELOCITY_DRAIN_RATE,
} from '../src/simulation/stamina';
import { createDefaultAttributes } from '../src/simulation/attributes';
import type { Horse } from '../src/simulation/types';
import type { TrackFrame } from '../src/simulation/track-navigator';

function makeHorse(overrides: Partial<Horse> = {}): Horse {
    const attrs = createDefaultAttributes();
    return {
        id: 0,
        color: 0,
        pos: { x: 0, y: 0 },
        tangentialVel: 0,
        normalVel: 0,
        trackProgress: 0,
        navigator: null as any,
        finished: false,
        finishOrder: null,
        baseAttributes: attrs,
        currentStamina: attrs.maxStamina,
        effectiveAttributes: { ...attrs },
        ...overrides,
    };
}

const STRAIGHT_FRAME: TrackFrame = {
    tangential: { x: 1, y: 0 },
    normal: { x: 0, y: -1 },
    turnRadius: Infinity,
    nominalRadius: Infinity,
    targetRadius: Infinity,
    slope: 0,
};

const ZERO_INPUT = { tangential: 0 as const, normal: 0 as const };

describe('drainStamina', () => {
    it('drains nothing when horse is stationary with no input', () => {
        const horse = makeHorse({ tangentialVel: 0, normalVel: 0 });
        const before = horse.currentStamina;
        drainStamina(horse, horse.effectiveAttributes, ZERO_INPUT, STRAIGHT_FRAME);
        // Speed tax is speed * rate, and speed is 0, so no drain
        expect(horse.currentStamina).toBe(before);
    });

    it('applies speed tax proportional to tangentialVel', () => {
        const horse = makeHorse({ tangentialVel: 10, normalVel: 0 });
        const before = horse.currentStamina;
        drainStamina(horse, horse.effectiveAttributes, ZERO_INPUT, STRAIGHT_FRAME);
        const expectedDrain = 10 * SPEED_DRAIN_RATE * horse.effectiveAttributes.drainRateMult;
        expect(horse.currentStamina).toBeCloseTo(before - expectedDrain);
    });

    it('applies overdrive drain when speed > cruiseSpeed', () => {
        const attrs = createDefaultAttributes(); // cruiseSpeed = 13
        const horse = makeHorse({
            tangentialVel: 18,
            normalVel: 0,
            effectiveAttributes: attrs,
        });
        const before = horse.currentStamina;
        drainStamina(horse, attrs, ZERO_INPUT, STRAIGHT_FRAME);
        const overdrive = (18 - 13) * OVERDRIVE_DRAIN_RATE;
        const speedTax = 18 * SPEED_DRAIN_RATE;
        const expectedDrain = (overdrive + speedTax) * attrs.drainRateMult;
        expect(horse.currentStamina).toBeCloseTo(before - expectedDrain);
    });

    it('applies push drain when tangential input > 0', () => {
        const horse = makeHorse({ tangentialVel: 10 });
        const pushInput = { tangential: 1 as const, normal: 0 as const };
        const before = horse.currentStamina;
        drainStamina(horse, horse.effectiveAttributes, pushInput, STRAIGHT_FRAME);
        const pushDrain = 1 * STAMINA_DRAIN_RATE;
        const speedTax = 10 * SPEED_DRAIN_RATE;
        const expectedDrain = (pushDrain + speedTax) * horse.effectiveAttributes.drainRateMult;
        expect(horse.currentStamina).toBeCloseTo(before - expectedDrain);
    });

    it('applies lateral steering drain when normal input != 0', () => {
        const horse = makeHorse({ tangentialVel: 0, normalVel: 0 });
        const steerInput = { tangential: 0 as const, normal: 1 as const };
        const before = horse.currentStamina;
        drainStamina(horse, horse.effectiveAttributes, steerInput, STRAIGHT_FRAME);
        const steerDrain = 1 * LATERAL_STEERING_DRAIN_RATE;
        const expectedDrain = steerDrain * horse.effectiveAttributes.drainRateMult;
        expect(horse.currentStamina).toBeCloseTo(before - expectedDrain);
    });

    it('applies lateral velocity tax', () => {
        const horse = makeHorse({ tangentialVel: 0, normalVel: 5 });
        const before = horse.currentStamina;
        drainStamina(horse, horse.effectiveAttributes, ZERO_INPUT, STRAIGHT_FRAME);
        const latDrain = 5 * LATERAL_VELOCITY_DRAIN_RATE;
        const expectedDrain = latDrain * horse.effectiveAttributes.drainRateMult;
        expect(horse.currentStamina).toBeCloseTo(before - expectedDrain);
    });

    it('clamps stamina to 0 (never negative)', () => {
        const horse = makeHorse({ tangentialVel: 20, currentStamina: 0.001 });
        drainStamina(horse, horse.effectiveAttributes, ZERO_INPUT, STRAIGHT_FRAME);
        expect(horse.currentStamina).toBe(0);
    });

    it('drainRateMult scales all drain', () => {
        const attrsLow = createDefaultAttributes();
        attrsLow.drainRateMult = 0.7;
        const attrsHigh = createDefaultAttributes();
        attrsHigh.drainRateMult = 1.3;

        const horseLow = makeHorse({
            tangentialVel: 18,
            effectiveAttributes: attrsLow,
        });
        const horseHigh = makeHorse({
            tangentialVel: 18,
            effectiveAttributes: attrsHigh,
        });

        drainStamina(horseLow, attrsLow, ZERO_INPUT, STRAIGHT_FRAME);
        drainStamina(horseHigh, attrsHigh, ZERO_INPUT, STRAIGHT_FRAME);

        // Higher drain mult = more stamina lost = lower remaining stamina
        expect(horseHigh.currentStamina).toBeLessThan(horseLow.currentStamina);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx nx test horse-racing -- --testPathPattern=stamina`
Expected: FAIL — cannot find module `../src/simulation/stamina`

- [ ] **Step 3: Write the implementation**

Create `apps/horse-racing/src/simulation/stamina.ts`:

```ts
import type { CoreAttributes } from './attributes';
import type { Horse, InputState } from './types';
import type { TrackFrame } from './track-navigator';

// --- Drain rate constants (initial values, to be tuned via integration tests) ---

export const OVERDRIVE_DRAIN_RATE = 0.005;
export const STAMINA_DRAIN_RATE = 0.01;
export const LATERAL_STEERING_DRAIN_RATE = 0.006;
export const CORNERING_DRAIN_RATE = 0.002;
export const SPEED_DRAIN_RATE = 0.0014;
export const LATERAL_VELOCITY_DRAIN_RATE = 0.0008;
export const GRIP_FORCE_BASELINE = 150.0;

/**
 * Drain stamina based on the horse's current effort. Mutates `horse.currentStamina`.
 *
 * Called once per game tick (not per substep), after physics.
 */
export function drainStamina(
    horse: Horse,
    attrs: CoreAttributes,
    input: InputState,
    frame: TrackFrame,
): void {
    let drain = 0;

    // Overdrive: cost of running above cruise speed
    if (horse.tangentialVel > attrs.cruiseSpeed) {
        drain += (horse.tangentialVel - attrs.cruiseSpeed) * OVERDRIVE_DRAIN_RATE;
    }

    // Jockey push: cost of forward input
    if (input.tangential > 0) {
        drain += Math.abs(input.tangential) * STAMINA_DRAIN_RATE;
    }

    // Lateral steering: cost of steering input
    if (input.normal !== 0) {
        drain += Math.abs(input.normal) * LATERAL_STEERING_DRAIN_RATE;
    }

    // Cornering: cost of exceeding grip threshold on curves
    if (frame.turnRadius < 1e6 && horse.tangentialVel > 0) {
        const requiredForce = (horse.tangentialVel ** 2) / frame.turnRadius;
        const toleratedForce = attrs.corneringGrip * GRIP_FORCE_BASELINE;
        if (requiredForce > toleratedForce) {
            drain += (requiredForce - toleratedForce) * CORNERING_DRAIN_RATE;
        }
    }

    // Speed tax: baseline cost of moving
    drain += Math.abs(horse.tangentialVel) * SPEED_DRAIN_RATE;

    // Lateral velocity tax
    drain += Math.abs(horse.normalVel) * LATERAL_VELOCITY_DRAIN_RATE;

    // Apply per-horse efficiency
    drain *= attrs.drainRateMult;

    horse.currentStamina = Math.max(0, horse.currentStamina - drain);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx nx test horse-racing -- --testPathPattern=stamina`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/horse-racing/src/simulation/stamina.ts apps/horse-racing/test/stamina.test.ts
git commit -m "feat(horse-racing): add drain-only stamina module"
```

---

### Task 8: Update index.ts Exports and Run Full Test Suite

**Files:**
- Modify: `apps/horse-racing/src/simulation/index.ts`

- [ ] **Step 1: Update index.ts**

Replace the full contents of `apps/horse-racing/src/simulation/index.ts`:

```ts
export { V2Sim, attachV2Sim, type V2SimHandle, type PhaseChangeCallback } from './sim';
export type { Horse, InputState, RacePhase, RaceState } from './types';
export type { CoreAttributes } from './attributes';
export { createDefaultAttributes } from './attributes';
```

- [ ] **Step 2: Run the full test suite**

Run: `bunx nx test horse-racing`
Expected: ALL PASS — attributes (3), cruise (3), exhaustion (6), stamina (8), physics integration (2), input (5), placeholder (1) = 28 tests

- [ ] **Step 3: Commit**

```bash
git add apps/horse-racing/src/simulation/index.ts
git commit -m "refactor(horse-racing): re-export CoreAttributes from simulation index"
```

---

### Task 9: Integration Test — Floor-It vs Paced

**Files:**
- Create: `apps/horse-racing/test/pacing-strategy.test.ts`

- [ ] **Step 1: Write the integration test**

Create `apps/horse-racing/test/pacing-strategy.test.ts`:

```ts
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
 * Simulate a two-horse race: horse 0 is the "strategy" horse (controlled),
 * horse 1 runs on cruise (auto-pilot).
 *
 * We use player mode for horse 0 so it receives input, while horse 1
 * gets cruise-only drive.
 *
 * Returns { strategyFinishTick, cruiseFinishTick } or null if either DNF.
 */
function runTwoHorseRace(
    segments: TrackSegment[],
    strategyInput: InputState,
) {
    const race = new Race(segments);
    // Start with horse 0 as player
    race.start(0);

    let strategyTick: number | null = null;
    let cruiseTick: number | null = null;

    for (let t = 0; t < MAX_TICKS; t++) {
        race.tick(strategyInput);

        for (const h of race.state.horses) {
            if (h.finished) {
                if (h.id === 0 && strategyTick === null) strategyTick = race.state.tick;
                if (h.id === 1 && cruiseTick === null) cruiseTick = race.state.tick;
            }
        }

        if (strategyTick !== null && cruiseTick !== null) break;
    }

    return { strategyTick, cruiseTick };
}

describe('Pacing strategy validation', () => {
    it('floor-it horse loses to cruise horse on test_oval', () => {
        const segments = loadTrack('test_oval.json');
        const { strategyTick, cruiseTick } = runTwoHorseRace(segments, FLOOR_IT_INPUT);

        expect(strategyTick).not.toBeNull();
        expect(cruiseTick).not.toBeNull();
        // Floor-it (horse 0) should finish AFTER cruise (horse 1)
        expect(strategyTick!).toBeGreaterThan(cruiseTick!);
    });

    it('floor-it horse loses to cruise horse on curriculum_1_straight (sprint)', () => {
        const segments = loadTrack('curriculum_1_straight.json');
        const { strategyTick, cruiseTick } = runTwoHorseRace(segments, FLOOR_IT_INPUT);

        expect(strategyTick).not.toBeNull();
        expect(cruiseTick).not.toBeNull();
        // Floor-it (horse 0) should finish AFTER cruise (horse 1)
        expect(strategyTick!).toBeGreaterThan(cruiseTick!);
    });

    it('floor-it horse depletes stamina before finishing', () => {
        const segments = loadTrack('test_oval.json');
        const race = new Race(segments);
        race.start(0);

        let depletedAt: number | null = null;

        for (let t = 0; t < MAX_TICKS; t++) {
            race.tick(FLOOR_IT_INPUT);
            const horse0 = race.state.horses[0];

            if (horse0.currentStamina <= 0 && depletedAt === null) {
                depletedAt = race.state.tick;
            }

            if (horse0.finished) {
                // Stamina should have been depleted before finishing
                expect(depletedAt).not.toBeNull();
                // Depletion should happen at 60-70% of the race
                // (measured by progress at depletion tick)
                break;
            }
        }

        expect(depletedAt).not.toBeNull();
    });
});
```

- [ ] **Step 2: Run the test**

Run: `bunx nx test horse-racing -- --testPathPattern=pacing`
Expected: PASS (3 tests). If the floor-it horse still wins, the drain rates need tuning — adjust `OVERDRIVE_DRAIN_RATE` and `SPEED_DRAIN_RATE` in `stamina.ts` upward and re-run until the tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/horse-racing/test/pacing-strategy.test.ts
git commit -m "test(horse-racing): add pacing strategy integration tests — floor-it must lose"
```

---

### Task 10: Tune Drain Rates (if needed)

**Files:**
- Modify: `apps/horse-racing/src/simulation/stamina.ts` (drain rate constants only)

This task only applies if the integration tests from Task 9 fail (floor-it horse still wins).

- [ ] **Step 1: Run the pacing tests and check results**

Run: `bunx nx test horse-racing -- --testPathPattern=pacing`

If all pass, skip to Step 4 (commit a no-op "verified" message).

- [ ] **Step 2: If tests fail, increase drain rates**

In `apps/horse-racing/src/simulation/stamina.ts`, increase the two main levers:

```ts
// Increase these until floor-it loses on both sprint and oval:
export const OVERDRIVE_DRAIN_RATE = 0.015;  // was 0.005
export const SPEED_DRAIN_RATE = 0.004;      // was 0.0014
```

The goal: at max speed (20 m/s) with cruise 13, the overdrive portion is `7 * 0.015 = 0.105` per tick, plus speed tax `20 * 0.004 = 0.08`, totaling ~0.185 per tick. At 100 stamina, depletion in ~540 ticks (~9 seconds). Adjust until depletion occurs at 60-70% track progress.

- [ ] **Step 3: Re-run pacing tests**

Run: `bunx nx test horse-racing -- --testPathPattern=pacing`
Expected: PASS. If still failing, iterate on the drain rate values.

- [ ] **Step 4: Run the full test suite to confirm nothing regressed**

Run: `bunx nx test horse-racing`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/horse-racing/src/simulation/stamina.ts
git commit -m "tune(horse-racing): adjust stamina drain rates so floor-it strategy loses"
```
