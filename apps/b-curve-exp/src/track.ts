import { BCurve } from "@ue-too/curve";
import { Point, PointCal, sameDirection } from "@ue-too/math";

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
    connections: Map<number, TrackSegment>;
}

export type ProjectionInfo = {
    curve: number;
    t0Joint: number;
    t1Joint: number;
    atT: number;
    projectionPoint: Point;
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

    getJoints(): TrackJoint[] {
        return Array.from(this.joints.values());
    }

    insertJointIntoTrackSegment(startJointNumber: number, endJointNumber: number, atT: number){
        const startJoint = this.joints.get(startJointNumber);
        const endJoint = this.joints.get(endJointNumber);

        if(startJoint === undefined || endJoint === undefined){
            console.warn("startJoint or endJoint not found");
            return;
        }

        const trackSegment = startJoint.connections.get(endJointNumber);

        if(trackSegment === undefined || (trackSegment.t0Joint !== startJointNumber && trackSegment.t0Joint !== endJointNumber) || (trackSegment.t1Joint !== endJointNumber && trackSegment.t1Joint !== startJointNumber)){
            console.warn("trackSegment not found or not the correct track segment; something is wrong");
            return;
        }
        
        const curve = this._trackCurveManager.getTrackSegment(trackSegment.curve);

        if(curve === null){
            console.warn("curve of track segmentnot found");
            return;
        }
        
        const newControlPointGroups = curve.split(atT);
        const newJointNumber = this.jointNumberManager.createEntity();
        const t0JointNumber = trackSegment.t0Joint;
        const t1JointNumber = trackSegment.t1Joint;
        let t0Joint = startJoint;
        let t1Joint = endJoint;
        if(t0JointNumber === endJointNumber) {
            t0Joint = endJoint;
            t1Joint = startJoint;
        }
        const newJointPosition = curve.get(atT);

        const firstCurve = new BCurve(newControlPointGroups[0]);
        const secondCurve = new BCurve(newControlPointGroups[1]);

        const firstCurveNumber = this._trackCurveManager.createCurveWithJoints(firstCurve, t0JointNumber, newJointNumber);
        const secondCurveNumber = this._trackCurveManager.createCurveWithJoints(secondCurve, newJointNumber, t1JointNumber);

        const firstTrackSegment: TrackSegment = {
            t0Joint: t0JointNumber,
            t1Joint: newJointNumber,
            curve: firstCurveNumber
        };

        const secondTrackSegment: TrackSegment = {
            t0Joint: newJointNumber,
            t1Joint: t1JointNumber,
            curve: secondCurveNumber
        };

        /*  NOTE: insert the new joint*/
        const newJoint: TrackJoint = {
            position: newJointPosition,
            from: new Map(),
            connections: new Map()
        };

        newJoint.from.set(t0JointNumber, {
            out: new Map([[t1JointNumber, secondTrackSegment]])
        });

        newJoint.from.set(t1JointNumber, {
            out: new Map([[t0JointNumber, firstTrackSegment]])
        });

        newJoint.connections.set(t0JointNumber, firstTrackSegment);
        newJoint.connections.set(t1JointNumber, secondTrackSegment);

        this.joints.set(newJointNumber, newJoint);

        /* NOTE: update the t0 joint */

        // NOTE: add the new connection and remove the old connection to the t1Joint
        t0Joint.connections.set(newJointNumber, firstTrackSegment);
        t0Joint.connections.delete(t1JointNumber);
        
        // NOTE: update every destination joint that is the t1Joint
        t0Joint.from.forEach((connection)=>{
            if(connection.out.has(t1JointNumber)){
                connection.out.set(newJointNumber, firstTrackSegment);
                connection.out.delete(t1JointNumber);
            }
        });

        // NOTE: update the incoming from t1Joint
        if(t0Joint.from.has(t1JointNumber)){
            const t0JointFromt1Joint = t0Joint.from.get(t1JointNumber);
            t0Joint.from.set(newJointNumber, t0JointFromt1Joint);
            t0Joint.from.delete(t1JointNumber);
        }


        /* NOTE: update the t1 joint */

        // NOTE: add the new connection and remove the old connection to the t0Joint
        t1Joint.connections.set(newJointNumber, secondTrackSegment);
        t1Joint.connections.delete(t0JointNumber);

        // NOTE: udpate every destination joint that is the t0Joint
        t1Joint.from.forEach((connection, originJointNumber)=>{
            if(connection.out.has(t0JointNumber)){
                connection.out.set(newJointNumber, secondTrackSegment);
                connection.out.delete(t0JointNumber);
            }
        });

        // NOTE: update the incoming from t0Joint
        if(t1Joint.from.has(t0JointNumber)){
            const t1JointFromt0Joint = t1Joint.from.get(t0JointNumber);
            t1Joint.from.set(newJointNumber, t1JointFromt0Joint);
            t1Joint.from.delete(t0JointNumber);
        }

        this._trackCurveManager.destroyEntity(trackSegment.curve);
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
        const curveNumber = this._trackCurveManager.createCurveWithJoints(curve, startJointNumber, newJointNumber);

        const newTrackSegment: TrackSegment = {
            t0Joint: startJointNumber,
            t1Joint: newJointNumber,
            curve: curveNumber
        };

        const newTrackJoint: TrackJoint = {
            position: endPosition,
            from: new Map(),
            connections: new Map()
        };

        // NOTE: insert connection to new joint's connections
        newTrackJoint.connections.set(startJointNumber, newTrackSegment);

        // NOTE: 
        newTrackJoint.from.set("end", {
            out: new Map([[startJointNumber, newTrackSegment]])
        });
        
        // NOTE: insert the new joint
        this.joints.set(newJointNumber, newTrackJoint);

        const destinationJointsToConnect: number[] = [];
        const comingFromNewJointCanGoToJoint: {destinationJointNumber: number, trackSegment: TrackSegment}[] = [];

        const comingFromNewJointCanGoToConnection: Connection = {
            out: new Map<number, TrackSegment>()
        };

        startJoint.connections.forEach((trackSegment, destinationJointNumber)=>{
            const curve = this.getTrackSegmentCurve(trackSegment.curve);
            if(curve == null){
                console.warn("curve not found");
                return;
            }
            let tangentEnteringStartJoint = PointCal.multiplyVectorByScalar(PointCal.unitVector(curve.derivative(0)), -1);
            if(startJointNumber === trackSegment.t1Joint){
                tangentEnteringStartJoint = PointCal.unitVector(curve.derivative(1));
            }
            const needConnection = sameDirection(tangentDirection, tangentEnteringStartJoint);
            if(needConnection){
                destinationJointsToConnect.push(destinationJointNumber);
                comingFromNewJointCanGoToJoint.push({
                    destinationJointNumber: destinationJointNumber,
                    trackSegment: trackSegment
                });
            }
        });

        destinationJointsToConnect.forEach((destination)=>{
            const fromDestinationEnteringStartJoint = startJoint.from.get(destination);
            if(fromDestinationEnteringStartJoint == undefined){
                console.warn('destination to add connection is not in the startJoint\'s from map something is not right');
                return;
            }
            fromDestinationEnteringStartJoint.out.set(newJointNumber, newTrackSegment);
        });

        comingFromNewJointCanGoToJoint.forEach((destination)=>{
            comingFromNewJointCanGoToConnection.out.set(destination.destinationJointNumber, {...destination.trackSegment});
        });

        startJoint.from.set(newJointNumber, comingFromNewJointCanGoToConnection);

        // NOTE: insert connection to the start joint's connections
        startJoint.connections.set(newJointNumber, newTrackSegment);

    }

    createNewTrackSegment(startJointPosition: Point, endJointPosition: Point, controlPoints: Point[]){
        const curve = new BCurve([startJointPosition, ...controlPoints, endJointPosition]);
        const startJointNumber = this.jointNumberManager.createEntity();
        const endJointNumber = this.jointNumberManager.createEntity();
        const curveNumber = this._trackCurveManager.createCurveWithJoints(curve, startJointNumber, endJointNumber);

        const newTrackSegment: TrackSegment = {
            t0Joint: startJointNumber,
            t1Joint: endJointNumber,
            curve: curveNumber
        };

        const startJoint: TrackJoint = {
            position: startJointPosition,
            from: new Map(),
            connections: new Map()
        };

        const endJoint: TrackJoint = {
            position: endJointPosition,
            from: new Map(),
            connections: new Map()
        };

        const start2EndConnection: Connection = {
            out: new Map([[endJointNumber, newTrackSegment]])
        };

        const end2StartConnection: Connection = {
            out: new Map([[startJointNumber, newTrackSegment]])
        };

        startJoint.from.set("end", start2EndConnection);
        endJoint.from.set("end", end2StartConnection);
        startJoint.connections.set(endJointNumber, newTrackSegment);
        endJoint.connections.set(startJointNumber, newTrackSegment);

        this.joints.set(startJointNumber, startJoint);
        this.joints.set(endJointNumber, endJoint);
    }

    getTangentAtJoint(jointNumber: number): Point | null {
        const joint = this.joints.get(jointNumber);
        if(joint === undefined){
            return null;
        }
        const firstConnection: TrackSegment = joint.connections.values().next().value;
        console.log("firstConnection", firstConnection.t0Joint, firstConnection.t1Joint);
        const curve = this._trackCurveManager.getTrackSegment(firstConnection.curve);
        if(curve === null){
            return null;
        }
        console.log("curve", curve);
        if(firstConnection.t1Joint === jointNumber){
            return curve.derivative(1);
        }
        return curve.derivative(0);
    }

    getJointConnections(jointNumber: number, comingFromJoint: number | "end"): Connection | null {
        const joint = this.joints.get(jointNumber);
        if(joint === undefined){
            console.warn("joint not found");
            return null;
        }
        return joint.from.get(comingFromJoint);
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
        const comingFromEndOutlets = joint.from.get("end");
        if(comingFromEndOutlets == undefined){
            console.warn("coming from end outlets not found");
            return null;
        }
        if(comingFromEndOutlets.out.size !== 1){
            console.warn("joint has more than one outgoing connection; something is wrong");
            return null;
        }
        const connection: TrackSegment = comingFromEndOutlets.out.values().next().value;

        return connection;
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
        const newTrackJoint: TrackJoint = {
            position: endPosition,
            from: new Map(),
            connections: new Map()
        };

        const newJointNumber = this.jointNumberManager.createEntity();
        const newCurveNumber = this._trackCurveManager.createCurveWithJoints(newCurve, startJointNumber, newJointNumber);

        const newTrackSegment: TrackSegment = {
            t0Joint: startJointNumber,
            t1Joint: newJointNumber,
            curve: newCurveNumber
        };

        const newConnection: Connection = {
            out: new Map([[startJointNumber, newTrackSegment]])
        };

        newTrackJoint.from.set("end", newConnection);
        newTrackJoint.connections.set(startJointNumber, newTrackSegment);

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

        if(this.jointIsEndingTrack(startJointNumber)){
            const otherEndOfEndingTrack = this.getTheOtherEndOfEndingTrack(startJointNumber);
            if(otherEndOfEndingTrack != null && this.getJointConnections(startJointNumber, "end") != null){
                const otherEndOfEndingTrackConnection = this.getJointConnections(startJointNumber, "end");
                startJoint.from.set(newJointNumber, otherEndOfEndingTrackConnection);
            }
            startJoint.from.delete("end");
        }

        startJoint.connections.set(newJointNumber, newTrackSegment);
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
        const firstConnection: TrackSegment = joint.connections.values().next().value;
        const curve = this._trackCurveManager.getTrackSegment(firstConnection.curve);
        if(curve === null){
            return null;
        }
        let tVal = 0;
        if(firstConnection.t1Joint === jointNumber){
            tVal = 1;
        }
        return curve.curvature(tVal);
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
                            t1Joint: trackSegment.t1Joint
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
        return this._trackCurveManager.getTrackSegment(curveNumber);
    }

    get trackSegments(): {t0Joint: number, t1Joint: number, curve: BCurve}[] {
        return this._trackCurveManager.getTrackSegmentsWithJoints();
    }

    logJoints(){
        for(const [jointNumber, joint] of this.joints.entries()){
            console.log('--------------------------------');
            console.log(`joint ${jointNumber} is ${this.jointIsEndingTrack(jointNumber) ? "" : "not"} a ending joint`);
            for(const [jointNumber, connection] of joint.from.entries()){
                console.log(`coming from ${jointNumber}`);
                for(const [jointNumber, trackSegment] of connection.out.entries()){
                    console.log(`can go to ${jointNumber}`);
                }
            }
            for(const [jointNumber, trackSegment] of joint.connections.entries()){
                console.log(`has connection to ${jointNumber} with track segment ${trackSegment.curve}`);
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
    private _trackSegmentsWithJoints: ({curve: BCurve, t0Joint: number, t1Joint: number} | null)[] = [];
    private _trackSegments: (BCurve | null)[] = [];

    constructor(initialCount: number) {
        this._maxEntities = initialCount;
        for (let i = 0; i < this._maxEntities; i++) {
            this._availableEntities.push(i);
            this._trackSegments.push(null);
            this._trackSegmentsWithJoints.push(null);
        }
    }

    getTrackSegment(entity: number): BCurve | null {
        if(entity < 0 || entity >= this._trackSegments.length){
            return null;
        }
        return this._trackSegments[entity];
    }

    getTrackSegmentsWithJoints(): {curve: BCurve, t0Joint: number, t1Joint: number}[] {
        return this._trackSegmentsWithJoints.filter((trackSegment) => trackSegment !== null);
    }

    getTrackSegmentWithJoints(entity: number): {curve: BCurve, t0Joint: number, t1Joint: number} | null {
        if(entity < 0 || entity >= this._trackSegmentsWithJoints.length){
            return null;
        }
        return this._trackSegmentsWithJoints[entity];
    }

    createCurveWithJoints(curve: BCurve, t0Joint: number, t1Joint: number): number {
        const entity = this.createEntity(curve);
        this._trackSegmentsWithJoints[entity] = {curve: curve, t0Joint: t0Joint, t1Joint: t1Joint};
        return entity;
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
        this._trackSegmentsWithJoints[entity] = null;
    }

    get livingEntities(): number[] {
        return Array.from(this._livingEntities);
    }
}
