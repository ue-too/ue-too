import { TemplateStateMachine } from "@ue-too/being";
import { CurveCreationEngine, LayoutEvents, LayoutContext, LayoutStateMachine, LayoutStates, LayoutIDLEState, LayoutHoverForStartingPointState, LayoutHoverForEndingPointState, LayoutHoverForCurveDeletionState } from "../kmt-state-machine";
import { TrainPlacementEngine } from "../train-kmt-state-machine";
import { TrackGraph } from "@/trains/tracks";

const createCurveCreationEngine = (): CurveCreationEngine => {
    const curveEngine = new CurveCreationEngine();

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

const createLayouyStateMachineWithDefaultContext = (): LayoutStateMachine => {
    const context = createCurveCreationEngine();
    return createLayoutStateMachine(context);
}

const createTrainPlacementEngine = (trackGraph: TrackGraph): TrainPlacementEngine => {
    return new TrainPlacementEngine(trackGraph);
};

export {
    createCurveCreationEngine,
    createLayoutStateMachine,
    createLayouyStateMachineWithDefaultContext,
    createTrainPlacementEngine,
};
