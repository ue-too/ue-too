/**
 * IsPlayerTurn precondition - checks if the actor is the active player.
 */

import { BasePrecondition } from './base';
import type { ActionContext } from '../../core/types';

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
