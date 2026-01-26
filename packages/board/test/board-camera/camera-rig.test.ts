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

    describe("rotation with limitEntireViewPort", () => {
        it("should adjust camera position when rotateBy causes viewport to exceed boundaries", () => {
            // Setup: Camera near top-left boundary, viewport will exceed when rotated
            const viewportWidth = 800;
            const viewportHeight = 600;
            const boundaries = {
                min: { x: 0, y: 0 },
                max: { x: 2000, y: 2000 }
            };
            
            // Position camera near top-left boundary
            // With rotation, the viewport corners will extend beyond boundaries
            const camera = new DefaultBoardCamera(
                { viewPortWidth: viewportWidth, viewPortHeight: viewportHeight, position: { x: 200, y: 200 }, rotation: 0, zoomLevel: 1, boundaries }
            );
            
            const cameraRig = createDefaultCameraRig(camera);
            cameraRig.configure({ limitEntireViewPort: true });
            
            const positionBeforeRotation = { ...cameraRig.camera.position };
            
            // Rotate 45 degrees - this will cause viewport corners to extend beyond boundaries
            cameraRig.rotateBy(Math.PI / 4);
            
            // Camera position should be adjusted to keep viewport within boundaries
            expect(cameraRig.camera.rotation).toBe(Math.PI / 4);
            expect(cameraRig.camera.position.x).not.toBe(positionBeforeRotation.x);
            expect(cameraRig.camera.position.y).not.toBe(positionBeforeRotation.y);
            
            // Verify viewport corners are within boundaries after adjustment
            const viewportCorners = cameraRig.camera.viewPortInWorldSpace();
            expect(viewportCorners.top.left.x).toBeGreaterThanOrEqual(boundaries.min.x);
            expect(viewportCorners.top.left.y).toBeGreaterThanOrEqual(boundaries.min.y);
            expect(viewportCorners.top.right.x).toBeLessThanOrEqual(boundaries.max.x);
            expect(viewportCorners.top.right.y).toBeGreaterThanOrEqual(boundaries.min.y);
            expect(viewportCorners.bottom.left.x).toBeGreaterThanOrEqual(boundaries.min.x);
            expect(viewportCorners.bottom.left.y).toBeLessThanOrEqual(boundaries.max.y);
            expect(viewportCorners.bottom.right.x).toBeLessThanOrEqual(boundaries.max.x);
            expect(viewportCorners.bottom.right.y).toBeLessThanOrEqual(boundaries.max.y);
        });

        it("should adjust camera position when rotateTo causes viewport to exceed boundaries", () => {
            // Setup: Camera near bottom-right boundary, viewport will exceed when rotated
            const viewportWidth = 800;
            const viewportHeight = 600;
            const boundaries = {
                min: { x: 0, y: 0 },
                max: { x: 2000, y: 2000 }
            };
            
            // Position camera near bottom-right boundary
            const camera = new DefaultBoardCamera(
                { viewPortWidth: viewportWidth, viewPortHeight: viewportHeight, position: { x: 1800, y: 1800 }, rotation: 0, zoomLevel: 1, boundaries }
            );
            
            const cameraRig = createDefaultCameraRig(camera);
            cameraRig.configure({ limitEntireViewPort: true });
            
            const positionBeforeRotation = { ...cameraRig.camera.position };
            
            // Rotate to 90 degrees - this will cause viewport corners to extend beyond boundaries
            cameraRig.rotateTo(Math.PI / 2);
            
            // Camera position should be adjusted to keep viewport within boundaries
            expect(cameraRig.camera.rotation).toBe(Math.PI / 2);
            expect(cameraRig.camera.position.x).not.toBe(positionBeforeRotation.x);
            expect(cameraRig.camera.position.y).not.toBe(positionBeforeRotation.y);
            
            // Verify viewport corners are within boundaries after adjustment
            const viewportCorners = cameraRig.camera.viewPortInWorldSpace();
            expect(viewportCorners.top.left.x).toBeGreaterThanOrEqual(boundaries.min.x);
            expect(viewportCorners.top.left.y).toBeGreaterThanOrEqual(boundaries.min.y);
            expect(viewportCorners.top.right.x).toBeLessThanOrEqual(boundaries.max.x);
            expect(viewportCorners.top.right.y).toBeGreaterThanOrEqual(boundaries.min.y);
            expect(viewportCorners.bottom.left.x).toBeGreaterThanOrEqual(boundaries.min.x);
            expect(viewportCorners.bottom.left.y).toBeLessThanOrEqual(boundaries.max.y);
            expect(viewportCorners.bottom.right.x).toBeLessThanOrEqual(boundaries.max.x);
            expect(viewportCorners.bottom.right.y).toBeLessThanOrEqual(boundaries.max.y);
        });

        it("should not adjust camera position when rotateBy does not cause viewport to exceed boundaries", () => {
            // Setup: Camera in center of boundaries, rotation won't cause overflow
            const viewportWidth = 400;
            const viewportHeight = 300;
            const boundaries = {
                min: { x: 0, y: 0 },
                max: { x: 2000, y: 2000 }
            };
            
            // Position camera in center with plenty of room
            const camera = new DefaultBoardCamera(
                { viewPortWidth: viewportWidth, viewPortHeight: viewportHeight, position: { x: 1000, y: 1000 }, rotation: 0, zoomLevel: 1, boundaries }
            );
            
            const cameraRig = createDefaultCameraRig(camera);
            cameraRig.configure({ limitEntireViewPort: true });
            
            const positionBeforeRotation = { ...cameraRig.camera.position };
            
            // Rotate 45 degrees - should not cause boundary violation
            cameraRig.rotateBy(Math.PI / 4);
            
            // Camera position should remain the same (no adjustment needed)
            expect(cameraRig.camera.rotation).toBe(Math.PI / 4);
            expect(cameraRig.camera.position.x).toBe(positionBeforeRotation.x);
            expect(cameraRig.camera.position.y).toBe(positionBeforeRotation.y);
        });

        it("should not adjust camera position when limitEntireViewPort is false for rotateBy", () => {
            const viewportWidth = 800;
            const viewportHeight = 600;
            const boundaries = {
                min: { x: 0, y: 0 },
                max: { x: 2000, y: 2000 }
            };
            
            const camera = new DefaultBoardCamera(
                { viewPortWidth: viewportWidth, viewPortHeight: viewportHeight, position: { x: 200, y: 200 }, rotation: 0, zoomLevel: 1, boundaries }
            );
            
            const cameraRig = createDefaultCameraRig(camera);
            cameraRig.configure({ limitEntireViewPort: false });
            
            const positionBeforeRotation = { ...cameraRig.camera.position };
            
            // Rotate - position should not be adjusted when limitEntireViewPort is false
            cameraRig.rotateBy(Math.PI / 4);
            
            expect(cameraRig.camera.rotation).toBe(Math.PI / 4);
            // Position should remain unchanged even if viewport exceeds boundaries
            expect(cameraRig.camera.position.x).toBe(positionBeforeRotation.x);
            expect(cameraRig.camera.position.y).toBe(positionBeforeRotation.y);
        });

        it("should not adjust camera position when limitEntireViewPort is false for rotateTo", () => {
            const viewportWidth = 800;
            const viewportHeight = 600;
            const boundaries = {
                min: { x: 0, y: 0 },
                max: { x: 2000, y: 2000 }
            };
            
            const camera = new DefaultBoardCamera(
                { viewPortWidth: viewportWidth, viewPortHeight: viewportHeight, position: { x: 200, y: 200 }, rotation: 0, zoomLevel: 1, boundaries }
            );
            
            const cameraRig = createDefaultCameraRig(camera);
            cameraRig.configure({ limitEntireViewPort: false });
            
            const positionBeforeRotation = { ...cameraRig.camera.position };
            
            // Rotate - position should not be adjusted when limitEntireViewPort is false
            cameraRig.rotateTo(Math.PI / 2);
            
            expect(cameraRig.camera.rotation).toBe(Math.PI / 2);
            // Position should remain unchanged even if viewport exceeds boundaries
            expect(cameraRig.camera.position.x).toBe(positionBeforeRotation.x);
            expect(cameraRig.camera.position.y).toBe(positionBeforeRotation.y);
        });

        it("should handle rotation with zoom level affecting viewport size", () => {
            // Higher zoom means larger viewport in world space, more likely to exceed boundaries
            const viewportWidth = 400;
            const viewportHeight = 300;
            const boundaries = {
                min: { x: 0, y: 0 },
                max: { x: 1000, y: 1000 }
            };
            
            const camera = new DefaultBoardCamera(
                { viewPortWidth: viewportWidth, viewPortHeight: viewportHeight, position: { x: 300, y: 300 }, rotation: 0, zoomLevel: 2, boundaries }
            );
            
            const cameraRig = createDefaultCameraRig(camera);
            cameraRig.configure({ limitEntireViewPort: true });
            
            const positionBeforeRotation = { ...cameraRig.camera.position };
            
            // Rotate - with higher zoom, viewport is larger in world space
            cameraRig.rotateBy(Math.PI / 4);
            
            expect(cameraRig.camera.rotation).toBe(Math.PI / 4);
            
            // Verify viewport is still within boundaries after adjustment
            const viewportCorners = cameraRig.camera.viewPortInWorldSpace();
            expect(viewportCorners.top.left.x).toBeGreaterThanOrEqual(boundaries.min.x);
            expect(viewportCorners.top.left.y).toBeGreaterThanOrEqual(boundaries.min.y);
            expect(viewportCorners.top.right.x).toBeLessThanOrEqual(boundaries.max.x);
            expect(viewportCorners.top.right.y).toBeGreaterThanOrEqual(boundaries.min.y);
            expect(viewportCorners.bottom.left.x).toBeGreaterThanOrEqual(boundaries.min.x);
            expect(viewportCorners.bottom.left.y).toBeLessThanOrEqual(boundaries.max.y);
            expect(viewportCorners.bottom.right.x).toBeLessThanOrEqual(boundaries.max.x);
            expect(viewportCorners.bottom.right.y).toBeLessThanOrEqual(boundaries.max.y);
        });

        it("should handle multiple rotations with boundary adjustments", () => {
            const viewportWidth = 600;
            const viewportHeight = 400;
            const boundaries = {
                min: { x: 0, y: 0 },
                max: { x: 1500, y: 1500 }
            };
            
            const camera = new DefaultBoardCamera(
                { viewPortWidth: viewportWidth, viewPortHeight: viewportHeight, position: { x: 200, y: 200 }, rotation: 0, zoomLevel: 1, boundaries }
            );
            
            const cameraRig = createDefaultCameraRig(camera);
            cameraRig.configure({ limitEntireViewPort: true });
            
            // First rotation
            cameraRig.rotateBy(Math.PI / 4);
            const positionAfterFirst = { ...cameraRig.camera.position };
            
            // Second rotation
            cameraRig.rotateBy(Math.PI / 4);
            
            expect(cameraRig.camera.rotation).toBe(Math.PI / 2);
            
            // Verify viewport is still within boundaries after both rotations
            const viewportCorners = cameraRig.camera.viewPortInWorldSpace();
            expect(viewportCorners.top.left.x).toBeGreaterThanOrEqual(boundaries.min.x);
            expect(viewportCorners.top.left.y).toBeGreaterThanOrEqual(boundaries.min.y);
            expect(viewportCorners.top.right.x).toBeLessThanOrEqual(boundaries.max.x);
            expect(viewportCorners.top.right.y).toBeGreaterThanOrEqual(boundaries.min.y);
            expect(viewportCorners.bottom.left.x).toBeGreaterThanOrEqual(boundaries.min.x);
            expect(viewportCorners.bottom.left.y).toBeLessThanOrEqual(boundaries.max.y);
            expect(viewportCorners.bottom.right.x).toBeLessThanOrEqual(boundaries.max.x);
            expect(viewportCorners.bottom.right.y).toBeLessThanOrEqual(boundaries.max.y);
        });
    });

});
