/**
 * Core module exports for the Board Game Rule Engine.
 *
 * This module provides the fundamental types, classes, and utilities
 * for building board game logic on top of the ECS architecture.
 */

// Type definitions
export * from './types';

// Game state
export { GameState, GAME_MANAGER_COMPONENT, ZONE_COMPONENT, PLAYER_COMPONENT } from './game-state';
export type { GameManagerComponent, ZoneComponent, PlayerComponent } from './game-state';

// Snapshot
export { GameStateSnapshot } from './snapshot';
