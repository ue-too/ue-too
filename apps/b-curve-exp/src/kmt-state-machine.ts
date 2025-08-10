import { BCurve } from "@ue-too/curve";
import { type Point } from "@ue-too/math";
import type { StateMachine, BaseContext, EventReactions } from "@ue-too/being";
import { NO_OP, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { TrackGraph } from "./track";
import { PointCal } from "@ue-too/math";


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

export interface LayoutContext extends BaseContext {
    startCurve: (startingPosition: Point) => void;
    endCurve: (endingPosition: Point) => void;
    cancelCurrentCurve: () => void;
    setHoverPosition: (position: Point) => void;
    hoverForStartingPoint: (position: Point) => void;
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
        "escapeKey": {
            action: (context) => {
                context.cancelCurrentCurve();
            },
            defaultTargetState: "IDLE",
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
                context.endCurve(event.position);
                context.startCurve(event.position);
            },
            defaultTargetState: "HOVER_FOR_ENDING_POINT",
        },
        "pointermove": {
            action: (context, event) => {
                context.setHoverPosition(event.position);
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
    private _curves: BCurve[] = [];
    private _hoverPosition: Point | null;
    private _hoverCirclePosition: Point | null;
    private _hoverCircleJointNumber: number | null;
    private _previewCurve: BCurve | null;
    private _trackGraph: TrackGraph;

    constructor() {
        this._currentStartingPoint = null;
        this._hoverPosition = null;
        this._previewCurve = null;
        this._trackGraph = new TrackGraph();
    }

    startCurve(startingPosition: Point) {
        let newPosition = startingPosition;
        if(this._hoverCircleJointNumber != null){
            // starting on an existing joint
            console.log("starting on an existing joint", this._hoverCircleJointNumber);
            newPosition = this._trackGraph.getJointPosition(this._hoverCircleJointNumber);
        }
        this._currentStartingPoint = newPosition;
    }

    hoverForStartingPoint(position: Point) {
        const joint = this._trackGraph.pointOnJoint(position);
        if(joint !== null){
            const jointPosition = this._trackGraph.getJointPosition(joint.jointNumber);
            if(jointPosition !== null){
                this._hoverCirclePosition = jointPosition;
                this._hoverCircleJointNumber = joint.jointNumber;
            }
        } else {
            this._hoverCirclePosition = null;
        }
    }

    setHoverPosition(position: Point) {
        this._hoverPosition = position;
        if(this._currentStartingPoint === null) {
            return;
        }

        const midPoint = {
            x: this._currentStartingPoint.x,
            y: this._currentStartingPoint.y + (this._hoverPosition.y - this._currentStartingPoint.y),
        }

        if(this._previewCurve == null){
            this._previewCurve = new BCurve([this._currentStartingPoint, midPoint, this._hoverPosition]);
            return;
        }

        this._previewCurve.setControlPointAtIndex(1, midPoint);
        this._previewCurve.setControlPointAtIndex(2, this._hoverPosition);
    }

    get previewCurve(): BCurve | null {
        return this._previewCurve;
    }

    get curves(): BCurve[] {
        return this._curves;
    }

    get hoverCirclePosition(): Point | null {
        return this._hoverCirclePosition;
    }

    endCurve(endingPosition: Point) {
        if(this._currentStartingPoint === null) {
            return;
        }

        const midPoint = {
            x: this._currentStartingPoint.x,
            y: this._currentStartingPoint.y + (endingPosition.y - this._currentStartingPoint.y),
        }

        const curve = new BCurve([this._currentStartingPoint, midPoint, endingPosition]);
        this._curves.push(curve);
        this._hoverPosition = null;
        this._trackGraph.addJointPosition(this._currentStartingPoint);
        this._trackGraph.createNewTrackSegment(this._currentStartingPoint, endingPosition, [midPoint]);
        this._currentStartingPoint = null;
        this._previewCurve = null;
        this._trackGraph.addJointPosition(endingPosition);
        this._hoverCircleJointNumber = null;
        this._hoverCirclePosition = null;
    }

    cancelCurrentCurve() {
        this._currentStartingPoint = null;
        this._hoverPosition = null;
        this._previewCurve = null;
    }

    setup() {

    }

    cleanup() {

    }

    get trackGraph(): TrackGraph {
        return this._trackGraph;
    }
}

function createInteractiveQuadratic(existingCurve: BCurve, mousePos: Point) {
    const controlPoints = existingCurve.getControlPoints();
    const endPoint = controlPoints[controlPoints.length - 1];
    const curvature = existingCurve.curvature(1);
    const tangent = existingCurve.derivative(1);
    const unitTangent = PointCal.unitVector(tangent);
    const mouseDistance = PointCal.distanceBetweenPoints(endPoint, mousePos);
    
    // Adaptive control distance based on mouse position
    let controlDistance = Math.min(mouseDistance * 0.4, 120);
    
    // Curvature-based adjustment for smoothness
    const curvatureMagnitude = Math.abs(curvature);
    if (curvatureMagnitude > 0.015) {
        controlDistance *= 0.7; // Tighter control for high curvature
    }
    
    // Prevent extreme angles
    const mouseVector = {
        x: mousePos.x - endPoint.x,
        y: mousePos.y - endPoint.y
    };
    const angleToMouse = Math.atan2(mouseVector.y, mouseVector.x);
    const tangentAngle = Math.atan2(tangent.y, tangent.x);
    const angleDiff = Math.abs(angleToMouse - tangentAngle);
    
    if (angleDiff > Math.PI / 2) {
        controlDistance *= 0.5; // Reduce control distance for sharp turns
    }
    
    return {
        p0: endPoint,
        p1: {
            x: endPoint.x + unitTangent.x * controlDistance,
            y: endPoint.y + unitTangent.y * controlDistance
        },
        p2: mousePos
    };
}
