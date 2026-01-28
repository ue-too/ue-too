import { Point } from '@ue-too/math';
import { Container, Graphics, Rectangle } from 'pixi.js';

import { Grid } from './grid';

export class PixiGrid extends Container {
    private _cells: Container;
    private _lineWidth: number = 1;

    constructor(private _grid: Grid) {
        super();
        this._cells = this._createCells();
        this.addChild(this._cells);
        this.position.set(this._grid.position.x, this._grid.position.y);
    }

    private _createCells(): Container {
        const container = new Container();

        // Outer border
        const rect = new Graphics();
        rect.rect(
            0,
            0,
            this._grid.cellWidth * this._grid.columns,
            this._grid.cellHeight * this._grid.rows
        );
        rect.stroke({ color: 0x000000, width: this._lineWidth });
        container.addChild(rect);

        const cells = new Container();
        container.addChild(cells);

        // Grid lines
        for (let row = 0; row < this._grid.rows; row++) {
            for (let column = 0; column < this._grid.columns; column++) {
                const cell = new Graphics();
                cell.rect(
                    column * this._grid.cellWidth,
                    row * this._grid.cellHeight,
                    this._grid.cellWidth,
                    this._grid.cellHeight
                );
                cell.stroke({ color: 0x000000, width: this._lineWidth });
                cells.addChild(cell);
            }
        }

        // Ensure container is visible and has proper bounds
        container.visible = true;
        return container;
    }
}
