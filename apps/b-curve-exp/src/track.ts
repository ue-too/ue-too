import { BCurve, offset, offset2 } from "@ue-too/curve";
import { directionAlignedToTangent, normalizeAngleZero2TwoPI, Point, PointCal, sameDirection } from "@ue-too/math";
import { GenericEntityManager } from "./utils";
import { Rectangle, RTree } from "./r-tree";

const VERTICAL_CLEARANCE = 3;

const LEVEL_HEIGHT = 10;

export type TrackSegment = {
    t0Joint: number;
    t1Joint: number;
    curve: BCurve;
    gauge: number;
}

export type TrackJointWithElevation = TrackJoint & {
    elevation: ELEVATION; // this is the resulting elevation: result = base (terrain) + joint elevation
}

export enum ELEVATION {
    SUB_3 = -3,
    SUB_2,
    SUB_1,
    GROUND,
    ABOVE_1,
    ABOVE_2,
    ABOVE_3,
}

export type TrackSegmentWithElevation =  TrackSegment & {
    elevation: {
        from: ELEVATION; // this is the resulting elevation: result = base (terrain) + track elevation
        to: ELEVATION;
    };
}

export type TrackSegmentWithCollision = TrackSegmentWithElevation & {
    collision: {
        selfT: number;
        anotherCurve: {
            curve: BCurve;
            tVal: number;
        }
    }[];
}

export type TrackSegmentWithCollisionAndNumber = TrackSegmentWithCollision & {
    trackSegmentNumber: number;
}

export function getElevationAtT(t: number, trackSegment: TrackSegmentWithElevation, trackJointManager: TrackJointManager): number {

    const startJointNumber = trackSegment.t0Joint;
    const endJointNumber = trackSegment.t1Joint;

    const startJoint = trackJointManager.getJoint(startJointNumber);
    const endJoint = trackJointManager.getJoint(endJointNumber);

    if(startJoint === null || endJoint === null){
        return ELEVATION.GROUND;
    }

    const startElevationLevel = startJoint.elevation;
    const endElevationLevel = endJoint.elevation;

    const startElevation = startElevationLevel * LEVEL_HEIGHT;
    const endElevation = endElevationLevel * LEVEL_HEIGHT;

    const elevation = startElevation + (endElevation - startElevation) * t;
    
    return elevation;
}

export function trackIsSlopedByJoints(trackSegment: TrackSegmentWithElevation, trackJointManager: TrackJointManager): boolean {
    const startJointNumber = trackSegment.t0Joint;
    const endJointNumber = trackSegment.t1Joint;
    
    const startJoint = trackJointManager.getJoint(startJointNumber);
    const endJoint = trackJointManager.getJoint(endJointNumber);

    if(startJoint === null || endJoint === null){
        return false;
    }

    return startJoint.elevation !== endJoint.elevation;
}

export function trackIsSloped(trackSegment: TrackSegmentWithElevation): boolean {
    return trackSegment.elevation.from !== trackSegment.elevation.to;
}

export function intersectionSatisfiesVerticalClearance(intersectionTVal: number, trackSegment: TrackSegmentWithElevation, intersectionTVal2: number, trackSegment2: TrackSegmentWithElevation, trackJointManager: TrackJointManager): boolean {
    const elevation1 = getElevationAtT(intersectionTVal, trackSegment, trackJointManager);
    const elevation2 = getElevationAtT(intersectionTVal2, trackSegment2, trackJointManager);

    const diff = Math.abs(elevation1 - elevation2);

    return satisfiesVerticalClearance(diff);
}

export function satisfiesVerticalClearance(elevation: number): boolean {
    if(elevation >= VERTICAL_CLEARANCE){
        return true;
    }
    return false;
}

export type TrackJoint = {
    position: Point;
    connections: Map<number, number>; // maps joint number -> track segment number
    tangent: Point;
    direction: {
        tangent: Set<number>; // to the next joint number
        reverseTangent: Set<number>; // to the next joint number
    };
}

export type ProjectionInfo = {
    curve: number;
    t0Joint: number;
    t1Joint: number;
    atT: number;
    projectionPoint: Point;
    tangent: Point;
    curvature: number;
}

export type ProjectionResult = ProjectionFalseResult | ProjectionPositiveResult;

export type ProjectionFalseResult = {
    hit: false;
}

export type ProjectionPositiveResult = {
    hit: true;
} & (ProjectionJointResult | ProjectionCurveResult | ProjectionEdgeResult);


export type ProjectionEdgeResult = {
    hitType: "edge";
} & ProjectionInfo;

export type ProjectionJointResult = {
    hitType: "joint";
    jointNumber: number;
    projectionPoint: Point;
    tangent: Point;
    curvature: number;
}

export type ProjectionCurveResult = {
    hitType: "curve";
} & ProjectionInfo;

export type PointOnJointPositiveResult = {

}

export class TrackGraph {

    private _jointManager: TrackJointManager = new TrackJointManager(10);
    private _trackCurveManager: TrackCurveManager = new TrackCurveManager(10);

    getJoints(): {jointNumber: number, joint: TrackJoint}[] {
        return this._jointManager.getJoints();
    }

    getJoint(jointNumber: number): TrackJoint | null {
        return this._jointManager.getJoint(jointNumber);
    }

    insertJointIntoTrackSegmentUsingTrackNumber(trackSegmentNumber: number, atT: number): number | null {
        const segment = this._trackCurveManager.getTrackSegmentWithJoints(trackSegmentNumber);

        if(segment === null){
            console.warn("track segment number does not correspond to a track segment");
            return null;
        }

        const newControlPointGroups = segment.curve.split(atT);
        const t0JointNumber = segment.t0Joint;
        const t1JointNumber = segment.t1Joint;

        const t0Joint = this._jointManager.getJoint(t0JointNumber);
        const t1Joint = this._jointManager.getJoint(t1JointNumber);

        if(t0Joint === null || t1Joint === null){
            console.warn("t0Joint or t1Joint not found when inserting joint into track segment using track number");
            return null;
        }

        const newJointPosition = segment.curve.get(atT);


        /*  NOTE: insert the new joint*/
        const newJoint: TrackJointWithElevation = {
            position: newJointPosition,
            connections: new Map(),
            tangent: {x: 0, y: 0},
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>()
            },
            elevation: ELEVATION.GROUND
        };

        const newJointNumber = this._jointManager.createJoint(newJoint);

        const firstCurve = new BCurve(newControlPointGroups[0]);
        const secondCurve = new BCurve(newControlPointGroups[1]);

        const firstSegmentNumber = this._trackCurveManager.createCurveWithJoints(firstCurve, t0JointNumber, newJointNumber, t0Joint.elevation, newJoint.elevation);
        const secondSegmentNumber = this._trackCurveManager.createCurveWithJoints(secondCurve, newJointNumber, t1JointNumber, newJoint.elevation, t1Joint.elevation);

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

        if(directionAlignedToTangent(t0JointTangent, t0JointTangentFromCurve)){
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

        if(directionAlignedToTangent(t1JointTangent, t1JointTangentFromCurve)){
            t1Joint.direction.reverseTangent.delete(t0JointNumber);
            t1Joint.direction.reverseTangent.add(newJointNumber);
        } else {
            t1Joint.direction.tangent.delete(t0JointNumber);
            t1Joint.direction.tangent.add(newJointNumber);
        }

        this._trackCurveManager.destroyCurve(trackSegmentNumber);
        return newJointNumber;
    }

    insertJointIntoTrackSegment(startJointNumber: number, endJointNumber: number, atT: number){
        const startJoint = this._jointManager.getJoint(startJointNumber);
        const endJoint = this._jointManager.getJoint(endJointNumber);

        if(startJoint === null || endJoint === null){
            console.warn("startJoint or endJoint not found");
            return;
        }

        // get the id of the track segment from the start and end joint number
        const trackSegmentNumber = startJoint.connections.get(endJointNumber);

        if(trackSegmentNumber === undefined) { // || (trackSegment.t0Joint !== startJointNumber && trackSegment.t0Joint !== endJointNumber) || (trackSegment.t1Joint !== endJointNumber && trackSegment.t1Joint !== startJointNumber)){
            console.warn("trackSegment not found or not the correct track segment; something is wrong");
            return;
        }

        const segment = this._trackCurveManager.getTrackSegmentWithJoints(trackSegmentNumber);

        if(segment === null){
            console.warn("track segment number does not correspond to a track segment");
            return;
        }

        const newControlPointGroups = segment.curve.split(atT);
        const t0JointNumber = segment.t0Joint;
        const t1JointNumber = segment.t1Joint;
        let t0Joint = startJoint;
        let t1Joint = endJoint;

        if(t0JointNumber === endJointNumber) {
            t0Joint = endJoint;
            t1Joint = startJoint;
        }

        const newJointPosition = segment.curve.get(atT);

        /*  NOTE: insert the new joint*/
        const newJoint: TrackJointWithElevation = {
            position: newJointPosition,
            connections: new Map(),
            tangent: {x: 0, y: 0},
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>()
            },
            elevation: ELEVATION.GROUND
        };

        const newJointNumber = this._jointManager.createJoint(newJoint);

        const firstCurve = new BCurve(newControlPointGroups[0]);
        const secondCurve = new BCurve(newControlPointGroups[1]);

        const firstSegmentNumber = this._trackCurveManager.createCurveWithJoints(firstCurve, t0JointNumber, newJointNumber, t0Joint.elevation, newJoint.elevation);
        const secondSegmentNumber = this._trackCurveManager.createCurveWithJoints(secondCurve, newJointNumber, t1JointNumber, newJoint.elevation, t1Joint.elevation);

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

        if(sameDirection(t0JointTangent, t0JointTangentFromCurve)){
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

        if(sameDirection(t1JointTangent, t1JointTangentFromCurve)){
            t1Joint.direction.reverseTangent.delete(t0JointNumber);
            t1Joint.direction.reverseTangent.add(newJointNumber);
        } else {
            t1Joint.direction.tangent.delete(t0JointNumber);
            t1Joint.direction.tangent.add(newJointNumber);
        }

        this._trackCurveManager.destroyCurve(trackSegmentNumber);
    }

    get trackOffsets(): {positive: Point[], negative: Point[]}[] {
        return this._trackCurveManager.trackOffsets;
    }

    removeTrackSegment(trackSegmentNumber: number): void {
        const segment = this._trackCurveManager.getTrackSegmentWithJoints(trackSegmentNumber);

        console.log('segment', segment);
        if(segment === null){
            console.warn("segment not found");
            return;
        }

        const t0Joint = this._jointManager.getJoint(segment.t0Joint);
        const t1Joint = this._jointManager.getJoint(segment.t1Joint);

        if(t0Joint === null || t1Joint === null){
            console.warn("t0Joint or t1Joint not found");
            return;
        }

        if((t0Joint.direction.tangent.has(segment.t1Joint) && t0Joint.direction.tangent.size === 1 && t0Joint.direction.reverseTangent.size > 1) || (t0Joint.direction.reverseTangent.has(segment.t1Joint) && t0Joint.direction.reverseTangent.size === 1 && t0Joint.direction.tangent.size > 1)){
            console.warn("t1Joint is the sole connection of the t0Joint in the direction of t0Joint; cannot delete");
            return;
        }
        if((t1Joint.direction.tangent.has(segment.t0Joint) && t1Joint.direction.tangent.size === 1 && t1Joint.direction.reverseTangent.size > 1) || (t1Joint.direction.reverseTangent.has(segment.t0Joint) && t1Joint.direction.reverseTangent.size === 1 && t1Joint.direction.tangent.size > 1)){
            console.warn("t0Joint is the sole connection of the t1Joint in the direction of t1Joint; cannot delete");
            return;
        }

        this._trackCurveManager.destroyCurve(trackSegmentNumber);

        t0Joint.connections.delete(segment.t1Joint);
        t1Joint.connections.delete(segment.t0Joint);

        t0Joint.direction.tangent.delete(segment.t1Joint);
        t0Joint.direction.reverseTangent.delete(segment.t1Joint);
        t1Joint.direction.tangent.delete(segment.t0Joint);
        t1Joint.direction.reverseTangent.delete(segment.t0Joint);

        if(t0Joint.connections.size === 0){
            this._jointManager.destroyJoint(segment.t0Joint);
        }

        if(t1Joint.connections.size === 0){
            this._jointManager.destroyJoint(segment.t1Joint);
        }
    }

    branchToNewJoint(startJointNumber: number, endPosition: Point, controlPoints: Point[]): boolean{
        const startJoint = this._jointManager.getJoint(startJointNumber);

        if(startJoint === null){
            console.warn("startJoint not found");
            return false;
        }

        // NOTE: create the new joint and curve
        const curve = new BCurve([startJoint.position, ...controlPoints, endPosition]);

        const tangentAtEnd = PointCal.unitVector(curve.derivative(1));

        const newTrackJoint: TrackJointWithElevation = {
            position: endPosition,
            connections: new Map(),
            tangent: tangentAtEnd,
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>()
            },
            elevation: ELEVATION.GROUND
        };

        const newJointNumber = this._jointManager.createJoint(newTrackJoint);

        const newTrackSegmentNumber = this._trackCurveManager.createCurveWithJoints(curve, startJointNumber, newJointNumber, startJoint.elevation, newTrackJoint.elevation);


        // NOTE: insert connection to new joint's connections
        newTrackJoint.connections.set(startJointNumber, newTrackSegmentNumber);
        newTrackJoint.direction.reverseTangent.add(startJointNumber);

        // NOTE: insert connection to the start joint's connections
        startJoint.connections.set(newJointNumber, newTrackSegmentNumber);

        const tangentAtStartJoint = startJoint.tangent;
        const tangentAtStartJointFromCurve = curve.derivative(0);

        if(sameDirection(tangentAtStartJoint, tangentAtStartJointFromCurve)){
            startJoint.direction.tangent.add(newJointNumber);
        } else {
            console.log('different start tangent at branching');
            console.log('tangent at start joint', tangentAtStartJoint);
            console.log('tangent from curve', tangentAtStartJointFromCurve);
            startJoint.direction.reverseTangent.add(newJointNumber);
        }

        return true;
    }

    createNewEmptyJoint(position: Point, tangent: Point, elevation: ELEVATION = ELEVATION.GROUND): number {
        const newJoint: TrackJointWithElevation = {
            position,
            connections: new Map(),
            tangent,
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>()
            },
            elevation,
        }
        const newJointNumber = this._jointManager.createJoint(newJoint);
        return newJointNumber;
    }

    createNewTrackSegment(startJointPosition: Point, endJointPosition: Point, controlPoints: Point[]): boolean {
        const curve = new BCurve([startJointPosition, ...controlPoints, endJointPosition]);

        const tangentAtStart = PointCal.unitVector(curve.derivative(0));
        const tangentAtEnd = PointCal.unitVector(curve.derivative(1));

        const startJoint: TrackJointWithElevation = {
            position: startJointPosition,
            connections: new Map(),
            tangent: tangentAtStart,
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>()
            },
            elevation: ELEVATION.GROUND
        };

        const endJoint: TrackJointWithElevation = {
            position: endJointPosition,
            connections: new Map(),
            tangent: tangentAtEnd,
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>()
            },
            elevation: ELEVATION.GROUND
        };

        const startJointNumber = this._jointManager.createJoint(startJoint);
        const endJointNumber = this._jointManager.createJoint(endJoint);
        const newTrackSegmentNumber = this._trackCurveManager.createCurveWithJoints(curve, startJointNumber, endJointNumber, startJoint.elevation, endJoint.elevation);

        startJoint.connections.set(endJointNumber, newTrackSegmentNumber);
        endJoint.connections.set(startJointNumber, newTrackSegmentNumber);

        startJoint.direction.tangent.add(endJointNumber);
        endJoint.direction.reverseTangent.add(startJointNumber);

        return true;
    }

    getTangentAtJoint(jointNumber: number): Point | null {
        const joint = this._jointManager.getJoint(jointNumber);
        if(joint === null){
            console.warn("Joint does not exist");
            return null;
        }
        return joint.tangent;
    }

    getDeadEndJointSoleConnection(jointNumber: number): TrackSegment | null {
        if(!this.jointIsEndingTrack(jointNumber)){
            console.warn("joint is not an ending track");
            return null;
        }
        const joint = this._jointManager.getJoint(jointNumber);
        if(joint === null){
            console.warn("joint not found");
            return null;
        }
        const segmentNumber: number | undefined = joint.connections.values().next().value;

        if(segmentNumber === undefined){
            return null;
        }

        const segment = this._trackCurveManager.getTrackSegmentWithJoints(segmentNumber);
        if(segment == undefined){
            return null;
        }
        return segment;
    }

    getTheOtherEndOfEndingTrack(jointNumber: number): number | null {
        if(!this.jointIsEndingTrack(jointNumber)){
            console.warn("joint is not an ending track");
            return null;
        }
        const joint = this._jointManager.getJoint(jointNumber);
        if(joint === null){
            console.warn("joint not found");
            return null;
        }
        const firstConnection: number | undefined = joint.connections.keys().next().value;
        if(firstConnection === undefined){
            return null;
        }
        return firstConnection;
    }

    jointIsEndingTrack(jointNumber: number): boolean {
        const joint = this._jointManager.getJoint(jointNumber);
        if(joint === null){
            console.warn("joint not found");
            return false;
        }
        const tangentCount = joint.direction.tangent.size;
        const reverseTangentCount = joint.direction.reverseTangent.size;
        if(tangentCount + reverseTangentCount === 1 && joint.connections.size === 1){
            return true;
        }
        return false;
    }

    extendTrackFromJoint(startJointNumber: number, endPosition: Point, controlPoints: Point[]): boolean{

        const startJoint = this._jointManager.getJoint(startJointNumber);

        if(startJoint === null){
            console.warn("startJoint not found");
            return false;
        }

        const emptyTangentDirection = this.tangentIsPointingInEmptyDirection(startJointNumber) ? startJoint.tangent : PointCal.multiplyVectorByScalar(startJoint.tangent, -1);

        const start2EndDirection = PointCal.unitVectorFromA2B(startJoint.position, endPosition);

        const rawAngleDiff = PointCal.angleFromA2B(emptyTangentDirection, start2EndDirection);
        const angleDiff = normalizeAngleZero2TwoPI(rawAngleDiff);

        if(angleDiff > Math.PI / 2 && angleDiff < 3 * Math.PI / 2){
            console.warn("invalid direction in extendTrackFromJoint");
            return false;
        }

        const newCurve = new BCurve([startJoint.position, ...controlPoints, endPosition]);

        // pointing from the start joint to the new joint
        const tangentAtStart = PointCal.unitVector(newCurve.derivative(0));
        const tangentAtEnd = PointCal.unitVector(newCurve.derivative(1));

        const newTrackJoint: TrackJointWithElevation = {
            position: endPosition,
            connections: new Map(),
            tangent: tangentAtEnd,
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>()
            },
            elevation: ELEVATION.GROUND
        };

        newTrackJoint.direction.reverseTangent.add(startJointNumber);

        const newJointNumber = this._jointManager.createJoint(newTrackJoint);
        const newTrackSegmentNumber = this._trackCurveManager.createCurveWithJoints(newCurve, startJointNumber, newJointNumber, startJoint.elevation, newTrackJoint.elevation);

        newTrackJoint.connections.set(startJointNumber, newTrackSegmentNumber);

        startJoint.connections.set(newJointNumber, newTrackSegmentNumber);
        if(sameDirection(startJoint.tangent, tangentAtStart)){
            startJoint.direction.tangent.add(newJointNumber);
        } else {
            startJoint.direction.reverseTangent.add(newJointNumber);
        }

        return true;
    }

    connectJoints(startJointNumber: number, endJointNumber: number, controlPoints: Point[]): boolean {
        const startJoint = this._jointManager.getJoint(startJointNumber);
        const endJoint = this._jointManager.getJoint(endJointNumber);

        if(startJoint === null || endJoint === null){
            console.warn("startJoint or endJoint not found");
            return false;
        }

        if(startJoint.connections.has(endJointNumber)){
            console.warn(`joint #${startJointNumber} already has connection to joint #${endJointNumber}`);
            return false;
        }

        const newCurve = new BCurve([startJoint.position, ...controlPoints, endJoint.position]);

        const startTangent = PointCal.unitVector(newCurve.derivative(0));
        const endTangent = PointCal.unitVector(newCurve.derivative(1));

        const startJointTangentDirection = startJoint.tangent;
        const endJointTangentDirection = endJoint.tangent;

        const straightCurve = new BCurve([startJoint.position, ...controlPoints, endJoint.position]);
        const newTrackSegmentNumber = this._trackCurveManager.createCurveWithJoints(straightCurve, startJointNumber, endJointNumber, startJoint.elevation, endJoint.elevation);

        startJoint.connections.set(endJointNumber, newTrackSegmentNumber);
        endJoint.connections.set(startJointNumber, newTrackSegmentNumber);

        if(directionAlignedToTangent(startJointTangentDirection, startTangent)){
            startJoint.direction.tangent.add(endJointNumber);
        } else {
            startJoint.direction.reverseTangent.add(endJointNumber);
        }

        if(directionAlignedToTangent(endJointTangentDirection, endTangent)){
            endJoint.direction.reverseTangent.add(startJointNumber);
        } else {
            endJoint.direction.tangent.add(startJointNumber);
        }
        
        return true;
    }

    getJointPosition(jointNumber: number): Point | null {
        const joint = this._jointManager.getJoint(jointNumber);
        if(joint === null){
            return null;
        }
        return joint.position;
    }

    getCurvatureAtJoint(jointNumber: number): number | null {
        const joint = this._jointManager.getJoint(jointNumber);
        if(joint === null){
            return null;
        }
        const firstSegment: number | undefined = joint.connections.values().next().value;
        if(firstSegment === undefined){
            return null;
        }
        const segment = this._trackCurveManager.getTrackSegmentWithJoints(firstSegment);
        if(segment === null){
            return null;
        }
        let tVal = 0;
        if(segment.t1Joint === jointNumber){
            tVal = 1;
        }
        return segment.curve.curvature(tVal);
    }

    tangentIsPointingInEmptyDirection(jointNumber: number): boolean {
        const joint = this._jointManager.getJoint(jointNumber);
        if(joint === null){
            console.warn("joint not found");
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

        if(jointRes !== null){
            return {hit: true, hitType: "joint", jointNumber: jointRes.jointNumber, projectionPoint: jointRes.position, tangent: jointRes.tangent, curvature: jointRes.curvature};
        }
        if(curveRes !== null){
            console.log("curve hit", curveRes);
            return {hit: true, hitType: "curve", ...curveRes};
        }
        if(edgeRes !== null){
            console.log("edge hit", edgeRes);
            return {hit: true, hitType: "edge", ...edgeRes};
        }
        return {hit: false};
    }

    projectPointOnTrack(position: Point): ProjectionInfo | null {
        return this._trackCurveManager.projectOnCurve(position);
    }

    onTrackSegmentEdge(position: Point): ProjectionInfo | null {
        return this._trackCurveManager.onTrackSegmentEdge(position);
    }

    pointOnJoint(position: Point): {jointNumber: number, tangent: Point, position: Point, curvature: number} | null {
        let closestJoint: {jointNumber: number, distance: number, tangent: Point, position: Point, curvature: number} | null = null;
        let minDistance:number = 5;

        const joints = this._jointManager.getJoints();

        for(const {jointNumber, joint} of joints){
            const distance = PointCal.distanceBetweenPoints(position, joint.position);
            if(distance < minDistance){
                minDistance = distance;
                const curveNumber: number | undefined = joint.connections.values().next().value;
                if(curveNumber === undefined){
                    continue;
                }
                const curve = this._trackCurveManager.getTrackSegmentWithJoints(curveNumber);
                if(curve === null){
                    continue;
                }
                if(curve === null){
                    continue;
                }
                const tVal = curve.t0Joint === jointNumber ? 0 : 1;
                const curvature = curve.curve.curvature(tVal);
                closestJoint = {jointNumber: jointNumber, distance: distance, tangent: joint.tangent, position: joint.position, curvature: curvature};
            }
        }
        if(closestJoint !== null){
            return {jointNumber: closestJoint.jointNumber, tangent: closestJoint.tangent, position: closestJoint.position, curvature: closestJoint.curvature};
        }
        return null;
    }

    getTrackSegmentCurve(curveNumber: number): BCurve | null {
        return this._trackCurveManager.getTrackSegmentWithJoints(curveNumber)?.curve ?? null;
    }

    getTrackSegmentWithJoints(curveNumber: number): TrackSegment | null {
        return this._trackCurveManager.getTrackSegmentWithJoints(curveNumber);
    }

    get trackSegments(): {t0Joint: number, t1Joint: number, curve: BCurve}[] {
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

    logJoints(){
        for(const {jointNumber, joint} of this._jointManager.getJoints()){
            console.log('--------------------------------');
            console.log(`joint ${jointNumber} is ${this.jointIsEndingTrack(jointNumber) ? "" : "not "}an ending joint`);
            console.log('joint position', joint.position);
            console.log('joint elevation', joint.elevation);
            if(joint.direction){
                console.log('######')
                console.log('tangent count', joint.direction.tangent.size);
                console.log('reverse tangent count', joint.direction.reverseTangent.size);
                console.log('connection count', joint.connections.size);
                console.log('tangent + reverse tangent count', joint.direction.tangent.size + joint.direction.reverseTangent.size);
                console.log('for tangent direction: ');
                joint.direction.tangent.forEach((destinationJointNumber)=>{
                    console.log(`can go to ${destinationJointNumber}`);
                });
                if(joint.direction.tangent.size === 0){
                    console.log('can go nowhere');
                }
                console.log('for reverse tangent direction: ');
                joint.direction.reverseTangent.forEach((destinationJointNumber)=>{
                    console.log(`can go to ${destinationJointNumber}`);
                });
                if(joint.direction.reverseTangent.size === 0){
                    console.log('can go nowhere');
                }
            }
            for(const [jointNumber, trackSegment] of joint.connections.entries()){
                const segment = this._trackCurveManager.getTrackSegmentWithJoints(trackSegment);
                if(segment == undefined){
                    continue;
                }
                console.log(`has connection to ${jointNumber} with track segment ${segment.curve}`);
            }
        }
        console.log('full length', this.getFullLength());
    }
    
    logTrackSegments(){
        for(const [index, trackSegment] of this.trackSegments.entries()){
            if(trackSegment.curve === null){
                continue;
            }
            console.log(`track segment ${index} has t0Joint ${trackSegment.t0Joint} and t1Joint ${trackSegment.t1Joint} with curve ${trackSegment.curve}`);
        }
    }
    
    getFullLength(): number {
        let length = 0;
        for(const trackSegment of this.trackSegments){
            length += trackSegment.curve.fullLength;
        }
        return length;
    }

    get experimentTrackOffsets(): {positive: Point[], negative: Point[]}[] {
        return this._trackCurveManager.trackOffsets;
    }
}

export class TrackJointManager {
    private _internalTrackJointManager: GenericEntityManager<TrackJointWithElevation>;

    constructor(initialCount = 10){
        this._internalTrackJointManager = new GenericEntityManager<TrackJointWithElevation>(initialCount);
    }

    createJoint(joint: TrackJointWithElevation): number {
        return this._internalTrackJointManager.createEntity(joint);
    }

    getJoints(): {jointNumber: number, joint: TrackJointWithElevation}[] {
        return this._internalTrackJointManager.getLivingEntitiesWithIndex().map(({index, entity}) => ({jointNumber: index, joint: entity}));
    }

    getJoint(jointNumber: number): TrackJointWithElevation | null {
        return this._internalTrackJointManager.getEntity(jointNumber);
    }

    destroyJoint(jointNumber: number): void {
        this._internalTrackJointManager.destroyEntity(jointNumber);
    }
}

export type TrackSegmentRTreeEntry = {
    segmentNumber: number;
    elevation: {
        from: ELEVATION;
        to: ELEVATION;
    };
    t0Joint: number;
    t1Joint: number;
}

export class TrackCurveManager {

    private _internalTrackCurveManager: GenericEntityManager<{
        segment: TrackSegmentWithCollision;
        offsets: {
            positive: Point[];
            negative: Point[];
        };
    }>;

    private _internalRTree: RTree<TrackSegmentWithCollisionAndNumber> = new RTree<TrackSegmentWithCollisionAndNumber>();

    constructor(initialCount: number) {
        this._internalTrackCurveManager = new GenericEntityManager<{
            segment: TrackSegmentWithCollision;
            offsets: {
                positive: Point[];
                negative: Point[];
            };
        }>(initialCount);
    }

    getTrackSegment(segmentNumber: number): BCurve | null {
        return this._internalTrackCurveManager.getEntity(segmentNumber)?.segment.curve ?? null;
    }

    getTrackSegmentsWithJoints(): TrackSegmentWithCollision[] {
        return this._internalTrackCurveManager.getLivingEntities().map((trackSegment) => trackSegment.segment)
    }

    getTrackSegmentWithJoints(segmentNumber: number): TrackSegmentWithCollision | null {
        return this._internalTrackCurveManager.getEntity(segmentNumber)?.segment ?? null;
    }

    onTrackSegmentEdge(position: Point): ProjectionInfo | null {
        let minDistance = 30;
        let projectionInfo: ProjectionInfo | null = null;
        const bbox = new Rectangle(position.x - 10, position.y - 10, position.x + 10, position.y + 10);
        const possibleTrackSegments = this._internalRTree.search(bbox);
        possibleTrackSegments.forEach((trackSegment)=>{

            const res = trackSegment.curve.getProjection(position);
            if(res != null){
                const distance = PointCal.distanceBetweenPoints(position, res.projection);
                if(distance < minDistance && distance > trackSegment.gauge / 2){
                    minDistance = distance;
                    const tangent = PointCal.unitVector(trackSegment.curve.derivative(res.tVal));
                    const curvature = trackSegment.curve.curvature(res.tVal);
                    const direction = PointCal.unitVectorFromA2B(res.projection, position);
                    const angle = PointCal.angleFromA2B(tangent, direction);
                    let orthogonalDirection = PointCal.unitVector({x: -tangent.y, y: tangent.x});
                    if(angle < 0) {
                        orthogonalDirection = PointCal.multiplyVectorByScalar(orthogonalDirection, -1);
                    }
                    const projectedPosition = PointCal.addVector(res.projection, PointCal.multiplyVectorByScalar(orthogonalDirection, trackSegment.gauge));
                    if(projectionInfo === null){
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

    projectOnCurve(position: Point, maxDistance: number = 10): ProjectionInfo | null {
        let minDistance = maxDistance;
        let projectionInfo: ProjectionInfo | null = null;
        const bbox = new Rectangle(position.x - 0.1, position.y - 0.1, position.x + 0.1, position.y + 0.1);
        const possibleTrackSegments = this._internalRTree.search(bbox);
        possibleTrackSegments.forEach((trackSegment)=>{

            const res = trackSegment.curve.getProjection(position);
            if(res != null){
                const distance = PointCal.distanceBetweenPoints(position, res.projection);
                const tangent = trackSegment.curve.derivative(res.tVal);
                const curvature = trackSegment.curve.curvature(res.tVal);
                if(distance < minDistance){
                    minDistance = distance;
                    if(projectionInfo === null){
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

    createCurveWithJoints(curve: BCurve, t0Joint: number, t1Joint: number, t0Elevation: ELEVATION, t1Elevation: ELEVATION, gauge: number = 10): number {
        const experimentPositiveOffsets = offset2(curve, gauge / 2);
        const experimentNegativeOffsets = offset2(curve, -gauge / 2);
        const aabb = curve.AABB;
        const aabbRectangle = new Rectangle(aabb.min.x, aabb.min.y, aabb.max.x, aabb.max.y);
        const possibleCollisions = this._internalRTree.search(aabbRectangle);

        const collisions: {selfT: number, anotherCurve: {curve: BCurve, tVal: number}}[] = [];

        possibleCollisions.forEach((segment)=>{
            console.log(`collision found with segment ${segment.curve}`);
            console.log('start finding intersections');
            console.log('possible collisions', segment.curve);
            const intersections = segment.curve.getCurveIntersections(curve).map((intersection)=>{
                console.log(`collision found at t value = ${intersection.otherT}`);
                return {selfT: intersection.otherT, anotherCurve: {curve: segment.curve, tVal: intersection.selfT}};
            });

            collisions.push(...intersections);

            if(intersections.length > 10){
                console.log('--------------------------------');
                console.log("weird");
                console.log('curve 1 control points', JSON.stringify(curve.getControlPoints(), null, 2));
                console.log('curve 2 control points', JSON.stringify(segment.curve.getControlPoints(), null, 2));
                console.log('intersection t values on curve 1', JSON.stringify(intersections.map((intersection)=>intersection.selfT), null, 2));
                console.log('intersection t values on curve 2', JSON.stringify(intersections.map((intersection)=>intersection.anotherCurve.tVal), null, 2));
            }

            console.log('end finding intersections');
        });

        const trackSegmentEntry: TrackSegmentWithCollision = 
            {
                curve: curve,
                t0Joint: t0Joint,
                t1Joint: t1Joint,
                elevation: {
                    from: t0Elevation,
                    to: t1Elevation
                },
                collision: collisions,
                gauge
            };
        
        const curveNumber = this._internalTrackCurveManager.createEntity({
            segment: trackSegmentEntry,
            offsets: {
                positive: experimentPositiveOffsets,
                negative: experimentNegativeOffsets
            }
        });

        const trackSegmentTreeEntry: TrackSegmentWithCollisionAndNumber = {
            ...trackSegmentEntry,
            trackSegmentNumber: curveNumber,
        }

        this._internalRTree.insert(aabbRectangle, trackSegmentTreeEntry);
        return curveNumber;
    }

    destroyCurve(curveNumber: number): void {
        const trackSegment = this._internalTrackCurveManager.getEntity(curveNumber);
        if(trackSegment === null){
            console.warn("track segment not found");
            return;
        }
        const rectangle = new Rectangle(trackSegment.segment.curve.AABB.min.x, trackSegment.segment.curve.AABB.min.y, trackSegment.segment.curve.AABB.max.x, trackSegment.segment.curve.AABB.max.y);
        const trackSegmentTreeEntry = this._internalRTree.search(rectangle).find((segment)=>segment.trackSegmentNumber === curveNumber);
        if(trackSegmentTreeEntry == null){
            console.warn("track segment tree entry not found");
            return;
        }
        this._internalRTree.remove(rectangle, trackSegmentTreeEntry);
        this._internalTrackCurveManager.destroyEntity(curveNumber);
    }

    get livingEntities(): number[] {
        return this._internalTrackCurveManager.getLivingEntitesIndex();
    }

    get trackOffsets(): {positive: Point[], negative: Point[]}[] {
        return this._internalTrackCurveManager.getLivingEntities().map((entity) => entity.offsets);
    }
}
