import type { Ticker } from 'pixi.js';
import { useEffect } from 'react';

import { usePixiCanvas } from '@/contexts/pixi';
import { Grid } from '@/knit-grid/grid';
import { PixiGrid } from '@/knit-grid/grid-pixi';

const grid = new Grid(10, 10);
const pixiGrid = new PixiGrid(grid);

export const useAppTicker = (
    callback: (time: Ticker) => void,
    enabled: boolean = true
) => {
    const { result } = usePixiCanvas();

    useEffect(() => {
        if (
            result.initialized == false ||
            result.success == false ||
            result.components.app == null ||
            !enabled
        ) {
            return;
        }

        result.components.app.ticker.add(callback);

        return () => {
            result.components.app.ticker.remove(callback);
        };
    }, [result, callback, enabled]);
};

export const useToggleKmtInput = (enable: boolean) => {
    const { result } = usePixiCanvas();

    useEffect(() => {
        if (
            result.initialized == false ||
            result.success == false ||
            result.components.kmtInputStateMachine == null
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

    useEffect(() => {
        if (
            result.initialized == false ||
            result.success == false ||
            result.components.app == null
        ) {
            return;
        }
        result.components.app.canvas.addEventListener('pointerdown', callback);
        return () => {
            result.components.app.canvas.removeEventListener(
                'pointerdown',
                callback
            );
        };
    }, [result, callback]);
};

export const useGrid = () => {
    const { result } = usePixiCanvas();

    useEffect(() => {
        if (
            result.initialized == false ||
            result.success == false ||
            result.components.app == null
        ) {
            return;
        }
        result.components.app.stage.addChild(pixiGrid);
        return () => {
            result.components.app.stage.removeChild(pixiGrid);
        };
    }, [result]);
};
