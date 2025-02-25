import { PointCal } from "point2point";
import { EventAction, EventGuards, Guard, TemplateState, TemplateStateMachine } from "src/being/interfaces";
import { TouchContext } from "./touch-input-context";
export type TouchStates = "IDLE" | "PENDING" | "IN_PROGRESS";


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

export class IdleState extends TemplateState<TouchEventMapping, TouchContext, TouchStates> {

    private _eventReactions: EventAction<TouchEventMapping, TouchContext, TouchStates> = {
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
        touchPointsCount: ((context: TouchContext) => {
            return context.getCurrentTouchPointsCount() === 2;
        }).bind(this)
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

    touchstart(context: TouchContext, payload: TouchEventPayload): TouchStates {
        context.addTouchPoints(payload.points);
        return "IDLE";
    }

    touchend(context: TouchContext, payload: TouchEventPayload): "PENDING" | "IDLE" {
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

    touchstart(context: TouchContext, payload: TouchEventPayload): TouchStates {
        context.addTouchPoints(payload.points);
        return "IDLE";
    }

    touchend(context: TouchContext, payload: TouchEventPayload): TouchStates {
        context.removeTouchPoints(payload.points.map(p => p.ident));
        if(context.getCurrentTouchPointsCount() === 2){
            return "IN_PROGRESS";
        }
        return "IDLE";
    }

    touchmove(context: TouchContext, payload: TouchEventPayload): TouchStates {
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

    touchmove(context: TouchContext, payload: TouchEventPayload): TouchStates {
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
                if(!context.alignCoordinateSystem){
                    midPointInViewPort.y = -midPointInViewPort.y;
                }
                context.notifyOnZoom(-(initialStartAndEndDistance -  currentStartAndEndDistance) * 0.005, midPointInViewPort);
                return "IN_PROGRESS";
            case "PANNING":
                if(!context.alignCoordinateSystem){
                    midPointDelta.y = -midPointDelta.y;
                }
                context.notifyOnPan(midPointDelta);
                return "IN_PROGRESS";
        }
        return "IN_PROGRESS"; 
    }

    touchend(context: TouchContext, payload: TouchEventPayload): TouchStates {
        context.removeTouchPoints(payload.points.map(p => p.ident));
        return "IDLE";
    }
}

export class TouchInputStateMachine extends TemplateStateMachine<TouchEventMapping, TouchContext, TouchStates> {

    constructor(context: TouchContext) {
        super({
            IDLE: new IdleState(),
            PENDING: new PendingState(),
            IN_PROGRESS: new InProgressState(),
        }, "IDLE", context);
    }

}
