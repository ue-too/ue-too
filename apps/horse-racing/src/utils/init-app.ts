import {
    baseInitApp,
    type BaseAppComponents,
    type InitAppOptions,
} from '@ue-too/board-pixi-integration';

import { attachHorseRacingSim } from '@/simulation/horse-racing-sim';

export type HorseRacingAppComponents = BaseAppComponents;

/**
 * Initializes the Pixi canvas with board input and the horse-racing dynamics demo.
 *
 * @param canvas - Host canvas element from the board wrapper
 * @param option - Board / camera options passed through to `baseInitApp`
 * @returns Base app components; simulation cleanup is appended to `cleanups`
 */
export async function initApp(
    canvas: HTMLCanvasElement,
    option: Partial<InitAppOptions>,
): Promise<HorseRacingAppComponents> {
    const components = await baseInitApp(canvas, option);
    await attachHorseRacingSim(components);
    return components;
}
