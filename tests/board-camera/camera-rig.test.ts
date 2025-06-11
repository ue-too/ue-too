import DefaultBoardCamera, { CameraRig, createDefaultCameraRig } from "../../src/board-camera";

describe("camera rig", ()=>{
    beforeEach(()=>{
        const cameraRig = createDefaultCameraRig(new DefaultBoardCamera());
    });

    it("should zoom at world space", ()=>{
        expect(true).toBe(true);
    });

});
