import { createDefaultCameraRig, createDefaultFlowControlWithCameraRig, createKmtInputStateMachine, DefaultBoardCamera, KmtInputStateMachineWebWorkerProxy, VanillaKMTEventParser } from "src";
import { CanvasPositionDimensionPublisher } from "src/boardify/utils";
import { RawUserInputPublisher } from "src/raw-input-publisher";
import { CanvasProxy, CanvasProxyWorkerRelay, ObservableInputTracker } from "src/input-state-machine/kmt-input-context";

const utilBtn = document.getElementById("util-btn") as HTMLButtonElement;

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const offscreen = canvas.transferControlToOffscreen();
let isCanvasTransferred = false;
const canvasPositionDimensionPublisher = new CanvasPositionDimensionPublisher(canvas);
// const canvasProxy = new CanvasProxy(canvas);
// const camera = new DefaultBoardCamera();
// const cameraRig = createDefaultCameraRig(camera);
// const flowControl = createDefaultFlowControlWithCameraRig(cameraRig);
// const rawInputPublisher = new RawUserInputPublisher(flowControl);
// const observableInputTracker = new ObservableInputTracker(canvasProxy, rawInputPublisher);


const worker = new Worker('./worker.ts', {type: "module"});
const kmtInputStateMachine = new KmtInputStateMachineWebWorkerProxy(worker);
const kmtEventParser = new VanillaKMTEventParser(canvas, kmtInputStateMachine);
kmtEventParser.setUp();

const canvasProxyWorkerRelay = new CanvasProxyWorkerRelay(canvas, worker, canvasPositionDimensionPublisher);


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
