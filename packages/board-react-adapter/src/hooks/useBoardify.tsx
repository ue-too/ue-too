import {Board as Boardify} from "@ue-too/board";
import {createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore} from "react";
import { CameraMux, CameraState } from "@ue-too/board/camera";
import { Point } from "@ue-too/math";

type StateToEventKey<K extends keyof CameraState> =
    K extends "position" ? "pan" : K extends "zoomLevel" ? "zoom" : "rotate";

export function useBoardify(fullScreen: boolean = false) {

    const boardRef = useRef<Boardify>(new Boardify());

    useEffect(() => {
        boardRef.current.fullScreen = fullScreen;
    }, [fullScreen]);

    return {
        board: boardRef.current,
        subscribe: (callback: () => void) => {
            if (boardRef.current == null) {
                return () => {};
            }
            return boardRef.current.on("pan", (_event, _data) => {
                callback();
            });
        }
    }
}

export function useBoardCameraState<K extends keyof CameraState>(state: K): CameraState[K] {
    const board = useBoard();
    const stateKey = (state === "position" ? "pan" : state === "zoomLevel" ? "zoom" : "rotate") as StateToEventKey<K>;
    const cachedPositionRef = useRef<{ x: number; y: number } | null>(null);

    return useSyncExternalStore(
        (cb) => board.camera.on(stateKey, cb),
        () => {
            // For position (object), we need to cache to avoid creating new objects
            if (state === "position") {
                const currentPosition = board.camera.position;
                const cached = cachedPositionRef.current;
                
                if (cached && cached.x === currentPosition.x && cached.y === currentPosition.y) {
                    // Return cached snapshot to maintain referential equality
                    return cached as CameraState[K];
                }
                
                // Cache the new position object
                const newPosition = {...currentPosition};
                cachedPositionRef.current = newPosition;
                return newPosition as CameraState[K];
            }
            
            // For primitive values (rotation, zoomLevel), return directly
            // Object.is works correctly for primitives
            return board.camera[state] as CameraState[K];
        },
    );
}

export function useCameraInput(){
    const board = useBoard();

    const test = useMemo(()=>{
        const cameraRig = board.getCameraRig();

        return {
            panToWorld: (worldPosition: Point) => {
                cameraRig.panToWorld(worldPosition);
            },
            panToViewPort: (viewPortPosition: Point) => {
                cameraRig.panToViewPort(viewPortPosition);
            },
            zoomTo: (zoomLevel: number) => {
                cameraRig.zoomTo(zoomLevel);
            },
            zoomBy: (zoomDelta: number) => {
                cameraRig.zoomBy(zoomDelta);
            },
            rotateTo: (rotation: number) => {
                cameraRig.rotateTo(rotation);
            },
            rotateBy: (rotationDelta: number) => {
                cameraRig.rotateBy(rotationDelta);
            }
        }

    }, [board]);

    return test;
}

export function useAllBoardCameraState()  {
    const board = useBoard();
    const cachedSnapshotRef = useRef<{
        position: { x: number; y: number };
        rotation: number;
        zoomLevel: number;
    } | null>(null);

    return useSyncExternalStore(
        (cb) => { return board.camera.on("all", cb) },
        () => {
            const currentPosition = board.camera.position;
            const currentRotation = board.camera.rotation;
            const currentZoomLevel = board.camera.zoomLevel;

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

export function useCustomCameraMux(cameraMux: CameraMux) {
    const board = useBoard();

    useEffect(()=>{
        board.cameraMux = cameraMux;
    }, [cameraMux]);
}

const BoardContext = createContext<Boardify | null>(null);

export function BoardProvider({children}: {children: React.ReactNode}) {
    const board = useMemo(() => new Boardify(), []);
    return <BoardContext.Provider value={board}>{children}</BoardContext.Provider>;
}

export function useBoard() {
    const board = useContext(BoardContext);
    if (board == null) {
        throw new Error('Board Provider not found');
    }
    return board;
}

export function useBoardCamera() {
    const board = useBoard();
    return board.camera;
}
