/**
 * Base Precondition classes for the Action System.
 *
 * Provides abstract base classes for implementing preconditions that validate
 * whether an action can be executed.
 */

import type { Precondition, ActionContext } from '../../core/types';

/**
 * Abstract base class for all preconditions.
 * Provides structure for checking conditions and generating error messages.
 */
export abstract class BasePrecondition implements Precondition {
  /**
   * Check if the precondition is satisfied.
   * Must be implemented by subclasses.
   *
   * @param context - Action context containing state and entities
   * @returns True if precondition passes, false otherwise
   */
  abstract check(context: ActionContext): boolean;

  /**
   * Get error message when precondition fails.
   * Must be implemented by subclasses.
   *
   * @param context - Action context
   * @returns Error message describing why precondition failed
   */
  abstract getErrorMessage(context: ActionContext): string;
}

/**
 * Composite precondition that requires ALL sub-preconditions to pass (AND logic).
 *
 * @example
 * ```typescript
 * const precondition = new AndPrecondition([
 *   new IsPlayerTurn(),
 *   new HasComponent(CARD_COMPONENT, 'actor'),
 *   new ResourceAvailable('mana', 5)
 * ]);
 * ```
 */
export class AndPrecondition extends BasePrecondition {
  constructor(private preconditions: Precondition[]) {
    super();
  }

  check(context: ActionContext): boolean {
    return this.preconditions.every((precondition) => precondition.check(context));
  }

  getErrorMessage(context: ActionContext): string {
    const failedPreconditions = this.preconditions.filter(
      (precondition) => !precondition.check(context)
    );
    if (failedPreconditions.length === 0) {
      return 'All preconditions passed';
    }
    const messages = failedPreconditions.map((p) => p.getErrorMessage(context));
    return messages.join('; ');
  }

  /**
   * Get all sub-preconditions.
   *
   * @returns Array of preconditions
   */
  getPreconditions(): Precondition[] {
    return [...this.preconditions];
  }
}

/**
 * Composite precondition that requires AT LEAST ONE sub-precondition to pass (OR logic).
 *
 * @example
 * ```typescript
 * const precondition = new OrPrecondition([
 *   new PhaseCheck(['Main']),
 *   new PhaseCheck(['Combat'])
 * ]);
 * ```
 */
export class OrPrecondition extends BasePrecondition {
  constructor(private preconditions: Precondition[]) {
    super();
  }

  check(context: ActionContext): boolean {
    return this.preconditions.some((precondition) => precondition.check(context));
  }

  getErrorMessage(context: ActionContext): string {
    if (this.check(context)) {
      return 'At least one precondition passed';
    }
    return `None of the preconditions passed: ${this.preconditions
      .map((p) => p.getErrorMessage(context))
      .join(' OR ')}`;
  }

  /**
   * Get all sub-preconditions.
   *
   * @returns Array of preconditions
   */
  getPreconditions(): Precondition[] {
    return [...this.preconditions];
  }
}

/**
 * Precondition that inverts another precondition (NOT logic).
 *
 * @example
 * ```typescript
 * const precondition = new NotPrecondition(
 *   new PhaseCheck(['Combat'])
 * ); // True if NOT in Combat phase
 * ```
 */
export class NotPrecondition extends BasePrecondition {
  constructor(
    private precondition: Precondition,
    private customMessage?: string
  ) {
    super();
  }

  check(context: ActionContext): boolean {
    return !this.precondition.check(context);
  }

  getErrorMessage(context: ActionContext): string {
    if (this.customMessage) {
      return this.customMessage;
    }
    return `NOT (${this.precondition.getErrorMessage(context)})`;
  }

  /**
   * Get the wrapped precondition.
   *
   * @returns The precondition being inverted
   */
  getPrecondition(): Precondition {
    return this.precondition;
  }
}

/**
 * Precondition that always passes.
 * Useful as a placeholder or for testing.
 */
export class AlwaysTruePrecondition extends BasePrecondition {
  check(context: ActionContext): boolean {
    return true;
  }

  getErrorMessage(context: ActionContext): string {
    return 'This precondition always passes';
  }
}

/**
 * Precondition that always fails.
 * Useful for disabling actions temporarily or for testing.
 */
export class AlwaysFalsePrecondition extends BasePrecondition {
  constructor(private message: string = 'This action is disabled') {
    super();
  }

  check(context: ActionContext): boolean {
    return false;
  }

  getErrorMessage(context: ActionContext): string {
    return this.message;
  }
}

/**
 * Precondition that runs a custom function.
 * Use this for quick prototyping or game-specific conditions.
 *
 * @example
 * ```typescript
 * const precondition = new CustomPrecondition(
 *   (context) => {
 *     const deck = context.getComponent<DeckComponent>(DECK_COMPONENT, deckEntity);
 *     return deck !== null && deck.cached.entities.length > 0;
 *   },
 *   'Deck must not be empty'
 * );
 * ```
 */
export class CustomPrecondition extends BasePrecondition {
  constructor(
    private checkFn: (context: ActionContext) => boolean,
    private errorMessage: string | ((context: ActionContext) => string)
  ) {
    super();
  }

  check(context: ActionContext): boolean {
    return this.checkFn(context);
  }

  getErrorMessage(context: ActionContext): string {
    if (typeof this.errorMessage === 'function') {
      return this.errorMessage(context);
    }
    return this.errorMessage;
  }
}
