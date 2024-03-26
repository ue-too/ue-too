# board

[Demo](https://vntchang.dev/vCanvasDemo/)
_The demo version is rather old and outdated but it showcases the basic functionalities so I am keeping it here. I will replace it with the newer version later on when it's stable_

[Documentation](https://niuee.github.io/board/index.html) This documentation is still in its early stages; a lot of things are still not documented properly.

The [design document](https://hackmd.io/@niuee/ByKskjAUp) contains a more detailed explanation of the underlying mechanisms of the canvas including the camera system that is essentially the backbone of this custom canvas.

## Installation
There are a lot of ways to import this library.
If you are already bundling you project through some kind of bundler and you have npm or pnpm or other package manager to manage you dependencies.
You can install the package using npm.
```bash
npm install @niuee/board
```

Or alternatively you can use the bundled JavaScript in the releases and put it in the same directory for other JavaScript to import
```javascript
import { Board } from "./board.js";
```

Or you can import from the jsdelivr cdn 
```javascript
import { Board } from "https://cdn.jsdelivr.net/npm/@niuee/board@latest/index.mjs";
```

The above are all through esm. Additionally, the library is bundled to iife and umd as well just look for those directories.
For example using the iife 
```html
<script src="https://cdn.jsdelivr.net/npm/@niuee/board@latest/iife/index.js"></script>
```

and then in a JavaScript file you can use the exports of @niuee/board using the name board.{some export}

```javascript
const newBoard = new board.Board(canvasElement);
```

## Usage
The `Board` class extends an existing canvas element in the DOM to have extra capabilities such as pan, zoom, and rotation. 
To instantiate a new board.

Have a canvas element in your html or create and append one to the DOM using JavaScript.
```html
<canvas id="board"></canvas>
```
```javascript
import { Board } from "@niuee/board";

const canvasElement = document.getElementById("board"); // or other method to get a canvas element you would like to use
const board = new Board(canvasElement); 
// if you are using this library through iife don't use the variable name board since it would have name conflict with the library
```

A canvas element is basically like a static image, to make it look like it's panning or something is happening to it, most
libraries rely on the `requestAnimationFrame` function to make it move so does @niuee/board. 
By default the `Board` class does not call the `requestAnimationFrame` function by itself, because if the `Board` class calls the
function itself, users would have to alter the `Board` class in order to do anything meaningful. Thus, the `Board` class relies on 
the user to call the `requestAnimationFrame` and call the `Board` class `step` function in it. It similar to how threejs would have
its user call the `requestAnimationFrame` function in this [example](https://threejs.org/docs/index.html#manual/en/introduction/Creating-a-scene).

To get the step function of the `Board` class.
```javascript
import { Board } from "@niuee/board";

const canvasElement = document.querySelector("canvas");
const board = new Board(canvasElement); 

const stepFn = board.getStepFunction();

function step(timestamp){
    // timestamp is the argument requestAnimationFrame pass to its callback function
    
    // step the board first before everything else you want to do because stepping the board would wipe the canvas
    // pass in the timestamp as it is to the board's step function.
    stepFn(timestamp);

    // do your stuff

}
```
Right now, the board should have the basic functionalities. (able to pan and zoom)
There's probably nothing on your canvas 
```javascript
board.debugMode = true;
```

You'll probably see a X-axis drawn in red and Y-axis drawn in green, and a green reference circle drawn in green at location (30, 20).
There is also going to have a red cross hair at the cursor's position on the canvas with the position coordinate.

This is probably a good time to talk about the coordinate system @niuee/board uses. The canvas element uses the y-axis down coordinate system.
@niuee/board just flip the y-axis, so positive direction of the y-axis in @niuee/board is up. However, the context which is part of the canvas api
uses y-axis down coordinate and @niuee/board uses the same context as a normal canvas element does. We'll discuss the impact this has on the usage of 
the canvas context.

To draw stuff on the board first get the 2d context of the board.
```javascript
const ctx = board.getContext();
```
The context returned is using the down is positive y coordinate system, but @niuee/board is flipped. If you look at the current canvas, you'll have a y and a x axis.
These two interset at the position of (0, 0) in @niuee/board. This also happens to be the origin of a canvas element. When you use the returned context to draw stuff,
it would be the same as a regular canvas. 

```javascript
ctx.beginPath();
ctx.arc(10, 10, 5, 0, 2 * Math.PI);
ctx.stroke();
```

This would result in a circle drawn to the bottom right of the origin. The same as a regular canvas. Here comes the tricky part, in the eye of @niuee/board this location where the 
circle is drawn is actually (10, -10). If you have a `pointerdown` event listener you would get `clientX` and `clientY` from the event, there is a helper function from `Board` to convert
the `clientX` and `clientY` to world coordinate in @niuee/board: `convertWindowPoint2WorldCoord`. This function takes in a single argument of type `{x: number, y: number}` you can directly pass
in the `clientX` and `clientY` to the function. This is probably pretty hard to wrap one's head around, so that's look at an example.



