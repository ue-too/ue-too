import { EntityManager } from "./utils";

export type Car = {
    id: number;
    numberOfBogies: number;
    onTrack: number[];
}

export type Formation = {
    cars: number[]; // car ids
}

export class TrainManager {

    private _carManager: EntityManager<Car>;

    constructor(){
        this._carManager = new EntityManager<Car>(100);
    }
}
