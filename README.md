<h1 align="center">
    uē-tôo
</h1>
<p align="center">
    pan, zoom, rotate, and more.
</p>

<div align="center">

[![npm version](https://img.shields.io/npm/v/@niuee/board.svg?style=for-the-badge)](https://www.npmjs.com/package/@niuee/board)
[![ci tests](https://img.shields.io/github/actions/workflow/status/niuee/board/ci-test.yml?label=test&style=for-the-badge)](https://github.com/niuee/board/actions/workflows/ci-test.yml)
[![License](https://img.shields.io/github/license/niuee/board?style=for-the-badge)](https://github.com/niuee/board/blob/main/LICENSE.txt)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@niuee/board?color=success&label=gzipped%20bundle%20size&style=for-the-badge)](https://bundlephobia.com/package/@niuee/board)

</div>

<p align="center">
  <a href="#quick-demo">Quick Demo</a> •
  <a href="#installation-and-usage">Install</a> •
  <a href="#key-features">Key Features</a> •
  <a href="#quick-start-using-only-html-canvas">Quick Start</a> •
  <a href="#development">Development</a> •
  <a href="#under-the-hood-a-rather-brief-overview">Structural Overview</a>
</p>

![small-demo](./doc-media/small-demo-with-cursor.gif)

<p align="center">
    This is is a small demo gif of what board is capable of.
</p>

## What this library is?
- Transforms your HTML canvas into a near-infinite canvas with panning, zooming, and rotation capabilities
- Provides utility functions that simplify the complex mathematics required for operating an infinite canvas
- Works with multiple canvas frameworks (vanilla, Pixi.js, Fabric.js, Konva) as the underlying mathematical principles remain consistent
- Serves as a foundation library for building your own infinite canvas applications
- Accomplishes the same goal as pixi-viewport but not dependent on pixi.js

## What this library is not?
- A complete drawing application like Excalidraw, tldraw, or similar tools
- A full-featured package with built-in drawing tools and user interfaces

## Quick Demo
[CodeSandbox link](https://codesandbox.io/p/sandbox/drp5c7): with a minimal example showcasing the basic functionality that `ue-too` can achieve.

There are a few more examples in the `devserver` directory. Including how to integrate with pixi.js, fabric.js, and konva. (not complete yet)

## Docs
- [API Documentation](https://ue-too.github.io/ue-too/)
- [中文文件連結](https://ue-too.github.io/ue-too/tw/index.html) (還在努力補沒翻完的，還要開發新功能，時間真的不太夠 u.u)

## Installation and Usage
### Package manager
install it using
```bash
npm install ue-too
```
and import it like
```javascript
import { Board } from "ue-too";
```

### Download From Github
Download the bundled JavaScript (board.js) in the [releases](https://github.com/niuee/board/releases/) page of the repository and put it in the your project directory for other JavaScript module to import like this.
```javascript
import { Board } from "./ue-too.js";
```

### Import From jsdelivr
```javascript
import { Board } from "https://cdn.jsdelivr.net/npm/ue-too@latest/index.mjs";
```
_iife is no longer supported_

## Key Features
- Modularity: you don't have to use everything from this library; take only what you need. (details in the later section)
- Supports a wide variety of input methods. (touch, trackpad(macOS), keyboard mouse) But you can still tweak how things work.
- Works with just HTML and JavaScript but also works with frontend frameworks/libraries with a little bit of extra work. (example is on the way)
- You can use this with pixi.js, fabric.js, Konva; or maybe just html canvas. (example is on the way)

## Quick Start (Using only HTML canvas)
The `Board` class extends an existing canvas element in the DOM to have extra capabilities such as pan, zoom, and rotation.
To instantiate a new board, you need have a canvas element in your html.
```html
<canvas id="board"></canvas>
```

Call the step function of the `Board` class and in a `requestAnimationFrame` callback.
```javascript
import { Board } from "ue-too";

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

This is probably a good time to talk about coordinate system. The `Board` class has an attribute `alignCoordinateSystem` if set to `false` would result in a reversed y axis.
Meaning positive y goes up in the screen.

Setting `alignCoordinateSystem` would also require an update to the context which you use to draw stuff. After altering the value of `alignCoorindateSystem` if you have previously stored the value of `board.context` somewhere you would need to update that value by calling `board.context` and use the returned value to udpate the stored value.

Without updating the context, the stuff you draw would probably result in a weird state. (everything is reversed in terms of y) `board` takes care of this by using `Proxy` so you don't have to remember to negate the y value when you set `alignCoorindateSystem` to false.

## Development
I am using pnpm as the package manager for this project.
Node version 20.11.0 is used for development. (Some of the scripts that I wrote for ci/cd uses node version 20 APIs and is not compatible with 22 (specifically the `assert`) I will migrate them to use node version 22 APIs when I have time.)

The dev environment setup for this project is relatively simple. Let me break down the different aspects.
- Bundling (rollup): `pnpm build` Bundling is done through rollup. There's a `rollup.config.js` in charge of that. Every subdirectory in the `src` directory gets its own bundled index.js file.
- Unit Testing (jest): `pnpm test` There's not a lot of tests right now. Only the core functionalities revolving around the camera are unit tested. The next section I will move on to test is the input state machine.
- Dev Server (vite): `pnpm dev` The `devserver` directory contains the current examples of the board. It's sort of like a playground. The more complete example is the in the `main.ts` file.
- Docs Dev Server (vite): `pnpm dev:docs` would spin up a docs server serving files from the directory `docs-staging`
- Documentation (typedoc): `pnpm doc:default` would generate a `docs-staging/en` and then `pnpm doc:move2prod` would copy the entire `docs-staging` to `docs`
- Translation: __Pending__ This is a work in progress probably not going to be ready for the version 0.2 release. The flow of how things should be done is still in discussion.

To start developing `board` first clone the repo.

Then install the dependencies using

```bash
pnpm i
```

And then off you go! You can modify however as you like it.

The [API documentation](https://ue-too.github.io/ue-too/) has all the APIs listed.

## Under the Hood (a rather brief overview)

#### Data Flow
How board achieve the effect of infinite canvas is through a camera abstraction. It's like the viewport attribute of svg. 

The user controls the position, zoom, and rotation of the camera to see different parts of a canvas context.

i.e. if you draw a circle with the center at (100, 100) on the context, if the position of the camera is at (100, 100) the cirle would appear in the center of the canvas element.

Everything starts with an user input: a pointer down event, or a touchstart event.
These events are captured by the event listeners added to the canvas element. Then, the event listeners would parse the raw events into a more granular events like: `LEFT_POINTER_MOVE`, `SPACEBAR_DOWN`, etc.

These parsed events are then fed into the input state machine to interpret the user's intent.

The input state machine would spit out something like pan with some distance, or zoom to X scale, etc. 
These are called the raw user inputs (meaning that they exist in the viewport coorindate system instead of the canvas context or the world coordinate.)

The raw user inputs are broadcast by the raw user input publisher to the subscribers including the flow control.

The flow control is where different sources of camera input are coordinated. This is in place to prepare for animated camera input.
(an example ruleset on how different kinds of input affect each other is: user input would take precedence over animated input on both zoom and pan meaning user can cancel animated camera movement)

You might not need this kind of functionality so there's a very basic flow control in place as the default that is just a simple relay.

The flow control then pass the desired camera input through `CameraRig`; this is essentially a pipeline that will perform a series of transformation on the camera inputs. 
(e.g. clamping the translation so that the camera does not move out of boundary; restrict camera movement in certain axis)

Below is a diagram on the data flow.
![camera-control-data-flow](./doc-media/camera-control-data-flow.png)

You can customize the data flow however you want. Heck you can probably plug directly from an event listener to the camera skipping all of the above.

For simplicity, the overarching class `Board` takes care of it all, but if you want customization you'll have to get familiar with the data flow and see which part best fits your need for customizing.

Detail on each part will be on the documentation site (not the API documentation, but more on how and why on the various parts of `board` and a few examples) I'll setup later but probably after the version 0.2 release.

There's one more thing about the data flow, since it's starting from event listeners all the way to the canvas context. This does not work if you want to use an offscreen canvas on a worker thread. This is a planned feature but will not be in version 0.2.

#### Coordinate System
Since the user controls where the camera (viewport) is, how big the camera is, and the rotation angle of the camera, it's coordinate system will deviate from the context/world coorindate system. 
![viewport and world coorindate system](./doc-media/coordinate-system.png)

`board` provides a few sets of coordinate conversion helper functions. Most of them are in the `src/board-camera/utils/coordinate-conversion.ts` file.

#### Input State Machine
In the [Data Flow](#data-flow) section I mentioned the state machine that is used to interpret user intentions. 
The state diagram for keyboard mouse, and trackpad input is shown below:
![kmt-input-state-machine](./doc-media/kmt-input-state-machine.png)

The state diagram for touch input is shown below:
![touch-input-state-machine](./doc-media/touch-input-state-machine.png)

You can customize how the state machine works by defining the relationship between each state in a state machine. There's a tiny library within `board` that's dedicated for this purpose.
Look into the `src/being` directory for more. (Detailed documentation will follow with the documentation site mentioned in the [data flow](#data-flow) section)

## TODO
- [ ] Add a canvas position dimension publisher that can be used to get the position and dimension of the canvas.
- [ ] Add a `boardify-pixi` package that contains utility functions for the board to work with pixi.js.
- [ ] Add a `boardify-fabric` package that contains utility functions for the board to work with fabric.js.
- [ ] Add a `boardify-konva` package that contains utility functions for the board to work with konva.js.
- [ ] Add an example of the board being used with react.
- [ ] Add an example of the board being used with svelte. (I'm learning svelte right now so I can make a example for that)
- [ ] Add an example of the board being used with vue. (Currently I don't have any plans on learning vue so probably not going to make one very soon)
- [ ] A documentation site. There is a lot of util stuff that I don't think will fit in here in the readme. So stay tuned! (I am experimenting with docusaurus right now so it might be a docusaurus site)

