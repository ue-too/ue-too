import { createDefaultCameraRig, createDefaultFlowControlWithCameraRig, createKmtInputStateMachine, DefaultBoardCamera, KmtInputStateMachineWebWorkerProxy, VanillaKMTEventParser } from "src";
import { CanvasPositionDimensionPublisher } from "src/boardify/utils";
import { RawUserInputPublisher, RawUserInputPublisherWithWebWorkerRelay } from "src/raw-input-publisher";
import { CanvasProxy, CanvasProxyWorkerRelay, ObservableInputTracker } from "src/input-state-machine/kmt-input-context";

const utilBtn = document.getElementById("util-btn") as HTMLButtonElement;

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const offscreen = canvas.transferControlToOffscreen();
let isCanvasTransferred = false;
const canvasPositionDimensionPublisher = new CanvasPositionDimensionPublisher(canvas);
// const camera = new DefaultBoardCamera();
// const cameraRig = createDefaultCameraRig(camera);
// const flowControl = createDefaultFlowControlWithCameraRig(cameraRig);
// const rawInputPublisher = new RawUserInputPublisher(flowControl);
// const observableInputTracker = new ObservableInputTracker(canvasProxy, rawInputPublisher);


const worker = new Worker('./input-publisher-worker.ts', {type: "module"});
const canvasCache = new CanvasProxyWorkerRelay(canvas, worker, canvasPositionDimensionPublisher);
const userInputPublisher = new RawUserInputPublisherWithWebWorkerRelay(worker);
const observableInputTracker = new ObservableInputTracker(canvasCache, userInputPublisher);
const kmtInputStateMachine = createKmtInputStateMachine(observableInputTracker);
const kmtEventParser = new VanillaKMTEventParser(canvas, kmtInputStateMachine);
kmtEventParser.setUp();

worker.onmessage = (event) => {
    switch(event.data.type){
        case "updateCanvasDimensions":
            canvas.style.width = event.data.width + "px";
            canvas.style.height = event.data.height + "px";
            break;
    }
}

utilBtn.addEventListener("click", () => {
    if (!isCanvasTransferred) {
        worker.postMessage({
            type: "canvas",
            canvas: offscreen,
            width: canvas.width,
            height: canvas.height,
            devicePixelRatio: window.devicePixelRatio,
        }, {transfer: [offscreen]});
        isCanvasTransferred = true;
    } else {
        console.warn('Canvas already transferred');
    }
});
