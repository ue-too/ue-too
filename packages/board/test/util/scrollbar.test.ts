import { DefaultBoardCamera } from '../../src/camera';
import {
    getScrollBarDimension,
    getScrollBarPosition,
} from '../../src/utils/scrollbar/scrollbar';

describe('getScollBarDimension', () => {
    it('should return 0 for undefined boundaries (meaning unlimited scroll)', () => {
        const boardCamera = new DefaultBoardCamera();
        boardCamera.boundaries = undefined;
        const result = getScrollBarDimension(boardCamera);
        expect(result).toEqual({ horizontal: 0, vertical: 0 });
    });

    it('should return 0 for rotation other than 0', () => {
        const boardCamera = new DefaultBoardCamera();
        boardCamera.setRotation(Math.PI / 4);
        const result = getScrollBarDimension(boardCamera);
        expect(result).toEqual({ horizontal: 0, vertical: 0 });
    });

    it('should return the correct scroll bar dimension for a given boundaries', () => {
        const boardCamera = new DefaultBoardCamera();
        boardCamera.viewPortWidth = 1000;
        boardCamera.viewPortHeight = 1000;
        boardCamera.boundaries = {
            min: { x: -1000, y: -1000 },
            max: { x: 1000, y: 1000 },
        };
        const result = getScrollBarDimension(boardCamera);
        expect(result).toEqual({ horizontal: 0.5, vertical: 0.5 });
    });

    it('should return the correct scroll bar dimension for a scaled viewport', () => {
        const boardCamera = new DefaultBoardCamera();
        boardCamera.viewPortWidth = 1000;
        boardCamera.viewPortHeight = 1000;
        boardCamera.boundaries = {
            min: { x: -1000, y: -1000 },
            max: { x: 1000, y: 1000 },
        };
        boardCamera.setZoomLevel(2);
        const result = getScrollBarDimension(boardCamera);
        expect(result).toEqual({ horizontal: 0.25, vertical: 0.25 });
    });
});

describe('getScrollBarPosition', () => {
    it('should return undefined for rotation other than 0', () => {
        const boardCamera = new DefaultBoardCamera();
        boardCamera.setRotation(Math.PI / 4);
        const result = getScrollBarPosition(boardCamera);
        expect(result).toEqual({ horizontal: undefined, vertical: undefined });
    });

    it('should return undefined for undefined boundaries', () => {
        const boardCamera = new DefaultBoardCamera();
        boardCamera.boundaries = undefined;
        const result = getScrollBarPosition(boardCamera);
        expect(result).toEqual({ horizontal: undefined, vertical: undefined });
    });

    it('should return the correct scroll bar position for a given boundaries', () => {
        const boardCamera = new DefaultBoardCamera();
        boardCamera.viewPortWidth = 300;
        boardCamera.viewPortHeight = 300;
        boardCamera.setPosition({ x: 75, y: 75 });
        boardCamera.setZoomLevel(2);
        boardCamera.boundaries = {
            min: { x: -1000, y: -1000 },
            max: { x: 1000, y: 1000 },
        };
        const result = getScrollBarPosition(boardCamera);
        expect(result).toEqual({ horizontal: 0.5, vertical: 0.5 });
    });
});
