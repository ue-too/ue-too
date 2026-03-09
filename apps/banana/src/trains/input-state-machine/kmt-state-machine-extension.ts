import { DisabledState, InitialPanState, KmtIdleState, KmtInputContext, KmtInputEventMapping, KmtInputEventOutputMapping, KmtInputStateMachineWebWorkerProxy, KmtInputStates, PanState, PanViaScrollWheelState, ReadyToPanViaScrollWheelState, ReadyToPanViaSpaceBarState } from "@ue-too/board";
import { StateMachine } from "@ue-too/being";
import { LayoutContext, LayoutEvents, LayoutStateMachine } from "./kmt-state-machine";
import { createStateGuard, Defer, EventReactions, Guard, State, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { createLayoutStateMachine } from "./utils";
import { CurveCreationEngine } from "./curve-engine";

type KmtStateMachineEventExtension = KmtInputEventMapping & LayoutEvents;

type KmtStateMachineExtensionContext = KmtInputContext & LayoutContext;

const LAYOUT_EVENT_KEYS: (keyof LayoutEvents)[] = [
    'leftPointerDown',
    'leftPointerUp',
    'pointerMove',
    'escapeKey',
    'startLayout',
    'endLayout',
    'flipEndTangent',
    'flipStartTangent',
    'toggleStraightLine',
    'startDeletion',
    'endDeletion',
    'scroll',
    'arrowUp',
    'arrowDown',
];

const LAYOUT_EVENT_KEY_SET = new Set<string>(LAYOUT_EVENT_KEYS);

class KmtStateMachineExtensionIdleState extends TemplateState<KmtStateMachineEventExtension, KmtStateMachineExtensionContext, KmtInputStates, KmtInputEventOutputMapping> {

    private _originalEventReactions: EventReactions<KmtStateMachineEventExtension, KmtStateMachineExtensionContext, KmtInputStates, KmtInputEventOutputMapping>;
    private _layoutSubStateMachine: LayoutStateMachine;

    constructor(curveEngine: CurveCreationEngine) {
        super();
        const originalIdleState = new KmtIdleState();
        this._originalEventReactions = originalIdleState.eventReactions as unknown as EventReactions<KmtStateMachineEventExtension, KmtStateMachineExtensionContext, KmtInputStates, KmtInputEventOutputMapping>;

        this._eventReactions = {
            ...this._originalEventReactions,
        } as EventReactions<KmtStateMachineEventExtension, KmtStateMachineExtensionContext, KmtInputStates, KmtInputEventOutputMapping>;


        this.uponEnter = originalIdleState.uponEnter as unknown as (
            context: KmtStateMachineExtensionContext,
            stateMachine: TemplateStateMachine<KmtStateMachineEventExtension, KmtStateMachineExtensionContext, KmtInputStates, KmtInputEventOutputMapping>,
            from: KmtInputStates | 'INITIAL'
        ) => void;

        this.beforeExit = originalIdleState.beforeExit as unknown as (
            context: KmtStateMachineExtensionContext,
            stateMachine: TemplateStateMachine<KmtStateMachineEventExtension, KmtStateMachineExtensionContext, KmtInputStates, KmtInputEventOutputMapping>,
            to: KmtInputStates | 'TERMINAL'
        ) => void;

        this._guards = originalIdleState.guards as unknown as Guard<KmtStateMachineExtensionContext>;

        this._layoutSubStateMachine = createLayoutStateMachine(curveEngine);
    }

    protected _defer: Defer<KmtStateMachineExtensionContext, KmtStateMachineEventExtension, KmtInputStates, KmtInputEventOutputMapping> = {
        action: (context, event, eventKey, stateMachine) => {
            console.log('eventKey', eventKey, 'event', event);
            // console.log('current state of the layout sub state machine', this._layoutSubStateMachine.currentState);
            if (!LAYOUT_EVENT_KEY_SET.has(eventKey as string)) {
                return { handled: false };
            }
            const key = eventKey as keyof LayoutEvents;
            const payload = event as LayoutEvents[keyof LayoutEvents];
            // Assert: at runtime key and payload are correlated; TS can't infer from the union
            const result = (this._layoutSubStateMachine.happens as (
                k: keyof LayoutEvents,
                p: LayoutEvents[keyof LayoutEvents]
            ) => ReturnType<LayoutStateMachine['happens']>)(key, payload);
            console.log('result', result)
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
        KmtStateMachineEventExtension,
        KmtStateMachineExtensionContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    >
>();

type KmtExpandedStateMachine = StateMachine<
    KmtStateMachineEventExtension,
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
        KmtStateMachineEventExtension,
        KmtStateMachineExtensionContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    >(states, 'IDLE', curveEngine);
}
