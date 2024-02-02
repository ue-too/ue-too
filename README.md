# vCanvas

__This project is experimental (only to show a way to have a canvas that can be panned, zoomed, and rotated) please do not use it in production until you modify it to your needs, test it out, and make sure that it suits all your needs__ <br/>

[Demo](https://vntchang.dev/vCanvasDemo/)
_The demo version is rather old and outdated but it showcases the basic functionalities so I am keeping it here. I will replace it with the newer version later on when it's stable_

Initially, I needed a way to have a pannable and zoomable canvas for a racetrack maker project that I was working on. I stumbled upon a [codepen example](https://codepen.io/chengarda/pen/wRxoyB) that is posted in stackoverflow. It was a fantastic starting point. It provided everything that I need. However, some functionalities I needed was not there; I started to build on top of this and make a canvas element that is easier to work with and modify and has the functionalities that I need. 

This project is written entirely with vanilla JavaScript. However, in the future I plan to have a React version of this and maybe support other frontend libraries and/or frameworks.

It's using the web component api and supports Safari, Chrome, and Firefox as for the eariliest version of each browser I would need time to investigate more on that. Webkit does not support extending from existing HTMLElement like HTMLCanvasElement, thus the canvas element is inheriting from just simple HTMLElement with an internal canvas element attached to the shadow dom.

The panning, zooming, rotating supports keyboard-mouse, trackpad, and also touch on iOS and iPadOS devices. I haven't tested this with screen that has touch capability. Android devices are not tested either.

The [design document](https://hackmd.io/@niuee/ByKskjAUp) contains a more detailed explanation of the underlying mechanisms of the canvas including the camera system that is essentially the backbone of this custom canvas.

### Installation
~~You can install the package from npm using~~

_I am revamping some of the features of vCanvas, currently the changes are not reflected on the published npm package. There are no simple way to just install and use the package since I use other packages that I didn't publish to npm; if you really want to clone the project and build it yourself, see the package.json file for other packages that vCanvas depends on and clone those packages from my GitHub repositories as well. (It's listed below)_ 

- [point2point](https://github.com/niuee/point2point) I've published this package on npm but I added some functions that I used in vCanvas and those are not updated to npm yet. 

After cloning the repo you can change the path for point2point in vCanvas's package.json and npm install to install the local cloned version of point2point.

---
### Usage
Just like any other web component, you have to define the custom element first.
```javascript
// you can put the name that you want in here; but you have to make sure that it's more than one word (two words and up) and with dash(es) in between otherwise it won't work. This is the constraint imposed by web component
import { vCanvas } from "@niuee/vcanvas";
customElements.define('tag-name-you-desire', vCanvas);
```
Then in a html file you can use it like this.
```html
<tag-name-you-desire></tag-name-you-desire>
```

### Coordinate System
I know the coordinate system for the native canvas html element down is positive y and right is positive x. However, I decided to flip the y-axis around to make up positive y and right positve x.
In the demo I have drawn the x and y axis on the canvas element. 
__Green__ is the y axis and the extending direction is the positive direction.
__Red__ is the x axis.
The coordinate of the rendering context is still down for positive y and right for positive x. It's just when a user clicked on the canvas, the coordinate that is reported is in up for positive y and right for positive x coordinate system.

### panning
Keyboard-Mouse: <kbd>⌘</kbd> + Hold Down Left Mouse Button or on windows <kbd>⊞</kbd> + Hold Down Left Mouse Button <br/> or Hold the wheel button.
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
You can think of the step function similar to the `render` function of a `renderer` from threejs where you have to call it in the `animate` function in this [example](https://threejs.org/docs/index.html#manual/en/introduction/Creating-a-scene). The step function takes in an argument `timestamp: number`; you can get this directly as the arugment of the call back function passed into `requestAnimationFrame`. You can also just use the step function as the callback passed into `requestAnimationFrame`; but this way you would not be able to do much stuff with the canvas. To get the `step` function simply call the `getStepFunction()` from the canvas element like this.
```javascript
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
---
### Attributes

#### `restrict-{x-translation | y-translation | rotation | zoom}`
This is to restrict any kind of input from the gestures (mouse-keyboard input, trackpad gesture, touch points) to move, rotate, or zoom the canvas.<br/>
For Example, to limit the absolute x direction translation set the attribute restrict-x-translation on the html tag.

This will restrict the ability to pan the canvas in x-direction.
```html
<v-canvas restrict-x-translation></v-canvas> 
```
#### `restrict-relative-{x-translation | y-translation}`
This is to restrict any kind of input from the gestures (mouse-keyboard input, trackpad gesture, touch points) to move relative to the camera viewport.
X is the left and right direction of the view port and Y is the up and down direction.
```html
<v-canvas restrict-relative-x-translation></v-canvas> 
```
#### `full-screen`
This is to set the dimensions of the canvas to be the same as `window.innerHeight` and `window.innerWidth`.<br/>
This will override the `width` and `height` attribute.
```html
<v-canvas full-screen></v-canvas> 
```

#### `width`
This is to set the width of the canvas.
```html
<v-canvas width="300"></v-canvas> 
```

#### `height`
This is to set the height of the canvas.
```html
<v-canvas height="300"></v-canvas> 
```

#### `control-step`
This is to prevent the canvas from calling the `window.requestAnimationFrame` automatically. Default is "true"(meaning that the canvas element would not call rAF itself the user would have to "control the step function"; I know it's kind of confusing I am still working on the name though)
```html
<v-canvas control-step="false"></v-canvas> 
```
Setting this attribute to "false"(string as attribute value can only be string), the canvas would handle the calling of rAF and the user would just get the pan, zoom, and rotate functionality automatically. However, in this mode you would probably have to go into the source code of the canvas and add stuff to the step function to actually acheive anything.

#### `debug-mode`
This would switch on the debug mode for the canvas. Currently, the debug mode is drawing the reference circle in green, the axis in their respective color, the bounding box in blue. The cursor icon would be replaced with a red crosshair and at the top right to the crosshair would be the position of the cursor in world coordinate.
```html
<v-canvas debug-mode></v-canvas>
```

#### `max-half-trans-width`
This is to set the horizontal boundaries for the viewport. Currently, the boundaries are set mirrored at the origin. Hence the "half" in the attribute name. Left and right both gets the same value. The entire horizontal boundary is then 2 * half width wide. 
```html
<!-- This would set the entire horizontal boundary of the camera to be 2000-->
<v-canvas max-half-trans-width="1000"></v-canvas>
```

#### `max-half-trans-height`
This is to set the vertical boundaries for the viewport. Currently, the boundaries are set mirrored at the origin. Hence the "half" in the attribute name. Top and bottom both gets the same value. The entire vertical boundary is then 2 * half width wide. 
```html
<!-- This would set the entire vertical boundary of the camera to be 2000-->
<v-canvas max-half-trans-height="1000"></v-canvas>
```
---
### Listen to the event of panning, zooming, rotating movement
This is one of the revamped feature of the canvas. The rotation of the canvas needed to be controlled by an external element. That element would have to sync up with the rotation of the canvas. This was originally done through custom event; the canvas orientation would be dispatch through custom events at every frame even if the canvas is stationary. The mechanism in place now is to set up an event listener just like before but the canvas would only report the current orientation when the canvas is moved in any way. 

#### Pan Event
To listen to the pan event of the canvas.
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

#### Rotate Event
To Listen to the rotate event of the canvas.
```javascript
// the rotate call back 
function rotateCallback(event, cameraState) {
    console.log(event);
    console.log(cameraState) // {position: Point, rotation: number, zoomLevel: number}
}

// listen to the rotate event and when a pan event occur the callback would execute
canvasElement.on("rotate", rotateCallback);

// rotate event payload looks like
// {
//     deltaRotation: number;
// }
```
#### Zoom Event
To Listen to the zoom event of the canvas.
```javascript
// the zoom call back 
function zoomCallback(event, cameraState) {
    console.log(event); 
    console.log(cameraState) // {position: Point, rotation: number, zoomLevel: number}
}

// listen to the zoom event and when a pan event occur the callback would execute
canvasElement.on("rotate", rotateCallback);

// zoom event payload looks like
// {
//     deltaZoomAmount: number;
//     anchorPoint: Point;
// }
```
---

To control the rotation the external element would have to be able to tell the canvas how to rotate. To do this, the external element would have to issue a command to the canvas. This usecase is rather uncommon so I'll point to the source code for the commands and if you need to add new commands it's also at the same place. 
`/src/vCanvas/cameraChangeCommand/cameraObserver.ts`
