import { BaseContext, EventReactions, NO_OP, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { Point, PointCal } from "@ue-too/math";
import { TrackGraph } from "./track";
import { approximately } from "@ue-too/curve";

export type TrainPlacementStates = "IDLE" | "HOVER_FOR_PLACEMENT";

export type TrainPlacementEvents = {
    "pointerdown": {
        position: Point;
    };
    "pointerup": {
        position: Point;
    };
    "pointermove": {
        position: Point;
    };
    "escapeKey": {};
    "startPlacement": {};
    "endPlacement": {};
}

export interface TrainPlacementContext extends BaseContext {
    cancelCurrentTrainPlacement: () => void;
    placeTrain: (position: Point) => void;
    hoverForPlacement: (position: Point) => void;
}

export type TrainPosition = {
    trackSegment: number;
    tValue: number;
    direction: TrainDirection; // the direction of the train on the bezier curve; forward is t = 0 -> t = 1; backward is t = 1 -> t = 0
}

export type TrainDirection = "forward" | "backward";


export interface JointDirectionManager {
    getNextJoint(jointNumber: number, direction: "tangent" | "reverseTangent"): {jointNumber: number, direction: "forward" | "backward", curveNumber: number} | null;
}

export class DefaultJointDirectionManager implements JointDirectionManager {
    
    private _trackGraph: TrackGraph;

    constructor(trackGraph: TrackGraph){
        this._trackGraph = trackGraph;
    }

    getNextJoint(jointNumber: number, direction: "tangent" | "reverseTangent"): {jointNumber: number, direction: "forward" | "backward", curveNumber: number} | null {
        const joint = this._trackGraph.getJoint(jointNumber);
        if(joint === null){
            console.warn("starting joint not found");
            return null;
        }
        const possibleNextJoints = joint.direction[direction];
        if(possibleNextJoints.size === 0){
            console.warn("no possible next joints");
            return null;
        }
        const firstNextJointNumber: number = possibleNextJoints.values().next().value;
        const firstNextTrackSegmentNumber = joint.connections.get(firstNextJointNumber);
        const firstNextJoint = this._trackGraph.getJoint(firstNextJointNumber);
        const firstNextTrackSegment = this._trackGraph.getTrackSegmentWithJoints(firstNextTrackSegmentNumber);
        if(firstNextJoint === null){
            console.warn("first next joint not found");
            return null;
        }
        if(firstNextTrackSegment === null){
            console.warn("first next track segment not found");
            return null;
        }
        const nextDirection = firstNextTrackSegment.t0Joint === jointNumber ? "forward" : "backward";
        return {
            jointNumber: firstNextJointNumber,
            direction: nextDirection,
            curveNumber: firstNextTrackSegmentNumber
        };
    }
}

export class TrainPlacementEngine implements TrainPlacementContext {

    private _trackGraph: TrackGraph;
    private _trainPosition: Point | null = null;
    private _previewPosition: Point | null = null;
    private _trainTangent: Point | null = null;
    private _previewTangent: Point | null = null;
    private _trainSpeed: number = 0; // train speed should never be negative since the direction already takes care of it
    private _trainAcceleration: number = 0;
    private _trainPositionInTrack: TrainPosition | null = null;
    private _jointDirectionManager: JointDirectionManager;
    private _potentialTrainPlacement: TrainPosition | null = null;
    private _friction: number = -0.05;

    constructor(trackGraph: TrackGraph) {
        this._trackGraph = trackGraph;
        this._jointDirectionManager = new DefaultJointDirectionManager(trackGraph);
    }

    cancelCurrentTrainPlacement(){
        this._previewPosition = null;
    };

    placeTrain(){
        if(this._previewPosition === null){
            return;
        }
        if(this._potentialTrainPlacement !== null){
            this._trainPositionInTrack = {...this._potentialTrainPlacement};
            this._potentialTrainPlacement = null;
        }
        this._trainPosition = this._previewPosition;
        this._previewPosition = null;
        this._trainTangent = this._previewTangent;
        this._previewTangent = null;
    }

    setTrainAcceleration(acceleration: number){
        this._trainAcceleration = acceleration;
    }

    update(deltaTime: number){
        deltaTime /= 1000;
        if(this._trainPositionInTrack === null){
            return;
        }
        const trackSegment = this._trackGraph.getTrackSegmentWithJoints(this._trainPositionInTrack.trackSegment);
        if(trackSegment === null){
            console.warn("track segment where the train is on is not found");
            return;
        }
        let friction = this._friction;
        if(this._trainSpeed === 0){
            friction = 0;
        }
        if(this._trainSpeed > 0 && this._trainSpeed + friction < 0){
            this._trainSpeed = 0;
            return;
        } else {
            this._trainSpeed += friction;
        }
        this._trainSpeed += this._trainAcceleration * deltaTime;
        let distanceToAdvance = this._trainSpeed * deltaTime;
        if(approximately(distanceToAdvance, 0, 0.001)){
            return;
        }
        let nextPosition = trackSegment.curve.advanceAtTWithLength(this._trainPositionInTrack.tValue, distanceToAdvance * (this._trainPositionInTrack.direction === "forward" ? 1 : -1));
        while(nextPosition.type !== "withinCurve"){
            const comingFromJointNumber = this._trainPositionInTrack.direction === "forward" ? trackSegment.t0Joint : trackSegment.t1Joint;
            const enteringJointNumber = this._trainPositionInTrack.direction === "forward" ? trackSegment.t1Joint : trackSegment.t0Joint;
            const enteringJoint = this._trackGraph.getJoint(enteringJointNumber);
            if(enteringJoint === null){
                console.warn("entering joint not found");
                return;
            }
            const nextJointDirection = enteringJoint.direction.reverseTangent.has(comingFromJointNumber) ? "tangent" : "reverseTangent";
            const nextDirection = this._jointDirectionManager.getNextJoint(enteringJointNumber, nextJointDirection);

            if(nextDirection === null){
                console.warn("end of the track");
                this._trainAcceleration = 0;
                this._trainSpeed = 0;
                this._trainPositionInTrack.tValue = this._trainPositionInTrack.direction === "forward" ? 1 : 0;
                return;
            }

            const nextTrackSegment = this._trackGraph.getTrackSegmentWithJoints(nextDirection.curveNumber);
            if(nextTrackSegment === null){
                console.info("the end");
                return;
            }
            this._trainPositionInTrack.direction = nextDirection.direction;
            this._trainPositionInTrack.trackSegment = nextDirection.curveNumber;

            distanceToAdvance = Math.abs(nextPosition.remainLength);
            nextPosition = nextTrackSegment.curve.advanceAtTWithLength(nextDirection.direction === "forward" ? 0 : 1, distanceToAdvance * (nextDirection.direction === "forward" ? 1 : -1));
            this._trainPositionInTrack.tValue = nextPosition.type === "withinCurve" ? nextPosition.tVal : nextDirection.direction === "forward" ? 1 : 0;
            if(nextPosition.type === "withinCurve"){
                this._trainPositionInTrack.tValue = nextPosition.tVal;
            } else {
                this._trainPositionInTrack.tValue = nextDirection.direction === "forward" ? 1 : 0;
            }
        }
        // console.log("train position in track", this._trainPositionInTrack);
        this._trainPositionInTrack.tValue = nextPosition.tVal;
        this._trainPosition = null;
    }

    switchDirection(){
        if(this._trainPositionInTrack === null){
            return;
        }
        this._trainPositionInTrack.direction = this._trainPositionInTrack.direction === "forward" ? "backward" : "forward";
        this._trainTangent = PointCal.multiplyVectorByScalar(this._trainTangent, -1);
    }

    get trainTangent(): Point | null {
        return this._trainTangent;
    }

    hoverForPlacement(position: Point){
        const res = this._trackGraph.project(position);
        if(res.hit){
            switch(res.hitType){
                // case "joint":
                //     this._previewPosition = res.position;
                //     const joint = this._trackGraph.getJoint(res.jointNumber);
                //     if(joint == undefined){
                //         console.warn("joint not found");
                //         return;
                //     }
                //     const connection = joint.connections.values().next().value;

                //     break;
                case "curve":
                    const trackSegment = this._trackGraph.getTrackSegmentWithJoints(res.curve);
                    if(trackSegment == undefined){
                        console.warn("track segment not found");
                        return;
                    }
                    this._previewPosition = res.projectionPoint;
                    this._potentialTrainPlacement = {
                        trackSegment: res.curve,
                        tValue: res.atT,
                        direction: "forward"
                    };
                    break;
            }
            this._previewTangent = res.tangent;
        } else {
            this._previewPosition = null;
        }
    }

    get trainPosition(): Point | null {
        if(this._trainPosition !== null) {
            return this._trainPosition;
        }
        if(this._trainPositionInTrack !== null){
            const trackSegment = this._trackGraph.getTrackSegmentWithJoints(this._trainPositionInTrack.trackSegment);
            if(trackSegment !== null){
                const tangent = PointCal.unitVector(trackSegment.curve.derivative(this._trainPositionInTrack.tValue));
                this._trainTangent = this._trainPositionInTrack.direction === "forward" ? tangent : PointCal.multiplyVectorByScalar(tangent, -1);
                this._trainPosition = trackSegment.curve.get(this._trainPositionInTrack.tValue);
                return this._trainPosition;
            }
        }
        return null;
    }

    get previewPosition(): Point | null {
        return this._previewPosition;
    }

    setup(){
        // TODO: setup
    }

    cleanup(){
        // TODO: cleanup
    }
}

export class TrainPlacementStateMachine extends TemplateStateMachine<TrainPlacementEvents, TrainPlacementContext, TrainPlacementStates> {

    constructor(context: TrainPlacementContext) {
        super({
            IDLE: new TrainPlacementIDLEState(),
            "HOVER_FOR_PLACEMENT": new TrainPlacementHoverForPlacementState(),
        }, "IDLE", context);
    }
}


export class TrainPlacementIDLEState extends TemplateState<TrainPlacementEvents, TrainPlacementContext, TrainPlacementStates> {

    public eventReactions: EventReactions<TrainPlacementEvents, TrainPlacementContext, TrainPlacementStates> = {
        "startPlacement": {
            action: NO_OP,
            defaultTargetState: "HOVER_FOR_PLACEMENT"
        }
    }
}

export class TrainPlacementHoverForPlacementState extends TemplateState<TrainPlacementEvents, TrainPlacementContext, TrainPlacementStates> {

    public eventReactions: EventReactions<TrainPlacementEvents, TrainPlacementContext, TrainPlacementStates> = {
        "endPlacement": {
            action: (context) => {
                context.cancelCurrentTrainPlacement();
            },
            defaultTargetState: "IDLE"
        },
        "pointerup": {
            action: (context, event) => {
                context.placeTrain(event.position);
            },
            defaultTargetState: "HOVER_FOR_PLACEMENT"
        },
        "pointermove": {
            action: (context, event) => {
                context.hoverForPlacement(event.position);
            },
            defaultTargetState: "HOVER_FOR_PLACEMENT"
        },
        "escapeKey": {
            action: (context) => {
                context.cancelCurrentTrainPlacement();
            },
            defaultTargetState: "IDLE"
        }
    }
}

