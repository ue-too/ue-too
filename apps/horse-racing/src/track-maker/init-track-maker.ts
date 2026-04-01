/**
 * Initializes the track maker page: pixi canvas + board + data model +
 * state machine (wired to KMT event parser) + render system.
 */

import {
    baseInitApp,
    type BaseAppComponents,
    type InitAppOptions,
} from '@ue-too/board-pixi-integration';
import {
    convertFromCanvas2ViewPort,
    convertFromViewport2World,
    convertFromWindow2Canvas,
} from '@ue-too/board';

import { CurveCollectionModel } from './curve-collection-model';
import { TrackMakerRenderSystem } from './track-maker-render-system';
import {
    createTrackMakerStateMachine,
    createTrackMakerKmtExtension,
    type TrackMakerStateMachine,
} from './state-machine';

export type TrackMakerAppComponents = BaseAppComponents & {
    model: CurveCollectionModel;
    stateMachine: TrackMakerStateMachine;
    renderSystem: TrackMakerRenderSystem;
};

export async function initTrackMaker(
    canvas: HTMLCanvasElement,
    option: Partial<InitAppOptions>,
): Promise<TrackMakerAppComponents> {
    const components = await baseInitApp(canvas, option);

    const model = new CurveCollectionModel();

    // Coordinate conversion: window position → world position
    // Follows the same pipeline as banana's CurveCreationEngine.convert2WorldPosition
    const canvasProxy = components.canvasProxy;
    const convert2WorldPosition = (pos: { x: number; y: number }) => {
        const camera = components.camera;
        const pointInCanvas = convertFromWindow2Canvas(
            { x: pos.x, y: pos.y, z: 0 },
            canvasProxy,
        );
        const pointInViewPort = convertFromCanvas2ViewPort(pointInCanvas, {
            x: canvasProxy.width / 2,
            y: canvasProxy.height / 2,
        });
        return convertFromViewport2World(
            pointInViewPort,
            camera.position,
            camera.zoomLevel,
            camera.rotation,
            false,
        );
    };

    const getZoomLevel = () => components.camera.zoomLevel;
    const stateMachine = createTrackMakerStateMachine(model, convert2WorldPosition, getZoomLevel);

    // Start in editing mode immediately
    console.log('[TrackMaker] init: state before startEditing:', stateMachine.currentState);
    const startResult = stateMachine.happens('startEditing');
    console.log('[TrackMaker] init: startEditing result:', startResult, '| state after:', stateMachine.currentState);

    // Create the KMT extension that bridges board pan/zoom with track maker events
    const kmtExtension = createTrackMakerKmtExtension(
        stateMachine,
        components.observableInputTracker,
    );

    // Replace the default KMT state machine with our extended one
    // This routes DOM pointer/keyboard events through the board's event parser
    // to our track maker state machine via the _defer mechanism
    (components.kmtParser as any).stateMachine = kmtExtension;

    const renderSystem = new TrackMakerRenderSystem(model, components.app.stage);

    // Sync render system edit mode with state machine state
    const syncEditMode = () => {
        const state = stateMachine.currentState;
        const isEdit = state === 'EDIT_MODE' || state === 'DRAGGING_POINT';
        renderSystem.setEditMode(isEdit);
    };
    model.onChange(syncEditMode);
    stateMachine.onStateChange(syncEditMode);

    // Initial render
    renderSystem.render();

    return { ...components, model, stateMachine, renderSystem };
}
