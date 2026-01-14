import { TemplateStateMachine, TemplateState, BaseContext, EventReactions } from "./interface";

type VendingMachineEvents = {
    insertBills: {};
    selectCoke: {};
    selectRedBull: {};
    selectWater: {};
    cancelTransaction: {};
}

type VendingMachineStates = "IDLE" | "ONE_DOLLAR_INSERTED" | "TWO_DOLLARS_INSERTED" | "THREE_DOLLARS_INSERTED";

class IdleState extends TemplateState<VendingMachineEvents, BaseContext, VendingMachineStates> {
    protected _eventReactions: EventReactions<VendingMachineEvents, BaseContext, VendingMachineStates> = {
        "insertBills": {
            action: (context, event, stateMachine) => {
                console.log("inserted bills");
            },
            defaultTargetState: "ONE_DOLLAR_INSERTED"
        },
    }
}

class OneDollarInsertedState extends TemplateState<VendingMachineEvents, BaseContext, VendingMachineStates> {
    protected _eventReactions: EventReactions<VendingMachineEvents, BaseContext, VendingMachineStates> = {
        "insertBills": {
            action: (context, event, stateMachine) => {
                console.log("inserted bills");
            },
            defaultTargetState: "TWO_DOLLARS_INSERTED"
        },
        "selectCoke": {
            action: (context, event, stateMachine) => {
                console.log("selected coke; thank you for your purchase");
            },
            defaultTargetState: "IDLE"
        },
        "selectRedBull": {
            action: (context, event, stateMachine) => {
                console.log("selected red bull; not enough money, 1 dollar short, please insert more money");
            },
        },
        "selectWater": {
            action: (context, event, stateMachine) => {
                console.log("selected water; not enough money, 2 dollars short, please insert more money");
            },
        },
        "cancelTransaction": {
            action: (context, event, stateMachine) => {
                console.log('cancelled transaction; refunding 1 dollar; please take your money');
            },
            defaultTargetState: "IDLE"
        }
    }
}

class TwoDollarsInsertedState extends TemplateState<VendingMachineEvents, BaseContext, VendingMachineStates> {
    protected _eventReactions: EventReactions<VendingMachineEvents, BaseContext, VendingMachineStates> = {
        "insertBills": {
            action: (context, event, stateMachine) => {
                console.log("inserted bills");
            },
            defaultTargetState: "THREE_DOLLARS_INSERTED"
        },
        "selectCoke": {
            action: (context, event, stateMachine) => {
                console.log("selected coke; thank you for your purchase");
            },
            defaultTargetState: "IDLE"
        },
        "selectRedBull": {
            action: (context, event, stateMachine) => {
                console.log('selected red bull; thank you for your purchase');
            },
            defaultTargetState: "IDLE"
        },
        "selectWater": {
            action: (context, event, stateMachine) => {
                console.log('selected water; not enough money, 1 dollars short, please insert more money');
            },
        },
        "cancelTransaction": {
            action: (context, event, stateMachine) => {
                console.log('cancelled transaction; refunding 2 dollars; please take your money');
            },
            defaultTargetState: "IDLE"
        }
    }
}

class ThreeDollarsInsertedState extends TemplateState<VendingMachineEvents, BaseContext, VendingMachineStates> {
    protected _eventReactions: EventReactions<VendingMachineEvents, BaseContext, VendingMachineStates> = {
        "insertBills": {
            action: (context, event, stateMachine) => {
                console.log('not taking more bills; returning the inserted bills');
            },
        },
        "selectCoke": {
            action: (context, event, stateMachine) => {
                console.log("selected coke; change: 1 dollar");
            },
            defaultTargetState: "IDLE"
        },
        "selectRedBull": {
            action: (context, event, stateMachine) => {
                console.log('selected red bull; change: 2 dollars');
            },
            defaultTargetState: "IDLE"
        },
        "selectWater": {
            action: (context, event, stateMachine) => {
                console.log('selected water; no change');
            },
        },
        "cancelTransaction": {
            action: (context, event, stateMachine) => {
                console.log('cancelled transaction; refunding 3 dollars; please take your money');
            },
            defaultTargetState: "IDLE"
        }
    }
}

const context: BaseContext = {
    setup: () => {},
    cleanup: () => {},
}

export const createVendingMachine = () => new TemplateStateMachine<VendingMachineEvents, BaseContext, VendingMachineStates>({
    "IDLE": new IdleState(),
    "ONE_DOLLAR_INSERTED": new OneDollarInsertedState(),
    "TWO_DOLLARS_INSERTED": new TwoDollarsInsertedState(),
    "THREE_DOLLARS_INSERTED": new ThreeDollarsInsertedState(),
}, "IDLE", context);

console.log('test');

