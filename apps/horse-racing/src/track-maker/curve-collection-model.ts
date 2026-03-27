/**
 * CurveCollectionModel — manages a collection of BezierCurveModels.
 *
 * Ported from legacy BuilderPageMediator.ts with all rendering methods removed.
 * Emits change events so the render system can react.
 */

import { type Point, PointCal } from '@ue-too/math';

import { BezierCurveModel } from './bezier-curve-model';
import {
    type CurveListEntry,
    type GrabbedPoint,
    HandleType,
    type PointType,
    type Track,
} from './types';

// ---------------------------------------------------------------------------
// Change notification
// ---------------------------------------------------------------------------

type ChangeListener = () => void;

// ---------------------------------------------------------------------------
// Internal item type
// ---------------------------------------------------------------------------

type CurveItem = {
    name: string;
    curve: BezierCurveModel;
    selected: boolean;
};

// ---------------------------------------------------------------------------
// CurveCollectionModel
// ---------------------------------------------------------------------------

export class CurveCollectionModel {
    private curveMap = new Map<string, CurveItem>();
    private curveBeingEdited: { ident: string | null } = { ident: null };
    private selectedCurveLastPos = new Map<string, Point>();
    private grabbedPoint: GrabbedPoint = {
        ident: null,
        pointIndex: -1,
        pointType: null,
        lastPos: null,
    };

    private withArcFit = false;
    private snapEnabled = true;
    private scale = 1;
    private nextId = 0;

    private listeners: ChangeListener[] = [];

    // ------------------------------------------------------------------
    // Observable
    // ------------------------------------------------------------------

    onChange(listener: ChangeListener): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    private emit(): void {
        for (const l of this.listeners) l();
    }

    // ------------------------------------------------------------------
    // Curve CRUD
    // ------------------------------------------------------------------

    addCurve(curve?: BezierCurveModel): string {
        const ident = `curve_${this.nextId++}`;
        this.curveMap.set(ident, {
            name: 'default curve',
            curve: curve ?? new BezierCurveModel(),
            selected: false,
        });
        this.emit();
        return ident;
    }

    deleteCurve(ident: string): void {
        this.curveMap.delete(ident);
        this.emit();
    }

    deleteSelectedCurves(): void {
        for (const ident of this.getSelectedCurveIds()) {
            this.curveMap.delete(ident);
        }
        this.releaseGrabbedPoint();
        this.emit();
    }

    renameCurve(ident: string, name: string): void {
        const item = this.curveMap.get(ident);
        if (item) {
            item.name = name;
            this.emit();
        }
    }

    // ------------------------------------------------------------------
    // Selection
    // ------------------------------------------------------------------

    selectCurve(ident: string): void {
        const item = this.curveMap.get(ident);
        if (item) {
            item.selected = true;
            this.emit();
        }
    }

    deselectCurve(ident: string): void {
        const item = this.curveMap.get(ident);
        if (item) {
            item.selected = false;
            this.emit();
        }
    }

    clearSelected(): void {
        for (const item of this.curveMap.values()) {
            item.selected = false;
        }
        this.emit();
    }

    getSelectedCurveIds(): string[] {
        const ids: string[] = [];
        for (const [ident, item] of this.curveMap) {
            if (item.selected) ids.push(ident);
        }
        return ids;
    }

    getSelectedCurveCount(): number {
        let count = 0;
        for (const item of this.curveMap.values()) {
            if (item.selected) count++;
        }
        return count;
    }

    curveIsSelected(ident: string): boolean {
        return this.curveMap.get(ident)?.selected ?? false;
    }

    // ------------------------------------------------------------------
    // Editing mode
    // ------------------------------------------------------------------

    hasCurveBeingEdited(): boolean {
        return this.curveBeingEdited.ident != null;
    }

    clearEditingStatus(): void {
        this.curveBeingEdited.ident = null;
        this.emit();
    }

    clickedOnCurveCard(shiftPressed: boolean, ident: string): void {
        if (this.hasCurveBeingEdited()) return;
        if (shiftPressed) {
            if (this.curveIsSelected(ident)) this.deselectCurve(ident);
            else this.selectCurve(ident);
        } else {
            if (this.getSelectedCurveCount() === 1 && this.curveIsSelected(ident)) {
                this.deselectCurve(ident);
            } else {
                this.clearSelected();
                this.selectCurve(ident);
            }
        }
    }

    doubleClickedOnCurveCard(ident: string): void {
        if (!this.curveMap.has(ident)) return;
        this.curveBeingEdited.ident = ident;
        this.clearSelected();
    }

    // ------------------------------------------------------------------
    // Grabbed point
    // ------------------------------------------------------------------

    hasGrabbedPoint(): boolean {
        return this.grabbedPoint.ident != null;
    }

    getGrabbedPoint(): Readonly<GrabbedPoint> {
        return this.grabbedPoint;
    }

    releaseGrabbedPoint(): void {
        this.grabbedPoint = { ident: null, pointIndex: -1, pointType: null, lastPos: null };
    }

    handleClick(cursorPosition: Point, zoomLevel: number = 1): void {
        let clickedOnPoint = false;
        for (const ident of this.getSelectedCurveIds()) {
            const item = this.curveMap.get(ident)!;
            const result = item.curve.clickedOnPoint(cursorPosition, zoomLevel);
            if (result.hit) {
                const cp = item.curve.controlPoints[result.pointIndex];
                let lastPos: Point;
                if (result.pointType === 'cp') lastPos = cp.coord;
                else if (result.pointType === 'lh') lastPos = cp.left_handle.coord;
                else lastPos = cp.right_handle.coord;
                this.grabbedPoint = {
                    ident,
                    pointIndex: result.pointIndex,
                    pointType: result.pointType,
                    lastPos,
                };
                clickedOnPoint = true;
                break;
            }
        }
        if (!clickedOnPoint) this.releaseGrabbedPoint();
    }

    handleGrab(
        isEditMode: boolean,
        shiftPressed: boolean,
        cursorPositionDiff: Point,
        zoomLevel: number = 1,
    ): void {
        if (isEditMode) {
            if (this.grabbedPoint.ident == null) return;
            const item = this.curveMap.get(this.grabbedPoint.ident);
            if (!item) return;

            const localDiff = PointCal.transform2NewAxis(cursorPositionDiff, item.curve.orientationAngle);
            let destPos = PointCal.addVector(this.grabbedPoint.lastPos!, localDiff);

            // Shift-constrain to axis of previous segment
            if (shiftPressed && this.grabbedPoint.pointIndex > 1 && this.grabbedPoint.pointType === 'cp') {
                const prev = item.curve.controlPoints[this.grabbedPoint.pointIndex - 1];
                const prevPrev = item.curve.controlPoints[this.grabbedPoint.pointIndex - 2];
                const axis = PointCal.unitVectorFromA2B(prev.coord, prevPrev.coord);
                destPos = PointCal.addVector(
                    prev.coord,
                    PointCal.multiplyVectorByScalar(axis, PointCal.dotProduct(localDiff, axis)),
                );
            }

            item.curve.moveControlPoint(destPos, this.grabbedPoint.pointIndex, this.grabbedPoint.pointType!);

            // Snap to nearby points on selected curves
            if (this.snapEnabled) {
                let snapCoord: Point | null = null;
                for (const [sid, sItem] of this.curveMap) {
                    if (!sItem.selected) continue;
                    const transformedDest = this.curveMap.get(this.grabbedPoint.ident)!.curve.transformPoint(destPos);
                    const res = sItem.curve.clickedOnPoint(transformedDest, zoomLevel);
                    if (res.hit) {
                        if (sid === this.grabbedPoint.ident &&
                            res.pointIndex === this.grabbedPoint.pointIndex &&
                            res.pointType === this.grabbedPoint.pointType) continue;
                        snapCoord = PointCal.subVector(
                            res.pointPos!,
                            this.curveMap.get(this.grabbedPoint.ident)!.curve.anchorPoint,
                        );
                        break;
                    }
                }
                if (snapCoord) {
                    item.curve.moveControlPoint(snapCoord, this.grabbedPoint.pointIndex, this.grabbedPoint.pointType!);
                }
            }
        } else {
            // Object mode — move entire selected curves
            for (const ident of this.getSelectedCurveIds()) {
                const item = this.curveMap.get(ident)!;
                const lastPos = this.selectedCurveLastPos.get(ident);
                if (lastPos) {
                    item.curve.moveAnchorPoint(PointCal.addVector(lastPos, cursorPositionDiff));
                }
            }
        }
        this.emit();
    }

    // ------------------------------------------------------------------
    // Undo support
    // ------------------------------------------------------------------

    holdSelectedCurvePositions(): void {
        this.selectedCurveLastPos.clear();
        for (const [ident, item] of this.curveMap) {
            if (item.selected) {
                this.selectedCurveLastPos.set(ident, { ...item.curve.anchorPoint });
            }
        }
    }

    holdGrabbedPointPosition(): void {
        if (!this.hasGrabbedPoint()) return;
        const item = this.curveMap.get(this.grabbedPoint.ident!);
        if (!item) return;
        const cp = item.curve.controlPoints[this.grabbedPoint.pointIndex];
        if (this.grabbedPoint.pointType === 'lh') this.grabbedPoint.lastPos = { ...cp.left_handle.coord };
        else if (this.grabbedPoint.pointType === 'rh') this.grabbedPoint.lastPos = { ...cp.right_handle.coord };
        else this.grabbedPoint.lastPos = { ...cp.coord };
    }

    revertPointToPrevPos(): void {
        if (this.grabbedPoint.ident == null) return;
        const item = this.curveMap.get(this.grabbedPoint.ident);
        if (!item || this.grabbedPoint.pointIndex >= item.curve.controlPoints.length) return;
        item.curve.moveControlPoint(this.grabbedPoint.lastPos!, this.grabbedPoint.pointIndex, this.grabbedPoint.pointType!);
        this.emit();
    }

    revertCurveToPrevPos(): void {
        for (const [ident, lastPos] of this.selectedCurveLastPos) {
            const item = this.curveMap.get(ident);
            if (item) item.curve.anchorPoint = lastPos;
        }
        this.selectedCurveLastPos.clear();
        this.emit();
    }

    // ------------------------------------------------------------------
    // Handle type / slope
    // ------------------------------------------------------------------

    changeGrabbedHandleType(type: HandleType): void {
        if (!this.hasGrabbedPoint() || this.grabbedPoint.pointType === 'cp') return;
        const item = this.curveMap.get(this.grabbedPoint.ident!);
        if (!item) return;
        item.curve.changeHandleType(
            this.grabbedPoint.pointIndex,
            this.grabbedPoint.pointType as 'lh' | 'rh',
            type,
        );
        this.emit();
    }

    setGrabbedPointSlope(slope: number | null): void {
        if (!this.hasGrabbedPoint() || this.grabbedPoint.pointType !== 'cp') return;
        const item = this.curveMap.get(this.grabbedPoint.ident!);
        if (!item) return;
        item.curve.controlPoints[this.grabbedPoint.pointIndex].slope = slope;
        this.emit();
    }

    // ------------------------------------------------------------------
    // Extend / delete points
    // ------------------------------------------------------------------

    extendSelectedCurves(prepend = false): void {
        for (const item of this.curveMap.values()) {
            if (item.selected) item.curve.extendControlPoint(prepend);
        }
        this.emit();
    }

    deleteGrabbedPoint(): boolean {
        if (!this.hasGrabbedPoint() || this.grabbedPoint.pointType !== 'cp') return false;
        const item = this.curveMap.get(this.grabbedPoint.ident!);
        if (!item) return false;
        if (item.curve.deleteSelectedControlPoint(this.grabbedPoint.pointIndex)) {
            this.releaseGrabbedPoint();
            this.emit();
            return true;
        }
        return false;
    }

    // ------------------------------------------------------------------
    // Scale
    // ------------------------------------------------------------------

    calculateScale(): boolean {
        for (const item of this.curveMap.values()) {
            if (item.name === 'SCALE') {
                this.scale = 100 / item.curve.getLength();
                for (const c of this.curveMap.values()) c.curve.setScale(this.scale);
                return true;
            }
        }
        return false;
    }

    getScale(): number {
        return this.scale;
    }

    // ------------------------------------------------------------------
    // Feature toggles
    // ------------------------------------------------------------------

    get arcFitEnabled(): boolean {
        return this.withArcFit;
    }

    get isSnapEnabled(): boolean {
        return this.snapEnabled;
    }

    toggleArcFit(): void {
        this.withArcFit = !this.withArcFit;
        this.emit();
    }

    toggleSnap(): void {
        this.snapEnabled = !this.snapEnabled;
        this.emit();
    }

    // ------------------------------------------------------------------
    // Accessors for rendering
    // ------------------------------------------------------------------

    getCurveList(): CurveListEntry[] {
        const result: CurveListEntry[] = [];
        for (const [ident, item] of this.curveMap) {
            result.push({
                ident,
                name: item.name,
                selected: item.selected,
                beingEdited: this.curveBeingEdited.ident === ident,
            });
        }
        return result;
    }

    getCurve(ident: string): BezierCurveModel | undefined {
        return this.curveMap.get(ident)?.curve;
    }

    getCurveItem(ident: string): CurveItem | undefined {
        return this.curveMap.get(ident);
    }

    getAllCurves(): Map<string, CurveItem> {
        return this.curveMap;
    }

    getGrabbedPointPos(): Point | null {
        if (!this.hasGrabbedPoint()) return null;
        const item = this.curveMap.get(this.grabbedPoint.ident!);
        if (!item) return null;
        const cp = item.curve.controlPoints[this.grabbedPoint.pointIndex];
        if (this.grabbedPoint.pointType === 'cp') return cp.transformedCoord;
        if (this.grabbedPoint.pointType === 'lh') return cp.left_handle.transformedCoord;
        if (this.grabbedPoint.pointType === 'rh') return cp.right_handle.transformedCoord;
        return null;
    }

    // ------------------------------------------------------------------
    // Export
    // ------------------------------------------------------------------

    exportTrack(origin: Point): Track[] | null {
        const output: Track[] = [];
        for (const item of this.curveMap.values()) {
            if (item.name === 'SCALE') continue;
            const tracks = item.curve.exportCurve(origin);
            if (tracks == null) return null;
            output.push(...tracks);
        }
        return output;
    }
}
