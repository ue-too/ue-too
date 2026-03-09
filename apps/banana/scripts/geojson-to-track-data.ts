/**
 * Converts a GeoJSON GeometryCollection of LineStrings (railroad sections) into
 * banana SerializedTrackData. Uses x,y in meters with the center of the GeoJSON
 * as the origin (0, 0). Assigns one elevation per joint so segment from/to match
 * joint elevations.
 *
 * Simplification (to keep total joints + segments in the 50 range):
 * - Douglas–Peucker on each LineString (fewer points → fewer segments)
 * - Larger snap tolerance (merge nearby endpoints into one joint)
 * - One segment per joint pair (dedupe by endpoint pair)
 * - Sample LineStrings (process every Nth geometry)
 *
 * Usage: bun run scripts/geojson-to-track-data.ts <path-to-geojson> [output-path]
 * Example: bun run scripts/geojson-to-track-data.ts ~/Desktop/N02-05-g_RailroadSection.json public/tokyo-railroad-tracks.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const GAUGE = 1.067;
/** Merge endpoints within this distance (m) into one joint. */
const SNAP_TOLERANCE_M = 550;
/** Douglas–Peucker tolerance (m); larger = fewer points per line. */
const DOUGLAS_PEUCKER_EPSILON_M = 600;
/** Target total joints + segments; geometry sampling aims for this. */
const TARGET_MAX_TOTAL = 50;
const METERS_PER_DEG_LAT = 110540;

type Point = { x: number; y: number };

function makeProjector(centerLon: number, centerLat: number): (lon: number, lat: number) => Point {
  const metersPerDegLon = 111320 * Math.cos((centerLat * Math.PI) / 180);
  return (lon: number, lat: number) => ({
    x: (lon - centerLon) * metersPerDegLon,
    y: (lat - centerLat) * METERS_PER_DEG_LAT,
  });
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Perpendicular distance from point p to segment a–b. */
function perpendicularDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1e-10;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len)));
  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return dist(p, proj);
}

/** Douglas–Peucker simplification; epsilon in same units as points (meters). */
function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDist(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }
  if (maxDist <= epsilon) return [start, end];
  const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
  const right = douglasPeucker(points.slice(maxIdx), epsilon);
  return [...left.slice(0, -1), ...right];
}

function unitTangentQuadraticAtStart(p0: Point, p1: Point, p2: Point): Point {
  const dx = 2 * (p1.x - p0.x);
  const dy = 2 * (p1.y - p0.y);
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function unitTangentQuadraticAtEnd(p0: Point, p1: Point, p2: Point): Point {
  const dx = 2 * (p2.x - p1.x);
  const dy = 2 * (p2.y - p1.y);
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function addTangent(t: Point, out: Point): void {
  const len = Math.hypot(out.x + t.x, out.y + t.y);
  if (len > 1e-10) {
    out.x = (out.x + t.x) / len;
    out.y = (out.y + t.y) / len;
  }
}

type GeoGeometry = { type: string; coordinates: number[][] | number[][][] };
type GeoCollection = { type: 'GeometryCollection'; geometries: GeoGeometry[] };

function isLineString(g: GeoGeometry): g is { type: 'LineString'; coordinates: number[][] } {
  return g.type === 'LineString' && Array.isArray(g.coordinates) && g.coordinates.length > 0 && Array.isArray(g.coordinates[0]);
}

function lineCoords(g: GeoGeometry): number[][] {
  if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
    return g.coordinates as number[][];
  }
  return [];
}

function main(): void {
  const geojsonPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!geojsonPath) {
    console.error('Usage: bun run scripts/geojson-to-track-data.ts <path-to-geojson> [output-path]');
    process.exit(1);
  }

  const raw = readFileSync(resolve(geojsonPath), 'utf-8');
  const geojson = JSON.parse(raw) as GeoCollection;
  if (geojson.type !== 'GeometryCollection' || !Array.isArray(geojson.geometries)) {
    console.error('Expected GeoJSON GeometryCollection');
    process.exit(1);
  }

  // Compute center of GeoJSON (origin for x,y).
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const geom of geojson.geometries) {
    const coords = lineCoords(geom);
    for (const c of coords) {
      const [lon, lat] = c;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;
  const project = makeProjector(centerLon, centerLat);

  const jointPositions: Point[] = [];
  const jointTangentSum: Point[] = [];
  const jointElevation: number[] = [];

  /** ELEVATION enum range for banana (SUB_3 = -3 … ABOVE_3 = 3). */
  const ELEVATION_MIN = -3;
  const ELEVATION_MAX = 3;

  function findOrCreateJoint(p: Point): number {
    for (let i = 0; i < jointPositions.length; i++) {
      if (dist(jointPositions[i], p) <= SNAP_TOLERANCE_M) return i;
    }
    const j = jointPositions.length;
    jointPositions.push({ ...p });
    jointTangentSum.push({ x: 0, y: 0 });
    jointElevation.push(0);
    return j;
  }

  const segments: {
    t0Joint: number;
    t1Joint: number;
    controlPoints: Point[];
  }[] = [];
  /** One segment per joint pair (dedupe by unordered pair). */
  const segmentKey = new Set<string>();

  // Sample geometries so total joints + segments stays near TARGET_MAX_TOTAL (~1000).
  const lineStrings = geojson.geometries.filter((g: GeoGeometry) => isLineString(g));
  const geometryStep = lineStrings.length <= 25 ? 1 : Math.max(1, Math.floor(lineStrings.length / 25));

  // Use position-based segment key so we don't create orphan joints when skipping duplicates.
  function segmentKeyForPoints(a: Point, b: Point): string {
    const snap = (p: Point) =>
      `${Math.round(p.x / SNAP_TOLERANCE_M) * SNAP_TOLERANCE_M},${Math.round(p.y / SNAP_TOLERANCE_M) * SNAP_TOLERANCE_M}`;
    const k1 = snap(a);
    const k2 = snap(b);
    return k1 < k2 ? `${k1}-${k2}` : `${k2}-${k1}`;
  }

  for (let gIdx = 0; gIdx < lineStrings.length; gIdx += geometryStep) {
    const geom = lineStrings[gIdx];
    const coords = lineCoords(geom);
    const points = coords.map((c) => project(c[0], c[1]));
    const simplified = douglasPeucker(points, DOUGLAS_PEUCKER_EPSILON_M);
    for (let i = 0; i < simplified.length - 1; i++) {
      const a = simplified[i];
      const b = simplified[i + 1];
      const key = segmentKeyForPoints(a, b);
      if (segmentKey.has(key)) continue;
      segmentKey.add(key);
      const ja = findOrCreateJoint(a);
      const jb = findOrCreateJoint(b);
      if (ja === jb) continue;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const cps = [jointPositions[ja], mid, jointPositions[jb]];
      const t0 = unitTangentQuadraticAtStart(cps[0], cps[1], cps[2]);
      const t1 = unitTangentQuadraticAtEnd(cps[0], cps[1], cps[2]);
      addTangent(t0, jointTangentSum[ja]);
      addTangent(t1, jointTangentSum[jb]);
      segments.push({ t0Joint: ja, t1Joint: jb, controlPoints: cps });
    }
  }

  // Assign one elevation per joint (no geo elevation data): use northing for gentle variation.
  const yMin = Math.min(...jointPositions.map((p) => p.y));
  const yMax = Math.max(...jointPositions.map((p) => p.y));
  const yRange = yMax - yMin || 1;
  for (let j = 0; j < jointPositions.length; j++) {
    const t = (jointPositions[j].y - yMin) / yRange;
    const raw = Math.round(t * (ELEVATION_MAX - ELEVATION_MIN)) + ELEVATION_MIN;
    jointElevation[j] = Math.max(ELEVATION_MIN, Math.min(ELEVATION_MAX, raw));
  }

  const joints: {
    jointNumber: number;
    position: Point;
    connections: [number, number][];
    tangent: Point;
    direction: { tangent: number[]; reverseTangent: number[] };
    elevation: number;
  }[] = [];

  for (let j = 0; j < jointPositions.length; j++) {
    const tangentSum = jointTangentSum[j];
    let tangent = { x: 1, y: 0 };
    const len = Math.hypot(tangentSum.x, tangentSum.y);
    if (len > 1e-10) {
      tangent = { x: tangentSum.x / len, y: tangentSum.y / len };
    }
    const connections: [number, number][] = [];
    const tangentJoints: number[] = [];
    const reverseTangentJoints: number[] = [];
    segments.forEach((seg, segIdx) => {
      if (seg.t0Joint === j) {
        connections.push([seg.t1Joint, segIdx]);
        tangentJoints.push(seg.t1Joint);
      } else if (seg.t1Joint === j) {
        connections.push([seg.t0Joint, segIdx]);
        reverseTangentJoints.push(seg.t0Joint);
      }
    });
    joints.push({
      jointNumber: j,
      position: jointPositions[j],
      connections,
      tangent,
      direction: { tangent: tangentJoints, reverseTangent: reverseTangentJoints },
      elevation: jointElevation[j],
    });
  }

  // Keep only joints that have at least one connection (required by loader).
  const usedJointSet = new Set<number>();
  for (const seg of segments) {
    usedJointSet.add(seg.t0Joint);
    usedJointSet.add(seg.t1Joint);
  }
  const oldToNewJoint = new Map<number, number>();
  let newIdx = 0;
  for (let j = 0; j < joints.length; j++) {
    if (usedJointSet.has(j)) {
      oldToNewJoint.set(j, newIdx++);
    }
  }
  const filteredJoints = joints
    .filter((j) => usedJointSet.has(j.jointNumber))
    .map((j) => {
      const newNum = oldToNewJoint.get(j.jointNumber)!;
      return {
        jointNumber: newNum,
        position: j.position,
        connections: j.connections.map(([adj, segNum]) => [oldToNewJoint.get(adj)!, segNum] as [number, number]),
        tangent: j.tangent,
        direction: {
          tangent: j.direction.tangent.map((adj) => oldToNewJoint.get(adj)!),
          reverseTangent: j.direction.reverseTangent.map((adj) => oldToNewJoint.get(adj)!),
        },
        elevation: j.elevation,
      };
    });
  const filteredSegments = segments.map((seg, idx) => ({
    segmentNumber: idx,
    controlPoints: seg.controlPoints,
    t0Joint: oldToNewJoint.get(seg.t0Joint)!,
    t1Joint: oldToNewJoint.get(seg.t1Joint)!,
    elevation: { from: jointElevation[seg.t0Joint], to: jointElevation[seg.t1Joint] },
    gauge: GAUGE,
    splits: [] as number[],
  }));

  const out = { joints: filteredJoints, segments: filteredSegments };
  const json = JSON.stringify(out, null, 2);

  if (outputPath) {
    writeFileSync(resolve(outputPath), json, 'utf-8');
    console.log(`Wrote ${filteredJoints.length} joints, ${filteredSegments.length} segments to ${outputPath}`);
  } else {
    console.log(json);
  }
}

main();
