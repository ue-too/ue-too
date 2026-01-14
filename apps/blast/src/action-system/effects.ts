import type { ActionContext, Effect, Event, GameState } from './types';

/**
 * Modifies a resource on an entity.
 */
export class ModifyResource implements Effect {
  constructor(
    private resourceName: string,
    private amount: number | ((context: ActionContext) => number),
    private target: 'actor' | `target${number}` = 'actor',
    private operation: 'add' | 'subtract' | 'set' = 'add'
  ) {}

  apply(context: ActionContext): GameState {
    const entity = this.getTargetEntity(context);
    if (!entity) {
      return context.state;
    }

    const newState = context.state.clone();
    const targetEntity = newState.getEntity(entity.id);
    if (!targetEntity) {
      return newState;
    }

    const resources = targetEntity.get('Resources') ?? {};
    const currentAmount = resources[this.resourceName] ?? 0;
    const changeAmount = typeof this.amount === 'function' 
      ? this.amount(context) 
      : this.amount;

    let newAmount: number;
    switch (this.operation) {
      case 'add':
        newAmount = currentAmount + changeAmount;
        break;
      case 'subtract':
        newAmount = Math.max(0, currentAmount - Math.abs(changeAmount));
        break;
      case 'set':
        newAmount = changeAmount;
        break;
      default:
        newAmount = currentAmount;
    }

    // Update resources using ECS if available, otherwise fallback to mock behavior
    const updatedResources = { ...resources, [this.resourceName]: newAmount };
    
    // If using ECS, update through coordinator
    if ('getCoordinator' in newState) {
      const coordinator = (newState as any).getCoordinator();
      const entityMapper = (newState as any).getEntityMapper();
      const componentMapper = (newState as any).getComponentMapper();
      const ecsEntity = entityMapper.getECSEntity(entity.id);
      
      if (ecsEntity !== null) {
        const ResourcesSymbol = componentMapper.getOrCreateComponentName('Resources');
        coordinator.addComponentToEntity(ResourcesSymbol, ecsEntity, updatedResources);
      }
    } else {
      // Fallback for mock entities
      (targetEntity as any).components = {
        ...(targetEntity as any).components,
        Resources: updatedResources
      };
    }

    return newState;
  }

  generatesEvent(): boolean {
    return true;
  }

  createEvent(context: ActionContext): Event | null {
    const entity = this.getTargetEntity(context);
    const changeAmount = typeof this.amount === 'function' 
      ? this.amount(context) 
      : this.amount;
    
    return {
      type: 'ResourceChanged',
      data: {
        entityId: entity?.id,
        resourceName: this.resourceName,
        amount: changeAmount,
        operation: this.operation
      }
    };
  }

  private getTargetEntity(context: ActionContext): any {
    if (this.target === 'actor') {
      return context.actor;
    }
    const match = this.target.match(/^target(\d+)$/);
    if (match) {
      const index = parseInt(match[1], 10);
      return context.targets[index] ?? null;
    }
    return null;
  }
}

/**
 * Moves entity between zones.
 */
export class MoveEntity implements Effect {
  constructor(
    private toZone: string,
    private target: 'actor' | `target${number}` = 'actor',
    private position?: 'top' | 'bottom' | 'random' | number
  ) {}

  apply(context: ActionContext): GameState {
    const entity = this.getTargetEntity(context);
    if (!entity) {
      return context.state;
    }

    const newState = context.state.clone();
    const targetEntity = newState.getEntity(entity.id);
    if (!targetEntity) {
      return newState;
    }

    // Update position component
    const currentPosition = targetEntity.get('Position') ?? { zone: '', index: 0 };
    const newPosition = {
      ...currentPosition,
      zone: this.toZone,
      index: this.getPositionIndex(currentPosition.index)
    };

    // If using ECS, update through coordinator
    if ('getCoordinator' in newState) {
      const coordinator = (newState as any).getCoordinator();
      const entityMapper = (newState as any).getEntityMapper();
      const componentMapper = (newState as any).getComponentMapper();
      const ecsEntity = entityMapper.getECSEntity(entity.id);
      
      if (ecsEntity !== null) {
        const PositionSymbol = componentMapper.getOrCreateComponentName('Position');
        coordinator.addComponentToEntity(PositionSymbol, ecsEntity, newPosition);
      }
    } else {
      // Fallback for mock entities
      (targetEntity as any).components = {
        ...(targetEntity as any).components,
        Position: newPosition
      };
    }

    return newState;
  }

  generatesEvent(): boolean {
    return true;
  }

  createEvent(context: ActionContext): Event | null {
    const entity = this.getTargetEntity(context);
    const fromZone = entity?.get('Position')?.zone ?? 'unknown';
    
    return {
      type: 'EntityMoved',
      data: {
        entityId: entity?.id,
        fromZone,
        toZone: this.toZone
      }
    };
  }

  private getTargetEntity(context: ActionContext): any {
    if (this.target === 'actor') {
      return context.actor;
    }
    const match = this.target.match(/^target(\d+)$/);
    if (match) {
      const index = parseInt(match[1], 10);
      return context.targets[index] ?? null;
    }
    return null;
  }

  private getPositionIndex(currentIndex: number): number {
    if (this.position === 'top') {
      return 0;
    }
    if (this.position === 'bottom') {
      return 999; // Place at end
    }
    if (typeof this.position === 'number') {
      return this.position;
    }
    return currentIndex;
  }
}

/**
 * Creates a new entity in the game.
 */
export class CreateEntity implements Effect {
  constructor(
    private entityType: string,
    private components: Record<string, any>,
    private owner?: 'actor' | `target${number}` | string
  ) {}

  apply(context: ActionContext): GameState {
    const newState = context.state.clone();
    
    // Generate entity ID
    const entityId = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine owner
    let ownerId: string;
    if (this.owner === 'actor') {
      ownerId = context.actor.id;
    } else if (this.owner?.startsWith('target')) {
      const match = this.owner.match(/^target(\d+)$/);
      if (match) {
        const index = parseInt(match[1], 10);
        ownerId = context.targets[index]?.id ?? context.actor.id;
      } else {
        ownerId = context.actor.id;
      }
    } else {
      ownerId = this.owner ?? context.actor.id;
    }

    // If using ECS, create entity through coordinator
    if ('getCoordinator' in newState) {
      const coordinator = (newState as any).getCoordinator();
      const entityMapper = (newState as any).getEntityMapper();
      const componentMapper = (newState as any).getComponentMapper();
      
      const ecsEntity = entityMapper.getOrCreateEntity(entityId, coordinator);
      
      // Add all components
      for (const [compName, compData] of Object.entries(this.components)) {
        const symbol = componentMapper.getOrCreateComponentName(compName);
        if (coordinator.getComponentType(symbol) === null) {
          coordinator.registerComponent(symbol);
        }
        coordinator.addComponentToEntity(symbol, ecsEntity, compData);
      }
      
      // Add Owner component
      const OwnerSymbol = componentMapper.getOrCreateComponentName('Owner');
      if (coordinator.getComponentType(OwnerSymbol) === null) {
        coordinator.registerComponent(OwnerSymbol);
      }
      coordinator.addComponentToEntity(OwnerSymbol, ecsEntity, { id: ownerId });
      
      // Refresh entity map
      newState.entities.set(entityId, newState.getEntity(entityId)!);
    } else {
      // Fallback for mock entities
      const entity: any = {
        id: entityId,
        components: {
          ...this.components,
          Owner: { id: ownerId }
        },
        get(componentName: string) {
          return this.components[componentName] ?? null;
        },
        has(componentName: string) {
          return componentName in this.components;
        }
      };
      newState.entities.set(entityId, entity);
    }

    return newState;
  }

  generatesEvent(): boolean {
    return true;
  }

  createEvent(context: ActionContext): Event | null {
    // Entity ID will be determined during apply, so we'll need to track it
    // For now, return a generic event
    return {
      type: 'EntityCreated',
      data: {
        entityType: this.entityType,
        owner: this.owner
      }
    };
  }
}

/**
 * Removes an entity from the game completely.
 */
export class DestroyEntity implements Effect {
  constructor(private target: 'actor' | `target${number}` = 'target0') {}

  apply(context: ActionContext): GameState {
    const entity = this.getTargetEntity(context);
    if (!entity) {
      return context.state;
    }

    const newState = context.state.clone();
    
    // If using ECS, destroy through coordinator
    if ('getCoordinator' in newState) {
      const coordinator = (newState as any).getCoordinator();
      const entityMapper = (newState as any).getEntityMapper();
      const ecsEntity = entityMapper.getECSEntity(entity.id);
      
      if (ecsEntity !== null) {
        coordinator.destroyEntity(ecsEntity);
        entityMapper.removeMapping(entity.id);
      }
    }
    
    newState.entities.delete(entity.id);

    return newState;
  }

  generatesEvent(): boolean {
    return true;
  }

  createEvent(context: ActionContext): Event | null {
    const entity = this.getTargetEntity(context);
    
    return {
      type: 'EntityDestroyed',
      data: {
        entityId: entity?.id
      }
    };
  }

  private getTargetEntity(context: ActionContext): any {
    if (this.target === 'actor') {
      return context.actor;
    }
    const match = this.target.match(/^target(\d+)$/);
    if (match) {
      const index = parseInt(match[1], 10);
      return context.targets[index] ?? null;
    }
    return null;
  }
}

/**
 * Explicitly emits an event without modifying state.
 */
export class EmitEvent implements Effect {
  constructor(
    private eventType: string,
    private data: Record<string, any> | ((context: ActionContext) => Record<string, any>)
  ) {}

  apply(context: ActionContext): GameState {
    // No state change
    return context.state;
  }

  generatesEvent(): boolean {
    return true;
  }

  createEvent(context: ActionContext): Event {
    const eventData = typeof this.data === 'function'
      ? this.data(context)
      : this.data;

    return {
      type: this.eventType,
      data: eventData
    };
  }
}

/**
 * Chains multiple effects together.
 */
export class CompositeEffect implements Effect {
  constructor(private effects: Effect[]) {}

  apply(context: ActionContext): GameState {
    let currentState = context.state;
    for (const effect of this.effects) {
      const newContext = { ...context, state: currentState };
      currentState = effect.apply(newContext);
    }
    return currentState;
  }

  generatesEvent(): boolean {
    return this.effects.some(effect => effect.generatesEvent());
  }

  createEvent(context: ActionContext): Event | null {
    // Composite effects don't generate a single event
    // Events from child effects should be collected separately
    return null;
  }
}
