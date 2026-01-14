import type { State, EventReactions, BaseContext } from "@ue-too/being";
import { NO_OP, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { Point } from "@ue-too/math";

/**
 * State identifiers for the zoom control state machine.
 *
 * @remarks
 * Three states manage zoom input and animations:
 * - `ACCEPTING_USER_INPUT`: Normal state, accepts user zoom input
 * - `TRANSITION`: Animation/transition state, may block user input
 * - `LOCKED_ON_OBJECT`: Camera locked to follow a specific object with zoom
 *
 * @category Input Flow Control
 */
export type ZoomControlStates = "ACCEPTING_USER_INPUT" | "TRANSITION" | "LOCKED_ON_OBJECT";

/**
 * Payload for zoom-by-at input events (relative zoom around a point).
 * @category Input Flow Control
 */
export type ZoomByAtInputPayload = {
    /** Zoom delta amount (multiplier) */
    deltaZoom: number;
    /** Anchor point for zoom operation */
    anchorPoint: Point;
}

/**
 * Payload for zoom-to-at input events (absolute zoom to target around a point).
 * @category Input Flow Control
 */
export type ZoomToAtInputPayload = {
    /** Target zoom level */
    targetZoom: number;
    /** Anchor point for zoom operation */
    anchorPoint: Point;
}

/**
 * Payload for zoom-by input events (relative zoom without anchor).
 * @category Input Flow Control
 */
export type ZoomByPayload = {
    /** Zoom delta amount (multiplier) */
    deltaZoom: number;
}

/**
 * Payload for zoom-to input events (absolute zoom to target level).
 * @category Input Flow Control
 */
export type ZoomToPayload = {
    /** Target zoom level */
    targetZoom: number;
}

/**
 * Event payload type mapping for the zoom control state machine.
 *
 * @remarks
 * Maps event names to their payload types. Events include:
 * - User input events (`userZoomByAtInput`, `userZoomToAtInput`)
 * - Transition/animation events (`transitionZoomByAtInput`, `transitionZoomToAtInput`, etc.)
 * - Locked object events (`lockedOnObjectZoomByAtInput`, `lockedOnObjectZoomToAtInput`)
 * - Control events (`unlock`, `initiateTransition`)
 *
 * @category Input Flow Control
 */
export type ZoomEventPayloadMapping = {
    "userZoomByAtInput": ZoomByAtInputPayload,
    "userZoomToAtInput": ZoomToAtInputPayload,
    "transitionZoomByAtInput": ZoomByAtInputPayload,
    "transitionZoomToAtInput": ZoomToAtInputPayload,
    "transitionZoomByAtCenterInput": ZoomByPayload,
    "transitionZoomToAtCenterInput": ZoomToAtInputPayload,
    "transitionZoomToAtWorldInput": ZoomToAtInputPayload,
    "lockedOnObjectZoomByAtInput": ZoomByAtInputPayload,
    "lockedOnObjectZoomToAtInput": ZoomToAtInputPayload,
    "unlock": {},
    "initiateTransition": {},
};

/**
 * Discriminated union of output events from zoom control state machine.
 *
 * @remarks
 * Output events instruct the camera system what zoom operation to perform:
 * - `zoomByAt`: Relative zoom around anchor point
 * - `zoomToAt`: Absolute zoom to target level around anchor point
 * - `zoomBy`: Relative zoom without anchor
 * - `zoomTo`: Absolute zoom to target level without anchor
 * - `zoomByAtWorld`: Relative zoom around world anchor point
 * - `zoomToAtWorld`: Absolute zoom to target level around world anchor point
 * - `none`: No operation (input blocked)
 *
 * @category Input Flow Control
 */
export type ZoomControlOutputEvent =
    | { type: "zoomByAt", deltaZoom: number, anchorPoint: Point }
    | { type: "zoomToAt", targetZoom: number, anchorPoint: Point }
    | { type: "zoomBy", deltaZoom: number }
    | { type: "zoomTo", targetZoom: number }
    | { type: "zoomByAtWorld", deltaZoom: number, anchorPoint: Point }
    | { type: "zoomToAtWorld", targetZoom: number, anchorPoint: Point }
    | { type: "none" };

/**
 * Output event type mapping for zoom control events.
 * Maps input event names to their corresponding output event types.
 *
 * @category Input Flow Control
 */
export type ZoomControlOutputMapping = {
    "userZoomByAtInput": ZoomControlOutputEvent,
    "userZoomToAtInput": ZoomControlOutputEvent,
    "transitionZoomByAtInput": ZoomControlOutputEvent,
    "transitionZoomToAtInput": ZoomControlOutputEvent,
    "transitionZoomByAtCenterInput": ZoomControlOutputEvent,
    "transitionZoomToAtCenterInput": ZoomControlOutputEvent,
    "transitionZoomToAtWorldInput": ZoomControlOutputEvent,
    "lockedOnObjectZoomByAtInput": ZoomControlOutputEvent,
    "lockedOnObjectZoomToAtInput": ZoomControlOutputEvent,
};

/**
 * State implementation for accepting user zoom input (idle/normal state).
 * Accepts user zoom input and can transition to animation or locked states.
 * @category Input Flow Control
 */
export class ZoomAcceptingUserInputState extends TemplateState<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> {

    protected _eventReactions: EventReactions<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> = {
        userZoomByAtInput: {action: this.userZoomByAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userZoomToAtInput: {action: this.userZoomToAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        initiateTransition: {action: NO_OP, defaultTargetState: "TRANSITION"},
    };

    userZoomByAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["userZoomByAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomByAt", deltaZoom: payload.deltaZoom, anchorPoint: payload.anchorPoint };
    }

    userZoomToAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["userZoomToAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomToAt", targetZoom: payload.targetZoom, anchorPoint: payload.anchorPoint };
    }
}

/**
 * State implementation for zoom animations and transitions.
 * Processes animation updates and allows user input to interrupt.
 * @category Input Flow Control
 */
export class ZoomTransitionState extends TemplateState<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> {

    constructor(){
        super();
    }

    protected _eventReactions: EventReactions<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> = {
        lockedOnObjectZoomByAtInput: {action: this.lockedOnObjectZoomByAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectZoomToAtInput: {action: this.lockedOnObjectZoomToAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        transitionZoomByAtInput: {action: this.transitionZoomByAtInput, defaultTargetState: "TRANSITION"},
        transitionZoomToAtInput: {action: this.transitionZoomToAtInput, defaultTargetState: "TRANSITION"},
        transitionZoomToAtCenterInput: {action: this.transitionZoomToAtCenterInput, defaultTargetState: "TRANSITION"},
        transitionZoomToAtWorldInput: {action: this.transitionZoomToAtWorldInput, defaultTargetState: "TRANSITION"},
        userZoomByAtInput: {action: this.userZoomByAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userZoomToAtInput: {action: this.userZoomToAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
    }

    lockedOnObjectZoomByAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomByAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomBy", deltaZoom: payload.deltaZoom };
    }

    lockedOnObjectZoomToAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomToAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomTo", targetZoom: payload.targetZoom };
    }

    userZoomByAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["userZoomByAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomByAt", deltaZoom: payload.deltaZoom, anchorPoint: payload.anchorPoint };
    }

    userZoomToAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["userZoomToAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomToAt", targetZoom: payload.targetZoom, anchorPoint: payload.anchorPoint };
    }

    transitionZoomByAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["transitionZoomByAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomByAt", deltaZoom: payload.deltaZoom, anchorPoint: payload.anchorPoint };
    }

    transitionZoomByAtCenterInput(context: BaseContext, payload: ZoomEventPayloadMapping["transitionZoomByAtCenterInput"]): ZoomControlOutputEvent {
        return { type: "zoomBy", deltaZoom: payload.deltaZoom };
    }

    transitionZoomToAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["transitionZoomToAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomToAt", targetZoom: payload.targetZoom, anchorPoint: payload.anchorPoint };
    }

    transitionZoomToAtCenterInput(context: BaseContext, payload: ZoomEventPayloadMapping["transitionZoomToAtCenterInput"]): ZoomControlOutputEvent {
        return { type: "zoomTo", targetZoom: payload.targetZoom };
    }

    transitionZoomToAtWorldInput(context: BaseContext, payload: ZoomEventPayloadMapping["transitionZoomToAtWorldInput"]): ZoomControlOutputEvent {
        return { type: "zoomToAtWorld", targetZoom: payload.targetZoom, anchorPoint: payload.anchorPoint };
    }
}

/**
 * State implementation for camera locked to follow an object with zoom.
 * Accepts locked object zoom events and user input to unlock.
 * @category Input Flow Control
 */
export class ZoomLockedOnObjectState extends TemplateState<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> {

    constructor(){
        super();
    }

    protected _eventReactions: EventReactions<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> = {
        lockedOnObjectZoomByAtInput: {action: this.lockedOnObjectZoomByAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        lockedOnObjectZoomToAtInput: {action: this.lockedOnObjectZoomToAtInput, defaultTargetState: "LOCKED_ON_OBJECT"},
        userZoomByAtInput: {action: this.userZoomByAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
        userZoomToAtInput: {action: this.userZoomToAtInput, defaultTargetState: "ACCEPTING_USER_INPUT"},
    }

    lockedOnObjectZoomByAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomByAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomByAt", deltaZoom: payload.deltaZoom, anchorPoint: payload.anchorPoint };
    }

    lockedOnObjectZoomToAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["lockedOnObjectZoomToAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomToAt", targetZoom: payload.targetZoom, anchorPoint: payload.anchorPoint };
    }

    userZoomByAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["userZoomByAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomByAt", deltaZoom: payload.deltaZoom, anchorPoint: payload.anchorPoint };
    }

    userZoomToAtInput(context: BaseContext, payload: ZoomEventPayloadMapping["userZoomToAtInput"]): ZoomControlOutputEvent {
        return { type: "zoomToAt", targetZoom: payload.targetZoom, anchorPoint: payload.anchorPoint };
    }
}

/**
 * State machine controlling zoom input flow and animations.
 *
 * @remarks
 * This state machine manages the lifecycle of zoom operations:
 * - **User input handling**: Accepts or blocks user zoom gestures based on state
 * - **Animation control**: Manages smooth zoom-to animations
 * - **Object tracking**: Supports locking camera to follow objects with zoom
 *
 * **State transitions:**
 * - `ACCEPTING_USER_INPUT` → `TRANSITION`: Start animation (`initiateTransition`)
 * - `ACCEPTING_USER_INPUT` → `LOCKED_ON_OBJECT`: Lock to object (`lockedOnObjectZoom...`)
 * - `TRANSITION` → `ACCEPTING_USER_INPUT`: User input interrupts animation
 * - `LOCKED_ON_OBJECT` → `ACCEPTING_USER_INPUT`: User input unlocks
 *
 * Helper methods simplify event dispatching without memorizing event names.
 *
 * @example
 * ```typescript
 * const stateMachine = createDefaultZoomControlStateMachine(cameraRig);
 *
 * // User zooms - accepted in ACCEPTING_USER_INPUT state
 * const result = stateMachine.notifyZoomByAtInput(1.2, { x: 400, y: 300 });
 *
 * // Start animation - transitions to TRANSITION state
 * stateMachine.notifyZoomToAtWorldInput(2.0, { x: 1000, y: 500 });
 *
 * // User input now may interrupt animation
 * ```
 *
 * @category Input Flow Control
 * @see {@link createDefaultZoomControlStateMachine} for factory function
 */
export class ZoomControlStateMachine extends TemplateStateMachine<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping> {

    constructor(states: Record<ZoomControlStates, State<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping>>, initialState: ZoomControlStates, context: BaseContext){
        super(states, initialState, context);
    }

    /**
     * Notifies the state machine of user zoom input around an anchor point.
     *
     * @param delta - Zoom delta (multiplier)
     * @param at - Anchor point for zoom
     * @returns Event handling result with output event
     *
     * @remarks
     * Dispatches `userZoomByAtInput` event. Accepted in `ACCEPTING_USER_INPUT` and `TRANSITION` states.
     */
    notifyZoomByAtInput(delta: number, at: Point) {
        return this.happens("userZoomByAtInput", {deltaZoom: delta, anchorPoint: at});
    }

    /**
     * Initiates a zoom animation around an anchor point.
     *
     * @param delta - Zoom delta (multiplier)
     * @param at - Anchor point for zoom
     * @returns Event handling result
     *
     * @remarks
     * Dispatches `transitionZoomByAtInput` event, starting a zoom animation.
     */
    notifyZoomByAtInputAnimation(delta: number, at: Point) {
        return this.happens("transitionZoomByAtInput", {deltaZoom: delta, anchorPoint: at});
    }

    /**
     * Initiates a zoom animation to target level around center anchor.
     *
     * @param targetZoom - Target zoom level
     * @param at - Anchor point for zoom
     * @returns Event handling result
     *
     * @remarks
     * Dispatches `transitionZoomToAtCenterInput` event for center-anchored zoom animation.
     */
    notifyZoomToAtCenterInput(targetZoom: number, at: Point) {
        return this.happens("transitionZoomToAtCenterInput", {targetZoom: targetZoom, anchorPoint: at});
    }

    /**
     * Initiates a zoom animation to target level around world anchor.
     *
     * @param targetZoom - Target zoom level
     * @param at - World anchor point for zoom
     * @returns Event handling result
     *
     * @remarks
     * Dispatches `transitionZoomToAtWorldInput` event for world-anchored zoom animation.
     */
    notifyZoomToAtWorldInput(targetZoom: number, at: Point) {
        return this.happens("transitionZoomToAtWorldInput", {targetZoom: targetZoom, anchorPoint: at});
    }

    /**
     * Initiates transition to `TRANSITION` state.
     *
     * @remarks
     * Forces state change to begin animation or transition sequence.
     * Called when starting programmatic camera movements.
     */
    initateTransition() {
        return this.happens("initiateTransition");
    }
}

/**
 * Creates the default set of zoom control states.
 * @returns State instances for all zoom control states
 * @category Input Flow Control
 */
export function createDefaultZoomControlStates(): Record<ZoomControlStates, State<ZoomEventPayloadMapping, BaseContext, ZoomControlStates, ZoomControlOutputMapping>> {
    return {
        ACCEPTING_USER_INPUT: new ZoomAcceptingUserInputState(),
        TRANSITION: new ZoomTransitionState(),
        LOCKED_ON_OBJECT: new ZoomLockedOnObjectState(),
    }
}

/**
 * Creates a zoom control state machine with default configuration.
 *
 * @param context - Camera rig or context for zoom operations
 * @returns Configured zoom control state machine starting in `ACCEPTING_USER_INPUT` state
 *
 * @remarks
 * Factory function for creating a zoom state machine with sensible defaults.
 * The machine starts in `ACCEPTING_USER_INPUT` state, ready to accept user zoom gestures.
 *
 * @example
 * ```typescript
 * const cameraRig = createDefaultCameraRig(camera);
 * const zoomSM = createDefaultZoomControlStateMachine(cameraRig);
 * ```
 *
 * @category Input Flow Control
 */
export function createDefaultZoomControlStateMachine(context: BaseContext = {setup: NO_OP, cleanup: NO_OP}): ZoomControlStateMachine {
    return new ZoomControlStateMachine(createDefaultZoomControlStates(), "ACCEPTING_USER_INPUT", context);
}
