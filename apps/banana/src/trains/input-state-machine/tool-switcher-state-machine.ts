import {
    BaseContext,
    CreateStateType,
    DefaultOutputMapping,
    Defer,
    EventReactions,
    NO_OP,
    StateMachine,
    TemplateState,
    TemplateStateMachine,
} from '@ue-too/being';

import type { DualSpinePlacementStateMachine } from '@/stations/dual-spine-placement-state-machine';
import type { SingleSpinePlacementStateMachine } from '@/stations/single-spine-placement-state-machine';
import { StationPlacementStateMachine } from '@/stations/station-placement-state-machine';

import { CatenaryLayoutStateMachine } from './catenary-layout-state-machine';
import { DuplicateToSideStateMachine } from './duplicate-to-side-state-machine';
import type { JointDirectionStateMachine } from './joint-direction-state-machine';
import { LayoutStateMachine } from './layout-kmt-state-machine';

import {
    CurveCreationEngine,
    TrainPlacementStateMachine,
    createLayoutStateMachine,
} from '.';

export const TOOL_SWITCHER_STATES = [
    'LAYOUT',
    'TRAIN',
    'STATION',
    'DUPLICATE',
    'CATENARY',
    'SINGLE_SPINE_PLATFORM',
    'DUAL_SPINE_PLATFORM',
    'JOINT_DIRECTION',
    'IDLE',
] as const;

export type ToolSwitcherStates = CreateStateType<typeof TOOL_SWITCHER_STATES>;

export type ToolSwitcherEvents = {
    switchToLayout: {};
    switchToTrain: {};
    switchToStation: {};
    switchToDuplicate: {};
    switchToCatenary: {};
    switchToSingleSpinePlatform: { stationId: number };
    switchToDualSpinePlatform: { stationId: number };
    switchToJointDirection: {};
    switchToIdle: {};
};

export type ToolSwitcherContext = BaseContext & {
    // switchToLayout: () => void;
    // switchToTrain: () => void;
    // switchToIdle: () => void;
};

export type ToolSwitcherEventOutputMapping = {
    switchToLayout: void;
    switchToTrain: void;
    switchToStation: void;
    switchToDuplicate: void;
    switchToCatenary: void;
    switchToSingleSpinePlatform: void;
    switchToDualSpinePlatform: void;
    switchToJointDirection: void;
    switchToIdle: void;
};

export type ToolSwitcherStateMachine = StateMachine<
    ToolSwitcherEvents,
    ToolSwitcherContext,
    ToolSwitcherStates,
    ToolSwitcherEventOutputMapping
>;

class ToolSwitcherIdleState extends TemplateState<
    ToolSwitcherEvents,
    ToolSwitcherContext,
    ToolSwitcherStates,
    ToolSwitcherEventOutputMapping
> {
    private _singleSpineState: ToolSwitcherSingleSpinePlatformState | null =
        null;
    private _dualSpineState: ToolSwitcherDualSpinePlatformState | null = null;

    setSubStates(
        singleSpineState: ToolSwitcherSingleSpinePlatformState,
        dualSpineState: ToolSwitcherDualSpinePlatformState
    ) {
        this._singleSpineState = singleSpineState;
        this._dualSpineState = dualSpineState;
    }

    protected _eventReactions: EventReactions<
        ToolSwitcherEvents,
        ToolSwitcherContext,
        ToolSwitcherStates
    > = {
        switchToLayout: {
            action: NO_OP,
            defaultTargetState: 'LAYOUT',
        },
        switchToTrain: {
            action: NO_OP,
            defaultTargetState: 'TRAIN',
        },
        switchToStation: {
            action: NO_OP,
            defaultTargetState: 'STATION',
        },
        switchToDuplicate: {
            action: NO_OP,
            defaultTargetState: 'DUPLICATE',
        },
        switchToCatenary: {
            action: NO_OP,
            defaultTargetState: 'CATENARY',
        },
        switchToSingleSpinePlatform: {
            action: (_context, event) => {
                this._singleSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'SINGLE_SPINE_PLATFORM',
        },
        switchToDualSpinePlatform: {
            action: (_context, event) => {
                this._dualSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'DUAL_SPINE_PLATFORM',
        },
        switchToJointDirection: {
            action: NO_OP,
            defaultTargetState: 'JOINT_DIRECTION',
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        },
    };
}

class ToolSwitcherLayoutState extends TemplateState<
    ToolSwitcherEvents,
    ToolSwitcherContext,
    ToolSwitcherStates,
    ToolSwitcherEventOutputMapping
> {
    private _layoutSubStateMachine: LayoutStateMachine;
    private _singleSpineState: ToolSwitcherSingleSpinePlatformState | null =
        null;
    private _dualSpineState: ToolSwitcherDualSpinePlatformState | null = null;

    constructor(layoutSubStateMachine: LayoutStateMachine) {
        super();
        this._layoutSubStateMachine = layoutSubStateMachine;
    }

    setSubStates(
        singleSpineState: ToolSwitcherSingleSpinePlatformState,
        dualSpineState: ToolSwitcherDualSpinePlatformState
    ) {
        this._singleSpineState = singleSpineState;
        this._dualSpineState = dualSpineState;
    }

    public uponEnter(
        context: ToolSwitcherContext,
        stateMachine: ToolSwitcherStateMachine,
        fromState: ToolSwitcherStates
    ) {
        this._layoutSubStateMachine.happens('startLayout');
        console.log('uponEnter');
    }

    public beforeExit(
        context: ToolSwitcherContext,
        stateMachine: ToolSwitcherStateMachine,
        toState: ToolSwitcherStates
    ) {
        this._layoutSubStateMachine.happens('endLayout');
    }

    protected _defer: Defer<
        ToolSwitcherContext,
        ToolSwitcherEvents,
        ToolSwitcherStates
    > = {
        action: (context, event, eventKey, stateMachine) => {
            console.log('eventKey', eventKey, 'event', event);
            console.log(
                'current state of the layout sub state machine',
                this._layoutSubStateMachine.currentState
            );
            const result = this._layoutSubStateMachine.happens(eventKey, event);
            if (result.handled) {
                return {
                    handled: true,
                    output: result.output,
                };
            }
            return { handled: false };
        },
    };

    protected _eventReactions: EventReactions<
        ToolSwitcherEvents,
        ToolSwitcherContext,
        ToolSwitcherStates
    > = {
        switchToLayout: {
            action: NO_OP,
            defaultTargetState: 'LAYOUT',
        },
        switchToTrain: {
            action: NO_OP,
            defaultTargetState: 'TRAIN',
        },
        switchToStation: {
            action: NO_OP,
            defaultTargetState: 'STATION',
        },
        switchToDuplicate: {
            action: NO_OP,
            defaultTargetState: 'DUPLICATE',
        },
        switchToCatenary: {
            action: NO_OP,
            defaultTargetState: 'CATENARY',
        },
        switchToSingleSpinePlatform: {
            action: (_context, event) => {
                this._singleSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'SINGLE_SPINE_PLATFORM',
        },
        switchToDualSpinePlatform: {
            action: (_context, event) => {
                this._dualSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'DUAL_SPINE_PLATFORM',
        },
        switchToJointDirection: {
            action: NO_OP,
            defaultTargetState: 'JOINT_DIRECTION',
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        },
    };
}

class ToolSwitcherTrainState extends TemplateState<
    ToolSwitcherEvents,
    ToolSwitcherContext,
    ToolSwitcherStates
> {
    private _trainSubStateMachine: TrainPlacementStateMachine;
    private _singleSpineState: ToolSwitcherSingleSpinePlatformState | null =
        null;
    private _dualSpineState: ToolSwitcherDualSpinePlatformState | null = null;

    constructor(trainSubStateMachine: TrainPlacementStateMachine) {
        super();
        this._trainSubStateMachine = trainSubStateMachine;
    }

    setSubStates(
        singleSpineState: ToolSwitcherSingleSpinePlatformState,
        dualSpineState: ToolSwitcherDualSpinePlatformState
    ) {
        this._singleSpineState = singleSpineState;
        this._dualSpineState = dualSpineState;
    }

    protected _eventReactions: EventReactions<
        ToolSwitcherEvents,
        ToolSwitcherContext,
        ToolSwitcherStates
    > = {
        switchToLayout: {
            action: NO_OP,
            defaultTargetState: 'LAYOUT',
        },
        switchToTrain: {
            action: NO_OP,
            defaultTargetState: 'TRAIN',
        },
        switchToStation: {
            action: NO_OP,
            defaultTargetState: 'STATION',
        },
        switchToDuplicate: {
            action: NO_OP,
            defaultTargetState: 'DUPLICATE',
        },
        switchToCatenary: {
            action: NO_OP,
            defaultTargetState: 'CATENARY',
        },
        switchToSingleSpinePlatform: {
            action: (_context, event) => {
                this._singleSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'SINGLE_SPINE_PLATFORM',
        },
        switchToDualSpinePlatform: {
            action: (_context, event) => {
                this._dualSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'DUAL_SPINE_PLATFORM',
        },
        switchToJointDirection: {
            action: NO_OP,
            defaultTargetState: 'JOINT_DIRECTION',
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        },
    };

    uponEnter(
        context: BaseContext,
        stateMachine: StateMachine<
            ToolSwitcherEvents,
            BaseContext,
            ToolSwitcherStates,
            DefaultOutputMapping<ToolSwitcherEvents>
        >,
        from: ToolSwitcherStates | 'INITIAL'
    ): void {
        this._trainSubStateMachine.happens('startPlacement');
    }

    beforeExit(
        context: ToolSwitcherContext,
        stateMachine: ToolSwitcherStateMachine,
        toState: ToolSwitcherStates
    ) {
        this._trainSubStateMachine.happens('endPlacement');
    }

    protected _defer: Defer<
        ToolSwitcherContext,
        ToolSwitcherEvents,
        ToolSwitcherStates
    > = {
        action: (context, event, eventKey, stateMachine) => {
            console.log('eventKey', eventKey, 'event', event);
            console.log(
                'current state of the train sub state machine',
                this._trainSubStateMachine.currentState
            );
            const result = this._trainSubStateMachine.happens(eventKey, event);
            if (result.handled) {
                return {
                    handled: true,
                    output: result.output,
                };
            }
            return { handled: false };
        },
    };
}

class ToolSwitcherStationState extends TemplateState<
    ToolSwitcherEvents,
    ToolSwitcherContext,
    ToolSwitcherStates
> {
    private _stationSubStateMachine: StationPlacementStateMachine;
    private _singleSpineState: ToolSwitcherSingleSpinePlatformState | null =
        null;
    private _dualSpineState: ToolSwitcherDualSpinePlatformState | null = null;

    constructor(stationSubStateMachine: StationPlacementStateMachine) {
        super();
        this._stationSubStateMachine = stationSubStateMachine;
    }

    setSubStates(
        singleSpineState: ToolSwitcherSingleSpinePlatformState,
        dualSpineState: ToolSwitcherDualSpinePlatformState
    ) {
        this._singleSpineState = singleSpineState;
        this._dualSpineState = dualSpineState;
    }

    protected _eventReactions: EventReactions<
        ToolSwitcherEvents,
        ToolSwitcherContext,
        ToolSwitcherStates
    > = {
        switchToLayout: {
            action: NO_OP,
            defaultTargetState: 'LAYOUT',
        },
        switchToTrain: {
            action: NO_OP,
            defaultTargetState: 'TRAIN',
        },
        switchToStation: {
            action: NO_OP,
            defaultTargetState: 'STATION',
        },
        switchToDuplicate: {
            action: NO_OP,
            defaultTargetState: 'DUPLICATE',
        },
        switchToCatenary: {
            action: NO_OP,
            defaultTargetState: 'CATENARY',
        },
        switchToSingleSpinePlatform: {
            action: (_context, event) => {
                this._singleSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'SINGLE_SPINE_PLATFORM',
        },
        switchToDualSpinePlatform: {
            action: (_context, event) => {
                this._dualSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'DUAL_SPINE_PLATFORM',
        },
        switchToJointDirection: {
            action: NO_OP,
            defaultTargetState: 'JOINT_DIRECTION',
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        },
    };

    uponEnter(
        context: BaseContext,
        stateMachine: StateMachine<
            ToolSwitcherEvents,
            BaseContext,
            ToolSwitcherStates,
            DefaultOutputMapping<ToolSwitcherEvents>
        >,
        from: ToolSwitcherStates | 'INITIAL'
    ): void {
        this._stationSubStateMachine.happens('startPlacement');
    }

    beforeExit(
        context: ToolSwitcherContext,
        stateMachine: ToolSwitcherStateMachine,
        toState: ToolSwitcherStates
    ) {
        this._stationSubStateMachine.happens('endPlacement');
    }

    protected _defer: Defer<
        ToolSwitcherContext,
        ToolSwitcherEvents,
        ToolSwitcherStates
    > = {
        action: (context, event, eventKey, stateMachine) => {
            const result = this._stationSubStateMachine.happens(
                eventKey,
                event
            );
            if (result.handled) {
                return { handled: true, output: result.output };
            }
            return { handled: false };
        },
    };
}

class ToolSwitcherDuplicateState extends TemplateState<
    ToolSwitcherEvents,
    ToolSwitcherContext,
    ToolSwitcherStates
> {
    private _duplicateSubStateMachine: DuplicateToSideStateMachine;
    private _singleSpineState: ToolSwitcherSingleSpinePlatformState | null =
        null;
    private _dualSpineState: ToolSwitcherDualSpinePlatformState | null = null;

    constructor(duplicateSubStateMachine: DuplicateToSideStateMachine) {
        super();
        this._duplicateSubStateMachine = duplicateSubStateMachine;
    }

    setSubStates(
        singleSpineState: ToolSwitcherSingleSpinePlatformState,
        dualSpineState: ToolSwitcherDualSpinePlatformState
    ) {
        this._singleSpineState = singleSpineState;
        this._dualSpineState = dualSpineState;
    }

    protected _eventReactions: EventReactions<
        ToolSwitcherEvents,
        ToolSwitcherContext,
        ToolSwitcherStates
    > = {
        switchToLayout: {
            action: NO_OP,
            defaultTargetState: 'LAYOUT',
        },
        switchToTrain: {
            action: NO_OP,
            defaultTargetState: 'TRAIN',
        },
        switchToStation: {
            action: NO_OP,
            defaultTargetState: 'STATION',
        },
        switchToDuplicate: {
            action: NO_OP,
            defaultTargetState: 'DUPLICATE',
        },
        switchToCatenary: {
            action: NO_OP,
            defaultTargetState: 'CATENARY',
        },
        switchToSingleSpinePlatform: {
            action: (_context, event) => {
                this._singleSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'SINGLE_SPINE_PLATFORM',
        },
        switchToDualSpinePlatform: {
            action: (_context, event) => {
                this._dualSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'DUAL_SPINE_PLATFORM',
        },
        switchToJointDirection: {
            action: NO_OP,
            defaultTargetState: 'JOINT_DIRECTION',
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        },
    };

    uponEnter(
        context: BaseContext,
        stateMachine: StateMachine<
            ToolSwitcherEvents,
            BaseContext,
            ToolSwitcherStates,
            DefaultOutputMapping<ToolSwitcherEvents>
        >,
        from: ToolSwitcherStates | 'INITIAL'
    ): void {
        this._duplicateSubStateMachine.happens('startDuplicate');
    }

    beforeExit(
        context: ToolSwitcherContext,
        stateMachine: ToolSwitcherStateMachine,
        toState: ToolSwitcherStates
    ) {
        this._duplicateSubStateMachine.happens('endDuplicate');
    }

    protected _defer: Defer<
        ToolSwitcherContext,
        ToolSwitcherEvents,
        ToolSwitcherStates
    > = {
        action: (context, event, eventKey, stateMachine) => {
            const result = this._duplicateSubStateMachine.happens(
                eventKey,
                event
            );
            if (result.handled) {
                return { handled: true, output: result.output };
            }
            return { handled: false };
        },
    };
}

class ToolSwitcherCatenaryState extends TemplateState<
    ToolSwitcherEvents,
    ToolSwitcherContext,
    ToolSwitcherStates
> {
    private _catenarySubStateMachine: CatenaryLayoutStateMachine;
    private _singleSpineState: ToolSwitcherSingleSpinePlatformState | null =
        null;
    private _dualSpineState: ToolSwitcherDualSpinePlatformState | null = null;

    constructor(catenarySubStateMachine: CatenaryLayoutStateMachine) {
        super();
        this._catenarySubStateMachine = catenarySubStateMachine;
    }

    setSubStates(
        singleSpineState: ToolSwitcherSingleSpinePlatformState,
        dualSpineState: ToolSwitcherDualSpinePlatformState
    ) {
        this._singleSpineState = singleSpineState;
        this._dualSpineState = dualSpineState;
    }

    protected _eventReactions: EventReactions<
        ToolSwitcherEvents,
        ToolSwitcherContext,
        ToolSwitcherStates
    > = {
        switchToLayout: {
            action: NO_OP,
            defaultTargetState: 'LAYOUT',
        },
        switchToTrain: {
            action: NO_OP,
            defaultTargetState: 'TRAIN',
        },
        switchToStation: {
            action: NO_OP,
            defaultTargetState: 'STATION',
        },
        switchToDuplicate: {
            action: NO_OP,
            defaultTargetState: 'DUPLICATE',
        },
        switchToCatenary: {
            action: NO_OP,
            defaultTargetState: 'CATENARY',
        },
        switchToSingleSpinePlatform: {
            action: (_context, event) => {
                this._singleSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'SINGLE_SPINE_PLATFORM',
        },
        switchToDualSpinePlatform: {
            action: (_context, event) => {
                this._dualSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'DUAL_SPINE_PLATFORM',
        },
        switchToJointDirection: {
            action: NO_OP,
            defaultTargetState: 'JOINT_DIRECTION',
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        },
    };

    uponEnter(
        context: BaseContext,
        stateMachine: StateMachine<
            ToolSwitcherEvents,
            BaseContext,
            ToolSwitcherStates,
            DefaultOutputMapping<ToolSwitcherEvents>
        >,
        from: ToolSwitcherStates | 'INITIAL'
    ): void {
        this._catenarySubStateMachine.happens('startCatenary');
    }

    beforeExit(
        context: ToolSwitcherContext,
        stateMachine: ToolSwitcherStateMachine,
        toState: ToolSwitcherStates
    ) {
        this._catenarySubStateMachine.happens('endCatenary');
    }

    protected _defer: Defer<
        ToolSwitcherContext,
        ToolSwitcherEvents,
        ToolSwitcherStates
    > = {
        action: (context, event, eventKey, stateMachine) => {
            const result = this._catenarySubStateMachine.happens(
                eventKey,
                event
            );
            if (result.handled) {
                return { handled: true, output: result.output };
            }
            return { handled: false };
        },
    };
}

class ToolSwitcherSingleSpinePlatformState extends TemplateState<
    ToolSwitcherEvents,
    ToolSwitcherContext,
    ToolSwitcherStates
> {
    private _subStateMachine: SingleSpinePlacementStateMachine;
    private _stationId: number = 0;
    private _singleSpineState: ToolSwitcherSingleSpinePlatformState | null =
        null;
    private _dualSpineState: ToolSwitcherDualSpinePlatformState | null = null;

    constructor(subStateMachine: SingleSpinePlacementStateMachine) {
        super();
        this._subStateMachine = subStateMachine;
    }

    setStationId(id: number) {
        this._stationId = id;
    }

    setSubStates(
        singleSpineState: ToolSwitcherSingleSpinePlatformState,
        dualSpineState: ToolSwitcherDualSpinePlatformState
    ) {
        this._singleSpineState = singleSpineState;
        this._dualSpineState = dualSpineState;
    }

    protected _eventReactions: EventReactions<
        ToolSwitcherEvents,
        ToolSwitcherContext,
        ToolSwitcherStates
    > = {
        switchToLayout: {
            action: NO_OP,
            defaultTargetState: 'LAYOUT',
        },
        switchToTrain: {
            action: NO_OP,
            defaultTargetState: 'TRAIN',
        },
        switchToStation: {
            action: NO_OP,
            defaultTargetState: 'STATION',
        },
        switchToDuplicate: {
            action: NO_OP,
            defaultTargetState: 'DUPLICATE',
        },
        switchToCatenary: {
            action: NO_OP,
            defaultTargetState: 'CATENARY',
        },
        switchToSingleSpinePlatform: {
            action: (_context, event) => {
                this._singleSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'SINGLE_SPINE_PLATFORM',
        },
        switchToDualSpinePlatform: {
            action: (_context, event) => {
                this._dualSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'DUAL_SPINE_PLATFORM',
        },
        switchToJointDirection: {
            action: NO_OP,
            defaultTargetState: 'JOINT_DIRECTION',
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        },
    };

    uponEnter(
        context: BaseContext,
        stateMachine: StateMachine<
            ToolSwitcherEvents,
            BaseContext,
            ToolSwitcherStates,
            DefaultOutputMapping<ToolSwitcherEvents>
        >,
        from: ToolSwitcherStates | 'INITIAL'
    ): void {
        this._subStateMachine.happens('startPlacement', {
            stationId: this._stationId,
        });
    }

    beforeExit(
        context: ToolSwitcherContext,
        stateMachine: ToolSwitcherStateMachine,
        toState: ToolSwitcherStates
    ) {
        this._subStateMachine.happens('endPlacement');
    }

    protected _defer: Defer<
        ToolSwitcherContext,
        ToolSwitcherEvents,
        ToolSwitcherStates
    > = {
        action: (context, event, eventKey, stateMachine) => {
            const result = this._subStateMachine.happens(eventKey, event);
            if (result.handled) {
                return { handled: true, output: result.output };
            }
            return { handled: false };
        },
    };
}

class ToolSwitcherDualSpinePlatformState extends TemplateState<
    ToolSwitcherEvents,
    ToolSwitcherContext,
    ToolSwitcherStates
> {
    private _subStateMachine: DualSpinePlacementStateMachine;
    private _stationId: number = 0;
    private _singleSpineState: ToolSwitcherSingleSpinePlatformState | null =
        null;
    private _dualSpineState: ToolSwitcherDualSpinePlatformState | null = null;

    constructor(subStateMachine: DualSpinePlacementStateMachine) {
        super();
        this._subStateMachine = subStateMachine;
    }

    setStationId(id: number) {
        this._stationId = id;
    }

    setSubStates(
        singleSpineState: ToolSwitcherSingleSpinePlatformState,
        dualSpineState: ToolSwitcherDualSpinePlatformState
    ) {
        this._singleSpineState = singleSpineState;
        this._dualSpineState = dualSpineState;
    }

    protected _eventReactions: EventReactions<
        ToolSwitcherEvents,
        ToolSwitcherContext,
        ToolSwitcherStates
    > = {
        switchToLayout: {
            action: NO_OP,
            defaultTargetState: 'LAYOUT',
        },
        switchToTrain: {
            action: NO_OP,
            defaultTargetState: 'TRAIN',
        },
        switchToStation: {
            action: NO_OP,
            defaultTargetState: 'STATION',
        },
        switchToDuplicate: {
            action: NO_OP,
            defaultTargetState: 'DUPLICATE',
        },
        switchToCatenary: {
            action: NO_OP,
            defaultTargetState: 'CATENARY',
        },
        switchToSingleSpinePlatform: {
            action: (_context, event) => {
                this._singleSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'SINGLE_SPINE_PLATFORM',
        },
        switchToDualSpinePlatform: {
            action: (_context, event) => {
                this._dualSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'DUAL_SPINE_PLATFORM',
        },
        switchToJointDirection: {
            action: NO_OP,
            defaultTargetState: 'JOINT_DIRECTION',
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        },
    };

    uponEnter(
        context: BaseContext,
        stateMachine: StateMachine<
            ToolSwitcherEvents,
            BaseContext,
            ToolSwitcherStates,
            DefaultOutputMapping<ToolSwitcherEvents>
        >,
        from: ToolSwitcherStates | 'INITIAL'
    ): void {
        this._subStateMachine.happens('startPlacement', {
            stationId: this._stationId,
        });
    }

    beforeExit(
        context: ToolSwitcherContext,
        stateMachine: ToolSwitcherStateMachine,
        toState: ToolSwitcherStates
    ) {
        this._subStateMachine.happens('endPlacement');
    }

    protected _defer: Defer<
        ToolSwitcherContext,
        ToolSwitcherEvents,
        ToolSwitcherStates
    > = {
        action: (context, event, eventKey, stateMachine) => {
            const result = this._subStateMachine.happens(eventKey, event);
            if (result.handled) {
                return { handled: true, output: result.output };
            }
            return { handled: false };
        },
    };
}

class ToolSwitcherJointDirectionState extends TemplateState<
    ToolSwitcherEvents,
    ToolSwitcherContext,
    ToolSwitcherStates
> {
    private _subStateMachine: JointDirectionStateMachine;
    private _singleSpineState: ToolSwitcherSingleSpinePlatformState | null =
        null;
    private _dualSpineState: ToolSwitcherDualSpinePlatformState | null = null;

    constructor(subStateMachine: JointDirectionStateMachine) {
        super();
        this._subStateMachine = subStateMachine;
    }

    setSubStates(
        singleSpineState: ToolSwitcherSingleSpinePlatformState,
        dualSpineState: ToolSwitcherDualSpinePlatformState
    ) {
        this._singleSpineState = singleSpineState;
        this._dualSpineState = dualSpineState;
    }

    protected _eventReactions: EventReactions<
        ToolSwitcherEvents,
        ToolSwitcherContext,
        ToolSwitcherStates
    > = {
        switchToLayout: {
            action: NO_OP,
            defaultTargetState: 'LAYOUT',
        },
        switchToTrain: {
            action: NO_OP,
            defaultTargetState: 'TRAIN',
        },
        switchToStation: {
            action: NO_OP,
            defaultTargetState: 'STATION',
        },
        switchToDuplicate: {
            action: NO_OP,
            defaultTargetState: 'DUPLICATE',
        },
        switchToCatenary: {
            action: NO_OP,
            defaultTargetState: 'CATENARY',
        },
        switchToSingleSpinePlatform: {
            action: (_context, event) => {
                this._singleSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'SINGLE_SPINE_PLATFORM',
        },
        switchToDualSpinePlatform: {
            action: (_context, event) => {
                this._dualSpineState?.setStationId(event.stationId);
            },
            defaultTargetState: 'DUAL_SPINE_PLATFORM',
        },
        switchToJointDirection: {
            action: NO_OP,
            defaultTargetState: 'JOINT_DIRECTION',
        },
        switchToIdle: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        },
    };

    uponEnter(
        context: BaseContext,
        stateMachine: StateMachine<
            ToolSwitcherEvents,
            BaseContext,
            ToolSwitcherStates,
            DefaultOutputMapping<ToolSwitcherEvents>
        >,
        from: ToolSwitcherStates | 'INITIAL'
    ): void {
        this._subStateMachine.happens('startJointDirection');
    }

    beforeExit(
        context: ToolSwitcherContext,
        stateMachine: ToolSwitcherStateMachine,
        toState: ToolSwitcherStates
    ) {
        this._subStateMachine.happens('endJointDirection');
    }

    protected _defer: Defer<
        ToolSwitcherContext,
        ToolSwitcherEvents,
        ToolSwitcherStates
    > = {
        action: (context, event, eventKey, stateMachine) => {
            const result = this._subStateMachine.happens(eventKey, event);
            if (result.handled) {
                return { handled: true, output: result.output };
            }
            return { handled: false };
        },
    };
}

export const createToolSwitcherStateMachine = (
    layoutSubStateMachine: LayoutStateMachine,
    trainSubStateMachine: TrainPlacementStateMachine,
    stationSubStateMachine: StationPlacementStateMachine,
    duplicateSubStateMachine: DuplicateToSideStateMachine,
    catenarySubStateMachine: CatenaryLayoutStateMachine,
    singleSpineSubStateMachine: SingleSpinePlacementStateMachine,
    dualSpineSubStateMachine: DualSpinePlacementStateMachine,
    jointDirectionSubStateMachine: JointDirectionStateMachine
): ToolSwitcherStateMachine => {
    const singleSpineState = new ToolSwitcherSingleSpinePlatformState(
        singleSpineSubStateMachine
    );
    const dualSpineState = new ToolSwitcherDualSpinePlatformState(
        dualSpineSubStateMachine
    );

    const idleState = new ToolSwitcherIdleState();
    const layoutState = new ToolSwitcherLayoutState(layoutSubStateMachine);
    const trainState = new ToolSwitcherTrainState(trainSubStateMachine);
    const stationState = new ToolSwitcherStationState(stationSubStateMachine);
    const duplicateState = new ToolSwitcherDuplicateState(
        duplicateSubStateMachine
    );
    const catenaryState = new ToolSwitcherCatenaryState(
        catenarySubStateMachine
    );
    const jointDirectionState = new ToolSwitcherJointDirectionState(
        jointDirectionSubStateMachine
    );

    idleState.setSubStates(singleSpineState, dualSpineState);
    layoutState.setSubStates(singleSpineState, dualSpineState);
    trainState.setSubStates(singleSpineState, dualSpineState);
    stationState.setSubStates(singleSpineState, dualSpineState);
    duplicateState.setSubStates(singleSpineState, dualSpineState);
    catenaryState.setSubStates(singleSpineState, dualSpineState);
    singleSpineState.setSubStates(singleSpineState, dualSpineState);
    dualSpineState.setSubStates(singleSpineState, dualSpineState);
    jointDirectionState.setSubStates(singleSpineState, dualSpineState);

    return new TemplateStateMachine<
        ToolSwitcherEvents,
        ToolSwitcherContext,
        ToolSwitcherStates
    >(
        {
            IDLE: idleState,
            LAYOUT: layoutState,
            TRAIN: trainState,
            STATION: stationState,
            DUPLICATE: duplicateState,
            CATENARY: catenaryState,
            SINGLE_SPINE_PLATFORM: singleSpineState,
            DUAL_SPINE_PLATFORM: dualSpineState,
            JOINT_DIRECTION: jointDirectionState,
        },
        'IDLE',
        {
            setup: () => {},
            cleanup: () => {},
        }
    );
};
