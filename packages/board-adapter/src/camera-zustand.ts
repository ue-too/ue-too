import { createStore } from "zustand/vanilla";
import { Point } from "@ue-too/math";
import { BaseCamera } from "@ue-too/board";
import type { BoardCamera, Boundaries, RotationLimits, ZoomLevelLimits } from "@ue-too/board";

export const createCameraStore = (initialState: Partial<BoardCamera> = {}) => createStore<BoardCamera>(
(set)=>{
    const camera = new BaseCamera();

    return {
        get position() {
            return camera.position;
        },
        get zoomLevel() {
            return camera.zoomLevel;
        },
        get rotation() {
            return camera.rotation;
        },
        get viewPortWidth() {
            return camera.viewPortWidth;
        },
        get viewPortHeight() {
            return camera.viewPortHeight;
        },
        get boundaries(): Boundaries | undefined {
            return camera.boundaries;
        },
        get zoomBoundaries(): ZoomLevelLimits | undefined {
            return camera.zoomBoundaries;
        },
        get rotationBoundaries(): RotationLimits | undefined {
            return camera.rotationBoundaries;
        },
        set viewPortWidth(width: number) {
            camera.viewPortWidth = width;
            set({viewPortWidth: camera.viewPortWidth});
        },
        set viewPortHeight(height: number) {
            camera.viewPortHeight = height;
            set({viewPortHeight: camera.viewPortHeight});
        },
        set boundaries(boundaries: Boundaries) {
            camera.boundaries = boundaries;
            set({boundaries: camera.boundaries});
        },
        set zoomBoundaries(zoomBoundaries: ZoomLevelLimits) {
            camera.zoomBoundaries = zoomBoundaries;
            set({zoomBoundaries: camera.zoomBoundaries});
        },
        set rotationBoundaries(rotationBoundaries: RotationLimits) {
            camera.rotationBoundaries = rotationBoundaries;
            set({rotationBoundaries: camera.rotationBoundaries});
        },
        ...initialState,
        setPosition: (position: Point) => {
            const res = camera.setPosition(position);
            set({position: camera.position});
            return res;
        },
        setZoomLevel: (zoomLevel: number) => {
            const res = camera.setZoomLevel(zoomLevel);
            set({zoomLevel: camera.zoomLevel});
            return res;
        },
        setRotation: (rotation: number) => {
            const res = camera.setRotation(rotation);
            set({rotation: camera.rotation});
            return res;
        },
        getTransform: (devicePixelRatio: number, alignCoorindate: boolean = true) => camera.getTransform(devicePixelRatio, alignCoorindate),
        getTRS: (devicePixelRatio: number, alignCoorindate: boolean = true) => camera.getTRS(devicePixelRatio, alignCoorindate),
        convertFromViewPort2WorldSpace: (point: Point) => camera.convertFromViewPort2WorldSpace(point),
        convertFromWorld2ViewPort: (point: Point) => camera.convertFromWorld2ViewPort(point),
        invertFromWorldSpace2ViewPort: (point: Point) => camera.invertFromWorldSpace2ViewPort(point),
        setHorizontalBoundaries: (min: number, max: number) => {
            camera.setHorizontalBoundaries(min, max);
            set({boundaries: camera.boundaries});
        },
        setVerticalBoundaries: (min: number, max: number) => {
            camera.setVerticalBoundaries(min, max);
            set({boundaries: camera.boundaries});
        },
        setMinZoomLevel: (minZoomLevel: number) => camera.setMinZoomLevel(minZoomLevel),
        setMaxZoomLevel: (maxZoomLevel: number) => camera.setMaxZoomLevel(maxZoomLevel),
    }
});

export const createCameraSlice = (initialState: Partial<BoardCamera> = {}) => {
    return (set: (state: Partial<BoardCamera>) => void, get: () => BoardCamera)=>{
        const camera = new BaseCamera();
        return {
            get position() {
                return camera.position;
            },
            get zoomLevel() {
                return camera.zoomLevel;
            },
            get rotation() {
                return camera.rotation;
            },
            get viewPortWidth() {
                return camera.viewPortWidth;
            },
            get viewPortHeight() {
                return camera.viewPortHeight;
            },
            get boundaries(): Boundaries | undefined {
                return camera.boundaries;
            },
            get zoomBoundaries(): ZoomLevelLimits | undefined {
                return camera.zoomBoundaries;
            },
            get rotationBoundaries(): RotationLimits | undefined {
                return camera.rotationBoundaries;
            },
            set viewPortWidth(width: number) {
                camera.viewPortWidth = width;
                set({viewPortWidth: camera.viewPortWidth});
            },
            set viewPortHeight(height: number) {
                camera.viewPortHeight = height;
                set({viewPortHeight: camera.viewPortHeight});
            },
            set boundaries(boundaries: Boundaries) {
                camera.boundaries = boundaries;
                set({boundaries: camera.boundaries});
            },
            set zoomBoundaries(zoomBoundaries: ZoomLevelLimits) {
                camera.zoomBoundaries = zoomBoundaries;
                set({zoomBoundaries: camera.zoomBoundaries});
            },
            set rotationBoundaries(rotationBoundaries: RotationLimits) {
                camera.rotationBoundaries = rotationBoundaries;
                set({rotationBoundaries: camera.rotationBoundaries});
            },
            ...initialState,
            setPosition: (position: Point) => {
                const res = camera.setPosition(position);
                set({position: camera.position});
                return res;
            },
            setZoomLevel: (zoomLevel: number) => {
                const res = camera.setZoomLevel(zoomLevel);
                set({zoomLevel: camera.zoomLevel});
                return res;
            },
            setRotation: (rotation: number) => {
                const res = camera.setRotation(rotation);
                set({rotation: camera.rotation});
                return res;
            },
            getTransform: (devicePixelRatio: number, alignCoorindate: boolean = true) => camera.getTransform(devicePixelRatio, alignCoorindate),
            getTRS: (devicePixelRatio: number, alignCoorindate: boolean = true) => camera.getTRS(devicePixelRatio, alignCoorindate),
            convertFromViewPort2WorldSpace: (point: Point) => camera.convertFromViewPort2WorldSpace(point),
            convertFromWorld2ViewPort: (point: Point) => camera.convertFromWorld2ViewPort(point),
            invertFromWorldSpace2ViewPort: (point: Point) => camera.invertFromWorldSpace2ViewPort(point),
            setHorizontalBoundaries: (min: number, max: number) => {
                camera.setHorizontalBoundaries(min, max);
                set({boundaries: camera.boundaries});
            },
            setVerticalBoundaries: (min: number, max: number) => {
                camera.setVerticalBoundaries(min, max);
                set({boundaries: camera.boundaries});
            },
            setMinZoomLevel: (minZoomLevel: number) => camera.setMinZoomLevel(minZoomLevel),
            setMaxZoomLevel: (maxZoomLevel: number) => camera.setMaxZoomLevel(maxZoomLevel),
        }
    };
}
