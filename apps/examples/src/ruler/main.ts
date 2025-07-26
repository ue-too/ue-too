import { Board, drawRuler } from "@ue-too/board";

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

    const topLeftCornerInWorld = board.camera.convertFromViewPort2WorldSpace(topLeftCornerInViewPort);
    const topRightCornerInWorld = board.camera.convertFromViewPort2WorldSpace(topRightCornerInViewPort);
    const bottomLeftCornerInWorld = board.camera.convertFromViewPort2WorldSpace(bottomLeftCornerInViewPort);

    drawRuler(
        board.context, 
        topLeftCornerInWorld, 
        topRightCornerInWorld, 
        bottomLeftCornerInWorld, 
        board.alignCoordinateSystem, 
        board.camera.zoomLevel, 
    );

    requestAnimationFrame(step);
}

requestAnimationFrame(step);
