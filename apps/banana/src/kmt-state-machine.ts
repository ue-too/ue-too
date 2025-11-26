import { BCurve } from "@ue-too/curve";
import { directionAlignedToTangent, sameDirection, type Point } from "@ue-too/math";
import type { StateMachine, BaseContext, EventReactions, EventGuards, Guard } from "@ue-too/being";
import { NO_OP, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { ELEVATION, ProjectionCurveResult, ProjectionEdgeResult, ProjectionJointResult, ProjectionPositiveResult, ProjectionResult, TrackGraph } from "./track";
import { PointCal, normalizeAngleZero2TwoPI } from "@ue-too/math";
import { Observable, Observer, SynchronousObservable } from "@ue-too/board";
import { PreviewCurveCalculator } from "./new-joint";


export type LayoutStates = "IDLE" | "HOVER_FOR_STARTING_POINT" | "HOVER_FOR_ENDING_POINT" | "HOVER_FOR_CURVE_DELETION";

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
    "toggleStraightLine": {};
    "startDeletion": {};
    "endDeletion": {};
    "scroll": {
        positive: boolean;
    };
}

export interface LayoutContext extends BaseContext {
    startCurve: () => void;
    endCurve: () => Point | null;
    cancelCurrentCurve: () => void;
    hoveringForEndJoint: (position: Point) => void;
    hoverForStartingPoint: (position: Point) => void;
    insertJointIntoTrackSegment: (startJointNumber: number, endJointNumber: number, atT: number) => void;
    flipEndTangent: () => void;
    flipStartTangent: () => void;
    toggleStraightLine: () => void;
    hoverForCurveDeletion: (position: Point) => void;
    deleteCurrentCurve: () => void;
    cancelCurrentDeletion: () => void;
    setCurrentJointElevation: (elevation: ELEVATION) => void;
    bumpCurrentJointElevation: () => void;
    lowerCurrentJointElevation: () => void;
    bumpStartJointElevation: () => void;
    lowerStartJointElevation: () => void;
    bumpEndJointElevation: () => void;
    lowerEndJointElevation: () => void;
    previewStartProjection: ProjectionPositiveResult | null;
    newStartJointType: NewJointType | null;
    lastCurveSuccess: boolean;
}

class LayoutIDLEState extends TemplateState<LayoutEvents, LayoutContext, LayoutStates> {

    constructor() {
        super();
    }

    _eventReactions: EventReactions<LayoutEvents, LayoutContext, LayoutStates> = {
        "startLayout": {
            action: NO_OP,
            defaultTargetState: "HOVER_FOR_STARTING_POINT",
        },
        "startDeletion": {
            action: NO_OP,
            defaultTargetState: "HOVER_FOR_CURVE_DELETION",
        },
    };

    get eventReactions() {
        return this._eventReactions;
    }

}

class LayoutHoverForCurveDeletionState extends TemplateState<LayoutEvents, LayoutContext, LayoutStates> {
    constructor() {
        super();
    }

    _eventReactions: EventReactions<LayoutEvents, LayoutContext, LayoutStates> = {
        "pointermove": {
            action: (context, event) => {
                context.hoverForCurveDeletion(event.position);
            }
        },
        "pointerup": {
            action: (context, event) => {
                // context.deleteCurrentCurve();
                context.deleteCurrentCurve();
            },
            defaultTargetState: "HOVER_FOR_CURVE_DELETION",
        },
        "endDeletion": {
            action: (context, event) => {
                context.cancelCurrentDeletion();
            },
            defaultTargetState: "IDLE",
        },
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
        "escapeKey": {
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
        },
        "startDeletion": {
            action: (context, event) => {
                context.cancelCurrentCurve();
            },
            defaultTargetState: "HOVER_FOR_CURVE_DELETION",
        },
        "scroll": {
            action: (context, event) => {
                if(event.positive){
                    context.bumpStartJointElevation();
                } else {
                    context.lowerStartJointElevation();
                }
            },
        }
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
                const res = context.endCurve();
                if(res == null) {
                    return;
                }
                context.hoverForStartingPoint(res);
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
        },
        "flipStartTangent": {
            action: (context, event) => {
                context.flipStartTangent();
            },
        },
        "toggleStraightLine": {
            action: (context, event) => {
                context.toggleStraightLine();
            },
        },
        "startDeletion": {
            action: (context, event) => {
                context.cancelCurrentCurve();
            },
            defaultTargetState: "HOVER_FOR_CURVE_DELETION",
        },
        "scroll": {
            action: (context, event) => {
                if(event.positive){
                    context.bumpEndJointElevation();
                } else {
                    context.lowerEndJointElevation();
                }
            },
        }
    };

    protected _guards: Guard<LayoutContext, string> = {
        "lastCurveNotSuccess": (context) => {
            return !context.lastCurveSuccess;
        }
    };

    protected _eventGuards: Partial<EventGuards<LayoutEvents, LayoutStates, LayoutContext, Guard<LayoutContext, string>>> = {
        "pointerup": [
            {
                guard: "lastCurveNotSuccess",
                target: "HOVER_FOR_STARTING_POINT",
            }
        ]
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
            "HOVER_FOR_CURVE_DELETION": new LayoutHoverForCurveDeletionState(),
        },
        "IDLE",
        context
    );
    return stateMachine;
}

export type BrandNewJoint = {
    type: "new";
} & BaseJoint;

export type BaseJoint = {
    position: Point;
    elevation: ELEVATION;
}

export type ConstrainedNewJoint = {
    type: "contrained";
    constraint: ProjectionEdgeResult;
} & BaseJoint;

export type BranchJoint = {
    type: "branchJoint";
    constraint: ProjectionJointResult;
} & BaseJoint;

export type ExtendingTrackJoint = {
    type: "extendingTrack";
    constraint: ProjectionJointResult;
} & BaseJoint;

export type BranchCurveJoint = {
    type: "branchCurve";
    constraint: ProjectionCurveResult;
} & BaseJoint;

export type NewJointType = BrandNewJoint | BranchJoint | ExtendingTrackJoint | BranchCurveJoint | ConstrainedNewJoint;

export class CurveCreationEngine implements LayoutContext {

    private _trackGraph: TrackGraph;

    private _newStartJoint: NewJointType | null = null;
    private _newEndJoint: NewJointType | null = null;

    private _previewStartProjection: ProjectionPositiveResult | null = null;
    private _previewEndProjection: ProjectionPositiveResult | null = null;

    private _previewCurve: {
        curve: BCurve;
        previewStartAndEndSwitched: boolean; 
        elevation: {
            from: ELEVATION;
            to: ELEVATION;
        }
    } | null = null;

    private _lastCurveSuccess: boolean = false;

    private _previewCurveForDeletion: number | null = null;

    public _currentJointElevation: ELEVATION | null = null;
    private _startJointElevation: ELEVATION | null = null;
    private _elevationObservable: Observable<[ELEVATION | null]> = new SynchronousObservable<[ELEVATION | null]>();

    private _previewCurveCalculator: PreviewCurveCalculator = new PreviewCurveCalculator();

    constructor() {
        this._trackGraph = new TrackGraph();
    }

    get newStartJointType(): NewJointType | null {
        return this._newStartJoint;
    }

    get lastCurveSuccess(): boolean {
        return this._lastCurveSuccess;
    }

    get previewCurveForDeletion(): BCurve | null {
        const res = this._previewCurveForDeletion !== null ? this._trackGraph.getTrackSegmentCurve(this._previewCurveForDeletion) : null;
        return res;
    }

    startCurve() {
        // this.cancelCurrentCurve();
    }

    setCurrentJointElevation(elevation: ELEVATION) {
        if(elevation != this._currentJointElevation){
            this._elevationObservable.notify(elevation);
        }
        this._currentJointElevation = elevation;
    }

    bumpStartJointElevation() {
        if(this._newStartJoint !== null && (this._newStartJoint.type === "branchCurve" || this._newStartJoint.type === "branchJoint")){
            return;
        }
        const currentElevation = this._currentJointElevation != null ? this._currentJointElevation : ELEVATION.GROUND;
        if(currentElevation >= ELEVATION.ABOVE_3){
            return;
        }
        this._currentJointElevation = currentElevation + 1;
        this._elevationObservable.notify(this._currentJointElevation);
        if(this._newStartJoint === null){
            return;
        }
        this._newStartJoint.elevation = currentElevation + 1;
        if(this._newEndJoint === null){
            return;
        }
        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    bumpEndJointElevation() {
        if(this._newStartJoint !== null && (this._newStartJoint.type === "branchCurve" || this._newStartJoint.type === "branchJoint")){
            return;
        }
        const currentElevation = this._currentJointElevation != null ? this._currentJointElevation : ELEVATION.GROUND;
        if(currentElevation >= ELEVATION.ABOVE_3){
            return;
        }
        this._currentJointElevation = currentElevation + 1;
        this._elevationObservable.notify(this._currentJointElevation);
        if(this._newEndJoint === null){
            return;
        }
        this._newEndJoint.elevation = currentElevation + 1;
        if(this._newStartJoint === null){
            return;
        }
        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    bumpCurrentJointElevation() {
        if(this._newStartJoint !== null && (this._newStartJoint.type === "branchCurve" || this._newStartJoint.type === "branchJoint")){
            return;
        }
        const currentElevation = this._currentJointElevation != null ? this._currentJointElevation : ELEVATION.GROUND;
        if(currentElevation >= ELEVATION.ABOVE_3){
            return;
        }
        this._currentJointElevation = currentElevation + 1;
        this._elevationObservable.notify(this._currentJointElevation);
    }

    lowerStartJointElevation() {
        if(this._newStartJoint !== null && (this._newStartJoint.type === "branchCurve" || this._newStartJoint.type === "branchJoint")){
            return;
        }
        const currentElevation = this._currentJointElevation != null ? this._currentJointElevation : ELEVATION.GROUND;
        if(currentElevation <= ELEVATION.SUB_3){
            return;
        }
        this._currentJointElevation = currentElevation - 1;
        this._elevationObservable.notify(this._currentJointElevation);
        if(this._newStartJoint === null){
            return;
        }
        this._newStartJoint.elevation = currentElevation - 1;
        if(this._newEndJoint === null){
            return;
        }
        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    lowerEndJointElevation() {
        if(this._newStartJoint !== null && (this._newStartJoint.type === "branchCurve" || this._newStartJoint.type === "branchJoint")){
            return;
        }
        const currentElevation = this._currentJointElevation != null ? this._currentJointElevation : ELEVATION.GROUND;
        if(currentElevation <= ELEVATION.SUB_3){
            return;
        }
        this._currentJointElevation = currentElevation - 1;
        this._elevationObservable.notify(this._currentJointElevation);
        if(this._newEndJoint === null){
            return;
        }
        this._newEndJoint.elevation = currentElevation - 1;
        if(this._newStartJoint === null){
            return;
        }
        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    lowerCurrentJointElevation() {
        if(this._newStartJoint !== null && (this._newStartJoint.type === "branchCurve" || this._newStartJoint.type === "branchJoint")){
            return;
        }
        const currentElevation = this._currentJointElevation != null ? this._currentJointElevation : ELEVATION.GROUND;
        if(currentElevation <= ELEVATION.SUB_3){
            return;
        }
        this._currentJointElevation = currentElevation - 1;
        this._elevationObservable.notify(this._currentJointElevation);
    }

    onElevationChange(observer: Observer<[ELEVATION | null]>) {
        this._elevationObservable.subscribe(observer);
    }

    hoverForCurveDeletion(position: Point) {
        const res = this._trackGraph.project(position);
        if(res.hit && res.hitType === "curve") {
            this._previewCurveForDeletion = res.curve;
        } else {
            this._previewCurveForDeletion = null;
        }
    }

    hoverForStartingPoint(position: Point) {
        const res = this._trackGraph.project(position);
        const elevation = this._currentJointElevation != null ? this._currentJointElevation : ELEVATION.GROUND;
        this._newStartJoint = this.determineNewJointType(position, res, elevation);
        if(res.hit){
            this._previewStartProjection = res;
        } else {
            this._previewStartProjection = null;
        }
    }

    flipStartTangent() {
        this._previewCurveCalculator.toggleStartTangentFlip();
        if(this._newStartJoint === null){
            return;
        }
        if(this._newEndJoint === null){
            return;
        }
        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    private _updatePreviewCurve(startJoint: NewJointType, endJoint: NewJointType){
        const newPreviewCurve = this._previewCurveCalculator.getPreviewCurve(startJoint, endJoint);
        if(this._previewCurve == null){
            this._previewCurve = {
                curve: new BCurve(newPreviewCurve.cps),
                previewStartAndEndSwitched: newPreviewCurve.startAndEndSwitched,
                elevation: newPreviewCurve.startAndEndSwitched ? {
                    from: endJoint.elevation,
                    to: startJoint.elevation,
                } : {
                    from: startJoint.elevation,
                    to: endJoint.elevation,
                }
            };
        } else {
            this._previewCurve.curve.setControlPoints(newPreviewCurve.cps);
            this._previewCurve.previewStartAndEndSwitched = newPreviewCurve.startAndEndSwitched;
            this._previewCurve.elevation = newPreviewCurve.startAndEndSwitched ? {
                from: endJoint.elevation,
                to: startJoint.elevation,
            } : {
                from: startJoint.elevation,
                to: endJoint.elevation,
            };
        }
    }

    flipEndTangent() {
        this._previewCurveCalculator.toggleEndTangentFlip();
        if(this._newStartJoint === null){
            return;
        }
        if(this._newEndJoint === null){
            return;
        }
        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    toggleStraightLine() {
        this._previewCurveCalculator.toggleStraightLine();
        if(this._newStartJoint === null){
            return;
        }
        if(this._newEndJoint === null){
            return;
        }
        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    hoveringForEndJoint(position: Point) {
        if(this._newStartJoint == null) {
            return;
        }

        const res = this._trackGraph.project(position);
        const elevation = this._currentJointElevation != null ? this._currentJointElevation : ELEVATION.GROUND;
        this._newEndJoint = this.determineNewJointType(position, res, elevation);

        if(res.hit){
            this._previewEndProjection = res;
        } else {
            this._previewEndProjection = null;
        }

        this._updatePreviewCurve(this._newStartJoint, this._newEndJoint);
    }

    get previewCurve(): {
        curve: BCurve;
        previewStartAndEndSwitched: boolean;
        elevation: {
            from: ELEVATION;
            to: ELEVATION;
        }
    } | null {
        return this._previewCurve;
    }

    get previewStartProjection(): ProjectionPositiveResult | null {
        return this._previewStartProjection;
    }

    get previewEndProjection(): ProjectionPositiveResult | null {
        return this._previewEndProjection;
    }

    get newEndJointType(): NewJointType | null {
        return this._newEndJoint;
    }

    endCurve(): Point | null {
        const res = this.endCurveInternal();
        console.log("endCurve", res);
        if(res !== null) {
            this._lastCurveSuccess = true;
        } else {
            this.cancelCurrentCurve();
            this._lastCurveSuccess = false;
        }

        return res;
    }

    deleteCurrentCurve(){
        if(this._previewCurveForDeletion === null){
            return;
        }
        console.log('deleteCurrentCurve', this._previewCurveForDeletion);
        this._trackGraph.removeTrackSegment(this._previewCurveForDeletion);
        this._previewCurveForDeletion = null;
    }

    private endCurveInternal(): Point | null {
        
        let res: Point | null = null;

        if(this._newStartJoint === null || this._previewCurve === null || this._newEndJoint === null) {
            this.cancelCurrentCurve();
            return null;
        }

        const cps = this._previewCurve.curve.getControlPoints().slice(1, -1);

        console.log("preview curve", this._previewCurve.curve.getControlPoints());
        console.log("cps", cps);

        let startJointNumber: number | null = null;
        let endJointNumber: number | null = null;

        // TODO maybe turn this into a validation pipeline function and add other edge cases?
        if(this._newStartJoint.type === "extendingTrack"){
            const startJointNumber = this._newStartJoint.constraint.jointNumber;
            const startJointTangent = this._newStartJoint.constraint.tangent;
            const previewCurveTangent = this._previewCurve.previewStartAndEndSwitched ? this._previewCurve.curve.derivative(1) : this._previewCurve.curve.derivative(0);
            if(this._previewCurve.previewStartAndEndSwitched){
                console.log("start and end point switched in preview curve")
            } else {
                console.log("start and end point not switched in preview curve")
            }
            if(!extendTrackIsPossible(startJointNumber, startJointTangent, previewCurveTangent, this._trackGraph)){
                console.warn('extend track not possible for start joint');
                this.cancelCurrentCurve();
                return null;
            }
        }

        if(this._newEndJoint.type === "extendingTrack"){
            console.log('checking extend track possible for end joint');
            const startJointNumber = this._newEndJoint.constraint.jointNumber;
            const startJointTangent = this._newEndJoint.constraint.tangent;
            const previewCurveTangentInTheDirectionToOtherJoint = this._previewCurve.previewStartAndEndSwitched ? this._previewCurve.curve.derivative(0) : PointCal.multiplyVectorByScalar(this._previewCurve.curve.derivative(1), -1);
            if(!extendTrackIsPossible(startJointNumber, startJointTangent, previewCurveTangentInTheDirectionToOtherJoint, this._trackGraph)){
                console.warn('extend track not possible for end joint');
                this.cancelCurrentCurve();
                return null;
            }
        }

        if(this._newStartJoint.type == "branchCurve" || this._newStartJoint.type == "branchJoint" || this._newEndJoint.type == "branchCurve" || this._newEndJoint.type == "branchJoint"){
            if(this._newStartJoint.elevation != this._newEndJoint.elevation){
                return null;
            }
        }

        // END OF VALIDATION PIPELINE

        if(this._newStartJoint.type === "new" || this._newStartJoint.type === "contrained"){
            const startTangent = this._previewCurve.previewStartAndEndSwitched ? 
            PointCal.unitVector(this._previewCurve.curve.derivative(1)) : PointCal.unitVector(this._previewCurve.curve.derivative(0));
            startJointNumber = this._trackGraph.createNewEmptyJoint(this._newStartJoint.position, startTangent, this._newStartJoint.elevation);
        } else if(this._newStartJoint.type === "branchCurve"){
            const constraint = this._newStartJoint.constraint;
            const trackSegmentNumber = constraint.curve;
            startJointNumber = this._trackGraph.insertJointIntoTrackSegmentUsingTrackNumber(trackSegmentNumber, constraint.atT);
        }else {
            startJointNumber = this._newStartJoint.constraint.jointNumber;
        }

        if(this._newEndJoint.type === "new" || this._newEndJoint.type === "contrained"){
            if(this._newEndJoint.type === "new"){
                const previewCurveStartAndEndSwitched = this._previewCurve.previewStartAndEndSwitched;
                const endTangent = previewCurveStartAndEndSwitched ? 
                PointCal.unitVector(this._previewCurve.curve.derivative(0)) : PointCal.unitVector(this._previewCurve.curve.derivative(1));
                const previewCurveCPs = this._previewCurve.curve.getControlPoints();
                const endPosition = previewCurveStartAndEndSwitched ? previewCurveCPs[0] : previewCurveCPs[previewCurveCPs.length - 1];
                res = endPosition;
                endJointNumber = this._trackGraph.createNewEmptyJoint(endPosition, endTangent, this._newEndJoint.elevation);
            } else {
                res = this._newEndJoint.position;
                endJointNumber = this._trackGraph.createNewEmptyJoint(this._newEndJoint.position, this._newEndJoint.constraint.tangent, this._newEndJoint.elevation);
            }
        } else if (this._newEndJoint.type === "branchCurve"){
            const constraint = this._newEndJoint.constraint;
            const trackSegmentNumber = constraint.curve;
            res = constraint.projectionPoint;
            endJointNumber = this._trackGraph.insertJointIntoTrackSegmentUsingTrackNumber(trackSegmentNumber, constraint.atT);
        }else {
            res = this._newEndJoint.position;
            endJointNumber = this._newEndJoint.constraint.jointNumber;
        }

        if(startJointNumber === null || endJointNumber === null){
            if(startJointNumber === null){
                console.warn('startJointNumber is null');
            }
            if(endJointNumber === null){
                console.warn('endJointNumber is null');
            }
            this.cancelCurrentCurve();
            return null;
        }

        this._trackGraph.connectJoints(startJointNumber, endJointNumber, cps);
        this._trackGraph.logJoints();
        this.cancelCurrentCurve();

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
        this._newStartJoint = null;
        this._newEndJoint = null;
    }

    cancelCurrentDeletion(){
        this._previewCurveForDeletion = null;
    }

    setup() {

    }

    cleanup() {

    }

    get trackGraph(): TrackGraph {
        return this._trackGraph;
    }

    determineNewJointType(rawPosition: Point, projection: ProjectionResult, elevation: ELEVATION = ELEVATION.GROUND): NewJointType {
        if(!projection.hit){
            return {
                type: "new",
                position: rawPosition,
                elevation: elevation,
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
                        elevation: elevation,
                    };
                } else {
                    // branching out from a joint that is not an ending track
                    return {
                        type: "branchJoint",
                        position: projection.projectionPoint,
                        constraint: projection,
                        elevation: elevation,
                    }
                }
            case "curve":
                return {
                    type: "branchCurve",
                    position: projection.projectionPoint,
                    constraint: projection,
                    elevation: elevation,
                }
            case "edge":
                return {
                    type: "contrained",
                    position: projection.projectionPoint,
                    constraint: projection,
                    elevation: elevation,
                }
        }
    }
}


// TODO: deprecate
function getPreviewCurve(
    newStartJointType: NewJointType, 
    newEndJointType: NewJointType, 
    previewStartTangentFlipped: boolean, 
    previewEndTangentFlipped: boolean, 
    extendAsStraightLine: boolean = false,
): 
    {
        cps: Point[] // including start and end preview points
        startAndEndSwitched: boolean; // sometimes the new curve would go from end (as t = 0) to start (as t = 1)
        shouldToggleStartTangentFlip: boolean;
        shouldToggleEndTangentFlip: boolean;
    } | null
{

    // simplified logic for different combinations of new joint types
    if(newEndJointType.type === "new" && (newStartJointType.type === "new" || extendAsStraightLine)) {
        // a straight line

        let {flipped: tangentCalibrated, tangent: startTangent} = calibrateTangent(newStartJointType.type !== "new" ? newStartJointType.constraint.tangent : PointCal.unitVectorFromA2B(newStartJointType.position, newEndJointType.position), newStartJointType.position, newEndJointType.position);
        startTangent = previewStartTangentFlipped ? PointCal.multiplyVectorByScalar(startTangent, -1) : startTangent;

        startTangent = PointCal.unitVector(startTangent);

        const rawEndPositionRelativeToStart = PointCal.subVector(newEndJointType.position, newStartJointType.position);
        const adjustedEndPosition = PointCal.addVector(newStartJointType.position, PointCal.multiplyVectorByScalar(startTangent, PointCal.dotProduct(startTangent, rawEndPositionRelativeToStart)));

        const midPoint = {
            x: newStartJointType.position.x + (adjustedEndPosition.x - newStartJointType.position.x) / 2,
            y: newStartJointType.position.y + (adjustedEndPosition.y - newStartJointType.position.y) / 2,
        }

        return {
            cps: [newStartJointType.position, midPoint, adjustedEndPosition],
            startAndEndSwitched: false,
            shouldToggleEndTangentFlip: false,
            shouldToggleStartTangentFlip: tangentCalibrated && previewStartTangentFlipped,
        };
    } else if(newStartJointType.type === "new" && newEndJointType.type !== "new") {
        // reversed quadratic curve

        let {flipped: tangentCalibrated, tangent} = calibrateTangent(newEndJointType.constraint.tangent, newEndJointType.position, newStartJointType.position);
        tangent = previewEndTangentFlipped ? PointCal.multiplyVectorByScalar(tangent, -1) : tangent;
        const curvature = newEndJointType.constraint.curvature;
        const previewCurveCPs = createQuadraticFromTangentCurvature(newEndJointType.position, newStartJointType.position, tangent, curvature);
        // const previewCurveCPs = createCubicFromTangentsCurvaturesV2(newEndJointType.position, newStartJointType.position, {tangent, curvature});
        return {
            cps: [previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2],
            startAndEndSwitched: true,
            shouldToggleStartTangentFlip: false,
            shouldToggleEndTangentFlip: tangentCalibrated && previewEndTangentFlipped,
        };

    } else if(newEndJointType.type === "new" && newStartJointType.type !== "new") {
        // quadratic curve

        let {flipped: tangentCalibrated, tangent} = calibrateTangent(newStartJointType.constraint.tangent, newStartJointType.position, newEndJointType.position);
        tangent = previewStartTangentFlipped ? PointCal.multiplyVectorByScalar(tangent, -1) : tangent;
        const curvature = newStartJointType.constraint.curvature;
        // branch to a new joint
        // const previewCurveCPs = createCubicFromTangentsCurvaturesV2(newStartJointType.position, newEndJointType.position, {tangent, curvature});
        const previewCurveCPs = createQuadraticFromTangentCurvature(newStartJointType.position, newEndJointType.position, tangent, curvature);
        return {
            cps: [previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2],
            startAndEndSwitched: false,
            shouldToggleEndTangentFlip: false,
            shouldToggleStartTangentFlip: tangentCalibrated && previewStartTangentFlipped,
        };
    } else if(newStartJointType.type !== "new" && newEndJointType.type !== "new") {
        // cubic curve

        let {flipped: tangentCalibrated, tangent} = calibrateTangent(newStartJointType.constraint.tangent, newStartJointType.position, newEndJointType.position);
        tangent = previewStartTangentFlipped ? PointCal.multiplyVectorByScalar(tangent, -1) : tangent;
        const curvature = newStartJointType.constraint.curvature;
        let endTangentCalibrated = false;
        let endTangent = newEndJointType.constraint.tangent;

        if(newEndJointType.type === "extendingTrack"){
            let {flipped, tangent } = calibrateTangent(newEndJointType.constraint.tangent, newEndJointType.position, newStartJointType.position);
            endTangent = tangent;
            endTangentCalibrated = flipped;
        }

        const previewEndTangent = previewEndTangentFlipped ? PointCal.multiplyVectorByScalar(endTangent, -1) : endTangent;
        const previewCurveCPs = createCubicFromTangentsCurvatures(newStartJointType.position, newEndJointType.position, tangent, previewEndTangent, curvature, newEndJointType.constraint.curvature);
        return {
            cps: [previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2, previewCurveCPs.p3],
            startAndEndSwitched: false,
            shouldToggleEndTangentFlip: false,
            shouldToggleStartTangentFlip: tangentCalibrated && previewStartTangentFlipped,
        };
    } else {
        return null;
    }
}

function extendTrackIsPossible(startJointNumber: number, startJointTangent: Point, previewCurveTangentInTheDirectionToOtherJoint: Point, trackGraph: TrackGraph){
    const jointTangentIsPointingInEmptyDirection = trackGraph.tangentIsPointingInEmptyDirection(startJointNumber);
    const emptyTangentDirection = jointTangentIsPointingInEmptyDirection ? startJointTangent : PointCal.multiplyVectorByScalar(startJointTangent, -1);

    if(directionAlignedToTangent(emptyTangentDirection, previewCurveTangentInTheDirectionToOtherJoint)){
        return true;
    }

    return false;
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

export function createCubicFromTangentsCurvatures(startPoint: Point, endPoint: Point, startTangent: Point, endTangent: Point, startCurvature: number, endCurvature: number, tension = 1.0) {
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
    curvature: number,
    tension = 1.5
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
    let controlDistance = chordLength * tension / 3.0;
    
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
