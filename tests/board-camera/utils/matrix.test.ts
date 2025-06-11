import { createCameraMatrix, decomposeCameraMatrix } from "../../../src/board-camera/utils/matrix";

describe("matrix operations", ()=>{
    it("should decompose the matrix correctly", ()=>{
        const originalCamera = {
            position: { x: 100, y: 50 },
            zoom: 2.0,
            rotation: Math.PI / 6 // 30 degrees
        };
        const devicePixelRatio = 1.5;
        const canvasWidth = 800;
        const canvasHeight = 600;

        const matrix = createCameraMatrix(
            originalCamera.position, 
            originalCamera.zoom, 
            originalCamera.rotation, 
            devicePixelRatio, 
            canvasWidth, 
            canvasHeight
        );

        const decomposed = decomposeCameraMatrix(
            matrix, 
            devicePixelRatio, 
            canvasWidth, 
            canvasHeight
        );

        expect(decomposed.position.x).toBeCloseTo(originalCamera.position.x);
        expect(decomposed.position.y).toBeCloseTo(originalCamera.position.y);
        expect(decomposed.zoom).toBeCloseTo(originalCamera.zoom);
        expect(decomposed.rotation).toBeCloseTo(originalCamera.rotation);
    });
});
