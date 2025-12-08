import { System, Coordinator, Entity, ComponentType } from "@ue-too/ecs";

export const GRID_COMPONENT = "Grid";
export const GRID_LOCATION_COMPONENT = "GridLocation";
export const TEST_FUNCTION_IN_COMPONENT = "TestFunctionInComponent";

export type GridComponent = {
    cells: Entity[][];
};

export type GridLocationComponent = {
    grid: Entity | null;
    row: number | null;
    column: number | null;
};

export type TestFunctionInComponent = {
    testFunc: () => void;
}

export function addAndDisplace(grid: Entity, row: number, column: number, entity: Entity, coordinator: Coordinator): void {
    const gridComponentOfGrid = coordinator.getComponentFromEntity<GridComponent>(GRID_COMPONENT, grid);
    const testFunctionInComponentOfEntity = coordinator.getComponentFromEntity<TestFunctionInComponent>(TEST_FUNCTION_IN_COMPONENT, entity);
    if(!testFunctionInComponentOfEntity) {
        throw new Error(entity + " does not have a test function component");
    }
    if(!gridComponentOfGrid) {
        throw new Error(grid + " is not a grid, thus cannot be added to");
    }
    const gridLocationComponentOfEntity = coordinator.getComponentFromEntity<GridLocationComponent>(GRID_LOCATION_COMPONENT, entity);

    if(!gridLocationComponentOfEntity) {
        throw new Error(entity + " is not in a grid, thus cannot be added to " + grid);
    }

    if(row < 0 || row >= gridComponentOfGrid.cells.length) {
        throw new Error("Row " + row + " is out of bounds for grid " + grid);
    }

    if(column < 0 || column >= gridComponentOfGrid.cells[row].length) {
        throw new Error("Column " + column + " is out of bounds for grid " + grid);
    }

    const originalEntity = gridComponentOfGrid.cells[row][column];

    if(originalEntity) {
        const originalGridLocationComponent = coordinator.getComponentFromEntity<GridLocationComponent>(GRID_LOCATION_COMPONENT, originalEntity);

        if(originalGridLocationComponent) {
            originalGridLocationComponent.grid = null;
            originalGridLocationComponent.row = null;
            originalGridLocationComponent.column = null;
        }
    }

    testFunctionInComponentOfEntity.testFunc();
    gridComponentOfGrid.cells[row][column] = entity;
    gridLocationComponentOfEntity.grid = grid;
    gridLocationComponentOfEntity.row = row;
    gridLocationComponentOfEntity.column = column;
}
