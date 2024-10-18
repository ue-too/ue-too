import { InputObserver } from "src/input-observer";
import { DefaultStateMap, EventMapping, KeyboardMouseInputState, NormalState, SelectionState } from "./index";
import { BoardCamera } from "src/board-camera";
import { SelectionBox } from "src/drawing-engine/selection-box";

export type StateMap = {
    [key: string]: KeyboardMouseInputState;
}

export interface StateManager extends KeyboardMouseInputState {
    state: KeyboardMouseInputState;
}

export class StateRegistry<T extends StateMap, K extends keyof T = keyof T> implements StateManager {
    
    private _stateMap: T;
    private _state: KeyboardMouseInputState;
    

    constructor(){
    }

    changeState(stateName: K): void {
        if(this._stateMap === undefined){
            return;
        }
        if(this._state !== undefined){
            this._state.resetInternalStates();
        }
        this._state = this._stateMap[stateName];
        if(this._state === undefined){
            return;
        }
        this._state.resetInternalStates();
    }

    changeStateAndContinueEvent<M extends keyof EventMapping>(stateName: K, invokeName: M, event: EventMapping[M]){
        this.changeState(stateName);
        if(this._state === undefined){
            return;
        }
        (this._state[invokeName] as (event: EventMapping[M]) => void)(event);
    }

    get state(): KeyboardMouseInputState | undefined {
        return this._state;
    }

    set stateMap(stateMap: T){
        this._stateMap = stateMap;
    }

    pointerDownHandler(event: PointerEvent): void {
        
    }

    pointerMoveHandler(event: PointerEvent): void {
        
    }

    pointerUpHandler(event: PointerEvent): void {
        
    }

    keypressHandler(event: KeyboardEvent): void {
        
    }

    keyupHandler(event: KeyboardEvent): void {
        
    }

    scrollHandler(event: WheelEvent): void {
        
    }

    resetInternalStates(): void {
        
    }
}

export function createDefaultStateRegistry(inputObserver: InputObserver, canvas: HTMLCanvasElement, camera: BoardCamera): StateRegistry<DefaultStateMap>{
    const stateRegistry = new StateRegistry<DefaultStateMap>();
    const stateMap: DefaultStateMap = {
        normal: new NormalState(stateRegistry, inputObserver, canvas),
        selection: new SelectionState(stateRegistry, camera, canvas, new SelectionBox()),
    };
    stateRegistry.stateMap = stateMap;
    stateRegistry.changeState("normal");
    return stateRegistry;
}
