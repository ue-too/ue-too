import { vCanvas, CameraUpdateEvent, InteractiveUIPolygonComponent } from "../src";
import { vDial, DialWheelEvent, Point } from "../src";


customElements.define('v-canvas', vCanvas);
customElements.define('v-dial', vDial);

let element = document.getElementById("test-graph") as vCanvas;
let button = document.querySelector("#reset-camera") as HTMLButtonElement;
let restrictXTranslationButton = document.querySelector("#restrict-x-translation") as HTMLButtonElement;
let dialWheel = document.querySelector("v-dial") as vDial;
let positionText = document.querySelector("#clicked-position");
let zoomLevelText = document.querySelector("#zoom-level");
let cameraPositionText = document.querySelector("#camera-position");
let cameraRotationText = document.querySelector("#camera-rotation");
let toggleTest = document.querySelector("#toggle-test") as HTMLInputElement;

if(toggleTest){
    toggleTest.onchange = (e) =>{
        dialWheel.style.visibility = toggleTest.checked ? "visible" : "hidden";
    }
}

if (button) {
    button.onclick = (e) => element.resetCamera();
}

if (restrictXTranslationButton) {
    restrictXTranslationButton.onclick = (e) => {
        element.setAttribute("restrict-relative-x-translation", "true")
    };
}
if(dialWheel && element){
    const dialWheelHalfHeight = dialWheel.clientHeight / 2;
    const dialWheelHalfWidth = dialWheel.clientWidth / 2;
    const canvasCenterX = element.getBoundingClientRect().left + element.clientWidth / 2;
    const canvasCenterY = element.getBoundingClientRect().top + element.clientHeight / 2;
    let topValue = canvasCenterY - dialWheelHalfHeight;
    let leftValue = canvasCenterX - dialWheelHalfWidth;
    console.log("top", topValue);
    console.log("left", leftValue);
    dialWheel.style.top = topValue.toString() + "px";
    dialWheel.style.left = leftValue.toString() + "px";
    dialWheel.style.visibility = "hidden";
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


let testPolygon = new InteractiveUIPolygonComponent({x: 100, y: 100}, [{x: 50, y: 50}, {x: -50, y: 50}, {x: -50, y: -50}, {x: 50, y: -50}], 45 * Math.PI / 180);

const raycastCallback = (position: Point)=>{
    element.getCamera().lockOntoWithTransition(testPolygon);
};
testPolygon.setRayCastCallback(raycastCallback);
element.insertUIComponent(testPolygon);