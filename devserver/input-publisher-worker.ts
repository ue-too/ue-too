import { CanvasProxy, convertFromWindow2ViewPort, convertFromWindow2ViewPortWithCanvasOperator, createDefaultFlowControlWithCameraRig, createKmtInputStateMachine, DefaultBoardCamera, KmtInputStateMachineWebWorkerProxy, ObservableInputTracker, RawUserInputPublisher } from "src";
import { CameraRig, createDefaultCameraRig } from "src/board-camera/camera-rig";
import { CanvasCacheInWebWorker } from "src/input-state-machine/kmt-input-context";

let context: OffscreenCanvasRenderingContext2D;
let canvas: OffscreenCanvas;


function step(timestamp: number){
    context.reset();
    context.clearRect(0, 0, canvas.width, canvas.height);

    const transfromMatrix = camera.getTransform(2, true);
    context.setTransform(transfromMatrix.a, transfromMatrix.b, transfromMatrix.c, transfromMatrix.d, transfromMatrix.e, transfromMatrix.f);

    // context.reset();
    context.beginPath();
    context.rect(0, 0, 100, 100);
    context.fillStyle = 'black';
    context.fill();
    requestAnimationFrame(step);
}

const camera = new DefaultBoardCamera();
const cameraRig = createDefaultCameraRig(camera);
const flowControl = createDefaultFlowControlWithCameraRig(cameraRig);
const rawInputPublisher = new RawUserInputPublisher(flowControl);
const canvasCacheInWebWorker = new CanvasCacheInWebWorker(postMessage);
const observableInputTracker = new ObservableInputTracker(canvasCacheInWebWorker, rawInputPublisher);
const kmtInputStateMachine = createKmtInputStateMachine(observableInputTracker);

onmessage = (event) => {
    switch(event.data.type){
        case "canvas":
            canvas = event.data.canvas;
            console.log('event.data', event.data);
            console.log('canvas', canvas);
            // canvas.width = 100;
            // canvas.height = 100;
            context = canvas.getContext('2d');
            step(0);
            break;
        // case "setCanvasDimensions":
        //     if(canvasCacheInWebWorker.position.x !== event.data.position.x || canvasCacheInWebWorker.position.y !== event.data.position.y){
        //         console.log('position is different');
        //         canvasCacheInWebWorker.position = event.data.position;
        //     }
        //     if(canvasCacheInWebWorker.width === event.data.width && canvasCacheInWebWorker.height === event.data.height){
        //         console.log('width and height are the same');
        //         return;
        //     }
        //     canvasCacheInWebWorker.width = event.data.width;
        //     canvasCacheInWebWorker.height = event.data.height;
        //     canvasCacheInWebWorker.position = event.data.position;
        //     camera.viewPortHeight = event.data.height;
        //     camera.viewPortWidth = event.data.width;
        //     if(canvas){
        //         console.log('canvas width', canvas.width, 'canvas height', canvas.height);
        //         canvas.width = event.data.width * 2;
        //         canvas.height = event.data.height * 2;
        //         console.log('canvas width', canvas.width, 'canvas height', canvas.height);
        //         postMessage({type: "updateCanvasDimensions", width: event.data.width, height: event.data.height});
        //     }
        //     break;
        case "updateCanvasDimensions":
            if(canvasCacheInWebWorker.position.x !== event.data.position.x || canvasCacheInWebWorker.position.y !== event.data.position.y){
                canvasCacheInWebWorker.position = event.data.position;
            }
            if(canvasCacheInWebWorker.width === event.data.width && canvasCacheInWebWorker.height === event.data.height && canvas !== undefined && canvas.width === event.data.width * 2 && canvas.height === event.data.height * 2){
                return;
            }

            canvasCacheInWebWorker.width = event.data.width;
            canvasCacheInWebWorker.height = event.data.height;
            canvasCacheInWebWorker.position = event.data.position;
            camera.viewPortHeight = event.data.height;
            camera.viewPortWidth = event.data.width;
            if(canvas){
                canvas.width = event.data.width * 2;
                canvas.height = event.data.height * 2;
                postMessage({type: "updateCanvasDimensions", width: event.data.width, height: event.data.height});
            }
            break;
        case "kmtInputStateMachine":
            kmtInputStateMachine.happens(event.data.event, event.data.payload);
            break;
        case "notifyUserInput":
            console.log('user input', event.data);
            break;
    }
}
