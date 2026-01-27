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

export type OrthoGridComponent = {
    name: string;
    rows: number;
    columns: number;
};

// each grid cell should also be a zone
export type OrthoGridLocationComponent = {
    grid: Entity;
    row: number;
    column: number;
};

export const ORTHO_GRID_COMPONENT =
    createGlobalComponentName('OrthoGridComponent');
export const ORTHO_GRID_LOCATION_COMPONENT = createGlobalComponentName(
    'OrthoGridLocationComponent'
);
export const ORTHO_GRID_SYSTEM = createGlobalSystemName('OrthoGridSystem');

export function createOrthoGrid(
    coordinator: Coordinator,
    rows: number,
    columns: number,
    name: string
): Entity {
    const gridEntity = coordinator.createEntity();

    coordinator.registerComponent<OrthoGridComponent>(ORTHO_GRID_COMPONENT);
    coordinator.registerComponent<OrthoGridLocationComponent>(
        ORTHO_GRID_LOCATION_COMPONENT
    );
    coordinator.registerComponent<ZoneComponent>(ZONE_COMPONENT);

    coordinator.addComponentToEntity(ORTHO_GRID_COMPONENT, gridEntity, {
        name: name,
        rows: rows,
        columns: columns,
    });

    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const gridCellZoneEntity = coordinator.createEntity();
            coordinator.addComponentToEntity(
                ZONE_COMPONENT,
                gridCellZoneEntity,
                {
                    zone: name + ' ' + row + ' ' + column,
                    owner: null,
                    visibility: 'public',
                    ordered: true,
                }
            );

            coordinator.addComponentToEntity(
                ORTHO_GRID_LOCATION_COMPONENT,
                gridCellZoneEntity,
                {
                    grid: gridEntity,
                    row: row,
                    column: column,
                }
            );
        }
    }

    return gridEntity;
}

export class OrthoGridSystem implements System {
    entities: Set<Entity>;
    private coordinator: Coordinator;

    constructor(coordinator: Coordinator) {
        this.entities = new Set<Entity>();
        this.coordinator = coordinator;
        this.coordinator.registerComponent<OrthoGridComponent>(
            ORTHO_GRID_COMPONENT
        );
        this.coordinator.registerComponent<OrthoGridLocationComponent>(
            ORTHO_GRID_LOCATION_COMPONENT
        );
        this.coordinator.registerComponent<ZoneComponent>(ZONE_COMPONENT);
        this.coordinator.registerSystem(ORTHO_GRID_SYSTEM, this);

        const gridComponentType =
            this.coordinator.getComponentType(ORTHO_GRID_COMPONENT);
        if (gridComponentType === null) {
            throw new Error('OrthoGridComponent not registered');
        }
        const gridLocationComponentType = this.coordinator.getComponentType(
            ORTHO_GRID_LOCATION_COMPONENT
        );
        if (gridLocationComponentType === null) {
            throw new Error('OrthoGridLocationComponent not registered');
        }
        const zoneComponentType =
            this.coordinator.getComponentType(ZONE_COMPONENT);
        if (zoneComponentType === null) {
            throw new Error('ZoneComponent not registered');
        }
        this.coordinator.setSystemSignature(
            ORTHO_GRID_SYSTEM,
            (1 << gridLocationComponentType) | (1 << zoneComponentType)
        );
    }

    addEntityToGridCell(
        grid: Entity,
        row: number,
        column: number,
        entity: Entity,
        direction: 'top' | 'bottom' = 'top',
        displace: boolean = false
    ): void {
        const gridComponent =
            this.coordinator.getComponentFromEntity<OrthoGridComponent>(
                ORTHO_GRID_COMPONENT,
                grid
            );
        if (!gridComponent) {
            return;
        }
        if (
            row < 0 ||
            row >= gridComponent.rows ||
            column < 0 ||
            column >= gridComponent.columns
        ) {
            return;
        }
        let zoneAtCell: Entity | null = null;
        for (const entity of this.entities) {
            const gridLocationComponent =
                this.coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                    ORTHO_GRID_LOCATION_COMPONENT,
                    entity
                );
            if (!gridLocationComponent) {
                continue;
            }
            if (
                gridLocationComponent.grid === grid &&
                gridLocationComponent.row === row &&
                gridLocationComponent.column === column
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
        locationSystem.addEntityToZone(zoneAtCell, entity, 'top');
    }

    getEntireGridEntities(
        grid: Entity
    ): { entities: (Entity | null)[][]; hasHole: boolean } | null {
        const gridComponent =
            this.coordinator.getComponentFromEntity<OrthoGridComponent>(
                ORTHO_GRID_COMPONENT,
                grid
            );
        if (!gridComponent) {
            return null;
        }

        const entities: (Entity | null)[][] = Array.from(
            { length: gridComponent.rows },
            () => Array.from({ length: gridComponent.columns }, () => null)
        );

        for (const entity of this.entities) {
            const gridLocationComponent =
                this.coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                    ORTHO_GRID_LOCATION_COMPONENT,
                    entity
                );
            if (!gridLocationComponent) {
                continue;
            }
            entities[gridLocationComponent.row][gridLocationComponent.column] =
                entity;
        }
        let hasHole = false;
        for (let row = 0; row < gridComponent.rows; row++) {
            for (let column = 0; column < gridComponent.columns; column++) {
                if (entities[row][column] === null) {
                    hasHole = true;
                }
            }
        }
        return { entities, hasHole };
    }

    getCellEntityAt(grid: Entity, row: number, column: number): Entity | null {
        const gridComponent =
            this.coordinator.getComponentFromEntity<OrthoGridComponent>(
                ORTHO_GRID_COMPONENT,
                grid
            );
        if (!gridComponent) {
            return null;
        }
        if (
            row < 0 ||
            row >= gridComponent.rows ||
            column < 0 ||
            column >= gridComponent.columns
        ) {
            return null;
        }
        for (const entity of this.entities) {
            const gridLocationComponent =
                this.coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                    ORTHO_GRID_LOCATION_COMPONENT,
                    entity
                );
            if (!gridLocationComponent) {
                continue;
            }
            if (
                gridLocationComponent.grid === grid &&
                gridLocationComponent.row === row &&
                gridLocationComponent.column === column
            ) {
                return entity;
            }
        }
        return null;
    }
}
