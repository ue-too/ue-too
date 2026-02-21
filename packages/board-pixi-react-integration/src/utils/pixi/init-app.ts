import { Application } from 'pixi.js';

import { PixiCanvasResult } from '../../contexts';
import { ResolvedComponents } from '../../contexts';

export const appIsReady = (
    result: PixiCanvasResult<ResolvedComponents>
):
    | { ready: false }
    | { ready: true; app: Application; components: ResolvedComponents } => {
    if (
        result.initialized == false ||
        result.success == false ||
        result.components.app.renderer == null
    ) {
        return { ready: false };
    }
    return {
        ready: true,
        app: result.components.app,
        components: result.components,
    };
};
