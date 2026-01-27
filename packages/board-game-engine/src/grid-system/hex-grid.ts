import {
    Coordinator,
    Entity,
    System,
    createGlobalComponentName,
    createGlobalSystemName,
} from '@ue-too/ecs';
import {
    LOCATION_COMPONENT,
    LOCATION_SYSTEM,
    LocationComponent,
    LocationSystem,
    ZONE_COMPONENT,
    ZoneComponent,
} from 'src/zone-system';

export type HexGridVariant = 'odd-r' | 'even-r' | 'odd-q' | 'even-q';

export type HexGridComponent = {
    name: string;
    width: number; // q dimension
    height: number; // r dimension
    variant: HexGridVariant;
};

// each grid cell should also be a zone
export type HexGridLocationComponent = {
    grid: Entity;
    q: number;
    r: number;
};

export const HEX_GRID_COMPONENT = createGlobalComponentName('HexGridComponent');
export const HEX_GRID_LOCATION_COMPONENT = createGlobalComponentName(
    'HexGridLocationComponent'
);
export const HEX_GRID_SYSTEM = createGlobalSystemName('HexGridSystem');

/**
 * Creates a hexagonal grid with offset coordinates (q, r).
 *
 * @param coordinator - The ECS coordinator
 * @param width - The width of the grid (q dimension)
 * @param height - The height of the grid (r dimension)
 * @param name - The name of the grid
 * @param variant - The offset coordinate variant: 'odd-r', 'even-r', 'odd-q', or 'even-q'
 * @returns The grid entity
 */
export function createHexGrid(
    coordinator: Coordinator,
    width: number,
    height: number,
    name: string,
    variant: HexGridVariant = 'odd-r'
): Entity {
    const gridEntity = coordinator.createEntity();

    coordinator.registerComponent<HexGridComponent>(HEX_GRID_COMPONENT);
    coordinator.registerComponent<HexGridLocationComponent>(
        HEX_GRID_LOCATION_COMPONENT
    );
    coordinator.registerComponent<ZoneComponent>(ZONE_COMPONENT);

    coordinator.addComponentToEntity(HEX_GRID_COMPONENT, gridEntity, {
        name: name,
        width: width,
        height: height,
        variant: variant,
    });

    for (let q = 0; q < width; q++) {
        for (let r = 0; r < height; r++) {
            const gridCellZoneEntity = coordinator.createEntity();
            coordinator.addComponentToEntity(
                ZONE_COMPONENT,
                gridCellZoneEntity,
                {
                    zone: name + ' ' + q + ' ' + r,
                    owner: null,
                    visibility: 'public',
                    ordered: true,
                }
            );

            coordinator.addComponentToEntity(
                HEX_GRID_LOCATION_COMPONENT,
                gridCellZoneEntity,
                {
                    grid: gridEntity,
                    q: q,
                    r: r,
                }
            );
        }
    }

    return gridEntity;
}

export class HexGridSystem implements System {
    entities: Set<Entity>;
    private coordinator: Coordinator;

    constructor(coordinator: Coordinator) {
        this.entities = new Set<Entity>();
        this.coordinator = coordinator;
        this.coordinator.registerComponent<HexGridComponent>(
            HEX_GRID_COMPONENT
        );
        this.coordinator.registerComponent<HexGridLocationComponent>(
            HEX_GRID_LOCATION_COMPONENT
        );
        this.coordinator.registerComponent<ZoneComponent>(ZONE_COMPONENT);
        this.coordinator.registerSystem(HEX_GRID_SYSTEM, this);

        const gridComponentType =
            this.coordinator.getComponentType(HEX_GRID_COMPONENT);
        if (gridComponentType === null) {
            throw new Error('HexGridComponent not registered');
        }
        const gridLocationComponentType = this.coordinator.getComponentType(
            HEX_GRID_LOCATION_COMPONENT
        );
        if (gridLocationComponentType === null) {
            throw new Error('HexGridLocationComponent not registered');
        }
        const zoneComponentType =
            this.coordinator.getComponentType(ZONE_COMPONENT);
        if (zoneComponentType === null) {
            throw new Error('ZoneComponent not registered');
        }
        this.coordinator.setSystemSignature(
            HEX_GRID_SYSTEM,
            (1 << gridLocationComponentType) | (1 << zoneComponentType)
        );
    }

    addEntityToGridCell(
        grid: Entity,
        q: number,
        r: number,
        entity: Entity,
        direction: 'top' | 'bottom' = 'top',
        displace: boolean = false
    ): void {
        const gridComponent =
            this.coordinator.getComponentFromEntity<HexGridComponent>(
                HEX_GRID_COMPONENT,
                grid
            );
        if (!gridComponent) {
            return;
        }
        if (
            q < 0 ||
            q >= gridComponent.width ||
            r < 0 ||
            r >= gridComponent.height
        ) {
            return;
        }
        let zoneAtCell: Entity | null = null;
        for (const entity of this.entities) {
            const gridLocationComponent =
                this.coordinator.getComponentFromEntity<HexGridLocationComponent>(
                    HEX_GRID_LOCATION_COMPONENT,
                    entity
                );
            if (!gridLocationComponent) {
                continue;
            }
            if (
                gridLocationComponent.grid === grid &&
                gridLocationComponent.q === q &&
                gridLocationComponent.r === r
            ) {
                zoneAtCell = entity;
                break;
            }
        }
        if (zoneAtCell === null) {
            return;
        }
        const locationSystem =
            this.coordinator.getSystem<LocationSystem>(LOCATION_SYSTEM);
        if (!locationSystem) {
            return;
        }
        locationSystem.addEntityToZone(zoneAtCell, entity, direction);
    }

    getEntireGridEntities(
        grid: Entity
    ): { entities: (Entity | null)[][]; hasHole: boolean } | null {
        const gridComponent =
            this.coordinator.getComponentFromEntity<HexGridComponent>(
                HEX_GRID_COMPONENT,
                grid
            );
        if (!gridComponent) {
            return null;
        }

        const entities: (Entity | null)[][] = Array.from(
            { length: gridComponent.width },
            () => Array.from({ length: gridComponent.height }, () => null)
        );

        for (const entity of this.entities) {
            const gridLocationComponent =
                this.coordinator.getComponentFromEntity<HexGridLocationComponent>(
                    HEX_GRID_LOCATION_COMPONENT,
                    entity
                );
            if (!gridLocationComponent) {
                continue;
            }
            if (
                gridLocationComponent.grid === grid &&
                gridLocationComponent.q >= 0 &&
                gridLocationComponent.q < gridComponent.width &&
                gridLocationComponent.r >= 0 &&
                gridLocationComponent.r < gridComponent.height
            ) {
                entities[gridLocationComponent.q][gridLocationComponent.r] =
                    entity;
            }
        }
        let hasHole = false;
        for (let q = 0; q < gridComponent.width; q++) {
            for (let r = 0; r < gridComponent.height; r++) {
                if (entities[q][r] === null) {
                    hasHole = true;
                }
            }
        }
        return { entities, hasHole };
    }

    getCellEntityAt(grid: Entity, q: number, r: number): Entity | null {
        const gridComponent =
            this.coordinator.getComponentFromEntity<HexGridComponent>(
                HEX_GRID_COMPONENT,
                grid
            );
        if (!gridComponent) {
            return null;
        }
        if (
            q < 0 ||
            q >= gridComponent.width ||
            r < 0 ||
            r >= gridComponent.height
        ) {
            return null;
        }
        for (const entity of this.entities) {
            const gridLocationComponent =
                this.coordinator.getComponentFromEntity<HexGridLocationComponent>(
                    HEX_GRID_LOCATION_COMPONENT,
                    entity
                );
            if (!gridLocationComponent) {
                continue;
            }
            if (
                gridLocationComponent.grid === grid &&
                gridLocationComponent.q === q &&
                gridLocationComponent.r === r
            ) {
                return entity;
            }
        }
        return null;
    }
}
