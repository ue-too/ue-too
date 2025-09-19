import { CameraMux } from "./camera-mux";
import { PointCal } from "@ue-too/math";

export class EdgeAutoCameraInput {

    private _cameraMux: CameraMux;
    private _state: 'idle' | 'moving' = 'idle';
    private _speed: number = 10; // pixels per second in viewport space

    private _horizontalDirection: 'left' | 'right' | 'none' = 'none';
    private _verticalDirection: 'up' | 'down' | 'none' = 'none';

    constructor(cameraMux: CameraMux) {
        this._cameraMux = cameraMux;
    }

    toggleOff(){
        this._state = 'idle';
    }

    toggleOn(){
        this._state = 'moving';
    }

    setDirection(horizontalDirection: 'left' | 'right' | 'none', verticalDirection: 'up' | 'down' | 'none'): void {
        this._horizontalDirection = horizontalDirection;
        this._verticalDirection = verticalDirection;
    }

    update(deltaTime: number){

        if(this._state === 'idle') {
            return;
        }

        const direction = {
            x: this._horizontalDirection === 'left' ? -1 : this._horizontalDirection === 'right' ? 1 : 0,
            y: this._verticalDirection === 'up' ? -1 : this._verticalDirection === 'down' ? 1 : 0
        };

        const distance = this._speed * deltaTime;

        const deltaVector = PointCal.multiplyVectorByScalar(direction, distance);

        this._cameraMux.notifyPanInput(deltaVector);
    }
}
