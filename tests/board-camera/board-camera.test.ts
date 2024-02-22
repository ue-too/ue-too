import { getRandom, getRandomPoint } from "..";
import BoardCamera, { InvalidZoomLevelError } from "../../src/board-camera";
import { Point } from "../../src";

describe("Initialize a BoardCamera object", ()=>{
    let camera: BoardCamera;

    beforeEach(()=>{
        camera = new BoardCamera();
    });

    test("Initialze with default parameters", ()=>{
        expect(camera.getPosition()).toEqual({x: 0, y: 0});
        expect(camera.getRotation()).toBe(0);
        expect(camera.getZoomLevel()).toBe(1);
    });

    test("Initialize with invalid zoom level", ()=>{
        let testFunc = ()=>{
            camera = new BoardCamera({x: 0, y: 0}, 100, 100, 0);
        }
        expect(testFunc).toThrow(InvalidZoomLevelError);
    });

});


describe("Basic Operations on BoardCamera object attributes", ()=>{
    let camera: BoardCamera;

    beforeEach(()=>{
        camera = new BoardCamera();
    });

    test("Set Camera Position", ()=>{
        camera.setPosition({x: 10, y: 20});
        expect(camera.getPosition()).toEqual({x: 10, y: 20});
    });

    test("Set Camera Rotation", ()=>{
        camera.setRotation(Math.PI / 2);
        expect(camera.getRotation()).toBeCloseTo(Math.PI / 2);
    });

    test("Set view port width", ()=>{
        camera.setViewPortWidth(300);
        expect(camera.getViewPortWidth()).toBe(300);
    });

    test("Set view port height", ()=>{
        camera.setViewPortHeight(300);
        expect(camera.getViewPortHeight()).toBe(300);
    });

});


describe("Camera boundaries manipulations", ()=>{
    let camera: BoardCamera;

    beforeEach(()=>{
        camera = new BoardCamera();
    });

    test("Set Empty Boundaries", ()=>{
        expect(camera.getBoundaries()).toBe(undefined);
    });

    test("Set camera translation boundaries", ()=>{
        camera.setHorizontalBoundaries(-500, 300);
        camera.setVerticalBoundaries(-500, 300);
        const boundaries = camera.getBoundaries();
        expect(boundaries == undefined).toBe(false);
        if(boundaries !== undefined){
            expect(boundaries.max).toEqual({x: 300, y: 300});
            expect(boundaries.min).toEqual({x: -500, y: -500});
        }
    });

    test("Set camera translation boundaries with rogue inputs (min greater than max)", ()=>{
        camera.setHorizontalBoundaries(300, -500);
        camera.setVerticalBoundaries(300, -500);
        const boundaries = camera.getBoundaries();
        expect(boundaries == undefined).toBe(false);
        if(boundaries !== undefined){
            expect(boundaries.max).toEqual({x: 300, y: 300});
            expect(boundaries.min).toEqual({x: -500, y: -500});
        }
    });

    test("Check if a point is inside of camera translation boundaries", ()=>{
        camera.setHorizontalBoundaries(300, -500);
        camera.setVerticalBoundaries(300, -500);
        expect(camera.withinBoundaries({x: -700, y: -700})).toBe(false);
    });

    test("Clamp a point within the boundaries", ()=>{
        camera.setHorizontalBoundaries(-500, 300);
        camera.setVerticalBoundaries(-500, 300);
        const testDestPoint = {x: 350, y: 400};
        expect(camera.clampPoint(testDestPoint)).toEqual({x: 300, y: 300});
    });

    test("Set position with automatic clamping", ()=>{
        camera.setHorizontalBoundaries(300, -500);
        camera.setVerticalBoundaries(-300, 700);
        const testDestPoint = {x: 250, y: 800};
        camera.setPositionWithClamp(testDestPoint);
        expect(camera.getPosition()).toEqual({x: 250, y: 700});
    })

});

describe("Camera translation Movements", ()=>{
    let camera: BoardCamera;

    beforeEach(()=>{
        camera = new BoardCamera();
    });

    test("Set camera position outside of boundaries", ()=>{
        camera.setHorizontalBoundaries(-500, 300);
        camera.setVerticalBoundaries(-500, 300);
        const actualRes = camera.setPosition({x: -700, y: -700});
        expect(actualRes).toBe(false);
        expect(camera.getPosition()).toEqual({x: 0, y: 0});
    });

    test("Translate camera given a delta translation vector", ()=>{
        const moveDeltaVector = {x: 10, y: 10};
        const actualRes = camera.move(moveDeltaVector);
        expect(actualRes).toBe(true);
        expect(camera.getPosition()).toEqual({x: 10, y: 10});
    });

    test("Translate camera position outside of boundaries", ()=>{
        camera.setHorizontalBoundaries(-500, 300);
        camera.setVerticalBoundaries(-500, 300);
        camera.moveWithClamp({x: 700, y: -700});
        expect(camera.getPosition()).toEqual({x: 300, y: -500});
    });

    test("Translate camera to a destination that is not within translation boundaries", ()=>{
        const moveDeltaVector = getRandomPoint(400, 500);
        camera.setHorizontalBoundaries(-500, 300);
        camera.setVerticalBoundaries(-500, 300);
        const actualRes = camera.move(moveDeltaVector);
        expect(actualRes).toBe(false);
        expect(camera.getPosition()).toEqual({x: 0, y: 0});
    });
});

describe("Camera zooming operations", ()=>{
    let camera: BoardCamera;

    beforeEach(()=>{
        camera = new BoardCamera();
    });

    test("Set camera zoom", ()=>{
        camera.setZoomLevel(10);
        expect(camera.getZoomLevel()).toBe(10);
        camera.setMinZoomLevel(0.005);
        camera.setMaxZoomLevel(30);
        let testRes = camera.setZoomLevel(0.003);
        expect(testRes).toBe(false);
        testRes = camera.setZoomLevel(35);
        expect(testRes).toBe(false);
    });

    test("Set camera zoom with clamping", ()=>{
        camera.setZoomLevel(10);
        expect(camera.getZoomLevel()).toBe(10);
        camera.setMinZoomLevel(0.005);
        camera.setMaxZoomLevel(30);
        camera.setZoomLevelWithClamp(40);
        expect(camera.getZoomLevel()).toBe(30);
    });

    test("Reset zoom", ()=>{
        camera.setZoomLevel(10);
        camera.resetZoomLevel();
        expect(camera.getZoomLevel()).toBe(1);
    });

    test("Set maximum zoom", ()=>{
        camera.setMaxZoomLevel(10);
        const zoomLevelLimits = camera.getZoomLevelLimits();
        expect(zoomLevelLimits == undefined).toBe(false);
        expect(zoomLevelLimits?.max).toBe(10);
        camera.setZoomLevel(6);
        camera.setMinZoomLevel(5);
        const testRes = camera.setMaxZoomLevel(4);
        expect(testRes).toBe(false);
    });

    test("Set minimum zoom", ()=>{
        camera.setZoomLevel(11);
        camera.setMinZoomLevel(10);
        const zoomLevelLimits = camera.getZoomLevelLimits();
        expect(zoomLevelLimits == undefined).toBe(false);
        expect(zoomLevelLimits?.min).toBe(10);
        camera.setMaxZoomLevel(15);
        const testRes = camera.setMinZoomLevel(20);
        expect(testRes).toBe(false);
    });

    test("Set Zoom less than or equal to 0", ()=>{
        const zoomRes = camera.setZoomLevel(0);
        expect(zoomRes).toBe(false);
        camera.setZoomLevel(1);
        camera.setZoomLevel(-5);
        expect(camera.getZoomLevel()).toBe(1);

    })

});

describe("Camera rotation operations", ()=>{
    let camera: BoardCamera;

    beforeEach(()=>{
        camera = new BoardCamera();
    });

    test("Set camera rotation in degree", ()=>{
        camera.setRotationDeg(45);
        expect(camera.getRotationDeg()).toBeCloseTo(45);
    });

    test("Set camera rotation with a number that is over 360", ()=>{
        camera.setRotationDeg(405);
        expect(camera.getRotationDeg()).toBeCloseTo(45);
    });

    test("Set camera rotation with a number that is negative", ()=>{
        camera.setRotationDeg(-45);
        expect(camera.getRotationDeg()).toBeCloseTo(315);
    });

    test("Find the smaller angle between the current camera rotation and target rotation", ()=>{
        expect(camera.getAngleSpanDeg(-45)).toBeCloseTo(-45);
        expect(camera.getAngleSpanDeg(195)).toBeCloseTo(-165);
        expect(camera.getAngleSpanDeg(-195)).toBeCloseTo(165);
        camera.setRotationDeg(-45);
        expect(camera.getAngleSpanDeg(405)).toBeCloseTo(90);
    });

    test("Rotate camera with a given delta angle", ()=>{
        camera.spinDeg(-45);
        expect(camera.getRotationDeg()).toBeCloseTo(315);
        camera.spinDeg(360);
        expect(camera.getRotationDeg()).toBeCloseTo(315);
        camera.spinDeg(90);
        expect(camera.getRotationDeg()).toBeCloseTo(45);
    });

});


describe("Interactions with the world", ()=>{
    let camera: BoardCamera;

    beforeEach(()=>{
        camera = new BoardCamera();
    });

    test("Convert point within camera view to world space", ()=>{
        const point = {x: 100, y: 100};
        camera.setPosition({x: 30, y: 50});
        camera.setRotationDeg(-45);
        camera.setZoomLevel(10);
        const testRes = camera.convert2WorldSpace(point);
        expect(testRes.x).toBeCloseTo(30 - (800 / (Math.sqrt(2) * camera.getZoomLevel())));
        expect(testRes.y).toBeCloseTo(50);
        camera.resetCamera();
        camera.setPosition({x: 10, y: 10});
        const testRes2 = camera.convert2WorldSpace(point);
        expect(testRes2.x).toBeCloseTo(-390);
        expect(testRes2.y).toBeCloseTo(-390);
    });

    test("Convert point within world space to camera view", ()=>{
        const point = {x: 10, y: 30};
        camera.setPosition({x: 30, y: 50});
        const cameraCenterInViewPort = {x: 500, y: 500};
        const testRes = camera.invertFromWorldSpace(point);
        expect(testRes.x).toBeCloseTo(cameraCenterInViewPort.x - 20);
        expect(testRes.y).toBeCloseTo(cameraCenterInViewPort.y - 20);
        const test2Point = {x: 10, y: 50};
        camera.setRotationDeg(-45);
        const testRes2 = camera.invertFromWorldSpace(test2Point);
        const expectedRes = {x: 500 - 20 / Math.sqrt(2), y: 500 - 20 / Math.sqrt(2)};
        expect(testRes2.x).toBeCloseTo(expectedRes.x);
        expect(testRes2.y).toBeCloseTo(expectedRes.y);
    });

});

describe("Camera Locking onto a specific object", ()=>{

    let camera: BoardCamera;

    beforeEach(()=>{
        camera = new BoardCamera();
    });

    test("Update to the locked on object", ()=>{
        let testObj = new LockableBody;
        testObj.setPosition({x: 100, y: 100});
        testObj.setRotation(Math.PI);
        camera.lockOnto(testObj);
        expect(camera.getPosition()).toEqual({x: 100, y: 100});
        expect(camera.getRotation()).toBeCloseTo(Math.PI);
        expect(camera.getZoomLevel()).toBe(5);
    });

    test("Zoom level should not be affected by the locking", ()=>{
        let testObj = new LockableBody;
        testObj.setPosition(getRandomPoint(-500, 500));
        camera.lockOnto(testObj);
        camera.setZoomLevel(20);
        expect(camera.getZoomLevel()).toBe(20);
    });

});


describe("Camera Animations",()=>{

    let camera: BoardCamera;

    beforeEach(()=>{
        camera = new BoardCamera();
    });

    test("Set Camera position with animation", ()=>{
        const destPoint = getRandomPoint(-500, 500);
        camera.setPositionWithAnimation(destPoint);

    });
});

describe("Camera Rendering Optimization", ()=>{
    
    let camera: BoardCamera;

    beforeEach(()=>{
        camera = new BoardCamera();
    });

    test("Given a point in world space, check if it is within the camera view", ()=>{
        const point = {x: 501, y: 500};
        expect(camera.pointIsInViewPort(point)).toBe(false);
        const point2 = {x: 500, y: 500};
        expect(camera.pointIsInViewPort(point2)).toBe(true);
    });
});

describe("Restrictions on camera", ()=>{

    let camera: BoardCamera;

    beforeEach(()=>{
        camera = new BoardCamera();
    });

    test("Restrict camera translation", ()=>{
        camera.move({x: 10, y: 10});
        camera.lockTranslationFromGesture();
        camera.move({x: 10, y: 10});
        expect(camera.getPosition()).toEqual({x: 20, y: 20});
        camera.lockTranslationFromGesture();
        camera.moveFromGesture({x: 10, y: 10});
        expect(camera.getPosition()).toEqual({x: 20, y: 20});
        camera.releaseLockOnTranslationFromGesture();
        camera.moveFromGesture({x: 10, y: 10});
        expect(camera.getPosition()).toEqual({x: 30, y: 30});
        camera.lockTranslationFromGesture();
        camera.moveWithClamp({x: 10, y: 10});
        expect(camera.getPosition()).toEqual({x: 40, y: 40});
        camera.moveWithClampFromGesture({x: 10, y: 10});
        expect(camera.getPosition()).toEqual({x: 40, y: 40});
    });
    
    test("Restrict camera zoom", ()=>{
        camera.lockZoomFromGesture();
        expect(camera.setZoomLevelFromGesture(10)).toBe(false);
        expect(camera.setZoomLevel(10)).toBe(true);
        camera.setZoomLevelWithClampFromGesture(20);
        expect(camera.getZoomLevel()).toBe(10);
        camera.releaseLockOnZoomFromGesture();
        expect(camera.setZoomLevelFromGesture(5)).toBe(true);
        expect(camera.getZoomLevel()).toBe(5);
        camera.setZoomLevelWithClampFromGesture(15);
        expect(camera.getZoomLevel()).toBe(15);
    });

    test("Restrict camera rotation", ()=>{
        camera.lockRotationFromGesture();
        camera.setRotationDegFromGesture(30);
        expect(camera.getRotationDeg()).toBeCloseTo(0);
        camera.spinDegFromGesture(10);
        expect(camera.getRotationDeg()).toBeCloseTo(0);
        camera.setRotationDeg(30);
        expect(camera.getRotationDeg()).toBeCloseTo(30);
        camera.releaseLockOnRotationFromGesture();
        camera.setRotationDegFromGesture(20);
        expect(camera.getRotationDeg()).toBeCloseTo(20);
        camera.spinDegFromGesture(10);
        expect(camera.getRotationDeg()).toBeCloseTo(30);
    })

});



class LockableBody {

    private position: Point;
    private rotation: number;

    constructor(){
        this.position = {x: 0, y: 0};
        this.rotation = 0;
    }

    setPosition(point: Point){
        this.position = point;
    }

    setRotation(angle: number){
        this.rotation = angle;
    }

    getPosition(): Point{
        return this.position;
    }

    getRotation(): number{
        return this.rotation;
    }

    getOptimalZoomLevel(): number{
        return 5;
    }
};
