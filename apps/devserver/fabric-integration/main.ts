import { StaticCanvas, FabricText, TMat2D, Rect } from 'fabric'
import { createKmtInputStateMachine, CanvasProxy, createDefaultCameraRig, DefaultBoardCamera, ObservableInputTracker, RawUserInputPublisher, createCameraMuxWithAnimationAndLockWithCameraRig } from "src";
import { VanillaKMTEventParser } from "src/input-interpretation/kmt-event-parser/vanilla-kmt-event-parser";


const canvas = document.getElementById("graph") as HTMLCanvasElement;
const fabricCanvas = new StaticCanvas(canvas);
const helloWorld = new FabricText('Hello world!', {
    left: 0,
    top: 0
});
fabricCanvas.add(helloWorld);

const rectangle = new Rect({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    originX: 'left',
    originY: 'top',
    fill: 'transparent',
    stroke: 'black',
    strokeWidth: 2
});
fabricCanvas.add(rectangle);

const width = parseInt(canvas.style.width);
const height = parseInt(canvas.style.height);
const camera = new DefaultBoardCamera(width, height, {x: 0, y: 0}, 0, 2);
const canvasProxy = new CanvasProxy(canvas);
const cameraRig = createDefaultCameraRig(camera);
const boardInputPublisher = new RawUserInputPublisher(createCameraMuxWithAnimationAndLockWithCameraRig(cameraRig));
const observableInputTracker = new ObservableInputTracker(canvasProxy, boardInputPublisher);
const kmtInputStateMachine = createKmtInputStateMachine(observableInputTracker);
const kmtParser = new VanillaKMTEventParser(canvas, kmtInputStateMachine);
kmtParser.setUp();

function step(){
    const transform = camera.getTransform(1, true);
    const matrix: TMat2D = [transform.a, transform.b, transform.c, transform.d, transform.e, transform.f];
    // const matrix: TMat2D = [1, 0, 0, 1, 0, 0];
    fabricCanvas.setViewportTransform(matrix);
    requestAnimationFrame(step);
}

requestAnimationFrame(step);
