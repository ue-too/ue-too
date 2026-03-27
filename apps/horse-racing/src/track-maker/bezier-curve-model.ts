/**
 * BezierCurveModel — pure data + computation, no rendering.
 *
 * Ported from legacy hrracetrack-maker/src/frontend/modules/BezierCurve.ts.
 * All Canvas 2D drawing methods have been removed; rendering is handled
 * separately by the Pixi render system.
 */

import { type Point, PointCal } from '@ue-too/math';
import { Bezier } from 'bezier-js';

import {
    type ControlPoint,
    type HandlePoint,
    HandleType,
    type HitTestResult,
    type PointType,
    type Track,
    TrackType,
} from './types';

// ---------------------------------------------------------------------------
// Default initial control points
// ---------------------------------------------------------------------------

function defaultControlPoints(): ControlPoint[] {
    return [
        {
            coord: { x: 0, y: 0 },
            transformedCoord: { x: 0, y: 0 },
            left_handle: {
                coord: { x: -100, y: 0 },
                transformedCoord: { x: -100, y: 0 },
                handleType: HandleType.ALIGNED,
            },
            right_handle: {
                coord: { x: 100, y: 0 },
                transformedCoord: { x: 100, y: 0 },
                handleType: HandleType.ALIGNED,
            },
            slope: null,
        },
        {
            coord: { x: 400, y: 0 },
            transformedCoord: { x: 400, y: 0 },
            left_handle: {
                coord: { x: 300, y: 0 },
                transformedCoord: { x: 300, y: 0 },
                handleType: HandleType.ALIGNED,
            },
            right_handle: {
                coord: { x: 500, y: 0 },
                transformedCoord: { x: 500, y: 0 },
                handleType: HandleType.VECTOR,
            },
            slope: null,
        },
    ];
}

// ---------------------------------------------------------------------------
// BezierCurveModel
// ---------------------------------------------------------------------------

export class BezierCurveModel {
    anchorPoint: Point;
    controlPoints: ControlPoint[];
    orientationAngle: number; // radians
    fullCurveLength: number = 0;
    scale: number;

    constructor(opts?: {
        anchorPoint?: Point;
        controlPoints?: ControlPoint[];
        orientationAngle?: number;
        scale?: number;
    }) {
        this.anchorPoint = opts?.anchorPoint ?? { x: 0, y: 0 };
        this.controlPoints = opts?.controlPoints ?? defaultControlPoints();
        this.orientationAngle = opts?.orientationAngle ?? 0;
        this.scale = opts?.scale ?? 1;
    }

    // ------------------------------------------------------------------
    // Coordinate transforms
    // ------------------------------------------------------------------

    transformPoint(point: Point): Point {
        const rotated = PointCal.rotatePoint(point, this.orientationAngle);
        return PointCal.addVector(rotated, this.anchorPoint);
    }

    // ------------------------------------------------------------------
    // Update all transformed coordinates + handle constraints
    // ------------------------------------------------------------------

    updatePointsCoordinates(): void {
        this.fullCurveLength = 0;

        this.controlPoints.forEach((cp, index) => {
            // Left handle VECTOR constraint
            if (cp.left_handle.handleType === HandleType.VECTOR) {
                if (index > 0) {
                    const prev = this.controlPoints[index - 1].coord;
                    const dir = PointCal.unitVector(PointCal.subVector(prev, cp.coord));
                    const dist = PointCal.distanceBetweenPoints(prev, cp.coord);
                    cp.left_handle.coord = PointCal.addVector(
                        cp.coord,
                        PointCal.multiplyVectorByScalar(dir, dist * 0.3),
                    );
                }
            } else if (cp.left_handle.handleType === HandleType.ALIGNED) {
                if (cp.right_handle.handleType === HandleType.VECTOR) {
                    const dist = PointCal.distanceBetweenPoints(cp.coord, cp.left_handle.coord);
                    const dir = PointCal.unitVectorFromA2B(cp.right_handle.coord, cp.coord);
                    cp.left_handle.coord = PointCal.addVector(
                        cp.coord,
                        PointCal.multiplyVectorByScalar(dir, dist),
                    );
                }
            }

            // Right handle VECTOR constraint
            if (cp.right_handle.handleType === HandleType.VECTOR) {
                if (index < this.controlPoints.length - 1) {
                    const next = this.controlPoints[index + 1].coord;
                    const dir = PointCal.unitVector(PointCal.subVector(next, cp.coord));
                    const dist = PointCal.distanceBetweenPoints(next, cp.coord);
                    cp.right_handle.coord = PointCal.addVector(
                        cp.coord,
                        PointCal.multiplyVectorByScalar(dir, dist * 0.3),
                    );
                }
            } else if (cp.right_handle.handleType === HandleType.ALIGNED) {
                if (cp.left_handle.handleType === HandleType.VECTOR) {
                    const dist = PointCal.distanceBetweenPoints(cp.coord, cp.right_handle.coord);
                    const dir = PointCal.unitVectorFromA2B(cp.left_handle.coord, cp.coord);
                    cp.right_handle.coord = PointCal.addVector(
                        cp.coord,
                        PointCal.multiplyVectorByScalar(dir, dist),
                    );
                }
            }

            // Compute transformed (world-space) coordinates
            cp.transformedCoord = this.transformPoint(cp.coord);
            cp.left_handle.transformedCoord = this.transformPoint(cp.left_handle.coord);
            cp.right_handle.transformedCoord = this.transformPoint(cp.right_handle.coord);

            // Accumulate arc length
            if (index > 0) {
                const start = this.controlPoints[index - 1];
                const bCurve = new Bezier([
                    start.transformedCoord,
                    start.right_handle.transformedCoord,
                    cp.left_handle.transformedCoord,
                    cp.transformedCoord,
                ]);
                const { fullArcLength } = this.getArcLengths(bCurve);
                this.fullCurveLength += fullArcLength;
            }
        });
    }

    // ------------------------------------------------------------------
    // Handle type changes
    // ------------------------------------------------------------------

    changeHandleType(cpIndex: number, handle: 'lh' | 'rh', newType: HandleType): void {
        if (cpIndex < 0 || cpIndex > this.controlPoints.length - 1) return;

        const cp = this.controlPoints[cpIndex];

        if (handle === 'lh') {
            switch (newType) {
                case HandleType.VECTOR:
                    if (cpIndex > 0) {
                        const prev = this.controlPoints[cpIndex - 1].coord;
                        const dir = PointCal.unitVector(PointCal.subVector(prev, cp.coord));
                        const dist = PointCal.distanceBetweenPoints(prev, cp.coord);
                        cp.left_handle.coord = PointCal.addVector(
                            cp.coord,
                            PointCal.multiplyVectorByScalar(dir, dist * 0.3),
                        );
                    }
                    cp.left_handle.handleType = HandleType.VECTOR;
                    if (cp.right_handle.handleType !== HandleType.VECTOR) {
                        cp.right_handle.handleType = HandleType.FREE;
                    }
                    break;
                case HandleType.ALIGNED:
                    cp.left_handle.handleType = HandleType.ALIGNED;
                    if (cp.right_handle.handleType !== HandleType.FREE) {
                        const dir = PointCal.unitVectorFromA2B(cp.right_handle.coord, cp.coord);
                        let proj = PointCal.dotProduct(
                            dir,
                            PointCal.subVector(cp.left_handle.coord, cp.coord),
                        );
                        if (proj < 0) proj = -proj;
                        cp.left_handle.coord = PointCal.addVector(
                            cp.coord,
                            PointCal.multiplyVectorByScalar(dir, proj),
                        );
                    }
                    break;
                case HandleType.FREE:
                    cp.left_handle.handleType = HandleType.FREE;
                    break;
            }
        } else {
            switch (newType) {
                case HandleType.VECTOR:
                    if (cpIndex < this.controlPoints.length - 1) {
                        const next = this.controlPoints[cpIndex + 1].coord;
                        const dir = PointCal.unitVector(PointCal.subVector(next, cp.coord));
                        const dist = PointCal.distanceBetweenPoints(next, cp.coord);
                        cp.right_handle.coord = PointCal.addVector(
                            cp.coord,
                            PointCal.multiplyVectorByScalar(dir, dist * 0.3),
                        );
                    }
                    cp.right_handle.handleType = HandleType.VECTOR;
                    if (cp.left_handle.handleType !== HandleType.VECTOR) {
                        cp.left_handle.handleType = HandleType.FREE;
                    }
                    break;
                case HandleType.ALIGNED:
                    cp.right_handle.handleType = HandleType.ALIGNED;
                    if (cp.left_handle.handleType !== HandleType.FREE) {
                        const dir = PointCal.unitVectorFromA2B(cp.left_handle.coord, cp.coord);
                        let proj = PointCal.dotProduct(
                            dir,
                            PointCal.subVector(cp.right_handle.coord, cp.coord),
                        );
                        if (proj < 0) proj = -proj;
                        cp.right_handle.coord = PointCal.addVector(
                            cp.coord,
                            PointCal.multiplyVectorByScalar(dir, proj),
                        );
                    }
                    break;
                case HandleType.FREE:
                    cp.right_handle.handleType = HandleType.FREE;
                    break;
            }
        }

        this.updatePointsCoordinates();
    }

    // ------------------------------------------------------------------
    // Move operations
    // ------------------------------------------------------------------

    moveAnchorPoint(destPos: Point): void {
        this.anchorPoint = destPos;
        this.updatePointsCoordinates();
    }

    moveControlPoint(destPos: Point, pointIndex: number, pointType: PointType): void {
        if (pointIndex >= this.controlPoints.length) return;
        const cp = this.controlPoints[pointIndex];

        switch (pointType) {
            case 'cp': {
                const diff = PointCal.subVector(destPos, cp.coord);
                cp.coord = destPos;
                cp.left_handle.coord = PointCal.addVector(cp.left_handle.coord, diff);
                cp.right_handle.coord = PointCal.addVector(cp.right_handle.coord, diff);
                break;
            }
            case 'lh': {
                switch (cp.left_handle.handleType) {
                    case HandleType.VECTOR:
                        break; // immovable
                    case HandleType.FREE:
                        cp.left_handle.coord = destPos;
                        break;
                    case HandleType.ALIGNED:
                        if (cp.right_handle.handleType === HandleType.VECTOR) {
                            const dir = PointCal.unitVectorFromA2B(cp.right_handle.coord, cp.coord);
                            const posDiff = PointCal.subVector(destPos, cp.coord);
                            const proj = PointCal.dotProduct(posDiff, dir);
                            if (proj > 20) {
                                cp.left_handle.coord = PointCal.addVector(
                                    cp.coord,
                                    PointCal.multiplyVectorByScalar(dir, proj),
                                );
                            }
                        } else if (cp.right_handle.handleType === HandleType.ALIGNED) {
                            const rhDist = PointCal.distanceBetweenPoints(cp.coord, cp.right_handle.coord);
                            const rhDir = PointCal.unitVectorFromA2B(destPos, cp.coord);
                            cp.left_handle.coord = destPos;
                            cp.right_handle.coord = PointCal.addVector(
                                cp.coord,
                                PointCal.multiplyVectorByScalar(rhDir, rhDist),
                            );
                        } else {
                            cp.left_handle.coord = destPos;
                        }
                        break;
                }
                break;
            }
            case 'rh': {
                switch (cp.right_handle.handleType) {
                    case HandleType.VECTOR:
                        break; // immovable
                    case HandleType.FREE:
                        cp.right_handle.coord = destPos;
                        break;
                    case HandleType.ALIGNED:
                        if (cp.left_handle.handleType === HandleType.VECTOR) {
                            const dir = PointCal.unitVectorFromA2B(cp.left_handle.coord, cp.coord);
                            const posDiff = PointCal.subVector(destPos, cp.coord);
                            const proj = PointCal.dotProduct(posDiff, dir);
                            if (proj > 20) {
                                cp.right_handle.coord = PointCal.addVector(
                                    cp.coord,
                                    PointCal.multiplyVectorByScalar(dir, proj),
                                );
                            }
                        } else if (cp.left_handle.handleType === HandleType.ALIGNED) {
                            const lhDist = PointCal.distanceBetweenPoints(cp.coord, cp.left_handle.coord);
                            const lhDir = PointCal.unitVectorFromA2B(destPos, cp.coord);
                            cp.right_handle.coord = destPos;
                            cp.left_handle.coord = PointCal.addVector(
                                cp.coord,
                                PointCal.multiplyVectorByScalar(lhDir, lhDist),
                            );
                        } else {
                            cp.right_handle.coord = destPos;
                        }
                        break;
                }
                break;
            }
        }

        this.updatePointsCoordinates();
    }

    // ------------------------------------------------------------------
    // Hit testing
    // ------------------------------------------------------------------

    clickedOnPoint(cursorPosition: Point, zoomLevel: number = 1): HitTestResult {
        this.updatePointsCoordinates();
        const SCREEN_HIT_RADIUS = 10;
        const HIT_RADIUS = SCREEN_HIT_RADIUS / zoomLevel;

        const idx = this.controlPoints.findIndex((cp) => {
            return (
                PointCal.distanceBetweenPoints(cp.transformedCoord, cursorPosition) < HIT_RADIUS ||
                PointCal.distanceBetweenPoints(cp.left_handle.transformedCoord, cursorPosition) < HIT_RADIUS ||
                PointCal.distanceBetweenPoints(cp.right_handle.transformedCoord, cursorPosition) < HIT_RADIUS
            );
        });

        if (idx === -1) {
            return { hit: false, pointIndex: -1, pointType: null, pointPos: null };
        }

        const cp = this.controlPoints[idx];
        if (PointCal.distanceBetweenPoints(cp.transformedCoord, cursorPosition) < HIT_RADIUS) {
            return { hit: true, pointIndex: idx, pointType: 'cp', pointPos: cp.transformedCoord };
        }
        if (PointCal.distanceBetweenPoints(cp.left_handle.transformedCoord, cursorPosition) < HIT_RADIUS) {
            return { hit: true, pointIndex: idx, pointType: 'lh', pointPos: cp.left_handle.transformedCoord };
        }
        if (PointCal.distanceBetweenPoints(cp.right_handle.transformedCoord, cursorPosition) < HIT_RADIUS) {
            return { hit: true, pointIndex: idx, pointType: 'rh', pointPos: cp.right_handle.transformedCoord };
        }

        return { hit: false, pointIndex: -1, pointType: null, pointPos: null };
    }

    // ------------------------------------------------------------------
    // Extend / delete control points
    // ------------------------------------------------------------------

    extendControlPoint(prepend = false): void {
        const newCp: ControlPoint = {
            coord: { x: 0, y: 0 },
            transformedCoord: { x: 0, y: 0 },
            left_handle: {
                coord: { x: -100, y: 0 },
                transformedCoord: { x: -100, y: 0 },
                handleType: HandleType.ALIGNED,
            },
            right_handle: {
                coord: { x: 100, y: 0 },
                transformedCoord: { x: 100, y: 0 },
                handleType: HandleType.ALIGNED,
            },
            slope: null,
        };

        if (prepend) {
            let newCoord: Point;
            if (this.controlPoints.length > 0) {
                const base = this.controlPoints[0];
                const vec = PointCal.multiplyVectorByScalar(
                    PointCal.unitVectorFromA2B(base.coord, base.left_handle.coord),
                    1.3 * PointCal.distanceBetweenPoints(base.coord, base.left_handle.coord),
                );
                newCoord = PointCal.addVector(base.coord, vec);
            } else {
                newCoord = this.anchorPoint;
            }
            newCp.coord = newCoord;
            newCp.left_handle.coord = PointCal.addVector(newCoord, { x: -200, y: 0 });
            newCp.right_handle.coord = PointCal.addVector(newCoord, { x: 200, y: 0 });
            this.controlPoints.unshift(newCp);
        } else {
            let newCoord: Point;
            if (this.controlPoints.length > 0) {
                const base = this.controlPoints[this.controlPoints.length - 1];
                const vec = PointCal.multiplyVectorByScalar(
                    PointCal.unitVectorFromA2B(base.coord, base.right_handle.coord),
                    1.3 * PointCal.distanceBetweenPoints(base.coord, base.right_handle.coord),
                );
                newCoord = PointCal.addVector(base.coord, vec);
            } else {
                newCoord = this.anchorPoint;
            }
            newCp.coord = newCoord;
            newCp.left_handle.coord = PointCal.addVector(newCoord, { x: -200, y: 0 });
            newCp.right_handle.coord = PointCal.addVector(newCoord, { x: 200, y: 0 });
            this.controlPoints.push(newCp);
        }

        this.updatePointsCoordinates();
    }

    deleteSelectedControlPoint(controlPointIndex: number): boolean {
        if (controlPointIndex < 0 || controlPointIndex >= this.controlPoints.length) {
            return false;
        }
        this.controlPoints.splice(controlPointIndex, 1);
        return true;
    }

    // ------------------------------------------------------------------
    // Scale & length
    // ------------------------------------------------------------------

    getLength(): number {
        return this.fullCurveLength;
    }

    setScale(scale: number): void {
        this.scale = scale;
    }

    // ------------------------------------------------------------------
    // Export to Track[] (simulation format)
    // ------------------------------------------------------------------

    exportCurve(origin: Point): Track[] | null {
        const exportTracks: Track[] = [];

        for (let index = 1; index < this.controlPoints.length; index++) {
            const startCp = this.controlPoints[index - 1];
            const endCp = this.controlPoints[index];

            const slope = startCp.slope ?? undefined;

            if (
                startCp.right_handle.handleType === HandleType.VECTOR &&
                endCp.left_handle.handleType === HandleType.VECTOR
            ) {
                // Straight segment
                const track: Track = {
                    tracktype: TrackType.STRAIGHT,
                    startPoint: PointCal.flipYAxis(
                        PointCal.multiplyVectorByScalar(
                            PointCal.unitVectorFromA2B(origin, startCp.transformedCoord),
                            PointCal.distanceBetweenPoints(origin, startCp.transformedCoord) * this.scale,
                        ),
                    ),
                    endPoint: PointCal.flipYAxis(
                        PointCal.multiplyVectorByScalar(
                            PointCal.unitVectorFromA2B(origin, endCp.transformedCoord),
                            PointCal.distanceBetweenPoints(origin, endCp.transformedCoord) * this.scale,
                        ),
                    ),
                    slope,
                };
                exportTracks.push(track);
            } else {
                // Curve segment — use bezier-js arc fitting
                const startWorld = PointCal.flipYAxis(
                    PointCal.multiplyVectorByScalar(
                        PointCal.unitVectorFromA2B(origin, startCp.transformedCoord),
                        PointCal.distanceBetweenPoints(origin, startCp.transformedCoord) * this.scale,
                    ),
                );
                const endWorld = PointCal.flipYAxis(
                    PointCal.multiplyVectorByScalar(
                        PointCal.unitVectorFromA2B(origin, endCp.transformedCoord),
                        PointCal.distanceBetweenPoints(origin, endCp.transformedCoord) * this.scale,
                    ),
                );
                const rhWorld = PointCal.flipYAxis(
                    PointCal.multiplyVectorByScalar(
                        PointCal.unitVectorFromA2B(origin, startCp.right_handle.transformedCoord),
                        PointCal.distanceBetweenPoints(origin, startCp.right_handle.transformedCoord) * this.scale,
                    ),
                );
                const lhWorld = PointCal.flipYAxis(
                    PointCal.multiplyVectorByScalar(
                        PointCal.unitVectorFromA2B(origin, endCp.left_handle.transformedCoord),
                        PointCal.distanceBetweenPoints(origin, endCp.left_handle.transformedCoord) * this.scale,
                    ),
                );

                const bCurve = new Bezier([startWorld, rhWorld, lhWorld, endWorld]);

                try {
                    const arcs = bCurve.arcs(0.05);
                    for (const arc of arcs) {
                        const arcStart = bCurve.get(arc.interval.start);
                        const arcEnd = bCurve.get(arc.interval.end);
                        const track: Track = {
                            tracktype: TrackType.CURVE,
                            startPoint: { x: arcStart.x, y: arcStart.y },
                            endPoint: { x: arcEnd.x, y: arcEnd.y },
                            radius: arc.r,
                            center: { x: arc.x, y: arc.y },
                            angleSpan: PointCal.angleFromA2B(
                                PointCal.subVector({ x: arcStart.x, y: arcStart.y }, { x: arc.x, y: arc.y }),
                                PointCal.subVector({ x: arcEnd.x, y: arcEnd.y }, { x: arc.x, y: arc.y }),
                            ),
                            slope,
                        };
                        exportTracks.push(track);
                    }
                } catch {
                    console.error('Arc fitting failed for segment', index);
                    return null;
                }
            }
        }

        return exportTracks;
    }

    // ------------------------------------------------------------------
    // Arc length utilities (used for direction arrows & labels)
    // ------------------------------------------------------------------

    getArcLengths(bCurve: Bezier): { arcLengths: number[]; fullArcLength: number } {
        const arcLengths: number[] = [];
        let arcLength = 0;
        let curPoint = bCurve.get(0);

        for (let tVal = 0; tVal <= 1; tVal += 0.001) {
            const nextPoint = bCurve.get(tVal);
            arcLength += PointCal.distanceBetweenPoints(nextPoint, curPoint);
            arcLengths.push(arcLength);
            curPoint = nextPoint;
        }

        return { arcLengths, fullArcLength: arcLength };
    }

    mapPercentage2TVal(
        percentage: number,
        arcLengths: number[],
        fullArcLength: number,
    ): number {
        const target = (fullArcLength * percentage) / 100;
        let left = 0;
        let right = arcLengths.length - 1;

        while (left <= right) {
            const mid = left + Math.floor((right - left) / 2);
            if (arcLengths[mid] === target) return mid / 1000;
            if (arcLengths[mid] < target) left = mid + 1;
            else right = mid - 1;
        }

        return left / 1000;
    }
}
