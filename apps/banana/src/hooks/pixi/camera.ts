import { CameraState } from '@ue-too/board/camera';
import { useRef, useSyncExternalStore } from 'react';

import { usePixiCanvas } from '@/contexts/pixi';

type StateToEventKey<K extends keyof CameraState> = K extends 'position'
    ? 'pan'
    : K extends 'zoomLevel'
      ? 'zoom'
      : 'rotate';

export function useAllBoardCameraState() {
    const { result } = usePixiCanvas();

    const cachedSnapshotRef = useRef<{
        position: { x: number; y: number };
        rotation: number;
        zoomLevel: number;
    }>({ position: { x: 0, y: 0 }, rotation: 0, zoomLevel: 1 });

    return useSyncExternalStore(
        cb => {
            if (result.initialized == false || result.success == false) {
                return () => {};
            }
            return result.components.camera.on('all', cb);
        },
        () => {
            if (result.initialized == false || result.success == false) {
                if (
                    cachedSnapshotRef.current.position.x === 0 &&
                    cachedSnapshotRef.current.position.y === 0 &&
                    cachedSnapshotRef.current.rotation === 0 &&
                    cachedSnapshotRef.current.zoomLevel === 1
                ) {
                    return cachedSnapshotRef.current;
                }
                cachedSnapshotRef.current = {
                    position: { x: 0, y: 0 },
                    rotation: 0,
                    zoomLevel: 1,
                };
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
                position: { ...currentPosition },
                rotation: currentRotation,
                zoomLevel: currentZoomLevel,
            };
            cachedSnapshotRef.current = newSnapshot;
            return newSnapshot;
        }
    );
}

export const useBoardCameraState = <K extends keyof CameraState>(
    state: K
): CameraState[K] => {
    const { result } = usePixiCanvas();
    const stateKey = (
        state === 'position' ? 'pan' : state === 'zoomLevel' ? 'zoom' : 'rotate'
    ) as StateToEventKey<K>;

    const cachedPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const cachedRotationRef = useRef<number>(0);
    const cachedZoomLevelRef = useRef<number>(1);

    return useSyncExternalStore(
        cb => {
            if (
                result.initialized == false ||
                result.success == false ||
                result.components.camera == null
            ) {
                return () => {};
            }
            return result.components.camera.on(stateKey, cb);
        },
        () => {
            // For position (object), we need to cache to avoid creating new objects
            if (state === 'position') {
                if (
                    result.initialized == false ||
                    result.success == false ||
                    result.components.camera == null
                ) {
                    if (
                        cachedPositionRef.current.x === 0 &&
                        cachedPositionRef.current.y === 0
                    ) {
                        return cachedPositionRef.current as CameraState[K];
                    }
                    cachedPositionRef.current = { x: 0, y: 0 };
                    return cachedPositionRef.current as CameraState[K];
                }
                const currentPosition = result.components.camera.position;
                const cached = cachedPositionRef.current;

                if (
                    cached &&
                    cached.x === currentPosition.x &&
                    cached.y === currentPosition.y
                ) {
                    // Return cached snapshot to maintain referential equality
                    return cached as CameraState[K];
                }

                // Cache the new position object
                const newPosition = { ...currentPosition };
                cachedPositionRef.current = newPosition;
                return cachedPositionRef.current as CameraState[K];
            } else if (state === 'rotation') {
                if (
                    result.initialized == false ||
                    result.success == false ||
                    result.components.camera == null
                ) {
                    if (cachedRotationRef.current === 0) {
                        return cachedRotationRef.current as CameraState[K];
                    }
                    cachedRotationRef.current = 0;
                    return cachedRotationRef.current as CameraState[K];
                }
                cachedRotationRef.current = result.components.camera.rotation;
                return cachedRotationRef.current as CameraState[K];
            } else {
                if (
                    result.initialized == false ||
                    result.success == false ||
                    result.components.camera == null
                ) {
                    if (cachedZoomLevelRef.current === 1) {
                        return cachedZoomLevelRef.current as CameraState[K];
                    }
                    cachedZoomLevelRef.current = 1;
                    return cachedZoomLevelRef.current as CameraState[K];
                }
                cachedZoomLevelRef.current = result.components.camera.zoomLevel;
                return cachedZoomLevelRef.current as CameraState[K];
            }
        }
    );
};
