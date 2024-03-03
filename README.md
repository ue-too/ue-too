# board

__This project is experimental (only to show a way to have a canvas that can be panned, zoomed, and rotated) please do not use it in production until you modify it to your needs, test it out, and make sure that it suits all your needs__ <br/>

[Demo](https://vntchang.dev/vCanvasDemo/)
_The demo version is rather old and outdated but it showcases the basic functionalities so I am keeping it here. I will replace it with the newer version later on when it's stable_

[Documentation](https://niuee.github.io/board/index.html) This documentation is still in its early stages; a lot of things are still not documented.

Initially, I needed a way to have a pannable and zoomable canvas for a racetrack maker project that I was working on. I stumbled upon a [codepen example](https://codepen.io/chengarda/pen/wRxoyB) that is posted in stackoverflow. It was a fantastic starting point. It provided everything that I need. However, some functionalities I needed was not there; I started to build on top of this and make a canvas element that is easier to work with and modify and has the functionalities that I need. 

This project is written entirely with vanilla JavaScript (with TypeScript). However, in the future I plan to have a React version of this and maybe support other frontend libraries and/or frameworks.

It's using the web component api and supports Safari, Chrome, and Firefox as for the eariliest version of each browser I would need time to investigate more on that. Webkit does not support extending from existing HTMLElement like HTMLCanvasElement, thus the canvas element is inheriting from just simple HTMLElement with an internal canvas element attached to the shadow dom.

The panning, zooming, rotating supports keyboard-mouse, trackpad, and also touch on iOS and iPadOS devices. I haven't tested this with screen that has touch capability. Android devices are not tested either.

The [design document](https://hackmd.io/@niuee/ByKskjAUp) contains a more detailed explanation of the underlying mechanisms of the canvas including the camera system that is essentially the backbone of this custom canvas.

### v0.0.1 -> v0.0.2 
The default export for this package is changed to a `Board` class. This is different from the original class used for custom element. To use the custom element class use the named export 
```javascript
import { BoardElement } from "@niuee/board";
```
or the default export of the sub directory in the pacakge. (If you want to keep the name `Board` in your source code)
```javascript
import Board from "@niuee/board/board-element";
```


### Installation
You can install the package from npm using
```
npm install @niuee/board
```
Or you can just use the files in the release and import it directly

They are in the release tab of this repo. (both the minified JavaScript file and the map)

---
### Usage
There are two ways to use this package. One is to use the custom element `BoardElement` class. This is the custom element however I can't quite to sort out the issue where the style and dimensions of the custom element not lining up with the canvas element attached to the shadow dom. Therefore, I have an alternative and is the recommended way to use this package: to use a Board class to provide the extended functionalities and leave the HTML element and CSS to the html and CSS files. 

#### The `BoardElement` way.

Just like any other web component, you have to define the custom element first.
```javascript
// you can put the name that you want in here; but you have to make sure that it's more than one word (two words and up) and with dash(es) in between otherwise it won't work. This is the constraint imposed by web component
import { BoardElement } from "@niuee/board";
customElements.define('tag-name-you-desire', BoardElement);
```
Then in a html file you can use it like this.
```html
<tag-name-you-desire></tag-name-you-desire>
```

To operate on the BoardElement with JavaScript
```javascript
const boardElement = document.querySelector("tag-name-you-desire") as BoardElement
// do what you want to do with boardElement; detailed example in later sections
```

The `Board` way.

The `Board` class constructor takes in a canvas element as an argument to add extended funcionalities.

```javascript
import Board from "@niuee/board"

const canvasElement = document.querySelect("canvas");
const board = new Board(canvasElement);

```

### Coordinate System
I know the coordinate system for the native canvas html element down is positive y and right is positive x. However, I decided to flip the y-axis around to make up positive y and right positve x.
In the demo I have drawn the x and y axis on the canvas element. 
__Green__ is the y axis and the extending direction is the positive direction.
__Red__ is the x axis.
The coordinate of the rendering context is still down for positive y and right for positive x. It's just when a user clicked on the canvas, the coordinate that is reported is in up for positive y and right for positive x coordinate system.

### panning
Keyboard-Mouse: <kbd>⌘</kbd> + Hold Down Left Mouse Button or on windows <kbd>⊞</kbd> + Hold Down Left Mouse Button or Hold the wheel button. <br/>
Trackpad: Two fingers swipe to pan<br/>
Touch: Two fingers swipe to pan (plan to change it to one finger drag to pan)<br/>

### zooming
Keyboard-Mouse: scroll the wheel while holding down the control key, (zoom is anchor to the cursor position)<br/>
Trackpad: Two fingers pinch to zoom<br/>
Touch: Two fingers pinch to zoom<br/>

### rotating
Rotating is a little more complicated because I couldn't figure out an intuitive way to directly rotate the canvas. However, the functionality is there. I'll explain in more detail in a later section.

---
### RequestAnimationFrame
HTML Canvas is essentially a static image. To make it look like an actual canvas that you can manipulate and mess around. It relies on the requestAnimationFrame function. Clearing the canvas and redrawing at each frame so that it looks like the canvas is actually moving like an animation. 

Currently, the default is that the canvas will not call the requestAnimationFrame itself. It relies on the user to call requestAnimationFrame for it. I will demonstrate it below.

### Get the step function of the canvas.
You can think of the step function similar to the `render` function of a `renderer` from threejs which you have to call in the `animate` function in this [example](https://threejs.org/docs/index.html#manual/en/introduction/Creating-a-scene). The step function takes in an argument `timestamp: number`; you can get this directly as the arugment of the call back function passed into `requestAnimationFrame`. You can also just use the step function as the callback passed into `requestAnimationFrame`; but this way you would not be able to do much stuff with the canvas. To get the `step` function simply call the `getStepFunction()` from the canvas element like this.
```javascript
const canvasElement = document.querySelector("tag-name-you-desire") as BoardElement; // this is the tag name that you assign to the custom element; or you can assign id to the tag and select using id
const stepFunction = canvasElement.getStepFunction(); // canvas element is of type vCanvas you can get it using the queryselector

const context = canvasElement.getContext(); // this is the drawing context for the canvas element

// this is the step function that wraps the canvas step function so you can also do stuff at each frame
function step(timestamp: number){
    // make sure to step the canvas element first otherwise your stuff is going to get wiped when the canvas element steps
    stepFunction(timestamp);

    // this is an example of drawing a circle
    context.beginPath();
    context.arc(200, -100, 5, 0, Math.PI * 2);
    context.stroke();

    // call the requestAnimationFrame to keep stepping
    window.requestAnimationFrame(step);
}

// remember to call the function to start
step(0); 
```

The `Board` way is very similar. 
```javascript
const board = new Board(canvasElement); // instantiate a Board object with a canvas element
const stepFunction = board.getStepFunction(); // canvas element is of type vCanvas you can get it using the queryselector

const context = board.getContext(); // this is the drawing context for the canvas element

// this is the step function that wraps the canvas step function so you can also do stuff at each frame
function step(timestamp: number){
    // make sure to step the canvas element first otherwise your stuff is going to get wiped when the canvas element steps
    stepFunction(timestamp);

    // this is an example of drawing a circle
    context.beginPath();
    context.arc(200, -100, 5, 0, Math.PI * 2);
    context.stroke();

    // call the requestAnimationFrame to keep stepping
    window.requestAnimationFrame(step);
}

// remember to call the function to start
step(0); 

```
---
### Attributes

#### `restrict-{x-translation | y-translation | rotation | zoom}`
This is to restrict any kind of input from the gestures (mouse-keyboard input, trackpad gesture, touch points) to move, rotate, or zoom the canvas.<br/>
For Example, to limit the absolute x direction translation set the attribute restrict-x-translation on the html tag.

This will restrict the ability to pan the canvas in x-direction.

The `BoardElement` way. It's to add an attribute to the html custom element.
```html
<canvas-board restrict-x-translation></canvas-board>
```

The `Board` way. It's to just set the property `restrictXTranslation` to `true`.
```javascript
board.restrictXTranslation = true;
```

#### `restrict-relative-{x-translation | y-translation}`
This is to restrict any kind of input from the gestures (mouse-keyboard input, trackpad gesture, touch points) to move relative to the camera viewport.
X is the left and right direction of the view port and Y is the up and down direction.

The `BoadElement` way. It's to add an attribute to the html custom element.
```html
<canvas-board restrict-relative-x-translation></canvas-board> 
```

The `Board` way. It's to just set the property `restrictYTranslation` to `true`.
```javascript
board.restrictRelativeYTranslation = true;
```

#### `full-screen`
This is to set the dimensions of the canvas to be the same as `window.innerHeight` and `window.innerWidth`.<br/>
This will override the `width` and `height` attribute.
```html
<canvas-board full-screen></canvas-board> 
```

#### `width`

The `BoardElement` way.
This is to set the width of the canvas.
```html
<canvas-board width="300"></canvas-board> 
```

The `Board` way.
This will change the width of the canvas element. 
The Board class instance also listens to the attribute change of the underlying canvas element. So if you can also change the width of the canvas element; the board class instance will take care of the change under the hood.
```javascript
board.width = 300;
```
OR
```html
<canvas width="300"></canvas>
```

#### `height`

The `BoardElement` way.

This is to set the height of the canvas.
```html
<canvas-board height="300"></canvas-board> 
```

The `Board` way.
This is similar to the width attribute. The board also listens to the height change of the canvas element it controls; you can change the height using JavasScript or directly in html.
```javascript
board.height = 300;
```
OR
```html
<canvas height="300"></canvas>
```

#### `control-step`
This is to prevent the canvas from calling the `window.requestAnimationFrame` automatically. Default is "true"(meaning that the canvas element would not call rAF itself the user would have to "control the step function"; I know it's kind of confusing I am still working on the name though)

The `BoardElement` way.
```html
<canvas-board control-step="false"></canvas-board> 
```
Setting this attribute to "false"(string as attribute value can only be string), the canvas would handle the calling of rAF and the user would just get the pan, zoom, and rotate functionality automatically. However, in this mode you would probably have to go into the source code of the canvas and add stuff to the step function to actually acheive anything.

The `Board` way.
```javascript
board.stepControl = false;
```

#### `debug-mode`
This would switch on the debug mode for the canvas. Currently, the debug mode is drawing the reference circle in green, the axis in their respective color, the bounding box in blue. The cursor icon would be replaced with a red crosshair and at the top right to the crosshair would be the position of the cursor in world coordinate.
The `BoardElement` way.
```html
<canvas-board debug-mode></canvas-board>
```

The `Board` way.
```javascript
board.debugMode = true;
```

#### `max-half-trans-width`
This is to set the horizontal boundaries for the viewport. (where the camera can move to) Currently, the boundaries are set mirrored at the origin. Hence the "half" in the attribute name. Left and right both gets the same value. The entire horizontal boundary is then 2 * half width wide. 

The `BoardElement` way.
```html
<!-- This would set the entire horizontal boundary of the camera to be 2000-->
<canvas-board max-half-trans-width="1000"></canvas-board>
```

The `Board` way
```javascript
board.maxHalfTransWidth = 1000;
```

#### `max-half-trans-height`
This is to set the vertical boundaries for the viewport. Currently, the boundaries are set mirrored at the origin. Hence the "half" in the attribute name. Top and bottom both gets the same value. The entire vertical boundary is then 2 * half width wide. 

The `BoardElement` way.
```html
<!-- This would set the entire vertical boundary of the camera to be 2000-->
<canvas-board max-half-trans-height="1000"></canvas-board>
```

The `Board` way.
```javascript
board.maxHalfTransHeight = 1000;
```

#### `grid`
This is to toggle the grid displayed on the canvas. The spacing currently is not adjustable; it is the same as the ruler (it flexible depending on the zoom).

The `BoardElement` way.
```html
<canvas-board grid></canvas-board>
```

The `Board` way.
```javascript
board.displayGrid = true;
```

#### `ruler`
This is to toggle the ruler displayed on the canvas. The spacing depends on the zoom level.

The `BoardElement` way.
```html
<canvas-board ruler></canvas-board>
```
The `Board` way.
```javascript
board.displayRuler = true;
```

---
### Listen to the event of panning, zooming, rotating movement
This is one of the revamped feature of the canvas. The rotation of the canvas needed to be controlled by an external element. That element would have to sync up with the rotation of the canvas. This was originally done through custom event; the canvas orientation would be dispatch through custom events at every frame even if the canvas is stationary. The mechanism in place now is to set up an event listener just like before but the canvas would only report the current orientation when the canvas is moved in any way. 

#### Pan Event
To listen to the pan event of the canvas.

The `BoardElement` way.
```javascript
// the pan call back 
function panCallback(event, cameraState) {
    // payload for pan event would contain the diff of the canvas pan
    // cameraState would be the current state of the abstracted camera
    console.log(event); // {diff: {x: number, y: number}}
    console.log(cameraState) // {position: Point, rotation: number, zoomLevel: number}
}

// listen to the pan event and when a pan event occur the callback would execute
canvasElement.on("pan", panCallback);

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

The `Board` way. 
It's not too different from the `BoardElement` way. It's just the `.on` function is called on the `Board` class instance.
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

#### Rotate Event
To Listen to the rotate event of the canvas.
The `BoardElement` way.
```javascript
// the rotate call back 
function rotateCallback(event, cameraState) {
    console.log(event);
    console.log(cameraState) // {position: Point, rotation: number, zoomLevel: number}
}

// listen to the rotate event and when a rotate event occur the callback would execute
canvasElement.on("rotate", rotateCallback);

// rotate event payload looks like
// {
//     deltaRotation: number;
// }
```

The `Board` way.

```javascript
board.on("rotate", rotateCallback);
```
#### Zoom Event
To Listen to the zoom event of the canvas.

The `BoardElement` way.
```javascript
// the zoom call back 
function zoomCallback(event, cameraState) {
    console.log(event); 
    console.log(cameraState) // {position: Point, rotation: number, zoomLevel: number}
}

// listen to the zoom event and when a zoom event occur the callback would execute
canvasElement.on("zoom", zoomCallback);

// zoom event payload looks like
// {
//     deltaZoomAmount: number;
//     anchorPoint: Point;
// }
```

The `Board` way.

```javascript
board.on("zoom", zoomCallback);
```
---

### Controlling the Camera

Currently, there is no function of the `Board` class nor the `BoardElement` class that directly control the underlying camera system. However, you can get the underlying `BoardCamera` instance using the `board.getCamera()` and the `boardElement.getCamera()` functions to get the internal `BoardCamera` object. 

Once you have the `boardCamera` you can do a lot of things. 

#### Command Conventions
#### Set or Move, (Set or spin for rotation operation), (Not applicable to zoom operation)
Set directly set the position of the camera. It takes in the destination as argument. Move takes in the delta as an argument making it suitable for when you don't care the current position of the camera.
#### FromGesture or not
FromGesture is affected by the restrictions (restrictXTranslation, etc.) The design document has a detailed relationship between different kinds of camera commands.
#### LimitEntireViewPort or not
If limiting the entire view port the entire view port would be contrained within the boundaries not just the center of the view port (or the camera position). I would post a gif demonstrating the difference.
#### Clamp or not
If there is no clamping then the command would not take effect if the destination is out of bounds. 
There is a graph in the design document.

For example you can call the `moveWithClampFromGesture(delta: {x: number, y: number})` to "move" the camera to a position clamped inside the boundaries from gesture so that the restrictions imposed would limit this command. 
