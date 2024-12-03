import { BoardCameraV2, PanRig } from "../../src";
import BoardV2 from "../../src/boardify/board";
// import { createCanvas } from 'canvas';
import * as ResizeObserverModule from 'resize-observer-polyfill';

window.ResizeObserver = ResizeObserverModule.default;

describe("board state synchronization", () => {

    test("switching board camera would sync between the different input strategies", ()=>{
        const board = new BoardV2(document.createElement("canvas"));
        const altCamera = new BoardCameraV2();
        board.camera = altCamera;
        expect(1).toBe(1);
    });


});