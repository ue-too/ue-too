# Board Camera

This is one of three core modules.

This module consists of the following sub-modules:
- `board-camera`: the core of the board camera.
- `camera-rig`: camera rig transforms camera input based on the configuration (e.g. clamping, restriction, etc.) before passing it to the board camera.
- `camera-update-publisher`: publish the camera updates to the callbacks.
- `camera-update-batcher`: batch camera updates. (very unstable, please don't use it yet)

## What `BoardCamera` is for ?
- Holds the viewport information
- Converts the viewport information to a transform matrix that can be used in various rendering engines. (e.g. Vanilla Canvas, pixi.js, fabric.js, etc.)
- Converts points in the viewport coordinate system to the world coordinate system and vice versa.


## The analogy behind the camera (viewport)
Before we get into the detail of the API of the `BoardCamera` class, let's first talk about the analogy behind the camera (viewport) to align some of the assumptions made in the API.

Panning and zooming a canvas requires a viewport. You might have seen this concept in many many other libraries that achieves the infinite canvas effect. (It's even in the name of pixi-viewport)
It's like the viewBox in SVG. You see the bigger picture only through the viewport.

Imagine you have a painting that is drawn on a big sheet of paper. You are given a rectangle bracket to be placed on the paper, that rectangle bracket is the viewport. Only things within the bracket are visible to you.

The viewport is essentially the canvas element in the browser in your screen. 
You can see "part" of an infinite canvas (the big sheet of paper) through the canvas element. 

This analogy falls short when you consider the zooming effect though. It's harder to visualize. 
Maybe think of it like the size of the bracket is changed when you zoom in and out. Here's the tricky part. The size change is only relative to the paper. Not to the viewer.
The size of the viewport as seen by the user is always the same. (the canvas element's size in the screen stays the same regardless of the zoom level)

With those out of the way, let's get into the details of the API!

## The API

### The `BoardCamera` interface and the default implementation

There are 2 kinds of board camera interfaces. One is the `BoardCamera` interface and the other is the `ObservableBoardCamera` interface.

`ObservableBoardCamera` extends the `BoardCamera` interface and adds the ability to observe the camera state changes. (this is useful for when you only want to redraw the canvas when the camera state changes)

The `BaseCamera` class implements the `BoardCamera` interface. But the default `DefaultBoardCamera` is used in the `Board` class, and it implements the `ObservableBoardCamera` interface.

We'll talk about observing the camera state changes in a later section but for now, let's focus on the common methods and properties of the `BoardCamera` interface. They differ only in the being observable part.

#### The common methods and properties of the `DefaultBoardCamera` and the `BaseCamera` class

I'll refer to them as the board camera from now on for this section.

All arguments of the board camera constructor are optional. It provides the default values. 
However, there are two arguments that you should keep in mind. 

Those are the `viewPortWidth` and the `viewPortHeight`.
These are the dimensions of the viewport aka the size of the canvas element in the screen. (in CSS pixels)
These are not necessarily the dimensions of the canvas element you specify in the html or jsx.

On high DPI screens, you may have specified higher `width` and `height` and scaled down the CSS style size of the canvas element.

Usually in this case, `width` would be the product of the CSS style width and the device pixel ratio. 

Like in this example in the [MDN docs](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio).

The board camera need the style width not the canvas width. 

To mark the importance of the style width and height, they are the first two arguments of the constructor.

You can also set the `viewPortWidth` and the `viewPortHeight` properties after the board camera is initialized.

```typescript
    const boardCamera = new DefaultBoardCamera(100, 100);
    boardCamera.viewPortWidth = 1000;
    boardCamera.viewPortHeight = 1000;
```

It's useful when you want to update the size of the viewport when the size of the canvas element changes.

Make sure to set the correct `viewPortWidth` and `viewPortHeight` otherwise the coordinates tranformation would be incorrect. The viewport transformation matrix would also be incorrect.

#### The position, zoom level and rotation of the board camera

The board camera holds 3 properties that is relevant to the transform matrix that is supplied to the rendering engine.

Those are the `position`, the `zoomLevel` and the `rotation`.

The `position` is the position of the camera in the world coordinate system.
The position of the `position` of the camera within the viewport is at the center of the viewport. (also the center of the canvas element)

In other words, `position` represents where the center of the canvas element is in the world coordinate system. (the position of the center of the rectangular bracket on the big sheet of paper)

The `zoomLevel` is how much the viewport is zoomed in or out. The bigger the zoom level, the more zoomed in the viewport is. (object in the viewport appears bigger than it is in world coordinate system)

The `rotation` is the rotation of the viewport around the `position` of the camera.

You can directly access the `position`, the `zoomLevel` and the `rotation` properties of the board camera.

```typescript
    const boardCamera = new DefaultBoardCamera(100, 100);
    console.log(boardCamera.position);
    console.log(boardCamera.zoomLevel);
    console.log(boardCamera.rotation);
```

However, you can't set the `position`, the `zoomLevel` and the `rotation` properties of the board camera directly.

You can only set these properties through the `setPosition`, `setZoomLevel` and `setRotation` methods.

```typescript
    boardCamera.setPosition(100, 100);
    boardCamera.setZoomLevel(2);
    boardCamera.setRotation(Math.PI / 4);
```

This is to force the user to be explicit about the camera state changes, also to have a way to do boundary checks and other logic before the camera state changes.

There is one thing about the board camera that I want to mention. The position, zoom level and rotation all have their own boundaries. They are optional. 
If they are present, when setting the position, zoom level and rotation the are outside of the boundaries, the set functions would not change the camera state.

The set functions would return false if the camera state is not changed.

```typescript
    const res = boardCamera.setPosition(100, 100);
    console.log(res); // false if 100, 100 is outside of the boundaries otherwise true
```

Clamping is not handled by the board camera. It is the responsibility of the `CameraRig`. That is why although you can set the position, zoom level and rotation through the set functions, it is recommended to use the `CameraRig` instead. 

I'll talk about the camera rig in the next section.

There's one more thing about the board camera: the `getTransform` method. 

This method is used to get the transform matrix that is supplied to the rendering engine.

It takes two arguments: 
- `devicePixelRatio`: the device pixel ratio of the screen.
- `alignCoordinate`: whether to keep using the coordinate system the html canvas uses. (in most cases you should keep this true, positive y is up and clockwise is the position rotation direction)

```typescript
    const transform = boardCamera.getTransform(devicePixelRatio, true);
```

Usually for the device pixel ratio, you can use the `window.devicePixelRatio` property. But for pixi.js, you should just use 1 because pixi.js handles the resizing of the canvas element internally. (using the `autoDensity` property of the renderer)

After getting the transform matrix, you can use it to transform the context (renderer) of the rendering engine.

For vanilla canvas, you can use the `setTransform` method of the 2d context.

```typescript
    const ctx = canvas.getContext('2d');
    ctx.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
```

For pixi.js, you can use the `setFromMatrix` method of the stage (`Container`).

```typescript
    app.stage.setFromMatrix(new Matrix(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f));
```

#### The `CameraRig`

The `CameraRig` is an abstraction layer that allows you to define camera panning, zooming and rotation behavior without directly manipulating the camera state.
This is useful when you want to have a more complex camera behavior. For example, the default camera rig handles the clamping and the restriction of the camera movement.

When you pan with the default camera rig, it'll automatically clamp the camera so you can move the camera even when you specify a destination or a delta that would cause the camera to move outside of the boundaries. This clamping behavior of the default camera rig can be turned off though. 

```typescript
    // turn off the clamping behavior; the default is true
    cameraRig.configure({clampTranslation: false});
```

The default camera rig also handles restrictions. For example if you do not want the camera to have lateral movement, you can configure the camera rig to only allow vertical movement.

```typescript
    // turn on lateral movement restriction; the default is false
    cameraRig.configure({restrictTranslationX: true});
```

There's a util function that creates a camera rig with the default configuration given a board camera.

```typescript
    const boardCamera = new DefaultBoardCamera();
    const cameraRig = createDefaultCameraRig(boardCamera);
```

Then you can use the camera rig to pan, zoom and rotate the board camera.

```typescript
    cameraRig.panByViewPort({x: 100, y: 100}); // pan by 100px in the viewport coordinate system
    cameraRig.zoomBy(2); // zoom by 2; here the delta is addition not multiplication
    cameraRig.rotateBy(Math.PI / 4); // rotate by a certain radian
```

The available methods of the camera rig are:
- `panByViewPort`: pan by a certain amount in the viewport coordinate system.
- `panByWorld`: pan by a certain amount in the world coordinate system.
- `panToViewPort`: pan to a certain position in the viewport coordinate system. (currently this does not check if the destination is outside the viewport meaning that the destination is not currently visible within the viewport)
- `panToWorld`: pan to a certain position in the world coordinate system.
- `zoomBy`: zoom by a certain amount. (this is addition not multiplication) the anchor point would be the center of the viewport.
- `zoomByAt`: zoom by a certain amount at a certain position in the viewport coordinate system. (this is addition not multiplication)
- `zoomByAtWorld`: zoom by a certain amount at a certain position in the world coordinate system. (this is addition not multiplication)
- `zoomTo`: zoom to a certain level. the anchor point would be the center of the viewport.
- `zoomToAt`: zoom to a certain level at a certain position in the viewport coordinate system.
- `zoomToAtWorld`: zoom to a certain level at a certain position in the world coordinate system.
- `rotateTo`: rotate to a certain angle at a certain position in the viewport coordinate system.
- `rotateBy`: rotate by a certain amount at a certain position in the world coordinate system.

#### Observing the observable camera

To observe the camera state changes, you can use the `on` method of the `ObservableBoardCamera` interface.

Depending on the event type being observed, the callback function will receive different arguments.

For example, when observing the `pan` event, the callback signature looks like this:

```typescript
    (eventPayload: CameraPanEventPayload, cameraState: CameraState): void

    type CameraPanEventPayload = {
        diff: Point;
    }

    type CameraState = {
        position: Point;
        zoomLevel: number;
        rotation: number;
    }
``` 

so you can get the delta of the pan event from the `eventPayload` and the current camera state (after the pan event) from the `cameraState`.

```typescript
    observableCamera.on("pan", (event, cameraState)=>{
        // handle the pan event
        console.log('pan event', event.diff); // deltaZoomAmount or deltaRotation would not be available in autocomplete
        console.log('camera state', cameraState); // camera state after the pan event
    });
```

The `on` method returns an unsubscribe function. You can use it to unsubscribe from the event.

```typescript
    const unsubscribe = observableCamera.on("pan", (event, cameraState)=>{
        // handle the pan event
    });

    // later when you no longer want to observe the pan event, you can unsubscribe
    unsubscribe();
```

Or you can also pass an abort signal in the options argument of the `on` method.

```typescript
    const abortController = new AbortController();
    const unsubscribe = observableCamera.on("pan", (event, cameraState)=>{
        // handle the pan event
    }, {signal: abortController.signal});

    // later when you no longer want to observe the pan event, you can abort the signal
    abortController.abort();
```
Using the abort signal you can unsubscribe from multiple events; you can even pass the same abort signal from an event listener. (Not sure what the use case is, but you can do it)

Zoom and Rotation event payloads are similar, the event payloads are the delta of the zoom and rotation respectively.

There's also an `all` event that will be triggered when any of the camera state changes.
This one is a bit different, since it's triggered by any of the camera state changes, the callback signature is a bit different.

```typescript
    (eventPayload: AllCameraEventPayload, cameraState: CameraState): void

    type AllCameraEventPayload = CameraRotateEvent | CameraPanEvent | CameraZoomEvent;

    type CameraRotateEvent = {
        type: "rotate";
    } & CameraRotateEventPayload;

    type CameraPanEvent = {
        type: "pan";
    } & CameraPanEventPayload;

    type CameraZoomEvent = {
        type: "zoom";
    } & CameraZoomEventPayload;
```

To differentiate which event triggered the callback, you can check the `type` property of the event payload utilizing typescript's Discriminated Unions
You can either use `switch` or `if` statements to do this.

```typescript
    if (eventPayload.type === "pan") {
        // handle the pan event
        // if you use typescript, it'll automatically infer the type of the eventPayload
        console.log('pan event', eventPayload.diff); // deltaZoomAmount or deltaRotation would not be available in autocomplete
    } else if (eventPayload.type === "zoom") {
        // handle the zoom event
        // if you use typescript, it'll automatically infer the type of the eventPayload
        console.log('zoom event', eventPayload.deltaZoomAmount); // diff would not be available in autocomplete
    } else if (eventPayload.type === "rotate") {
        // handle the rotate event
        // if you use typescript, it'll automatically infer the type of the eventPayload
        console.log('rotate event', eventPayload.deltaRotation); // diff would not be available in autocomplete
    }
```

#### The `CameraUpdatePublisher` class

The `CameraUpdatePublisher` class is used to publish the camera state changes to the callbacks. This is used in the `DefaultBoardCamera` class to make it observable. This is the helper class that the `DefaultBoardCamera` uses to publish the camera state changes. It makes use of the `Observable` class in the `utils` module in the root directory.

#### The `CameraUpdateBatcher` class

> The `CameraUpdateBatcher` class is used to batch the camera state changes. This is used in the `CameraRigWithUpdateBatcher` class. This is currently unstable and should not be used. The behavior is not consistent.
