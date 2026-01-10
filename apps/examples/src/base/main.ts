import { Board } from "@ue-too/board";

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const board = new Board();

board.alignCoordinateSystem = false;

function step(){
    board.step(performance.now());
    if(board.context != undefined){
        board.context.beginPath();
        board.context.rect(0, 0, 100, 100);
        board.context.fill();
    }
    requestAnimationFrame(step);
}

requestAnimationFrame(step);

canvas.addEventListener('click', (event) => {
    const point = {x: event.clientX, y: event.clientY};
    const pointInViewPort = board.convertWindowPoint2WorldCoord(point);
    console.log(pointInViewPort);
});

const toggleCamera = document.querySelector("#toggle-camera") as HTMLButtonElement;
toggleCamera.addEventListener("click", ()=>{
    board.attach(canvas);
});

const detachCanvas = document.querySelector("#detach-canvas") as HTMLButtonElement;
detachCanvas.addEventListener("click", ()=>{
    board.tearDown();
});