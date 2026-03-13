import { BaseContext, EventGuards, EventReactions, Guard, NO_OP, TemplateState, TemplateStateMachine } from "@ue-too/being";
import { Point } from "@ue-too/math";


type BogieStates = 'IDLE' | 'DRAGGING';

type BogieEvents = {
    'leftPointerDown': Point;
    'leftPointerUp': Point;
    'pointerMove': Point;
}

export type BogieContext = BaseContext & {
    setCurrentPosition: (position: Point) => void;
    projectOnBogie: (position: Point) => boolean;
    convert2WorldPosition: (pointInWindow: Point) => Point;
    convert2WindowPosition: (pointInWorld: Point) => Point;
    dropCurrentBogie: () => void;
    getCurrentPosition: () => Point;
}

class BogieIdleState extends TemplateState<BogieEvents, BogieContext, BogieStates> {

    constructor() {
        super();
    }

    protected _eventReactions = {
        leftPointerDown: {
            action: this.leftPointerDown.bind(this),
        },
    } as EventReactions<BogieEvents, BogieContext, BogieStates>;


    protected _guards: Guard<BogieContext, 'projectOnBogie'> = {
        projectOnBogie: ((context: BogieContext) => {
            return context.projectOnBogie(context.getCurrentPosition());
        }).bind(this),
    };

    protected _eventGuards: Partial<
        EventGuards<
            BogieEvents,
            BogieStates,
            BogieContext,
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

    leftPointerDown(context: BogieContext, payload: Point): void {
        context.setCurrentPosition(payload);
    }

}

class BogieDraggingState extends TemplateState<BogieEvents, BogieContext, BogieStates> {
    constructor() {
        super();
    }

    protected _eventReactions = {
        pointerMove: {
            action: this.pointerMove.bind(this),
        },
        leftPointerUp: {
            action: NO_OP,
            defaultTargetState: 'IDLE',
        },
    } as EventReactions<BogieEvents, BogieContext, BogieStates>;

    pointerMove(context: BogieContext, payload: Point): void {
        context.setCurrentPosition(payload);
    }

}

type BogieStateMachine = TemplateStateMachine<BogieEvents, BogieContext, BogieStates>;

export const createBogieStateMachine = (context: BogieContext): BogieStateMachine => {
    return new TemplateStateMachine<BogieEvents, BogieContext, BogieStates>(
        {
            IDLE: new BogieIdleState(),
            DRAGGING: new BogieDraggingState(),
        },
        'IDLE',
        context
    );
}





