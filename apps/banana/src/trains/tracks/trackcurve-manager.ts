import { BCurve, offset2 } from '@ue-too/curve';
import {
    Point,
    PointCal
} from '@ue-too/math';

import { RTree, Rectangle } from '../r-tree';
import { GenericEntityManager } from '../../utils';
import { ELEVATION, ProjectionInfo, SerializedTrackSegment, TrackSegmentDrawData, TrackSegmentSplit, TrackStyle, TrackSegmentWithCollision, TrackSegmentWithCollisionAndNumber } from './types';
import { LEVEL_HEIGHT } from './constants';
import { getElevationAtT, makeTrackSegmentDrawDataFromSplit, orderTest, trackSegmentDrawDataInsertIndex } from './utils';
import { Observable, SubscriptionOptions, SynchronousObservable } from '@ue-too/board';

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
        positiveOffsets: Point[];
        negativeOffsets: Point[];
    })[] = [];

    private _deleteObservable: Observable<[string]> = new SynchronousObservable<[string]>();
    private _addObservable: Observable<[number, (TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] })[]]> = new SynchronousObservable<[number, (TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] })[]]>();

    private _addTrackSegmentObservable: Observable<[number, TrackSegmentWithCollision]> = new SynchronousObservable<[number, TrackSegmentWithCollision]>();
    private _removeTrackSegmentObservable: Observable<[number]> = new SynchronousObservable<[number]>();

    /**
     * Extra distance added to gauge-based projection thresholds.
     * Prevents head-on train texture overlap at joints.
     */
    private _projectionBuffer: number = 0.5;

    /** Total width of the gravel bed foundation for newly created tracks. Used for snapping when bed is enabled. */
    private _bedWidth: number = 3;
    /** Whether the bed layer is enabled (affects snapping distance). */
    private _bedEnabled: boolean = false;

    constructor(initialCount: number) {
        this._internalTrackCurveManager = new GenericEntityManager<{
            segment: TrackSegmentWithCollision;
            offsets: {
                positive: Point[];
                negative: Point[];
            };
        }>(initialCount);
    }

    /** Get the current projection buffer value. */
    get projectionBuffer(): number {
        return this._projectionBuffer;
    }

    /** Set the projection buffer (extra distance beyond gauge for snapping). */
    set projectionBuffer(value: number) {
        this._projectionBuffer = Math.max(0, value);
    }

    /** Get the current bed width for newly created tracks. */
    get bedWidth(): number {
        return this._bedWidth;
    }

    /** Set the bed width for newly created tracks (affects snapping). */
    set bedWidth(value: number) {
        this._bedWidth = Math.max(1, value);
    }

    /** Whether the bed layer is enabled for snapping. */
    get bedEnabled(): boolean {
        return this._bedEnabled;
    }

    /** Toggle bed layer for snapping. When off, snapping uses gauge only. */
    set bedEnabled(value: boolean) {
        this._bedEnabled = value;
    }

    get persistedDrawData(): (TrackSegmentDrawData & {
        callback(index: number): void;
    })[] {
        return this._persistedDrawData;
    }

    getVisualPropsForSegment(segmentNumber: number): { trackStyle?: TrackStyle; electrified?: boolean; catenarySide?: 1 | -1; bed?: boolean; gauge?: number; bedWidth?: number } | undefined {
        const drawData = this._persistedDrawData.find(
            entry => entry.originalTrackSegment.trackSegmentNumber === segmentNumber
        );
        if (drawData === undefined) return undefined;
        return { trackStyle: drawData.trackStyle, electrified: drawData.electrified, catenarySide: drawData.catenarySide, bed: drawData.bed, gauge: drawData.gauge, bedWidth: drawData.bedWidth };
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
        let minDistance = Infinity;
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
                const existingWidth = trackSegment.bedWidth ?? trackSegment.gauge;
                const newWidth = this._bedEnabled ? this._bedWidth : trackSegment.gauge;
                const maxSnapDistance = existingWidth / 2 + newWidth / 2 + this._projectionBuffer;
                if (
                    distance < minDistance &&
                    distance < maxSnapDistance &&
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
                            existingWidth / 2 + newWidth / 2
                        )
                    );
                    if (projectionInfo === null) {
                        const curveIsSloped = trackSegment.elevation.from !== trackSegment.elevation.to;
                        const elevation = curveIsSloped ? getElevationAtT(res.tVal, {
                            elevation: {
                                from: trackSegment.elevation.from * LEVEL_HEIGHT,
                                to: trackSegment.elevation.to * LEVEL_HEIGHT,
                            },
                        }) : trackSegment.elevation.from;
                        projectionInfo = {
                            curve: trackSegment.trackSegmentNumber,
                            atT: res.tVal,
                            projectionPoint: projectedPosition,
                            t0Joint: trackSegment.t0Joint,
                            t1Joint: trackSegment.t1Joint,
                            tangent,
                            curvature,
                            elevation: {
                                curveIsSloped: curveIsSloped,
                                elevation: elevation,
                            },
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
        position: Point
    ): ProjectionInfo | null {
        let minDistance = Infinity;
        let projectionInfo: ProjectionInfo | null = null;
        const searchRadius = 10;
        const bbox = new Rectangle(
            position.x - searchRadius,
            position.y - searchRadius,
            position.x + searchRadius,
            position.y + searchRadius
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
                if (distance < minDistance && distance < trackSegment.gauge / 2) {
                    minDistance = distance;
                    if (projectionInfo === null) {
                        const curveIsSloped = trackSegment.elevation.from !== trackSegment.elevation.to;
                        const elevation = curveIsSloped ? getElevationAtT(res.tVal, {
                            elevation: {
                                from: trackSegment.elevation.from * LEVEL_HEIGHT,
                                to: trackSegment.elevation.to * LEVEL_HEIGHT,
                            },
                        }) : trackSegment.elevation.from;
                        projectionInfo = {
                            curve: trackSegment.trackSegmentNumber,
                            atT: res.tVal,
                            projectionPoint: res.projection,
                            t0Joint: trackSegment.t0Joint,
                            t1Joint: trackSegment.t1Joint,
                            tangent,
                            curvature,
                            elevation: {
                                curveIsSloped: curveIsSloped,
                                elevation: elevation,
                            },
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

    /**
     * Like projectOnCurve but uses a wider acceptance radius instead of gauge/2.
     * Used by platform placement tools that need a more forgiving hit area.
     */
    projectOnCurveWide(
        position: Point,
        maxDistance: number = 5,
    ): ProjectionInfo | null {
        let minDistance = Infinity;
        let projectionInfo: ProjectionInfo | null = null;
        const searchRadius = Math.max(10, maxDistance);
        const bbox = new Rectangle(
            position.x - searchRadius,
            position.y - searchRadius,
            position.x + searchRadius,
            position.y + searchRadius
        );
        const possibleTrackSegments = this._internalRTree.search(bbox);
        possibleTrackSegments.forEach(trackSegment => {
            const res = trackSegment.curve.getProjection(position);
            if (res != null) {
                const distance = PointCal.distanceBetweenPoints(
                    position,
                    res.projection
                );
                if (distance < minDistance && distance < maxDistance) {
                    minDistance = distance;
                    const tangent = trackSegment.curve.derivative(res.tVal);
                    const curvature = trackSegment.curve.curvature(res.tVal);
                    const curveIsSloped = trackSegment.elevation.from !== trackSegment.elevation.to;
                    const elevation = curveIsSloped ? getElevationAtT(res.tVal, {
                        elevation: {
                            from: trackSegment.elevation.from * LEVEL_HEIGHT,
                            to: trackSegment.elevation.to * LEVEL_HEIGHT,
                        },
                    }) : trackSegment.elevation.from;
                    projectionInfo = {
                        curve: trackSegment.trackSegmentNumber,
                        atT: res.tVal,
                        projectionPoint: res.projection,
                        t0Joint: trackSegment.t0Joint,
                        t1Joint: trackSegment.t1Joint,
                        tangent,
                        curvature,
                        elevation: {
                            curveIsSloped,
                            elevation,
                        },
                    };
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
        excludeSegmentsForCollisionCheck: Set<number> = new Set(),
        bedWidth?: number,
        visualProps?: { trackStyle?: TrackStyle; electrified?: boolean; catenarySide?: 1 | -1; bed?: boolean }
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
            bedWidth: bedWidth ?? (this._bedEnabled ? this._bedWidth : undefined),
            trackStyle: visualProps?.trackStyle,
            electrified: visualProps?.electrified,
            catenarySide: visualProps?.catenarySide,
            bed: visualProps?.bed,
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

        const drawDataForSplits: (TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] })[] = [];

        splits.forEach(split => {
            const drawDataForSplit = makeTrackSegmentDrawDataFromSplit(split, trackSegmentEntry, curveNumber) as
                TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[]; callback(index: number): void };
            drawDataForSplit.callback = ((index: number) => {
                this._trackOrderMap.set(
                    JSON.stringify({ trackSegmentNumber: curveNumber, tValInterval: split.tValInterval }),
                    index
                );
            }).bind(this);
            const insertIndex = trackSegmentDrawDataInsertIndex(this._persistedDrawData, drawDataForSplit);
            this._persistedDrawData.splice(insertIndex, 0, drawDataForSplit);
            drawDataForSplits.push(drawDataForSplit);
        });

        this._addObservable.notify(-1, drawDataForSplits);

        this._internalRTree.insert(aabbRectangle, trackSegmentTreeEntry);
        this._drawDataDirty = true;
        this._addTrackSegmentObservable.notify(curveNumber, trackSegmentEntry);
        return curveNumber;
    }

    destroyCurve(curveNumber: number): void {
        const trackSegment =
            this._internalTrackCurveManager.getEntity(curveNumber);
        if (trackSegment === null) {
            console.warn('track segment not found');
            return;
        }
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

        const removedKeys: string[] = [];
        this._persistedDrawData = this._persistedDrawData.filter(entry => {
            if (entry.originalTrackSegment.trackSegmentNumber === curveNumber) {
                const key = JSON.stringify({
                    trackSegmentNumber: curveNumber,
                    tValInterval: entry.originalTrackSegment.tValInterval,
                });
                removedKeys.push(key);
                return false;
            }
            return true;
        });

        for (const key of removedKeys) {
            this._deleteObservable.notify(key);
        }
        this._removeTrackSegmentObservable.notify(curveNumber);
    }

    getPreviewDrawData(
        curve: BCurve,
        t0Elevation: ELEVATION,
        t1Elevation: ELEVATION,
        gauge: number = 1.067,
        excludeSegmentsForCollisionCheck: Set<number> = new Set()
    ): { index: number, drawData: TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] } }[] {
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
            t0Joint: -1,
            t1Joint: -1,
            elevation: {
                from: t0Elevation,
                to: t1Elevation,
            },
            collision: collisions,
            gauge,
            splits: insertionT,
            splitCurves: splits,
        };

        const drawDataForSplits = splits.map(split => {
            const drawDataForSplit = makeTrackSegmentDrawDataFromSplit(split, trackSegmentEntry, -1);
            const positiveOffsets = offset2(split.curve, gauge / 2).points;
            const negativeOffsets = offset2(split.curve, -gauge / 2).points;
            return {
                // index: trackSegmentDrawDataInsertIndex(this._persistedDrawData, drawDataForSplit),
                index: -1,
                drawData: drawDataForSplit,
                positiveOffsets,
                negativeOffsets,
            };
        });

        return drawDataForSplits;
    }

    onDelete(callback: (key: string) => void, options?: SubscriptionOptions) {
        return this._deleteObservable.subscribe(callback, options);
    }

    onAdd(callback: (index: number, drawData: (TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] })[]) => void, options?: SubscriptionOptions) {
        return this._addObservable.subscribe(callback, options);
    }

    onAddTrackSegment(callback: (curveNumber: number, trackSegment: TrackSegmentWithCollision) => void, options?: SubscriptionOptions) {
        return this._addTrackSegmentObservable.subscribe(callback, options);
    }

    onRemoveTrackSegment(callback: (curveNumber: number) => void, options?: SubscriptionOptions) {
        return this._removeTrackSegmentObservable.subscribe(callback, options);
    }

    get livingEntities(): number[] {
        return this._internalTrackCurveManager.getLivingEntitesIndex();
    }

    get trackOffsets(): { positive: Point[]; negative: Point[] }[] {
        return this._internalTrackCurveManager
            .getLivingEntities()
            .map(entity => entity.offsets);
    }

    onWhichDrawData(position: { trackSegmentNumber: number, tVal: number }): { trackSegmentNumber: number, tValInterval: { start: number, end: number } } | null {
        const trackSegment = this._internalTrackCurveManager.getEntity(position.trackSegmentNumber);
        if (trackSegment == null) {
            return null;
        }
        const splits = trackSegment.segment.splitCurves;
        let left = 0;
        let right = splits.length - 1;

        while (left <= right) {
            const mid = left + Math.floor((right - left) / 2);
            const midSplit = splits[mid];
            if (position.tVal >= midSplit.tValInterval.start && position.tVal <= midSplit.tValInterval.end) {
                return { trackSegmentNumber: position.trackSegmentNumber, tValInterval: midSplit.tValInterval };
            } else if (position.tVal < midSplit.tValInterval.start) {
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }
        return null;
    }

    /**
     * Serializes all living track segments into a JSON-safe format.
     * BCurves are stored as control point arrays; derived state (offsets,
     * collisions, RTree entries, draw data) is recomputed during deserialization.
     */
    serialize(): SerializedTrackSegment[] {
        return this._internalTrackCurveManager
            .getLivingEntitiesWithIndex()
            .map(({ index, entity }) => {
                const visualProps = this.getVisualPropsForSegment(index);
                return {
                    segmentNumber: index,
                    controlPoints: entity.segment.curve.getControlPoints().map(p => ({ x: p.x, y: p.y })),
                    t0Joint: entity.segment.t0Joint,
                    t1Joint: entity.segment.t1Joint,
                    elevation: {
                        from: entity.segment.elevation.from,
                        to: entity.segment.elevation.to,
                    },
                    gauge: entity.segment.gauge,
                    splits: [...entity.segment.splits],
                    trackStyle: entity.segment.trackStyle ?? visualProps?.trackStyle,
                    electrified: entity.segment.electrified ?? visualProps?.electrified,
                    catenarySide: entity.segment.catenarySide ?? visualProps?.catenarySide,
                    bed: entity.segment.bed ?? visualProps?.bed,
                };
            });
    }

    /**
     * Loads a segment with a specific ID, rebuilding all derived state
     * (offsets, split curves, RTree entry, draw data) from the stored essentials.
     * Fires add observers so that render systems are notified.
     */
    loadSegmentWithId(
        segmentNumber: number,
        curve: BCurve,
        t0Joint: number,
        t1Joint: number,
        t0Elevation: ELEVATION,
        t1Elevation: ELEVATION,
        gauge: number,
        splitTValues: number[],
        visualProps?: { trackStyle?: TrackStyle; electrified?: boolean; catenarySide?: 1 | -1; bed?: boolean }
    ): void {
        const experimentPositiveOffsets = offset2(curve, gauge / 2);
        const experimentNegativeOffsets = offset2(curve, -gauge / 2);
        const aabb = curve.AABB;
        const aabbRectangle = new Rectangle(
            aabb.min.x,
            aabb.min.y,
            aabb.max.x,
            aabb.max.y
        );

        // Compute collisions with existing segments in the RTree (same as
        // addTrackSegment). Without this, segments loaded from serialized data
        // have empty collision arrays and crossing detection won't work.
        const collisions: {
            selfT: number;
            anotherCurve: { curve: BCurve; tVal: number };
        }[] = [];

        const possibleCollisions = this._internalRTree.search(aabbRectangle);
        for (const segment of possibleCollisions) {
            const intersections = segment.curve
                .getCurveIntersections(curve)
                .map(intersection => ({
                    selfT: intersection.otherT,
                    anotherCurve: {
                        curve: segment.curve,
                        tVal: intersection.selfT,
                    },
                }));
            collisions.push(...intersections);
        }

        const splits: TrackSegmentSplit[] = [];

        if (splitTValues.length === 0) {
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
                const [startingCurve, _] = curve.splitIntoCurves(splitTValues[0]);
                const startElevation = getElevationAtT(0, {
                    elevation: {
                        from: t0Elevation * LEVEL_HEIGHT,
                        to: t1Elevation * LEVEL_HEIGHT,
                    },
                });
                const endElevation = getElevationAtT(splitTValues[0], {
                    elevation: {
                        from: t0Elevation * LEVEL_HEIGHT,
                        to: t1Elevation * LEVEL_HEIGHT,
                    },
                });
                splits.push({
                    curve: startingCurve,
                    elevation: { from: startElevation, to: endElevation },
                    tValInterval: { start: 0, end: splitTValues[0] },
                });
            }

            for (let i = 0; i < splitTValues.length - 1; i++) {
                const tVal = splitTValues[i];
                const nextTVal = splitTValues[i + 1];
                const [_, secondCurve] = curve.splitIn3Curves(tVal, nextTVal);
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
                    splitTValues[splitTValues.length - 1]
                );
                const startElevation = getElevationAtT(
                    splitTValues[splitTValues.length - 1],
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
                        start: splitTValues[splitTValues.length - 1],
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
            trackStyle: visualProps?.trackStyle,
            electrified: visualProps?.electrified,
            catenarySide: visualProps?.catenarySide,
            bed: visualProps?.bed,
            splits: splitTValues,
            splitCurves: splits,
        };

        this._internalTrackCurveManager.createEntityWithId(segmentNumber, {
            segment: trackSegmentEntry,
            offsets: {
                positive: experimentPositiveOffsets.points,
                negative: experimentNegativeOffsets.points,
            },
        });

        const trackSegmentTreeEntry: TrackSegmentWithCollisionAndNumber = {
            ...trackSegmentEntry,
            trackSegmentNumber: segmentNumber,
        };

        this._internalRTree.insert(aabbRectangle, trackSegmentTreeEntry);

        const drawDataForSplits: (TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[] })[] = [];

        splits.forEach(split => {
            const drawDataForSplit = makeTrackSegmentDrawDataFromSplit(split, trackSegmentEntry, segmentNumber) as
                TrackSegmentDrawData & { positiveOffsets: Point[]; negativeOffsets: Point[]; callback(index: number): void };
            drawDataForSplit.callback = ((index: number) => {
                this._trackOrderMap.set(
                    JSON.stringify({ trackSegmentNumber: segmentNumber, tValInterval: split.tValInterval }),
                    index
                );
            }).bind(this);
            const insertIndex = trackSegmentDrawDataInsertIndex(this._persistedDrawData, drawDataForSplit);
            this._persistedDrawData.splice(insertIndex, 0, drawDataForSplit);
            drawDataForSplits.push(drawDataForSplit);
        });

        this._addObservable.notify(-1, drawDataForSplits);
        this._drawDataDirty = true;
        this._addTrackSegmentObservable.notify(segmentNumber, trackSegmentEntry);
    }

    /**
     * Reconstructs a TrackCurveManager from serialized data,
     * preserving all original segment numbers. Derived state
     * (offsets, split curves, RTree, draw data) is recomputed.
     */
    static deserialize(data: SerializedTrackSegment[]): TrackCurveManager {
        const maxId = data.reduce((max, s) => Math.max(max, s.segmentNumber), -1);
        const manager = new TrackCurveManager(Math.max(maxId + 1, 10));
        for (const segment of data) {
            const curve = new BCurve(segment.controlPoints);
            manager.loadSegmentWithId(
                segment.segmentNumber,
                curve,
                segment.t0Joint,
                segment.t1Joint,
                segment.elevation.from,
                segment.elevation.to,
                segment.gauge,
                segment.splits,
                { trackStyle: segment.trackStyle, electrified: segment.electrified, catenarySide: segment.catenarySide, bed: segment.bed }
            );
        }
        return manager;
    }
}
