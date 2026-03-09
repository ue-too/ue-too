import { BaseContext, CreateStateType, Defer, EventReactions, EventResult, Guard, State, TemplateState, TemplateStateMachine } from "@ue-too/being";

const MAIN_STATES = ['IDLE', 'CURVE_CREATION', 'TRAIN_PLACEMENT'] as const;

type MainStates = CreateStateType<typeof MAIN_STATES>;

const SUB_STATES_WITHIN_MAIN = ['START', 'END'] as const;

type SubStatesWithinMain = CreateStateType<typeof SUB_STATES_WITHIN_MAIN>;

type MainContext = BaseContext & {

};

type SubEventOutputMapping = {
    log: {
        message: string;
    };
};

type MainEventMapping = {
    createCurve: {};
    endCurve: {};
    placeTrain: {};
    endPlacement: {};
};


type SubEventMapping = {
    start: {};
    end: {};
    log: {};
};

/** Single source of truth for which events are forwarded to the sub state machine. */
const SUB_EVENT_KEYS: (keyof SubEventMapping)[] = ['start', 'end', 'log'];

const SUB_EVENT_KEY_SET = new Set<string>(SUB_EVENT_KEYS);

type MainEventMappingExtension = MainEventMapping & SubEventMapping;

type SubContext = BaseContext & {

};

type SubStateMachine = TemplateStateMachine<SubEventMapping, SubContext, SubStatesWithinMain, SubEventOutputMapping>;

class SubStartState extends TemplateState<SubEventMapping, SubContext, SubStatesWithinMain, SubEventOutputMapping> {
    protected _eventReactions: EventReactions<SubEventMapping, SubContext, SubStatesWithinMain, SubEventOutputMapping> = {
        end: {
            action: (context, event, stateMachine) => {
                return 'END';
            },
            defaultTargetState: 'END',
        },
        log: {
            action: (context, event, stateMachine) => {
                return {
                    message: 'log in the start state',
                }
            },
            defaultTargetState: 'START',
        },
    };
}

class SubEndState extends TemplateState<SubEventMapping, SubContext, SubStatesWithinMain, SubEventOutputMapping> {
    protected _eventReactions: EventReactions<SubEventMapping, SubContext, SubStatesWithinMain, SubEventOutputMapping> = {
        start: {
            action: (context, event, stateMachine) => {
                return 'START';
            },
        },
        log: {
            action: (context, event, stateMachine) => {
                return {
                    message: 'log in the end state',
                }
            },
        }
    };
}

const createSubStateMachine = () => {
    return new TemplateStateMachine<SubEventMapping, SubContext, SubStatesWithinMain, SubEventOutputMapping>({
        START: new SubStartState(),
        END: new SubEndState(),
    }, 'START', {
        setup: () => { },
        cleanup: () => { },
    });
}


class MainIdleState extends TemplateState<MainEventMapping, MainContext, MainStates> {
    protected _eventReactions: EventReactions<MainEventMapping, MainContext, MainStates> = {
        createCurve: {
            action: (context, event, stateMachine) => {
            },
            defaultTargetState: "CURVE_CREATION",
        },
        placeTrain: {
            action: (context, event, stateMachine) => {
            },
            defaultTargetState: "TRAIN_PLACEMENT",
        }
    };
}

class MainCurveCreationState extends TemplateState<MainEventMapping, MainContext, MainStates> {
    protected _eventReactions: EventReactions<MainEventMapping, MainContext, MainStates> = {
        endCurve: {
            action: (context, event, stateMachine) => {
            },
            defaultTargetState: "IDLE",
        },
        placeTrain: {
            action: (context, event, stateMachine) => {
            },
            defaultTargetState: "TRAIN_PLACEMENT",
        }
    };
}

class MainPlacementState extends TemplateState<MainEventMapping, MainContext, MainStates> {
    protected _eventReactions: EventReactions<MainEventMapping, MainContext, MainStates> = {
        endPlacement: {
            action: (context, event, stateMachine) => {
            },
            defaultTargetState: "IDLE",
        }
    };
}

class MainIdleExtensionState extends TemplateState<MainEventMappingExtension, MainContext, MainStates, SubEventOutputMapping> {

    private _originalEventReactions: EventReactions<MainEventMappingExtension, MainContext, MainStates, SubEventOutputMapping>;
    private _subStateMachine: SubStateMachine;

    constructor() {
        super();

        const originalIdleState = new MainIdleState();

        this._originalEventReactions = originalIdleState.eventReactions as unknown as EventReactions<MainEventMappingExtension, MainContext, MainStates, SubEventOutputMapping>;

        this._eventReactions = {
            ...this._originalEventReactions,
        } as EventReactions<MainEventMappingExtension, MainContext, MainStates, SubEventOutputMapping>;

        this.uponEnter = originalIdleState.uponEnter as unknown as (
            context: MainContext,
            stateMachine: TemplateStateMachine<MainEventMappingExtension, MainContext, MainStates, SubEventOutputMapping>,
            from: MainStates | 'INITIAL'
        ) => void;

        this.beforeExit = originalIdleState.beforeExit as unknown as (
            context: MainContext,
            stateMachine: TemplateStateMachine<MainEventMappingExtension, MainContext, MainStates, SubEventOutputMapping>,
            to: MainStates | 'TERMINAL'
        ) => void;

        this._guards = originalIdleState.guards as unknown as Guard<MainContext>;

        this._subStateMachine = createSubStateMachine();
    }

    protected _defer: Defer<MainContext, MainEventMappingExtension, MainStates, SubEventOutputMapping> = {
        action: (context, event, eventKey, stateMachine) => {
            if (!SUB_EVENT_KEY_SET.has(eventKey as string)) {
                return { handled: false };
            }
            const key = eventKey as keyof SubEventMapping;
            const payload = event as SubEventMapping[keyof SubEventMapping];
            // Assert: at runtime key and payload are correlated; TS can't infer from the union
            const result = (this._subStateMachine.happens as (
                k: keyof SubEventMapping,
                p: SubEventMapping[keyof SubEventMapping]
            ) => ReturnType<SubStateMachine['happens']>)(key, payload);

            if (result.handled) {
                return {
                    handled: true,
                    output: result.output,
                }
            }
            return { handled: false };
        },
    };
}

export const createAdaptedStateToExpansionFunc = <
    OldState extends State<any, any, any, any>,
    NewState extends State<any, any, any, any>,
>() => {
    return (state: OldState): NewState => {
        return state as unknown as NewState;
    };
};

const expandState = createAdaptedStateToExpansionFunc<
    State<
        MainEventMapping,
        MainContext,
        MainStates
    >,
    State<
        MainEventMappingExtension,
        MainContext,
        MainStates,
        SubEventOutputMapping
    >
>();


export const createMainStateMachine = () => {
    return new TemplateStateMachine<MainEventMappingExtension, MainContext, MainStates, SubEventOutputMapping>({
        IDLE: new MainIdleExtensionState(),
        CURVE_CREATION: expandState(new MainCurveCreationState()),
        TRAIN_PLACEMENT: expandState(new MainPlacementState()),
    }, 'IDLE', {
        setup: () => { },
        cleanup: () => { },
    });
};


