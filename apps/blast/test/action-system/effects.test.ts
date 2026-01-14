import {
  ModifyResource,
  MoveEntity,
  CreateEntity,
  DestroyEntity,
  EmitEvent,
  CompositeEffect
} from '../../src/action-system/effects';
import type { ActionContext } from '../../src/action-system/types';
import { MockEntity, MockGameState } from '../../src/action-system/mocks';

describe('Effects', () => {
  describe('ModifyResource', () => {
    it('adds resources correctly', () => {
      const effect = new ModifyResource('mana', 5, 'actor', 'add');
      const actor = MockEntity.createPlayer('player1', { mana: 10 });
      const state = new MockGameState([actor], 'player1', 'Main');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      const newState = effect.apply(context);
      const updatedActor = newState.getEntity('player1') as MockEntity;
      
      expect(updatedActor.get('Resources').mana).toBe(15);
      expect(effect.generatesEvent()).toBe(true);
      
      const event = effect.createEvent(context);
      expect(event?.type).toBe('ResourceChanged');
      expect(event?.data.resourceName).toBe('mana');
    });

    it('subtracts resources correctly with floor at 0', () => {
      const effect = new ModifyResource('mana', 3, 'actor', 'subtract');
      const actor = MockEntity.createPlayer('player1', { mana: 5 });
      const state = new MockGameState([actor], 'player1', 'Main');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      const newState = effect.apply(context);
      const updatedActor = newState.getEntity('player1') as MockEntity;
      
      expect(updatedActor.get('Resources').mana).toBe(2);
    });

    it('sets resources to exact value', () => {
      const effect = new ModifyResource('mana', 20, 'actor', 'set');
      const actor = MockEntity.createPlayer('player1', { mana: 10 });
      const state = new MockGameState([actor], 'player1', 'Main');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      const newState = effect.apply(context);
      const updatedActor = newState.getEntity('player1') as MockEntity;
      
      expect(updatedActor.get('Resources').mana).toBe(20);
    });

    it('does not mutate original state', () => {
      const effect = new ModifyResource('mana', 5, 'actor', 'add');
      const actor = MockEntity.createPlayer('player1', { mana: 10 });
      const state = new MockGameState([actor], 'player1', 'Main');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      const originalMana = actor.get('Resources').mana;
      effect.apply(context);
      
      expect(actor.get('Resources').mana).toBe(originalMana);
    });
  });

  describe('MoveEntity', () => {
    it('moves entity to new zone', () => {
      const effect = new MoveEntity('board', 'actor');
      const actor = MockEntity.createCard('card1', 'player1', 'hand', 5);
      const state = new MockGameState([actor], 'player1', 'Main');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'card1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      const newState = effect.apply(context);
      const updatedEntity = newState.getEntity('card1') as MockEntity;
      
      expect(updatedEntity.get('Position').zone).toBe('board');
      expect(effect.generatesEvent()).toBe(true);
      
      const event = effect.createEvent(context);
      expect(event?.type).toBe('EntityMoved');
      expect(event?.data.toZone).toBe('board');
    });

    it('does not mutate original state', () => {
      const effect = new MoveEntity('board', 'actor');
      const actor = MockEntity.createCard('card1', 'player1', 'hand', 5);
      const state = new MockGameState([actor], 'player1', 'Main');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'card1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      const originalZone = actor.get('Position').zone;
      effect.apply(context);
      
      expect(actor.get('Position').zone).toBe(originalZone);
    });
  });

  describe('CreateEntity', () => {
    it('creates new entity with components', () => {
      const effect = new CreateEntity(
        'Card',
        { Card: { cost: 3 }, Position: { zone: 'hand', index: 0 } },
        'actor'
      );
      const actor = MockEntity.createPlayer('player1');
      const state = new MockGameState([actor], 'player1', 'Main');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      const newState = effect.apply(context);
      
      // Should have one more entity
      expect(newState.entities.size).toBe(2);
      
      // Find the new entity
      const newEntities = Array.from(newState.entities.values())
        .filter(e => e.id !== 'player1');
      expect(newEntities.length).toBe(1);
      
      const newEntity = newEntities[0] as MockEntity;
      expect(newEntity.get('Card')).toBeDefined();
      expect(newEntity.get('Owner').id).toBe('player1');
    });

    it('generates EntityCreated event', () => {
      const effect = new CreateEntity('Card', { Card: { cost: 3 } });
      const actor = MockEntity.createPlayer('player1');
      const state = new MockGameState([actor], 'player1', 'Main');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      const event = effect.createEvent(context);
      expect(event?.type).toBe('EntityCreated');
      expect(event?.data.entityType).toBe('Card');
    });
  });

  describe('DestroyEntity', () => {
    it('removes entity from state', () => {
      const effect = new DestroyEntity('target0');
      const actor = MockEntity.createPlayer('player1');
      const target = MockEntity.createCard('card1', 'player1', 'board', 5);
      const state = new MockGameState([actor, target], 'player1', 'Main');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player1', targetIds: ['card1'], parameters: {} },
        actor,
        targets: [target],
        parameters: {}
      };

      const newState = effect.apply(context);
      
      expect(newState.entities.has('card1')).toBe(false);
      expect(newState.entities.size).toBe(1);
    });

    it('generates EntityDestroyed event', () => {
      const effect = new DestroyEntity('target0');
      const actor = MockEntity.createPlayer('player1');
      const target = MockEntity.createCard('card1', 'player1', 'board', 5);
      const state = new MockGameState([actor, target], 'player1', 'Main');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player1', targetIds: ['card1'], parameters: {} },
        actor,
        targets: [target],
        parameters: {}
      };

      const event = effect.createEvent(context);
      expect(event?.type).toBe('EntityDestroyed');
      expect(event?.data.entityId).toBe('card1');
    });
  });

  describe('EmitEvent', () => {
    it('does not modify state', () => {
      const effect = new EmitEvent('CustomEvent', { data: 'test' });
      const actor = MockEntity.createPlayer('player1');
      const state = new MockGameState([actor], 'player1', 'Main');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      const newState = effect.apply(context);
      
      expect(newState).toBe(state); // Should return same state
      expect(effect.generatesEvent()).toBe(true);
    });

    it('creates event with static data', () => {
      const effect = new EmitEvent('CustomEvent', { value: 42 });
      const actor = MockEntity.createPlayer('player1');
      const state = new MockGameState([actor], 'player1', 'Main');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      const event = effect.createEvent(context);
      expect(event?.type).toBe('CustomEvent');
      expect(event?.data.value).toBe(42);
    });

    it('creates event with dynamic data', () => {
      const effect = new EmitEvent('CustomEvent', (ctx) => ({
        actorId: ctx.actor.id,
        targetCount: ctx.targets.length
      }));
      const actor = MockEntity.createPlayer('player1');
      const target = MockEntity.createCard('card1', 'player1', 'hand', 5);
      const state = new MockGameState([actor, target], 'player1', 'Main');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player1', targetIds: ['card1'], parameters: {} },
        actor,
        targets: [target],
        parameters: {}
      };

      const event = effect.createEvent(context);
      expect(event?.type).toBe('CustomEvent');
      expect(event?.data.actorId).toBe('player1');
      expect(event?.data.targetCount).toBe(1);
    });
  });

  describe('CompositeEffect', () => {
    it('applies multiple effects sequentially', () => {
      const effect = new CompositeEffect([
        new ModifyResource('mana', 5, 'actor', 'add'),
        new ModifyResource('health', 10, 'actor', 'add')
      ]);
      const actor = MockEntity.createPlayer('player1', { mana: 10, health: 50 });
      const state = new MockGameState([actor], 'player1', 'Main');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      const newState = effect.apply(context);
      const updatedActor = newState.getEntity('player1') as MockEntity;
      
      expect(updatedActor.get('Resources').mana).toBe(15);
      expect(updatedActor.get('Resources').health).toBe(60);
    });

    it('generates event if any child effect generates event', () => {
      const effect = new CompositeEffect([
        new ModifyResource('mana', 5, 'actor', 'add'),
        new EmitEvent('TestEvent', {})
      ]);
      
      expect(effect.generatesEvent()).toBe(true);
    });
  });
});
