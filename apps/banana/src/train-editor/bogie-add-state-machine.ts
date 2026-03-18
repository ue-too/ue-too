import { BaseContext, EventReactions, NO_OP, StateMachine, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { Point } from "@ue-too/math";

export type BogieAddStates = 'INACTIVE' | 'READY';

export type BogieAddEvents = {
    'startAdding': {};
    'endAdding': {};
    'leftPointerDown': Point;
    'leftPointerUp': Point;
    'pointerMove': Point;
}

export type BogieAddContext = BaseContext & {
    addBogie: (position: Point) => number;
    convert2WorldPosition: (pointInWindow: Point) => Point;
}

export type BogieAddStateMachine = StateMachine<BogieAddEvents, BogieAddContext, BogieAddStates>;

class BogieAddInactiveState extends TemplateState<BogieAddEvents, BogieAddContext, BogieAddStates> {
    protected _eventReactions = {
        startAdding: {
            action: NO_OP,
            defaultTargetState: 'READY' as const,
        },
    } as EventReactions<BogieAddEvents, BogieAddContext, BogieAddStates>;
}

class BogieAddReadyState extends TemplateState<BogieAddEvents, BogieAddContext, BogieAddStates> {
    protected _eventReactions = {
        leftPointerDown: {
            action: this.leftPointerDown.bind(this),
        },
        endAdding: {
            action: NO_OP,
            defaultTargetState: 'INACTIVE' as const,
        },
    } as EventReactions<BogieAddEvents, BogieAddContext, BogieAddStates>;

    leftPointerDown(context: BogieAddContext, payload: Point): void {
        const worldPos = context.convert2WorldPosition(payload);
        context.addBogie(worldPos);
    }
}

export const createBogieAddStateMachine = (context: BogieAddContext): BogieAddStateMachine => {
    return new TemplateStateMachine<BogieAddEvents, BogieAddContext, BogieAddStates>(
        {
            INACTIVE: new BogieAddInactiveState(),
            READY: new BogieAddReadyState(),
        },
        'INACTIVE',
        context
    );
}
