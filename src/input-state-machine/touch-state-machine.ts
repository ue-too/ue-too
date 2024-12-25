import { PointCal } from "point2point";
import type { Point} from "src/index";
import { EventAction, EventGuards, Guard, StateMachine, TemplateState, TemplateStateMachine } from "src/being/interfaces";

export type TouchStates = "IDLE" | "PENDING" | "IN_PROGRESS";

export interface TouchContext {
    addTouchPoints: (points: TouchPoints[]) => void;
    removeTouchPoints: (idents: number[]) => void;
    getCurrentTouchPointsCount: () => number;
    getInitialTouchPointsPositions: (idents: number[]) => TouchPoints[];
    updateTouchPoints: (pointsMoved: TouchPoints[]) => void;
    notifyOnPan: (delta: Point) => void;
    notifyOnZoom: (zoomAmount: number, anchorPoint: Point) => void; 
    canvas: HTMLCanvasElement;
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

export class IdleState extends TemplateState<TouchEventMapping, TouchContext, TouchStates> {

    private _eventReactions: Partial<EventAction<TouchEventMapping, TouchContext, TouchStates>> = {
        touchstart: {
            action: this.touchstart,
            defaultTargetState: "IDLE",
        },
        touchend: {
            action: this.touchend,
            defaultTargetState: "IDLE",
        },
    };

    protected _guards: Guard<TouchContext, "touchPointsCount"> = {
        touchPointsCount: (context: TouchContext) => {
            console.log("touchPointsCount", context.getCurrentTouchPointsCount() === 2);
            return context.getCurrentTouchPointsCount() === 2;
        }
    };

    protected _eventGuards: Partial<EventGuards<TouchEventMapping, TouchStates, TouchContext, typeof this._guards>> = {
        touchstart: [{
            guard: "touchPointsCount",
            target: "PENDING",
        }],
        touchend: [{
            guard: "touchPointsCount",
            target: "PENDING",
        }],
    };

    get eventReactions(): Partial<EventAction<TouchEventMapping, TouchContext, TouchStates>> {
        return this._eventReactions;
    }

    touchstart(stateMachine: TouchStateMachine, context: TouchContext, payload: TouchEventPayload): TouchStates {
        context.addTouchPoints(payload.points);
        return "IDLE";
    }

    touchend(stateMachine: TouchStateMachine, context: TouchContext, payload: TouchEventPayload): "PENDING" | "IDLE" {
        context.removeTouchPoints(payload.points.map(p => p.ident));
        return "IDLE";
    }
}

export class PendingState extends TemplateState<TouchEventMapping, TouchContext, TouchStates> {

    private _eventReactions: Partial<EventAction<TouchEventMapping, TouchContext, TouchStates>> = {
        touchstart: {
            action: this.touchstart,
            defaultTargetState: "IDLE",
        },
        touchend: {
            action: this.touchend,
            defaultTargetState: "IDLE",
        },
        touchmove: {
            action: this.touchmove,
            defaultTargetState: "IN_PROGRESS",
        },
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
        const idents = payload.points.map(p => p.ident);
        const initialPositions = context.getInitialTouchPointsPositions(idents);
        const currentPositions = payload.points;
        const initialStartAndEndDistance = PointCal.distanceBetweenPoints(initialPositions[0], initialPositions[1]);
        const currentStartAndEndDistance = PointCal.distanceBetweenPoints(currentPositions[0], currentPositions[1]);
        const midPoint = PointCal.linearInterpolation(initialPositions[0], initialPositions[1], 0.5);
        const currentMidPoint = PointCal.linearInterpolation(currentPositions[0], currentPositions[1], 0.5);
        const midPointDelta = PointCal.subVector(midPoint, currentMidPoint);
        let panZoom = Math.abs(currentStartAndEndDistance - initialStartAndEndDistance) > PointCal.distanceBetweenPoints(midPoint, currentMidPoint) ? "ZOOMING" : "PANNING";
        const boundingRect = context.canvas.getBoundingClientRect();
        const cameraCenterInWindow = {x: boundingRect.left + boundingRect.width / 2, y: boundingRect.top + boundingRect.height / 2};
        const midPointInViewPort = PointCal.subVector(midPoint, cameraCenterInWindow);
       
        context.updateTouchPoints(currentPositions);
        switch(panZoom){
            case "ZOOMING":
                context.notifyOnZoom((currentStartAndEndDistance - initialStartAndEndDistance) * 0.005, midPointInViewPort);
                return "IN_PROGRESS";
            case "PANNING":
                context.notifyOnPan(midPointDelta);
                return "IN_PROGRESS";
        }
        return "IN_PROGRESS"; 
    }
}

export class InProgressState extends TemplateState<TouchEventMapping, TouchContext, TouchStates> {

    private _eventReactions: Partial<EventAction<TouchEventMapping, TouchContext, TouchStates>> = {
        touchmove: {
            action: this.touchmove,
            defaultTargetState: "IN_PROGRESS",
        },
        touchend: {
            action: this.touchend,
            defaultTargetState: "IDLE",
        },
    };

    get eventReactions(): Partial<EventAction<TouchEventMapping, TouchContext, TouchStates>> {
        return this._eventReactions;
    }

    touchmove(stateMachine: TouchStateMachine, context: TouchContext, payload: TouchEventPayload): TouchStates {
        // context.pointsMoved(payload.points);
        const idents = payload.points.map(p => p.ident);
        const initialPositions = context.getInitialTouchPointsPositions(idents);
        const currentPositions = payload.points;
        const initialStartAndEndDistance = PointCal.distanceBetweenPoints(initialPositions[0], initialPositions[1]);
        const currentStartAndEndDistance = PointCal.distanceBetweenPoints(currentPositions[0], currentPositions[1]);
        const midPoint = PointCal.linearInterpolation(initialPositions[0], initialPositions[1], 0.5);
        const currentMidPoint = PointCal.linearInterpolation(currentPositions[0], currentPositions[1], 0.5);
        const midPointDelta = PointCal.subVector(midPoint, currentMidPoint);
        const boundingRect = context.canvas.getBoundingClientRect();
        const cameraCenterInWindow = {x: boundingRect.left + boundingRect.width / 2, y: boundingRect.top + boundingRect.height / 2};
        const midPointInViewPort = PointCal.subVector(midPoint, cameraCenterInWindow);
        let panZoom = Math.abs(currentStartAndEndDistance - initialStartAndEndDistance) > PointCal.distanceBetweenPoints(midPoint, currentMidPoint) ? "ZOOMING" : "PANNING";
       
        context.updateTouchPoints(currentPositions);
        switch(panZoom){
            case "ZOOMING":
                context.notifyOnZoom(-(initialStartAndEndDistance -  currentStartAndEndDistance) * 0.005, midPointInViewPort);
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
