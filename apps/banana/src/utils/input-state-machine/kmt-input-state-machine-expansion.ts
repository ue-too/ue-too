import { BaseContext, CreateStateType, EventReactions, Guard, State, StateMachine, TemplateState, TemplateStateMachine } from "@ue-too/being";
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

export const KMT_INPUT_STATE_MACHINE_EXPANSION_STATES = ['PLACEMENT'] as const;

export type KmtInputStateMachineExpansionStates = KmtInputStates | CreateStateType<typeof KMT_INPUT_STATE_MACHINE_EXPANSION_STATES>;

export type KmtExpandedStateMachine = StateMachine<KmtInputStateMachineExpansionEventMapping, KmtInputStateMachineExpansionContext, KmtInputStateMachineExpansionStates, KmtInputStateMachineExpansionEventOutputMapping>;

/**
 * Type helper that safely adapts a state with original generics to work with expanded generics.
 * 
 * @remarks
 * Since the expansion types are supersets of the original types, states typed with
 * the original generics can safely be used with the expanded generics. This type
 * assertion is safe because:
 * - Expanded context extends original context (all original properties are present)
 * - Expanded event mapping extends original event mapping (all original events are present)
 * - Expanded states include original states (all original states are present)
 * - Expanded output mapping extends original output mapping (all original outputs are present)
 * 
 * This helper function provides a type-safe way to use original states in the expansion.
 */
function adaptStateToExpansion<
    T extends State<KmtInputEventMapping, KmtInputContext, KmtInputStates, KmtInputEventOutputMapping>
>(
    state: T
): State<
    KmtInputStateMachineExpansionEventMapping,
    KmtInputStateMachineExpansionContext,
    KmtInputStateMachineExpansionStates,
    KmtInputStateMachineExpansionEventOutputMapping
> {
    // Type assertion is safe because expansion types are supersets
    return state as unknown as State<
        KmtInputStateMachineExpansionEventMapping,
        KmtInputStateMachineExpansionContext,
        KmtInputStateMachineExpansionStates,
        KmtInputStateMachineExpansionEventOutputMapping
    >;
}

export const createAdaptedStateToExpansionFunc = <OldState extends State<any, any, any, any>, NewState extends State<any, any, any, any>>() => {
    return (state: OldState): NewState => {
        return state as unknown as NewState;
    }
}

const expandState = createAdaptedStateToExpansionFunc<State<KmtInputEventMapping, KmtInputContext, KmtInputStates, KmtInputEventOutputMapping>, State<KmtInputStateMachineExpansionEventMapping, KmtInputStateMachineExpansionContext, KmtInputStateMachineExpansionStates, KmtInputStateMachineExpansionEventOutputMapping>>();

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
export class KmtExtendedIdleState extends TemplateState<KmtInputStateMachineExpansionEventMapping, KmtInputStateMachineExpansionContext, KmtInputStateMachineExpansionStates> {


    constructor() {
        super();

        const originalIdleState = new KmtIdleState();
        // Get parent's event reactions (typed with original generics)
        // Cast to expanded type - safe because expansion types are supersets
        const parentReactions = originalIdleState.eventReactions as unknown as EventReactions<
            KmtInputStateMachineExpansionEventMapping,
            KmtInputStateMachineExpansionContext,
            KmtInputStateMachineExpansionStates,
            KmtInputStateMachineExpansionEventOutputMapping
        >;

        this.uponEnter = originalIdleState.uponEnter as (context: KmtInputContext, stateMachine: KmtExpandedStateMachine, from: KmtInputStateMachineExpansionStates | 'INITIAL') => void;
        this.beforeExit = originalIdleState.beforeExit as (context: KmtInputContext, stateMachine: KmtExpandedStateMachine, to: KmtInputStateMachineExpansionStates | 'TERMINAL') => void;

        // Merge parent's event reactions with new ones
        // The spread operator ensures all existing handlers are preserved
        // Type assertion is safe because expansion types are supersets of original types
        this._eventReactions = {
            ...parentReactions, // Preserve all existing handlers from parent
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
                defaultTargetState: "PLACEMENT",
            },
        } as EventReactions<KmtInputStateMachineExpansionEventMapping, KmtInputStateMachineExpansionContext, KmtInputStateMachineExpansionStates, KmtInputStateMachineExpansionEventOutputMapping>;

        this._guards = {
            ...originalIdleState.guards,
            // Add your new guards here
            // Example:
            // hasEnoughMoney: (context) => context.balance >= context.itemPrice,
        } as Guard<KmtInputStateMachineExpansionContext>;

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
        'leftPointerUp': {
            action: (context, eventPayload, stateMachine) => {
                console.log('leftPointerUp', eventPayload);
            },
            defaultTargetState: 'IDLE',
        }
    };
}

export function createKmtInputStateMachineExpansion(
    context: KmtInputContext
): KmtExpandedStateMachine {
    const states = {
        IDLE: new KmtExtendedIdleState(),
        READY_TO_PAN_VIA_SPACEBAR: expandState(new ReadyToPanViaSpaceBarState()),
        INITIAL_PAN: expandState(new InitialPanState()),
        PAN: expandState(new PanState()),
        READY_TO_PAN_VIA_SCROLL_WHEEL: expandState(new ReadyToPanViaScrollWheelState()),
        PAN_VIA_SCROLL_WHEEL: expandState(new PanViaScrollWheelState()),
        DISABLED: expandState(new DisabledState()),
        PLACEMENT: new KmtPlacementState(),
    };
    return new TemplateStateMachine<
        KmtInputStateMachineExpansionEventMapping,
        KmtInputStateMachineExpansionContext,
        KmtInputStateMachineExpansionStates,
        KmtInputStateMachineExpansionEventOutputMapping
    >(states, 'IDLE', context);
}
