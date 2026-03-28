/**
 * AI Jockey — runs a trained ONNX policy model in the browser to control horses.
 *
 * The model takes an 18-dimensional observation and outputs a 2D action
 * [extraTangential, extraNormal].
 */

import * as ort from 'onnxruntime-web';

import type { HorseAction } from './horse-racing-engine';
import type { HorseObservation } from './horse-racing-engine';

// Load WASM backend from CDN to avoid Vite's public/ import restrictions
const ORT_VERSION = '1.24.3';
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
// Disable multi-threading to avoid SharedArrayBuffer issues in dev
ort.env.wasm.numThreads = 1;

export class AIJockey {
    private session: ort.InferenceSession | null = null;
    private ready = false;

    /**
     * Load an ONNX model from a URL.
     * @param modelUrl - URL to the .onnx file (e.g., '/models/horse_jockey.onnx')
     */
    async load(modelUrl: string): Promise<void> {
        this.session = await ort.InferenceSession.create(modelUrl, {
            executionProviders: ['wasm'],
        });
        this.ready = true;
    }

    get isReady(): boolean {
        return this.ready;
    }

    /**
     * Compute an action from a horse observation.
     * @returns [extraTangential, extraNormal] action
     */
    async computeAction(obs: HorseObservation): Promise<HorseAction> {
        if (!this.session) {
            return { extraTangential: 0, extraNormal: 0 };
        }

        const obsArray = observationToArray(obs);
        const tensor = new ort.Tensor('float32', obsArray, [1, 18]);
        const results = await this.session.run({ obs: tensor });
        const actionData = results.action.data as Float32Array;

        return {
            extraTangential: clamp(actionData[0], -10, 10),
            extraNormal: clamp(actionData[1], -5, 5),
        };
    }

    /**
     * Compute actions for multiple horses (batched for efficiency).
     */
    async computeActions(observations: HorseObservation[]): Promise<HorseAction[]> {
        if (!this.session || observations.length === 0) {
            return observations.map(() => ({ extraTangential: 0, extraNormal: 0 }));
        }

        // Batch all observations into one tensor
        const batchSize = observations.length;
        const obsFlat = new Float32Array(batchSize * 18);
        for (let i = 0; i < batchSize; i++) {
            const arr = observationToArray(observations[i]);
            obsFlat.set(arr, i * 18);
        }

        const tensor = new ort.Tensor('float32', obsFlat, [batchSize, 18]);
        const results = await this.session.run({ obs: tensor });
        const actionData = results.action.data as Float32Array;

        const actions: HorseAction[] = [];
        for (let i = 0; i < batchSize; i++) {
            actions.push({
                extraTangential: clamp(actionData[i * 2], -10, 10),
                extraNormal: clamp(actionData[i * 2 + 1], -5, 5),
            });
        }
        return actions;
    }
}

/**
 * Convert a HorseObservation to the 18-element float array matching
 * the Python engine's obs_to_array format.
 */
function observationToArray(obs: HorseObservation): Float32Array {
    const corneringMargin = obs.corneringMargin === Infinity
        ? 1000.0
        : Math.min(obs.corneringMargin, 1000.0);

    return new Float32Array([
        obs.tangentialVel,                       // [0]
        obs.normalVel,                           // [1]
        obs.displacement,                        // [2]
        0,                                       // [3] track_progress — not in HorseObservation, use 0
        obs.turnRadius < 1e6 ? 1 / obs.turnRadius : 0, // [4] curvature
        obs.currentStamina / obs.maxStamina,     // [5] stamina_ratio
        obs.effectiveCruiseSpeed,                // [6]
        obs.effectiveMaxSpeed,                   // [7]
        0, 0,                                    // [8-9] rel_horse_1 (TODO: compute from positions)
        0, 0,                                    // [10-11] rel_horse_2
        0, 0,                                    // [12-13] rel_horse_3
        corneringMargin,                         // [14]
        obs.slope,                               // [15]
        0.5,                                     // [16] pushing_power (default)
        0.5,                                     // [17] push_resistance (default)
    ]);
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}
