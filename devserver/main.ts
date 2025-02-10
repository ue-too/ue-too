import "./media";
import Board, { drawAxis, drawRuler, drawGrid } from "../src/boardify";
import { Point, PointCal } from "point2point";
import { drawVectorTip, drawXAxis, drawYAxis, drawArrow } from "./drawing-util";
import { drawLine } from "./utils";
import { Container, SelectionBox } from "src/drawing-engine";
import { OrthogonalLayout, exampleGraph } from "src/being/layout";
import { Animation, CompositeAnimation, PointAnimationHelper, Keyframe, EasingFunctions, NumberAnimationHelper } from "@niuee/bounce";
import { RelayControlCenter } from "src/control-center/simple-relay";
import { CompleteZoomHandlerConfig, createDefaultZoomToAtWorldHandler } from "src/board-camera/zoom/zoom-handler";
import { createDefaultPanByHandler } from "src/board-camera/pan/pan-handlers";

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
const drawingEngine = new Container(board.context);

const layout = new OrthogonalLayout(board.context);
const result = layout.layout(exampleGraph);

const experimentalZoomHandler = createDefaultZoomToAtWorldHandler();
const panHandler = createDefaultPanByHandler();

const config: CompleteZoomHandlerConfig = {
    panByHandler: panHandler,
    entireViewPort: false,
    restrictZoom: false,
    restrictXTranslation: false,
    restrictYTranslation: false,
    restrictRelativeXTranslation: false,
    restrictRelativeYTranslation: false,
}

const positionKeyframe: Keyframe<Point>[] = [{percentage: 0, value: {x: board.camera.position.x, y: board.camera.position.y}, easingFn: EasingFunctions.linear}];
const zoomKeyframe: Keyframe<number>[] = [{percentage: 0, value: board.camera.zoomLevel, easingFn: EasingFunctions.linear}];

const animation = new Animation(positionKeyframe, (value)=>{
    console.log("animation", value);
    const currentVector = PointCal.subVector({x: 0, y: 0}, value);
    const targetVector = PointCal.subVector({x: 0, y: 0}, board.camera.position);
    console.log("--------------------------------");
    console.log("current vector", currentVector);
    console.log("target vector", targetVector);
    console.log("angle", PointCal.angleFromA2B(currentVector, targetVector));
    (board.controlCenter as RelayControlCenter).notifyPanToAnimationInput(value);
}, new PointAnimationHelper(), 1000);

const zoomAnimation = new Animation(zoomKeyframe, (value)=>{
    // console.log("zoom level", value);
    (board.controlCenter as RelayControlCenter).notifyZoomInputAnimation(value);
}, new NumberAnimationHelper(), 1000);

const compositeAnimation = new CompositeAnimation();
compositeAnimation.addAnimation("position", animation);
compositeAnimation.addAnimation("zoom", zoomAnimation);
// compositeAnimation.addAnimationAdmist("zoom", zoomAnimation, "position", 50);
// compositeAnimation.addAnimationAfter("zoom", zoomAnimation, "position");

const resetCameraBtn = document.getElementById("reset-camera-btn") as HTMLButtonElement;
const experimentalZoomHandlerBtn = document.getElementById("experimental-zoom-handler-btn") as HTMLButtonElement;

experimentalZoomHandlerBtn.addEventListener("click", ()=>{
    experimentalZoomHandler(board.camera, 1, {x: 0, y: 0}, config);
});

resetCameraBtn.addEventListener("click", ()=>{
    animation.keyFrames = [{
        percentage: 0,
        value: {x: board.camera.position.x, y: board.camera.position.y},
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
    (board.controlCenter as RelayControlCenter).initatePanTransition();
    (board.controlCenter as RelayControlCenter).initateZoomTransition();
    compositeAnimation.startAnimation();
});

// board.fullScreen = true;
// board.camera.setRotation(45 * Math.PI / 180);

drawingEngine.addDrawTask({
    drawWithContext: (context, deltaTime) => {
        context.beginPath();
        context.arc(0, 0, 100, 0, Math.PI * 2);
        context.fillStyle = 'red';
        context.fill();
    },
    draw: (deltaTime) => {
        console.log("draw", deltaTime);
    }
});
drawingEngine.addDrawTask(board.selectionBox);

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
