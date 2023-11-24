import { vCamera } from "../../src";

describe("Initialize a vCamera object", ()=>{
    let camera: vCamera;

    beforeEach(()=>{
        camera = new vCamera();
    });

    test("Initialzing with default parameters", ()=>{
        expect(camera.getPosition()).toEqual({x: 0, y: 0});
        expect(camera.getRotation()).toBe(0);
        expect(camera.getZoom()).toBe(1);
    });

});


describe("Basic Operations on vCamera object attributes", ()=>{
    let camera: vCamera;

    beforeEach(()=>{
        camera = new vCamera();
    });

    test("Set Camera Position", ()=>{
        camera.setPosition({x: 10, y: 20});
        expect(camera.getPosition()).toEqual({x: 10, y: 20});
    });

    test("Set Camera Rotation", ()=>{
        camera.setRotation(Math.PI / 2);
        expect(camera.getRotation()).toBeCloseTo(Math.PI / 2);
    });

    test("Set Camera Zoom", ()=>{
        camera.setZoom(10);
        expect(camera.getZoom()).toBe(10);
    });

});