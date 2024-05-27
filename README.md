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

This is not a complete drawing canvas library like excalidraw or tl;draw, but a library which you can build on top of to make an app like excalidraw.
This library saves you from the hassle of manually implementing panning, zooming, and rotating functionalities on the HTML canvas element, and math if your not a fan of math.

[Demo](https://vntchang.dev/vCanvasDemo/)
_The demo version is rather old and outdated but it showcases the basic functionalities so I am keeping it here. I will replace it with the newer version later on when it's stable_
[CodeSandbox Link](https://codesandbox.io/p/sandbox/board-example-y2dycd?layout=%257B%2522sidebarPanel%2522%253A%2522EXPLORER%2522%252C%2522rootPanelGroup%2522%253A%257B%2522direction%2522%253A%2522horizontal%2522%252C%2522contentType%2522%253A%2522UNKNOWN%2522%252C%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522id%2522%253A%2522ROOT_LAYOUT%2522%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522contentType%2522%253A%2522UNKNOWN%2522%252C%2522direction%2522%253A%2522vertical%2522%252C%2522id%2522%253A%2522clw2y7l7v00063b6iiev37bos%2522%252C%2522sizes%2522%253A%255B100%252C0%255D%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522contentType%2522%253A%2522EDITOR%2522%252C%2522direction%2522%253A%2522horizontal%2522%252C%2522id%2522%253A%2522EDITOR%2522%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL%2522%252C%2522contentType%2522%253A%2522EDITOR%2522%252C%2522id%2522%253A%2522clw2y7l7v00023b6ikchwe6hz%2522%257D%255D%257D%252C%257B%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522contentType%2522%253A%2522SHELLS%2522%252C%2522direction%2522%253A%2522horizontal%2522%252C%2522id%2522%253A%2522SHELLS%2522%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL%2522%252C%2522contentType%2522%253A%2522SHELLS%2522%252C%2522id%2522%253A%2522clw2y7l7v00033b6ikl1vhmzw%2522%257D%255D%252C%2522sizes%2522%253A%255B100%255D%257D%255D%257D%252C%257B%2522type%2522%253A%2522PANEL_GROUP%2522%252C%2522contentType%2522%253A%2522DEVTOOLS%2522%252C%2522direction%2522%253A%2522vertical%2522%252C%2522id%2522%253A%2522DEVTOOLS%2522%252C%2522panels%2522%253A%255B%257B%2522type%2522%253A%2522PANEL%2522%252C%2522contentType%2522%253A%2522DEVTOOLS%2522%252C%2522id%2522%253A%2522clw2y7l7v00053b6iwbyc1zfu%2522%257D%255D%252C%2522sizes%2522%253A%255B100%255D%257D%255D%252C%2522sizes%2522%253A%255B46.32162767975171%252C53.67837232024829%255D%257D%252C%2522tabbedPanels%2522%253A%257B%2522clw2y7l7v00023b6ikchwe6hz%2522%253A%257B%2522tabs%2522%253A%255B%257B%2522id%2522%253A%2522clw2y7l7v00013b6iiagi3t0j%2522%252C%2522mode%2522%253A%2522permanent%2522%252C%2522type%2522%253A%2522FILE%2522%252C%2522filepath%2522%253A%2522%252Fsrc%252Findex.html%2522%252C%2522state%2522%253A%2522IDLE%2522%257D%252C%257B%2522id%2522%253A%2522clw4g5a2x00023b6icusokwho%2522%252C%2522mode%2522%253A%2522permanent%2522%252C%2522type%2522%253A%2522FILE%2522%252C%2522initialSelections%2522%253A%255B%257B%2522startLineNumber%2522%253A15%252C%2522startColumn%2522%253A29%252C%2522endLineNumber%2522%253A15%252C%2522endColumn%2522%253A29%257D%255D%252C%2522filepath%2522%253A%2522%252Fsrc%252Findex.mjs%2522%252C%2522state%2522%253A%2522IDLE%2522%257D%255D%252C%2522id%2522%253A%2522clw2y7l7v00023b6ikchwe6hz%2522%252C%2522activeTabId%2522%253A%2522clw4g5a2x00023b6icusokwho%2522%257D%252C%2522clw2y7l7v00053b6iwbyc1zfu%2522%253A%257B%2522tabs%2522%253A%255B%257B%2522id%2522%253A%2522clw2y7l7v00043b6ic6f06neh%2522%252C%2522mode%2522%253A%2522permanent%2522%252C%2522type%2522%253A%2522UNASSIGNED_PORT%2522%252C%2522port%2522%253A0%252C%2522path%2522%253A%2522%252F%2522%257D%255D%252C%2522id%2522%253A%2522clw2y7l7v00053b6iwbyc1zfu%2522%252C%2522activeTabId%2522%253A%2522clw2y7l7v00043b6ic6f06neh%2522%257D%252C%2522clw2y7l7v00033b6ikl1vhmzw%2522%253A%257B%2522tabs%2522%253A%255B%255D%252C%2522id%2522%253A%2522clw2y7l7v00033b6ikl1vhmzw%2522%257D%257D%252C%2522showDevtools%2522%253Atrue%252C%2522showShells%2522%253Afalse%252C%2522showSidebar%2522%253Atrue%252C%2522sidebarPanelSize%2522%253A15%257D) You Can try it out to see if it's for you.

## Docs
- [Documentation](https://niuee.github.io/board/index.html) (Still in its early stages; a lot of things are still not documented properly.)

- [Design Document](https://hackmd.io/@niuee/ByKskjAUp)

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
import { Board } from "./board.js";
```

### Import From jsdelivr
```javascript
import { Board } from "https://cdn.jsdelivr.net/npm/@niuee/board@latest/index.mjs";
```

### Use iife bundle
In an HTML file use the script tag. (instead of importing from jsdelivr you can also download it as source and put it in you project directly)
```html
<script src="https://cdn.jsdelivr.net/npm/@niuee/board@latest/iife/index.js"></script>
```

and then in other JavaScript file you can use the exports of @niuee/board using the name Board.{some export}

For example the constructor for the `Board` class.
```javascript
const newBoard = new Board.Board(canvasElement);
```

## Key Features
- Supports a wide variety of input methods. (touch, trackpad(macOS), keyboard mouse)
- Works with just HTML and JavaScript but also works with frontend frameworks/libraries with a little bit of extra work.
- Rich API for board camera. (You can do a lot of cool stuff with the camera e.g. animating the camera moving along a path, zooming and rotating can also be animated)

## Bare Minimum Example

```javascript
import { Board } from "@niuee/board"; // or other import style mentioned above

const canvasElement = document.querySelector("canvas");
const board = new Board(canvasElement);


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
import { Board } from "@niuee/board";

const canvasElement = document.getElementById("board");
const board = new Board(canvasElement); // if you are using this library through iife don't use the variable name board since it would have name conflict with the library

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


The [API documentation](https://niuee.github.io/board/index.html) has all the APIs listed.

I am setting up a documentation site for examples and explanations of the entire project. Stay tuned.
