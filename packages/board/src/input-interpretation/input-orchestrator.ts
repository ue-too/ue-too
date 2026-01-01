import type {Point} from "@ue-too/math";
import {KmtOutputEvent} from "./input-state-machine/kmt-input-state-machine";
import {TouchOutputEvent} from "./input-state-machine/touch-input-state-machine";
import {UserInputPublisher} from "./raw-input-publisher/raw-input-publisher";
import {CameraMux, CameraMuxPanOutput, CameraMuxZoomOutput, CameraMuxRotationOutput} from "../camera/camera-mux";
import {CameraRig} from "../camera/camera-rig";

/**
 * Union type of all output events from state machines.
 *
 * @remarks
 * This type represents the unified output from both KMT (Keyboard/Mouse/Trackpad) and Touch state machines.
 * By unifying these outputs, the orchestrator can handle events from different input modalities uniformly.
 *
 * @category Input Interpretation
 */
export type OutputEvent = KmtOutputEvent | TouchOutputEvent;

/**
 * Central orchestrator that coordinates input interpretation and camera control for the infinite canvas.
 *
 * @remarks
 * The InputOrchestrator serves as the mediator between input state machines and camera control systems.
 * It implements a permission-based architecture where:
 *
 * 1. **Event Flow**: State machines produce high-level gesture events (pan, zoom, rotate)
 * 2. **Permission Check**: Events are sent to CameraMux for permission validation
 * 3. **Execution**: If allowed, gestures are executed on CameraRig
 * 4. **Broadcasting**: Raw events are simultaneously broadcast to observers via UserInputPublisher
 *
 * **Architecture Pattern**:
 * ```
 * State Machines → Orchestrator → CameraMux (permission) → CameraRig (execution)
 *                       ↓
 *                 UserInputPublisher (observers)
 * ```
 *
 * This design decouples state machines from camera control, allowing state machines to focus solely
 * on gesture recognition while the orchestrator handles the complexities of camera coordination,
 * permission management, and event distribution.
 *
 * **Key Benefits**:
 * - Single point of control for all camera operations
 * - State machines remain unaware of camera implementation
 * - Parallel path for observers to react to raw input events
 * - Consistent handling of KMT and Touch input modalities
 *
 * @category Input Interpretation
 *
 * @example
 * ```typescript
 * // Create the orchestrator
 * const cameraMux = new CameraMux();
 * const cameraRig = new CameraRig(camera, viewport);
 * const publisher = new RawUserInputPublisher();
 * const orchestrator = new InputOrchestrator(cameraMux, cameraRig, publisher);
 *
 * // State machines send their output to the orchestrator
 * const kmtStateMachine = createKmtInputStateMachine(kmtContext);
 * const result = kmtStateMachine.happens("leftPointerMove", {x: 100, y: 200});
 * orchestrator.processInputEventOutput(result.output);
 *
 * // Observers can subscribe to raw input events
 * publisher.on("pan", (event) => {
 *   console.log("Pan gesture detected:", event.diff);
 * });
 * ```
 */
export class InputOrchestrator {
    private _cameraMux: CameraMux;
    private _cameraRig: CameraRig;
    private _publisher?: UserInputPublisher;

    /**
     * Creates a new InputOrchestrator instance.
     *
     * @param cameraMux - The camera multiplexer that validates and controls camera operation permissions
     * @param cameraRig - The camera rig that executes camera transformations
     * @param publisher - Optional publisher for broadcasting raw input events to observers
     *
     * @remarks
     * The publisher parameter is optional to support scenarios where event broadcasting is not needed.
     * When provided, all input events are broadcast in parallel to camera control execution.
     */
    constructor(cameraMux: CameraMux, cameraRig: CameraRig, publisher?: UserInputPublisher) {
        this._cameraMux = cameraMux;
        this._cameraRig = cameraRig;
        this._publisher = publisher;
    }

    /**
     * Processes output events from state machines and routes them to camera control and observers.
     *
     * @param output - The output from a state machine, can be a single event, array of events, or any value
     *
     * @remarks
     * This method serves as the main entry point for state machine outputs. It:
     * 1. Validates whether the output is a valid OutputEvent
     * 2. Handles both single events and arrays of events
     * 3. Routes each valid event through the camera control pipeline
     * 4. Broadcasts events to observers via the publisher
     *
     * Called by event parsers after the state machine processes an input and produces output.
     * The method uses type guards to ensure type safety when handling dynamic output types.
     *
     * @example
     * ```typescript
     * const result = stateMachine.happens("scroll", {deltaX: 0, deltaY: 10, x: 100, y: 200});
     * orchestrator.processInputEventOutput(result.output);
     * ```
     */
    public processInputEventOutput(output: any): void {
        // Handle different output types
        if (this.isOutputEvent(output)) {
            this.handleStateMachineOutput(output);
        } else if (Array.isArray(output)) {
            // Handle multiple outputs
            output.forEach(item => {
                if (this.isOutputEvent(item)) {
                    this.handleStateMachineOutput(item);
                }
            });
        }
    }

    public processInputEvent(input: OutputEvent): void {
        this.handleStateMachineOutput(input);
    }

    /**
     * Type guard to check if an output value is a valid OutputEvent.
     *
     * @param output - The value to check
     * @returns True if the output is a valid OutputEvent with a type property
     *
     * @remarks
     * This type guard ensures type safety when processing state machine outputs.
     * It checks for the presence of a 'type' property which is common to all OutputEvent variants.
     */
    private isOutputEvent(output: any): output is OutputEvent {
        return output && typeof output === 'object' && 'type' in output;
    }

    /**
     * Handles individual output events from state machines by routing to camera control and observers.
     *
     * @param event - The output event from a state machine (pan, zoom, rotate, cursor, or none)
     *
     * @remarks
     * This method implements a dual-path architecture:
     *
     * **Parallel Path 1 - Observer Notification**:
     * - Immediately broadcasts the event to all subscribers via UserInputPublisher
     * - This allows external systems to react to user input in real-time
     * - Independent of camera permission/execution
     *
     * **Parallel Path 2 - Camera Control**:
     * - Requests permission from CameraMux for the operation
     * - CameraMux may modify the event (e.g., clamp values, deny operation)
     * - If permitted, executes the transformation on CameraRig
     *
     * Event types:
     * - **pan**: Translates the camera viewport
     * - **zoom**: Scales the camera around an anchor point
     * - **rotate**: Rotates the camera view
     * - **cursor**: Changes cursor appearance (handled by state machine)
     * - **none**: No operation needed
     */
    private handleStateMachineOutput(event: OutputEvent): void {
        switch (event.type) {
            case "pan":
                // Publish to observers (parallel path)
                this._publisher?.notifyPan(event.delta);
                // Ask CameraMux for permission and process its output
                const panOutput = this._cameraMux.notifyPanInput(event.delta);
                this.processPanMuxOutput(panOutput);
                break;
            case "zoom":
                // Publish to observers (parallel path)
                this._publisher?.notifyZoom(event.delta, event.anchorPointInViewPort);
                // Ask CameraMux for permission and process its output
                const zoomOutput = this._cameraMux.notifyZoomInput(event.delta, event.anchorPointInViewPort);
                this.processZoomMuxOutput(zoomOutput);
                break;
            case "rotate":
                // Publish to observers (parallel path)
                this._publisher?.notifyRotate(event.deltaRotation);
                // Ask CameraMux for permission and process its output
                const rotateOutput = this._cameraMux.notifyRotationInput(event.deltaRotation);
                this.processRotateMuxOutput(rotateOutput);
                break;
            case "cursor":
                // Cursor changes are handled by the state machine's uponEnter/beforeExit methods
                // This case is here for future extension
                break;
            case "none":
                // No action needed
                break;
        }
    }

    /**
     * Processes pan output from CameraMux and executes the pan operation if permitted.
     *
     * @param output - The pan output from CameraMux containing permission and potentially modified delta
     *
     * @remarks
     * CameraMux may deny the operation (allowPassThrough = false) or modify the delta value
     * to enforce constraints like viewport bounds or animation states.
     * Only when permission is granted does the pan execute on CameraRig.
     */
    private processPanMuxOutput(output: CameraMuxPanOutput): void {
        if (output.allowPassThrough) {
            this._cameraRig.panByViewPort(output.delta);
        }
    }

    /**
     * Processes zoom output from CameraMux and executes the zoom operation if permitted.
     *
     * @param output - The zoom output from CameraMux containing permission and potentially modified parameters
     *
     * @remarks
     * CameraMux may deny the operation or modify zoom parameters to enforce constraints
     * like minimum/maximum zoom levels or animation states. The anchor point determines
     * the center of the zoom transformation in viewport coordinates.
     */
    private processZoomMuxOutput(output: CameraMuxZoomOutput): void {
        if (output.allowPassThrough) {
            this._cameraRig.zoomByAt(output.delta, output.anchorPoint);
        }
    }

    /**
     * Processes rotation output from CameraMux and executes the rotation operation if permitted.
     *
     * @param output - The rotation output from CameraMux containing permission and potentially modified delta
     *
     * @remarks
     * CameraMux may deny the operation or modify the rotation delta to enforce constraints
     * like rotation limits or animation states.
     */
    private processRotateMuxOutput(output: CameraMuxRotationOutput): void {
        if (output.allowPassThrough) {
            this._cameraRig.rotateBy(output.delta);
        }
    }

    /**
     * Gets the UserInputPublisher for direct access to event subscription.
     *
     * @returns The publisher instance, or undefined if not configured
     *
     * @remarks
     * Allows external code to subscribe to raw input events without going through the orchestrator.
     */
    get publisher(): UserInputPublisher | undefined {
        return this._publisher;
    }

    /**
     * Gets the CameraMux instance for direct access to permission control.
     *
     * @returns The camera multiplexer instance
     */
    get cameraMux(): CameraMux {
        return this._cameraMux;
    }

    /**
     * Sets a new CameraMux instance.
     *
     * @param cameraMux - The new camera multiplexer to use for permission control
     *
     * @remarks
     * Allows dynamic reconfiguration of camera permission logic at runtime.
     */
    set cameraMux(cameraMux: CameraMux){
        this._cameraMux = cameraMux;
    }
}
