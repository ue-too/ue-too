import { BaseContext, EventReactions, NO_OP, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { Point } from "@ue-too/math";
import { TrackGraph } from "./track";

export type TrainPlacementStates = "IDLE" | "HOVER_FOR_PLACEMENT";

export type TrainPlacementEvents = {
    "pointerdown": {
        position: Point;
    };
    "pointerup": {
        position: Point;
    };
    "pointermove": {
        position: Point;
    };
    "escapeKey": {};
    "startPlacement": {};
    "endPlacement": {};
}

export interface TrainPlacementContext extends BaseContext {
    cancelCurrentTrainPlacement: () => void;
    placeTrain: (position: Point) => void;
    hoverForPlacement: (position: Point) => void;
}

export class TrainPlacementEngine implements TrainPlacementContext {

    private _trackGraph: TrackGraph;
    private _trainPosition: Point | null = null;
    private _previewPosition: Point | null = null;

    constructor(trackGraph: TrackGraph) {
        this._trackGraph = trackGraph;
    }

    cancelCurrentTrainPlacement(){
        this._previewPosition = null;
    };

    placeTrain(){
        if(this._previewPosition === null){
            return;
        }
        this._trainPosition = this._previewPosition;
        this._previewPosition = null;
    }

    hoverForPlacement(position: Point){
        const res = this._trackGraph.project(position);
        if(res.hit){
            switch(res.hitType){
                case "joint":
                    this._previewPosition = res.position;
                    break;
                case "curve":
                    this._previewPosition = res.projectionPoint;
                    break;
            }
        } else {
            this._previewPosition = null;
        }
    }

    get trainPosition(): Point | null {
        return this._trainPosition;
    }

    get previewPosition(): Point | null {
        return this._previewPosition;
    }

    setup(){
        // TODO: setup
    }

    cleanup(){
        // TODO: cleanup
    }
}

export class TrainPlacementStateMachine extends TemplateStateMachine<TrainPlacementEvents, TrainPlacementContext, TrainPlacementStates> {

    constructor(context: TrainPlacementContext) {
        super({
            IDLE: new TrainPlacementIDLEState(),
            "HOVER_FOR_PLACEMENT": new TrainPlacementHoverForPlacementState(),
        }, "IDLE", context);
    }
}


export class TrainPlacementIDLEState extends TemplateState<TrainPlacementEvents, TrainPlacementContext, TrainPlacementStates> {

    public eventReactions: EventReactions<TrainPlacementEvents, TrainPlacementContext, TrainPlacementStates> = {
        "startPlacement": {
            action: NO_OP,
            defaultTargetState: "HOVER_FOR_PLACEMENT"
        }
    }
}

export class TrainPlacementHoverForPlacementState extends TemplateState<TrainPlacementEvents, TrainPlacementContext, TrainPlacementStates> {

    public eventReactions: EventReactions<TrainPlacementEvents, TrainPlacementContext, TrainPlacementStates> = {
        "endPlacement": {
            action: (context) => {
                context.cancelCurrentTrainPlacement();
            },
            defaultTargetState: "IDLE"
        },
        "pointerup": {
            action: (context, event) => {
                context.placeTrain(event.position);
            },
            defaultTargetState: "HOVER_FOR_PLACEMENT"
        },
        "pointermove": {
            action: (context, event) => {
                context.hoverForPlacement(event.position);
            },
            defaultTargetState: "HOVER_FOR_PLACEMENT"
        },
        "escapeKey": {
            action: (context) => {
                context.cancelCurrentTrainPlacement();
            },
            defaultTargetState: "IDLE"
        }
    }
}

