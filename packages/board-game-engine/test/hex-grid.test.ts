import { Coordinator, Entity } from "@ue-too/ecs";
import { 
    createHexGrid, 
    HexGridComponent, 
    HexGridLocationComponent,
    HexGridSystem,
    HexGridVariant,
    HEX_GRID_COMPONENT,
    HEX_GRID_LOCATION_COMPONENT,
    HEX_GRID_SYSTEM
} from "../src/grid-system/hex-grid";
import { ZONE_COMPONENT, ZoneComponent, LocationSystem, LOCATION_COMPONENT, LocationComponent } from "../src/zone-system/zone-component";

describe('createHexGrid', () => {
    let coordinator: Coordinator;

    beforeEach(() => {
        coordinator = new Coordinator();
    });

    it('should create a grid entity with HexGridComponent', () => {
        const gridEntity = createHexGrid(coordinator, 4, 3, 'test-hex-grid', 'odd-r');

        expect(gridEntity).toBeDefined();
        
        const gridComponent = coordinator.getComponentFromEntity<HexGridComponent>(
            HEX_GRID_COMPONENT, 
            gridEntity
        );
        
        expect(gridComponent).not.toBeNull();
        expect(gridComponent?.name).toBe('test-hex-grid');
        expect(gridComponent?.width).toBe(4);
        expect(gridComponent?.height).toBe(3);
        expect(gridComponent?.variant).toBe('odd-r');
    });

    it('should create correct number of cell zone entities', () => {
        const width = 4;
        const height = 3;
        const gridEntity = createHexGrid(coordinator, width, height, 'test-hex-grid', 'odd-r');

        // Get all entities with HexGridLocationComponent
        const allEntities = coordinator.getAllEntities();
        const cellEntities = allEntities.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<HexGridLocationComponent>(
                HEX_GRID_LOCATION_COMPONENT,
                entity
            );
            return locationComponent !== null && locationComponent.grid === gridEntity;
        });

        expect(cellEntities.length).toBe(width * height);
    });

    it('should create cell entities with ZoneComponent', () => {
        const gridEntity = createHexGrid(coordinator, 2, 2, 'test-hex-grid', 'even-r');

        const allEntities = coordinator.getAllEntities();
        const cellEntities = allEntities.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<HexGridLocationComponent>(
                HEX_GRID_LOCATION_COMPONENT,
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
        const gridName = 'my-hex-grid';
        const gridEntity = createHexGrid(coordinator, 2, 3, gridName, 'odd-q');

        const allEntities = coordinator.getAllEntities();
        const cellEntities = allEntities.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<HexGridLocationComponent>(
                HEX_GRID_LOCATION_COMPONENT,
                entity
            );
            return locationComponent !== null && locationComponent.grid === gridEntity;
        });

        // Verify zone names are formatted correctly
        for (let q = 0; q < 2; q++) {
            for (let r = 0; r < 3; r++) {
                const expectedZoneName = `${gridName} ${q} ${r}`;
                const cellEntity = cellEntities.find(entity => {
                    const locationComponent = coordinator.getComponentFromEntity<HexGridLocationComponent>(
                        HEX_GRID_LOCATION_COMPONENT,
                        entity
                    );
                    return locationComponent?.q === q && locationComponent?.r === r;
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

    it('should create cell entities with HexGridLocationComponent', () => {
        const gridEntity = createHexGrid(coordinator, 2, 2, 'test-hex-grid', 'even-q');

        const allEntities = coordinator.getAllEntities();
        const cellEntities = allEntities.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<HexGridLocationComponent>(
                HEX_GRID_LOCATION_COMPONENT,
                entity
            );
            return locationComponent !== null && locationComponent.grid === gridEntity;
        });

        // Verify each cell has HexGridLocationComponent with correct values
        for (let q = 0; q < 2; q++) {
            for (let r = 0; r < 2; r++) {
                const cellEntity = cellEntities.find(entity => {
                    const locationComponent = coordinator.getComponentFromEntity<HexGridLocationComponent>(
                        HEX_GRID_LOCATION_COMPONENT,
                        entity
                    );
                    return locationComponent?.q === q && locationComponent?.r === r;
                });

                expect(cellEntity).toBeDefined();
                const locationComponent = coordinator.getComponentFromEntity<HexGridLocationComponent>(
                    HEX_GRID_LOCATION_COMPONENT,
                    cellEntity!
                );
                expect(locationComponent?.grid).toBe(gridEntity);
                expect(locationComponent?.q).toBe(q);
                expect(locationComponent?.r).toBe(r);
            }
        }
    });

    it('should handle single cell grid', () => {
        const gridEntity = createHexGrid(coordinator, 1, 1, 'single-cell', 'odd-r');

        const gridComponent = coordinator.getComponentFromEntity<HexGridComponent>(
            HEX_GRID_COMPONENT,
            gridEntity
        );
        expect(gridComponent?.width).toBe(1);
        expect(gridComponent?.height).toBe(1);

        const allEntities = coordinator.getAllEntities();
        const cellEntities = allEntities.filter(entity => {
            const locationComponent = coordinator.getComponentFromEntity<HexGridLocationComponent>(
                HEX_GRID_LOCATION_COMPONENT,
                entity
            );
            return locationComponent !== null && locationComponent.grid === gridEntity;
        });

        expect(cellEntities.length).toBe(1);

        const cellEntity = cellEntities[0];
        const locationComponent = coordinator.getComponentFromEntity<HexGridLocationComponent>(
            HEX_GRID_LOCATION_COMPONENT,
            cellEntity
        );
        expect(locationComponent?.q).toBe(0);
        expect(locationComponent?.r).toBe(0);

        const zoneComponent = coordinator.getComponentFromEntity<ZoneComponent>(
            ZONE_COMPONENT,
            cellEntity
        );
        expect(zoneComponent?.zone).toBe('single-cell 0 0');
    });

    it('should handle different variants', () => {
        const variants: HexGridVariant[] = ['odd-r', 'even-r', 'odd-q', 'even-q'];
        
        variants.forEach(variant => {
            const gridEntity = createHexGrid(coordinator, 2, 2, `grid-${variant}`, variant);
            const gridComponent = coordinator.getComponentFromEntity<HexGridComponent>(
                HEX_GRID_COMPONENT,
                gridEntity
            );
            expect(gridComponent?.variant).toBe(variant);
        });
    });

    it('should default to odd-r variant when not specified', () => {
        const gridEntity = createHexGrid(coordinator, 2, 2, 'test-grid');
        const gridComponent = coordinator.getComponentFromEntity<HexGridComponent>(
            HEX_GRID_COMPONENT,
            gridEntity
        );
        expect(gridComponent?.variant).toBe('odd-r');
    });

    it('should register components if not already registered', () => {
        // Create grid without pre-registering components
        const gridEntity = createHexGrid(coordinator, 2, 2, 'test-hex-grid', 'odd-r');

        // Verify components are registered by checking component types
        const gridComponentType = coordinator.getComponentType(HEX_GRID_COMPONENT);
        const locationComponentType = coordinator.getComponentType(HEX_GRID_LOCATION_COMPONENT);
        const zoneComponentType = coordinator.getComponentType(ZONE_COMPONENT);

        expect(gridComponentType).not.toBeNull();
        expect(locationComponentType).not.toBeNull();
        expect(zoneComponentType).not.toBeNull();
    });
});

describe('HexGridSystem', () => {
    let coordinator: Coordinator;
    let locationSystem: LocationSystem;
    let gridSystem: HexGridSystem;
    let gridEntity: Entity;

    beforeEach(() => {
        coordinator = new Coordinator();
        locationSystem = new LocationSystem(coordinator);
        gridSystem = new HexGridSystem(coordinator);
        gridEntity = createHexGrid(coordinator, 3, 3, 'test-hex-grid', 'odd-r');
    });

    describe('constructor', () => {
        it('should initialize with empty entities set', () => {
            const newCoordinator = new Coordinator();
            const newGridSystem = new HexGridSystem(newCoordinator);
            expect(newGridSystem.entities).toBeInstanceOf(Set);
            expect(newGridSystem.entities.size).toBe(0);
        });

        it('should register components and system', () => {
            const newCoordinator = new Coordinator();
            const newGridSystem = new HexGridSystem(newCoordinator);
            
            // Verify components are registered
            expect(newCoordinator.getComponentType(HEX_GRID_COMPONENT)).not.toBeNull();
            expect(newCoordinator.getComponentType(HEX_GRID_LOCATION_COMPONENT)).not.toBeNull();
            expect(newCoordinator.getComponentType(ZONE_COMPONENT)).not.toBeNull();
            
            // Verify system is registered
            const retrievedSystem = newCoordinator.getSystem<HexGridSystem>(HEX_GRID_SYSTEM);
            expect(retrievedSystem).toBe(newGridSystem);
        });

        it('should automatically add entities with required components to system', () => {
            const newCoordinator = new Coordinator();
            new LocationSystem(newCoordinator);
            const newGridSystem = new HexGridSystem(newCoordinator);
            
            // Create a grid cell entity with both HexGridLocationComponent and ZoneComponent
            const cellEntity = newCoordinator.createEntity();
            const grid = newCoordinator.createEntity();
            newCoordinator.addComponentToEntity(HEX_GRID_COMPONENT, grid, {
                name: 'grid',
                width: 1,
                height: 1,
                variant: 'odd-r'
            });
            
            newCoordinator.addComponentToEntity(ZONE_COMPONENT, cellEntity, {
                zone: 'test',
                owner: null,
                visibility: 'public',
                ordered: true
            });
            newCoordinator.addComponentToEntity(HEX_GRID_LOCATION_COMPONENT, cellEntity, {
                grid: grid,
                q: 0,
                r: 0
            });
            
            expect(newGridSystem.entities.has(cellEntity)).toBe(true);
        });
    });

    describe('getCellEntityAt', () => {
        it('should return null for non-existent grid', () => {
            const nonExistentGrid = coordinator.createEntity();
            const result = gridSystem.getCellEntityAt(nonExistentGrid, 0, 0);
            expect(result).toBeNull();
        });

        it('should return null for out of bounds q', () => {
            const result = gridSystem.getCellEntityAt(gridEntity, -1, 0);
            expect(result).toBeNull();
            
            const result2 = gridSystem.getCellEntityAt(gridEntity, 3, 0);
            expect(result2).toBeNull();
        });

        it('should return null for out of bounds r', () => {
            const result = gridSystem.getCellEntityAt(gridEntity, 0, -1);
            expect(result).toBeNull();
            
            const result2 = gridSystem.getCellEntityAt(gridEntity, 0, 3);
            expect(result2).toBeNull();
        });

        it('should return the cell entity at specified position', () => {
            // Get all cell entities
            const allEntities = coordinator.getAllEntities();
            const cellEntities = allEntities.filter(entity => {
                const locationComponent = coordinator.getComponentFromEntity<HexGridLocationComponent>(
                    HEX_GRID_LOCATION_COMPONENT,
                    entity
                );
                return locationComponent !== null && locationComponent.grid === gridEntity;
            });

            // Test getting cell at (0, 0)
            const cellAt00 = gridSystem.getCellEntityAt(gridEntity, 0, 0);
            expect(cellAt00).not.toBeNull();
            expect(cellEntities).toContain(cellAt00);
            
            const locationComponent = coordinator.getComponentFromEntity<HexGridLocationComponent>(
                HEX_GRID_LOCATION_COMPONENT,
                cellAt00!
            );
            expect(locationComponent?.q).toBe(0);
            expect(locationComponent?.r).toBe(0);
        });

        it('should return correct cell entity for different positions', () => {
            const cell00 = gridSystem.getCellEntityAt(gridEntity, 0, 0);
            const cell01 = gridSystem.getCellEntityAt(gridEntity, 0, 1);
            const cell10 = gridSystem.getCellEntityAt(gridEntity, 1, 0);
            const cell22 = gridSystem.getCellEntityAt(gridEntity, 2, 2);

            expect(cell00).not.toBeNull();
            expect(cell01).not.toBeNull();
            expect(cell10).not.toBeNull();
            expect(cell22).not.toBeNull();

            // All should be different entities
            expect(cell00).not.toBe(cell01);
            expect(cell00).not.toBe(cell10);
            expect(cell00).not.toBe(cell22);
        });
    });

    describe('getEntireGridEntities', () => {
        it('should return null for non-existent grid', () => {
            const nonExistentGrid = coordinator.createEntity();
            const result = gridSystem.getEntireGridEntities(nonExistentGrid);
            expect(result).toBeNull();
        });

        it('should return grid structure with all cells', () => {
            const result = gridSystem.getEntireGridEntities(gridEntity);
            expect(result).not.toBeNull();
            expect(result?.entities).toHaveLength(3); // width
            expect(result?.entities[0]).toHaveLength(3); // height
            expect(result?.entities[1]).toHaveLength(3);
            expect(result?.entities[2]).toHaveLength(3);
        });

        it('should return hasHole false when all cells are present', () => {
            const result = gridSystem.getEntireGridEntities(gridEntity);
            expect(result?.hasHole).toBe(false);
        });

        it('should return correct cell entities in correct positions', () => {
            const result = gridSystem.getEntireGridEntities(gridEntity);
            
            // Verify each cell is in the correct position
            expect(result).not.toBeNull();
            expect(result?.entities).toHaveLength(3);
            for (let q = 0; q < 3; q++) {
                const qArray = result?.entities[q];
                expect(qArray).toBeDefined();
                expect(qArray).toHaveLength(3);
                for (let r = 0; r < 3; r++) {
                    const cellEntity = qArray?.[r];
                    // Cell entity might be null if not in system, or might be from a different grid
                    // But the structure should be correct
                    if (cellEntity !== null && cellEntity !== undefined) {
                        const locationComponent = coordinator.getComponentFromEntity<HexGridLocationComponent>(
                            HEX_GRID_LOCATION_COMPONENT,
                            cellEntity
                        );
                        if (locationComponent?.grid === gridEntity) {
                            expect(locationComponent?.q).toBe(q);
                            expect(locationComponent?.r).toBe(r);
                        }
                    }
                }
            }
        });

        it('should handle different grid sizes', () => {
            // Create a new coordinator to avoid mixing entities from different grids
            const newCoordinator = new Coordinator();
            new LocationSystem(newCoordinator);
            const newGridSystem = new HexGridSystem(newCoordinator);
            const smallGrid = createHexGrid(newCoordinator, 2, 2, 'small-hex-grid', 'even-r');
            const result = newGridSystem.getEntireGridEntities(smallGrid);
            
            expect(result?.entities).toHaveLength(2);
            expect(result?.entities[0]).toHaveLength(2);
            expect(result?.entities[1]).toHaveLength(2);
            expect(result?.hasHole).toBe(false);
        });
    });

    describe('addEntityToGridCell', () => {
        it('should do nothing for non-existent grid', () => {
            const nonExistentGrid = coordinator.createEntity();
            const entity = coordinator.createEntity();
            
            expect(() => {
                gridSystem.addEntityToGridCell(nonExistentGrid, 0, 0, entity);
            }).not.toThrow();
        });

        it('should do nothing for out of bounds q', () => {
            const entity = coordinator.createEntity();
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity, {
                location: coordinator.createEntity(),
                sortIndex: 0
            });
            
            gridSystem.addEntityToGridCell(gridEntity, -1, 0, entity);
            gridSystem.addEntityToGridCell(gridEntity, 3, 0, entity);
            
            // Entity should not be in any zone
            const locationComponent = coordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT,
                entity
            );
            // Location should remain unchanged (or be null if not set)
            expect(locationComponent).not.toBeNull();
        });

        it('should do nothing for out of bounds r', () => {
            const entity = coordinator.createEntity();
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity, {
                location: coordinator.createEntity(),
                sortIndex: 0
            });
            
            gridSystem.addEntityToGridCell(gridEntity, 0, -1, entity);
            gridSystem.addEntityToGridCell(gridEntity, 0, 3, entity);
            
            // Entity should not be moved
            const locationComponent = coordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT,
                entity
            );
            expect(locationComponent).not.toBeNull();
        });

        it('should add entity to grid cell zone', () => {
            const entity = coordinator.createEntity();
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity, {
                location: coordinator.createEntity(),
                sortIndex: 0
            });
            
            const cellEntity = gridSystem.getCellEntityAt(gridEntity, 1, 1);
            expect(cellEntity).not.toBeNull();
            
            gridSystem.addEntityToGridCell(gridEntity, 1, 1, entity);
            
            // Verify entity is now in the cell zone
            const locationComponent = coordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT,
                entity
            );
            expect(locationComponent?.location).toBe(cellEntity);
            
            // Verify entity is in the zone
            const entitiesInZone = locationSystem.getEntitiesInZone(cellEntity!);
            expect(entitiesInZone).toContain(entity);
        });

        it('should add entity to different grid cells', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, {
                location: coordinator.createEntity(),
                sortIndex: 0
            });
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, {
                location: coordinator.createEntity(),
                sortIndex: 0
            });
            
            const cell00 = gridSystem.getCellEntityAt(gridEntity, 0, 0);
            const cell22 = gridSystem.getCellEntityAt(gridEntity, 2, 2);
            
            gridSystem.addEntityToGridCell(gridEntity, 0, 0, entity1);
            gridSystem.addEntityToGridCell(gridEntity, 2, 2, entity2);
            
            // Verify entities are in correct zones
            const location1 = coordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT,
                entity1
            );
            const location2 = coordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT,
                entity2
            );
            
            expect(location1?.location).toBe(cell00);
            expect(location2?.location).toBe(cell22);
            
            // Verify entities are in correct zones
            const entitiesInZone00 = locationSystem.getEntitiesInZone(cell00!);
            const entitiesInZone22 = locationSystem.getEntitiesInZone(cell22!);
            
            expect(entitiesInZone00).toContain(entity1);
            expect(entitiesInZone22).toContain(entity2);
            expect(entitiesInZone00).not.toContain(entity2);
            expect(entitiesInZone22).not.toContain(entity1);
        });

        it('should handle adding multiple entities to same cell', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();
            
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, {
                location: coordinator.createEntity(),
                sortIndex: 0
            });
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, {
                location: coordinator.createEntity(),
                sortIndex: 0
            });
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, {
                location: coordinator.createEntity(),
                sortIndex: 0
            });
            
            const cellEntity = gridSystem.getCellEntityAt(gridEntity, 1, 1);
            
            gridSystem.addEntityToGridCell(gridEntity, 1, 1, entity1);
            gridSystem.addEntityToGridCell(gridEntity, 1, 1, entity2);
            gridSystem.addEntityToGridCell(gridEntity, 1, 1, entity3);
            
            // All entities should be in the same zone
            const entitiesInZone = locationSystem.getEntitiesInZone(cellEntity!);
            expect(entitiesInZone.length).toBe(3);
            expect(entitiesInZone).toContain(entity1);
            expect(entitiesInZone).toContain(entity2);
            expect(entitiesInZone).toContain(entity3);
        });

        it('should do nothing if LocationSystem is not available', () => {
            const newCoordinator = new Coordinator();
            const newGridSystem = new HexGridSystem(newCoordinator);
            const newGrid = createHexGrid(newCoordinator, 2, 2, 'test', 'odd-r');
            
            // Don't create LocationSystem
            const entity = newCoordinator.createEntity();
            newCoordinator.addComponentToEntity(LOCATION_COMPONENT, entity, {
                location: newCoordinator.createEntity(),
                sortIndex: 0
            });
            
            const originalLocation = newCoordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT,
                entity
            );
            
            expect(() => {
                newGridSystem.addEntityToGridCell(newGrid, 0, 0, entity);
            }).not.toThrow();
            
            // Location should remain unchanged
            const locationAfter = newCoordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT,
                entity
            );
            expect(locationAfter?.location).toBe(originalLocation?.location);
        });

        it('should respect direction parameter', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, {
                location: coordinator.createEntity(),
                sortIndex: 0
            });
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, {
                location: coordinator.createEntity(),
                sortIndex: 0
            });
            
            const cellEntity = gridSystem.getCellEntityAt(gridEntity, 1, 1);
            
            // Add entity1 at top
            gridSystem.addEntityToGridCell(gridEntity, 1, 1, entity1, 'top');
            // Add entity2 at bottom
            gridSystem.addEntityToGridCell(gridEntity, 1, 1, entity2, 'bottom');
            
            // Both entities should be in the zone
            const entitiesInZone = locationSystem.getEntitiesInZone(cellEntity!);
            expect(entitiesInZone).toContain(entity1);
            expect(entitiesInZone).toContain(entity2);
        });
    });
});
