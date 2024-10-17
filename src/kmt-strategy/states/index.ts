export interface KeyboardMouseInputState {
    pointerDownHandler(event: PointerEvent): void;
    pointerMoveHandler(event: PointerEvent): void;
    pointerUpHandler(event: PointerEvent): void;
    scrollHandler(event: WheelEvent): void;
    keypressHandler(event: KeyboardEvent): void;
    keyupHandler(event: KeyboardEvent): void;
    resetInternalStates(): void;
}
