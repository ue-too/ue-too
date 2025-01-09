export type StateHandler<EventPayloadMapping, Context, States extends string> = 
<K extends keyof EventPayloadMapping>(
    stateMachine: StateMachine<EventPayloadMapping, Context, States>, 
    event: K, 
    payload: EventPayloadMapping[K], 
    context: Context
) => States;

export type StateMachine<EventPayloadMapping, Context, States extends string = 'IDLE'> = {
    switchTo: (state: States) => void;
    happens: <K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context) => void;
    setContext: (context: Context) => void;
};

export type EventAction<EventPayloadMapping, Context, States extends string> = {
    [K in keyof EventPayloadMapping]: 
        (stateMachine: StateMachine<EventPayloadMapping, Context, States>, context: Context, event: EventPayloadMapping[K]) => States;
};

export function createStateMachine<EventPayloadMapping, Context, States extends string>(
    states: Record<States, StateHandler<EventPayloadMapping, Context, States>>, 
    initialState: States, 
    context: Context
): StateMachine<EventPayloadMapping, Context, States> {
    let currentState = initialState;

    const switchTo = (state: States) => {
        currentState = state;
    };

    const happens = <K extends keyof EventPayloadMapping>(event: K, payload: EventPayloadMapping[K], context: Context) => {
        const nextState = states[currentState](stateMachine, event, payload, context);
        if (nextState !== currentState) {
            switchTo(nextState);
        }
    };

    const setContext = (newContext: Context) => {
        context = newContext;
    };

    const stateMachine: StateMachine<EventPayloadMapping, Context, States> = {
        switchTo,
        happens,
        setContext,
    };

    return stateMachine;
}
