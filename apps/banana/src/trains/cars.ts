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
    /** Reverse internal ordering for direction switch. */
    switchDirection(): void;
    /** Whether this unit is flipped from its original orientation. */
    get flipped(): boolean;
    /** Nesting depth: 0 for Car, 1+ for Formation. */
    get depth(): number;
}

export class Car implements TrainUnit {

    readonly id: string;
    private _bogieOffsets: number[];

    private _edgeToBogie: number;
    private _bogieToEdge: number;
    private _flipped: boolean = false;

    constructor(id: string, bogieOffsets: number[], edgeToBogie: number, bogieToEdge: number) {
        this.id = id;
        this._bogieOffsets = bogieOffsets;
        this._edgeToBogie = edgeToBogie;
        this._bogieToEdge = bogieToEdge;
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

