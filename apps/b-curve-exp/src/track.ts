import { BCurve } from "@ue-too/curve";
import { Point, PointCal, sameDirection } from "@ue-too/math";
import { NumberManager } from "./utils";

export type TrackSegment = {
    t0Joint: number;
    t1Joint: number;
    curve: BCurve;
}

export type TrackJoint = {
    position: Point;
    connections: Map<number, number>; // maps joint number -> track segment number
    tangent: Point;
    direction: {
        tangent: Set<number>;
        reverseTangent: Set<number>;
    };
}

export type ProjectionInfo = {
    curve: number;
    t0Joint: number;
    t1Joint: number;
    atT: number;
    projectionPoint: Point;
    tangent: Point;
}

export type ProjectionResult = ProjectionFalseResult | ProjectionPositiveResult;

export type ProjectionFalseResult = {
    hit: false;
}

export type ProjectionPositiveResult = {
    hit: true;
} & (ProjectionJointResult | ProjectionCurveResult);


export type ProjectionJointResult = {
    hitType: "joint";
    jointNumber: number;
    position: Point;
    tangent: Point;
}

export type ProjectionCurveResult = {
    hitType: "curve";
} & ProjectionInfo;



export class TrackGraph {

    private joints: Map<number, TrackJoint> = new Map();
    private jointNumberManager: NumberManager = new NumberManager(10);
    private _trackCurveManager: TrackCurveManager = new TrackCurveManager(10);

    getJoints(): {jointNumber: number, joint: TrackJoint}[] {
        const res: {jointNumber: number, joint: TrackJoint}[] = [];
        this.joints.forEach((joint, jointNumber)=>{
            res.push({
                jointNumber,
                joint: {...joint}
            })
        });
        return res;
    }

    getJoint(jointNumber: number): TrackJoint | null {
        return this.joints.get(jointNumber) ?? null;
    }

    insertJointIntoTrackSegment(startJointNumber: number, endJointNumber: number, atT: number){
        const startJoint = this.joints.get(startJointNumber);
        const endJoint = this.joints.get(endJointNumber);

        if(startJoint === undefined || endJoint === undefined){
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
        const newJointNumber = this.jointNumberManager.createEntity();
        const t0JointNumber = segment.t0Joint;
        const t1JointNumber = segment.t1Joint;
        let t0Joint = startJoint;
        let t1Joint = endJoint;
        if(t0JointNumber === endJointNumber) {
            t0Joint = endJoint;
            t1Joint = startJoint;
        }
        const newJointPosition = segment.curve.get(atT);

        const firstCurve = new BCurve(newControlPointGroups[0]);
        const secondCurve = new BCurve(newControlPointGroups[1]);

        const firstSegmentNumber = this._trackCurveManager.createCurveWithJoints(firstCurve, t0JointNumber, newJointNumber);
        const secondSegmentNumber = this._trackCurveManager.createCurveWithJoints(secondCurve, newJointNumber, t1JointNumber);

        const tangentAtNewJoint = PointCal.unitVector(firstCurve.derivative(1));

        /*  NOTE: insert the new joint*/
        const newJoint: TrackJoint = {
            position: newJointPosition,
            connections: new Map(),
            tangent: tangentAtNewJoint,
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>()
            }
        };

        newJoint.direction.reverseTangent.add(t0JointNumber);
        newJoint.direction.tangent.add(t1JointNumber);

        newJoint.connections.set(t0JointNumber, firstSegmentNumber);
        newJoint.connections.set(t1JointNumber, secondSegmentNumber);

        this.joints.set(newJointNumber, newJoint);

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

    branchToNewJoint(startJointNumber: number, endPosition: Point, controlPoints: Point[], tangentDirection: Point){
        const startJoint = this.joints.get(startJointNumber);

        if(startJoint === undefined){
            console.warn("startJoint not found");
            return;
        }

        // NOTE: create the new joint and curve
        const curve = new BCurve([startJoint.position, ...controlPoints, endPosition]);
        const newJointNumber = this.jointNumberManager.createEntity();
        const newTrackSegmentNumber = this._trackCurveManager.createCurveWithJoints(curve, startJointNumber, newJointNumber);

        const tangentAtEnd = PointCal.unitVector(curve.derivative(1));

        const newTrackJoint: TrackJoint = {
            position: endPosition,
            connections: new Map(),
            tangent: tangentAtEnd,
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>()
            }
        };

        // NOTE: insert connection to new joint's connections
        newTrackJoint.connections.set(startJointNumber, newTrackSegmentNumber);
        newTrackJoint.direction.reverseTangent.add(startJointNumber);

        
        // NOTE: insert the new joint
        this.joints.set(newJointNumber, newTrackJoint);

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
    }

    createNewTrackSegment(startJointPosition: Point, endJointPosition: Point, controlPoints: Point[]){
        const curve = new BCurve([startJointPosition, ...controlPoints, endJointPosition]);
        const startJointNumber = this.jointNumberManager.createEntity();
        const endJointNumber = this.jointNumberManager.createEntity();
        const newTrackSegmentNumber = this._trackCurveManager.createCurveWithJoints(curve, startJointNumber, endJointNumber);

        const tangentAtStart = PointCal.unitVector(curve.derivative(0));
        const tangentAtEnd = PointCal.unitVector(curve.derivative(1));

        const startJoint: TrackJoint = {
            position: startJointPosition,
            connections: new Map(),
            tangent: tangentAtStart,
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>()
            }
        };

        const endJoint: TrackJoint = {
            position: endJointPosition,
            connections: new Map(),
            tangent: tangentAtEnd,
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>()
            }
        };

        startJoint.connections.set(endJointNumber, newTrackSegmentNumber);
        endJoint.connections.set(startJointNumber, newTrackSegmentNumber);

        startJoint.direction.tangent.add(endJointNumber);
        endJoint.direction.reverseTangent.add(startJointNumber);

        this.joints.set(startJointNumber, startJoint);
        this.joints.set(endJointNumber, endJoint);
    }

    getTangentAtJoint(jointNumber: number): Point | null {
        const joint = this.joints.get(jointNumber);
        if(joint === undefined){
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
        const joint = this.joints.get(jointNumber);
        if(joint === undefined){
            console.warn("joint not found");
            return null;
        }
        const segmentNumber: number = joint.connections.values().next().value;
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
        const joint = this.joints.get(jointNumber);
        if(joint === undefined){
            console.warn("joint not found");
            return null;
        }
        const firstConnection: number = joint.connections.keys().next().value;
        return firstConnection;
    }

    jointIsEndingTrack(jointNumber: number): boolean {
        const joint = this.joints.get(jointNumber);
        if(joint === undefined){
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

    extendTrackFromJoint(comingFromJoint: number, startJointNumber: number, endPosition: Point, controlPoints: Point[]){

        const startJoint = this.joints.get(startJointNumber);
        const comingJoint = this.joints.get(comingFromJoint);

        if(startJoint === undefined || comingJoint === undefined){
            console.warn("startJoint or comingJoint not found");
            return;
        }

        const newCurve = new BCurve([startJoint.position, ...controlPoints, endPosition]);

        // pointing from the start joint to the new joint
        const tangentAtStart = PointCal.unitVector(newCurve.derivative(0));
        const tangentAtEnd = PointCal.unitVector(newCurve.derivative(1));

        const newTrackJoint: TrackJoint = {
            position: endPosition,
            connections: new Map(),
            tangent: tangentAtEnd,
            direction: {
                tangent: new Set<number>(),
                reverseTangent: new Set<number>()
            }
        };

        newTrackJoint.direction.reverseTangent.add(startJointNumber);

        const newJointNumber = this.jointNumberManager.createEntity();
        const newTrackSegmentNumber = this._trackCurveManager.createCurveWithJoints(newCurve, startJointNumber, newJointNumber);

        newTrackJoint.connections.set(startJointNumber, newTrackSegmentNumber);

        this.joints.set(newJointNumber, newTrackJoint);

        startJoint.connections.set(newJointNumber, newTrackSegmentNumber);
        if(sameDirection(startJoint.tangent, tangentAtStart)){
            startJoint.direction.tangent.add(newJointNumber);
        } else {
            startJoint.direction.reverseTangent.add(newJointNumber);
        }
    }

    getJointPosition(jointNumber: number): Point | null {
        const joint = this.joints.get(jointNumber);
        if(joint === undefined){
            return null;
        }
        return joint.position;
    }

    getCurvatureAtJoint(jointNumber: number): number | null {
        const joint = this.joints.get(jointNumber);
        if(joint === undefined){
            return null;
        }
        const firstSegment: number = joint.connections.values().next().value;
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

    pointOnJoint(position: Point): {jointNumber: number, tangent: Point} | null {
        let closestJoint: {jointNumber: number, distance: number, tangent: Point} | null = null;
        let minDistance:number = 10;

        for(const [jointNumber, joint] of this.joints.entries()){
            const distance = PointCal.distanceBetweenPoints(position, joint.position);
            if(distance < minDistance){
                minDistance = distance;
                closestJoint = {jointNumber: jointNumber, distance: distance, tangent: joint.tangent};
            }
        }
        if(closestJoint !== null){
            return {jointNumber: closestJoint.jointNumber, tangent: closestJoint.tangent};
        }
        return null;
    }

    project(point: Point): ProjectionResult {
        const jointRes = this.pointOnJoint(point);
        const curveRes = this.projectPointOnTrack(point);
        if(jointRes !== null){
            return {hit: true, hitType: "joint", jointNumber: jointRes.jointNumber, position: this.getJointPosition(jointRes.jointNumber), tangent: jointRes.tangent};
        }
        if(curveRes !== null){
            return {hit: true, hitType: "curve", ...curveRes};
        }
        return {hit: false};
    }

    projectPointOnTrack(position: Point): ProjectionInfo | null {
        let minDistance = 10;
        let projectionInfo: ProjectionInfo | null = null;
        this._trackCurveManager.livingEntities.forEach((entity)=>{
            const trackSegment = this._trackCurveManager.getTrackSegmentWithJoints(entity);
            if(trackSegment === null){
                return;
            }
            const res = trackSegment.curve.getProjection(position);
            if(res != null){
                const distance = PointCal.distanceBetweenPoints(position, res.projection);
                if(distance < minDistance){
                    minDistance = distance;
                    if(projectionInfo === null){
                        projectionInfo = {
                            curve: entity,
                            atT: res.tVal,
                            projectionPoint: res.projection,
                            t0Joint: trackSegment.t0Joint,
                            t1Joint: trackSegment.t1Joint,
                            tangent: trackSegment.curve.derivative(res.tVal)
                        };
                        return;
                    }
                    projectionInfo.atT = res.tVal;
                    projectionInfo.projectionPoint = res.projection;
                    projectionInfo.curve = entity;
                    projectionInfo.t0Joint = trackSegment.t0Joint;
                    projectionInfo.t1Joint = trackSegment.t1Joint;
                }
            }
        });
        return projectionInfo;
    }

    getTrackSegmentCurve(curveNumber: number): BCurve | null {
        return this._trackCurveManager.getTrackSegmentWithJoints(curveNumber).curve;
    }

    getTrackSegmentWithJoints(curveNumber: number): TrackSegment | null {
        return this._trackCurveManager.getTrackSegmentWithJoints(curveNumber);
    }

    get trackSegments(): {t0Joint: number, t1Joint: number, curve: BCurve}[] {
        return this._trackCurveManager.getTrackSegmentsWithJoints();
    }

    logJoints(){
        for(const [jointNumber, joint] of this.joints.entries()){
            console.log('--------------------------------');
            console.log(`joint ${jointNumber} is ${this.jointIsEndingTrack(jointNumber) ? "" : "not "}an ending joint`);
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
    }
    
    logTrackSegments(){
        for(const [index, trackSegment] of this.trackSegments.entries()){
            if(trackSegment.curve === null){
                continue;
            }
            console.log(`track segment ${index} has t0Joint ${trackSegment.t0Joint} and t1Joint ${trackSegment.t1Joint} with curve ${trackSegment.curve}`);
        }
    }
}


export class TrackCurveManager {

    private _availableEntities: number[] = [];
    private _livingEntities: Set<number> = new Set();
    private _maxEntities: number;
    private _livingEntityCount = 0;
    private _trackSegmentsWithJoints: (TrackSegment | null)[] = [];

    constructor(initialCount: number) {
        this._maxEntities = initialCount;
        for (let i = 0; i < this._maxEntities; i++) {
            this._availableEntities.push(i);
            this._trackSegmentsWithJoints.push(null);
        }
    }

    getTrackSegment(entity: number): BCurve | null {
        if(entity < 0 || entity >= this._trackSegmentsWithJoints.length){
            return null;
        }
        return this._trackSegmentsWithJoints[entity].curve;
    }

    getTrackSegmentsWithJoints(): {curve: BCurve, t0Joint: number, t1Joint: number}[] {
        return this._trackSegmentsWithJoints.filter((trackSegment) => trackSegment !== null);
    }

    getTrackSegmentWithJoints(entity: number): {curve: BCurve, t0Joint: number, t1Joint: number} | null {
        if(entity < 0 || entity >= this._trackSegmentsWithJoints.length){
            console.log("not exist");
            return null;
        }
        return this._trackSegmentsWithJoints[entity];
    }

    createCurveWithJoints(curve: BCurve, t0Joint: number, t1Joint: number): number {
        const entity = this.createCurve(curve);
        this._trackSegmentsWithJoints[entity] = {curve: curve, t0Joint: t0Joint, t1Joint: t1Joint};
        return entity;
    }

    createCurve(curve: BCurve): number {
        if(this._livingEntityCount >= this._maxEntities) {
            console.info("Max entities reached, increasing max entities");
            const currentMaxEntities = this._maxEntities;
            this._maxEntities += currentMaxEntities;
            for (let i = currentMaxEntities; i < this._maxEntities; i++) {
                this._availableEntities.push(i);
            }
        }
        const entity = this._availableEntities.shift();
        if(entity === undefined) {
            throw new Error('No available entities');
        }
        this._livingEntityCount++;
        this._livingEntities.add(entity);
        return entity;
    }

    destroyCurve(curveNumber: number): void {
        if(curveNumber >= this._maxEntities || curveNumber < 0) {
            throw new Error('Invalid entity out of range');
        }
        this._livingEntities.delete(curveNumber);
        this._availableEntities.push(curveNumber);
        this._livingEntityCount--;
        this._trackSegmentsWithJoints[curveNumber] = null;
    }

    get livingEntities(): number[] {
        return Array.from(this._livingEntities);
    }
}
