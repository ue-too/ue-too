/**
 * Win Condition Evaluator
 *
 * Evaluates win conditions from game definitions to determine if the game is over
 * and who won.
 */
import type { Entity, GameState } from '../core/types';
import { ExpressionResolver } from '../schema/expression-resolver';
import type {
    ConditionDefinition,
    ResolverContext,
    WinConditionSchema,
} from '../schema/types';

/**
 * Result of evaluating win conditions.
 */
export interface WinConditionResult {
    /** Winner entity (null if no winner yet or draw) */
    winner: Entity | null;

    /** Reason for game end */
    endReason?: string;

    /** ID of the win condition that matched */
    winConditionId?: string;
}

/**
 * Evaluates win conditions to determine if the game is over and who won.
 */
export class WinConditionEvaluator {
    private resolver: ExpressionResolver;

    constructor(resolver: ExpressionResolver) {
        this.resolver = resolver;
    }

    /**
     * Evaluate all win conditions and return the first match.
     *
     * @param state - Current game state
     * @param winConditions - Array of win conditions to evaluate
     * @param context - Optional resolver context (for entity expressions)
     * @returns Win condition result or null if no condition matches
     */
    evaluateWinConditions(
        state: GameState,
        winConditions: WinConditionSchema[],
        context?: ResolverContext
    ): WinConditionResult | null {
        // Evaluate each win condition in order (first match wins)
        for (const winCondition of winConditions) {
            // For win conditions, we need to check all players
            // Try each player as the context actor to see if condition matches
            const players = state.getAllPlayers();

            for (const player of players) {
                // Create a fresh context with this player as actor
                // Don't mutate the provided context if it exists
                const resolverContext: ResolverContext = {
                    state: context?.state ?? state,
                    actor: player,
                    targets: context?.targets ?? [],
                    parameters: context?.parameters ?? {},
                    candidate: context?.candidate,
                    eachPlayer: player,
                    effectContext: context?.effectContext,
                };

                if (
                    this.evaluateCondition(
                        winCondition.condition,
                        state,
                        resolverContext
                    )
                ) {
                    // Condition matched - determine winner
                    const winner = this.resolveWinner(
                        winCondition,
                        state,
                        resolverContext
                    );
                    const endReason =
                        winCondition.name ||
                        winCondition.description ||
                        `Win condition ${winCondition.id} met`;

                    return {
                        winner,
                        endReason,
                        winConditionId: winCondition.id,
                    };
                }
            }
        }

        // No win condition matched
        return null;
    }

    /**
     * Evaluate a single condition definition.
     */
    private evaluateCondition(
        condition: ConditionDefinition,
        state: GameState,
        context: ResolverContext
    ): boolean {
        return this.resolver.evaluateCondition(condition, context);
    }

    /**
     * Resolve the winner entity from a win condition.
     */
    private resolveWinner(
        winCondition: WinConditionSchema,
        state: GameState,
        context: ResolverContext
    ): Entity | null {
        // If winner expression is provided, resolve it
        if (winCondition.winner) {
            // Handle special cases: "actor", "opponent", "draw"
            if (typeof winCondition.winner === 'string') {
                if (winCondition.winner === 'draw') {
                    return null; // Draw means no winner
                }
                if (winCondition.winner === 'actor') {
                    return context.actor;
                }
                if (winCondition.winner === 'opponent') {
                    // Get opponent (player that is not the actor)
                    const players = state.getAllPlayers();
                    return players.find(p => p !== context.actor) ?? null;
                }
            }

            // Otherwise, resolve as entity expression
            return this.resolver.resolveEntity(winCondition.winner, context);
        }

        // If no winner expression, check for loser expression (winner is the other player)
        if (winCondition.loser) {
            const loser = this.resolver.resolveEntity(
                winCondition.loser,
                context
            );
            if (loser !== null) {
                // Winner is the player that is not the loser
                const players = state.getAllPlayers();
                return players.find(p => p !== loser) ?? null;
            }
        }

        // Default: no winner (draw)
        return null;
    }
}
