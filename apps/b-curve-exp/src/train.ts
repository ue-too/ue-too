import { NumberManager } from "./utils";

export type Car = {
    id: number;
    numberOfBogies: number;
    onTrack: number[];
}

export type Formation = {
    cars: number[]; // car ids
}


export class TrainManager {

    private _numberManager: NumberManager;

    constructor(){
        this._numberManager = new NumberManager(100);
    }
}