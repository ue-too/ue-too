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

const viewPortrotationKeyframees: Keyframe<number>[] = [
    {percentage: 0, value: 0, easingFn: EasingFunctions.easeInOutSine},
    {percentage: 1, value: 90 * Math.PI / 180, easingFn: EasingFunctions.easeInOutSine}
];

const numberAnimationHelper = new NumberAnimationHelper();
const viewPortAnimation = new Animation<number>(viewPortrotationKeyframees, (value)=>{viewPortRotation = value;}, numberAnimationHelper, 1500);
const compositeAnimation = new CompositeAnimation();
compositeAnimation.addAnimation("viewport-rotation", viewPortAnimation);

const playAnimationButton = document.getElementById("play-animation-btn") as HTMLButtonElement;

playAnimationButton.onclick = function(){
    compositeAnimation.startAnimation();
};



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
    // drawXAxis(board.context, board.camera.zoomLevel);
    // drawYAxis(board.context, board.camera.zoomLevel);
    board.context.lineWidth = 1 / board.camera.zoomLevel;
    // drawLine(board.context, {x: 0, y: 0}, {x: 1000, y: 0}, "rgb(160, 35, 52)");
    // drawLine(board.context, {x: 0, y: 0}, {x: 0, y: 1000}, "rgb(13, 124, 102)");
    const topLeftTransformed = PointCal.rotatePoint(topLeftCorner, viewPortRotation);
    const topRightTransformed = PointCal.rotatePoint(topRightCorner, viewPortRotation);
    const bottomRightTransformed = PointCal.rotatePoint(bottomRightCorner, viewPortRotation);
    const bottomLeftTransformed = PointCal.rotatePoint(bottomLeftCorner, viewPortRotation);
    board.context.beginPath();
    board.context.moveTo(topLeftTransformed.x, topLeftTransformed.y);
    board.context.lineTo(topRightTransformed.x, topRightTransformed.y);
    board.context.lineTo(bottomRightTransformed.x, bottomRightTransformed.y);
    board.context.lineTo(bottomLeftTransformed.x, bottomLeftTransformed.y);
    board.context.lineTo(topLeftTransformed.x, topLeftTransformed.y);
    board.context.stroke();
    board.context.strokeStyle = "blue";
    const aabb = calculateAABB(topLeftTransformed, topRightTransformed, bottomRightTransformed, bottomLeftTransformed);
    board.context.beginPath();
    drawAABB(board.context, aabb);
    const aabbHeight = aabb.max.y - aabb.min.y;
    const aabbWidth = aabb.max.x - aabb.min.x;

    // board.context.rect(-(viewPortWidth + 100) / 2, -(viewPortHeight-100) / 2, viewPortWidth + 100, viewPortHeight - 100);
    board.context.stroke();

    // board.context.setLineDash([5, 15]);
    // drawLine(board.context, topLeftTransformed, PointCal.addVector(topLeftTransformed, {x: 0, y: aabbHeight}), "green");
    // board.context.setLineDash([]);
    // board.context.beginPath();
    // board.context.strokeStyle = "green";
    // board.context.arc(topLeftTransformed.x, topLeftTransformed.y, 50, 90 * Math.PI / 180, (90 + 45) * Math.PI / 180);
    // board.context.stroke();

    // board.context.setLineDash([5, 15]);
    // drawLine(board.context, bottomLeftTransformed, PointCal.addVector(bottomLeftTransformed, {x: aabbWidth, y: 0}), "red");
    // board.context.setLineDash([]);
    // board.context.beginPath();
    // board.context.strokeStyle = "red";
    // board.context.arc(bottomLeftTransformed.x, bottomLeftTransformed.y, 50, 0, (0 + 45) * Math.PI / 180);
    // board.context.stroke();
    // const heightContributeHeight = 300 * Math.cos(45 * Math.PI / 180);
    // const widthContributeHeight = 100 * Math.sin(45 * Math.PI / 180);
    // drawLine(board.context, {x: 150, y: topLeftTransformed.y},  {x: 150, y: topLeftTransformed.y + heightContributeHeight}, "green");
    // drawLine(board.context, {x: 150, y: bottomLeftTransformed.y},  {x: 150, y: bottomLeftTransformed.y + widthContributeHeight}, "red");
    // board.context.beginPath();
    // board.context.fillStyle = `rgba(0, 0, 0, ${1}`;
    // board.context.arc(200 * viewPortWidth / 600, -200 * viewPortHeight / 600, 2 / board.camera.zoomLevel, 0, 2 * Math.PI);
    // board.context.fill();

    requestAnimationFrame(step);
}

step(0);

type AABB = {min: Point, max: Point};

function drawAABB(context: CanvasRenderingContext2D, aabb: AABB){
    context.beginPath();
    context.rect(aabb.min.x, aabb.min.y, aabb.max.x - aabb.min.x, aabb.max.y - aabb.min.y);
    context.stroke();
}

function calculateAABB(topLeft: Point, topRight: Point, bottomRight: Point, bottomLeft: Point): {min: Point, max: Point}{
    const minX = Math.min(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x);
    const minY = Math.min(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y);
    const maxX = Math.max(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x);
    const maxY = Math.max(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y);
    return {min: {x: minX, y: minY}, max: {x: maxX, y: maxY}};
}

function calculateTopFourCorners(){
    const topLeft = board.camera.convertFromViewPort2WorldSpace({x: 0, y: 0});
    const topRight = board.camera.convertFromViewPort2WorldSpace({x: board.camera.viewPortWidth, y: 0});
    const bottomLeft = board.camera.convertFromViewPort2WorldSpace({x: 0, y: board.camera.viewPortHeight});
    const bottomRight = board.camera.convertFromViewPort2WorldSpace({x: board.camera.viewPortWidth, y: board.camera.viewPortHeight});
    return {topLeft, topRight, bottomLeft, bottomRight};
}

console.log("test");
