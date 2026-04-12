import {
    Observable,
    Observer,
    SubscriptionOptions,
    SynchronousObservable,
} from '@ue-too/board';
import type { Point } from '@ue-too/math';

import { TrackGraph } from '../tracks/track';
import { CatenaryLayoutContext } from './catenary-layout-state-machine';

/**
 * Highlight payload for the catenary layout tool.
 * `hover` = candidate under the cursor while no source is selected.
 * `selected` = the currently locked-in source while a preview is shown.
 */
export type CatenaryHighlightState = {
    segmentNumber: number;
    kind: 'hover' | 'selected';
} | null;

/**
 * Preview payload emitted while the user is choosing a side.
 */
export type CatenaryPreviewState = {
    segmentNumber: number;
    side: 1 | -1;
} | null;

export class CatenaryLayoutEngine implements CatenaryLayoutContext {
    private _trackGraph: TrackGraph;
    private _convert2WorldPosition: (position: Point) => Point;

    private _sourceSegmentNumber: number | null = null;
    private _side: 1 | -1 = 1;
    private _lastHoverSegmentNumber: number | null = null;

    private _previewObservable: Observable<[CatenaryPreviewState]> =
        new SynchronousObservable<[CatenaryPreviewState]>();

    private _highlightObservable: Observable<[CatenaryHighlightState]> =
        new SynchronousObservable<[CatenaryHighlightState]>();

    constructor(
        trackGraph: TrackGraph,
        convert2WorldPosition: (position: Point) => Point
    ) {
        this._trackGraph = trackGraph;
        this._convert2WorldPosition = convert2WorldPosition;
    }

    setup(): void {}

    cleanup(): void {}

    get hasPreview(): boolean {
        return this._sourceSegmentNumber !== null;
    }

    convert2WorldPosition(position: Point): Point {
        return this._convert2WorldPosition(position);
    }

    onPreviewChange(
        observer: Observer<[CatenaryPreviewState]>,
        options?: SubscriptionOptions
    ) {
        this._previewObservable.subscribe(observer, options);
    }

    onHighlightChange(
        observer: Observer<[CatenaryHighlightState]>,
        options?: SubscriptionOptions
    ) {
        this._highlightObservable.subscribe(observer, options);
    }

    updateCursor(position: Point): void {
        if (this._sourceSegmentNumber !== null) {
            return;
        }

        const res = this._trackGraph.project(position);
        let hoverSegment: number | null = null;
        if (res.hit) {
            if (res.hitType === 'curve' || res.hitType === 'edge') {
                hoverSegment = res.curve;
            } else if (res.hitType === 'joint') {
                const joint = this._trackGraph.getJoint(res.jointNumber);
                const first = joint?.connections.values().next().value;
                if (first !== undefined) {
                    hoverSegment = first;
                }
            }
        }

        if (hoverSegment === this._lastHoverSegmentNumber) {
            return;
        }
        this._lastHoverSegmentNumber = hoverSegment;
        this._highlightObservable.notify(
            hoverSegment === null
                ? null
                : { segmentNumber: hoverSegment, kind: 'hover' }
        );
    }

    selectSource(position: Point): boolean {
        const res = this._trackGraph.project(position);
        if (!res.hit) {
            return false;
        }

        let segmentNumber: number | null = null;
        let projectionPoint: Point | null = null;
        let tangentAtProjection: Point | null = null;

        if (res.hitType === 'curve' || res.hitType === 'edge') {
            segmentNumber = res.curve;
            projectionPoint = res.projectionPoint;
            tangentAtProjection = res.tangent;
        } else if (res.hitType === 'joint') {
            const joint = this._trackGraph.getJoint(res.jointNumber);
            if (joint === null) return false;
            const firstConnectedSegment = joint.connections
                .values()
                .next().value;
            if (firstConnectedSegment === undefined) return false;
            segmentNumber = firstConnectedSegment;
            projectionPoint = res.projectionPoint;
            tangentAtProjection = res.tangent;
        }

        if (
            segmentNumber === null ||
            projectionPoint === null ||
            tangentAtProjection === null
        ) {
            return false;
        }

        this._sourceSegmentNumber = segmentNumber;
        this._side = sideFromCursor(
            position,
            projectionPoint,
            tangentAtProjection
        );
        this._lastHoverSegmentNumber = null;
        this._highlightObservable.notify({
            segmentNumber,
            kind: 'selected',
        });
        this._emitPreview();
        return true;
    }

    flipSide(): void {
        this._side = this._side === 1 ? -1 : 1;
        this._emitPreview();
    }

    commitCatenary(): boolean {
        if (this._sourceSegmentNumber === null) {
            return false;
        }

        const segmentNumber = this._sourceSegmentNumber;
        const side = this._side;

        this.cancelPreview();

        this._commitObservable.notify({ segmentNumber, side });
        return true;
    }

    cancelPreview(): void {
        this._sourceSegmentNumber = null;
        this._lastHoverSegmentNumber = null;
        this._previewObservable.notify(null);
        this._highlightObservable.notify(null);
    }

    // --- Commit observable (render system subscribes to this) ---

    private _commitObservable: Observable<
        [{ segmentNumber: number; side: 1 | -1 }]
    > = new SynchronousObservable<[{ segmentNumber: number; side: 1 | -1 }]>();

    onCommit(
        observer: Observer<[{ segmentNumber: number; side: 1 | -1 }]>,
        options?: SubscriptionOptions
    ) {
        this._commitObservable.subscribe(observer, options);
    }

    private _emitPreview(): void {
        if (this._sourceSegmentNumber === null) {
            this._previewObservable.notify(null);
            return;
        }
        this._previewObservable.notify({
            segmentNumber: this._sourceSegmentNumber,
            side: this._side,
        });
    }
}

function sideFromCursor(
    cursor: Point,
    projection: Point,
    tangent: Point
): 1 | -1 {
    const dx = cursor.x - projection.x;
    const dy = cursor.y - projection.y;
    const dot = dx * -tangent.y + dy * tangent.x;
    return dot >= 0 ? 1 : -1;
}
