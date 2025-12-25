
import { CameraMux, CameraMuxPanOutput, CameraMuxZoomOutput, CameraMuxRotationOutput } from "../interface";
import { Point } from "@ue-too/math";
import { ObservableBoardCamera } from "../../interface";
import { createDefaultPanControlStateMachine, PanControlStateMachine, PanControlOutputEvent } from "./pan-control-state-machine";
import { createDefaultZoomControlStateMachine, ZoomControlStateMachine, ZoomControlOutputEvent } from "./zoom-control-state-machine";
import { createDefaultRotateControlStateMachine, RotateControlStateMachine, RotateControlOutputEvent } from "./rotation-control-state-machine";
import { CameraRig } from "../../camera-rig";
import { createDefaultCameraRig } from "../../camera-rig";

/**
 * Advanced camera input multiplexer with animation support and input locking via state machines.
 *
 * @remarks
 * This {@link CameraMux} implementation provides sophisticated input flow control using
 * separate state machines for pan, zoom, and rotation. Each state machine can:
 * - Block user input during camera animations
 * - Manage animation playback
 * - Arbitrate between user input and programmatic camera control
 * - Handle transitions between different camera control states
 *
 * **Key features:**
 * - **Animation system**: Support for smooth camera animations (pan-to, zoom-to, rotate-to)
 * - **Input locking**: Automatically block user input during animations
 * - **State-based control**: Each camera operation (pan/zoom/rotate) has its own state machine
 * - **Flexible transitions**: Initiate transitions to interrupt or chain animations
 *
 * **Architecture:**
 * - Three independent state machines: {@link PanControlStateMachine}, {@link ZoomControlStateMachine}, {@link RotateControlStateMachine}
 * - Each state machine decides whether to allow or block input based on current state
 * - State machines receive events and produce output events for camera operations
 *
 * **When to use:**
 * - Applications requiring smooth camera animations (e.g., "focus on object", "zoom to region")
 * - UI where user input should be blocked during programmatic camera movements
 * - Games or interactive experiences with scripted camera sequences
 *
 * **Alternatives:**
 * - Use {@link Relay} for simple passthrough without animation support
 * - Implement custom {@link CameraMux} for different state management approaches
 *
 * @example
 * ```typescript
 * const camera = new DefaultBoardCamera();
 * const mux = createCameraMuxWithAnimationAndLock(camera);
 *
 * // Start a pan animation - user input will be blocked
 * mux.notifyPanToAnimationInput({ x: 1000, y: 500 });
 *
 * // User tries to pan during animation - will be blocked
 * const result = mux.notifyPanInput({ x: 50, y: 30 });
 * // result.allowPassThrough = false (blocked during animation)
 *
 * // After animation completes, user input allowed again
 * ```
 *
 * @category Input Flow Control
 * @see {@link CameraMux} for the interface definition
 * @see {@link Relay} for simpler passthrough implementation
 * @see {@link createCameraMuxWithAnimationAndLock} for factory function
 */
export class CameraMuxWithAnimationAndLock implements CameraMux {

    private _panStateMachine: PanControlStateMachine;
    private _zoomStateMachine: ZoomControlStateMachine;
    private _rotateStateMachine: RotateControlStateMachine;

    /**
     * Creates a new camera mux with animation and locking capabilities.
     *
     * @param panStateMachine - State machine controlling pan operations and animations
     * @param zoomStateMachine - State machine controlling zoom operations and animations
     * @param rotateStateMachine - State machine controlling rotation operations and animations
     *
     * @remarks
     * Typically created via factory functions like {@link createCameraMuxWithAnimationAndLock}
     * rather than direct instantiation.
     */
    constructor(panStateMachine: PanControlStateMachine, zoomStateMachine: ZoomControlStateMachine, rotateStateMachine: RotateControlStateMachine){
        this._panStateMachine = panStateMachine;
        this._zoomStateMachine = zoomStateMachine;
        this._rotateStateMachine = rotateStateMachine;
    }

    /**
     * Initiates a pan animation to a target position.
     *
     * @param target - Target position in world coordinates
     * @returns Pan output indicating whether animation was initiated
     *
     * @remarks
     * This method starts a camera pan animation to the specified world position.
     * The state machine handles:
     * - Starting the animation
     * - Blocking user input during animation
     * - Producing incremental pan deltas each frame
     *
     * The animation continues until the camera reaches the target or is interrupted.
     *
     * @example
     * ```typescript
     * // Animate camera to world position
     * mux.notifyPanToAnimationInput({ x: 1000, y: 500 });
     * ```
     */
    notifyPanToAnimationInput(target: Point): CameraMuxPanOutput {
        const res = this._panStateMachine.notifyPanToAnimationInput(target);

        if(res.handled) {
            const output = res.output;
            if(output !== undefined){
                switch(output.type){
                    case 'panByViewPort':
                        return { allowPassThrough: true, delta: output.delta };
                    case 'panToWorld':
                        return { allowPassThrough: true, delta: output.target };
                    default:
                        return { allowPassThrough: false };
                }

            }
        }
        return { allowPassThrough: false };
    }

    /**
     * Processes user pan input (implements {@link CameraMux.notifyPanInput}).
     *
     * @param delta - Pan delta in viewport coordinates
     * @returns Output indicating whether pan is allowed
     *
     * @remarks
     * This method is called when the user attempts to pan the camera (e.g., mouse drag).
     * The pan state machine determines whether to allow the input based on current state:
     * - **Allowed**: When in idle state or user control state
     * - **Blocked**: When camera animation is playing
     *
     * @example
     * ```typescript
     * // User drags mouse
     * const result = mux.notifyPanInput({ x: 50, y: 30 });
     * if (result.allowPassThrough) {
     *   // Apply pan to camera
     *   cameraRig.panByViewPort(result.delta);
     * }
     * ```
     */
    notifyPanInput(delta: Point): CameraMuxPanOutput {
        const result = this._panStateMachine.happens("userPanByInput", { diff: delta });
        if (result.handled && 'output' in result && result.output) {
            const output = result.output as PanControlOutputEvent;
            if (output.type !== "none") {
                return { allowPassThrough: true, delta: delta };
            }
        }
        return { allowPassThrough: false };
    }

    /**
     * Processes user zoom input (implements {@link CameraMux.notifyZoomInput}).
     *
     * @param delta - Zoom delta (change in zoom level)
     * @param at - Anchor point in viewport coordinates
     * @returns Output indicating whether zoom is allowed
     *
     * @remarks
     * This method is called when the user attempts to zoom (e.g., mouse wheel).
     * The zoom state machine determines whether to allow the input based on current state:
     * - **Allowed**: When in idle state or user control state
     * - **Blocked**: When zoom animation is playing
     *
     * @example
     * ```typescript
     * // User scrolls mouse wheel
     * const result = mux.notifyZoomInput(0.1, mousePosition);
     * if (result.allowPassThrough) {
     *   // Apply zoom to camera
     *   cameraRig.zoomByAt(result.delta, result.anchorPoint);
     * }
     * ```
     */
    notifyZoomInput(delta: number, at: Point): CameraMuxZoomOutput {
        const result = this._zoomStateMachine.happens("userZoomByAtInput", { deltaZoom: delta, anchorPoint: at });
        if (result.handled && 'output' in result && result.output) {
            const output = result.output as ZoomControlOutputEvent;
            if (output.type !== "none") {
                return { allowPassThrough: true, delta: delta, anchorPoint: at };
            }
        }
        return { allowPassThrough: false };
    }

    /**
     * Processes user rotation input (rotate-by variant).
     *
     * @param delta - Rotation delta in radians
     * @returns Output from rotation state machine
     *
     * @remarks
     * Delegates to the rotation state machine's rotate-by handler.
     * The state machine determines whether to allow rotation based on current state.
     */
    notifyRotateByInput(delta: number) {
        return this._rotateStateMachine.notifyRotateByInput(delta);
    }

    /**
     * Initiates a rotation animation to a target angle.
     *
     * @param target - Target rotation angle in radians
     * @returns Output from rotation state machine
     *
     * @remarks
     * Starts a camera rotation animation to the specified angle.
     * User input will be blocked during the animation.
     */
    notifyRotateToAnimationInput(target: number) {
        return this._rotateStateMachine.notifyRotateToAnimationInput(target);
    }

    /**
     * Initiates a zoom animation to a target level at a viewport position.
     *
     * @param targetZoom - Target zoom level
     * @param at - Anchor point in viewport coordinates (defaults to origin)
     *
     * @remarks
     * Starts a zoom animation that zooms to the specified level while keeping
     * the anchor point stationary (zoom-to-cursor behavior).
     * User input will be blocked during the animation.
     */
    notifyZoomInputAnimation(targetZoom: number, at: Point = {x: 0, y: 0}): void {
        this._zoomStateMachine.notifyZoomToAtCenterInput(targetZoom, at);
    }

    /**
     * Initiates a zoom animation to a target level at a world position.
     *
     * @param targetZoom - Target zoom level
     * @param at - Anchor point in world coordinates (defaults to origin)
     *
     * @remarks
     * Similar to {@link notifyZoomInputAnimation} but accepts world-space coordinates
     * for the anchor point instead of viewport coordinates.
     */
    notifyZoomInputAnimationWorld(targetZoom: number, at: Point = {x: 0, y: 0}): void {
        this._zoomStateMachine.notifyZoomToAtWorldInput(targetZoom, at);
    }

    /**
     * Processes user rotation input (implements {@link CameraMux.notifyRotationInput}).
     *
     * @param delta - Rotation delta in radians
     * @returns Output indicating whether rotation is allowed
     *
     * @remarks
     * This method is called when the user attempts to rotate the camera.
     * The rotation state machine determines whether to allow the input based on current state:
     * - **Allowed**: When in idle state or user control state
     * - **Blocked**: When rotation animation is playing
     *
     * @example
     * ```typescript
     * // User rotates camera
     * const result = mux.notifyRotationInput(0.1);
     * if (result.allowPassThrough) {
     *   cameraRig.rotateBy(result.delta);
     * }
     * ```
     */
    notifyRotationInput(delta: number): CameraMuxRotationOutput {
        const result = this._rotateStateMachine.happens("userRotateByInput", { diff: delta });
        if (result.handled && 'output' in result && result.output) {
            const output = result.output as RotateControlOutputEvent;
            if (output.type !== "none") {
                return { allowPassThrough: true, delta: delta };
            }
        }
        return { allowPassThrough: false };
    }

    /**
     * Initiates a transition in the pan state machine.
     *
     * @remarks
     * This method forces the pan state machine to transition to its next state.
     * Can be used to interrupt animations or force state changes.
     */
    initatePanTransition(): void {
        this._panStateMachine.initateTransition();
    }

    /**
     * Initiates a transition in the zoom state machine.
     *
     * @remarks
     * This method forces the zoom state machine to transition to its next state.
     * Can be used to interrupt animations or force state changes.
     */
    initateZoomTransition(): void {
        this._zoomStateMachine.initateTransition();
    }

    /**
     * Initiates a transition in the rotation state machine.
     *
     * @remarks
     * This method forces the rotation state machine to transition to its next state.
     * Can be used to interrupt animations or force state changes.
     */
    initateRotateTransition(): void {
        this._rotateStateMachine.initateTransition();
    }

    /**
     * Gets the rotation state machine.
     *
     * @returns The rotation state machine instance
     *
     * @remarks
     * Provides direct access to the rotation state machine for advanced control
     * or state inspection.
     */
    get rotateStateMachine(): RotateControlStateMachine {
        return this._rotateStateMachine;
    }

    /**
     * Gets the pan state machine.
     *
     * @returns The pan state machine instance
     *
     * @remarks
     * Provides direct access to the pan state machine for advanced control
     * or state inspection.
     */
    get panStateMachine(): PanControlStateMachine {
        return this._panStateMachine;
    }

    /**
     * Gets the zoom state machine.
     *
     * @returns The zoom state machine instance
     *
     * @remarks
     * Provides direct access to the zoom state machine for advanced control
     * or state inspection.
     */
    get zoomStateMachine(): ZoomControlStateMachine {
        return this._zoomStateMachine;
    }
}

/**
 * Creates a camera mux with animation and locking capabilities from a camera instance.
 *
 * @param camera - Observable camera to control
 * @returns Configured camera mux with animation support
 *
 * @remarks
 * This factory function creates a complete camera input flow control system with:
 * 1. A default {@link CameraRig} wrapping the provided camera
 * 2. Three state machines (pan, zoom, rotation) for animation control
 * 3. A {@link CameraMuxWithAnimationAndLock} coordinating the state machines
 *
 * **What you get:**
 * - Smooth camera animations (pan-to, zoom-to, rotate-to)
 * - Automatic input blocking during animations
 * - State-based input arbitration
 * - All with sensible default configurations
 *
 * **Use this when:**
 * - You have a camera and want animation support out-of-the-box
 * - You don't need custom camera rig configuration
 * - You want the simplest setup for animated camera control
 *
 * @example
 * ```typescript
 * const camera = new DefaultBoardCamera(1920, 1080);
 * const mux = createCameraMuxWithAnimationAndLock(camera);
 *
 * // Start a pan animation
 * mux.notifyPanToAnimationInput({ x: 1000, y: 500 });
 *
 * // User input is blocked during animation
 * const result = mux.notifyPanInput({ x: 50, y: 30 });
 * console.log(result.allowPassThrough); // false during animation
 * ```
 *
 * @category Input Flow Control
 * @see {@link CameraMuxWithAnimationAndLock} for the implementation
 * @see {@link createCameraMuxWithAnimationAndLockWithCameraRig} for custom rig version
 */
export function createCameraMuxWithAnimationAndLock(camera: ObservableBoardCamera): CameraMux {
    const context = createDefaultCameraRig(camera);
    const panStateMachine = createDefaultPanControlStateMachine(context);
    const zoomStateMachine = createDefaultZoomControlStateMachine(context);
    const rotateStateMachine = createDefaultRotateControlStateMachine(context);
    return new CameraMuxWithAnimationAndLock(panStateMachine, zoomStateMachine, rotateStateMachine);
}

/**
 * Creates a camera mux with animation and locking capabilities from a camera rig.
 *
 * @param cameraRig - Pre-configured camera rig to use
 * @returns Configured camera mux with animation support
 *
 * @remarks
 * Similar to {@link createCameraMuxWithAnimationAndLock} but accepts an existing
 * camera rig instead of creating a default one. Use this when you need:
 * - Custom camera rig configuration
 * - Specific pan/zoom/rotation constraints
 * - Non-default handler pipelines
 * - To share a camera rig between multiple systems
 *
 * **Advantages over camera-only variant:**
 * - Full control over camera rig settings
 * - Ability to configure boundaries, restrictions, clamping
 * - Use custom handler functions
 * - Reuse existing rig instance
 *
 * @example
 * ```typescript
 * // Create custom camera rig with specific config
 * const camera = new DefaultBoardCamera(1920, 1080);
 * const rig = new DefaultCameraRig({
 *   limitEntireViewPort: true,
 *   clampTranslation: true,
 *   boundaries: {
 *     min: { x: 0, y: 0 },
 *     max: { x: 2000, y: 1000 }
 *   }
 * }, camera);
 *
 * // Create mux with custom rig
 * const mux = createCameraMuxWithAnimationAndLockWithCameraRig(rig);
 *
 * // Animations respect rig's boundaries and constraints
 * mux.notifyPanToAnimationInput({ x: 3000, y: 1500 });
 * // Camera will be clamped to boundaries during animation
 * ```
 *
 * @category Input Flow Control
 * @see {@link CameraMuxWithAnimationAndLock} for the implementation
 * @see {@link createCameraMuxWithAnimationAndLock} for simpler camera-only version
 */
export function createCameraMuxWithAnimationAndLockWithCameraRig(cameraRig: CameraRig): CameraMux {
    const panStateMachine = createDefaultPanControlStateMachine(cameraRig);
    const zoomStateMachine = createDefaultZoomControlStateMachine(cameraRig);
    const rotateStateMachine = createDefaultRotateControlStateMachine(cameraRig);
    return new CameraMuxWithAnimationAndLock(panStateMachine, zoomStateMachine, rotateStateMachine);
}
