import { vCanvas } from "../../src";
import { PointCal } from "point2point";
import { Point } from "../../src";
import { getRandom, getRandomPoint } from "../index";


customElements.define('v-canvas', vCanvas);

describe("Custom Canvas Initialization", ()=>{

    let vCanvasElement: vCanvas;
    
    beforeEach(()=>{
        vCanvasElement = document.createElement('v-canvas') as vCanvas;
    });

    test("Initialize custom canvas element with width and height set to certain size", ()=>{
        vCanvasElement.setAttribute("width", "300");
        vCanvasElement.setAttribute("height", "400");
        expect(vCanvasElement.getInternalCanvas().width).toBe(300);
        expect(vCanvasElement.getInternalCanvas().height).toBe(400);
    });

    test("Initialize custom canvas element set with full screen", ()=>{
        vCanvasElement.setAttribute("full-screen", "true");
        expect(vCanvasElement.getInternalCanvas().width).toBe(window.innerWidth);
        expect(vCanvasElement.getInternalCanvas().height).toBe(window.innerHeight);
    });

    test("Initialize custom canvas element with set style on background color", ()=>{
        vCanvasElement.setAttribute("style", "background-color: gray");
        expect(window.getComputedStyle(vCanvasElement.getInternalCanvas(), null).getPropertyValue('background-color')).toBe('gray');
        expect(window.getComputedStyle(vCanvasElement, null).getPropertyValue('background-color')).toBe("gray");
    });

});

describe("Custom canvas initialization with camera", ()=>{
    let vCanvasElement: vCanvas;
    beforeEach(()=>{
        vCanvasElement = document.createElement('v-canvas') as vCanvas;
    });

    test("Camera position should be at the (0, 0), with zoom level 1 and rotation at 0 degree", ()=>{
        const canvasCamera = vCanvasElement.getCamera();
        expect(canvasCamera.getPosition()).toEqual({x: 0, y: 0});
        expect(canvasCamera.getRotation()).toBe(0);
        expect(canvasCamera.getZoomLevel()).toBe(1);
    });

});

describe("Canvas browser window coordinate transformation to internal camera coordinate system", ()=>{

    let vCanvasElement: vCanvas;
    beforeEach(()=>{
        vCanvasElement = document.createElement('v-canvas') as vCanvas;
    });

    test("Convert window click point to canvas viewport point", ()=>{
    })

});