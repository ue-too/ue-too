import { AltCamera } from "src/board-camera";
import { CameraObserver } from "src/camera-observer";

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const context = canvas.getContext("2d");

const camera = new AltCamera({x: 100, y: 100}, 45 * Math.PI / 180, 0.5, canvas.width, canvas.height, new CameraObserver());
console.log(camera.position);
console.log(camera.getTransform(canvas.width, canvas.height, window.devicePixelRatio, true));
canvas.style.width = canvas.width + "px";
canvas.style.height = canvas.height + "px";
canvas.width = window.devicePixelRatio * canvas.width;
canvas.height = window.devicePixelRatio * canvas.height;

function step(timestamp: number){
    const transform = camera.getTransform(canvas.width, canvas.height, window.devicePixelRatio, true);
    context.reset();
    context.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
    context.beginPath();
    context.arc(100, 100, 50, 0, 2 * Math.PI);
    context.stroke();
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(500, 0);
    context.moveTo(0, 0);
    context.lineTo(0, 500);
    context.stroke();
    requestAnimationFrame(step);
}

canvas.addEventListener('pointerdown', (event)=>{
    const boundingBox = canvas.getBoundingClientRect();
    const pointInViewPort = {x: event.clientX - boundingBox.left, y: event.clientY - boundingBox.top};
    console.log("clicked in ", camera.convertFromViewPort2WorldSpace(pointInViewPort));
});

step(0);
