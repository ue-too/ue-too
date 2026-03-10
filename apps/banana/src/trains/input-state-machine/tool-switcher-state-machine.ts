import { BaseContext, CreateStateType, DefaultOutputMapping, Defer, EventReactions, NO_OP, StateMachine, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { LayoutStateMachine } from "./layout-kmt-state-machine";
import { createLayoutStateMachine, CurveCreationEngine, TrainPlacementStateMachine } from ".";

export const TOOL_SWITCHER_STATES = ['LAYOUT', 'TRAIN', 'IDLE'] as const;

export type ToolSwitcherStates = CreateStateType<typeof TOOL_SWITCHER_STATES>;

export type ToolSwitcherEvents = {
    "switchToLayout": {};
    "switchToTrain": {};
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
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        }
    }

    uponEnter(context: BaseContext, stateMachine: StateMachine<ToolSwitcherEvents, BaseContext, "LAYOUT" | "TRAIN" | "IDLE", DefaultOutputMapping<ToolSwitcherEvents>>, from: "LAYOUT" | "TRAIN" | "IDLE" | "INITIAL"): void {
        this._trainSubStateMachine.happens("startPlacement");
    }

    beforeExit(context: ToolSwitcherContext, stateMachine: ToolSwitcherStateMachine, toState: ToolSwitcherStates) {
        this._trainSubStateMachine.happens("endPlacement");
    }

    protected _defer: Defer<ToolSwitcherContext, ToolSwitcherEvents, ToolSwitcherStates> = {
        action: (context, event, eventKey, stateMachine) => {
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

export const createToolSwitcherStateMachine = (layoutSubStateMachine: LayoutStateMachine, trainSubStateMachine: TrainPlacementStateMachine): ToolSwitcherStateMachine => {
    return new TemplateStateMachine<ToolSwitcherEvents, ToolSwitcherContext, ToolSwitcherStates>({
        IDLE: new ToolSwitcherIdleState(),
        LAYOUT: new ToolSwitcherLayoutState(layoutSubStateMachine),
        TRAIN: new ToolSwitcherTrainState(trainSubStateMachine),
    }, 'IDLE', {
        setup: () => { },
        cleanup: () => { },
    });
};

