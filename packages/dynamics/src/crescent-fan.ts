import { Point, PointCal } from '@ue-too/math';

import { BaseRigidBody, RigidBody } from './rigidbody';

/**
 * Static rigid body shaped as a circular arc barrier (outer rail segment).
 * SAT projection logic matches the Python `Crescent` used in hrphysics-simulation.
 *
 * @param center - Arc center (same as track JSON `center`)
 * @param radius - Arc radius
 * @param angleSpan - Signed sweep in radians; normalized internally like Python
 * @param orientationAngle - Angle from +x to the first arc endpoint (radians)
 */
export class Crescent extends BaseRigidBody {
    private readonly _radius: number;
    private readonly _angleSpan: number;
    private _startPoint: Point = { x: 0, y: 0 };
    private _endPoint: Point = { x: 0, y: 0 };

    constructor(
        center: Point = { x: 0, y: 0 },
        radius: number,
        angleSpan: number,
        orientationAngle: number = 0,
        mass: number = 500,
        isStatic: boolean = true,
        frictionEnabled: boolean = false
    ) {
        let orient = orientationAngle;
        let span = angleSpan;
        if (span < 0) {
            orient += span;
            span = -span;
        }
        super(center, orient, mass, isStatic, frictionEnabled);
        this._radius = radius;
        this._angleSpan = span;
        this.step = this.step.bind(this);
        this.updateArcEndpoints();
    }

    private updateArcEndpoints(): void {
        const base = PointCal.rotatePoint(
            { x: this._radius, y: 0 },
            this._orientationAngle
        );
        this._startPoint = PointCal.addVector(this._center, base);
        const baseEnd = PointCal.rotatePoint(base, this._angleSpan);
        this._endPoint = PointCal.addVector(this._center, baseEnd);
    }

    step(deltaTime: number): void {
        if (this.isStatic()) {
            this.force = { x: 0, y: 0 };
            return;
        }
        super.step(deltaTime);
        this.updateArcEndpoints();
    }

    move(delta: Point): void {
        super.move(delta);
        this.updateArcEndpoints();
    }

    get momentOfInertia(): number {
        return 1;
    }

    getMinMaxProjection(unitvector: Point): { min: number; max: number } {
        this.updateArcEndpoints();
        const c = this._center;
        const fromCenterToStart = PointCal.subVector(this._startPoint, c);
        const uv = PointCal.unitVector(unitvector);
        const negUv = PointCal.multiplyVectorByScalar(uv, -1);

        let extraPoint = this._startPoint;
        const unitVectorAngle = PointCal.angleFromA2B(fromCenterToStart, uv);
        const revUnitVectorAngle = PointCal.angleFromA2B(fromCenterToStart, negUv);

        if (unitVectorAngle >= 0 && unitVectorAngle <= this._angleSpan) {
            extraPoint = PointCal.addVector(
                c,
                PointCal.multiplyVectorByScalar(uv, this._radius)
            );
        } else if (
            revUnitVectorAngle >= 0 &&
            revUnitVectorAngle <= this._angleSpan
        ) {
            extraPoint = PointCal.addVector(
                c,
                PointCal.multiplyVectorByScalar(negUv, this._radius)
            );
        }

        const projStart = PointCal.dotProduct(this._startPoint, uv);
        const projEnd = PointCal.dotProduct(this._endPoint, uv);
        const projExtra = PointCal.dotProduct(extraPoint, uv);

        return {
            min: Math.min(projStart, projEnd, projExtra),
            max: Math.max(projStart, projEnd, projExtra),
        };
    }

    getCollisionAxes(relativeBody: RigidBody): Point[] {
        this.updateArcEndpoints();
        const rel = PointCal.subVector(relativeBody.center, this._center);
        let relAxis = PointCal.unitVector(rel);
        if (PointCal.magnitude(rel) < 1e-12) {
            relAxis = { x: 1, y: 0 };
        }
        const chord = PointCal.subVector(this._endPoint, this._startPoint);
        const perpChord = PointCal.rotatePoint(chord, Math.PI / 2);
        const start2end = PointCal.unitVector(perpChord);
        return [relAxis, start2end];
    }

    get AABB(): { min: Point; max: Point } {
        this.updateArcEndpoints();
        const midAngle = this._angleSpan / 2;
        const fromStart = PointCal.subVector(this._startPoint, this._center);
        const vecC2M = PointCal.rotatePoint(fromStart, midAngle);
        const midPoint = PointCal.addVector(this._center, vecC2M);
        return {
            min: {
                x: Math.min(midPoint.x, this._startPoint.x, this._endPoint.x),
                y: Math.min(midPoint.y, this._startPoint.y, this._endPoint.y),
            },
            max: {
                x: Math.max(midPoint.x, this._startPoint.x, this._endPoint.x),
                y: Math.max(midPoint.y, this._startPoint.y, this._endPoint.y),
            },
        };
    }

    significantVertex(collisionNormal: Point): Point {
        this.updateArcEndpoints();
        const n = PointCal.unitVector(collisionNormal);
        const dir = PointCal.multiplyVectorByScalar(n, this._radius);
        const fromCStart = PointCal.subVector(this._startPoint, this._center);
        const ang = PointCal.angleFromA2B(fromCStart, dir);
        if (ang >= 0 && ang <= this._angleSpan) {
            return PointCal.addVector(this._center, dir);
        }
        const dS = PointCal.dotProduct(this._startPoint, n);
        const dE = PointCal.dotProduct(this._endPoint, n);
        return dS >= dE ? this._startPoint : this._endPoint;
    }

    getSignificantVertices(collisionNormal: Point): Point[] {
        return [this.significantVertex(collisionNormal)];
    }

    getNormalOfSignificantFace(collisionNormal: Point): Point {
        return PointCal.unitVector(collisionNormal);
    }

    getAdjacentFaces(_collisionNormal: Point): {
        startPoint: { coord: Point; index: number };
        endPoint: { coord: Point; index: number };
    }[] {
        return [];
    }
}

/**
 * Fan-shaped rigid body (arc plus wedge toward center). SAT logic matches Python `Fan`.
 */
export class Fan extends BaseRigidBody {
    private readonly _radius: number;
    private readonly _angleSpan: number;
    private _startPoint: Point = { x: 0, y: 0 };
    private _endPoint: Point = { x: 0, y: 0 };

    constructor(
        center: Point = { x: 0, y: 0 },
        radius: number,
        angleSpan: number,
        orientationAngle: number = 0,
        mass: number = 500,
        isStatic: boolean = true,
        frictionEnabled: boolean = false
    ) {
        let orient = orientationAngle;
        let span = angleSpan;
        if (span < 0) {
            orient += span;
            span = -span;
        }
        super(center, orient, mass, isStatic, frictionEnabled);
        this._radius = radius;
        this._angleSpan = span;
        this.step = this.step.bind(this);
        this.updateArcEndpoints();
    }

    private updateArcEndpoints(): void {
        const base = PointCal.rotatePoint(
            { x: this._radius, y: 0 },
            this._orientationAngle
        );
        this._startPoint = PointCal.addVector(this._center, base);
        const baseEnd = PointCal.rotatePoint(base, this._angleSpan);
        this._endPoint = PointCal.addVector(this._center, baseEnd);
    }

    step(deltaTime: number): void {
        if (this.isStatic()) {
            this.force = { x: 0, y: 0 };
            return;
        }
        super.step(deltaTime);
        this.updateArcEndpoints();
    }

    move(delta: Point): void {
        super.move(delta);
        this.updateArcEndpoints();
    }

    get momentOfInertia(): number {
        return 1;
    }

    getMinMaxProjection(unitvector: Point): { min: number; max: number } {
        this.updateArcEndpoints();
        const c = this._center;
        const fromCenterToStart = PointCal.subVector(this._startPoint, c);
        const uv = PointCal.unitVector(unitvector);
        const negUv = PointCal.multiplyVectorByScalar(uv, -1);

        let extraPoint = this._startPoint;
        const unitVectorAngle = PointCal.angleFromA2B(fromCenterToStart, uv);
        const revUnitVectorAngle = PointCal.angleFromA2B(fromCenterToStart, negUv);

        if (unitVectorAngle >= 0 && unitVectorAngle <= this._angleSpan) {
            extraPoint = PointCal.addVector(
                c,
                PointCal.multiplyVectorByScalar(uv, this._radius)
            );
        } else if (
            revUnitVectorAngle >= 0 &&
            revUnitVectorAngle <= this._angleSpan
        ) {
            extraPoint = PointCal.addVector(
                c,
                PointCal.multiplyVectorByScalar(negUv, this._radius)
            );
        }

        const projStart = PointCal.dotProduct(this._startPoint, uv);
        const projEnd = PointCal.dotProduct(this._endPoint, uv);
        const projExtra = PointCal.dotProduct(extraPoint, uv);
        const projCenter = PointCal.dotProduct(c, uv);

        return {
            min: Math.min(projStart, projEnd, projCenter, projExtra),
            max: Math.max(projStart, projEnd, projCenter, projExtra),
        };
    }

    getCollisionAxes(relativeBody: RigidBody): Point[] {
        this.updateArcEndpoints();
        const rel = PointCal.subVector(relativeBody.center, this._center);
        let relAxis = PointCal.unitVector(rel);
        if (PointCal.magnitude(rel) < 1e-12) {
            relAxis = { x: 1, y: 0 };
        }
        const fromCStart = PointCal.subVector(this._startPoint, this._center);
        const fromCEnd = PointCal.subVector(this._endPoint, this._center);
        const startAxis = PointCal.unitVector(
            PointCal.rotatePoint(fromCStart, -Math.PI / 2)
        );
        const endAxis = PointCal.unitVector(
            PointCal.rotatePoint(fromCEnd, Math.PI / 2)
        );
        return [relAxis, startAxis, endAxis];
    }

    get AABB(): { min: Point; max: Point } {
        this.updateArcEndpoints();
        const midAngle = this._angleSpan / 2;
        const fromStart = PointCal.subVector(this._startPoint, this._center);
        const vecC2M = PointCal.rotatePoint(fromStart, midAngle);
        const midPoint = PointCal.addVector(this._center, vecC2M);
        return {
            min: {
                x: Math.min(
                    midPoint.x,
                    this._startPoint.x,
                    this._endPoint.x,
                    this._center.x
                ),
                y: Math.min(
                    midPoint.y,
                    this._startPoint.y,
                    this._endPoint.y,
                    this._center.y
                ),
            },
            max: {
                x: Math.max(
                    midPoint.x,
                    this._startPoint.x,
                    this._endPoint.x,
                    this._center.x
                ),
                y: Math.max(
                    midPoint.y,
                    this._startPoint.y,
                    this._endPoint.y,
                    this._center.y
                ),
            },
        };
    }

    significantVertex(collisionNormal: Point): Point {
        this.updateArcEndpoints();
        const n = PointCal.unitVector(collisionNormal);
        const projC = PointCal.dotProduct(this._center, n);
        const projS = PointCal.dotProduct(this._startPoint, n);
        const projE = PointCal.dotProduct(this._endPoint, n);
        const dir = PointCal.multiplyVectorByScalar(n, this._radius);
        const fromCStart = PointCal.subVector(this._startPoint, this._center);
        const ang = PointCal.angleFromA2B(fromCStart, dir);
        let arcPt = this._startPoint;
        if (ang >= 0 && ang <= this._angleSpan) {
            arcPt = PointCal.addVector(this._center, dir);
        } else {
            arcPt = projS >= projE ? this._startPoint : this._endPoint;
        }
        return projC >= Math.max(projS, projE) && projC >= PointCal.dotProduct(arcPt, n)
            ? this._center
            : arcPt;
    }

    getSignificantVertices(collisionNormal: Point): Point[] {
        return [this.significantVertex(collisionNormal)];
    }

    getNormalOfSignificantFace(collisionNormal: Point): Point {
        return PointCal.unitVector(collisionNormal);
    }

    getAdjacentFaces(_collisionNormal: Point): {
        startPoint: { coord: Point; index: number };
        endPoint: { coord: Point; index: number };
    }[] {
        return [];
    }
}
