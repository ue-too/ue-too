import {
    BaseContext,
    EventGuards,
    EventPreconditions,
    EventReactions,
    Guard,
    TemplateState,
    TemplateStateMachine,
} from '@ue-too/being';

/**
 * A small demo machine exercising eventPreconditions: withdrawals are
 * vetoed unless the account has funds (watch the event log report
 * `not handled`), and an overdrawing withdrawal routes to FROZEN via a
 * post-action guard.
 */
type AccountEvents = {
    withdraw: { amount: number };
    deposit: { amount: number };
    unfreeze: {};
};

type AccountStates = 'ACTIVE' | 'FROZEN';

interface AccountContext extends BaseContext {
    balance: number;
}

class ActiveState extends TemplateState<
    AccountEvents,
    AccountContext,
    AccountStates
> {
    protected _guards: Guard<AccountContext, 'hasFunds' | 'isOverdrawn'> = {
        hasFunds: context => context.balance > 0,
        isOverdrawn: context => context.balance < 0,
    };
    protected _eventReactions: EventReactions<
        AccountEvents,
        AccountContext,
        AccountStates
    > = {
        withdraw: {
            action: (context, event) => {
                context.balance -= event.amount;
            },
        },
        deposit: {
            action: (context, event) => {
                context.balance += event.amount;
            },
        },
    };
    protected _eventGuards: Partial<
        EventGuards<
            AccountEvents,
            AccountStates,
            AccountContext,
            Guard<AccountContext>
        >
    > = {
        withdraw: [{ guard: 'isOverdrawn', target: 'FROZEN' }],
    };
    protected _eventPreconditions: Partial<
        EventPreconditions<AccountEvents, AccountContext, Guard<AccountContext>>
    > = {
        withdraw: ['hasFunds'],
    };
}

class FrozenState extends TemplateState<
    AccountEvents,
    AccountContext,
    AccountStates
> {
    protected _eventReactions: EventReactions<
        AccountEvents,
        AccountContext,
        AccountStates
    > = {
        unfreeze: {
            action: context => {
                context.balance = Math.max(context.balance, 0);
            },
            defaultTargetState: 'ACTIVE',
        },
    };
}

export function createAccountDemoMachine() {
    const context: AccountContext = {
        balance: 100,
        setup() {
            this.balance = 100;
        },
        cleanup() {},
    };
    return new TemplateStateMachine<
        AccountEvents,
        AccountContext,
        AccountStates
    >(
        { ACTIVE: new ActiveState(), FROZEN: new FrozenState() },
        'ACTIVE',
        context
    );
}
