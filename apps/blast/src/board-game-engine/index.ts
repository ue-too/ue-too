/**
 * Board Game Rule Engine - Main exports.
 *
 * A general-purpose board game rule engine built on top of ECS.
 */

// Core
export * from './core';

// Main engine
export { GameEngine } from './game-engine';
export type { GameDefinition } from './game-engine';

// Re-export key classes from systems (avoiding duplicate type exports)
export { ActionSystem } from './action-system/action-system';
export { ActionDefinition } from './action-system/action-definition';
export { ActionContext } from './action-system/action-context';
export { EventPattern } from './event-system/event-pattern';
export { EventQueue } from './event-system/event-queue';
export { EventProcessor } from './event-system/event-processor';
export { RuleEngine } from './rule-engine/rule-engine';
export { RuleContext } from './rule-engine/rule-context';
export { PhaseManager } from './phase-system/phase-manager';

// Re-export preconditions and effects
export {
  BasePrecondition,
  AndPrecondition,
  OrPrecondition,
  NotPrecondition,
  AlwaysTruePrecondition,
  AlwaysFalsePrecondition,
  CustomPrecondition,
  IsPlayerTurn,
  HasComponent,
  PhaseCheck,
} from './action-system/preconditions';
export {
  BaseEffect,
  ECSEffect,
  CompositeEffect,
  NoOpEffect,
  CustomEffect,
  EmitEvent,
} from './action-system/effects';

// Schema (JSON game definitions)
export * from './schema';

// Win Condition System
export { WinConditionEvaluator } from './win-condition-system/win-condition-evaluator';
export { WinConditionFactory } from './schema/factories/win-condition-factory';
export type { WinCondition } from './schema/factories/win-condition-factory';
export { GAME_STATUS_COMPONENT } from './core/game-state';
export type { GameStatusComponent } from './core/game-state';
