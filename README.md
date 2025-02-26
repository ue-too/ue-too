<h1 align="center">
    board
</h1>
<p align="center">
    board supercharges your html canvas element giving it the capabilities to pan, zoom, rotate, and much more.
</p>
<p align="center">
    <a href="https://www.npmjs.com/package/@niuee/board">
        <img src="https://img.shields.io/npm/v/@niuee/board.svg?style=for-the-badge" alt="continuous integration" style="height: 20px;"/>
    </a>
    <a href="https://github.com/niuee/board/actions/workflows/node.js.yml">
        <img src="https://img.shields.io/github/actions/workflow/status/niuee/board/ci-test.yml?label=test&style=for-the-badge" alt="contributors" style="height: 20px;"/>
    </a>
    <a href="https://github.com/niuee/board/blob/main/LICENSE.txt">
        <img src="https://img.shields.io/github/license/niuee/board?style=for-the-badge" alt="contributors" style="height: 20px;"/>
    </a>

</p>

<p align="center">
  •
  <a href="#install">Install</a> •
  <a href="#key-features">Key Features</a> •
  <a href="#bare-minimum-example">Bare Minimum Example</a> •
  <a href="#quick-start-using-only-html-canvas">Quick Start</a> •
  <a href="#development">Development</a>
</p>

![small-demo](./doc-media/small-demo.gif)

_This is is a small demo of what board is capable of. (only showing a small fraction)_

This is not a complete package of drawing app like excalidraw or tl;draw, but a library which you can build on top of to make an app like excalidraw.
board lets you skip the hassle of manually implementing panning, zooming, and rotating functionalities on the HTML canvas element, and well a little bit of math.

What `board` is trying to do is very much like what [pixi-viewport](https://github.com/pixijs-userland/pixi-viewport) is doing. But `board` takes a step back, it's not heavily integrated with pixi.js. It can be used with just regular HTML canvas element without pixi.js, but it also works with canvas that uses [pixi.js](https://github.com/pixijs/pixijs), [fabric.js](https://github.com/fabricjs/fabric.js), and [konva](https://github.com/konvajs/konva).

[CodeSandbox link](https://codesandbox.io/p/sandbox/drp5c7): with a minimal example showcasing the basic functionality that `board` can achieve.

There are a few more examples in the `devserver` directory. Including how to integrate with pixi.js, fabric.js, and konva.

## Docs
- [API Documentation](https://niuee.github.io/board/index.html)
- [中文文件連結](https://niuee.github.io/board/zh-tw/index.html) (還在努力補沒翻完的，還要開發新功能，時間真的不太夠 u.u)
### PR welcome for the i18n for the documentation. (See the [Development](#development) section for more detail)

## Installation and Usage
### Package manager
install it using
```bash
npm install @niuee/board
```
and import it like
```javascript
import { Board } from "@niuee/board";
```

### Download From Github
Download the bundled JavaScript (board.js) in the [releases](https://github.com/niuee/board/releases/) page of the repository and put it in the your project directory for other JavaScript module to import like this.
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

and then in other JavaScript module you can use the exports of @niuee/board using the name Board.some export

For example the constructor for the `Board` class.
```javascript
const newBoard = new Board.Board(canvasElement);
```

## Key Features
- Modularity: you don't have to use everything from this library; take only what you need. (details in the later section)
- Supports a wide variety of input methods. (touch, trackpad(macOS), keyboard mouse) But you can still tweak how things work.
- Works with just HTML and JavaScript but also works with frontend frameworks/libraries with a little bit of extra work. (example is on the way)
- You can use this with pixi.js, fabric.js, Konva; or maybe just html canvas. (example is on the way)

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

## Quick Start (Using only HTML canvas)
The `Board` class extends an existing canvas element in the DOM to have extra capabilities such as pan, zoom, and rotation.
To instantiate a new board, you need have a canvas element in your html.
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

This would result in a circle drawn to the bottom right of the origin. The same as a regular canvas. (but you can pan and zoom the canvas around)

## Development
The dev environment setup for this project is relatively simple. Let me break down the different aspects.
- Bundling (rollup): `pnpm build` Bundling is done through rollup. There's a `rollup.config.js` in charge of that. Every subdirectory in the `src` directory gets its own bundled index.js file.
- Unit Testing (jest): `pnpm test` There's not a lot of tests right now. Only the core functionalities revolving around the camera are unit tested. The next section I will move on to test is the input state machine.
- Dev Server (vite): `pnpm dev` The `devserver` directory contains the current examples of the board. It's sort of like a playground. The more complete example is the in the `main.ts` file.
- Documentation (typedoc): `pnpm doc:default` would generate a `docs-staging`
The [API documentation](https://niuee.github.io/board/index.html) has all the APIs listed.

## Under the Hood
How board achieve the effect of infinite canvas is through an abstraction called a camera! It's like the viewport attribute of svg. 

The user controls the position, zoom, and rotation of the camera to see different part of a canvas context.

i.e. if you draw a circle with the center at (100, 100) on the context, if the position of the camera is at (100, 100) the center of the canvas would be the same as the center of the circle on screen.

Everything starts with an user input: like dragging while holding the control key, 2-finger-swipe on trackpad, or 2-finger swipe on touch devices.
These events are captured by the event listeners added to the canvas element. Then, the event listeners would parse the raw events into events like: `LEFT_POINTER_MOVE`, `SPACEBAR_DOWN`, etc.

These parsed events are then fed into the input state machine to interpret the user's intent. (Essentially, a second layer of parsing.)

The input state machine would spit out something like pan with some distance, or zoom to X scale, etc. 

The event listeners combined with the input state machine is how board maps users input to the control input of the camera.
If you want custom behavior for example, the default 2-finger-swipe on touch device is panning the camera, if you want to make it 1-finger-drag instead, this is where you would want to look into.
(you can start by looking into `src/kmt-strategy/kmt-strategy.ts`, `src/input-state-machine.ts` detail documentation will be updated in the future.)

User camera input from the state machine is passed to a input observable. This observable allows users (as in the user of the library not the browser client) to subscribe to the raw camera input.
The "raw" indicates that all values are in viewport coordinate system instead of context or the "world" space.

The following diagram shows the difference between the "viewport" and the "world" coordinate system.

Since the user controls where the camera (viewport) is, how big the camera is, and the rotation angle of the camera, it's coordinate system will deviate from the context/world coorindate system. 
![viewport and world coorindate system](./doc-media//coordinate-system.png)

