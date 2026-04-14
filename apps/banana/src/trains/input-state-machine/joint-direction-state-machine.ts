import type {
    BaseContext,
    CreateStateType,
    EventGuards,
    EventReactions,
    Guard,
    StateMachine,
} from '@ue-too/being';
import { NO_OP, TemplateState, TemplateStateMachine } from '@ue-too/being';
import { type Point, PointCal } from '@ue-too/math';

export const JOINT_DIRECTION_STATES = ['IDLE', 'HOVERING', 'SELECTED'] as const;

export type JointDirectionStates = CreateStateType<
    typeof JOINT_DIRECTION_STATES
>;

export type JointDirectionEvents = {
    pointerMove: {
        x: number;
        y: number;
    };
    leftPointerDown: {
        x: number;
        y: number;
    };
    leftPointerUp: {
        x: number;
        y: number;
    };
    escapeKey: {};
    startJointDirection: {};
    endJointDirection: {};
};

export interface JointDirectionContext extends BaseContext {
    convert2WorldPosition(pos: Point): Point;
    getHoveredSwitchJoint(worldPos: Point): number | null;
    showHoverIndicator(jointNumber: number): void;
    clearHoverIndicator(): void;
    selectJoint(jointNumber: number): void;
    deselectJoint(): void;
    cycleDirection(
        jointNumber: number,
        direction: 'tangent' | 'reverseTangent'
    ): void;
    getSelectedJointTangent(): Point | null;
    getSelectedJointPosition(): Point | null;
}

export type JointDirectionStateMachine = StateMachine<
    JointDirectionEvents,
    JointDirectionContext,
    JointDirectionStates
>;

class JointDirectionIdleState extends TemplateState<
    JointDirectionEvents,
    JointDirectionContext,
    JointDirectionStates
> {
    private _hoveringState: JointDirectionHoveringState | null = null;
    private _lastHitJoint: number | null = null;

    setHoveringState(state: JointDirectionHoveringState) {
        this._hoveringState = state;
    }

    protected _guards: Guard<JointDirectionContext, 'foundJoint'> = {
        foundJoint: () => {
            return this._lastHitJoint !== null;
        },
    };

    protected _eventGuards: Partial<
        EventGuards<
            JointDirectionEvents,
            JointDirectionStates,
            JointDirectionContext,
            Guard<JointDirectionContext, 'foundJoint'>
        >
    > = {
        pointerMove: [
            {
                guard: 'foundJoint',
                target: 'HOVERING',
            },
        ],
    };

    protected _eventReactions: EventReactions<
        JointDirectionEvents,
        JointDirectionContext,
        JointDirectionStates
    > = {
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({
                    x: event.x,
                    y: event.y,
                });
                const jointNumber = context.getHoveredSwitchJoint(worldPos);
                this._lastHitJoint = jointNumber;
                if (jointNumber !== null) {
                    context.showHoverIndicator(jointNumber);
                    this._hoveringState?.setHoveredJoint(jointNumber);
                }
            },
            defaultTargetState: 'IDLE',
        },
        endJointDirection: {
            action: context => {
                context.clearHoverIndicator();
                context.deselectJoint();
            },
            defaultTargetState: 'IDLE',
        },
    };
}

class JointDirectionHoveringState extends TemplateState<
    JointDirectionEvents,
    JointDirectionContext,
    JointDirectionStates
> {
    private _hoveredJoint: number | null = null;

    setHoveredJoint(joint: number) {
        this._hoveredJoint = joint;
    }

    getHoveredJoint(): number | null {
        return this._hoveredJoint;
    }

    protected _guards: Guard<JointDirectionContext, 'noJointHovered'> = {
        noJointHovered: () => {
            return this._hoveredJoint === null;
        },
    };

    protected _eventGuards: Partial<
        EventGuards<
            JointDirectionEvents,
            JointDirectionStates,
            JointDirectionContext,
            Guard<JointDirectionContext, 'noJointHovered'>
        >
    > = {
        pointerMove: [
            {
                guard: 'noJointHovered',
                target: 'IDLE',
            },
        ],
    };

    protected _eventReactions: EventReactions<
        JointDirectionEvents,
        JointDirectionContext,
        JointDirectionStates
    > = {
        pointerMove: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({
                    x: event.x,
                    y: event.y,
                });
                const jointNumber = context.getHoveredSwitchJoint(worldPos);
                if (jointNumber !== null) {
                    this._hoveredJoint = jointNumber;
                    context.showHoverIndicator(jointNumber);
                } else {
                    this._hoveredJoint = null;
                    context.clearHoverIndicator();
                }
            },
            defaultTargetState: 'HOVERING',
        },
        leftPointerDown: {
            action: context => {
                if (this._hoveredJoint !== null) {
                    context.clearHoverIndicator();
                    context.selectJoint(this._hoveredJoint);
                }
            },
            defaultTargetState: 'SELECTED',
        },
        escapeKey: {
            action: context => {
                this._hoveredJoint = null;
                context.clearHoverIndicator();
            },
            defaultTargetState: 'IDLE',
        },
        endJointDirection: {
            action: context => {
                this._hoveredJoint = null;
                context.clearHoverIndicator();
            },
            defaultTargetState: 'IDLE',
        },
    };
}

class JointDirectionSelectedState extends TemplateState<
    JointDirectionEvents,
    JointDirectionContext,
    JointDirectionStates
> {
    private _selectedJoint: number | null = null;
    private _hoveringState: JointDirectionHoveringState | null = null;
    private _lastClickResult: 'no-joint' | 'joint' = 'joint';

    setHoveringState(state: JointDirectionHoveringState) {
        this._hoveringState = state;
    }

    protected _guards: Guard<JointDirectionContext, 'clickedNoJoint'> = {
        clickedNoJoint: () => {
            return this._lastClickResult === 'no-joint';
        },
    };

    protected _eventGuards: Partial<
        EventGuards<
            JointDirectionEvents,
            JointDirectionStates,
            JointDirectionContext,
            Guard<JointDirectionContext, 'clickedNoJoint'>
        >
    > = {
        leftPointerDown: [
            {
                guard: 'clickedNoJoint',
                target: 'IDLE',
            },
        ],
    };

    protected _eventReactions: EventReactions<
        JointDirectionEvents,
        JointDirectionContext,
        JointDirectionStates
    > = {
        pointerMove: {
            action: NO_OP,
            defaultTargetState: 'SELECTED',
        },
        leftPointerDown: {
            action: (context, event) => {
                const worldPos = context.convert2WorldPosition({
                    x: event.x,
                    y: event.y,
                });
                const nearJoint = context.getHoveredSwitchJoint(worldPos);

                if (nearJoint === null) {
                    // No joint near click -> deselect -> IDLE
                    context.deselectJoint();
                    this._selectedJoint = null;
                    this._lastClickResult = 'no-joint';
                    return;
                }

                this._lastClickResult = 'joint';

                if (
                    nearJoint === this._selectedJoint &&
                    this._selectedJoint !== null
                ) {
                    // Same joint: determine direction via dot product
                    const jointPos = context.getSelectedJointPosition();
                    const jointTangent = context.getSelectedJointTangent();
                    if (jointPos !== null && jointTangent !== null) {
                        const clickVec = PointCal.subVector(worldPos, jointPos);
                        const dot = PointCal.dotProduct(clickVec, jointTangent);
                        if (dot >= 0) {
                            context.cycleDirection(
                                this._selectedJoint,
                                'tangent'
                            );
                        } else {
                            context.cycleDirection(
                                this._selectedJoint,
                                'reverseTangent'
                            );
                        }
                    }
                    return;
                }

                // Different joint: deselect old, select new
                context.deselectJoint();
                context.selectJoint(nearJoint);
                this._selectedJoint = nearJoint;
            },
            defaultTargetState: 'SELECTED',
        },
        escapeKey: {
            action: context => {
                context.deselectJoint();
                this._selectedJoint = null;
            },
            defaultTargetState: 'IDLE',
        },
        endJointDirection: {
            action: context => {
                context.deselectJoint();
                this._selectedJoint = null;
            },
            defaultTargetState: 'IDLE',
        },
    };

    uponEnter(
        context: JointDirectionContext,
        stateMachine: JointDirectionStateMachine,
        from: JointDirectionStates | 'INITIAL'
    ): void {
        // When entering SELECTED from HOVERING, capture the hovered joint
        if (this._hoveringState) {
            const hovered = this._hoveringState.getHoveredJoint();
            if (hovered !== null) {
                this._selectedJoint = hovered;
            }
        }
    }
}

export function createJointDirectionStateMachine(): JointDirectionStateMachine {
    const hoveringState = new JointDirectionHoveringState();
    const selectedState = new JointDirectionSelectedState();
    const idleState = new JointDirectionIdleState();

    idleState.setHoveringState(hoveringState);
    selectedState.setHoveringState(hoveringState);

    return new TemplateStateMachine<
        JointDirectionEvents,
        JointDirectionContext,
        JointDirectionStates
    >(
        {
            IDLE: idleState,
            HOVERING: hoveringState,
            SELECTED: selectedState,
        },
        'IDLE',
        {
            setup: () => {},
            cleanup: () => {},
        }
    );
}
