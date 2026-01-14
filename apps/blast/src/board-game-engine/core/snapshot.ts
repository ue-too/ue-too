/**
 * GameStateSnapshot for capturing and restoring game state.
 *
 * Provides snapshot-based immutability by capturing the state of the ECS
 * coordinator at specific points in time. This allows for undo/redo functionality
 * and maintains immutability boundaries around action execution.
 */

import type { Coordinator } from '@ue-too/ecs';
import type { GameMetadata } from './types';

/**
 * Captures a snapshot of the game state for immutability and undo/redo.
 *
 * @example
 * ```typescript
 * // Capture current state
 * const snapshot = GameStateSnapshot.capture(coordinator, {
 *   currentPhase: 'Main',
 *   turnNumber: 5,
 *   activePlayer: playerEntity,
 *   eventQueue: []
 * });
 *
 * // Later, restore it
 * snapshot.restore(coordinator);
 * ```
 */
export class GameStateSnapshot {
  private readonly ecsState: any;
  public readonly metadata: GameMetadata;
  public readonly timestamp: number;

  private constructor(ecsState: any, metadata: GameMetadata, timestamp: number) {
    this.ecsState = ecsState;
    this.metadata = { ...metadata }; // Deep copy metadata
    this.timestamp = timestamp;
  }

  /**
   * Capture a snapshot of the current ECS state and metadata.
   *
   * @param coordinator - The ECS coordinator to snapshot
   * @param metadata - Game metadata to capture
   * @returns A new GameStateSnapshot
   */
  static capture(coordinator: Coordinator, metadata: GameMetadata): GameStateSnapshot {
    // Serialize the entire ECS state
    const ecsState = coordinator.serialize();

    // Create deep copy of metadata to prevent mutation
    const metadataCopy: GameMetadata = {
      currentPhase: metadata.currentPhase,
      turnNumber: metadata.turnNumber,
      activePlayer: metadata.activePlayer,
      eventQueue: [...metadata.eventQueue], // Shallow copy of event array
    };

    return new GameStateSnapshot(ecsState, metadataCopy, Date.now());
  }

  /**
   * Restore this snapshot to the coordinator.
   * WARNING: This will clear all existing entities and replace with snapshot state.
   *
   * @param coordinator - The ECS coordinator to restore into
   */
  restore(coordinator: Coordinator): void {
    // Deserialize ECS state (clears existing state)
    coordinator.deserialize(this.ecsState, { clearExisting: true });
  }

  /**
   * Get a deep copy of the metadata from this snapshot.
   *
   * @returns A copy of the snapshot metadata
   */
  getMetadata(): GameMetadata {
    return {
      currentPhase: this.metadata.currentPhase,
      turnNumber: this.metadata.turnNumber,
      activePlayer: this.metadata.activePlayer,
      eventQueue: [...this.metadata.eventQueue],
    };
  }

  /**
   * Get the timestamp of when this snapshot was created.
   *
   * @returns Timestamp in milliseconds
   */
  getTimestamp(): number {
    return this.timestamp;
  }

  /**
   * Create a JSON representation of this snapshot for persistence.
   *
   * @returns JSON-serializable object
   */
  toJSON(): {
    ecsState: any;
    metadata: GameMetadata;
    timestamp: number;
  } {
    return {
      ecsState: this.ecsState,
      metadata: this.getMetadata(),
      timestamp: this.timestamp,
    };
  }

  /**
   * Restore a snapshot from JSON.
   *
   * @param json - JSON object from toJSON()
   * @returns A new GameStateSnapshot
   */
  static fromJSON(json: {
    ecsState: any;
    metadata: GameMetadata;
    timestamp: number;
  }): GameStateSnapshot {
    return new GameStateSnapshot(json.ecsState, json.metadata, json.timestamp);
  }
}
