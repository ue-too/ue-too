import { BoardKMTStrategy } from "../kmt-strategy";
import { KeyboardMouseInputState } from "./index";

function functionNotImplementedWarningMessage(handlerName: string){
    console.log(`this method is a default ${handlerName} you state does not implement it if this is what you want you can ignore this warning`);
}

// in case the keyboard mouse input state needs new event listeners add it to this class so others can decide whether to implement themselves
export abstract class KeyboardMouseInputStateTemplate implements KeyboardMouseInputState {

    protected _strategy: BoardKMTStrategy;

    constructor(strategy: BoardKMTStrategy){
        this._strategy = strategy;
    }

    pointerDownHandler(event: PointerEvent){
        functionNotImplementedWarningMessage('pointerDownHandler');
    }

    pointerMoveHandler(event: PointerEvent){
        functionNotImplementedWarningMessage('pointerMoveHandler');
    }

    pointerUpHandler(event: PointerEvent): void {
        functionNotImplementedWarningMessage('pointerUpHandler');
    }

    scrollHandler(event: WheelEvent): void {
        functionNotImplementedWarningMessage('scrollHandler');
    }

    keypressHandler(event: KeyboardEvent): void {
        functionNotImplementedWarningMessage('keypressHandler');
    }

    keyupHandler(event: KeyboardEvent): void {
        functionNotImplementedWarningMessage('keyupHandler');
    }

    resetInternalStates(): void {
        functionNotImplementedWarningMessage('resetInternalStates');
    }
}
