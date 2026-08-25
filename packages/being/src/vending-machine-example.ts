import {
    BaseContext,
    EventReactions,
    TemplateState,
    TemplateStateMachine,
} from './interface';

/** Events accepted by the {@link createVendingMachine} demo machine. */
export type VendingMachineEvents = {
    insertBills: {};
    selectCoke: {};
    selectRedBull: {};
    selectWater: {};
    cancelTransaction: {};
};

/** States of the {@link createVendingMachine} demo machine. */
export type VendingMachineStates =
    | 'IDLE'
    | 'ONE_DOLLAR_INSERTED'
    | 'TWO_DOLLARS_INSERTED'
    | 'THREE_DOLLARS_INSERTED';

class IdleState extends TemplateState<
    VendingMachineEvents,
    BaseContext,
    VendingMachineStates
> {
    protected _eventReactions: EventReactions<
        VendingMachineEvents,
        BaseContext,
        VendingMachineStates
    > = {
        insertBills: {
            action: (context, event, stateMachine) => {
                console.log('inserted bills');
            },
            defaultTargetState: 'ONE_DOLLAR_INSERTED',
        },
    };
}

class OneDollarInsertedState extends TemplateState<
    VendingMachineEvents,
    BaseContext,
    VendingMachineStates
> {
    protected _eventReactions: EventReactions<
        VendingMachineEvents,
        BaseContext,
        VendingMachineStates
    > = {
        insertBills: {
            action: (context, event, stateMachine) => {
                console.log('inserted bills');
            },
            defaultTargetState: 'TWO_DOLLARS_INSERTED',
        },
        selectCoke: {
            action: (context, event, stateMachine) => {
                console.log('selected coke; thank you for your purchase');
            },
            defaultTargetState: 'IDLE',
        },
        selectRedBull: {
            action: (context, event, stateMachine) => {
                console.log(
                    'selected red bull; not enough money, 1 dollar short, please insert more money'
                );
            },
        },
        selectWater: {
            action: (context, event, stateMachine) => {
                console.log(
                    'selected water; not enough money, 2 dollars short, please insert more money'
                );
            },
        },
        cancelTransaction: {
            action: (context, event, stateMachine) => {
                console.log(
                    'cancelled transaction; refunding 1 dollar; please take your money'
                );
            },
            defaultTargetState: 'IDLE',
        },
    };
}

class TwoDollarsInsertedState extends TemplateState<
    VendingMachineEvents,
    BaseContext,
    VendingMachineStates
> {
    protected _eventReactions: EventReactions<
        VendingMachineEvents,
        BaseContext,
        VendingMachineStates
    > = {
        insertBills: {
            action: (context, event, stateMachine) => {
                console.log('inserted bills');
            },
            defaultTargetState: 'THREE_DOLLARS_INSERTED',
        },
        selectCoke: {
            action: (context, event, stateMachine) => {
                console.log('selected coke; thank you for your purchase');
            },
            defaultTargetState: 'IDLE',
        },
        selectRedBull: {
            action: (context, event, stateMachine) => {
                console.log('selected red bull; thank you for your purchase');
            },
            defaultTargetState: 'IDLE',
        },
        selectWater: {
            action: (context, event, stateMachine) => {
                console.log(
                    'selected water; not enough money, 1 dollars short, please insert more money'
                );
            },
        },
        cancelTransaction: {
            action: (context, event, stateMachine) => {
                console.log(
                    'cancelled transaction; refunding 2 dollars; please take your money'
                );
            },
            defaultTargetState: 'IDLE',
        },
    };
}

class ThreeDollarsInsertedState extends TemplateState<
    VendingMachineEvents,
    BaseContext,
    VendingMachineStates
> {
    protected _eventReactions: EventReactions<
        VendingMachineEvents,
        BaseContext,
        VendingMachineStates
    > = {
        insertBills: {
            action: (context, event, stateMachine) => {
                console.log(
                    'not taking more bills; returning the inserted bills'
                );
            },
        },
        selectCoke: {
            action: (context, event, stateMachine) => {
                console.log('selected coke; change: 1 dollar');
            },
            defaultTargetState: 'IDLE',
        },
        selectRedBull: {
            action: (context, event, stateMachine) => {
                console.log('selected red bull; change: 2 dollars');
            },
            defaultTargetState: 'IDLE',
        },
        selectWater: {
            action: (context, event, stateMachine) => {
                console.log('selected water; no change');
            },
        },
        cancelTransaction: {
            action: (context, event, stateMachine) => {
                console.log(
                    'cancelled transaction; refunding 3 dollars; please take your money'
                );
            },
            defaultTargetState: 'IDLE',
        },
    };
}

/**
 * Creates a demo vending machine used by tests and the examples visualizer.
 *
 * @remarks
 * A 4-state machine (`IDLE`, `ONE_DOLLAR_INSERTED`, `TWO_DOLLARS_INSERTED`,
 * `THREE_DOLLARS_INSERTED`) modeling a simple vending machine that accepts
 * one-dollar bills and dispenses a Coke, Red Bull, or water once enough
 * money has been inserted, with a `cancelTransaction` event to refund and
 * return to `IDLE`. Each call returns a machine with its own context.
 *
 * @category Examples
 */
export const createVendingMachine = () => {
    const context: BaseContext = {
        setup: () => {},
        cleanup: () => {},
    };
    return new TemplateStateMachine<
        VendingMachineEvents,
        BaseContext,
        VendingMachineStates
    >(
        {
            IDLE: new IdleState(),
            ONE_DOLLAR_INSERTED: new OneDollarInsertedState(),
            TWO_DOLLARS_INSERTED: new TwoDollarsInsertedState(),
            THREE_DOLLARS_INSERTED: new ThreeDollarsInsertedState(),
        },
        'IDLE',
        context
    );
};
