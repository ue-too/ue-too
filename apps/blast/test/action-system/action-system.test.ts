import { ActionSystem } from '../../src/action-system/action-system';
import { ActionDefinitionImpl } from '../../src/action-system/action-definition';
import {
  IsPlayerTurn,
  HasComponent,
  ResourceAvailable,
  EntityInZone,
  PhaseCheck
} from '../../src/action-system/preconditions';
import {
  ModifyResource,
  MoveEntity,
  EmitEvent
} from '../../src/action-system/effects';
import { MockEntity, MockGameState } from '../../src/action-system/mocks';
import type { Action } from '../../src/action-system/types';
import { createActionType } from '../../src/action-system/types';

describe('ActionSystem', () => {
  let actionSystem: ActionSystem;
  let player1: MockEntity;
  let player2: MockEntity;
  let card1: MockEntity;
  let state: MockGameState;

  beforeEach(() => {
    actionSystem = new ActionSystem();
    player1 = MockEntity.createPlayer('player1', { mana: 10 });
    player2 = MockEntity.createPlayer('player2', { mana: 10 });
    card1 = MockEntity.createCard('card1', 'player1', 'hand', 5);
    state = new MockGameState([player1, player2, card1], 'player1', 'Main');
  });

  describe('registration', () => {
    it('registers action definitions', () => {
      const TestAction = createActionType('TestAction');
      const definition = new ActionDefinitionImpl(
        TestAction,
        'TestAction',
        [],
        [],
        []
      );

      actionSystem.registerAction(definition);
      expect(actionSystem.getDefinition(TestAction)).toBe(definition);
    });

    it('throws when registering duplicate action type', () => {
      const TestAction = createActionType('TestAction');
      const definition1 = new ActionDefinitionImpl(TestAction, 'TestAction', [], [], []);
      const definition2 = new ActionDefinitionImpl(TestAction, 'TestAction', [], [], []);

      actionSystem.registerAction(definition1);
      expect(() => actionSystem.registerAction(definition2)).toThrow();
    });

    it('unregisters action definitions', () => {
      const TestAction = createActionType('TestAction');
      const definition = new ActionDefinitionImpl(TestAction, 'TestAction', [], [], []);
      actionSystem.registerAction(definition);
      actionSystem.unregisterAction(TestAction);
      expect(actionSystem.getDefinition(TestAction)).toBeNull();
    });
  });

  describe('validation', () => {
    it('validates valid actions', () => {
      const PlayCard = createActionType('PlayCard');
      const definition = new ActionDefinitionImpl(
        PlayCard,
        'PlayCard',
        [
          new IsPlayerTurn(),
          new ResourceAvailable('mana', 5)
        ],
        [],
        []
      );
      actionSystem.registerAction(definition);

      const action: Action = {
        type: PlayCard,
        actorId: 'player1',
        targetIds: [],
        parameters: {}
      };

      const [isValid, errorMessage] = actionSystem.validateAction(state, action);
      expect(isValid).toBe(true);
      expect(errorMessage).toBeNull();
    });

    it('rejects invalid actions', () => {
      const PlayCard = createActionType('PlayCard');
      const definition = new ActionDefinitionImpl(
        PlayCard,
        'PlayCard',
        [
          new IsPlayerTurn(),
          new ResourceAvailable('mana', 20) // Not enough mana
        ],
        [],
        []
      );
      actionSystem.registerAction(definition);

      const action: Action = {
        type: PlayCard,
        actorId: 'player1',
        targetIds: [],
        parameters: {}
      };

      const [isValid, errorMessage] = actionSystem.validateAction(state, action);
      expect(isValid).toBe(false);
      expect(errorMessage).toContain('Insufficient');
    });

    it('rejects unknown action types', () => {
      const UnknownAction = createActionType('UnknownAction');
      const action: Action = {
        type: UnknownAction,
        actorId: 'player1',
        targetIds: [],
        parameters: {}
      };

      const [isValid, errorMessage] = actionSystem.validateAction(state, action);
      expect(isValid).toBe(false);
      expect(errorMessage).toContain('Unknown action type');
    });
  });

  describe('execution', () => {
    it('executes valid actions', () => {
      const ModifyMana = createActionType('ModifyMana');
      const definition = new ActionDefinitionImpl(
        ModifyMana,
        'ModifyMana',
        [new IsPlayerTurn()],
        [new ModifyResource('mana', -5, 'actor', 'subtract')],
        [
          new ModifyResource('mana', 1, 'actor', 'add'),
          new EmitEvent('ActionDone', {})
        ]
      );
      actionSystem.registerAction(definition);

      const action: Action = {
        type: ModifyMana,
        actorId: 'player1',
        targetIds: [],
        parameters: {}
      };

      const [newState, events] = actionSystem.executeAction(state, action);

      // Check state changes - should have paid 5, then got 1 back = net -4
      const updatedPlayer = newState.getEntity('player1') as MockEntity;
      expect(updatedPlayer.get('Resources').mana).toBe(6);

      // Check events
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'ActionExecuted')).toBe(true);
      expect(events.some(e => e.type === 'ActionDone')).toBe(true);
      expect(events.some(e => e.type === 'ResourceChanged')).toBe(true);
    });

    it('does not mutate original state', () => {
      const ModifyMana = createActionType('ModifyMana');
      const definition = new ActionDefinitionImpl(
        ModifyMana,
        'ModifyMana',
        [new IsPlayerTurn()],
        [],
        [new ModifyResource('mana', 5, 'actor', 'add')]
      );
      actionSystem.registerAction(definition);

      const action: Action = {
        type: ModifyMana,
        actorId: 'player1',
        targetIds: [],
        parameters: {}
      };

      const originalMana = (state.getEntity('player1') as MockEntity).get('Resources').mana;
      actionSystem.executeAction(state, action);
      const unchangedMana = (state.getEntity('player1') as MockEntity).get('Resources').mana;

      expect(unchangedMana).toBe(originalMana);
    });

    it('throws when executing invalid action', () => {
      const PlayCard = createActionType('PlayCard');
      const definition = new ActionDefinitionImpl(
        PlayCard,
        'PlayCard',
        [new IsPlayerTurn(), new ResourceAvailable('mana', 100)],
        [],
        []
      );
      actionSystem.registerAction(definition);

      const action: Action = {
        type: PlayCard,
        actorId: 'player1',
        targetIds: [],
        parameters: {}
      };

      expect(() => actionSystem.executeAction(state, action)).toThrow();
    });
  });

  describe('getValidActions', () => {
    it('returns valid actions for player', () => {
      const SimpleAction = createActionType('SimpleAction');
      const definition = new ActionDefinitionImpl(
        SimpleAction,
        'SimpleAction',
        [
          new IsPlayerTurn()
        ],
        [],
        []
      );
      actionSystem.registerAction(definition);

      const validActions = actionSystem.getValidActions(state, 'player1');

      expect(validActions.length).toBeGreaterThan(0);
      expect(validActions[0].type).toBe(SimpleAction);
      expect(validActions[0].actorId).toBe('player1');
    });

    it('returns empty array when no valid actions', () => {
      const PlayCard = createActionType('PlayCard');
      const definition = new ActionDefinitionImpl(
        PlayCard,
        'PlayCard',
        [
          new IsPlayerTurn(),
          new ResourceAvailable('mana', 100) // Too expensive
        ],
        [],
        []
      );
      actionSystem.registerAction(definition);

      const validActions = actionSystem.getValidActions(state, 'player1');

      expect(validActions.length).toBe(0);
    });

    it('filters actions by phase', () => {
      const MainPhaseAction = createActionType('MainPhaseAction');
      const definition = new ActionDefinitionImpl(
        MainPhaseAction,
        'MainPhaseAction',
        [
          new IsPlayerTurn(),
          new PhaseCheck(['Main'])
        ],
        [],
        []
      );
      actionSystem.registerAction(definition);

      const mainState = new MockGameState([player1], 'player1', 'Main');
      const combatState = new MockGameState([player1], 'player1', 'Combat');

      const mainActions = actionSystem.getValidActions(mainState, 'player1');
      const combatActions = actionSystem.getValidActions(combatState, 'player1');

      expect(mainActions.length).toBeGreaterThan(0);
      expect(combatActions.length).toBe(0);
    });

    it('handles actions with multiple target combinations', () => {
      const card2 = MockEntity.createCard('card2', 'player1', 'hand', 3);
      const multiState = new MockGameState([player1, card1, card2], 'player1', 'Main');

      const TargetAction = createActionType('TargetAction');
      const definition = new ActionDefinitionImpl(
        TargetAction,
        'TargetAction',
        [
          new IsPlayerTurn()
        ],
        [],
        []
      );
      definition.targetSelector = (state, actor) => {
        const cards = state.query(`zone == 'hand'`);
        return cards.map(card => [card]);
      };
      actionSystem.registerAction(definition);

      const validActions = actionSystem.getValidActions(multiState, 'player1');

      // Should have actions targeting both cards
      expect(validActions.length).toBeGreaterThan(0);
      expect(validActions.some(a => a.targetIds.includes('card1'))).toBe(true);
      expect(validActions.some(a => a.targetIds.includes('card2'))).toBe(true);
    });
  });

  describe('action lifecycle', () => {
    it('applies costs before effects', () => {
      const PlayCard = createActionType('PlayCard');
      const definition = new ActionDefinitionImpl(
        PlayCard,
        'PlayCard',
        [
          new IsPlayerTurn(),
          new ResourceAvailable('mana', 5)
        ],
        [
          new ModifyResource('mana', -5, 'actor', 'subtract')
        ],
        [
          new ModifyResource('mana', 1, 'actor', 'add') // Refund 1 mana
        ]
      );
      actionSystem.registerAction(definition);

      const action: Action = {
        type: PlayCard,
        actorId: 'player1',
        targetIds: [],
        parameters: {}
      };

      const [newState] = actionSystem.executeAction(state, action);
      const updatedPlayer = newState.getEntity('player1') as MockEntity;

      // Should have paid 5, then got 1 back = net -4
      expect(updatedPlayer.get('Resources').mana).toBe(6);
    });

    it('generates events from both costs and effects', () => {
      const TestAction = createActionType('TestAction');
      const definition = new ActionDefinitionImpl(
        TestAction,
        'TestAction',
        [new IsPlayerTurn()],
        [
          new ModifyResource('mana', -2, 'actor', 'subtract')
        ],
        [
          new ModifyResource('health', 10, 'actor', 'add'),
          new EmitEvent('CustomEvent', {})
        ]
      );
      actionSystem.registerAction(definition);

      const action: Action = {
        type: TestAction,
        actorId: 'player1',
        targetIds: [],
        parameters: {}
      };

      const [, events] = actionSystem.executeAction(state, action);

      // Should have events from cost, effects, and ActionExecuted
      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toContain('ResourceChanged'); // From cost
      expect(eventTypes).toContain('ResourceChanged'); // From effect
      expect(eventTypes).toContain('CustomEvent');
      expect(eventTypes).toContain('ActionExecuted');
    });
  });
});
