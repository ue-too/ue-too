import { AltCamera } from "src/alt-camera";
const canvas = document.getElementById("graph") as HTMLCanvasElement;
const context = canvas.getContext("2d");

const camera = new AltCamera({x: 100, y: 100}, 0, 2, canvas.width, canvas.height);
console.log(camera.transform);

function step(timestamp: number){
    const transform = camera.transform;
    context.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
    context.beginPath();
    context.arc(100, 100, 50, 0, 2 * Math.PI);
    context.stroke();
    requestAnimationFrame(step);
}

step(0);
