import type { Application, Ticker } from 'pixi.js';
import { useEffect, useMemo, useRef } from 'react';

import { usePixiCanvas } from '@/contexts/pixi';
import { Grid } from '@/knit-grid/grid';
import { PixiGrid } from '@/knit-grid/grid-pixi';
import { appIsReady } from '@/utils/pixi';
import { useAllBoardCameraState, useBoardCameraState } from './camera';

export const useAppTicker = (
    callback: (time: Ticker) => void,
    enabled: boolean = true
) => {
    const { result } = usePixiCanvas();

    useEffect(() => {
        const check = appIsReady(result);
        if (!check.ready) {
            return;
        }

        check.app.ticker.add(callback);

        return () => {
            check.app.ticker.remove(callback);
        };
    }, [result, callback, enabled]);
};

export const useToggleKmtInput = (enable: boolean) => {
    const { result } = usePixiCanvas();

    useEffect(() => {
        if (
            result.initialized == false ||
            result.success == false
        ) {
            return;
        }

        if (enable) {
            result.components.kmtParser.enable();
        } else {
            result.components.kmtParser.disable();
        }
    }, [result, enable]);
};

export const useCanvasPointerDown = (
    callback: (event: PointerEvent) => void
) => {
    const { result } = usePixiCanvas();

    console.log('useCanvasPointerDown hook rendered', result);

    useEffect(() => {
        const check = appIsReady(result);
        if (!check.ready) {
            return;
        }

        const canvas = check.app.canvas;
        canvas.addEventListener('pointerdown', callback);
        return () => {
            console.log('remove pointerdown');
            canvas.removeEventListener('pointerdown', callback);
        };
    }, [result, callback]);
};
