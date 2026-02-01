/**
 * SwitchActivePlayer Effect
 *
 * Switches the active player to the next player in rotation.
 * Emits an ActivePlayerChanged event so rules can react to the player change.
 */
import type { Entity } from '@ue-too/ecs';

import type { ActionContext, Event } from '../../core/types';
import { BaseEffect } from './base';

function generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Effect that switches the active player to the next player.
 * Emits an ActivePlayerChanged event for rules to react to.
 *
 * @example
 * ```typescript
 * const effect = new SwitchActivePlayer();
 * ```
 */
export class SwitchActivePlayer extends BaseEffect {
    private previousPlayer: Entity | null = null;
    private newPlayer: Entity | null = null;
    private turnNumber: number = 1;

    apply(context: ActionContext): void {
        const players = context.state.getAllPlayers();
        if (players.length === 0) return;

        const currentIndex = players.indexOf(context.state.activePlayer!);
        const nextIndex = (currentIndex + 1) % players.length;
        const newActivePlayer = players[nextIndex];

        // Store state for event generation
        this.previousPlayer = context.state.activePlayer;
        this.newPlayer = newActivePlayer;
        this.turnNumber = context.state.turnNumber;

        context.state.setActivePlayer(newActivePlayer);

        // Increment turn if we wrapped around
        if (nextIndex === 0) {
            context.state.setTurnNumber(context.state.turnNumber + 1);
            this.turnNumber = context.state.turnNumber;
        }
    }

    generatesEvent(): boolean {
        return true;
    }

    createEvent(context: ActionContext): Event {
        return {
            type: 'ActivePlayerChanged',
            data: {
                previousPlayerId: this.previousPlayer,
                newPlayerId: this.newPlayer,
                turnNumber: this.turnNumber,
            },
            timestamp: Date.now(),
            id: generateEventId(),
        };
    }
}
