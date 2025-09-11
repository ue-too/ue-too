import { Board, CanvasProxy } from "@ue-too/board";

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const utilButton = document.getElementById("util") as HTMLButtonElement;
// const board = new Board(canvas);


window.devicePixelRatio = 2;
const canvasProxy = new CanvasProxy(canvas);

utilButton.addEventListener("click", ()=>{
    // canvas.width = 700;
    canvas.style.width = "700px";
    setTimeout(()=>{
        console.log(canvasProxy.dimensions);
    }, 1000);
});




// function step(){
//     board.step(performance.now());
//     board.context.rect(0, 0, 100, 100);
//     board.context.fill();
//     requestAnimationFrame(step);
// }

// requestAnimationFrame(step);
