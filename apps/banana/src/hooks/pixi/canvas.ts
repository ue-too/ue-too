import type { Ticker } from 'pixi.js';
import { useEffect } from 'react';

import { usePixiCanvas } from '@/contexts/pixi';

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
