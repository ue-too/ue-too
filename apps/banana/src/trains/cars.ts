let _nextCarId = 0;
let _nextFormationId = 0;

/** Generate a unique car ID. */
export function generateCarId(): string {
    return `car-${_nextCarId++}`;
}

/** Generate a unique formation ID. */
export function generateFormationId(): string {
    return `formation-${_nextFormationId++}`;
}

/**
 * Seeds the car/formation ID generators so the next generated IDs won't clash
 * with existing serialized IDs. Call during deserialization after parsing
 * car and formation id arrays.
 *
 * @param carIds - All car IDs from serialized data (e.g. "car-0", "car-1")
 * @param formationIds - All formation IDs from serialized data (e.g. "formation-0")
 */
export function seedIdGeneratorsFromSerialized(carIds: string[], formationIds: string[]): void {
    const carNum = (id: string) => {
        const m = /^car-(\d+)$/.exec(id);
        return m ? parseInt(m[1], 10) : -1;
    };
    const formationNum = (id: string) => {
        const m = /^formation-(\d+)$/.exec(id);
        return m ? parseInt(m[1], 10) : -1;
    };
    const maxCar = carIds.reduce((a, id) => Math.max(a, carNum(id)), -1);
    const maxFormation = formationIds.reduce((a, id) => Math.max(a, formationNum(id)), -1);
    if (maxCar >= 0) _nextCarId = maxCar + 1;
    if (maxFormation >= 0) _nextFormationId = maxFormation + 1;
}

/**
 * Common interface for train composition elements.
 * Both individual cars (leaf) and formations (composite) implement this.
 */
export interface TrainUnit {
    readonly id: string;
    /** Inter-bogie distances including leading edgeToBogie. */
    bogieOffsets(): number[];
    /** Distance from leading edge to first bogie. */
    get edgeToBogie(): number;
    /** Distance from last bogie to trailing edge. */
    get bogieToEdge(): number;
    /** Flattened list of cars in head-to-tail order. */
    flatCars(): readonly Car[];
    /** Flattened list of cars in head-to-tail order, including the path to the car. */
    _flatCars(): readonly { car: Car, path: string[] }[];
    /** Reverse internal ordering for direction switch. */
    switchDirection(): void;
    /** Whether this unit is flipped from its original orientation. */
    get flipped(): boolean;
    /** Nesting depth: 0 for Car, 1+ for Formation. */
    get depth(): number;
}

export class Car implements TrainUnit {

    readonly id: string;
    private _name: string;
    private _bogieOffsets: number[];

    private _edgeToBogie: number;
    private _bogieToEdge: number;
    private _flipped: boolean = false;

    constructor(id: string, bogieOffsets: number[], edgeToBogie: number, bogieToEdge: number) {
        this.id = id;
        this._name = id;
        this._bogieOffsets = bogieOffsets;
        this._edgeToBogie = edgeToBogie;
        this._bogieToEdge = bogieToEdge;
    }

    /** Display name for UI. Defaults to the car id. */
    get name(): string {
        return this._name;
    }

    set name(value: string) {
        this._name = value;
    }

    bogieOffsets(): number[] {
        return this._bogieOffsets;
    }

    switchDirection(): void {
        this._bogieOffsets = this._bogieOffsets.reverse();
        [this._edgeToBogie, this._bogieToEdge] = [this._bogieToEdge, this._edgeToBogie];
        this._flipped = !this._flipped;
    }

    flatCars(): readonly Car[] {
        return [this];
    }

    _flatCars(): readonly { car: Car, path: string[] }[] {
        return [{ car: this, path: [] }];
    }

    get edgeToBogie(): number {
        return this._edgeToBogie;
    }

    get bogieToEdge(): number {
        return this._bogieToEdge;
    }

    get flipped(): boolean {
        return this._flipped;
    }

    get depth(): number {
        return 0;
    }
}

