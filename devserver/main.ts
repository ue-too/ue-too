import "./media";
import Board, { drawAxis, drawRuler, drawGrid } from "src/boardify";
import { Point, PointCal } from "point2point";
import { drawVectorTip, drawXAxis, drawYAxis, drawArrow } from "./drawing-util";
import { drawLine } from "./utils";
import { Container, SelectionBox } from "src/drawing-engine";
import { Animation, CompositeAnimation, PointAnimationHelper, Keyframe, EasingFunctions, NumberAnimationHelper } from "@niuee/bounce";
import { RelayControlCenter } from "src/input-flow-control/simple-relay";
import { createDefaultZoomToAtWorldHandler } from "src/board-camera/zoom/zoom-handler";
import { createDefaultPanByHandler } from "src/board-camera/pan/pan-handlers";
import { cameraPositionToGet, convertDeltaInViewPortToWorldSpace } from "src";
import type { BoardCamera, ZoomHandlerConfig } from "src/board-camera";

export function comboDetect(inputKey: string, currentString: string, combo: string): {nextState: string, comboDetected: boolean} {
    if(currentString.length > combo.length){
        return {nextState: "", comboDetected: false};
    }
    if(currentString.length === combo.length - 1){
        return {nextState: "", comboDetected: currentString + inputKey === combo};
    }
    if(combo[currentString.length] === inputKey){
        return {nextState: currentString + inputKey, comboDetected: false};
    }
    if(combo.startsWith(currentString.substring(1))){
        return {nextState: currentString.substring(1) + inputKey, comboDetected: false};
    }
    if(combo[0] === inputKey){
        return {nextState: inputKey, comboDetected: false};
    }
    return {nextState: "", comboDetected: false};
}

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const board = new Board(canvas);
board.camera.setRotation(0 * Math.PI / 180);
board.alignCoordinateSystem = false;
console.log("context", board.context);
const drawingEngine = new Container(board.context);

const experimentalZoomHandler = createDefaultZoomToAtWorldHandler();
const panHandler = createDefaultPanByHandler();

const config: ZoomHandlerConfig = {
    panByHandler: panHandler,
    limitEntireViewPort: false,
    restrictZoom: false,
    restrictXTranslation: false,
    restrictYTranslation: false,
    restrictRelativeXTranslation: false,
    restrictRelativeYTranslation: false,
}

const positionKeyframe: Keyframe<Point>[] = [{percentage: 0, value: {x: board.camera.position.x, y: board.camera.position.y}, easingFn: EasingFunctions.linear}];
const zoomKeyframe: Keyframe<number>[] = [{percentage: 0, value: board.camera.zoomLevel, easingFn: EasingFunctions.linear}];
const rotationKeyframe: Keyframe<number>[] = [{percentage: 0, value: board.camera.rotation, easingFn: EasingFunctions.linear}];

const animation = new Animation(positionKeyframe, (value)=>{
    // const pointInWorld = board.camera.convertFromViewPort2WorldSpace(value);
    // (board.controlCenter as RelayControlCenter).notifyPanToAnimationInput(value);
    const pointInWorldShouldBeInViewPort = value;
    const cameraPositionSatisfy = cameraPositionToGet({x: 100, y: 100}, pointInWorldShouldBeInViewPort, board.camera.zoomLevel, board.camera.rotation);
    (board.controlCenter as RelayControlCenter).notifyPanToAnimationInput(cameraPositionSatisfy);
}, new PointAnimationHelper(), 1000);

const zoomAnimation = new Animation(zoomKeyframe, (value)=>{
    // console.log("zoom level", value);
    (board.controlCenter as RelayControlCenter).notifyZoomInputAnimationWorld(value);
}, new NumberAnimationHelper(), 1000);

const rotationAnimation = new Animation(rotationKeyframe, (value)=>{
    // console.log("rotation", value);
    board.camera.setRotation(value);
}, new NumberAnimationHelper(), 1000);

const compositeAnimation = new CompositeAnimation();
compositeAnimation.addAnimation("position", animation);
compositeAnimation.addAnimation("zoom", zoomAnimation);
compositeAnimation.addAnimation("rotation", rotationAnimation);
// compositeAnimation.addAnimationAdmist("zoom", zoomAnimation, "position", 50);
// compositeAnimation.addAnimationAfter("zoom", zoomAnimation, "position");

const resetCameraBtn = document.getElementById("reset-camera-btn") as HTMLButtonElement;
const experimentalZoomHandlerBtn = document.getElementById("experimental-zoom-handler-btn") as HTMLButtonElement;

experimentalZoomHandlerBtn.addEventListener("click", ()=>{
    experimentalZoomHandler(1, board.camera, {x: 0, y: 0}, config);
});

resetCameraBtn.addEventListener("click", ()=>{
    const pointInWorldInViewport = board.camera.convertFromWorld2ViewPort({x: 100, y: 100});
    console.log("originInViewPort", pointInWorldInViewport);
    const delta = {x: pointInWorldInViewport.x - 0, y: pointInWorldInViewport.y - 0};
    console.log("delta in viewport", delta);
    const deltaInWorld = convertDeltaInViewPortToWorldSpace(delta, board.camera.zoomLevel, board.camera.rotation);
    console.log("delta in world", deltaInWorld);
    console.log("current camera position", board.camera.position);
    console.log("target camera position", PointCal.addVector(board.camera.position, deltaInWorld));
    animation.keyFrames = [{
        percentage: 0,
        value: {x: pointInWorldInViewport.x, y: pointInWorldInViewport.y},
        easingFn: EasingFunctions.easeInOutSine
    },
    {
        percentage: 1,
        value: {x: 0, y: 0}
    }];
    zoomAnimation.keyFrames = [{
        percentage: 0,
        value: board.camera.zoomLevel,
        easingFn: EasingFunctions.easeInOutSine
    },
    {
        percentage: 1,
        value: 1,
        easingFn: EasingFunctions.easeInOutSine
    }];
    rotationAnimation.keyFrames = [{
        percentage: 0,
        value: board.camera.rotation,
        easingFn: EasingFunctions.easeInOutSine
    },
    {
        percentage: 1,
        value: 0,
    }];
    (board.controlCenter as RelayControlCenter).initatePanTransition();
    (board.controlCenter as RelayControlCenter).initateZoomTransition();
    compositeAnimation.startAnimation();
});

// board.fullScreen = true;
// board.camera.setRotation(45 * Math.PI / 180);

drawingEngine.addDrawTask({
    drawWithContext: (context, deltaTime) => {
        context.beginPath();
        context.arc(100, 100, 50, 0, Math.PI * 2);
        context.fillStyle = 'red';
        context.fill();
    },
    draw: (deltaTime) => {
        console.log("draw", deltaTime);
    }
});

// const stateMachine = board.touchStrategy.touchStateMachine;
const stateMachine = board.kmtStrategy.stateMachine;
const touchStateMachine = board.touchStrategy.touchStateMachine;

// stateMachine.onStateChange((currentState, nextState) => {
//     console.log("state change", currentState, "->", nextState);
// });

// parseStateMachine(stateMachine);
const states = stateMachine.possibleStates;

board.limitEntireViewPort = false;
board.camera.setZoomLevel(1);
board.camera.setPosition({x: 0, y: 0});

// drawingEngine.position = {x: 100, y: 100};

let lastUpdateTime = 0;
function step(timestamp: number){
    board.step(timestamp);
    const deltaMiliseconds = timestamp - lastUpdateTime;
    lastUpdateTime = timestamp;
    compositeAnimation.animate(deltaMiliseconds);
    board.context.fillStyle = 'white';
    board.context.fillRect(-5000, -5000, 10000, 10000);

    board.context.beginPath();
    board.context.arc(0, 100, 10, 0, Math.PI * 2);
    board.context.fillStyle = 'black';
    board.context.fill();
    
    drawXAxis(board.context, board.camera.zoomLevel);
    drawYAxis(board.context, board.camera.zoomLevel);
    board.context.lineWidth = 1 / board.camera.zoomLevel;

    drawingEngine.drawWithContext(board.context, deltaMiliseconds);

    const fourCorners = calculateTopFourCorners();
    drawRuler(board.context, fourCorners.topLeft, fourCorners.topRight, fourCorners.bottomLeft, fourCorners.bottomRight, true, board.camera.zoomLevel);
    // layout.render(result);
    // board.context.strokeStyle = 'red';
    // board.context.beginPath();
    // board.context.arc(fourCorners.topLeft.x, fourCorners.topLeft.y, 100, 0, Math.PI * 2);
    // board.context.fillStyle = 'red';
    // board.context.stroke();
    // console.log("fourCorners.topLeft", fourCorners.topLeft);
    // drawGrid(board.context, fourCorners.topLeft, fourCorners.topRight, fourCorners.bottomLeft, fourCorners.bottomRight, true, board.camera.zoomLevel);


    requestAnimationFrame(step);
}

step(0);

function calculateTopFourCorners(){
    const topLeft = board.camera.convertFromViewPort2WorldSpace({x: (-canvas.width / 2) / window.devicePixelRatio, y: (-canvas.height / 2) / window.devicePixelRatio});
    const topRight = board.camera.convertFromViewPort2WorldSpace({x: (canvas.width / 2) / window.devicePixelRatio, y: (-canvas.height / 2) / window.devicePixelRatio});
    const bottomLeft = board.camera.convertFromViewPort2WorldSpace({x: (-canvas.width / 2) / window.devicePixelRatio, y: (canvas.height / 2) / window.devicePixelRatio});
    const bottomRight = board.camera.convertFromViewPort2WorldSpace({x: (canvas.width / 2) / window.devicePixelRatio, y: (canvas.height / 2) / window.devicePixelRatio});
    // console.log("topLeft", topLeft);
    return {topLeft, topRight, bottomLeft, bottomRight};
}

// let currentCombo = "";

// window.addEventListener('keydown', (event)=>{
//     const {nextState, comboDetected} = comboDetec(event.key, currentCombo, "aabb");
//     console.log("nextState: ", nextState);
//     console.log("comboDetected: ", comboDetected);
//     currentCombo = nextState;
//     if(comboDetected){
//         console.log("combo detected");
//     }
// });

canvas.addEventListener('pointerdown', (event)=>{
    const pointInWindow = {x: event.clientX, y: event.clientY};
    const pointInWorld = board.convertWindowPoint2WorldCoord({x: pointInWindow.x, y: pointInWindow.y});
    console.log('point in world space: ', pointInWorld);
});

// canvas.addEventListener('touchmove', (event)=>{
//     const pointInWindow = {x: event.touches[0].clientX, y: event.touches[0].clientY};
//     console.log('point in world space: ', pointInWindow);
// });
