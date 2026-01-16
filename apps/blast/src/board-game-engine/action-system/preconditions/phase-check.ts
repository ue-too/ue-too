/**
 * PhaseCheck precondition - checks if current phase is in allowed list.
 */

import { BasePrecondition } from './base';
import type { ActionContext } from '../../core/types';

/**
 * Precondition that checks if the current phase is in the allowed list.
 *
 * @example
 * ```typescript
 * // Action only allowed in Main phase
 * const precondition = new PhaseCheck(['Main']);
 *
 * // Action allowed in Main or Combat phases
 * const precondition = new PhaseCheck(['Main', 'Combat']);
 * ```
 */
export class PhaseCheck extends BasePrecondition {
  constructor(private allowedPhases: string[]) {
    super();
  }

  check(context: ActionContext): boolean {
    return this.allowedPhases.includes(context.state.currentPhase);
  }

  getErrorMessage(context: ActionContext): string {
    return `Action not allowed in ${context.state.currentPhase} phase (allowed: ${this.allowedPhases.join(', ')})`;
  }

  /**
   * Get the list of allowed phases.
   *
   * @returns Array of phase names
   */
  getAllowedPhases(): string[] {
    return [...this.allowedPhases];
  }
}
