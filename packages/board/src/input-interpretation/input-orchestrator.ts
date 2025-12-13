import type {Point} from "@ue-too/math";
import {KmtOutputEvent} from "./input-state-machine/kmt-input-state-machine";
import {TouchOutputEvent} from "./input-state-machine/touch-input-state-machine";
import {UserInputPublisher} from "./raw-input-publisher/raw-input-publisher";
import {CameraMux} from "../camera/camera-mux";

/**
 * @description Union type of all output events from state machines.
 */
export type OutputEvent = KmtOutputEvent | TouchOutputEvent;

/**
 * @description The input orchestrator processes outputs from state machines and routes them to camera/publisher.
 * It receives outputs from both KMT and Touch state machines and routes them to the camera mux and optional publisher.
 * This decouples state machines from camera control, making each component unaware of its neighbors.
 * The orchestrator is the single point of control for camera operations.
 *
 * Since both KMT and Touch output the same event types (pan, zoom), a single orchestrator can handle both.
 *
 * @category Input Orchestrator
 */
export class InputOrchestrator {
    private _cameraMux: CameraMux;
    private _publisher?: UserInputPublisher;

    constructor(cameraMux: CameraMux, publisher?: UserInputPublisher) {
        this._cameraMux = cameraMux;
        this._publisher = publisher;
    }

    /**
     * @description Processes output events from state machines and routes them to the camera and publisher.
     * Called by parsers after state machine returns output.
     */
    public processOutput(output: any): void {
        // Handle different output types
        if (this.isOutputEvent(output)) {
            this.routeOutputEvent(output);
        } else if (Array.isArray(output)) {
            // Handle multiple outputs
            output.forEach(item => {
                if (this.isOutputEvent(item)) {
                    this.routeOutputEvent(item);
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
     * @description Routes output events to the camera mux and optional publisher.
     * The orchestrator controls the camera directly and optionally broadcasts events to observers.
     * Handles outputs from both KMT and Touch state machines.
     * Only publishes events if CameraMux allows passthrough.
     */
    private routeOutputEvent(event: OutputEvent): void {
        switch (event.type) {
            case "pan":
                const panOutput = this._cameraMux.notifyPanInput(event.delta);
                if (panOutput.allowPassThrough) {
                    this._publisher?.notifyPan(panOutput.delta);
                }
                break;
            case "zoom":
                const zoomOutput = this._cameraMux.notifyZoomInput(event.delta, event.anchorPoint);
                if (zoomOutput.allowPassThrough) {
                    this._publisher?.notifyZoom(zoomOutput.delta, zoomOutput.anchorPoint);
                }
                break;
            case "rotate":
                const rotateOutput = this._cameraMux.notifyRotationInput(event.deltaRotation);
                if (rotateOutput.allowPassThrough) {
                    this._publisher?.notifyRotate(rotateOutput.delta);
                }
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
}
