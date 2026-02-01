import { Coordinator } from '@ue-too/ecs';

import {
    GRID_COMPONENT,
    GRID_LOCATION_COMPONENT,
    GridComponent,
    GridLocationComponent,
    TEST_FUNCTION_IN_COMPONENT,
    TestFunctionInComponent,
    addAndDisplace,
} from '../src/grid';

describe('GridSystem', () => {
    let coordinator: Coordinator;

    beforeEach(() => {
        coordinator = new Coordinator();
        coordinator.registerComponent<GridComponent>(GRID_COMPONENT);
        coordinator.registerComponent<GridLocationComponent>(
            GRID_LOCATION_COMPONENT
        );
        coordinator.registerComponent<TestFunctionInComponent>(
            TEST_FUNCTION_IN_COMPONENT
        );
    });

    describe('addAndDisplace', () => {
        it('test the function for adding an entity to a grid and displacing an existing entity', () => {
            const newEntity = coordinator.createEntity();
            const grid = coordinator.createEntity();
            const otherEntity = coordinator.createEntity();

            coordinator.addComponentToEntity<GridLocationComponent>(
                GRID_LOCATION_COMPONENT,
                otherEntity,
                {
                    grid: grid,
                    row: 0,
                    column: 0,
                }
            );
            coordinator.addComponentToEntity<GridComponent>(
                GRID_COMPONENT,
                grid,
                {
                    cells: [[otherEntity]],
                }
            );

            const mockTestFunc = jest.fn();
            coordinator.addComponentToEntity<TestFunctionInComponent>(
                TEST_FUNCTION_IN_COMPONENT,
                newEntity,
                {
                    testFunc: mockTestFunc,
                }
            );

            // newEntity needs a GridLocationComponent for addAndDisplace to work
            coordinator.addComponentToEntity<GridLocationComponent>(
                GRID_LOCATION_COMPONENT,
                newEntity,
                {
                    grid: null,
                    row: null,
                    column: null,
                }
            );

            addAndDisplace(grid, 0, 0, newEntity, coordinator);

            expect(mockTestFunc).toHaveBeenCalledTimes(1);
        });
    });
});
