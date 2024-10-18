export * from "./normal";
export * from "./selection-state";
export * from "./state-registry";

export interface KeyboardMouseInputState {
    pointerDownHandler(event: PointerEvent): void;
    pointerMoveHandler(event: PointerEvent): void;
    pointerUpHandler(event: PointerEvent): void;
    scrollHandler(event: WheelEvent): void;
    keypressHandler(event: KeyboardEvent): void;
    keyupHandler(event: KeyboardEvent): void;
    resetInternalStates(): void;
}

export type EventMapping = {
    [K in keyof Omit<KeyboardMouseInputState, 'resetInternalStates'>]: Parameters<KeyboardMouseInputState[K]>[0]
}

export class Test {
    private state: KeyboardMouseInputState;
    
    constructor() {
        // Initialize state
    }

    test<K extends keyof EventMapping>(invokeName: K, event: EventMapping[K]) {
        (this.state[invokeName] as (event: EventMapping[K]) => void)(event);
    }
}
