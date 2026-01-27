# Board Camera

This is one of three core modules.

This module consists of the following sub-modules:

- `board-camera`: The core of the board camera system
- `camera-rig`: Transforms camera input based on configuration (e.g., clamping, restrictions) before passing it to the board camera
- `camera-update-publisher`: Publishes camera updates to registered callbacks
- `camera-update-batcher`: Batches camera updates (currently unstable, not recommended for use)

## Purpose of `BoardCamera`

- Maintains viewport information
- Converts viewport information into transform matrices compatible with various rendering engines (e.g., Vanilla Canvas, pixi.js, fabric.js)
- Converts coordinates between viewport and world coordinate systems

## Camera (Viewport) Concept

Before diving into the `BoardCamera` API details, let's establish the conceptual framework behind the camera (viewport) to align with the API's assumptions.

Panning and zooming a canvas requires a viewport, a concept present in many libraries that implement infinite canvas functionality (even in the name of pixi-viewport). It's similar to the viewBox in SVG, where you only see a portion of the larger picture through the viewport.

Imagine a painting on a large sheet of paper. The viewport is like a rectangular frame placed on the paper - only the content within this frame is visible to you.

The viewport essentially represents the canvas element in your browser screen. You can see a portion of an infinite canvas (the large sheet of paper) through this canvas element.

This analogy becomes more complex when considering zooming effects. Think of it as changing the size of the frame relative to the paper, not to the viewer. The viewport's size as perceived by the user remains constant (the canvas element's size on screen stays the same regardless of zoom level).

## API Documentation

### The `BoardCamera` Interface and Default Implementation

There are two types of board camera interfaces:

1. `BoardCamera` interface
2. `ObservableBoardCamera` interface

`ObservableBoardCamera` extends `BoardCamera` and adds the ability to observe camera state changes (useful for triggering canvas redraws when the camera state changes).

The `BaseCamera` class implements the `BoardCamera` interface. The default `DefaultBoardCamera` used in the `Board` class implements the `ObservableBoardCamera` interface.

We'll discuss observing camera state changes in a later section. For now, let's focus on the common methods and properties of the `BoardCamera` interface, which differ only in their observability.

#### Common Methods and Properties

For this section, we'll refer to both implementations as the board camera.

All board camera constructor arguments are optional with default values. However, two arguments are particularly important:

- `viewPortWidth`
- `viewPortHeight`

These represent the viewport dimensions, which are the size of the canvas element on screen (in CSS pixels). These may differ from the dimensions specified in your HTML or JSX.

On high DPI screens, you might specify higher `width` and `height` values while scaling down the CSS style size of the canvas element. In such cases, `width` would typically be the product of the CSS style width and the device pixel ratio, as shown in the [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio). (If you are using the `Board` class, you don't need to worry about this.)

The board camera requires the style width, not the canvas width. To emphasize the importance of style width and height, they are the first two constructor arguments.

You can also set these properties after initialization:

```typescript
const boardCamera = new DefaultBoardCamera(100, 100);
boardCamera.viewPortWidth = 1000;
boardCamera.viewPortHeight = 1000;
```

This is useful when you need to update the viewport size in response to canvas element size changes.

Ensure you set the correct `viewPortWidth` and `viewPortHeight` to maintain accurate coordinate transformations and viewport transformation matrices.

#### Position, Zoom Level, and Rotation

The board camera maintains three properties relevant to the transform matrix provided to the rendering engine:

- `position`: The camera's position in the world coordinate system
- `zoomLevel`: The viewport's zoom level
- `rotation`: The viewport's rotation around the camera position

The `position` represents the center of the canvas element in the world coordinate system (the center of the rectangular frame on the large sheet of paper).

The `zoomLevel` determines how much the viewport is zoomed in or out. Higher zoom levels make objects appear larger than their world coordinate system size.

The `rotation` represents the viewport's rotation around the camera's position.

You can access these properties directly:

```typescript
const boardCamera = new DefaultBoardCamera(100, 100);
console.log(boardCamera.position);
console.log(boardCamera.zoomLevel);
console.log(boardCamera.rotation);
```

However, you cannot set these properties directly. You must use the following methods:

```typescript
boardCamera.setPosition(100, 100);
boardCamera.setZoomLevel(2);
boardCamera.setRotation(Math.PI / 4);
```

This design enforces explicit camera state changes and enables boundary checks and other logic before state changes occur.

The board camera supports optional boundaries for position, zoom level, and rotation. When setting values outside these boundaries, the set functions will not change the camera state and return false:

```typescript
const res = boardCamera.setPosition(100, 100);
console.log(res); // false if 100, 100 is outside boundaries, true otherwise
```

Clamping is handled by the `CameraRig`, not the board camera. While you can set position, zoom level, and rotation through the set functions, we recommend using the `CameraRig` instead.

#### The `getTransform` Method

The `getTransform` method provides the transform matrix for the rendering engine. It takes two arguments:

- `devicePixelRatio`: The screen's device pixel ratio
- `alignCoordinate`: Whether to maintain the HTML canvas coordinate system (usually true, with positive y down and positive rotation clockwise)

```typescript
const transform = boardCamera.getTransform(devicePixelRatio, true);
```

For the device pixel ratio, you can typically use `window.devicePixelRatio`. However, for pixi.js, use 1 as pixi.js handles canvas resizing internally (using the renderer's `autoDensity` property).

After obtaining the transform matrix, you can apply it to your rendering engine's context:

For vanilla canvas:

```typescript
const ctx = canvas.getContext('2d');
ctx.setTransform(
    transform.a,
    transform.b,
    transform.c,
    transform.d,
    transform.e,
    transform.f
);
```

For pixi.js:

```typescript
app.stage.setFromMatrix(
    new Matrix(
        transform.a,
        transform.b,
        transform.c,
        transform.d,
        transform.e,
        transform.f
    )
);
```

#### The `CameraRig`

The `CameraRig` provides an abstraction layer for defining camera panning, zooming, and rotation behavior without directly manipulating camera state. This is particularly useful for implementing complex camera behaviors. The default camera rig handles clamping and movement restrictions.

When panning with the default camera rig, it automatically clamps the camera movement, allowing you to move the camera even when the destination or delta would place it outside boundaries. This clamping behavior can be disabled:

```typescript
// Disable clamping behavior (enabled by default)
cameraRig.configure({ clampTranslation: false });
```

The default camera rig also manages restrictions. For example, to restrict lateral movement:

```typescript
// Enable lateral movement restriction (disabled by default)
cameraRig.configure({ restrictTranslationX: true });
```

A utility function creates a camera rig with default configuration:

```typescript
const boardCamera = new DefaultBoardCamera();
const cameraRig = createDefaultCameraRig(boardCamera);
```

You can then use the camera rig to control the board camera:

```typescript
cameraRig.panByViewPort({ x: 100, y: 100 }); // Pan by 100px in viewport coordinates
cameraRig.zoomBy(2); // Zoom by 2 (additive, not multiplicative)
cameraRig.rotateBy(Math.PI / 4); // Rotate by π/4 radians
```

Available camera rig methods:

- `panByViewPort`: Pan by a specified amount in viewport coordinates
- `panByWorld`: Pan by a specified amount in world coordinates
- `panToViewPort`: Pan to a specified position in viewport coordinates (currently doesn't check if destination is outside viewport)
- `panToWorld`: Pan to a specified position in world coordinates
- `zoomBy`: Zoom by a specified amount (additive) around viewport center
- `zoomByAt`: Zoom by a specified amount at a viewport coordinate position
- `zoomByAtWorld`: Zoom by a specified amount at a world coordinate position
- `zoomTo`: Zoom to a specified level around viewport center
- `zoomToAt`: Zoom to a specified level at a viewport coordinate position
- `zoomToAtWorld`: Zoom to a specified level at a world coordinate position
- `rotateTo`: Rotate to a specified angle at a viewport coordinate position
- `rotateBy`: Rotate by a specified amount at a world coordinate position

#### Observing Camera State Changes

To observe camera state changes, use the `on` method of the `ObservableBoardCamera` interface. The callback function receives different arguments depending on the event type.

For example, the `pan` event callback signature:

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

You can access the pan event delta from `eventPayload` and the current camera state from `cameraState`:

```typescript
observableCamera.on('pan', (event, cameraState) => {
    // Handle the pan event
    console.log('pan event', event.diff);
    console.log('camera state', cameraState);
});
```

The `on` method returns an unsubscribe function:

```typescript
const unsubscribe = observableCamera.on('pan', (event, cameraState) => {
    // Handle the pan event
});

// Unsubscribe when no longer needed
unsubscribe();
```

Alternatively, you can pass an abort signal in the options argument of the `on` method.

```typescript
const abortController = new AbortController();
const unsubscribe = observableCamera.on(
    'pan',
    (event, cameraState) => {
        // Handle the pan event
    },
    { signal: abortController.signal }
);

// Unsubscribe when no longer needed
abortController.abort();
```

Using the abort signal, you can unsubscribe from multiple events; you can even pass the same abort signal from an event listener. (Not sure what the use case is, but you can do it)

Zoom and rotation event payloads are similar, the event payloads are the delta of the zoom and rotation respectively.

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
if (eventPayload.type === 'pan') {
    // handle the pan event
    // if you use typescript, it'll automatically infer the type of the eventPayload
    console.log('pan event', eventPayload.diff); // deltaZoomAmount or deltaRotation would not be available in autocomplete
} else if (eventPayload.type === 'zoom') {
    // handle the zoom event
    // if you use typescript, it'll automatically infer the type of the eventPayload
    console.log('zoom event', eventPayload.deltaZoomAmount); // diff would not be available in autocomplete
} else if (eventPayload.type === 'rotate') {
    // handle the rotate event
    // if you use typescript, it'll automatically infer the type of the eventPayload
    console.log('rotate event', eventPayload.deltaRotation); // diff would not be available in autocomplete
}
```

#### The `CameraUpdatePublisher` class

The `CameraUpdatePublisher` class is used to publish the camera state changes to the callbacks. This is used in the `DefaultBoardCamera` class to make it observable. This is the helper class that the `DefaultBoardCamera` uses to publish the camera state changes. It makes use of the `Observable` class in the `utils` module in the root directory.

#### The `CameraUpdateBatcher` class

> The `CameraUpdateBatcher` class is used to batch the camera state changes. This is used in the `CameraRigWithUpdateBatcher` class. This is currently unstable and should not be used. The behavior is not consistent.
