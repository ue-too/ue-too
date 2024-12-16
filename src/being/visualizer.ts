import { StateMachine } from "./interfaces";

export function placeholder(){};

export function parser<EventPayloadMapping, Context, States extends string>(stateMachine: StateMachine<EventPayloadMapping, Context, States>): void {
    const states = stateMachine.states;
    const possibleStates = Object.keys(states);
    for(const state of possibleStates){
        const stateObject = states[state as States];
        const eventReactions = stateObject.eventReactions;
        for(const event in eventReactions){
            const eventHandler = eventReactions[event];
            type returnType = ReturnType<typeof eventHandler>;
            console.log(event);
        }
    }

}