import { AABBIntersects, BCurve } from '@ue-too/curve';
import {
    Point,
    PointCal,
    directionAlignedToTangent,
    normalizeAngleZero2TwoPI,
    sameDirection,
} from '@ue-too/math';

import { LEVEL_HEIGHT } from './constants';
import { ELEVATION, ProjectionInfo, ProjectionJointResult, ProjectionResult, TrackJoint, TrackJointWithElevation, TrackSegment, TrackSegmentDrawData, TrackSegmentWithCollision, TrackSegmentWithElevation } from './types';
import { TrackCurveManager } from './trackcurve-manager';
import { TrackJointManager } from './trackjoin-manager';
import { elevationIntervalOverlaps, getElevationAtT, trackIsSloped } from './utils';

export class TrackGraph {
    private _jointManager: TrackJointManager = new TrackJointManager(10);
    private _trackCurveManager: TrackCurveManager = new TrackCurveManager(10);

    private _drawDataDirty = true;
    private _drawData: (TrackSegmentDrawData & {
        callback(index: number): void;
    })[] = [];

    getJoints(): { jointNumber: number; joint: TrackJoint }[] {
        return this._jointManager.getJoints();
    }

    getJoint(jointNumber: number): TrackJoint | null {
        return this._jointManager.getJoint(jointNumber);
    }

    insertJointIntoTrackSegmentUsingTrackNumber(
        trackSegmentNumber: number,
        atT: number
    ): number | null {
        const segment =
            this._trackCurveManager.getTrackSegmentWithJoints(
                trackSegmentNumber
            );

        if (segment === null) {
            console.warn(
                'track segment number does not correspond to a track segment'
            );
            return null;
        }

        const newControlPointGroups = segment.curve.split(atT);
        const t0JointNumber = segment.t0Joint;
        const t1JointNumber = segment.t1Joint;

        const t0Joint = this._jointManager.getJoint(t0JointNumber);
        const t1Joint = this._jointManager.getJoint(t1JointNumber);

        if (t0Joint === null || t1Joint === null) {
            console.warn(
                't0Joint or t1Joint not found when inserting joint into track segment using track number'
            );
            return null;
        }

        if (t0Joint.elevation !== t1Joint.elevation) {
            return null;
        }

        const newJointPosition = segment.curve.get(atT);

        /*  NOTE: insert the new joint*/
        const newJoint: TrackJointWithElevation = {
            position: newJointPosition,
            connections: new Map(),
            tangent: { x: 0, y: 0 },
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>(),
            },
            elevation: t0Joint.elevation,
        };

        const newJointNumber = this._jointManager.createJoint(newJoint);

        const firstCurve = new BCurve(newControlPointGroups[0]);
        const secondCurve = new BCurve(newControlPointGroups[1]);

        this._trackCurveManager.destroyCurve(trackSegmentNumber);

        const firstSegmentNumber =
            this._trackCurveManager.createCurveWithJoints(
                firstCurve,
                t0JointNumber,
                newJointNumber,
                t0Joint.elevation,
                newJoint.elevation
            );
        const secondSegmentNumber =
            this._trackCurveManager.createCurveWithJoints(
                secondCurve,
                newJointNumber,
                t1JointNumber,
                newJoint.elevation,
                t1Joint.elevation
            );

        const tangentAtNewJoint = PointCal.unitVector(firstCurve.derivative(1));

        newJoint.tangent = tangentAtNewJoint;

        newJoint.direction.reverseTangent.add(t0JointNumber);
        newJoint.direction.tangent.add(t1JointNumber);

        newJoint.connections.set(t0JointNumber, firstSegmentNumber);
        newJoint.connections.set(t1JointNumber, secondSegmentNumber);

        /* NOTE: update the t0 joint */

        // NOTE: add the new connection and remove the old connection to the t1Joint
        t0Joint.connections.set(newJointNumber, firstSegmentNumber);
        t0Joint.connections.delete(t1JointNumber);

        const t0JointTangent = t0Joint.tangent;
        const t0JointTangentFromCurve = segment.curve.derivative(0);

        if (
            directionAlignedToTangent(t0JointTangent, t0JointTangentFromCurve)
        ) {
            t0Joint.direction.tangent.delete(t1JointNumber);
            t0Joint.direction.tangent.add(newJointNumber);
        } else {
            t0Joint.direction.reverseTangent.delete(t1JointNumber);
            t0Joint.direction.reverseTangent.add(newJointNumber);
        }

        /* NOTE: update the t1 joint */

        // NOTE: add the new connection and remove the old connection to the t0Joint
        t1Joint.connections.set(newJointNumber, secondSegmentNumber);
        t1Joint.connections.delete(t0JointNumber);

        const t1JointTangent = t1Joint.tangent;
        const t1JointTangentFromCurve = segment.curve.derivative(1);

        if (
            directionAlignedToTangent(t1JointTangent, t1JointTangentFromCurve)
        ) {
            t1Joint.direction.reverseTangent.delete(t0JointNumber);
            t1Joint.direction.reverseTangent.add(newJointNumber);
        } else {
            t1Joint.direction.tangent.delete(t0JointNumber);
            t1Joint.direction.tangent.add(newJointNumber);
        }

        return newJointNumber;
    }

    insertJointIntoTrackSegment(
        startJointNumber: number,
        endJointNumber: number,
        atT: number
    ) {
        const startJoint = this._jointManager.getJoint(startJointNumber);
        const endJoint = this._jointManager.getJoint(endJointNumber);

        if (startJoint === null || endJoint === null) {
            console.warn('startJoint or endJoint not found');
            return;
        }

        if (startJoint.elevation !== endJoint.elevation) {
            // sloped tracks cannot be splited
            return null;
        }

        // get the id of the track segment from the start and end joint number
        const trackSegmentNumber = startJoint.connections.get(endJointNumber);

        if (trackSegmentNumber === undefined) {
            // || (trackSegment.t0Joint !== startJointNumber && trackSegment.t0Joint !== endJointNumber) || (trackSegment.t1Joint !== endJointNumber && trackSegment.t1Joint !== startJointNumber)){
            console.warn(
                'trackSegment not found or not the correct track segment; something is wrong'
            );
            return;
        }

        const segment =
            this._trackCurveManager.getTrackSegmentWithJoints(
                trackSegmentNumber
            );

        if (segment === null) {
            console.warn(
                'track segment number does not correspond to a track segment'
            );
            return;
        }

        const newControlPointGroups = segment.curve.split(atT);
        const t0JointNumber = segment.t0Joint;
        const t1JointNumber = segment.t1Joint;
        let t0Joint = startJoint;
        let t1Joint = endJoint;

        if (t0JointNumber === endJointNumber) {
            t0Joint = endJoint;
            t1Joint = startJoint;
        }

        const newJointPosition = segment.curve.get(atT);

        /*  NOTE: insert the new joint*/
        const newJoint: TrackJointWithElevation = {
            position: newJointPosition,
            connections: new Map(),
            tangent: { x: 0, y: 0 },
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>(),
            },
            elevation: ELEVATION.GROUND,
        };

        const newJointNumber = this._jointManager.createJoint(newJoint);

        const firstCurve = new BCurve(newControlPointGroups[0]);
        const secondCurve = new BCurve(newControlPointGroups[1]);

        this._trackCurveManager.destroyCurve(trackSegmentNumber);

        const firstSegmentNumber =
            this._trackCurveManager.createCurveWithJoints(
                firstCurve,
                t0JointNumber,
                newJointNumber,
                t0Joint.elevation,
                newJoint.elevation
            );
        const secondSegmentNumber =
            this._trackCurveManager.createCurveWithJoints(
                secondCurve,
                newJointNumber,
                t1JointNumber,
                newJoint.elevation,
                t1Joint.elevation
            );

        const tangentAtNewJoint = PointCal.unitVector(firstCurve.derivative(1));

        newJoint.tangent = tangentAtNewJoint;

        newJoint.direction.reverseTangent.add(t0JointNumber);
        newJoint.direction.tangent.add(t1JointNumber);

        newJoint.connections.set(t0JointNumber, firstSegmentNumber);
        newJoint.connections.set(t1JointNumber, secondSegmentNumber);

        /* NOTE: update the t0 joint */

        // NOTE: add the new connection and remove the old connection to the t1Joint
        t0Joint.connections.set(newJointNumber, firstSegmentNumber);
        t0Joint.connections.delete(t1JointNumber);

        const t0JointTangent = t0Joint.tangent;
        const t0JointTangentFromCurve = segment.curve.derivative(0);

        if (sameDirection(t0JointTangent, t0JointTangentFromCurve)) {
            t0Joint.direction.tangent.delete(t1JointNumber);
            t0Joint.direction.tangent.add(newJointNumber);
        } else {
            t0Joint.direction.reverseTangent.delete(t1JointNumber);
            t0Joint.direction.reverseTangent.add(newJointNumber);
        }

        /* NOTE: update the t1 joint */

        // NOTE: add the new connection and remove the old connection to the t0Joint
        t1Joint.connections.set(newJointNumber, secondSegmentNumber);
        t1Joint.connections.delete(t0JointNumber);

        const t1JointTangent = t1Joint.tangent;
        const t1JointTangentFromCurve = segment.curve.derivative(1);

        if (sameDirection(t1JointTangent, t1JointTangentFromCurve)) {
            t1Joint.direction.reverseTangent.delete(t0JointNumber);
            t1Joint.direction.reverseTangent.add(newJointNumber);
        } else {
            t1Joint.direction.tangent.delete(t0JointNumber);
            t1Joint.direction.tangent.add(newJointNumber);
        }
    }

    get trackOffsets(): { positive: Point[]; negative: Point[] }[] {
        return this._trackCurveManager.trackOffsets;
    }

    removeTrackSegment(trackSegmentNumber: number): void {
        const segment =
            this._trackCurveManager.getTrackSegmentWithJoints(
                trackSegmentNumber
            );

        console.log('segment', segment);
        if (segment === null) {
            console.warn('segment not found');
            return;
        }

        const t0Joint = this._jointManager.getJoint(segment.t0Joint);
        const t1Joint = this._jointManager.getJoint(segment.t1Joint);

        if (t0Joint === null || t1Joint === null) {
            console.warn('t0Joint or t1Joint not found');
            return;
        }

        if (
            (t0Joint.direction.tangent.has(segment.t1Joint) &&
                t0Joint.direction.tangent.size === 1 &&
                t0Joint.direction.reverseTangent.size > 1) ||
            (t0Joint.direction.reverseTangent.has(segment.t1Joint) &&
                t0Joint.direction.reverseTangent.size === 1 &&
                t0Joint.direction.tangent.size > 1)
        ) {
            console.warn(
                't1Joint is the sole connection of the t0Joint in the direction of t0Joint; cannot delete'
            );
            return;
        }
        if (
            (t1Joint.direction.tangent.has(segment.t0Joint) &&
                t1Joint.direction.tangent.size === 1 &&
                t1Joint.direction.reverseTangent.size > 1) ||
            (t1Joint.direction.reverseTangent.has(segment.t0Joint) &&
                t1Joint.direction.reverseTangent.size === 1 &&
                t1Joint.direction.tangent.size > 1)
        ) {
            console.warn(
                't0Joint is the sole connection of the t1Joint in the direction of t1Joint; cannot delete'
            );
            return;
        }

        this._trackCurveManager.destroyCurve(trackSegmentNumber);

        t0Joint.connections.delete(segment.t1Joint);
        t1Joint.connections.delete(segment.t0Joint);

        t0Joint.direction.tangent.delete(segment.t1Joint);
        t0Joint.direction.reverseTangent.delete(segment.t1Joint);
        t1Joint.direction.tangent.delete(segment.t0Joint);
        t1Joint.direction.reverseTangent.delete(segment.t0Joint);

        if (t0Joint.connections.size === 0) {
            this._jointManager.destroyJoint(segment.t0Joint);
        }

        if (t1Joint.connections.size === 0) {
            this._jointManager.destroyJoint(segment.t1Joint);
        }
        this._drawDataDirty = true;
    }

    branchToNewJoint(
        startJointNumber: number,
        endPosition: Point,
        controlPoints: Point[]
    ): boolean {
        const startJoint = this._jointManager.getJoint(startJointNumber);

        if (startJoint === null) {
            console.warn('startJoint not found');
            return false;
        }

        // NOTE: create the new joint and curve
        const curve = new BCurve([
            startJoint.position,
            ...controlPoints,
            endPosition,
        ]);

        const tangentAtEnd = PointCal.unitVector(curve.derivative(1));

        const newTrackJoint: TrackJointWithElevation = {
            position: endPosition,
            connections: new Map(),
            tangent: tangentAtEnd,
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>(),
            },
            elevation: ELEVATION.GROUND,
        };

        const newJointNumber = this._jointManager.createJoint(newTrackJoint);

        const newTrackSegmentNumber =
            this._trackCurveManager.createCurveWithJoints(
                curve,
                startJointNumber,
                newJointNumber,
                startJoint.elevation,
                newTrackJoint.elevation
            );

        // NOTE: insert connection to new joint's connections
        newTrackJoint.connections.set(startJointNumber, newTrackSegmentNumber);
        newTrackJoint.direction.reverseTangent.add(startJointNumber);

        // NOTE: insert connection to the start joint's connections
        startJoint.connections.set(newJointNumber, newTrackSegmentNumber);

        const tangentAtStartJoint = startJoint.tangent;
        const tangentAtStartJointFromCurve = curve.derivative(0);

        if (sameDirection(tangentAtStartJoint, tangentAtStartJointFromCurve)) {
            startJoint.direction.tangent.add(newJointNumber);
        } else {
            console.log('different start tangent at branching');
            console.log('tangent at start joint', tangentAtStartJoint);
            console.log('tangent from curve', tangentAtStartJointFromCurve);
            startJoint.direction.reverseTangent.add(newJointNumber);
        }

        return true;
    }

    createNewEmptyJoint(
        position: Point,
        tangent: Point,
        elevation: ELEVATION = ELEVATION.GROUND
    ): number {
        const newJoint: TrackJointWithElevation = {
            position,
            connections: new Map(),
            tangent,
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>(),
            },
            elevation,
        };
        const newJointNumber = this._jointManager.createJoint(newJoint);
        return newJointNumber;
    }

    createNewTrackSegment(
        startJointPosition: Point,
        endJointPosition: Point,
        controlPoints: Point[]
    ): boolean {
        const curve = new BCurve([
            startJointPosition,
            ...controlPoints,
            endJointPosition,
        ]);

        const tangentAtStart = PointCal.unitVector(curve.derivative(0));
        const tangentAtEnd = PointCal.unitVector(curve.derivative(1));

        const startJoint: TrackJointWithElevation = {
            position: startJointPosition,
            connections: new Map(),
            tangent: tangentAtStart,
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>(),
            },
            elevation: ELEVATION.GROUND,
        };

        const endJoint: TrackJointWithElevation = {
            position: endJointPosition,
            connections: new Map(),
            tangent: tangentAtEnd,
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>(),
            },
            elevation: ELEVATION.GROUND,
        };

        const startJointNumber = this._jointManager.createJoint(startJoint);
        const endJointNumber = this._jointManager.createJoint(endJoint);
        const newTrackSegmentNumber =
            this._trackCurveManager.createCurveWithJoints(
                curve,
                startJointNumber,
                endJointNumber,
                startJoint.elevation,
                endJoint.elevation
            );

        startJoint.connections.set(endJointNumber, newTrackSegmentNumber);
        endJoint.connections.set(startJointNumber, newTrackSegmentNumber);

        startJoint.direction.tangent.add(endJointNumber);
        endJoint.direction.reverseTangent.add(startJointNumber);

        return true;
    }

    getTangentAtJoint(jointNumber: number): Point | null {
        const joint = this._jointManager.getJoint(jointNumber);
        if (joint === null) {
            console.warn('Joint does not exist');
            return null;
        }
        return joint.tangent;
    }

    getDeadEndJointSoleConnection(jointNumber: number): TrackSegment | null {
        if (!this.jointIsEndingTrack(jointNumber)) {
            console.warn('joint is not an ending track');
            return null;
        }
        const joint = this._jointManager.getJoint(jointNumber);
        if (joint === null) {
            console.warn('joint not found');
            return null;
        }
        const segmentNumber: number | undefined = joint.connections
            .values()
            .next().value;

        if (segmentNumber === undefined) {
            return null;
        }

        const segment =
            this._trackCurveManager.getTrackSegmentWithJoints(segmentNumber);
        if (segment == undefined) {
            return null;
        }
        return segment;
    }

    getTheOtherEndOfEndingTrack(jointNumber: number): number | null {
        if (!this.jointIsEndingTrack(jointNumber)) {
            console.warn('joint is not an ending track');
            return null;
        }
        const joint = this._jointManager.getJoint(jointNumber);
        if (joint === null) {
            console.warn('joint not found');
            return null;
        }
        const firstConnection: number | undefined = joint.connections
            .keys()
            .next().value;
        if (firstConnection === undefined) {
            return null;
        }
        return firstConnection;
    }

    jointIsEndingTrack(jointNumber: number): boolean {
        const joint = this._jointManager.getJoint(jointNumber);
        if (joint === null) {
            console.warn('joint not found');
            return false;
        }
        const tangentCount = joint.direction.tangent.size;
        const reverseTangentCount = joint.direction.reverseTangent.size;
        if (
            tangentCount + reverseTangentCount === 1 &&
            joint.connections.size === 1
        ) {
            return true;
        }
        return false;
    }

    extendTrackFromJoint(
        startJointNumber: number,
        endPosition: Point,
        controlPoints: Point[]
    ): boolean {
        const startJoint = this._jointManager.getJoint(startJointNumber);

        if (startJoint === null) {
            console.warn('startJoint not found');
            return false;
        }

        const emptyTangentDirection = this.tangentIsPointingInEmptyDirection(
            startJointNumber
        )
            ? startJoint.tangent
            : PointCal.multiplyVectorByScalar(startJoint.tangent, -1);

        const start2EndDirection = PointCal.unitVectorFromA2B(
            startJoint.position,
            endPosition
        );

        const rawAngleDiff = PointCal.angleFromA2B(
            emptyTangentDirection,
            start2EndDirection
        );
        const angleDiff = normalizeAngleZero2TwoPI(rawAngleDiff);

        if (angleDiff > Math.PI / 2 && angleDiff < (3 * Math.PI) / 2) {
            console.warn('invalid direction in extendTrackFromJoint');
            return false;
        }

        const newCurve = new BCurve([
            startJoint.position,
            ...controlPoints,
            endPosition,
        ]);

        // pointing from the start joint to the new joint
        const tangentAtStart = PointCal.unitVector(newCurve.derivative(0));
        const tangentAtEnd = PointCal.unitVector(newCurve.derivative(1));

        const newTrackJoint: TrackJointWithElevation = {
            position: endPosition,
            connections: new Map(),
            tangent: tangentAtEnd,
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>(),
            },
            elevation: ELEVATION.GROUND,
        };

        newTrackJoint.direction.reverseTangent.add(startJointNumber);

        const newJointNumber = this._jointManager.createJoint(newTrackJoint);
        const newTrackSegmentNumber =
            this._trackCurveManager.createCurveWithJoints(
                newCurve,
                startJointNumber,
                newJointNumber,
                startJoint.elevation,
                newTrackJoint.elevation
            );

        newTrackJoint.connections.set(startJointNumber, newTrackSegmentNumber);

        startJoint.connections.set(newJointNumber, newTrackSegmentNumber);
        if (sameDirection(startJoint.tangent, tangentAtStart)) {
            startJoint.direction.tangent.add(newJointNumber);
        } else {
            startJoint.direction.reverseTangent.add(newJointNumber);
        }

        return true;
    }

    connectJoints(
        startJointNumber: number,
        endJointNumber: number,
        controlPoints: Point[]
    ): boolean {
        console.log('connectJoints', startJointNumber, endJointNumber);
        const startJoint = this._jointManager.getJoint(startJointNumber);
        const endJoint = this._jointManager.getJoint(endJointNumber);

        if (startJoint === null || endJoint === null) {
            console.warn('startJoint or endJoint not found');
            return false;
        }

        if (startJoint.connections.has(endJointNumber)) {
            console.warn(
                `joint #${startJointNumber} already has connection to joint #${endJointNumber}`
            );
            return false;
        }

        const newCurve = new BCurve([
            startJoint.position,
            ...controlPoints,
            endJoint.position,
        ]);

        const startTangent = PointCal.unitVector(newCurve.derivative(0));
        const endTangent = PointCal.unitVector(newCurve.derivative(1));

        const startJointTangentDirection = startJoint.tangent;
        const endJointTangentDirection = endJoint.tangent;

        const excludeSegementSet = new Set([
            ...startJoint.direction.reverseTangent,
            ...startJoint.direction.tangent,
            ...endJoint.direction.reverseTangent,
            ...endJoint.direction.tangent,
        ]);

        const newTrackSegmentNumber =
            this._trackCurveManager.createCurveWithJoints(
                newCurve,
                startJointNumber,
                endJointNumber,
                startJoint.elevation,
                endJoint.elevation,
                1.067,
                excludeSegementSet
            );

        startJoint.connections.set(endJointNumber, newTrackSegmentNumber);
        endJoint.connections.set(startJointNumber, newTrackSegmentNumber);

        if (
            directionAlignedToTangent(startJointTangentDirection, startTangent)
        ) {
            startJoint.direction.tangent.add(endJointNumber);
        } else {
            startJoint.direction.reverseTangent.add(endJointNumber);
        }

        if (directionAlignedToTangent(endJointTangentDirection, endTangent)) {
            endJoint.direction.reverseTangent.add(startJointNumber);
        } else {
            endJoint.direction.tangent.add(startJointNumber);
        }
        this._drawDataDirty = true;
        return true;
    }

    getJointPosition(jointNumber: number): Point | null {
        const joint = this._jointManager.getJoint(jointNumber);
        if (joint === null) {
            return null;
        }
        return joint.position;
    }

    getCurvatureAtJoint(jointNumber: number): number | null {
        const joint = this._jointManager.getJoint(jointNumber);
        if (joint === null) {
            return null;
        }
        const firstSegment: number | undefined = joint.connections
            .values()
            .next().value;
        if (firstSegment === undefined) {
            return null;
        }
        const segment =
            this._trackCurveManager.getTrackSegmentWithJoints(firstSegment);
        if (segment === null) {
            return null;
        }
        let tVal = 0;
        if (segment.t1Joint === jointNumber) {
            tVal = 1;
        }
        return segment.curve.curvature(tVal);
    }

    tangentIsPointingInEmptyDirection(jointNumber: number): boolean {
        const joint = this._jointManager.getJoint(jointNumber);
        if (joint === null) {
            console.warn('joint not found');
            return false;
        }
        return joint.direction.tangent.size === 0;
    }

    /**
     * Get the projection of a point on the tracks; joint has precedence over curve
     * @param point
     * @returns
     */
    project(point: Point): ProjectionResult {
        const jointRes = this.pointOnJoint(point);
        const curveRes = this.projectPointOnTrack(point);
        const edgeRes = this.onTrackSegmentEdge(point);

        if (jointRes !== null) {
            return { hit: true, ...jointRes };
        }
        if (curveRes !== null) {
            // console.log("curve hit", curveRes);
            return { hit: true, hitType: 'curve', ...curveRes };
        }
        if (edgeRes !== null) {
            // console.log("edge hit", edgeRes);
            return { hit: true, hitType: 'edge', ...edgeRes };
        }
        console.log('no hit');
        return { hit: false };
    }

    projectPointOnTrack(position: Point): ProjectionInfo | null {
        return this._trackCurveManager.projectOnCurve(position);
    }

    onTrackSegmentEdge(position: Point): ProjectionInfo | null {
        return this._trackCurveManager.onTrackSegmentEdge(position);
    }

    pointOnJoint(position: Point): ProjectionJointResult | null {
        let closestJoint: {
            jointNumber: number;
            distance: number;
            tangent: Point;
            position: Point;
            curvature: number;
            endingJoint: boolean;
        } | null = null;
        let minDistance: number = 1;

        const joints = this._jointManager.getJoints();

        for (const { jointNumber, joint } of joints) {
            const distance = PointCal.distanceBetweenPoints(
                position,
                joint.position
            );
            if (distance < minDistance) {
                minDistance = distance;
                const curveNumber: number | undefined = joint.connections
                    .values()
                    .next().value;
                if (curveNumber === undefined) {
                    continue;
                }
                const curve =
                    this._trackCurveManager.getTrackSegmentWithJoints(
                        curveNumber
                    );
                if (curve === null) {
                    continue;
                }
                if (curve === null) {
                    continue;
                }
                const tVal = curve.t0Joint === jointNumber ? 0 : 1;
                const curvature = curve.curve.curvature(tVal);
                const endingJoint = this.jointIsEndingTrack(jointNumber);
                closestJoint = {
                    jointNumber: jointNumber,
                    distance: distance,
                    tangent: joint.tangent,
                    position: joint.position,
                    curvature: curvature,
                    endingJoint: endingJoint,
                };
            }
        }
        if (closestJoint !== null) {
            return {
                hitType: 'joint',
                jointNumber: closestJoint.jointNumber,
                tangent: closestJoint.tangent,
                projectionPoint: closestJoint.position,
                curvature: closestJoint.curvature,
                endingJoint: closestJoint.endingJoint,
            };
        }
        return null;
    }

    getTrackSegmentCurve(curveNumber: number): BCurve | null {
        return (
            this._trackCurveManager.getTrackSegmentWithJoints(curveNumber)
                ?.curve ?? null
        );
    }

    getTrackSegmentWithJoints(curveNumber: number): TrackSegment | null {
        return this._trackCurveManager.getTrackSegmentWithJoints(curveNumber);
    }

    get trackSegments(): { t0Joint: number; t1Joint: number; curve: BCurve }[] {
        return this._trackCurveManager.getTrackSegmentsWithJoints();
    }

    /**
     * Get track segments sorted by elevation for proper drawing order.
     * SUB_3 elevation segments are drawn first, highest elevation segments are drawn last.
     * For segments with different start/end elevations, uses the minimum elevation for sorting.
     * @returns Track segments sorted by elevation (ascending order)
     */
    getSortedTrackSegments(): TrackSegmentWithCollision[] {
        const segments = this._trackCurveManager.getTrackSegmentsWithJoints();

        // Sort by minimum elevation of the segment (start or end, whichever is lower)
        return segments.sort((a, b) => {
            const minElevationA = Math.min(a.elevation.from, a.elevation.to);
            const minElevationB = Math.min(b.elevation.from, b.elevation.to);

            return minElevationA - minElevationB;
        });
    }

    /**
     * Get track segments sorted by elevation for proper drawing order.
     * SUB_3 elevation segments are drawn first, highest elevation segments are drawn last.
     * For segments with different start/end elevations, uses the maximum elevation for sorting.
     * @returns Track segments sorted by elevation (ascending order)
     */
    getSortedTrackSegmentsByMaxElevation(): TrackSegmentWithElevation[] {
        const segments = this._trackCurveManager.getTrackSegmentsWithJoints();

        // Sort by maximum elevation of the segment (start or end, whichever is higher)
        return segments.sort((a, b) => {
            const maxElevationA = Math.max(a.elevation.from, a.elevation.to);
            const maxElevationB = Math.max(b.elevation.from, b.elevation.to);

            return maxElevationA - maxElevationB;
        });
    }

    /**
     * Get track segments sorted by elevation for proper drawing order.
     * SUB_3 elevation segments are drawn first, highest elevation segments are drawn last.
     * For segments with different start/end elevations, uses the average elevation for sorting.
     * @returns Track segments sorted by elevation (ascending order)
     */
    getSortedTrackSegmentsByAverageElevation(): TrackSegmentWithElevation[] {
        const segments = this._trackCurveManager.getTrackSegmentsWithJoints();

        // Sort by average elevation of the segment
        return segments.sort((a, b) => {
            const avgElevationA = (a.elevation.from + a.elevation.to) / 2;
            const avgElevationB = (b.elevation.from + b.elevation.to) / 2;

            return avgElevationA - avgElevationB;
        });
    }

    getDrawData(viewportAABB: {
        min: Point;
        max: Point;
    }): TrackSegmentDrawData[] {
        const segments = this._trackCurveManager.experimental();
        if (!this._drawDataDirty) {
            const res = this._drawData.filter(segment => {
                const aabb = segment.curve.AABB;
                return AABBIntersects(viewportAABB, aabb);
            });
            this._trackCurveManager.clearInternalDrawDataOrderMap();
            res.forEach((segment, index) => {
                segment.callback(index);
            });
            return res;
        }
        console.time('sort');
        this._drawData = segments.sort((a, b) => {
            if (!trackIsSloped(a) && !trackIsSloped(b)) {
                return a.elevation.from - b.elevation.from;
            }

            const overlaps = elevationIntervalOverlaps(a, b);
            const aMax = Math.max(a.elevation.from, a.elevation.to);
            const bMax = Math.max(b.elevation.from, b.elevation.to);
            if (!overlaps) {
                return aMax - bMax;
            }
            if (
                a.excludeSegmentsForCollisionCheck.has(
                    b.originalTrackSegment.trackSegmentNumber
                ) ||
                b.excludeSegmentsForCollisionCheck.has(
                    a.originalTrackSegment.trackSegmentNumber
                )
            ) {
                return 0;
            }
            const broad = AABBIntersects(a.curve.AABB, b.curve.AABB);
            if (!broad) {
                return aMax - bMax;
            }
            const collision = a.curve.getCurveIntersections(b.curve);
            if (collision.length === 0) {
                return aMax - bMax;
            }
            if (collision.length !== 1) {
                console.warn(
                    'something wrong in the sorting of track segments draw order'
                );
                // return 0;
            }
            const aElevation = getElevationAtT(collision[0].selfT, {
                elevation: {
                    from: a.elevation.from * LEVEL_HEIGHT,
                    to: a.elevation.to * LEVEL_HEIGHT,
                },
            });
            const bElevation = getElevationAtT(collision[0].otherT, {
                elevation: {
                    from: b.elevation.from * LEVEL_HEIGHT,
                    to: b.elevation.to * LEVEL_HEIGHT,
                },
            });
            return aElevation - bElevation;
        });
        console.timeEnd('sort');
        this._drawDataDirty = false;
        const res = this._drawData.filter(segment => {
            const aabb = segment.curve.AABB;
            return AABBIntersects(viewportAABB, aabb);
        });
        res.forEach((segment, index) => {
            segment.callback(index);
        });
        return res;
    }

    getTrackDrawDataOrder(
        trackSegmentNumber: number,
        tVal: number
    ): number | null {
        const trackSegment =
            this._trackCurveManager.getTrackSegmentWithJoints(
                trackSegmentNumber
            );
        if (trackSegment === null) {
            console.warn('track segment not found in getTrackDrawDataOrder');
            return null;
        }

        const splits = trackSegment.splitCurves;

        const index = this._findTValIntervalIndex(splits, tVal);

        if (index === null) {
            console.warn('tVal is not in any of the tVal intervals');
            return null;
        }

        const interval = splits[index].tValInterval;

        const order = this._trackCurveManager.getTrackOrder(
            trackSegmentNumber,
            interval
        );

        if (order === null) {
            console.warn('track order not found in getTrackDrawDataOrder');
            return null;
        }

        return order;
    }

    private _findTValIntervalIndex(
        splits: { tValInterval: { start: number; end: number } }[],
        tVal: number
    ): number | null {
        let left = 0;
        let right = splits.length - 1;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const midStartTVal = splits[mid].tValInterval.start;
            const midEndTVal = splits[mid].tValInterval.end;
            if (tVal >= midStartTVal && tVal <= midEndTVal) {
                return mid;
            }
            if (tVal < midStartTVal) {
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }
        return null;
    }

    logJoints() {
        for (const { jointNumber, joint } of this._jointManager.getJoints()) {
            console.log('--------------------------------');
            console.log(
                `joint ${jointNumber} is ${this.jointIsEndingTrack(jointNumber) ? '' : 'not '}an ending joint`
            );
            console.log('joint position', joint.position);
            console.log('joint elevation', joint.elevation);
            if (joint.direction) {
                console.log('######');
                console.log('tangent count', joint.direction.tangent.size);
                console.log(
                    'reverse tangent count',
                    joint.direction.reverseTangent.size
                );
                console.log('connection count', joint.connections.size);
                console.log(
                    'tangent + reverse tangent count',
                    joint.direction.tangent.size +
                    joint.direction.reverseTangent.size
                );
                console.log('for tangent direction: ');
                joint.direction.tangent.forEach(destinationJointNumber => {
                    console.log(`can go to ${destinationJointNumber}`);
                });
                if (joint.direction.tangent.size === 0) {
                    console.log('can go nowhere');
                }
                console.log('for reverse tangent direction: ');
                joint.direction.reverseTangent.forEach(
                    destinationJointNumber => {
                        console.log(`can go to ${destinationJointNumber}`);
                    }
                );
                if (joint.direction.reverseTangent.size === 0) {
                    console.log('can go nowhere');
                }
            }
            for (const [
                jointNumber,
                trackSegment,
            ] of joint.connections.entries()) {
                const segment =
                    this._trackCurveManager.getTrackSegmentWithJoints(
                        trackSegment
                    );
                if (segment == undefined) {
                    continue;
                }
                console.log(
                    `has connection to ${jointNumber} with track segment ${segment.curve}`
                );
            }
        }
        console.log('full length', this.getFullLength());
    }

    logTrackSegments() {
        for (const [index, trackSegment] of this.trackSegments.entries()) {
            if (trackSegment.curve === null) {
                continue;
            }
            console.log(
                `track segment ${index} has t0Joint ${trackSegment.t0Joint} and t1Joint ${trackSegment.t1Joint} with curve ${trackSegment.curve}`
            );
        }
    }

    getFullLength(): number {
        let length = 0;
        for (const trackSegment of this.trackSegments) {
            length += trackSegment.curve.fullLength;
        }
        return length;
    }

    get experimentTrackOffsets(): { positive: Point[]; negative: Point[] }[] {
        return this._trackCurveManager.trackOffsets;
    }
}
