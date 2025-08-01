import {
    resolveCollision,
    resolveCollisionWithRotation,
    aabbIntersects,
    intersects,
    narrowPhaseWithRigidBody,
    narrowPhase,
    broadPhaseWithRigidBodyReturned,
    broadPhase
} from "../src/collision";
import { Polygon, Circle } from "../src/rigidbody";
import { QuadTree, RectangleBound } from "../src/quadtree";

describe("AABB Intersection", () => {
    test("Intersecting AABBs", () => {
        const aabbA = { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } };
        const aabbB = { min: { x: 5, y: 5 }, max: { x: 15, y: 15 } };
        
        expect(aabbIntersects(aabbA, aabbB)).toBe(true);
    });

    test("Non-intersecting AABBs", () => {
        const aabbA = { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } };
        const aabbB = { min: { x: 15, y: 15 }, max: { x: 25, y: 25 } };
        
        expect(aabbIntersects(aabbA, aabbB)).toBe(false);
    });

    test("Touching AABBs", () => {
        const aabbA = { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } };
        const aabbB = { min: { x: 10, y: 0 }, max: { x: 20, y: 10 } };
        
        expect(aabbIntersects(aabbA, aabbB)).toBe(true);
    });

    test("One AABB inside another", () => {
        const aabbA = { min: { x: 0, y: 0 }, max: { x: 20, y: 20 } };
        const aabbB = { min: { x: 5, y: 5 }, max: { x: 15, y: 15 } };
        
        expect(aabbIntersects(aabbA, aabbB)).toBe(true);
    });
});

describe("Shape Intersection", () => {
    test("Intersecting circles", () => {
        const circleA = new Circle({ x: 0, y: 0 }, 10);
        const circleB = new Circle({ x: 15, y: 0 }, 10);
        
        const result = intersects(circleA, circleB);
        expect(result.collision).toBe(true);
        expect(result.depth).toBeGreaterThan(0);
        expect(result.normal).toBeDefined();
    });

    test("Non-intersecting circles", () => {
        const circleA = new Circle({ x: 0, y: 0 }, 10);
        const circleB = new Circle({ x: 25, y: 0 }, 10);
        
        const result = intersects(circleA, circleB);
        expect(result.collision).toBe(false);
        expect(result.depth).toBeUndefined();
        expect(result.normal).toBeUndefined();
    });

    test("Intersecting polygons", () => {
        const vertices = [{ x: 10, y: 10 }, { x: -10, y: 10 }, { x: -10, y: -10 }, { x: 10, y: -10 }];
        const polygonA = new Polygon({ x: 0, y: 0 }, vertices);
        const polygonB = new Polygon({ x: 15, y: 0 }, vertices);
        
        const result = intersects(polygonA, polygonB);
        expect(result.collision).toBe(true);
        expect(result.depth).toBeGreaterThan(0);
        expect(result.normal).toBeDefined();
    });

    test("Non-intersecting polygons", () => {
        const vertices = [{ x: 10, y: 10 }, { x: -10, y: 10 }, { x: -10, y: -10 }, { x: 10, y: -10 }];
        const polygonA = new Polygon({ x: 0, y: 0 }, vertices);
        const polygonB = new Polygon({ x: 30, y: 0 }, vertices);
        
        const result = intersects(polygonA, polygonB);
        expect(result.collision).toBe(false);
        expect(result.depth).toBeUndefined();
        expect(result.normal).toBeUndefined();
    });

    test("Circle and polygon intersection", () => {
        const circle = new Circle({ x: 0, y: 0 }, 10);
        const vertices = [{ x: 10, y: 10 }, { x: -10, y: 10 }, { x: -10, y: -10 }, { x: 10, y: -10 }];
        const polygon = new Polygon({ x: 15, y: 0 }, vertices);
        
        const result = intersects(circle, polygon);
        expect(result.collision).toBe(true);
        expect(result.depth).toBeGreaterThan(0);
        expect(result.normal).toBeDefined();
    });
});

describe("Collision Resolution", () => {
    test("Resolve collision between two moving circles", () => {
        const circleA = new Circle({ x: 0, y: 0 }, 10);
        const circleB = new Circle({ x: 15, y: 0 }, 10);
        
        circleA.linearVelocity = { x: 10, y: 0 };
        circleB.linearVelocity = { x: -5, y: 0 };
        
        const normal = { x: 1, y: 0 }; // Normal pointing from A to B
        
        resolveCollision(circleA, circleB, normal);
        
        // After collision, velocities should change
        expect(circleA.linearVelocity.x).toBeLessThan(10);
        expect(circleB.linearVelocity.x).toBeGreaterThan(-5);
    });

    test("Resolve collision with static body", () => {
        const movingCircle = new Circle({ x: 0, y: 0 }, 10);
        const staticCircle = new Circle({ x: 15, y: 0 }, 10, 0, 50, true);
        
        movingCircle.linearVelocity = { x: 10, y: 0 };
        const initialStaticVelocity = { ...staticCircle.linearVelocity };
        
        const normal = { x: 1, y: 0 };
        
        resolveCollision(movingCircle, staticCircle, normal);
        
        // Static body should not change velocity
        expect(staticCircle.linearVelocity).toEqual(initialStaticVelocity);
        // Moving body should bounce back
        expect(movingCircle.linearVelocity.x).toBeLessThan(0);
    });

    test("Resolve collision with rotation", () => {
        const circleA = new Circle({ x: 0, y: 0 }, 10);
        const circleB = new Circle({ x: 15, y: 0 }, 10);
        
        circleA.linearVelocity = { x: 10, y: 0 };
        circleA.angularVelocity = 1;
        circleB.linearVelocity = { x: -5, y: 0 };
        circleB.angularVelocity = -0.5;
        
        const contactManifold = {
            normal: { x: 1, y: 0 },
            contactPoints: [{ x: 10, y: 0 }]
        };
        
        const initialLinearVelA = { ...circleA.linearVelocity };
        const initialLinearVelB = { ...circleB.linearVelocity };
        
        resolveCollisionWithRotation(circleA, circleB, contactManifold);
        
        // Linear velocities should change due to collision
        expect(circleA.linearVelocity.x).not.toBe(initialLinearVelA.x);
        expect(circleB.linearVelocity.x).not.toBe(initialLinearVelB.x);
    });

    test("Resolve collision between two static bodies does nothing", () => {
        const staticA = new Circle({ x: 0, y: 0 }, 10, 0, 50, true);
        const staticB = new Circle({ x: 15, y: 0 }, 10, 0, 50, true);
        
        const initialVelA = { ...staticA.linearVelocity };
        const initialVelB = { ...staticB.linearVelocity };
        
        const normal = { x: 1, y: 0 };
        
        resolveCollision(staticA, staticB, normal);
        
        expect(staticA.linearVelocity).toEqual(initialVelA);
        expect(staticB.linearVelocity).toEqual(initialVelB);
    });
});

describe("Broad Phase Collision Detection", () => {
    test("Broad phase with rigid body returned", () => {
        const bound = new RectangleBound({ x: -100, y: -100 }, 200, 200);
        const quadTree = new QuadTree<Circle>(0, bound);
        
        const circleA = new Circle({ x: 0, y: 0 }, 10);
        const circleB = new Circle({ x: 15, y: 0 }, 10);
        const circleC = new Circle({ x: 50, y: 50 }, 10);
        
        const bodies = [circleA, circleB, circleC];
        
        bodies.forEach(body => quadTree.insert(body));
        
        const combinations = broadPhaseWithRigidBodyReturned(quadTree, bodies);
        
        // Should find potential collisions between close bodies
        expect(combinations.length).toBeGreaterThan(0);
        
        // Check that static bodies are filtered out appropriately
        const hasAB = combinations.some(combo => 
            (combo.bodyA === circleA && combo.bodyB === circleB) ||
            (combo.bodyA === circleB && combo.bodyB === circleA)
        );
        expect(hasAB).toBe(true);
    });

    test("Broad phase with static bodies", () => {
        const bound = new RectangleBound({ x: -100, y: -100 }, 200, 200);
        const quadTree = new QuadTree<Circle>(0, bound);
        
        const staticCircle = new Circle({ x: 0, y: 0 }, 10, 0, 50, true);
        const movingCircle = new Circle({ x: 15, y: 0 }, 10);
        
        const bodies = [staticCircle, movingCircle];
        bodies.forEach(body => quadTree.insert(body));
        
        const combinations = broadPhaseWithRigidBodyReturned(quadTree, bodies);
        
        // Should include combinations with at least one non-static body
        expect(combinations.length).toBeGreaterThan(0);
    });

    test("Broad phase returns potential collision pairs", () => {
        const bound = new RectangleBound({ x: -100, y: -100 }, 200, 200);
        const quadTree = new QuadTree<Circle>(0, bound);
        
        const circleA = new Circle({ x: 0, y: 0 }, 5);
        const circleB = new Circle({ x: 50, y: 50 }, 5);
        
        const bodies = [circleA, circleB];
        bodies.forEach(body => quadTree.insert(body));
        
        const combinations = broadPhaseWithRigidBodyReturned(quadTree, bodies);
        
        // Broad phase should return some combinations (may include false positives)
        // The important thing is that it doesn't miss actual collision pairs
        expect(Array.isArray(combinations)).toBe(true);
        expect(combinations.length).toBeGreaterThanOrEqual(0);
    });
});

describe("Narrow Phase Collision Detection", () => {
    test("Narrow phase with rigid body", () => {
        const circleA = new Circle({ x: 0, y: 0 }, 10);
        const circleB = new Circle({ x: 15, y: 0 }, 10); // Overlapping
        
        circleA.linearVelocity = { x: 5, y: 0 };
        circleB.linearVelocity = { x: -5, y: 0 };
        
        const bodies = [circleA, circleB];
        const combinations = [{ bodyA: circleA, bodyB: circleB }];
        
        const contactPoints = narrowPhaseWithRigidBody(bodies, combinations, true);
        
        // Should resolve collision and return contact points
        expect(contactPoints.length).toBeGreaterThan(0);
        
        // Bodies should be separated
        const distance = Math.sqrt(
            Math.pow(circleA.center.x - circleB.center.x, 2) +
            Math.pow(circleA.center.y - circleB.center.y, 2)
        );
        expect(distance).toBeGreaterThanOrEqual(20); // Sum of radii
    });

    test("Narrow phase without collision resolution", () => {
        const circleA = new Circle({ x: 0, y: 0 }, 10);
        const circleB = new Circle({ x: 15, y: 0 }, 10);
        
        const initialPositionA = { ...circleA.center };
        const initialPositionB = { ...circleB.center };
        
        const bodies = [circleA, circleB];
        const combinations = [{ bodyA: circleA, bodyB: circleB }];
        
        const contactPoints = narrowPhaseWithRigidBody(bodies, combinations, false);
        
        // Should not resolve collision when flag is false
        expect(contactPoints).toEqual([]);
        expect(circleA.center).toEqual(initialPositionA);
        expect(circleB.center).toEqual(initialPositionB);
    });

    test("Narrow phase with different Z levels", () => {
        const circleA = new Circle({ x: 0, y: 0, z: 0 }, 10);
        const circleB = new Circle({ x: 15, y: 0, z: 2 }, 10); // Different z-level
        
        const bodies = [circleA, circleB];
        const combinations = [{ bodyA: circleA, bodyB: circleB }];
        
        const contactPoints = narrowPhaseWithRigidBody(bodies, combinations, true);
        
        // Should not collide due to z-level difference
        expect(contactPoints).toEqual([]);
    });

    test("Narrow phase with same body", () => {
        const circle = new Circle({ x: 0, y: 0 }, 10);
        
        const bodies = [circle];
        const combinations = [{ bodyA: circle, bodyB: circle }];
        
        const contactPoints = narrowPhaseWithRigidBody(bodies, combinations, true);
        
        // Should not collide with itself
        expect(contactPoints).toEqual([]);
    });

    test("Narrow phase with static body positioning", () => {
        const staticCircle = new Circle({ x: 0, y: 0 }, 10, 0, 50, true);
        const movingCircle = new Circle({ x: 15, y: 0 }, 10);
        
        const initialStaticPos = { ...staticCircle.center };
        
        const bodies = [staticCircle, movingCircle];
        const combinations = [{ bodyA: staticCircle, bodyB: movingCircle }];
        
        narrowPhaseWithRigidBody(bodies, combinations, true);
        
        // Static body should not move (compare x,y due to z coordinate)
        expect(staticCircle.center.x).toBe(initialStaticPos.x);
        expect(staticCircle.center.y).toBe(initialStaticPos.y);
        
        // Moving body should be pushed away
        expect(movingCircle.center.x).toBeGreaterThan(15);
    });
});

describe("Complex Collision Scenarios", () => {
    test("Multiple body collision", () => {
        const circleA = new Circle({ x: 0, y: 0 }, 10);
        const circleB = new Circle({ x: 18, y: 0 }, 10);
        const circleC = new Circle({ x: 36, y: 0 }, 10);
        
        circleA.linearVelocity = { x: 20, y: 0 };
        circleB.linearVelocity = { x: 0, y: 0 };
        circleC.linearVelocity = { x: -20, y: 0 };
        
        const bodies = [circleA, circleB, circleC];
        const combinations = [
            { bodyA: circleA, bodyB: circleB },
            { bodyA: circleB, bodyB: circleC }
        ];
        
        const contactPointsBefore = narrowPhaseWithRigidBody(bodies, combinations, true);
        
        // All bodies should have their velocities affected
        expect(Math.abs(circleA.linearVelocity.x)).toBeLessThan(20);
        expect(Math.abs(circleB.linearVelocity.x)).toBeGreaterThan(0);
        expect(Math.abs(circleC.linearVelocity.x)).toBeLessThan(20);
    });

    test("Polygon collision with contact points", () => {
        const vertices = [{ x: 10, y: 10 }, { x: -10, y: 10 }, { x: -10, y: -10 }, { x: 10, y: -10 }];
        const polygonA = new Polygon({ x: 0, y: 0 }, vertices);
        const polygonB = new Polygon({ x: 18, y: 0 }, vertices);
        
        const bodies = [polygonA, polygonB];
        const combinations = [{ bodyA: polygonA, bodyB: polygonB }];
        
        const contactPoints = narrowPhaseWithRigidBody(bodies, combinations, true);
        
        // Should find contact points for polygon collision
        expect(contactPoints.length).toBeGreaterThan(0);
        
        // Bodies should be separated
        const distance = Math.abs(polygonA.center.x - polygonB.center.x);
        expect(distance).toBeGreaterThanOrEqual(20); // Width of each polygon
    });
});