import { BCurve } from "@ue-too/curve";
import { type Point } from "@ue-too/math";
import type { StateMachine, BaseContext, EventReactions } from "@ue-too/being";
import { NO_OP, TemplateState, TemplateStateMachine } from "@ue-too/being";


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
    "esacpeKey": {};
    "startLayout": {};
    "endLayout": {};
}

export interface LayoutContext extends BaseContext {
    startCurve: (startingPosition: Point) => void;
    endCurve: (endingPosition: Point) => void;
    cancelCurrentCurve: () => void;
    setHoverPosition: (position: Point) => void;
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
        // "pointermove": {
        //     action: (context, event) => {
        //         context.setHoverPosition(event.position);
        //     },
        //     defaultTargetState: "HOVER_FOR_STARTING_POINT",
        // },
        "endLayout": {
            action: (context, event) => {
                context.cancelCurrentCurve();
            },
            defaultTargetState: "IDLE",
        },
        "esacpeKey": {
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
        "esacpeKey": {
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
    private _previewCurve: BCurve | null;

    constructor() {
        this._currentStartingPoint = null;
        this._hoverPosition = null;
        this._previewCurve = null;
    }

    startCurve(startingPosition: Point) {
        this._currentStartingPoint = startingPosition;
    }

    setHoverPosition(position: Point) {
        console.log("setHoverPosition", position);
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
        this._currentStartingPoint = null;
        this._previewCurve = null;
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
}
