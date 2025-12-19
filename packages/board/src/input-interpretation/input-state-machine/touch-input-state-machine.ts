import { PointCal } from "@ue-too/math";
import { EventReactions, EventGuards, Guard, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { TouchContext, TouchPoints } from "./touch-input-context";
import type { Point } from "@ue-too/math";

export type TouchStates = "IDLE" | "PENDING" | "IN_PROGRESS";

/**
 * @description The touch event payload.
 *
 * @category Input State Machine
 */
export type TouchEventPayload = {
    points: TouchPoints[];
};

/**
 * @description Output events from the touch state machine to the orchestrator.
 * These events represent the actions that should be taken in response to user input.
 *
 * @category Input State Machine
 */
export type TouchOutputEvent =
    | { type: "pan", delta: Point }
    | { type: "zoom", delta: number, anchorPointInViewPort: Point }
    | { type: "none" };

/**
 * @description The touch event mapping.
 *
 * @category Input State Machine
 */
export type TouchEventMapping = {
    touchstart: TouchEventPayload;
    touchmove: TouchEventPayload;
    touchend: TouchEventPayload;
}

export type TouchInputEventOutputMapping = {
    touchmove: TouchOutputEvent;
}

/**
 * @description The idle state of the touch input state machine.
 *
 * @category Input State Machine
 */
export class IdleState extends TemplateState<TouchEventMapping, TouchContext, TouchStates, TouchInputEventOutputMapping> {

    private _eventReactions: EventReactions<TouchEventMapping, TouchContext, TouchStates, TouchInputEventOutputMapping> = {
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

    get eventReactions(): EventReactions<TouchEventMapping, TouchContext, TouchStates, TouchInputEventOutputMapping> {
        return this._eventReactions;
    }

    touchstart(context: TouchContext, payload: TouchEventPayload): void {
        context.addTouchPoints(payload.points);
    }

    touchend(context: TouchContext, payload: TouchEventPayload): void {
        context.removeTouchPoints(payload.points.map(p => p.ident));
    }
}

/**
 * @description The pending state of the touch input state machine.
 *
 * @category Input State Machine
 */
export class PendingState extends TemplateState<TouchEventMapping, TouchContext, TouchStates, TouchInputEventOutputMapping> {

    private _eventReactions: EventReactions<TouchEventMapping, TouchContext, TouchStates, TouchInputEventOutputMapping> = {
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

    get eventReactions(): EventReactions<TouchEventMapping, TouchContext, TouchStates, TouchInputEventOutputMapping> {
        return this._eventReactions;
    }

    touchstart(context: TouchContext, payload: TouchEventPayload): void {
        context.addTouchPoints(payload.points);
    }

    touchend(context: TouchContext, payload: TouchEventPayload): void {
        context.removeTouchPoints(payload.points.map(p => p.ident));
    }

    touchmove(context: TouchContext, payload: TouchEventPayload): TouchOutputEvent {
        const idents = payload.points.map(p => p.ident);
        const initialPositions = context.getInitialTouchPointsPositions(idents);
        const currentPositions = payload.points;
        const initialStartAndEndDistance = PointCal.distanceBetweenPoints(initialPositions[0], initialPositions[1]);
        const currentStartAndEndDistance = PointCal.distanceBetweenPoints(currentPositions[0], currentPositions[1]);
        const midPoint = PointCal.linearInterpolation(initialPositions[0], initialPositions[1], 0.5);
        const currentMidPoint = PointCal.linearInterpolation(currentPositions[0], currentPositions[1], 0.5);
        const midPointDelta = PointCal.subVector(midPoint, currentMidPoint);
        const cameraCenterInWindow = {x: context.canvas.position.x + context.canvas.width / 2, y: context.canvas.position.y + context.canvas.height / 2};
        const midPointInViewPort = PointCal.subVector(midPoint, cameraCenterInWindow);
        let panZoom = Math.abs(currentStartAndEndDistance - initialStartAndEndDistance) > PointCal.distanceBetweenPoints(midPoint, currentMidPoint) ? "ZOOMING" : "PANNING";

        context.updateTouchPoints(currentPositions);
        switch(panZoom){
            case "ZOOMING":
                return {
                    type: "zoom",
                    delta: (currentStartAndEndDistance - initialStartAndEndDistance) * 0.005,
                    anchorPointInViewPort: midPointInViewPort
                };
            case "PANNING":
                return {
                    type: "pan",
                    delta: midPointDelta
                };
            default:
                console.warn("Unknown panZoom state", panZoom);
                return { type: "none" };
        }
    }
}

/**
 * @description The in progress state of the touch input state machine.
 *
 * @category Input State Machine
 */
export class InProgressState extends TemplateState<TouchEventMapping, TouchContext, TouchStates, TouchInputEventOutputMapping> {

    private _eventReactions: EventReactions<TouchEventMapping, TouchContext, TouchStates, TouchInputEventOutputMapping> = {
        touchmove: {
            action: this.touchmove,
            defaultTargetState: "IN_PROGRESS",
        },
        touchend: {
            action: this.touchend,
            defaultTargetState: "IDLE",
        },
        touchstart: {
            action: ()=> "IDLE",
            defaultTargetState: "IDLE",
        },
    };

    get eventReactions(): EventReactions<TouchEventMapping, TouchContext, TouchStates, TouchInputEventOutputMapping> {
        return this._eventReactions;
    }

    touchmove(context: TouchContext, payload: TouchEventPayload): TouchOutputEvent {
        const idents = payload.points.map(p => p.ident);
        const initialPositions = context.getInitialTouchPointsPositions(idents);
        const currentPositions = payload.points;
        const initialStartAndEndDistance = PointCal.distanceBetweenPoints(initialPositions[0], initialPositions[1]);
        const currentStartAndEndDistance = PointCal.distanceBetweenPoints(currentPositions[0], currentPositions[1]);
        const midPoint = PointCal.linearInterpolation(initialPositions[0], initialPositions[1], 0.5);
        const currentMidPoint = PointCal.linearInterpolation(currentPositions[0], currentPositions[1], 0.5);
        const midPointDelta = PointCal.subVector(midPoint, currentMidPoint);
        const cameraCenterInWindow = {x: context.canvas.position.x + context.canvas.width / 2, y: context.canvas.position.y + context.canvas.height / 2};
        const midPointInViewPort = PointCal.subVector(midPoint, cameraCenterInWindow);
        let panZoom = Math.abs(currentStartAndEndDistance - initialStartAndEndDistance) > PointCal.distanceBetweenPoints(midPoint, currentMidPoint) ? "ZOOMING" : "PANNING";

        context.updateTouchPoints(currentPositions);
        switch(panZoom){
            case "ZOOMING":
                if(!context.alignCoordinateSystem){
                    midPointInViewPort.y = -midPointInViewPort.y;
                }
                return {
                    type: "zoom",
                    delta: -(initialStartAndEndDistance -  currentStartAndEndDistance) * 0.005,
                    anchorPointInViewPort: midPointInViewPort
                };
            case "PANNING":
                if(!context.alignCoordinateSystem){
                    midPointDelta.y = -midPointDelta.y;
                }
                return {
                    type: "pan",
                    delta: midPointDelta
                };
            default:
                console.warn("Unknown panZoom state", panZoom);
                return { type: "none" };
        }
    }

    touchend(context: TouchContext, payload: TouchEventPayload): void {
        context.removeTouchPoints(payload.points.map(p => p.ident));
    }
}

/**
 * @description The touch input state machine.
 *
 * @category Input State Machine
 */
export type TouchInputStateMachine = TemplateStateMachine<TouchEventMapping, TouchContext, TouchStates, TouchInputEventOutputMapping>;

export function createTouchInputStateMachine(context: TouchContext): TouchInputStateMachine {
    return new TemplateStateMachine<TouchEventMapping, TouchContext, TouchStates, TouchInputEventOutputMapping>(
        {
            IDLE: new IdleState(),
            PENDING: new PendingState(),
            IN_PROGRESS: new InProgressState(),
        }, "IDLE", context);
}
