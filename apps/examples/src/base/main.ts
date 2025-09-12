import { Board, CanvasProxy } from "@ue-too/board";

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const utilButton = document.getElementById("util") as HTMLButtonElement;
const board = new Board();

utilButton.addEventListener("click", ()=>{
    board.attach(canvas);
    // canvas.style.width = 700 + "px";
    // canvas.width = 700;
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
});

function step(){
    board.step(performance.now());
    if(board.context != undefined){
        board.context.rect(0, 0, 100, 100);
        board.context.fill();
    }
    requestAnimationFrame(step);
}

requestAnimationFrame(step);
