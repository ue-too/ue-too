/**
 * RuleContext - Context for rule evaluation.
 *
 * Bundles information needed during rule condition checking and effect execution.
 */

import type { Entity } from '@ue-too/ecs';
import type { GameState, Event, Rule, RuleContext as IRuleContext } from '../core/types';

/**
 * Implementation of RuleContext that bundles information for rule evaluation.
 *
 * @example
 * ```typescript
 * const context = new RuleContext(state, event, rule, matchedEntities);
 *
 * // Use in condition evaluation
 * if (condition.evaluate(state, context)) {
 *   // Apply rule effects
 * }
 * ```
 */
export class RuleContext implements IRuleContext {
  constructor(
    public readonly state: GameState,
    public readonly event: Event,
    public readonly rule: Rule,
    public readonly matchedEntities: Entity[]
  ) {}

  /**
   * Get the source entity of the rule (if it's an entity-attached rule).
   *
   * @returns Source entity or null if rule is global
   */
  getSourceEntity(): Entity | null {
    return this.rule.source ?? null;
  }

  /**
   * Get data from the event by key.
   *
   * @param key - Data key
   * @returns Data value or undefined
   */
  getEventData<T = any>(key: string): T | undefined {
    return this.event.data[key] as T;
  }

  /**
   * Check if event data contains a key.
   *
   * @param key - Data key
   * @returns True if key exists
   */
  hasEventData(key: string): boolean {
    return key in this.event.data;
  }
}
