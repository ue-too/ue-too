import { Board } from "@ue-too/board";
import { BCurve } from "@ue-too/curve";
import { Animation, type Keyframe, numberHelperFunctions } from "@ue-too/animate";
import { PointCal } from "@ue-too/math";
import { createLayoutStateMachine, CurveCreationEngine } from "./kmt-state-machine";

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
});

layoutToggleButton.addEventListener("click", ()=>{
    if(layoutToggleButton.textContent === "Start Layout"){
        stateMachine.happens("startLayout", {});
        board.kmtParser.disabled = true;
        layoutToggleButton.textContent = "End Layout";
    } else {
        stateMachine.happens("endLayout", {});
        board.kmtParser.disabled = false;
        layoutToggleButton.textContent = "Start Layout";
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
    // curveEngine.curves.forEach((curve)=>{
    //     const cps = curve.getControlPoints();
    //     board.context.beginPath();
    //     board.context.moveTo(cps[0].x, cps[0].y);
    //     board.context.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
    //     board.context.stroke();
    // });
    curveEngine.trackGraph.trackSegments.forEach((trackSegment)=>{ 
        const cps = trackSegment.curve.getControlPoints();
        board.context.beginPath();
        board.context.moveTo(cps[0].x, cps[0].y);
        board.context.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
        board.context.stroke();
    });

    for(let i = 0; i < arcs.length; i++){
        board.context.save();
        board.context.lineWidth = 1 / board.camera.zoomLevel;
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

    animation.animate(deltaTime);

    window.requestAnimationFrame(step);
}

window.requestAnimationFrame(step);

const positiveControlPoints = [{x: 70, y: 250}, {x: 20, y: 110}, {x: 220, y: 60}];
const reverseControlPoints = [{x: 220, y: 60}, {x: 20, y: 110}, {x: 70, y: 250}];

const posCurve = new BCurve(positiveControlPoints);
const reverseCurve = new BCurve(reverseControlPoints);


const positiveTVal = 0.5;
const reverseTVal = 1 - positiveTVal;

const posPoint = posCurve.get(positiveTVal);
const posTangent = posCurve.derivative(positiveTVal);
const reversePoint = reverseCurve.get(reverseTVal);
const reverseTangent = reverseCurve.derivative(reverseTVal);

console.log("posPoint", posPoint);
console.log("reversePoint", reversePoint);

console.log("posTangent", posTangent);
console.log("reverseTangent", reverseTangent);



