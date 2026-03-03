/**
 * Simple track-laying state for the POC.
 * Mirrors banana's layout flow: start point -> end point -> place segment (straight only).
 */

import type { Point, TrackSegment } from './types';

export type LayoutState = 'idle' | 'placing';

export interface TrackStateSnapshot {
  state: LayoutState;
  segments: TrackSegment[];
  startPoint: Point | null;
  cursorPoint: Point | null;
}

type Listener = (snapshot: TrackStateSnapshot) => void;

export function createTrackState() {
  let state: LayoutState = 'idle';
  let segments: TrackSegment[] = [];
  let startPoint: Point | null = null;
  let cursorPoint: Point | null = null;
  const listeners = new Set<Listener>();

  function getSnapshot(): TrackStateSnapshot {
    return { state, segments: [...segments], startPoint, cursorPoint };
  }

  function notify() {
    const s = getSnapshot();
    listeners.forEach((fn) => fn(s));
  }

  return {
    getSnapshot,

    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    startLayout() {
      state = 'placing';
      startPoint = null;
      cursorPoint = null;
      notify();
    },

    endLayout() {
      state = 'idle';
      startPoint = null;
      cursorPoint = null;
      notify();
    },

    setCursor(point: Point | null) {
      cursorPoint = point;
      notify();
    },

    pointerDown(worldPoint: Point): boolean {
      if (state === 'idle') return false;

      if (startPoint === null) {
        startPoint = { ...worldPoint };
        notify();
        return true;
      }

      const segment: TrackSegment = { start: { ...startPoint }, end: { ...worldPoint } };
      segments.push(segment);
      startPoint = { ...worldPoint };
      notify();
      return true;
    },
  };
}

export type TrackState = ReturnType<typeof createTrackState>;
