import Board from "src/boardify";

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const board = new Board(canvas);

function step(){
    board.step(performance.now());
    board.context.rect(0, 0, 100, 100);
    board.context.fill();
    requestAnimationFrame(step);
}

requestAnimationFrame(step);

// navigate the canvas using w, a, s, d
window.addEventListener("keydown", (event)=>{
    if(event.key === "a"){
        board.getCameraRig().panByViewPort({x: -10, y: 0});
    }
    else if(event.key === "d"){
        board.getCameraRig().panByViewPort({x: 10, y: 0});
    }
    else if(event.key === "w"){
        board.getCameraRig().panByViewPort({x: 0, y: -10});
    }
    else if(event.key === "s"){
        board.getCameraRig().panByViewPort({x: 0, y: 10});
    }
});
