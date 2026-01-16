import { Coordinator, createGlobalComponentName, createGlobalSystemName, Entity, System } from "@ue-too/ecs";

export type OrthoGridComponent = {
    rows: number;
    columns: number;
    stackable: boolean;
};

export type OrthoGridLocationComponent = {
    grid: Entity;
    row: number;
    column: number;
    stackIndex: number;
};

export const ORTHO_GRID_COMPONENT = createGlobalComponentName("OrthoGridComponent");
export const ORTHO_GRID_LOCATION_COMPONENT = createGlobalComponentName("OrthoGridLocationComponent");
export const ORTHO_GRID_SYSTEM = createGlobalSystemName("OrthoGridSystem");

export class OrthoLocationSystem implements System {
    entities: Set<Entity>;
    private coordinator: Coordinator;

    constructor(coordinator: Coordinator) {
        this.coordinator = coordinator;
        this.entities = new Set();
        this.coordinator.registerComponent<OrthoGridComponent>(ORTHO_GRID_COMPONENT);
        this.coordinator.registerComponent<OrthoGridLocationComponent>(ORTHO_GRID_LOCATION_COMPONENT);
        const orthoGridComponentType = this.coordinator.getComponentType(ORTHO_GRID_LOCATION_COMPONENT);
        if(orthoGridComponentType === null) {
            throw new Error('OrthoGridLocationComponent not registered');
        }
        this.coordinator.setSystemSignature(ORTHO_GRID_SYSTEM, 1 << orthoGridComponentType);
    }

    getGrid(gridEntity: Entity): (Entity | null)[][] {
        const gridComponent = this.coordinator.getComponentFromEntity<OrthoGridComponent>(ORTHO_GRID_COMPONENT, gridEntity);
        if(!gridComponent) {
            throw new Error('Grid component not found');
        }
        const grid: (Entity | null)[][] = [];
        for(let i = 0; i < gridComponent.rows; i++) {
            const row: (Entity | null) [] = [];
            for(let j = 0; j < gridComponent.columns; j++) {
                row.push(null);
            }
            grid.push(row);
        }
        for(const entity of this.entities) {
            const orthoGridLocationComponent = this.coordinator.getComponentFromEntity<OrthoGridLocationComponent>(ORTHO_GRID_LOCATION_COMPONENT, entity);
            if(orthoGridLocationComponent?.grid === gridEntity) {
                grid[orthoGridLocationComponent.row][orthoGridLocationComponent.column] = entity;
            }
        }
        return grid;
    }

}
