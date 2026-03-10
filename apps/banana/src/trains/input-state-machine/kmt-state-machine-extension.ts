import { DisabledState, InitialPanState, KmtIdleState, KmtInputContext, KmtInputEventMapping, KmtInputEventOutputMapping, KmtInputStateMachineWebWorkerProxy, KmtInputStates, PanState, PanViaScrollWheelState, ReadyToPanViaScrollWheelState, ReadyToPanViaSpaceBarState } from "@ue-too/board";
import { StateMachine } from "@ue-too/being";
import { LayoutContext, LayoutEvents, LayoutStateMachine } from "./layout-kmt-state-machine";
import { Defer, EventReactions, Guard, State, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { createLayoutStateMachine } from "./utils";
import { CurveCreationEngine } from "./curve-engine";
import { createToolSwitcherStateMachine, ToolSwitcherContext, ToolSwitcherEvents, ToolSwitcherStateMachine } from "./tool-switcher-state-machine";

type KmtStateMachineEventWithToolSwitcher = KmtInputEventMapping & ToolSwitcherEvents;

type KmtStateMachineExtensionContext = KmtInputContext & ToolSwitcherContext;

const KMT_STATE_MACHINE_EVENT_WITH_TOOL_SWITCHER_KEYS: (keyof LayoutEvents | keyof ToolSwitcherEvents)[] = [
    'switchToLayout',
    'switchToTrain',
    'switchToIdle',
];

const KMT_STATE_MACHINE_EVENT_WITH_TOOL_SWITCHER_KEY_SET = new Set<string>(KMT_STATE_MACHINE_EVENT_WITH_TOOL_SWITCHER_KEYS);

class KmtStateMachineExtensionIdleState extends TemplateState<KmtStateMachineEventWithToolSwitcher, KmtStateMachineExtensionContext, KmtInputStates, KmtInputEventOutputMapping> {

    private _originalEventReactions: EventReactions<KmtStateMachineEventWithToolSwitcher, KmtStateMachineExtensionContext, KmtInputStates, KmtInputEventOutputMapping>;
    private _toolSwitcherSubStateMachine: ToolSwitcherStateMachine;

    constructor(curveEngine: CurveCreationEngine) {
        super();
        const originalIdleState = new KmtIdleState();
        this._originalEventReactions = originalIdleState.eventReactions as unknown as EventReactions<KmtStateMachineEventWithToolSwitcher, KmtStateMachineExtensionContext, KmtInputStates, KmtInputEventOutputMapping>;

        this._eventReactions = {
            ...this._originalEventReactions,
        } as EventReactions<KmtStateMachineEventWithToolSwitcher, KmtStateMachineExtensionContext, KmtInputStates, KmtInputEventOutputMapping>;


        this.uponEnter = originalIdleState.uponEnter as unknown as (
            context: KmtStateMachineExtensionContext,
            stateMachine: TemplateStateMachine<KmtStateMachineEventWithToolSwitcher, KmtStateMachineExtensionContext, KmtInputStates, KmtInputEventOutputMapping>,
            from: KmtInputStates | 'INITIAL'
        ) => void;

        this.beforeExit = originalIdleState.beforeExit as unknown as (
            context: KmtStateMachineExtensionContext,
            stateMachine: TemplateStateMachine<KmtStateMachineEventWithToolSwitcher, KmtStateMachineExtensionContext, KmtInputStates, KmtInputEventOutputMapping>,
            to: KmtInputStates | 'TERMINAL'
        ) => void;

        this._guards = originalIdleState.guards as unknown as Guard<KmtStateMachineExtensionContext>;

        this._toolSwitcherSubStateMachine = createToolSwitcherStateMachine(curveEngine);
    }

    protected _defer: Defer<KmtStateMachineExtensionContext, KmtStateMachineEventWithToolSwitcher, KmtInputStates, KmtInputEventOutputMapping> = {
        action: (context, event, eventKey, stateMachine) => {
            // console.log('eventKey', eventKey, 'event', event);
            // console.log('current state of the tool switcher sub state machine', this._toolSwitcherSubStateMachine.currentState);
            const key = eventKey as keyof ToolSwitcherEvents;
            const payload = event as ToolSwitcherEvents[keyof ToolSwitcherEvents];
            // Assert: at runtime key and payload are correlated; TS can't infer from the union
            const result = (this._toolSwitcherSubStateMachine.happens as (
                k: keyof ToolSwitcherEvents,
                p: ToolSwitcherEvents[keyof ToolSwitcherEvents]
            ) => ReturnType<ToolSwitcherStateMachine['happens']>)(key, payload);
            // const result = this._toolSwitcherSubStateMachine.happens(key, payload);
            // console.log('result', result);
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
        KmtInputEventMapping,
        KmtInputContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    >,
    State<
        KmtStateMachineEventWithToolSwitcher,
        KmtStateMachineExtensionContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    >
>();

export type KmtExpandedStateMachine = StateMachine<
    KmtStateMachineEventWithToolSwitcher,
    KmtStateMachineExtensionContext,
    KmtInputStates,
    KmtInputEventOutputMapping
>;

export function createKmtInputStateMachineExpansion(
    curveEngine: CurveCreationEngine
): KmtExpandedStateMachine {
    const states = {
        IDLE: new KmtStateMachineExtensionIdleState(curveEngine),
        READY_TO_PAN_VIA_SPACEBAR: expandState(
            new ReadyToPanViaSpaceBarState()
        ),
        INITIAL_PAN: expandState(new InitialPanState()),
        PAN: expandState(new PanState()),
        READY_TO_PAN_VIA_SCROLL_WHEEL: expandState(
            new ReadyToPanViaScrollWheelState()
        ),
        PAN_VIA_SCROLL_WHEEL: expandState(new PanViaScrollWheelState()),
        DISABLED: expandState(new DisabledState()),
    };
    return new TemplateStateMachine<
        KmtStateMachineEventWithToolSwitcher,
        KmtStateMachineExtensionContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    >(states, 'IDLE', curveEngine);
}
