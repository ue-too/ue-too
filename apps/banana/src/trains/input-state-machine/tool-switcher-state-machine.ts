import { BaseContext, CreateStateType, DefaultOutputMapping, Defer, EventReactions, NO_OP, StateMachine, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { LayoutStateMachine } from "./layout-kmt-state-machine";
import { createLayoutStateMachine, CurveCreationEngine, TrainPlacementStateMachine } from ".";
import { StationPlacementStateMachine } from "@/stations/station-placement-state-machine";

export const TOOL_SWITCHER_STATES = ['LAYOUT', 'TRAIN', 'STATION', 'IDLE'] as const;

export type ToolSwitcherStates = CreateStateType<typeof TOOL_SWITCHER_STATES>;

export type ToolSwitcherEvents = {
    "switchToLayout": {};
    "switchToTrain": {};
    "switchToStation": {};
    "switchToIdle": {};
}

export type ToolSwitcherContext = BaseContext & {
    // switchToLayout: () => void;
    // switchToTrain: () => void;
    // switchToIdle: () => void;
}

export type ToolSwitcherEventOutputMapping = {
    switchToLayout: void;
    switchToTrain: void;
    switchToStation: void;
    switchToIdle: void;
}


export type ToolSwitcherStateMachine = StateMachine<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates, ToolSwitcherEventOutputMapping>;


class ToolSwitcherIdleState extends TemplateState<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates, ToolSwitcherEventOutputMapping> {
    protected _eventReactions: EventReactions<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates> = {
        switchToLayout: {
            action: NO_OP,
            defaultTargetState: 'LAYOUT',
        },
        switchToTrain: {
            action: NO_OP,
            defaultTargetState: 'TRAIN',
        },
        switchToStation: {
            action: NO_OP,
            defaultTargetState: 'STATION',
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        }
    }
};

class ToolSwitcherLayoutState extends TemplateState<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates, ToolSwitcherEventOutputMapping> {

    private _layoutSubStateMachine: LayoutStateMachine;

    constructor(layoutSubStateMachine: LayoutStateMachine) {
        super();
        this._layoutSubStateMachine = layoutSubStateMachine;
    }

    public uponEnter(context: ToolSwitcherContext, stateMachine: ToolSwitcherStateMachine, fromState: ToolSwitcherStates) {
        this._layoutSubStateMachine.happens('startLayout');
        console.log('uponEnter');
    }

    public beforeExit(context: ToolSwitcherContext, stateMachine: ToolSwitcherStateMachine, toState: ToolSwitcherStates) {
        this._layoutSubStateMachine.happens('endLayout');
    }

    protected _defer: Defer<ToolSwitcherContext, ToolSwitcherEvents, ToolSwitcherStates> = {
        action: (context, event, eventKey, stateMachine) => {
            console.log('eventKey', eventKey, 'event', event);
            console.log('current state of the layout sub state machine', this._layoutSubStateMachine.currentState);
            const result = this._layoutSubStateMachine.happens(eventKey, event);
            if (result.handled) {
                return {
                    handled: true,
                    output: result.output,
                }
            }
            return { handled: false };
        },
    };

    protected _eventReactions: EventReactions<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates> = {
        switchToLayout: {
            action: NO_OP,
            defaultTargetState: 'LAYOUT',
        },
        switchToTrain: {
            action: NO_OP,
            defaultTargetState: 'TRAIN',
        },
        switchToStation: {
            action: NO_OP,
            defaultTargetState: 'STATION',
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        }
    }
};

class ToolSwitcherTrainState extends TemplateState<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates> {
    private _trainSubStateMachine: TrainPlacementStateMachine;

    constructor(trainSubStateMachine: TrainPlacementStateMachine) {
        super();
        this._trainSubStateMachine = trainSubStateMachine;
    }

    protected _eventReactions: EventReactions<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates> = {
        switchToLayout: {
            action: NO_OP,
            defaultTargetState: 'LAYOUT',
        },
        switchToTrain: {
            action: NO_OP,
            defaultTargetState: 'TRAIN',
        },
        switchToStation: {
            action: NO_OP,
            defaultTargetState: 'STATION',
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        }
    }

    uponEnter(context: BaseContext, stateMachine: StateMachine<ToolSwitcherEvents, BaseContext, ToolSwitcherStates, DefaultOutputMapping<ToolSwitcherEvents>>, from: ToolSwitcherStates | "INITIAL"): void {
        this._trainSubStateMachine.happens("startPlacement");
    }

    beforeExit(context: ToolSwitcherContext, stateMachine: ToolSwitcherStateMachine, toState: ToolSwitcherStates) {
        this._trainSubStateMachine.happens("endPlacement");
    }

    protected _defer: Defer<ToolSwitcherContext, ToolSwitcherEvents, ToolSwitcherStates> = {
        action: (context, event, eventKey, stateMachine) => {
            console.log('eventKey', eventKey, 'event', event);
            console.log('current state of the train sub state machine', this._trainSubStateMachine.currentState);
            const result = this._trainSubStateMachine.happens(eventKey, event);
            if (result.handled) {
                return {
                    handled: true, output: result.output,
                }
            }
            return { handled: false };
        },
    };
};

class ToolSwitcherStationState extends TemplateState<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates> {
    private _stationSubStateMachine: StationPlacementStateMachine;

    constructor(stationSubStateMachine: StationPlacementStateMachine) {
        super();
        this._stationSubStateMachine = stationSubStateMachine;
    }

    protected _eventReactions: EventReactions<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates> = {
        switchToLayout: {
            action: NO_OP,
            defaultTargetState: 'LAYOUT',
        },
        switchToTrain: {
            action: NO_OP,
            defaultTargetState: 'TRAIN',
        },
        switchToStation: {
            action: NO_OP,
            defaultTargetState: 'STATION',
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        }
    }

    uponEnter(context: BaseContext, stateMachine: StateMachine<ToolSwitcherEvents, BaseContext, ToolSwitcherStates, DefaultOutputMapping<ToolSwitcherEvents>>, from: ToolSwitcherStates | "INITIAL"): void {
        this._stationSubStateMachine.happens("startPlacement");
    }

    beforeExit(context: ToolSwitcherContext, stateMachine: ToolSwitcherStateMachine, toState: ToolSwitcherStates) {
        this._stationSubStateMachine.happens("endPlacement");
    }

    protected _defer: Defer<ToolSwitcherContext, ToolSwitcherEvents, ToolSwitcherStates> = {
        action: (context, event, eventKey, stateMachine) => {
            const result = this._stationSubStateMachine.happens(eventKey, event);
            if (result.handled) {
                return { handled: true, output: result.output };
            }
            return { handled: false };
        },
    };
};

export const createToolSwitcherStateMachine = (
    layoutSubStateMachine: LayoutStateMachine,
    trainSubStateMachine: TrainPlacementStateMachine,
    stationSubStateMachine: StationPlacementStateMachine,
): ToolSwitcherStateMachine => {
    return new TemplateStateMachine<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates>({
        IDLE: new ToolSwitcherIdleState(),
        LAYOUT: new ToolSwitcherLayoutState(layoutSubStateMachine),
        TRAIN: new ToolSwitcherTrainState(trainSubStateMachine),
        STATION: new ToolSwitcherStationState(stationSubStateMachine),
    }, 'IDLE', {
        setup: () => { },
        cleanup: () => { },
    });
};

