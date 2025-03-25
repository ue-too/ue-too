import { CanvasPositionDimensionPublisher } from "src/boardify/utils";

const utilBtn = document.getElementById("util-btn") as HTMLButtonElement;

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const offscreen = canvas.transferControlToOffscreen();
let isCanvasTransferred = false;
const canvasPositionDimensionPublisher = new CanvasPositionDimensionPublisher(canvas);

const worker = new Worker('./worker.ts', {type: "module"});

canvasPositionDimensionPublisher.onPositionUpdate((rect)=>{
    worker.postMessage({
        type: "canvasPositionDimension",
        payload: rect
    });
});


utilBtn.addEventListener("click", () => {
    if (!isCanvasTransferred) {
        worker.postMessage({
            type: "canvas",
            canvas: offscreen
        }, {transfer: [offscreen]});
        isCanvasTransferred = true;
    } else {
        console.warn('Canvas already transferred');
    }
});
