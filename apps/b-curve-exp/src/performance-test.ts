import { BCurve, offset } from "@ue-too/curve";
import { Bezier } from "bezier-js";

// Test with a simple cubic curve
const testPoints = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 10 },
    { x: 30, y: 10 }
];

console.log("=== Performance Test ===");
console.log("Testing with control points:", testPoints);

// Test bezier-js performance
console.log("\n--- Testing bezier-js ---");
const bezierCurve = new Bezier(testPoints);
console.time('bezier-js offset');
const bezierOffset = bezierCurve.offset(5);
console.timeEnd('bezier-js offset');
console.log("Bezier-js result segments:", Array.isArray(bezierOffset) ? bezierOffset.length : 1);

// Test BCurve performance
console.log("\n--- Testing BCurve ---");
const bCurve = new BCurve(testPoints);
console.time('BCurve offset');
const bCurveOffset = offset(bCurve, 5);
console.timeEnd('BCurve offset');
console.log("BCurve result segments:", bCurveOffset.length);

// Test individual operations that might be slow
console.log("\n--- Testing individual operations ---");

// Test constructor performance
console.time('BCurve constructor');
for (let i = 0; i < 100; i++) {
    new BCurve(testPoints);
}
console.timeEnd('BCurve constructor');

// Test getExtrema performance
console.time('getExtrema');
for (let i = 0; i < 100; i++) {
    bCurve.getExtrema();
}
console.timeEnd('getExtrema');

// Test curveIsLinear performance
console.time('curveIsLinear');
for (let i = 0; i < 100; i++) {
    // This would need to be exposed as a public method to test
    // For now, we'll test the operations it uses
    const points = bCurve.getControlPoints();
    const order = points.length - 1;
    const alignedPoints = alignPointsToLine(points, {p1: points[0], p2: points[order]});
    const baseLength = Math.sqrt((points[order].x - points[0].x) ** 2 + (points[order].y - points[0].y) ** 2);
    const linear = alignedPoints.reduce((t, p) => t + Math.abs(p.y), 0) < baseLength / 50;
}
console.timeEnd('curveIsLinear');

// Test the specific bottleneck: lengthAtT calls
console.time('lengthAtT calls (1000 times)');
for (let i = 0; i < 1000; i++) {
    bCurve.lengthAtT(i / 1000);
}
console.timeEnd('lengthAtT calls (1000 times)');

// Test derivative calls (which are called by lengthAtT)
console.time('derivative calls (1000 times)');
for (let i = 0; i < 1000; i++) {
    bCurve.derivative(i / 1000);
}
console.timeEnd('derivative calls (1000 times)');

// Helper function for testing
function alignPointsToLine(points: any[], line: {p1: any, p2: any}) {
    const tx = line.p1.x,
      ty = line.p1.y,
      a = -Math.atan2(line.p2.y - ty, line.p2.x - tx),
      d = function (v: any) {
        return {
          x: (v.x - tx) * Math.cos(a) - (v.y - ty) * Math.sin(a),
          y: (v.x - tx) * Math.sin(a) + (v.y - ty) * Math.cos(a),
        };
      };
    return points.map(d);
}

console.log("\n=== Performance Test Complete ===");
