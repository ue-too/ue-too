import { BaseContext, EventGuards, EventReactions, Guard, NO_OP, StateMachine, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { Point } from "@ue-too/math";


export type BogieEditStates = 'INACTIVE' | 'IDLE' | 'DRAGGING';

export type BogieEditEvents = {
    'startEditing': {};
    'endEditing': {};
    'leftPointerDown': Point;
    'leftPointerUp': Point;
    'leftPointerMove': Point;
    'pointerMove': Point;
}

export type BogieEditContext = BaseContext & {
    setCurrentPosition: (position: Point) => void;
    projectOnBogie: (position: Point) => boolean;
    convert2WorldPosition: (pointInWindow: Point) => Point;
    convert2WindowPosition: (pointInWorld: Point) => Point;
    dropCurrentBogie: () => void;
    getCurrentPosition: () => Point;
}

export type BogieEditStateMachine = StateMachine<BogieEditEvents, BogieEditContext, BogieEditStates>;

class BogieInactiveState extends TemplateState<BogieEditEvents, BogieEditContext, BogieEditStates> {
    protected _eventReactions = {
        startEditing: {
            action: NO_OP,
            defaultTargetState: 'IDLE' as const,
        },
    } as EventReactions<BogieEditEvents, BogieEditContext, BogieEditStates>;
}

class BogieIdleState extends TemplateState<BogieEditEvents, BogieEditContext, BogieEditStates> {

    constructor() {
        super();
    }

    protected _eventReactions = {
        leftPointerDown: {
            action: this.leftPointerDown.bind(this),
        },
        endEditing: {
            action: NO_OP,
            defaultTargetState: 'INACTIVE' as const,
        },
    } as EventReactions<BogieEditEvents, BogieEditContext, BogieEditStates>;


    protected _guards: Guard<BogieEditContext, 'projectOnBogie'> = {
        projectOnBogie: ((context: BogieEditContext) => {
            return context.projectOnBogie(context.getCurrentPosition());
        }).bind(this),
    };

    protected _eventGuards: Partial<
        EventGuards<
            BogieEditEvents,
            BogieEditStates,
            BogieEditContext,
            typeof this._guards
        >
    > = {
            leftPointerDown: [
                {
                    guard: 'projectOnBogie',
                    target: 'DRAGGING',
                },
            ],
        };

    leftPointerDown(context: BogieEditContext, payload: Point): void {
        const worldPos = context.convert2WorldPosition(payload);
        context.setCurrentPosition(worldPos);
    }

}

class BogieDraggingState extends TemplateState<BogieEditEvents, BogieEditContext, BogieEditStates> {
    constructor() {
        super();
    }

    protected _eventReactions = {
        leftPointerMove: {
            action: this.onPointerMove.bind(this),
        },
        pointerMove: {
            action: this.onPointerMove.bind(this),
        },
        leftPointerUp: {
            action: this.leftPointerUp.bind(this),
            defaultTargetState: 'IDLE' as const,
        },
    } as EventReactions<BogieEditEvents, BogieEditContext, BogieEditStates>;

    onPointerMove(context: BogieEditContext, payload: Point): void {
        const worldPos = context.convert2WorldPosition(payload);
        context.setCurrentPosition(worldPos);
    }

    leftPointerUp(context: BogieEditContext, _payload: Point): void {
        context.dropCurrentBogie();
    }

}

export const createBogieEditStateMachine = (context: BogieEditContext): BogieEditStateMachine => {
    return new TemplateStateMachine<BogieEditEvents, BogieEditContext, BogieEditStates>(
        {
            INACTIVE: new BogieInactiveState(),
            IDLE: new BogieIdleState(),
            DRAGGING: new BogieDraggingState(),
        },
        'INACTIVE',
        context
    );
}





