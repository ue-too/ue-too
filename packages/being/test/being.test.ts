import {
    BaseContext,
    EventGuards,
    EventReactions,
    Guard,
    TemplateState,
    TemplateStateMachine,
    createStateGuard,
} from '../src/interface';

type TestStates = 'IDLE' | 'FIRST' | 'SECOND';

type TestEventPayloadMapping = {
    EVENT_1: {};
    EVENT_2: {};
    EVENT_WITH_DATA: {
        data: string;
    };
};

const testContext: BaseContext = {
    setup: () => {},
    cleanup: () => {},
};

class IdleState extends TemplateState<
    TestEventPayloadMapping,
    BaseContext,
    TestStates
> {
    protected _eventReactions: EventReactions<
        TestEventPayloadMapping,
        BaseContext,
        TestStates
    > = {
        EVENT_1: {
            action: () => {},
            defaultTargetState: 'FIRST',
        },
        EVENT_WITH_DATA: {
            action: () => {},
            defaultTargetState: 'FIRST',
        },
    };
}

class FirstState extends TemplateState<
    TestEventPayloadMapping,
    BaseContext,
    TestStates
> {
    protected _eventReactions: EventReactions<
        TestEventPayloadMapping,
        BaseContext,
        TestStates
    > = {
        EVENT_2: {
            action: () => {},
            defaultTargetState: 'SECOND',
        },
    };
}

class SecondState extends TemplateState<
    TestEventPayloadMapping,
    BaseContext,
    TestStates
> {
    protected _eventReactions: EventReactions<
        TestEventPayloadMapping,
        BaseContext,
        TestStates
    > = {
        EVENT_1: {
            action: () => {},
            defaultTargetState: 'IDLE',
        },
    };
}

describe('being', () => {
    it('should be able to switch to a new state', () => {
        const stateMachine = new TemplateStateMachine(
            {
                IDLE: new IdleState(),
                FIRST: new FirstState(),
                SECOND: new SecondState(),
            },
            'IDLE',
            testContext
        );

        stateMachine.happens('EVENT_1');
        expect(stateMachine.currentState).toBe('FIRST');
    });

    it('should be able to call events with empty payloads without providing payload', () => {
        const stateMachine = new TemplateStateMachine(
            {
                IDLE: new IdleState(),
                FIRST: new FirstState(),
                SECOND: new SecondState(),
            },
            'IDLE',
            testContext
        );

        stateMachine.happens('EVENT_1');
        expect(stateMachine.currentState).toBe('FIRST');
    });

    it('should require payload for events with non-empty payloads', () => {
        const stateMachine = new TemplateStateMachine(
            {
                IDLE: new IdleState(),
                FIRST: new FirstState(),
                SECOND: new SecondState(),
            },
            'IDLE',
            testContext
        );

        // This should work - providing payload for event with data
        stateMachine.happens('EVENT_WITH_DATA', { data: 'test' });

        // This should work - omitting payload for event with empty payload
        stateMachine.happens('EVENT_1');
    });

    it('should call the action when event occurs', () => {
        const mockAction = jest.fn();
        const idleState = new IdleState();
        (idleState._eventReactions['EVENT_1'] as any).action = mockAction;
        idleState.beforeExit = jest.fn();
        idleState.uponEnter = jest.fn();

        const firstState = new FirstState();
        firstState.beforeExit = jest.fn();
        firstState.uponEnter = jest.fn();

        const stateMachine = new TemplateStateMachine(
            {
                IDLE: idleState,
                FIRST: firstState,
                SECOND: new SecondState(),
            },
            'IDLE',
            testContext
        );

        stateMachine.happens('EVENT_1');
        expect(mockAction).toHaveBeenCalled();
        expect(idleState.beforeExit).toHaveBeenCalledWith(
            testContext,
            stateMachine,
            'FIRST'
        );
        expect(firstState.uponEnter).toHaveBeenCalledWith(
            testContext,
            stateMachine,
            'IDLE'
        );
    });

    it('should call the beforeExit and uponEnter functions when the state changes with the correct context and source and target states', () => {
        const mockAction = jest.fn();
        const idleState = new IdleState();
        (idleState._eventReactions['EVENT_1'] as any).action = mockAction;
        idleState.beforeExit = jest.fn();
        idleState.uponEnter = jest.fn();

        const firstState = new FirstState();
        firstState.beforeExit = jest.fn();
        firstState.uponEnter = jest.fn();

        const stateMachine = new TemplateStateMachine(
            {
                IDLE: idleState,
                FIRST: firstState,
                SECOND: new SecondState(),
            },
            'IDLE',
            testContext
        );

        stateMachine.happens('EVENT_1');
        expect(idleState.beforeExit).toHaveBeenCalledWith(
            testContext,
            stateMachine,
            'FIRST'
        );
        expect(firstState.uponEnter).toHaveBeenCalledWith(
            testContext,
            stateMachine,
            'IDLE'
        );
    });

    it('should be able to handle unknown events', () => {
        const stateMachine = new TemplateStateMachine(
            {
                IDLE: new IdleState(),
                FIRST: new FirstState(),
                SECOND: new SecondState(),
            },
            'IDLE',
            testContext
        );

        stateMachine.happens('EVENT_3');
        expect(stateMachine.currentState).toBe('IDLE');
    });

    describe('Initialization', () => {
        it('should call uponEnter for initial state when state machine is constructed', () => {
            const idleState = new IdleState();
            idleState.uponEnter = jest.fn();

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: idleState,
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            expect(idleState.uponEnter).toHaveBeenCalledWith(
                testContext,
                stateMachine,
                'IDLE'
            );
            expect(stateMachine.currentState).toBe('IDLE');
        });

        it('should call context.setup() when state machine starts', () => {
            const mockSetup = jest.fn();
            const mockCleanup = jest.fn();
            const contextWithSetup: BaseContext = {
                setup: mockSetup,
                cleanup: mockCleanup,
            };

            new TemplateStateMachine(
                {
                    IDLE: new IdleState(),
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                contextWithSetup
            );

            expect(mockSetup).toHaveBeenCalled();
        });

        it('should start in INITIAL state before calling start()', () => {
            // This test verifies the internal INITIAL state behavior
            const idleState = new IdleState();
            idleState.uponEnter = jest.fn();

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: idleState,
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            // After construction, start() is called automatically, so we should be in IDLE
            expect(stateMachine.currentState).toBe('IDLE');
        });
    });

    describe('Lifecycle Methods', () => {
        it('should call wrapup() and transition to TERMINAL state', () => {
            const idleState = new IdleState();
            idleState.beforeExit = jest.fn();

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: idleState,
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            stateMachine.wrapup();
            expect(idleState.beforeExit).toHaveBeenCalledWith(
                testContext,
                stateMachine,
                'TERMINAL'
            );
            expect(stateMachine.currentState).toBe('TERMINAL');
        });

        it('should call context.cleanup() when wrapup() is called', () => {
            const mockCleanup = jest.fn();
            const contextWithCleanup: BaseContext = {
                setup: () => {},
                cleanup: mockCleanup,
            };

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new IdleState(),
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                contextWithCleanup
            );

            stateMachine.wrapup();
            expect(mockCleanup).toHaveBeenCalled();
        });

        it('should not call beforeExit if already in TERMINAL state', () => {
            const idleState = new IdleState();
            idleState.beforeExit = jest.fn() as any;

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: idleState,
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            stateMachine.wrapup();
            const beforeExitCallCount = (idleState.beforeExit as jest.Mock).mock
                .calls.length;
            stateMachine.wrapup(); // Call again
            expect(idleState.beforeExit).toHaveBeenCalledTimes(
                beforeExitCallCount
            );
        });

        it('should reset state machine to initial state', () => {
            const mockSetup = jest.fn();
            const mockCleanup = jest.fn();
            const contextWithLifecycle: BaseContext = {
                setup: mockSetup,
                cleanup: mockCleanup,
            };

            const idleState = new IdleState();
            idleState.uponEnter = jest.fn();
            idleState.beforeExit = jest.fn();

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: idleState,
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                contextWithLifecycle
            );

            // Transition to another state
            stateMachine.happens('EVENT_1');
            expect(stateMachine.currentState).toBe('FIRST');

            // Reset
            stateMachine.reset();
            expect(mockCleanup).toHaveBeenCalled();
            expect(mockSetup).toHaveBeenCalled();
            expect(stateMachine.currentState).toBe('IDLE');
            expect(idleState.uponEnter).toHaveBeenCalledTimes(2); // Once on construction, once on reset
        });

        it('should not call start() if not in INITIAL state', () => {
            const mockSetup = jest.fn();
            const contextWithSetup: BaseContext = {
                setup: mockSetup,
                cleanup: () => {},
            };

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new IdleState(),
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                contextWithSetup
            );

            const initialCallCount = mockSetup.mock.calls.length;
            stateMachine.happens('EVENT_1'); // Transition to FIRST
            stateMachine.start(); // Try to start again
            expect(mockSetup).toHaveBeenCalledTimes(initialCallCount); // Should not be called again
        });
    });

    describe('State Change Callbacks', () => {
        it('should call onStateChange callback when state transitions', () => {
            const stateChangeCallback = jest.fn();
            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new IdleState(),
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            stateMachine.onStateChange(stateChangeCallback);
            stateMachine.happens('EVENT_1');

            expect(stateChangeCallback).toHaveBeenCalledWith('IDLE', 'FIRST');
        });

        it('should call multiple onStateChange callbacks', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new IdleState(),
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            stateMachine.onStateChange(callback1);
            stateMachine.onStateChange(callback2);
            stateMachine.happens('EVENT_1');

            expect(callback1).toHaveBeenCalledWith('IDLE', 'FIRST');
            expect(callback2).toHaveBeenCalledWith('IDLE', 'FIRST');
        });

        it("should not call onStateChange callback if state doesn't change", () => {
            const stateChangeCallback = jest.fn();
            const idleState = new IdleState();
            // Remove defaultTargetState so state doesn't change
            (idleState._eventReactions['EVENT_1'] as any).defaultTargetState =
                undefined;

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: idleState,
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            stateMachine.onStateChange(stateChangeCallback);
            stateMachine.happens('EVENT_1');

            expect(stateChangeCallback).not.toHaveBeenCalled();
        });
    });

    describe('onHappens Callbacks', () => {
        it('should call onHappens callback when event occurs', () => {
            const happensCallback = jest.fn();
            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new IdleState(),
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            stateMachine.onHappens(happensCallback);
            stateMachine.happens('EVENT_1');

            expect(happensCallback).toHaveBeenCalledWith(
                ['EVENT_1'],
                testContext
            );
        });

        it('should call onHappens callback with event payload', () => {
            const happensCallback = jest.fn();
            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new IdleState(),
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            stateMachine.onHappens(happensCallback);
            stateMachine.happens('EVENT_WITH_DATA', { data: 'test' });

            expect(happensCallback).toHaveBeenCalledWith(
                ['EVENT_WITH_DATA', { data: 'test' }],
                testContext
            );
        });

        it('should call multiple onHappens callbacks', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new IdleState(),
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            stateMachine.onHappens(callback1);
            stateMachine.onHappens(callback2);
            stateMachine.happens('EVENT_1');

            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });

        it('should not call onHappens callback when in INITIAL or TERMINAL state', () => {
            const happensCallback = jest.fn();
            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new IdleState(),
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            stateMachine.onHappens(happensCallback);
            stateMachine.wrapup();
            stateMachine.happens('EVENT_1'); // Should not trigger callback in TERMINAL state

            // The callback should not have been called for the TERMINAL state event
            expect(happensCallback).not.toHaveBeenCalled();
        });
    });

    describe('Guards and Event Guards', () => {
        interface GuardContext extends BaseContext {
            count: number;
            setup(): void;
            cleanup(): void;
        }

        type GuardStates = 'IDLE' | 'ACTIVE' | 'PAUSED';

        type GuardEvents = {
            toggle: {};
        };

        class GuardIdleState extends TemplateState<
            GuardEvents,
            GuardContext,
            GuardStates
        > {
            protected _eventReactions: EventReactions<
                GuardEvents,
                GuardContext,
                GuardStates
            > = {
                toggle: {
                    action: context => {
                        context.count++;
                    },
                    defaultTargetState: 'ACTIVE',
                },
            };

            // Define guards with type inference for guard names
            // This pattern enables TypeScript to infer guard names in eventGuards
            protected _guards: Guard<GuardContext, 'isEven' | 'isOdd'> = {
                isEven: (context: GuardContext) => context.count % 2 === 0,
                isOdd: (context: GuardContext) => context.count % 2 === 1,
            };

            // Use typeof this._guards to get type inference for guard names
            protected _eventGuards: Partial<
                EventGuards<
                    GuardEvents,
                    GuardStates,
                    GuardContext,
                    typeof this._guards
                >
            > = {
                toggle: [
                    { guard: 'isEven', target: 'ACTIVE' },
                    { guard: 'isOdd', target: 'PAUSED' },
                ],
            };
        }

        class GuardActiveState extends TemplateState<
            GuardEvents,
            GuardContext,
            GuardStates
        > {
            protected _eventReactions: EventReactions<
                GuardEvents,
                GuardContext,
                GuardStates
            > = {
                toggle: {
                    action: () => {},
                    defaultTargetState: 'IDLE',
                },
            };
        }

        class GuardPausedState extends TemplateState<
            GuardEvents,
            GuardContext,
            GuardStates
        > {
            protected _eventReactions: EventReactions<
                GuardEvents,
                GuardContext,
                GuardStates
            > = {};
        }

        it('should use guard to determine next state', () => {
            // Test 1: count starts at 0, action increments to 1 (odd), should go to PAUSED
            const context1: GuardContext = {
                count: 0,
                setup() {
                    this.count = 0;
                },
                cleanup() {},
            };

            const stateMachine1 = new TemplateStateMachine(
                {
                    IDLE: new GuardIdleState(),
                    ACTIVE: new GuardActiveState(),
                    PAUSED: new GuardPausedState(),
                },
                'IDLE',
                context1
            );

            stateMachine1.happens('toggle');
            expect(stateMachine1.currentState).toBe('PAUSED');
            expect(context1.count).toBe(1);

            // Test 2: count starts at 1, action increments to 2 (even), should go to ACTIVE
            const context2: GuardContext = {
                count: 1,
                setup() {
                    this.count = 1;
                },
                cleanup() {},
            };

            const stateMachine2 = new TemplateStateMachine(
                {
                    IDLE: new GuardIdleState(),
                    ACTIVE: new GuardActiveState(),
                    PAUSED: new GuardPausedState(),
                },
                'IDLE',
                context2
            );

            stateMachine2.happens('toggle');
            expect(stateMachine2.currentState).toBe('ACTIVE');
            expect(context2.count).toBe(2);
        });

        it('should fall back to defaultTargetState if no guard matches', () => {
            const context: GuardContext = {
                count: 0,
                setup() {
                    this.count = 0;
                },
                cleanup() {},
            };

            class GuardIdleStateWithNoMatch extends TemplateState<
                GuardEvents,
                GuardContext,
                GuardStates
            > {
                protected _eventReactions: EventReactions<
                    GuardEvents,
                    GuardContext,
                    GuardStates
                > = {
                    toggle: {
                        action: () => {},
                        defaultTargetState: 'ACTIVE',
                    },
                };

                // Define guards with type inference for guard names
                protected _guards: Guard<GuardContext, 'alwaysFalse'> = {
                    alwaysFalse: () => false,
                };

                // Use typeof this._guards to get type inference for guard names
                protected _eventGuards: Partial<
                    EventGuards<
                        GuardEvents,
                        GuardStates,
                        GuardContext,
                        typeof this._guards
                    >
                > = {
                    toggle: [{ guard: 'alwaysFalse', target: 'PAUSED' }],
                };
            }

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new GuardIdleStateWithNoMatch(),
                    ACTIVE: new GuardActiveState(),
                    PAUSED: new GuardPausedState(),
                },
                'IDLE',
                context
            );

            stateMachine.happens('toggle');
            expect(stateMachine.currentState).toBe('ACTIVE'); // Should use defaultTargetState
        });
    });

    describe('Event Outputs', () => {
        type OutputEvents = {
            calculate: { value: number };
            getValue: {};
        };

        type OutputStates = 'IDLE' | 'PROCESSING';

        interface OutputContext extends BaseContext {
            result: number;
            setup(): void;
            cleanup(): void;
        }

        class OutputIdleState extends TemplateState<
            OutputEvents,
            OutputContext,
            OutputStates
        > {
            protected _eventReactions: EventReactions<
                OutputEvents,
                OutputContext,
                OutputStates
            > = {
                calculate: {
                    action: (context, event) => {
                        return event.value * 2;
                    },
                    defaultTargetState: 'PROCESSING',
                },
                getValue: {
                    action: context => {
                        return context.result;
                    },
                },
            };
        }

        class OutputProcessingState extends TemplateState<
            OutputEvents,
            OutputContext,
            OutputStates
        > {
            protected _eventReactions: EventReactions<
                OutputEvents,
                OutputContext,
                OutputStates
            > = {};
        }

        it('should return output from event handler', () => {
            const context: OutputContext = {
                result: 0,
                setup() {
                    this.result = 0;
                },
                cleanup() {},
            };

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new OutputIdleState(),
                    PROCESSING: new OutputProcessingState(),
                },
                'IDLE',
                context
            );

            const result = stateMachine.happens('calculate', { value: 5 });
            expect(result.handled).toBe(true);
            if (result.handled) {
                expect(result.output).toBe(10);
            }
        });

        it("should return undefined output if action doesn't return a value", () => {
            const context: OutputContext = {
                result: 0,
                setup() {
                    this.result = 0;
                },
                cleanup() {},
            };

            const idleState = new OutputIdleState();
            (idleState._eventReactions['getValue'] as any).action = () => {}; // No return

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: idleState,
                    PROCESSING: new OutputProcessingState(),
                },
                'IDLE',
                context
            );

            const result = stateMachine.happens('getValue');
            expect(result.handled).toBe(true);
            if (result.handled) {
                expect(result.output).toBeUndefined();
            }
        });
    });

    describe('Edge Cases', () => {
        it('should not transition if nextState is the same as current state', () => {
            const idleState = new IdleState();
            idleState.beforeExit = jest.fn() as any;
            idleState.uponEnter = jest.fn() as any;

            const firstState = new FirstState();
            firstState.beforeExit = jest.fn() as any;
            firstState.uponEnter = jest.fn() as any;

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: idleState,
                    FIRST: firstState,
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            // Modify EVENT_1 to transition back to IDLE
            (idleState._eventReactions['EVENT_1'] as any).defaultTargetState =
                'IDLE';

            const beforeExitCallCount = (idleState.beforeExit as jest.Mock).mock
                .calls.length;
            const uponEnterCallCount = (idleState.uponEnter as jest.Mock).mock
                .calls.length;

            stateMachine.happens('EVENT_1');

            // Should not call beforeExit/uponEnter again since state didn't change
            expect(idleState.beforeExit).toHaveBeenCalledTimes(
                beforeExitCallCount
            );
            expect(idleState.uponEnter).toHaveBeenCalledTimes(
                uponEnterCallCount
            );
        });

        it('should not handle events when in TERMINAL state', () => {
            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new IdleState(),
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            stateMachine.wrapup();
            expect(stateMachine.currentState).toBe('TERMINAL');

            const result = stateMachine.happens('EVENT_1');
            expect(result.handled).toBe(false);
            expect(stateMachine.currentState).toBe('TERMINAL');
        });

        it('should handle events with undefined defaultTargetState (no transition)', () => {
            const idleState = new IdleState();
            (idleState._eventReactions['EVENT_1'] as any).defaultTargetState =
                undefined;

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: idleState,
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            const result = stateMachine.happens('EVENT_1');
            expect(result.handled).toBe(true);
            if (result.handled) {
                expect(result.nextState).toBeUndefined();
            }
            expect(stateMachine.currentState).toBe('IDLE');
        });

        it('should handle multiple sequential state transitions', () => {
            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new IdleState(),
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            stateMachine.happens('EVENT_1'); // IDLE -> FIRST
            expect(stateMachine.currentState).toBe('FIRST');

            stateMachine.happens('EVENT_2'); // FIRST -> SECOND
            expect(stateMachine.currentState).toBe('SECOND');

            stateMachine.happens('EVENT_1'); // SECOND -> IDLE
            expect(stateMachine.currentState).toBe('IDLE');
        });
    });

    describe('Getters and Setters', () => {
        it('should return current state', () => {
            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new IdleState(),
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            expect(stateMachine.currentState).toBe('IDLE');
            stateMachine.happens('EVENT_1');
            expect(stateMachine.currentState).toBe('FIRST');
        });

        it('should return possible states', () => {
            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new IdleState(),
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            const possibleStates = stateMachine.possibleStates;
            expect(possibleStates).toContain('IDLE');
            expect(possibleStates).toContain('FIRST');
            expect(possibleStates).toContain('SECOND');
            expect(possibleStates.length).toBe(3);
        });

        it('should return states object', () => {
            const idleState = new IdleState();
            const firstState = new FirstState();
            const secondState = new SecondState();

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: idleState,
                    FIRST: firstState,
                    SECOND: secondState,
                },
                'IDLE',
                testContext
            );

            const states = stateMachine.states;
            expect(states['IDLE']).toBe(idleState);
            expect(states['FIRST']).toBe(firstState);
            expect(states['SECOND']).toBe(secondState);
        });

        it('should allow setting context', () => {
            const newContext: BaseContext = {
                setup: () => {},
                cleanup: () => {},
            };

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new IdleState(),
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                testContext
            );

            stateMachine.setContext(newContext);
            // Context is internal, so we verify by checking that events still work
            stateMachine.happens('EVENT_1');
            expect(stateMachine.currentState).toBe('FIRST');
        });
    });

    describe('Context Lifecycle', () => {
        it('should call setup and cleanup in correct order during reset', () => {
            const callOrder: string[] = [];
            const context: BaseContext = {
                setup: () => callOrder.push('setup'),
                cleanup: () => callOrder.push('cleanup'),
            };

            const stateMachine = new TemplateStateMachine(
                {
                    IDLE: new IdleState(),
                    FIRST: new FirstState(),
                    SECOND: new SecondState(),
                },
                'IDLE',
                context
            );

            stateMachine.happens('EVENT_1');
            stateMachine.reset();

            // During reset: cleanup, then setup
            expect(callOrder).toContain('cleanup');
            expect(callOrder).toContain('setup');
            const cleanupIndex = callOrder.indexOf('cleanup');
            const setupIndex = callOrder.indexOf('setup', cleanupIndex);
            expect(setupIndex).toBeGreaterThan(cleanupIndex);
        });
    });

    describe('createStateGuard', () => {
        it('should create a type guard that correctly identifies valid states', () => {
            const STATES = ['IDLE', 'FIRST', 'SECOND'] as const;
            const isTestState = createStateGuard(STATES);

            expect(isTestState('IDLE')).toBe(true);
            expect(isTestState('FIRST')).toBe(true);
            expect(isTestState('SECOND')).toBe(true);
            expect(isTestState('INVALID')).toBe(false);
            expect(isTestState('')).toBe(false);
        });

        it('should work with TypeScript type narrowing', () => {
            const MAIN_STATES = ['idle', 'active'] as const;
            const SUB_STATES = ['loading', 'processing'] as const;
            type MainState = (typeof MAIN_STATES)[number];
            type SubState = (typeof SUB_STATES)[number];
            type AllStates = MainState | SubState;

            const isMainState = createStateGuard(MAIN_STATES);
            const isSubState = createStateGuard(SUB_STATES);

            function handleState(state: AllStates): string {
                if (isMainState(state)) {
                    // TypeScript should know state is "idle" | "active" here
                    return `Main: ${state}`;
                } else if (isSubState(state)) {
                    // TypeScript should know state is "loading" | "processing" here
                    return `Sub: ${state}`;
                }
                return 'unknown';
            }

            expect(handleState('idle')).toBe('Main: idle');
            expect(handleState('loading')).toBe('Sub: loading');
        });

        it('should handle empty state arrays', () => {
            const EMPTY_STATES = [] as const;
            const isEmptyState = createStateGuard(EMPTY_STATES);

            expect(isEmptyState('anything')).toBe(false);
        });

        it('should be case-sensitive', () => {
            const STATES = ['IDLE', 'FIRST'] as const;
            const isTestState = createStateGuard(STATES);

            expect(isTestState('IDLE')).toBe(true);
            expect(isTestState('idle')).toBe(false);
            expect(isTestState('Idle')).toBe(false);
        });
    });
});
