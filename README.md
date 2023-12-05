# vCanvas

__This project is experimental (only to show a way to have a canvas that can be panned, zoomed, and rotated) please do not use it in production until you modify it to your needs, test it out, and make sure that it suits all your needs__ <br/>

[Demo](https://vntchang.dev/vCanvasDemo/)

This is a project that I pull from the [Component Library](https://github.com/niuee/vnt-component-library). <br/>
It's basically a canvas with pan and zoom and also rotation on camera.<br/>
This is implemented using the web component API. I plan to also implement it as a React component.<br/>

This custom canvas element supports Safari, Chrome, and Firefox as for the eariliest version of each browser I would need time to investigate more on that. Webkit does not support extending from existing HTMLElement like HTMLCanvasElement, thus the canvas element is inheriting from just simple HTMLElement with an internal canvas element attached to the shadow dom. <br/>
The panning, zooming, rotating supports keyboard-mouse, trackpad, and also touch on iOS and iPadOS devices. I haven't tested this with screen that has touch capability. Also android devices are not tested either.

### Usage 
You can install the package from npm using 
```
npm install @niuee/vcanvas
```
Just like any other web component, you have to define the custom element first.
```javascript
// you can put the name that you want in here. make sure that it's more than two words and with dash(es) in between otherwise it won't work.
import { vCanvas } from "@niuee/vcanvas";
customElements.define('tag-name-you-want', vCanvas);
```
Then in a html file you can use it like this.
```html
<v-canvas></v-canvas>
```

### Coordinate System
I know the coordinate system for the native canvas html element down is positive y and right is positive x.<br>
However, I decided to flip the y-axis around to make up positive y and right positve x.<br/>
In the demo I have drawn the x and y axis on the canvas element. <br/>
__Green__ is the y axis and the extending direction is the positive direction. <br/>
__Red__ is the x axis.
The coordinate of the rendering context is still down for positive y and right for positive x. It's just when a user clicked on the canvas, the coordinate that is reported is in up for positive y and right for positive x coordinate system.

### panning
Keyboard-Mouse: <kbd>⌘</kbd> + Hold Down Left Mouse Button or on windows <kbd>⊞</kbd> + Hold Down Left Mouse Button <br/>
Trackpad: Two fingers swipe to pan<br/>
Touch: Two fingers swipe to pan (plan to change it to one finger drag to pan)<br/>

### zooming
Keyboard-Mouse: scroll on the wheel, (zoom is anchor to the cursor position)<br/>
Trackpad: Two fingers pinch to zoom<br/>
Touch: Two fingers pinch to zoom<br/>

### rotating
Rotating is a little more complicated because I couldn't figure out an intuitive way to directly rotate the canvas.
So I created sort of like a helper element to go with this functionality. It's the vDial. It's bascially a dial wheel element to emit event to change the rotation angle of the canvas. Please check the playground example for how to link the input element to the canvas element. You can actually swap any other input element for this. 

Below is the example using the dial wheel element to add event listener to update the canvas rotation to the input value of the dial wheel.
```javascript
dialWheel.addEventListener('needlechange', (evt: Event)=>{
    let dialEvent = evt as DialWheelEvent;
    let angleSpan = dialEvent.detail.angleSpan;
    // call this function to update the rotation of the canvas; it takes an angle in radians.
    element.setCameraAngle(angleSpan);
});
```

You can swap it with the input element of your choice; heck, you can probably create a more stylish and intuitive element to control the rotation than I did.
```javascript
let canvasElement = document.querySelector("#test-canvas");
let inputElement = document.querySelector("#your-input-element"); // let's take a textfield input as an example
input.addEventListener('change', (e)=>{
    canvasElement.setCameraAngle(e.target.value); // assumming e.target.value is a valid value (setCameraAngle takes in an angle in radians)
})
```

There is also a custom event that the canvas element emits to pass the camera information to other element. (So you can sync your element with the current rotation / position / zoom level of the canvas element to indicate the status of the canvas camera)
```javascript
let canvasElement = document.querySelector("#test-canvas");
canvasElement.addEventListener('cameraupdate', (evt)=>{
    let cameraInfo = evt.detail;
    dialWheel.linkRotation(cameraInfo.cameraAngle); // you can swap this with the input element of your choice
})
```

### To Draw Your Own Stuff
This is a bit more complicated. I intend to find a better solution for this. Currently there are two ways to draw your own stuff. <br/>
I am going to demonstrate both of those.

1. Add the `tap-step` attribute to the canvas element and draw in your own step functions
```html
<v-canvas tap-step></v-canvas>
```
```javascript

const context = canvasElement.getContext();
const stepFunction = canvasElement.getStepFunction();

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

window.requestAnimationFrame(step);
```

2. Create a class that implements the UIComponent interface. I have an exported interface as shown below.
```typescript
interface UIComponent{
    draw(context: CanvasRenderingContext2D, zoomLevel: number): void;
}
```
The canvas element has a method to add into its list of UI components. The canvas will draw them at every frame.
```typescript
// this is an example of an implementation of UIComponent interface
class UICircle implements UIComponent {

    private centerX: number;
    private centerY: number;
    private radius: number;

    constructor(centerX: number, centerY: number, radius: number){
        this.centerX = centerX;
        this.centerY = centerY;
        this.radius = radius;
    }

    draw(context: CanvasRenderingContext2D, zoomLevel: number){
        context.beginPath();
        context.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        context.stroke();
    }
}

// example of inserting into canvas
const exampleCircle = new UICircle(0, 0, 200);
canvasElement.insertUIComponent(exampleCircle);
```

The above methods are not ideal. I am still thinking about how to improve this process.

### Attributes

#### `restrict-{x-translation | y-translation | rotation | zoom}`
This is to restrict any kind of input from the gestures (mouse-keyboard input, trackpad gesture, touch points) to move, rotate, or zoom the canvas.<br/>
For Example, to limit the x direction translation set the attribute restrict-x-translation on the html tag.

This will restrict the ability to pan the canvas in x-direction.
```html
<v-canvas restrict-x-translation></v-canvas> 
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
    // do your work
    // ...
    // ...
    canvasStepFn(timestamp);
    window.requestAnimationFrame(step);
}

window.requestAnimationFrame(step);
```
