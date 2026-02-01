/**
 * EmitEvent effect - explicitly emits an event without modifying state.
 */
import type { ActionContext, Event } from '../../core/types';
import { BaseEffect } from './base';

// Simple ID generator for events
let eventIdCounter = 0;
function generateEventId(): string {
    return `event-${Date.now()}-${eventIdCounter++}`;
}

/**
 * Effect that emits an event without modifying game state.
 * Use this to signal that something happened for the rule engine to process.
 *
 * @example
 * ```typescript
 * const effect = new EmitEvent('CardPlayed', (ctx) => ({
 *   cardId: ctx.actor,
 *   playerId: ctx.state.activePlayer
 * }));
 * ```
 */
export class EmitEvent extends BaseEffect {
    constructor(
        private eventType: string,
        private dataGenerator:
            | Record<string, any>
            | ((context: ActionContext) => Record<string, any>)
    ) {
        super();
    }

    apply(context: ActionContext): void {
        // This effect doesn't modify state, only generates an event
        // The event will be collected by ActionSystem and added to the queue
    }

    generatesEvent(): boolean {
        return true;
    }

    createEvent(context: ActionContext): Event {
        const data =
            typeof this.dataGenerator === 'function'
                ? this.dataGenerator(context)
                : { ...this.dataGenerator };

        return {
            type: this.eventType,
            data,
            timestamp: Date.now(),
            id: generateEventId(),
        };
    }
}
