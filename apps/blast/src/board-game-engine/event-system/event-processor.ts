/**
 * EventProcessor - Processes events through the rule engine.
 *
 * Provides event processing with cycle detection and iteration limits.
 */

import type { GameState, Event } from '../core/types';
import type { RuleEngine } from '../rule-engine/rule-engine';
import { EventQueue } from './event-queue';
import { InfiniteLoopError } from '../core/types';

/**
 * Processes events through the rule engine with safety features.
 *
 * @example
 * ```typescript
 * const processor = new EventProcessor(ruleEngine);
 * const queue = new EventQueue();
 * queue.addMultiple(events);
 *
 * const newState = processor.processAll(state, queue);
 * ```
 */
export class EventProcessor {
  private maxIterations: number;

  /**
   * Create a new event processor.
   *
   * @param ruleEngine - The rule engine to process events with
   * @param maxIterations - Maximum processing iterations (default: 100)
   */
  constructor(
    private ruleEngine: RuleEngine,
    maxIterations: number = 100
  ) {
    this.maxIterations = maxIterations;
  }

  /**
   * Process all events in the queue through the rule engine.
   *
   * @param state - Current game state
   * @param queue - Event queue to process
   * @returns Final game state after processing all events
   * @throws InfiniteLoopError if max iterations exceeded
   */
  processAll(state: GameState, queue: EventQueue): GameState {
    let iterations = 0;
    const processedSignatures = new Set<string>();

    while (!queue.isEmpty() && iterations < this.maxIterations) {
      const event = queue.pop();
      if (!event) break;

      // Cycle detection
      const signature = this.getEventSignature(event);
      if (processedSignatures.has(signature)) {
        console.warn(
          `Cycle detected: event signature "${signature}" already processed. Skipping.`
        );
        continue;
      }
      processedSignatures.add(signature);

      // Process through rule engine
      const newEvents = this.ruleEngine.processEvent(state, event);

      // Add new events to queue
      if (newEvents.length > 0) {
        queue.addMultiple(newEvents);
      }

      iterations++;
    }

    if (iterations >= this.maxIterations) {
      throw new InfiniteLoopError(
        `Event processing exceeded maximum iterations (${this.maxIterations})`,
        this.maxIterations
      );
    }

    return state;
  }

  /**
   * Generate a unique signature for an event for cycle detection.
   *
   * @param event - Event to generate signature for
   * @returns Event signature string
   */
  private getEventSignature(event: Event): string {
    const parts = [event.type];

    // Sort keys for consistent signatures
    const sortedKeys = Object.keys(event.data).sort();

    for (const key of sortedKeys) {
      const value = event.data[key];
      // Simple stringification - may need more sophisticated approach for complex objects
      parts.push(`${key}:${JSON.stringify(value)}`);
    }

    return parts.join('|');
  }

  /**
   * Get the maximum iterations limit.
   *
   * @returns Maximum iterations
   */
  getMaxIterations(): number {
    return this.maxIterations;
  }

  /**
   * Set the maximum iterations limit.
   *
   * @param max - New maximum iterations
   */
  setMaxIterations(max: number): void {
    this.maxIterations = max;
  }
}
