/**
 * Categorizes a car for default behaviour (e.g. gangway presence).
 * Uses string values so the enum is extensible without breaking serialization.
 *
 * @group Train System
 */
export enum CarType {
    LOCOMOTIVE = 'locomotive',
    COACH = 'coach',
    MOTOR = 'motor',
    TRAILER = 'trailer',
    FREIGHT = 'freight',
    CAB_CAR = 'cab_car',
}

/** Per-type gangway defaults (head side, tail side). */
const DEFAULT_GANGWAY: Record<CarType, { head: boolean; tail: boolean }> = {
    [CarType.LOCOMOTIVE]: { head: false, tail: false },
    [CarType.COACH]:      { head: true,  tail: true },
    [CarType.MOTOR]:      { head: true,  tail: true },
    [CarType.TRAILER]:    { head: true,  tail: true },
    [CarType.FREIGHT]:    { head: false, tail: false },
    [CarType.CAB_CAR]:    { head: false, tail: true },
};

/**
 * Return the default gangway flags for a given car type.
 * Falls back to no gangway for unknown types.
 */
export function getDefaultGangway(type: CarType): { head: boolean; tail: boolean } {
    return DEFAULT_GANGWAY[type] ?? { head: false, tail: false };
}

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
    /** Distance from the head-end bogie to the tip of the coupler. */
    get headCouplerLength(): number;
    /** Distance from the tail-end bogie to the tip of the coupler. */
    get tailCouplerLength(): number;
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
    private _couplerLength: number;
    private _flipped: boolean = false;
    private _type: CarType;
    private _headHasGangway: boolean;
    private _tailHasGangway: boolean;

    constructor(id: string, bogieOffsets: number[], edgeToBogie: number, bogieToEdge: number, couplerLength?: number, type?: CarType) {
        this.id = id;
        this._name = id;
        this._bogieOffsets = bogieOffsets;
        this._edgeToBogie = edgeToBogie;
        this._bogieToEdge = bogieToEdge;
        this._couplerLength = couplerLength ?? bogieToEdge + 1;
        this._type = type ?? CarType.COACH;
        const gangway = getDefaultGangway(this._type);
        this._headHasGangway = gangway.head;
        this._tailHasGangway = gangway.tail;
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
        [this._headHasGangway, this._tailHasGangway] = [this._tailHasGangway, this._headHasGangway];
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

    get couplerLength(): number {
        return this._couplerLength;
    }

    set couplerLength(value: number) {
        this._couplerLength = value;
    }

    get headCouplerLength(): number {
        return this._couplerLength;
    }

    get tailCouplerLength(): number {
        return this._couplerLength;
    }

    get flipped(): boolean {
        return this._flipped;
    }

    /** Car category — determines default gangway flags. */
    get type(): CarType {
        return this._type;
    }

    /** Setting the type resets gangway flags to the new type's defaults. */
    set type(value: CarType) {
        this._type = value;
        const gangway = getDefaultGangway(value);
        this._headHasGangway = gangway.head;
        this._tailHasGangway = gangway.tail;
    }

    /** Whether the head (leading) end has a gangway connector. */
    get headHasGangway(): boolean {
        return this._headHasGangway;
    }

    set headHasGangway(value: boolean) {
        this._headHasGangway = value;
    }

    /** Whether the tail (trailing) end has a gangway connector. */
    get tailHasGangway(): boolean {
        return this._tailHasGangway;
    }

    set tailHasGangway(value: boolean) {
        this._tailHasGangway = value;
    }

    get depth(): number {
        return 0;
    }
}

