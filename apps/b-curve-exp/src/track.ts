import { BCurve } from "@ue-too/curve";
import { Point, PointCal } from "@ue-too/math";

export type TrackSegment = {
    t0Joint: number;
    t1Joint: number;
    curve: BCurve;
}

export type Connection = {
    out: Map<number, TrackSegment>;
}

export type TrackJoint = {
    position: Point;
    from: Map<number | "end", Connection>;
}

export class TrackGraph {

    private joints: Map<number, TrackJoint> = new Map();
    private jointPositions: Point[] = [];
    private jointNumberManager: NumberManager = new NumberManager(10);
    private trackSegmentNumberManager: NumberManager = new NumberManager(10);
    private _trackSegments: TrackSegment[] = [];

    addJoint(joint: TrackJoint) {
        this.joints.set(this.joints.size, joint);
    }

    addJointPosition(position: Point) {
        this.jointPositions.push(position);
    }

    branchToNewJoint(comingFromJoint: number, startJointNumber: number, endPosition: Point, controlPoints: Point[]){
        const startJoint = this.joints.get(startJointNumber);

        if(startJoint === undefined){
            console.warn("startJoint not found");
            return;
        }

        const curve = new BCurve([startJoint.position, ...controlPoints, endPosition]);

        const endJointNumber = this.jointNumberManager.createEntity();

        const newTrackSegment: TrackSegment = {
            t0Joint: startJointNumber,
            t1Joint: endJointNumber,
            curve: curve
        };

        const endTrackJoint: TrackJoint = {
            position: endPosition,
            from: new Map()
        };

        let comingFromConnections: Connection | undefined;

        comingFromConnections = startJoint.from.get(comingFromJoint);

        if(comingFromConnections === undefined){
            console.info("comingFromConnections not found, creating new connection");
            comingFromConnections = {
                out: new Map<number, TrackSegment>()
            };
        }

        comingFromConnections.out.set(endJointNumber, newTrackSegment);

        const end2StartConnection: Connection = {
            out: new Map([[startJointNumber, newTrackSegment]])
        };

        endTrackJoint.from.set("end", end2StartConnection);

        this.joints.set(endJointNumber, endTrackJoint);
    }

    createNewTrackSegment(startJointPosition: Point, endJointPosition: Point, controlPoints: Point[]){
        const curve = new BCurve([startJointPosition, ...controlPoints, endJointPosition]);
        const startJointNumber = this.jointNumberManager.createEntity();
        const endJointNumber = this.jointNumberManager.createEntity();

        const newTrackSegment: TrackSegment = {
            t0Joint: startJointNumber,
            t1Joint: endJointNumber,
            curve: curve
        };

        const newTrackSegmentNumber = this.trackSegmentNumberManager.createEntity();
        this._trackSegments.push(newTrackSegment);

        const startJoint: TrackJoint = {
            position: startJointPosition,
            from: new Map()
        };

        const endJoint: TrackJoint = {
            position: endJointPosition,
            from: new Map()
        };

        const start2EndConnection: Connection = {
            out: new Map([[endJointNumber, newTrackSegment]])
        };

        const end2StartConnection: Connection = {
            out: new Map([[startJointNumber, newTrackSegment]])
        };

        startJoint.from.set("end", start2EndConnection);
        endJoint.from.set("end", end2StartConnection);

        this.joints.set(startJointNumber, startJoint);
        this.joints.set(endJointNumber, endJoint);
    }

    jointIsEndingTrack(jointNumber: number): boolean {
        const joint = this.joints.get(jointNumber);
        if(joint === undefined){
            console.warn("joint not found");
            return false;
        }
        return joint.from.has("end");
    }

    extendTrackFromJoint(comingFromJoint: number, startJointNumber: number, endPosition: Point, controlPoints: Point[]){

        const startJoint = this.joints.get(startJointNumber);
        const comingJoint = this.joints.get(comingFromJoint);

        if(startJoint === undefined || comingJoint === undefined){
            console.warn("startJoint or comingJoint not found");
            return;
        }

        const newCurve = new BCurve([startJoint.position, ...controlPoints, endPosition]);
        const newTrackJoint: TrackJoint = {
            position: endPosition,
            from: new Map(),
        };

        const newJointNumber = this.jointNumberManager.createEntity();

        const newTrackSegment: TrackSegment = {
            t0Joint: startJointNumber,
            t1Joint: newJointNumber,
            curve: newCurve
        };

        const newConnection: Connection = {
            out: new Map([[startJointNumber, newTrackSegment]])
        };

        newTrackJoint.from.set("end", newConnection);

        this.joints.set(newJointNumber, newTrackJoint);

        let comingFromConnections = startJoint.from.get(comingFromJoint);

        if(comingFromConnections === undefined){
            console.info("comingFromConnections not found, creating new connection");
            comingFromConnections = {
                out: new Map<number, TrackSegment>()
            };
            startJoint.from.set(comingFromJoint, comingFromConnections);
        }

        comingFromConnections.out.set(newJointNumber, newTrackSegment);

        if(this.jointIsEndingTrack(comingFromJoint)){
            startJoint.from.delete("end");
        }
    }

    getJointPosition(jointNumber: number): Point | null {
        if(jointNumber < 0 || jointNumber >= this.jointPositions.length){
            return null;
        }
        return this.jointPositions[jointNumber];
    }

    pointOnJoint(position: Point): {jointNumber: number} | null {
        const distances = this.jointPositions.map((jointPosition) => PointCal.distanceBetweenPoints(position, jointPosition));
        const minDistance = Math.min(...distances);
        const jointNumber = distances.indexOf(minDistance);
        if(minDistance < 10){
            return {jointNumber: jointNumber};
        }
        return null;
    }

    get trackSegments(): TrackSegment[] {
        return this._trackSegments;
    }
}

export class NumberManager {

    private _availableEntities: number[] = [];
    private _maxEntities: number;
    private _livingEntityCount = 0;

    constructor(initialCount: number) {
        this._maxEntities = initialCount;
        for (let i = 0; i < this._maxEntities; i++) {
            this._availableEntities.push(i);
        }
    }

    createEntity(): number {
        if(this._livingEntityCount >= this._maxEntities) {
            // throw new Error('Max entities reached');
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
        return entity;
    }

    destroyEntity(entity: number): void {
        if(entity >= this._maxEntities || entity < 0) {
            throw new Error('Invalid entity out of range');
        }
        this._availableEntities.push(entity);
        this._livingEntityCount--;
    }
}
