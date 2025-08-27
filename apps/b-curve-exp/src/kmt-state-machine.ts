import { BCurve } from "@ue-too/curve";
import { type Point } from "@ue-too/math";
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
}

type NewCurveCreationType = "new" | "branchJoint" | "branchTrack" | "extendEndingTrack";

export interface LayoutContext extends BaseContext {
    startCurve: (startingPosition: Point) => void;
    endCurve: (endingPosition: Point) => boolean;
    cancelCurrentCurve: () => void;
    hoveringForEndJoint: (position: Point) => void;
    hoverForStartingPoint: (position: Point) => void;
    insertJointIntoTrackSegment: (startJointNumber: number, endJointNumber: number, atT: number) => void;
    flipEndTangent: () => void;
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
                if(context.previewStartProjection != null){
                    context.startCurve(context.previewStartProjection.projectionPoint);
                } else {
                    context.startCurve(event.position);
                }
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
            return context.newStartJointType != null && context.newStartJointType.type === "branchCurve";
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
                const res = context.endCurve(event.position);
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
        },
        "flipEndTangent": {
            action: (context, event) => {
                context.flipEndTangent();
            },
            defaultTargetState: "HOVER_FOR_ENDING_POINT",
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

    private _currentStartingPoint: Point | null;
    private _hoverPosition: Point | null;
    // private _hoverCircleJointNumber: number | null;
    private _hoverEndPosition: Point | null = null;
    private _previewCurve: BCurve | null;
    private _trackGraph: TrackGraph;

    public projection: ProjectionInfo | null = null;

    // private _startingPointType: "new" | "branchJoint" | "branchTrack" | "extendEndingTrack" = "new";
    private _endingPointJointNumber: number | null = null;

    private _newStartJointType: NewJointType | null = null;

    private _endTangent: Point | null = null;

    private _previewStartProjection: ProjectionPositiveResult | null = null;
    private _previewEndProjection: ProjectionPositiveResult | null = null;

    constructor() {
        this._currentStartingPoint = null;
        this._hoverPosition = null;
        this._previewCurve = null;
        this._trackGraph = new TrackGraph();
    }

    get currentStartingPoint(): Point | null {
        return this._currentStartingPoint;
    }

    get hoverEndPosition(): Point | null {
        return this._hoverEndPosition;
    }

    get newStartJointType(): NewJointType | null {
        return this._newStartJointType;
    }

    startCurve(startingPosition: Point) {

        const res = this._trackGraph.project(startingPosition);
        this._newStartJointType = this.determineNewJointType(startingPosition, res);
        if(this._newStartJointType != null && this._newStartJointType.type === "branchCurve"){
            this._trackGraph.insertJointIntoTrackSegment(this.projection.t0Joint, this.projection.t1Joint, this.projection.atT);
            this._trackGraph.logJoints();
            this._trackGraph.logTrackSegments();
            console.log("branching out from a track segment", this.projection);
        }

        this._currentStartingPoint = this._newStartJointType.position;
        this.projection = null;
    }

    hoverForStartingPoint(position: Point) {
        /** same section */
        const res = this._trackGraph.project(position);
        if(res.hit){
            this._previewStartProjection = res;
        } else {
            this._previewStartProjection = null;
        }
        /** same section */

        const joint = this._trackGraph.pointOnJoint(position);
        const projection = this._trackGraph.projectPointOnTrack(position);

        if(joint !== null){
            const jointPosition = this._trackGraph.getJointPosition(joint.jointNumber);
            if(jointPosition !== null){
            }
        } else {
        }
        if(projection != null){
            this.projection = projection;
        } else {
            this.projection = null;
        }
    }

    flipEndTangent() {
        if(this._endTangent == null){
            return;
        }
        this._endTangent = PointCal.multiplyVectorByScalar(this._endTangent, -1);
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

        const joint = this._trackGraph.pointOnJoint(position);
        const projection = this._trackGraph.projectPointOnTrack(position);

        if(joint != null){
            this._hoverEndPosition = joint.position;
            this._endTangent = joint.tangent;
            this._endingPointJointNumber = joint.jointNumber;
        } else {
            this._hoverEndPosition = null;
            this._endTangent = null;
            this._endingPointJointNumber = null;
        }

        switch(this._newStartJointType.type){
            case "new":
                midPoint = {
                    x: this._currentStartingPoint.x + (this._hoverPosition.x - this._currentStartingPoint.x) / 2,
                    y: this._currentStartingPoint.y + (this._hoverPosition.y - this._currentStartingPoint.y) / 2,
                };
                if(this._previewCurve == null){
                    this._previewCurve = new BCurve([this._currentStartingPoint, midPoint, this._hoverPosition]);
                    return;
                }

                this._previewCurve.setControlPointAtIndex(1, midPoint);
                this._previewCurve.setControlPointAtIndex(2, this._hoverPosition);
                break;
            case "branchJoint":{
                const curPreviewDirection = PointCal.unitVectorFromA2B(this._currentStartingPoint, this._hoverPosition);
                const curvature = this._newStartJointType.constraint.curvature;
                let tangent = this._newStartJointType.constraint.tangent;
                const angleDiff = normalizeAngleZero2TwoPI(PointCal.angleFromA2B(tangent, curPreviewDirection));
                if(angleDiff >= Math.PI / 2 && angleDiff <= 3 * Math.PI / 2){
                    console.info('tangent should be the reversed');
                    tangent = PointCal.multiplyVectorByScalar(tangent, -1);
                }
                if(this._endTangent == null){
                    const previewCurveCPs = createQuadraticFromTangentCurvature(this._currentStartingPoint, this._hoverPosition, tangent, curvature);
                    if(this._previewCurve == null || this._previewCurve.getControlPoints().length !== 3){
                        this._previewCurve = new BCurve([previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2]);
                        return;
                    }
                    this._previewCurve.setControlPointAtIndex(0, previewCurveCPs.p0);
                    this._previewCurve.setControlPointAtIndex(1, previewCurveCPs.p1);
                    this._previewCurve.setControlPointAtIndex(2, previewCurveCPs.p2);
                } else {
                    const previewCurveCPs = createCubicFromTangentsCurvatures(this._currentStartingPoint, this._hoverEndPosition, joint.tangent, this._endTangent, curvature, joint.curvature);
                    if(this._previewCurve == null){
                        this._previewCurve = new BCurve([previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2, previewCurveCPs.p3]);
                    } else {
                        console.log("setting control points for cubic curve");
                        this._previewCurve.setControlPoints([previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2, previewCurveCPs.p3]);
                    }
                }
                break;
            }
            case "branchCurve":{
                break;
            }
            case "extendingTrack":
                console.log("extending track");
                // const previewCurveCPs = createInteractiveQuadratic(this._constrainingCurve.curve, this._hoverPosition, this._constrainingCurve.atT);
                const constraint = this._newStartJointType.constraint;
                const previewCurveCPs = createQuadraticFromTangentCurvature(constraint.projectionPoint, this._hoverPosition, constraint.tangent, constraint.curvature );
                if(this._previewCurve == null){
                    this._previewCurve = new BCurve([previewCurveCPs.p0, previewCurveCPs.p1, previewCurveCPs.p2]);
                    return;
                }
                this._previewCurve.setControlPointAtIndex(0, previewCurveCPs.p0);
                this._previewCurve.setControlPointAtIndex(1, previewCurveCPs.p1);
                this._previewCurve.setControlPointAtIndex(2, previewCurveCPs.p2);
                const curPreviewTangent = PointCal.unitVector(this._previewCurve.derivative(0));
                const angleDiff = PointCal.angleFromA2B(constraint.tangent, curPreviewTangent);
                const angleDiffRad = normalizeAngleZero2TwoPI(angleDiff);
                const jointTangentIsPointingInEmptyDirection = this._trackGraph.tangentIsPointingInEmptyDirection(constraint.jointNumber);
                
                break;
        }


    }

    get previewCurve(): BCurve | null {
        return this._previewCurve;
    }

    get previewStartProjection(): ProjectionPositiveResult | null {
        return this._previewStartProjection;
    }

    get previewEndProjection(): ProjectionPositiveResult | null {
        return this._previewEndProjection;
    }

    endCurve(endingPosition: Point): boolean {
        let res = false;
        if(this._currentStartingPoint === null || this._previewCurve === null) {
            this.cancelCurrentCurve();
            return false;
        }

        const cps = this._previewCurve.getControlPoints().slice(1, -1);
        switch(this._newStartJointType.type){
            case "new":
                res = this._trackGraph.createNewTrackSegment(this._currentStartingPoint, endingPosition, cps);
                break;
            case "branchJoint": {
                const constraint = this._newStartJointType.constraint;
                if(this._endingPointJointNumber != null) {
                    res = this._trackGraph.connectJoints(constraint.jointNumber, this._endingPointJointNumber, cps);
                } else {
                    res = this._trackGraph.branchToNewJoint(constraint.jointNumber, endingPosition, cps);
                }
                break;
            }
            case "branchCurve":
                break;
            case "extendingTrack":
                const constraint = this._newStartJointType.constraint;
                const curPreviewTangent = PointCal.unitVector(this._previewCurve.derivative(0));
                const emptyTangentDirection = this._trackGraph.tangentIsPointingInEmptyDirection(constraint.jointNumber) ? constraint.tangent : PointCal.multiplyVectorByScalar(constraint.tangent, -1);
                const rawAngleDiff = PointCal.angleFromA2B(emptyTangentDirection, curPreviewTangent);
                const angleDiff = normalizeAngleZero2TwoPI(rawAngleDiff);
                if(angleDiff > Math.PI / 2 && angleDiff < 3 * Math.PI / 2){
                    console.log("invalid direction in endCurve");
                    res = false;
                    break;
                }
                res = this._trackGraph.extendTrackFromJoint(constraint.jointNumber, endingPosition, cps);
                break;
        }

        this._hoverPosition = null;
        this._currentStartingPoint = null;
        this._previewCurve = null;
        this._hoverEndPosition = null;
        this._endingPointJointNumber = null;
        this._endTangent = null;
        this._previewStartProjection = null;
        this._newStartJointType = null;
        this._trackGraph.logJoints();
        return res;
    }

    insertJointIntoTrackSegment(startJointNumber: number, endJointNumber: number, atT: number) {
        this._trackGraph.insertJointIntoTrackSegment(startJointNumber, endJointNumber, atT);
        this._trackGraph.logJoints();
    }

    cancelCurrentCurve() {
        this._previewStartProjection = null;
        this._currentStartingPoint = null;
        this._hoverPosition = null;
        this._previewCurve = null;
        this.projection = null;
        this._hoverEndPosition = null;
        this._endingPointJointNumber = null;
        this._endTangent = null;
        this._newStartJointType = null;
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
    
    const mouseDirection = PointCal.unitVectorFromA2B(startPoint, endPoint);

    const rawAngleDiff = PointCal.angleFromA2B(unitTangent, mouseDirection);
    const angleDiff = normalizeAngleZero2TwoPI(rawAngleDiff);

    // NOTE: + or - 90 degrees should reverse the tangent direction
    if(angleDiff >= Math.PI / 2 && angleDiff <= 3 * Math.PI / 2){
        unitTangent = PointCal.multiplyVectorByScalar(unitTangent, -1);
    }
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
