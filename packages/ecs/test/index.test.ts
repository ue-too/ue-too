import * as Point2Point from "../src/index";

describe("Point to Point operations", () => {

    test("Check if two points have the same values", ()=>{
        expect(Point2Point.PointCal.isEqual({x: 1, y: 2}, {x: 1, y: 2})).toBe(true);
        expect(Point2Point.PointCal.isEqual({x: 1, y: 2, z: 1}, {x: 1, y: 2})).toBe(false);
        expect(Point2Point.PointCal.isEqual({x: 1, y: 2}, {x: 1, y: 3})).toBe(false);
    });

    test("Addition", () => {
        expect(Point2Point.PointCal.addVector({x: 1, y: 2}, {x: 3, y: 4})).toEqual(expect.objectContaining({x: 4, y: 6}))
    });

    test("Subtraction", () => {
        expect(Point2Point.PointCal.subVector({x: 1, y: 2}, {x: 3, y: 4})).toEqual(expect.objectContaining({x: -2, y: -2}))
    });

    test("Scalar Multiplication", () => {
        expect(Point2Point.PointCal.multiplyVectorByScalar({x: 1, y: 2}, 3)).toEqual(expect.objectContaining({x: 3, y: 6}))
    });

    test("Scalar Division", () => {
        expect(Point2Point.PointCal.divideVectorByScalar({x: 1, y: 2}, 3)).toEqual(expect.objectContaining({x: 0.3333333333333333, y: 0.6666666666666666}))
        expect(Point2Point.PointCal.divideVectorByScalar({x: 1, y: 2}, 0)).toEqual(expect.objectContaining({x: 1, y: 2}))
    });

    test("Magnitude of a point", () => {
        expect(Point2Point.PointCal.magnitude({x: 1, y: 2})).toBe(Math.sqrt(5))
    });

    test("Unit Vector", () => {
        expect(Point2Point.PointCal.unitVector({x: 1, y: 2})).toEqual(expect.objectContaining({x: 0.4472135954999579, y: 0.8944271909999159}))
    });

    test("Unit Vector with 0 magnitude", () => {
        expect(Point2Point.PointCal.unitVector({x: 0, y: 0})).toEqual(expect.objectContaining({x: 0, y: 0}));
    });

    test("Dot Product", () => {
        expect(Point2Point.PointCal.dotProduct({x: 1, y: 2}, {x: 3, y: 4})).toBe(11)
    });

    test("Cross Product", () => {
        expect(Point2Point.PointCal.crossProduct({x: 1, y: 2}, {x: 3, y: 4})).toEqual(expect.objectContaining({x: 0, y: 0, z: -2}))
    });

    test("Angle From A to B", () => {
        expect(Point2Point.PointCal.angleFromA2B({x: 1, y: 0}, {x: 0, y: 1})).toBe(Math.PI / 2)
    });

    test("Unit Vector From A to B", () => {
        expect(Point2Point.PointCal.unitVectorFromA2B({x: 1, y: 0}, {x: 0, y: 1})).toEqual(expect.objectContaining({x: -1/Math.sqrt(2), y: 1/Math.sqrt(2)}))
    });


    test("Transform Point Coordinate to another set of axis", ()=>{
        expect(Point2Point.PointCal.transform2NewAxis({x: -2, y: 4}, 0.6435029).x).toBeCloseTo(4/5, 4);
        expect(Point2Point.PointCal.transform2NewAxis({x: -2, y: 4}, 0.6435029).y).toBeCloseTo(22/5, 4);
    });

    describe("Point Transformation", () => {
        test("Rotate Point", () => {
            let res = Point2Point.PointCal.rotatePoint({x: 1, y: 0}, Math.PI/ 2);
            expect(res.x).toBeCloseTo(0, 5);
            expect(res.y).toBeCloseTo(1, 5);
        });

        test("Rotate Point with respect to an Anchor Point", () => {
            let res = Point2Point.PointCal.transformPointWRTAnchor({x: 1, y: 0}, {x: 0, y: 0}, Math.PI/ 2);
            expect(res.x).toBeCloseTo(0, 5);
            expect(res.y).toBeCloseTo(1, 5);
        });
    });

    test("Distance Between Two Points", () => {
        let res = Point2Point.PointCal.distanceBetweenPoints({x: 1, y: 0}, {x: 0, y: 1});
        expect(res).toBeCloseTo(Math.sqrt(2), 5);
    });


});


describe("Miscellaneous", ()=>{
    test("Flip Y Axis", ()=>{
        let res = Point2Point.PointCal.flipYAxis({x: 1, y: 4});
        res = Point2Point.PointCal.multiplyVectorByScalar(res, 10);
        expect(res.y).toBe(-40);
        expect(res.z).toBe(undefined);
    });

});

describe("Linear Interpolation between Points", ()=>{
    test("Given two points {x: 0, y: 100}, and {x: 60, y: 40}, and a t val of 0.5", ()=>{
        let res = Point2Point.PointCal.linearInterpolation({x: 0, y: 100}, {x: 60, y: 40}, 0.5);
        expect(res).toEqual(expect.objectContaining({x: 30, y: 70}));
    })
});
