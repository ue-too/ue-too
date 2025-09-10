import { World } from "../src/world";
import { Circle, Polygon } from "../src/rigidbody";
import { PinJoint, FixedPinJoint } from "../src/constraint";

describe("World", () => {
    let world: World;

    beforeEach(() => {
        world = new World(1000, 1000);
    });

    test("World initialization", () => {
        expect(world).toBeInstanceOf(World);
        expect(world.resolveCollision).toBe(true);
        expect(world.getRigidBodyList()).toHaveLength(0);
        expect(world.getRigidBodyMap().size).toBe(0);
    });

    test("Add rigid body", () => {
        const circle = new Circle({ x: 10, y: 20 }, 15);
        
        world.addRigidBody("circle1", circle);
        
        expect(world.getRigidBodyList()).toHaveLength(1);
        expect(world.getRigidBodyMap().get("circle1")).toBe(circle);
        expect(world.getRigidBodyMap().has("circle1")).toBe(true);
    });

    test("Add multiple rigid bodies", () => {
        const circle = new Circle({ x: 10, y: 20 }, 15);
        const vertices = [{ x: 10, y: 10 }, { x: -10, y: 10 }, { x: -10, y: -10 }, { x: 10, y: -10 }];
        const polygon = new Polygon({ x: 50, y: 50 }, vertices);
        
        world.addRigidBody("circle1", circle);
        world.addRigidBody("polygon1", polygon);
        
        expect(world.getRigidBodyList()).toHaveLength(2);
        expect(world.getRigidBodyMap().size).toBe(2);
        expect(world.getRigidBodyMap().get("circle1")).toBe(circle);
        expect(world.getRigidBodyMap().get("polygon1")).toBe(polygon);
    });

    test("Remove rigid body", () => {
        const circle = new Circle({ x: 10, y: 20 }, 15);
        
        world.addRigidBody("circle1", circle);
        expect(world.getRigidBodyMap().has("circle1")).toBe(true);
        
        world.removeRigidBody("circle1");
        expect(world.getRigidBodyMap().has("circle1")).toBe(false);
        expect(world.getRigidBodyMap().size).toBe(0);
    });

    test("Remove non-existent rigid body", () => {
        // Should not throw error
        world.removeRigidBody("nonexistent");
        expect(world.getRigidBodyMap().size).toBe(0);
    });

    test("Collision resolution flag", () => {
        expect(world.resolveCollision).toBe(true);
        
        world.resolveCollision = false;
        expect(world.resolveCollision).toBe(false);
        
        world.resolveCollision = true;
        expect(world.resolveCollision).toBe(true);
    });

    test("Set world dimensions", () => {
        world.setMaxTransWidth(500);
        world.setMaxTransHeight(300);
        
        // We can't directly test the internal bounds, but we can ensure no errors occur
        expect(() => world.step(0.016)).not.toThrow();
    });

    test("World step without bodies", () => {
        // Should not throw error with empty world
        expect(() => world.step(0.016)).not.toThrow();
    });

    test("World step with single body", () => {
        const circle = new Circle({ x: 0, y: 0 }, 10, 0, 50, false, false); // Disable friction
        circle.applyForce({ x: 100, y: 0 });
        
        world.addRigidBody("circle1", circle);
        
        const initialPosition = { ...circle.center };
        world.step(0.016);
        
        // Body should have moved due to applied force
        expect(circle.center.x).toBeGreaterThan(initialPosition.x);
        expect(circle.linearVelocity.x).toBeGreaterThan(0);
    });

    test("World step with multiple bodies", () => {
        const circle1 = new Circle({ x: 0, y: 0 }, 10, 0, 50, false, false); // Disable friction
        const circle2 = new Circle({ x: 100, y: 0 }, 10, 0, 50, false, false); // Disable friction
        
        circle1.applyForce({ x: 50, y: 0 });
        circle2.applyForce({ x: -30, y: 0 });
        
        world.addRigidBody("circle1", circle1);
        world.addRigidBody("circle2", circle2);
        
        const initialPos1 = { ...circle1.center };
        const initialPos2 = { ...circle2.center };
        
        world.step(0.016);
        
        // Both bodies should have moved
        expect(circle1.center.x).toBeGreaterThan(initialPos1.x);
        expect(circle2.center.x).toBeLessThan(initialPos2.x);
    });

    test("World step with collision resolution disabled", () => {
        const circle1 = new Circle({ x: 0, y: 0 }, 10);
        const circle2 = new Circle({ x: 15, y: 0 }, 10); // Overlapping
        
        circle1.linearVelocity = { x: 10, y: 0 };
        circle2.linearVelocity = { x: -10, y: 0 };
        
        world.addRigidBody("circle1", circle1);
        world.addRigidBody("circle2", circle2);
        
        world.resolveCollision = false;
        
        const initialVel1 = { ...circle1.linearVelocity };
        const initialVel2 = { ...circle2.linearVelocity };
        
        world.step(0.016);
        
        // Velocities should remain unchanged since collision resolution is disabled
        // Note: They might change slightly due to physics integration, but not due to collision
        expect(Math.abs(circle1.linearVelocity.x - initialVel1.x)).toBeLessThan(1);
        expect(Math.abs(circle2.linearVelocity.x - initialVel2.x)).toBeLessThan(1);
    });

    test("World collision resolution", () => {
        const circle1 = new Circle({ x: 0, y: 0 }, 10);
        const circle2 = new Circle({ x: 15, y: 0 }, 10); // Overlapping
        
        circle1.linearVelocity = { x: 20, y: 0 };
        circle2.linearVelocity = { x: -20, y: 0 };
        
        world.addRigidBody("circle1", circle1);
        world.addRigidBody("circle2", circle2);
        
        world.step(0.016);
        
        // After collision, velocities should be different
        expect(circle1.linearVelocity.x).toBeLessThan(20);
        expect(circle2.linearVelocity.x).toBeGreaterThan(-20);
        
        // Bodies should be separated
        const distance = Math.sqrt(
            Math.pow(circle1.center.x - circle2.center.x, 2) +
            Math.pow(circle1.center.y - circle2.center.y, 2)
        );
        expect(distance).toBeGreaterThanOrEqual(20); // Sum of radii
    });

    test("World with static and dynamic bodies", () => {
        const staticCircle = new Circle({ x: 0, y: 0 }, 10, 0, 50, true);
        const dynamicCircle = new Circle({ x: 15, y: 0 }, 10);
        
        dynamicCircle.linearVelocity = { x: -20, y: 0 };
        
        world.addRigidBody("static", staticCircle);
        world.addRigidBody("dynamic", dynamicCircle);
        
        const initialStaticPos = { ...staticCircle.center };
        
        world.step(0.016);
        
        // Static body should not move (compare x,y only due to z coordinate)
        expect(staticCircle.center.x).toBe(initialStaticPos.x);
        expect(staticCircle.center.y).toBe(initialStaticPos.y);
        
        // Dynamic body should bounce back
        expect(dynamicCircle.linearVelocity.x).toBeGreaterThan(0);
    });

    test("World physics integration over multiple steps", () => {
        const circle = new Circle({ x: 0, y: 0 }, 10, 0, 50, false, false); // Disable friction
        circle.applyForce({ x: 100, y: 0 });
        
        world.addRigidBody("circle1", circle);
        
        // Run multiple physics steps
        for (let i = 0; i < 10; i++) {
            world.step(0.016);
        }
        
        // Body should have significant displacement and velocity
        expect(circle.center.x).toBeGreaterThan(0);
        expect(circle.linearVelocity.x).toBeGreaterThan(0);
    });

    test("World with polygon bodies", () => {
        const vertices = [{ x: 10, y: 10 }, { x: -10, y: 10 }, { x: -10, y: -10 }, { x: 10, y: -10 }];
        const polygon1 = new Polygon({ x: 0, y: 0 }, vertices);
        const polygon2 = new Polygon({ x: 18, y: 0 }, vertices); // Overlapping
        
        polygon1.linearVelocity = { x: 10, y: 0 };
        polygon2.linearVelocity = { x: -10, y: 0 };
        
        world.addRigidBody("poly1", polygon1);
        world.addRigidBody("poly2", polygon2);
        
        world.step(0.016);
        
        // Polygons should collide and change velocities
        expect(polygon1.linearVelocity.x).toBeLessThan(10);
        expect(polygon2.linearVelocity.x).toBeGreaterThan(-10);
    });

    test("World resolveCollisionPhase method", () => {
        const circle1 = new Circle({ x: 0, y: 0 }, 10);
        const circle2 = new Circle({ x: 15, y: 0 }, 10);
        
        world.addRigidBody("circle1", circle1);
        world.addRigidBody("circle2", circle2);
        
        const contactPoints = world.resolveCollisionPhase();
        
        // Should return contact points array (may be empty if no collisions)
        expect(Array.isArray(contactPoints)).toBe(true);
    });

    test("World with many bodies performance", () => {
        // Add many bodies to test quadtree efficiency
        for (let i = 0; i < 50; i++) {
            const circle = new Circle(
                { x: Math.random() * 200 - 100, y: Math.random() * 200 - 100 },
                5
            );
            world.addRigidBody(`circle${i}`, circle);
        }
        
        expect(world.getRigidBodyList()).toHaveLength(50);
        
        // Should handle many bodies without errors
        expect(() => world.step(0.016)).not.toThrow();
    });
});

describe("World Constraint System", () => {
    let world: World;

    beforeEach(() => {
        world = new World(1000, 1000);
    });

    test("Add constraints to world", () => {
        const circle1 = new Circle({ x: 0, y: 0 }, 10);
        const circle2 = new Circle({ x: 20, y: 0 }, 10);
        
        const constraint = new PinJoint(circle1, circle2, { x: 0, y: 0 }, { x: 0, y: 0 });
        
        world.addConstraint(constraint);
        
        expect(world.getConstraints()).toHaveLength(1);
        expect(world.getConstraints()[0]).toBe(constraint);
    });

    test("Add multiple constraints", () => {
        const circle1 = new Circle({ x: 0, y: 0 }, 10);
        const circle2 = new Circle({ x: 20, y: 0 }, 10);
        const circle3 = new Circle({ x: 40, y: 0 }, 10);
        
        const constraint1 = new PinJoint(circle1, circle2, { x: 0, y: 0 }, { x: 0, y: 0 });
        const constraint2 = new FixedPinJoint(circle3, { x: 0, y: 0 }, { x: 40, y: 0 });
        
        world.addConstraint(constraint1);
        world.addConstraint(constraint2);
        
        expect(world.getConstraints()).toHaveLength(2);
    });

    test("World step with constraints", () => {
        const circle1 = new Circle({ x: 0, y: 0 }, 10);
        const circle2 = new Circle({ x: 30, y: 0 }, 10); // Beyond pin joint distance
        
        world.addRigidBody("circle1", circle1);
        world.addRigidBody("circle2", circle2);
        
        const constraint = new PinJoint(circle1, circle2, { x: 0, y: 0 }, { x: 0, y: 0 });
        world.addConstraint(constraint);
        
        // Apply force to one body
        circle1.applyForce({ x: 100, y: 0 });
        
        world.step(0.016);
        
        // Both bodies should be affected by the constraint
        // The exact behavior depends on the constraint implementation
        expect(() => world.step(0.016)).not.toThrow();
    });

    test("World with fixed pin joint constraint", () => {
        const circle = new Circle({ x: 10, y: 10 }, 10);
        const worldAnchor = { x: 0, y: 0 };
        
        world.addRigidBody("circle", circle);
        
        const constraint = new FixedPinJoint(circle, { x: 0, y: 0 }, worldAnchor);
        world.addConstraint(constraint);
        
        // Apply force to body
        circle.applyForce({ x: 100, y: 100 });
        
        // Run multiple steps
        for (let i = 0; i < 10; i++) {
            world.step(0.016);
        }
        
        // Body should be constrained near the world anchor
        expect(() => world.step(0.016)).not.toThrow();
    });

    test("World addPinJoint convenience method", () => {
        const circle1 = new Circle({ x: 0, y: 0 }, 10);
        const circle2 = new Circle({ x: 20, y: 0 }, 10);
        
        const anchorA = { x: 5, y: 0 };
        const anchorB = { x: -5, y: 0 };
        
        world.addPinJoint(circle1, circle2, anchorA, anchorB);
        
        // This method adds to internal pinJoints array
        // We can't directly test it, but ensure no errors
        expect(() => world.step(0.016)).not.toThrow();
    });
});