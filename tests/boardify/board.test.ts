import { BoardV2 } from "../../src/boardify";
// import { createCanvas } from 'canvas';
import * as ResizeObserverModule from 'resize-observer-polyfill';

window.ResizeObserver = ResizeObserverModule.default;

describe("test test with boardify", () => {
    test("supply a dom element to the board constructor", ()=>{
        const board = new BoardV2(document.createElement("canvas"));
        expect(board).toBeDefined();
        
    });
});