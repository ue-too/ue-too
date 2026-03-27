/**
 * KMT extension for the track maker — bridges the board's pan/zoom/camera
 * state machine with the track maker editing state machine.
 *
 * Follows the exact pattern from banana's train-editor-kmt-extension.ts:
 * the IDLE state's _defer forwards unhandled events to the track maker
 * state machine, allowing pan/zoom to coexist with editing.
 */

import {
    DisabledState,
    InitialPanState,
    KmtIdleState,
    type KmtInputContext,
    type KmtInputEventMapping,
    type KmtInputEventOutputMapping,
    type KmtInputStates,
    PanState,
    PanViaScrollWheelState,
    ReadyToPanViaScrollWheelState,
    ReadyToPanViaSpaceBarState,
} from '@ue-too/board';
import {
    type Defer,
    type EventReactions,
    type Guard,
    type State,
    type StateMachine,
    TemplateState,
    TemplateStateMachine,
} from '@ue-too/being';

import type {
    TrackMakerEvents,
    TrackMakerStateMachine,
} from './track-maker-state-machine';

// ---------------------------------------------------------------------------
// Combined event type: KMT events + track maker events
// ---------------------------------------------------------------------------

type TrackMakerKmtEvents = KmtInputEventMapping & TrackMakerEvents;
type TrackMakerKmtContext = KmtInputContext;

// ---------------------------------------------------------------------------
// Extended IDLE state — delegates unhandled events to track maker SM
// ---------------------------------------------------------------------------

class TrackMakerKmtIdleState extends TemplateState<
    TrackMakerKmtEvents,
    TrackMakerKmtContext,
    KmtInputStates,
    KmtInputEventOutputMapping
> {
    private _trackMakerStateMachine: TrackMakerStateMachine;

    constructor(trackMakerStateMachine: TrackMakerStateMachine) {
        super();
        const originalIdleState = new KmtIdleState();

        this._eventReactions = {
            ...(originalIdleState.eventReactions as unknown as EventReactions<
                TrackMakerKmtEvents,
                TrackMakerKmtContext,
                KmtInputStates,
                KmtInputEventOutputMapping
            >),
        };

        this.uponEnter = originalIdleState.uponEnter as unknown as (
            context: TrackMakerKmtContext,
            stateMachine: TemplateStateMachine<
                TrackMakerKmtEvents,
                TrackMakerKmtContext,
                KmtInputStates,
                KmtInputEventOutputMapping
            >,
            from: KmtInputStates | 'INITIAL',
        ) => void;

        this.beforeExit = originalIdleState.beforeExit as unknown as (
            context: TrackMakerKmtContext,
            stateMachine: TemplateStateMachine<
                TrackMakerKmtEvents,
                TrackMakerKmtContext,
                KmtInputStates,
                KmtInputEventOutputMapping
            >,
            to: KmtInputStates | 'TERMINAL',
        ) => void;

        this._guards = originalIdleState.guards as unknown as Guard<TrackMakerKmtContext>;
        this._trackMakerStateMachine = trackMakerStateMachine;
    }

    protected _defer: Defer<
        TrackMakerKmtContext,
        TrackMakerKmtEvents,
        KmtInputStates,
        KmtInputEventOutputMapping
    > = {
        action: (_context, event, eventKey) => {
            const key = eventKey as keyof TrackMakerEvents;
            const payload = event as TrackMakerEvents[keyof TrackMakerEvents];
            const result = (
                this._trackMakerStateMachine.happens as (
                    k: keyof TrackMakerEvents,
                    p: TrackMakerEvents[keyof TrackMakerEvents],
                ) => ReturnType<TrackMakerStateMachine['happens']>
            )(key, payload);
            if (result.handled) {
                return { handled: true, output: result.output };
            }
            return { handled: false };
        },
    };
}

// ---------------------------------------------------------------------------
// Adapted state helper (same pattern as banana)
// ---------------------------------------------------------------------------

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
    State<TrackMakerKmtEvents, TrackMakerKmtContext, KmtInputStates, KmtInputEventOutputMapping>
>();

// ---------------------------------------------------------------------------
// Type alias
// ---------------------------------------------------------------------------

export type TrackMakerKmtStateMachine = StateMachine<
    TrackMakerKmtEvents,
    TrackMakerKmtContext,
    KmtInputStates,
    KmtInputEventOutputMapping
>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTrackMakerKmtExtension(
    trackMakerStateMachine: TrackMakerStateMachine,
    context: TrackMakerKmtContext,
): TrackMakerKmtStateMachine {
    const states = {
        IDLE: new TrackMakerKmtIdleState(trackMakerStateMachine),
        READY_TO_PAN_VIA_SPACEBAR: expandState(new ReadyToPanViaSpaceBarState()),
        INITIAL_PAN: expandState(new InitialPanState()),
        PAN: expandState(new PanState()),
        READY_TO_PAN_VIA_SCROLL_WHEEL: expandState(new ReadyToPanViaScrollWheelState()),
        PAN_VIA_SCROLL_WHEEL: expandState(new PanViaScrollWheelState()),
        DISABLED: expandState(new DisabledState()),
    };

    return new TemplateStateMachine<
        TrackMakerKmtEvents,
        TrackMakerKmtContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    >(states, 'IDLE', context);
}
