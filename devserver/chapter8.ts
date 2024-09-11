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
    const tip = PointCal.rotatePoint({x: 100, y: 0}, rotation);
    drawArrow(board.context, {x: 0, y: 0}, tip, board.camera.zoomLevel, "black");

    board.context.beginPath();
    board.context.font = "16px Arial";
    board.context.fillStyle = "black";
    board.context.fillText(`旋轉角度: ${(rotation * 180 / Math.PI).toFixed(2)}`, tip.x + 10, tip.y);

    board.context.beginPath();
    board.context.font = "16px Arial";
    board.context.fillStyle = "black";
    const tip270 = PointCal.rotatePoint({x: 100, y: 0}, 270 * Math.PI / 180);
    const unitVector270 = PointCal.multiplyVectorByScalar(PointCal.unitVector(tip270), -10);
    board.context.fillText(`270`, tip270.x + 10, tip270.y);

    drawLine(board.context, tip270,  PointCal.addVector(tip270, unitVector270), "black");

    board.context.beginPath();
    board.context.font = "16px Arial";
    board.context.fillStyle = "black";
    const tip180 = PointCal.rotatePoint({x: 100, y: 0}, 180 * Math.PI / 180);
    const unitVector180 = PointCal.multiplyVectorByScalar(PointCal.unitVector(tip180), -10);
    const textDimension180 = board.context.measureText(`180`);
    board.context.fillText(`180`, tip180.x - textDimension180.width - 5, tip180.y);
    // board.context.fillText(`180`, tip180.x + 10, tip180.y);

    drawLine(board.context, tip180,  PointCal.addVector(tip180, unitVector180), "black");

    board.context.beginPath();
    board.context.font = "16px Arial";
    board.context.fillStyle = "black";
    const tip90 = PointCal.rotatePoint({x: 100, y: 0}, 90 * Math.PI / 180);
    const unitVector90 = PointCal.multiplyVectorByScalar(PointCal.unitVector(tip90), -10);
    const textDimension90 = board.context.measureText(`90`);
    board.context.fillText(`90`, tip90.x, tip90.y + textDimension90.actualBoundingBoxAscent + 5);
    // board.context.fillText(`180`, tip180.x + 10, tip180.y);

    drawLine(board.context, tip90,  PointCal.addVector(tip90, unitVector90), "black");
    
    // board.context.lineWidth = 1 / board.camera.zoomLevel;
    // drawLine(board.context, {x: 0, y: 0}, {x: 1000, y: 0}, "rgb(160, 35, 52)");
    // drawLine(board.context, {x: 0, y: 0}, {x: 0, y: 1000}, "rgb(13, 124, 102)");
    // drawLine(board.context, {x: 0, y: 0}, {x: 1000, y: 0}, "rgb(160, 35, 52)");
    // drawLine(board.context, {x: 0, y: 0}, {x: 0, y: 1000}, "rgb(13, 124, 102)");
    // board.context.rect(-(viewPortWidth + 100) / 2, -(viewPortHeight-100) / 2, viewPortWidth + 100, viewPortHeight - 100);
    // board.context.stroke();


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
