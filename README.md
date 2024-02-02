# vCanvas

__This project is experimental (only to show a way to have a canvas that can be panned, zoomed, and rotated) please do not use it in production until you modify it to your needs, test it out, and make sure that it suits all your needs__ <br/>

[Demo](https://vntchang.dev/vCanvasDemo/)
_The demo version is rather old and outdated but it showcases the basic functionalities so I am keeping it here. I will replace it with the newer version later on when it's stable_

Initially, I needed a way to have a pannable and zoomable canvas for a racetrack maker project that I was working on. I stumbled upon a [codepen example](https://codepen.io/chengarda/pen/wRxoyB) that is posted in stackoverflow. It was a fantastic starting point. It provided everything that I need. However, some functionalities I needed was not there; I started to build on top of this and make a canvas element that is easier to work with and modify and has the functionalities that I need. 

This project is written entirely with vanilla JavaScript. However, in the future I plan to have a React version of this and maybe support other frontend libraries and/or frameworks.

It's using the web component api and supports Safari, Chrome, and Firefox as for the eariliest version of each browser I would need time to investigate more on that. Webkit does not support extending from existing HTMLElement like HTMLCanvasElement, thus the canvas element is inheriting from just simple HTMLElement with an internal canvas element attached to the shadow dom.

The panning, zooming, rotating supports keyboard-mouse, trackpad, and also touch on iOS and iPadOS devices. I haven't tested this with screen that has touch capability. Android devices are not tested either.

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

### RequestAnimationFrame
HTML Canvas is essentially a static image. To make it look like an actual canvas that you can manipulate and mess around. It relies on the requestAnimationFrame function. Clearing the canvas and redrawing at each frame so that it looks like the canvas is actually moving like an animation. 

Currently, the default is that the canvas will not call the requestAnimationFrame itself. It relies on the user to call requestAnimationFrame for it. 

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

#### `tap-step`
This is to prevent the canvas from calling the `window.requestAnimationFrame` automatically.
```html
<v-canvas tap-step></v-canvas> 
```
After setting this attribute, for the panning, zooming, and rotating to work. You need to call the `window.requestAnimationFrame` yourself, and also call the step function for the canvas along with your own step function. Below is an example.
```javascript
let canvasStepFn = canvasElement.getStepFunction(); // this will return the step function of the canvas element

// this is an example of your own step function
function step(timestamp){
    // call the step function of the canvas first because the canvas step function will clear the canvas
    canvasStepFn(timestamp);
    // do your work
    // ...
    // ...
    window.requestAnimationFrame(step);
}

window.requestAnimationFrame(step);
```
