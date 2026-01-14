/**
 * Action System - A declarative framework for defining, validating, and executing game actions.
 * 
 * @packageDocumentation
 * 
 * @example
 * ```typescript
 * import { ActionSystem, ActionDefinitionImpl } from './action-system';
 * import { IsPlayerTurn, ResourceAvailable } from './action-system/preconditions';
 * import { ModifyResource, MoveEntity } from './action-system/effects';
 * 
 * const actionSystem = new ActionSystem();
 * 
 * const playCardAction = new ActionDefinitionImpl(
 *   'PlayCard',
 *   [
 *     new IsPlayerTurn(),
 *     new ResourceAvailable('mana', 5)
 *   ],
 *   [
 *     new ModifyResource('mana', -5, 'actor', 'subtract')
 *   ],
 *   [
 *     new MoveEntity('board', 'actor')
 *   ]
 * );
 * 
 * actionSystem.registerAction(playCardAction);
 * 
 * const validActions = actionSystem.getValidActions(state, 'player1');
 * const [newState, events] = actionSystem.executeAction(state, validActions[0]);
 * ```
 */

export * from './types';
export * from './preconditions';
export * from './effects';
export * from './action-definition';
export * from './action-system';
export * from './mocks';
export * from './ecs-adapter';
export * from './ecs-mocks';
