import { CameraRig } from "src/board-camera/camera-rig";

let context: OffscreenCanvasRenderingContext2D;
let canvas: OffscreenCanvas;

function step(timestamp: number){
    // if(context == undefined || canvas == undefined){
    //     return;
    // }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'red';
    context.fillRect(0, 0, 100, 100);
    requestAnimationFrame(step);
}

onmessage = (event) => {
    switch(event.data.type){
        case "canvas":
            console.log('canvas', event.data.canvas);
            canvas = event.data.canvas;
            context = canvas.getContext('2d');
            step(0);
            break;
        case "setCanvasDimensions":
            console.log('setCanvasDimensions', event.data.payload);
            break;
        case "updateCanvasDimensions":
            console.log('updateCanvasDimensions', event.data);
            break;
        case "kmtInputStateMachine":
            console.log('kmtInputStateMachine', event.data);
            break;
    }
}
