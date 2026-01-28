import { Application } from 'pixi.js';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { usePixiCanvas } from '@/contexts/pixi';

import { PixiAppComponents, initApp } from '../../utils/pixi';

export const useInitializePixiApp = (
    option: { fullScreen: boolean } = { fullScreen: true }
) => {
    const { setResult } = usePixiCanvas();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const appComponentsRef = useRef<PixiAppComponents | null>(null);
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
                    appComponentsRef.current.app.destroy(false);
                    appComponentsRef.current.cleanup();
                    appComponentsRef.current = null;
                    setResult({ initialized: false });
                }

                // Small delay to ensure canvas is fully ready
                await new Promise(resolve => setTimeout(resolve, 0));

                if (!isMounted) return;

                // console.log('initialize pixi');

                const appComponents = await initApp(canvas, option);

                if (!isMounted) {
                    appComponents.app.destroy(false);
                    appComponentsRef.current = null;
                    appComponents.cleanup();
                    setResult({ initialized: true, success: false });
                    return;
                }

                appComponentsRef.current = appComponents;
                setResult({
                    initialized: true,
                    success: true,
                    components: appComponents,
                });
            } catch (error) {
                console.error('Failed to initialize PixiJS:', error);
                appComponentsRef.current?.cleanup();
                setResult({ initialized: true, success: false });
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
                appComponentsRef.current.cleanup();
                appComponentsRef.current.app.destroy(false);
                setResult({ initialized: false });
                appComponentsRef.current = null;
            }
        };
    }, [setResult, option]);

    return { canvasRef };
};
