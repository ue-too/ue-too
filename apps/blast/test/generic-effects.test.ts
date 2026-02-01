/**
 * Unit Tests for Generic Effects Library
 *
 * Tests the configurable, reusable effects.
 */
import { Coordinator, Entity, createGlobalComponentName } from '@ue-too/ecs';

import { ActionContext as ActionContextImpl } from '../src/board-game-engine/action-system/action-context';
import { NoOpEffect } from '../src/board-game-engine/action-system/effects/base';
import {
    ConditionalEffect,
    CreateEntity,
    DestroyEntity,
    EntityResolvers,
    ModifyResource,
    MoveEntity,
    RepeatEffect,
    SetComponentValue,
    ShuffleZone,
    TransferMultiple,
} from '../src/board-game-engine/action-system/effects/generic';
import {
    GameState,
    PLAYER_COMPONENT,
    ZONE_COMPONENT,
} from '../src/board-game-engine/core/game-state';
import type {
    PlayerComponent,
    ZoneComponent,
} from '../src/board-game-engine/core/game-state';
import type { Action } from '../src/board-game-engine/core/types';

// ============================================================================
// Test Components
// ============================================================================

const RESOURCE_COMPONENT = createGlobalComponentName('TestResource');
const LOCATION_COMPONENT = createGlobalComponentName('TestLocation');
const DECK_COMPONENT = createGlobalComponentName('TestDeck');
const CARD_COMPONENT = createGlobalComponentName('TestCard');

interface ResourceComponent {
    mana: number;
    maxMana: number;
    health: number;
    maxHealth: number;
}

interface LocationComponent {
    location: Entity;
    sortIndex: number;
}

interface DeckComponent {
    cached: { entities: Entity[] };
}

interface CardComponent {
    name: string;
    tapped: boolean;
}

// ============================================================================
// Test Helpers
// ============================================================================

function createTestState(): {
    state: GameState;
    player1: Entity;
    zone1: Entity;
    zone2: Entity;
} {
    const coordinator = new Coordinator();

    // Register components
    coordinator.registerComponent<PlayerComponent>(PLAYER_COMPONENT);
    coordinator.registerComponent<ZoneComponent>(ZONE_COMPONENT);
    coordinator.registerComponent<ResourceComponent>(RESOURCE_COMPONENT);
    coordinator.registerComponent<LocationComponent>(LOCATION_COMPONENT);
    coordinator.registerComponent<DeckComponent>(DECK_COMPONENT);
    coordinator.registerComponent<CardComponent>(CARD_COMPONENT);

    const state = new GameState(coordinator);

    // Create player
    const player1 = coordinator.createEntity();
    coordinator.addComponentToEntity<PlayerComponent>(
        PLAYER_COMPONENT,
        player1,
        {
            name: 'Player 1',
            playerNumber: 0,
        }
    );
    coordinator.addComponentToEntity<ResourceComponent>(
        RESOURCE_COMPONENT,
        player1,
        {
            mana: 5,
            maxMana: 10,
            health: 20,
            maxHealth: 20,
        }
    );

    // Create zones
    const zone1 = coordinator.createEntity();
    coordinator.addComponentToEntity<ZoneComponent>(ZONE_COMPONENT, zone1, {
        name: 'zone1',
        owner: player1,
        visibility: 'public',
    });
    coordinator.addComponentToEntity<DeckComponent>(DECK_COMPONENT, zone1, {
        cached: { entities: [] },
    });

    const zone2 = coordinator.createEntity();
    coordinator.addComponentToEntity<ZoneComponent>(ZONE_COMPONENT, zone2, {
        name: 'zone2',
        owner: player1,
        visibility: 'public',
    });
    coordinator.addComponentToEntity<DeckComponent>(DECK_COMPONENT, zone2, {
        cached: { entities: [] },
    });

    // Set initial state
    state.setCurrentPhase('Main');
    state.setTurnNumber(1);
    state.setActivePlayer(player1);

    return { state, player1, zone1, zone2 };
}

function createCard(
    coordinator: Coordinator,
    zone: Entity,
    name: string = 'Test Card'
): Entity {
    const card = coordinator.createEntity();

    coordinator.addComponentToEntity<CardComponent>(CARD_COMPONENT, card, {
        name,
        tapped: false,
    });

    coordinator.addComponentToEntity<LocationComponent>(
        LOCATION_COMPONENT,
        card,
        {
            location: zone,
            sortIndex: 0,
        }
    );

    // Add to zone's deck
    const deckComp = coordinator.getComponentFromEntity<DeckComponent>(
        DECK_COMPONENT,
        zone
    );
    if (deckComp) {
        deckComp.cached.entities.push(card);
    }

    return card;
}

function createContext(
    state: GameState,
    actor: Entity,
    targets: Entity[] = [],
    parameters: Record<string, any> = {}
): ActionContextImpl {
    const action: Action = {
        type: 'TestAction',
        actorId: actor,
        targetIds: targets,
        parameters,
    };

    return new ActionContextImpl(state, action, actor, targets, parameters);
}

// ============================================================================
// MoveEntity Tests
// ============================================================================

describe('MoveEntity Effect', () => {
    it('should move entity from one zone to another', () => {
        const { state, player1, zone1, zone2 } = createTestState();
        const coordinator = state.coordinator;

        // Create a card in zone1
        const card = createCard(coordinator, zone1, 'Moving Card');

        // Create effect
        const effect = new MoveEntity({
            entity: EntityResolvers.target,
            toZone: _ctx => zone2,
            locationComponent: LOCATION_COMPONENT,
            zoneListComponent: DECK_COMPONENT,
        });

        // Create context with card as target
        const ctx = createContext(state, player1, [card]);

        // Apply effect
        effect.apply(ctx);

        // Verify card moved
        const locationComp =
            coordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT,
                card
            );
        expect(locationComp?.location).toBe(zone2);

        // Verify zone caches updated
        const zone1Deck = coordinator.getComponentFromEntity<DeckComponent>(
            DECK_COMPONENT,
            zone1
        );
        const zone2Deck = coordinator.getComponentFromEntity<DeckComponent>(
            DECK_COMPONENT,
            zone2
        );
        expect(zone1Deck?.cached.entities).not.toContain(card);
        expect(zone2Deck?.cached.entities).toContain(card);
    });

    it('should generate event when configured', () => {
        const { state, player1, zone1, zone2 } = createTestState();
        const coordinator = state.coordinator;

        const card = createCard(coordinator, zone1);

        const effect = new MoveEntity({
            entity: EntityResolvers.target,
            toZone: _ctx => zone2,
            locationComponent: LOCATION_COMPONENT,
            eventType: 'EntityMoved',
        });

        const ctx = createContext(state, player1, [card]);

        expect(effect.generatesEvent()).toBe(true);

        const event = effect.createEvent(ctx);
        expect(event).not.toBeNull();
        expect(event?.type).toBe('EntityMoved');
        expect(event?.data.entityId).toBe(card);
        expect(event?.data.toZoneId).toBe(zone2);
    });
});

// ============================================================================
// ModifyResource Tests
// ============================================================================

describe('ModifyResource Effect', () => {
    it('should add to a resource', () => {
        const { state, player1 } = createTestState();
        const coordinator = state.coordinator;

        const effect = new ModifyResource({
            entity: EntityResolvers.actor,
            componentName: RESOURCE_COMPONENT,
            property: 'mana',
            amount: 3,
        });

        const ctx = createContext(state, player1);
        effect.apply(ctx);

        const resource = coordinator.getComponentFromEntity<ResourceComponent>(
            RESOURCE_COMPONENT,
            player1
        );
        expect(resource?.mana).toBe(8); // 5 + 3
    });

    it('should subtract from a resource', () => {
        const { state, player1 } = createTestState();
        const coordinator = state.coordinator;

        const effect = new ModifyResource({
            entity: EntityResolvers.actor,
            componentName: RESOURCE_COMPONENT,
            property: 'mana',
            amount: -2,
        });

        const ctx = createContext(state, player1);
        effect.apply(ctx);

        const resource = coordinator.getComponentFromEntity<ResourceComponent>(
            RESOURCE_COMPONENT,
            player1
        );
        expect(resource?.mana).toBe(3); // 5 - 2
    });

    it('should clamp to min value', () => {
        const { state, player1 } = createTestState();
        const coordinator = state.coordinator;

        const effect = new ModifyResource({
            entity: EntityResolvers.actor,
            componentName: RESOURCE_COMPONENT,
            property: 'mana',
            amount: -100,
            min: 0,
        });

        const ctx = createContext(state, player1);
        effect.apply(ctx);

        const resource = coordinator.getComponentFromEntity<ResourceComponent>(
            RESOURCE_COMPONENT,
            player1
        );
        expect(resource?.mana).toBe(0); // Clamped to 0
    });

    it('should clamp to max property', () => {
        const { state, player1 } = createTestState();
        const coordinator = state.coordinator;

        const effect = new ModifyResource({
            entity: EntityResolvers.actor,
            componentName: RESOURCE_COMPONENT,
            property: 'mana',
            amount: 100,
            maxProperty: 'maxMana',
        });

        const ctx = createContext(state, player1);
        effect.apply(ctx);

        const resource = coordinator.getComponentFromEntity<ResourceComponent>(
            RESOURCE_COMPONENT,
            player1
        );
        expect(resource?.mana).toBe(10); // Clamped to maxMana (10)
    });

    it('should use number resolver for amount', () => {
        const { state, player1 } = createTestState();
        const coordinator = state.coordinator;

        const effect = new ModifyResource({
            entity: EntityResolvers.actor,
            componentName: RESOURCE_COMPONENT,
            property: 'health',
            amount: ctx => ctx.parameters.damage,
        });

        const ctx = createContext(state, player1, [], { damage: -5 });
        effect.apply(ctx);

        const resource = coordinator.getComponentFromEntity<ResourceComponent>(
            RESOURCE_COMPONENT,
            player1
        );
        expect(resource?.health).toBe(15); // 20 - 5
    });
});

// ============================================================================
// SetComponentValue Tests
// ============================================================================

describe('SetComponentValue Effect', () => {
    it('should set a component property to a fixed value', () => {
        const { state, player1, zone1 } = createTestState();
        const coordinator = state.coordinator;

        const card = createCard(coordinator, zone1);

        const effect = new SetComponentValue({
            entity: EntityResolvers.target,
            componentName: CARD_COMPONENT,
            property: 'tapped',
            value: true,
        });

        const ctx = createContext(state, player1, [card]);
        effect.apply(ctx);

        const cardComp = coordinator.getComponentFromEntity<CardComponent>(
            CARD_COMPONENT,
            card
        );
        expect(cardComp?.tapped).toBe(true);
    });

    it('should use value resolver', () => {
        const { state, player1, zone1 } = createTestState();
        const coordinator = state.coordinator;

        const card = createCard(coordinator, zone1);

        const effect = new SetComponentValue({
            entity: EntityResolvers.target,
            componentName: CARD_COMPONENT,
            property: 'name',
            value: ctx => `Renamed by ${ctx.actor}`,
        });

        const ctx = createContext(state, player1, [card]);
        effect.apply(ctx);

        const cardComp = coordinator.getComponentFromEntity<CardComponent>(
            CARD_COMPONENT,
            card
        );
        expect(cardComp?.name).toBe(`Renamed by ${player1}`);
    });
});

// ============================================================================
// ShuffleZone Tests
// ============================================================================

describe('ShuffleZone Effect', () => {
    it('should shuffle entities in a zone', () => {
        const { state, player1, zone1 } = createTestState();
        const coordinator = state.coordinator;

        // Create multiple cards
        const cards: Entity[] = [];
        for (let i = 0; i < 10; i++) {
            cards.push(createCard(coordinator, zone1, `Card ${i}`));
        }

        // Get initial order
        const deckBefore = coordinator.getComponentFromEntity<DeckComponent>(
            DECK_COMPONENT,
            zone1
        );
        const orderBefore = [...deckBefore!.cached.entities];

        // Apply shuffle multiple times to ensure it actually shuffles
        const effect = new ShuffleZone({
            zone: _ctx => zone1,
            zoneListComponent: DECK_COMPONENT,
        });

        const ctx = createContext(state, player1);

        // Shuffle several times
        for (let i = 0; i < 5; i++) {
            effect.apply(ctx);
        }

        const deckAfter = coordinator.getComponentFromEntity<DeckComponent>(
            DECK_COMPONENT,
            zone1
        );

        // Check that all entities are still present
        expect(deckAfter?.cached.entities.length).toBe(10);
        for (const card of cards) {
            expect(deckAfter?.cached.entities).toContain(card);
        }

        // Note: We can't guarantee the order changed since shuffle is random,
        // but we can verify the structure is intact
    });
});

// ============================================================================
// TransferMultiple Tests
// ============================================================================

describe('TransferMultiple Effect', () => {
    it('should transfer multiple entities from top', () => {
        const { state, player1, zone1, zone2 } = createTestState();
        const coordinator = state.coordinator;

        // Create cards in zone1
        const card1 = createCard(coordinator, zone1, 'Card 1');
        const card2 = createCard(coordinator, zone1, 'Card 2');
        const card3 = createCard(coordinator, zone1, 'Card 3');

        const effect = new TransferMultiple({
            fromZone: _ctx => zone1,
            toZone: _ctx => zone2,
            count: 2,
            selection: 'top',
            locationComponent: LOCATION_COMPONENT,
            zoneListComponent: DECK_COMPONENT,
        });

        const ctx = createContext(state, player1);
        effect.apply(ctx);

        const zone1Deck = coordinator.getComponentFromEntity<DeckComponent>(
            DECK_COMPONENT,
            zone1
        );
        const zone2Deck = coordinator.getComponentFromEntity<DeckComponent>(
            DECK_COMPONENT,
            zone2
        );

        // Card3 and Card2 should have moved (top = last in array)
        expect(zone1Deck?.cached.entities.length).toBe(1);
        expect(zone1Deck?.cached.entities).toContain(card1);
        expect(zone2Deck?.cached.entities.length).toBe(2);
        expect(zone2Deck?.cached.entities).toContain(card2);
        expect(zone2Deck?.cached.entities).toContain(card3);
    });

    it('should not transfer more than available', () => {
        const { state, player1, zone1, zone2 } = createTestState();
        const coordinator = state.coordinator;

        // Create only 2 cards
        createCard(coordinator, zone1, 'Card 1');
        createCard(coordinator, zone1, 'Card 2');

        const effect = new TransferMultiple({
            fromZone: _ctx => zone1,
            toZone: _ctx => zone2,
            count: 5, // Requesting more than available
            selection: 'top',
            locationComponent: LOCATION_COMPONENT,
            zoneListComponent: DECK_COMPONENT,
        });

        const ctx = createContext(state, player1);
        effect.apply(ctx);

        const zone1Deck = coordinator.getComponentFromEntity<DeckComponent>(
            DECK_COMPONENT,
            zone1
        );
        const zone2Deck = coordinator.getComponentFromEntity<DeckComponent>(
            DECK_COMPONENT,
            zone2
        );

        // Should transfer all 2 available
        expect(zone1Deck?.cached.entities.length).toBe(0);
        expect(zone2Deck?.cached.entities.length).toBe(2);
    });
});

// ============================================================================
// CreateEntity Tests
// ============================================================================

describe('CreateEntity Effect', () => {
    it('should create entity with components', () => {
        const { state, player1, zone1 } = createTestState();
        const coordinator = state.coordinator;

        const effect = new CreateEntity({
            components: [
                {
                    name: CARD_COMPONENT,
                    data: { name: 'Created Card', tapped: false },
                },
            ],
            zone: _ctx => zone1,
            locationComponent: LOCATION_COMPONENT,
            zoneListComponent: DECK_COMPONENT,
            storeAs: 'createdEntity',
        });

        const ctx = createContext(state, player1);
        effect.apply(ctx);

        // Get created entity from parameters
        const createdEntity = ctx.parameters.createdEntity;
        expect(createdEntity).toBeDefined();

        // Verify component
        const cardComp = coordinator.getComponentFromEntity<CardComponent>(
            CARD_COMPONENT,
            createdEntity
        );
        expect(cardComp?.name).toBe('Created Card');

        // Verify in zone
        const zone1Deck = coordinator.getComponentFromEntity<DeckComponent>(
            DECK_COMPONENT,
            zone1
        );
        expect(zone1Deck?.cached.entities).toContain(createdEntity);
    });

    it('should use dynamic component data from resolver', () => {
        const { state, player1, zone1 } = createTestState();
        const coordinator = state.coordinator;

        const effect = new CreateEntity({
            components: [
                {
                    name: CARD_COMPONENT,
                    data: ctx => ({
                        name: `Token of ${ctx.actor}`,
                        tapped: false,
                    }),
                },
            ],
            zone: _ctx => zone1,
            locationComponent: LOCATION_COMPONENT,
            zoneListComponent: DECK_COMPONENT,
            storeAs: 'token',
        });

        const ctx = createContext(state, player1);
        effect.apply(ctx);

        const token = ctx.parameters.token;
        const cardComp = coordinator.getComponentFromEntity<CardComponent>(
            CARD_COMPONENT,
            token
        );
        expect(cardComp?.name).toBe(`Token of ${player1}`);
    });
});

// ============================================================================
// ConditionalEffect Tests
// ============================================================================

describe('ConditionalEffect', () => {
    it('should apply thenEffect when condition is true', () => {
        const { state, player1 } = createTestState();
        const coordinator = state.coordinator;

        const effect = new ConditionalEffect({
            condition: ctx => {
                const resource =
                    ctx.state.coordinator.getComponentFromEntity<ResourceComponent>(
                        RESOURCE_COMPONENT,
                        ctx.actor
                    );
                return resource !== null && resource.mana >= 5;
            },
            thenEffect: new ModifyResource({
                entity: EntityResolvers.actor,
                componentName: RESOURCE_COMPONENT,
                property: 'health',
                amount: 5,
            }),
            elseEffect: new ModifyResource({
                entity: EntityResolvers.actor,
                componentName: RESOURCE_COMPONENT,
                property: 'health',
                amount: 1,
            }),
        });

        const ctx = createContext(state, player1);
        effect.apply(ctx);

        const resource = coordinator.getComponentFromEntity<ResourceComponent>(
            RESOURCE_COMPONENT,
            player1
        );
        expect(resource?.health).toBe(25); // 20 + 5 (then branch)
    });

    it('should apply elseEffect when condition is false', () => {
        const { state, player1 } = createTestState();
        const coordinator = state.coordinator;

        // Set mana to 0 so condition fails
        const resource = coordinator.getComponentFromEntity<ResourceComponent>(
            RESOURCE_COMPONENT,
            player1
        );
        resource!.mana = 0;

        const effect = new ConditionalEffect({
            condition: ctx => {
                const r =
                    ctx.state.coordinator.getComponentFromEntity<ResourceComponent>(
                        RESOURCE_COMPONENT,
                        ctx.actor
                    );
                return r !== null && r.mana >= 5;
            },
            thenEffect: new ModifyResource({
                entity: EntityResolvers.actor,
                componentName: RESOURCE_COMPONENT,
                property: 'health',
                amount: 5,
            }),
            elseEffect: new ModifyResource({
                entity: EntityResolvers.actor,
                componentName: RESOURCE_COMPONENT,
                property: 'health',
                amount: 1,
            }),
        });

        const ctx = createContext(state, player1);
        effect.apply(ctx);

        const resourceAfter =
            coordinator.getComponentFromEntity<ResourceComponent>(
                RESOURCE_COMPONENT,
                player1
            );
        expect(resourceAfter?.health).toBe(21); // 20 + 1 (else branch)
    });
});

// ============================================================================
// RepeatEffect Tests
// ============================================================================

describe('RepeatEffect', () => {
    it('should apply effect multiple times', () => {
        const { state, player1 } = createTestState();
        const coordinator = state.coordinator;

        const effect = new RepeatEffect({
            effect: new ModifyResource({
                entity: EntityResolvers.actor,
                componentName: RESOURCE_COMPONENT,
                property: 'health',
                amount: -1,
            }),
            times: 5,
        });

        const ctx = createContext(state, player1);
        effect.apply(ctx);

        const resource = coordinator.getComponentFromEntity<ResourceComponent>(
            RESOURCE_COMPONENT,
            player1
        );
        expect(resource?.health).toBe(15); // 20 - (1 * 5)
    });

    it('should use number resolver for times', () => {
        const { state, player1 } = createTestState();
        const coordinator = state.coordinator;

        const effect = new RepeatEffect({
            effect: new ModifyResource({
                entity: EntityResolvers.actor,
                componentName: RESOURCE_COMPONENT,
                property: 'mana',
                amount: 1,
                maxProperty: 'maxMana',
            }),
            times: ctx => ctx.parameters.repeatCount,
        });

        const ctx = createContext(state, player1, [], { repeatCount: 3 });
        effect.apply(ctx);

        const resource = coordinator.getComponentFromEntity<ResourceComponent>(
            RESOURCE_COMPONENT,
            player1
        );
        expect(resource?.mana).toBe(8); // 5 + 3
    });
});

// ============================================================================
// DestroyEntity Tests
// ============================================================================

describe('DestroyEntity Effect', () => {
    it('should move entity to discard zone', () => {
        const { state, player1, zone1, zone2 } = createTestState();
        const coordinator = state.coordinator;

        const card = createCard(coordinator, zone1);

        const effect = new DestroyEntity({
            entity: EntityResolvers.target,
            discardZone: _ctx => zone2,
            locationComponent: LOCATION_COMPONENT,
            zoneListComponent: DECK_COMPONENT,
        });

        const ctx = createContext(state, player1, [card]);
        effect.apply(ctx);

        // Card should be in zone2 (discard)
        const locationComp =
            coordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT,
                card
            );
        expect(locationComp?.location).toBe(zone2);

        const zone1Deck = coordinator.getComponentFromEntity<DeckComponent>(
            DECK_COMPONENT,
            zone1
        );
        const zone2Deck = coordinator.getComponentFromEntity<DeckComponent>(
            DECK_COMPONENT,
            zone2
        );
        expect(zone1Deck?.cached.entities).not.toContain(card);
        expect(zone2Deck?.cached.entities).toContain(card);
    });
});
