import { Point } from '@ue-too/math';
import { Container, Graphics, Rectangle } from 'pixi.js';

import { Cell, Grid } from './grid';
import { CameraState } from '@ue-too/board';

export class PixiGrid extends Container {
    private _cells: Container;
    private _lineWidth: number = 1;


    constructor(private _grid: Grid) {
        super();
        this._cells = this._createCells(this._lineWidth);
        this.addChild(this._cells);
        this.position.set(this._grid.position.x, this._grid.position.y);
    }

    setCell(row: number, column: number, cellType: string): void {
        this._grid.setCell(row, column, cellType);
        const index = row * this._grid.columns + column;
        console.log('index', index);
        console.log('children', this._cells.children[1].children);
        let cell = this._cells.children[1].children[index];
        cell.destroy({ children: true });
        cell = new Container();
        const cellWall = new Graphics();
        cellWall.rect(
            0,
            0,
            this._grid.cellWidth,
            this._grid.cellHeight
        );
        cellWall.stroke({ color: 0x000000, width: this._lineWidth });
        cell.addChild(cellWall);
        if (cellType == 'knit') {
            const knit = new Graphics();
            knit.arc(0, 0, this._grid.cellWidth / 4, 0, 2 * Math.PI);
            knit.fill({ color: 0x000000 });
            knit.position.set(this._grid.cellWidth / 2, this._grid.cellHeight / 2);
            cell.addChild(knit);
        }
        cell.position.set(column * this._grid.cellWidth, row * this._grid.cellHeight);
        this._cells.children[1].addChildAt(cell, index);
    }

    addRow(at?: number): void {
        this._grid.addRow(at);
        this._cells.destroy({ children: true });
        this._cells = this._createCells(this._lineWidth);
        this.addChild(this._cells);
    }

    removeRow(at?: number): void {
        if (at == undefined) {
            at = this._grid.rows - 1;
        }
        this._grid.removeRow(at);
        this._cells.destroy({ children: true });
        this._cells = this._createCells(this._lineWidth);
        this.addChild(this._cells);
    }

    private _createCells(lineWidth: number): Container {
        const container = new Container();

        // Outer border
        const rect = new Graphics();
        rect.rect(
            0,
            0,
            this._grid.cellWidth * this._grid.columns,
            this._grid.cellHeight * this._grid.rows
        );
        rect.stroke({ color: 0x000000, width: lineWidth });
        container.addChild(rect);

        const cells = new Container();
        container.addChild(cells);

        // Grid lines
        for (let row = 0; row < this._grid.rows; row++) {
            for (let column = 0; column < this._grid.columns; column++) {
                const cell = new Container();
                const cellWall = new Graphics();
                cellWall.rect(
                    column * this._grid.cellWidth,
                    row * this._grid.cellHeight,
                    this._grid.cellWidth,
                    this._grid.cellHeight
                );
                cellWall.stroke({ color: 0x000000, width: lineWidth });
                cell.addChild(cellWall);
                cells.addChild(cell);
            }
        }

        // Ensure container is visible and has proper bounds
        container.visible = true;
        return container;
    }

    update(zoomLevel: number) {
        const lineWidth = 1 / zoomLevel;
        this._lineWidth = lineWidth;
        this._cells.destroy({ children: true });
        this._cells = this._createCells(lineWidth);
        this.addChild(this._cells);
    }

    getCell(point: Point): { row: number; column: number; cell: Cell } | null {
        return this._grid.getCell(point);
    }
}
