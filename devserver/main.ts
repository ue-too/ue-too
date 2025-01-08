// import "./media";
import Board, { drawAxis, drawRuler, drawGrid } from "../src/boardify";
import { PointCal } from "point2point";
import { drawVectorTip, drawXAxis, drawYAxis, drawArrow } from "./drawing-util";
import { drawLine } from "./utils";
import { parseStateMachine, parseEventsOfAState } from "src/being";
import { Container, SelectionBox } from "src/drawing-engine";
import FlowGraph from "../src/being/flowgraph";
import ForceGraph from "src/being/forcegraph";
import { OrthogonalLayout, exampleGraph } from "src/being/layout";

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

const flowGraph = new FlowGraph("graph");

const layout = new OrthogonalLayout(board.context);
const result = layout.layout(exampleGraph);
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

states.forEach(state => {
    console.log("state", state);
    const events = parseEventsOfAState(stateMachine, state);
    console.log("events", events);
    flowGraph.addNode(state, state, 'rectangular');
    events.forEach(event => {
        flowGraph.addNode(state + event.event, event.event, 'pill');
    });
});

states.forEach(state => {
    const events = parseEventsOfAState(stateMachine, state);
    events.forEach(event => {
        if(event.defaultTargetState === "IDLE"){
            console.log("event", event.event, "of state", state, "should point to IDLE");
        }
        flowGraph.addEdge(state, state + event.event);
        flowGraph.addEdge(state + event.event, event.defaultTargetState);
    });
});

board.limitEntireViewPort = true;
board.camera.setZoomLevel(1);
board.camera.setPosition({x: 0, y: 0});

// drawingEngine.position = {x: 100, y: 100};

let lastUpdateTime = 0;
function step(timestamp: number){
    board.step(timestamp);
    const deltaMiliseconds = timestamp - lastUpdateTime;
    lastUpdateTime = timestamp;
    board.context.fillStyle = 'white';
    board.context.fillRect(-5000, -5000, 10000, 10000);

    flowGraph.layout();
    flowGraph.render();
    board.context.beginPath();
    board.context.arc(0, 100, 10, 0, Math.PI * 2);
    board.context.fillStyle = 'black';
    board.context.fill();
    
    drawXAxis(board.context, board.camera.zoomLevel);
    drawYAxis(board.context, board.camera.zoomLevel);
    board.context.lineWidth = 1 / board.camera.zoomLevel;

    const fourCorners = calculateTopFourCorners();
    drawRuler(board.context, fourCorners.topLeft, fourCorners.topRight, fourCorners.bottomLeft, fourCorners.bottomRight, true, board.camera.zoomLevel);
    drawingEngine.drawWithContext(board.context, deltaMiliseconds);
    // layout.render(result);
    // board.context.strokeStyle = 'red';
    // board.context.beginPath();
    // board.context.arc(fourCorners.topLeft.x, fourCorners.topLeft.y, 100, 0, Math.PI * 2);
    // board.context.fillStyle = 'red';
    // board.context.stroke();
    // console.log("fourCorners.topLeft", fourCorners.topLeft);
    drawGrid(board.context, fourCorners.topLeft, fourCorners.topRight, fourCorners.bottomLeft, fourCorners.bottomRight, true, board.camera.zoomLevel);


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
