import { Coordinator, createGlobalComponentName, createGlobalSystemName, Entity, System } from "@ue-too/ecs";
import { LOCATION_COMPONENT, LocationComponent, ZONE_COMPONENT, ZoneComponent } from "src/zone-system";

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

export const ORTHO_GRID_COMPONENT = createGlobalComponentName("OrthoGridComponent");
export const ORTHO_GRID_LOCATION_COMPONENT = createGlobalComponentName("OrthoGridLocationComponent");
export const ORTHO_GRID_SYSTEM = createGlobalSystemName("OrthoGridSystem");

export function createOrthoGrid(coordinator: Coordinator, rows: number, columns: number, name: string): Entity {
    const gridEntity = coordinator.createEntity();

    coordinator.registerComponent<OrthoGridComponent>(ORTHO_GRID_COMPONENT);
    coordinator.registerComponent<OrthoGridLocationComponent>(ORTHO_GRID_LOCATION_COMPONENT);
    coordinator.registerComponent<ZoneComponent>(ZONE_COMPONENT);

    coordinator.addComponentToEntity(ORTHO_GRID_COMPONENT, gridEntity, {
        name: name,
        rows: rows,
        columns: columns
    });

    for(let row = 0; row < rows; row++) {
        for(let column = 0; column < columns; column++) {
            const gridCellZoneEntity = coordinator.createEntity();
            coordinator.addComponentToEntity(ZONE_COMPONENT, gridCellZoneEntity, {
                zone: name + " " + row + " " + column,
                owner: null,
                visibility: "public",
                ordered: true
            });

            coordinator.addComponentToEntity(ORTHO_GRID_LOCATION_COMPONENT, gridCellZoneEntity, {
                grid: gridEntity,
                row: row,
                column: column
            });
        }
    }

    return gridEntity;
}
