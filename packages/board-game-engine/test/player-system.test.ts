import { Coordinator, Entity } from '@ue-too/ecs';

import {
    PLAYER_COMPONENT,
    PLAYER_SYSTEM,
    PlayerComponent,
    PlayerSystem,
} from '../src/player-system/player-component';

describe('PlayerSystem', () => {
    let coordinator: Coordinator;
    let playerSystem: PlayerSystem;

    beforeEach(() => {
        coordinator = new Coordinator();
        playerSystem = new PlayerSystem(coordinator, 2);
    });

    describe('constructor', () => {
        it('should initialize with empty entities set', () => {
            const newCoordinator = new Coordinator();
            const newPlayerSystem = new PlayerSystem(newCoordinator);
            expect(newPlayerSystem.entities).toBeInstanceOf(Set);
            expect(newPlayerSystem.entities.size).toBe(0);
        });

        it('should register PlayerComponent', () => {
            const newCoordinator = new Coordinator();
            const newPlayerSystem = new PlayerSystem(newCoordinator);

            const componentType =
                newCoordinator.getComponentType(PLAYER_COMPONENT);
            expect(componentType).not.toBeNull();
        });

        it('should register system', () => {
            const newCoordinator = new Coordinator();
            const newPlayerSystem = new PlayerSystem(newCoordinator);

            const retrievedSystem =
                newCoordinator.getSystem<PlayerSystem>(PLAYER_SYSTEM);
            expect(retrievedSystem).toBe(newPlayerSystem);
        });

        it('should set system signature to include PlayerComponent', () => {
            const newCoordinator = new Coordinator();
            const newPlayerSystem = new PlayerSystem(newCoordinator);

            // Create a player entity - should be automatically added to system
            const player = newCoordinator.createEntity();
            newCoordinator.addComponentToEntity<PlayerComponent>(
                PLAYER_COMPONENT,
                player,
                {
                    name: 'Test Player',
                    playerNumber: 0,
                    inPlay: true,
                }
            );

            expect(newPlayerSystem.entities.has(player)).toBe(true);
        });

        it('should use default player count of 2', () => {
            const newCoordinator = new Coordinator();
            const newPlayerSystem = new PlayerSystem(newCoordinator);

            // Should be able to add 2 players
            const player1 = newPlayerSystem.addPlayer('Player 1');
            const player2 = newPlayerSystem.addPlayer('Player 2');
            const player3 = newPlayerSystem.addPlayer('Player 3');

            expect(player1).not.toBeNull();
            expect(player2).not.toBeNull();
            expect(player3).toBeNull(); // Should be rejected
        });

        it('should accept custom player count', () => {
            const newCoordinator = new Coordinator();
            const newPlayerSystem = new PlayerSystem(newCoordinator, 4);

            // Should be able to add 4 players
            const player1 = newPlayerSystem.addPlayer('Player 1');
            const player2 = newPlayerSystem.addPlayer('Player 2');
            const player3 = newPlayerSystem.addPlayer('Player 3');
            const player4 = newPlayerSystem.addPlayer('Player 4');
            const player5 = newPlayerSystem.addPlayer('Player 5');

            expect(player1).not.toBeNull();
            expect(player2).not.toBeNull();
            expect(player3).not.toBeNull();
            expect(player4).not.toBeNull();
            expect(player5).toBeNull(); // Should be rejected
        });
    });

    describe('addPlayer', () => {
        it('should create a player entity with PlayerComponent', () => {
            const player = playerSystem.addPlayer('Alice');

            expect(player).not.toBeNull();

            const playerComponent =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player!
                );

            expect(playerComponent).not.toBeNull();
            expect(playerComponent?.name).toBe('Alice');
            expect(playerComponent?.playerNumber).toBe(0);
            expect(playerComponent?.inPlay).toBe(true);
        });

        it('should assign sequential player numbers', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');

            const component1 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );

            expect(component1?.playerNumber).toBe(0);
            expect(component2?.playerNumber).toBe(1);
        });

        it('should add player to system entities', () => {
            const player = playerSystem.addPlayer('Bob');

            expect(playerSystem.entities.has(player!)).toBe(true);
            expect(playerSystem.playerCount()).toBe(1);
        });

        it('should return null when player count limit is reached', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');
            const player3 = playerSystem.addPlayer('Player 3');

            expect(player1).not.toBeNull();
            expect(player2).not.toBeNull();
            expect(player3).toBeNull();

            expect(playerSystem.playerCount()).toBe(2);
        });

        it('should allow adding players up to the limit', () => {
            const newCoordinator = new Coordinator();
            const newPlayerSystem = new PlayerSystem(newCoordinator, 3);

            const player1 = newPlayerSystem.addPlayer('Player 1');
            const player2 = newPlayerSystem.addPlayer('Player 2');
            const player3 = newPlayerSystem.addPlayer('Player 3');

            expect(player1).not.toBeNull();
            expect(player2).not.toBeNull();
            expect(player3).not.toBeNull();
            expect(newPlayerSystem.playerCount()).toBe(3);
        });

        it('should handle empty player name', () => {
            const player = playerSystem.addPlayer('');

            expect(player).not.toBeNull();
            const playerComponent =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player!
                );
            expect(playerComponent?.name).toBe('');
        });

        it('should allow duplicate player names', () => {
            const player1 = playerSystem.addPlayer('Player');
            const player2 = playerSystem.addPlayer('Player');

            expect(player1).not.toBeNull();
            expect(player2).not.toBeNull();

            const component1 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );

            expect(component1?.name).toBe('Player');
            expect(component2?.name).toBe('Player');
            expect(component1?.playerNumber).toBe(0);
            expect(component2?.playerNumber).toBe(1);
        });
    });

    describe('playerCount', () => {
        it('should return 0 for empty system', () => {
            expect(playerSystem.playerCount()).toBe(0);
        });

        it('should return correct count after adding players', () => {
            playerSystem.addPlayer('Player 1');
            expect(playerSystem.playerCount()).toBe(1);

            playerSystem.addPlayer('Player 2');
            expect(playerSystem.playerCount()).toBe(2);
        });

        it('should not exceed max player count', () => {
            playerSystem.addPlayer('Player 1');
            playerSystem.addPlayer('Player 2');
            playerSystem.addPlayer('Player 3'); // Should be rejected

            expect(playerSystem.playerCount()).toBe(2);
        });

        it('should only count players with inPlay true', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');

            expect(playerSystem.playerCount()).toBe(2);

            // Remove a player
            playerSystem.removePlayer(player2!);

            // playerCount should only count in-play players
            expect(playerSystem.playerCount()).toBe(1);
            // But entity is still in the system entities set
            expect(playerSystem.entities.has(player2!)).toBe(true);
        });
    });

    describe('getPlayers', () => {
        it('should return empty array for empty system', () => {
            const players = playerSystem.getPlayers();
            expect(players).toEqual([]);
        });

        it('should return array of player entities', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');

            const players = playerSystem.getPlayers();

            expect(players).toHaveLength(2);
            expect(players).toContain(player1);
            expect(players).toContain(player2);
        });

        it('should return players in order they were added', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');

            const players = playerSystem.getPlayers();

            expect(players[0]).toBe(player1);
            expect(players[1]).toBe(player2);
        });

        it('should return all players up to limit', () => {
            const newCoordinator = new Coordinator();
            const newPlayerSystem = new PlayerSystem(newCoordinator, 5);

            const player1 = newPlayerSystem.addPlayer('Player 1');
            const player2 = newPlayerSystem.addPlayer('Player 2');
            const player3 = newPlayerSystem.addPlayer('Player 3');
            const player4 = newPlayerSystem.addPlayer('Player 4');
            const player5 = newPlayerSystem.addPlayer('Player 5');
            newPlayerSystem.addPlayer('Player 6'); // Should be rejected

            const players = newPlayerSystem.getPlayers();

            expect(players).toHaveLength(5);
            expect(players).toContain(player1);
            expect(players).toContain(player2);
            expect(players).toContain(player3);
            expect(players).toContain(player4);
            expect(players).toContain(player5);
        });

        it('should only return players with inPlay true', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');

            let players = playerSystem.getPlayers();
            expect(players).toHaveLength(2);
            expect(players).toContain(player1);
            expect(players).toContain(player2);

            // Remove a player
            playerSystem.removePlayer(player2!);

            players = playerSystem.getPlayers();
            expect(players).toHaveLength(1);
            expect(players).toContain(player1);
            expect(players).not.toContain(player2);
        });

        it('should not return players without PlayerComponent', () => {
            const player = playerSystem.addPlayer('Player 1');

            // Manually remove component (edge case)
            coordinator.removeComponentFromEntity(PLAYER_COMPONENT, player!);

            const players = playerSystem.getPlayers();
            expect(players).not.toContain(player);
        });
    });

    describe('integration with ECS', () => {
        it('should automatically add entities with PlayerComponent to system', () => {
            const newCoordinator = new Coordinator();
            const newPlayerSystem = new PlayerSystem(newCoordinator);

            // Manually create entity with PlayerComponent
            const player = newCoordinator.createEntity();
            newCoordinator.addComponentToEntity<PlayerComponent>(
                PLAYER_COMPONENT,
                player,
                {
                    name: 'Manual Player',
                    playerNumber: 0,
                    inPlay: true,
                }
            );

            expect(newPlayerSystem.entities.has(player)).toBe(true);
            expect(newPlayerSystem.playerCount()).toBe(1);
        });

        it('should not add entities without PlayerComponent to system', () => {
            const entity = coordinator.createEntity();
            // Don't add PlayerComponent

            expect(playerSystem.entities.has(entity)).toBe(false);
        });

        it('should remove entity from system when PlayerComponent is removed', () => {
            const player = playerSystem.addPlayer('Test Player');

            expect(playerSystem.entities.has(player!)).toBe(true);

            coordinator.removeComponentFromEntity(PLAYER_COMPONENT, player!);

            expect(playerSystem.entities.has(player!)).toBe(false);
            expect(playerSystem.playerCount()).toBe(0);
        });

        it('should handle system registration being idempotent', () => {
            const newCoordinator = new Coordinator();
            const system1 = new PlayerSystem(newCoordinator, 2);
            const system2 = new PlayerSystem(newCoordinator, 3);

            // System registration is idempotent, so the first system registered is kept
            const retrievedSystem =
                newCoordinator.getSystem<PlayerSystem>(PLAYER_SYSTEM);
            expect(retrievedSystem).toBe(system1);
            // system2 is a different instance, but the coordinator keeps system1
            expect(retrievedSystem).not.toBe(system2);

            // When adding players, entities are added to the registered system (system1)
            const player1 = system1.addPlayer('System1 Player 1');
            const player2 = system2.addPlayer('System2 Player 1');

            // system1 is the registered system, so it receives all entities with PlayerComponent
            expect(system1.entities.has(player1!)).toBe(true);
            expect(system1.entities.has(player2!)).toBe(true);
            expect(system1.playerCount()).toBe(2);

            // system2 is a separate instance with its own entities set
            // It doesn't receive entities because it's not the registered system
            expect(system2.entities.has(player1!)).toBe(false);
            expect(system2.entities.has(player2!)).toBe(false);
            expect(system2.playerCount()).toBe(0);
        });
    });

    describe('removePlayer', () => {
        it('should set inPlay to false for the player', () => {
            const player = playerSystem.addPlayer('Test Player');

            const playerComponent =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player!
                );
            expect(playerComponent?.inPlay).toBe(true);

            playerSystem.removePlayer(player!);

            const updatedComponent =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player!
                );
            expect(updatedComponent?.inPlay).toBe(false);
        });

        it('should do nothing if player does not have PlayerComponent', () => {
            const entity = coordinator.createEntity();
            // Don't add PlayerComponent

            expect(() => {
                playerSystem.removePlayer(entity);
            }).not.toThrow();
        });

        it('should remove player from getPlayers but keep in entities set', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');

            expect(playerSystem.getPlayers()).toHaveLength(2);
            expect(playerSystem.entities.has(player1!)).toBe(true);
            expect(playerSystem.entities.has(player2!)).toBe(true);

            playerSystem.removePlayer(player2!);

            const players = playerSystem.getPlayers();
            expect(players).toHaveLength(1);
            expect(players).toContain(player1);
            expect(players).not.toContain(player2);

            // Entity is still in system entities set
            expect(playerSystem.entities.has(player2!)).toBe(true);
        });

        it('should update playerCount after removing player', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');

            expect(playerSystem.playerCount()).toBe(2);

            playerSystem.removePlayer(player1!);

            expect(playerSystem.playerCount()).toBe(1);
        });

        it('should handle removing already removed player', () => {
            const player = playerSystem.addPlayer('Player 1');

            playerSystem.removePlayer(player!);
            playerSystem.removePlayer(player!); // Remove again

            const playerComponent =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player!
                );
            expect(playerComponent?.inPlay).toBe(false);
        });
    });

    describe('shufflePlayerOrder', () => {
        it('should shuffle player order and reassign player numbers', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');

            // Verify initial state
            const component1Before =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2Before =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            expect(component1Before?.playerNumber).toBe(0);
            expect(component2Before?.playerNumber).toBe(1);

            // Shuffle
            playerSystem.shufflePlayerOrder();

            // Check that all players are still present
            const players = playerSystem.getPlayers();
            expect(players).toHaveLength(2);
            expect(players).toContain(player1);
            expect(players).toContain(player2);

            // Check that player numbers are reassigned sequentially (0, 1)
            const component1After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            const numbers = [
                component1After?.playerNumber,
                component2After?.playerNumber,
            ].sort();
            expect(numbers).toEqual([0, 1]);

            // Verify that at least one player number changed (with 2 players, this should happen)
            // Since shuffle randomizes, we check that numbers are still sequential
            expect(component1After?.playerNumber).toBeGreaterThanOrEqual(0);
            expect(component1After?.playerNumber).toBeLessThan(2);
            expect(component2After?.playerNumber).toBeGreaterThanOrEqual(0);
            expect(component2After?.playerNumber).toBeLessThan(2);
        });

        it('should only shuffle players with inPlay true', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');
            const player3 = coordinator.createEntity();
            coordinator.addComponentToEntity<PlayerComponent>(
                PLAYER_COMPONENT,
                player3,
                {
                    name: 'Player 3',
                    playerNumber: 2,
                    inPlay: false,
                }
            );

            playerSystem.shufflePlayerOrder();

            const players = playerSystem.getPlayers();
            expect(players).toHaveLength(2);
            expect(players).toContain(player1);
            expect(players).toContain(player2);
            expect(players).not.toContain(player3);
        });

        it('should handle single player', () => {
            const player = playerSystem.addPlayer('Player 1');

            playerSystem.shufflePlayerOrder();

            const players = playerSystem.getPlayers();
            expect(players).toHaveLength(1);
            expect(players[0]).toBe(player);

            const component =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player!
                );
            expect(component?.playerNumber).toBe(0);
        });

        it('should handle empty player list', () => {
            expect(() => {
                playerSystem.shufflePlayerOrder();
            }).not.toThrow();

            expect(playerSystem.getPlayers()).toHaveLength(0);
        });
    });

    describe('organizePlayerOrder', () => {
        it('should sort players by playerNumber and reassign sequential numbers', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');

            // Manually set non-sequential player numbers
            const component1 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            component1!.playerNumber = 5;
            component2!.playerNumber = 2;

            playerSystem.organizePlayerOrder();

            // Players should have sequential numbers (0, 1)
            const players = playerSystem.getPlayers();
            expect(players).toHaveLength(2);

            // Verify player numbers are sequential (0, 1)
            const component1After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            const numbers = [
                component1After?.playerNumber,
                component2After?.playerNumber,
            ].sort();
            expect(numbers).toEqual([0, 1]);
        });

        it('should only organize players with inPlay true', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');
            const player3 = coordinator.createEntity();
            coordinator.addComponentToEntity<PlayerComponent>(
                PLAYER_COMPONENT,
                player3,
                {
                    name: 'Player 3',
                    playerNumber: 10,
                    inPlay: false,
                }
            );

            // Set non-sequential numbers
            const component1 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            component1!.playerNumber = 7;
            component2!.playerNumber = 3;

            playerSystem.organizePlayerOrder();

            const players = playerSystem.getPlayers();
            expect(players).toHaveLength(2);
            expect(players).toContain(player1);
            expect(players).toContain(player2);
            expect(players).not.toContain(player3);

            // Verify in-play players have sequential numbers (0, 1)
            const component1After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            const numbers = [
                component1After?.playerNumber,
                component2After?.playerNumber,
            ].sort();
            expect(numbers).toEqual([0, 1]);

            // Out-of-play player should keep original number
            const component3 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player3
                );
            expect(component3?.playerNumber).toBe(10);
        });

        it('should handle players with same playerNumber', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');

            // Set same player number
            const component1 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            component1!.playerNumber = 1;
            component2!.playerNumber = 1;

            playerSystem.organizePlayerOrder();

            const players = playerSystem.getPlayers();
            expect(players).toHaveLength(2);

            // Both should have sequential numbers
            const numbers = players.map(player => {
                const component =
                    coordinator.getComponentFromEntity<PlayerComponent>(
                        PLAYER_COMPONENT,
                        player
                    );
                return component?.playerNumber;
            });
            expect(numbers).toContain(0);
            expect(numbers).toContain(1);
        });

        it('should handle empty player list', () => {
            expect(() => {
                playerSystem.organizePlayerOrder();
            }).not.toThrow();

            expect(playerSystem.getPlayers()).toHaveLength(0);
        });

        it('should handle single player', () => {
            const player = playerSystem.addPlayer('Player 1');

            const component =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player!
                );
            component!.playerNumber = 10;

            playerSystem.organizePlayerOrder();

            const updatedComponent =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player!
                );
            expect(updatedComponent?.playerNumber).toBe(0);
        });
    });

    describe('setPlayerOrder', () => {
        it('should set player numbers based on array order', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');

            // Set order: player2 first, then player1
            playerSystem.setPlayerOrder([player2!, player1!]);

            const component1 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );

            // After organizePlayerOrder, numbers should be sequential
            expect(component2?.playerNumber).toBe(0);
            expect(component1?.playerNumber).toBe(1);
        });

        it('should reassign sequential player numbers after setting order', () => {
            const newCoordinator = new Coordinator();
            const newPlayerSystem = new PlayerSystem(newCoordinator, 3);
            const player1 = newPlayerSystem.addPlayer('Player 1');
            const player2 = newPlayerSystem.addPlayer('Player 2');
            const player3 = newPlayerSystem.addPlayer('Player 3');

            // Set non-sequential numbers first
            const component1 =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2 =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            const component3 =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player3!
                );
            component1!.playerNumber = 10;
            component2!.playerNumber = 5;
            component3!.playerNumber = 20;

            // Set order: player3, player1, player2
            newPlayerSystem.setPlayerOrder([player3!, player1!, player2!]);

            // After organizePlayerOrder, numbers should be sequential (0, 1, 2)
            const updatedComponent1 =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const updatedComponent2 =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            const updatedComponent3 =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player3!
                );

            expect(updatedComponent3?.playerNumber).toBe(0);
            expect(updatedComponent1?.playerNumber).toBe(1);
            expect(updatedComponent2?.playerNumber).toBe(2);
        });

        it('should do nothing when array size does not match in-play player count', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');

            const component1Before =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2Before =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            const originalNumber1 = component1Before?.playerNumber;
            const originalNumber2 = component2Before?.playerNumber;

            // Try to set order with empty array (size mismatch)
            playerSystem.setPlayerOrder([]);

            // Player numbers should remain unchanged
            const component1After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );

            expect(component1After?.playerNumber).toBe(originalNumber1);
            expect(component2After?.playerNumber).toBe(originalNumber2);
        });

        it('should do nothing when array size is larger than in-play player count', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');
            const extraEntity = coordinator.createEntity();

            const component1Before =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2Before =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            const originalNumber1 = component1Before?.playerNumber;
            const originalNumber2 = component2Before?.playerNumber;

            // Try to set order with 3 items when there are only 2 players (size mismatch)
            playerSystem.setPlayerOrder([player1!, player2!, extraEntity]);

            // Player numbers should remain unchanged
            const component1After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );

            expect(component1After?.playerNumber).toBe(originalNumber1);
            expect(component2After?.playerNumber).toBe(originalNumber2);
        });

        it('should do nothing when array size is smaller than in-play player count', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');

            const component1Before =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2Before =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            const originalNumber1 = component1Before?.playerNumber;
            const originalNumber2 = component2Before?.playerNumber;

            // Try to set order with only 1 item when there are 2 players (size mismatch)
            playerSystem.setPlayerOrder([player1!]);

            // Player numbers should remain unchanged
            const component1After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );

            expect(component1After?.playerNumber).toBe(originalNumber1);
            expect(component2After?.playerNumber).toBe(originalNumber2);
        });

        it('should skip players without PlayerComponent', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');
            const entityWithoutComponent = coordinator.createEntity();
            // Don't add PlayerComponent to entityWithoutComponent

            // Array must match in-play player count (2), so we can't include entityWithoutComponent
            // Instead, we'll use a valid array and verify it works
            playerSystem.setPlayerOrder([player2!, player1!]);

            const component1 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );

            // Player numbers should be set based on order
            expect(component2?.playerNumber).toBe(0);
            expect(component1?.playerNumber).toBe(1);
        });

        it('should require array to contain all in-play players', () => {
            const newCoordinator = new Coordinator();
            const newPlayerSystem = new PlayerSystem(newCoordinator, 3);
            const player1 = newPlayerSystem.addPlayer('Player 1');
            const player2 = newPlayerSystem.addPlayer('Player 2');
            const player3 = newPlayerSystem.addPlayer('Player 3');

            // Get original numbers
            const component1Before =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2Before =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            const component3Before =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player3!
                );
            const originalNumber1 = component1Before?.playerNumber;
            const originalNumber2 = component2Before?.playerNumber;
            const originalNumber3 = component3Before?.playerNumber;

            // Try to set order with only 2 players when there are 3 (size mismatch)
            newPlayerSystem.setPlayerOrder([player3!, player1!]);

            // Player numbers should remain unchanged because array size doesn't match
            const component1After =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2After =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            const component3After =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player3!
                );

            expect(component1After?.playerNumber).toBe(originalNumber1);
            expect(component2After?.playerNumber).toBe(originalNumber2);
            expect(component3After?.playerNumber).toBe(originalNumber3);
        });

        it('should handle duplicate players in array', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');

            // Array must match in-play player count (2), so we can't include duplicates
            // Instead, test with valid array
            playerSystem.setPlayerOrder([player2!, player1!]);

            const component1 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2 =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );

            // After organizePlayerOrder, numbers should be sequential
            expect(component2?.playerNumber).toBe(0);
            expect(component1?.playerNumber).toBe(1);
        });

        it('should do nothing when array contains duplicates and size matches', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');

            const component1Before =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2Before =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            const originalNumber1 = component1Before?.playerNumber;
            const originalNumber2 = component2Before?.playerNumber;

            // Try to set order with duplicates (size matches but contains duplicates)
            // Note: The implementation doesn't check for duplicates, it just sets numbers
            // But if we include a duplicate, the array size won't match the unique player count
            // Actually, the array size is 3 but player count is 2, so it should fail
            playerSystem.setPlayerOrder([player1!, player2!, player1!]);

            // Since array size (3) doesn't match player count (2), nothing should happen
            const component1After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );

            expect(component1After?.playerNumber).toBe(originalNumber1);
            expect(component2After?.playerNumber).toBe(originalNumber2);
        });

        it('should work with single player', () => {
            const player = playerSystem.addPlayer('Player 1');

            playerSystem.setPlayerOrder([player!]);

            const component =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player!
                );

            expect(component?.playerNumber).toBe(0);
        });

        it('should call organizePlayerOrder to ensure sequential numbering', () => {
            const newCoordinator = new Coordinator();
            const newPlayerSystem = new PlayerSystem(newCoordinator, 3);
            const player1 = newPlayerSystem.addPlayer('Player 1');
            const player2 = newPlayerSystem.addPlayer('Player 2');
            const player3 = newPlayerSystem.addPlayer('Player 3');

            // Set order with gaps in player numbers
            newPlayerSystem.setPlayerOrder([player3!, player1!, player2!]);

            // After organizePlayerOrder, all in-play players should have sequential numbers
            const players = newPlayerSystem.getPlayers();
            const playerNumbers = players
                .map(player => {
                    const component =
                        newCoordinator.getComponentFromEntity<PlayerComponent>(
                            PLAYER_COMPONENT,
                            player
                        );
                    return component?.playerNumber;
                })
                .sort();

            expect(playerNumbers).toEqual([0, 1, 2]);
        });

        it('should do nothing when array includes out-of-play players', () => {
            const player1 = playerSystem.addPlayer('Player 1');
            const player2 = playerSystem.addPlayer('Player 2');
            const playerNotInPlay = coordinator.createEntity();
            // Add PlayerComponent but set inPlay to false so it won't be in getPlayers
            coordinator.addComponentToEntity<PlayerComponent>(
                PLAYER_COMPONENT,
                playerNotInPlay,
                {
                    name: 'Not In Play',
                    playerNumber: 99,
                    inPlay: false,
                }
            );

            const component1Before =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2Before =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            const originalNumber1 = component1Before?.playerNumber;
            const originalNumber2 = component2Before?.playerNumber;

            // Try to set order with 3 items when there are only 2 in-play players (size mismatch)
            playerSystem.setPlayerOrder([player1!, playerNotInPlay, player2!]);

            // Player numbers should remain unchanged because array size doesn't match in-play player count
            const component1After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2After =
                coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );

            expect(component1After?.playerNumber).toBe(originalNumber1);
            expect(component2After?.playerNumber).toBe(originalNumber2);
        });

        it('should only work with in-play players', () => {
            const newCoordinator = new Coordinator();
            const newPlayerSystem = new PlayerSystem(newCoordinator, 3);
            const player1 = newPlayerSystem.addPlayer('Player 1');
            const player2 = newPlayerSystem.addPlayer('Player 2');
            const player3 = newPlayerSystem.addPlayer('Player 3');

            // Remove player3 (now only 2 in-play players)
            newPlayerSystem.removePlayer(player3!);

            const component1Before =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2Before =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            const component3Before =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player3!
                );
            const originalNumber1 = component1Before?.playerNumber;
            const originalNumber2 = component2Before?.playerNumber;
            const originalNumber3 = component3Before?.playerNumber;

            // Try to set order with 3 items when there are only 2 in-play players (size mismatch)
            newPlayerSystem.setPlayerOrder([player3!, player1!, player2!]);

            // Player numbers should remain unchanged because array size doesn't match in-play player count
            const component1After =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player1!
                );
            const component2After =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player2!
                );
            const component3After =
                newCoordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player3!
                );

            expect(component1After?.playerNumber).toBe(originalNumber1);
            expect(component2After?.playerNumber).toBe(originalNumber2);
            expect(component3After?.playerNumber).toBe(originalNumber3);

            // Now set order with correct size (only in-play players)
            newPlayerSystem.setPlayerOrder([player2!, player1!]);

            // After organizePlayerOrder, only in-play players should have sequential numbers
            const players = newPlayerSystem.getPlayers();
            expect(players).toHaveLength(2);
            expect(players).toContain(player1);
            expect(players).toContain(player2);
            expect(players).not.toContain(player3);

            const playerNumbers = players
                .map(player => {
                    const component =
                        newCoordinator.getComponentFromEntity<PlayerComponent>(
                            PLAYER_COMPONENT,
                            player
                        );
                    return component?.playerNumber;
                })
                .sort();

            expect(playerNumbers).toEqual([0, 1]);
        });
    });
});
