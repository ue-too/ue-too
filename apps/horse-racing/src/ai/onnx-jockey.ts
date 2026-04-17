import type { InferenceSession } from 'onnxruntime-web';

import { OBS_SIZE, buildObservations } from '../simulation/observation';
import type { Race } from '../simulation/race';
import type { InputState } from '../simulation/types';
import type { Jockey } from './types';

type OrtModule = typeof import('onnxruntime-web');

/**
 * Global inference mutex — onnxruntime-web cannot run multiple sessions
 * concurrently. All OnnxJockey instances share this lock.
 */
let globalInferenceLock: Promise<void> = Promise.resolve();

function acquireInferenceLock(): { ready: Promise<void>; release: () => void } {
    let release!: () => void;
    const next = new Promise<void>(resolve => { release = resolve; });
    const ready = globalInferenceLock;
    globalInferenceLock = globalInferenceLock.then(() => next);
    return { ready, release };
}

/** Discrete 6×9 action space — asymmetric braking (light brake only). */
export const TANGENTIAL_LEVELS = [
    -0.25, 0, 0.25, 0.5, 0.75, 1,
] as const;
export const NORMAL_LEVELS = [
    -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1,
] as const;
export const NUM_TANGENTIAL = TANGENTIAL_LEVELS.length;
export const NUM_NORMAL = NORMAL_LEVELS.length;
export const NUM_ACTIONS = NUM_TANGENTIAL * NUM_NORMAL;

/**
 * Decode a flat action index into a (tangential, normal) pair.
 * Layout: index = tangentialLevel * NUM_NORMAL + normalLevel
 */
export function decodeAction(index: number): InputState {
    const ti = Math.floor(index / NUM_NORMAL);
    const ni = index % NUM_NORMAL;
    return {
        tangential: TANGENTIAL_LEVELS[ti],
        normal: NORMAL_LEVELS[ni],
    };
}

function argmax(data: Float32Array, offset: number, length: number): number {
    let best = 0;
    let bestVal = data[offset];
    for (let i = 1; i < length; i++) {
        if (data[offset + i] > bestVal) {
            bestVal = data[offset + i];
            best = i;
        }
    }
    return best;
}

/**
 * AI jockey that runs a trained ONNX model to produce actions.
 *
 * Supports both single-frame models (input = OBS_SIZE) and
 * frame-stacked models (input = OBS_SIZE × N). Frame stacking
 * is auto-detected from the model's input shape.
 */
export class OnnxJockey implements Jockey {
    private ort: OrtModule;
    private session: InferenceSession;
    private lastResult: Map<number, InputState> = new Map();
    private disposed = false;

    /** Number of frames the model expects (1 = no stacking). */
    private frameStack: number;
    /** Total input size per horse (OBS_SIZE × frameStack). */
    private inputSize: number;
    /** Per-horse frame buffer: horseId → ring buffer of recent obs. */
    private frameBuffers = new Map<number, Float64Array[]>();

    private constructor(ort: OrtModule, session: InferenceSession, inputSize: number) {
        this.ort = ort;
        this.session = session;
        this.inputSize = inputSize;
        this.frameStack = Math.round(inputSize / OBS_SIZE);
    }

    static async create(modelUrl: string): Promise<OnnxJockey> {
        const ort = await import('onnxruntime-web');
        const session = await ort.InferenceSession.create(modelUrl);

        // Detect input size by probing with a single obs
        let inputSize = OBS_SIZE;
        try {
            const probe = new Float32Array(OBS_SIZE);
            const inputName = session.inputNames[0];
            const tensor = new ort.Tensor('float32', probe, [1, OBS_SIZE]);
            await session.run({ [inputName]: tensor });
            // If it works, model expects OBS_SIZE (single frame)
        } catch {
            // Try common frame-stack multiples
            for (const mult of [4, 8, 2]) {
                try {
                    const size = OBS_SIZE * mult;
                    const probe = new Float32Array(size);
                    const inputName = session.inputNames[0];
                    const tensor = new ort.Tensor('float32', probe, [1, size]);
                    await session.run({ [inputName]: tensor });
                    inputSize = size;
                    break;
                } catch {
                    continue;
                }
            }
        }

        const frameStack = Math.round(inputSize / OBS_SIZE);
        if (frameStack > 1) {
            console.log(`OnnxJockey: detected ${frameStack}-frame stacked model (input=${inputSize})`);
        }
        return new OnnxJockey(ort, session, inputSize);
    }

    static fromSession(session: InferenceSession, inputSize: number = OBS_SIZE): OnnxJockey {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new OnnxJockey(null as any, session, inputSize);
    }

    /**
     * Synchronous fallback — returns the most recent cached result.
     */
    infer(_race: Race): Map<number, InputState> {
        return new Map(this.lastResult);
    }

    /** Reset frame buffers (call on race restart). */
    resetFrames(): void {
        this.frameBuffers.clear();
    }

    private getOrCreateBuffer(horseId: number, currentObs: Float64Array): Float64Array[] {
        let buf = this.frameBuffers.get(horseId);
        if (!buf) {
            // Initialize buffer with copies of the current obs
            buf = [];
            for (let i = 0; i < this.frameStack; i++) {
                buf.push(new Float64Array(currentObs));
            }
            this.frameBuffers.set(horseId, buf);
        }
        return buf;
    }

    private pushFrame(horseId: number, obs: Float64Array): void {
        const buf = this.getOrCreateBuffer(horseId, obs);
        // Shift: drop oldest, push newest
        buf.shift();
        buf.push(new Float64Array(obs));
    }

    private buildStackedInput(horseId: number): Float32Array {
        const buf = this.frameBuffers.get(horseId)!;
        const stacked = new Float32Array(this.inputSize);
        for (let f = 0; f < this.frameStack; f++) {
            const frame = buf[f];
            for (let j = 0; j < OBS_SIZE; j++) {
                stacked[f * OBS_SIZE + j] = frame[j];
            }
        }
        return stacked;
    }

    /**
     * Async inference — builds obs, runs the ONNX session, and returns
     * fresh actions for the current race state.
     */
    async inferAsync(race: Race, horseIds?: number[]): Promise<Map<number, InputState>> {
        if (this.disposed) return new Map();

        const horses = race.state.horses;
        const playerId = race.state.playerHorseId;

        const aiIndices: number[] = [];
        if (horseIds) {
            for (const id of horseIds) {
                const h = horses[id];
                if (h && !h.finished) aiIndices.push(id);
            }
        } else {
            for (const h of horses) {
                if (h.id !== playerId && !h.finished) {
                    aiIndices.push(h.id);
                }
            }
        }

        if (aiIndices.length === 0) return new Map();

        const allObs = buildObservations(race);
        const batchSize = aiIndices.length;

        // Update frame buffers and build input
        const inputData = new Float32Array(batchSize * this.inputSize);

        for (let b = 0; b < batchSize; b++) {
            const hid = aiIndices[b];
            const obs = allObs[hid];

            if (this.frameStack > 1) {
                // Frame stacking: push current obs, build stacked input
                this.pushFrame(hid, obs);
                const stacked = this.buildStackedInput(hid);
                inputData.set(stacked, b * this.inputSize);
            } else {
                // Single frame: copy directly
                for (let j = 0; j < OBS_SIZE; j++) {
                    inputData[b * this.inputSize + j] = obs[j];
                }
            }
        }

        const inputName = this.session.inputNames[0];
        const outputName = this.session.outputNames[0];

        const { ready, release } = acquireInferenceLock();
        await ready;

        try {
            if (this.disposed) return new Map();

            const tensor = this.ort
                ? new this.ort.Tensor('float32', inputData, [batchSize, this.inputSize])
                : ({ dims: [batchSize, this.inputSize], type: 'float32', data: inputData } as any);
            const feeds = { [inputName]: tensor };
            const results = await this.session.run(feeds);

            if (this.disposed) return new Map();

            const output = results[outputName];
            const outData = output.data as Float32Array;
            const actions = new Map<number, InputState>();

            for (let b = 0; b < batchSize; b++) {
                const actionIdx = argmax(outData, b * NUM_ACTIONS, NUM_ACTIONS);
                actions.set(aiIndices[b], decodeAction(actionIdx));
            }

            this.lastResult = actions;
            return new Map(actions);
        } catch (err) {
            if (!this.disposed) {
                console.error('OnnxJockey inference failed:', err);
            }
            return new Map(this.lastResult);
        } finally {
            release();
        }
    }

    dispose(): void {
        this.disposed = true;
        this.session.release();
    }
}
