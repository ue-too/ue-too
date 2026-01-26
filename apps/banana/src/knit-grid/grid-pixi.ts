import { Container, Graphics, Rectangle } from "pixi.js";
import { Point } from "@ue-too/math";
import { Grid } from "./grid";

export class PixiGrid extends Container {

    private _cells: Container;
    private _lineWidth: number = 1;

    constructor(private _grid: Grid){
        super();
        this._cells = this._createCells();
        this.addChild(this._cells);
        this.position.set(this._grid.position.x, this._grid.position.y);
    }

    private _createCells(): Container {
        const container = new Container();
        const rect = new Graphics();
        rect.setStrokeStyle({width: this._lineWidth, color: 0x000000 })
        rect.rect(this.position.x, this.position.y, this._grid.cellWidth * this._grid.columns, this._grid.cellHeight * this._grid.rows);
        rect.stroke();
        container.addChild(rect);

        const cells = new Container();
        container.addChild(cells);

        for(let row = 0; row < this._grid.rows; row++) {
            for(let column = 0; column < this._grid.columns; column++) {
                const cell = new Graphics();
                cell.setStrokeStyle({width: this._lineWidth, color: 0x000000 })
                cell.rect(this.position.x + column * this._grid.cellWidth, this.position.y + row * this._grid.cellHeight, this._grid.cellWidth, this._grid.cellHeight);
                cell.stroke();
                cells.addChild(cell);
            }
        }
        return container;
    }
}