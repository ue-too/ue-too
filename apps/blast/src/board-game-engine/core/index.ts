/**
 * Core module exports for the Board Game Rule Engine.
 *
 * This module provides the fundamental types, classes, and utilities
 * for building board game logic on top of the ECS architecture.
 */

// Type definitions
export * from './types';

// Game state
export { GameState, GAME_MANAGER_COMPONENT, ZONE_COMPONENT, PLAYER_COMPONENT, GRID_LOCATION_COMPONENT } from './game-state';
export type { GameManagerComponent, ZoneComponent, PlayerComponent, GridLocationComponent } from './game-state';

// Grid system
export {
  getGridType,
  getSquareNeighbors,
  getHexNeighbors,
  getSquareDistance,
  getHexDistance,
  hexAxialToCube,
  hexCubeToAxial,
} from './grid';

// Snapshot
export { GameStateSnapshot } from './snapshot';
