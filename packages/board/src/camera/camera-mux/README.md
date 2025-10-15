# Camera Input Multiplexer

This module manages and controls camera input permissions and behavior.

For instance, during a camera transition animation, you may want to allow user input to interrupt the transition.

The `CameraMux` interface defines the following user input methods:
- `notifyPanInput`
- `notifyZoomInput`
- `notifyRotateInput`
- `notifyAllInput`

The `Relay` class provides the simplest implementation of the `CameraMux` interface, directly forwarding input to the camera.

You are not limited to this implementation approach. You can develop your own logic and control the camera position accordingly. (We recommend using the `CameraRig` class for camera control, even if you're not using `CameraMux`)

The `animation-and-lock.ts` file contains the `CameraMuxWithAnimationAndLock` class, which implements the `CameraMux` interface and adds camera transition animation and input locking functionality.

This implementation uses the state machine pattern to coordinate camera input. You can follow a similar pattern or create your own camera multiplexer with custom logic.

The `Board` class uses the `CameraMux` interface to control camera input. If you want to substitute the default implementation with your own camera multiplexer, ensure it implements the `CameraMux` interface. However, avoid using the camera multiplexer inside the `Board` class like this:

```ts
// Incorrect usage
board.cameraMux.yourOwnInput(value); // TypeScript will error as CameraMux interface doesn't have yourOwnInput method
```

Instead, maintain a reference to the camera multiplexer and use it to send input:

```ts
// Correct usage
const cameraMux = new YourOwnCameraMux();
board.cameraMux = cameraMux;

// Send input through the reference
cameraMux.yourOwnInput(value);
```

Alternatively, you can choose not to use the `Board` class at all.

The camera multiplexer is entirely optional. Only implement it if you need its functionality; you can skip it entirely if not required. 
