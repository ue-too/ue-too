import { createCameraStore } from "../src/camera-zustand";
import { BaseCamera } from "@ue-too/board";

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
