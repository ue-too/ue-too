import { usePixiCanvas } from '@ue-too/board-pixi-react-integration';
import { useMemo } from 'react';
import type { TrainEditorComponents } from './types';

/**
 * Access the initialized train editor app components from the PixiCanvas context.
 * Returns null when the app is not yet ready.
 *
 * @remarks
 * The global PixiCanvasRegistry is augmented with BananaAppComponents,
 * but the train editor page uses its own component type. We cast at runtime
 * since the init function provides the correct components.
 */
export function useTrainEditorApp(): TrainEditorComponents | null {
    const { result } = usePixiCanvas();

    return useMemo(() => {
        if (
            !result.initialized ||
            !result.success ||
            !result.components?.app?.renderer
        ) {
            return null;
        }
        return result.components as unknown as TrainEditorComponents;
    }, [result]);
}
