import { TemplateStateMachine } from "@ue-too/being";
import { LayoutEvents, LayoutContext, LayoutStateMachine, LayoutStates, LayoutIDLEState, LayoutHoverForStartingPointState, LayoutHoverForEndingPointState, LayoutHoverForCurveDeletionState } from "../layout-kmt-state-machine";
import { CurveCreationEngine } from "../curve-engine";
import { TrainPlacementEngine } from "../train-kmt-state-machine";
import { TrackGraph } from "@/trains/tracks";
import { Canvas, ObservableBoardCamera } from "@ue-too/board";

const createCurveCreationEngine = (canvas: Canvas, camera: ObservableBoardCamera): CurveCreationEngine => {
    const curveEngine = new CurveCreationEngine(canvas, camera);

    return curveEngine;
};

const createLayoutStateMachine = (curveEngine: CurveCreationEngine): LayoutStateMachine => {
    const stateMachine = new TemplateStateMachine<
        LayoutEvents,
        LayoutContext,
        LayoutStates
    >(
        {
            IDLE: new LayoutIDLEState(),
            HOVER_FOR_STARTING_POINT: new LayoutHoverForStartingPointState(),
            HOVER_FOR_ENDING_POINT: new LayoutHoverForEndingPointState(),
            HOVER_FOR_CURVE_DELETION: new LayoutHoverForCurveDeletionState(),
        },
        'IDLE',
        curveEngine
    );
    return stateMachine;
};

const createLayouyStateMachineWithDefaultContext = (canvas: Canvas, camera: ObservableBoardCamera): LayoutStateMachine => {
    const context = createCurveCreationEngine(canvas, camera);
    return createLayoutStateMachine(context);
}

export {
    createCurveCreationEngine,
    createLayoutStateMachine,
    createLayouyStateMachineWithDefaultContext,
};
