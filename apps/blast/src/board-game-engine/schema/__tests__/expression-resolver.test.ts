/**
 * Unit tests for ExpressionResolver
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Coordinator, createGlobalComponentName } from '@ue-too/ecs';
import { ExpressionResolver } from '../expression-resolver';
import type { ResolverContext } from '../types';

describe('ExpressionResolver', () => {
  let resolver: ExpressionResolver;
  let coordinator: Coordinator;
  let mockContext: ResolverContext;

  const RESOURCE_COMPONENT = createGlobalComponentName('Resource');
  const CARD_COMPONENT = createGlobalComponentName('Card');
  const ZONE_COMPONENT = createGlobalComponentName('Zone');

  beforeEach(() => {
    coordinator = new Coordinator();
    coordinator.registerComponent(RESOURCE_COMPONENT);
    coordinator.registerComponent(CARD_COMPONENT);
    coordinator.registerComponent(ZONE_COMPONENT);

    const componentNames = new Map([
      ['Resource', RESOURCE_COMPONENT],
      ['Card', CARD_COMPONENT],
      ['Zone', ZONE_COMPONENT],
    ]);

    resolver = new ExpressionResolver(componentNames);

    // Create test entities
    const player1 = coordinator.createEntity();
    const player2 = coordinator.createEntity();
    const card1 = coordinator.createEntity();
    const handZone = coordinator.createEntity();

    coordinator.addComponentToEntity(RESOURCE_COMPONENT, player1, {
      mana: 5,
      maxMana: 10,
      health: 20,
    });

    coordinator.addComponentToEntity(CARD_COMPONENT, card1, {
      name: 'Test Card',
      cost: 3,
      cardType: 'Creature',
    });

    coordinator.addComponentToEntity(ZONE_COMPONENT, handZone, {
      name: 'hand',
      owner: player1,
    });

    mockContext = {
      state: {
        coordinator,
        activePlayer: player1,
        getAllPlayers: () => [player1, player2],
        getZone: (zoneName, owner) => {
          if (zoneName === 'hand' && owner === player1) return handZone;
          return null;
        },
      },
      actor: player1,
      targets: [card1],
      parameters: { damage: 5, cardId: card1 },
    };
  });

  describe('resolveEntity', () => {
    it('should resolve $actor', () => {
      const result = resolver.resolveEntity('$actor', mockContext);
      expect(result).toBe(mockContext.actor);
    });

    it('should resolve $target (shorthand for $target.0)', () => {
      const result = resolver.resolveEntity('$target', mockContext);
      expect(result).toBe(mockContext.targets[0]);
    });

    it('should resolve $target.0', () => {
      const result = resolver.resolveEntity('$target.0', mockContext);
      expect(result).toBe(mockContext.targets[0]);
    });

    it('should resolve $activePlayer', () => {
      const result = resolver.resolveEntity('$activePlayer', mockContext);
      expect(result).toBe(mockContext.state.activePlayer);
    });

    it('should resolve $param.cardId', () => {
      const result = resolver.resolveEntity('$param.cardId', mockContext);
      expect(result).toBe(mockContext.parameters.cardId as number);
    });

    it('should return null for invalid target index', () => {
      const result = resolver.resolveEntity('$target.5', mockContext);
      expect(result).toBeNull();
    });
  });

  describe('resolveNumber', () => {
    it('should resolve literal numbers', () => {
      const result = resolver.resolveNumber(42, mockContext);
      expect(result).toBe(42);
    });

    it('should resolve $param.damage', () => {
      const result = resolver.resolveNumber('$param.damage', mockContext);
      expect(result).toBe(5);
    });

    it('should resolve $component.$actor.Resource.mana', () => {
      const result = resolver.resolveNumber('$component.$actor.Resource.mana', mockContext);
      expect(result).toBe(5);
    });

    it('should resolve $component.$target.Card.cost', () => {
      const result = resolver.resolveNumber('$component.$target.Card.cost', mockContext);
      expect(result).toBe(3);
    });

    it('should resolve $negate', () => {
      const result = resolver.resolveNumber('$negate(3)', mockContext);
      expect(result).toBe(-3);
    });

    it('should resolve $add', () => {
      const result = resolver.resolveNumber('$add(2, 3)', mockContext);
      expect(result).toBe(5);
    });

    it('should resolve $multiply', () => {
      const result = resolver.resolveNumber('$multiply(3, 4)', mockContext);
      expect(result).toBe(12);
    });

    it('should return 0 for invalid component path', () => {
      const result = resolver.resolveNumber('$component.$actor.Invalid.prop', mockContext);
      expect(result).toBe(0);
    });
  });

  describe('resolveZone', () => {
    it('should resolve $zone.actor.hand', () => {
      const result = resolver.resolveZone('$zone.actor.hand', mockContext);
      expect(result).not.toBeNull();
    });

    it('should return null for non-existent zone', () => {
      const result = resolver.resolveZone('$zone.actor.nonexistent', mockContext);
      expect(result).toBeNull();
    });
  });

  describe('resolveValue', () => {
    it('should resolve string expressions', () => {
      const result = resolver.resolveValue<number>('$param.damage', mockContext);
      expect(result).toBe(5);
    });

    it('should pass through non-expression strings', () => {
      const result = resolver.resolveValue('regular string', mockContext);
      expect(result).toBe('regular string');
    });

    it('should pass through numbers', () => {
      const result = resolver.resolveValue(42, mockContext);
      expect(result).toBe(42);
    });

    it('should pass through booleans', () => {
      const result = resolver.resolveValue(true, mockContext);
      expect(result).toBe(true);
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate resourceCheck with >=', () => {
      const condition = {
        type: 'resourceCheck' as const,
        entity: '$actor',
        component: 'Resource',
        property: 'mana',
        operator: '>=' as const,
        value: 3,
      };
      const result = resolver.evaluateCondition(condition, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate resourceCheck with < (false case)', () => {
      const condition = {
        type: 'resourceCheck' as const,
        entity: '$actor',
        component: 'Resource',
        property: 'mana',
        operator: '<' as const,
        value: 3,
      };
      const result = resolver.evaluateCondition(condition, mockContext);
      expect(result).toBe(false);
    });

    it('should evaluate componentValueCheck', () => {
      const condition = {
        type: 'componentValueCheck' as const,
        entity: '$target',
        component: 'Card',
        property: 'cardType',
        value: 'Creature',
      };
      const result = resolver.evaluateCondition(condition, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate and condition', () => {
      const condition = {
        type: 'and' as const,
        conditions: [
          {
            type: 'resourceCheck' as const,
            entity: '$actor',
            component: 'Resource',
            property: 'mana',
            operator: '>=' as const,
            value: 3,
          },
          {
            type: 'componentValueCheck' as const,
            entity: '$target',
            component: 'Card',
            property: 'cardType',
            value: 'Creature',
          },
        ],
      };
      const result = resolver.evaluateCondition(condition, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate or condition', () => {
      const condition = {
        type: 'or' as const,
        conditions: [
          {
            type: 'resourceCheck' as const,
            entity: '$actor',
            component: 'Resource',
            property: 'mana',
            operator: '<' as const,
            value: 3,
          },
          {
            type: 'componentValueCheck' as const,
            entity: '$target',
            component: 'Card',
            property: 'cardType',
            value: 'Creature',
          },
        ],
      };
      const result = resolver.evaluateCondition(condition, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate not condition', () => {
      const condition = {
        type: 'not' as const,
        condition: {
          type: 'resourceCheck' as const,
          entity: '$actor',
          component: 'Resource',
          property: 'mana',
          operator: '<' as const,
          value: 3,
        },
      };
      const result = resolver.evaluateCondition(condition, mockContext);
      expect(result).toBe(true);
    });
  });
});
