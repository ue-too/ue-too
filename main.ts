import "./devserver/media";
import Board, { drawAxis, drawRuler } from "./src/boardify";
import { PointCal } from "point2point";
import { drawVectorTip, drawXAxis, drawYAxis, drawArrow } from "./devserver/drawing-util";
import { drawLine } from "./devserver/utils";

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
    
    // drawXAxis(board.context, board.camera.zoomLevel);
    // drawYAxis(board.context, board.camera.zoomLevel);
    board.context.lineWidth = 1 / board.camera.zoomLevel;
    drawLine(board.context, {x: 0, y: 0}, {x: 1000, y: 0}, "rgb(160, 35, 52)");
    drawLine(board.context, {x: 0, y: 0}, {x: 0, y: 1000}, "rgb(13, 124, 102)");

    for(let i = 1; i < 20; i++){
        drawLine(board.context, {x: i / 2, y: 0}, {x: i / 2, y: 0.25}, "black");
        board.context.font = `${20 / board.camera.zoomLevel}px Arial`;
        board.context.fillStyle = `rgba(0, 0, 0, ${1}`;
        const textDimension = board.context.measureText(`${i}`);
        const textCenter = PointCal.addVector({x: i / 2, y: 0.35}, {x: -textDimension.width / 2, y: textDimension.fontBoundingBoxAscent - textDimension.fontBoundingBoxDescent});
        board.context.fillText(`${i}`, textCenter.x, textCenter.y);
    }

    for(let i = 1; i < 20; i++){
        drawLine(board.context, {x: 0, y: i / 2}, {x: 0.25, y: i / 2}, "black");
        board.context.font = `${20 / board.camera.zoomLevel}px Arial`;
        board.context.fillStyle = `rgba(0, 0, 0, ${1}`;
        const textDimension = board.context.measureText(`${i}`);
        const textCenter = PointCal.addVector({x: 0.35, y: i / 2}, {x: -textDimension.width / 2, y: (textDimension.fontBoundingBoxAscent - textDimension.fontBoundingBoxDescent) / 2});
        board.context.fillText(`${i}`, textCenter.x, textCenter.y);
    }
    
    // drawArrow(board.context, {x: 0, y: 0}, {x: 1, y: 1}, board.camera.zoomLevel, "blue");
    board.context.beginPath();
    board.context.fillStyle = `rgba(0, 0, 0, ${1}`;
    board.context.arc(0.5, 0.5, 2 / board.camera.zoomLevel, 0, 2 * Math.PI);
    board.context.fill();
    board.context.font = `${20 / board.camera.zoomLevel}px Arial`;
    board.context.fillStyle = `rgba(0, 0, 0, ${1}`;
    const textDimension = board.context.measureText("(1, 1)");
    const textCenter = PointCal.addVector({x: 0.5, y: 0.5}, {x: +textDimension.width / 2, y: textDimension.fontBoundingBoxAscent - textDimension.fontBoundingBoxDescent});
    board.context.fillText("(1, 1)", textCenter.x, textCenter.y);
    const fourCorners = calculateTopFourCorners();
    drawRuler(board.context, fourCorners.topLeft, fourCorners.topRight, fourCorners.bottomLeft, fourCorners.bottomRight, true, board.camera.zoomLevel);

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
