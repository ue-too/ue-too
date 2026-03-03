/**
 * Shared types for the Three.js track-laying POC.
 * Kept minimal and self-contained.
 */

export interface Point {
  x: number;
  y: number;
}

export interface TrackSegment {
  start: Point;
  end: Point;
}
