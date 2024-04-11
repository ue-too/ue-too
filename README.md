<h1 align="center">
    board
</h1>
<p align="center">
    board supercharges your html canvas element giving it the capabilities to pan, zoom, rotate, and much more.
</p>
<p align="center">
    <a href="https://www.npmjs.com/package/@niuee/board">
        <img src="https://img.shields.io/npm/v/@niuee/board.svg?style=for-the-badge" alt="continuous integration" style="height: 20px;">
    </a>
    <a href="https://github.com/niuee/board/actions/workflows/node.js.yml">
        <img src="https://img.shields.io/github/actions/workflow/status/niuee/board/node.js.yml?branch=main&label=test&style=for-the-badge" alt="contributors" style="height: 20px;">
    </a>
    <a href="https://github.com/niuee/board/blob/main/LICENSE.txt">
        <img src="https://img.shields.io/github/license/niuee/board?style=for-the-badge" alt="contributors" style="height: 20px;">
    </a>

</p>

<p align="center">
  •
  <a href="#install">Install</a> •
  <a href="#key-features">Key Features</a> •
  <a href="#bare-minimum-example">Bare Minimum Example</a> •
  <a href="#how-to-use">How To Use</a>

</p>

This is not a drawing canvas library like excalidraw or tl;draw, but a library which you can build on top of to make an app like excalidraw.

[Demo](https://vntchang.dev/vCanvasDemo/)
_The demo version is rather old and outdated but it showcases the basic functionalities so I am keeping it here. I will replace it with the newer version later on when it's stable_

## Docs
- [Documentation](https://niuee.github.io/board/index.html) (Still in its early stages; a lot of things are still not documented properly.)

- [Design Document](https://hackmd.io/@niuee/ByKskjAUp)

## Install
### Install From npm
```bash
npm install @niuee/board
```

### Download From Github
Download the bundled JavaScript (board.js) in the [releases](https://github.com/niuee/board/releases/) and put it in the same directory for other JavaScript to import.
```javascript
import { Board } from "./board.js";
```

### Import From jsdelivr
```javascript
import { Board } from "https://cdn.jsdelivr.net/npm/@niuee/board@latest/index.mjs";
```

### Use iife bundle
```html
<script src="https://cdn.jsdelivr.net/npm/@niuee/board@latest/iife/index.js"></script>
```

and then in a JavaScript file you can use the exports of @niuee/board using the name board.{some export}

For example the constructor for the `Board` class.
```javascript
const newBoard = new board.Board(canvasElement);
```

## Key Features
- Supports a wide variety of input methods. (touch, trackpad(macOS), keyboard mouse)
- Works with just HTML and JavaScript but also works with React with a little bit of extra work.
- Rich API for board camera. (You can do a lot of cool stuff with the camera)

## Bare Minimum Example

```javascript
import { Board } from "@niuee/board"; // or other import style mentioned above

const canvasElement = document.querySelector("canvas");
const board = new Board(canvasElement);

// XY axis and a reference circle at location (30, 20) would appear in debugMode
board.debugMode = true;
// get the step function of the board
const stepFn = board.getStepFunction();

// get the 2d rendering context of the canvas
const ctx = board.getContext();

// this is the callback function for the requestAnimationFrame
function step(timestamp){
    // timestamp is the argument requestAnimationFrame pass to its callback function

    // step the board first before everything else because stepping the board would wipe the canvas
    // pass in the timestamp as it is to the board's step function.
    stepFn(timestamp);

    // if you want to draw stuff draw it in the step function otherwise it would not persist
    // draw a circle at (100, 100) with a width of 1px
    ctx.beginPath();
    ctx.arc(100, 100, 1, 0, 2 * Math.PI);
    ctx.stroke();

    // and then call the requestAnimationFrame
    window.requestAnimationFrame(step);
}

// start the animation loop
step(0);
```

## How To Use
The `Board` class extends an existing canvas element in the DOM to have extra capabilities such as pan, zoom, and rotation.
To instantiate a new board, must have a canvas element in your html.
```html
<canvas id="board"></canvas>
```

Get the step function of the `Board` class and call it in a `requestAnimationFrame` callback.
```javascript
import { Board } from "@niuee/board";

const canvasElement = document.getElementById("board");
const board = new Board(canvasElement); // if you are using this library through iife don't use the variable name board since it would have name conflict with the library

// get the step function of the board
const stepFn = board.getStepFunction();

// this is the callback function for the requestAnimationFrame
function step(timestamp){
    // timestamp is the argument requestAnimationFrame pass to its callback function

    // step the board first before everything else because stepping the board would wipe the canvas
    // pass in the timestamp as it is to the board's step function.
    stepFn(timestamp);

    // do your stuff

    // and then call the requestAnimationFrame
    window.requestAnimationFrame(step);
}

// start the animation loop
step(0);
```
Now the board should have the basic functionalities like pan and zoom. But there's probably nothing on your canvas.

Enable debug mode to at least have something on the canvas.
```javascript
board.debugMode = true;
```

You'll see an X-axis drawn in red and an Y-axis drawn in green, and a green reference circle drawn in green at location (30, 20).
There is also going to have a red cross hair at the cursor's position on the canvas with the position coordinate.

The default coordinate system @niuee/board uses is the same as the one of the canvas API which is "Down" for positive Y direction.

To draw stuff on the board first get the 2d context of the board.
```javascript
const ctx = board.getContext();

// draw a circle at the location (10, 10)
ctx.beginPath();
ctx.arc(10, 10, 5, 0, 2 * Math.PI);
ctx.stroke();
```

This would result in a circle drawn to the bottom right of the origin. The same as a regular canvas.

This is probably a good time to talk about the coordinate system @niuee/board uses.

In Most use cases the default coordinate system would be what you want as you might already be familiar with the canvas API.

In case you want to flip the Y axis so that positive direction for Y axis is point up in the screen.

Set the `alignCoordinateSystem` of the `Board` class to `false`.
```javascript
board.alignCoordinateSystem = false;
```

This would flip the Y axis. There's a catch though. Even though the Y axis is flipped the context that the board uses is still the same as a regular canvas. This means that to draw something in the coordinate of the flipped coordinate system, you would need to flip the Y axis coordinate (negate the coordinate) before feeding it to the `context` to draw.

For example if you want to draw a circle at (30, 30), for the flipped coordinate system, you would need to do it like this.
```javascript
// notice the negative sign for the y coordinate
context.arc(30, -30, 5, 0, Math.PI * 2);
```

There is also another difference other than the flipped Y axis. The positive direction of an angle is also reversed. For the flipped coordinate system. Positive rotation is counter clockwise. As for the default coordintate system it's the same as the regular canvas API where positive rotation is clockwise.

## Camera Events
Right now there are only 3 camera events that a user can listen to which are the pan, zoom, and rotate.

To Listen to the pan event of the camera.

Because the zooming of the camera is center at the cursor point (plan to have the option to set the anchor point to the center or the top left corner of the viewport) zooming cause the camera to also pan. This will also fire the pan event.
```javascript
// the pan call back
function panCallback(event, cameraState) {
    // payload for pan event would contain the diff of the canvas pan
    // cameraState would be the current state of the abstracted camera
    console.log(event); // {diff: {x: number, y: number}}
    console.log(cameraState) // {position: Point, rotation: number, zoomLevel: number}
}

// listen to the pan event and when a pan event occur the callback would execute
board.on("pan", panCallback);

// pan event payload looks like
// {
//     diff: Point;
// }

// cameraState looks like
// {
//     position: Point;
//     rotation: nubmer;
//     zoomLevel: number;
// }
```

To Listen to the zoom event.
```javascript
// the rotate call back
function rotateCallback(event, cameraState) {
    console.log(event);
    console.log(cameraState) // {position: Point, rotation: number, zoomLevel: number}
}

// listen to the rotate event and when a rotate event occur the callback would execute
board.on("rotate", rotateCallback);

// rotate event payload looks like
// {
//     deltaRotation: number;
// }
```

To Listen to the rotate event.
```javascript
// the zoom call back
function zoomCallback(event, cameraState) {
    console.log(event);
    console.log(cameraState) // {position: Point, rotation: number, zoomLevel: number}
}

// listen to the zoom event and when a zoom event occur the callback would execute
board.on("zoom", zoomCallback);

// zoom event payload looks like
// {
//     deltaZoomAmount: number;
//     anchorPoint: Point;
// }
```

## Controlling the Camera
Currently, there is no function of the Board class that directly control the underlying camera system. However, you can get the underlying BoardCamera instance using the `camera` property of the `Board` class to get the internal BoardCamera object.

Once you have the camera you can do a lot of things.

### Command Conventions
Set or Move, (Set or spin for rotation operation), (Not applicable to zoom operation)
Set directly set the position of the camera. It takes in the destination as argument. Move takes in the delta as an argument making it suitable for when you don't care the current position of the camera.

### FromGesture or not
FromGesture is affected by the restrictions (restrictXTranslation, etc.) The design document has a detailed relationship between different kinds of camera commands.

### LimitEntireViewPort or not
If limiting the entire view port the entire view port would be contrained within the boundaries not just the center of the view port (or the camera position). I would post a gif demonstrating the difference.

### Clamp or not
If there is no clamping then the command would not take effect if the destination is out of bounds. There is a graph in the design document.

For example you can call the `moveWithClampFromGesture(delta: {x: number, y: number})` to "move" the camera to a position clamped inside the boundaries from gesture so that the restrictions imposed would limit this command.

The [documentation](https://niuee.github.io/board/index.html) has all the apis listed.

## Camera Attributes

### `restrict-{x-translation | y-translation | rotation | zoom}`
This is to restrict any kind of input from the gestures (mouse-keyboard input, trackpad gesture, touch points) to move, rotate, or zoom the canvas.<br/>
For Example, to limit the absolute x direction translation set the attribute restrict-x-translation on the html tag.

This will restrict the ability to pan the canvas in x-direction.

```javascript
board.restrictXTranslation = true;
```

### `restrict-relative-{x-translation | y-translation}`
This is to restrict any kind of input from the gestures (mouse-keyboard input, trackpad gesture, touch points) to move relative to the camera viewport.
X is the left and right direction of the view port and Y is the up and down direction.

```javascript
board.restrictRelativeYTranslation = true;
```

### `full-screen`
This is to set the dimensions of the canvas to be the same as `window.innerHeight` and `window.innerWidth`.<br/>
This will override the `width` and `height` attribute.

```javascript
board.fullScreen = true;
```

### `width`

This will change the width of the canvas element.
The Board class instance also listens to the attribute change of the underlying canvas element. So if you can also change the width of the canvas element; the board class instance will take care of the change under the hood.
```javascript
board.width = 300;
```
OR
```html
<canvas width="300"></canvas>
```

### `height`

This is to set the height of the canvas.
This is similar to the width attribute. The board also listens to the height change of the canvas element it controls; you can change the height using JavasScript or directly in html.
```javascript
board.height = 300;
```
OR
```html
<canvas height="300"></canvas>
```

### `control-step`
This is to prevent the canvas from calling the `window.requestAnimationFrame` automatically. Default is "true"(meaning that the canvas element would not call rAF itself the user would have to "control the step function"; I know it's kind of confusing I am still working on the name though)

Setting this attribute to false the canvas would handle the calling of rAF and the user would just get the pan, zoom, and rotate functionality automatically. However, in this mode you would probably have to go into the source code of the canvas and add stuff to the step function to actually acheive anything.
```javascript
board.stepControl = false;
```

### `debug-mode`
This would switch on the debug mode for the canvas. Currently, the debug mode is drawing the reference circle in green, the axis in their respective color, the bounding box in blue. The cursor icon would be replaced with a red crosshair and at the top right to the crosshair would be the position of the cursor in world coordinate.

The `Board` way.
```javascript
board.debugMode = true;
```

### `max-half-trans-width`
This is to set the horizontal boundaries for the viewport. (where the camera can move to) Currently, the boundaries are set mirrored at the origin. Hence the "half" in the attribute name. Left and right both gets the same value. The entire horizontal boundary is then 2 * half width wide.

```javascript
board.maxHalfTransWidth = 1000;
```

### `max-half-trans-height`
This is to set the vertical boundaries for the viewport. Currently, the boundaries are set mirrored at the origin. Hence the "half" in the attribute name. Top and bottom both gets the same value. The entire vertical boundary is then 2 * half width wide.

The `Board` way.
```javascript
board.maxHalfTransHeight = 1000;
```

### `grid`
This is to toggle the grid displayed on the canvas. The spacing currently is not adjustable; it is the same as the ruler (it flexible depending on the zoom).

```javascript
board.displayGrid = true;
```

### `ruler`
This is to toggle the ruler displayed on the canvas. The spacing depends on the zoom level.
```javascript
board.displayRuler = true;
```
