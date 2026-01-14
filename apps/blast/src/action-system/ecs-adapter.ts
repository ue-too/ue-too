import {
  Coordinator,
  Entity as ECSEntity,
  ComponentName,
  createGlobalComponentName,
  getComponentNameString
} from '@ue-too/ecs';
import type { Entity, GameState } from './types';

/**
 * Adapter that bridges the action system's string-based entity IDs
 * with the ECS's number-based entity system.
 */
export class EntityIdMapper {
  private stringToNumber: Map<string, ECSEntity> = new Map();
  private numberToString: Map<ECSEntity, string> = new Map();
  private nextId: number = 0;

  /**
   * Get or create an ECS entity for a string ID
   */
  getOrCreateEntity(stringId: string, coordinator: Coordinator): ECSEntity {
    let entity = this.stringToNumber.get(stringId);
    if (entity === undefined) {
      entity = coordinator.createEntity();
      this.stringToNumber.set(stringId, entity);
      this.numberToString.set(entity, stringId);
    }
    return entity;
  }

  /**
   * Get string ID for an ECS entity
   */
  getStringId(entity: ECSEntity): string | null {
    return this.numberToString.get(entity) ?? null;
  }

  /**
   * Get ECS entity for a string ID
   */
  getECSEntity(stringId: string): ECSEntity | null {
    return this.stringToNumber.get(stringId) ?? null;
  }

  /**
   * Remove mapping
   */
  removeMapping(stringId: string): void {
    const entity = this.stringToNumber.get(stringId);
    if (entity !== undefined) {
      this.stringToNumber.delete(stringId);
      this.numberToString.delete(entity);
    }
  }

  /**
   * Get all string IDs
   */
  getAllStringIds(): string[] {
    return Array.from(this.stringToNumber.keys());
  }
}

/**
 * Adapter that bridges string component names with ECS ComponentName symbols.
 */
export class ComponentNameMapper {
  private stringToSymbol: Map<string, ComponentName> = new Map();

  /**
   * Get or create a ComponentName for a string name
   */
  getOrCreateComponentName(name: string): ComponentName {
    let symbol = this.stringToSymbol.get(name);
    if (symbol === undefined) {
      symbol = createGlobalComponentName(name);
      this.stringToSymbol.set(name, symbol);
    }
    return symbol;
  }

  /**
   * Get string name for a ComponentName
   */
  getStringName(componentName: ComponentName): string {
    return getComponentNameString(componentName);
  }
}

/**
 * Entity adapter that wraps an ECS entity with string-based component access.
 */
export class ECSEntityAdapter implements Entity {
  constructor(
    public id: string,
    private ecsEntity: ECSEntity,
    private coordinator: Coordinator,
    private componentMapper: ComponentNameMapper
  ) {}

  get(componentName: string): any | null {
    const symbol = this.componentMapper.getOrCreateComponentName(componentName);
    return this.coordinator.getComponentFromEntity(symbol, this.ecsEntity);
  }

  has(componentName: string): boolean {
    const symbol = this.componentMapper.getOrCreateComponentName(componentName);
    return this.coordinator.getComponentFromEntity(symbol, this.ecsEntity) !== null;
  }
}

/**
 * GameState implementation using the ECS Coordinator.
 */
export class ECSGameState implements GameState {
  public entities: Map<string, Entity> = new Map();
  public activePlayer: string = '';
  public phase: string = '';

  constructor(
    private coordinator: Coordinator,
    private entityMapper: EntityIdMapper,
    private componentMapper: ComponentNameMapper,
    activePlayer: string = '',
    phase: string = ''
  ) {
    this.activePlayer = activePlayer;
    this.phase = phase;
    this.refreshEntityMap();
  }

  /**
   * Refresh the entities map from the ECS
   */
  private refreshEntityMap(): void {
    this.entities.clear();
    for (const stringId of this.entityMapper.getAllStringIds()) {
      const ecsEntity = this.entityMapper.getECSEntity(stringId);
      if (ecsEntity !== null) {
        this.entities.set(
          stringId,
          new ECSEntityAdapter(stringId, ecsEntity, this.coordinator, this.componentMapper)
        );
      }
    }
  }

  clone(): GameState {
    // Create a new coordinator with cloned state
    // This is a simplified approach - in production, you'd want a more efficient cloning mechanism
    const newCoordinator = new Coordinator();
    const newEntityMapper = new EntityIdMapper();
    const newComponentMapper = new ComponentNameMapper();

    // Track which components we've registered
    const registeredComponents = new Set<string>();

    // Copy all entities and components
    for (const [stringId, entity] of this.entities.entries()) {
      const ecsEntity = this.entityMapper.getECSEntity(stringId);
      if (ecsEntity !== null) {
        const newEcsEntity = newEntityMapper.getOrCreateEntity(stringId, newCoordinator);
        
        // Try to get all components that might exist
        // We'll check common component names
        const commonComponents = ['Resources', 'Owner', 'Card', 'Position', 'Health', 'Status'];
        
        for (const compName of commonComponents) {
          const symbol = this.componentMapper.getOrCreateComponentName(compName);
          const component = this.coordinator.getComponentFromEntity(symbol, ecsEntity);
          if (component !== null) {
            // Register component if not already registered
            if (!registeredComponents.has(compName)) {
              if (newCoordinator.getComponentType(symbol) === null) {
                newCoordinator.registerComponent(symbol);
              }
              registeredComponents.add(compName);
            }
            
            // Deep clone the component data
            const clonedComponent = JSON.parse(JSON.stringify(component));
            newCoordinator.addComponentToEntity(symbol, newEcsEntity, clonedComponent);
          }
        }
      }
    }

    return new ECSGameState(newCoordinator, newEntityMapper, newComponentMapper, this.activePlayer, this.phase);
  }

  getEntity(id: string): Entity | null {
    return this.entities.get(id) ?? null;
  }

  query(selector: string): Entity[] {
    // Simple query implementation
    // In a real implementation, this would parse the selector and use ECS queries
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

  /**
   * Get the underlying ECS coordinator
   */
  getCoordinator(): Coordinator {
    return this.coordinator;
  }

  /**
   * Get the entity mapper
   */
  getEntityMapper(): EntityIdMapper {
    return this.entityMapper;
  }

  /**
   * Get the component mapper
   */
  getComponentMapper(): ComponentNameMapper {
    return this.componentMapper;
  }
}

// Export for convenience
export const entityMapper = new EntityIdMapper();
export const componentMapper = new ComponentNameMapper();
