import { createCameraStore, createCameraSlice } from "../src/camera-zustand";
import { BaseCamera } from "@ue-too/board";
import { createStore } from "zustand/vanilla";

describe("camera using zustand store", () => {
    it("should be able to set the position", () => {
        const store = createCameraStore({position: {x: 100, y: 100}});
        expect(store.getState().position).toEqual({x: 100, y: 100});
        store.getState().setPosition({x: 200, y: 200});
        expect(store.getState().position).toEqual({x: 200, y: 200});
    });

    it('should be able to set the zoom level', () => {
        const store = createCameraStore({zoomLevel: 1});
        expect(store.getState().zoomLevel).toEqual(1);
        store.getState().setZoomLevel(2);
        expect(store.getState().zoomLevel).toEqual(2);
    });

    it('should be able to set the rotation', () => {
        const store = createCameraStore({rotation: 45 * Math.PI / 180});
        expect(store.getState().rotation).toEqual(45 * Math.PI / 180);
        store.getState().setRotation(90 * Math.PI / 180);
        expect(store.getState().rotation).toEqual(90 * Math.PI / 180);
    });

    it('should be able to subscribe to the state of the camera', () => {
        const store = createCameraStore({position: {x: 100, y: 100}});
        store.subscribe((state) => {
            expect(state.position).toEqual(store.getState().position);
        });
        store.getState().setPosition({x: 200, y: 200});
    });

    it('should mimic the get transform method', () => {
        const camera = new BaseCamera();
        const store = createCameraStore({position: camera.position, rotation: camera.rotation, zoomLevel: camera.zoomLevel});

        const transform = store.getState().getTransform(1, true);
        expect(transform).toEqual(camera.getTransform(1, true));
    });
});

describe("camera using zustand slice", () => {
    it("should be able to set the position", () => {
        const slice = createCameraSlice({position: {x: 100, y: 100}});
        const store = createStore(slice);
        
        expect(store.getState().position).toEqual({x: 100, y: 100});
        
        const result = store.getState().setPosition({x: 200, y: 200});
        expect(result).toBe(true); // setPosition returns boolean
        expect(store.getState().position).toEqual({x: 200, y: 200});
    });

    it('should be able to set the zoom level', () => {
        const slice = createCameraSlice({zoomLevel: 1});
        const store = createStore(slice);
        
        expect(store.getState().zoomLevel).toEqual(1);
        
        const result = store.getState().setZoomLevel(2);
        expect(result).toBe(true); // setZoomLevel returns boolean
        expect(store.getState().zoomLevel).toEqual(2);
    });

    it('should be able to set the rotation', () => {
        const slice = createCameraSlice({rotation: 45 * Math.PI / 180});
        const store = createStore(slice);
        
        expect(store.getState().rotation).toEqual(45 * Math.PI / 180);
        
        const result = store.getState().setRotation(90 * Math.PI / 180);
        expect(result).toBe(true); // setRotation returns boolean
        expect(store.getState().rotation).toEqual(90 * Math.PI / 180);
    });

    it('should be able to set viewport dimensions', () => {
        const slice = createCameraSlice();
        const store = createStore(slice);
        
        store.getState().viewPortWidth = 800;
        expect(store.getState().viewPortWidth).toEqual(800);
        
        store.getState().viewPortHeight = 600;
        expect(store.getState().viewPortHeight).toEqual(600);
    });

    it('should be able to set boundaries', () => {
        const slice = createCameraSlice();
        const store = createStore(slice);
        
        const boundaries = { 
            min: { x: 0, y: 0 }, 
            max: { x: 1000, y: 1000 } 
        };
        store.getState().boundaries = boundaries;
        expect(store.getState().boundaries).toEqual(boundaries);
    });

    it('should be able to set zoom boundaries', () => {
        const slice = createCameraSlice();
        const store = createStore(slice);
        
        const zoomBoundaries = { min: 0.1, max: 10 };
        store.getState().zoomBoundaries = zoomBoundaries;
        expect(store.getState().zoomBoundaries).toEqual(zoomBoundaries);
    });

    it('should be able to set rotation boundaries', () => {
        const slice = createCameraSlice();
        const store = createStore(slice);
        
        const rotationBoundaries = { 
            start: -Math.PI, 
            end: Math.PI, 
            ccw: false, 
            startAsTieBreaker: true 
        };
        store.getState().rotationBoundaries = rotationBoundaries;
        expect(store.getState().rotationBoundaries).toEqual(rotationBoundaries);
    });

    it('should be able to set horizontal boundaries', () => {
        const slice = createCameraSlice();
        const store = createStore(slice);
        
        store.getState().setHorizontalBoundaries(0, 1000);
        const boundaries = store.getState().boundaries;
        expect(boundaries?.min?.x).toBe(0);
        expect(boundaries?.max?.x).toBe(1000);
    });

    it('should be able to set vertical boundaries', () => {
        const slice = createCameraSlice();
        const store = createStore(slice);
        
        store.getState().setVerticalBoundaries(0, 1000);
        const boundaries = store.getState().boundaries;
        expect(boundaries?.min?.y).toBe(0);
        expect(boundaries?.max?.y).toBe(1000);
    });

    it('should be able to set min and max zoom levels', () => {
        const slice = createCameraSlice();
        const store = createStore(slice);
        
        store.getState().setMinZoomLevel(0.1);
        store.getState().setMaxZoomLevel(10);
        
        // These methods don't trigger set() calls, they just set the camera's internal state
        expect(store.getState().zoomBoundaries?.min).toBe(0.1);
        expect(store.getState().zoomBoundaries?.max).toBe(10);
    });

    it('should mimic the get transform method', () => {
        const camera = new BaseCamera();
        const slice = createCameraSlice({position: camera.position, rotation: camera.rotation, zoomLevel: camera.zoomLevel});
        const store = createStore(slice);

        const transform = store.getState().getTransform(1, true);
        expect(transform).toEqual(camera.getTransform(1, true));
    });

    it('should mimic the get TRS method', () => {
        const camera = new BaseCamera();
        const slice = createCameraSlice({position: camera.position, rotation: camera.rotation, zoomLevel: camera.zoomLevel});
        const store = createStore(slice);

        const trs = store.getState().getTRS(1, true);
        expect(trs).toEqual(camera.getTRS(1, true));
    });

    it('should be able to convert coordinates', () => {
        const slice = createCameraSlice();
        const store = createStore(slice);

        const point = { x: 100, y: 100 };
        
        const worldPoint = store.getState().convertFromViewPort2WorldSpace(point);
        const viewPortPoint = store.getState().convertFromWorld2ViewPort(worldPoint);
        
        expect(typeof worldPoint.x).toBe('number');
        expect(typeof worldPoint.y).toBe('number');
        expect(typeof viewPortPoint.x).toBe('number');
        expect(typeof viewPortPoint.y).toBe('number');
    });

    it('should handle initial state correctly', () => {
        const initialState = {
            position: { x: 50, y: 50 },
            zoomLevel: 1.5,
            rotation: Math.PI / 4,
            viewPortWidth: 1024,
            viewPortHeight: 768
        };
        
        const slice = createCameraSlice(initialState);
        const store = createStore(slice);
        
        expect(store.getState().position).toEqual(initialState.position);
        expect(store.getState().zoomLevel).toEqual(initialState.zoomLevel);
        expect(store.getState().rotation).toEqual(initialState.rotation);
        expect(store.getState().viewPortWidth).toEqual(initialState.viewPortWidth);
        expect(store.getState().viewPortHeight).toEqual(initialState.viewPortHeight);
    });

    it('should be able to subscribe to state changes', () => {
        const slice = createCameraSlice({position: {x: 100, y: 100}});
        const store = createStore(slice);
        
        let stateChangeCount = 0;
        const unsubscribe = store.subscribe((state) => {
            stateChangeCount++;
            expect(state.position).toEqual(store.getState().position);
        });
        
        store.getState().setPosition({x: 200, y: 200});
        expect(stateChangeCount).toBe(1);
        
        store.getState().setZoomLevel(2);
        expect(stateChangeCount).toBe(2);
        
        unsubscribe();
    });

    it('should behave identically to createCameraStore', () => {
        const initialState = {
            position: { x: 100, y: 100 },
            zoomLevel: 1.5,
            rotation: Math.PI / 4
        };
        
        const storeFromSlice = createStore(createCameraSlice(initialState));
        const storeFromFunction = createCameraStore(initialState);
        
        // Test that both stores have the same initial state
        expect(storeFromSlice.getState().position).toEqual(storeFromFunction.getState().position);
        expect(storeFromSlice.getState().zoomLevel).toEqual(storeFromFunction.getState().zoomLevel);
        expect(storeFromSlice.getState().rotation).toEqual(storeFromFunction.getState().rotation);
        
        // Test that both stores behave the same way when setting values
        storeFromSlice.getState().setPosition({x: 200, y: 200});
        storeFromFunction.getState().setPosition({x: 200, y: 200});
        
        expect(storeFromSlice.getState().position).toEqual(storeFromFunction.getState().position);
        
        // Test that transform methods return the same results
        const transformFromSlice = storeFromSlice.getState().getTransform(1, true);
        const transformFromFunction = storeFromFunction.getState().getTransform(1, true);
        
        expect(transformFromSlice).toEqual(transformFromFunction);
    });
});
