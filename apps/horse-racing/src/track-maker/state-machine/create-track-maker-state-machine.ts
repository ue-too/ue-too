/**
 * Factory function to create and wire the track maker state machine.
 */

import { TemplateStateMachine } from '@ue-too/being';

import type { CurveCollectionModel } from '../curve-collection-model';
import {
    type TrackMakerContext,
    type TrackMakerEvents,
    type TrackMakerStates,
    type TrackMakerStateMachine,
    TrackMakerIdleState,
    TrackMakerObjectModeState,
    TrackMakerEditModeState,
    TrackMakerDraggingPointState,
    TrackMakerDraggingCurveState,
} from './track-maker-state-machine';
import type { Point } from '@ue-too/math';

export function createTrackMakerStateMachine(
    model: CurveCollectionModel,
    convert2WorldPosition: (position: Point) => Point,
    getZoomLevel: () => number,
): TrackMakerStateMachine {
    const context: TrackMakerContext = {
        setup: () => {},
        cleanup: () => {},
        model,
        convert2WorldPosition,
        getZoomLevel,
        grabOrigin: null,
    };

    const states = {
        IDLE: new TrackMakerIdleState(),
        OBJECT_MODE: new TrackMakerObjectModeState(),
        EDIT_MODE: new TrackMakerEditModeState(),
        DRAGGING_POINT: new TrackMakerDraggingPointState(),
        DRAGGING_CURVE: new TrackMakerDraggingCurveState(),
    };

    return new TemplateStateMachine<
        TrackMakerEvents,
        TrackMakerContext,
        TrackMakerStates
    >(states, 'IDLE', context);
}
