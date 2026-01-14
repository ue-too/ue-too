/**
 * EventQueue - FIFO queue for managing pending events.
 *
 * Provides a First-In-First-Out queue for event processing with safety limits.
 */

import type { Event } from '../core/types';

/**
 * Event queue implementation with FIFO ordering and depth limits.
 *
 * @example
 * ```typescript
 * const queue = new EventQueue();
 * queue.add(event1);
 * queue.addMultiple([event2, event3]);
 *
 * while (!queue.isEmpty()) {
 *   const event = queue.pop();
 *   // Process event
 * }
 * ```
 */
export class EventQueue {
  private queue: Event[] = [];
  private maxDepth: number;
  public processedCount: number = 0;

  /**
   * Create a new event queue.
   *
   * @param maxDepth - Maximum queue depth (default: 1000)
   */
  constructor(maxDepth: number = 1000) {
    this.maxDepth = maxDepth;
  }

  /**
   * Add an event to the queue.
   *
   * @param event - Event to add
   * @throws Error if queue is full
   */
  add(event: Event): void {
    if (this.queue.length >= this.maxDepth) {
      throw new Error(`Event queue exceeded maximum depth of ${this.maxDepth}`);
    }
    this.queue.push(event);
  }

  /**
   * Add multiple events to the queue.
   *
   * @param events - Events to add
   * @throws Error if queue would exceed maximum depth
   */
  addMultiple(events: Event[]): void {
    if (this.queue.length + events.length > this.maxDepth) {
      throw new Error(
        `Adding ${events.length} events would exceed maximum queue depth of ${this.maxDepth}`
      );
    }
    this.queue.push(...events);
  }

  /**
   * Remove and return the next event from the queue (FIFO).
   *
   * @returns Next event or null if queue is empty
   */
  pop(): Event | null {
    const event = this.queue.shift();
    if (event) {
      this.processedCount++;
    }
    return event ?? null;
  }

  /**
   * Peek at the next event without removing it.
   *
   * @returns Next event or null if queue is empty
   */
  peek(): Event | null {
    return this.queue[0] ?? null;
  }

  /**
   * Check if the queue is empty.
   *
   * @returns True if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get the current queue size.
   *
   * @returns Number of events in queue
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Clear all events from the queue.
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Get all events in the queue (without removing them).
   *
   * @returns Array of all queued events
   */
  getAll(): Event[] {
    return [...this.queue];
  }

  /**
   * Reset the processed count.
   */
  resetProcessedCount(): void {
    this.processedCount = 0;
  }

  /**
   * Get the maximum queue depth.
   *
   * @returns Maximum depth
   */
  getMaxDepth(): number {
    return this.maxDepth;
  }
}
