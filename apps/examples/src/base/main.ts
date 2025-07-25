import { Board } from "@ue-too/board";

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const board = new Board(canvas);


function step(){
    board.step(performance.now());
    board.context.rect(0, 0, 100, 100);
    board.context.fill();
    requestAnimationFrame(step);
}

requestAnimationFrame(step);
