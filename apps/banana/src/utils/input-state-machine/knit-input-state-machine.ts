import { BaseContext, CompositeState, CreateStateType, DefaultOutputMapping, Defer, EventReactions, StateMachine, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { createKmtInputStateMachine, KmtInputStates, KmtInputEventOutputMapping, KmtInputContext, KmtInputEventMapping, KmtInputStateMachine } from "@ue-too/board";
import { createKmtInputStateMachineExpansion, KmtExpandedStateMachine } from "./kmt-input-state-machine-expansion";

const KNIT_INPUT_STATES = ['IDLE', 'MOVING'] as const;

type KnitInputStates = CreateStateType<typeof KNIT_INPUT_STATES>;

type KnitInputEventMapping = {
    move: {};
    switchToKnit: {};
};


class KnitMoveState extends TemplateState<KnitInputEventMapping, BaseContext, KnitInputStates> {

    private _cMachine: KmtInputStateMachine;

    constructor(childContext: KmtInputContext) {
        super();
        this._cMachine = createKmtInputStateMachine(childContext);
    }

    uponEnter(context: BaseContext, stateMachine: StateMachine<KnitInputEventMapping, BaseContext, KnitInputStates, DefaultOutputMapping<KnitInputEventMapping>>, from: KnitInputStates | "INITIAL"): void {
        this._cMachine.reset();
    }

    beforeExit(context: BaseContext, stateMachine: StateMachine<KnitInputEventMapping, BaseContext, KnitInputStates, DefaultOutputMapping<KnitInputEventMapping>>, to: KnitInputStates | "TERMINAL"): void {
        this._cMachine.wrapup();
    }

    protected _defer: Defer<BaseContext, KnitInputEventMapping, KnitInputStates> = {
        action: (context, event, eventKey, stateMachine) => {
            const res = this._cMachine.happens(eventKey, event);
            if (res.handled) {
                return { handled: true, output: res.output };
            }
            return { handled: false };
        },
    };

    protected _eventReactions: EventReactions<KnitInputEventMapping, BaseContext, KnitInputStates> = {
        switchToKnit: {
            action: (context, event, stateMachine) => {
                return { handled: true };
            },
            defaultTargetState: 'IDLE',
        },
    };
}

class KnitIdleState extends TemplateState<KnitInputEventMapping, BaseContext, KnitInputStates> {

    protected _eventReactions: EventReactions<KnitInputEventMapping, BaseContext, KnitInputStates> = {
        move: {
            action: (context, event, stateMachine) => {
                return { handled: true };
            },
            defaultTargetState: 'MOVING',
        },
    };
}

export const createKnitInputStateMachine = (moveMachineContext: KmtInputContext) => {
    const states = {
        IDLE: new KnitIdleState(),
        MOVING: new KnitMoveState(moveMachineContext),
    };
    return new TemplateStateMachine<KnitInputEventMapping, BaseContext, KnitInputStates>(states, 'MOVING', moveMachineContext);
};
