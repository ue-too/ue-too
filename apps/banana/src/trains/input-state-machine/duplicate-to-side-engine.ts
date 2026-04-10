import {
    Observable,
    Observer,
    SubscriptionOptions,
    SynchronousObservable,
} from '@ue-too/board';
import { BCurve } from '@ue-too/curve';
import type { Point } from '@ue-too/math';

import { computeDuplicateGeometry } from '../tracks/duplicate-geometry';
import { computeParallelSpacing } from '../tracks/parallel-spacing';
import { TrackGraph } from '../tracks/track';
import {
    ELEVATION,
    TrackSegmentDrawData,
    TrackSegmentWithElevation,
} from '../tracks/types';
import { DuplicateToSideContext } from './duplicate-to-side-state-machine';

type PreviewDrawData = {
    index: number;
    drawData: TrackSegmentDrawData & {
        positiveOffsets: Point[];
        negativeOffsets: Point[];
    };
}[];

/**
 * Highlight payload for the duplicate-to-side tool.
 * `hover` = candidate under the cursor while no source is selected.
 * `selected` = the currently locked-in source while a preview is shown.
 */
export type DuplicateHighlightState = {
    segmentNumber: number;
    kind: 'hover' | 'selected';
} | null;

export class DuplicateToSideEngine implements DuplicateToSideContext {
    private _trackGraph: TrackGraph;
    private _convert2WorldPosition: (position: Point) => Point;

    private _sourceSegmentNumber: number | null = null;
    private _side: 1 | -1 = 1;
    private _cursorWorldPosition: Point = { x: 0, y: 0 };
    private _lastHoverSegmentNumber: number | null = null;

    private _newPreviewGauge: number = 1.067;
    private _newPreviewBedWidth: number | undefined = undefined;

    private _previewDrawDataObservable: Observable<
        [PreviewDrawData | undefined]
    > = new SynchronousObservable<[PreviewDrawData | undefined]>();

    private _highlightObservable: Observable<[DuplicateHighlightState]> =
        new SynchronousObservable<[DuplicateHighlightState]>();

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

    onPreviewDrawDataChange(
        observer: Observer<[PreviewDrawData | undefined]>,
        options?: SubscriptionOptions
    ) {
        this._previewDrawDataObservable.subscribe(observer, options);
    }

    onHighlightChange(
        observer: Observer<[DuplicateHighlightState]>,
        options?: SubscriptionOptions
    ) {
        this._highlightObservable.subscribe(observer, options);
    }

    updateCursor(position: Point): void {
        this._cursorWorldPosition = position;
        // While a source is locked in, the 'selected' highlight stays put —
        // don't overwrite it with hover updates.
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
        this._refreshPreview();
        return true;
    }

    flipSide(): void {
        this._side = this._side === 1 ? -1 : 1;
        this._refreshPreview();
    }

    commitDuplicate(): boolean {
        if (this._sourceSegmentNumber === null) {
            return false;
        }

        const geometry = this._computeGeometry(this._sourceSegmentNumber);
        if (geometry === null) {
            return false;
        }
        const {
            startPosition,
            startTangent,
            endPosition,
            endTangent,
            middleControlPoints,
            startElevation,
            endElevation,
        } = geometry;

        let startJointNumber: number;
        const startSnap = this._trackGraph.pointOnJoint(startPosition);
        if (startSnap !== null) {
            startJointNumber = startSnap.jointNumber;
        } else {
            startJointNumber = this._trackGraph.createNewEmptyJoint(
                startPosition,
                startTangent,
                startElevation
            );
        }

        let endJointNumber: number;
        const endSnap = this._trackGraph.pointOnJoint(endPosition);
        if (endSnap !== null) {
            endJointNumber = endSnap.jointNumber;
        } else {
            endJointNumber = this._trackGraph.createNewEmptyJoint(
                endPosition,
                endTangent,
                endElevation
            );
        }

        const ok = this._trackGraph.connectJoints(
            startJointNumber,
            endJointNumber,
            middleControlPoints,
            this._newPreviewGauge
        );
        if (!ok) {
            console.warn('duplicate commit: connectJoints returned false');
            return false;
        }

        this.cancelPreview();
        return true;
    }

    cancelPreview(): void {
        this._sourceSegmentNumber = null;
        this._lastHoverSegmentNumber = null;
        this._previewDrawDataObservable.notify(undefined);
        this._highlightObservable.notify(null);
    }

    private _refreshPreview(): void {
        if (this._sourceSegmentNumber === null) {
            this._previewDrawDataObservable.notify(undefined);
            return;
        }

        const geometry = this._computeGeometry(this._sourceSegmentNumber);
        if (geometry === null) {
            this._previewDrawDataObservable.notify(undefined);
            return;
        }

        const {
            startPosition,
            endPosition,
            middleControlPoints,
            startElevation,
            endElevation,
        } = geometry;

        const previewCurve = new BCurve([
            startPosition,
            ...middleControlPoints,
            endPosition,
        ]);

        const excludeSet = new Set<number>([this._sourceSegmentNumber]);
        const drawData =
            this._trackGraph.trackCurveManager.getPreviewDrawData(
                previewCurve,
                startElevation,
                endElevation,
                this._newPreviewGauge,
                excludeSet
            );

        this._previewDrawDataObservable.notify(drawData);
    }

    private _computeGeometry(segmentNumber: number): {
        startPosition: Point;
        startTangent: Point;
        endPosition: Point;
        endTangent: Point;
        middleControlPoints: Point[];
        startElevation: ELEVATION;
        endElevation: ELEVATION;
    } | null {
        const segment = this._trackGraph.getTrackSegmentWithJoints(
            segmentNumber
        ) as TrackSegmentWithElevation | null;
        if (segment === null) return null;

        const startJoint = this._trackGraph.getJoint(segment.t0Joint);
        const endJoint = this._trackGraph.getJoint(segment.t1Joint);
        if (startJoint === null || endJoint === null) return null;

        const spacing = computeParallelSpacing(
            { bedWidth: segment.bedWidth, gauge: segment.gauge },
            { bedWidth: this._newPreviewBedWidth, gauge: this._newPreviewGauge }
        );

        const sourceControlPoints = segment.curve.getControlPoints();

        const result = computeDuplicateGeometry({
            sourceControlPoints,
            sourceStartPosition: startJoint.position,
            sourceStartTangent: startJoint.tangent,
            sourceEndPosition: endJoint.position,
            sourceEndTangent: endJoint.tangent,
            side: this._side,
            spacing,
        });

        return {
            ...result,
            startElevation: segment.elevation.from,
            endElevation: segment.elevation.to,
        };
    }
}

function sideFromCursor(
    cursor: Point,
    projection: Point,
    tangent: Point
): 1 | -1 {
    const dx = cursor.x - projection.x;
    const dy = cursor.y - projection.y;
    // Left-hand perpendicular of the tangent is (-t.y, t.x).
    // Dot(cursor - projection, leftPerp) > 0 means cursor is on the +1 side.
    const dot = dx * -tangent.y + dy * tangent.x;
    return dot >= 0 ? 1 : -1;
}
