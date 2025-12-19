import type {Point} from "@ue-too/math";
import {KmtOutputEvent} from "./input-state-machine/kmt-input-state-machine";
import {TouchOutputEvent} from "./input-state-machine/touch-input-state-machine";
import {UserInputPublisher} from "./raw-input-publisher/raw-input-publisher";
import {CameraMux, CameraMuxPanOutput, CameraMuxZoomOutput, CameraMuxRotationOutput} from "../camera/camera-mux";
import {CameraRig} from "../camera/camera-rig";

/**
 * @description Union type of all output events from state machines.
 */
export type OutputEvent = KmtOutputEvent | TouchOutputEvent;

/**
 * @description The input orchestrator processes outputs from state machines and routes them to camera/publisher.
 * It receives outputs from both KMT and Touch state machines and routes them to the camera mux and camera rig.
 * The orchestrator asks CameraMux for permission (via outputs), and if allowed, executes on CameraRig.
 * This decouples state machines from camera control, making each component unaware of its neighbors.
 * The orchestrator is the single point of control for camera operations.
 *
 * Since both KMT and Touch output the same event types (pan, zoom), a single orchestrator can handle both.
 *
 * @category Input Orchestrator
 */
export class InputOrchestrator {
    private _cameraMux: CameraMux;
    private _cameraRig: CameraRig;
    private _publisher?: UserInputPublisher;

    constructor(cameraMux: CameraMux, cameraRig: CameraRig, publisher?: UserInputPublisher) {
        this._cameraMux = cameraMux;
        this._cameraRig = cameraRig;
        this._publisher = publisher;
    }

    /**
     * @description Processes output events from state machines and routes them to the camera and publisher.
     * Called by parsers after state machine returns output.
     */
    public processInputStateMachineResult(output: any): void {
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

    /**
     * @description Type guard to check if an output is an OutputEvent.
     */
    private isOutputEvent(output: any): output is OutputEvent {
        return output && typeof output === 'object' && 'type' in output;
    }

    /**
     * @description Handles output events from state machines.
     * Publishes to observers (parallel path) and asks CameraMux for permission.
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
     * @description Processes pan output from CameraMux.
     * Executes on CameraRig if CameraMux allows passthrough.
     */
    private processPanMuxOutput(output: CameraMuxPanOutput): void {
        if (output.allowPassThrough) {
            this._cameraRig.panByViewPort(output.delta);
        }
    }

    /**
     * @description Processes zoom output from CameraMux.
     * Executes on CameraRig if CameraMux allows passthrough.
     */
    private processZoomMuxOutput(output: CameraMuxZoomOutput): void {
        if (output.allowPassThrough) {
            this._cameraRig.zoomByAt(output.delta, output.anchorPoint);
        }
    }

    /**
     * @description Processes rotation output from CameraMux.
     * Executes on CameraRig if CameraMux allows passthrough.
     */
    private processRotateMuxOutput(output: CameraMuxRotationOutput): void {
        if (output.allowPassThrough) {
            this._cameraRig.rotateBy(output.delta);
        }
    }

    /**
     * @description Gets the underlying publisher (for direct access if needed).
     */
    get publisher(): UserInputPublisher | undefined {
        return this._publisher;
    }

    /**
     * @description Gets the underlying camera mux (for direct access if needed).
     */
    get cameraMux(): CameraMux {
        return this._cameraMux;
    }

    set cameraMux(cameraMux: CameraMux){
        this._cameraMux = cameraMux;
    }
}
