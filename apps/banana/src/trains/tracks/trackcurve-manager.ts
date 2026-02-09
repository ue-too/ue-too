import { BCurve, offset2 } from '@ue-too/curve';
import {
    Point,
    PointCal
} from '@ue-too/math';

import { RTree, Rectangle } from '../r-tree';
import { GenericEntityManager } from '../../utils';
import { ELEVATION, ProjectionInfo, TrackSegmentDrawData, TrackSegmentSplit, TrackSegmentWithCollision, TrackSegmentWithCollisionAndNumber } from './types';
import { LEVEL_HEIGHT } from './constants';
import { getElevationAtT, makeTrackSegmentDrawDataFromSplit, orderTest, trackSegmentDrawDataInsertIndex } from './utils';
import { Observable, SynchronousObservable } from '@ue-too/board';

export class TrackCurveManager {
    private _internalTrackCurveManager: GenericEntityManager<{
        segment: TrackSegmentWithCollision;
        offsets: {
            positive: Point[];
            negative: Point[];
        };
    }>;

    private _internalRTree: RTree<TrackSegmentWithCollisionAndNumber> =
        new RTree<TrackSegmentWithCollisionAndNumber>();

    private _internalDrawData: (TrackSegmentDrawData & {
        callback(index: number): void;
    })[] = [];
    private _drawDataDirty = true;

    private _trackOrderMap: Map<string, number> = new Map();

    private _persistedDrawData: (TrackSegmentDrawData & {
        callback(index: number): void;
    })[] = [];
    private _persistedDrawDataMap: Map<string, number> = new Map();

    private _deleteObservable: Observable<[string]> = new SynchronousObservable<[string]>();
    private _addObservable: Observable<[number, TrackSegmentDrawData]> = new SynchronousObservable<[number, TrackSegmentDrawData]>();

    constructor(initialCount: number) {
        this._internalTrackCurveManager = new GenericEntityManager<{
            segment: TrackSegmentWithCollision;
            offsets: {
                positive: Point[];
                negative: Point[];
            };
        }>(initialCount);
    }

    get persistedDrawData(): (TrackSegmentDrawData & {
        callback(index: number): void;
    })[] {
        return this._persistedDrawData;
    }

    getTrackSegment(segmentNumber: number): BCurve | null {
        return (
            this._internalTrackCurveManager.getEntity(segmentNumber)?.segment
                .curve ?? null
        );
    }

    getTrackSegmentsWithJoints(): TrackSegmentWithCollision[] {
        return this._internalTrackCurveManager
            .getLivingEntities()
            .map(trackSegment => trackSegment.segment);
    }

    getTrackOrder(
        trackSegmentNumber: number,
        tValInterval: { start: number; end: number }
    ): number | null {
        console.log(this._trackOrderMap);
        console.log(JSON.stringify({ trackSegmentNumber, tValInterval }));
        return (
            this._trackOrderMap.get(
                JSON.stringify({ trackSegmentNumber, tValInterval })
            ) ?? null
        );
    }

    clearInternalDrawDataOrderMap(): void {
        this._trackOrderMap.clear();
    }

    experimental(): (TrackSegmentDrawData & {
        callback(index: number): void;
    })[] {
        if (!this._drawDataDirty) {
            return this._internalDrawData;
        }
        const res: (TrackSegmentDrawData & {
            callback(index: number): void;
        })[] = [];
        const tracks =
            this._internalTrackCurveManager.getLivingEntitiesWithIndex();
        this._trackOrderMap.clear();
        tracks.forEach(track => {
            const trackSegment = track.entity;
            const index = track.index;
            trackSegment.segment.splitCurves.forEach(splitCurve => {
                const cps = trackSegment.segment.curve.getControlPoints();
                const startPosition = cps[0];
                const endPosition = cps[cps.length - 1];
                const drawData: TrackSegmentDrawData & {
                    callback(index: number): void;
                } = {
                    curve: splitCurve.curve,
                    originalTrackSegment: {
                        trackSegmentNumber: index,
                        tValInterval: {
                            start: splitCurve.tValInterval.start,
                            end: splitCurve.tValInterval.end,
                        },
                        startJointPosition: startPosition,
                        endJointPosition: endPosition,
                    },
                    originalElevation: {
                        from: trackSegment.segment.elevation.from,
                        to: trackSegment.segment.elevation.to,
                    },
                    elevation: splitCurve.elevation,
                    excludeSegmentsForCollisionCheck: new Set(),
                    callback: ((drawIndex: number) => {
                        this._trackOrderMap.set(
                            JSON.stringify({
                                trackSegmentNumber: index,
                                tValInterval: splitCurve.tValInterval,
                            }),
                            drawIndex
                        );
                    }).bind(this),
                    gauge: trackSegment.segment.gauge,
                };
                res.push(drawData);
            });
        });
        console.time('sort');
        res.sort(orderTest);
        console.timeEnd('sort');
        this._internalDrawData = res;
        this._drawDataDirty = false;
        return res;
    }

    getTrackSegmentWithJoints(
        segmentNumber: number
    ): TrackSegmentWithCollision | null {
        return (
            this._internalTrackCurveManager.getEntity(segmentNumber)?.segment ??
            null
        );
    }

    checkForCollisions(
        curve: BCurve,
        excludeSegmentsForCollisionCheck: Set<number> = new Set(),
        skipFlat: boolean = false
    ): { selfT: number; anotherCurve: { curve: BCurve; tVal: number } }[] {
        const collisions: {
            selfT: number;
            anotherCurve: { curve: BCurve; tVal: number };
        }[] = [];
        const rect = new Rectangle(
            curve.AABB.min.x,
            curve.AABB.min.y,
            curve.AABB.max.x,
            curve.AABB.max.y
        );
        const possibleCollisions = this._internalRTree.search(rect);
        possibleCollisions
            .filter(
                segment =>
                    !excludeSegmentsForCollisionCheck.has(
                        segment.trackSegmentNumber
                    ) &&
                    (!skipFlat ||
                        segment.elevation.from !== segment.elevation.to)
            )
            .forEach(segment => {
                const intersections = segment.curve
                    .getCurveIntersections(curve)
                    .map(intersection => {
                        return {
                            selfT: intersection.otherT,
                            anotherCurve: {
                                curve: segment.curve,
                                tVal: intersection.selfT,
                            },
                        };
                    });
                collisions.push(...intersections);
            });

        return collisions;
    }

    onTrackSegmentEdge(position: Point): ProjectionInfo | null {
        let minDistance = 2;
        let projectionInfo: ProjectionInfo | null = null;
        const bbox = new Rectangle(
            position.x - 10,
            position.y - 10,
            position.x + 10,
            position.y + 10
        );
        const possibleTrackSegments = this._internalRTree.search(bbox);
        possibleTrackSegments.forEach(trackSegment => {
            const res = trackSegment.curve.getProjection(position);
            if (res != null) {
                const distance = PointCal.distanceBetweenPoints(
                    position,
                    res.projection
                );
                if (
                    distance < minDistance &&
                    distance > trackSegment.gauge / 2
                ) {
                    minDistance = distance;
                    const tangent = PointCal.unitVector(
                        trackSegment.curve.derivative(res.tVal)
                    );
                    const curvature = trackSegment.curve.curvature(res.tVal);
                    const direction = PointCal.unitVectorFromA2B(
                        res.projection,
                        position
                    );
                    const angle = PointCal.angleFromA2B(tangent, direction);
                    let orthogonalDirection = PointCal.unitVector({
                        x: -tangent.y,
                        y: tangent.x,
                    });
                    if (angle < 0) {
                        orthogonalDirection = PointCal.multiplyVectorByScalar(
                            orthogonalDirection,
                            -1
                        );
                    }
                    const projectedPosition = PointCal.addVector(
                        res.projection,
                        PointCal.multiplyVectorByScalar(
                            orthogonalDirection,
                            trackSegment.gauge
                        )
                    );
                    if (projectionInfo === null) {
                        projectionInfo = {
                            curve: trackSegment.trackSegmentNumber,
                            atT: res.tVal,
                            projectionPoint: projectedPosition,
                            t0Joint: trackSegment.t0Joint,
                            t1Joint: trackSegment.t1Joint,
                            tangent,
                            curvature,
                        };
                        return;
                    }
                    projectionInfo.atT = res.tVal;
                    projectionInfo.projectionPoint = projectedPosition;
                    projectionInfo.curve = trackSegment.trackSegmentNumber;
                    projectionInfo.t0Joint = trackSegment.t0Joint;
                    projectionInfo.t1Joint = trackSegment.t1Joint;
                    projectionInfo.tangent = tangent;
                    projectionInfo.curvature = curvature;
                }
            }
        });
        return projectionInfo;
    }

    projectOnCurve(
        position: Point,
        maxDistance: number = 1
    ): ProjectionInfo | null {
        let minDistance = maxDistance;
        let projectionInfo: ProjectionInfo | null = null;
        const bbox = new Rectangle(
            position.x - 0.1,
            position.y - 0.1,
            position.x + 0.1,
            position.y + 0.1
        );
        const possibleTrackSegments = this._internalRTree.search(bbox);
        possibleTrackSegments.forEach(trackSegment => {
            const res = trackSegment.curve.getProjection(position);
            if (res != null) {
                const distance = PointCal.distanceBetweenPoints(
                    position,
                    res.projection
                );
                const tangent = trackSegment.curve.derivative(res.tVal);
                const curvature = trackSegment.curve.curvature(res.tVal);
                if (distance < minDistance) {
                    minDistance = distance;
                    if (projectionInfo === null) {
                        projectionInfo = {
                            curve: trackSegment.trackSegmentNumber,
                            atT: res.tVal,
                            projectionPoint: res.projection,
                            t0Joint: trackSegment.t0Joint,
                            t1Joint: trackSegment.t1Joint,
                            tangent,
                            curvature,
                        };
                        return;
                    }
                    projectionInfo.atT = res.tVal;
                    projectionInfo.projectionPoint = res.projection;
                    projectionInfo.curve = trackSegment.trackSegmentNumber;
                    projectionInfo.t0Joint = trackSegment.t0Joint;
                    projectionInfo.t1Joint = trackSegment.t1Joint;
                    projectionInfo.tangent = tangent;
                    projectionInfo.curvature = curvature;
                }
            }
        });
        return projectionInfo;
    }

    createCurveWithJoints(
        curve: BCurve,
        t0Joint: number,
        t1Joint: number,
        t0Elevation: ELEVATION,
        t1Elevation: ELEVATION,
        gauge: number = 1.067,
        excludeSegmentsForCollisionCheck: Set<number> = new Set()
    ): number {
        const experimentPositiveOffsets = offset2(curve, gauge / 2);
        const experimentNegativeOffsets = offset2(curve, -gauge / 2);
        const aabb = curve.AABB;
        const aabbRectangle = new Rectangle(
            aabb.min.x,
            aabb.min.y,
            aabb.max.x,
            aabb.max.y
        );
        const possibleCollisions = this._internalRTree.search(aabbRectangle);

        const collisions: {
            selfT: number;
            anotherCurve: { curve: BCurve; tVal: number };
        }[] = [];

        possibleCollisions
            .filter(
                segment =>
                    !excludeSegmentsForCollisionCheck.has(
                        segment.trackSegmentNumber
                    )
            )
            .forEach(segment => {
                const intersections = segment.curve
                    .getCurveIntersections(curve)
                    .map(intersection => {
                        return {
                            selfT: intersection.otherT,
                            anotherCurve: {
                                curve: segment.curve,
                                tVal: intersection.selfT,
                            },
                        };
                    });
                collisions.push(...intersections);
            });

        let startT = 0;

        const insertionT: number[] = [];
        const collisionT: number[] = [];

        if (t0Elevation !== t1Elevation) {
            // the new curve is sloped
            const internalIntersections = this.checkForCollisions(
                curve,
                excludeSegmentsForCollisionCheck
            );

            internalIntersections
                .sort((a, b) => a.selfT - b.selfT)
                .forEach(intersection => {
                    collisionT.push(intersection.selfT);
                    const insertT =
                        Math.round(((intersection.selfT + startT) / 2) * 100) /
                        100;
                    insertionT.push(insertT);
                    startT = intersection.selfT;
                });
        } else {
            // the new curve is flat
            const internalIntersections = this.checkForCollisions(
                curve,
                excludeSegmentsForCollisionCheck,
                true
            );

            internalIntersections
                .sort((a, b) => a.selfT - b.selfT)
                .forEach(intersection => {
                    collisionT.push(intersection.selfT);
                    const insertT =
                        Math.round(((intersection.selfT + startT) / 2) * 100) /
                        100;
                    insertionT.push(insertT);
                    startT = intersection.selfT;
                });
        }

        startT = 0;

        const splits: TrackSegmentSplit[] = [];

        if (insertionT.length === 0) {
            splits.push({
                curve: curve,
                elevation: {
                    from: t0Elevation * LEVEL_HEIGHT,
                    to: t1Elevation * LEVEL_HEIGHT,
                },
                tValInterval: { start: 0, end: 1 },
            });
        } else {
            {
                const [startingCurve, _] = curve.splitIntoCurves(insertionT[0]);
                const startElevation = getElevationAtT(startT, {
                    elevation: {
                        from: t0Elevation * LEVEL_HEIGHT,
                        to: t1Elevation * LEVEL_HEIGHT,
                    },
                });
                const endElevation = getElevationAtT(insertionT[0], {
                    elevation: {
                        from: t0Elevation * LEVEL_HEIGHT,
                        to: t1Elevation * LEVEL_HEIGHT,
                    },
                });
                splits.push({
                    curve: startingCurve,
                    elevation: { from: startElevation, to: endElevation },
                    tValInterval: { start: 0, end: insertionT[0] },
                });
            }

            for (let i = 0; i < insertionT.length - 1; i++) {
                const tVal = insertionT[i];
                const nextTVal = insertionT[i + 1];
                const [_, secondCurve] =
                    curve.splitIn3Curves(tVal, nextTVal);
                const startElevation = getElevationAtT(tVal, {
                    elevation: {
                        from: t0Elevation * LEVEL_HEIGHT,
                        to: t1Elevation * LEVEL_HEIGHT,
                    },
                });
                const endElevation = getElevationAtT(nextTVal, {
                    elevation: {
                        from: t0Elevation * LEVEL_HEIGHT,
                        to: t1Elevation * LEVEL_HEIGHT,
                    },
                });
                splits.push({
                    curve: secondCurve,
                    elevation: { from: startElevation, to: endElevation },
                    tValInterval: { start: tVal, end: nextTVal },
                });
            }

            {
                const [_, endingCurve] = curve.splitIntoCurves(
                    insertionT[insertionT.length - 1]
                );
                const startElevation = getElevationAtT(
                    insertionT[insertionT.length - 1],
                    {
                        elevation: {
                            from: t0Elevation * LEVEL_HEIGHT,
                            to: t1Elevation * LEVEL_HEIGHT,
                        },
                    }
                );
                const endElevation = getElevationAtT(1, {
                    elevation: {
                        from: t0Elevation * LEVEL_HEIGHT,
                        to: t1Elevation * LEVEL_HEIGHT,
                    },
                });
                splits.push({
                    curve: endingCurve,
                    elevation: { from: startElevation, to: endElevation },
                    tValInterval: {
                        start: insertionT[insertionT.length - 1],
                        end: 1,
                    },
                });
            }
        }

        const trackSegmentEntry: TrackSegmentWithCollision = {
            curve: curve,
            t0Joint: t0Joint,
            t1Joint: t1Joint,
            elevation: {
                from: t0Elevation,
                to: t1Elevation,
            },
            collision: collisions,
            gauge,
            splits: insertionT,
            splitCurves: splits,
        };

        const curveNumber = this._internalTrackCurveManager.createEntity({
            segment: trackSegmentEntry,
            offsets: {
                positive: experimentPositiveOffsets.points,
                negative: experimentNegativeOffsets.points,
            },
        });

        const trackSegmentTreeEntry: TrackSegmentWithCollisionAndNumber = {
            ...trackSegmentEntry,
            trackSegmentNumber: curveNumber,
        };

        splits.forEach(split => {
            const drawDataForSplit = makeTrackSegmentDrawDataFromSplit(split, trackSegmentEntry, curveNumber);
            const insertIndex = trackSegmentDrawDataInsertIndex(this._persistedDrawData, drawDataForSplit);
            this._persistedDrawData.splice(insertIndex, 0, {
                ...drawDataForSplit,
                callback: ((index: number) => {
                    this._trackOrderMap.set(
                        JSON.stringify({ trackSegmentNumber: curveNumber, tValInterval: split.tValInterval }),
                        index
                    );
                }).bind(this),
            });
            this._persistedDrawDataMap.set(JSON.stringify({ trackSegmentNumber: curveNumber, tValInterval: split.tValInterval }), insertIndex);
            this._addObservable.notify(insertIndex, drawDataForSplit);
        });

        this._internalRTree.insert(aabbRectangle, trackSegmentTreeEntry);
        this._drawDataDirty = true;
        return curveNumber;
    }

    destroyCurve(curveNumber: number): void {
        const trackSegment =
            this._internalTrackCurveManager.getEntity(curveNumber);
        if (trackSegment === null) {
            console.warn('track segment not found');
            return;
        }
        const splits = trackSegment.segment.splitCurves;
        const rectangle = new Rectangle(
            trackSegment.segment.curve.AABB.min.x,
            trackSegment.segment.curve.AABB.min.y,
            trackSegment.segment.curve.AABB.max.x,
            trackSegment.segment.curve.AABB.max.y
        );
        const trackSegmentTreeEntry = this._internalRTree
            .search(rectangle)
            .find(segment => segment.trackSegmentNumber === curveNumber);
        if (trackSegmentTreeEntry == null) {
            console.warn('track segment tree entry not found');
            return;
        }
        this._internalRTree.removeByData(trackSegmentTreeEntry);
        this._internalTrackCurveManager.destroyEntity(curveNumber);
        this._drawDataDirty = true;

        let minIndex = this._persistedDrawData.length - 1;
        const deletedSet: Set<string> = new Set();
        splits.forEach(split => {
            const key = JSON.stringify({ trackSegmentNumber: curveNumber, tValInterval: split.tValInterval });
            deletedSet.add(key);
            const index = this._persistedDrawDataMap.get(key);
            if (index !== undefined) {
                if (index < minIndex) {
                    minIndex = index;
                }
                this._persistedDrawData.splice(index, 1);
                this._persistedDrawDataMap.delete(key);
                this._deleteObservable.notify(key);
            }
        });
    }

    onDelete(callback: (key: string) => void) {
        return this._deleteObservable.subscribe(callback);
    }

    onAdd(callback: (index: number, drawData: TrackSegmentDrawData) => void) {
        return this._addObservable.subscribe(callback);
    }

    get livingEntities(): number[] {
        return this._internalTrackCurveManager.getLivingEntitesIndex();
    }

    get trackOffsets(): { positive: Point[]; negative: Point[] }[] {
        return this._internalTrackCurveManager
            .getLivingEntities()
            .map(entity => entity.offsets);
    }
}
