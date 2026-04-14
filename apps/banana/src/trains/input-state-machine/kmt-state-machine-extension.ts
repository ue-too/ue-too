import { StateMachine } from '@ue-too/being';
import {
    Defer,
    EventReactions,
    Guard,
    State,
    TemplateState,
    TemplateStateMachine,
} from '@ue-too/being';
import {
    DisabledState,
    InitialPanState,
    KmtIdleState,
    KmtInputContext,
    KmtInputEventMapping,
    KmtInputEventOutputMapping,
    KmtInputStateMachineWebWorkerProxy,
    KmtInputStates,
    PanState,
    PanViaScrollWheelState,
    ReadyToPanViaScrollWheelState,
    ReadyToPanViaSpaceBarState,
} from '@ue-too/board';

import type { DualSpinePlacementStateMachine } from '@/stations/dual-spine-placement-state-machine';
import type { SingleSpinePlacementStateMachine } from '@/stations/single-spine-placement-state-machine';
import { StationPlacementStateMachine } from '@/stations/station-placement-state-machine';

import { CatenaryLayoutStateMachine } from './catenary-layout-state-machine';
import { CurveCreationEngine } from './curve-engine';
import { DuplicateToSideStateMachine } from './duplicate-to-side-state-machine';
import type { JointDirectionStateMachine } from './joint-direction-state-machine';
import {
    LayoutContext,
    LayoutEvents,
    LayoutStateMachine,
} from './layout-kmt-state-machine';
import {
    ToolSwitcherContext,
    ToolSwitcherEvents,
    ToolSwitcherStateMachine,
    createToolSwitcherStateMachine,
} from './tool-switcher-state-machine';
import { TrainPlacementStateMachine } from './train-kmt-state-machine';
import { createLayoutStateMachine } from './utils';

type KmtStateMachineEventWithToolSwitcher = KmtInputEventMapping &
    ToolSwitcherEvents & {
        startDeletion: {};
        endDeletion: {};
    };

type KmtStateMachineExtensionContext = KmtInputContext & ToolSwitcherContext;

class KmtStateMachineExtensionIdleState extends TemplateState<
    KmtStateMachineEventWithToolSwitcher,
    KmtStateMachineExtensionContext,
    KmtInputStates,
    KmtInputEventOutputMapping
> {
    private _originalEventReactions: EventReactions<
        KmtStateMachineEventWithToolSwitcher,
        KmtStateMachineExtensionContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    >;
    private _toolSwitcherSubStateMachine: ToolSwitcherStateMachine;

    constructor(
        layoutSubStateMachine: LayoutStateMachine,
        trainSubStateMachine: TrainPlacementStateMachine,
        stationSubStateMachine: StationPlacementStateMachine,
        duplicateSubStateMachine: DuplicateToSideStateMachine,
        catenarySubStateMachine: CatenaryLayoutStateMachine,
        singleSpineSubStateMachine: SingleSpinePlacementStateMachine,
        dualSpineSubStateMachine: DualSpinePlacementStateMachine,
        jointDirectionSubStateMachine: JointDirectionStateMachine
    ) {
        super();
        const originalIdleState = new KmtIdleState();
        this._originalEventReactions =
            originalIdleState.eventReactions as unknown as EventReactions<
                KmtStateMachineEventWithToolSwitcher,
                KmtStateMachineExtensionContext,
                KmtInputStates,
                KmtInputEventOutputMapping
            >;

        this._eventReactions = {
            ...this._originalEventReactions,
        } as EventReactions<
            KmtStateMachineEventWithToolSwitcher,
            KmtStateMachineExtensionContext,
            KmtInputStates,
            KmtInputEventOutputMapping
        >;

        this.uponEnter = originalIdleState.uponEnter as unknown as (
            context: KmtStateMachineExtensionContext,
            stateMachine: TemplateStateMachine<
                KmtStateMachineEventWithToolSwitcher,
                KmtStateMachineExtensionContext,
                KmtInputStates,
                KmtInputEventOutputMapping
            >,
            from: KmtInputStates | 'INITIAL'
        ) => void;

        this.beforeExit = originalIdleState.beforeExit as unknown as (
            context: KmtStateMachineExtensionContext,
            stateMachine: TemplateStateMachine<
                KmtStateMachineEventWithToolSwitcher,
                KmtStateMachineExtensionContext,
                KmtInputStates,
                KmtInputEventOutputMapping
            >,
            to: KmtInputStates | 'TERMINAL'
        ) => void;

        this._guards =
            originalIdleState.guards as unknown as Guard<KmtStateMachineExtensionContext>;

        this._toolSwitcherSubStateMachine = createToolSwitcherStateMachine(
            layoutSubStateMachine,
            trainSubStateMachine,
            stationSubStateMachine,
            duplicateSubStateMachine,
            catenarySubStateMachine,
            singleSpineSubStateMachine,
            dualSpineSubStateMachine,
            jointDirectionSubStateMachine
        );
    }

    protected _defer: Defer<
        KmtStateMachineExtensionContext,
        KmtStateMachineEventWithToolSwitcher,
        KmtInputStates,
        KmtInputEventOutputMapping
    > = {
        action: (context, event, eventKey, stateMachine) => {
            // console.log('eventKey', eventKey, 'event', event);
            // console.log('current state of the tool switcher sub state machine', this._toolSwitcherSubStateMachine.currentState);
            const key = eventKey as keyof ToolSwitcherEvents;
            const payload =
                event as ToolSwitcherEvents[keyof ToolSwitcherEvents];
            // Assert: at runtime key and payload are correlated; TS can't infer from the union
            const result = (
                this._toolSwitcherSubStateMachine.happens as (
                    k: keyof ToolSwitcherEvents,
                    p: ToolSwitcherEvents[keyof ToolSwitcherEvents]
                ) => ReturnType<ToolSwitcherStateMachine['happens']>
            )(key, payload);
            // const result = this._toolSwitcherSubStateMachine.happens(key, payload);
            // console.log('result', result);
            if (result.handled) {
                return {
                    handled: true,
                    output: result.output,
                };
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
    layoutSubStateMachine: LayoutStateMachine,
    trainSubStateMachine: TrainPlacementStateMachine,
    stationSubStateMachine: StationPlacementStateMachine,
    duplicateSubStateMachine: DuplicateToSideStateMachine,
    catenarySubStateMachine: CatenaryLayoutStateMachine,
    singleSpineSubStateMachine: SingleSpinePlacementStateMachine,
    dualSpineSubStateMachine: DualSpinePlacementStateMachine,
    jointDirectionSubStateMachine: JointDirectionStateMachine,
    context: KmtStateMachineExtensionContext
): KmtExpandedStateMachine {
    const states = {
        IDLE: new KmtStateMachineExtensionIdleState(
            layoutSubStateMachine,
            trainSubStateMachine,
            stationSubStateMachine,
            duplicateSubStateMachine,
            catenarySubStateMachine,
            singleSpineSubStateMachine,
            dualSpineSubStateMachine,
            jointDirectionSubStateMachine
        ),
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

    const stateMachine = new TemplateStateMachine<
        KmtStateMachineEventWithToolSwitcher,
        KmtStateMachineExtensionContext,
        KmtInputStates,
        KmtInputEventOutputMapping
    >(states, 'IDLE', context);

    return stateMachine;
}
