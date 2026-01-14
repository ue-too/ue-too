import type { ActionContext, Precondition } from './types';

/**
 * Checks if the actor is the active player.
 */
export class IsPlayerTurn implements Precondition {
  check(context: ActionContext): boolean {
    return context.state.activePlayer === context.actor.id;
  }

  getErrorMessage(context: ActionContext): string {
    return `It is not ${context.actor.id}'s turn. Current active player: ${context.state.activePlayer}`;
  }
}

/**
 * Checks if an entity has a specific component.
 */
export class HasComponent implements Precondition {
  constructor(
    private componentType: string,
    private target: 'actor' | `target${number}` = 'actor'
  ) {}

  check(context: ActionContext): boolean {
    const entity = this.getTargetEntity(context);
    return entity?.has(this.componentType) ?? false;
  }

  getErrorMessage(context: ActionContext): string {
    const entity = this.getTargetEntity(context);
    const entityName = entity?.id ?? 'unknown';
    return `Entity ${entityName} does not have component ${this.componentType}`;
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
 * Checks if actor has sufficient resources.
 */
export class ResourceAvailable implements Precondition {
  constructor(
    private resourceName: string,
    private amount: number | ((context: ActionContext) => number)
  ) {}

  check(context: ActionContext): boolean {
    const requiredAmount = typeof this.amount === 'function' 
      ? this.amount(context) 
      : this.amount;
    
    const resources = context.actor.get('Resources');
    if (!resources) {
      return false;
    }
    
    const currentAmount = resources[this.resourceName] ?? 0;
    return currentAmount >= requiredAmount;
  }

  getErrorMessage(context: ActionContext): string {
    const requiredAmount = typeof this.amount === 'function' 
      ? this.amount(context) 
      : this.amount;
    
    const resources = context.actor.get('Resources');
    const currentAmount = resources?.[this.resourceName] ?? 0;
    const needed = requiredAmount - currentAmount;
    
    return `Insufficient ${this.resourceName}. Have ${currentAmount}, need ${requiredAmount} (${needed} more needed)`;
  }
}

/**
 * Checks if entity is in a specific zone.
 */
export class EntityInZone implements Precondition {
  constructor(
    private zone: string,
    private target: 'actor' | `target${number}` = 'actor'
  ) {}

  check(context: ActionContext): boolean {
    const entity = this.getTargetEntity(context);
    if (!entity) {
      return false;
    }
    
    const position = entity.get('Position');
    if (!position) {
      return false;
    }
    
    return position.zone === this.zone;
  }

  getErrorMessage(context: ActionContext): string {
    const entity = this.getTargetEntity(context);
    const entityName = entity?.id ?? 'unknown';
    return `Entity ${entityName} is not in zone ${this.zone}`;
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
 * Checks if current phase is in allowed list.
 */
export class PhaseCheck implements Precondition {
  constructor(private allowedPhases: string[]) {}

  check(context: ActionContext): boolean {
    return this.allowedPhases.includes(context.state.phase);
  }

  getErrorMessage(context: ActionContext): string {
    return `Action not allowed in phase ${context.state.phase}. Allowed phases: ${this.allowedPhases.join(', ')}`;
  }
}

/**
 * Custom precondition for game-specific conditions.
 */
export class CustomPrecondition implements Precondition {
  constructor(
    private checkFn: (context: ActionContext) => boolean,
    private errorMessage: string | ((context: ActionContext) => string)
  ) {}

  check(context: ActionContext): boolean {
    return this.checkFn(context);
  }

  getErrorMessage(context: ActionContext): string {
    return typeof this.errorMessage === 'function'
      ? this.errorMessage(context)
      : this.errorMessage;
  }
}
