import {
  IsPlayerTurn,
  HasComponent,
  ResourceAvailable,
  EntityInZone,
  PhaseCheck,
  CustomPrecondition
} from '../../src/action-system/preconditions';
import type { ActionContext } from '../../src/action-system/types';
import { MockEntity, MockGameState } from '../../src/action-system/mocks';

describe('Preconditions', () => {
  describe('IsPlayerTurn', () => {
    it('returns true when actor is active player', () => {
      const precondition = new IsPlayerTurn();
      const state = new MockGameState([], 'player1', 'Main');
      const actor = MockEntity.createPlayer('player1');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      expect(precondition.check(context)).toBe(true);
      expect(precondition.getErrorMessage(context)).toContain('turn');
    });

    it('returns false when actor is not active player', () => {
      const precondition = new IsPlayerTurn();
      const state = new MockGameState([], 'player1', 'Main');
      const actor = MockEntity.createPlayer('player2');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player2', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      expect(precondition.check(context)).toBe(false);
      expect(precondition.getErrorMessage(context)).toContain('not');
    });
  });

  describe('HasComponent', () => {
    it('returns true when actor has component', () => {
      const precondition = new HasComponent('Card');
      const actor = MockEntity.createCard('card1', 'player1', 'hand', 5);
      
      const context: ActionContext = {
        state: new MockGameState(),
        action: { type: 'Test', actorId: 'card1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      expect(precondition.check(context)).toBe(true);
    });

    it('returns false when actor does not have component', () => {
      const precondition = new HasComponent('Card');
      const actor = MockEntity.createPlayer('player1');
      
      const context: ActionContext = {
        state: new MockGameState(),
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      expect(precondition.check(context)).toBe(false);
    });

    it('checks target entity when specified', () => {
      const precondition = new HasComponent('Health', 'target0');
      const actor = MockEntity.createPlayer('player1');
      const target = new MockEntity('target1', { Health: { current: 10, max: 10 } });
      
      const context: ActionContext = {
        state: new MockGameState(),
        action: { type: 'Test', actorId: 'player1', targetIds: ['target1'], parameters: {} },
        actor,
        targets: [target],
        parameters: {}
      };

      expect(precondition.check(context)).toBe(true);
    });
  });

  describe('ResourceAvailable', () => {
    it('returns true when actor has sufficient resources', () => {
      const precondition = new ResourceAvailable('mana', 5);
      const actor = MockEntity.createPlayer('player1', { mana: 10 });
      
      const context: ActionContext = {
        state: new MockGameState(),
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      expect(precondition.check(context)).toBe(true);
    });

    it('returns false when actor has insufficient resources', () => {
      const precondition = new ResourceAvailable('mana', 10);
      const actor = MockEntity.createPlayer('player1', { mana: 5 });
      
      const context: ActionContext = {
        state: new MockGameState(),
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      expect(precondition.check(context)).toBe(false);
      expect(precondition.getErrorMessage(context)).toContain('Insufficient');
    });

    it('supports dynamic amount calculation', () => {
      const precondition = new ResourceAvailable('mana', (ctx) => ctx.actor.get('Card')?.cost ?? 0);
      const actor = MockEntity.createCard('card1', 'player1', 'hand', 5);
      actor.components.Resources = { mana: 10 };
      
      const context: ActionContext = {
        state: new MockGameState(),
        action: { type: 'Test', actorId: 'card1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      expect(precondition.check(context)).toBe(true);
    });
  });

  describe('EntityInZone', () => {
    it('returns true when entity is in specified zone', () => {
      const precondition = new EntityInZone('hand');
      const actor = MockEntity.createCard('card1', 'player1', 'hand', 5);
      
      const context: ActionContext = {
        state: new MockGameState(),
        action: { type: 'Test', actorId: 'card1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      expect(precondition.check(context)).toBe(true);
    });

    it('returns false when entity is not in specified zone', () => {
      const precondition = new EntityInZone('board');
      const actor = MockEntity.createCard('card1', 'player1', 'hand', 5);
      
      const context: ActionContext = {
        state: new MockGameState(),
        action: { type: 'Test', actorId: 'card1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      expect(precondition.check(context)).toBe(false);
    });
  });

  describe('PhaseCheck', () => {
    it('returns true when current phase is allowed', () => {
      const precondition = new PhaseCheck(['Main', 'Combat']);
      const state = new MockGameState([], 'player1', 'Main');
      const actor = MockEntity.createPlayer('player1');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      expect(precondition.check(context)).toBe(true);
    });

    it('returns false when current phase is not allowed', () => {
      const precondition = new PhaseCheck(['Main', 'Combat']);
      const state = new MockGameState([], 'player1', 'End');
      const actor = MockEntity.createPlayer('player1');
      
      const context: ActionContext = {
        state,
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      expect(precondition.check(context)).toBe(false);
    });
  });

  describe('CustomPrecondition', () => {
    it('executes custom check function', () => {
      const precondition = new CustomPrecondition(
        (ctx) => ctx.actor.id === 'player1',
        'Actor must be player1'
      );
      const actor = MockEntity.createPlayer('player1');
      
      const context: ActionContext = {
        state: new MockGameState(),
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      expect(precondition.check(context)).toBe(true);
    });

    it('supports dynamic error messages', () => {
      const precondition = new CustomPrecondition(
        (ctx) => false,
        (ctx) => `Custom error for ${ctx.actor.id}`
      );
      const actor = MockEntity.createPlayer('player1');
      
      const context: ActionContext = {
        state: new MockGameState(),
        action: { type: 'Test', actorId: 'player1', targetIds: [], parameters: {} },
        actor,
        targets: [],
        parameters: {}
      };

      expect(precondition.getErrorMessage(context)).toBe('Custom error for player1');
    });
  });
});
