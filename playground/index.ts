import { vCanvas, CameraUpdateEvent } from "../src";
import { vDial, DialWheelEvent } from "../src";


customElements.define('v-canvas', vCanvas);
customElements.define('v-dial', vDial);

let element = document.getElementById("test-graph") as vCanvas;
let button = document.querySelector("button");
let dialWheel = document.querySelector("v-dial") as vDial;
let positionText = document.querySelector("#clicked-position");
let zoomLevelText = document.querySelector("#zoom-level");
let cameraPositionText = document.querySelector("#camera-position");
let cameraRotationText = document.querySelector("#camera-rotation");

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
    if(zoomLevelText !== null){
        zoomLevelText.innerHTML = `${cameraInfo.cameraZoomLevel.toFixed(2)}`;
    }
    if(cameraPositionText !== null){
        cameraPositionText.innerHTML = `x: ${cameraInfo.cameraPosition.x.toFixed(2)} y: ${cameraInfo.cameraPosition.y.toFixed(2)}`;
    }
    if(cameraRotationText !== null){
        cameraRotationText.innerHTML = `${(cameraInfo.cameraAngle * 180 / Math.PI).toFixed(2)}`;
    }
});

element.addEventListener('pointerdown', (e)=>{
    const clickedPoint = element.convertWindowPoint2WorldCoord({x: e.clientX, y: e.clientY});
    // console.log("clicked point", clickedPoint);
    if(positionText !== null){
        positionText.innerHTML = `x: ${clickedPoint.x.toFixed(2)} y: ${clickedPoint.y.toFixed(2)}`;
    }
});