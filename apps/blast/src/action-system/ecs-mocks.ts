import { Coordinator } from '@ue-too/ecs';
import { ECSGameState, EntityIdMapper, ComponentNameMapper, ECSEntityAdapter } from './ecs-adapter';
import type { Entity } from './types';

/**
 * Helper to create ECS-based entities for testing.
 */
export class ECSMockHelpers {
  private coordinator: Coordinator;
  private entityMapper: EntityIdMapper;
  private componentMapper: ComponentNameMapper;

  constructor() {
    this.coordinator = new Coordinator();
    this.entityMapper = new EntityIdMapper();
    this.componentMapper = new ComponentNameMapper();
  }

  /**
   * Create a player entity with resources
   */
  createPlayer(id: string, resources: Record<string, number> = {}): Entity {
    const ecsEntity = this.entityMapper.getOrCreateEntity(id, this.coordinator);
    
    // Register components if needed
    const ResourcesSymbol = this.componentMapper.getOrCreateComponentName('Resources');
    const OwnerSymbol = this.componentMapper.getOrCreateComponentName('Owner');
    
    if (this.coordinator.getComponentType(ResourcesSymbol) === null) {
      this.coordinator.registerComponent(ResourcesSymbol);
    }
    if (this.coordinator.getComponentType(OwnerSymbol) === null) {
      this.coordinator.registerComponent(OwnerSymbol);
    }

    // Add components
    this.coordinator.addComponentToEntity(ResourcesSymbol, ecsEntity, resources);
    this.coordinator.addComponentToEntity(OwnerSymbol, ecsEntity, { id });

    return new ECSEntityAdapter(id, ecsEntity, this.coordinator, this.componentMapper);
  }

  /**
   * Create a card entity
   */
  createCard(id: string, ownerId: string, zone: string, cost: number = 0): Entity {
    const ecsEntity = this.entityMapper.getOrCreateEntity(id, this.coordinator);
    
    // Register components if needed
    const CardSymbol = this.componentMapper.getOrCreateComponentName('Card');
    const PositionSymbol = this.componentMapper.getOrCreateComponentName('Position');
    const OwnerSymbol = this.componentMapper.getOrCreateComponentName('Owner');
    
    if (this.coordinator.getComponentType(CardSymbol) === null) {
      this.coordinator.registerComponent(CardSymbol);
    }
    if (this.coordinator.getComponentType(PositionSymbol) === null) {
      this.coordinator.registerComponent(PositionSymbol);
    }
    if (this.coordinator.getComponentType(OwnerSymbol) === null) {
      this.coordinator.registerComponent(OwnerSymbol);
    }

    // Add components
    this.coordinator.addComponentToEntity(CardSymbol, ecsEntity, { cost });
    this.coordinator.addComponentToEntity(PositionSymbol, ecsEntity, { zone, index: 0 });
    this.coordinator.addComponentToEntity(OwnerSymbol, ecsEntity, { id: ownerId });

    return new ECSEntityAdapter(id, ecsEntity, this.coordinator, this.componentMapper);
  }

  /**
   * Create a game state
   */
  createGameState(entities: Entity[], activePlayer: string = '', phase: string = ''): ECSGameState {
    const state = new ECSGameState(
      this.coordinator,
      this.entityMapper,
      this.componentMapper,
      activePlayer,
      phase
    );
    
    // Ensure all entities are in the state
    for (const entity of entities) {
      state.entities.set(entity.id, entity);
    }
    
    return state;
  }

  /**
   * Get the coordinator (for advanced operations)
   */
  getCoordinator(): Coordinator {
    return this.coordinator;
  }
}
