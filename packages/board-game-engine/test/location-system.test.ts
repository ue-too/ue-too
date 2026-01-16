import { Coordinator, Entity } from "@ue-too/ecs";
import { LocationSystem, LocationComponent, ZoneComponent, LOCATION_COMPONENT, ZONE_COMPONENT } from "../src/zone-system/zone-component";

describe('LocationSystem', () => {
    let coordinator: Coordinator;
    let locationSystem: LocationSystem;
    let zoneEntity: Entity;
    let otherZoneEntity: Entity;

    beforeEach(() => {
        coordinator = new Coordinator();
        coordinator.registerComponent<LocationComponent>(LOCATION_COMPONENT);
        coordinator.registerComponent<ZoneComponent>(ZONE_COMPONENT);
        locationSystem = new LocationSystem(coordinator);
        
        zoneEntity = coordinator.createEntity();
        otherZoneEntity = coordinator.createEntity();
    });

    describe('constructor', () => {
        it('should initialize with empty entities set', () => {
            expect(locationSystem.entities).toBeInstanceOf(Set);
            expect(locationSystem.entities.size).toBe(0);
        });

        it('should store the coordinator reference', () => {
            expect(locationSystem).toBeDefined();
            // Coordinator is private, but we can verify it works by using it
            expect(locationSystem.getEntitiesInZone(zoneEntity)).toEqual([]);
        });

        it('should automatically add entities with LocationComponent to system', () => {
            const entity = coordinator.createEntity();
            const location: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity, location);
            
            expect(locationSystem.entities.has(entity)).toBe(true);
            expect(locationSystem.entities.size).toBe(1);
        });

        it('should not add entities without LocationComponent to system', () => {
            const entity = coordinator.createEntity();
            // Don't add LocationComponent
            
            expect(locationSystem.entities.has(entity)).toBe(false);
            expect(locationSystem.entities.size).toBe(0);
        });
    });

    describe('getEntitiesInZone', () => {
        it('should return empty array for non-existent zone entity', () => {
            const nonExistentZone = coordinator.createEntity();
            const result = locationSystem.getEntitiesInZone(nonExistentZone);
            expect(result).toEqual([]);
        });

        it('should return empty array for zone entity without ZoneComponent', () => {
            // Create entity but don't add ZoneComponent
            const result = locationSystem.getEntitiesInZone(zoneEntity);
            expect(result).toEqual([]);
        });

        it('should return empty array for zone with no entities', () => {
            const zoneComponent: ZoneComponent = {
                zone: 'test-zone',
                owner: null,
                visibility: 'public',
                ordered: false
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent);

            const result = locationSystem.getEntitiesInZone(zoneEntity);
            expect(result).toEqual([]);
        });

        it('should return entities in zone when zone is unordered', () => {
            const zoneComponent: ZoneComponent = {
                zone: 'test-zone',
                owner: null,
                visibility: 'public',
                ordered: false
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent);

            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 2 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 3 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);

            const result = locationSystem.getEntitiesInZone(zoneEntity);
            expect(result).toHaveLength(3);
            expect(result).toContain(entity1);
            expect(result).toContain(entity2);
            expect(result).toContain(entity3);
        });

        it('should return entities in sorted order when zone is ordered', () => {
            const zoneComponent: ZoneComponent = {
                zone: 'test-zone',
                owner: null,
                visibility: 'public',
                ordered: true
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent);

            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 3 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 2 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);

            const result = locationSystem.getEntitiesInZone(zoneEntity);
            expect(result).toHaveLength(3);
            expect(result[0]).toBe(entity2); // sortIndex 1
            expect(result[1]).toBe(entity3); // sortIndex 2
            expect(result[2]).toBe(entity1); // sortIndex 3
        });

        it('should only return entities in the specified zone', () => {
            const zoneComponent1: ZoneComponent = {
                zone: 'zone-1',
                owner: null,
                visibility: 'public',
                ordered: false
            };
            const zoneComponent2: ZoneComponent = {
                zone: 'zone-2',
                owner: null,
                visibility: 'public',
                ordered: false
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent1);
            coordinator.addComponentToEntity(ZONE_COMPONENT, otherZoneEntity, zoneComponent2);

            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: otherZoneEntity, sortIndex: 0 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 0 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);

            const result = locationSystem.getEntitiesInZone(zoneEntity);
            expect(result).toHaveLength(2);
            expect(result).toContain(entity1);
            expect(result).toContain(entity3);
            expect(result).not.toContain(entity2);
        });

        it('should skip entities without LocationComponent', () => {
            const zoneComponent: ZoneComponent = {
                zone: 'test-zone',
                owner: null,
                visibility: 'public',
                ordered: false
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent);

            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            // entity2 has no LocationComponent
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 0 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);
            // entity2 has no LocationComponent, so it won't be in the system

            const result = locationSystem.getEntitiesInZone(zoneEntity);
            expect(result).toHaveLength(2);
            expect(result).toContain(entity1);
            expect(result).toContain(entity3);
            expect(result).not.toContain(entity2);
            // Verify entity2 is not in the system's entities set
            expect(locationSystem.entities.has(entity2)).toBe(false);
        });

        it('should handle entities with same sortIndex in ordered zone', () => {
            const zoneComponent: ZoneComponent = {
                zone: 'test-zone',
                owner: null,
                visibility: 'public',
                ordered: true
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent);

            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 1 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);

            const result = locationSystem.getEntitiesInZone(zoneEntity);
            expect(result).toHaveLength(3);
            // All have same sortIndex, order is stable but not guaranteed
            expect(result).toContain(entity1);
            expect(result).toContain(entity2);
            expect(result).toContain(entity3);
        });
    });

    describe('shuffleZone', () => {
        it('should do nothing for non-existent zone entity', () => {
            const nonExistentZone = coordinator.createEntity();
            expect(() => {
                locationSystem.shuffleZone(nonExistentZone);
            }).not.toThrow();
        });

        it('should do nothing for zone entity without ZoneComponent', () => {
            expect(() => {
                locationSystem.shuffleZone(zoneEntity);
            }).not.toThrow();
        });

        it('should do nothing for empty zone', () => {
            const zoneComponent: ZoneComponent = {
                zone: 'test-zone',
                owner: null,
                visibility: 'public',
                ordered: false
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent);

            expect(() => {
                locationSystem.shuffleZone(zoneEntity);
            }).not.toThrow();
        });

        it('should shuffle entities and update sortIndex', () => {
            const zoneComponent: ZoneComponent = {
                zone: 'test-zone',
                owner: null,
                visibility: 'public',
                ordered: true
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent);

            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();
            const entity4 = coordinator.createEntity();
            const entity5 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 2 };
            const location4: LocationComponent = { location: zoneEntity, sortIndex: 3 };
            const location5: LocationComponent = { location: zoneEntity, sortIndex: 4 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity4, location4);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity5, location5);

            // Get original order
            const originalOrder = locationSystem.getEntitiesInZone(zoneEntity);
            expect(originalOrder).toEqual([entity1, entity2, entity3, entity4, entity5]);

            // Shuffle multiple times to increase chance of different order
            let shuffled = false;
            for (let i = 0; i < 10; i++) {
                locationSystem.shuffleZone(zoneEntity);
                const newOrder = locationSystem.getEntitiesInZone(zoneEntity);
                
                // Check that all entities are still present
                expect(newOrder).toHaveLength(5);
                expect(newOrder).toContain(entity1);
                expect(newOrder).toContain(entity2);
                expect(newOrder).toContain(entity3);
                expect(newOrder).toContain(entity4);
                expect(newOrder).toContain(entity5);

                // Check that sortIndex values are updated correctly
                newOrder.forEach((entity, index) => {
                    const location = coordinator.getComponentFromEntity<LocationComponent>(LOCATION_COMPONENT, entity);
                    expect(location?.sortIndex).toBe(index);
                });

                // If order changed, mark as shuffled
                if (JSON.stringify(newOrder) !== JSON.stringify(originalOrder)) {
                    shuffled = true;
                }
            }

            // With 10 shuffles, it's very likely at least one will be different
            // (probability of all being same is (1/5!)^10 ≈ 0)
            expect(shuffled).toBe(true);
        });

        it('should maintain all entities in zone after shuffle', () => {
            const zoneComponent: ZoneComponent = {
                zone: 'test-zone',
                owner: null,
                visibility: 'public',
                ordered: false
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent);

            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 2 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);

            const beforeShuffle = locationSystem.getEntitiesInZone(zoneEntity);
            expect(beforeShuffle).toHaveLength(3);

            locationSystem.shuffleZone(zoneEntity);

            const afterShuffle = locationSystem.getEntitiesInZone(zoneEntity);
            expect(afterShuffle).toHaveLength(3);
            expect(afterShuffle).toContain(entity1);
            expect(afterShuffle).toContain(entity2);
            expect(afterShuffle).toContain(entity3);
        });

        it('should skip entities without LocationComponent during shuffle', () => {
            const zoneComponent: ZoneComponent = {
                zone: 'test-zone',
                owner: null,
                visibility: 'public',
                ordered: true
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent);

            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            // entity2 has no LocationComponent
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 2 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);
            // entity2 has no LocationComponent, so it won't be in the system

            locationSystem.shuffleZone(zoneEntity);

            const result = locationSystem.getEntitiesInZone(zoneEntity);
            expect(result).toHaveLength(2);
            expect(result).toContain(entity1);
            expect(result).toContain(entity3);
            expect(result).not.toContain(entity2);

            // Check sortIndex values are updated correctly
            result.forEach((entity, index) => {
                const location = coordinator.getComponentFromEntity<LocationComponent>(LOCATION_COMPONENT, entity);
                expect(location?.sortIndex).toBe(index);
            });
        });

        it('should only shuffle entities in the specified zone', () => {
            const zoneComponent1: ZoneComponent = {
                zone: 'zone-1',
                owner: null,
                visibility: 'public',
                ordered: true
            };
            const zoneComponent2: ZoneComponent = {
                zone: 'zone-2',
                owner: null,
                visibility: 'public',
                ordered: true
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent1);
            coordinator.addComponentToEntity(ZONE_COMPONENT, otherZoneEntity, zoneComponent2);

            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: otherZoneEntity, sortIndex: 0 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 1 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);

            // Shuffle zoneEntity
            locationSystem.shuffleZone(zoneEntity);

            // Check that entity2's sortIndex is unchanged
            const location2After = coordinator.getComponentFromEntity<LocationComponent>(LOCATION_COMPONENT, entity2);
            expect(location2After?.sortIndex).toBe(0);

            // Check that entities in zoneEntity have updated sortIndex
            const zone1Entities = locationSystem.getEntitiesInZone(zoneEntity);
            zone1Entities.forEach((entity, index) => {
                const location = coordinator.getComponentFromEntity<LocationComponent>(LOCATION_COMPONENT, entity);
                expect(location?.sortIndex).toBe(index);
            });
        });

        it('should handle single entity in zone', () => {
            const zoneComponent: ZoneComponent = {
                zone: 'test-zone',
                owner: null,
                visibility: 'public',
                ordered: true
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent);

            const entity1 = coordinator.createEntity();
            const location1: LocationComponent = { location: zoneEntity, sortIndex: 5 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);

            locationSystem.shuffleZone(zoneEntity);

            const result = locationSystem.getEntitiesInZone(zoneEntity);
            expect(result).toHaveLength(1);
            expect(result[0]).toBe(entity1);

            const location = coordinator.getComponentFromEntity<LocationComponent>(LOCATION_COMPONENT, entity1);
            expect(location?.sortIndex).toBe(0);
        });
    });
});
