import { Board, drawArrow } from "@ue-too/board";
import { BCurve } from "@ue-too/curve";
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

utilButton.addEventListener("click", ()=>{
    animation.start();
});

let lastTimestamp = 0;

function step(timestamp: number){

    board.step(timestamp);


    const deltaTime = timestamp - lastTimestamp;

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
        board.context.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
        board.context.stroke();
    }
    
    curveEngine.trackGraph.trackSegments.forEach((trackSegment)=>{ 
        const cps = trackSegment.curve.getControlPoints();
        board.context.save();
        board.context.lineWidth = 1 / board.camera.zoomLevel;
        board.context.strokeStyle = "green";
        board.context.beginPath();
        board.context.moveTo(cps[0].x, cps[0].y);
        board.context.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
        board.context.stroke();
        board.context.restore();
    });

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
    }

    if(curveEngine.branchTangent != null && curveEngine.currentStartingPoint != null){
        drawArrow(board.context, board.camera.zoomLevel, curveEngine.currentStartingPoint, PointCal.addVector(PointCal.multiplyVectorByScalar(curveEngine.branchTangent, 10), curveEngine.currentStartingPoint));
    }

    animation.animate(deltaTime);

    window.requestAnimationFrame(step);
}

window.requestAnimationFrame(step);

const straightLine = [{x: 0, y: 0}, {x: 100, y: 100}, {x: 200, y: 200}];
const straightCurve = new BCurve(straightLine);
const tangent = PointCal.unitVector(straightCurve.derivative(1));

console.log('tangent', tangent);





