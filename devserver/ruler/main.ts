import Board from "src/boardify";
import { drawRuler } from "src/utils/drawing";

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const board = new Board(canvas);


board.alignCoordinateSystem = false;

function step(){

    board.step(performance.now());
    board.context.rect(0, 100, 100, 100);
    board.context.fill();

    const topLeftCornerInViewPort = board.alignCoordinateSystem ? {x: -board.camera.viewPortWidth / 2, y: -board.camera.viewPortHeight / 2} : {x: -board.camera.viewPortWidth / 2, y: board.camera.viewPortHeight / 2};
    const topRightCornerInViewPort = board.alignCoordinateSystem ? {x: board.camera.viewPortWidth / 2, y: -board.camera.viewPortHeight / 2} : {x: board.camera.viewPortWidth / 2, y: board.camera.viewPortHeight / 2};
    const bottomLeftCornerInViewPort = board.alignCoordinateSystem ? {x: -board.camera.viewPortWidth / 2, y: board.camera.viewPortHeight / 2} : {x: -board.camera.viewPortWidth / 2, y: -board.camera.viewPortHeight / 2};
    const bottomRightCornerInViewPort = board.alignCoordinateSystem ? {x: board.camera.viewPortWidth / 2, y: board.camera.viewPortHeight / 2} : {x: board.camera.viewPortWidth / 2, y: -board.camera.viewPortHeight / 2};

    const topLeftCornerInWorld = board.camera.convertFromViewPort2WorldSpace(topLeftCornerInViewPort);
    const topRightCornerInWorld = board.camera.convertFromViewPort2WorldSpace(topRightCornerInViewPort);
    const bottomLeftCornerInWorld = board.camera.convertFromViewPort2WorldSpace(bottomLeftCornerInViewPort);
    const bottomRightCornerInWorld = board.camera.convertFromViewPort2WorldSpace(bottomRightCornerInViewPort);

    drawRuler(
        board.context, 
        topLeftCornerInWorld, 
        topRightCornerInWorld, 
        bottomLeftCornerInWorld, 
        bottomRightCornerInWorld, 
        false, 
        board.camera.zoomLevel, 
        true, 
        true,
    );

    requestAnimationFrame(step);
}

canvas.addEventListener("click", (e) => {
    const worldCoord = board.convertWindowPoint2WorldCoord({x: e.clientX, y: e.clientY});
    console.log(worldCoord);
});

requestAnimationFrame(step);
