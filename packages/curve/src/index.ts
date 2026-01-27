/**
 * @packageDocumentation
 * Bezier curve and geometric path library for TypeScript.
 *
 * @remarks
 * The `@ue-too/curve` package provides comprehensive tools for working with Bezier curves,
 * lines, and composite paths. It includes advanced features like curve intersection detection,
 * offset curves, arc fitting, and arc-length parameterization.
 *
 * ## Core Components
 *
 * - **{@link BCurve}**: Bezier curve (quadratic and cubic) with extensive geometric operations
 * - **{@link Line}**: Straight line segment with intersection and projection utilities
 * - **{@link CompositeBCurve}**: Composite Bezier curve with control points and handles
 * - **{@link Path}**: Sequential path made of line segments
 *
 * ## Key Features
 *
 * ### Bezier Curve Operations
 * - Evaluate curves at any parameter t
 * - Split curves at any point
 * - Calculate arc length with caching
 * - Find derivatives and curvature
 * - Detect self-intersections and curve-to-curve intersections
 *
 * ### Geometric Queries
 * - Project points onto curves
 * - Find closest points on curves
 * - Calculate bounding boxes (AABB)
 * - Detect intersections with lines, circles, and other curves
 * - Fit arcs to curve segments
 *
 * ### Advanced Features
 * - Offset curves (parallel curves at distance)
 * - Arc-length parameterization for uniform spacing
 * - Curve reduction and simplification
 * - Normal and tangent vector calculation
 * - Extrema detection (min/max x and y values)
 *
 * ## Main Exports
 *
 * - {@link BCurve} - Bezier curve class (2-4 control points)
 * - {@link Line} - Line segment class
 * - {@link CompositeBCurve} - Composite curve with handles
 * - {@link ControlPoint} - Control point with left/right handles
 * - {@link Path} - Path composed of line segments
 *
 * @example
 * Basic Bezier curve
 * ```typescript
 * import { BCurve } from '@ue-too/curve';
 *
 * // Create a quadratic Bezier curve
 * const curve = new BCurve([
 *   { x: 0, y: 0 },
 *   { x: 50, y: 100 },
 *   { x: 100, y: 0 }
 * ]);
 *
 * // Evaluate at midpoint
 * const midpoint = curve.get(0.5);
 *
 * // Get the total length
 * console.log('Length:', curve.fullLength);
 *
 * // Split the curve
 * const [left, right] = curve.splitIntoCurves(0.5);
 * ```
 *
 * @example
 * Curve intersections
 * ```typescript
 * import { BCurve } from '@ue-too/curve';
 *
 * const curve1 = new BCurve([
 *   { x: 0, y: 0 },
 *   { x: 50, y: 100 },
 *   { x: 100, y: 0 }
 * ]);
 *
 * const curve2 = new BCurve([
 *   { x: 0, y: 50 },
 *   { x: 50, y: -50 },
 *   { x: 100, y: 50 }
 * ]);
 *
 * // Find intersections
 * const intersections = curve1.getCurveIntersections(curve2);
 * intersections.forEach(({selfT, otherT}) => {
 *   console.log('Intersection at t1:', selfT, 't2:', otherT);
 * });
 * ```
 *
 * @see {@link BCurve} for the main Bezier curve class
 * @see {@link Line} for line segment utilities
 */

export * from './b-curve';
export * from './line';
export * from './composite-curve';
export * from './path';
