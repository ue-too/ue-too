/**
 * Win Condition Factory
 *
 * Converts JSON win condition schemas into evaluatable win condition objects.
 */

import type { ComponentName } from '@ue-too/ecs';
import type { WinConditionSchema } from '../types';
import { ExpressionResolver } from '../expression-resolver';

/**
 * Win condition with resolved expressions (ready for evaluation).
 * This is essentially the same as WinConditionSchema but validated.
 */
export type WinCondition = WinConditionSchema;

/**
 * Factory for creating win conditions from JSON schemas.
 */
export class WinConditionFactory {
  private componentNames: Map<string, ComponentName>;
  private resolver: ExpressionResolver;

  constructor(componentNames: Map<string, ComponentName> = new Map()) {
    this.componentNames = componentNames;
    this.resolver = new ExpressionResolver(componentNames);
  }

  /**
   * Create win conditions from JSON schemas.
   *
   * @param schemas - Array of win condition schemas from JSON
   * @returns Array of validated win conditions
   */
  createWinConditions(schemas: WinConditionSchema[]): WinCondition[] {
    return schemas.map((schema) => this.createWinCondition(schema));
  }

  /**
   * Create a single win condition from a schema.
   *
   * @param schema - Win condition schema from JSON
   * @returns Validated win condition
   */
  createWinCondition(schema: WinConditionSchema): WinCondition {
    // Validate required fields
    if (!schema.id) {
      throw new Error('Win condition must have an id');
    }

    if (!schema.condition) {
      throw new Error(`Win condition ${schema.id} must have a condition`);
    }

    // Validate winner/loser expressions if provided
    if (schema.winner) {
      this.validateEntityExpression(schema.winner, `win condition ${schema.id} winner`);
    }

    if (schema.loser) {
      this.validateEntityExpression(schema.loser, `win condition ${schema.id} loser`);
    }

    // Return the validated schema (it's already in the right format)
    return schema;
  }

  /**
   * Validate an entity expression.
   */
  private validateEntityExpression(expr: string | number, context: string): void {
    // If it's a number, it's a fixed entity ID (valid)
    if (typeof expr === 'number') {
      return;
    }

    // If it's a string, check if it's a valid expression
    if (typeof expr === 'string') {
      // Special cases: "actor", "opponent", "draw"
      if (['actor', 'opponent', 'draw'].includes(expr)) {
        return;
      }

      // Must start with $ for expressions
      if (!expr.startsWith('$')) {
        throw new Error(`Invalid entity expression in ${context}: ${expr}. Must start with $ or be a number.`);
      }

      // Basic validation - check for known expression patterns
      const validPrefixes = ['$actor', '$target', '$param', '$activePlayer', '$opponent', '$eachPlayer', '$candidate'];
      const prefix = expr.split('.')[0];
      if (!validPrefixes.includes(prefix)) {
        // Allow it anyway - might be a valid expression we don't know about
        // The ExpressionResolver will handle it at runtime
      }
    }
  }
}
