import { CreateStateType, EventReactions, State, StateMachine, TemplateState, TemplateStateMachine } from "@ue-too/being";
import {
    KmtIdleState,
    KmtInputStates,
    KmtInputContext,
    KmtInputEventMapping,
    KmtInputEventOutputMapping,
    DisabledState,
    PanViaScrollWheelState,
    PanState,
    InitialPanState,
    ReadyToPanViaSpaceBarState,
    ReadyToPanViaScrollWheelState,
    KmtInputStateMachine
} from "@ue-too/board";

export type KmtInputStateMachineExpansionContext = KmtInputContext & {
};

export type KmtInputStateMachineExpansionEventMapping = KmtInputEventMapping & {
};

export type KmtInputStateMachineExpansionEventOutputMapping = KmtInputEventOutputMapping & {
};

export const KMT_INPUT_STATE_MACHINE_EXPANSION_STATES = [] as const;

export type KmtInputStateMachineExpansionStates = KmtInputStates | CreateStateType<typeof KMT_INPUT_STATE_MACHINE_EXPANSION_STATES>;

export type KmtExpandedStateMachine = StateMachine<KmtInputStateMachineExpansionEventMapping, KmtInputStateMachineExpansionContext, KmtInputStateMachineExpansionStates, KmtInputStateMachineExpansionEventOutputMapping>;

/**
 * Extended IDLE state that adds additional event reactions while preserving
 * all existing handlers from KmtIdleState.
 * 
 * @remarks
 * This class extends KmtIdleState and merges event reactions, so you don't need
 * to manually delegate existing handlers. New event handlers are added to the
 * existing ones, and you can override specific handlers if needed.
 * 
 * @example
 * ```typescript
 * const extendedIdleState = new KmtExtendedIdleState();
 * // Now handles all original events PLUS any new ones you add
 * ```
 */
export class KmtExtendedIdleState extends KmtIdleState {
    constructor() {
        super();

        // Merge parent's event reactions with new ones
        // The spread operator ensures all existing handlers are preserved
        this._eventReactions = {
            ...this._eventReactions, // Preserve all existing handlers
            // Add your new event handlers here
            // Example:
            // leftPointerDown: {
            //     action: this.customLeftPointerDownHandler,
            //     defaultTargetState: 'IDLE',
            // },
            leftPointerDown: {
                action: (context, eventPayload, stateMachine) => {
                    console.log('leftPointerDown', eventPayload);
                },
                defaultTargetState: 'IDLE',
            },
        };
    }

    // Example: Add a custom handler for a new event or override an existing one
    // customLeftPointerDownHandler(
    //     context: KmtInputContext,
    //     payload: PointerEventPayload
    // ): void {
    //     // Your custom logic here
    //     // You can still call the parent's handler if needed:
    //     // super.middlePointerDownHandler(context, payload);
    // }
}

export class KmtPlacementState extends TemplateState<KmtInputStateMachineExpansionEventMapping, KmtInputStateMachineExpansionContext, KmtInputStateMachineExpansionStates> {
    constructor() {
        super();
    }

    protected _eventReactions: EventReactions<KmtInputStateMachineExpansionEventMapping, KmtInputStateMachineExpansionContext, KmtInputStateMachineExpansionStates> = {
    };
}

export function createKmtInputStateMachineExpansion(
    context: KmtInputContext
): KmtExpandedStateMachine {
    const states = {
        IDLE: new KmtExtendedIdleState(),
        READY_TO_PAN_VIA_SPACEBAR: new ReadyToPanViaSpaceBarState(),
        INITIAL_PAN: new InitialPanState(),
        PAN: new PanState(),
        READY_TO_PAN_VIA_SCROLL_WHEEL: new ReadyToPanViaScrollWheelState(),
        PAN_VIA_SCROLL_WHEEL: new PanViaScrollWheelState(),
        DISABLED: new DisabledState(),
    };
    return new TemplateStateMachine<
        KmtInputStateMachineExpansionEventMapping,
        KmtInputStateMachineExpansionContext,
        KmtInputStateMachineExpansionStates,
        KmtInputStateMachineExpansionEventOutputMapping
    >(states, 'IDLE', context);
}
