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
