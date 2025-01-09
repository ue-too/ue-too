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

This is not an all-in-one drawing canvas library like excalidraw or tl;draw, but a library which you can build on top of to make an app like excalidraw.
This library let you skip the hassle of manually implementing panning, zooming, and rotating functionalities on the HTML canvas element, and math if your not a fan of math.

[CodeSandbox Link](https://codesandbox.io/p/sandbox/drp5c7) This is a minimal example showcasing the basic functionality board can achieve. You can try it out to see if it's for you.

## Docs
- [Documentation](https://niuee.github.io/board/index.html) (Still in its early stages; a lot of things are still not documented properly.)
- [中文文件連結](https://niuee.github.io/board/tw/index.html) (還在很早期的階段，目前很努力在補齊文件中)

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
- Modularity: you don't have to use everything from this library; take only what you need. (details in the later section)
- Supports a wide variety of input methods. (touch, trackpad(macOS), keyboard mouse) But you can still customize how things work.
- Works with just HTML and JavaScript but also works with frontend frameworks/libraries with a little bit of extra work.

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
