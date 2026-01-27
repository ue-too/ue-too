import { useRef, useSyncExternalStore } from 'react';
import { usePixiCanvas } from '@/contexts/pixi';

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
