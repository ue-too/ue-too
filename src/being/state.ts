import { Point } from "src/index";

/**
 * this is the type for the event action
 * the structure is a mapping from the event to the state transition
 * it would look like this:
 * {
 *  leftPointerUp: (context, event) => 'READY_TO_PAN',
 * }
 * 
 * this is for a single state; how it reacts to the event
 */
export type EventAction<EventPayloadMapping, Context, States> = {
    [K in keyof EventPayloadMapping]: (context: Context, event: EventPayloadMapping[K]) => keyof States;
};

/**
 * this is the type for the state event action
 * the structure is a mapping from the state to the event action
 * it would look like this:
 * {
 *  normal: {
 *      leftPointerUp: (context, event) => 'READY_TO_PAN',
 *  },
 * }
 * 
 * this is for all states; how they react to each event
 */
export type StateEventAction<EventPayloadMapping, Context, StateKeys extends string = 'normal' | 'hover'> = {
    [K in StateKeys]-?: Partial<EventAction<EventPayloadMapping, Context, StateEventAction<EventPayloadMapping, Context, StateKeys>>>;
}

export type StateReactions<EventPayloadMapping, Context, StateKeys extends string = 'normal' | 'hover'> = Partial<EventAction<EventPayloadMapping, Context, StateEventAction<EventPayloadMapping, Context, StateKeys>>>;

export type StateEventActionAcceptingStateReactionInterface<EventPayloadMapping, Context, StateKeys extends string = 'normal' | 'hover'> = {
    [K in StateKeys]-?: StateReaction<EventPayloadMapping, Context, StateKeys>;
} 

export interface StateReaction<EventPayloadMapping, Context, StateKeys extends string = 'normal' | 'hover'> {
    happens<K extends keyof EventPayloadMapping>(context: Context, event: K, payload: EventPayloadMapping[K]): keyof StateEventAction<EventPayloadMapping, Context, StateKeys>;
}

class Test implements StateReaction<UserInputEventPayloadMapping, StateContext, UserInputStates> {
    happens<K extends keyof UserInputEventPayloadMapping>(context: StateContext, event: K, payload: UserInputEventPayloadMapping[K]): UserInputStates {
        return "IDLE";
    }
}

export type LeftPointerUpEventPayload = {
    position: Point;
}

export type LeftPointerDownEventPayload = {
    position: Point;
}

export type MiddlePointerDownEventPayload = {
    position: Point;
}

export type ScrollEventPayload = {
    deltaX: number;
    deltaY: number;
}

export type SpacebarDownEventPayload = {
}

export type SpacebarUpEventPayload = {
}

export type PointerMoveEventPayload = {
    position: Point;
}

export interface StateContext {
}

export type UserInputEventPayloadMapping = {
    leftPointerUp: LeftPointerUpEventPayload;
    leftPointerDown: LeftPointerDownEventPayload;
    middlePointerDown: MiddlePointerDownEventPayload;
    spacebarDown: SpacebarDownEventPayload;
    spacebarUp: SpacebarUpEventPayload;
    pointerMove: PointerMoveEventPayload;
    scrollWithCtrl: ScrollEventPayload;
    scroll: ScrollEventPayload;
}

export type UserInputStates = 'IDLE' | 'READY_TO_PAN' | 'READY_TO_SELECTION' | 'SELECTION' | 'INITIAL_PAN' | 'PAN' | 'CALCULATING_POINTER_POSITION';

export type UserInputStateEventAction = StateEventAction<UserInputEventPayloadMapping, StateContext, UserInputStates>;

export const userInputStateEventAction: UserInputStateEventAction = {
    IDLE: {
        leftPointerDown: (context, event) => "READY_TO_SELECTION",
        spacebarDown: (context, event) => "READY_TO_PAN",
        middlePointerDown: (context, event) => "INITIAL_PAN",
        scrollWithCtrl: (context, event) => { console.log("scrollWithCtrl", event); return "IDLE"},
        scroll: (context, event) => { console.log("scroll", event); return "IDLE"},
    },
    READY_TO_PAN: {
        leftPointerDown: (context, event) => "INITIAL_PAN",
        spacebarUp: (context, event) => "IDLE",
    },
    READY_TO_SELECTION: {
        leftPointerUp: (context, event) => "IDLE",
        pointerMove: (context, event) => "SELECTION",
    },
    SELECTION: {
        leftPointerUp: (context, event) => "IDLE",
        pointerMove: (context, event) => "SELECTION",
    },
    INITIAL_PAN: {
        pointerMove: (context, event) => "PAN",
        spacebarUp: (context, event) => "IDLE",
    },
    PAN: {
        pointerMove: (context, event) => "PAN",
        leftPointerUp: (context, event) => "READY_TO_PAN",
        spacebarUp: (context, event) => "IDLE",
    },
    CALCULATING_POINTER_POSITION: {
        pointerMove: (context, event) => "PAN",
    }
}


export type MouseEventPayload = {
    x: number;
    y: number;
}

export type SpacebarEventPayload = {
    pressed: boolean;
}

export type InputEventPayloadMapping = {
    mouse: MouseEventPayload;
    spacebar: SpacebarEventPayload;
}

export type InputContext = {
    currentX: number;
    currentY: number;
    pressed: boolean;
}


export type InputEventAction = EventAction<InputEventPayloadMapping, InputContext, StateEventAction<InputEventPayloadMapping, InputContext>>;

export type InputStateEventAction = StateEventAction<InputEventPayloadMapping, InputContext>;

const inputStateEventAction: InputStateEventAction = {
    normal: {
        mouse: (context, event) => {
            context.currentX = event.x;
            context.currentY = event.y;
            return "normal";
        },
    },
    hover: {
        mouse: () => "hover",
        spacebar: () => "normal",
    },
}

const inputStateEventActionNoOp: InputStateEventAction = {
    normal: {},
    hover: {},
}

interface StateMachine<States, Events> {
    switchTo(state: keyof States): void;
    happens<K extends keyof Events>(event: K, payload: Events[K]): void;
}

export class GenericStateMachine<Events, Context, StateKeys extends string> implements StateMachine<StateEventAction<Events, Context, StateKeys>, Events> {
    private _currentState: keyof StateEventAction<Events, Context, StateKeys>;
    private context: Context;
    private eventAction: StateEventAction<Events, Context, StateKeys>;

    constructor(eventAction: StateEventAction<Events, Context, StateKeys>) {
        this._currentState = Object.keys(eventAction)[0] as keyof StateEventAction<Events, Context, StateKeys>;
        this.eventAction = eventAction;
    }

    get currentState(): keyof StateEventAction<Events, Context, StateKeys> {
        return this._currentState;
    }

    switchTo(state: keyof StateEventAction<Events, Context, StateKeys>): void {
        if(this._currentState === state){
            return;
        }
        console.log("--------------------------------");
        console.log("switching from", this._currentState, "to", state);
        this._currentState = state;
        console.log("after switching, current state of the state machine", this._currentState);
        console.log("--------------------------------");
    }

    happens<K extends keyof Events>(event: K, payload: Events[K]): void {
        const action = this.eventAction[this._currentState][event];
        if (action) {
            this.switchTo(action(this.context, payload));
        }
    }
}

export const userInputStateMachine = new GenericStateMachine<UserInputEventPayloadMapping, StateContext, UserInputStates>(userInputStateEventAction);

const inputStateMachine = new GenericStateMachine<InputEventPayloadMapping, InputContext, 'normal' | 'hover'>(inputStateEventAction);

class InputStateMachine implements StateMachine<InputStateEventAction, InputEventPayloadMapping> {

    private currentState: keyof InputStateEventAction;
    private context: InputContext;
    private eventAction: InputStateEventAction;

    constructor(eventAction: InputStateEventAction) {
        this.currentState = "normal";
        this.eventAction = eventAction;
        this.context = {
            currentX: 0,
            currentY: 0,
            pressed: false,
        };
    }

    happens<K extends keyof InputEventPayloadMapping>(event: K, payload: InputEventPayloadMapping[K]): void {
        const action = this.eventAction[this.currentState][event];
        if (action) {
            this.currentState = action(this.context, payload);
        }
    }

    switchTo(state: keyof InputStateEventAction): void {
        this.currentState = state;
    }

    leftPointerDown(payload: LeftPointerDownEventPayload): void {
    }

    blah(payload: LeftPointerDownEventPayload): "EXP_PAN" {
        return "EXP_PAN";
    }

}

const inputStateMachine2 = new InputStateMachine(inputStateEventAction);

type ExpEventMapping = {
    blah: LeftPointerDownEventPayload;
};

type ExpContext = {};

type ExpStates = "EXP_IDLE" | "EXP_PAN";

type ExpEventAction = StateEventAction<ExpEventMapping, ExpContext, ExpStates>;

const test: ExpEventAction = {
    EXP_IDLE: {
        blah: (context, event) => "EXP_IDLE",
    },
    EXP_PAN: {
        blah: inputStateMachine2.blah,
    }
}

