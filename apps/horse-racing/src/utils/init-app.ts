import {
    baseInitApp,
    type BaseAppComponents,
    type InitAppOptions,
} from '@ue-too/board-pixi-integration';

import {
    attachHorseRacingSim,
    type HorseRacingSimHandle,
} from '@/simulation/horse-racing-sim';

export type HorseRacingAppComponents = BaseAppComponents & {
    simHandle: HorseRacingSimHandle;
};

/**
 * Initializes the Pixi canvas with board input and the horse-racing dynamics demo.
 *
 * @param canvas - Host canvas element from the board wrapper
 * @param option - Board / camera options passed through to `baseInitApp`
 * @returns App components including the simulation handle for track reloading
 */
export async function initApp(
    canvas: HTMLCanvasElement,
    option: Partial<InitAppOptions>,
): Promise<HorseRacingAppComponents> {
    const components = await baseInitApp(canvas, option);
    // Allow deeper zoom for small horse rectangles (0.65m wide)
    components.camera.setMaxZoomLevel(30);
    const simHandle = await attachHorseRacingSim(components);
    return { ...components, simHandle };
}
