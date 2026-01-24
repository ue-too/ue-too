import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Application } from 'pixi.js';
import { initApp, PixiAppComponents } from '../pixi-based/init-app';
import { usePixiCanvas } from '../PixiCanvas';

export const useInitializePixiApp = () => {

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
          setResult({initialized: false});
        }

        // Small delay to ensure canvas is fully ready
        await new Promise(resolve => setTimeout(resolve, 0));

        if (!isMounted) return;

        const appComponents = await initApp(canvas);
        
        if (!isMounted) {
          appComponents.app.destroy(false);
          appComponentsRef.current = null;
          appComponents.cleanup();
          setResult({initialized: true, success: false});
          return;
        }

        appComponentsRef.current = appComponents;
        setResult({initialized: true, success: true, components: appComponents});
      } catch (error) {
        console.error('Failed to initialize PixiJS:', error);
        appComponentsRef.current?.cleanup();
        setResult({initialized: true, success: false});
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
        setResult({initialized: false});
        appComponentsRef.current = null;
      }
    };
  }, [setResult]);

  return { canvasRef };
}

export function useAllBoardCameraState()  {
  const {result} = usePixiCanvas();

  const cachedSnapshotRef = useRef<{
      position: { x: number; y: number };
      rotation: number;
      zoomLevel: number;
  }>({position: {x: 0, y: 0}, rotation: 0, zoomLevel: 1});

  return useSyncExternalStore(
      (cb) => { 
        if(result.initialized == false || result.success == false){
          return () => {};
        }
        return result.components.camera.on("all", cb);
      },
      () => {
        if(result.initialized == false || result.success == false){
          if(cachedSnapshotRef.current.position.x === 0 && cachedSnapshotRef.current.position.y === 0 && cachedSnapshotRef.current.rotation === 0 && cachedSnapshotRef.current.zoomLevel === 1){
            return cachedSnapshotRef.current;
          }
          cachedSnapshotRef.current = {position: {x: 0, y: 0}, rotation: 0, zoomLevel: 1};
          return cachedSnapshotRef.current;
        }
        const currentPosition = result.components.camera.position;
        const currentRotation = result.components.camera.rotation;
        const currentZoomLevel = result.components.camera.zoomLevel;

          // Check if values actually changed
          const cached = cachedSnapshotRef.current;
          if (
              cached &&
              cached.position.x === currentPosition.x &&
              cached.position.y === currentPosition.y &&
              cached.rotation === currentRotation &&
              cached.zoomLevel === currentZoomLevel
          ) {
              // Return cached snapshot to maintain referential equality
              return cached;
          }

          // Create new snapshot only when values changed
          const newSnapshot = {
              position: {...currentPosition},
              rotation: currentRotation,
              zoomLevel: currentZoomLevel,
          };
          cachedSnapshotRef.current = newSnapshot;
          return newSnapshot;
      },
  )
}