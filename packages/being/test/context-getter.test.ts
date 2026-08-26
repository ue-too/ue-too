import { describe, expect, it } from 'vitest';

import {
    BaseContext,
    EventReactions,
    TemplateState,
    TemplateStateMachine,
} from '../src/interface';

type Events = { tick: {} };
type States = 'IDLE';

interface CounterContext extends BaseContext {
    count: number;
}

class IdleState extends TemplateState<Events, CounterContext, States> {
    protected _eventReactions: EventReactions<Events, CounterContext, States> =
        {
            tick: {
                action: context => {
                    context.count += 1;
                },
            },
        };
}

function createMachine(context: CounterContext) {
    return new TemplateStateMachine<Events, CounterContext, States>(
        { IDLE: new IdleState() },
        'IDLE',
        context
    );
}

describe('StateMachine context getter', () => {
    it('exposes the live context object read-only', () => {
        const context: CounterContext = {
            count: 0,
            setup() {},
            cleanup() {},
        };
        const machine = createMachine(context);
        expect(machine.context).toBe(context);
        machine.happens('tick');
        expect(machine.context.count).toBe(1);
    });

    it('reflects a context swapped in via setContext', () => {
        const first: CounterContext = { count: 0, setup() {}, cleanup() {} };
        const second: CounterContext = { count: 42, setup() {}, cleanup() {} };
        const machine = createMachine(first);
        machine.setContext(second);
        expect(machine.context).toBe(second);
    });
});
