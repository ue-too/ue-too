import { InitAppOptions, baseInitApp } from '@ue-too/board-pixi-integration';
import { Assets, Sprite } from 'pixi.js';

import { Grid } from '@/knit-grid/grid';
import { PixiGrid } from '@/knit-grid/grid-pixi';
import { ExpandedInputTracker } from '@/utils/input-state-machine';
import { createKmtInputStateMachineExpansion } from '@/utils/input-state-machine';
import { KnitAppComponents } from '..';

export const initApp = async (
    canvasElement: HTMLCanvasElement,
    option: Partial<InitAppOptions> = {
        fullScreen: true,
        limitEntireViewPort: true,
    }
): Promise<KnitAppComponents> => {
    // Intialize the application.
    const baseComponents = await baseInitApp(canvasElement, option);

    const grid = new Grid(10, 10);
    const pixiGrid = new PixiGrid(grid);
    baseComponents.app.stage.addChild(pixiGrid);

    const expandedInputTracker = new ExpandedInputTracker(
        baseComponents.canvasProxy,
        pixiGrid,
        baseComponents.camera
    );
    const kmtInputStateMachine =
        createKmtInputStateMachineExpansion(expandedInputTracker);
    baseComponents.kmtParser.stateMachine = kmtInputStateMachine;
    baseComponents.kmtInputStateMachine = kmtInputStateMachine;

    // Load the image from app root assets/ (served via public/assets -> ../assets).
    const imageUrl = new URL('/assets/bala.png', import.meta.url).href;
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
