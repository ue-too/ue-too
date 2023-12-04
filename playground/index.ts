import { vCanvas, CameraUpdateEvent } from "../src";
import { vDial, DialWheelEvent } from "../src";


customElements.define('v-canvas', vCanvas);
customElements.define('v-dial', vDial);

let element = document.getElementById("test-graph") as vCanvas;
let button = document.querySelector("button");
let dialWheel = document.querySelector("v-dial") as vDial;
if (button) {
    button.onclick = (e) => element.resetCamera();
}

dialWheel.addEventListener('needleslide', (evt: Event)=>{
    let dialEvent = evt as DialWheelEvent;
    let angleSpan = dialEvent.detail.angleSpan;
    element.spinCameraWithAnimation(angleSpan);
});

dialWheel.addEventListener('needlechange', (evt: Event)=>{
    let dialEvent = evt as DialWheelEvent;
    let angleSpan = dialEvent.detail.angleSpan;
    element.setCameraAngle(angleSpan);
});

element.addEventListener('cameraupdate', (evt: Event)=>{
    let cameraUpdateEvent = evt as CameraUpdateEvent;
    let cameraInfo = cameraUpdateEvent.detail;
    dialWheel.linkRotation(cameraInfo.cameraAngle);
})