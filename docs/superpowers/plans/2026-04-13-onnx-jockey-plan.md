# ONNX AI Jockey Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI inference layer that loads ONNX models and produces per-tick actions for non-player horses, with a model picker on the gate screen.

**Architecture:** A `src/ai/` layer sits between `V2Sim` and `Race`. It defines a `Jockey` interface with two implementations: `NullJockey` (no-op) and `OnnxJockey` (wraps `onnxruntime-web`). `V2Sim` calls `jockey.infer(race)` each tick, merges results with player input, and passes the combined map to `race.tick()`.

**Tech Stack:** TypeScript, onnxruntime-web (already installed), Vitest (via `bunx nx test horse-racing`), React

**Spec:** `docs/superpowers/specs/2026-04-13-onnx-jockey-design.md`

---

## File Structure

```
src/ai/
    types.ts        — Jockey interface definition
    null-jockey.ts  — NullJockey: returns empty map (no model loaded)
    onnx-jockey.ts  — OnnxJockey: wraps InferenceSession, batched inference
    index.ts        — re-exports
```

**Modified files:**
- `src/simulation/sim.ts` — add `jockey` field, `setJockey()` on handle, merge AI inputs in tick
- `src/simulation/index.ts` — re-export `Race` type (already exported)
- `src/utils/init-app.ts` — wire `setJockey` into `V2SimHandle`
- `src/components/race/HorsePicker.tsx` — add model picker dropdown
- `src/App.tsx` — no changes needed (HorsePicker already has sim handle)

**Cleanup:**
- Delete `public/models/*.onnx` (6 v1 files)

**Test files:**
- `test/null-jockey.test.ts`
- `test/onnx-jockey.test.ts`
- `test/sim-jockey-integration.test.ts`

---

### Task 1: Jockey interface and NullJockey

**Files:**
- Create: `apps/horse-racing/src/ai/types.ts`
- Create: `apps/horse-racing/src/ai/null-jockey.ts`
- Create: `apps/horse-racing/src/ai/index.ts`
- Create: `apps/horse-racing/test/null-jockey.test.ts`

- [ ] **Step 1: Write the failing test for NullJockey**

Create `apps/horse-racing/test/null-jockey.test.ts`:

```typescript
import { NullJockey } from '../src/ai';

describe('NullJockey', () => {
    it('infer returns an empty map', () => {
        const jockey = new NullJockey();
        // NullJockey.infer ignores its argument entirely
        const result = jockey.infer(null as any);
        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(0);
    });

    it('dispose is a no-op', () => {
        const jockey = new NullJockey();
        expect(() => jockey.dispose()).not.toThrow();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx nx test horse-racing -- --testPathPattern null-jockey`
Expected: FAIL — cannot find module `../src/ai`

- [ ] **Step 3: Create the Jockey interface**

Create `apps/horse-racing/src/ai/types.ts`:

```typescript
import type { Race } from '../simulation/race';
import type { InputState } from '../simulation/types';

/**
 * Common interface for AI jockey strategies.
 * Each implementation produces per-horse actions from the current race state.
 */
export interface Jockey {
    /**
     * Produce actions for AI-controlled horses.
     * @returns Map from horse id to input action. Horses not in the map receive {0, 0}.
     */
    infer(race: Race): Map<number, InputState>;

    /** Release any resources (e.g. ONNX session). */
    dispose(): void;
}
```

- [ ] **Step 4: Create NullJockey**

Create `apps/horse-racing/src/ai/null-jockey.ts`:

```typescript
import type { Race } from '../simulation/race';
import type { InputState } from '../simulation/types';
import type { Jockey } from './types';

/**
 * No-op jockey — returns an empty action map.
 * Used when no AI model is loaded; horses receive {0, 0} input.
 */
export class NullJockey implements Jockey {
    infer(_race: Race): Map<number, InputState> {
        return new Map();
    }

    dispose(): void {
        // nothing to release
    }
}
```

- [ ] **Step 5: Create index barrel**

Create `apps/horse-racing/src/ai/index.ts`:

```typescript
export type { Jockey } from './types';
export { NullJockey } from './null-jockey';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bunx nx test horse-racing -- --testPathPattern null-jockey`
Expected: PASS — 2 tests

- [ ] **Step 7: Commit**

```bash
git add apps/horse-racing/src/ai/types.ts apps/horse-racing/src/ai/null-jockey.ts apps/horse-racing/src/ai/index.ts apps/horse-racing/test/null-jockey.test.ts
git commit -m "feat(horse-racing): add Jockey interface and NullJockey implementation"
```

---

### Task 2: OnnxJockey implementation

**Files:**
- Create: `apps/horse-racing/src/ai/onnx-jockey.ts`
- Modify: `apps/horse-racing/src/ai/index.ts`
- Create: `apps/horse-racing/test/onnx-jockey.test.ts`

- [ ] **Step 1: Write the failing tests for OnnxJockey**

Create `apps/horse-racing/test/onnx-jockey.test.ts`:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

import { OnnxJockey } from '../src/ai/onnx-jockey';
import { OBS_SIZE } from '../src/simulation/observation';
import { Race } from '../src/simulation/race';
import { parseTrackJson } from '../src/simulation/track-from-json';

function loadOvalTrack() {
    const path = join(__dirname, '../public/tracks/test_oval.json');
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parseTrackJson(raw);
}

/** Minimal mock that mimics onnxruntime-web InferenceSession. */
function createMockSession(outputAction: number[]) {
    return {
        inputNames: ['obs'],
        outputNames: ['actions'],
        run: jest.fn(async (feeds: Record<string, unknown>) => {
            const input = feeds['obs'] as { dims: number[] };
            const batchSize = input.dims[0];
            const data = new Float32Array(batchSize * 2);
            for (let i = 0; i < batchSize; i++) {
                data[i * 2] = outputAction[0];
                data[i * 2 + 1] = outputAction[1];
            }
            return {
                actions: { dims: [batchSize, 2], data },
            };
        }),
        release: jest.fn(),
    };
}

describe('OnnxJockey', () => {
    it('produces actions for all horses when no player is set', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(null); // no player — all horses are AI

        const session = createMockSession([0.5, -0.3]);
        const jockey = OnnxJockey.fromSession(session as any);

        const actions = jockey.infer(race);

        expect(actions.size).toBe(4);
        for (let i = 0; i < 4; i++) {
            const a = actions.get(i)!;
            expect(a.tangential).toBeCloseTo(0.5);
            expect(a.normal).toBeCloseTo(-0.3);
        }
    });

    it('excludes the player horse from inference', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(2); // horse 2 is player

        const session = createMockSession([0.8, 0.1]);
        const jockey = OnnxJockey.fromSession(session as any);

        const actions = jockey.infer(race);

        expect(actions.size).toBe(3);
        expect(actions.has(2)).toBe(false);
        expect(actions.get(0)!.tangential).toBeCloseTo(0.8);
    });

    it('returns empty map when session.run throws', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(null);

        const session = createMockSession([0, 0]);
        session.run.mockRejectedValue(new Error('WASM OOM'));
        const jockey = OnnxJockey.fromSession(session as any);

        const actions = jockey.infer(race);

        expect(actions.size).toBe(0);
    });

    it('builds input tensor with correct shape', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 6);
        race.start(0); // horse 0 is player, 5 AI horses

        const session = createMockSession([0, 0]);
        const jockey = OnnxJockey.fromSession(session as any);

        jockey.infer(race);

        expect(session.run).toHaveBeenCalledTimes(1);
        const feeds = session.run.mock.calls[0][0] as Record<string, any>;
        const tensor = feeds['obs'];
        expect(tensor.dims).toEqual([5, OBS_SIZE]);
        expect(tensor.data).toBeInstanceOf(Float32Array);
        expect(tensor.data.length).toBe(5 * OBS_SIZE);
    });

    it('dispose releases the session', () => {
        const session = createMockSession([0, 0]);
        const jockey = OnnxJockey.fromSession(session as any);

        jockey.dispose();

        expect(session.release).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx nx test horse-racing -- --testPathPattern onnx-jockey`
Expected: FAIL — cannot find module `../src/ai/onnx-jockey`

- [ ] **Step 3: Implement OnnxJockey**

Create `apps/horse-racing/src/ai/onnx-jockey.ts`:

```typescript
import type { InferenceSession, Tensor } from 'onnxruntime-web';

import { buildObservations, OBS_SIZE } from '../simulation/observation';
import type { Race } from '../simulation/race';
import type { InputState } from '../simulation/types';
import type { Jockey } from './types';

/**
 * AI jockey that runs a trained ONNX model to produce actions.
 *
 * Input tensor:  [batchSize, OBS_SIZE]  (Float32)
 * Output tensor: [batchSize, 2]         (tangential, normal per horse)
 *
 * The player horse (if any) is excluded from the batch.
 */
export class OnnxJockey implements Jockey {
    private session: InferenceSession;
    private pendingResult: Map<number, InputState> = new Map();
    private inferring = false;

    private constructor(session: InferenceSession) {
        this.session = session;
    }

    /**
     * Load an ONNX model from a URL and create an OnnxJockey.
     */
    static async create(modelUrl: string): Promise<OnnxJockey> {
        const ort = await import('onnxruntime-web');
        const session = await ort.InferenceSession.create(modelUrl);
        return new OnnxJockey(session);
    }

    /**
     * Create from a pre-existing session (useful for testing with mocks).
     */
    static fromSession(session: InferenceSession): OnnxJockey {
        return new OnnxJockey(session);
    }

    infer(race: Race): Map<number, InputState> {
        const horses = race.state.horses;
        const playerId = race.state.playerHorseId;

        // Collect AI horse indices (exclude player)
        const aiIndices: number[] = [];
        for (const h of horses) {
            if (h.id !== playerId && !h.finished) {
                aiIndices.push(h.id);
            }
        }

        if (aiIndices.length === 0) {
            return new Map();
        }

        // If a previous async inference is still running, return last result
        if (this.inferring) {
            return new Map(this.pendingResult);
        }

        // Build observations for all horses, then pick AI ones
        const allObs = buildObservations(race);
        const batchSize = aiIndices.length;
        const inputData = new Float32Array(batchSize * OBS_SIZE);

        for (let b = 0; b < batchSize; b++) {
            const obs = allObs[aiIndices[b]];
            for (let j = 0; j < OBS_SIZE; j++) {
                inputData[b * OBS_SIZE + j] = obs[j];
            }
        }

        const inputName = this.session.inputNames[0];
        const outputName = this.session.outputNames[0];

        // Fire async inference — use last result until it completes
        this.inferring = true;
        const feeds: Record<string, Tensor> = {
            [inputName]: {
                dims: [batchSize, OBS_SIZE],
                type: 'float32',
                data: inputData,
                size: inputData.length,
            } as unknown as Tensor,
        };

        this.session
            .run(feeds)
            .then((results) => {
                const output = results[outputName];
                const outData = output.data as Float32Array;
                const actions = new Map<number, InputState>();

                for (let b = 0; b < batchSize; b++) {
                    actions.set(aiIndices[b], {
                        tangential: outData[b * 2],
                        normal: outData[b * 2 + 1],
                    });
                }

                this.pendingResult = actions;
            })
            .catch((err) => {
                console.error('OnnxJockey inference failed:', err);
                this.pendingResult = new Map();
            })
            .finally(() => {
                this.inferring = false;
            });

        // Return previous result while async inference runs
        return new Map(this.pendingResult);
    }

    dispose(): void {
        this.session.release();
    }
}
```

- [ ] **Step 4: Update the barrel export**

Modify `apps/horse-racing/src/ai/index.ts`:

```typescript
export type { Jockey } from './types';
export { NullJockey } from './null-jockey';
export { OnnxJockey } from './onnx-jockey';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bunx nx test horse-racing -- --testPathPattern onnx-jockey`
Expected: PASS — 5 tests

Note: The "returns empty map when session.run throws" test may need adjustment since inference is async. The mock rejects immediately, so `inferring` will flip back to false and `pendingResult` will be an empty map. The synchronous return from `infer()` will also be an empty map (initial state). This is correct behavior.

- [ ] **Step 6: Commit**

```bash
git add apps/horse-racing/src/ai/onnx-jockey.ts apps/horse-racing/src/ai/index.ts apps/horse-racing/test/onnx-jockey.test.ts
git commit -m "feat(horse-racing): add OnnxJockey with batched inference"
```

---

### Task 3: Wire Jockey into V2Sim

**Files:**
- Modify: `apps/horse-racing/src/simulation/sim.ts:1-143`
- Modify: `apps/horse-racing/src/simulation/index.ts`
- Create: `apps/horse-racing/test/sim-jockey-integration.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `apps/horse-racing/test/sim-jockey-integration.test.ts`:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

import type { Jockey } from '../src/ai';
import { Race } from '../src/simulation/race';
import { parseTrackJson } from '../src/simulation/track-from-json';
import type { InputState } from '../src/simulation/types';

function loadOvalTrack() {
    const path = join(__dirname, '../public/tracks/test_oval.json');
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return parseTrackJson(raw);
}

/** A jockey that always returns a fixed action for every non-player horse. */
class StubJockey implements Jockey {
    constructor(private action: InputState) {}
    lastRace: Race | null = null;

    infer(race: Race): Map<number, InputState> {
        this.lastRace = race;
        const map = new Map<number, InputState>();
        const playerId = race.state.playerHorseId;
        for (const h of race.state.horses) {
            if (h.id !== playerId) {
                map.set(h.id, { ...this.action });
            }
        }
        return map;
    }

    dispose(): void {}
}

describe('V2Sim jockey integration', () => {
    it('Race.tick receives merged AI + player inputs', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(0); // horse 0 is player

        const stubJockey = new StubJockey({ tangential: 1, normal: 0 });
        const playerInput: InputState = { tangential: -1, normal: 0.5 };

        // Simulate what V2Sim.tick does: get AI inputs, merge player, call race.tick
        const aiInputs = stubJockey.infer(race);
        aiInputs.set(0, playerInput); // player overrides

        race.tick(aiInputs);

        // After one tick, horse 0 should have different velocity direction than AI horses
        // because it got tangential: -1 while AI horses got tangential: 1
        const playerHorse = race.state.horses[0];
        const aiHorse = race.state.horses[1];

        // AI horse should be moving forward (positive tangential vel)
        expect(aiHorse.tangentialVel).toBeGreaterThan(0);
        // Player horse got brake input — should be at 0 or negative
        expect(playerHorse.tangentialVel).toBeLessThanOrEqual(0);
    });

    it('with NullJockey, AI horses receive zero input', () => {
        const segments = loadOvalTrack();
        const race = new Race(segments, 4);
        race.start(null); // no player — watch mode

        // NullJockey returns empty map → all horses get {0, 0}
        const emptyInputs = new Map<number, InputState>();
        race.tick(emptyInputs);

        // All horses should stay at zero velocity (no input)
        for (const h of race.state.horses) {
            expect(h.tangentialVel).toBeCloseTo(0, 1);
        }
    });
});
```

- [ ] **Step 2: Run test to verify it passes (these test the merge logic conceptually)**

Run: `bunx nx test horse-racing -- --testPathPattern sim-jockey-integration`
Expected: PASS — these tests exercise Race directly with the merge pattern. They don't import V2Sim (which needs Pixi).

- [ ] **Step 3: Add jockey field and setJockey to V2Sim**

Modify `apps/horse-racing/src/simulation/sim.ts`. Add import at top:

```typescript
import { NullJockey, type Jockey } from '../ai';
```

Add field to `V2Sim` class (after `private disposed = false;`):

```typescript
    private jockey: Jockey = new NullJockey();
```

Add method to `V2Sim` class (after `cleanup()` method):

```typescript
    setJockey(jockey: Jockey): void {
        this.jockey.dispose();
        this.jockey = jockey;
    }
```

Replace the `tick()` method body with:

```typescript
    private tick(): void {
        if (this.disposed) return;
        const prevPhase = this.race.state.phase;

        const inputs = this.jockey.infer(this.race);
        const pid = this.race.state.playerHorseId;
        if (pid !== null) {
            inputs.set(pid, this.input.state);
        }
        this.race.tick(inputs);

        this.renderer.syncHorses(
            this.race.state.horses,
            this.race.state.playerHorseId
        );

        if (this.race.state.phase !== prevPhase) {
            this.emitPhase();
        }

        // Camera follow in player mode
        if (pid !== null && this.race.state.phase === 'running') {
            const h = this.race.state.horses[pid];
            this.components.camera.setPosition({ x: h.pos.x, y: h.pos.y });
        }
    }
```

Add `setJockey` to `V2SimHandle` interface:

```typescript
export interface V2SimHandle {
    pickHorse(id: number | null): void;
    start(): void;
    reset(): void;
    getPhase(): RacePhase;
    getHorses(): Horse[];
    onPhaseChange(cb: PhaseChangeCallback): () => void;
    setJockey(jockey: Jockey): void;
    cleanup(): void;
}
```

- [ ] **Step 4: Wire setJockey into init-app.ts handle**

Modify `apps/horse-racing/src/utils/init-app.ts`. Add import:

```typescript
import type { Jockey } from '@/ai';
```

Add to the handle object inside `makeInitApp` (after `onPhaseChange`):

```typescript
            setJockey: (jockey: Jockey) => sim.setJockey(jockey),
```

- [ ] **Step 5: Re-export Jockey type from ai/index.ts in simulation/index.ts**

No change needed — `src/ai/index.ts` already exports `Jockey`. Consumers import from `@/ai` directly.

- [ ] **Step 6: Run all tests to verify nothing broke**

Run: `bunx nx test horse-racing`
Expected: All tests pass (existing + new integration tests).

- [ ] **Step 7: Commit**

```bash
git add apps/horse-racing/src/simulation/sim.ts apps/horse-racing/src/utils/init-app.ts apps/horse-racing/test/sim-jockey-integration.test.ts
git commit -m "feat(horse-racing): wire Jockey into V2Sim tick loop"
```

---

### Task 4: Model picker UI on the gate screen

**Files:**
- Modify: `apps/horse-racing/src/components/race/HorsePicker.tsx:1-71`
- Modify: `apps/horse-racing/src/App.tsx:1-64`

- [ ] **Step 1: Add model picker to HorsePicker component**

Modify `apps/horse-racing/src/components/race/HorsePicker.tsx`. Replace the entire file:

```typescript
import { useEffect, useState, type ReactNode } from 'react';

import { OnnxJockey, NullJockey } from '@/ai';
import type { V2SimHandle } from '@/simulation';

interface ModelEntry {
    label: string;
    url: string;
}

interface Props {
    sim: V2SimHandle;
    horses: { id: number; color: number }[];
}

function hex(n: number): string {
    return `#${n.toString(16).padStart(6, '0')}`;
}

export function HorsePicker({ sim, horses }: Props): ReactNode {
    const [selected, setSelected] = useState<number | null>(null);
    const [models, setModels] = useState<ModelEntry[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch('/models/manifest.json')
            .then((res) => res.json())
            .then((data: ModelEntry[]) => setModels(data))
            .catch(() => setModels([]));
    }, []);

    const pick = (id: number | null) => {
        setSelected(id);
        sim.pickHorse(id);
    };

    const onModelChange = async (url: string) => {
        setSelectedModel(url);
        if (!url) {
            sim.setJockey(new NullJockey());
            return;
        }
        setLoading(true);
        try {
            const jockey = await OnnxJockey.create(url);
            sim.setJockey(jockey);
        } catch (err) {
            console.error('Failed to load model:', err);
            sim.setJockey(new NullJockey());
            setSelectedModel('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: 'rgba(20,20,20,0.85)',
                borderRadius: 12,
                zIndex: 10,
                pointerEvents: 'auto',
            }}
        >
            {/* Model picker */}
            {models.length > 0 && (
                <select
                    value={selectedModel}
                    onChange={(e) => onModelChange(e.target.value)}
                    disabled={loading}
                    style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid #555',
                        background: '#222',
                        color: 'white',
                        fontSize: 13,
                        cursor: 'pointer',
                    }}
                >
                    <option value="">No AI Model</option>
                    {models.map((m) => (
                        <option key={m.url} value={m.url}>
                            {m.label}
                        </option>
                    ))}
                </select>
            )}

            {/* Horse picker */}
            <div style={{ display: 'flex', gap: 12 }}>
                {horses.map((h) => (
                    <button
                        key={h.id}
                        onClick={() => pick(h.id)}
                        aria-label={`Pick horse ${h.id + 1}`}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            border:
                                selected === h.id
                                    ? '3px solid white'
                                    : '2px solid #555',
                            background: hex(h.color),
                            cursor: 'pointer',
                        }}
                    />
                ))}
                <button
                    onClick={() => pick(null)}
                    style={{
                        padding: '0 14px',
                        borderRadius: 22,
                        border:
                            selected === null
                                ? '3px solid white'
                                : '2px solid #555',
                        background: '#333',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: 14,
                    }}
                >
                    Watch
                </button>
            </div>
        </div>
    );
}
```

Note: The `horses` prop replaces the hardcoded `HORSE_COLORS` array. This lets the picker reflect the actual horses in the race (variable count from Phase 3).

- [ ] **Step 2: Update App.tsx to pass horses prop**

Modify `apps/horse-racing/src/App.tsx`. The `HorsePicker` now needs a `horses` prop. Change the line:

```typescript
{phase === 'gate' && simHandle && <HorsePicker sim={simHandle} />}
```

to:

```typescript
{phase === 'gate' && simHandle && (
    <HorsePicker
        sim={simHandle}
        horses={simHandle.getHorses().map((h) => ({
            id: h.id,
            color: h.color,
        }))}
    />
)}
```

- [ ] **Step 3: Run the dev server and test manually**

Run: `bun run dev:horse-racing`

Verify:
1. Gate screen shows horse picker buttons matching the number of spawned horses (not hardcoded 4)
2. If `public/models/` has no `.onnx` files, the model dropdown does not appear
3. If `.onnx` files exist, dropdown shows "No AI Model" + model labels from manifest
4. Selecting a model shows loading state, selecting "No AI Model" switches back to NullJockey
5. Starting a race in watch mode (no player) with no model — all horses sit still
6. Starting a race with a player selected — player horse responds to arrow keys

- [ ] **Step 4: Commit**

```bash
git add apps/horse-racing/src/components/race/HorsePicker.tsx apps/horse-racing/src/App.tsx
git commit -m "feat(horse-racing): add model picker to gate screen, dynamic horse buttons"
```

---

### Task 5: Delete v1 ONNX models

**Files:**
- Delete: `apps/horse-racing/public/models/v35_phase2.onnx`
- Delete: `apps/horse-racing/public/models/v38_phase1_s2.onnx`
- Delete: `apps/horse-racing/public/models/v42_phase1_s1.onnx`
- Delete: `apps/horse-racing/public/models/v43_phase1.onnx`
- Delete: `apps/horse-racing/public/models/v45_p2s1.onnx`
- Delete: `apps/horse-racing/public/models/v46_p2s3.onnx`

- [ ] **Step 1: Delete all v1 .onnx files**

```bash
git rm apps/horse-racing/public/models/v35_phase2.onnx apps/horse-racing/public/models/v38_phase1_s2.onnx apps/horse-racing/public/models/v42_phase1_s1.onnx apps/horse-racing/public/models/v43_phase1.onnx apps/horse-racing/public/models/v45_p2s1.onnx apps/horse-racing/public/models/v46_p2s3.onnx
```

- [ ] **Step 2: Regenerate manifest (should be empty array)**

The Vite plugin regenerates `manifest.json` on startup, but we can also do it manually to keep the committed file clean:

```bash
echo '[]' > apps/horse-racing/public/models/manifest.json
```

- [ ] **Step 3: Run all tests to make sure nothing depends on v1 models**

Run: `bunx nx test horse-racing`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/horse-racing/public/models/
git commit -m "chore(horse-racing): remove v1 ONNX models incompatible with v2 physics"
```

---

### Task 6: Final integration test — full test suite

**Files:** None new — verification only.

- [ ] **Step 1: Run full test suite**

Run: `bunx nx test horse-racing`
Expected: All tests pass (existing 87 + new null-jockey + onnx-jockey + sim-jockey-integration).

- [ ] **Step 2: Run dev server for manual smoke test**

Run: `bun run dev:horse-racing`

Verify:
1. Gate screen: horse buttons match spawned horses, model dropdown absent (no models)
2. Watch mode race: all horses idle (NullJockey, no model)
3. Player mode race: selected horse responds to keyboard, others idle
4. No console errors related to ONNX or AI

- [ ] **Step 3: Run format check**

Run: `bun run format:check`

If formatting issues, fix with `bun run format` and commit.
