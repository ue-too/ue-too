import { BaseAppComponents } from '@ue-too/board-pixi-integration';
import { Application } from 'pixi.js';

import { PixiCanvasResult, ResolvedComponents } from '../../contexts';

export const appIsReady = <C extends BaseAppComponents = ResolvedComponents>(
    result: PixiCanvasResult<C>
):
    | { ready: false }
    | { ready: true; app: Application; components: C } => {
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
