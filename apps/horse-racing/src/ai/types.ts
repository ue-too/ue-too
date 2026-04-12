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
