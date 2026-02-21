import { Observable, SynchronousObservable } from '@ue-too/board/utils/';
import { Point, PointCal } from '@ue-too/math';

export type Cell = {
    type: string;
};

export class Grid {
    private _cellWidth: number = 10;
    private _cellHeight: number = 10;
    private _cells: Cell[][] = [];
    private _changeObservable: Observable<
        [{ row: number; column: number; cell: Cell }]
    > = new SynchronousObservable<
        [{ row: number; column: number; cell: Cell }]
    >();
    private _position: Point = { x: 0, y: 0 };

    constructor(
        private _rows: number,
        private _columns: number
    ) {
        this._cells = new Array(_rows)
            .fill(null)
            .map(() => new Array(_columns).fill(null));

        for (let row = 0; row < _rows; row++) {
            for (let column = 0; column < _columns; column++) {
                this._cells[row][column] = { type: 'empty' };
            }
        }
    }

    get cellWidth(): number {
        return this._cellWidth;
    }

    get cellHeight(): number {
        return this._cellHeight;
    }

    get rows(): number {
        return this._rows;
    }

    get columns(): number {
        return this._columns;
    }

    addRow(at?: number): void {
        this._rows++;
        if (at == undefined) {
            at = this._rows;
        }
        this._cells.splice(
            at,
            0,
            new Array(this._columns).fill({ type: 'empty' })
        );
    }

    removeRow(at: number): void {
        this._rows--;
        this._cells.splice(at, 1);
    }

    setCell(row: number, column: number, cellType: string): void {
        if (
            row < 0 ||
            row >= this._rows ||
            column < 0 ||
            column >= this._columns
        ) {
            throw new Error('Row or column out of bounds');
        }
        this._cells[row][column].type = cellType;
        this._changeObservable.notify({
            row,
            column,
            cell: { type: cellType },
        });
    }

    onCellChange(
        callback: (row: number, column: number, cell: Cell) => void
    ): () => void {
        return this._changeObservable.subscribe(data => {
            callback(data.row, data.column, data.cell);
        });
    }

    getCell(point: Point): { row: number; column: number; cell: Cell } | null {
        const offset = PointCal.subVector(point, this.position);
        const row = Math.floor(offset.y / this.cellHeight);
        const column = Math.floor(offset.x / this.cellWidth);
        if (
            row < 0 ||
            row >= this._rows ||
            column < 0 ||
            column >= this._columns
        ) {
            return null;
        }
        return { row, column, cell: this._cells[row][column] };
    }

    get position(): Point {
        return this._position;
    }
}
