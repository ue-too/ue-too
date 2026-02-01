import {
    Coordinator,
    Entity,
    System,
    createGlobalComponentName,
    createGlobalSystemName,
} from '@ue-too/ecs';

import { shuffle } from '../zone-system/zone-component';

export const PLAYER_COMPONENT = createGlobalComponentName('Player');
export const PLAYER_SYSTEM = createGlobalSystemName('Player');

export interface PlayerComponent {
    name: string;
    playerNumber: number;
    inPlay: boolean;
}

export class PlayerSystem implements System {
    entities: Set<Entity> = new Set();

    constructor(
        private readonly _coordinator: Coordinator,
        private readonly _playerCount: number = 2
    ) {
        this._coordinator.registerComponent(PLAYER_COMPONENT);

        const playerComponentType =
            this._coordinator.getComponentType(PLAYER_COMPONENT);
        if (playerComponentType === null) {
            throw new Error('PlayerComponent not registered');
        }
        this._coordinator.registerSystem(PLAYER_SYSTEM, this);
        this._coordinator.setSystemSignature(
            PLAYER_SYSTEM,
            1 << playerComponentType
        );
    }

    addPlayer(name: string): Entity | null {
        if (this.playerCount() >= this._playerCount) {
            return null;
        }
        const player = this._coordinator.createEntity();
        this._coordinator.addComponentToEntity<PlayerComponent>(
            PLAYER_COMPONENT,
            player,
            { name, playerNumber: this.entities.size, inPlay: true }
        );
        return player;
    }

    removePlayer(player: Entity): void {
        const playerComponent =
            this._coordinator.getComponentFromEntity<PlayerComponent>(
                PLAYER_COMPONENT,
                player
            );
        if (!playerComponent) {
            return;
        }
        playerComponent.inPlay = false;
    }

    playerCount(): number {
        return this.getPlayers().length;
    }

    getPlayers(): Entity[] {
        const players: Entity[] = [];
        for (const entity of this.entities) {
            const playerComponent =
                this._coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    entity
                );
            if (!playerComponent || !playerComponent.inPlay) {
                continue;
            }
            players.push(entity);
        }
        return players;
    }

    shufflePlayerOrder(): void {
        let players = this.getPlayers();
        players = shuffle(players);
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const playerComponent =
                this._coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player
                );
            if (!playerComponent) {
                continue;
            }
            playerComponent.playerNumber = i;
        }
    }

    setPlayerOrder(players: Entity[]): void {
        const playerCounts = this.playerCount();
        if (playerCounts !== players.length) {
            return;
        }
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const playerComponent =
                this._coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player
                );
            if (!playerComponent) {
                continue;
            }
            playerComponent.playerNumber = i;
        }
        this.organizePlayerOrder();
    }

    organizePlayerOrder(): void {
        const players = this.getPlayers();
        players.sort((a, b) => {
            const aComponent =
                this._coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    a
                );
            const bComponent =
                this._coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    b
                );
            if (!aComponent || !bComponent) {
                return 0;
            }
            return aComponent.playerNumber - bComponent.playerNumber;
        });
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const playerComponent =
                this._coordinator.getComponentFromEntity<PlayerComponent>(
                    PLAYER_COMPONENT,
                    player
                );
            if (!playerComponent) {
                continue;
            }
            playerComponent.playerNumber = i;
        }
    }

    getPlayerOrder(): Entity[] {
        this.organizePlayerOrder();
        const players = this.getPlayers();
        return players;
    }
}
