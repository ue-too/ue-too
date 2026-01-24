import { Application, FederatedPointerEvent, Rectangle, Matrix, Graphics, Polygon } from "pixi.js";
import { BoardCamera, InputOrchestrator, KmtInputEventMapping, KmtInputStateMachine } from "@ue-too/board";
import { EventArgs } from "@ue-too/being";

export class PixiTouchEventParser {
    private _app: Application;
    private _stage: Application["stage"];
    private _canvas: HTMLCanvasElement;
    private _kmtInputStateMachine: KmtInputStateMachine;
    private _inputOrchestrator: InputOrchestrator;
    private _keyfirstPressed: Map<string, boolean>;
    private _abortController: AbortController;
    private _disabled: boolean = false;
    private _camera: BoardCamera;
    private _hitAreaDebugGraphics: Graphics | null = null;

    
}