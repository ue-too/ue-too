import { Point, PointCal } from "@ue-too/math";
import { RigidBody } from "./rigidbody";

/**
 * Physics constraint interface.
 *
 * @remarks
 * Constraints restrict the motion of rigid bodies. Common examples include
 * pin joints, distance constraints, and angle limits.
 *
 * Constraints are solved using iterative methods and Baumgarte stabilization
 * to prevent drift over time.
 *
 * @category Constraints
 */
export interface Constraint {
    /**
     * Enforces the constraint for one timestep.
     *
     * @param dt - Timestep in seconds
     */
    enforce(dt: number): void;
}

/**
 * Pin joint connecting a body to a fixed world point.
 *
 * @remarks
 * Creates a pendulum-like constraint where a point on the body is pinned
 * to a fixed location in world space. The body can rotate around this point.
 *
 * Uses Baumgarte stabilization to prevent drift.
 *
 * @example
 * Create a pendulum
 * ```typescript
 * const bob = new Circle({ x: 0, y: 100 }, 20, 0, 10, false);
 * const joint = new FixedPinJoint(
 *   bob,
 *   { x: 0, y: 0 },  // Anchor on bob (center)
 *   { x: 0, y: 0 }   // World anchor (ceiling)
 * );
 * world.addRigidBody('bob', bob);
 * world.addConstraint(joint);
 * ```
 *
 * @category Constraints
 */
export class FixedPinJoint implements Constraint {

    private anchorA: Point;
    private worldAnchorA: Point;
    private bodyA: RigidBody;

    constructor(bodyA: RigidBody, anchorA: Point, worldAnchorA: Point) {
        this.bodyA = bodyA;
        this.anchorA = anchorA;
        this.worldAnchorA = worldAnchorA;
    }

    enforce(dt: number): void {
        this.solveWorldPinJointConstraint(dt);
    }

    solveWorldPinJointConstraint(dt: number) {
        const body = this.bodyA;
        const localAnchor = this.anchorA;
        const worldAnchor = this.worldAnchorA;

        // Transform local anchor point to world space
        const worldAnchorOnBody = PointCal.addVector(body.center, PointCal.rotatePoint(localAnchor, body.orientationAngle));

        // Calculate the difference between the anchor points
        const diff = PointCal.subVector(worldAnchorOnBody, worldAnchor);

        // Calculate the relative velocity of the anchor point
        const r = PointCal.subVector(worldAnchorOnBody, body.center);
        const velocity = PointCal.addVector(
            body.linearVelocity,
            PointCal.crossProduct({x: 0, y: 0, z: body.angularVelocity}, r)
        );

        // Calculate the mass matrix
        const invMass = body.isStatic() ? 0 : 1 / body.mass;
        const invI = body.isStatic() ? 0 : 1 / body.momentOfInertia;

        const K = {
            x: invMass + invI * r.y * r.y,
            y: invMass + invI * r.x * r.x,
            xy: -invI * r.x * r.y
        };

        // Calculate the impulse
        const baumgarte = 1; // Baumgarte stabilization factor
        const impulse = {
            x: -K.x * diff.x - K.xy * diff.y - baumgarte * diff.x / dt - velocity.x,
            y: -K.xy * diff.x - K.y * diff.y - baumgarte * diff.y / dt - velocity.y
        };

        // Apply the impulse
        if (!body.isStatic()) {
            body.linearVelocity.x += invMass * impulse.x;
            body.linearVelocity.y += invMass * impulse.y;
            body.angularVelocity += invI * (r.x * impulse.y - r.y * impulse.x);
        }
    }
}

/**
 * Pin joint connecting two bodies together.
 *
 * @remarks
 * Connects two bodies at specified anchor points. The bodies can rotate
 * relative to each other around the joint.
 *
 * Useful for creating chains, ragdolls, and mechanical linkages.
 *
 * @example
 * Create a chain
 * ```typescript
 * const link1 = new Circle({ x: 0, y: 0 }, 10);
 * const link2 = new Circle({ x: 30, y: 0 }, 10);
 *
 * const joint = new PinJoint(
 *   link1,
 *   link2,
 *   { x: 10, y: 0 },   // Right edge of link1
 *   { x: -10, y: 0 }   // Left edge of link2
 * );
 *
 * world.addRigidBody('link1', link1);
 * world.addRigidBody('link2', link2);
 * world.addConstraint(joint);
 * ```
 *
 * @category Constraints
 */
export class PinJoint implements Constraint {

    private anchorA: Point;
    private anchorB: Point;
    private bodyA: RigidBody;
    private bodyB: RigidBody;

    constructor(bodyA: RigidBody, bodyB: RigidBody, anchorA: Point, anchorB: Point) {
        this.bodyA = bodyA;
        this.bodyB = bodyB;
        this.anchorA = anchorA;
        this.anchorB = anchorB;
    }

    enforce(dt: number): void {
        this.solvePinJointConstraint(dt);
    }

    solvePinJointConstraint(dt: number) {
        const bodyA = this.bodyA;
        const bodyB = this.bodyB;
        const anchorA = this.anchorA;
        const anchorB = this.anchorB;

        // Transform local anchor points to world space
        const worldAnchorA = PointCal.addVector(bodyA.center, PointCal.rotatePoint(anchorA, bodyA.orientationAngle));
        const worldAnchorB = PointCal.addVector(bodyB.center, PointCal.rotatePoint(anchorB, bodyB.orientationAngle));
    
        // Calculate the difference between the two anchor points in world space
        const diff = PointCal.subVector(worldAnchorB, worldAnchorA);
    
        // Calculate the relative velocity of the anchor points
        const rA = PointCal.subVector(worldAnchorA, bodyA.center);
        const rB = PointCal.subVector(worldAnchorB, bodyB.center);
        const relativeVelocity = PointCal.subVector(
            PointCal.addVector(bodyB.linearVelocity, PointCal.crossProduct({x: 0, y: 0, z: bodyB.angularVelocity}, rB)),
            PointCal.addVector(bodyA.linearVelocity, PointCal.crossProduct({x: 0, y: 0, z: bodyA.angularVelocity}, rA))
        );
    
        // Calculate the mass matrix
        const invMassA = bodyA.isStatic() ? 0 : 1 / bodyA.mass;
        const invMassB = bodyB.isStatic() ? 0 : 1 / bodyB.mass;
        const invIA = bodyA.isStatic() ? 0 : 1 / bodyA.momentOfInertia;
        const invIB = bodyB.isStatic() ? 0 : 1 / bodyB.momentOfInertia;
    
        const K = {
            x: invMassA + invMassB + invIA * rA.y * rA.y + invIB * rB.y * rB.y,
            y: invMassA + invMassB + invIA * rA.x * rA.x + invIB * rB.x * rB.x,
            xy: -invIA * rA.x * rA.y - invIB * rB.x * rB.y
        };
    
        // Calculate the impulse
        const baumgarte = 1; // Baumgarte stabilization factor
        const impulse = {
            x: -K.x * diff.x - K.xy * diff.y - baumgarte * diff.x / dt - relativeVelocity.x,
            y: -K.xy * diff.x - K.y * diff.y - baumgarte * diff.y / dt - relativeVelocity.y
        };
    
        // Apply the impulse
        if (!bodyA.isStatic()) {
            bodyA.linearVelocity.x -= invMassA * impulse.x;
            bodyA.linearVelocity.y -= invMassA * impulse.y;
            bodyA.angularVelocity -= invIA * (rA.x * impulse.y - rA.y * impulse.x);
        }
    
        if (!bodyB.isStatic()) {
            bodyB.linearVelocity.x += invMassB * impulse.x;
            bodyB.linearVelocity.y += invMassB * impulse.y;
            bodyB.angularVelocity += invIB * (rB.x * impulse.y - rB.y * impulse.x);
        }
    }

}

export interface PinJointConstraint {
    bodyA: RigidBody;
    bodyB: RigidBody;
    anchorA: Point; // Local anchor point for bodyA
    anchorB: Point; // Local anchor point for bodyB
}

export function solvePinJointConstraint(constraint: PinJointConstraint, dt: number) {
    const { bodyA, bodyB, anchorA, anchorB } = constraint;

    // Transform local anchor points to world space
    const worldAnchorA = PointCal.addVector(bodyA.center, PointCal.rotatePoint(anchorA, bodyA.orientationAngle));
    const worldAnchorB = PointCal.addVector(bodyB.center, PointCal.rotatePoint(anchorB, bodyB.orientationAngle));

    // Calculate the difference between the two anchor points in world space
    const diff = PointCal.subVector(worldAnchorB, worldAnchorA);

    // Calculate the relative velocity of the anchor points
    const rA = PointCal.subVector(worldAnchorA, bodyA.center);
    const rB = PointCal.subVector(worldAnchorB, bodyB.center);
    const relativeVelocity = PointCal.subVector(
        PointCal.addVector(bodyB.linearVelocity, PointCal.crossProduct({x: 0, y: 0, z: bodyB.angularVelocity}, rB)),
        PointCal.addVector(bodyA.linearVelocity, PointCal.crossProduct({x: 0, y: 0, z: bodyA.angularVelocity}, rA))
    );

    // Calculate the mass matrix
    const invMassA = bodyA.isStatic() ? 0 : 1 / bodyA.mass;
    const invMassB = bodyB.isStatic() ? 0 : 1 / bodyB.mass;
    const invIA = bodyA.isStatic() ? 0 : 1 / bodyA.momentOfInertia;
    const invIB = bodyB.isStatic() ? 0 : 1 / bodyB.momentOfInertia;

    const K = {
        x: invMassA + invMassB + invIA * rA.y * rA.y + invIB * rB.y * rB.y,
        y: invMassA + invMassB + invIA * rA.x * rA.x + invIB * rB.x * rB.x,
        xy: -invIA * rA.x * rA.y - invIB * rB.x * rB.y
    };

    // Calculate the impulse
    const baumgarte = 0.5; // Baumgarte stabilization factor
    const impulse = {
        x: -K.x * diff.x - K.xy * diff.y - baumgarte * diff.x / dt - relativeVelocity.x,
        y: -K.xy * diff.x - K.y * diff.y - baumgarte * diff.y / dt - relativeVelocity.y
    };

    // Apply the impulse
    if (!bodyA.isStatic()) {
        bodyA.linearVelocity.x -= invMassA * impulse.x;
        bodyA.linearVelocity.y -= invMassA * impulse.y;
        bodyA.angularVelocity -= invIA * (rA.x * impulse.y - rA.y * impulse.x);
    }

    if (!bodyB.isStatic()) {
        bodyB.linearVelocity.x += invMassB * impulse.x;
        bodyB.linearVelocity.y += invMassB * impulse.y;
        bodyB.angularVelocity += invIB * (rB.x * impulse.y - rB.y * impulse.x);
    }
}

export interface WorldPinJointConstraint {
    body: RigidBody;
    localAnchor: Point; // Anchor point in body's local space
    worldAnchor: Point; // Fixed point in world space
}

export function solveWorldPinJointConstraint(constraint: WorldPinJointConstraint, dt: number) {
    const { body, localAnchor, worldAnchor } = constraint;

    // Transform local anchor point to world space
    const worldAnchorOnBody = PointCal.addVector(body.center, PointCal.rotatePoint(localAnchor, body.orientationAngle));

    // Calculate the difference between the anchor points
    const diff = PointCal.subVector(worldAnchorOnBody, worldAnchor);

    // Calculate the relative velocity of the anchor point
    const r = PointCal.subVector(worldAnchorOnBody, body.center);
    const velocity = PointCal.addVector(
        body.linearVelocity,
        PointCal.crossProduct({x: 0, y: 0, z: body.angularVelocity}, r)
    );

    // Calculate the mass matrix
    const invMass = body.isStatic() ? 0 : 1 / body.mass;
    const invI = body.isStatic() ? 0 : 1 / body.momentOfInertia;

    const K = {
        x: invMass + invI * r.y * r.y,
        y: invMass + invI * r.x * r.x,
        xy: -invI * r.x * r.y
    };

    // Calculate the impulse
    const baumgarte = 0.2; // Baumgarte stabilization factor
    const impulse = {
        x: -K.x * diff.x - K.xy * diff.y - baumgarte * diff.x / dt - velocity.x,
        y: -K.xy * diff.x - K.y * diff.y - baumgarte * diff.y / dt - velocity.y
    };

    // Apply the impulse
    if (!body.isStatic()) {
        body.linearVelocity.x += invMass * impulse.x;
        body.linearVelocity.y += invMass * impulse.y;
        body.angularVelocity += invI * (r.x * impulse.y - r.y * impulse.x);
    }
}
