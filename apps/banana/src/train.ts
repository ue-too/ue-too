import { GenericEntityManager } from "./utils";

export type Car = {
    id: number;
    numberOfBogies: number;
    onTrack: number[];
}

export type Formation = {
    cars: number[]; // car ids
}

export class TrainManager {

    private _carManager: GenericEntityManager<Car>;

    constructor(){
        this._carManager = new GenericEntityManager<Car>(100);
    }
}
