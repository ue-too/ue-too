import "./media";
import Board, { drawAxis, drawRuler } from "../src/boardify";
import { PointCal, Point } from "point2point";
import { drawVectorTip, drawXAxis, drawYAxis, drawArrow } from "./drawing-util";
import { drawLine } from "./utils";
import { Keyframe, NumberAnimationHelper, Animation, CompositeAnimation, EasingFunctions} from "@niuee/bounce";

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const board = new Board(canvas);
board.limitEntireViewPort = true;
let viewPortRotation = 0 * Math.PI / 180;

let topLeftCorner = {x: -100, y: -150};
let topRightCorner = {x: 100, y: -150};
let bottomRightCorner = {x: 100, y: 150};
let bottomLeftCorner = {x: -100, y: 150};

const numberAnimationHelper = new NumberAnimationHelper();
const compositeAnimation = new CompositeAnimation();

const playAnimationButton = document.getElementById("play-animation-btn") as HTMLButtonElement;

playAnimationButton.onclick = function(){
    compositeAnimation.startAnimation();
};

let rotation = 0;
const rotationKeyframes: Keyframe<number>[] = [
    {percentage: 0, value: 0, easingFn: EasingFunctions.linear},
    {percentage: 1, value: 360 * Math.PI / 180 },
];

const rotationAnimation = new Animation(rotationKeyframes, (value)=>{rotation = value}, numberAnimationHelper, 5000);

compositeAnimation.addAnimation("rotation", rotationAnimation);


let lastUpdateTime = 0;
function step(timestamp: number){
    board.step(timestamp);
    const deltaMiliseconds = timestamp - lastUpdateTime;
    lastUpdateTime = timestamp;
    board.context.fillStyle = 'white';
    board.context.fillRect(-5000, -5000, 10000, 10000);
    const fourCorners = calculateTopFourCorners();
    // drawRuler(board.context, fourCorners.topLeft, fourCorners.topRight, fourCorners.bottomLeft, fourCorners.bottomRight, true, board.camera.zoomLevel);
    compositeAnimation.animate(deltaMiliseconds);
    drawXAxis(board.context, board.camera.zoomLevel);
    drawYAxis(board.context, board.camera.zoomLevel);

    board.context.font = "16px Noto Sans";
    board.context.fillStyle = "black";
    board.context.textAlign = "right";
    board.context.fillText("Day 01", 0, 0);
    board.context.font = "16px Noto Sans TC";
    board.context.textAlign = "left";
    board.context.fillText("從零開始", 0, 20);

    requestAnimationFrame(step);
}
board.camera.setZoomLevel(6);
step(0);

function calculateTopFourCorners(){
    const topLeft = board.camera.convertFromViewPort2WorldSpace({x: 0, y: 0});
    const topRight = board.camera.convertFromViewPort2WorldSpace({x: board.camera.viewPortWidth, y: 0});
    const bottomLeft = board.camera.convertFromViewPort2WorldSpace({x: 0, y: board.camera.viewPortHeight});
    const bottomRight = board.camera.convertFromViewPort2WorldSpace({x: board.camera.viewPortWidth, y: board.camera.viewPortHeight});
    return {topLeft, topRight, bottomLeft, bottomRight};
}
