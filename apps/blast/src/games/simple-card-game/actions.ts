/**
 * Card Game Actions - All player actions for the Simple Card Game.
 *
 * Implements:
 * - DrawCard: Draw the top card from deck to hand
 * - PlayCard: Play a card from hand to the board (pays mana cost)
 * - AttackCreature: Attack an enemy creature with your creature
 * - AttackPlayer: Attack an enemy player directly with your creature
 * - ActivateAbility: Activate a card's special ability
 * - EndTurn: End your turn and pass to the next player
 */
import type { Entity } from '@ue-too/ecs';

import { ActionDefinition } from '../../board-game-engine/action-system/action-definition';
import {
    CompositeEffect,
    CustomEffect,
    EmitEvent,
} from '../../board-game-engine/action-system/effects';
import {
    CustomPrecondition,
    IsPlayerTurn,
    PhaseCheck,
} from '../../board-game-engine/action-system/preconditions';
import type {
    ActionContext,
    GameState,
} from '../../board-game-engine/core/types';
import {
    CARD_COMPONENT,
    CARD_STATE_COMPONENT,
    type CardComponent,
    type CardStateComponent,
    DECK_COMPONENT,
    LOCATION_COMPONENT,
    type LocationComponent,
    OWNER_COMPONENT,
    type OwnerComponent,
    RESOURCE_COMPONENT,
    type ResourceComponent,
    TURN_STATE_COMPONENT,
    type TurnStateComponent,
    ZONE_COMPONENT,
    type ZoneComponent,
    getOwner,
    isCard,
    isInZone,
} from './components';

/** Helper type for context with state - compatible with ActionContext */
interface StateContext {
    state: GameState;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the deck zone entity for a player.
 */
function getPlayerDeckZone(ctx: StateContext, playerId: Entity): Entity | null {
    const allEntities = ctx.state.coordinator.getAllEntities();
    for (const entity of allEntities) {
        const zoneComp =
            ctx.state.coordinator.getComponentFromEntity<ZoneComponent>(
                ZONE_COMPONENT,
                entity
            );
        if (
            zoneComp &&
            zoneComp.name === 'deck' &&
            zoneComp.owner === playerId
        ) {
            return entity;
        }
    }
    return null;
}

/**
 * Get the hand zone entity for a player.
 */
function getPlayerHandZone(ctx: StateContext, playerId: Entity): Entity | null {
    const allEntities = ctx.state.coordinator.getAllEntities();
    for (const entity of allEntities) {
        const zoneComp =
            ctx.state.coordinator.getComponentFromEntity<ZoneComponent>(
                ZONE_COMPONENT,
                entity
            );
        if (
            zoneComp &&
            zoneComp.name === 'hand' &&
            zoneComp.owner === playerId
        ) {
            return entity;
        }
    }
    return null;
}

/**
 * Get the board zone entity for a player.
 */
function getPlayerBoardZone(
    ctx: StateContext,
    playerId: Entity
): Entity | null {
    const allEntities = ctx.state.coordinator.getAllEntities();
    for (const entity of allEntities) {
        const zoneComp =
            ctx.state.coordinator.getComponentFromEntity<ZoneComponent>(
                ZONE_COMPONENT,
                entity
            );
        if (
            zoneComp &&
            zoneComp.name === 'board' &&
            zoneComp.owner === playerId
        ) {
            return entity;
        }
    }
    return null;
}

/**
 * Get all cards in a specific zone for a player.
 */
function getCardsInZone(
    ctx: StateContext,
    zoneName: string,
    playerId: Entity
): Entity[] {
    const coordinator = ctx.state.coordinator;
    const allEntities = coordinator.getAllEntities();
    const cards: Entity[] = [];

    for (const entity of allEntities) {
        // Check if it's a card
        if (!isCard(coordinator, entity)) continue;

        // Check if it's in the right zone for the right player
        if (isInZone(coordinator, entity, zoneName, playerId)) {
            cards.push(entity);
        }
    }

    return cards;
}

/**
 * Get all creatures on board that can attack (not tapped, no summoning sickness).
 */
function getAttackableCreatures(ctx: StateContext, playerId: Entity): Entity[] {
    const coordinator = ctx.state.coordinator;
    const boardCards = getCardsInZone(ctx, 'board', playerId);

    return boardCards.filter(card => {
        const cardComp = coordinator.getComponentFromEntity<CardComponent>(
            CARD_COMPONENT,
            card
        );
        const cardState =
            coordinator.getComponentFromEntity<CardStateComponent>(
                CARD_STATE_COMPONENT,
                card
            );

        // Must be a creature
        if (!cardComp || cardComp.cardType !== 'Creature') return false;

        // Must not have summoning sickness and not be tapped
        if (!cardState) return false;
        if (cardState.summoningSickness) return false;
        if (cardState.tapped) return false;

        return true;
    });
}

/**
 * Get all creatures on board that can be attacked.
 */
function getTargetableCreatures(ctx: StateContext, playerId: Entity): Entity[] {
    const coordinator = ctx.state.coordinator;
    const opponents = ctx.state.getOpponents(playerId);
    const targets: Entity[] = [];

    for (const opponent of opponents) {
        const boardCards = getCardsInZone(ctx, 'board', opponent);
        for (const card of boardCards) {
            const cardComp = coordinator.getComponentFromEntity<CardComponent>(
                CARD_COMPONENT,
                card
            );
            if (cardComp && cardComp.cardType === 'Creature') {
                targets.push(card);
            }
        }
    }

    return targets;
}

// ============================================================================
// DrawCard Action
// ============================================================================

/**
 * Draw the top card from your deck to your hand.
 */
export const drawCardAction = new ActionDefinition({
    name: 'DrawCard',
    preconditions: [
        new IsPlayerTurn(),
        new PhaseCheck(['Main']),
        // Check that player hasn't already drawn this turn
        new CustomPrecondition(ctx => {
            const turnState =
                ctx.state.coordinator.getComponentFromEntity<TurnStateComponent>(
                    TURN_STATE_COMPONENT,
                    ctx.actor
                );
            return turnState === null || !turnState.hasDrawnThisTurn;
        }, 'You have already drawn a card this turn'),
        // Check that deck is not empty
        new CustomPrecondition(ctx => {
            const deckZone = getPlayerDeckZone(ctx, ctx.actor);
            if (!deckZone) return false;

            const deckComp = ctx.state.coordinator.getComponentFromEntity<{
                cached: { entities: Entity[] };
            }>(DECK_COMPONENT, deckZone);
            return deckComp !== null && deckComp.cached.entities.length > 0;
        }, 'Your deck is empty'),
    ],
    costs: [],
    effects: [
        new CustomEffect(ctx => {
            const coordinator = ctx.state.coordinator;
            const deckZone = getPlayerDeckZone(ctx, ctx.actor);
            const handZone = getPlayerHandZone(ctx, ctx.actor);

            if (!deckZone || !handZone) return;

            // Get the top card from the deck
            const deckComp = coordinator.getComponentFromEntity<{
                cached: { entities: Entity[] };
            }>(DECK_COMPONENT, deckZone);
            if (!deckComp || deckComp.cached.entities.length === 0) return;

            // Pop the top card (last in array is top of deck)
            const cardEntity = deckComp.cached.entities.pop()!;

            // Update card's location to hand
            const locationComp =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    cardEntity
                );
            if (locationComp) {
                locationComp.location = handZone;
            }

            // Update hand deck component
            const handDeckComp = coordinator.getComponentFromEntity<{
                cached: { entities: Entity[] };
            }>(DECK_COMPONENT, handZone);
            if (handDeckComp) {
                handDeckComp.cached.entities.push(cardEntity);
            }

            // Mark that this player has drawn a card this turn
            const turnState =
                coordinator.getComponentFromEntity<TurnStateComponent>(
                    TURN_STATE_COMPONENT,
                    ctx.actor
                );
            if (turnState) {
                turnState.hasDrawnThisTurn = true;
            }
        }),
        new EmitEvent('CardDrawn', ctx => {
            const deckZone = getPlayerDeckZone(ctx, ctx.actor);
            const deckComp = ctx.state.coordinator.getComponentFromEntity<{
                cached: { entities: Entity[] };
            }>(DECK_COMPONENT, deckZone!);
            // The card was just popped, so we reference it via the action result
            return {
                playerId: ctx.actor,
                cardsRemaining: deckComp?.cached.entities.length ?? 0,
            };
        }),
    ],
    targetSelector: () => [[]], // No targets
    parameterGenerator: () => [{}],
    metadata: {
        displayName: 'Draw Card',
        description: 'Draw the top card from your deck',
    },
});

// ============================================================================
// PlayCard Action
// ============================================================================

/**
 * Play a card from your hand to the board.
 * Target: The card to play (must be in hand).
 */
export const playCardAction = new ActionDefinition({
    name: 'PlayCard',
    preconditions: [
        new IsPlayerTurn(),
        new PhaseCheck(['Main']),
        // Check target is a card
        new CustomPrecondition(ctx => {
            if (ctx.targets.length === 0) return false;
            return isCard(ctx.state.coordinator, ctx.targets[0]);
        }, 'Target must be a card'),
        // Check target is in hand
        new CustomPrecondition(ctx => {
            if (ctx.targets.length === 0) return false;
            return isInZone(
                ctx.state.coordinator,
                ctx.targets[0],
                'hand',
                ctx.actor
            );
        }, 'Card must be in your hand'),
        // Check you own the card
        new CustomPrecondition(ctx => {
            if (ctx.targets.length === 0) return false;
            const owner = getOwner(ctx.state.coordinator, ctx.targets[0]);
            return owner === ctx.actor;
        }, 'You must own the card'),
        // Check you have enough mana
        new CustomPrecondition(
            ctx => {
                if (ctx.targets.length === 0) return false;
                const cardComp =
                    ctx.state.coordinator.getComponentFromEntity<CardComponent>(
                        CARD_COMPONENT,
                        ctx.targets[0]
                    );
                const resources =
                    ctx.state.coordinator.getComponentFromEntity<ResourceComponent>(
                        RESOURCE_COMPONENT,
                        ctx.actor
                    );
                if (!cardComp || !resources) return false;
                return resources.mana >= cardComp.cost;
            },
            ctx => {
                const cardComp =
                    ctx.state.coordinator.getComponentFromEntity<CardComponent>(
                        CARD_COMPONENT,
                        ctx.targets[0]
                    );
                const resources =
                    ctx.state.coordinator.getComponentFromEntity<ResourceComponent>(
                        RESOURCE_COMPONENT,
                        ctx.actor
                    );
                return `Not enough mana (need ${cardComp?.cost ?? 0}, have ${resources?.mana ?? 0})`;
            }
        ),
    ],
    costs: [
        // Pay mana cost
        new CustomEffect(ctx => {
            const coordinator = ctx.state.coordinator;
            const cardComp = coordinator.getComponentFromEntity<CardComponent>(
                CARD_COMPONENT,
                ctx.targets[0]
            );
            const resources =
                coordinator.getComponentFromEntity<ResourceComponent>(
                    RESOURCE_COMPONENT,
                    ctx.actor
                );

            if (cardComp && resources) {
                resources.mana -= cardComp.cost;
            }
        }),
    ],
    effects: [
        new CustomEffect(ctx => {
            const coordinator = ctx.state.coordinator;
            const card = ctx.targets[0];
            const handZone = getPlayerHandZone(ctx, ctx.actor);
            const boardZone = getPlayerBoardZone(ctx, ctx.actor);

            if (!handZone || !boardZone) return;

            // Remove from hand
            const handDeckComp = coordinator.getComponentFromEntity<{
                cached: { entities: Entity[] };
            }>(DECK_COMPONENT, handZone);
            if (handDeckComp) {
                const idx = handDeckComp.cached.entities.indexOf(card);
                if (idx !== -1) {
                    handDeckComp.cached.entities.splice(idx, 1);
                }
            }

            // Update card's location to board
            const locationComp =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    card
                );
            if (locationComp) {
                locationComp.location = boardZone;
            }

            // Add to board
            const boardDeckComp = coordinator.getComponentFromEntity<{
                cached: { entities: Entity[] };
            }>(DECK_COMPONENT, boardZone);
            if (boardDeckComp) {
                boardDeckComp.cached.entities.push(card);
            }

            // Add card state if it's a creature (summoning sickness)
            const cardComp = coordinator.getComponentFromEntity<CardComponent>(
                CARD_COMPONENT,
                card
            );
            if (cardComp && cardComp.cardType === 'Creature') {
                const existingState =
                    coordinator.getComponentFromEntity<CardStateComponent>(
                        CARD_STATE_COMPONENT,
                        card
                    );
                if (!existingState) {
                    coordinator.addComponentToEntity<CardStateComponent>(
                        CARD_STATE_COMPONENT,
                        card,
                        {
                            tapped: false,
                            summoningSickness: true,
                            attacksThisTurn: 0,
                        }
                    );
                } else {
                    existingState.summoningSickness = true;
                    existingState.tapped = false;
                    existingState.attacksThisTurn = 0;
                }
            }
        }),
        new EmitEvent('CardPlayed', ctx => {
            const cardComp =
                ctx.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    ctx.targets[0]
                );
            return {
                playerId: ctx.actor,
                cardId: ctx.targets[0],
                cardName: cardComp?.name ?? 'Unknown',
                cardType: cardComp?.cardType ?? 'Unknown',
                manaCost: cardComp?.cost ?? 0,
            };
        }),
    ],
    targetSelector: (state, actor) => {
        // Get all cards in hand that the player can afford
        const coordinator = state.coordinator;
        const cardsInHand = getCardsInZone({ state }, 'hand', actor);
        const resources = coordinator.getComponentFromEntity<ResourceComponent>(
            RESOURCE_COMPONENT,
            actor
        );
        const currentMana = resources?.mana ?? 0;

        // Filter to affordable cards and return each as a separate target option
        const validTargets: Entity[][] = [];
        for (const card of cardsInHand) {
            const cardComp = coordinator.getComponentFromEntity<CardComponent>(
                CARD_COMPONENT,
                card
            );
            if (cardComp && cardComp.cost <= currentMana) {
                validTargets.push([card]);
            }
        }

        return validTargets;
    },
    parameterGenerator: () => [{}],
    metadata: {
        displayName: 'Play Card',
        description: 'Play a card from your hand to the board',
    },
});

// ============================================================================
// AttackCreature Action
// ============================================================================

/**
 * Attack an enemy creature with one of your creatures.
 * Targets: [0] Your attacking creature, [1] Enemy creature to attack
 */
export const attackCreatureAction = new ActionDefinition({
    name: 'AttackCreature',
    preconditions: [
        new IsPlayerTurn(),
        new PhaseCheck(['Main']),
        // Check we have two targets
        new CustomPrecondition(
            ctx => ctx.targets.length === 2,
            'Must select attacker and defender'
        ),
        // Check attacker is yours and on board
        new CustomPrecondition(ctx => {
            const attacker = ctx.targets[0];
            return isInZone(
                ctx.state.coordinator,
                attacker,
                'board',
                ctx.actor
            );
        }, 'Attacker must be on your board'),
        // Check attacker is a creature
        new CustomPrecondition(ctx => {
            const cardComp =
                ctx.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    ctx.targets[0]
                );
            return cardComp !== null && cardComp.cardType === 'Creature';
        }, 'Attacker must be a creature'),
        // Check attacker can attack (not tapped, no summoning sickness)
        new CustomPrecondition(ctx => {
            const cardState =
                ctx.state.coordinator.getComponentFromEntity<CardStateComponent>(
                    CARD_STATE_COMPONENT,
                    ctx.targets[0]
                );
            if (!cardState) return false;
            return !cardState.tapped && !cardState.summoningSickness;
        }, 'Creature cannot attack (tapped or has summoning sickness)'),
        // Check defender is an enemy creature on board
        new CustomPrecondition(ctx => {
            const defender = ctx.targets[1];
            const cardComp =
                ctx.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    defender
                );
            if (!cardComp || cardComp.cardType !== 'Creature') return false;

            // Check it's on an opponent's board
            const owner = getOwner(ctx.state.coordinator, defender);
            if (owner === ctx.actor) return false;

            const opponents = ctx.state.getOpponents(ctx.actor);
            return opponents.includes(owner!);
        }, 'Defender must be an enemy creature on the board'),
    ],
    costs: [],
    effects: [
        new CustomEffect(ctx => {
            const coordinator = ctx.state.coordinator;
            const attacker = ctx.targets[0];
            const defender = ctx.targets[1];

            // Get attacker and defender stats
            const attackerCard =
                coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    attacker
                );
            const defenderCard =
                coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    defender
                );
            const attackerState =
                coordinator.getComponentFromEntity<CardStateComponent>(
                    CARD_STATE_COMPONENT,
                    attacker
                );

            if (!attackerCard || !defenderCard) return;

            // Tap the attacker
            if (attackerState) {
                attackerState.tapped = true;
                attackerState.attacksThisTurn++;
            }

            // Deal damage: defender takes attacker's power as damage
            // For simplicity, reduce toughness (in a real game, you'd track damage separately)
            if (
                defenderCard.toughness !== undefined &&
                attackerCard.power !== undefined
            ) {
                defenderCard.toughness -= attackerCard.power;

                // Check if defender dies
                if (defenderCard.toughness <= 0) {
                    // Move to discard/graveyard
                    const owner = getOwner(coordinator, defender);
                    if (owner) {
                        // Find discard zone
                        const allEntities = coordinator.getAllEntities();
                        for (const entity of allEntities) {
                            const zoneComp =
                                coordinator.getComponentFromEntity<ZoneComponent>(
                                    ZONE_COMPONENT,
                                    entity
                                );
                            if (
                                zoneComp &&
                                zoneComp.name === 'discard' &&
                                zoneComp.owner === owner
                            ) {
                                const locationComp =
                                    coordinator.getComponentFromEntity<LocationComponent>(
                                        LOCATION_COMPONENT,
                                        defender
                                    );
                                if (locationComp) {
                                    // Remove from board
                                    const boardZone = getPlayerBoardZone(
                                        { state: ctx.state },
                                        owner
                                    );
                                    if (boardZone) {
                                        const boardDeckComp =
                                            coordinator.getComponentFromEntity<{
                                                cached: { entities: Entity[] };
                                            }>(DECK_COMPONENT, boardZone);
                                        if (boardDeckComp) {
                                            const idx =
                                                boardDeckComp.cached.entities.indexOf(
                                                    defender
                                                );
                                            if (idx !== -1)
                                                boardDeckComp.cached.entities.splice(
                                                    idx,
                                                    1
                                                );
                                        }
                                    }

                                    // Add to discard
                                    locationComp.location = entity;
                                    const discardDeckComp =
                                        coordinator.getComponentFromEntity<{
                                            cached: { entities: Entity[] };
                                        }>(DECK_COMPONENT, entity);
                                    if (discardDeckComp) {
                                        discardDeckComp.cached.entities.push(
                                            defender
                                        );
                                    }
                                }
                                break;
                            }
                        }
                    }
                }
            }

            // Counter-attack: attacker takes defender's power as damage
            if (
                attackerCard.toughness !== undefined &&
                defenderCard.power !== undefined
            ) {
                attackerCard.toughness -= defenderCard.power;

                // Check if attacker dies
                if (attackerCard.toughness <= 0) {
                    // Move attacker to discard/graveyard
                    const owner = getOwner(coordinator, attacker);
                    if (owner) {
                        const allEntities = coordinator.getAllEntities();
                        for (const entity of allEntities) {
                            const zoneComp =
                                coordinator.getComponentFromEntity<ZoneComponent>(
                                    ZONE_COMPONENT,
                                    entity
                                );
                            if (
                                zoneComp &&
                                zoneComp.name === 'discard' &&
                                zoneComp.owner === owner
                            ) {
                                const locationComp =
                                    coordinator.getComponentFromEntity<LocationComponent>(
                                        LOCATION_COMPONENT,
                                        attacker
                                    );
                                if (locationComp) {
                                    // Remove from board
                                    const boardZone = getPlayerBoardZone(
                                        { state: ctx.state },
                                        owner
                                    );
                                    if (boardZone) {
                                        const boardDeckComp =
                                            coordinator.getComponentFromEntity<{
                                                cached: { entities: Entity[] };
                                            }>(DECK_COMPONENT, boardZone);
                                        if (boardDeckComp) {
                                            const idx =
                                                boardDeckComp.cached.entities.indexOf(
                                                    attacker
                                                );
                                            if (idx !== -1)
                                                boardDeckComp.cached.entities.splice(
                                                    idx,
                                                    1
                                                );
                                        }
                                    }

                                    // Add to discard
                                    locationComp.location = entity;
                                    const discardDeckComp =
                                        coordinator.getComponentFromEntity<{
                                            cached: { entities: Entity[] };
                                        }>(DECK_COMPONENT, entity);
                                    if (discardDeckComp) {
                                        discardDeckComp.cached.entities.push(
                                            attacker
                                        );
                                    }
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }),
        new EmitEvent('CreatureAttacked', ctx => {
            const attackerCard =
                ctx.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    ctx.targets[0]
                );
            const defenderCard =
                ctx.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    ctx.targets[1]
                );
            return {
                attackerId: ctx.targets[0],
                defenderId: ctx.targets[1],
                attackerName: attackerCard?.name ?? 'Unknown',
                defenderName: defenderCard?.name ?? 'Unknown',
                damageDealt: attackerCard?.power ?? 0,
                damageReceived: defenderCard?.power ?? 0,
            };
        }),
    ],
    targetSelector: (state, actor) => {
        // Generate all valid attacker-defender combinations
        const attackers = getAttackableCreatures({ state }, actor);
        const defenders = getTargetableCreatures({ state }, actor);

        const combinations: Entity[][] = [];
        for (const attacker of attackers) {
            for (const defender of defenders) {
                combinations.push([attacker, defender]);
            }
        }

        return combinations;
    },
    parameterGenerator: () => [{}],
    metadata: {
        displayName: 'Attack Creature',
        description: 'Attack an enemy creature with one of your creatures',
    },
});

// ============================================================================
// AttackPlayer Action
// ============================================================================

/**
 * Attack an enemy player directly with one of your creatures.
 * Targets: [0] Your attacking creature, [1] Enemy player to attack
 */
export const attackPlayerAction = new ActionDefinition({
    name: 'AttackPlayer',
    preconditions: [
        new IsPlayerTurn(),
        new PhaseCheck(['Main']),
        // Check we have two targets
        new CustomPrecondition(
            ctx => ctx.targets.length === 2,
            'Must select attacker and target player'
        ),
        // Check attacker is yours and on board
        new CustomPrecondition(ctx => {
            const attacker = ctx.targets[0];
            return isInZone(
                ctx.state.coordinator,
                attacker,
                'board',
                ctx.actor
            );
        }, 'Attacker must be on your board'),
        // Check attacker is a creature
        new CustomPrecondition(ctx => {
            const cardComp =
                ctx.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    ctx.targets[0]
                );
            return cardComp !== null && cardComp.cardType === 'Creature';
        }, 'Attacker must be a creature'),
        // Check attacker can attack
        new CustomPrecondition(ctx => {
            const cardState =
                ctx.state.coordinator.getComponentFromEntity<CardStateComponent>(
                    CARD_STATE_COMPONENT,
                    ctx.targets[0]
                );
            if (!cardState) return false;
            return !cardState.tapped && !cardState.summoningSickness;
        }, 'Creature cannot attack (tapped or has summoning sickness)'),
        // Check target is an opponent player
        new CustomPrecondition(ctx => {
            const targetPlayer = ctx.targets[1];
            if (targetPlayer === ctx.actor) return false;
            const opponents = ctx.state.getOpponents(ctx.actor);
            return opponents.includes(targetPlayer);
        }, 'Target must be an opponent'),
    ],
    costs: [],
    effects: [
        new CustomEffect(ctx => {
            const coordinator = ctx.state.coordinator;
            const attacker = ctx.targets[0];
            const targetPlayer = ctx.targets[1];

            // Get attacker stats
            const attackerCard =
                coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    attacker
                );
            const attackerState =
                coordinator.getComponentFromEntity<CardStateComponent>(
                    CARD_STATE_COMPONENT,
                    attacker
                );
            const targetResources =
                coordinator.getComponentFromEntity<ResourceComponent>(
                    RESOURCE_COMPONENT,
                    targetPlayer
                );

            if (!attackerCard || !targetResources) return;

            // Tap the attacker
            if (attackerState) {
                attackerState.tapped = true;
                attackerState.attacksThisTurn++;
            }

            // Deal damage to player
            if (attackerCard.power !== undefined) {
                targetResources.health -= attackerCard.power;
            }
        }),
        new EmitEvent('PlayerAttacked', ctx => {
            const attackerCard =
                ctx.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    ctx.targets[0]
                );
            return {
                attackerId: ctx.targets[0],
                attackerName: attackerCard?.name ?? 'Unknown',
                targetPlayerId: ctx.targets[1],
                damageDealt: attackerCard?.power ?? 0,
            };
        }),
    ],
    targetSelector: (state, actor) => {
        // Generate all valid attacker-player combinations
        const attackers = getAttackableCreatures({ state }, actor);
        const opponents = state.getOpponents(actor);

        const combinations: Entity[][] = [];
        for (const attacker of attackers) {
            for (const opponent of opponents) {
                combinations.push([attacker, opponent]);
            }
        }

        return combinations;
    },
    parameterGenerator: () => [{}],
    metadata: {
        displayName: 'Attack Player',
        description: 'Attack an opponent directly with one of your creatures',
    },
});

// ============================================================================
// ActivateAbility Action
// ============================================================================

/**
 * Activate a card's special ability.
 * Target: The card with the ability to activate.
 * Parameters: { abilityIndex: number } - which ability to activate (for cards with multiple)
 */
export const activateAbilityAction = new ActionDefinition({
    name: 'ActivateAbility',
    preconditions: [
        new IsPlayerTurn(),
        new PhaseCheck(['Main']),
        // Check target is a card with an ability
        new CustomPrecondition(ctx => {
            if (ctx.targets.length === 0) return false;
            const cardComp =
                ctx.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    ctx.targets[0]
                );
            return cardComp !== null && cardComp.effectId !== undefined;
        }, 'Card must have an ability'),
        // Check you own the card
        new CustomPrecondition(ctx => {
            if (ctx.targets.length === 0) return false;
            const owner = getOwner(ctx.state.coordinator, ctx.targets[0]);
            return owner === ctx.actor;
        }, 'You must own the card'),
        // Check card is on board
        new CustomPrecondition(ctx => {
            if (ctx.targets.length === 0) return false;
            return isInZone(
                ctx.state.coordinator,
                ctx.targets[0],
                'board',
                ctx.actor
            );
        }, 'Card must be on the board'),
        // Check card is not tapped
        new CustomPrecondition(ctx => {
            const cardState =
                ctx.state.coordinator.getComponentFromEntity<CardStateComponent>(
                    CARD_STATE_COMPONENT,
                    ctx.targets[0]
                );
            return cardState === null || !cardState.tapped;
        }, 'Card is tapped and cannot use ability'),
    ],
    costs: [],
    effects: [
        new CustomEffect(ctx => {
            const coordinator = ctx.state.coordinator;
            const card = ctx.targets[0];

            // Tap the card (most abilities require tapping)
            let cardState =
                coordinator.getComponentFromEntity<CardStateComponent>(
                    CARD_STATE_COMPONENT,
                    card
                );
            if (!cardState) {
                coordinator.addComponentToEntity<CardStateComponent>(
                    CARD_STATE_COMPONENT,
                    card,
                    {
                        tapped: true,
                        summoningSickness: false,
                        attacksThisTurn: 0,
                    }
                );
            } else {
                cardState.tapped = true;
            }

            // The actual ability effect would be handled by the rule engine based on effectId
            // For now, we just emit the event and let rules handle it
        }),
        new EmitEvent('AbilityActivated', ctx => {
            const cardComp =
                ctx.state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    ctx.targets[0]
                );
            return {
                playerId: ctx.actor,
                cardId: ctx.targets[0],
                cardName: cardComp?.name ?? 'Unknown',
                effectId: cardComp?.effectId ?? null,
            };
        }),
    ],
    targetSelector: (state, actor) => {
        // Get all cards on board with abilities
        const boardCards = getCardsInZone({ state }, 'board', actor);
        const cardsWithAbilities: Entity[][] = [];

        for (const card of boardCards) {
            const cardComp =
                state.coordinator.getComponentFromEntity<CardComponent>(
                    CARD_COMPONENT,
                    card
                );
            const cardState =
                state.coordinator.getComponentFromEntity<CardStateComponent>(
                    CARD_STATE_COMPONENT,
                    card
                );

            // Has ability and not tapped
            if (cardComp?.effectId && (!cardState || !cardState.tapped)) {
                cardsWithAbilities.push([card]);
            }
        }

        return cardsWithAbilities;
    },
    parameterGenerator: () => [{}],
    metadata: {
        displayName: 'Activate Ability',
        description: "Activate a card's special ability",
    },
});

// ============================================================================
// EndTurn Action
// ============================================================================

/**
 * End your turn and pass to the next player.
 */
export const endTurnAction = new ActionDefinition({
    name: 'EndTurn',
    preconditions: [new IsPlayerTurn()],
    costs: [],
    effects: [
        new CustomEffect(ctx => {
            const coordinator = ctx.state.coordinator;

            // Untap all of current player's creatures
            const boardCards = getCardsInZone(ctx, 'board', ctx.actor);
            for (const card of boardCards) {
                const cardState =
                    coordinator.getComponentFromEntity<CardStateComponent>(
                        CARD_STATE_COMPONENT,
                        card
                    );
                if (cardState) {
                    cardState.tapped = false;
                    cardState.attacksThisTurn = 0;
                }
            }

            // Switch active player
            const players = ctx.state.getAllPlayers();
            const currentIndex = players.indexOf(ctx.state.activePlayer!);
            const nextIndex = (currentIndex + 1) % players.length;
            ctx.state.setActivePlayer(players[nextIndex]);

            // Increment turn if we wrapped around
            if (nextIndex === 0) {
                ctx.state.setTurnNumber(ctx.state.turnNumber + 1);
            }

            // Remove summoning sickness from new player's creatures (start of their turn)
            const newPlayerBoardCards = getCardsInZone(
                ctx,
                'board',
                players[nextIndex]
            );
            for (const card of newPlayerBoardCards) {
                const cardState =
                    coordinator.getComponentFromEntity<CardStateComponent>(
                        CARD_STATE_COMPONENT,
                        card
                    );
                if (cardState) {
                    cardState.summoningSickness = false;
                }
            }

            // Give new player 1 mana at the start of their turn (up to max)
            const newPlayerResources =
                coordinator.getComponentFromEntity<ResourceComponent>(
                    RESOURCE_COMPONENT,
                    players[nextIndex]
                );
            if (
                newPlayerResources &&
                newPlayerResources.mana < newPlayerResources.maxMana
            ) {
                newPlayerResources.mana = Math.min(
                    newPlayerResources.mana + 1,
                    newPlayerResources.maxMana
                );
            }

            // Reset hasDrawnThisTurn for the new active player
            const newPlayerTurnState =
                coordinator.getComponentFromEntity<TurnStateComponent>(
                    TURN_STATE_COMPONENT,
                    players[nextIndex]
                );
            if (newPlayerTurnState) {
                newPlayerTurnState.hasDrawnThisTurn = false;
            }
        }),
        new EmitEvent('TurnEnded', ctx => ({
            playerId: ctx.actor,
            turnNumber: ctx.state.turnNumber,
        })),
    ],
    targetSelector: () => [[]],
    parameterGenerator: () => [{}],
    metadata: {
        displayName: 'End Turn',
        description: 'End your turn and pass to the next player',
    },
});

// ============================================================================
// Export All Actions
// ============================================================================

export const cardGameActions = [
    drawCardAction,
    playCardAction,
    attackCreatureAction,
    attackPlayerAction,
    activateAbilityAction,
    endTurnAction,
];
