import { beforeEach, describe, expect, it } from 'vitest';

import {
    BaseContext,
    EventGuards,
    EventPreconditions,
    EventReactions,
    Guard,
    TemplateState,
    TemplateStateMachine,
} from '../src/interface';

type Events = { withdraw: { amount: number }; deposit: {}; ping: {} };
type States = 'ACTIVE' | 'LOCKED';

interface AccountContext extends BaseContext {
    balance: number;
    locked: boolean;
    actionRuns: number;
    deferRuns: number;
}

function createContext(
    overrides: Partial<AccountContext> = {}
): AccountContext {
    return {
        balance: 100,
        locked: false,
        actionRuns: 0,
        deferRuns: 0,
        setup() {},
        cleanup() {},
        ...overrides,
    };
}

class ActiveState extends TemplateState<Events, AccountContext, States> {
    protected _guards: Guard<
        AccountContext,
        'hasBalance' | 'notLocked' | 'overdrawn'
    > = {
        hasBalance: context => context.balance > 0,
        notLocked: context => !context.locked,
        overdrawn: context => context.balance < 0,
    };
    protected _eventReactions: EventReactions<Events, AccountContext, States> =
        {
            withdraw: {
                action: (context, event) => {
                    context.actionRuns += 1;
                    context.balance -= event.amount;
                },
            },
            deposit: {
                action: context => {
                    context.actionRuns += 1;
                },
            },
        };
    protected _eventGuards: Partial<
        EventGuards<Events, States, AccountContext, Guard<AccountContext>>
    > = {
        withdraw: [{ guard: 'overdrawn', target: 'LOCKED' }],
    };
    protected _eventPreconditions: Partial<
        EventPreconditions<Events, AccountContext, Guard<AccountContext>>
    > = {
        withdraw: ['hasBalance', 'notLocked'],
    };
}

class LockedState extends TemplateState<Events, AccountContext, States> {}

class DeferringState extends TemplateState<Events, AccountContext, States> {
    protected _guards: Guard<AccountContext, 'notLocked'> = {
        notLocked: context => !context.locked,
    };
    protected _eventPreconditions: Partial<
        EventPreconditions<Events, AccountContext, Guard<AccountContext>>
    > = {
        ping: ['notLocked'],
    };
    protected _defer = {
        action: (context: AccountContext) => {
            context.deferRuns += 1;
            return { handled: true as const };
        },
    };
}

class MissingGuardState extends TemplateState<Events, AccountContext, States> {
    protected _eventReactions: EventReactions<Events, AccountContext, States> =
        {
            ping: {
                action: context => {
                    context.actionRuns += 1;
                },
            },
        };
    protected _eventPreconditions: Partial<
        EventPreconditions<Events, AccountContext, Guard<AccountContext>>
    > = {
        ping: ['doesNotExist'],
    };
}

describe('eventPreconditions', () => {
    let context: AccountContext;
    let machine: TemplateStateMachine<Events, AccountContext, States>;

    beforeEach(() => {
        context = createContext();
        machine = new TemplateStateMachine<Events, AccountContext, States>(
            { ACTIVE: new ActiveState(), LOCKED: new LockedState() },
            'ACTIVE',
            context
        );
    });

    it('handles the event normally when all preconditions pass', () => {
        const result = machine.happens('withdraw', { amount: 30 });
        expect(result.handled).toBe(true);
        expect(context.actionRuns).toBe(1);
        expect(context.balance).toBe(70);
    });

    it('returns handled false and skips the action when a precondition fails', () => {
        context.balance = 0;
        const result = machine.happens('withdraw', { amount: 30 });
        expect(result).toEqual({ handled: false });
        expect(context.actionRuns).toBe(0);
        expect(context.balance).toBe(0);
    });

    it('does not transition state when vetoed', () => {
        context.locked = true;
        machine.happens('withdraw', { amount: 200 });
        expect(machine.currentState).toBe('ACTIVE');
    });

    it('requires every listed precondition to pass (AND semantics)', () => {
        context.locked = true; // hasBalance passes, notLocked fails
        const result = machine.happens('withdraw', { amount: 10 });
        expect(result).toEqual({ handled: false });
    });

    it('leaves events without preconditions unaffected', () => {
        context.balance = 0;
        context.locked = true;
        const result = machine.happens('deposit');
        expect(result.handled).toBe(true);
        expect(context.actionRuns).toBe(1);
    });

    it('still applies eventGuards routing after a passing precondition', () => {
        const result = machine.happens('withdraw', { amount: 150 });
        expect(result.handled).toBe(true);
        // balance went negative, so the 'overdrawn' guard routes to LOCKED
        expect(machine.currentState).toBe('LOCKED');
    });

    it('vetoes when a precondition names an unregistered guard (fail closed)', () => {
        const failClosedMachine = new TemplateStateMachine<
            Events,
            AccountContext,
            States
        >(
            { ACTIVE: new MissingGuardState(), LOCKED: new LockedState() },
            'ACTIVE',
            context
        );
        const result = failClosedMachine.happens('ping');
        expect(result).toEqual({ handled: false });
        expect(context.actionRuns).toBe(0);
    });

    it('gates the defer hook: a failed precondition prevents defer from running', () => {
        context.locked = true;
        const deferMachine = new TemplateStateMachine<
            Events,
            AccountContext,
            States
        >(
            { ACTIVE: new DeferringState(), LOCKED: new LockedState() },
            'ACTIVE',
            context
        );
        const result = deferMachine.happens('ping');
        expect(result).toEqual({ handled: false });
        expect(context.deferRuns).toBe(0);
    });

    it('lets the defer hook run when preconditions pass', () => {
        const deferMachine = new TemplateStateMachine<
            Events,
            AccountContext,
            States
        >(
            { ACTIVE: new DeferringState(), LOCKED: new LockedState() },
            'ACTIVE',
            context
        );
        const result = deferMachine.happens('ping');
        expect(result.handled).toBe(true);
        expect(context.deferRuns).toBe(1);
    });
});
