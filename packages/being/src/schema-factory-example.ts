/**
 * Example demonstrating runtime state machine creation from schema.
 *
 * @remarks
 * This example shows how to use the schema factory to create state machines
 * dynamically at runtime, which is useful for GUI builders or configuration-driven
 * state machines.
 */

import { BaseContext } from "./interface";

import {
  createStateMachineFromSchema,
  StateMachineSchema,
  ActionFunction,
  GuardFunction,
} from "./schema-factory";

/**
 * Example: Timer state machine with IDLE, RUNNING, and PAUSED states.
 */
interface TimerContext extends BaseContext {
  elapsed: number;
  startTime: number;
  pausedTime: number;
}

// Define event payload types
type TimerEvents = {
  start: {};
  stop: {};
  pause: {};
  resume: {};
  tick: { delta: number };
};

// Define state names as a type for better type inference
type TimerStates = "IDLE" | "RUNNING" | "PAUSED";

// Define the schema with typed events and states
const timerSchema: StateMachineSchema<TimerContext, TimerEvents, TimerStates> = {
  states: ["IDLE", "RUNNING", "PAUSED"],
  events: {
    start: {},
    stop: {},
    pause: {},
    resume: {},
    tick: { delta: 0 }, // Type is inferred from TimerEvents
  },
  initialState: "IDLE",
  stateDefinitions: [
    {
      name: "IDLE",
      transitions: [
        {
          event: "start",
          targetState: "RUNNING",
          action: ((context) => {
            console.log("Timer started");
            context.startTime = Date.now();
            context.elapsed = 0;
          })
        },
      ],
      onEnter: (context) => {
        console.log("Entered IDLE state");
      },
    },
    {
      name: "RUNNING",
      transitions: [
        {
          event: "stop",
          targetState: "IDLE",
          action: ((context) => {
            console.log(`Timer stopped. Elapsed: ${context.elapsed}ms`);
          })
        },
        {
          event: "pause",
          targetState: "PAUSED",
          action: ((context) => {
            console.log("Timer paused");
            context.pausedTime = Date.now();
          })
        },
        {
          event: "tick",
          targetState: "RUNNING", // Stay in RUNNING
          action: ((context, payload) => {
            // payload is now typed as { delta: number }
            context.elapsed += payload.delta;
          })
        },
      ],
      onEnter: (context) => {
        console.log("Entered RUNNING state");
      },
      onExit: (context) => {
        console.log("Exiting RUNNING state");
      },
    },
    {
      name: "PAUSED",
      transitions: [
        {
          event: "resume",
          targetState: "RUNNING",
          action: ((context) => {
            const pauseDuration = Date.now() - context.pausedTime;
            console.log(`Resumed after ${pauseDuration}ms pause`);
          })
        },
        {
          event: "stop",
          targetState: "IDLE",
          action: ((context) => {
            console.log(`Timer stopped from paused state. Total elapsed: ${context.elapsed}ms`);
          })
        },
      ],
      onEnter: (context) => {
        console.log("Entered PAUSED state");
      },
    },
  ],
};

// Create context
const timerContext: TimerContext = {
  elapsed: 0,
  startTime: 0,
  pausedTime: 0,
  setup() {
    this.elapsed = 0;
    this.startTime = 0;
    this.pausedTime = 0;
  },
  cleanup() {
    console.log("Timer context cleaned up");
  },
};

// Create state machine from schema
const timer = createStateMachineFromSchema(timerSchema, timerContext);

// Test the state machine
console.log("=== Timer State Machine Demo ===\n");

console.log("1. Starting timer...");
(timer.happens as any)("start");
console.log(`Current state: ${(timer as any).currentState}\n`);

console.log("2. Simulating ticks...");
timer.happens("tick", { delta: 100 });
timer.happens("tick", { delta: 50 });
console.log(`Elapsed: ${timerContext.elapsed}ms`);
console.log(`Current state: ${(timer as any).currentState}\n`);

console.log("3. Pausing...");
(timer.happens as any)("pause");
console.log(`Current state: ${(timer as any).currentState}\n`);

console.log("4. Resuming...");
(timer.happens as any)("resume");
console.log(`Current state: ${(timer as any).currentState}\n`);

console.log("5. Stopping...");
(timer.happens as any)("stop");
console.log(`Current state: ${(timer as any).currentState}\n`);

/**
 * Example: Vending machine with guards for conditional transitions.
 */
interface VendingContext extends BaseContext {
  balance: number;
  selectedItem: string | null;
  itemPrice: number;
}

type VendingEvents = {
  insertBill: {};
  selectCoke: {};
  selectRedBull: {};
  selectWater: {};
  cancel: {};
};

// Define state names as a type for better type inference
type VendingStates = "IDLE" | "ONE_DOLLAR" | "TWO_DOLLARS" | "THREE_DOLLARS";

const vendingSchema: StateMachineSchema<VendingContext, VendingEvents, VendingStates> = {
  states: ["IDLE", "ONE_DOLLAR", "TWO_DOLLARS", "THREE_DOLLARS"],
  events: {
    insertBill: {},
    selectCoke: {},
    selectRedBull: {},
    selectWater: {},
    cancel: {},
  },
  initialState: "IDLE",
  stateDefinitions: [
    {
      name: "IDLE",
      transitions: [
        {
          event: "insertBill",
          targetState: "ONE_DOLLAR",
          action: ((context) => {
            const ctx = context;
            ctx.balance = 1;
            console.log("Inserted $1. Balance: $1");
          }),
        },
      ],
    },
    {
      name: "ONE_DOLLAR",
      transitions: [
        {
          event: "insertBill",
          targetState: "TWO_DOLLARS",
          action: ((context) => {
            const ctx = context;
            ctx.balance = 2;
            console.log("Inserted $1. Balance: $2");
          }),
        },
        {
          event: "selectCoke",
          targetState: "IDLE",
          action: ((context) => {
            const ctx = context;
            console.log("Dispensing Coke. Thank you!");
            ctx.balance = 0;
          }),
        },
        {
          event: "selectRedBull",
          targetState: "ONE_DOLLAR", // Stay - not enough money
          action: ((context) => {
            console.log("Not enough money. Need $2, have $1");
          }),
        },
        {
          event: "cancel",
          targetState: "IDLE",
          action: ((context) => {
            const ctx = context;
            console.log("Cancelled. Refunding $1");
            ctx.balance = 0;
          }),
        },
      ],
    },
    {
      name: "TWO_DOLLARS",
      transitions: [
        {
          event: "insertBill",
          targetState: "THREE_DOLLARS",
          action: ((context) => {
            const ctx = context;
            ctx.balance = 3;
            console.log("Inserted $1. Balance: $3");
          }),
        },
        {
          event: "selectCoke",
          targetState: "IDLE",
          action: ((context) => {
            const ctx = context;
            console.log("Dispensing Coke. Change: $1");
            ctx.balance = 0;
          }),
        },
        {
          event: "selectRedBull",
          targetState: "IDLE",
          action: ((context) => {
            const ctx = context;
            console.log("Dispensing Red Bull. Thank you!");
            ctx.balance = 0;
          }),
        },
        {
          event: "selectWater",
          targetState: "TWO_DOLLARS", // Stay - not enough
          action: ((context) => {
            console.log("Not enough money. Need $3, have $2");
          }),
        },
        {
          event: "cancel",
          targetState: "IDLE",
          action: ((context) => {
            const ctx = context;
            console.log("Cancelled. Refunding $2");
            ctx.balance = 0;
          }),
        },
      ],
    },
    {
      name: "THREE_DOLLARS",
      transitions: [
        {
          event: "selectCoke",
          targetState: "IDLE",
          action: ((context) => {
            const ctx = context;
            console.log("Dispensing Coke. Change: $2");
            ctx.balance = 0;
          }),
        },
        {
          event: "selectRedBull",
          targetState: "IDLE",
          action: ((context) => {
            const ctx = context;
            console.log("Dispensing Red Bull. Change: $1");
            ctx.balance = 0;
          }),
        },
        {
          event: "selectWater",
          targetState: "IDLE",
          action: ((context) => {
            const ctx = context;
            console.log("Dispensing Water. Thank you!");
            ctx.balance = 0;
          }),
        },
        {
          event: "cancel",
          targetState: "IDLE",
          action: ((context) => {
            const ctx = context;
            console.log("Cancelled. Refunding $3");
            ctx.balance = 0;
          }),
        },
      ],
    },
  ],
};

const vendingContext: VendingContext = {
  balance: 0,
  selectedItem: null,
  itemPrice: 0,
  setup() {
    this.balance = 0;
    this.selectedItem = null;
    this.itemPrice = 0;
  },
  cleanup() {},
};

const vendingMachine = createStateMachineFromSchema(vendingSchema, vendingContext);

console.log("\n=== Vending Machine Demo ===\n");

console.log("1. Inserting $1...");
(vendingMachine.happens as any)("insertBill");
console.log(`Current state: ${(vendingMachine as any).currentState}\n`);

console.log("2. Trying to buy Red Bull (needs $2)...");
(vendingMachine.happens as any)("selectRedBull");
console.log(`Current state: ${(vendingMachine as any).currentState}\n`);

console.log("3. Inserting another $1...");
(vendingMachine.happens as any)("insertBill");
console.log(`Current state: ${(vendingMachine as any).currentState}\n`);

console.log("4. Buying Red Bull...");
(vendingMachine.happens as any)("selectRedBull");
console.log(`Current state: ${(vendingMachine as any).currentState}\n`);

/**
 * Example: State machine with guards for conditional transitions.
 */
interface PaymentContext extends BaseContext {
  balance: number;
  itemPrice: number;
  hasDiscount: boolean;
}

type PaymentEvents = {
  selectItem: { price: number };
  applyDiscount: {};
  pay: { amount: number };
  confirm: {};
};

// Define state names as a type for better type inference
type PaymentStates = "SELECTING" | "PAYING" | "CONFIRMED";

const paymentSchema: StateMachineSchema<PaymentContext, PaymentEvents, PaymentStates> = {
  states: ["SELECTING", "PAYING", "CONFIRMED"],
  events: {
    selectItem: { price: 0 },
    applyDiscount: {},
    pay: { amount: 0 },
    confirm: {},
  },
  initialState: "SELECTING",
  stateDefinitions: [
    {
      name: "SELECTING",
      transitions: [
        {
          event: "selectItem",
          targetState: "PAYING",
          action: (context, payload) => {
            context.itemPrice = payload.price;
            console.log(`Selected item. Price: $${context.itemPrice}`);
          },
        },
      ],
    },
    {
      name: "PAYING",
      /**
       * Define reusable guards at the state level.
       * These guards can be referenced by name in any transition's guards array,
       * avoiding duplication when the same guard logic is needed for multiple events.
       * Note: Guards are correctly typed with PaymentContext, not BaseContext.
       */
      guards: {
        hasEnoughBalance: (context) => {
          return context.balance >= context.itemPrice;
        },
        hasInsufficientBalance: (context) => {
          return context.balance < context.itemPrice;
        },
      },
      transitions: [
        {
          event: "applyDiscount",
          targetState: "PAYING", // Stay in PAYING
          action: (context) => {
            context.hasDiscount = true;
            context.itemPrice *= 0.9; // 10% discount
            console.log(`Discount applied. New price: $${context.itemPrice.toFixed(2)}`);
          },
        },
        {
          event: "pay",
          targetState: "SELECTING", // Default if guards don't match
          action: (context, payload) => {
            context.balance += payload.amount;
            console.log(`Paid $${payload.amount}. Balance: $${context.balance}`);
          },
          /**
           * Reference guards by name instead of defining them inline.
           * This allows the same guard logic to be reused across multiple events
           * within the same state without duplication.
           */
          guards: [
            {
              guard: "hasEnoughBalance", // Reference to state-level guard
              targetState: "CONFIRMED",
            },
            {
              guard: "hasInsufficientBalance", // Reference to state-level guard
              targetState: "PAYING", // Stay in PAYING if not enough
            },
          ],
        },
      ],
    },
    {
      name: "CONFIRMED",
      transitions: [
        {
          event: "confirm",
          targetState: "SELECTING",
          action: (context) => {
            const change = context.balance - context.itemPrice;
            console.log(`Payment confirmed! Change: $${change.toFixed(2)}`);
            context.balance = 0;
            context.itemPrice = 0;
            context.hasDiscount = false;
          },
        },
      ],
    },
  ],
};

const paymentContext: PaymentContext = {
  balance: 0,
  itemPrice: 0,
  hasDiscount: false,
  setup() {
    this.balance = 0;
    this.itemPrice = 0;
    this.hasDiscount = false;
  },
  cleanup() {},
};

const paymentMachine = createStateMachineFromSchema(paymentSchema, paymentContext);

console.log("\n=== Payment Machine with Guards Demo ===\n");

console.log("1. Selecting item ($10)...");
(paymentMachine.happens as any)("selectItem", { price: 10 });
console.log(`Current state: ${(paymentMachine as any).currentState}\n`);

console.log("2. Paying $5 (not enough)...");
(paymentMachine.happens as any)("pay", { amount: 5 });
console.log(`Current state: ${(paymentMachine as any).currentState}\n`);

console.log("3. Paying $3 more (total $8, still not enough)...");
(paymentMachine.happens as any)("pay", { amount: 3 });
console.log(`Current state: ${(paymentMachine as any).currentState}\n`);

console.log("4. Applying discount (10% off, new price $9)...");
(paymentMachine.happens as any)("applyDiscount");
console.log(`Current state: ${(paymentMachine as any).currentState}\n`);

console.log("5. Paying $2 more (total $10, enough now)...");
(paymentMachine.happens as any)("pay", { amount: 2 });
console.log(`Current state: ${(paymentMachine as any).currentState}\n`);

console.log("6. Confirming payment...");
(paymentMachine.happens as any)("confirm");
console.log(`Current state: ${(paymentMachine as any).currentState}\n`);

/**
 * Example: State machine with action outputs.
 * Actions can return values that are included in the event result.
 */
interface CalculatorContext extends BaseContext {
  value: number;
  history: number[];
}

type CalculatorEvents = {
  add: { amount: number };
  multiply: { factor: number };
  getResult: {};
  reset: {};
};

// Define state names as a type for better type inference
type CalculatorStates = "READY" | "CALCULATING";

// Define output types for events that return values
type CalculatorOutputs = {
  getResult: number; // getResult event returns a number
  add: number; // add event returns the new total
  multiply: number; // multiply event returns the new total
};

const calculatorSchema: StateMachineSchema<CalculatorContext, CalculatorEvents, CalculatorStates, CalculatorOutputs> = {
  states: ["READY", "CALCULATING"],
  events: {
    add: { amount: 0 },
    multiply: { factor: 0 },
    getResult: {},
    reset: {},
  },
  initialState: "READY",
  stateDefinitions: [
    {
      name: "READY",
      transitions: [
        {
          event: "add",
          targetState: "READY",
          action: (context, payload) => {
            context.value += payload.amount;
            context.history.push(context.value);
            // Return the new total as output
            return context.value;
          },
        },
        {
          event: "multiply",
          targetState: "READY",
          action: (context, payload) => {
            context.value *= payload.factor;
            context.history.push(context.value);
            // Return the new total as output
            return context.value;
          },
        },
        {
          event: "getResult",
          targetState: "READY",
          action: (context) => {
            // Return the current value as output
            return context.value;
          },
        },
        {
          event: "reset",
          targetState: "READY",
          action: (context) => {
            context.value = 0;
            context.history = [];
            // No output for reset
          },
        },
      ],
    },
  ],
};

const calculatorContext: CalculatorContext = {
  value: 0,
  history: [],
  setup() {
    this.value = 0;
    this.history = [];
  },
  cleanup() {},
};

const calculator = createStateMachineFromSchema(
  calculatorSchema,
  calculatorContext
);

console.log("\n=== Calculator with Action Outputs Demo ===\n");

console.log("1. Adding 10...");
const addResult = calculator.happens("add", { amount: 10 });
if (addResult.handled && "output" in addResult) {
  console.log(`Result: ${addResult.output} (from action output)`);
}
console.log(`Current value: ${calculatorContext.value}\n`);

console.log("2. Multiplying by 3...");
const multiplyResult = calculator.happens("multiply", { factor: 3 });
if (multiplyResult.handled && "output" in multiplyResult) {
  console.log(`Result: ${multiplyResult.output} (from action output)`);
}
console.log(`Current value: ${calculatorContext.value}\n`);

console.log("3. Getting result...");
const getResultResult = calculator.happens("getResult");
if (getResultResult.handled && "output" in getResultResult) {
  console.log(`Result: ${getResultResult.output} (from action output)`);
}
console.log(`Current value: ${calculatorContext.value}\n`);

console.log("4. Adding 5 more...");
const addResult2 = calculator.happens("add", { amount: 5 });
if (addResult2.handled && "output" in addResult2) {
  console.log(`Result: ${addResult2.output} (from action output)`);
}
console.log(`Current value: ${calculatorContext.value}\n`);

console.log("5. Resetting...");
const resetResult = calculator.happens("reset");
if (resetResult.handled) {
  console.log("Reset complete (no output)");
}
console.log(`Current value: ${calculatorContext.value}\n`);
