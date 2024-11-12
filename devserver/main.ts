import "./media";
import Board, { drawAxis, drawRuler, drawGrid } from "../src/boardify";
import { PointCal } from "point2point";
import { drawVectorTip, drawXAxis, drawYAxis, drawArrow } from "./drawing-util";
import { drawLine } from "./utils";
import { comboDetect } from "../src/input-state-manager/input-state-manager";

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const board = new Board(canvas);
board.limitEntireViewPort = true;

const playAnimationButton = document.getElementById("play-animation-btn") as HTMLButtonElement;

playAnimationButton.onclick = function(){
};

let lastUpdateTime = 0;
function step(timestamp: number){
    board.step(timestamp);
    const deltaMiliseconds = timestamp - lastUpdateTime;
    lastUpdateTime = timestamp;
    board.context.fillStyle = 'white';
    board.context.fillRect(-5000, -5000, 10000, 10000);
    
    drawXAxis(board.context, board.camera.zoomLevel);
    drawYAxis(board.context, board.camera.zoomLevel);
    board.context.lineWidth = 1 / board.camera.zoomLevel;

    const fourCorners = calculateTopFourCorners();
    drawRuler(board.context, fourCorners.topLeft, fourCorners.topRight, fourCorners.bottomLeft, fourCorners.bottomRight, true, board.camera.zoomLevel);
    drawGrid(board.context, fourCorners.topLeft, fourCorners.topRight, fourCorners.bottomLeft, fourCorners.bottomRight, true, board.camera.zoomLevel);

    requestAnimationFrame(step);
}

step(0);

function calculateTopFourCorners(){
    const topLeft = board.camera.convertFromViewPort2WorldSpace({x: -canvas.width / 2, y: -canvas.height / 2});
    const topRight = board.camera.convertFromViewPort2WorldSpace({x: canvas.width / 2, y: -canvas.height / 2});
    const bottomLeft = board.camera.convertFromViewPort2WorldSpace({x: -canvas.width / 2, y: canvas.height / 2});
    const bottomRight = board.camera.convertFromViewPort2WorldSpace({x: canvas.width / 2, y: canvas.height / 2});
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
