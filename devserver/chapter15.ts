import "./media";
import Board, { drawAxis, drawRuler } from "../src/boardify";
import { PointCal } from "point2point";
import { drawVectorTip, drawXAxis, drawYAxis, drawArrow } from "./drawing-util";
import { drawLine } from "./utils";
import { Keyframe, NumberAnimationHelper, Animation, CompositeAnimation, EasingFunctions} from "@niuee/bounce";

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const board = new Board(canvas);
board.limitEntireViewPort = true;
let viewPortWidth = 600;
let viewPortHeight = 600;
const direction = PointCal.unitVector({x: 1, y: -1});
let directionLength = 0;

const negativeDirection = PointCal.unitVector(PointCal.multiplyVectorByScalar(direction, -1));

const viewPortKeyframees: Keyframe<number>[] = [
    {percentage: 0, value: 600, easingFn: EasingFunctions.easeInOutSine},
    {percentage: 1, value: 300, easingFn: EasingFunctions.easeInOutSine}
];

const directionLengthKeyframes: Keyframe<number>[] = [
    {percentage: 0, value: 0, easingFn: EasingFunctions.easeInOutSine},
    {percentage: 1, value: 10}
];

const numberAnimationHelper = new NumberAnimationHelper();
const viewPortAnimation = new Animation<number>(viewPortKeyframees, (value)=>{viewPortWidth = value; viewPortHeight = value;}, numberAnimationHelper);
const directionLengthAnimation = new Animation<number>(directionLengthKeyframes, (value)=>{directionLength = value;}, numberAnimationHelper);
const compositeAnimation = new CompositeAnimation();
compositeAnimation.addAnimation("direction-length", directionLengthAnimation);

const playAnimationButton = document.getElementById("play-animation-btn") as HTMLButtonElement;

playAnimationButton.onclick = function(){
    console.log("clicked");
    compositeAnimation.startAnimation();
};


let lastUpdateTime = 0;
function step(timestamp: number){
    board.step(timestamp);
    const deltaMiliseconds = timestamp - lastUpdateTime;
    lastUpdateTime = timestamp;
    board.context.fillStyle = 'white';
    board.context.fillRect(-5000, -5000, 10000, 10000);
    compositeAnimation.animate(deltaMiliseconds);
    drawXAxis(board.context, board.camera.zoomLevel);
    drawYAxis(board.context, board.camera.zoomLevel);
    board.context.lineWidth = 1 / board.camera.zoomLevel;
    // drawLine(board.context, {x: 0, y: 0}, {x: 1000, y: 0}, "rgb(160, 35, 52)");
    // drawLine(board.context, {x: 0, y: 0}, {x: 0, y: 1000}, "rgb(13, 124, 102)");
    // board.context.beginPath();
    // board.context.rect(-viewPortWidth / 2, -viewPortHeight / 2, viewPortWidth, viewPortHeight);
    // board.context.stroke();
    // const fourCorners = calculateTopFourCorners();
    // drawRuler(board.context, fourCorners.topLeft, fourCorners.topRight, fourCorners.bottomLeft, fourCorners.bottomRight, true, board.camera.zoomLevel);
    // board.context.beginPath();
    // board.context.fillStyle = `rgba(0, 0, 0, ${1}`;
    // board.context.arc(200 * viewPortWidth / 600, -200 * viewPortHeight / 600, 2 / board.camera.zoomLevel, 0, 2 * Math.PI);
    // board.context.fill();
    board.context.lineWidth = 1 / board.camera.zoomLevel;
    board.context.beginPath();
    const finger2Pos = PointCal.addVector(PointCal.multiplyVectorByScalar(direction, directionLength), {x: 10, y: -10});
    const finger1Pos = PointCal.addVector(PointCal.multiplyVectorByScalar(negativeDirection, directionLength), {x: 0, y: 0});
    board.context.arc(finger2Pos.x, finger2Pos.y, 5 * Math.sqrt(2), 0, 2 * Math.PI);
    board.context.stroke();
    board.context.beginPath();
    board.context.arc(finger1Pos.x, finger1Pos.y, 5 * Math.sqrt(2), 0, 2 * Math.PI);
    board.context.stroke();
    drawArrow(board.context, {x: 20, y: -20}, {x: 25, y: -25}, board.camera.zoomLevel);
    requestAnimationFrame(step);
}

step(0);

function calculateTopFourCorners(){
    const topLeft = board.camera.convertFromViewPort2WorldSpace({x: 0, y: 0});
    const topRight = board.camera.convertFromViewPort2WorldSpace({x: board.camera.viewPortWidth, y: 0});
    const bottomLeft = board.camera.convertFromViewPort2WorldSpace({x: 0, y: board.camera.viewPortHeight});
    const bottomRight = board.camera.convertFromViewPort2WorldSpace({x: board.camera.viewPortWidth, y: board.camera.viewPortHeight});
    return {topLeft, topRight, bottomLeft, bottomRight};
}

console.log("test");
