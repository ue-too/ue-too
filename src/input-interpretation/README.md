# User Input Interpretation

This is more of a demonstration of how to interpret user input. I am using the state machine pattern to achieve this.

You can have your own way of interpreting user input. After interpreting the input, you can set the state of the camera directly with the `setPosition`, `setZoomLevel`, `setRotation` methods or use the camera rig as mentioned in the [board camera README](../board-camera/README.md).

There are 2 parts: 1. the layer to register event handlers. 2. the state machine to react on different events at different states.

### Input Event Handler
This is the layer that registers event handlers for different events. Because event systems are different for each rendering options. 
For example, vanilla canvas API is not the same as pixi.js's event system they have different event payload even different event names.

### Input State Machine

The state diagram for keyboard mouse, and trackpad input is shown below:
![kmt-input-state-machine](../../doc-media/kmt-input-state-machine.png)

The state diagram for touch input is shown below:
![touch-input-state-machine](../../doc-media/touch-input-state-machine.png)

You can customize how the state machine works by defining the relationship between each state in a state machine. There's a tiny library within `board` that's dedicated for this purpose.
Look into the `src/being` directory for more. (Detailed documentation will follow with the documentation site (WIP))
