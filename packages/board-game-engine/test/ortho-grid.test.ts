import { Coordinator, Entity } from "@ue-too/ecs";
import { 
    createOrthoGrid, 
    OrthoGridComponent, 
    OrthoGridLocationComponent,
    ORTHO_GRID_COMPONENT,
    ORTHO_GRID_LOCATION_COMPONENT
} from "../src/grid-system/ortho-grid";
import { ZONE_COMPONENT, ZoneComponent } from "../src/zone-system/zone-component";

describe('createOrthoGrid', () => {
    let coordinator: Coordinator;

    beforeEach(() => {
        coordinator = new Coordinator();
    });

    it('should create a grid entity with OrthoGridComponent', () => {
        const gridEntity = createOrthoGrid(coordinator, 3, 4, 'test-grid');

        expect(gridEntity).toBeDefined();
        
        const gridComponent = coordinator.getComponentFromEntity<OrthoGridComponent>(
            ORTHO_GRID_COMPONENT, 
            gridEntity
        );
        
        expect(gridComponent).not.toBeNull();
        expect(gridComponent?.name).toBe('test-grid');
        expect(gridComponent?.rows).toBe(3);
        expect(gridComponent?.columns).toBe(4);
    });

    it('should create correct number of cell zone entities', () => {
        const rows = 3;
        const columns = 4;
        const gridEntity = createOrthoGrid(coordinator, rows, columns, 'test-grid');

        // Get all entities with OrthoGridLocationComponent
        const allEntities = coordinator.getAllEntities();
        const cellEntities = allEntities.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                ORTHO_GRID_LOCATION_COMPONENT,
                entity
            );
            return locationComponent !== null && locationComponent.grid === gridEntity;
        });

        expect(cellEntities.length).toBe(rows * columns);
    });

    it('should create cell entities with ZoneComponent', () => {
        const gridEntity = createOrthoGrid(coordinator, 2, 2, 'test-grid');

        const allEntities = coordinator.getAllEntities();
        const cellEntities = allEntities.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                ORTHO_GRID_LOCATION_COMPONENT,
                entity
            );
            return locationComponent !== null && locationComponent.grid === gridEntity;
        });

        // Verify each cell has ZoneComponent
        cellEntities.forEach(cellEntity => {
            const zoneComponent = coordinator.getComponentFromEntity<ZoneComponent>(
                ZONE_COMPONENT,
                cellEntity
            );
            expect(zoneComponent).not.toBeNull();
            expect(zoneComponent?.ordered).toBe(true);
            expect(zoneComponent?.visibility).toBe('public');
            expect(zoneComponent?.owner).toBeNull();
        });
    });

    it('should create cell entities with correct zone names', () => {
        const gridName = 'my-grid';
        const gridEntity = createOrthoGrid(coordinator, 2, 3, gridName);

        const allEntities = coordinator.getAllEntities();
        const cellEntities = allEntities.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                ORTHO_GRID_LOCATION_COMPONENT,
                entity
            );
            return locationComponent !== null && locationComponent.grid === gridEntity;
        });

        // Verify zone names are formatted correctly
        for (let row = 0; row < 2; row++) {
            for (let column = 0; column < 3; column++) {
                const expectedZoneName = `${gridName} ${row} ${column}`;
                const cellEntity = cellEntities.find(entity => {
                    const locationComponent = coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                        ORTHO_GRID_LOCATION_COMPONENT,
                        entity
                    );
                    return locationComponent?.row === row && locationComponent?.column === column;
                });

                expect(cellEntity).toBeDefined();
                const zoneComponent = coordinator.getComponentFromEntity<ZoneComponent>(
                    ZONE_COMPONENT,
                    cellEntity!
                );
                expect(zoneComponent?.zone).toBe(expectedZoneName);
            }
        }
    });

    it('should create cell entities with OrthoGridLocationComponent', () => {
        const gridEntity = createOrthoGrid(coordinator, 2, 2, 'test-grid');

        const allEntities = coordinator.getAllEntities();
        const cellEntities = allEntities.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                ORTHO_GRID_LOCATION_COMPONENT,
                entity
            );
            return locationComponent !== null && locationComponent.grid === gridEntity;
        });

        // Verify each cell has OrthoGridLocationComponent with correct values
        for (let row = 0; row < 2; row++) {
            for (let column = 0; column < 2; column++) {
                const cellEntity = cellEntities.find(entity => {
                    const locationComponent = coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                        ORTHO_GRID_LOCATION_COMPONENT,
                        entity
                    );
                    return locationComponent?.row === row && locationComponent?.column === column;
                });

                expect(cellEntity).toBeDefined();
                const locationComponent = coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                    ORTHO_GRID_LOCATION_COMPONENT,
                    cellEntity!
                );
                expect(locationComponent?.grid).toBe(gridEntity);
                expect(locationComponent?.row).toBe(row);
                expect(locationComponent?.column).toBe(column);
            }
        }
    });

    it('should handle single cell grid', () => {
        const gridEntity = createOrthoGrid(coordinator, 1, 1, 'single-cell');

        const gridComponent = coordinator.getComponentFromEntity<OrthoGridComponent>(
            ORTHO_GRID_COMPONENT,
            gridEntity
        );
        expect(gridComponent?.rows).toBe(1);
        expect(gridComponent?.columns).toBe(1);

        const allEntities = coordinator.getAllEntities();
        const cellEntities = allEntities.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                ORTHO_GRID_LOCATION_COMPONENT,
                entity
            );
            return locationComponent !== null && locationComponent.grid === gridEntity;
        });

        expect(cellEntities.length).toBe(1);

        const cellEntity = cellEntities[0];
        const locationComponent = coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
            ORTHO_GRID_LOCATION_COMPONENT,
            cellEntity
        );
        expect(locationComponent?.row).toBe(0);
        expect(locationComponent?.column).toBe(0);

        const zoneComponent = coordinator.getComponentFromEntity<ZoneComponent>(
            ZONE_COMPONENT,
            cellEntity
        );
        expect(zoneComponent?.zone).toBe('single-cell 0 0');
    });

    it('should handle large grid', () => {
        const rows = 10;
        const columns = 10;
        const gridEntity = createOrthoGrid(coordinator, rows, columns, 'large-grid');

        const gridComponent = coordinator.getComponentFromEntity<OrthoGridComponent>(
            ORTHO_GRID_COMPONENT,
            gridEntity
        );
        expect(gridComponent?.rows).toBe(rows);
        expect(gridComponent?.columns).toBe(columns);

        const allEntities = coordinator.getAllEntities();
        const cellEntities = allEntities.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                ORTHO_GRID_LOCATION_COMPONENT,
                entity
            );
            return locationComponent !== null && locationComponent.grid === gridEntity;
        });

        expect(cellEntities.length).toBe(rows * columns);
    });

    it('should register components if not already registered', () => {
        // Create grid without pre-registering components
        const gridEntity = createOrthoGrid(coordinator, 2, 2, 'test-grid');

        // Verify components are registered by checking component types
        const gridComponentType = coordinator.getComponentType(ORTHO_GRID_COMPONENT);
        const locationComponentType = coordinator.getComponentType(ORTHO_GRID_LOCATION_COMPONENT);
        const zoneComponentType = coordinator.getComponentType(ZONE_COMPONENT);

        expect(gridComponentType).not.toBeNull();
        expect(locationComponentType).not.toBeNull();
        expect(zoneComponentType).not.toBeNull();
    });

    it('should create all cells with ordered zones', () => {
        const gridEntity = createOrthoGrid(coordinator, 3, 3, 'ordered-grid');

        const allEntities = coordinator.getAllEntities();
        const cellEntities = allEntities.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                ORTHO_GRID_LOCATION_COMPONENT,
                entity
            );
            return locationComponent !== null && locationComponent.grid === gridEntity;
        });

        // Verify all cells have ordered zones
        cellEntities.forEach(cellEntity => {
            const zoneComponent = coordinator.getComponentFromEntity<ZoneComponent>(
                ZONE_COMPONENT,
                cellEntity
            );
            expect(zoneComponent?.ordered).toBe(true);
        });
    });

    it('should create unique entities for each cell', () => {
        const gridEntity = createOrthoGrid(coordinator, 2, 2, 'test-grid');

        const allEntities = coordinator.getAllEntities();
        const cellEntities = allEntities.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                ORTHO_GRID_LOCATION_COMPONENT,
                entity
            );
            return locationComponent !== null && locationComponent.grid === gridEntity;
        });

        // Verify all cell entities are unique
        const uniqueEntities = new Set(cellEntities);
        expect(uniqueEntities.size).toBe(cellEntities.length);
    });

    it('should handle different grid names', () => {
        // Create first grid and verify it works
        const grid1 = createOrthoGrid(coordinator, 2, 2, 'grid-1');
        const grid1Component = coordinator.getComponentFromEntity<OrthoGridComponent>(
            ORTHO_GRID_COMPONENT,
            grid1
        );
        expect(grid1Component).not.toBeNull();
        expect(grid1Component?.name).toBe('grid-1');
        
        // Get grid1 cells
        const allEntitiesBefore = coordinator.getAllEntities();
        const grid1Cells = allEntitiesBefore.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                ORTHO_GRID_LOCATION_COMPONENT,
                entity
            );
            return locationComponent !== null && locationComponent.grid === grid1;
        });
        expect(grid1Cells.length).toBe(4);
        
        // Verify grid1 zone names
        grid1Cells.forEach(cell => {
            const zoneComponent = coordinator.getComponentFromEntity<ZoneComponent>(
                ZONE_COMPONENT,
                cell
            );
            expect(zoneComponent?.zone).toContain('grid-1');
        });

        // Create second grid with different name (components are now idempotent, so grid1 data is preserved)
        const grid2 = createOrthoGrid(coordinator, 2, 2, 'grid-2');
        const grid2Component = coordinator.getComponentFromEntity<OrthoGridComponent>(
            ORTHO_GRID_COMPONENT,
            grid2
        );
        expect(grid2Component).not.toBeNull();
        expect(grid2Component?.name).toBe('grid-2');

        // Verify grid1 is still accessible after creating grid2 (idempotent registration preserves data)
        const grid1ComponentAfter = coordinator.getComponentFromEntity<OrthoGridComponent>(
            ORTHO_GRID_COMPONENT,
            grid1
        );
        expect(grid1ComponentAfter).not.toBeNull();
        expect(grid1ComponentAfter?.name).toBe('grid-1');

        // Get grid2 cells
        const allEntitiesAfter = coordinator.getAllEntities();
        const grid2Cells = allEntitiesAfter.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                ORTHO_GRID_LOCATION_COMPONENT,
                entity
            );
            return locationComponent !== null && locationComponent.grid === grid2;
        });
        expect(grid2Cells.length).toBe(4);

        // Verify grid1 cells are still accessible
        const grid1CellsAfter = allEntitiesAfter.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<OrthoGridLocationComponent>(
                ORTHO_GRID_LOCATION_COMPONENT,
                entity
            );
            return locationComponent !== null && locationComponent.grid === grid1;
        });
        expect(grid1CellsAfter.length).toBe(4);

        // Verify grid2 zone names contain 'grid-2'
        grid2Cells.forEach(cell => {
            const zoneComponent = coordinator.getComponentFromEntity<ZoneComponent>(
                ZONE_COMPONENT,
                cell
            );
            expect(zoneComponent?.zone).toContain('grid-2');
        });
    });
});
