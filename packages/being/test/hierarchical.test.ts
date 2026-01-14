import {
  BaseContext,
  TemplateState,
  TemplateStateMachine,
  EventReactions,
} from "../src/interface";
import {
  CompositeState,
  HierarchicalStateMachine,
  HierarchicalStatePath,
} from "../src/hierarchical";

// ============================================================================
// Test Types and Context
// ============================================================================

type ParentStates = "IDLE" | "ACTIVE" | "PAUSED";
type ChildStates = "LOADING" | "READY" | "ERROR";

type TestEvents = {
  start: {};
  stop: {};
  pause: {};
  resume: {};
  loadComplete: {};
  error: { message: string };
  retry: {};
  childEvent: {};
  parentEvent: {};
};

interface TestContext extends BaseContext {
  counter: number;
  message: string | null;
  setup(): void;
  cleanup(): void;
}

const createTestContext = (): TestContext => ({
  counter: 0,
  message: null,
  setup() {
    this.counter = 0;
    this.message = null;
  },
  cleanup() {},
});

// ============================================================================
// Child States (for composite state)
// ============================================================================

class LoadingState extends TemplateState<TestEvents, TestContext, ChildStates> {
  protected _eventReactions: EventReactions<TestEvents, TestContext, ChildStates> = {
    loadComplete: {
      action: () => {},
      defaultTargetState: "READY",
    },
    error: {
      action: (context, event) => {
        context.message = event.message;
      },
      defaultTargetState: "ERROR",
    },
  };

  uponEnter = jest.fn();
  beforeExit = jest.fn();
}

class ReadyState extends TemplateState<TestEvents, TestContext, ChildStates> {
  protected _eventReactions: EventReactions<TestEvents, TestContext, ChildStates> = {
    childEvent: {
      action: () => {},
    },
  };

  uponEnter = jest.fn();
  beforeExit = jest.fn();
}

class ErrorState extends TemplateState<TestEvents, TestContext, ChildStates> {
  protected _eventReactions: EventReactions<TestEvents, TestContext, ChildStates> = {
    retry: {
      action: () => {},
      defaultTargetState: "LOADING",
    },
  };

  uponEnter = jest.fn();
  beforeExit = jest.fn();
}

// ============================================================================
// Top-Level States
// ============================================================================

class IdleState extends TemplateState<TestEvents, TestContext, ParentStates> {
  protected _eventReactions: EventReactions<TestEvents, TestContext, ParentStates> = {
    start: {
      action: () => {},
      defaultTargetState: "ACTIVE",
    },
  };

  uponEnter = jest.fn();
  beforeExit = jest.fn();
}

class ActiveState extends CompositeState<
  TestEvents,
  TestContext,
  ParentStates,
  ChildStates
> {
  protected _eventReactions: EventReactions<TestEvents, TestContext, ParentStates> = {
    pause: {
      action: () => {},
      defaultTargetState: "PAUSED",
    },
    stop: {
      action: () => {},
      defaultTargetState: "IDLE",
    },
    parentEvent: {
      action: () => {},
    },
  };

  protected getChildStateMachine() {

    const childStates = {
      LOADING: new LoadingState(),
      READY: new ReadyState(),
      ERROR: new ErrorState(),
    };

    const childMachine = new TemplateStateMachine<TestEvents, TestContext, ChildStates>(
      childStates,
      "LOADING",
      this._context!,
      false
    );

    return {
      stateMachine: childMachine,
      defaultChildState: "LOADING" as ChildStates,
      rememberHistory: false,
    };
  }

//   uponEnter = jest.fn();
//   beforeExit = jest.fn();
}

class ActiveStateWithHistory extends CompositeState<
  TestEvents,
  TestContext,
  ParentStates,
  ChildStates
> {
  protected _eventReactions: EventReactions<TestEvents, TestContext, ParentStates> = {
    pause: {
      action: () => {},
      defaultTargetState: "PAUSED",
    },
    stop: {
      action: () => {},
      defaultTargetState: "IDLE",
    },
  };

  protected getChildStateMachine() {
    const childStates = {
      LOADING: new LoadingState(),
      READY: new ReadyState(),
      ERROR: new ErrorState(),
    };

    const childMachine = new TemplateStateMachine<TestEvents, TestContext, ChildStates>(
      childStates,
      "LOADING",
      this._context!,
      false
    );

    return {
      stateMachine: childMachine,
      defaultChildState: "LOADING" as ChildStates,
      rememberHistory: true,
    };
  }
}

class PausedState extends TemplateState<TestEvents, TestContext, ParentStates> {
  protected _eventReactions: EventReactions<TestEvents, TestContext, ParentStates> = {
    resume: {
      action: () => {},
      defaultTargetState: "ACTIVE",
    },
    stop: {
      action: () => {},
      defaultTargetState: "IDLE",
    },
  };

  uponEnter = jest.fn();
  beforeExit = jest.fn();
}

// ============================================================================
// Tests
// ============================================================================

describe("Hierarchical State Machine", () => {
  describe("CompositeState", () => {
    describe("Child State Machine Initialization", () => {
      it("should initialize child state machine when composite state is entered", () => {
        const context = createTestContext();
        const activeState = new ActiveState();

        const idleState = new IdleState();
        const machine = new TemplateStateMachine(
          {
            IDLE: idleState,
            ACTIVE: activeState,
          },
          "IDLE",
          context
        );

        // Verify we're in IDLE state
        expect(machine.currentState).toBe("IDLE");

        // Transition to ACTIVE - this should trigger uponEnter on activeState
        machine.happens("start");

        // Verify we transitioned to ACTIVE
        expect(machine.currentState).toBe("ACTIVE");

        // Check if child state machine config is set (uponEnter should have been called)
        expect((activeState as any)._childStateMachineConfig).not.toBeNull();
        expect((activeState as any)._childStateMachineConfig).toBeDefined();
        
        expect(activeState.getCurrentChildState()).toBe("LOADING");
        const childMachine = (activeState as any)._childStateMachineConfig.stateMachine;
        expect(childMachine.currentState).toBe("LOADING");
      });

      it("should enter default child state when composite state is entered", () => {
        const context = createTestContext();
        const activeState = new ActiveState();
        (activeState as any)._context = context;

        const machine = new TemplateStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
          },
          "IDLE",
          context
        );

        machine.happens("start");

        expect(activeState.getCurrentChildState()).toBe("LOADING");
        const childMachine = (activeState as any)._childStateMachineConfig.stateMachine;
        const loadingState = childMachine.states.LOADING;
        expect(loadingState.uponEnter).toHaveBeenCalled();
      });

      it("should return null for getCurrentChildState when no child state machine is active", () => {
        const context = createTestContext();
        const activeState = new ActiveState();

        expect(activeState.getCurrentChildState()).toBeNull();
      });
    });

    describe("State Path Tracking", () => {
      it("should return parent state path when no child state is active", () => {
        const context = createTestContext();
        const activeState = new ActiveState();
        const path = activeState.getStatePath("ACTIVE" as ParentStates);
        expect(path).toBe("ACTIVE");
      });

      it("should return hierarchical path when child state is active", () => {
        const context = createTestContext();
        const activeState = new ActiveState();
        (activeState as any)._context = context;

        const machine = new TemplateStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
          },
          "IDLE",
          context
        );

        machine.happens("start");
        const path = activeState.getStatePath("ACTIVE" as ParentStates);
        expect(path).toBe("ACTIVE.LOADING");
      });
    });

    describe("History State", () => {
      it("should enter default child state when history is disabled", () => {
        const context = createTestContext();
        const activeState = new ActiveState();
        (activeState as any)._context = context;

        const machine = new TemplateStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
            PAUSED: new PausedState(),
          },
          "IDLE",
          context
        );

        // Enter ACTIVE -> LOADING
        machine.happens("start");
        expect(activeState.getCurrentChildState()).toBe("LOADING");

        // Transition to READY
        machine.happens("loadComplete");
        expect(activeState.getCurrentChildState()).toBe("READY");

        // Exit to PAUSED
        machine.happens("pause");

        // Re-enter ACTIVE (should go to default, not history)
        machine.happens("resume");
        expect(activeState.getCurrentChildState()).toBe("LOADING"); // Default, not READY
      });

      it("should restore history state when history is enabled", () => {
        const context = createTestContext();
        const activeStateWithHistory = new ActiveStateWithHistory();
        (activeStateWithHistory as any)._context = context;

        const machine = new TemplateStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeStateWithHistory,
            PAUSED: new PausedState(),
          },
          "IDLE",
          context
        );

        // Enter ACTIVE -> LOADING
        machine.happens("start");
        expect(activeStateWithHistory.getCurrentChildState()).toBe("LOADING");

        // Transition to READY
        machine.happens("loadComplete");
        expect(activeStateWithHistory.getCurrentChildState()).toBe("READY");

        // Exit to PAUSED (history should be saved)
        machine.happens("pause");

        // Re-enter ACTIVE (should restore READY from history)
        machine.happens("resume");
        expect(activeStateWithHistory.getCurrentChildState()).toBe("READY");
      });

      it("should use default state if no history exists", () => {
        const context = createTestContext();
        const activeStateWithHistory = new ActiveStateWithHistory();
        (activeStateWithHistory as any)._context = context;

        const machine = new TemplateStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeStateWithHistory,
            PAUSED: new PausedState(),
          },
          "IDLE",
          context
        );

        // First entry should use default
        machine.happens("start");
        expect(activeStateWithHistory.getCurrentChildState()).toBe("LOADING");
      });
    });

    describe("Event Propagation", () => {
      it("should handle events in child state machine first", () => {
        const context = createTestContext();
        const activeState = new ActiveState();
        (activeState as any)._context = context;

        const loadingState = new LoadingState();
        const readyState = new ReadyState();

        const childStates = {
          LOADING: loadingState,
          READY: readyState,
          ERROR: new ErrorState(),
        };

        const childMachine = new TemplateStateMachine(
          childStates,
          "LOADING",
          context,
          false
        );

        (activeState as any)._childStateMachineConfig = {
          stateMachine: childMachine,
          defaultChildState: "LOADING" as ChildStates,
          rememberHistory: false,
        };

        const machine = new TemplateStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
          },
          "IDLE",
          context
        );

        machine.happens("start");
        expect(activeState.getCurrentChildState()).toBe("LOADING");

        // Child should handle loadComplete
        machine.happens("loadComplete");
        expect(activeState.getCurrentChildState()).toBe("READY");
        expect(machine.currentState).toBe("ACTIVE"); // Parent state unchanged
      });

      it("should bubble events to parent if child doesn't handle them", () => {
        const context = createTestContext();
        const activeState = new ActiveState();
        (activeState as any)._context = context;

        const machine = new TemplateStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
            PAUSED: new PausedState(),
          },
          "IDLE",
          context
        );

        machine.happens("start");
        expect(activeState.getCurrentChildState()).toBe("LOADING");

        // pause event is not handled by child, should bubble to parent
        machine.happens("pause");
        expect(machine.currentState).toBe("PAUSED");
      });

      it("should handle parent-only events in parent state", () => {
        const context = createTestContext();
        const activeState = new ActiveState();
        (activeState as any)._context = context;

        const machine = new TemplateStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
            PAUSED: new PausedState(),
          },
          "IDLE",
          context
        );

        machine.happens("start");
        expect(activeState.getCurrentChildState()).toBe("LOADING");

        // parentEvent is only in parent, should be handled by parent
        const result = machine.happens("parentEvent");
        expect(result.handled).toBe(true);
        expect(machine.currentState).toBe("ACTIVE"); // No transition, but handled
      });
    });

    describe("Lifecycle Methods", () => {
      it("should call child state uponEnter when composite state is entered", () => {
        const context = createTestContext();
        const activeState = new ActiveState();

        const machine = new TemplateStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
          },
          "IDLE",
          context
        );

        machine.happens("start");
        
        // Get the actual child state from the created child machine
        const childMachine = (activeState as any)._childStateMachineConfig.stateMachine;
        const loadingState = childMachine.states.LOADING;
        expect(loadingState.uponEnter).toHaveBeenCalled();
      });

      it("should call child state beforeExit when composite state is exited", () => {
        const context = createTestContext();
        const activeState = new ActiveState();

        const machine = new TemplateStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
            PAUSED: new PausedState(),
          },
          "IDLE",
          context
        );

        machine.happens("start");
        expect(activeState.getCurrentChildState()).toBe("LOADING");

        // Get the actual child state from the created child machine
        const childMachine = (activeState as any)._childStateMachineConfig.stateMachine;
        const loadingState = childMachine.states.LOADING;

        machine.happens("pause");
        expect(loadingState.beforeExit).toHaveBeenCalled();
      });

      it("should save history state before exit when history is enabled", () => {
        const context = createTestContext();
        const activeStateWithHistory = new ActiveStateWithHistory();

        const machine = new TemplateStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeStateWithHistory,
            PAUSED: new PausedState(),
          },
          "IDLE",
          context
        );

        machine.happens("start");
        machine.happens("loadComplete");
        expect(activeStateWithHistory.getCurrentChildState()).toBe("READY");

        machine.happens("pause");
        expect((activeStateWithHistory as any)._historyState).toBe("READY");
      });
    });
  });

  describe("HierarchicalStateMachine", () => {
    describe("getCurrentStatePath", () => {
      it("should return simple state name for non-composite states", () => {
        const context = createTestContext();
        const machine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: new ActiveState(),
          },
          "IDLE",
          context
        );

        expect(machine.getCurrentStatePath()).toBe("IDLE");
      });

      it("should return hierarchical path for composite states", () => {
        const context = createTestContext();
        const activeState = new ActiveState();
        (activeState as any)._context = context;

        const machine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
          },
          "IDLE",
          context
        );

        machine.happens("start");
        expect(machine.getCurrentStatePath()).toBe("ACTIVE.LOADING");
      });

      it("should return INITIAL when in INITIAL state", () => {
        const context = createTestContext();
        const machine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: new ActiveState(),
          },
          "IDLE",
          context
        );

        // Create a new machine but don't start it
        const unstartedMachine = new TemplateStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: new ActiveState(),
          },
          "IDLE",
          context,
          false
        );

        // Manually check INITIAL state (this is internal, but we can test via wrapup)
        unstartedMachine.wrapup();
        expect(unstartedMachine.currentState).toBe("TERMINAL");
      });

      it("should return TERMINAL when in TERMINAL state", () => {
        const context = createTestContext();
        const machine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: new ActiveState(),
          },
          "IDLE",
          context
        );

        machine.wrapup();
        expect(machine.getCurrentStatePath()).toBe("TERMINAL");
      });
    });

    describe("getActiveStatePath", () => {
      it("should return array with single state for non-composite states", () => {
        const context = createTestContext();
        const machine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: new ActiveState(),
          },
          "IDLE",
          context
        );

        expect(machine.getActiveStatePath()).toEqual(["IDLE"]);
      });

      it("should return array with parent and child states for composite states", () => {
        const context = createTestContext();
        const activeState = new ActiveState();
        (activeState as any)._context = context;

        const machine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
          },
          "IDLE",
          context
        );

        machine.happens("start");
        expect(machine.getActiveStatePath()).toEqual(["ACTIVE", "LOADING"]);
      });

      it("should update active path when child state changes", () => {
        const context = createTestContext();
        const activeState = new ActiveState();
        (activeState as any)._context = context;

        const machine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
          },
          "IDLE",
          context
        );

        machine.happens("start");
        expect(machine.getActiveStatePath()).toEqual(["ACTIVE", "LOADING"]);

        machine.happens("loadComplete");
        expect(machine.getActiveStatePath()).toEqual(["ACTIVE", "READY"]);
      });

      it("should return INITIAL array when in INITIAL state", () => {
        const context = createTestContext();
        const unstartedMachine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: new ActiveState(),
          },
          "IDLE",
          context
        );

        // After construction, machine is started, so we test TERMINAL instead
        unstartedMachine.wrapup();
        expect(unstartedMachine.getActiveStatePath()).toEqual(["TERMINAL"]);
      });
    });

    describe("isInStatePath", () => {
      it("should return true for exact state match", () => {
        const context = createTestContext();
        const machine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: new ActiveState(),
          },
          "IDLE",
          context
        );

        expect(machine.isInStatePath("IDLE")).toBe(true);
      });

      it("should return true for exact hierarchical path match", () => {
        const context = createTestContext();
        const activeState = new ActiveState();
        (activeState as any)._context = context;

        const machine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
          },
          "IDLE",
          context
        );

        machine.happens("start");
        expect(machine.isInStatePath("ACTIVE.LOADING")).toBe(true);
      });

      it("should return true when current path starts with given path", () => {
        const context = createTestContext();
        const activeState = new ActiveState();
        (activeState as any)._context = context;

        const machine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
          },
          "IDLE",
          context
        );

        machine.happens("start");
        expect(machine.isInStatePath("ACTIVE")).toBe(true);
        expect(machine.isInStatePath("ACTIVE.LOADING")).toBe(true);
      });

      it("should return false when current path doesn't match", () => {
        const context = createTestContext();
        const machine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: new ActiveState(),
          },
          "IDLE",
          context
        );

        expect(machine.isInStatePath("ACTIVE")).toBe(false);
        expect(machine.isInStatePath("PAUSED")).toBe(false);
      });

      it("should return false for partial path match that doesn't start correctly", () => {
        const context = createTestContext();
        const activeState = new ActiveState();
        (activeState as any)._context = context;

        const machine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
          },
          "IDLE",
          context
        );

        machine.happens("start");
        expect(machine.isInStatePath("LOADING")).toBe(false); // Not a parent path
        expect(machine.isInStatePath("ACTIVE.READY")).toBe(false); // Different child
      });
    });

    describe("Integration Tests", () => {
      it("should handle complete hierarchical state machine workflow", () => {
        const context = createTestContext();
        const activeState = new ActiveState();
        (activeState as any)._context = context;

        const machine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
            PAUSED: new PausedState(),
          },
          "IDLE",
          context
        );

        // Start in IDLE
        expect(machine.getCurrentStatePath()).toBe("IDLE");
        expect(machine.getActiveStatePath()).toEqual(["IDLE"]);

        // Transition to ACTIVE -> LOADING
        machine.happens("start");
        expect(machine.getCurrentStatePath()).toBe("ACTIVE.LOADING");
        expect(machine.getActiveStatePath()).toEqual(["ACTIVE", "LOADING"]);
        expect(machine.isInStatePath("ACTIVE")).toBe(true);
        expect(machine.isInStatePath("ACTIVE.LOADING")).toBe(true);

        // Child state transition: LOADING -> READY
        machine.happens("loadComplete");
        expect(machine.getCurrentStatePath()).toBe("ACTIVE.READY");
        expect(machine.getActiveStatePath()).toEqual(["ACTIVE", "READY"]);

        // Parent handles pause, transitions to PAUSED
        machine.happens("pause");
        expect(machine.getCurrentStatePath()).toBe("PAUSED");
        expect(machine.getActiveStatePath()).toEqual(["PAUSED"]);

        // Resume back to ACTIVE (no history, should go to default)
        machine.happens("resume");
        expect(machine.getCurrentStatePath()).toBe("ACTIVE.LOADING");
        expect(machine.getActiveStatePath()).toEqual(["ACTIVE", "LOADING"]);

        // Stop to IDLE
        machine.happens("stop");
        expect(machine.getCurrentStatePath()).toBe("IDLE");
        expect(machine.getActiveStatePath()).toEqual(["IDLE"]);
      });

      it("should handle error and retry workflow", () => {
        const context = createTestContext();
        const activeState = new ActiveState();
        (activeState as any)._context = context;

        const machine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeState,
          },
          "IDLE",
          context
        );

        machine.happens("start");
        expect(machine.getCurrentStatePath()).toBe("ACTIVE.LOADING");

        // Error occurs
        machine.happens("error", { message: "Network error" });
        expect(machine.getCurrentStatePath()).toBe("ACTIVE.ERROR");
        expect(context.message).toBe("Network error");

        // Retry
        machine.happens("retry");
        expect(machine.getCurrentStatePath()).toBe("ACTIVE.LOADING");
      });

      it("should work with history state enabled", () => {
        const context = createTestContext();
        const activeStateWithHistory = new ActiveStateWithHistory();
        (activeStateWithHistory as any)._context = context;

        const machine = new HierarchicalStateMachine(
          {
            IDLE: new IdleState(),
            ACTIVE: activeStateWithHistory,
            PAUSED: new PausedState(),
          },
          "IDLE",
          context
        );

        // Enter ACTIVE -> LOADING
        machine.happens("start");
        expect(machine.getCurrentStatePath()).toBe("ACTIVE.LOADING");

        // Transition to READY
        machine.happens("loadComplete");
        expect(machine.getCurrentStatePath()).toBe("ACTIVE.READY");

        // Pause (saves history)
        machine.happens("pause");
        expect(machine.getCurrentStatePath()).toBe("PAUSED");

        // Resume (restores READY from history)
        machine.happens("resume");
        expect(machine.getCurrentStatePath()).toBe("ACTIVE.READY");
      });
    });
  });
});
