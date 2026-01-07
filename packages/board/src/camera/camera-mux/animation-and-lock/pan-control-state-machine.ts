import { Point } from "@ue-too/math";
import type { EventReactions, State, BaseContext } from "@ue-too/being";
import { NO_OP, TemplateState, TemplateStateMachine } from "@ue-too/being";

/**
 * State identifiers for the pan control state machine.
 *
 * @remarks
 * Three states manage pan input and animations:
 * - `ACCEPTING_USER_INPUT`: Normal state, accepts user pan input
 * - `TRANSITION`: Animation/transition state, may block user input
 * - `LOCKED_ON_OBJECT`: Camera locked to follow a specific object/position
 *
 * @category Input Flow Control
 */
export type PanControlStates = "ACCEPTING_USER_INPUT" | "TRANSITION" | "LOCKED_ON_OBJECT";

/**
 * Payload for pan-by input events (relative panning).
 * @category Input Flow Control
 */
export type PanByInputEventPayload = {
    /** Pan displacement in viewport coordinates */
    diff: Point;
};

/**
 * Payload for pan-to input events (absolute panning).
 * @category Input Flow Control
 */
export type PanToInputEventPayload = {
    /** Target position to pan to */
    target: Point;
};

/** Empty payload for events that don't need data */
type EmptyPayload = {};

/**
 * Event payload type mapping for the pan control state machine.
 *
 * @remarks
 * Maps event names to their payload types. Events include:
 * - User input events (`userPanByInput`, `userPanToInput`)
 * - Transition/animation events (`transitionPanByInput`, `transitionPanToInput`)
 * - Locked object events (`lockedOnObjectPanByInput`, `lockedOnObjectPanToInput`)
 * - Control events (`unlock`, `initateTransition`)
 *
 * @category Input Flow Control
 */
export type PanEventPayloadMapping = {
    "userPanByInput": PanByInputEventPayload,
    "userPanToInput": PanToInputEventPayload,
    "transitionPanByInput": PanByInputEventPayload,
    "transitionPanToInput": PanToInputEventPayload,
    "lockedOnObjectPanByInput": PanByInputEventPayload,
    "lockedOnObjectPanToInput": PanToInputEventPayload,
    "unlock": EmptyPayload,
    "initateTransition": EmptyPayload,
};

/**
 * Discriminated union of output events from pan control state machine.
 *
 * @remarks
 * Output events instruct the camera system what pan operation to perform:
 * - `panByViewPort`: Relative pan in viewport coordinates
 * - `panToWorld`: Absolute pan to world position
 * - `none`: No operation (input blocked)
 *
 * @category Input Flow Control
 */
export type PanControlOutputEvent =
    | { type: "panByViewPort", delta: Point }
    | { type: "panToWorld", target: Point }
    | { type: "none" };

/**
 * Output event type mapping for pan control events.
 * Maps input event names to their corresponding output event types.
 *
 * @category Input Flow Control
 */
export type PanControlOutputMapping = {
    "userPanByInput": PanControlOutputEvent,
    "userPanToInput": PanControlOutputEvent,
    "transitionPanByInput": PanControlOutputEvent,
    "transitionPanToInput": PanControlOutputEvent,
    "lockedOnObjectPanByInput": PanControlOutputEvent,
    "lockedOnObjectPanToInput": PanControlOutputEvent,
};


/**
 * State machine controlling pan input flow and animations.
 *
 * @remarks
 * This state machine manages the lifecycle of pan operations:
 * - **User input handling**: Accepts or blocks user pan gestures based on state
 * - **Animation control**: Manages smooth pan-to animations
 * - **Object tracking**: Supports locking camera to follow objects
 *
 * **State transitions:**
 * - `ACCEPTING_USER_INPUT` → `TRANSITION`: Start animation (`initateTransition`)
 * - `ACCEPTING_USER_INPUT` → `LOCKED_ON_OBJECT`: Lock to object (`lockedOnObjectPan...`)
 * - `TRANSITION` → `ACCEPTING_USER_INPUT`: User input interrupts animation
 * - `LOCKED_ON_OBJECT` → `ACCEPTING_USER_INPUT`: Unlock (`unlock` event)
 *
 * Helper methods simplify event dispatching without memorizing event names.
 *
 * @example
 * ```typescript
 * const stateMachine = createDefaultPanControlStateMachine(cameraRig);
 *
 * // User pans - accepted in ACCEPTING_USER_INPUT state
 * const result = stateMachine.notifyPanInput({ x: 50, y: 30 });
 *
 * // Start animation - transitions to TRANSITION state
 * stateMachine.notifyPanToAnimationInput({ x: 1000, y: 500 });
 *
 * // User input now blocked while animating
 * ```
 *
 * @category Input Flow Control
 * @see {@link createDefaultPanControlStateMachine} for factory function
 */
export class PanControlStateMachine extends TemplateStateMachine<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping> {

    constructor(states: Record<PanControlStates, State<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping>>, initialState: PanControlStates, context: BaseContext){
        super(states, initialState, context);
    }

    /**
     * Notifies the state machine of user pan input.
     *
     * @param diff - Pan displacement in viewport coordinates
     * @returns Event handling result with output event
     *
     * @remarks
     * Dispatches `userPanByInput` event. Accepted in `ACCEPTING_USER_INPUT` and `TRANSITION` states,
     * where it may transition back to `ACCEPTING_USER_INPUT` (user interrupting animation).
     */
    notifyPanInput(diff: Point) {
        return this.happens("userPanByInput", {diff: diff});
    }

    /**
     * Initiates a pan animation to a target position.
     *
     * @param target - Target position in world coordinates
     * @returns Event handling result
     *
     * @remarks
     * Dispatches `transitionPanToInput` event, starting a pan animation.
     * Transitions to `TRANSITION` state where animation updates occur.
     */
    notifyPanToAnimationInput(target: Point) {
        return this.happens("transitionPanToInput", {target: target});
    }

    /**
     * Initiates transition to `TRANSITION` state.
     *
     * @remarks
     * Forces state change to begin animation or transition sequence.
     * Called when starting programmatic camera movements.
     */
    initateTransition() {
        return this.happens("initateTransition");
    }
}

/**
 * State implementation for accepting user pan input (idle/normal state).
 * Accepts user pan input and can transition to animation or locked states.
 * @category Input Flow Control
 */
export class AcceptingUserInputState extends TemplateState<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping> {

    constructor(){
        super();
    }

    eventReactions: EventReactions<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping> = {
        userPanByInput: {action: this.userPanByInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userPanToInput: {action: this.userPanToInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        lockedOnObjectPanByInput: {action: this.lockedOnObjectPanByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectPanToInput: {action: this.lockedOnObjectPanToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        initateTransition: {action: NO_OP, defaultTargetState: "TRANSITION"},
    }

    userPanByInputHandler(context: BaseContext, payload: PanByInputEventPayload): PanControlOutputEvent {
        return { type: "panByViewPort", delta: payload.diff };
    }

    userPanToInputHandler(context: BaseContext, payload: PanToInputEventPayload): PanControlOutputEvent {
        return { type: "panToWorld", target: payload.target };
    }

    lockedOnObjectPanByInputHandler(context: BaseContext, payload: PanByInputEventPayload): PanControlOutputEvent {
        return { type: "panByViewPort", delta: payload.diff };
    }

    lockedOnObjectPanToInputHandler(context: BaseContext, payload: PanToInputEventPayload): PanControlOutputEvent {
        return { type: "panToWorld", target: payload.target };
    }

}

/**
 * State implementation for pan animations and transitions.
 * Processes animation updates and allows user input to interrupt.
 * @category Input Flow Control
 */
export class TransitionState extends TemplateState<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping> {

    constructor(){
        super();
    }

    eventReactions: EventReactions<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping> = {
        userPanByInput: {action: this.userPanByInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userPanToInput: {action: this.userPanToInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        transitionPanByInput: {action: this.transitionPanByInputHandler, defaultTargetState: "TRANSITION"},
        transitionPanToInput: {action: this.transitionPanToInputHandler, defaultTargetState: "TRANSITION"},
        lockedOnObjectPanByInput: {action: this.lockedOnObjectPanByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectPanToInput: {action: this.lockedOnObjectPanToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
    }

    userPanByInputHandler(context: BaseContext, payload: PanByInputEventPayload): PanControlOutputEvent  {
        return { type: "panByViewPort", delta: payload.diff };
    }

    userPanToInputHandler(context: BaseContext, payload: PanToInputEventPayload): PanControlOutputEvent {
        return { type: "panToWorld", target: payload.target };
    }

    transitionPanByInputHandler(context: BaseContext, payload: PanByInputEventPayload): PanControlOutputEvent {
        return { type: "panByViewPort", delta: payload.diff };
    }

    transitionPanToInputHandler(context: BaseContext, payload: PanToInputEventPayload): PanControlOutputEvent {
        return { type: "panToWorld", target: payload.target };
    }

    lockedOnObjectPanByInputHandler(context: BaseContext, payload: PanByInputEventPayload): PanControlOutputEvent {
        return { type: "panByViewPort", delta: payload.diff };
    }

    lockedOnObjectPanToInputHandler(context: BaseContext, payload: PanToInputEventPayload): PanControlOutputEvent {
        return { type: "panToWorld", target: payload.target };
    }

}

/**
 * State implementation for camera locked to follow an object.
 * Only accepts locked object pan events until unlocked.
 * @category Input Flow Control
 */
export class LockedOnObjectState extends TemplateState<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping> {

    constructor(){
        super();
    }

    eventReactions: EventReactions<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping> = {
        unlock: {action: NO_OP, defaultTargetState: "ACCEPTING_USER_INPUT"},
        lockedOnObjectPanByInput: {action: this.lockedOnObjectPanByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectPanToInput: {action: this.lockedOnObjectPanToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
    }

    lockedOnObjectPanByInputHandler(context: BaseContext, payload: PanByInputEventPayload): PanControlOutputEvent {
        return { type: "panByViewPort", delta: payload.diff };
    }

    lockedOnObjectPanToInputHandler(context: BaseContext, payload: PanToInputEventPayload): PanControlOutputEvent {
        return { type: "panToWorld", target: payload.target };
    }

}

/**
 * Creates the default set of pan control states.
 * @returns State instances for all pan control states
 * @category Input Flow Control
 */
export function createDefaultPanControlStates(): Record<PanControlStates, State<PanEventPayloadMapping, BaseContext, PanControlStates, PanControlOutputMapping>> {
    return {
        ACCEPTING_USER_INPUT: new AcceptingUserInputState(),
        TRANSITION: new TransitionState(),
        LOCKED_ON_OBJECT: new LockedOnObjectState(),
    }
}

/**
 * Creates a pan control state machine with default configuration.
 *
 * @param context - Camera rig or context for pan operations
 * @returns Configured pan control state machine starting in `ACCEPTING_USER_INPUT` state
 *
 * @remarks
 * Factory function for creating a pan state machine with sensible defaults.
 * The machine starts in `ACCEPTING_USER_INPUT` state, ready to accept user pan gestures.
 *
 * @example
 * ```typescript
 * const cameraRig = createDefaultCameraRig(camera);
 * const panSM = createDefaultPanControlStateMachine(cameraRig);
 * ```
 *
 * @category Input Flow Control
 */
export function createDefaultPanControlStateMachine(context: BaseContext = {setup: NO_OP, cleanup: NO_OP}): PanControlStateMachine {
    return new PanControlStateMachine(createDefaultPanControlStates(), "ACCEPTING_USER_INPUT", context);
}
