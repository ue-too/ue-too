import {
    convertDeltaInViewPortToWorldSpace,
    convertDeltaInWorldToViewPortSpace,
} from '../../../src/camera/utils/coordinate-conversion';

const testcases = [];

describe('convertDeltaInWorldToViewPortSpace', () => {
    it('should convert delta in world space to view port space', () => {
        const delta = { x: -7.071067811865475, y: 7.071067811865475 };
        const cameraZoomLevel = 1;
        const cameraRotation = (45 * Math.PI) / 180;
        const result = convertDeltaInWorldToViewPortSpace(
            delta,
            cameraZoomLevel,
            cameraRotation
        );
        expect(result.x).toBeCloseTo(0);
        expect(result.y).toBeCloseTo(10);
    });

    it('should convert delta in view port space to world space', () => {
        const delta = { x: 0, y: 10 };
        const cameraZoomLevel = 1;
        const cameraRotation = (45 * Math.PI) / 180;
        const result = convertDeltaInViewPortToWorldSpace(
            delta,
            cameraZoomLevel,
            cameraRotation
        );
        expect(result.x).toBeCloseTo(-7.071067811865475);
        expect(result.y).toBeCloseTo(7.071067811865475);
    });
});
