export type EventAction<EventPayloadMapping, Context, States> = {
    [K in keyof EventPayloadMapping]: (context: Context, event: EventPayloadMapping[K]) => keyof States;
};

export type StateEventAction<EventPayloadMapping, Context> = {
    normal: Partial<EventAction<EventPayloadMapping, Context, StateEventAction<EventPayloadMapping, Context>>>;
    hover: Partial<EventAction<EventPayloadMapping, Context, StateEventAction<EventPayloadMapping, Context>>>;
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

interface StateMachine<States, Events, Context> {
    switchTo(state: keyof States): void;
    happens<K extends keyof Events>(event: K, payload: Events[K]): void;
}

export class GenericStateMachine<Events, Context> implements StateMachine<StateEventAction<Events, Context>, Events, Context> {
    private _currentState: keyof StateEventAction<Events, Context>;
    private context: Context;
    private eventAction: StateEventAction<Events, Context>;

    constructor(eventAction: StateEventAction<Events, Context>) {
        this._currentState = Object.keys(eventAction)[0] as keyof StateEventAction<Events, Context>;
        this.eventAction = eventAction;
    }

    get currentState(): keyof StateEventAction<Events, Context> {
        return this._currentState;
    }

    switchTo(state: keyof StateEventAction<Events, Context>): void {
        this._currentState = state;
    }

    happens<K extends keyof Events>(event: K, payload: Events[K]): void {
        const action = this.eventAction[this._currentState][event];
        if (action) {
            this.switchTo(action(this.context, payload));
        }
    }
}

const inputStateMachine = new GenericStateMachine<InputEventPayloadMapping, InputContext>(inputStateEventAction);
inputStateMachine.currentState

class InputStateMachine implements StateMachine<InputStateEventAction, InputEventPayloadMapping, InputContext> {

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
}