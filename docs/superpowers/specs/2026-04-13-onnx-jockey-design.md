# Phase 4: ONNX AI Jockey Inference — Design Spec

## Goal

Add an AI layer that loads trained ONNX models and runs inference each tick to produce actions for non-player horses. The simulation remains ONNX-unaware; the AI layer sits between `V2Sim` and `Race`.

## Context

- Training happens in a mirrored Python environment. The TS HTTP server (Phase 3) validates physics parity only — it is not used for training.
- The pipeline is: train in Python → export `.onnx` → drop into `public/models/` → load in browser for inference.
- Phase 3 provides `buildObservations(race)` which produces a 139-float observation vector per horse.
- Six v1 `.onnx` models exist but are incompatible with v2 physics. They will be deleted; the Vite manifest plugin stays.

## Architecture

### AI layer (`src/ai/`)

A new directory at `apps/horse-racing/src/ai/` defines a common `Jockey` interface:

```typescript
interface Jockey {
    infer(race: Race): Map<number, InputState>;
    dispose(): void;
}
```

Any AI strategy (ONNX, behavior trees, scripted) implements this interface. Two implementations ship in Phase 4:

- **`NullJockey`** — returns an empty map. Used when no model is loaded.
- **`OnnxJockey`** — wraps an `onnxruntime-web` `InferenceSession`.

### OnnxJockey

**Construction:** async factory method loads the session.

```typescript
static async create(modelUrl: string): Promise<OnnxJockey>
```

**`infer(race)`:**

1. Call `buildObservations(race)` → `Float64Array[]` (one per horse).
2. Filter out the player horse (`race.state.playerHorseId`), collecting only AI horse indices.
3. Batch AI observations into a single input tensor of shape `[batchSize, 139]`.
4. Run `session.run()` once (batched, not per-horse).
5. Output tensor shape: `[batchSize, 2]` (tangential, normal per horse).
6. Slice output back into per-horse `{ tangential, normal }` actions.
7. Return `Map<number, InputState>` keyed by horse id.

If inference fails (shape mismatch, runtime error), log the error and return an empty map — AI horses idle rather than crash.

**`dispose()`:** releases the `InferenceSession`.

### Integration with V2Sim

`V2Sim` gets:

- A `jockey: Jockey` field, defaulting to `NullJockey`.
- A `setJockey(jockey: Jockey)` method exposed on `V2SimHandle`.

Tick loop becomes:

```typescript
const aiInputs = this.jockey.infer(this.race);
if (pid !== null) {
    aiInputs.set(pid, this.input.state); // player overrides AI
}
this.race.tick(aiInputs);
```

Jockey persists across `reset()` — model stays loaded until explicitly changed.

### Gate screen UI

The gate screen shows a model picker (dropdown) populated from `manifest.json`. Options:

- "None" (default) — uses `NullJockey`, AI horses idle.
- Each `.onnx` model listed by label from the manifest.

When the user selects a model, React calls `OnnxJockey.create(url)` then `sim.setJockey(jockey)`. Selecting "None" sets `NullJockey`.

### No model loaded behavior

AI horses receive input `{ tangential: 0, normal: 0 }` — they sit still. No scripted fallback.

## File Structure

```
src/ai/
    types.ts        — Jockey interface
    null-jockey.ts  — NullJockey implementation
    onnx-jockey.ts  — OnnxJockey implementation
    index.ts        — re-exports
```

## Cleanup

- Delete all 6 v1 `.onnx` files from `public/models/`.
- `manifest.json` regenerates as `[]` via the Vite plugin.

## Testing

- **OnnxJockey:** Mock `InferenceSession` to verify: tensor shape construction from observations, player horse exclusion from batch, output slicing back to `Map<number, InputState>`, graceful error handling (returns empty map).
- **NullJockey:** Returns empty map (trivial).
- **V2Sim integration:** Verify AI inputs and player inputs merge correctly — player overrides AI for player horse, AI fills all others.

## Inference frequency

Once per tick (30Hz), same as `Race.tick`. No throttling.

## Future extensibility

The `Jockey` interface accommodates future AI strategies (behavior trees, scripted jockeys) without changes to `Race` or the simulation layer.
