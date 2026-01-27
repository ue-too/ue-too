import { Coordinator, Entity } from '@ue-too/ecs';

import { MoveEntityToZoneEffect } from '../src/zone-system/effect';
import {
    LOCATION_COMPONENT,
    LocationComponent,
    LocationSystem,
    ZONE_COMPONENT,
    ZoneComponent,
} from '../src/zone-system/zone-component';

describe('MoveEntityToZoneEffect - Ordered Zone', () => {
    let coordinator: Coordinator;
    let locationSystem: LocationSystem;
    let orderedZoneEntity: Entity;
    let otherZoneEntity: Entity;

    beforeEach(() => {
        coordinator = new Coordinator();
        coordinator.registerComponent<LocationComponent>(LOCATION_COMPONENT);
        coordinator.registerComponent<ZoneComponent>(ZONE_COMPONENT);
        locationSystem = new LocationSystem(coordinator);

        orderedZoneEntity = coordinator.createEntity();
        otherZoneEntity = coordinator.createEntity();
    });

    describe('Moving entity to ordered zone - top', () => {
        beforeEach(() => {
            const orderedZoneComponent: ZoneComponent = {
                zone: 'ordered-zone',
                owner: null,
                visibility: 'public',
                ordered: true,
            };
            coordinator.addComponentToEntity(
                ZONE_COMPONENT,
                orderedZoneEntity,
                orderedZoneComponent
            );
        });

        it('should add entity to top of empty ordered zone', () => {
            const entity = coordinator.createEntity();
            const locationComponent: LocationComponent = {
                location: otherZoneEntity,
                sortIndex: 0,
            };
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity,
                locationComponent
            );

            const effect = new MoveEntityToZoneEffect(
                coordinator,
                entity,
                orderedZoneEntity,
                'top'
            );
            effect.apply();

            const updatedLocation =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    entity
                );
            expect(updatedLocation?.location).toBe(orderedZoneEntity);
            expect(updatedLocation?.sortIndex).toBe(0);

            const entitiesInZone =
                locationSystem.getEntitiesInZone(orderedZoneEntity);
            expect(entitiesInZone).toEqual([entity]);
        });

        it('should add entity to top and shift existing entities', () => {
            // Create existing entities in ordered zone
            const existingEntity1 = coordinator.createEntity();
            const existingEntity2 = coordinator.createEntity();
            const existingEntity3 = coordinator.createEntity();

            const location1: LocationComponent = {
                location: orderedZoneEntity,
                sortIndex: 0,
            };
            const location2: LocationComponent = {
                location: orderedZoneEntity,
                sortIndex: 1,
            };
            const location3: LocationComponent = {
                location: orderedZoneEntity,
                sortIndex: 2,
            };

            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                existingEntity1,
                location1
            );
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                existingEntity2,
                location2
            );
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                existingEntity3,
                location3
            );

            // Create new entity in different zone
            const newEntity = coordinator.createEntity();
            const newLocation: LocationComponent = {
                location: otherZoneEntity,
                sortIndex: 0,
            };
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                newEntity,
                newLocation
            );

            // Move new entity to top
            const effect = new MoveEntityToZoneEffect(
                coordinator,
                newEntity,
                orderedZoneEntity,
                'top'
            );
            effect.apply();

            // Verify new entity is at top (sortIndex 0)
            const newEntityLocation =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    newEntity
                );
            expect(newEntityLocation?.location).toBe(orderedZoneEntity);
            expect(newEntityLocation?.sortIndex).toBe(0);

            // Verify existing entities were shifted
            // addEntityToZone organizes the zone first, then adds the new entity at top,
            // which shifts all existing entities by 1
            const entity1Location =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    existingEntity1
                );
            const entity2Location =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    existingEntity2
                );
            const entity3Location =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    existingEntity3
                );

            // All existing entities should have indices > 0, and the zone should have 4 entities total
            const existingIndices = [
                entity1Location?.sortIndex,
                entity2Location?.sortIndex,
                entity3Location?.sortIndex,
            ];
            existingIndices.forEach(index => {
                expect(index).toBeGreaterThan(0);
            });

            // Verify all entities are in the zone and order is correct
            const entitiesInZone =
                locationSystem.getEntitiesInZone(orderedZoneEntity);
            expect(entitiesInZone.length).toBe(4);
            expect(entitiesInZone[0]).toBe(newEntity); // New entity should be first
        });

        it('should handle multiple entities added to top in sequence', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = {
                location: otherZoneEntity,
                sortIndex: 0,
            };
            const location2: LocationComponent = {
                location: otherZoneEntity,
                sortIndex: 0,
            };
            const location3: LocationComponent = {
                location: otherZoneEntity,
                sortIndex: 0,
            };

            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity1,
                location1
            );
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity2,
                location2
            );
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity3,
                location3
            );

            // Add entities to top in sequence
            new MoveEntityToZoneEffect(
                coordinator,
                entity1,
                orderedZoneEntity,
                'top'
            ).apply();
            new MoveEntityToZoneEffect(
                coordinator,
                entity2,
                orderedZoneEntity,
                'top'
            ).apply();
            new MoveEntityToZoneEffect(
                coordinator,
                entity3,
                orderedZoneEntity,
                'top'
            ).apply();

            // Verify sort indices and order
            // When adding to top in sequence, each new entity becomes 0 and shifts others
            // The final order should be: entity3 (0), entity2, entity1
            const loc1 = coordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT,
                entity1
            );
            const loc2 = coordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT,
                entity2
            );
            const loc3 = coordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT,
                entity3
            );

            // Last added entity should be at top (sortIndex 0)
            expect(loc3?.sortIndex).toBe(0);

            // Verify order is correct (entity3, entity2, entity1)
            const entitiesInZone =
                locationSystem.getEntitiesInZone(orderedZoneEntity);
            expect(entitiesInZone).toEqual([entity3, entity2, entity1]);

            // Verify all have valid sequential indices
            expect(loc1?.sortIndex).toBeGreaterThan(0);
            expect(loc2?.sortIndex).toBeGreaterThan(0);
        });
    });

    describe('Moving entity to ordered zone - bottom', () => {
        beforeEach(() => {
            const orderedZoneComponent: ZoneComponent = {
                zone: 'ordered-zone',
                owner: null,
                visibility: 'public',
                ordered: true,
            };
            coordinator.addComponentToEntity(
                ZONE_COMPONENT,
                orderedZoneEntity,
                orderedZoneComponent
            );
        });

        it('should add entity to bottom of empty ordered zone', () => {
            const entity = coordinator.createEntity();
            const locationComponent: LocationComponent = {
                location: otherZoneEntity,
                sortIndex: 0,
            };
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity,
                locationComponent
            );

            const effect = new MoveEntityToZoneEffect(
                coordinator,
                entity,
                orderedZoneEntity,
                'bottom'
            );
            effect.apply();

            const updatedLocation =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    entity
                );
            expect(updatedLocation?.location).toBe(orderedZoneEntity);
            expect(updatedLocation?.sortIndex).toBe(0);

            const entitiesInZone =
                locationSystem.getEntitiesInZone(orderedZoneEntity);
            expect(entitiesInZone).toEqual([entity]);
        });

        it('should add entity to bottom without shifting existing entities', () => {
            // Create existing entities in ordered zone
            const existingEntity1 = coordinator.createEntity();
            const existingEntity2 = coordinator.createEntity();
            const existingEntity3 = coordinator.createEntity();

            const location1: LocationComponent = {
                location: orderedZoneEntity,
                sortIndex: 0,
            };
            const location2: LocationComponent = {
                location: orderedZoneEntity,
                sortIndex: 1,
            };
            const location3: LocationComponent = {
                location: orderedZoneEntity,
                sortIndex: 2,
            };

            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                existingEntity1,
                location1
            );
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                existingEntity2,
                location2
            );
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                existingEntity3,
                location3
            );

            // Create new entity in different zone
            const newEntity = coordinator.createEntity();
            const newLocation: LocationComponent = {
                location: otherZoneEntity,
                sortIndex: 0,
            };
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                newEntity,
                newLocation
            );

            // Move new entity to bottom
            const effect = new MoveEntityToZoneEffect(
                coordinator,
                newEntity,
                orderedZoneEntity,
                'bottom'
            );
            effect.apply();

            // Verify new entity is at bottom (sortIndex should be 3, which is lastSortIndex)
            const newEntityLocation =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    newEntity
                );
            expect(newEntityLocation?.location).toBe(orderedZoneEntity);
            expect(newEntityLocation?.sortIndex).toBe(3);

            // Verify existing entities were not shifted
            const entity1Location =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    existingEntity1
                );
            const entity2Location =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    existingEntity2
                );
            const entity3Location =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    existingEntity3
                );

            expect(entity1Location?.sortIndex).toBe(0);
            expect(entity2Location?.sortIndex).toBe(1);
            expect(entity3Location?.sortIndex).toBe(2);

            // Verify order when retrieving entities
            const entitiesInZone =
                locationSystem.getEntitiesInZone(orderedZoneEntity);
            expect(entitiesInZone).toEqual([
                existingEntity1,
                existingEntity2,
                existingEntity3,
                newEntity,
            ]);
        });

        it('should handle multiple entities added to bottom in sequence', () => {
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = {
                location: otherZoneEntity,
                sortIndex: 0,
            };
            const location2: LocationComponent = {
                location: otherZoneEntity,
                sortIndex: 0,
            };
            const location3: LocationComponent = {
                location: otherZoneEntity,
                sortIndex: 0,
            };

            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity1,
                location1
            );
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity2,
                location2
            );
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity3,
                location3
            );

            // Add entities to bottom in sequence
            new MoveEntityToZoneEffect(
                coordinator,
                entity1,
                orderedZoneEntity,
                'bottom'
            ).apply();
            new MoveEntityToZoneEffect(
                coordinator,
                entity2,
                orderedZoneEntity,
                'bottom'
            ).apply();
            new MoveEntityToZoneEffect(
                coordinator,
                entity3,
                orderedZoneEntity,
                'bottom'
            ).apply();

            // Verify order: first added should be at top, last at bottom
            const entitiesInZone =
                locationSystem.getEntitiesInZone(orderedZoneEntity);
            expect(entitiesInZone).toEqual([entity1, entity2, entity3]);

            // Verify sort indices
            const loc1 = coordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT,
                entity1
            );
            const loc2 = coordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT,
                entity2
            );
            const loc3 = coordinator.getComponentFromEntity<LocationComponent>(
                LOCATION_COMPONENT,
                entity3
            );

            expect(loc1?.sortIndex).toBe(0);
            expect(loc2?.sortIndex).toBe(1);
            expect(loc3?.sortIndex).toBe(2);
        });
    });

    describe('Edge cases for ordered zones', () => {
        beforeEach(() => {
            const orderedZoneComponent: ZoneComponent = {
                zone: 'ordered-zone',
                owner: null,
                visibility: 'public',
                ordered: true,
            };
            coordinator.addComponentToEntity(
                ZONE_COMPONENT,
                orderedZoneEntity,
                orderedZoneComponent
            );
        });

        it('should not move entity if target is not a zone', () => {
            const entity = coordinator.createEntity();
            const locationComponent: LocationComponent = {
                location: otherZoneEntity,
                sortIndex: 0,
            };
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity,
                locationComponent
            );

            const nonZoneEntity = coordinator.createEntity();
            const effect = new MoveEntityToZoneEffect(
                coordinator,
                entity,
                nonZoneEntity,
                'top'
            );
            effect.apply();

            // Entity should remain in original location
            const updatedLocation =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    entity
                );
            expect(updatedLocation?.location).toBe(otherZoneEntity);
        });

        it('should not move entity if entity has no location component', () => {
            const entity = coordinator.createEntity();
            // Don't add location component

            const effect = new MoveEntityToZoneEffect(
                coordinator,
                entity,
                orderedZoneEntity,
                'top'
            );
            effect.apply();

            // Entity should not be in the zone
            const entitiesInZone =
                locationSystem.getEntitiesInZone(orderedZoneEntity);
            expect(entitiesInZone).not.toContain(entity);
        });

        it('should not move entity if entity is already in the target zone', () => {
            const entity = coordinator.createEntity();
            const locationComponent: LocationComponent = {
                location: orderedZoneEntity,
                sortIndex: 0,
            };
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity,
                locationComponent
            );

            const originalSortIndex = locationComponent.sortIndex;

            const effect = new MoveEntityToZoneEffect(
                coordinator,
                entity,
                orderedZoneEntity,
                'top'
            );
            effect.apply();

            // Sort index should remain unchanged
            const updatedLocation =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    entity
                );
            expect(updatedLocation?.sortIndex).toBe(originalSortIndex);
        });

        it('should handle moving entity from one ordered zone to another', () => {
            const otherOrderedZone = coordinator.createEntity();
            const otherOrderedZoneComponent: ZoneComponent = {
                zone: 'other-ordered-zone',
                owner: null,
                visibility: 'public',
                ordered: true,
            };
            coordinator.addComponentToEntity(
                ZONE_COMPONENT,
                otherOrderedZone,
                otherOrderedZoneComponent
            );

            // Create entities in first ordered zone
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = {
                location: otherOrderedZone,
                sortIndex: 0,
            };
            const location2: LocationComponent = {
                location: otherOrderedZone,
                sortIndex: 1,
            };
            const location3: LocationComponent = {
                location: otherOrderedZone,
                sortIndex: 2,
            };

            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity1,
                location1
            );
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity2,
                location2
            );
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity3,
                location3
            );

            // Move entity2 to the other ordered zone at top
            const effect = new MoveEntityToZoneEffect(
                coordinator,
                entity2,
                orderedZoneEntity,
                'top'
            );
            effect.apply();

            // Verify entity2 is now in orderedZoneEntity
            const entity2Location =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    entity2
                );
            expect(entity2Location?.location).toBe(orderedZoneEntity);
            expect(entity2Location?.sortIndex).toBe(0);

            // Verify other entities remain in original zone
            const entity1Location =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    entity1
                );
            const entity3Location =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    entity3
                );
            expect(entity1Location?.location).toBe(otherOrderedZone);
            expect(entity3Location?.location).toBe(otherOrderedZone);

            // Verify zones have correct entities
            const entitiesInOrderedZone =
                locationSystem.getEntitiesInZone(orderedZoneEntity);
            expect(entitiesInOrderedZone).toEqual([entity2]);

            const entitiesInOtherZone =
                locationSystem.getEntitiesInZone(otherOrderedZone);
            expect(entitiesInOtherZone).toEqual([entity1, entity3]);
        });

        it('should handle zone with disorganized sort indices', () => {
            // Create entities with non-sequential sort indices
            const entity1 = coordinator.createEntity();
            const entity2 = coordinator.createEntity();
            const entity3 = coordinator.createEntity();

            const location1: LocationComponent = {
                location: orderedZoneEntity,
                sortIndex: 5,
            };
            const location2: LocationComponent = {
                location: orderedZoneEntity,
                sortIndex: 2,
            };
            const location3: LocationComponent = {
                location: orderedZoneEntity,
                sortIndex: 10,
            };

            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity1,
                location1
            );
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity2,
                location2
            );
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                entity3,
                location3
            );

            // Add new entity to top - should organize and then add
            const newEntity = coordinator.createEntity();
            const newLocation: LocationComponent = {
                location: otherZoneEntity,
                sortIndex: 0,
            };
            coordinator.addComponentToEntity(
                LOCATION_COMPONENT,
                newEntity,
                newLocation
            );

            const effect = new MoveEntityToZoneEffect(
                coordinator,
                newEntity,
                orderedZoneEntity,
                'top'
            );
            effect.apply();

            // Zone should be organized
            const entitiesInZone =
                locationSystem.getEntitiesInZone(orderedZoneEntity);
            expect(entitiesInZone.length).toBe(4);

            // New entity should be at top
            const newEntityLocation =
                coordinator.getComponentFromEntity<LocationComponent>(
                    LOCATION_COMPONENT,
                    newEntity
                );
            expect(newEntityLocation?.sortIndex).toBe(0);

            // All entities should be in the zone and ordered correctly
            // addEntityToZone organizes the zone first, then adds the new entity at top
            expect(entitiesInZone[0]).toBe(newEntity);

            // Verify all entities have valid sort indices and are ordered
            const sortIndices = entitiesInZone.map(entity => {
                const loc =
                    coordinator.getComponentFromEntity<LocationComponent>(
                        LOCATION_COMPONENT,
                        entity
                    );
                return loc?.sortIndex ?? -1;
            });
            // First should be 0, others should be increasing
            expect(sortIndices[0]).toBe(0);
            for (let i = 1; i < sortIndices.length; i++) {
                expect(sortIndices[i]).toBeGreaterThan(sortIndices[i - 1]);
            }
        });
    });
});
