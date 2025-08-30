import { BCurve } from "@ue-too/curve";
import { sameDirection, type Point } from "@ue-too/math";
import type { StateMachine, BaseContext, EventReactions, EventGuards, Guard } from "@ue-too/being";
import { NO_OP, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { ProjectionCurveResult, ProjectionInfo, ProjectionJointResult, ProjectionPositiveResult, ProjectionResult, TrackGraph } from "./track";
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
    "flipEndTangent": {};
    "flipStartTangent": {};
}

export interface LayoutContext extends BaseContext {
    startCurve: () => void;
    endCurve: (endingPosition: Point) => boolean;
    cancelCurrentCurve: () => void;
    hoveringForEndJoint: (position: Point) => void;
    hoverForStartingPoint: (position: Point) => void;
    insertJointIntoTrackSegment: (startJointNumber: number, endJointNumber: number, atT: number) => void;
    flipEndTangent: () => void;
    flipStartTangent: () => void;
    previewStartProjection: ProjectionPositiveResult | null;
    newStartJointType: NewJointType | null;
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
                context.startCurve();
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
        "flipEndTangent": {
            action: (context, event) => {
                context.flipEndTangent();
            },
            defaultTargetState: "HOVER_FOR_STARTING_POINT",
        },
        "flipStartTangent": {
            action: (context, event) => {
                context.flipStartTangent();
            },
            defaultTargetState: "HOVER_FOR_STARTING_POINT",
        }
    };

    protected _guards: Guard<LayoutContext, string> = {
        "hasProjection": (context: LayoutContext) => {
            // NOTE: is in the middle instead of the end points
            return context.newStartJointType != null && context.newStartJointType.type === "branchCurve";
        }
    }

    protected _eventGuards: Partial<EventGuards<LayoutEvents, LayoutStates, LayoutContext, typeof this._guards>> = {
        // "pointerup": [{
        //     guard: "hasProjection",
        //     target: "HOVER_FOR_STARTING_POINT",
        // }],
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
                const res = context.endCurve(event.position);
                context.hoverForStartingPoint(event.position);
                context.startCurve();
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
        },
        "flipEndTangent": {
            action: (context, event) => {
                context.flipEndTangent();
            },
            defaultTargetState: "HOVER_FOR_ENDING_POINT",
        },
        "flipStartTangent": {
            action: (context, event) => {
                context.flipStartTangent();
            },
            // defaultTargetState: "HOVER_FOR_ENDING_POINT",
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

export type BrandNewJoint = {
    type: "new";
    position: Point;
}

export type BranchJoint = {
    type: "branchJoint";
    position: Point;
    constraint: ProjectionJointResult;
}

export type ExtendingTrackJoint = {
    type: "extendingTrack";
    position: Point;
    constraint: ProjectionJointResult;
}

export type BranchCurveJoint = {
    type: "branchCurve";
    position: Point;
    constraint: ProjectionCurveResult;
}

export type NewJointType = BrandNewJoint | BranchJoint | ExtendingTrackJoint | BranchCurveJoint;

export class CurveCreationEngine implements LayoutContext {

    private _trackGraph: TrackGraph;

    private _newStartJointType: NewJointType | null = null;
    private _newEndJointType: NewJointType | null = null;

    private _previewStartProjection: ProjectionPositiveResult | null = null;
    private _previewEndProjection: ProjectionPositiveResult | null = null;

    private _previewCurve: {
        curve: BCurve;
        previewStartAndEndSwitched: boolean; 
    } | null = null;

    private _previewStartTangentFlipped: boolean = false;
    private _previewEndTangentFlipped: boolean = false;

    constructor() {
        this._trackGraph = new TrackGraph();
    }

    get newStartJointType(): NewJointType | null {
        return this._newStartJointType;
    }

    startCurve() {
        // if(this._newStartJointType != null && this._newStartJointType.type === "branchCurve"){
        //     const constraint = this._newStartJointType.constraint;
        //     this._trackGraph.insertJointIntoTrackSegment(constraint.t0Joint, constraint.t1Joint, constraint.atT);
        //     this._trackGraph.logJoints();
        //     this._trackGraph.logTrackSegments();
        //     console.log("branching out from track segment", constraint.curve);
        // }
    }

    hoverForStartingPoint(position: Point) {
        const res = this._trackGraph.project(position);
        this._newStartJointType = this.determineNewJointType(position, res);
        if(res.hit){
            this._previewStartProjection = res;
        } else {
            this._previewStartProjection = null;
        }
    }

    flipStartTangent() {
        this._previewStartTangentFlipped = !this._previewStartTangentFlipped;
        const newPreviewCurveCPs = getPreviewCurve(this._newStartJointType, this._newEndJointType, this._previewStartTangentFlipped, this._previewEndTangentFlipped, this._previewEndProjection, this._previewCurve?.curve, this._trackGraph);
        if(this._previewCurve == null){
            this._previewCurve = {
                curve: new BCurve(newPreviewCurveCPs.cps),
                previewStartAndEndSwitched: newPreviewCurveCPs.startAndEndSwitched,
            };
        } else {
            this._previewCurve.curve.setControlPoints(newPreviewCurveCPs.cps);
            this._previewCurve.previewStartAndEndSwitched = newPreviewCurveCPs.startAndEndSwitched;
        }
    }

    flipEndTangent() {
        this._previewEndTangentFlipped = !this._previewEndTangentFlipped;
        const newPreviewCurveCPs = getPreviewCurve(this._newStartJointType, this._newEndJointType, this._previewStartTangentFlipped, this._previewEndTangentFlipped, this._previewEndProjection, this._previewCurve?.curve, this._trackGraph);
        if(this._previewCurve == null){
            this._previewCurve = {
                curve: new BCurve(newPreviewCurveCPs.cps),
                previewStartAndEndSwitched: newPreviewCurveCPs.startAndEndSwitched,
            };
        } else {
            this._previewCurve.curve.setControlPoints(newPreviewCurveCPs.cps);
            this._previewCurve.previewStartAndEndSwitched = newPreviewCurveCPs.startAndEndSwitched;
        }
    }

    hoveringForEndJoint(position: Point) {
        if(this._newStartJointType == null) {
            return;
        }

        const res = this._trackGraph.project(position);
        this._newEndJointType = this.determineNewJointType(position, res);

        if(res.hit){
            this._previewEndProjection = res;
        } else {
            this._previewEndProjection = null;
        }

        const newPreviewCurveCPs = getPreviewCurve(this._newStartJointType, this._newEndJointType, this._previewStartTangentFlipped, this._previewEndTangentFlipped, this._previewEndProjection, this._previewCurve?.curve, this._trackGraph);

        if(newPreviewCurveCPs.shouldToggleStartTangentFlip){
            this._previewStartTangentFlipped = !this._previewStartTangentFlipped;
        }
        if(newPreviewCurveCPs.shouldToggleEndTangentFlip){
            this._previewEndTangentFlipped = !this._previewEndTangentFlipped;
        }

        if(this._previewCurve == null){
            this._previewCurve = {
                curve: new BCurve(newPreviewCurveCPs.cps),
                previewStartAndEndSwitched: newPreviewCurveCPs.startAndEndSwitched,
            };
        } else {
            this._previewCurve.curve.setControlPoints(newPreviewCurveCPs.cps);
            this._previewCurve.previewStartAndEndSwitched = newPreviewCurveCPs.startAndEndSwitched;
        }

    }

    get previewCurve(): {
        curve: BCurve;
        previewStartAndEndSwitched: boolean;
    } | null {
        return this._previewCurve;
    }

    get previewStartProjection(): ProjectionPositiveResult | null {
        return this._previewStartProjection;
    }

    get previewEndProjection(): ProjectionPositiveResult | null {
        return this._previewEndProjection;
    }

    endCurve(): boolean {
        let res = false;

        if(this._newStartJointType === null || this._previewCurve === null || this._newEndJointType === null) {
            this.cancelCurrentCurve();
            return false;
        }

        const cps = this._previewCurve.curve.getControlPoints().slice(1, -1);

        let startJointNumber: number | null = null;
        let endJointNumber: number | null = null;

        // TODO maybe turn this into a validation pipeline function and add other edge cases?
        if(this._newStartJointType.type === "extendingTrack"){
            const startJointNumber = this._newStartJointType.constraint.jointNumber;
            const startJointTangent = this._newStartJointType.constraint.tangent;
            const previewCurveTangent = this._previewCurve.previewStartAndEndSwitched ? this._previewCurve.curve.derivative(1) : this._previewCurve.curve.derivative(0);
            if(!extendTrackIsPossible(startJointNumber, startJointTangent, previewCurveTangent, this._trackGraph)){
                this.cancelCurrentCurve();
                return false;
            }
        }

        if(this._newEndJointType.type === "extendingTrack"){
            console.log('checking extend track possible for end joint');
            const startJointNumber = this._newEndJointType.constraint.jointNumber;
            const startJointTangent = this._newEndJointType.constraint.tangent;
            const previewCurveTangent = this._previewCurve.previewStartAndEndSwitched ? this._previewCurve.curve.derivative(0) : this._previewCurve.curve.derivative(1);
            const previewCurveTangentInTheDirectionToOtherJoint = PointCal.multiplyVectorByScalar(previewCurveTangent, -1);
            if(!extendTrackIsPossible(startJointNumber, startJointTangent, previewCurveTangentInTheDirectionToOtherJoint, this._trackGraph)){
                this.cancelCurrentCurve();
                return false;
            }
        }
        // END OF VALIDATION PIPELINE

        if(this._newStartJointType.type === "new"){
            const startTangent = this._previewCurve.previewStartAndEndSwitched ? 
            PointCal.unitVector(this._previewCurve.curve.derivative(1)) : PointCal.unitVector(this._previewCurve.curve.derivative(0));
            startJointNumber = this._trackGraph.createNewEmptyJoint(this._newStartJointType.position, startTangent);
        } else if(this._newStartJointType.type === "branchCurve"){
            const constraint = this._newStartJointType.constraint;
            const trackSegmentNumber = constraint.curve;
            startJointNumber = this._trackGraph.insertJointIntoTrackSegmentUsingTrackNumber(trackSegmentNumber, constraint.atT);
        }else {
            startJointNumber = this._newStartJointType.constraint.jointNumber;
        }

        if(this._newEndJointType.type === "new"){
            const endTangent = this._previewCurve.previewStartAndEndSwitched ? 
            PointCal.unitVector(this._previewCurve.curve.derivative(0)) : PointCal.unitVector(this._previewCurve.curve.derivative(1));
            endJointNumber = this._trackGraph.createNewEmptyJoint(this._newEndJointType.position, endTangent);
        } else if (this._newEndJointType.type === "branchCurve"){
            const constraint = this._newEndJointType.constraint;
            const trackSegmentNumber = constraint.curve;
            endJointNumber = this._trackGraph.insertJointIntoTrackSegmentUsingTrackNumber(trackSegmentNumber, constraint.atT);
        }else {
            endJointNumber = this._newEndJointType.constraint.jointNumber;
        }

        if(startJointNumber === null || endJointNumber === null){
            this.cancelCurrentCurve();
            return false;
        }

        res = this._trackGraph.connectJoints(startJointNumber, endJointNumber, cps);
        this._trackGraph.logJoints();

        return res;
    }

    insertJointIntoTrackSegment(startJointNumber: number, endJointNumber: number, atT: number) {
        this._trackGraph.insertJointIntoTrackSegment(startJointNumber, endJointNumber, atT);
        this._trackGraph.logJoints();
    }

    cancelCurrentCurve() {
        this._previewStartProjection = null;
        this._previewEndProjection = null;
        this._previewCurve = null;
        this._newStartJointType = null;
        this._newEndJointType = null;
        this._previewStartTangentFlipped = false;
        this._previewEndTangentFlipped = false;
    }

    setup() {

    }

    cleanup() {

    }

    get trackGraph(): TrackGraph {
        return this._trackGraph;
    }

    determineNewJointType(rawPosition: Point, projection: ProjectionResult): NewJointType {
        if(!projection.hit){
            return {
                type: "new",
                position: rawPosition
            };
        }

        switch(projection.hitType){
            case "joint":
                if(this._trackGraph.jointIsEndingTrack(projection.jointNumber)){
                    // extending from a dead end joint
                    return {
                        type: "extendingTrack",
                        position: projection.projectionPoint,
                        constraint: projection,
                    };
                } else {
                    // branching out from a joint that is not an ending track
                    return {
                        type: "branchJoint",
                        position: projection.projectionPoint,
                        constraint: projection,
                    }
                }
            case "curve":
                return {
                    type: "branchCurve",
                    position: projection.projectionPoint,
                    constraint: projection,
                }
        }
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

function getPreviewCurve(newStartJointType: NewJointType, newEndJointType: NewJointType, previewStartTangentFlipped: boolean, previewEndTangentFlipped: boolean, previewEndProjection: ProjectionPositiveResult | null, previewCurve: BCurve | null, trackGraph: TrackGraph): 
    {
        cps: Point[] // including start and end preview points
        startAndEndSwitched: boolean; // sometimes the new curve would go from end (as t = 0) to start (as t = 1)
        shouldToggleStartTangentFlip: boolean;
        shouldToggleEndTangentFlip: boolean;
    }
{

    switch(newStartJointType.type){
        case "new":
            if(newEndJointType.type === "new"){
                let midPoint = {
                    x: newStartJointType.position.x + (newEndJointType.position.x - newStartJointType.position.x) / 2,
                    y: newStartJointType.position.y + (newEndJointType.position.y - newStartJointType.position.y) / 2,
                };
                return {
                    cps: [newStartJointType.position, midPoint, newEndJointType.position],
                    startAndEndSwitched: false,
                    shouldToggleStartTangentFlip: false,
                    shouldToggleEndTangentFlip: false,
                };
            } else {
                let {flipped: tangentCalibrated, tangent} = calibrateTangent(newEndJointType.constraint.tangent, newEndJointType.position, newStartJointType.position);
                tangent = previewEndTangentFlipped ? PointCal.multiplyVectorByScalar(tangent, -1) : tangent;
                const curvature = newEndJointType.constraint.curvature;
                const previewCurveCPs = createQuadraticFromTangentCurvature(newEndJointType.position, newStartJointType.position, tangent, curvature);
                return {
                    cps: [previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2],
                    startAndEndSwitched: true,
                    shouldToggleStartTangentFlip: false,
                    shouldToggleEndTangentFlip: tangentCalibrated && previewEndTangentFlipped,
                };
            }
        case "branchJoint":{
            let {flipped: tangentCalibrated, tangent} = calibrateTangent(newStartJointType.constraint.tangent, newStartJointType.position, newEndJointType.position);
            tangent = previewStartTangentFlipped ? PointCal.multiplyVectorByScalar(tangent, -1) : tangent;
            const curvature = newStartJointType.constraint.curvature;
            if(newEndJointType.type === "new"){
                // branch to a new joint
                const previewCurveCPs = createQuadraticFromTangentCurvature(newStartJointType.position, newEndJointType.position, tangent, curvature);
                return {
                    cps: [previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2],
                    startAndEndSwitched: false,
                    shouldToggleEndTangentFlip: false,
                    shouldToggleStartTangentFlip: tangentCalibrated && previewStartTangentFlipped,
                };
            } else {
                const previewEndTangent = previewEndTangentFlipped ? PointCal.multiplyVectorByScalar(newEndJointType.constraint.tangent, -1) : newEndJointType.constraint.tangent;
                const previewCurveCPs = createCubicFromTangentsCurvatures(newStartJointType.position, newEndJointType.position, tangent, previewEndTangent, curvature, previewEndProjection.curvature);
                return {
                    cps: [previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2, previewCurveCPs.p3],
                    startAndEndSwitched: false,
                    shouldToggleEndTangentFlip: false,
                    shouldToggleStartTangentFlip: tangentCalibrated && previewStartTangentFlipped,
                };
            }
        }
        case "branchCurve":{
            const curvature = newStartJointType.constraint.curvature;
            let {flipped: tangentCalibrated, tangent} = calibrateTangent(newStartJointType.constraint.tangent, newStartJointType.position, newEndJointType.position);
            tangent = previewStartTangentFlipped ? PointCal.multiplyVectorByScalar(tangent, -1) : tangent;
            if(newEndJointType.type === "new"){
                // branch to a new joint
                const previewCurveCPs = createQuadraticFromTangentCurvature(newStartJointType.position, newEndJointType.position, tangent, curvature);
                return {
                    cps: [previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2],
                    startAndEndSwitched: false,
                    shouldToggleEndTangentFlip: false,
                    shouldToggleStartTangentFlip: tangentCalibrated && previewStartTangentFlipped,
                };
            } else {
                const previewEndTangent = previewEndTangentFlipped ? PointCal.multiplyVectorByScalar(newEndJointType.constraint.tangent, -1) : newEndJointType.constraint.tangent;
                const previewCurveCPs = createCubicFromTangentsCurvatures(newStartJointType.position, newEndJointType.position, tangent, previewEndTangent, curvature, previewEndProjection.curvature);
                return {
                    cps: [previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2, previewCurveCPs.p3],
                    startAndEndSwitched: false,
                    shouldToggleEndTangentFlip: false,
                    shouldToggleStartTangentFlip: tangentCalibrated && previewStartTangentFlipped,
                };
            }
        }
        case "extendingTrack":
            let {flipped: tangentCalibrated, tangent: startTangent} = calibrateTangent(newStartJointType.constraint.tangent, newStartJointType.position, newEndJointType.position);
            startTangent = previewStartTangentFlipped ? PointCal.multiplyVectorByScalar(startTangent, -1) : startTangent;

            const curvature = newStartJointType.constraint.curvature;
            if(newEndJointType.type === "extendingTrack"){
                const previewCurveCPs = createCubicFromTangentsCurvatures(newStartJointType.position, newEndJointType.position, startTangent, newEndJointType.constraint.tangent, curvature, newEndJointType.constraint.curvature);
                return {
                    cps: [previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2, previewCurveCPs.p3],
                    startAndEndSwitched: false,
                    shouldToggleEndTangentFlip: false,
                    shouldToggleStartTangentFlip: tangentCalibrated && previewStartTangentFlipped,
                };
            } else {
                const constraint = newStartJointType.constraint;
                const previewCurveCPs = createQuadraticFromTangentCurvature(constraint.projectionPoint, newEndJointType.position, startTangent, curvature);
                return {
                    cps: [previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2],
                    startAndEndSwitched: false,
                    shouldToggleEndTangentFlip: false,
                    shouldToggleStartTangentFlip: tangentCalibrated && previewStartTangentFlipped,
                };
            }
    }
}

function extendTrackIsPossible(startJointNumber: number, startJointTangent: Point, previewCurveTangentInTheDirectionToOtherJoint: Point, trackGraph: TrackGraph){
    const emptyTangentDirection = trackGraph.tangentIsPointingInEmptyDirection(startJointNumber) ? startJointTangent : PointCal.multiplyVectorByScalar(startJointTangent, -1);

    if(sameDirection(emptyTangentDirection, previewCurveTangentInTheDirectionToOtherJoint)){
        return true;
    }

    return false;

    // const start2EndDirection = PointCal.unitVectorFromA2B(startJointPosition, endPosition);

    // const rawAngleDiff = PointCal.angleFromA2B(emptyTangentDirection, start2EndDirection);
    // const angleDiff = normalizeAngleZero2TwoPI(rawAngleDiff);

    // if(angleDiff > Math.PI / 2 && angleDiff < 3 * Math.PI / 2){
    //     console.warn("invalid direction in extendTrackFromJoint");
    //     return false;
    // }
}

function calibrateTangent(rawTangent: Point, curveStartPoint: Point, curveEndPoint: Point): { 
    flipped: boolean;
    tangent: Point;
}{
    const curPreviewDirection = PointCal.unitVectorFromA2B(curveStartPoint, curveEndPoint);
    let flipped = false;
    let tangent = rawTangent;
    const angleDiff = normalizeAngleZero2TwoPI(PointCal.angleFromA2B(tangent, curPreviewDirection));
    if(angleDiff >= Math.PI / 2 && angleDiff <= 3 * Math.PI / 2){
        flipped = true;
        tangent = PointCal.multiplyVectorByScalar(tangent, -1);
    }
    return {
        flipped,
        tangent
    };
}

/**
 * Creates a quadratic Bézier curve from start and end points with specified tangent direction and curvature
 * @param startPoint - The starting point of the curve (P0)
 * @param endPoint - The ending point of the curve (P2)  
 * @param tangentDirection - Unit vector indicating the tangent direction at the start point
 * @param curvature - The desired curvature value (positive for left turn, negative for right turn)
 * @returns Object containing the three control points {p0, p1, p2} of the quadratic Bézier curve
 */
function createQuadraticFromTangentCurvature(
    startPoint: Point, 
    endPoint: Point, 
    tangentDirection: Point, 
    curvature: number
): {p0: Point, p1: Point, p2: Point} {
    
    // Ensure tangent direction is normalized
    let unitTangent = PointCal.unitVector(tangentDirection);
    
    // Calculate the chord vector from start to end
    const chordVector = PointCal.subVector(endPoint, startPoint);
    const chordLength = PointCal.magnitude(chordVector);

    // For a quadratic Bézier curve, the relationship between curvature and control point placement
    // can be derived from the curve's mathematical properties
    // The control point distance is inversely related to curvature magnitude
    
    // Base control distance as a fraction of chord length
    let controlDistance = chordLength * 0.5;
    
    // Adjust control distance based on curvature
    // Higher curvature magnitude requires closer control points for tighter curves
    const curvatureMagnitude = Math.abs(curvature);
    if (curvatureMagnitude > 0.001) {
        // Scale inversely with curvature, but with reasonable bounds
        const curvatureScale = Math.min(1.0, 1.0 / (curvatureMagnitude * chordLength + 1.0));
        controlDistance *= curvatureScale;
        
        // Additional scaling based on curvature sign and magnitude
        if (curvatureMagnitude > 0.01) {
            controlDistance *= 0.8; // Tighter control for high curvature
        }
    }
    
    // Calculate the midpoint control point (P1)
    // For quadratic curves, P1 influences both the tangent direction and curvature
    const p1 = {
        x: startPoint.x + unitTangent.x * controlDistance,
        y: startPoint.y + unitTangent.y * controlDistance
    };
    
    // Fine-tune P1 position based on curvature direction
    // Positive curvature typically means curving to the left of the tangent direction
    if (Math.abs(curvature) > 0.001) {
        // Calculate perpendicular vector to tangent (90 degrees counter-clockwise)
        const perpendicular = {
            x: -unitTangent.y,
            y: unitTangent.x
        };
        
        // Adjust P1 perpendicular to the tangent based on curvature
        const perpendicularOffset = curvature * chordLength * 0.1;
        p1.x += perpendicular.x * perpendicularOffset;
        p1.y += perpendicular.y * perpendicularOffset;
    }
    
    return {
        p0: startPoint,
        p1: p1,
        p2: endPoint
    };
}

/**
 * Creates a cubic Bézier curve from start and end points with specified tangent directions and curvatures
 * @param startPoint - The starting point of the curve (P0)
 * @param endPoint - The ending point of the curve (P3)
 * @param startTangentDirection - Unit vector indicating the tangent direction at the start point
 * @param endTangentDirection - Unit vector indicating the tangent direction at the end point
 * @param startCurvature - The desired curvature value at start point (positive for left turn, negative for right turn)
 * @param endCurvature - The desired curvature value at end point (positive for left turn, negative for right turn)
 * @returns Object containing the four control points {p0, p1, p2, p3} of the cubic Bézier curve
 */
function createCubicFromTangentCurvature(
    startPoint: Point,
    endPoint: Point,
    startTangentDirection: Point,
    endTangentDirection: Point,
    startCurvature: number,
    endCurvature: number
): {p0: Point, p1: Point, p2: Point, p3: Point} {
    
    // Ensure tangent directions are normalized
    const unitStartTangent = PointCal.unitVector(startTangentDirection);
    const unitEndTangent = PointCal.unitVector(endTangentDirection);
    
    // Calculate the chord vector from start to end
    const chordVector = PointCal.subVector(endPoint, startPoint);
    const chordLength = PointCal.magnitude(chordVector);
    
    // Base control distances - start with 1/3 of chord length (standard for cubic Bézier)
    let startControlDistance = chordLength / 3.0;
    let endControlDistance = chordLength / 3.0;
    
    // Adjust control distances based on curvatures
    // Higher curvature magnitude requires tighter control for more precise curves
    
    // For start control point (P1)
    const startCurvatureMagnitude = Math.abs(startCurvature);
    if (startCurvatureMagnitude > 0.001) {
        // Scale inversely with curvature, with reasonable bounds
        const startCurvatureScale = Math.min(1.5, Math.max(0.3, 1.0 / (startCurvatureMagnitude * chordLength + 1.0)));
        startControlDistance *= startCurvatureScale;
        
        // Additional scaling for very high curvature
        if (startCurvatureMagnitude > 0.02) {
            startControlDistance *= 0.7;
        }
    }
    
    // For end control point (P2)
    const endCurvatureMagnitude = Math.abs(endCurvature);
    if (endCurvatureMagnitude > 0.001) {
        // Scale inversely with curvature, with reasonable bounds
        const endCurvatureScale = Math.min(1.5, Math.max(0.3, 1.0 / (endCurvatureMagnitude * chordLength + 1.0)));
        endControlDistance *= endCurvatureScale;
        
        // Additional scaling for very high curvature
        if (endCurvatureMagnitude > 0.02) {
            endControlDistance *= 0.7;
        }
    }
    
    // Calculate initial control points along tangent directions
    const p1Initial = {
        x: startPoint.x + unitStartTangent.x * startControlDistance,
        y: startPoint.y + unitStartTangent.y * startControlDistance
    };
    
    const p2Initial = {
        x: endPoint.x - unitEndTangent.x * endControlDistance,
        y: endPoint.y - unitEndTangent.y * endControlDistance
    };
    
    // Apply curvature-based perpendicular adjustments
    // Calculate perpendicular vectors (90 degrees counter-clockwise)
    const startPerpendicular = {
        x: -unitStartTangent.y,
        y: unitStartTangent.x
    };
    
    const endPerpendicular = {
        x: -unitEndTangent.y,
        y: unitEndTangent.x
    };
    
    // Apply curvature offsets perpendicular to tangent directions
    const startPerpendicularOffset = startCurvature * chordLength * 0.05;
    const endPerpendicularOffset = endCurvature * chordLength * 0.05;
    
    const p1 = {
        x: p1Initial.x + startPerpendicular.x * startPerpendicularOffset,
        y: p1Initial.y + startPerpendicular.y * startPerpendicularOffset
    };
    
    const p2 = {
        x: p2Initial.x + endPerpendicular.x * endPerpendicularOffset,
        y: p2Initial.y + endPerpendicular.y * endPerpendicularOffset
    };
    
    return {
        p0: startPoint,
        p1: p1,
        p2: p2,
        p3: endPoint
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

function createCubicFromTangentsCurvatures(startPoint: Point, endPoint: Point, startTangent: Point, endTangent: Point, startCurvature: number, endCurvature: number, tension = 1.0) {
    const unitStartTangent = PointCal.unitVector(startTangent);
    const unitEndTangent = PointCal.unitVector(endTangent);
    
    const chordVector = PointCal.subVector(endPoint, startPoint);
    const chordLength = PointCal.magnitude(chordVector);
    
    // Base control distances
    let startControlDistance = chordLength * tension / 3.0;
    let endControlDistance = chordLength * tension / 3.0;
    
    // Adjust based on curvatures
    const startCurvatureMagnitude = Math.abs(startCurvature);
    if (startCurvatureMagnitude > 0.001) {
        const startCurvatureScale = Math.min(1.5, Math.max(0.3, 1.0 / (startCurvatureMagnitude * chordLength + 1.0)));
        startControlDistance *= startCurvatureScale;
        
        if (startCurvatureMagnitude > 0.02) {
            startControlDistance *= 0.7;
        }
    }
    
    const endCurvatureMagnitude = Math.abs(endCurvature);
    if (endCurvatureMagnitude > 0.001) {
        const endCurvatureScale = Math.min(1.5, Math.max(0.3, 1.0 / (endCurvatureMagnitude * chordLength + 1.0)));
        endControlDistance *= endCurvatureScale;
        
        if (endCurvatureMagnitude > 0.02) {
            endControlDistance *= 0.7;
        }
    }
    
    // Calculate initial control points
    const p1Initial = {
        x: startPoint.x + unitStartTangent.x * startControlDistance,
        y: startPoint.y + unitStartTangent.y * startControlDistance
    };
    
    const p2Initial = {
        x: endPoint.x - unitEndTangent.x * endControlDistance,
        y: endPoint.y - unitEndTangent.y * endControlDistance
    };
    
    // Apply curvature adjustments
    const startPerpendicular = {
        x: -unitStartTangent.y,
        y: unitStartTangent.x
    };
    
    const endPerpendicular = {
        x: -unitEndTangent.y,
        y: unitEndTangent.x
    };
    
    const startCurvatureOffset = startCurvature * chordLength * 0.05;
    const endCurvatureOffset = endCurvature * chordLength * 0.05;
    
    const p1 = {
        x: p1Initial.x + startPerpendicular.x * startCurvatureOffset,
        y: p1Initial.y + startPerpendicular.y * startCurvatureOffset
    };
    
    const p2 = {
        x: p2Initial.x + endPerpendicular.x * endCurvatureOffset,
        y: p2Initial.y + endPerpendicular.y * endCurvatureOffset
    };
    
    return {
        p0: startPoint,
        p1: p1,
        p2: p2,
        p3: endPoint
    };
}
