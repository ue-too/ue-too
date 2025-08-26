import { Board, drawArrow } from "@ue-too/board";
import { BCurve, offset } from "@ue-too/curve";
import { Animation, type Keyframe, numberHelperFunctions } from "@ue-too/animate";
import { PointCal } from "@ue-too/math";
import { createLayoutStateMachine, CurveCreationEngine } from "./kmt-state-machine";
import { TrainPlacementEngine, TrainPlacementStateMachine } from "./train-kmt-state-machine";

const utilButton = document.getElementById("util") as HTMLButtonElement;

const layoutToggleButton = document.getElementById("layout-toggle") as HTMLButtonElement;


const canvas = document.getElementById("graph") as HTMLCanvasElement;

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

const trainPlacementToggleButton = document.getElementById("train-placement-toggle") as HTMLButtonElement;
const trainPlacementEngine = new TrainPlacementEngine(curveEngine.trackGraph);
const trainStateMachine = new TrainPlacementStateMachine(trainPlacementEngine);


const testCurve = new BCurve([{x:-10, y: -10}, {x: 50, y: 50}, {x: 100, y: 100}, {x: 150, y: 150}]);
const offsetTestCurve = offset(testCurve, 25);

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
        stateMachine.happens("escapeKey", {});
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
        const cps = curveEngine.previewCurve.getControlPoints();
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

    // const offsetCurves = curveEngine.trackGraph.trackSegments.map((trackSegment)=>{
    //     return offset(trackSegment.curve, 10);
    // });

    // offsetCurves.forEach((curveGroup)=>{
    //     curveGroup.forEach((curve)=>{
    //         const cps = curve.getControlPoints();
    //         board.context.beginPath();
    //         board.context.moveTo(cps[0].x, cps[0].y);
    //         if(cps.length === 3){
    //             board.context.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
    //         } else {
    //             board.context.bezierCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y, cps[3].x, cps[3].y);
    //         }
    //         board.context.stroke();
    //     });
    // })

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

    for(let i = 0; i < arcs.length; i++){
        board.context.save();
        board.context.lineWidth = 3 / board.camera.zoomLevel;
        board.context.strokeStyle = "red";
        board.context.beginPath();
        // board.context.arc(arcs[i].center.x, arcs[i].center.y, arcs[i].radius, arcs[i]., arcs[i].endAngle, false);
        board.context.stroke();
        board.context.restore();
    }

    if(curveEngine.hoverCirclePosition != null){
        board.context.beginPath();
        board.context.arc(curveEngine.hoverCirclePosition.x, curveEngine.hoverCirclePosition.y, 5, 0, 2 * Math.PI);
        board.context.fill();
    }

    if(curveEngine.hoverEndPosition != null){
        board.context.beginPath();
        board.context.arc(curveEngine.hoverEndPosition.x, curveEngine.hoverEndPosition.y, 5, 0, 2 * Math.PI);
        board.context.fill();
    }

    if(curveEngine.projection != null){
        board.context.save();
        board.context.fillStyle = "blue";
        board.context.beginPath();
        board.context.arc(curveEngine.projection.projectionPoint.x, curveEngine.projection.projectionPoint.y, 5, 0, 2 * Math.PI);
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

    if(curveEngine.branchTangent != null && curveEngine.currentStartingPoint != null){
        drawArrow(board.context, board.camera.zoomLevel, curveEngine.currentStartingPoint, PointCal.addVector(PointCal.multiplyVectorByScalar(curveEngine.branchTangent, 10), curveEngine.currentStartingPoint));
    }

    board.context.beginPath();
    const testCurveCps = testCurve.getControlPoints();
    board.context.moveTo(testCurveCps[0].x, testCurveCps[0].y);
    if(testCurveCps.length === 3){
        board.context.quadraticCurveTo(testCurveCps[1].x, testCurveCps[1].y, testCurveCps[2].x, testCurveCps[2].y);
    } else {
        board.context.bezierCurveTo(testCurveCps[1].x, testCurveCps[1].y, testCurveCps[2].x, testCurveCps[2].y, testCurveCps[3].x, testCurveCps[3].y);
    }
    board.context.stroke();

    board.context.save();
    board.context.strokeStyle = "blue";
    board.context.lineWidth = 3;
    offsetTestCurve.forEach((curve)=>{
        const offsetCps = curve.getControlPoints();
        board.context.beginPath();
        board.context.moveTo(offsetCps[0].x, offsetCps[0].y);
        if(offsetCps.length === 3){
            board.context.quadraticCurveTo(offsetCps[1].x, offsetCps[1].y, offsetCps[2].x, offsetCps[2].y);
        } else {
            board.context.bezierCurveTo(offsetCps[1].x, offsetCps[1].y, offsetCps[2].x, offsetCps[2].y, offsetCps[3].x, offsetCps[3].y);
        }
        board.context.stroke();
    });
    board.context.restore();

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

