import { PointCal } from "point2point";
import type { Point} from "src/index";
import { EventAction, StateMachine, TemplateState, TemplateStateMachine } from "src/being/interfaces";

export type TouchStates = "IDLE" | "PENDING" | "IN_PROGRESS";

export type TouchContext = {
    addTouchPoints: (points: TouchPoints[]) => void;
    removeTouchPoints: (idents: number[]) => void;
    getCurrentTouchPointsCount: () => number;
    getInitialTouchPointsPositions: (idents: number[]) => TouchPoints[];
    updateTouchPoints: (pointsMoved: TouchPoints[]) => void;
    notifyOnPan: (delta: Point) => void;
}

export type TouchPoints = {
    ident: number,
    x: number,
    y: number,
}

export type TouchEventPayload = {
    points: TouchPoints[];
};

export type TouchEventMapping = {
    touchstart: TouchEventPayload;
    touchmove: TouchEventPayload;
    touchend: TouchEventPayload;
}

type TouchStateMachine = StateMachine<TouchEventMapping, TouchContext, TouchStates>;
type TouchEventReaction = Partial<EventAction<TouchEventMapping, TouchContext, TouchStates>>;


export class IdleState extends TemplateState<TouchEventMapping, TouchContext, TouchStates> {

    private _eventReactions: Partial<EventAction<TouchEventMapping, TouchContext, TouchStates>> = {
        touchstart: this.touchstart,
        touchend: this.touchend,
    };

    get eventReactions(): Partial<EventAction<TouchEventMapping, TouchContext, TouchStates>> {
        return this._eventReactions;
    }

    touchstart(stateMachine: TouchStateMachine, context: TouchContext, payload: TouchEventPayload): TouchStates {
        context.addTouchPoints(payload.points);
        if(context.getCurrentTouchPointsCount() === 2){
            return "PENDING";
        }
        return "IDLE";
    }

    touchend(stateMachine: TouchStateMachine, context: TouchContext, payload: TouchEventPayload): TouchStates {
        context.removeTouchPoints(payload.points.map(p => p.ident));
        if(context.getCurrentTouchPointsCount() === 2){
            return "PENDING";
        }
        return "IDLE";
    }
}

export class PendingState extends TemplateState<TouchEventMapping, TouchContext, TouchStates> {

    private _eventReactions: Partial<EventAction<TouchEventMapping, TouchContext, TouchStates>> = {
        touchstart: this.touchstart,
        touchend: this.touchend,
        touchmove: this.touchmove,
    };

    get eventReactions(): Partial<EventAction<TouchEventMapping, TouchContext, TouchStates>> {
        return this._eventReactions;
    }

    touchstart(stateMachine: TouchStateMachine, context: TouchContext, payload: TouchEventPayload): TouchStates {
        context.addTouchPoints(payload.points);
        return "IDLE";
    }

    touchend(stateMachine: TouchStateMachine, context: TouchContext, payload: TouchEventPayload): TouchStates {
        console.log("PENDING touchend", payload.points);
        context.removeTouchPoints(payload.points.map(p => p.ident));
        if(context.getCurrentTouchPointsCount() === 2){
            return "IN_PROGRESS";
        }
        return "IDLE";
    }

    touchmove(stateMachine: TouchStateMachine, context: TouchContext, payload: TouchEventPayload): TouchStates {
       // context.pointsMoved(payload.points);
       const idents = payload.points.map(p => p.ident);
       const initialPositions = context.getInitialTouchPointsPositions(idents);
       const currentPositions = payload.points;
       const pointsMoved = currentPositions.map((p, index) => ({
           ident: p.ident,
           x: p.x - initialPositions[index].x,
           y: p.y - initialPositions[index].y,
       }));
       const initialStartAndEndDistance = PointCal.distanceBetweenPoints(initialPositions[0], initialPositions[1]);
       const currentStartAndEndDistance = PointCal.distanceBetweenPoints(currentPositions[0], currentPositions[1]);
       const midPoint = PointCal.linearInterpolation(initialPositions[0], initialPositions[1], 0.5);
       const currentMidPoint = PointCal.linearInterpolation(currentPositions[0], currentPositions[1], 0.5);
       const deltaStartPoint = pointsMoved[0];
       let panZoom = Math.abs(currentStartAndEndDistance - initialStartAndEndDistance) > PointCal.distanceBetweenPoints(midPoint, currentMidPoint) ? "ZOOMING" : "PANNING";
       
    //    console.log("points before", context.getInitialTouchPointsPositions(idents));
       context.updateTouchPoints(currentPositions);
    //    console.log("points after", context.getInitialTouchPointsPositions(idents));
       switch(panZoom){
           case "ZOOMING":
               return "IN_PROGRESS";
           case "PANNING":
               context.notifyOnPan(PointCal.subVector(midPoint, currentMidPoint));
               return "IN_PROGRESS";
       }
       return "IN_PROGRESS"; 
    }
}

export class InProgressState extends TemplateState<TouchEventMapping, TouchContext, TouchStates> {

    private _eventReactions: Partial<EventAction<TouchEventMapping, TouchContext, TouchStates>> = {
        touchmove: this.touchmove,
        touchend: this.touchend,
    };

    get eventReactions(): Partial<EventAction<TouchEventMapping, TouchContext, TouchStates>> {
        return this._eventReactions;
    }

    touchmove(stateMachine: TouchStateMachine, context: TouchContext, payload: TouchEventPayload): TouchStates {
        // context.pointsMoved(payload.points);
       const idents = payload.points.map(p => p.ident);
       const initialPositions = context.getInitialTouchPointsPositions(idents);
       const currentPositions = payload.points;
       const pointsMoved = currentPositions.map((p, index) => ({
           ident: p.ident,
           x: p.x - initialPositions[index].x,
           y: p.y - initialPositions[index].y,
       }));
       const initialStartAndEndDistance = PointCal.distanceBetweenPoints(initialPositions[0], initialPositions[1]);
       const currentStartAndEndDistance = PointCal.distanceBetweenPoints(currentPositions[0], currentPositions[1]);
       const midPoint = PointCal.linearInterpolation(initialPositions[0], initialPositions[1], 0.5);
       const currentMidPoint = PointCal.linearInterpolation(currentPositions[0], currentPositions[1], 0.5);
       const midPointDelta = PointCal.subVector(midPoint, currentMidPoint);
       let panZoom = Math.abs(currentStartAndEndDistance - initialStartAndEndDistance) > PointCal.distanceBetweenPoints(midPoint, currentMidPoint) ? "ZOOMING" : "PANNING";
       
    //    console.log("points before", context.getInitialTouchPointsPositions(idents));
       context.updateTouchPoints(currentPositions);
    //    console.log("points after", context.getInitialTouchPointsPositions(idents));
       switch(panZoom){
            case "ZOOMING":
               return "IN_PROGRESS";
            case "PANNING":
            //    console.log("PANNING", midPointDelta);
               context.notifyOnPan(midPointDelta);
               return "IN_PROGRESS";
       }
       return "IN_PROGRESS"; 
    }

    touchend(stateMachine: TouchStateMachine, context: TouchContext, payload: TouchEventPayload): TouchStates {
        context.removeTouchPoints(payload.points.map(p => p.ident));
        return "IDLE";
    }
}

export class TouchSM extends TemplateStateMachine<TouchEventMapping, TouchContext, TouchStates> {

    constructor(context: TouchContext) {
        super({
            IDLE: new IdleState(),
            PENDING: new PendingState(),
            IN_PROGRESS: new InProgressState(),
        }, "IDLE", context);
    }

}