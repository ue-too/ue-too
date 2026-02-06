import type { Ticker } from 'pixi.js';
import { useCallback, useEffect } from 'react';

import { usePixiCanvas } from '../../contexts/pixi';
import { appIsReady } from '../../utils/pixi';

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

export const useToggleKmtInput = () => {
    const { result } = usePixiCanvas();

    return useCallback((enable: boolean) => {
        const check = appIsReady(result);
        if (!check.ready) {
            return;
        }

        if (enable) {
            check.components.kmtParser.enable();
        } else {
            check.components.kmtParser.disable();
        }
    }, [result]);
};

export const useCanvasPointerDown = (
    callback: (event: PointerEvent) => void
) => {
    const { result } = usePixiCanvas();

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
