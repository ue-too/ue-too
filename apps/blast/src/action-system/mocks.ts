import type { Entity, GameState } from './types';

/**
 * Simple mock Entity implementation for testing.
 */
export class MockEntity implements Entity {
  public components: Record<string, any> = {};

  constructor(
    public id: string,
    components: Record<string, any> = {}
  ) {
    this.components = { ...components };
  }

  get(componentName: string): any | null {
    return this.components[componentName] ?? null;
  }

  has(componentName: string): boolean {
    return componentName in this.components;
  }

  /**
   * Helper method to create entities with common components
   */
  static createPlayer(id: string, resources: Record<string, number> = {}): MockEntity {
    return new MockEntity(id, {
      Resources: resources,
      Owner: { id }
    });
  }

  static createCard(id: string, ownerId: string, zone: string, cost: number = 0): MockEntity {
    return new MockEntity(id, {
      Card: { cost },
      Position: { zone, index: 0 },
      Owner: { id: ownerId }
    });
  }
}

/**
 * Simple mock GameState implementation for testing.
 */
export class MockGameState implements GameState {
  public entities: Map<string, Entity> = new Map();
  public activePlayer: string = '';
  public phase: string = '';

  constructor(
    entities: Entity[] = [],
    activePlayer: string = '',
    phase: string = ''
  ) {
    for (const entity of entities) {
      this.entities.set(entity.id, entity);
    }
    this.activePlayer = activePlayer;
    this.phase = phase;
  }

  clone(): GameState {
    const cloned = new MockGameState([], this.activePlayer, this.phase);
    
    // Deep clone entities and their components
    for (const [id, entity] of this.entities.entries()) {
      const mockEntity = entity as MockEntity;
      // Deep clone components
      const clonedComponents: Record<string, any> = {};
      for (const [key, value] of Object.entries(mockEntity.components)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          clonedComponents[key] = { ...value };
        } else {
          clonedComponents[key] = value;
        }
      }
      const clonedEntity = new MockEntity(id, clonedComponents);
      cloned.entities.set(id, clonedEntity);
    }
    
    return cloned;
  }

  getEntity(id: string): Entity | null {
    return this.entities.get(id) ?? null;
  }

  query(selector: string): Entity[] {
    // Simple query implementation for testing
    // In real implementation, this would parse the selector and filter entities
    const results: Entity[] = [];
    
    // Simple zone query: "zone == 'hand'"
    const zoneMatch = selector.match(/zone\s*==\s*['"]([^'"]+)['"]/);
    if (zoneMatch) {
      const zone = zoneMatch[1];
      for (const entity of this.entities.values()) {
        const position = entity.get('Position');
        if (position?.zone === zone) {
          results.push(entity);
        }
      }
      return results;
    }

    // Simple owner query: "owner == 'player1'"
    const ownerMatch = selector.match(/owner\s*==\s*['"]([^'"]+)['"]/);
    if (ownerMatch) {
      const ownerId = ownerMatch[1];
      for (const entity of this.entities.values()) {
        const owner = entity.get('Owner');
        if (owner?.id === ownerId) {
          results.push(entity);
        }
      }
      return results;
    }

    // Return all entities if no specific query matches
    return Array.from(this.entities.values());
  }
}
