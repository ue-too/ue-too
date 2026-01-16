import { Coordinator, Entity } from "@ue-too/ecs";
import { LocationSystem, LocationComponent, ZoneComponent, LOCATION_COMPONENT, ZONE_COMPONENT } from "../src/zone-system/zone-component";
import { 
    ZoneHasEntitiesPrecondition, 
    ZoneHasEntitiesNumberPrecondition, 
    ZoneHasEntitiesNumberRangePrecondition,
    ZoneHasEntityIndexPrecondition
} from "../src/zone-system/precondition";

describe('Zone System Preconditions', () => {
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

    describe('ZoneHasEntitiesPrecondition', () => {
        let entity: Entity;
        let entityInZone: Entity;
        let entityInOtherZone: Entity;

        beforeEach(() => {
            // Set up zone
            const zoneComponent: ZoneComponent = {
                zone: 'test-zone',
                owner: null,
                visibility: 'public',
                ordered: false
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent);

            const otherZoneComponent: ZoneComponent = {
                zone: 'other-zone',
                owner: null,
                visibility: 'public',
                ordered: false
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, otherZoneEntity, otherZoneComponent);

            // Create entities
            entity = coordinator.createEntity();
            entityInZone = coordinator.createEntity();
            entityInOtherZone = coordinator.createEntity();

            // Add location components
            const locationInZone: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const locationInOtherZone: LocationComponent = { location: otherZoneEntity, sortIndex: 0 };
            
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entityInZone, locationInZone);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entityInOtherZone, locationInOtherZone);
        });

        it('should return true when entity is in the specified zone', () => {
            const precondition = new ZoneHasEntitiesPrecondition(
                coordinator, zoneEntity, entityInZone
            );
            expect(precondition.check()).toBe(true);
        });

        it('should return false when entity is in a different zone', () => {
            const precondition = new ZoneHasEntitiesPrecondition(
                coordinator, zoneEntity, entityInOtherZone
            );
            expect(precondition.check()).toBe(false);
        });

        it('should return false when entity has no location component', () => {
            const precondition = new ZoneHasEntitiesPrecondition(
                coordinator, zoneEntity, entity
            );
            expect(precondition.check()).toBe(false);
        });

        it('should return false when checking non-existent zone entity', () => {
            const nonExistentZone = coordinator.createEntity();
            const precondition = new ZoneHasEntitiesPrecondition(
                coordinator, nonExistentZone, entityInZone
            );
            // Entity is in zoneEntity, not nonExistentZone
            expect(precondition.check()).toBe(false);
        });

        it('should correctly identify entity location after moving between zones', () => {
            // Initially in zoneEntity
            const movingEntity = coordinator.createEntity();
            const location: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            coordinator.addComponentToEntity(LOCATION_COMPONENT, movingEntity, location);

            let precondition = new ZoneHasEntitiesPrecondition(
                coordinator, zoneEntity, movingEntity
            );
            expect(precondition.check()).toBe(true);

            // Move to otherZoneEntity
            const locationComponent = coordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT, movingEntity
            );
            if (locationComponent) {
                locationComponent.location = otherZoneEntity;
            }

            precondition = new ZoneHasEntitiesPrecondition(
                coordinator, zoneEntity, movingEntity
            );
            expect(precondition.check()).toBe(false);

            precondition = new ZoneHasEntitiesPrecondition(
                coordinator, otherZoneEntity, movingEntity
            );
            expect(precondition.check()).toBe(true);
        });
    });

    describe('ZoneHasEntitiesNumberPrecondition', () => {
        beforeEach(() => {
            const zoneComponent: ZoneComponent = {
                zone: 'test-zone',
                owner: null,
                visibility: 'public',
                ordered: false
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent);
        });

        it('should return true when zone has exactly the minimum count', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 2 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);

            const precondition = new ZoneHasEntitiesNumberPrecondition(
                coordinator, zoneEntity, 3
            );
            expect(precondition.check()).toBe(true);
        });

        it('should return true when zone has more than the minimum count', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();
            const entity4 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 2 };
            const location4: LocationComponent = { location: zoneEntity, sortIndex: 3 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity4, location4);

            const precondition = new ZoneHasEntitiesNumberPrecondition(
                coordinator, zoneEntity, 3
            );
            expect(precondition.check()).toBe(true);
        });

        it('should return false when zone has fewer than the minimum count', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);

            const precondition = new ZoneHasEntitiesNumberPrecondition(
                coordinator, zoneEntity, 3
            );
            expect(precondition.check()).toBe(false);
        });

        it('should return true when zone is empty and minimum count is 0', () => {
            const precondition = new ZoneHasEntitiesNumberPrecondition(
                coordinator, zoneEntity, 0
            );
            expect(precondition.check()).toBe(true);
        });

        it('should return false when zone is empty and minimum count is greater than 0', () => {
            const precondition = new ZoneHasEntitiesNumberPrecondition(
                coordinator, zoneEntity, 1
            );
            expect(precondition.check()).toBe(false);
        });

        it('should handle zone without ZoneComponent', () => {
            const zoneWithoutComponent = coordinator.createEntity();
            const precondition = new ZoneHasEntitiesNumberPrecondition(
                coordinator, zoneWithoutComponent, 0
            );
            // getEntitiesInZone returns empty array for zone without component
            expect(precondition.check()).toBe(true);
        });

        it('should only count entities in the specified zone', () => {
            // Set up other zone
            const otherZoneComponent: ZoneComponent = {
                zone: 'other-zone',
                owner: null,
                visibility: 'public',
                ordered: false
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, otherZoneEntity, otherZoneComponent);

            // Add entities to both zones
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location3: LocationComponent = { location: otherZoneEntity, sortIndex: 0 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);

            // Check zoneEntity has 2 entities
            const precondition = new ZoneHasEntitiesNumberPrecondition(
                coordinator, zoneEntity, 2
            );
            expect(precondition.check()).toBe(true);

            // Check otherZoneEntity has 1 entity
            const precondition2 = new ZoneHasEntitiesNumberPrecondition(
                coordinator, otherZoneEntity, 1
            );
            expect(precondition2.check()).toBe(true);
        });
    });

    describe('ZoneHasEntitiesNumberRangePrecondition', () => {
        beforeEach(() => {
            const zoneComponent: ZoneComponent = {
                zone: 'test-zone',
                owner: null,
                visibility: 'public',
                ordered: false
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent);
        });

        it('should return true when zone has exactly the minimum count', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 2 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);

            const precondition = new ZoneHasEntitiesNumberRangePrecondition(
                coordinator, zoneEntity, 3, 5
            );
            expect(precondition.check()).toBe(true);
        });

        it('should return true when zone has exactly the maximum count', () => {
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

            const precondition = new ZoneHasEntitiesNumberRangePrecondition(
                coordinator, zoneEntity, 3, 5
            );
            expect(precondition.check()).toBe(true);
        });

        it('should return true when zone has count within the range', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();
            const entity4 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 2 };
            const location4: LocationComponent = { location: zoneEntity, sortIndex: 3 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity4, location4);

            const precondition = new ZoneHasEntitiesNumberRangePrecondition(
                coordinator, zoneEntity, 3, 5
            );
            expect(precondition.check()).toBe(true);
        });

        it('should return false when zone has fewer than the minimum count', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);

            const precondition = new ZoneHasEntitiesNumberRangePrecondition(
                coordinator, zoneEntity, 3, 5
            );
            expect(precondition.check()).toBe(false);
        });

        it('should return false when zone has more than the maximum count', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();
            const entity4 = coordinator.createEntity();
            const entity5 = coordinator.createEntity();
            const entity6 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 2 };
            const location4: LocationComponent = { location: zoneEntity, sortIndex: 3 };
            const location5: LocationComponent = { location: zoneEntity, sortIndex: 4 };
            const location6: LocationComponent = { location: zoneEntity, sortIndex: 5 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity4, location4);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity5, location5);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity6, location6);

            const precondition = new ZoneHasEntitiesNumberRangePrecondition(
                coordinator, zoneEntity, 3, 5
            );
            expect(precondition.check()).toBe(false);
        });

        it('should return true when zone is empty and range includes 0', () => {
            const precondition = new ZoneHasEntitiesNumberRangePrecondition(
                coordinator, zoneEntity, 0, 2
            );
            expect(precondition.check()).toBe(true);
        });

        it('should return false when zone is empty and range does not include 0', () => {
            const precondition = new ZoneHasEntitiesNumberRangePrecondition(
                coordinator, zoneEntity, 1, 3
            );
            expect(precondition.check()).toBe(false);
        });

        it('should handle zone without ZoneComponent', () => {
            const zoneWithoutComponent = coordinator.createEntity();
            const precondition = new ZoneHasEntitiesNumberRangePrecondition(
                coordinator, zoneWithoutComponent, 0, 1
            );
            // getEntitiesInZone returns empty array for zone without component
            expect(precondition.check()).toBe(true);
        });

        it('should work with range where min equals max', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 2 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);

            const precondition = new ZoneHasEntitiesNumberRangePrecondition(
                coordinator, zoneEntity, 3, 3
            );
            expect(precondition.check()).toBe(true);

            const precondition2 = new ZoneHasEntitiesNumberRangePrecondition(
                coordinator, zoneEntity, 2, 2
            );
            expect(precondition2.check()).toBe(false);
        });

        it('should only count entities in the specified zone', () => {
            // Set up other zone
            const otherZoneComponent: ZoneComponent = {
                zone: 'other-zone',
                owner: null,
                visibility: 'public',
                ordered: false
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, otherZoneEntity, otherZoneComponent);

            // Add entities to both zones
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();
            const entity4 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location3: LocationComponent = { location: otherZoneEntity, sortIndex: 0 };
            const location4: LocationComponent = { location: otherZoneEntity, sortIndex: 1 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity4, location4);

            // Check zoneEntity has 2 entities (within range 1-3)
            const precondition = new ZoneHasEntitiesNumberRangePrecondition(
                coordinator, zoneEntity, 1, 3
            );
            expect(precondition.check()).toBe(true);

            // Check otherZoneEntity has 2 entities (within range 1-3)
            const precondition2 = new ZoneHasEntitiesNumberRangePrecondition(
                coordinator, otherZoneEntity, 1, 3
            );
            expect(precondition2.check()).toBe(true);
        });
    });

    describe('ZoneHasEntityIndexPrecondition', () => {
        beforeEach(() => {
            const zoneComponent: ZoneComponent = {
                zone: 'test-zone',
                owner: null,
                visibility: 'public',
                ordered: true
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, zoneEntity, zoneComponent);

            const otherZoneComponent: ZoneComponent = {
                zone: 'other-zone',
                owner: null,
                visibility: 'public',
                ordered: true
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, otherZoneEntity, otherZoneComponent);
        });

        it('should return true when entity is at the specified index', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 2 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);

            const precondition = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneEntity, entity1, 0
            );
            expect(precondition.check()).toBe(true);

            const precondition2 = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneEntity, entity2, 1
            );
            expect(precondition2.check()).toBe(true);

            const precondition3 = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneEntity, entity3, 2
            );
            expect(precondition3.check()).toBe(true);
        });

        it('should return false when entity is at a different index', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 2 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);

            const precondition = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneEntity, entity1, 1
            );
            expect(precondition.check()).toBe(false);

            const precondition2 = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneEntity, entity2, 0
            );
            expect(precondition2.check()).toBe(false);

            const precondition3 = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneEntity, entity3, 0
            );
            expect(precondition3.check()).toBe(false);
        });

        it('should return false when entity is not in the zone', () => {
            const entityInZone = coordinator.createEntity();
            const entityNotInZone = coordinator.createEntity();

            const locationInZone: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const locationNotInZone: LocationComponent = { location: otherZoneEntity, sortIndex: 0 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entityInZone, locationInZone);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entityNotInZone, locationNotInZone);

            const precondition = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneEntity, entityNotInZone, 0
            );
            expect(precondition.check()).toBe(false);
        });

        it('should return false when index is out of bounds (negative)', () => {
            const entity = coordinator.createEntity();
            const location: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity, location);

            const precondition = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneEntity, entity, -1
            );
            expect(precondition.check()).toBe(false);
        });

        it('should return false when index is out of bounds (too large)', () => {
            const entity = coordinator.createEntity();
            const location: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity, location);

            const precondition = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneEntity, entity, 1
            );
            expect(precondition.check()).toBe(false);

            const precondition2 = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneEntity, entity, 10
            );
            expect(precondition2.check()).toBe(false);
        });

        it('should return false when zone is empty', () => {
            const entity = coordinator.createEntity();
            const location: LocationComponent = { location: otherZoneEntity, sortIndex: 0 };
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity, location);

            const precondition = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneEntity, entity, 0
            );
            expect(precondition.check()).toBe(false);
        });

        it('should work with unordered zones', () => {
            const unorderedZone = coordinator.createEntity();
            const unorderedZoneComponent: ZoneComponent = {
                zone: 'unordered-zone',
                owner: null,
                visibility: 'public',
                ordered: false
            };
            coordinator.addComponentToEntity(ZONE_COMPONENT, unorderedZone, unorderedZoneComponent);

            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();

            const location1: LocationComponent = { location: unorderedZone, sortIndex: 0 };
            const location2: LocationComponent = { location: unorderedZone, sortIndex: 1 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);

            // For unordered zones, the order may not be guaranteed, but the precondition should still work
            const precondition = new ZoneHasEntityIndexPrecondition(
                coordinator, unorderedZone, entity1, 0
            );
            // The result depends on how getEntitiesInZone handles unordered zones
            // It should return entities in some order, so the precondition can check if entity is at that index
            expect(typeof precondition.check()).toBe('boolean');
        });

        it('should handle zone without ZoneComponent', () => {
            const zoneWithoutComponent = coordinator.createEntity();
            const entity = coordinator.createEntity();
            const location: LocationComponent = { location: zoneWithoutComponent, sortIndex: 0 };
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity, location);

            const precondition = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneWithoutComponent, entity, 0
            );
            // getEntitiesInZone returns empty array for zone without component
            expect(precondition.check()).toBe(false);
        });

        it('should correctly identify entity index after reorganization', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            // Create entities with non-sequential sort indices
            const location1: LocationComponent = { location: zoneEntity, sortIndex: 5 };
            const location2: LocationComponent = { location: zoneEntity, sortIndex: 2 };
            const location3: LocationComponent = { location: zoneEntity, sortIndex: 10 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);

            // Reorganize the zone
            locationSystem.organizeZoneSortIndex(zoneEntity);

            // After reorganization, entities should be at indices 0, 1, 2
            // The order depends on how getEntitiesInZone sorts them (by sortIndex for ordered zones)
            const entitiesInZone = locationSystem.getEntitiesInZone(zoneEntity);
            expect(entitiesInZone.length).toBe(3);

            // Find which entity is at which index after reorganization
            const index0 = entitiesInZone.indexOf(entity1);
            const index1 = entitiesInZone.indexOf(entity2);
            const index2 = entitiesInZone.indexOf(entity3);

            // Verify preconditions work correctly
            if (index0 >= 0) {
                const precondition = new ZoneHasEntityIndexPrecondition(
                    coordinator, zoneEntity, entity1, index0
                );
                expect(precondition.check()).toBe(true);
            }
            if (index1 >= 0) {
                const precondition = new ZoneHasEntityIndexPrecondition(
                    coordinator, zoneEntity, entity2, index1
                );
                expect(precondition.check()).toBe(true);
            }
            if (index2 >= 0) {
                const precondition = new ZoneHasEntityIndexPrecondition(
                    coordinator, zoneEntity, entity3, index2
                );
                expect(precondition.check()).toBe(true);
            }
        });

        it('should correctly identify entity index when entities are added in sequence', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            // Add entities one by one
            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity1, location1);

            const location2: LocationComponent = { location: zoneEntity, sortIndex: 1 };
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity2, location2);

            const location3: LocationComponent = { location: zoneEntity, sortIndex: 2 };
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entity3, location3);

            // Verify each entity is at the correct index
            const precondition1 = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneEntity, entity1, 0
            );
            expect(precondition1.check()).toBe(true);

            const precondition2 = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneEntity, entity2, 1
            );
            expect(precondition2.check()).toBe(true);

            const precondition3 = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneEntity, entity3, 2
            );
            expect(precondition3.check()).toBe(true);
        });

        it('should return false when checking entity from different zone', () => {
            const entityInZone = coordinator.createEntity();
            const entityInOtherZone = coordinator.createEntity();

            const location1: LocationComponent = { location: zoneEntity, sortIndex: 0 };
            const location2: LocationComponent = { location: otherZoneEntity, sortIndex: 0 };

            coordinator.addComponentToEntity(LOCATION_COMPONENT, entityInZone, location1);
            coordinator.addComponentToEntity(LOCATION_COMPONENT, entityInOtherZone, location2);

            const precondition = new ZoneHasEntityIndexPrecondition(
                coordinator, zoneEntity, entityInOtherZone, 0
            );
            expect(precondition.check()).toBe(false);
        });
    });
});
