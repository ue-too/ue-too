import { baseInitApp } from '@ue-too/board-pixi-integration';
import { Application, Assets, Sprite } from 'pixi.js';
import { PixiCanvasResult } from '@/contexts/pixi';
import { createKmtInputStateMachineExpansion, ExpandedInputTracker } from '../input-state-machine';
import { Grid } from '@/knit-grid/grid';
import { PixiGrid } from '@/knit-grid/grid-pixi';
import { BaseAppComponents } from '@ue-too/board-pixi-integration';

export type PixiAppComponents = BaseAppComponents & {
    pixiGrid: PixiGrid;
};

export type InitAppOptions = {
    fullScreen: boolean;
    limitEntireViewPort: boolean;
};

export const initApp = async (
    canvasElement: HTMLCanvasElement,
    option: Partial<InitAppOptions> = { fullScreen: true, limitEntireViewPort: true }
): Promise<PixiAppComponents> => {

    // Intialize the application.
    const baseComponents = await baseInitApp(canvasElement, option);

    const grid = new Grid(10, 10);
    const pixiGrid = new PixiGrid(grid);
    baseComponents.app.stage.addChild(pixiGrid);

    baseComponents.camera.on('zoom', (_, cameraState) => {
        pixiGrid.update(cameraState.zoomLevel);
    });

    const expandedInputTracker = new ExpandedInputTracker(baseComponents.canvasProxy, pixiGrid, baseComponents.camera);
    const kmtInputStateMachine = createKmtInputStateMachineExpansion(expandedInputTracker);
    baseComponents.kmtParser.stateMachine = kmtInputStateMachine;
    baseComponents.kmtInputStateMachine = kmtInputStateMachine;


    // Load the bunny texture.
    const imageUrl = new URL('../../../assets/bala.png', import.meta.url).href;
    const texture = await Assets.load(imageUrl);
    // Create a new Sprite from an image path.
    const bala = new Sprite(texture);

    baseComponents.app.stage.addChild(bala);

    // Center the sprite's anchor point.
    bala.anchor.set(0.5);

    // Move the sprite to the center of the screen.
    bala.x = 0;
    bala.y = 0;

    // Add an animation loop callback to the application's ticker.

    return {
        ...baseComponents,
        pixiGrid,
    };
};

export const appIsReady = (result: PixiCanvasResult): { ready: false } | { ready: true, app: Application, components: PixiAppComponents } => {
    if (result.initialized == false || result.success == false || result.components.app.renderer == null) {
        return { ready: false };
    }
    return { ready: true, app: result.components.app, components: result.components };
};
