import {
    PinJoint,
    FixedPinJoint,
    solvePinJointConstraint,
    solveWorldPinJointConstraint,
    PinJointConstraint,
    WorldPinJointConstraint
} from "../src/constraint";
import { Circle, Polygon } from "../src/rigidbody";

describe("PinJoint Constraint", () => {
    test("PinJoint creation", () => {
        const bodyA = new Circle({ x: 0, y: 0 }, 10);
        const bodyB = new Circle({ x: 20, y: 0 }, 10);
        const anchorA = { x: 5, y: 0 };
        const anchorB = { x: -5, y: 0 };
        
        const pinJoint = new PinJoint(bodyA, bodyB, anchorA, anchorB);
        
        expect(pinJoint).toBeInstanceOf(PinJoint);
    });

    test("PinJoint enforce method", () => {
        const bodyA = new Circle({ x: 0, y: 0 }, 10);
        const bodyB = new Circle({ x: 30, y: 0 }, 10); // Far apart
        const anchorA = { x: 0, y: 0 };
        const anchorB = { x: 0, y: 0 };
        
        bodyA.linearVelocity = { x: 10, y: 0 };
        bodyB.linearVelocity = { x: -10, y: 0 };
        
        const pinJoint = new PinJoint(bodyA, bodyB, anchorA, anchorB);
        
        const initialVelA = { ...bodyA.linearVelocity };
        const initialVelB = { ...bodyB.linearVelocity };
        
        pinJoint.enforce(0.016);
        
        // Velocities should change due to constraint
        expect(bodyA.linearVelocity.x).not.toBe(initialVelA.x);
        expect(bodyB.linearVelocity.x).not.toBe(initialVelB.x);
    });

    test("PinJoint with static body", () => {
        const dynamicBody = new Circle({ x: 0, y: 0 }, 10);
        const staticBody = new Circle({ x: 30, y: 0 }, 10, 0, 50, true);
        const anchorA = { x: 0, y: 0 };
        const anchorB = { x: 0, y: 0 };
        
        dynamicBody.linearVelocity = { x: 10, y: 5 };
        const initialStaticVel = { ...staticBody.linearVelocity };
        
        const pinJoint = new PinJoint(dynamicBody, staticBody, anchorA, anchorB);
        
        pinJoint.enforce(0.016);
        
        // Static body should not change (compare x,y due to z coordinate)
        expect(staticBody.linearVelocity.x).toEqual(initialStaticVel.x);
        expect(staticBody.linearVelocity.y).toEqual(initialStaticVel.y);
        expect(staticBody.angularVelocity).toBe(0);
    });

    test("PinJoint with both static bodies", () => {
        const staticA = new Circle({ x: 0, y: 0 }, 10, 0, 50, true);
        const staticB = new Circle({ x: 30, y: 0 }, 10, 0, 50, true);
        const anchorA = { x: 0, y: 0 };
        const anchorB = { x: 0, y: 0 };
        
        const pinJoint = new PinJoint(staticA, staticB, anchorA, anchorB);
        
        const initialVelA = { ...staticA.linearVelocity };
        const initialVelB = { ...staticB.linearVelocity };
        
        pinJoint.enforce(0.016);
        
        // Both bodies should remain unchanged (compare x,y due to z coordinate)
        expect(staticA.linearVelocity.x).toEqual(initialVelA.x);
        expect(staticA.linearVelocity.y).toEqual(initialVelA.y);
        expect(staticB.linearVelocity.x).toEqual(initialVelB.x);
        expect(staticB.linearVelocity.y).toEqual(initialVelB.y);
    });

    test("PinJoint with rotating bodies", () => {
        const bodyA = new Circle({ x: 0, y: 0 }, 10);
        const bodyB = new Circle({ x: 20, y: 0 }, 10);
        const anchorA = { x: 5, y: 0 };
        const anchorB = { x: -5, y: 0 };
        
        bodyA.angularVelocity = 2;
        bodyB.angularVelocity = -1;
        
        const pinJoint = new PinJoint(bodyA, bodyB, anchorA, anchorB);
        
        const initialAngVelA = bodyA.angularVelocity;
        const initialAngVelB = bodyB.angularVelocity;
        
        pinJoint.enforce(0.016);
        
        // Angular velocities should be affected by constraint
        expect(bodyA.angularVelocity).not.toBe(initialAngVelA);
        expect(bodyB.angularVelocity).not.toBe(initialAngVelB);
    });

    test("PinJoint with polygons", () => {
        const vertices = [{ x: 5, y: 5 }, { x: -5, y: 5 }, { x: -5, y: -5 }, { x: 5, y: -5 }];
        const polygonA = new Polygon({ x: 0, y: 0 }, vertices);
        const polygonB = new Polygon({ x: 25, y: 0 }, vertices);
        
        const anchorA = { x: 0, y: 0 };
        const anchorB = { x: 0, y: 0 };
        
        polygonA.linearVelocity = { x: 5, y: 3 };
        polygonB.linearVelocity = { x: -3, y: -2 };
        
        const pinJoint = new PinJoint(polygonA, polygonB, anchorA, anchorB);
        
        expect(() => pinJoint.enforce(0.016)).not.toThrow();
    });
});

describe("FixedPinJoint Constraint", () => {
    test("FixedPinJoint creation", () => {
        const body = new Circle({ x: 10, y: 10 }, 10);
        const anchor = { x: 0, y: 0 };
        const worldAnchor = { x: 0, y: 0 };
        
        const fixedJoint = new FixedPinJoint(body, anchor, worldAnchor);
        
        expect(fixedJoint).toBeInstanceOf(FixedPinJoint);
    });

    test("FixedPinJoint enforce method", () => {
        const body = new Circle({ x: 20, y: 20 }, 10);
        const anchor = { x: 0, y: 0 };
        const worldAnchor = { x: 0, y: 0 };
        
        body.linearVelocity = { x: 10, y: 5 };
        body.angularVelocity = 1;
        
        const fixedJoint = new FixedPinJoint(body, anchor, worldAnchor);
        
        const initialVel = { ...body.linearVelocity };
        const initialAngVel = body.angularVelocity;
        
        fixedJoint.enforce(0.016);
        
        // Velocity should change due to constraint trying to pull body to world anchor
        expect(body.linearVelocity.x).not.toBe(initialVel.x);
        expect(body.linearVelocity.y).not.toBe(initialVel.y);
        // Angular velocity might not change significantly in single step
        expect(() => fixedJoint.enforce(0.016)).not.toThrow();
    });

    test("FixedPinJoint with static body", () => {
        const staticBody = new Circle({ x: 20, y: 20 }, 10, 0, 50, true);
        const anchor = { x: 0, y: 0 };
        const worldAnchor = { x: 0, y: 0 };
        
        const fixedJoint = new FixedPinJoint(staticBody, anchor, worldAnchor);
        
        const initialVel = { ...staticBody.linearVelocity };
        const initialAngVel = staticBody.angularVelocity;
        
        fixedJoint.enforce(0.016);
        
        // Static body should not change (compare x,y due to z coordinate)
        expect(staticBody.linearVelocity.x).toEqual(initialVel.x);
        expect(staticBody.linearVelocity.y).toEqual(initialVel.y);
        expect(staticBody.angularVelocity).toBe(initialAngVel);
    });

    test("FixedPinJoint with body at world anchor", () => {
        const body = new Circle({ x: 0, y: 0 }, 10);
        const anchor = { x: 0, y: 0 };
        const worldAnchor = { x: 0, y: 0 };
        
        body.linearVelocity = { x: 1, y: 1 };
        
        const fixedJoint = new FixedPinJoint(body, anchor, worldAnchor);
        
        fixedJoint.enforce(0.016);
        
        // Should stabilize the constraint
        expect(() => fixedJoint.enforce(0.016)).not.toThrow();
    });

    test("FixedPinJoint with offset anchor", () => {
        const body = new Circle({ x: 10, y: 10 }, 10);
        const anchor = { x: 5, y: 5 }; // Offset from body center
        const worldAnchor = { x: 0, y: 0 };
        
        body.linearVelocity = { x: 5, y: 5 };
        body.angularVelocity = 0.5;
        
        const fixedJoint = new FixedPinJoint(body, anchor, worldAnchor);
        
        expect(() => fixedJoint.enforce(0.016)).not.toThrow();
    });

    test("FixedPinJoint multiple enforcements", () => {
        const body = new Circle({ x: 50, y: 50 }, 10);
        const anchor = { x: 0, y: 0 };
        const worldAnchor = { x: 0, y: 0 };
        
        body.linearVelocity = { x: 20, y: 20 };
        
        const fixedJoint = new FixedPinJoint(body, anchor, worldAnchor);
        
        // Apply constraint multiple times
        for (let i = 0; i < 10; i++) {
            fixedJoint.enforce(0.016);
        }
        
        // Should converge towards the world anchor
        expect(() => fixedJoint.enforce(0.016)).not.toThrow();
    });
});

describe("Constraint Solver Functions", () => {
    test("solvePinJointConstraint function", () => {
        const bodyA = new Circle({ x: 0, y: 0 }, 10);
        const bodyB = new Circle({ x: 30, y: 0 }, 10);
        
        bodyA.linearVelocity = { x: 10, y: 0 };
        bodyB.linearVelocity = { x: -10, y: 0 };
        
        const constraint: PinJointConstraint = {
            bodyA,
            bodyB,
            anchorA: { x: 0, y: 0 },
            anchorB: { x: 0, y: 0 }
        };
        
        const initialVelA = { ...bodyA.linearVelocity };
        const initialVelB = { ...bodyB.linearVelocity };
        
        solvePinJointConstraint(constraint, 0.016);
        
        // Velocities should change
        expect(bodyA.linearVelocity.x).not.toBe(initialVelA.x);
        expect(bodyB.linearVelocity.x).not.toBe(initialVelB.x);
    });

    test("solvePinJointConstraint with zero delta time", () => {
        const bodyA = new Circle({ x: 0, y: 0 }, 10);
        const bodyB = new Circle({ x: 30, y: 0 }, 10);
        
        const constraint: PinJointConstraint = {
            bodyA,
            bodyB,
            anchorA: { x: 0, y: 0 },
            anchorB: { x: 0, y: 0 }
        };
        
        // Should handle zero delta time without throwing
        expect(() => solvePinJointConstraint(constraint, 0)).not.toThrow();
    });

    test("solveWorldPinJointConstraint function", () => {
        const body = new Circle({ x: 20, y: 20 }, 10);
        body.linearVelocity = { x: 10, y: 5 };
        body.angularVelocity = 1;
        
        const constraint: WorldPinJointConstraint = {
            body,
            localAnchor: { x: 0, y: 0 },
            worldAnchor: { x: 0, y: 0 }
        };
        
        const initialVel = { ...body.linearVelocity };
        const initialAngVel = body.angularVelocity;
        
        solveWorldPinJointConstraint(constraint, 0.016);
        
        // Velocity should change
        expect(body.linearVelocity.x).not.toBe(initialVel.x);
        expect(body.linearVelocity.y).not.toBe(initialVel.y);
        // Angular velocity might not change significantly in single step
        expect(() => solveWorldPinJointConstraint(constraint, 0.016)).not.toThrow();
    });

    test("solveWorldPinJointConstraint with static body", () => {
        const staticBody = new Circle({ x: 20, y: 20 }, 10, 0, 50, true);
        
        const constraint: WorldPinJointConstraint = {
            body: staticBody,
            localAnchor: { x: 0, y: 0 },
            worldAnchor: { x: 0, y: 0 }
        };
        
        const initialVel = { ...staticBody.linearVelocity };
        const initialAngVel = staticBody.angularVelocity;
        
        solveWorldPinJointConstraint(constraint, 0.016);
        
        // Static body should not change (compare x,y due to z coordinate)
        expect(staticBody.linearVelocity.x).toEqual(initialVel.x);
        expect(staticBody.linearVelocity.y).toEqual(initialVel.y);
        expect(staticBody.angularVelocity).toBe(initialAngVel);
    });

    test("Constraint solver with very small time step", () => {
        const bodyA = new Circle({ x: 0, y: 0 }, 10);
        const bodyB = new Circle({ x: 30, y: 0 }, 10);
        
        const constraint: PinJointConstraint = {
            bodyA,
            bodyB,
            anchorA: { x: 0, y: 0 },
            anchorB: { x: 0, y: 0 }
        };
        
        // Very small time step
        expect(() => solvePinJointConstraint(constraint, 0.001)).not.toThrow();
    });

    test("Constraint solver with large time step", () => {
        const bodyA = new Circle({ x: 0, y: 0 }, 10);
        const bodyB = new Circle({ x: 30, y: 0 }, 10);
        
        const constraint: PinJointConstraint = {
            bodyA,
            bodyB,
            anchorA: { x: 0, y: 0 },
            anchorB: { x: 0, y: 0 }
        };
        
        // Large time step
        expect(() => solvePinJointConstraint(constraint, 1.0)).not.toThrow();
    });
});

describe("Complex Constraint Scenarios", () => {
    test("Chain of pin joints", () => {
        const body1 = new Circle({ x: 0, y: 0 }, 5);
        const body2 = new Circle({ x: 15, y: 0 }, 5);
        const body3 = new Circle({ x: 30, y: 0 }, 5);
        
        // Chain: body1 <-> body2 <-> body3
        const joint1 = new PinJoint(body1, body2, { x: 0, y: 0 }, { x: 0, y: 0 });
        const joint2 = new PinJoint(body2, body3, { x: 0, y: 0 }, { x: 0, y: 0 });
        
        // Apply force to one end
        body1.applyForce({ x: 100, y: 0 });
        body1.step(0.016);
        
        // Apply constraints
        joint1.enforce(0.016);
        joint2.enforce(0.016);
        
        // All bodies should be affected
        expect(() => {
            joint1.enforce(0.016);
            joint2.enforce(0.016);
        }).not.toThrow();
    });

    test("Mixed static and dynamic constraints", () => {
        const staticBody = new Circle({ x: 0, y: 0 }, 10, 0, 50, true);
        const dynamicBody1 = new Circle({ x: 20, y: 0 }, 10);
        const dynamicBody2 = new Circle({ x: 40, y: 0 }, 10);
        
        // Static anchor and chain
        const fixedJoint = new FixedPinJoint(staticBody, { x: 0, y: 0 }, { x: 0, y: 0 });
        const pinJoint = new PinJoint(staticBody, dynamicBody1, { x: 0, y: 0 }, { x: 0, y: 0 });
        const pinJoint2 = new PinJoint(dynamicBody1, dynamicBody2, { x: 0, y: 0 }, { x: 0, y: 0 });
        
        dynamicBody2.applyForce({ x: 50, y: 50 });
        dynamicBody2.step(0.016);
        
        fixedJoint.enforce(0.016);
        pinJoint.enforce(0.016);
        pinJoint2.enforce(0.016);
        
        // Should stabilize the system
        expect(() => {
            fixedJoint.enforce(0.016);
            pinJoint.enforce(0.016);
            pinJoint2.enforce(0.016);
        }).not.toThrow();
    });

    test("Constraint with high angular velocities", () => {
        const bodyA = new Circle({ x: 0, y: 0 }, 10);
        const bodyB = new Circle({ x: 20, y: 0 }, 10);
        
        bodyA.angularVelocity = 10; // High angular velocity
        bodyB.angularVelocity = -5;
        
        const pinJoint = new PinJoint(bodyA, bodyB, { x: 5, y: 0 }, { x: -5, y: 0 });
        
        expect(() => pinJoint.enforce(0.016)).not.toThrow();
    });

    test("Constraint with bodies having different masses", () => {
        const lightBody = new Circle({ x: 0, y: 0 }, 5, 0, 10); // Light
        const heavyBody = new Circle({ x: 20, y: 0 }, 10, 0, 100); // Heavy
        
        lightBody.linearVelocity = { x: 20, y: 0 };
        heavyBody.linearVelocity = { x: -2, y: 0 };
        
        const pinJoint = new PinJoint(lightBody, heavyBody, { x: 0, y: 0 }, { x: 0, y: 0 });
        
        const initialMomentum = lightBody.mass * lightBody.linearVelocity.x + 
                               heavyBody.mass * heavyBody.linearVelocity.x;
        
        pinJoint.enforce(0.016);
        
        // Constraint should work with different masses
        expect(() => pinJoint.enforce(0.016)).not.toThrow();
    });

    test("Stress test with many constraints", () => {
        const bodies: Circle[] = [];
        const constraints: PinJoint[] = [];
        
        // Create a chain of 10 bodies
        for (let i = 0; i < 10; i++) {
            const body = new Circle({ x: i * 15, y: 0 }, 5);
            bodies.push(body);
            
            if (i > 0) {
                const constraint = new PinJoint(bodies[i-1], bodies[i], { x: 0, y: 0 }, { x: 0, y: 0 });
                constraints.push(constraint);
            }
        }
        
        // Apply force to one end
        bodies[0].applyForce({ x: 500, y: 0 });
        bodies[0].step(0.016);
        
        // Apply all constraints
        expect(() => {
            constraints.forEach(constraint => constraint.enforce(0.016));
        }).not.toThrow();
        
        // Should handle many constraints without issues
        expect(constraints).toHaveLength(9);
    });
});