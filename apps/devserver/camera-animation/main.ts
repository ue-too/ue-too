import Board from "src/boardify";
import { drawRuler } from "src/utils/drawing";
import { CompositeAnimation, Animation, Keyframe, PointAnimationHelper, EasingFunctions } from "@niuee/bounce";
import { Point } from "point2point";
import { CameraMuxWithAnimationAndLock } from "src";

// Create an image object
const tileImage = new Image();
tileImage.src = 'tile.png';

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const board = new Board(canvas);
const cameraMux = board.cameraMux as CameraMuxWithAnimationAndLock;

const panAnimationKeyframes: Keyframe<Point>[] = [
    {
        percentage: 0,
        value: {x: 0, y: 0},
    },
    {
        percentage: 1,
        value: {x: 100, y: 100},
    }
];

const panAnimation = new Animation(panAnimationKeyframes, (value)=>{
    cameraMux.notifyPanToAnimationInput(value);
}, new PointAnimationHelper(), 1000);

let lastUpdateFrameTimeStamp = 0;

function step(timestamp: number){
    board.step(performance.now());
    if (tileImage.complete) {
        board.context.drawImage(tileImage, 0, 0);
    }
    const deltaTime = timestamp - lastUpdateFrameTimeStamp;
    lastUpdateFrameTimeStamp = timestamp;

    panAnimation.animate(deltaTime);

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


canvas.addEventListener("click", (e) => {
    const worldCoord = board.convertWindowPoint2WorldCoord({x: e.clientX, y: e.clientY});
    cameraMux.initatePanTransition();
    panAnimation.keyFrames = [
        {
            percentage: 0,
            value: board.camera.position,
            easingFn: EasingFunctions.easeInOutSine,
        },
        {
            percentage: 1,
            value: worldCoord,
        }
    ]
    panAnimation.startAnimation();
});

requestAnimationFrame(step);
