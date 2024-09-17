import { withinBoundaries, normalizeAngleZero2TwoPI, angleSpan, convert2WorldSpace, invertFromWorldSpace, convert2WorldSpaceAnchorAtCenter, convert2ViewPortSpaceAnchorAtCenter } from "../../src/board-camera";
import { clampRotation, RotationLimits, rotationWithinBoundary, RotationBoundary } from "../../src/board-camera/utils/rotation";

import { Boundaries, halfTranslationWidthOf, translationWidthOf, translationHeightOf, halfTranslationHeightOf } from "../../src/board-camera/utils/position";

describe("withinBoundaries", () => {

    test("should return true if no boundaries", () => {
        expect(withinBoundaries({x: 0, y: 0}, undefined)).toBe(true);
    });

    test("should return true if point is within boundaries", () => {
        expect(withinBoundaries({x: 0, y: 0}, {min: {x: -1, y: -1}, max: {x: 1, y: 1}})).toBe(true);
    });

    test("should return false if point is outside boundaries", () => {
        expect(withinBoundaries({x: 0, y: 0}, {min: {x: 1, y: 1}, max: {x: 2, y: 2}})).toBe(false);
    });

    test("should still work if only one boundary is defined", () => {
        expect(withinBoundaries({x: 0, y: 0}, {min: {x: -1, y: -1}})).toBe(true);
        expect(withinBoundaries({x: 0, y: 0}, {max: {x: 1, y: 1}})).toBe(true);
        expect(withinBoundaries({x: 0, y: 0}, {min: {x: 1, y: 1}})).toBe(false);
        expect(withinBoundaries({x: 0, y: 0}, {max: {x: -1, y: -1}})).toBe(false);
    });

    test("should still work if only one axis is defined", () => {
        expect(withinBoundaries({x: 0, y: 0}, {min: {x: -1}})).toBe(true);
        expect(withinBoundaries({x: 0, y: 0}, {max: {x: 1}})).toBe(true);
        expect(withinBoundaries({x: 0, y: 0}, {min: {x: 1}})).toBe(false);
        expect(withinBoundaries({x: 0, y: 0}, {max: {x: -1}})).toBe(false);
    });
        
});

describe("rotation boundaries testing", ()=>{
    test("should return true if the rotation is within the boundaries", ()=>{
        const rotationBoundaries: RotationBoundary = {start: 0, end: Math.PI, positiveDirection: true, startAsTieBreaker: true};
        expect(rotationWithinBoundary(0, rotationBoundaries)).toBe(true);
        expect(rotationWithinBoundary(Math.PI, rotationBoundaries)).toBe(true);
        expect(rotationWithinBoundary(Math.PI / 2, rotationBoundaries)).toBe(true);
    });

    test("should return false if the rotation is outside the boundaries", ()=>{
        const rotationBoundaries: RotationBoundary = {start: 0, end: Math.PI, positiveDirection: true, startAsTieBreaker: true};
        expect(rotationWithinBoundary(-Math.PI / 2, rotationBoundaries)).toBe(false);
        expect(rotationWithinBoundary(Math.PI * 3 / 2, rotationBoundaries)).toBe(false);
    });

    test("should still work if the boundaries cross the 0 degree mark", ()=>{
        const rotationBoundaries: RotationBoundary = {start: (360 - 45) * Math.PI / 180, end: 45 * Math.PI / 180, positiveDirection: true, startAsTieBreaker: true};
        expect(rotationWithinBoundary(0, rotationBoundaries)).toBe(true);
        expect(rotationWithinBoundary(50 * Math.PI / 180, rotationBoundaries)).toBe(false);
        expect(rotationWithinBoundary(330 * Math.PI / 180, rotationBoundaries)).toBe(true);
        expect(rotationWithinBoundary(300 * Math.PI / 180, rotationBoundaries)).toBe(false);
        expect(rotationWithinBoundary(-50 * Math.PI / 180, rotationBoundaries)).toBe(false);
        expect(rotationWithinBoundary(315 * Math.PI / 180, rotationBoundaries)).toBe(true);
    });

    test("should return false if the rotation is outside the boundaries", ()=>{
        const rotationBoundaries: RotationBoundary = {start: (360 - 45) * Math.PI / 180, end: 45 * Math.PI / 180, positiveDirection: true, startAsTieBreaker: true};
        expect(rotationWithinBoundary(50 * Math.PI / 180, rotationBoundaries)).toBe(false);
    });
});

describe("get the translation dimensions from boundaries", () => {
    
    test("translation width from boundaries", ()=>{
        let boundaries: Boundaries | undefined = undefined;

        expect(translationWidthOf(boundaries)).toBe(undefined);
        boundaries = {min: {x: 0}, max: {x: 10}};
        expect(translationWidthOf(boundaries)).toBe(10);
        expect(halfTranslationWidthOf(boundaries)).toBe(5);
    });

    test("translation height from boundaries", ()=>{
        let boundaries: Boundaries | undefined = undefined;

        expect(translationHeightOf(boundaries)).toBe(undefined);
        boundaries = {min: {y: 0}, max: {y: 10}};
        expect(translationHeightOf(boundaries)).toBe(10);
        expect(halfTranslationHeightOf(boundaries)).toBe(5);
    });

});

describe("normalizeAngleZero2TwoPI", () => {
    test("should return the same angle if it is already between 0 and 2PI", () => {
        expect(normalizeAngleZero2TwoPI(0)).toBe(0);
        expect(normalizeAngleZero2TwoPI(Math.PI)).toBe(Math.PI);
        expect(normalizeAngleZero2TwoPI(Math.PI * 2)).toBe(0);
    });

    test("should return the normalized angle if it is not between 0 and 2PI", () => {
        expect(normalizeAngleZero2TwoPI(-45 * Math.PI / 180)).toBeCloseTo(315 * Math.PI / 180);
        expect(normalizeAngleZero2TwoPI(-Math.PI)).toBe(Math.PI);
        expect(normalizeAngleZero2TwoPI(-Math.PI * 2)).toBe(0);
        expect(normalizeAngleZero2TwoPI(Math.PI * 3)).toBe(Math.PI);
        expect(normalizeAngleZero2TwoPI(Math.PI * 4)).toBe(0);
    });
});

describe("angle clamping", ()=>{

    test("should return the same angle if it is within the limits", ()=>{
        const limits:RotationLimits = {start: 0, end: Math.PI, ccw: true, startAsTieBreaker: true};
        expect(clampRotation(0, limits)).toBe(0);
        expect(clampRotation(Math.PI, limits)).toBe(Math.PI);
        expect(clampRotation(Math.PI / 2, limits)).toBe(Math.PI / 2);

    });

    test("should return the clamped angle if out of limits with tie", ()=>{
        const limits:RotationLimits = {start: 0, end: Math.PI, ccw: true, startAsTieBreaker: true};
        expect(clampRotation(-Math.PI / 2, limits)).toBe(0);
        expect(clampRotation(Math.PI * 3 / 2, limits)).toBeCloseTo(0);
    });

    test("counter-clockwise rotation limits crossing the 0 degree mark", ()=>{
        const limits: RotationLimits = {start: (360 - 45) * Math.PI / 180, end: 45 * Math.PI / 180, ccw: true, startAsTieBreaker: true};
        expect(clampRotation(0, limits)).toBe(0);
        expect(clampRotation(50 * Math.PI / 180, limits)).toBe(45 * Math.PI / 180);
        expect(clampRotation(330 * Math.PI / 180, limits)).toBeCloseTo(330 * Math.PI / 180);
        expect(clampRotation(300 * Math.PI / 180, limits)).toBe(315 * Math.PI / 180);
        expect(clampRotation(-50 * Math.PI / 180, limits)).toBe(315 * Math.PI / 180);
    });

    test("clockwise rotation limits crossing the 0 degree mark", ()=>{
        const limits: RotationLimits = {start: 45 * Math.PI / 180, end: 315 * Math.PI / 180, ccw: false, startAsTieBreaker: true};
        expect(clampRotation(0, limits)).toBe(0);
        expect(clampRotation(50 * Math.PI / 180, limits)).toBe(45 * Math.PI / 180);
        expect(clampRotation(-50 * Math.PI / 180, limits)).toBe(315 * Math.PI / 180);
    });

});

describe("calculate the minimum angle span from an angle to another", () => {

    test("a full revolution meaning no angle span", () => {
        expect(angleSpan(0, Math.PI * 2)).toBe(0);
        expect(angleSpan(0, -Math.PI * 2)).toBe(0);
        expect(angleSpan(Math.PI * 2, Math.PI * 4)).toBe(0);
    });

    test("testing the angle span between 0 and 90 degrees", ()=>{
        expect(angleSpan(0, Math.PI / 2)).toBe(Math.PI / 2);
        expect(angleSpan(-Math.PI / 2, 0)).toBe(Math.PI / 2);
    });

    test("testing the angle span that rotating clockwise is smaller than rotating counter clockwise", ()=>{
        expect(angleSpan(0, 270 * Math.PI / 180)).toBeCloseTo(-90 * Math.PI / 180);
    });

    test("testing the angle span that cross the 0 degree mark", ()=>{
        expect(angleSpan(22.5 * Math.PI / 180, -22.5 * Math.PI / 180)).toBeCloseTo(- 45 * Math.PI / 180);
    });
});

describe("coordinate conversion", () => {
    test("Convert point within camera view to world space", ()=>{
        const testRes = convert2WorldSpace({x: 100, y: 100}, 1000, 1000, {x: 30, y: 50}, 10, -45 * Math.PI / 180);
        expect(testRes.x).toBeCloseTo(30 - (800 / (Math.sqrt(2) * 10)));
        expect(testRes.y).toBeCloseTo(50);
        const testRes2 = convert2WorldSpace({x: 100, y: 100}, 1000, 1000, {x: 10, y: 10}, 1, 0);
        expect(testRes2.x).toBeCloseTo(-390);
        expect(testRes2.y).toBeCloseTo(-390);
    });

    test("Convert point within camera view to world space with the camera position as view port origin", ()=>{
        const testRes = convert2WorldSpaceAnchorAtCenter({x: -400, y: -400},  {x: 30, y: 50}, 10, -45 * Math.PI / 180);
        expect(testRes.x).toBeCloseTo(30 - (800 / (Math.sqrt(2) * 10)));
        expect(testRes.y).toBeCloseTo(50);
        const testRes2 = convert2WorldSpaceAnchorAtCenter({x: -400, y: -400}, {x: 10, y: 10}, 1, 0);
        expect(testRes2.x).toBeCloseTo(-390);
        expect(testRes2.y).toBeCloseTo(-390);
    });

    test("Convert point within world space to camera view", ()=>{
        const point = {x: 10, y: 30};
        const cameraCenterInViewPort = {x: 500, y: 500};
        const testRes = invertFromWorldSpace(point, 1000, 1000, {x: 30, y: 50}, 1, 0);
        expect(testRes.x).toBeCloseTo(cameraCenterInViewPort.x - 20);
        expect(testRes.y).toBeCloseTo(cameraCenterInViewPort.y - 20);
        const test2Point = {x: 10, y: 50};
        const testRes2 = invertFromWorldSpace(test2Point, 1000, 1000, {x: 30, y: 50}, 1, -45 * Math.PI / 180);
        const expectedRes = {x: 500 - 20 / Math.sqrt(2), y: 500 - 20 / Math.sqrt(2)};
        expect(testRes2.x).toBeCloseTo(expectedRes.x);
        expect(testRes2.y).toBeCloseTo(expectedRes.y);
    });

    test("Convert point within world space to camera view with camera position as viewport origin", ()=>{
        const point = {x: 10, y: 30};
        const testRes = convert2ViewPortSpaceAnchorAtCenter(point, {x: 30, y: 50}, 1, 0);
        expect(testRes.x).toBeCloseTo(-20);
        expect(testRes.y).toBeCloseTo(-20);
        const test2Point = {x: 10, y: 50};
        const testRes2 = convert2ViewPortSpaceAnchorAtCenter(test2Point, {x: 30, y: 50}, 1, -45 * Math.PI / 180);
        const expectedRes = {x: - 20 / Math.sqrt(2), y: - 20 / Math.sqrt(2)};
        expect(testRes2.x).toBeCloseTo(expectedRes.x);
        expect(testRes2.y).toBeCloseTo(expectedRes.y);
    });
    
});
