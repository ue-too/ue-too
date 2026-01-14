/**
 * GameState - Main game state wrapper around ECS Coordinator.
 *
 * Provides a game-specific interface on top of the ECS coordinator,
 * managing game metadata, event queues, and state snapshots.
 */

import { Coordinator, Entity, ComponentName, createGlobalComponentName } from '@ue-too/ecs';
import type { GameMetadata, Event } from './types';
import { GameStateSnapshot } from './snapshot';

/**
 * Component name for the game manager component.
 * This component is attached to a single global entity to store game metadata.
 */
export const GAME_MANAGER_COMPONENT = createGlobalComponentName('GameManager');

/**
 * Component name for zone components.
 * Zones are entities with this component (hand, deck, discard, board, etc.)
 */
export const ZONE_COMPONENT = createGlobalComponentName('Zone');

/**
 * Component name for player components.
 * Identifies entities as players.
 */
export const PLAYER_COMPONENT = createGlobalComponentName('Player');

/**
 * Component type for the game manager global entity.
 */
export interface GameManagerComponent extends GameMetadata {
  // GameMetadata provides: currentPhase, turnNumber, activePlayer, eventQueue
}

/**
 * Component type for zones.
 */
export interface ZoneComponent {
  /** Zone name (e.g., "hand", "deck", "discard", "board") */
  name: string;

  /** Player entity who owns this zone (null for shared zones) */
  owner: Entity | null;

  /** Visibility level */
  visibility: 'public' | 'private' | 'owner-only';
}

/**
 * Component type for players.
 */
export interface PlayerComponent {
  /** Player name */
  name: string;

  /** Player number (0, 1, 2, etc.) */
  playerNumber: number;
}

/**
 * Main game state class that wraps the ECS Coordinator.
 * Provides game-specific methods and manages game metadata.
 *
 * @example
 * ```typescript
 * const coordinator = new Coordinator();
 * const gameState = new GameState(coordinator);
 *
 * // Access metadata
 * console.log(gameState.currentPhase); // "Upkeep"
 * console.log(gameState.turnNumber); // 1
 *
 * // Create snapshot
 * const snapshot = gameState.createSnapshot();
 *
 * // Later restore
 * gameState.restoreSnapshot(snapshot);
 * ```
 */
export class GameState {
  public readonly coordinator: Coordinator;
  private gameManagerEntity: Entity;
  private snapshotHistory: GameStateSnapshot[] = [];

  /**
   * Create a new GameState wrapping an ECS Coordinator.
   *
   * @param coordinator - The ECS coordinator to wrap
   * @param initializeGameManager - Whether to create the game manager entity (default: true)
   */
  constructor(coordinator: Coordinator, initializeGameManager: boolean = true) {
    this.coordinator = coordinator;

    if (initializeGameManager) {
      this.gameManagerEntity = this.initializeGameManager();
    } else {
      // Assume game manager entity already exists (e.g., after deserialization)
      this.gameManagerEntity = this.findGameManagerEntity();
    }
  }

  /**
   * Initialize the game manager entity with default metadata.
   *
   * @returns The created game manager entity
   */
  private initializeGameManager(): Entity {
    // Register game manager component if not already registered
    if (this.coordinator.getComponentType(GAME_MANAGER_COMPONENT) === null) {
      this.coordinator.registerComponent<GameManagerComponent>(GAME_MANAGER_COMPONENT);
    }

    // Create game manager entity
    const entity = this.coordinator.createEntity();

    // Add game manager component with default values
    const initialMetadata: GameManagerComponent = {
      currentPhase: 'Setup',
      turnNumber: 0,
      activePlayer: null,
      eventQueue: [],
    };

    this.coordinator.addComponentToEntity<GameManagerComponent>(
      GAME_MANAGER_COMPONENT,
      entity,
      initialMetadata
    );

    return entity;
  }

  /**
   * Find the existing game manager entity (used after deserialization).
   *
   * @returns The game manager entity
   * @throws Error if game manager entity not found
   */
  private findGameManagerEntity(): Entity {
    const allEntities = this.coordinator.getAllEntities();
    for (const entity of allEntities) {
      const component = this.coordinator.getComponentFromEntity<GameManagerComponent>(
        GAME_MANAGER_COMPONENT,
        entity
      );
      if (component) {
        return entity;
      }
    }
    throw new Error('GameManager entity not found');
  }

  /**
   * Get the game manager component.
   *
   * @returns The game manager component
   * @throws Error if component not found
   */
  private getGameManager(): GameManagerComponent {
    const component = this.coordinator.getComponentFromEntity<GameManagerComponent>(
      GAME_MANAGER_COMPONENT,
      this.gameManagerEntity
    );
    if (!component) {
      throw new Error('GameManager component not found');
    }
    return component;
  }

  // ============================================================================
  // Metadata Accessors
  // ============================================================================

  /**
   * Get the current phase name.
   */
  get currentPhase(): string {
    return this.getGameManager().currentPhase;
  }

  /**
   * Get the current turn number.
   */
  get turnNumber(): number {
    return this.getGameManager().turnNumber;
  }

  /**
   * Get the active player entity.
   */
  get activePlayer(): Entity | null {
    return this.getGameManager().activePlayer;
  }

  /**
   * Set the current phase name.
   */
  setCurrentPhase(phase: string): void {
    this.getGameManager().currentPhase = phase;
  }

  /**
   * Set the current turn number.
   */
  setTurnNumber(turn: number): void {
    this.getGameManager().turnNumber = turn;
  }

  /**
   * Set the active player entity.
   */
  setActivePlayer(player: Entity | null): void {
    this.getGameManager().activePlayer = player;
  }

  // ============================================================================
  // Event Queue Methods
  // ============================================================================

  /**
   * Get the event queue.
   *
   * @returns Array of pending events
   */
  getEventQueue(): Event[] {
    return this.getGameManager().eventQueue;
  }

  /**
   * Add an event to the queue.
   *
   * @param event - Event to add
   */
  addEvent(event: Event): void {
    this.getGameManager().eventQueue.push(event);
  }

  /**
   * Add multiple events to the queue.
   *
   * @param events - Events to add
   */
  addEvents(events: Event[]): void {
    this.getGameManager().eventQueue.push(...events);
  }

  /**
   * Clear the event queue.
   */
  clearEventQueue(): void {
    this.getGameManager().eventQueue = [];
  }

  // ============================================================================
  // Snapshot Methods
  // ============================================================================

  /**
   * Create a snapshot of the current game state.
   *
   * @returns A new GameStateSnapshot
   */
  createSnapshot(): GameStateSnapshot {
    const metadata: GameMetadata = {
      currentPhase: this.currentPhase,
      turnNumber: this.turnNumber,
      activePlayer: this.activePlayer,
      eventQueue: [...this.getEventQueue()],
    };

    const snapshot = GameStateSnapshot.capture(this.coordinator, metadata);
    this.snapshotHistory.push(snapshot);

    return snapshot;
  }

  /**
   * Restore a snapshot.
   * WARNING: This will replace all game state with the snapshot state.
   *
   * @param snapshot - Snapshot to restore
   */
  restoreSnapshot(snapshot: GameStateSnapshot): void {
    // Restore ECS state
    snapshot.restore(this.coordinator);

    // Restore metadata
    const metadata = snapshot.getMetadata();
    this.setCurrentPhase(metadata.currentPhase);
    this.setTurnNumber(metadata.turnNumber);
    this.setActivePlayer(metadata.activePlayer);
    this.clearEventQueue();
    this.addEvents(metadata.eventQueue);

    // Update game manager entity reference
    this.gameManagerEntity = this.findGameManagerEntity();
  }

  /**
   * Get the snapshot history.
   *
   * @returns Array of snapshots
   */
  getSnapshotHistory(): GameStateSnapshot[] {
    return [...this.snapshotHistory];
  }

  /**
   * Clear the snapshot history.
   */
  clearSnapshotHistory(): void {
    this.snapshotHistory = [];
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get all entities in a specific zone.
   *
   * @param zoneName - Name of the zone (e.g., "hand", "deck")
   * @param owner - Optional owner entity to filter by
   * @returns Array of entities in the zone
   */
  getEntitiesInZone(zoneName: string, owner?: Entity): Entity[] {
    // This is a placeholder - actual implementation depends on how zones are structured
    // For now, we'll return entities that have a LocationComponent pointing to the zone
    // This will be implemented properly when we integrate with existing LocationComponent

    const entities: Entity[] = [];
    const allEntities = this.coordinator.getAllEntities();

    // Find zone entity
    for (const entity of allEntities) {
      const zoneComp = this.coordinator.getComponentFromEntity<ZoneComponent>(
        ZONE_COMPONENT,
        entity
      );
      if (zoneComp && zoneComp.name === zoneName) {
        if (owner === undefined || zoneComp.owner === owner) {
          // This zone matches - now we need to find entities in it
          // This will be implemented with LocationComponent integration
          // For now, just track the zone entity
        }
      }
    }

    return entities;
  }

  /**
   * Get all player entities.
   *
   * @returns Array of player entities
   */
  getAllPlayers(): Entity[] {
    const players: Entity[] = [];
    const allEntities = this.coordinator.getAllEntities();

    for (const entity of allEntities) {
      const playerComp = this.coordinator.getComponentFromEntity<PlayerComponent>(
        PLAYER_COMPONENT,
        entity
      );
      if (playerComp) {
        players.push(entity);
      }
    }

    return players;
  }

  /**
   * Get opponent entities for a given player.
   *
   * @param playerId - The player entity
   * @returns Array of opponent entities
   */
  getOpponents(playerId: Entity): Entity[] {
    return this.getAllPlayers().filter((p) => p !== playerId);
  }

  /**
   * Check if an entity is a player.
   *
   * @param entity - Entity to check
   * @returns True if entity is a player
   */
  isPlayer(entity: Entity): boolean {
    return this.coordinator.getComponentFromEntity(PLAYER_COMPONENT, entity) !== null;
  }

  /**
   * Get a player by player number.
   *
   * @param playerNumber - Player number (0, 1, 2, etc.)
   * @returns Player entity or null if not found
   */
  getPlayerByNumber(playerNumber: number): Entity | null {
    const players = this.getAllPlayers();
    for (const player of players) {
      const playerComp = this.coordinator.getComponentFromEntity<PlayerComponent>(
        PLAYER_COMPONENT,
        player
      );
      if (playerComp && playerComp.playerNumber === playerNumber) {
        return player;
      }
    }
    return null;
  }
}
