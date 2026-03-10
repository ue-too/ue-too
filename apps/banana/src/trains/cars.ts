export class Car {

    private _bogieOffsets: number[];

    private _edgeToBogie: number;
    private _bogieToEdge: number;
    private _flipped: boolean = false;

    constructor(bogieOffsets: number[], edgeToBogie: number, bogieToEdge: number) {
        this._bogieOffsets = bogieOffsets;
        this._edgeToBogie = edgeToBogie;
        this._bogieToEdge = bogieToEdge;
    }

    get bogieOffsets(): number[] {
        return this._bogieOffsets;
    }

    switchDirection(): void {
        this._bogieOffsets = this._bogieOffsets.reverse();
        [this._edgeToBogie, this._bogieToEdge] = [this._bogieToEdge, this._edgeToBogie];
        this._flipped = !this._flipped;
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
};

