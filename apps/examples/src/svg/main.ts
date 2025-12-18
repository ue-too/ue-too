import { Board, DefaultBoardCamera, DummyCanvas, EdgeAutoCameraInput, InputOrchestrator, ObservableInputTracker, VanillaKMTEventParser, createCameraMuxWithAnimationAndLockWithCameraRig, createDefaultCameraRig, createKmtInputStateMachine } from "@ue-too/board";

const svg = document.querySelector("#graph") as SVGSVGElement;

const width = 300;
const height = 150;
svg.setAttribute("width", width.toString());
svg.setAttribute("height", height.toString());
svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

const camera = new DefaultBoardCamera(width, height);
const cameraRig = createDefaultCameraRig(camera);
const cameraMux = createCameraMuxWithAnimationAndLockWithCameraRig(cameraRig);

const edgeAutoCameraInput = new EdgeAutoCameraInput(cameraMux);

const observableInputTracker = new ObservableInputTracker(new DummyCanvas(), edgeAutoCameraInput);

const kmtInputStateMachine = createKmtInputStateMachine(observableInputTracker);

const cameraGroup = document.querySelector("#camera") as SVGGElement;

camera.on("all", (_, cameraState)=>{

    console.log(cameraState);
    const {scale, rotation, translation} = camera.getTRS(1, true);
    cameraGroup.setAttribute("transform", `translate(${translation.x}, ${translation.y}) scale(${scale.x}, ${scale.y}) rotate(${rotation * 180 / Math.PI})`);
});


const toggleCamera = document.querySelector("#toggle-camera") as HTMLButtonElement;
toggleCamera.addEventListener("click", ()=>{
    camera.setRotation(-Math.PI / 8);
    camera.setPosition({x: 10, y: 10});
});


