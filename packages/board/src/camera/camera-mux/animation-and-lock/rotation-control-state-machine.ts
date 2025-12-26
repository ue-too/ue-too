import type { EventReactions, State, BaseContext } from "@ue-too/being";
import { NO_OP, TemplateState, TemplateStateMachine } from "@ue-too/being";

/**
 * State identifiers for the rotation control state machine.
 *
 * @remarks
 * Three states manage rotation input and animations:
 * - `ACCEPTING_USER_INPUT`: Normal state, accepts user rotation input
 * - `TRANSITION`: Animation/transition state, may block user input
 * - `LOCKED_ON_OBJECT`: Camera locked to follow a specific object rotation
 *
 * @category Input Flow Control
 */
export type RotateControlStates = "ACCEPTING_USER_INPUT" | "TRANSITION" | "LOCKED_ON_OBJECT";

/**
 * Payload for rotate-by input events (relative rotation).
 * @category Input Flow Control
 */
export type RotateByInputEventPayload = {
    /** Rotation angle delta in radians */
    diff: number;
};

/**
 * Payload for rotate-to input events (absolute rotation).
 * @category Input Flow Control
 */
export type RotateToInputEventPayload = {
    /** Target rotation angle in radians */
    target: number;
};

/** Empty payload for events that don't need data */
type EmptyPayload = {};

/**
 * Event payload type mapping for the rotation control state machine.
 *
 * @remarks
 * Maps event names to their payload types. Events include:
 * - User input events (`userRotateByInput`, `userRotateToInput`)
 * - Transition/animation events (`transitionRotateByInput`, `transitionRotateToInput`)
 * - Locked object events (`lockedOnObjectRotateByInput`, `lockedOnObjectRotateToInput`)
 * - Control events (`unlock`, `initateTransition`)
 *
 * @category Input Flow Control
 */
export type RotateEventPayloadMapping = {
    "userRotateByInput": RotateByInputEventPayload,
    "userRotateToInput": RotateToInputEventPayload,
    "transitionRotateByInput": RotateByInputEventPayload,
    "transitionRotateToInput": RotateToInputEventPayload,
    "lockedOnObjectRotateByInput": RotateByInputEventPayload,
    "lockedOnObjectRotateToInput": RotateToInputEventPayload,
    "unlock": EmptyPayload,
    "initateTransition": EmptyPayload,
};

/**
 * Discriminated union of output events from rotation control state machine.
 *
 * @remarks
 * Output events instruct the camera system what rotation operation to perform:
 * - `rotateBy`: Relative rotation by delta angle
 * - `rotateTo`: Absolute rotation to target angle
 * - `none`: No operation (input blocked)
 *
 * @category Input Flow Control
 */
export type RotateControlOutputEvent =
    | { type: "rotateBy", delta: number }
    | { type: "rotateTo", target: number }
    | { type: "none" };

/**
 * Output event type mapping for rotation control events.
 * Maps input event names to their corresponding output event types.
 *
 * @category Input Flow Control
 */
export type RotateControlOutputMapping = {
    "userRotateByInput": RotateControlOutputEvent,
    "userRotateToInput": RotateControlOutputEvent,
    "transitionRotateByInput": RotateControlOutputEvent,
    "transitionRotateToInput": RotateControlOutputEvent,
    "lockedOnObjectRotateByInput": RotateControlOutputEvent,
    "lockedOnObjectRotateToInput": RotateControlOutputEvent,
};

/**
 * State machine controlling rotation input flow and animations.
 *
 * @remarks
 * This state machine manages the lifecycle of rotation operations:
 * - **User input handling**: Accepts or blocks user rotation gestures based on state
 * - **Animation control**: Manages smooth rotate-to animations
 * - **Object tracking**: Supports locking camera to follow objects with rotation
 *
 * **State transitions:**
 * - `ACCEPTING_USER_INPUT` → `TRANSITION`: Start animation (`initateTransition`)
 * - `ACCEPTING_USER_INPUT` → `LOCKED_ON_OBJECT`: Lock to object (`lockedOnObjectRotate...`)
 * - `TRANSITION` → `ACCEPTING_USER_INPUT`: User input interrupts animation
 * - `LOCKED_ON_OBJECT` → `ACCEPTING_USER_INPUT`: Unlock (`unlock` event)
 *
 * Helper methods simplify event dispatching without memorizing event names.
 *
 * @example
 * ```typescript
 * const stateMachine = createDefaultRotateControlStateMachine(cameraRig);
 *
 * // User rotates - accepted in ACCEPTING_USER_INPUT state
 * const result = stateMachine.notifyRotateByInput(Math.PI / 4);
 *
 * // Start animation - transitions to TRANSITION state
 * stateMachine.notifyRotateToAnimationInput(Math.PI);
 *
 * // User input now blocked while animating
 * ```
 *
 * @category Input Flow Control
 * @see {@link createDefaultRotateControlStateMachine} for factory function
 */
export class RotateControlStateMachine extends TemplateStateMachine<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping> {

    constructor(states: Record<RotateControlStates, State<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping>>, initialState: RotateControlStates, context: BaseContext){
        super(states, initialState, context);
    }

    /**
     * Notifies the state machine of user rotation input.
     *
     * @param diff - Rotation angle delta in radians
     * @returns Event handling result with output event
     *
     * @remarks
     * Dispatches `userRotateByInput` event. Accepted in `ACCEPTING_USER_INPUT` and `TRANSITION` states,
     * where it may transition back to `ACCEPTING_USER_INPUT` (user interrupting animation).
     */
    notifyRotateByInput(diff: number) {
        return this.happens("userRotateByInput", {diff: diff});
    }

    /**
     * Initiates a rotation animation to a target angle.
     *
     * @param target - Target rotation angle in radians
     * @returns Event handling result
     *
     * @remarks
     * Dispatches `transitionRotateToInput` event, starting a rotation animation.
     * Transitions to `TRANSITION` state where animation updates occur.
     */
    notifyRotateToAnimationInput(target: number) {
        return this.happens("transitionRotateToInput", {target: target});
    }

    /**
     * Initiates transition to `TRANSITION` state.
     *
     * @remarks
     * Forces state change to begin animation or transition sequence.
     * Called when starting programmatic camera movements.
     */
    initateTransition(): void{
        this.happens("initateTransition");
    }

}

/**
 * State implementation for accepting user rotation input (idle/normal state).
 * Accepts user rotation input and can transition to animation or locked states.
 * @category Input Flow Control
 */
export class RotationAcceptingUserInputState extends TemplateState<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping> {

    constructor(){
        super();
    }

    eventReactions: EventReactions<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping> = {
        userRotateByInput: {action: this.userRotateByInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userRotateToInput: {action: this.userRotateToInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        lockedOnObjectRotateByInput: {action: this.lockedOnObjectRotateByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectRotateToInput: {action: this.lockedOnObjectRotateToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        initateTransition: {action: NO_OP, defaultTargetState: "TRANSITION"},
    }

    userRotateByInputHandler(context: BaseContext, payload: RotateByInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateBy", delta: payload.diff };
    }

    userRotateToInputHandler(context: BaseContext, payload: RotateToInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateTo", target: payload.target };
    }

    lockedOnObjectRotateByInputHandler(context: BaseContext, payload: RotateByInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateBy", delta: payload.diff };
    }

    lockedOnObjectRotateToInputHandler(context: BaseContext, payload: RotateToInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateTo", target: payload.target };
    }

}

/**
 * State implementation for rotation animations and transitions.
 * Processes animation updates and allows user input to interrupt.
 * @category Input Flow Control
 */
export class RotationTransitionState extends TemplateState<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping> {

    constructor(){
        super();
    }

    eventReactions: EventReactions<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping> = {
        userRotateByInput: {action: this.userRotateByInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userRotateToInput: {action: this.userRotateToInputHandler, defaultTargetState: "ACCEPTING_USER_INPUT"},
        transitionRotateByInput: {action: this.transitionRotateByInputHandler, defaultTargetState: "TRANSITION"},
        transitionRotateToInput: {action: this.transitionRotateToInputHandler, defaultTargetState: "TRANSITION"},
        lockedOnObjectRotateByInput: {action: this.lockedOnObjectRotateByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectRotateToInput: {action: this.lockedOnObjectRotateToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
    }

    userRotateByInputHandler(context: BaseContext, payload: RotateByInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateBy", delta: payload.diff };
    }

    userRotateToInputHandler(context: BaseContext, payload: RotateToInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateTo", target: payload.target };
    }

    transitionRotateByInputHandler(context: BaseContext, payload: RotateByInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateBy", delta: payload.diff };
    }

    transitionRotateToInputHandler(context: BaseContext, payload: RotateToInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateTo", target: payload.target };
    }

    lockedOnObjectRotateByInputHandler(context: BaseContext, payload: RotateByInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateBy", delta: payload.diff };
    }

    lockedOnObjectRotateToInputHandler(context: BaseContext, payload: RotateToInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateTo", target: payload.target };
    }

}

/**
 * State implementation for camera locked to follow an object rotation.
 * Only accepts locked object rotation events until unlocked.
 * @category Input Flow Control
 */
export class RotationLockedOnObjectState extends TemplateState<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping> {

    constructor(){
        super();
    }

    eventReactions: EventReactions<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping> = {
        unlock: {action: NO_OP, defaultTargetState: "ACCEPTING_USER_INPUT"},
        lockedOnObjectRotateByInput: {action: this.lockedOnObjectRotateByInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectRotateToInput: {action: this.lockedOnObjectRotateToInputHandler, defaultTargetState: "LOCKED_ON_OBJECT"},
    }

    lockedOnObjectRotateByInputHandler(context: BaseContext, payload: RotateByInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateBy", delta: payload.diff };
    }

    lockedOnObjectRotateToInputHandler(context: BaseContext, payload: RotateToInputEventPayload): RotateControlOutputEvent {
        return { type: "rotateTo", target: payload.target };
    }

}

/**
 * Creates the default set of rotation control states.
 * @returns State instances for all rotation control states
 * @category Input Flow Control
 */
export function createDefaultRotateControlStates(): Record<RotateControlStates, State<RotateEventPayloadMapping, BaseContext, RotateControlStates, RotateControlOutputMapping>> {
    return {
        ACCEPTING_USER_INPUT: new RotationAcceptingUserInputState(),
        TRANSITION: new RotationTransitionState(),
        LOCKED_ON_OBJECT: new RotationLockedOnObjectState(),
    }
}

/**
 * Creates a rotation control state machine with default configuration.
 *
 * @param context - Camera rig or context for rotation operations
 * @returns Configured rotation control state machine starting in `ACCEPTING_USER_INPUT` state
 *
 * @remarks
 * Factory function for creating a rotation state machine with sensible defaults.
 * The machine starts in `ACCEPTING_USER_INPUT` state, ready to accept user rotation gestures.
 *
 * @example
 * ```typescript
 * const cameraRig = createDefaultCameraRig(camera);
 * const rotateSM = createDefaultRotateControlStateMachine(cameraRig);
 * ```
 *
 * @category Input Flow Control
 */
export function createDefaultRotateControlStateMachine(context: BaseContext): RotateControlStateMachine {
    return new RotateControlStateMachine(createDefaultRotateControlStates(), "ACCEPTING_USER_INPUT", context);
}
