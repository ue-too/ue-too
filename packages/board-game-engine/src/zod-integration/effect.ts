import { ComponentName, Coordinator, Entity } from '@ue-too/ecs';

import { NumberModificationEffect } from '../action-system';

/**
 * Type-safe number modification effect for typed components.
 *
 * @deprecated Use {@link NumberModificationEffect} instead, which automatically
 * handles both custom schema and typed components. This class is kept for
 * backward compatibility.
 *
 * @example
 * ```typescript
 * type HealthComponent = { health: number; maxHealth: number };
 * const effect = new NumberModificationEffect<HealthComponent>(
 *     coordinator, HEALTH_COMPONENT, entity, 'health', 25, 'subtract'
 * );
 * ```
 */
export class NumberModificationWithType<T> extends NumberModificationEffect<T> {
    constructor(
        coordinator: Coordinator,
        componentName: ComponentName,
        entity: Entity,
        valuePath: keyof T,
        amount: number,
        operation: 'add' | 'subtract' | 'set' = 'add'
    ) {
        super(coordinator, componentName, entity, valuePath, amount, operation);
    }
}
