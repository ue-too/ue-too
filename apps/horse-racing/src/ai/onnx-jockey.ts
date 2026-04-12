import type { InferenceSession, Tensor } from 'onnxruntime-web';

import { OBS_SIZE, buildObservations } from '../simulation/observation';
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
    private disposed = false;

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
        if (this.disposed) {
            return new Map();
        }

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

        // buildObservations returns Float64Array but ONNX requires float32;
        // copying element-by-element truncates each value to 32-bit precision.
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
            } as unknown as Tensor,
        };

        this.session
            .run(feeds)
            .then(results => {
                if (this.disposed) return;
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
            .catch(err => {
                if (this.disposed) return;
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
        this.disposed = true;
        this.session.release();
    }
}
