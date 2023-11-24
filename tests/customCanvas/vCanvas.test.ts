import { vCanvas } from "../../src/";

describe("First Kickoff Test", ()=>{

    test("First Placeholder Test", ()=>{
        expect(10).toBe(10);
    });


});

customElements.define('v-canvas', vCanvas);

describe("Custom Canvas Initialization", ()=>{

    let vCanvasElement: vCanvas;
    
    beforeEach(()=>{
        vCanvasElement = document.createElement('v-canvas') as vCanvas;
    });

    test("Initialize Custom Canvas Element with width and height set to certain size", ()=>{
        vCanvasElement.setAttribute("width", "300");
        vCanvasElement.setAttribute("height", "300");
        expect(vCanvasElement.getInternalCanvas().width).toBe(300);
        expect(vCanvasElement.getInternalCanvas().width).toBe(300);
    });

    test("Initialize Custom Canvas Element set with full screen", ()=>{
        vCanvasElement.setAttribute("full-screen", "true");
        expect(vCanvasElement.getInternalCanvas().width).toBe(window.innerWidth);
        expect(vCanvasElement.getInternalCanvas().height).toBe(window.innerHeight);
    });

    test("Initialize Custom Canvas Element with set style on background color", ()=>{
        vCanvasElement.setAttribute("style", "background-color: gray");
        expect(window.getComputedStyle(vCanvasElement.getInternalCanvas(), null).getPropertyValue('background-color')).toBe('gray');
        expect(window.getComputedStyle(vCanvasElement, null).getPropertyValue('background-color')).toBe("gray");
    });

});

describe("Custom Canvas Initialization", ()=>{
    let vCanvasElement: vCanvas;
    beforeEach(()=>{
        vCanvasElement = document.createElement('v-canvas') as vCanvas;
    });

    test("Placeholder test", ()=>{

    });
});