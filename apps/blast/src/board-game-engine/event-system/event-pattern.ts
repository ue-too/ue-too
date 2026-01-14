/**
 * EventPattern - Pattern matching for events.
 *
 * Provides pattern-based event matching for the rule engine.
 */

import type { Event, EventPattern as IEventPattern } from '../core/types';

/**
 * Implementation of EventPattern for matching events.
 *
 * @example
 * ```typescript
 * // Match any CardPlayed event
 * const pattern = new EventPattern('CardPlayed', {});
 *
 * // Match CardPlayed events for specific player
 * const pattern = new EventPattern('CardPlayed', { playerId: player1 });
 *
 * // Match with predicate
 * const pattern = new EventPattern('CardPlayed', {
 *   cardType: (type) => type === 'Spell'
 * });
 * ```
 */
export class EventPattern implements IEventPattern {
  constructor(
    public readonly eventType: string,
    public readonly filters: Record<string, any | ((value: any) => boolean)> = {}
  ) {}

  /**
   * Check if an event matches this pattern.
   *
   * @param event - Event to check
   * @returns True if event matches pattern
   */
  matches(event: Event): boolean {
    // Check event type
    if (this.eventType !== '*' && event.type !== this.eventType) {
      return false;
    }

    // Check all filters
    for (const [key, expectedValue] of Object.entries(this.filters)) {
      if (!(key in event.data)) {
        return false;
      }

      const actualValue = event.data[key];

      // Handle callable filters (predicates)
      if (typeof expectedValue === 'function') {
        if (!expectedValue(actualValue)) {
          return false;
        }
      }
      // Handle exact match
      else if (actualValue !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create a pattern that matches all events.
   *
   * @returns Pattern that matches everything
   */
  static matchAll(): EventPattern {
    return new EventPattern('*', {});
  }

  /**
   * Create a pattern that matches a specific event type.
   *
   * @param eventType - Event type to match
   * @returns Pattern that matches the event type
   */
  static forType(eventType: string): EventPattern {
    return new EventPattern(eventType, {});
  }

  /**
   * Create a string representation of this pattern for debugging.
   *
   * @returns String representation
   */
  toString(): string {
    const filterStr = Object.entries(this.filters)
      .map(([key, value]) => `${key}=${typeof value === 'function' ? '<predicate>' : value}`)
      .join(', ');
    return `EventPattern(${this.eventType}${filterStr ? `, {${filterStr}}` : ''})`;
  }
}
