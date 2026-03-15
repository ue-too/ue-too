import {
    DisabledState,
    InitialPanState,
    KmtIdleState,
    KmtInputContext,
    KmtInputEventMapping,
    KmtInputEventOutputMapping,
    KmtInputStates,
    PanState,
    PanViaScrollWheelState,
    ReadyToPanViaScrollWheelState,
    ReadyToPanViaSpaceBarState,
} from "@ue-too/board";
import { Defer, EventReactions, Guard, State, StateMachine, TemplateState, TemplateStateMachine } from "@ue-too/being";
import type { TrainEditorToolEvents, TrainEditorToolStateMachine } from "./train-editor-tool-switcher";

type TrainEditorKmtEvents = KmtInputEventMapping & TrainEditorToolEvents;

type TrainEditorKmtContext = KmtInputContext;

class TrainEditorKmtIdleState extends TemplateState<TrainEditorKmtEvents, TrainEditorKmtContext, KmtInputStates, KmtInputEventOutputMapping> {

    private _originalEventReactions: EventReactions<TrainEditorKmtEvents, TrainEditorKmtContext, KmtInputStates, KmtInputEventOutputMapping>;
    private _toolSwitcherStateMachine: TrainEditorToolStateMachine;

    constructor(toolSwitcherStateMachine: TrainEditorToolStateMachine) {
        super();
        const originalIdleState = new KmtIdleState();
        this._originalEventReactions = originalIdleState.eventReactions as unknown as EventReactions<TrainEditorKmtEvents, TrainEditorKmtContext, KmtInputStates, KmtInputEventOutputMapping>;

        this._eventReactions = {
            ...this._originalEventReactions,
        } as EventReactions<TrainEditorKmtEvents, TrainEditorKmtContext, KmtInputStates, KmtInputEventOutputMapping>;

        this.uponEnter = originalIdleState.uponEnter as unknown as (
            context: TrainEditorKmtContext,
            stateMachine: TemplateStateMachine<TrainEditorKmtEvents, TrainEditorKmtContext, KmtInputStates, KmtInputEventOutputMapping>,
            from: KmtInputStates | 'INITIAL'
        ) => void;

        this.beforeExit = originalIdleState.beforeExit as unknown as (
            context: TrainEditorKmtContext,
            stateMachine: TemplateStateMachine<TrainEditorKmtEvents, TrainEditorKmtContext, KmtInputStates, KmtInputEventOutputMapping>,
            to: KmtInputStates | 'TERMINAL'
        ) => void;

        this._guards = originalIdleState.guards as unknown as Guard<TrainEditorKmtContext>;

        this._toolSwitcherStateMachine = toolSwitcherStateMachine;
    }

    protected _defer: Defer<TrainEditorKmtContext, TrainEditorKmtEvents, KmtInputStates, KmtInputEventOutputMapping> = {
        action: (_context, event, eventKey) => {
            const key = eventKey as keyof TrainEditorToolEvents;
            const payload = event as TrainEditorToolEvents[keyof TrainEditorToolEvents];
            const result = (this._toolSwitcherStateMachine.happens as (
                k: keyof TrainEditorToolEvents,
                p: TrainEditorToolEvents[keyof TrainEditorToolEvents]
            ) => ReturnType<TrainEditorToolStateMachine['happens']>)(key, payload);
            if (result.handled) {
                return { handled: true, output: result.output };
            }
            return { handled: false };
        },
    };
}

const createAdaptedState = <
    OldState extends State<any, any, any, any>,
    NewState extends State<any, any, any, any>,
>() => {
    return (state: OldState): NewState => {
        return state as unknown as NewState;
    };
};

const expandState = createAdaptedState<
    State<KmtInputEventMapping, KmtInputContext, KmtInputStates, KmtInputEventOutputMapping>,
    State<TrainEditorKmtEvents, TrainEditorKmtContext, KmtInputStates, KmtInputEventOutputMapping>
>();

export type TrainEditorKmtStateMachine = StateMachine<
    TrainEditorKmtEvents,
    TrainEditorKmtContext,
    KmtInputStates,
    KmtInputEventOutputMapping
>;

export function createTrainEditorKmtExtension(
    toolSwitcherStateMachine: TrainEditorToolStateMachine,
    context: TrainEditorKmtContext,
): TrainEditorKmtStateMachine {
    const states = {
        IDLE: new TrainEditorKmtIdleState(toolSwitcherStateMachine),
        READY_TO_PAN_VIA_SPACEBAR: expandState(new ReadyToPanViaSpaceBarState()),
        INITIAL_PAN: expandState(new InitialPanState()),
        PAN: expandState(new PanState()),
        READY_TO_PAN_VIA_SCROLL_WHEEL: expandState(new ReadyToPanViaScrollWheelState()),
        PAN_VIA_SCROLL_WHEEL: expandState(new PanViaScrollWheelState()),
        DISABLED: expandState(new DisabledState()),
    };

    return new TemplateStateMachine<
        TrainEditorKmtEvents,
        TrainEditorKmtContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    >(states, 'IDLE', context);
}
