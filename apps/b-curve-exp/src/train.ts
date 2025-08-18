import { NumberManager } from "./utils";

export type Car = {
    id: number;
    numberOfAxles: number;
    onTrack: number[];
}


export class TrainManager {

    private _numberManager: NumberManager;

    constructor(){
        this._numberManager = new NumberManager(100);
    }
}