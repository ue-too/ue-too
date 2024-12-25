import { StateMachine } from "./interfaces";

export function placeholder(){};

export function parseStateMachine<EventPayloadMapping, Context, States extends string>(stateMachine: StateMachine<EventPayloadMapping, Context, States>){
    const states = stateMachine.states;
    const possibleStates = stateMachine.possibleStates;
    possibleStates.forEach(state => {
        const stateObject = states[state];
        console.log("--------------------------------");
        console.log("state: ", state);
        console.log("can handle:")
        const entries = Object.entries(stateObject.eventReactions);
        for (const event in stateObject.eventReactions){
            if(stateObject.eventReactions[event] === undefined){
                continue;
            }
            console.log("event: ", event);
            console.log("default target state: ", stateObject.eventReactions[event].defaultTargetState);
            const eventGuards = stateObject.eventGuards[event];
            if(eventGuards === undefined){
                continue;
            }
            console.log("event guards: ", eventGuards);
            for (const guard in eventGuards){
                console.log("guard: ", guard);
                console.log("guard condition: ", eventGuards[guard]);
            }
        }
    });
}