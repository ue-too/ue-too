import { Board, CameraPanEventPayload, CameraState, CameraZoomEventPayload } from "@ue-too/board";
import { Point, PointCal } from "@ue-too/math";
import { World, VisualPolygonBody } from "@ue-too/dynamics";


let element = document.getElementById("graph") as HTMLCanvasElement;
let board = new Board(element);
board.fullScreen = true;
let keyController: Map<string, boolean>;
keyController = new Map<string, boolean>();

keyController.set("KeyA", false);
keyController.set("KeyW", false);
keyController.set("KeyS", false);
keyController.set("KeyD", false);
keyController.set("KeyQ", false);
keyController.set("KeyE", false);

window.addEventListener('keypress', (e)=>{
    if(keyController.has(e.code)){
        keyController.set(e.code, true);
    }
});

window.addEventListener('keyup', (e)=>{
    if(keyController.has(e.code)){
        keyController.set(e.code, false);
    }
})

board.on("pan", (event: CameraPanEventPayload, cameraState: CameraState)=>{
    console.log(event.diff);
});

board.on("zoom", (event: CameraZoomEventPayload, cameraState: CameraState)=>{
    // console.log("canvas zoomed");
});

const context = board.context;
let world = new World(300, 300);
world._context = context;
for (let index = 0; index < 10; index++){
    if(index == 0){
        let vertices = [{x: 20, y: 10}, {x: -20, y: 10}, {x: -20, y: -10}, {x: 20, y: -10}];
        // let body = new VisaulCircleBody(getRandomPoint(0, 100), 5, context, 0, 200);
        let initialCenter = getRandomPoint(0, 300);
        initialCenter.z = 100;
        let body = new VisualPolygonBody(initialCenter, vertices, context, 0, 300);
        world.addRigidBody(index.toString(), body);
        
    } else {
        // let body = new VisaulCircleBody(getRandomPoint(0, 100), 5, context, 0, 50);
        let body = new VisualPolygonBody(getRandomPoint(0, 300), [{x: 20, y: 10}, {x: -20, y: 10}, {x: -20, y: -10}, {x: 20, y: -10}], context, 0, 50, false);
        world.addRigidBody(index.toString(), body);
    }
}
const initCameraPos = world.getRigidBodyList()[0].center;
// element.getCamera().setPositionWithClamp(initCameraPos);
function step(timestamp: number){
    board.step(timestamp);
    // console.log(world.getRigidBodyList()[0].center);
    let rigidBodies = world.getRigidBodyList();
    if(keyController.get("KeyW")){
        rigidBodies[0].applyForceInOrientation({x: 3000, y: 0});
    } 
    if(keyController.get("KeyA")){
        rigidBodies[0].applyForceInOrientation({x: 0, y: 3000});
    }
    if(keyController.get("KeyS")){
        rigidBodies[0].applyForceInOrientation({x: -3000, y: 0});
    }
    if(keyController.get("KeyD")){
        rigidBodies[0].applyForceInOrientation({x: 0, y: -3000});
    }
    if(keyController.get("KeyQ")){
        rigidBodies[0].angularVelocity = 0.5;
    }
    if(keyController.get("KeyE")){
        rigidBodies[0].angularVelocity = -0.5;
    }
    world.step(0.016);
    window.requestAnimationFrame(step);
}

step(0);

function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandom(min: number, max: number){
    return Math.random() * (max - min) + min;
}

function getRandomPoint(min: number, max: number): Point{
    return {x: getRandom(min, max), y: getRandom(min, max)};
}


// let worker = new Worker("./physicsWorker.js");
