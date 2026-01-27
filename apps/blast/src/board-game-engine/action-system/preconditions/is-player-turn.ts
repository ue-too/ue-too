/**
 * IsPlayerTurn precondition - checks if the actor is the active player.
 */
import type { ActionContext } from '../../core/types';
import { BasePrecondition } from './base';

/**
 * Precondition that checks if the actor is the currently active player.
 *
 * @example
 * ```typescript
 * const precondition = new IsPlayerTurn();
 * ```
 */
export class IsPlayerTurn extends BasePrecondition {
    check(context: ActionContext): boolean {
        return context.state.activePlayer === context.actor;
    }

    getErrorMessage(context: ActionContext): string {
        return `It is not your turn (active player: ${context.state.activePlayer}, actor: ${context.actor})`;
    }
}
