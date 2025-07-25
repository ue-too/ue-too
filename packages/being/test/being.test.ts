import { TemplateStateMachine, TemplateState, BaseContext, EventReactions } from "../src/interface";

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

        const firstState = new FirstState();
        firstState.beforeExit = jest.fn();
        firstState.uponEnter = jest.fn();

        const stateMachine = new TemplateStateMachine({
            "IDLE": idleState,
            "FIRST": firstState,
            "SECOND": new SecondState()
        }, "IDLE", testContext);

        stateMachine.happens("EVENT_1", testContext);
        expect(mockAction).toHaveBeenCalled();
        expect(idleState.beforeExit).toHaveBeenCalledWith(testContext, stateMachine, "FIRST");
        expect(firstState.uponEnter).toHaveBeenCalledWith(testContext, stateMachine, "IDLE");
    });
    
    it("should call the beforeExit and uponEnter functions when the state changes with the correct context and source and target states", ()=>{
        const mockAction = jest.fn();
        const idleState = new IdleState();
        (idleState.eventReactions["EVENT_1"] as any).action = mockAction;
        idleState.beforeExit = jest.fn();
        idleState.uponEnter = jest.fn();

        const firstState = new FirstState();
        firstState.beforeExit = jest.fn();
        firstState.uponEnter = jest.fn();

        const stateMachine = new TemplateStateMachine({
            "IDLE": idleState,
            "FIRST": firstState,
            "SECOND": new SecondState()
        }, "IDLE", testContext);

        stateMachine.happens("EVENT_1", testContext);
        expect(idleState.beforeExit).toHaveBeenCalledWith(testContext, stateMachine, "FIRST");
        expect(firstState.uponEnter).toHaveBeenCalledWith(testContext, stateMachine, "IDLE");
    });

    it("should be able to handle unknown events", ()=>{
        const stateMachine = new TemplateStateMachine({
            "IDLE": new IdleState(),
            "FIRST": new FirstState(),
            "SECOND": new SecondState()
        }, "IDLE", testContext);

        stateMachine.happens("EVENT_3", testContext);
        expect(stateMachine.currentState).toBe("IDLE");
    });
});
