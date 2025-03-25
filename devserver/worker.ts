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
    if(event.data.type === "canvas"){
        console.log('canvas', event.data.canvas);
        canvas = event.data.canvas;
        context = canvas.getContext('2d');
        step(0);
    }
}
