import DefaultBoardCamera, { CameraRig, createDefaultCameraRig } from "../../src/board-camera";


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

});
