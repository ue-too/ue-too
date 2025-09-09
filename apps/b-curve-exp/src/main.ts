import { Board, drawArrow } from "@ue-too/board";
import { BCurve } from "@ue-too/curve";
import { Animation, type Keyframe, numberHelperFunctions } from "@ue-too/animate";
import { PointCal } from "@ue-too/math";
import { createLayoutStateMachine, CurveCreationEngine } from "./kmt-state-machine";
import { TrainPlacementEngine, TrainPlacementStateMachine } from "./train-kmt-state-machine";
import Stats from "stats.js";


const utilButton = document.getElementById("util") as HTMLButtonElement;

const layoutToggleButton = document.getElementById("layout-toggle") as HTMLButtonElement;
const layoutDeleteToggleButton = document.getElementById("layout-delete-toggle") as HTMLButtonElement;


const canvas = document.getElementById("graph") as HTMLCanvasElement;
const stats = new Stats();
stats.showPanel(0);
const statsContainer = document.getElementById("stats") as HTMLDivElement;
statsContainer.appendChild(stats.dom);

// Override the stats.js default positioning to place it in top left
stats.dom.style.position = "absolute";
stats.dom.style.top = "0px";
stats.dom.style.left = "0px";

const board = new Board(canvas);

const getRandomPoint = (min: number, max: number) => {
    return {
        x: Math.random() * (max - min) + min,
        y: Math.random() * (max - min) + min,
    }
}

const controlPoints = [];

for(let i = 0; i < 3; i++){
    controlPoints.push(getRandomPoint(0, 100));
}

const percentageKeyFrame: Keyframe<number>[] = [
    {
        percentage: 0,
        value: 0
    },
    {
        percentage: 1,
        value: 1
    }
];

const point = {
    x: controlPoints[0].x,
    y: controlPoints[0].y
};

const curve = new BCurve(controlPoints);
const curveEngine = new CurveCreationEngine();
const stateMachine = createLayoutStateMachine(curveEngine);

stateMachine.onStateChange((currentState, nextState)=>{
    switch(nextState){
        case "HOVER_FOR_CURVE_DELETION":
            layoutToggleButton.textContent = "Start Layout";
            layoutToggleButton.disabled = true;
            layoutDeleteToggleButton.textContent = "End Layout Deletion";
            layoutDeleteToggleButton.disabled = false;
            break;
        case "HOVER_FOR_STARTING_POINT":
            layoutDeleteToggleButton.textContent = "Start Layout Deletion";
            layoutDeleteToggleButton.disabled = true;
            layoutToggleButton.textContent = "End Layout";
            layoutToggleButton.disabled = false;
            break;
        case "IDLE":
            layoutDeleteToggleButton.textContent = "Start Layout Deletion";
            layoutDeleteToggleButton.disabled = false;
            layoutToggleButton.textContent = "Start Layout";
            layoutToggleButton.disabled = false;
            break;
        default:
            break;
    }
});

layoutDeleteToggleButton.addEventListener("click", ()=>{
    if(layoutDeleteToggleButton.textContent === "Start Layout Deletion"){
        stateMachine.happens("startDeletion");
    } else {
        stateMachine.happens("endDeletion");
    }
});


const trainPlacementToggleButton = document.getElementById("train-placement-toggle") as HTMLButtonElement;
const trainPlacementEngine = new TrainPlacementEngine(curveEngine.trackGraph);
const trainStateMachine = new TrainPlacementStateMachine(trainPlacementEngine);

// Cache for track segment offset curves to avoid recalculating every frame
const trackOffsetCache = new Map<number, BCurve[]>();
let trackCacheVersion = 0;

canvas.addEventListener("pointerdown", (event) => {
    if(event.button !== 0){
        return;
    }

    const worldPosition = board.convertWindowPoint2WorldCoord({
        x: event.clientX,
        y: event.clientY,
    });

    stateMachine.happens("pointerdown", {
        position: worldPosition,
        pointerId: event.pointerId,
    });

    trainStateMachine.happens("pointerdown", {
        position: worldPosition,
    });
});

canvas.addEventListener("pointerup", (event) => {

    if(event.button !== 0){
        return;
    }

    const worldPosition = board.convertWindowPoint2WorldCoord({
        x: event.clientX,
        y: event.clientY,
    });

    stateMachine.happens("pointerup", {
        pointerId: event.pointerId,
        position: worldPosition,
    });

    trainStateMachine.happens("pointerup", {
        position: worldPosition,
    });
});

window.addEventListener("keydown", (event)=>{
    if(event.key === "Escape"){
        console.log("Escape key pressed");
        stateMachine.happens("escapeKey");
    } else if(event.key === "f"){
        stateMachine.happens("flipEndTangent");
    } else if(event.key === "g"){
        stateMachine.happens("flipStartTangent");
    } else if(event.key === "q"){
        stateMachine.happens("toggleStraightLine");
    }
});

canvas.addEventListener("pointermove", (event) => { 

    const worldPosition = board.convertWindowPoint2WorldCoord({
        x: event.clientX,
        y: event.clientY,
    });

    stateMachine.happens("pointermove", {
        pointerId: event.pointerId,
        position: worldPosition,
    });

    trainStateMachine.happens("pointermove", {
        position: worldPosition,
    });
});

layoutToggleButton.addEventListener("click", ()=>{
    if(layoutToggleButton.textContent === "Start Layout"){
        stateMachine.happens("startLayout", {});
        board.kmtParser.disabled = true;
        layoutToggleButton.textContent = "End Layout";
        trainPlacementToggleButton.disabled = true;
        trainPlacementToggleButton.textContent = "Start Train Placement";
        trainStateMachine.happens("endPlacement", {});
    } else {
        stateMachine.happens("endLayout", {});
        board.kmtParser.disabled = false;
        layoutToggleButton.textContent = "Start Layout";
        trainPlacementToggleButton.disabled = false;
    }
});

trainPlacementToggleButton.addEventListener("click", ()=>{
    if(trainPlacementToggleButton.textContent === "Start Train Placement"){
        trainStateMachine.happens("startPlacement", {});
        stateMachine.happens("endLayout", {});
        board.kmtParser.disabled = true;
        trainPlacementToggleButton.textContent = "End Train Placement";
        layoutToggleButton.disabled = true;
        layoutToggleButton.textContent = "Start Layout";
    } else {
        trainStateMachine.happens("endPlacement", {});
        board.kmtParser.disabled = false;
        trainPlacementToggleButton.textContent = "Start Train Placement";
        layoutToggleButton.disabled = false;
    }
});

stateMachine.onStateChange((currentState, nextState )=>{

    console.log('from', currentState, 'to', nextState);
})

const arcs = curve.findArcs(0.25);

const distance = PointCal.distanceBetweenPoints(curve.getPointbyPercentage(0), curve.getPointbyPercentage(0.25));
const distance2 = PointCal.distanceBetweenPoints(curve.getPointbyPercentage(0.25), curve.getPointbyPercentage(0.5));
const distance3 = PointCal.distanceBetweenPoints(curve.getPointbyPercentage(0.5), curve.getPointbyPercentage(0.75));
const distance4 = PointCal.distanceBetweenPoints(curve.getPointbyPercentage(0.75), curve.getPointbyPercentage(1));

console.log('full length', curve.fullLength);
console.log("distance", distance, distance2, distance3, distance4);
console.log("totals", distance + distance2 + distance3 + distance4);


const animation = new Animation(percentageKeyFrame, (value)=>{
    point.x = curve.getPointbyPercentage(value).x;
    point.y = curve.getPointbyPercentage(value).y;
}, numberHelperFunctions);

let lastTimestamp = 0;

// FPS calculation variables
let frameCount = 0;
let lastFpsUpdate = 0;
let currentFps = 0;

function step(timestamp: number){

    stats.begin();
    board.step(timestamp);

    // FPS calculation
    frameCount++;
    if (timestamp - lastFpsUpdate >= 1000) { // Update FPS every second
        currentFps = frameCount;
        frameCount = 0;
        lastFpsUpdate = timestamp;
    }

    const deltaTime = timestamp - lastTimestamp; // in milliseconds
    trainPlacementEngine.update(deltaTime);

    lastTimestamp = timestamp;
    const cps = curve.getControlPoints();
    board.context.beginPath();
    board.context.moveTo(cps[0].x, cps[0].y);
    board.context.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
    board.context.stroke();

    board.context.beginPath();
    board.context.arc(point.x, point.y, 5, 0, 2 * Math.PI);
    board.context.fill();

    if(curveEngine.previewCurve !== null){
        const cps = curveEngine.previewCurve.curve.getControlPoints();
        board.context.beginPath();
        board.context.moveTo(cps[0].x, cps[0].y);
        if(cps.length === 3){
            board.context.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
        } else {
            board.context.bezierCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y, cps[3].x, cps[3].y);
        }
        board.context.stroke();
    }
    
    // Clear offset cache when track changes (simple version - clear when number of segments changes)
    const currentTrackSegmentCount = curveEngine.trackGraph.trackSegments.length;
    if (trackOffsetCache.size !== currentTrackSegmentCount) {
        trackOffsetCache.clear();
        trackCacheVersion++;
    }

    curveEngine.trackGraph.trackSegments.forEach((trackSegment, index)=>{ 
        const cps = trackSegment.curve.getControlPoints();
        board.context.save();
        board.context.lineWidth = 1 / board.camera.zoomLevel;
        board.context.strokeStyle = "green";
        board.context.beginPath();
        board.context.moveTo(cps[0].x, cps[0].y);
        if(cps.length === 3){
            board.context.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
        } else {
            board.context.bezierCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y, cps[3].x, cps[3].y);
        }
        board.context.stroke();
        board.context.restore();
    });

    // offset as bezier curve
    // curveEngine.trackGraph.trackOffsets.forEach((curve)=>{
    //     const cps = curve.getControlPoints();
    //     board.context.beginPath();
    //     board.context.moveTo(cps[0].x, cps[0].y);
    //     if(cps.length === 3){
    //         board.context.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
    //     } else {
    //         board.context.bezierCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y, cps[3].x, cps[3].y);
    //     }
    //     board.context.stroke();
    // });

    // offset as line segments
    board.context.save();
    curveEngine.trackGraph.experimentTrackOffsets.forEach((offset)=>{
        board.context.beginPath();
        board.context.moveTo(offset.positive[0].x, offset.positive[0].y);
        for(let i = 1; i < offset.positive.length; i++){
            board.context.lineTo(offset.positive[i].x, offset.positive[i].y);
        }
        board.context.stroke();
        board.context.beginPath();
        board.context.moveTo(offset.negative[0].x, offset.negative[0].y);
        for(let i = 1; i < offset.negative.length; i++){
            board.context.lineTo(offset.negative[i].x, offset.negative[i].y);
        }
        board.context.stroke();
    });
    board.context.restore();

    if(curveEngine.previewCurveForDeletion !== null){
        const cps = curveEngine.previewCurveForDeletion.getControlPoints();
        board.context.save();
        board.context.lineWidth = 10 / board.camera.zoomLevel;
        board.context.strokeStyle = "rgba(255, 0, 0, 0.5)";
        board.context.beginPath();
        board.context.moveTo(cps[0].x, cps[0].y);
        if(cps.length === 3){
            board.context.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
        } else {
            board.context.bezierCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y, cps[3].x, cps[3].y);
        }
        board.context.stroke();
        board.context.restore();
    }

    curveEngine.trackGraph.getJoints().forEach(({joint, jointNumber})=>{
        board.context.save();
        board.context.lineWidth = 1 / board.camera.zoomLevel;
        board.context.strokeStyle = "blue";
        board.context.beginPath();
        board.context.arc(joint.position.x, joint.position.y, 5, 0, 2 * Math.PI);
        board.context.stroke();
        board.context.textAlign = "center";
        board.context.textBaseline = "middle";
        drawArrow(board.context, board.camera.zoomLevel, joint.position, PointCal.addVector(PointCal.multiplyVectorByScalar(joint.tangent, 10), joint.position));
        board.context.fillText(jointNumber.toString(), joint.position.x, joint.position.y);
        board.context.restore();
    });

    if(curveEngine.previewStartProjection != null){
        board.context.save();
        board.context.fillStyle = "red";
        const point = curveEngine.previewStartProjection.projectionPoint;
        board.context.beginPath();
        board.context.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        board.context.fill();
        board.context.restore();
    }

    if(curveEngine.previewEndProjection != null){
        board.context.save();
        board.context.fillStyle = "green";
        const point = curveEngine.previewEndProjection.projectionPoint;
        board.context.beginPath();
        board.context.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        board.context.fill();
        board.context.restore();
    }

    if(curveEngine.newEndJointType != null){
        board.context.save();
        board.context.fillStyle = "purple";
        board.context.beginPath();
        board.context.arc(curveEngine.newEndJointType.position.x, curveEngine.newEndJointType.position.y, 5, 0, 2 * Math.PI);
        board.context.fill();
        board.context.restore();
    }

    if(trainPlacementEngine.previewPosition != null){
        board.context.save();
        board.context.fillStyle = "red";
        board.context.beginPath();
        board.context.arc(trainPlacementEngine.previewPosition.x, trainPlacementEngine.previewPosition.y, 5, 0, 2 * Math.PI);
        board.context.fill();
        board.context.restore();
    }

    if(trainPlacementEngine.trainPosition != null){
        board.context.save();
        board.context.fillStyle = "green";
        board.context.beginPath();
        board.context.arc(trainPlacementEngine.trainPosition.x, trainPlacementEngine.trainPosition.y, 5, 0, 2 * Math.PI);
        board.context.fill();
        board.context.restore();
        drawArrow(board.context, board.camera.zoomLevel, trainPlacementEngine.trainPosition, PointCal.addVector(PointCal.multiplyVectorByScalar(PointCal.unitVector(trainPlacementEngine.trainTangent), 10), trainPlacementEngine.trainPosition));
    }

    if(trainPlacementEngine.secondBogiePosition != null){
        board.context.save();
        board.context.fillStyle = "green";
        board.context.beginPath();
        board.context.arc(trainPlacementEngine.secondBogiePosition.x, trainPlacementEngine.secondBogiePosition.y, 5, 0, 2 * Math.PI);
        board.context.fill();
        board.context.restore();
    }

    animation.animate(deltaTime);

    // Draw FPS indicator
    board.context.save();
    board.context.fillStyle = "white";
    board.context.strokeStyle = "black";
    board.context.lineWidth = 2;
    board.context.font = "16px Arial";
    board.context.textAlign = "left";
    board.context.textBaseline = "top";
    
    const fpsText = `FPS: ${currentFps}`;
    const textMetrics = board.context.measureText(fpsText);
    const padding = 8;
    const bgWidth = textMetrics.width + padding * 2;
    const bgHeight = 20 + padding * 2;
    
    // Draw background rectangle
    board.context.fillStyle = "rgba(0, 0, 0, 0.7)";
    board.context.fillRect(10, 10, bgWidth, bgHeight);
    
    // Draw border
    board.context.strokeRect(10, 10, bgWidth, bgHeight);
    
    // Draw FPS text
    board.context.fillStyle = "white";
    board.context.fillText(fpsText, 10 + padding, 10 + padding);
    
    board.context.restore();

    stats.end();
    window.requestAnimationFrame(step);
}

window.requestAnimationFrame(step);

utilButton.addEventListener("click", ()=>{
    animation.start();
});

const p1Button = document.getElementById("p1") as HTMLButtonElement;
const neutralButton = document.getElementById("neutral") as HTMLButtonElement;
const switchDirectionButton = document.getElementById("switch-direction") as HTMLButtonElement;

p1Button.addEventListener("click", ()=>{
    trainPlacementEngine.setTrainSpeed(30);
});

neutralButton.addEventListener("click", ()=>{
    trainPlacementEngine.setTrainSpeed(0);
    trainPlacementEngine.setTrainAcceleration(0);
});

switchDirectionButton.addEventListener("click", ()=>{
    trainPlacementEngine.switchDirection();
});

