import { useEffect, useRef } from 'react';

import { usePixiCanvas } from '@/contexts/pixi';
import { InitAppOptions } from '@/utils/pixi/init-app';

import { PixiAppComponents } from '../../utils/pixi';

export const useInitializePixiApp = <
    T extends InitAppOptions = InitAppOptions,
    C extends PixiAppComponents = PixiAppComponents,
>(
    option: Partial<T>,
    initFunction: (canvas: HTMLCanvasElement, option: Partial<T>) => Promise<C>
) => {
    const { setResult } = usePixiCanvas();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const appComponentsRef = useRef<C | null>(null);
    const isInitializingRef = useRef(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || isInitializingRef.current) return;

        let isMounted = true;
        isInitializingRef.current = true;

        const initializePixi = async () => {
            try {
                // Clean up any existing app first
                if (appComponentsRef.current) {
                    setResult({ initialized: false });
                    appComponentsRef.current.cleanup();
                    appComponentsRef.current.cleanups.forEach(cleanup =>
                        cleanup()
                    );
                    appComponentsRef.current.app.destroy(false);
                    appComponentsRef.current = null;
                }

                // Small delay to ensure canvas is fully ready
                await new Promise(resolve => setTimeout(resolve, 0));

                if (!isMounted) return;

                // console.log('initialize pixi');

                const appComponents = await initFunction(canvas, option);

                if (!isMounted) {
                    setResult({ initialized: true, success: false });
                    appComponents.cleanup();
                    appComponents.cleanups.forEach(cleanup => cleanup());
                    appComponents.app.destroy(false);
                    appComponentsRef.current = null;
                    return;
                }

                appComponentsRef.current = appComponents;
                setResult({
                    initialized: true,
                    success: true,
                    components: appComponents,
                });
            } catch (error) {
                setResult({ initialized: true, success: false });
                console.error('Failed to initialize PixiJS:', error);
                appComponentsRef.current?.cleanups.forEach(cleanup =>
                    cleanup()
                );
                appComponentsRef.current?.cleanup();
            } finally {
                isInitializingRef.current = false;
            }
        };

        initializePixi();

        // Cleanup function
        return () => {
            isMounted = false;
            isInitializingRef.current = false;
            if (appComponentsRef.current) {
                setResult({ initialized: false });
                appComponentsRef.current.cleanup();
                appComponentsRef.current.cleanups.forEach(cleanup => cleanup());
                appComponentsRef.current.app.destroy(false);
                appComponentsRef.current = null;
            }
        };
    }, [setResult, option]);

    return { canvasRef };
};
