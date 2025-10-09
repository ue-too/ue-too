# being

This is a library that helps with building finite state machines. 

> Disclaimer: I am not an expert on finite state machines, this is just what I use and it works for me, and the features are tailored to what I need. You would probably better off using a library like [xstate](https://stately.ai/docs).

If you still want to try it out, here is an example of how to use it:

Let's take the example of a traffic light that has a few states:

- Green
- Yellow
- Red

For these states to transition to one another, we need events that could happen:
- button press
- timer
- sensor
- etc.

For now let's keep it simple and just have a button press event. (not realistic but it's just an example)

So the behavior of the traffic light would be: each button press would transition the traffic light to the next state.

Green -> Yellow -> Red -> (loop back to) Green.

Now let's implement it using being:

First we need to define the states: 

```typescript

type TrafficLightStates = "GREEN" | "YELLOW" | "RED";

```

Then we need to define the events and their payloads: (right now it's just a button press event)

Since we don't need any payload for the button press event, we can just use an empty object.
```typescript
type TrafficLightEvents = {
    buttonPress: {};
};
```

If there are states(application states) that need to persist across states(state machine states), we can use the context to do so.
Note that context that is used in a state machine should implements the `BaseContext` interface.

```typescript
type Context = {
    // states you might want to persist across states
    buttonPressCount: number;
} & BaseContext; 

// or 
class TrafficLightContext implements BaseContext {
    buttonPressCount: number = 0;
    setup(): () => {};
    cleanup(): () => {};
}
```
Otherwise, you can not use the context as the generic parameter for the state machine.

We need to create a state class for every possible state; we can extend from the TemplateState class to help us with the boilerplate code.

```typescript
import { TemplateState, BaseContext, EventReactions } from "@ue-too/being";

class GreenState extends TemplateState<TrafficLightEvents, BaseContext, TrafficLightStates> {
    public eventReactions: EventReactions<TrafficLightEvents, {}, TrafficLightStates> = {
        buttonPress: () => "YELLOW",
    };

}
```
