/**
 * ECS Components for the Simple Card Game.
 *
 * Defines all component types needed for a basic 2-player card game
 * with hand, deck, discard, and board zones, plus mana and health resources.
 */

import { createGlobalComponentName, Entity, ComponentName, Coordinator } from '@ue-too/ecs';

// Re-export existing components from blast app
export { LOCATION_COMPONENT, DECK_COMPONENT } from '../../token';
export type { LocationComponent, DeckComponent } from '../../token';
export { PLAYER_COMPONENT, ZONE_COMPONENT } from '../../board-game-engine/core/game-state';
export type { PlayerComponent, ZoneComponent } from '../../board-game-engine/core/game-state';

// Import for local use
import type { LocationComponent, DeckComponent } from '../../token';
import type { ZoneComponent as ZoneComponentType } from '../../board-game-engine/core/game-state';
import { LOCATION_COMPONENT as LOCATION_COMP, DECK_COMPONENT as DECK_COMP } from '../../token';
import { PLAYER_COMPONENT as PLAYER_COMP, ZONE_COMPONENT as ZONE_COMP } from '../../board-game-engine/core/game-state';

// ============================================================================
// Card Component
// ============================================================================

/**
 * Component name for card components.
 */
export const CARD_COMPONENT: ComponentName = createGlobalComponentName('Card');

/**
 * Card component - represents a playable card.
 */
export interface CardComponent {
  /** Card name */
  name: string;

  /** Card type (e.g., "Creature", "Spell", "Artifact") */
  cardType: string;

  /** Mana cost to play the card */
  cost: number;

  /** Card description/effect text */
  description: string;

  /** Card power (for creatures) */
  power?: number;

  /** Card toughness (for creatures) */
  toughness?: number;

  /** Custom effect identifier (for rule engine to match) */
  effectId?: string;
}

// ============================================================================
// Resource Component
// ============================================================================

/**
 * Component name for resource components.
 */
export const RESOURCE_COMPONENT: ComponentName = createGlobalComponentName('Resource');

/**
 * Resource component - tracks player resources (mana, health, etc.)
 */
export interface ResourceComponent {
  /** Current mana */
  mana: number;

  /** Maximum mana */
  maxMana: number;

  /** Current health */
  health: number;

  /** Maximum health */
  maxHealth: number;
}

// ============================================================================
// Card State Component
// ============================================================================

/**
 * Component name for card state components.
 */
export const CARD_STATE_COMPONENT: ComponentName = createGlobalComponentName('CardState');

/**
 * Card state component - tracks the state of a card on the board.
 */
export interface CardStateComponent {
  /** Whether the card is tapped (used this turn) */
  tapped: boolean;

  /** Whether the card has summoning sickness */
  summoningSickness: boolean;

  /** Number of times the card has attacked this turn */
  attacksThisTurn: number;
}

// ============================================================================
// Owner Component
// ============================================================================

/**
 * Component name for owner components.
 */
export const OWNER_COMPONENT: ComponentName = createGlobalComponentName('Owner');

/**
 * Owner component - tracks which player owns an entity.
 */
export interface OwnerComponent {
  /** The player entity that owns this entity */
  owner: Entity;
}

// ============================================================================
// Game Status Component
// ============================================================================

/**
 * Component name for game status components.
 */
export const GAME_STATUS_COMPONENT: ComponentName = createGlobalComponentName('GameStatus');

/**
 * Game status component - tracks whether game is over and who won.
 * Attached to the game manager entity.
 */
export interface GameStatusComponent {
  /** Whether the game is over */
  isGameOver: boolean;

  /** Winner entity (null if no winner yet) */
  winner: Entity | null;

  /** Reason for game end */
  endReason?: string;
}

// ============================================================================
// Component Registration Helper
// ============================================================================

/**
 * Register all card game components with the ECS coordinator.
 * Call this once during game initialization.
 *
 * @param coordinator - The ECS coordinator to register components with
 */
export function registerCardGameComponents(coordinator: Coordinator): void {
  // Check and register card component
  if (coordinator.getComponentType(CARD_COMPONENT) === null) {
    coordinator.registerComponent<CardComponent>(CARD_COMPONENT);
  }

  // Check and register resource component
  if (coordinator.getComponentType(RESOURCE_COMPONENT) === null) {
    coordinator.registerComponent<ResourceComponent>(RESOURCE_COMPONENT);
  }

  // Check and register card state component
  if (coordinator.getComponentType(CARD_STATE_COMPONENT) === null) {
    coordinator.registerComponent<CardStateComponent>(CARD_STATE_COMPONENT);
  }

  // Check and register owner component
  if (coordinator.getComponentType(OWNER_COMPONENT) === null) {
    coordinator.registerComponent<OwnerComponent>(OWNER_COMPONENT);
  }

  // Check and register game status component
  if (coordinator.getComponentType(GAME_STATUS_COMPONENT) === null) {
    coordinator.registerComponent<GameStatusComponent>(GAME_STATUS_COMPONENT);
  }

  // Location and Deck components are registered by StackableTokenSystem
  // Player and Zone components are registered by GameState
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an entity is a card.
 *
 * @param coordinator - The ECS coordinator
 * @param entity - Entity to check
 * @returns True if entity has a card component
 */
export function isCard(coordinator: Coordinator, entity: Entity): boolean {
  return coordinator.getComponentFromEntity(CARD_COMPONENT, entity) !== null;
}

/**
 * Check if an entity is a player.
 *
 * @param coordinator - The ECS coordinator
 * @param entity - Entity to check
 * @returns True if entity has a player component
 */
export function isPlayer(coordinator: Coordinator, entity: Entity): boolean {
  return coordinator.getComponentFromEntity(PLAYER_COMP, entity) !== null;
}

/**
 * Get the owner of an entity.
 *
 * @param coordinator - The ECS coordinator
 * @param entity - Entity to get owner of
 * @returns Owner entity or null if no owner
 */
export function getOwner(coordinator: Coordinator, entity: Entity): Entity | null {
  const ownerComp = coordinator.getComponentFromEntity<OwnerComponent>(OWNER_COMPONENT, entity);
  return ownerComp ? ownerComp.owner : null;
}

/**
 * Check if an entity is in a specific zone.
 *
 * @param coordinator - The ECS coordinator
 * @param entity - Entity to check
 * @param zoneName - Name of the zone
 * @param owner - Optional owner to filter by
 * @returns True if entity is in the zone
 */
export function isInZone(
  coordinator: Coordinator,
  entity: Entity,
  zoneName: string,
  owner?: Entity
): boolean {
  const locationComp = coordinator.getComponentFromEntity<LocationComponent>(
    LOCATION_COMP,
    entity
  );
  if (!locationComp) return false;

  // Get the zone entity
  const zoneEntity = locationComp.location;
  const zoneComp = coordinator.getComponentFromEntity<ZoneComponentType>(ZONE_COMP, zoneEntity);

  if (!zoneComp || zoneComp.name !== zoneName) return false;

  if (owner !== undefined && zoneComp.owner !== owner) return false;

  return true;
}
