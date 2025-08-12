import { BCurve } from "@ue-too/curve";
import { Point, PointCal } from "@ue-too/math";

export type TrackSegment = {
    t0Joint: number;
    t1Joint: number;
    curve: number;
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
    private _trackCurveManager: TrackCurveManager = new TrackCurveManager(10);

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
        const curveNumber = this._trackCurveManager.createEntity(curve);
        const endJointNumber = this.jointNumberManager.createEntity();

        const newTrackSegment: TrackSegment = {
            t0Joint: startJointNumber,
            t1Joint: endJointNumber,
            curve: curveNumber
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
        const curveNumber = this._trackCurveManager.createEntity(curve);
        const startJointNumber = this.jointNumberManager.createEntity();
        const endJointNumber = this.jointNumberManager.createEntity();

        const newTrackSegment: TrackSegment = {
            t0Joint: startJointNumber,
            t1Joint: endJointNumber,
            curve: curveNumber
        };

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

    getJointConnections(jointNumber: number, comingFromJoint: number | "end"): Connection | null {
        const joint = this.joints.get(jointNumber);
        if(joint === undefined){
            console.warn("joint not found");
            return null;
        }
        return joint.from.get(comingFromJoint);
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
        if(joint.from.get("end")?.out.size !== 1){
            console.warn("joint has more than one outgoing connection; something is wrong");
            return null;
        }
        const outJoint = joint.from.get("end")?.out.keys().next().value;
        return outJoint;
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
        const newCurveNumber = this._trackCurveManager.createEntity(newCurve);
        const newTrackJoint: TrackJoint = {
            position: endPosition,
            from: new Map(),
        };

        const newJointNumber = this.jointNumberManager.createEntity();

        const newTrackSegment: TrackSegment = {
            t0Joint: startJointNumber,
            t1Joint: newJointNumber,
            curve: newCurveNumber
        };

        const newConnection: Connection = {
            out: new Map([[startJointNumber, newTrackSegment]])
        };

        newTrackJoint.from.set("end", newConnection);

        this.joints.set(newJointNumber, newTrackJoint);

        console.log('comingFromJoint', comingFromJoint);
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
            const otherEndOfEndingTrack = this.getTheOtherEndOfEndingTrack(comingFromJoint);
            if(otherEndOfEndingTrack != null && this.getJointConnections(startJointNumber, "end") != null){
                const otherEndOfEndingTrackConnection = this.getJointConnections(startJointNumber, "end");
                startJoint.from.set(newJointNumber, otherEndOfEndingTrackConnection);
            }
            startJoint.from.delete("end");
        }
    }

    getJointPosition(jointNumber: number): Point | null {
        const joint = this.joints.get(jointNumber);
        if(joint === undefined){
            return null;
        }
        return joint.position;
    }

    pointOnJoint(position: Point): {jointNumber: number} | null {
        let closestJoint: {jointNumber: number, distance: number} | null = null;
        let minDistance:number = 10;

        for(const [jointNumber, joint] of this.joints.entries()){
            const distance = PointCal.distanceBetweenPoints(position, joint.position);
            if(distance < minDistance){
                minDistance = distance;
                closestJoint = {jointNumber: jointNumber, distance: distance};
            }
        }
        if(closestJoint !== null){
            return {jointNumber: closestJoint.jointNumber};
        }
        return null;
    }

    projectPointOnTrack(position: Point): Point | null {
        let minDistance = 10;
        let minProjection: Point | null = null;
        this._trackCurveManager.livingEntities.forEach((entity)=>{
            const res = this._trackCurveManager.getTrackSegment(entity)?.getProjection(position);
            if(res != null){
                const distance = PointCal.distanceBetweenPoints(position, res.projection);
                if(distance < minDistance){
                    minDistance = distance;
                    minProjection = res.projection;
                }
            }
        });
        return minProjection;
    }

    get trackSegments(): {t0Joint: number, t1Joint: number, curve: BCurve}[] {
        return this._trackCurveManager.livingEntities.map((entity) => {
            return {
                t0Joint: this.joints.get(entity)?.from.get("end")?.out.get(entity)?.t0Joint,
                t1Joint: this.joints.get(entity)?.from.get("end")?.out.get(entity)?.t1Joint,
                curve: this._trackCurveManager.getTrackSegment(entity)
            }
        });
    }

    logJoints(){
        for(const [jointNumber, joint] of this.joints.entries()){
            console.log('--------------------------------');
            console.log(`joint ${jointNumber}`);
            for(const [jointNumber, connection] of joint.from.entries()){
                console.log(`coming from ${jointNumber}`);
                for(const [jointNumber, trackSegment] of connection.out.entries()){
                    console.log(`can go to ${jointNumber}`);
                }
            }
        }
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

export class TrackCurveManager {

    private _availableEntities: number[] = [];
    private _livingEntities: Set<number> = new Set();
    private _maxEntities: number;
    private _livingEntityCount = 0;
    private _trackSegments: (BCurve | null)[] = [];

    constructor(initialCount: number) {
        this._maxEntities = initialCount;
        for (let i = 0; i < this._maxEntities; i++) {
            this._availableEntities.push(i);
            this._trackSegments.push(null);
        }
    }

    getTrackSegment(entity: number): BCurve | null {
        if(entity < 0 || entity >= this._trackSegments.length){
            return null;
        }
        return this._trackSegments[entity];
    }

    createEntity(curve: BCurve): number {
        if(this._livingEntityCount >= this._maxEntities) {
            // throw new Error('Max entities reached');
            console.info("Max entities reached, increasing max entities");
            const currentMaxEntities = this._maxEntities;
            this._maxEntities += currentMaxEntities;
            for (let i = currentMaxEntities; i < this._maxEntities; i++) {
                this._availableEntities.push(i);
                this._trackSegments.push(null);
            }
        }
        const entity = this._availableEntities.shift();
        if(entity === undefined) {
            throw new Error('No available entities');
        }
        this._trackSegments[entity] = curve;
        this._livingEntityCount++;
        this._livingEntities.add(entity);
        return entity;
    }

    destroyEntity(entity: number): void {
        if(entity >= this._maxEntities || entity < 0) {
            throw new Error('Invalid entity out of range');
        }
        this._livingEntities.delete(entity);
        this._availableEntities.push(entity);
        this._livingEntityCount--;
        this._trackSegments[entity] = null;
    }

    get livingEntities(): number[] {
        return Array.from(this._livingEntities);
    }
}
