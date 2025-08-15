import { BCurve } from "@ue-too/curve";
import { type Point } from "@ue-too/math";
import type { StateMachine, BaseContext, EventReactions, EventGuards, Guard } from "@ue-too/being";
import { NO_OP, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { ProjectionInfo, TrackGraph } from "./track";
import { PointCal, normalizeAngleZero2TwoPI, angleSpan } from "@ue-too/math";


export type LayoutStates = "IDLE" | "HOVER_FOR_STARTING_POINT" | "HOVER_FOR_ENDING_POINT";

export type LayoutEvents = {
    "pointerdown": {
        position: Point;
        pointerId: number;
    };
    "pointerup": {
        pointerId: number;
        position: Point;
    };
    "pointermove": {
        pointerId: number;
        position: Point;
    };
    "escapeKey": {};
    "startLayout": {};
    "endLayout": {};
}

type NewCurveCreationType = "new" | "branchJoint" | "branchTrack" | "extendEndingTrack";

export interface LayoutContext extends BaseContext {
    startingPointType: NewCurveCreationType; 
    startCurve: (startingPosition: Point) => void;
    endCurve: (endingPosition: Point) => void;
    cancelCurrentCurve: () => void;
    hoveringForEndJoint: (position: Point) => void;
    hoverForStartingPoint: (position: Point) => void;
    insertJointIntoTrackSegment: (startJointNumber: number, endJointNumber: number, atT: number) => void;
}

class LayoutIDLEState extends TemplateState<LayoutEvents, LayoutContext, LayoutStates> {

    constructor() {
        super();
    }

    _eventReactions: EventReactions<LayoutEvents, LayoutContext, LayoutStates> = {
        "startLayout": {
            action: NO_OP,
            defaultTargetState: "HOVER_FOR_STARTING_POINT",
        }
    };

    get eventReactions() {
        return this._eventReactions;
    }

}

class LayoutHoverForStartingPointState extends TemplateState<LayoutEvents, LayoutContext, LayoutStates> {

    constructor() {
        super();
    }
    
    _eventReactions: EventReactions<LayoutEvents, LayoutContext, LayoutStates> = {
        "pointerup": {
            action: (context, event) => {
                context.startCurve(event.position);
            },
            defaultTargetState: "HOVER_FOR_ENDING_POINT",
        },
        "pointermove": {
            action: (context, event) => {
                context.hoverForStartingPoint(event.position);
            },
            defaultTargetState: "HOVER_FOR_STARTING_POINT",
        },
        "endLayout": {
            action: (context, event) => {
                context.cancelCurrentCurve();
            },
            defaultTargetState: "IDLE",
        },
    };

    protected _guards: Guard<LayoutContext, string> = {
        "hasProjection": (context: LayoutContext) => {
            // NOTE: is in the middle instead of the end points
            return context.startingPointType === "branchTrack";
        }
    }

    protected _eventGuards: Partial<EventGuards<LayoutEvents, LayoutStates, LayoutContext, typeof this._guards>> = {
        "pointerup": [{
            guard: "hasProjection",
            target: "HOVER_FOR_STARTING_POINT",
        }],
    };

    get eventReactions() {
        return this._eventReactions;
    }
}

class LayoutHoverForEndingPointState extends TemplateState<LayoutEvents, LayoutContext, LayoutStates> {

    constructor() {
        super();
    }
    
    _eventReactions: EventReactions<LayoutEvents, LayoutContext, LayoutStates> = {
        "pointerup": {
            action: (context, event) => {
                context.endCurve(event.position);
                context.hoverForStartingPoint(event.position);
                context.startCurve(event.position);
            },
            defaultTargetState: "HOVER_FOR_ENDING_POINT",
        },
        "pointermove": {
            action: (context, event) => {
                context.hoveringForEndJoint(event.position);
            },
            defaultTargetState: "HOVER_FOR_ENDING_POINT",
        },
        "endLayout": {
            action: (context, event) => {
                context.cancelCurrentCurve();
            },
            defaultTargetState: "IDLE",
        },
        "escapeKey": {
            action: (context) => {
                context.cancelCurrentCurve();
            },
            defaultTargetState: "HOVER_FOR_STARTING_POINT",
        }
    };

    get eventReactions() {
        return this._eventReactions;
    }
}

export function createLayoutStateMachine(context: LayoutContext): StateMachine<LayoutEvents, LayoutContext, LayoutStates> {
    const stateMachine = new TemplateStateMachine<LayoutEvents, LayoutContext, LayoutStates>(
        {
            "IDLE": new LayoutIDLEState(),
            "HOVER_FOR_STARTING_POINT": new LayoutHoverForStartingPointState(),
            "HOVER_FOR_ENDING_POINT": new LayoutHoverForEndingPointState(),
        },
        "IDLE",
        context
    );
    return stateMachine;
}

export class CurveCreationEngine implements LayoutContext {

    private _currentStartingPoint: Point | null;
    private _hoverPosition: Point | null;
    private _hoverCirclePosition: Point | null;
    private _hoverCircleJointNumber: number | null;
    private _previewCurve: BCurve | null;
    private _trackGraph: TrackGraph;

    public projection: ProjectionInfo | null = null;

    private _startingPointType: "new" | "branchJoint" | "branchTrack" | "extendEndingTrack" = "new";

    private _constrainingCurve: {curve: BCurve, atT: number, tangent: Point} | null = null;

    constructor() {
        this._currentStartingPoint = null;
        this._hoverPosition = null;
        this._previewCurve = null;
        this._trackGraph = new TrackGraph();
    }

    get startingPointType(): NewCurveCreationType {
        return this._startingPointType;
    }

    startCurve(startingPosition: Point) {
        let newPosition = startingPosition;
        if(this._hoverCircleJointNumber != null && this._trackGraph.jointIsEndingTrack(this._hoverCircleJointNumber)){
            // starting on an existing joint
            console.log("starting on an existing joint", this._hoverCircleJointNumber);
            newPosition = this._trackGraph.getJointPosition(this._hoverCircleJointNumber);
            const comingFromConnection = this._trackGraph.getDeadEndJointSoleConnection(this._hoverCircleJointNumber);
            const comingFromCurve = this._trackGraph.getTrackSegmentCurve(comingFromConnection?.curve);
            console.log("coming from connection", comingFromConnection);
            console.log("coming from curve", comingFromCurve);
            let tVal = 1;
            let incomingTangent = PointCal.unitVector(comingFromCurve.derivative(tVal));
            if(comingFromConnection.t0Joint === this._hoverCircleJointNumber){
                tVal = 0;
                incomingTangent = PointCal.multiplyVectorByScalar(incomingTangent, -1);
            }
            console.log("tVal", tVal);
            console.log('incoming tangent', incomingTangent);
            this._constrainingCurve = {curve: comingFromCurve, atT: tVal, tangent: incomingTangent};
            // const incomingConnection = this._trackGraph.getJointConnections(this._hoverCircleJointNumber, comingFromJoint);
            // console.log("incoming connection", incomingConnection);
            this._startingPointType = "extendEndingTrack";
        } else if (this._hoverCircleJointNumber != null && !this._trackGraph.jointIsEndingTrack(this._hoverCircleJointNumber)){
            newPosition = this._trackGraph.getJointPosition(this._hoverCircleJointNumber);
            console.log('branching out from a joint that is not an ending track', this._hoverCircleJointNumber);
            this._startingPointType = "branchJoint";
        } else if (this.projection != null){
            newPosition = this.projection.projectionPoint;
            this._trackGraph.insertJointIntoTrackSegment(this.projection.t0Joint, this.projection.t1Joint, this.projection.atT);
            this._trackGraph.logJoints();
            this._trackGraph.logTrackSegments();
            this._startingPointType = "branchTrack";
            console.log("branching out from a track segment", this.projection);
        } else {
            console.log("starting on a new track segment");
            this._startingPointType = "new";
        }

        this._currentStartingPoint = newPosition;
        this.projection = null;
    }

    hoverForStartingPoint(position: Point) {
        const joint = this._trackGraph.pointOnJoint(position);
        const projection = this._trackGraph.projectPointOnTrack(position);
        if(joint !== null){
            const jointPosition = this._trackGraph.getJointPosition(joint.jointNumber);
            if(jointPosition !== null){
                this._hoverCirclePosition = jointPosition;
                this._hoverCircleJointNumber = joint.jointNumber;
            }
        } else {
            this._hoverCirclePosition = null;
            this._hoverCircleJointNumber = null;
        }
        if(projection != null){
            this.projection = projection;
        } else {
            this.projection = null;
        }
    }

    hoveringForEndJoint(position: Point) {
        this._hoverPosition = position;
        if(this._currentStartingPoint == null) {
            return;
        }

        let midPoint = {
            x: this._currentStartingPoint.x,
            y: this._currentStartingPoint.y + (this._hoverPosition.y - this._currentStartingPoint.y),
        }

        switch(this._startingPointType){
            case "new":
                midPoint = {
                    x: this._currentStartingPoint.x + (this._hoverPosition.x - this._currentStartingPoint.x) / 2,
                    y: this._currentStartingPoint.y + (this._hoverPosition.y - this._currentStartingPoint.y) / 2,
                }
                if(this._previewCurve == null){
                    this._previewCurve = new BCurve([this._currentStartingPoint, midPoint, this._hoverPosition]);
                    return;
                }

                this._previewCurve.setControlPointAtIndex(1, midPoint);
                this._previewCurve.setControlPointAtIndex(2, this._hoverPosition);
                break;
            case "branchJoint":
                break;
            case "branchTrack":
                break;
            case "extendEndingTrack":
                const previewCurveCPs = createInteractiveQuadratic(this._constrainingCurve.curve, this._hoverPosition, this._constrainingCurve.atT);
                if(this._previewCurve == null){
                    this._previewCurve = new BCurve([previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2]);
                    return;
                }
                this._previewCurve.setControlPointAtIndex(0, previewCurveCPs.p0);
                this._previewCurve.setControlPointAtIndex(1, previewCurveCPs.p1);
                this._previewCurve.setControlPointAtIndex(2, previewCurveCPs.p2);
                const curPreviewTangent = PointCal.unitVector(this._previewCurve.derivative(0));
                const angleDiff = PointCal.angleFromA2B(this._constrainingCurve.tangent, curPreviewTangent);
                const angleDiffRad = normalizeAngleZero2TwoPI(angleDiff);
                console.log("angle diff", angleDiffRad * 180 / Math.PI);
                if(angleDiffRad > Math.PI / 2 && angleDiffRad < 3 * Math.PI / 2){
                    console.log("invalid direction");
                }
                break;
        }

    }

    get previewCurve(): BCurve | null {
        return this._previewCurve;
    }

    get hoverCirclePosition(): Point | null {
        return this._hoverCirclePosition;
    }

    endCurve(endingPosition: Point) {
        if(this._currentStartingPoint === null || this._previewCurve === null) {
            return;
        }

        const cps = this._previewCurve.getControlPoints().slice(1, -1);
        console.log('raw cps', this._previewCurve.getControlPoints());
        switch(this._startingPointType){
            case "new":
                this._trackGraph.createNewTrackSegment(this._currentStartingPoint, endingPosition, cps);
                break;
            case "branchJoint":
                break;
            case "branchTrack":
                break;
            case "extendEndingTrack":   
                const otherEndOfEndingTrack = this._trackGraph.getTheOtherEndOfEndingTrack(this._hoverCircleJointNumber);
                if(otherEndOfEndingTrack != null){
                    console.log(`other end of ending track is ${otherEndOfEndingTrack}`);
                    this._trackGraph.extendTrackFromJoint(otherEndOfEndingTrack, this._hoverCircleJointNumber, endingPosition, cps);
                }
                break;
        }

        this._hoverPosition = null;
        this._currentStartingPoint = null;
        this._previewCurve = null;
        this._hoverCircleJointNumber = null;
        this._hoverCirclePosition = null;
        this._trackGraph.logJoints();
    }

    insertJointIntoTrackSegment(startJointNumber: number, endJointNumber: number, atT: number) {
        this._trackGraph.insertJointIntoTrackSegment(startJointNumber, endJointNumber, atT);
    }

    cancelCurrentCurve() {
        this._currentStartingPoint = null;
        this._hoverCircleJointNumber = null;
        this._hoverPosition = null;
        this._previewCurve = null;
        this.projection = null;
    }

    setup() {

    }

    cleanup() {

    }

    get trackGraph(): TrackGraph {
        return this._trackGraph;
    }
}

function createInteractiveQuadratic(existingCurve: BCurve, mousePos: Point, atT: number = 1) {
    const branchPoint = existingCurve.get(atT);
    const curvature = existingCurve.curvature(atT);
    const tangent = existingCurve.derivative(atT);
    let unitTangent = PointCal.unitVector(tangent);
    const mouseDistance = PointCal.distanceBetweenPoints(branchPoint, mousePos);

    const mouseDirection = PointCal.unitVectorFromA2B(branchPoint, mousePos);

    const rawAngleDiff = PointCal.angleFromA2B(unitTangent, mouseDirection);
    const angleDiff = normalizeAngleZero2TwoPI(rawAngleDiff);

    // NOTE: + or - 90 degrees should reverse the tangent direction
    if(angleDiff >= Math.PI / 2 && angleDiff <= 3 * Math.PI / 2){
        unitTangent = PointCal.multiplyVectorByScalar(unitTangent, -1);
    }
    
    // Adaptive control distance based on mouse position
    let controlDistance = Math.min(mouseDistance * 0.5);
    
    // Curvature-based adjustment for smoothness
    const curvatureMagnitude = Math.abs(curvature);
    if (curvatureMagnitude > 0.015) {
        controlDistance *= 0.7; // Tighter control for high curvature
    }
    
    // Prevent extreme angles
    const mouseVector = {
        x: mousePos.x - branchPoint.x,
        y: mousePos.y - branchPoint.y
    };

    
    return {
        p0: branchPoint,
        p1: {
            x: branchPoint.x + unitTangent.x * controlDistance,
            y: branchPoint.y + unitTangent.y * controlDistance
        },
        p2: mousePos
    };
}

function createG2Cubic(existingCurve: BCurve, targetPoint: Point) {
    const endPoint = existingCurve.get(1);
    const unitTangent = PointCal.unitVector(existingCurve.derivative(1));
    
    // Calculate tangent magnitude based on distance to target
    const targetDistance = PointCal.distanceBetweenPoints(endPoint, targetPoint);
    const tangentMagnitude = Math.min(targetDistance * 0.4, 150);
    
    const newCubic: {p0: Point, p1: Point, p2: Point, p3: Point} = {
        p0: endPoint,
        p1: {x: 0, y: 0},
        p2: {x: 0, y: 0},
        p3: {x: 0, y: 0}
    };

    newCubic.p0 = { ...endPoint };
    
    // P1: Along tangent direction
    newCubic.p1 = {
        x: newCubic.p0.x + unitTangent.x * tangentMagnitude,
        y: newCubic.p0.y + unitTangent.y * tangentMagnitude
    };
    
    // For G2 continuity: 6*(P2 - 2*P1 + P0) should match curvature constraint
    const targetSecondDeriv = existingCurve.secondDerivative(1);
    
    // P2: Satisfy G2 constraint
    newCubic.p2 = {
        x: (targetSecondDeriv.x / 6) + 2 * newCubic.p1.x - newCubic.p0.x,
        y: (targetSecondDeriv.y / 6) + 2 * newCubic.p1.y - newCubic.p0.y
    };
    
    // P3: Target point
    newCubic.p3 = { ...targetPoint };
    
    return newCubic;
}
