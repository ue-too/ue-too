import { Point, PointCal } from '@ue-too/math';

import { canCollide } from './collision-filter';
import { QuadTree } from './quadtree';
import { BaseRigidBody, RigidBody } from './rigidbody';

export function resolveCollision(
    bodyA: RigidBody,
    bodyB: RigidBody,
    normal: Point
): void {
    // console.log("resolve");
    if (bodyA.isStatic() && bodyB.isStatic()) {
        return;
    }
    let restitution = 0.4;
    let inverseMassA =
        bodyA.isStatic() || bodyA.isMovingStatic() ? 0 : 1 / bodyA.mass;
    let inverseMassB =
        bodyB.isStatic() || bodyB.isMovingStatic() ? 0 : 1 / bodyB.mass;
    // console.log("inverse mass a", inverseMassA);
    // console.log("inverse mass b", inverseMassB);

    let relativeVelocity = PointCal.subVector(
        bodyA.linearVelocity,
        bodyB.linearVelocity
    );
    // console.log("relative velocity: ", relativeVelocity);
    // console.log("linear velocity of a", bodyA.getLinearVelocity());
    // console.log("linear veolcity of b", bodyB.getLinearVelocity());
    let J = -(1 + restitution) * PointCal.dotProduct(relativeVelocity, normal);
    J /= inverseMassA + inverseMassB;

    let deltaVelocityA = PointCal.multiplyVectorByScalar(
        normal,
        J * inverseMassA
    );
    let deltaVelocityB = PointCal.multiplyVectorByScalar(
        normal,
        J * inverseMassB
    );
    // console.log("delta velocity A:", deltaVelocityA);
    // console.log("delta velocity B:", deltaVelocityB);

    bodyA.linearVelocity = PointCal.addVector(
        bodyA.linearVelocity,
        deltaVelocityA
    );
    bodyB.linearVelocity = PointCal.subVector(
        bodyB.linearVelocity,
        deltaVelocityB
    );
}

export function resolveCollisionWithRotation(
    bodyA: RigidBody,
    bodyB: RigidBody,
    contactManifold: { normal: Point; contactPoints: Point[] }
) {
    // console.log("resolve");
    if (bodyA.isStatic() && bodyB.isStatic()) {
        return;
    }

    let restitution = 0.4;
    let inverseMassA =
        bodyA.isStatic() || bodyA.isMovingStatic() ? 0 : 1 / bodyA.mass;
    let inverseMassB =
        bodyB.isStatic() || bodyB.isMovingStatic() ? 0 : 1 / bodyB.mass;

    let inverseMMOIA =
        bodyA.isStatic() || bodyA.isMovingStatic()
            ? 0
            : 1 / bodyA.momentOfInertia;
    let inverseMMOIB =
        bodyB.isStatic() || bodyB.isMovingStatic()
            ? 0
            : 1 / bodyB.momentOfInertia;

    const Js: Point[] = [];
    for (let index = 0; index < contactManifold.contactPoints.length; index++) {
        const contactPoint = contactManifold.contactPoints[index];
        const rA = PointCal.subVector(contactPoint, bodyA.center);
        const rB = PointCal.subVector(contactPoint, bodyB.center);
        const rAPerpendicular = { x: -rA.y, y: rA.x };
        const rBPerpendicular = { x: -rB.y, y: rB.x };

        const angularVelocityA = PointCal.multiplyVectorByScalar(
            rAPerpendicular,
            bodyA.angularVelocity
        );
        const angularVelocityB = PointCal.multiplyVectorByScalar(
            rBPerpendicular,
            bodyB.angularVelocity
        );

        // console.log("inverse mass a", inverseMassA);
        // console.log("inverse mass b", inverseMassB);

        let relativeVelocity = PointCal.subVector(
            PointCal.addVector(bodyA.linearVelocity, angularVelocityA),
            PointCal.addVector(bodyB.linearVelocity, angularVelocityB)
        );
        // console.log("relative velocity: ", relativeVelocity);
        // console.log("linear velocity of a", bodyA.getLinearVelocity());
        // console.log("linear veolcity of b", bodyB.getLinearVelocity());
        let relativeVelocityNormal = PointCal.dotProduct(
            relativeVelocity,
            contactManifold.normal
        );
        const rAPerpendicularNormal = PointCal.dotProduct(
            rAPerpendicular,
            contactManifold.normal
        );
        const rBPerpendicularNormal = PointCal.dotProduct(
            rBPerpendicular,
            contactManifold.normal
        );

        const denominator =
            inverseMassA +
            inverseMassB +
            rAPerpendicularNormal * rAPerpendicularNormal * inverseMMOIA +
            rBPerpendicularNormal * rBPerpendicularNormal * inverseMMOIB;
        let J = -(1 + restitution) * relativeVelocityNormal;
        J /= denominator;

        J /= contactManifold.contactPoints.length;

        Js.push(PointCal.multiplyVectorByScalar(contactManifold.normal, J));
    }

    Js.forEach((impulse, index) => {
        let deltaVelocityA = PointCal.multiplyVectorByScalar(
            impulse,
            inverseMassA
        );
        let deltaVelocityB = PointCal.multiplyVectorByScalar(
            impulse,
            inverseMassB
        );

        bodyA.linearVelocity = PointCal.addVector(
            bodyA.linearVelocity,
            deltaVelocityA
        );
        let resA = PointCal.crossProduct(
            PointCal.subVector(
                contactManifold.contactPoints[index],
                bodyA.center
            ),
            impulse
        ).z;
        resA = resA == undefined ? 0 : resA;
        let resB = PointCal.crossProduct(
            PointCal.subVector(
                contactManifold.contactPoints[index],
                bodyB.center
            ),
            impulse
        ).z;
        resB = resB == undefined ? 0 : resB;
        bodyA.angularVelocity += resA * inverseMMOIA;
        bodyB.angularVelocity -= resB * inverseMMOIB;
        bodyB.linearVelocity = PointCal.subVector(
            bodyB.linearVelocity,
            deltaVelocityB
        );
    });
}

export function aabbIntersects(
    aabbA: { min: Point; max: Point },
    aabbB: { min: Point; max: Point }
): boolean {
    if (
        aabbA.min.x <= aabbB.max.x &&
        aabbB.min.x <= aabbA.max.x &&
        aabbA.min.y <= aabbB.max.y &&
        aabbB.min.y <= aabbA.max.y
    ) {
        return true;
    }
    return false;
}

export function intersects(
    bodyA: RigidBody,
    bodyB: RigidBody
): { collision: boolean; depth?: number; normal?: Point } {
    let axis: Point[] = [];
    let bodyAAxes = bodyA.getCollisionAxes(bodyB);
    let bodyBAxes = bodyB.getCollisionAxes(bodyA);

    axis.push(...bodyAAxes);
    axis.push(...bodyBAxes);

    let collision = true;
    let minDepth = Number.MAX_VALUE;
    let minAxis = axis[0];

    axis.forEach(projAxis => {
        let bodyAInterval = bodyA.getMinMaxProjection(projAxis);
        let bodyBInterval = bodyB.getMinMaxProjection(projAxis);

        if (
            bodyAInterval.min >= bodyBInterval.max ||
            bodyBInterval.min >= bodyAInterval.max
        ) {
            collision = false;
        } else {
            let depth = Math.abs(
                Math.min(bodyAInterval.max, bodyBInterval.max) -
                    Math.max(bodyBInterval.min, bodyAInterval.min)
            );
            if (depth < minDepth) {
                minDepth = depth;
                minAxis = projAxis;
                if (bodyAInterval.max < bodyBInterval.max) {
                    minAxis = PointCal.multiplyVectorByScalar(minAxis, -1);
                }
            }
        }
    });

    if (collision) {
        return { collision: collision, depth: minDepth, normal: minAxis };
    } else {
        return { collision: false, depth: undefined, normal: undefined };
    }
}

export function narrowPhaseWithRigidBody(
    bodies: RigidBody[],
    combinationsToCheck: { bodyA: RigidBody; bodyB: RigidBody }[],
    resolveCollisionFlag: boolean
): Point[] {
    if (!resolveCollisionFlag) {
        return [];
    }
    const contactPoints: Point[] = [];
    combinationsToCheck.forEach(combination => {
        let bodyA = combination.bodyA;
        let bodyB = combination.bodyB;
        if (bodyA == bodyB) {
            // console.log("same body");
            return;
        }
        let bodyAZ = bodyA.center.z == undefined ? 0 : bodyA.center.z;
        let bodyBZ = bodyB.center.z == undefined ? 0 : bodyB.center.z;
        if (Math.abs(bodyAZ - bodyBZ) > 0.5) {
            // console.log("z-index difference is too large");
            return;
        }
        let { collision, depth, normal: normalAxis } = intersects(bodyA, bodyB);
        if (collision && normalAxis !== undefined && depth !== undefined) {
            // the normal axis points in the direction that push bodyA away from bodyB

            let moveDisplacement = PointCal.multiplyVectorByScalar(
                normalAxis,
                depth / 2
            );
            let revMoveDisplacement = PointCal.multiplyVectorByScalar(
                normalAxis,
                -depth / 2
            );

            if (!bodyA.isStatic()) {
                bodyA.move(moveDisplacement);
            }
            if (!bodyB.isStatic()) {
                bodyB.move(revMoveDisplacement);
            }
            if (bodyA.isStatic()) {
                // bodyA.move(revMoveDisplacement);
                bodyB.move(revMoveDisplacement);
            }
            if (bodyB.isStatic()) {
                bodyA.move(moveDisplacement);
                // bodyB.move(moveDisplacement);
            }

            // finding the collision contact point(s)
            const bodyASigNormal = bodyA.getNormalOfSignificantFace(
                PointCal.multiplyVectorByScalar(normalAxis, -1)
            );
            const bodyBSigNormal = bodyB.getNormalOfSignificantFace(normalAxis);
            const bodyASigVertices = bodyA.getSignificantVertices(
                PointCal.multiplyVectorByScalar(normalAxis, -1)
            );
            const bodyBSigVertices = bodyB.getSignificantVertices(normalAxis);
            const bodyAParallelIndicator = Math.abs(
                PointCal.dotProduct(
                    bodyASigNormal,
                    PointCal.multiplyVectorByScalar(normalAxis, -1)
                )
            );
            const bodyBParallelIndicator = Math.abs(
                PointCal.dotProduct(bodyBSigNormal, normalAxis)
            );

            if (bodyBSigVertices.length == 1 || bodyASigVertices.length == 1) {
                // one of the body is a circle
                // console.log("involving a circle");
                if (bodyBSigVertices.length == 1) {
                    // bodyB is a circle
                    // contact point is on the perimeter of the circle and the direction is the collision normal
                    contactPoints.push(bodyBSigVertices[0]);
                } else {
                    // bodyA is a circle
                    // contact point is on the perimeter of the circle and the direction is the collision normal
                    contactPoints.push(bodyASigVertices[0]);
                }
            } else if (bodyAParallelIndicator > bodyBParallelIndicator) {
                // bodyA has the normal that is the most parallel to the collision normal
                const adjacentFaces = bodyA.getAdjacentFaces(
                    PointCal.multiplyVectorByScalar(normalAxis, -1)
                );
                let faceToClip = [...bodyBSigVertices];
                for (let index = 0; index < adjacentFaces.length - 1; index++) {
                    let startPoint = adjacentFaces[index].startPoint.coord;
                    let endPoint = adjacentFaces[index].endPoint.coord;
                    let direction = PointCal.subVector(endPoint, startPoint);
                    let sigStart = PointCal.subVector(
                        faceToClip[0],
                        startPoint
                    );
                    let sigEnd = PointCal.subVector(faceToClip[1], startPoint);
                    let startInside =
                        PointCal.angleFromA2B(direction, sigStart) >= 0;
                    let endInside =
                        PointCal.angleFromA2B(direction, sigEnd) >= 0;
                    if ((startInside ? 1 : 0) ^ (endInside ? 1 : 0)) {
                        // one of the point is outside the face
                        let intersectionPoint = PointCal.getLineIntersection(
                            startPoint,
                            endPoint,
                            faceToClip[0],
                            faceToClip[1]
                        );
                        if (
                            intersectionPoint.intersects &&
                            intersectionPoint.intersection !== undefined
                        ) {
                            if (startInside) {
                                faceToClip[1] = intersectionPoint.intersection;
                            } else {
                                faceToClip[0] = intersectionPoint.intersection;
                            }
                        }
                    }
                }
                const referenceFace = adjacentFaces[adjacentFaces.length - 1];
                let startPoint = referenceFace.startPoint.coord;
                let endPoint = referenceFace.endPoint.coord;
                let direction = PointCal.subVector(endPoint, startPoint);
                let sigStart = PointCal.subVector(faceToClip[0], startPoint);
                let sigEnd = PointCal.subVector(faceToClip[1], startPoint);
                let startInside =
                    PointCal.angleFromA2B(direction, sigStart) >= 0;
                let endInside = PointCal.angleFromA2B(direction, sigEnd) >= 0;
                if (startInside) {
                    contactPoints.push(faceToClip[0]);
                }
                if (endInside) {
                    contactPoints.push(faceToClip[1]);
                }
            } else {
                // bodyB has the normal that is the most parallel to the collision normal
                const adjacentFaces = bodyB.getAdjacentFaces(normalAxis);
                let faceToClip = [...bodyASigVertices];
                if (faceToClip.length == 0) {
                    console.log('warning');
                }
                let count = 0;
                for (let index = 0; index < adjacentFaces.length - 1; index++) {
                    let startPoint = adjacentFaces[index].startPoint.coord;
                    let endPoint = adjacentFaces[index].endPoint.coord;
                    let direction = PointCal.subVector(endPoint, startPoint);
                    let sigStart = PointCal.subVector(
                        faceToClip[0],
                        startPoint
                    );
                    let sigEnd = PointCal.subVector(faceToClip[1], startPoint);
                    let startInside =
                        PointCal.angleFromA2B(direction, sigStart) >= 0;
                    let endInside =
                        PointCal.angleFromA2B(direction, sigEnd) >= 0;
                    if ((startInside ? 1 : 0) ^ (endInside ? 1 : 0)) {
                        count += 1;
                        // one of the point is outside the face
                        let intersectionPoint = PointCal.getLineIntersection(
                            startPoint,
                            endPoint,
                            faceToClip[0],
                            faceToClip[1]
                        );
                        if (
                            intersectionPoint.intersects &&
                            intersectionPoint.intersection !== undefined
                        ) {
                            if (startInside) {
                                faceToClip[1] = intersectionPoint.intersection;
                            } else {
                                faceToClip[0] = intersectionPoint.intersection;
                            }
                        }
                    }
                }
                const referenceFace = adjacentFaces[adjacentFaces.length - 1];
                let startPoint = referenceFace.startPoint.coord;
                let endPoint = referenceFace.endPoint.coord;
                let direction = PointCal.subVector(endPoint, startPoint);
                let sigStart = PointCal.subVector(faceToClip[0], startPoint);
                let sigEnd = PointCal.subVector(faceToClip[1], startPoint);
                let startInside =
                    PointCal.angleFromA2B(direction, sigStart) >= 0;
                let endInside = PointCal.angleFromA2B(direction, sigEnd) >= 0;
                if (startInside) {
                    contactPoints.push(faceToClip[0]);
                }
                if (endInside) {
                    contactPoints.push(faceToClip[1]);
                }
            }
            if (resolveCollisionFlag) {
                resolveCollisionWithRotation(bodyA, bodyB, {
                    normal: normalAxis,
                    contactPoints: contactPoints,
                });
                // resolveCollision(bodyA, bodyB, normalAxis);
            }
        }
    });
    return contactPoints;
}

export function narrowPhase(
    bodies: BaseRigidBody[],
    combinationsToCheck: { bodyAIndex: number; bodyBIndex: number }[],
    resolveCollisionFlag: boolean
): void {
    if (!resolveCollisionFlag) {
        return;
    }
    combinationsToCheck.forEach(combination => {
        let bodyA = bodies[combination.bodyAIndex];
        let bodyB = bodies[combination.bodyBIndex];
        let { collision, depth, normal: normalAxis } = intersects(bodyA, bodyB);
        if (collision && normalAxis !== undefined && depth !== undefined) {
            // console.log("collision");
            let moveDisplacement = PointCal.multiplyVectorByScalar(
                normalAxis,
                depth / 2
            );
            let revMoveDisplacement = PointCal.multiplyVectorByScalar(
                normalAxis,
                -depth / 2
            );

            if (!bodyA.isStatic()) {
                bodyA.move(moveDisplacement);
            }
            if (!bodyB.isStatic()) {
                bodyB.move(revMoveDisplacement);
            }
            if (bodyA.isStatic()) {
                // bodyA.move(revMoveDisplacement);
                bodyB.move(revMoveDisplacement);
            }
            if (bodyB.isStatic()) {
                bodyA.move(moveDisplacement);
                // bodyB.move(moveDisplacement);
            }

            if (resolveCollisionFlag) {
                resolveCollision(bodyA, bodyB, normalAxis);
            }
        }
    });
}

export function broadPhaseWithRigidBodyReturned(
    quadTree: QuadTree<RigidBody>,
    bodies: RigidBody[]
): { bodyA: RigidBody; bodyB: RigidBody }[] {
    let possibleCombi: { bodyA: RigidBody; bodyB: RigidBody }[] = [];
    for (let index = 0; index <= bodies.length - 1; index++) {
        let objsToCheck = quadTree.retrieve(bodies[index]);
        for (let jindex = 0; jindex <= objsToCheck.length - 1; jindex++) {
            let bodyA = bodies[index];
            let bodyB = objsToCheck[jindex];
            if (bodyA.isStatic() && bodyB.isStatic()) {
                continue;
            }
            if (!aabbIntersects(bodyA.AABB, bodyB.AABB)) {
                continue;
            }
            possibleCombi.push({ bodyA: bodyA, bodyB: bodyB });
        }
    }
    return possibleCombi;
}

export function broadPhaseWithSpatialIndex(
    spatialIndex: import('./dynamic-tree').SpatialIndex<RigidBody>,
    bodies: RigidBody[]
): { bodyA: RigidBody; bodyB: RigidBody }[] {
    let possibleCombi: { bodyA: RigidBody; bodyB: RigidBody }[] = [];
    for (let index = 0; index <= bodies.length - 1; index++) {
        let objsToCheck = spatialIndex.retrieve(bodies[index]);
        for (let jindex = 0; jindex <= objsToCheck.length - 1; jindex++) {
            let bodyA = bodies[index];
            let bodyB = objsToCheck[jindex];
            if (bodyA.isStatic() && bodyB.isStatic()) {
                continue;
            }
            if (!aabbIntersects(bodyA.AABB, bodyB.AABB)) {
                continue;
            }
            possibleCombi.push({ bodyA: bodyA, bodyB: bodyB });
        }
    }
    return possibleCombi;
}

export function broadPhase(
    quadTree: QuadTree<RigidBody>,
    bodies: BaseRigidBody[]
): { bodyAIndex: number; bodyBIndex: number }[] {
    let possibleCombi: { bodyAIndex: number; bodyBIndex: number }[] = [];
    for (let index = 0; index <= bodies.length - 1; index++) {
        let objsToCheck = quadTree.retrieve(bodies[index]);
        for (let jindex = 0; jindex <= objsToCheck.length - 1; jindex++) {
            let bodyA = bodies[index];
            let bodyB = objsToCheck[jindex];
            if (bodyA.isStatic() && bodyB.isStatic()) {
                continue;
            }
            if (!aabbIntersects(bodyA.AABB, bodyB.AABB)) {
                continue;
            }
            possibleCombi.push({ bodyAIndex: index, bodyBIndex: jindex });
        }
    }
    return possibleCombi;
}

// Enhanced broadphase with collision filtering
export function broadPhaseWithSpatialIndexFiltered(
    spatialIndex: import('./dynamic-tree').SpatialIndex<RigidBody>,
    bodies: RigidBody[]
): { bodyA: RigidBody; bodyB: RigidBody }[] {
    let possibleCombi: { bodyA: RigidBody; bodyB: RigidBody }[] = [];
    for (let index = 0; index <= bodies.length - 1; index++) {
        let objsToCheck = spatialIndex.retrieve(bodies[index]);
        for (let jindex = 0; jindex <= objsToCheck.length - 1; jindex++) {
            let bodyA = bodies[index];
            let bodyB = objsToCheck[jindex];

            // Skip if both are static
            if (bodyA.isStatic() && bodyB.isStatic()) {
                continue;
            }

            // Apply collision filtering
            if (!canCollide(bodyA.collisionFilter, bodyB.collisionFilter)) {
                continue;
            }

            // Basic AABB check
            if (!aabbIntersects(bodyA.AABB, bodyB.AABB)) {
                continue;
            }

            possibleCombi.push({ bodyA: bodyA, bodyB: bodyB });
        }
    }
    return possibleCombi;
}

// Enhanced narrow phase that returns collision data for pair management
export function narrowPhaseWithRigidBodyAndPairs(
    bodies: RigidBody[],
    combinationsToCheck: { bodyA: RigidBody; bodyB: RigidBody }[],
    resolveCollisionFlag: boolean
): {
    contactPoints: Point[];
    collisions: {
        bodyA: RigidBody;
        bodyB: RigidBody;
        contactPoints: Point[];
        normal?: Point;
        depth?: number;
    }[];
} {
    const contactPoints: Point[] = [];
    const collisions: {
        bodyA: RigidBody;
        bodyB: RigidBody;
        contactPoints: Point[];
        normal?: Point;
        depth?: number;
    }[] = [];

    combinationsToCheck.forEach(combination => {
        let bodyA = combination.bodyA;
        let bodyB = combination.bodyB;

        let { collision, depth, normal: normalAxis } = intersects(bodyA, bodyB);
        if (collision && normalAxis !== undefined && depth !== undefined) {
            // Calculate contact points (simplified version)
            const collisionContactPoints: Point[] = [];

            // For now, use a simple contact point calculation
            // This could be enhanced later with proper clipping algorithms
            const contactCenter = {
                x: (bodyA.center.x + bodyB.center.x) / 2,
                y: (bodyA.center.y + bodyB.center.y) / 2,
            };
            collisionContactPoints.push(contactCenter);

            const collisionData = {
                bodyA,
                bodyB,
                contactPoints: collisionContactPoints,
                normal: normalAxis,
                depth: depth,
            };

            collisions.push(collisionData);
            contactPoints.push(...collisionContactPoints);

            if (resolveCollisionFlag) {
                // Position correction
                let moveDisplacement = PointCal.multiplyVectorByScalar(
                    normalAxis,
                    depth / 2
                );
                let revMoveDisplacement = PointCal.multiplyVectorByScalar(
                    normalAxis,
                    -depth / 2
                );

                if (!bodyA.isStatic()) {
                    bodyA.move(moveDisplacement);
                }
                if (!bodyB.isStatic()) {
                    bodyB.move(revMoveDisplacement);
                }
                if (bodyA.isStatic()) {
                    bodyB.move(revMoveDisplacement);
                }
                if (bodyB.isStatic()) {
                    bodyA.move(moveDisplacement);
                }

                // Resolve collision with rotation
                resolveCollisionWithRotation(bodyA, bodyB, {
                    normal: normalAxis,
                    contactPoints: collisionContactPoints,
                });
            }
        }
    });

    return { contactPoints, collisions };
}
