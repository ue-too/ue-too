import { BoardKMTStrategy } from "../kmt-strategy";

export interface KeyboardMouseInputState {
    pointerDownHandler(event: PointerEvent): void;
    pointerMoveHandler(event: PointerEvent): void;
    pointerUpHandler(event: PointerEvent): void;
    scrollHandler(event: WheelEvent): void;
    keypressHandler(event: KeyboardEvent): void;
    keyupHandler(event: KeyboardEvent): void;
    resetInternalStates(): void;
}

function handlerNotImplementedWarningMessage(handlerName: string){
    console.log(`this method is a default ${handlerName} you state does not implement it if this is what you want you can ignore this warning`);
}

// in case the keyboard mouse input state needs new event listeners add it to this class so others can decide whether to implement themselves
export abstract class KeyboardMouseInputStateTemplate implements KeyboardMouseInputState {

    protected _strategy: BoardKMTStrategy;

    constructor(strategy: BoardKMTStrategy){
        this._strategy = strategy; 
    }

    pointerDownHandler(event: PointerEvent){
        handlerNotImplementedWarningMessage('pointerDownHandler');
    }

    pointerMoveHandler(event: PointerEvent){
        handlerNotImplementedWarningMessage('pointerMoveHandler');
    }

    pointerUpHandler(event: PointerEvent): void {
        handlerNotImplementedWarningMessage('pointerUpHandler');
    }

    scrollHandler(event: WheelEvent): void {
        handlerNotImplementedWarningMessage('scrollHandler');
    }

    keypressHandler(event: KeyboardEvent): void {
        handlerNotImplementedWarningMessage('keypressHandler');
    }

    keyupHandler(event: KeyboardEvent): void {
        handlerNotImplementedWarningMessage('keyupHandler');
    }

    resetInternalStates(): void {
       console.log('you have not implement the resetInternalStates function');
    }
}

export * from "./normal";
