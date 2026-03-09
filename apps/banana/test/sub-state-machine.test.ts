import { createMainStateMachine } from '../src/trains/input-state-machine/test';

describe('Main State Machine', () => {
    it('should hold the sub state machine state when the main state machine transition in and out of a state', () => {
        const stateMachine = createMainStateMachine();

        const res = stateMachine.happens("log");
        if (res.handled && res.output) {
            console.log('in test case res', res);
            expect(res.output.message).toBe('log in the start state');
        } else {
            expect(res.handled).toBe(false);
        }

        stateMachine.happens('end');

        stateMachine.happens('createCurve');
        stateMachine.happens('endCurve');

        const res2 = stateMachine.happens('log');
        if (res2.handled && res2.output) {
            expect(res2.output.message).toBe('log in the end state');
        } else {
            expect(res2.handled).toBe(false);
        }
    });
});
