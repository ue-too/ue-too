import { PointCal } from "@ue-too/math";
import { DefaultBoardCamera,  createDefaultCameraRig } from "../../src/camera";


describe("camera rig", ()=>{

    it("should zoom at viewport anchor with the correct before and after zoom", ()=>{
        const viewportAnchor = {x: 100, y: 100};
        const cameraRig = createDefaultCameraRig(new DefaultBoardCamera());
        const viewportAnchorInWorldBeforeZoom = cameraRig.camera.convertFromViewPort2WorldSpace(viewportAnchor);
        cameraRig.zoomByAt(1, viewportAnchor);
        const viewportAnchorInWorldAfterZoom = cameraRig.camera.convertFromViewPort2WorldSpace(viewportAnchor);
        expect(viewportAnchorInWorldAfterZoom.x).toBe(viewportAnchorInWorldBeforeZoom.x);
        expect(viewportAnchorInWorldAfterZoom.y).toBe(viewportAnchorInWorldBeforeZoom.y);
        expect(viewportAnchorInWorldAfterZoom.z).toBe(viewportAnchorInWorldBeforeZoom.z);
    });

    it("should zoom by at world anchor with the anchor appear at the same position in view port", ()=>{
        const cameraRig = createDefaultCameraRig(new DefaultBoardCamera());
        const worldAnchor = {x: 100, y: 100};
        const viewportAnchor = cameraRig.camera.convertFromWorld2ViewPort(worldAnchor);
        cameraRig.zoomByAtWorld(1, worldAnchor);
        const viewportAnchorAfterZoom = cameraRig.camera.convertFromWorld2ViewPort(worldAnchor);
        expect(viewportAnchorAfterZoom.x).toBe(viewportAnchor.x);
        expect(viewportAnchorAfterZoom.y).toBe(viewportAnchor.y);
        expect(viewportAnchorAfterZoom.z).toBe(viewportAnchor.z);
    });

    it("should restrict translation to only move in x axis if configured to do so", ()=>{
        const cameraRig = createDefaultCameraRig(new DefaultBoardCamera());
        cameraRig.configure({restrictYTranslation: true});
        cameraRig.panByViewPort({x: 100, y: 100});
        expect(cameraRig.camera.position.y).toBe(0);
    });

    it("should restrict translation to only move in y axis if configured to do so", ()=>{
        const cameraRig = createDefaultCameraRig(new DefaultBoardCamera());
        cameraRig.configure({restrictXTranslation: true});
        cameraRig.panByViewPort({x: 100, y: 100});
        expect(cameraRig.camera.position.x).toBe(0);
    });

    it("should restrict translation to only move in relative x axis (horizontal direction in viewport) if configured to do so", ()=>{
        const cameraRig = createDefaultCameraRig(new DefaultBoardCamera());
        cameraRig.rotateBy(45 * Math.PI / 180);
        const horizontalDirectionInViewportInWorldSpace = PointCal.rotatePoint({x: 1, y: 0}, cameraRig.camera.rotation);
        cameraRig.configure({restrictRelativeXTranslation: true});
        cameraRig.panByViewPort({x: 100, y: 100});
        const res = PointCal.dotProduct(cameraRig.camera.position, horizontalDirectionInViewportInWorldSpace);
        expect(res).toBeCloseTo(0);
    });

    it("should restrict translation to only move in relative y axis (vertical direction in viewport) if configured to do so", ()=>{
        const cameraRig = createDefaultCameraRig(new DefaultBoardCamera());
        cameraRig.rotateBy(45 * Math.PI / 180);
        const verticalDirectionInViewportInWorldSpace = PointCal.rotatePoint({x: 0, y: 1}, cameraRig.camera.rotation);
        cameraRig.configure({restrictRelativeYTranslation: true});
        cameraRig.panByViewPort({x: 100, y: 100});
        const res = PointCal.dotProduct(cameraRig.camera.position, verticalDirectionInViewportInWorldSpace);
        expect(res).toBeCloseTo(0);
    });

    it("should restrict translation when configured to do so", ()=>{
        const cameraRig = createDefaultCameraRig(new DefaultBoardCamera());
        cameraRig.configure({restrictXTranslation: true, restrictYTranslation: true});
        cameraRig.panByViewPort({x: 100, y: 100});
        expect(cameraRig.camera.position.x).toBe(0);
        expect(cameraRig.camera.position.y).toBe(0);
    });

    it("should restrict rotation when configured to do so", ()=>{
        const cameraRig = createDefaultCameraRig(new DefaultBoardCamera());
        cameraRig.configure({restrictRotation: true});
        cameraRig.rotateBy(45 * Math.PI / 180);
        expect(cameraRig.camera.rotation).toBe(0);
    });

});
