import { TemplateStateMachine, TemplateState, BaseContext, EventReactions } from "../../src/being";

type TestStates = "IDLE" | "FIRST" | "SECOND";

type TestEventPayloadMapping = {
    "EVENT_1": {
    };
    "EVENT_2": {
    };
}

const testContext: BaseContext = {
    setup: ()=>{},
    cleanup: ()=>{}
}

class IdleState extends TemplateState<TestEventPayloadMapping, BaseContext, TestStates> { 
    eventReactions: EventReactions<TestEventPayloadMapping, BaseContext, TestStates> = {
        "EVENT_1": {
            action: ()=>{},
            defaultTargetState: "FIRST"
        }
    }
}

class FirstState extends TemplateState<TestEventPayloadMapping, BaseContext, TestStates> { 
    eventReactions: EventReactions<TestEventPayloadMapping, BaseContext, TestStates> = {
        "EVENT_2": {
            action: ()=>{},
            defaultTargetState: "SECOND"
        }
    }
}

class SecondState extends TemplateState<TestEventPayloadMapping, BaseContext, TestStates> { 
    eventReactions: EventReactions<TestEventPayloadMapping, BaseContext, TestStates> = {
        "EVENT_1": {
            action: ()=>{},
            defaultTargetState: "IDLE"
        }
    }
}

describe("being", ()=>{
    it("should be able to switch to a new state", ()=>{
        const stateMachine = new TemplateStateMachine({
            "IDLE": new IdleState(),
            "FIRST": new FirstState(),
            "SECOND": new SecondState()
        }, "IDLE", testContext);

        stateMachine.happens("EVENT_1", testContext);
        expect(stateMachine.currentState).toBe("FIRST");
    });

    it("should call the action when event occurs", () => {
        const mockAction = jest.fn();
        const idleState = new IdleState();
        (idleState.eventReactions["EVENT_1"] as any).action = mockAction;
        idleState.beforeExit = jest.fn();
        idleState.uponEnter = jest.fn();

        const stateMachine = new TemplateStateMachine({
            "IDLE": idleState,
            "FIRST": new FirstState(),
            "SECOND": new SecondState()
        }, "IDLE", testContext);

        stateMachine.happens("EVENT_1", testContext);
        expect(mockAction).toHaveBeenCalled();
        expect(idleState.beforeExit).toHaveBeenCalled();
    });
});
