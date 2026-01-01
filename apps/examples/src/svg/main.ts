import { Board, DefaultBoardCamera, DummyCanvas, EdgeAutoCameraInput, InputOrchestrator, ObservableInputTracker, SvgPositionDimensionPublisher, SvgProxy, VanillaKMTEventParser, createCameraMuxWithAnimationAndLockWithCameraRig, createDefaultCameraRig, createKmtInputStateMachine } from "@ue-too/board";
import { PointCal } from "@ue-too/math";

const svg = document.querySelector("#graph") as SVGSVGElement;

const width = 300;
const height = 150;
svg.setAttribute("width", width.toString());
svg.setAttribute("height", height.toString());
svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

const camera = new DefaultBoardCamera(width, height);
const cameraRig = createDefaultCameraRig(camera);
const cameraMux = createCameraMuxWithAnimationAndLockWithCameraRig(cameraRig);

const observableInputTracker = new ObservableInputTracker(new SvgProxy(svg));

const kmtInputStateMachine = createKmtInputStateMachine(observableInputTracker);

const svgPositionDimensionPublisher = new SvgPositionDimensionPublisher(svg);

const inputOrchestrator = new InputOrchestrator(cameraMux, cameraRig);

const kmtParser = new VanillaKMTEventParser(kmtInputStateMachine, inputOrchestrator, svg);

kmtParser.setUp();

let svgPos = {x: 0, y: 0, width: 0, height: 0};

svgPositionDimensionPublisher.onPositionUpdate((rect)=>{
    svgPos = rect;
});

const cameraGroup = document.querySelector("#camera") as SVGGElement;

camera.on("all", (_, cameraState)=>{

    // console.log(cameraState);
    const {scale, rotation, translation} = camera.getTRS(1, true);
    cameraGroup.setAttribute("transform", `translate(${translation.x}, ${translation.y}) scale(${scale.x}, ${scale.y}) rotate(${rotation * 180 / Math.PI})`);
});


const toggleCamera = document.querySelector("#toggle-camera") as HTMLButtonElement;
toggleCamera.addEventListener("click", ()=>{
    camera.setRotation(-Math.PI / 8);
    // camera.setPosition({x: 10, y: 10});
    // camera.setZoomLevel(1.5);
    cameraRig.zoomByAtWorld(1.5, {x: 10, y: 10});
});

svg.addEventListener('pointerdown', (e)=>{
    const viewportPosition = PointCal.subVector({x: e.clientX, y: e.clientY}, {x: svgPos.x + svgPos.width / 2, y: svgPos.y + svgPos.height / 2});
    console.log('svg position', svgPos);
    console.log('viewportPosition', viewportPosition);
    const worldPosition = camera.convertFromViewPort2WorldSpace(viewportPosition);
    console.log('worldPosition', worldPosition);
});


