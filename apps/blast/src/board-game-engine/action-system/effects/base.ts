/**
 * Base Effect classes for the Action System.
 *
 * Provides abstract base classes for implementing effects that modify game state.
 * Effects integrate directly with the ECS coordinator.
 */
import type { Coordinator } from '@ue-too/ecs';

import type { ActionContext, Effect, Event } from '../../core/types';

/**
 * Abstract base class for all effects.
 * Provides default implementations for event generation.
 */
export abstract class BaseEffect implements Effect {
    /**
     * Apply the effect to the game state.
     * Must be implemented by subclasses.
     *
     * @param context - Action context containing state and entities
     */
    abstract apply(context: ActionContext): void;

    /**
     * Whether this effect generates an event.
     * Override to return true if this effect should generate events.
     *
     * @returns False by default
     */
    generatesEvent(): boolean {
        return false;
    }

    /**
     * Create an event if this effect generates one.
     * Override if generatesEvent() returns true.
     *
     * @param context - Action context
     * @returns Null by default
     */
    createEvent(context: ActionContext): Event | null {
        return null;
    }
}

/**
 * Abstract base class for effects that are ECS-aware.
 * Provides direct access to the coordinator for convenience.
 */
export abstract class ECSEffect extends BaseEffect {
    /**
     * Get the coordinator from the context.
     * Helper method for subclasses.
     *
     * @param context - Action context
     * @returns The ECS coordinator
     */
    protected getCoordinator(context: ActionContext): Coordinator {
        return context.state.coordinator;
    }
}

/**
 * Composite effect that applies multiple effects in sequence.
 *
 * @example
 * ```typescript
 * const effect = new CompositeEffect([
 *   new ModifyResourceEffect('mana', -5),
 *   new MoveEntityEffect('hand', 'board'),
 *   new EmitEventEffect('CardPlayed', { cardId: entity })
 * ]);
 * ```
 */
export class CompositeEffect extends BaseEffect {
    constructor(private effects: Effect[]) {
        super();
    }

    /**
     * Apply all effects in sequence.
     *
     * @param context - Action context
     */
    apply(context: ActionContext): void {
        for (const effect of this.effects) {
            effect.apply(context);
        }
    }

    /**
     * Generates event if any sub-effect generates events.
     *
     * @returns True if any sub-effect generates events
     */
    generatesEvent(): boolean {
        return this.effects.some(effect => effect.generatesEvent());
    }

    /**
     * Create events from all sub-effects that generate them.
     * Note: Returns only the first event found. If you need multiple events,
     * use separate EmitEvent effects.
     *
     * @param context - Action context
     * @returns First event found or null
     */
    createEvent(context: ActionContext): Event | null {
        for (const effect of this.effects) {
            if (effect.generatesEvent()) {
                const event = effect.createEvent(context);
                if (event) return event;
            }
        }
        return null;
    }

    /**
     * Get all sub-effects.
     *
     * @returns Array of effects
     */
    getEffects(): Effect[] {
        return [...this.effects];
    }
}

/**
 * Effect that does nothing.
 * Useful as a placeholder or for testing.
 */
export class NoOpEffect extends BaseEffect {
    apply(context: ActionContext): void {
        // Do nothing
    }
}

/**
 * Effect that runs a custom function.
 * Use this for quick prototyping or game-specific effects.
 *
 * @example
 * ```typescript
 * const effect = new CustomEffect((context) => {
 *   const health = context.getComponent<HealthComponent>(HEALTH_COMPONENT, context.actor);
 *   if (health) {
 *     health.health = Math.min(health.health + 10, health.maxHealth);
 *   }
 * });
 * ```
 */
export class CustomEffect extends BaseEffect {
    constructor(
        private effectFn: (context: ActionContext) => void,
        private eventGenerator?: (context: ActionContext) => Event | null
    ) {
        super();
    }

    apply(context: ActionContext): void {
        this.effectFn(context);
    }

    generatesEvent(): boolean {
        return this.eventGenerator !== undefined;
    }

    createEvent(context: ActionContext): Event | null {
        return this.eventGenerator ? this.eventGenerator(context) : null;
    }
}
