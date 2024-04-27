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

## From version 0.0.5 to 0.0.6
There is another major revamp in version 0.0.6. 
1. The movement of the board camera is delegated to the respective handler for pan, zoom, and rotation. 
2. There is a board state manager to sync the essential states the board including the camera between the different input strategies.
3. The board camera is now abstracted to an interface `BoardCamera`.
4. The current exports stays the same as much as possible. The `BoardCamera` exported class in 0.0.5 is now `BoardCameraV1` in 0.0.6.
5. The current recommended implementation of `BoardCamera` is the class `BoardCameraV2` so the default export of `@niuee/board/board-camera` is now changed to `BoardCameraV2` instead of `BoardCameraV1`.
6. The original `Board` class is now `BoardV1`. There is a new class `BoardV2` that uses the `BoardCameraV2` and many other updates. So `BoardV2` is the recommended over `BoardV1` and `BoardV1` would be phased out in future versions.

## Installation and Usage
### Package manager
```bash
npm install @niuee/board
```
and import it in other JavaScript module

```javascript
import { BoardV2 } from "@niuee/board";
```

### Download From Github
Download the bundled JavaScript (board.js) in the [releases](https://github.com/niuee/board/releases/) of the repository and put it in the your project directory for other JavaScript module to import like this.
```javascript
import { BoardV2 } from "./board.js";
```

### Import From jsdelivr
```javascript
import { BoardV2 } from "https://cdn.jsdelivr.net/npm/@niuee/board@latest/index.mjs";
```

### Use iife bundle
In an HTML file use the script tag. (instead of importing from jsdelivr you can also download it as source and put it in you project directly)
```html
<script src="https://cdn.jsdelivr.net/npm/@niuee/board@latest/iife/index.js"></script>
```

and then in other JavaScript file you can use the exports of @niuee/board using the name Board.{some export}

For example the constructor for the `Board` class.
```javascript
const newBoard = new Board.BoardV2(canvasElement);
```

## Key Features
- Supports a wide variety of input methods. (touch, trackpad(macOS), keyboard mouse)
- Works with just HTML and JavaScript but also works with frontend frameworks/libraries with a little bit of extra work.
- Rich API for board camera. (You can do a lot of cool stuff with the camera)

## Bare Minimum Example

```javascript
import { BoardV2 } from "@niuee/board"; // or other import style mentioned above

const canvasElement = document.querySelector("canvas");
const board = new BoardV2(canvasElement);


// this is the callback function for the requestAnimationFrame
function step(timestamp){
    // timestamp is the argument requestAnimationFrame pass to its callback function

    // step the board first before everything else because stepping the board would wipe the canvas
    // pass in the timestamp as it is to the board's step function.
    board.step(timestamp);

    // if you want to draw stuff draw it in the step function otherwise it would not persist
    // draw a circle at (100, 100) with a width of 1px
    board.context.beginPath();
    board.context.arc(100, 100, 1, 0, 2 * Math.PI);
    board.context.stroke();

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

Call the step function of the `Board` class and in a `requestAnimationFrame` callback.
```javascript
import { BoardV2 } from "@niuee/board";

const canvasElement = document.getElementById("board");
const board = new BoardV2(canvasElement); // if you are using this library through iife don't use the variable name board since it would have name conflict with the library

// this is the callback function for the requestAnimationFrame
function step(timestamp){
    // timestamp is the argument requestAnimationFrame pass to its callback function

    // step the board first before everything else because stepping the board would wipe the canvas
    // pass in the timestamp as it is to the board's step function.
    board.step(timestamp);

    // do your stuff

    // and then call the requestAnimationFrame
    window.requestAnimationFrame(step);
}

// start the animation loop
step(0);
```
Now the board should have the basic functionalities like pan and zoom. But there's probably nothing on your canvas.

The default coordinate system @niuee/board uses is the same as the one of the canvas API which is "Down" for positive Y direction.

To draw stuff on the board first get the 2d context of the board.
```javascript

// draw a circle at the location (10, 10)
board.context.beginPath();
board.context.arc(10, 10, 5, 0, 2 * Math.PI);
board.context.stroke();
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
// }
```

## Input Strategies
To control the movements of the board camera through user interaction. The user inputs have to be capture to determine the intentions. This is where the input strategies comes in. 

The input strategies are mostly logic for handling the events fired from the canvas element. Like the `pointerdown`, `pointermove`, etc.

The role of the input strategies is to determine based on the events handled what the user wants to do? Pan, or Zoom, or others. 

For example, the default keyboard mouse and trackpad strategy would interpret the scroll event and based on the input fire commands to pan or to zoom the board camera (or both).

There are two input strategies that I implemented for out of the box pan and zoom capabilities which are the KMTStrategy (keyboard mouse, and trackpad), and the TouchStrategy.

### Keyboard, Mouse, and Trackpad

For the keyboard and mouse combination, the default behavior is to zoom while scrolling the mouse wheel, and to pan when holding 

### Touch

## Controlling the Camera
The control of the camera is delegated to the respective handlers for pan, zoom, rotate. 

### Pan Handler

The `PanHandler` interface has 2 methods.
1. `panCameraTo(camera: BoardCamera, destination: Point)`
2. `panCameraBy(camera: BoardCamera, delta: Point)`

The `PanController` interface extends the `PanHandler` interface where it has a few more attributes that control the behavior of the handler like `limitEntireViewPort`.

You can implement your own handler to have custom behavior for panning.

### Zoom Handler

### Command Conventions

### LimitEntireViewPort or not
If limiting the entire view port the entire view port would be contrained within the boundaries not just the center of the view port (or the camera position). I would post a gif demonstrating the difference.


The [documentation](https://niuee.github.io/board/index.html) has all the APIs listed.
