/**
 * Event utility functions.
 */

let eventIdCounter = 0;

/**
 * Generate a unique event ID.
 *
 * @returns Unique event ID string
 */
export function generateEventId(): string {
    return `event-${Date.now()}-${eventIdCounter++}`;
}
