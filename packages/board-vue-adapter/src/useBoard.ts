import { provide, inject, watch, onMounted, onUnmounted, computed, type ShallowRef, shallowRef } from "vue";
import { Board, CameraMux, CameraState } from "@ue-too/board";
import { type Ref } from "vue";

export const BOARD_SYMBOL = Symbol("BOARD");

export function provideBoard() {
  provide(BOARD_SYMBOL, new Board());
}

export function useBoard() {
  const board = inject<Board>(BOARD_SYMBOL);
  if (!board) {
    throw new Error(
      "Board not found, are you using useBoard in a component that is not a child of a board provider?"
    );
  }
  return board;
}

export function useCustomCameraMux(cameraMux: CameraMux) {
  const board = useBoard();
  watch(
    () => cameraMux,
    (newMux) => {
      board.cameraMux = newMux;
    },
    { immediate: true }
  );
}

export function useCameraState<K extends keyof CameraState>(state: K): ShallowRef<CameraState[K]>{
    const board = useBoard();
    const initialState: CameraState[K] = board.camera[state];
    const stateValue = shallowRef<CameraState[K]>(initialState);
    board.camera.on(state === "position" ? "pan" : state === "zoomLevel" ? "zoom" : "rotate", (newState, cameraState) => {
        stateValue.value = cameraState[state];
    });
    return stateValue as ShallowRef<CameraState[K]>;
}


/**
 * Hook to run a callback on every animation frame.
 * 
 * @param callback - Function to call on each animation frame, receives the current timestamp
 */
export function useAnimationFrame(callback?: (timestamp: number) => void) {
  let animationFrameId: number | null = null;

  const step = (timestamp: number) => {
    callback?.(timestamp);
    animationFrameId = requestAnimationFrame(step);
  };

  onMounted(() => {
    animationFrameId = requestAnimationFrame(step);
  });

  onUnmounted(() => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
  });
}

/**
 * Hook to run an animation loop integrated with the Board's step function.
 * 
 * @param callback - Optional function to call after board.step(), receives timestamp and canvas context
 */
export function useAnimationFrameWithBoard(
  callback?: (timestamp: number, ctx: CanvasRenderingContext2D) => void
) {
  const board = useBoard();

  // Use computed to memoize the callback function (Vue's useCallback equivalent)
  const animationCallback = computed(() => {
    return (timestamp: number) => {
      board.step(timestamp);
      const ctx = board.context;
      if (ctx == undefined) {
        console.warn("Canvas context not available");
        return;
      }
      callback?.(timestamp, ctx);
    };
  });

  useAnimationFrame((timestamp) => {
    animationCallback.value(timestamp);
  });
}
