import { createMainStateMachine } from '../src/trains/input-state-machine/test';

describe('Main State Machine', () => {
    it('should hold the sub state machine state when the main state machine transition in and out of a state', () => {
        const stateMachine = createMainStateMachine();

        const res = stateMachine.happens("log");
        if (res.handled && res.output) {
            expect(res.output.message).toBe('log in the start state');
        } else {
            expect(res.handled).toBe(false);
        }

        stateMachine.happens('end');

        stateMachine.happens('createCurve');
        stateMachine.happens('endCurve');

        stateMachine.happens('log');
        if (res.handled && res.output) {
            expect(res.output.message).toBe('log in the end state');
        } else {
            expect(res.handled).toBe(false);
        }
    });
});
