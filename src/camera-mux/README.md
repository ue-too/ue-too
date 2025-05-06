# The camera input multiplexer

The sole purpose of this module is to have the logic of controlling what camera input is allowed.

For example, if you have a camera transition animation, you might want the transition to be able to be interrupted by the user's input.

The interface `CameraMux` only specifies the user input. `notifyPanInput`, `notifyZoomInput`, `notifyRotateInput` and `notifyAllInput`.

The `Relay` class is the simplest implementation of the `CameraMux` interface. It simply relays the input to the camera.

You might not want to control the camera input in this way; you are not limited in any way. Just come up with your own logic and set the position of the camera accordingly. (highly recommended to use the `CameraRig` class to control the camera even if you're not using the `CameraMux`)

In the `animation-and-lock.ts` file there's a `CameraMuxWithAnimationAndLock` class that implements the `CameraMux` interface and adds the logic of the camera transition animation and the lock input.

This uses the state machine pattern to coordinate the camera input. You can use the similar patter or create a camera mux using you own logic.

The `Board` class uses the `CameraMux` interface to control the camera input. So if you have your own camera mux, and you want to use it to substitute the default one, make sure it implements the `CameraMux` interface. But don't use the camera mux inside the `Board` class like this:

```ts
// don't do this
board.cameraMux.yourOwnInput(value); // CameraMux interface doesn't have yourOwnInput method
```
Typescript would scream at you.

Instead, hold a reference to the camera mux and use it to send input to the camera mux.

```ts
// hold a reference to the camera mux
const cameraMux = new YourOwnCameraMux();
board.cameraMux = cameraMux;

// send input to the camera mux through the variable
cameraMux.yourOwnInput(value);
```

Or not use the `Board` class at all.

The camera mux is entirely optional. Only customize it if you need it, you can skip it all together. 

