import { CanvasProxy } from '@ue-too/board';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useCanvasProxy() {
    const [canvasProxy, _] = useState(() => new CanvasProxy());

    return canvasProxy;
}

export function useCanvasProxyWithRef() {
    const canvasProxy = useCanvasProxy();
    const refCallback = useCallback(
        (canvas: HTMLCanvasElement | null) => {
            if (canvas == null) {
                canvasProxy.tearDown();
                return;
            }
            canvasProxy.attach(canvas);
        },
        [canvasProxy]
    );

    return {
        canvasProxy,
        refCallback,
    };
}
