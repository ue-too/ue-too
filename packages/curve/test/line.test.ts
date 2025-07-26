import { Line } from "../src/line";

describe("Basic Line Operation", ()=>{
    
    test("Two Lines Intersecting each other", ()=>{
        const line1 = new Line({x: -520, y: 1032}, {x: 695, y: -912});
        const line2 = new Line({x: 188, y: 757}, {x: -281, y:-1119});
        const testRes = line1.intersectionWithAnotherLine(line2);
        expect(testRes.intersects).toBe(true);
        expect(testRes.intersection?.x).toBeCloseTo(34.821);
        expect(testRes.intersection?.y).toBeCloseTo(144.286);
    });

    test("Get the translation and rotation angle needed to align Line with the X axis", ()=>{
        const line = new Line({x: 2, y: 2}, {x: 3, y: 3});
        const testRes = line.getTranslationRotationToAlginXAxis();
        expect(testRes.translation.x).toBeCloseTo(-2);
        expect(testRes.translation.y).toBeCloseTo(-2);
        expect(testRes.rotationAngle).toBeCloseTo(-Math.PI / 4);
    });

    test("Determine if a point lies on the line", ()=>{
        const line = new Line({x: 2, y: 2}, {x: 7, y: 7});
        expect(line.pointInLine({x: 5, y: 5})).toBe(true);
        expect(line.pointInLine({x: 4, y: 5})).toBe(false);
        expect(line.pointInLine({x: 8, y: 8})).toBe(false);
    });
});

function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandom(min: number, max: number){
    return Math.random() * (max - min) + min;
}
