import {
    Board as Boardify,
    KMTEventParser,
    KmtInputStateMachine,
    OutputEvent,
    TouchEventParser,
} from '@ue-too/board';
import { CameraMux, CameraState } from '@ue-too/board/camera';
import { Point } from '@ue-too/math';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useSyncExternalStore,
} from 'react';

/**
 * Maps camera state keys to their corresponding event names.
 * @internal
 */
type StateToEventKey<K extends keyof CameraState> = K extends 'position'
    ? 'pan'
    : K extends 'zoomLevel'
      ? 'zoom'
      : 'rotate';

/**
 * Hook to subscribe to a specific camera state property with automatic re-rendering.
 *
 * @remarks
 * This hook uses React's `useSyncExternalStore` to efficiently subscribe to camera state changes.
 * It only triggers re-renders when the specified property actually changes, and uses caching
 * to maintain referential equality for object values (like position).
 *
 * **Performance**: The hook is optimized to prevent unnecessary re-renders by:
 * - Caching object values (position) to maintain referential equality
 * - Using `useSyncExternalStore` for efficient subscription management
 * - Only subscribing to the specific state property needed
 *
 * @typeParam K - Key of the camera state to subscribe to
 * @param state - The camera state property to track ("position", "rotation", or "zoomLevel")
 * @returns The current value of the specified camera state property
 *
 * @example
 * ```tsx
 * function CameraInfo() {
 *   const position = useBoardCameraState('position');
 *   const rotation = useBoardCameraState('rotation');
 *   const zoomLevel = useBoardCameraState('zoomLevel');
 *
 *   return (
 *     <div>
 *       Position: {position.x}, {position.y}<br/>
 *       Rotation: {rotation}<br/>
 *       Zoom: {zoomLevel}
 *     </div>
 *   );
 * }
 * ```
 *
 * @category Hooks
 * @see {@link useAllBoardCameraState} for subscribing to all camera state at once
 */
export function useBoardCameraState<K extends keyof CameraState>(
    state: K
): CameraState[K] {
    const board = useBoard();
    const stateKey = (
        state === 'position' ? 'pan' : state === 'zoomLevel' ? 'zoom' : 'rotate'
    ) as StateToEventKey<K>;
    const cachedPositionRef = useRef<{ x: number; y: number } | null>(null);

    return useSyncExternalStore(
        cb => board.camera.on(stateKey, cb),
        () => {
            // For position (object), we need to cache to avoid creating new objects
            if (state === 'position') {
                const currentPosition = board.camera.position;
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
                return newPosition as CameraState[K];
            }

            // For primitive values (rotation, zoomLevel), return directly
            // Object.is works correctly for primitives
            return board.camera[state] as CameraState[K];
        }
    );
}

/**
 * Hook to get camera control functions for programmatic camera manipulation.
 *
 * @remarks
 * This hook provides a stable set of functions to control the camera programmatically.
 * The functions are memoized and only recreate when the board instance changes.
 *
 * All camera operations go through the camera rig, which enforces boundaries,
 * restrictions, and other constraints configured on the board.
 *
 * @returns Object containing camera control functions:
 * - `panToWorld` - Pan camera to a world position
 * - `panToViewPort` - Pan camera to a viewport position
 * - `zoomTo` - Set camera zoom to specific level
 * - `zoomBy` - Adjust camera zoom by delta
 * - `rotateTo` - Set camera rotation to specific angle
 * - `rotateBy` - Adjust camera rotation by delta
 *
 * @example
 * ```tsx
 * function CameraControls() {
 *   const { panToWorld, zoomTo, rotateTo } = useCameraInput();
 *
 *   return (
 *     <div>
 *       <button onClick={() => panToWorld({ x: 0, y: 0 })}>
 *         Center Camera
 *       </button>
 *       <button onClick={() => zoomTo(1.0)}>
 *         Reset Zoom
 *       </button>
 *       <button onClick={() => rotateTo(0)}>
 *         Reset Rotation
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @category Hooks
 */
export function useCameraInput() {
    const board = useBoard();

    const test = useMemo(() => {
        const cameraRig = board.getCameraRig();

        return {
            panByViewPort: (delta: Point) => {
                cameraRig.panByViewPort(delta);
            },
            panByWorld: (delta: Point) => {
                cameraRig.panByWorld(delta);
            },
            panToWorld: (worldPosition: Point) => {
                cameraRig.panToWorld(worldPosition);
            },
            panToViewPort: (viewPortPosition: Point) => {
                cameraRig.panToViewPort(viewPortPosition);
            },
            zoomToAtViewPort: (zoomLevel: number, at: Point) => {
                cameraRig.zoomToAt(zoomLevel, at);
            },
            zoomToAtWorld: (zoomLevel: number, at: Point) => {
                cameraRig.zoomToAtWorld(zoomLevel, at);
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
            },
        };
    }, [board]);

    return test;
}

/**
 * Hook to subscribe to all camera state properties with automatic re-rendering.
 *
 * @remarks
 * This hook provides a snapshot of all camera state (position, rotation, zoomLevel) and
 * re-renders only when any of these values change. It's more efficient than using multiple
 * {@link useBoardCameraState} calls when you need all state properties.
 *
 * **Performance**: The hook uses snapshot caching to maintain referential equality when
 * values haven't changed, preventing unnecessary re-renders in child components.
 *
 * @returns Object containing:
 * - `position` - Current camera position {x, y}
 * - `rotation` - Current camera rotation in radians
 * - `zoomLevel` - Current camera zoom level
 *
 * @example
 * ```tsx
 * function CameraStateDisplay() {
 *   const { position, rotation, zoomLevel } = useAllBoardCameraState();
 *
 *   return (
 *     <div>
 *       <h3>Camera State</h3>
 *       <p>Position: ({position.x.toFixed(2)}, {position.y.toFixed(2)})</p>
 *       <p>Rotation: {rotation.toFixed(2)} rad</p>
 *       <p>Zoom: {zoomLevel.toFixed(2)}x</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @category Hooks
 * @see {@link useBoardCameraState} for subscribing to individual state properties
 */
export function useAllBoardCameraState() {
    const board = useBoard();
    const cachedSnapshotRef = useRef<{
        position: { x: number; y: number };
        rotation: number;
        zoomLevel: number;
    } | null>(null);

    return useSyncExternalStore(
        cb => {
            return board.camera.on('all', cb);
        },
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
                position: { ...currentPosition },
                rotation: currentRotation,
                zoomLevel: currentZoomLevel,
            };
            cachedSnapshotRef.current = newSnapshot;
            return newSnapshot;
        }
    );
}

/**
 * Hook to set a custom camera multiplexer on the board.
 *
 * @remarks
 * This hook allows you to replace the board's default camera mux with a custom implementation.
 * Useful when you need custom input coordination, animation control, or state-based input blocking.
 *
 * The camera mux is updated whenever the provided `cameraMux` instance changes.
 *
 * @param cameraMux - Custom camera mux implementation to use
 *
 * @example
 * ```tsx
 * function CustomMuxBoard() {
 *   const myCustomMux = useMemo(() => {
 *     return createCameraMuxWithAnimationAndLock(camera);
 *   }, []);
 *
 *   useCustomCameraMux(myCustomMux);
 *
 *   return <Board />;
 * }
 * ```
 *
 * @category Hooks
 * @see {@link CameraMux} from @ue-too/board for camera mux interface
 */
export function useCustomCameraMux(cameraMux: CameraMux) {
    const board = useBoard();

    useEffect(() => {
        board.cameraMux = cameraMux;
    }, [cameraMux, board]);
}

/**
 * The custom input handling logic is before everything else. To use this hook, you would need to handle the event from the canvas and pass down the result to the `processInputEvent` function.
 * @returns Object containing the `processInputEvent` function
 * @example
 * ```typescript
 * const { processInputEvent } = useCustomInputHandling();
 *
 * const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
 *   // custom logic to determine the user input
 *
 *   // if the user input is valid, pass it to the `processInputEvent` function
 *   // e.g. pass the pan event down the input handling system
 *   processInputEvent({
 *     type: "pan",
 *     delta: {
 *       x: 10,
 *       y: 10,
 *     },
 *   });
 * }
 * ```
 */
export function useCustomInputHandling() {
    const board = useBoard();

    const processInputEvent = useCallback(
        (input: OutputEvent) => {
            board.inputOrchestrator.processInputEvent(input);
        },
        [board]
    );

    useEffect(() => {
        board.disableEventListeners();

        return () => {
            board.enableEventListeners();
        };
    }, [board]);

    return {
        processInputEvent,
    };
}

/**
 * React context for sharing a Board instance across components.
 * @internal
 */
const BoardContext = createContext<Boardify | null>(null);

/**
 * Provider component for sharing a Board instance across the component tree.
 *
 * @remarks
 * This component creates a single Board instance and makes it available to all child
 * components via the {@link useBoard} hook. This is the recommended way to use the
 * board in React applications when you need to access it from multiple components.
 *
 * The board instance is created once when the provider mounts and persists for the
 * lifetime of the provider.
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to the board
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <BoardProvider>
 *       <Board width={800} height={600} />
 *       <CameraControls />
 *       <CameraStateDisplay />
 *     </BoardProvider>
 *   );
 * }
 * ```
 *
 * @category Components
 * @see {@link useBoard} for accessing the board instance
 */
export function BoardProvider({ children }: { children: React.ReactNode }) {
    const board = useMemo(() => new Boardify(), []);
    return (
        <BoardContext.Provider value={board}>{children}</BoardContext.Provider>
    );
}

/**
 * Hook to access the Board instance from context.
 *
 * @remarks
 * This hook retrieves the Board instance provided by {@link BoardProvider}.
 * It must be used within a component that is a descendant of BoardProvider,
 * otherwise it will throw an error.
 *
 * @returns The Board instance from context
 * @throws Error if used outside of BoardProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const board = useBoard();
 *
 *   useEffect(() => {
 *     // Configure board
 *     board.camera.boundaries = { min: { x: -1000, y: -1000 }, max: { x: 1000, y: 1000 } };
 *   }, [board]);
 *
 *   return <div>Board ready</div>;
 * }
 * ```
 *
 * @category Hooks
 * @see {@link BoardProvider} for providing the board instance
 */
export function useBoard() {
    const board = useContext(BoardContext);
    if (board == null) {
        throw new Error('Board Provider not found');
    }
    return board;
}

/**
 * Hook to access the camera instance from the Board context.
 *
 * @remarks
 * This is a convenience hook that returns the camera from the board instance.
 * Equivalent to calling `useBoard().camera` but more concise.
 *
 * @returns The camera instance from the board
 * @throws Error if used outside of BoardProvider
 *
 * @example
 * ```tsx
 * function CameraConfig() {
 *   const camera = useBoardCamera();
 *
 *   useEffect(() => {
 *     camera.setMinZoomLevel(0.5);
 *     camera.setMaxZoomLevel(4.0);
 *   }, [camera]);
 *
 *   return null;
 * }
 * ```
 *
 * @category Hooks
 * @see {@link useBoard} for accessing the full board instance
 */
export function useBoardCamera() {
    const board = useBoard();
    return board.camera;
}

export function useCanvasDimension() {
    const board = useBoard();

    return useSyncExternalStore(
        cb => board.onCanvasDimensionChange(cb),
        () => {
            return board.canvasDimensions;
        }
    );
}

export function useCoordinateConversion() {
    const board = useBoard();
    return useCallback(
        (pointInWindow: Point) => {
            return board.convertWindowPoint2WorldCoord(pointInWindow);
        },
        [board]
    );
}

export function useCustomKMTEventParser(eventParser: KMTEventParser) {
    const board = useBoard();

    useEffect(() => {
        board.kmtParser = eventParser;
    }, [eventParser, board]);
}

export function useCustomTouchEventParser(eventParser: TouchEventParser) {
    const board = useBoard();

    useEffect(() => {
        board.touchParser = eventParser;
    }, [eventParser, board]);
}
