/**
 * Example: How to use a schema generated from StateMachineBuilder
 * 
 * This demonstrates how to:
 * 1. Create a context object from a schema definition
 * 2. Instantiate a state machine from the schema
 * 3. Access and manipulate context data
 * 4. Trigger events and observe state transitions
 */

import { createStateMachineFromSchema, BaseContext, StateMachineSchema } from '@ue-too/being';

// Example: Context interface matching what you defined in the builder
interface MyContext extends BaseContext {
  counter: number;
  balance: number;
  items: string[];
  setup(): void;
  cleanup(): void;
}

// Example: Schema structure (this is what gets generated)
// In practice, you would load this from your generated schema JSON
const exampleSchema: StateMachineSchema<MyContext, any> = {
  states: ["IDLE", "ACTIVE", "PAUSED"],
  events: {
    start: {},
    stop: {},
    pause: {},
    increment: { amount: 0 },
  },
  initialState: "IDLE",
  stateDefinitions: [
    {
      name: "IDLE",
      transitions: [
        {
          event: "start",
          targetState: "ACTIVE",
          action: (context) => {
            console.log("Starting...");
            context.counter = 0;
          },
        },
      ],
    },
    {
      name: "ACTIVE",
      transitions: [
        {
          event: "increment",
          targetState: "ACTIVE",
          action: (context, payload: any) => {
            context.counter += payload.amount || 1;
            console.log(`Counter: ${context.counter}`);
          },
        },
        {
          event: "pause",
          targetState: "PAUSED",
        },
        {
          event: "stop",
          targetState: "IDLE",
          action: (context) => {
            console.log(`Stopped. Final counter: ${context.counter}`);
          },
        },
      ],
    },
    {
      name: "PAUSED",
      transitions: [
        {
          event: "start",
          targetState: "ACTIVE",
        },
        {
          event: "stop",
          targetState: "IDLE",
        },
      ],
    },
  ],
};

// Step 1: Create a context instance
// This matches the fields you defined in the StateMachineBuilder
const myContext: MyContext = {
  counter: 0,
  balance: 100,
  items: [],
  setup() {
    // Called when the state machine starts
    this.counter = 0;
    this.balance = 100;
    this.items = [];
    console.log("Context initialized");
  },
  cleanup() {
    // Called when the state machine is cleaned up
    console.log("Context cleaned up");
  },
};

// Step 2: Create the state machine from the schema
const machine = createStateMachineFromSchema(exampleSchema, myContext);

// Step 3: Use the state machine

// Access the current state
console.log("Initial state:", (machine as any).currentState);

// Listen to state changes
machine.onStateChange((currentState, nextState) => {
  console.log(`State changed: ${currentState} → ${nextState}`);
});

// Step 4: Manipulate context data directly
// You can modify context properties at any time
myContext.balance = 150;
myContext.items.push("item1", "item2");
console.log("Context balance:", myContext.balance);
console.log("Context items:", myContext.items);

// Step 5: Trigger events
// Events without payload
(machine.happens as any)("start");
console.log("State after start:", (machine as any).currentState);
console.log("Counter after start:", myContext.counter);

// Events with payload
machine.happens("increment", { amount: 5 });
machine.happens("increment", { amount: 10 });
console.log("Counter after increments:", myContext.counter);

// Modify context during state machine operation
myContext.counter = 100; // Direct manipulation
console.log("Manually set counter to:", myContext.counter);

// Trigger more events
(machine.happens as any)("pause");
console.log("State after pause:", (machine as any).currentState);

(machine.happens as any)("start");
console.log("State after resume:", (machine as any).currentState);

(machine.happens as any)("stop");
console.log("Final state:", (machine as any).currentState);
console.log("Final counter:", myContext.counter);

// Step 6: Reset the machine
machine.reset();
console.log("After reset - State:", (machine as any).currentState);
console.log("After reset - Counter:", myContext.counter); // Should be reset by setup()

/**
 * Key Takeaways:
 * 
 * 1. Context is a regular object - you can read/write properties directly
 * 2. The state machine manages state transitions, but context data is yours to control
 * 3. Actions in transitions can modify context, but you can also modify it externally
 * 4. The setup() method is called when the machine starts/resets
 * 5. The cleanup() method is called when the machine is wrapped up
 * 6. You can listen to state changes with onStateChange()
 * 7. Events are triggered with machine.happens(eventName, payload?)
 */
