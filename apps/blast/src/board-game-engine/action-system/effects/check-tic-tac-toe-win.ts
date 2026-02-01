/**
 * CheckTicTacToeWin Effect
 *
 * Checks if a player has won tic-tac-toe (3 markers in a row, column, or diagonal)
 * and sets the hasWon flag on the player's Player component.
 */
import type { ComponentName, Coordinator, Entity } from '@ue-too/ecs';
import { createGlobalComponentName } from '@ue-too/ecs';

import type { ActionContext } from '../../core/types';
import { ECSEffect } from './base';

const MARKER_COMPONENT = createGlobalComponentName('Marker');
const GRID_LOCATION_COMPONENT = createGlobalComponentName('GridLocation');
const PLAYER_COMPONENT = createGlobalComponentName('Player');

interface MarkerComponent {
    value: string;
    playerIndex: number;
}

interface GridLocationComponent {
    grid: Entity | null;
    row: number | null;
    column: number | null;
    q: number | null;
    r: number | null;
}

interface PlayerComponent {
    name?: string;
    playerNumber: number;
    hasWon?: boolean;
}

/**
 * Effect that checks for tic-tac-toe wins and sets the hasWon flag.
 */
export class CheckTicTacToeWin extends ECSEffect {
    apply(context: ActionContext): void {
        const coordinator = this.getCoordinator(context);
        const boardZone = context.state.getZone('board', null);
        if (!boardZone) return;

        // Get all markers from the board
        const allEntities = coordinator.getAllEntities();
        const markers: Array<{
            entity: Entity;
            marker: MarkerComponent;
            location: GridLocationComponent;
        }> = [];

        for (const entity of allEntities) {
            const marker = coordinator.getComponentFromEntity<MarkerComponent>(
                MARKER_COMPONENT,
                entity
            );
            const location =
                coordinator.getComponentFromEntity<GridLocationComponent>(
                    GRID_LOCATION_COMPONENT,
                    entity
                );

            if (
                marker &&
                location &&
                location.row !== null &&
                location.column !== null
            ) {
                // Check if entity is in board zone
                const locationComp = coordinator.getComponentFromEntity<{
                    location: Entity;
                }>(createGlobalComponentName('Location'), entity);
                if (locationComp && locationComp.location === boardZone) {
                    markers.push({ entity, marker, location });
                }
            }
        }

        // Check each player for wins
        const players = context.state.getAllPlayers();
        for (const player of players) {
            const playerComp =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player
                );
            if (!playerComp) continue;

            // Player numbers are 1-based (1, 2), but playerIndex in markers is 0-based (0, 1)
            // So we need to convert: playerNumber 1 -> playerIndex 0, playerNumber 2 -> playerIndex 1
            const playerNumber =
                playerComp.playerNumber ?? players.indexOf(player) + 1;
            const playerIndex = playerNumber - 1; // Convert to 0-based index
            const playerMarkers = markers.filter(
                m => m.marker.playerIndex === playerIndex
            );

            if (this.hasWon(playerMarkers)) {
                // Set hasWon flag - preserve all existing Player component properties
                const updatedPlayerComp: PlayerComponent = {
                    ...playerComp, // Preserve all existing properties
                    hasWon: true,
                };
                coordinator.addComponentToEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player,
                    updatedPlayerComp
                );
            }
        }
    }

    /**
     * Check if a player has won (3 markers in a row, column, or diagonal).
     */
    private hasWon(
        markers: Array<{ location: GridLocationComponent }>
    ): boolean {
        if (markers.length < 3) return false;

        // Create a 3x3 grid representation
        const grid: (boolean | null)[][] = [
            [null, null, null],
            [null, null, null],
            [null, null, null],
        ];

        for (const marker of markers) {
            const row = marker.location.row;
            const col = marker.location.column;
            if (
                row !== null &&
                col !== null &&
                row >= 0 &&
                row < 3 &&
                col >= 0 &&
                col < 3
            ) {
                grid[row][col] = true;
            }
        }

        // Check rows
        for (let row = 0; row < 3; row++) {
            if (grid[row][0] && grid[row][1] && grid[row][2]) {
                return true;
            }
        }

        // Check columns
        for (let col = 0; col < 3; col++) {
            if (grid[0][col] && grid[1][col] && grid[2][col]) {
                return true;
            }
        }

        // Check diagonals
        if (grid[0][0] && grid[1][1] && grid[2][2]) {
            return true;
        }
        if (grid[0][2] && grid[1][1] && grid[2][0]) {
            return true;
        }

        return false;
    }
}
