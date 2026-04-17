import type { Race } from '../simulation/race';
import type { InputState } from '../simulation/types';

/**
 * Common interface for AI jockey strategies.
 * Each implementation produces per-horse actions from the current race state.
 */
export interface Jockey {
    /**
     * Produce actions for AI-controlled horses (synchronous, may use stale results).
     * @returns Map from horse id to input action. Horses not in the map receive {0, 0}.
     */
    infer(race: Race): Map<number, InputState>;

    /**
     * Produce actions for AI-controlled horses (async, waits for fresh results).
     * @param horseIds - If provided, only infer for these horse IDs.
     *                   If omitted, infer for all non-player, non-finished horses.
     */
    inferAsync(race: Race, horseIds?: number[]): Promise<Map<number, InputState>>;

    /** Reset per-race state (e.g. frame buffers). Called on race start. */
    resetFrames?(): void;

    /** Release any resources (e.g. ONNX session). */
    dispose(): void;
}
