import { Board, convertDeltaToComplyWithRestriction, drawArrow, drawRuler } from "@ue-too/board";
import { BCurve } from "@ue-too/curve";
import { PointCal } from "@ue-too/math";
import { createCubicFromTangentsCurvatures, createLayoutStateMachine, CurveCreationEngine, NewJointType } from "./kmt-state-machine";
import { TrainPlacementEngine, TrainPlacementStateMachine } from "./train-kmt-state-machine";
import Stats from "stats.js";
import { mercatorProjection } from "@ue-too/border";
import "./media";
import { ELEVATION, trackIsSloped } from "./track";
import { Bezier, Point } from "bezier-js";
import { Rectangle } from "./r-tree";
import { PreviewCurveCalculator } from "./new-joint";


const testCurve = new BCurve([{x: 100, y: 25}, {x: 10, y: 90}, {x: 110, y: 100}, {x: 150, y: 195}]);
const res = testCurve.splitIn3Curves(0.25, 0.75);

const firstCurve = res[0];
const secondCurve = res[1];
const thirdCurve = res[2];

// curve 1 control points [
//     {
//       "x": 82.79468411364182,
//       "y": 281.7059900498813,
//       "z": 0
//     },
//     {
//       "x": 169.1029913563118,
//       "y": 199.1776976370353,
//       "z": 0
//     },
//     {
//       "x": 228.60937554640233,
//       "y": 82.27781065247305,
//       "z": 0
//     }
//   ]
//   track.ts:1019 curve 2 control points [
//     {
//       "x": -51.31285263434981,
//       "y": 380.48305072064204,
//       "z": 0
//     },
//     {
//       "x": 127.40804188978572,
//       "y": 281.08714225887155,
//       "z": 0
//     },
//     {
//       "x": 228.60937554640233,
//       "y": 82.27781065247305,
//       "z": 0
//     }
//   ]

const testCurve1 = new BCurve([
    {x: 82.79468411364182, y: 281.7059900498813, z: 0},
    {x: 169.1029913563118, y: 199.1776976370353, z: 0},
    {x: 228.60937554640233, y: 82.27781065247305, z: 0}
]);
const testCurve2 = new BCurve([
    {x: -51.31285263434981, y: 380.48305072064204, z: 0},
    {x: 127.40804188978572, y: 281.08714225887155, z: 0},
    {x: 228.60937554640233, y: 82.27781065247305, z: 0}
]);

const testCurve1Bezier = new Bezier([
    {x: 82.79468411364182, y: 281.7059900498813, z: 0},
    {x: 169.1029913563118, y: 199.1776976370353, z: 0},
    {x: 228.60937554640233, y: 82.27781065247305, z: 0}
]);
const testCurve2Bezier = new Bezier([
    {x: -51.31285263434981, y: 380.48305072064204, z: 0},
    {x: 127.40804188978572, y: 281.08714225887155, z: 0},
    {x: 228.60937554640233, y: 82.27781065247305, z: 0}
]);

const intersections = testCurve1Bezier.intersects(testCurve2Bezier);
console.log('intersections', intersections);

const testRes = testCurve1.getCurveIntersections(testCurve2);

const testCoordinate = { longitude: 120.20, latitude: 22.98 };

const testProjection = mercatorProjection(testCoordinate, 120.20);
console.log('testProjection', testProjection);

const elevationText = document.getElementById("elevation") as HTMLParagraphElement;

// Function to download ImageData as PNG
function downloadImageDataAsPNG(imageData: ImageData, filename: string = 'canvas-capture.png') {
    // Create a temporary canvas to convert ImageData to PNG
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempContext = tempCanvas.getContext('2d');
    
    if (!tempContext) {
        console.error('Could not get 2D context for temporary canvas');
        return;
    }
    
    // Put the image data onto the temporary canvas
    tempContext.putImageData(imageData, 0, 0);
    
    // Convert canvas to PNG data URL and download
    const dataURL = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataURL;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`Downloaded ${filename}`);
}

// GeoJSON types
interface GeoJSONFeature {
    type: "Feature";
    geometry: {
        type: "Polygon" | "MultiPolygon";
        coordinates: number[][][] | number[][][][];
    };
    properties: Record<string, any>;
}

interface GeoJSONFeatureCollection {
    type: "FeatureCollection";
    features: GeoJSONFeature[];
}

const getRandomPoint = (min: number, max: number) => {
    return {
        x: Math.random() * (max - min) + min,
        y: Math.random() * (max - min) + min,
    }
}

const getRandomNumber = (min: number, max: number) => {
    return Math.random() * (max - min) + min;
}


// Function to convert GeoJSON coordinates to world coordinates
function geoJSONToWorldCoordinates(geoJSON: GeoJSONFeatureCollection, bounds?: { minLng: number, minLat: number, maxLng: number, maxLat: number }) {
    const features = geoJSON.features;
    const worldFeatures: Array<{ coordinates: number[][], properties: Record<string, any> }> = [];
    
    // Calculate bounds if not provided
    if (!bounds) {
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        
        features.forEach(feature => {
            const coords = feature.geometry.coordinates;
            coords.forEach(ring => {
                ring.forEach(coord => {
                    const [lng, lat] = coord as [number, number];
                    minLng = Math.min(minLng, lng);
                    minLat = Math.min(minLat, lat);
                    maxLng = Math.max(maxLng, lng);
                    maxLat = Math.max(maxLat, lat);
                });
            });
        });
        
        bounds = { minLng, minLat, maxLng, maxLat };
    }
    
    // Convert to world coordinates (you can adjust the scaling as needed)
    const scale = 1; // Adjust this to fit your coordinate system
    const width = bounds.maxLng - bounds.minLng;
    const height = bounds.maxLat - bounds.minLat;
    
    features.forEach(feature => {
        const coords = feature.geometry.coordinates;
        const worldCoords: number[][] = [];
        
        coords.forEach(ring => {
            const worldRing: number[] = [];
            ring.forEach(coord => {
                const [lng, lat] = coord as [number, number];
                // Normalize coordinates to 0-1 range
                const normalizedX = (lng - bounds!.minLng) / width;
                const normalizedY = (lat - bounds!.minLat) / height;
                // Convert to world coordinates
                const projectionPoint = PointCal.subVector(mercatorProjection({ longitude: lng, latitude: lat }, 120.35), {x: 0, y: 2650000});
                worldRing.push(projectionPoint.x * scale, -projectionPoint.y * scale);
            });
            worldCoords.push(worldRing);
        });
        
        worldFeatures.push({
            coordinates: worldCoords,
            properties: feature.properties
        });
    });
    
    return { worldFeatures, bounds };
}

const utilButton = document.getElementById("util") as HTMLButtonElement;

const layoutToggleButton = document.getElementById("layout-toggle") as HTMLButtonElement;
const layoutDeleteToggleButton = document.getElementById("layout-delete-toggle") as HTMLButtonElement;

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const stats = new Stats();
stats.showPanel(0);
const statsContainer = document.getElementById("stats") as HTMLDivElement;
statsContainer.appendChild(stats.dom);

// Override the stats.js default positioning to place it in top left
stats.dom.style.position = "absolute";
stats.dom.style.top = "0px";
stats.dom.style.left = "0px";

const board = new Board(canvas, true);
console.log('view port in world space', board.camera.viewPortInWorldSpace());
console.log('camera zoom boundaries', board.camera.zoomBoundaries);
console.log('camera boundaries', board.camera.boundaries);

board.camera.setMinZoomLevel(0.000001);
console.log('camera zoom boundaries', board.camera.zoomBoundaries);

const curveEngine = new CurveCreationEngine();
curveEngine.onElevationChange((elevation)=>{
    if(elevation != null){
        elevationText.textContent = `Elevation: ${elevation}`;
    } else {
        elevationText.textContent = `Elevation: N/A`;
    }
})
const stateMachine = createLayoutStateMachine(curveEngine);

// GeoJSON data storage
let districtData: GeoJSONFeatureCollection | null = null;
let villageData: GeoJSONFeatureCollection | null = null;
let worldDistrictFeatures: Array<{ coordinates: number[][], properties: Record<string, any> }> = [];
let worldVillageFeatures: Array<{ coordinates: number[][], properties: Record<string, any> }> = [];

// Visibility toggles
let showDistricts = true;
let showVillages = true;

// Function to render GeoJSON polygons
function renderGeoJSONPolygons(features: Array<{ coordinates: number[][], properties: Record<string, any> }>, color: string = "rgba(0, 0, 255, 0.3)", strokeColor: string = "blue") {
    if (board.context === undefined) return;
    
    board.context.save();
    board.context.fillStyle = color;
    board.context.strokeStyle = strokeColor;
    board.context.lineWidth = 1 / board.camera.zoomLevel;
    
    features.forEach(feature => {
        feature.coordinates.forEach(ring => {
            board.context!.beginPath();
            for (let i = 0; i < ring.length; i += 2) {
                const x = ring[i];
                const y = ring[i + 1];
                if (i === 0) {
                    board.context!.moveTo(x, y);
                } else {
                    board.context!.lineTo(x, y);
                }
            }
            board.context!.closePath();
            board.context!.fill();
            board.context!.stroke();
        });
    });
    
    board.context.restore();
}

// Initialize GeoJSON data
async function initializeGeoJSON() {
    try {
        console.log("Initializing GeoJSON data...");
        const base = import.meta.env.BASE_URL || "/";
        const [districtResp, villageResp] = await Promise.all([
            fetch(`${base}tainan-district.json`),
            fetch(`${base}tainan-village.json`),
        ]);
        if (!districtResp.ok || !villageResp.ok) {
            throw new Error(`Failed to fetch GeoJSON: ${districtResp.status}/${villageResp.status}`);
        }
        districtData = await districtResp.json() as GeoJSONFeatureCollection;
        villageData = await villageResp.json() as GeoJSONFeatureCollection;
        
        // Convert to world coordinates
        const districtResult = geoJSONToWorldCoordinates(districtData);
        const villageResult = geoJSONToWorldCoordinates(villageData);
        
        worldDistrictFeatures = districtResult.worldFeatures;
        worldVillageFeatures = villageResult.worldFeatures;
        
        console.log(`Loaded ${worldDistrictFeatures.length} district features and ${worldVillageFeatures.length} village features`);
        
        // You can adjust the camera view to fit the data
        // board.camera.setViewport(districtResult.bounds);
        
    } catch (error) {
        console.error("Failed to initialize GeoJSON data:", error);
    }
}

stateMachine.onStateChange((currentState, nextState)=>{
    switch(nextState){
        case "HOVER_FOR_CURVE_DELETION":
            layoutToggleButton.textContent = "Start Layout";
            layoutToggleButton.disabled = true;
            layoutDeleteToggleButton.textContent = "End Layout Deletion";
            layoutDeleteToggleButton.disabled = false;
            break;
        case "HOVER_FOR_STARTING_POINT":
            board.cameraMovementOnMouseEdge.toggleOn();
            layoutDeleteToggleButton.textContent = "Start Layout Deletion";
            layoutDeleteToggleButton.disabled = true;
            layoutToggleButton.textContent = "End Layout";
            layoutToggleButton.disabled = false;
            break;
        case "IDLE":
            board.cameraMovementOnMouseEdge.toggleOff();
            layoutDeleteToggleButton.textContent = "Start Layout Deletion";
            layoutDeleteToggleButton.disabled = false;
            layoutToggleButton.textContent = "Start Layout";
            layoutToggleButton.disabled = false;
            break;
        default:
            break;
    }
});

layoutDeleteToggleButton.addEventListener("click", ()=>{
    if(layoutDeleteToggleButton.textContent === "Start Layout Deletion"){
        stateMachine.happens("startDeletion");
    } else {
        stateMachine.happens("endDeletion");
    }
});


const trainPlacementToggleButton = document.getElementById("train-placement-toggle") as HTMLButtonElement;
const trainPlacementEngine = new TrainPlacementEngine(curveEngine.trackGraph);
const trainStateMachine = new TrainPlacementStateMachine(trainPlacementEngine);

// Cache for track segment offset curves to avoid recalculating every frame
const trackOffsetCache = new Map<number, BCurve[]>();
let trackCacheVersion = 0;

canvas.addEventListener("pointerdown", (event) => {
    if(event.button !== 0){
        return;
    }

    const worldPosition = board.convertWindowPoint2WorldCoord({
        x: event.clientX,
        y: event.clientY,
    });

    stateMachine.happens("pointerdown", {
        position: worldPosition,
        pointerId: event.pointerId,
    });

    trainStateMachine.happens("pointerdown", {
        position: worldPosition,
    });
});

canvas.addEventListener("wheel", (event)=>{
    stateMachine.happens("scroll", {
        positive: event.deltaY > 0,
    });
});

canvas.addEventListener("pointerup", (event) => {

    if(event.button !== 0){
        return;
    }

    const worldPosition = board.convertWindowPoint2WorldCoord({
        x: event.clientX,
        y: event.clientY,
    });

    stateMachine.happens("pointerup", {
        pointerId: event.pointerId,
        position: worldPosition,
    });

    trainStateMachine.happens("pointerup", {
        position: worldPosition,
    });
});

window.addEventListener("keydown", (event)=>{
    if(event.key === "Escape"){
        console.log("Escape key pressed");
        stateMachine.happens("escapeKey");
    } else if(event.key === "f"){
        stateMachine.happens("flipEndTangent");
    } else if(event.key === "g"){
        stateMachine.happens("flipStartTangent");
    } else if(event.key === "q"){
        stateMachine.happens("toggleStraightLine");
    }
});

canvas.addEventListener("pointermove", (event) => { 

    const worldPosition = board.convertWindowPoint2WorldCoord({
        x: event.clientX,
        y: event.clientY,
    });

    stateMachine.happens("pointermove", {
        pointerId: event.pointerId,
        position: worldPosition,
    });

    trainStateMachine.happens("pointermove", {
        position: worldPosition,
    });
});

layoutToggleButton.addEventListener("click", ()=>{
    if(layoutToggleButton.textContent === "Start Layout"){
        stateMachine.happens("startLayout");
        console.log("start layout");
        board.kmtParser.stateMachine.happens("disable");
        layoutToggleButton.textContent = "End Layout";
        trainPlacementToggleButton.textContent = "Start Train Placement";
        trainStateMachine.happens("endPlacement");
    } else {
        stateMachine.happens("endLayout");
        board.kmtParser.stateMachine.happens("enable");
        layoutToggleButton.textContent = "Start Layout";
        trainPlacementToggleButton.disabled = false;
    }
});

trainPlacementToggleButton.addEventListener("click", ()=>{
    if(trainPlacementToggleButton.textContent === "Start Train Placement"){
        trainStateMachine.happens("startPlacement");
        stateMachine.happens("endLayout");
        board.kmtParser.disabled = true;
        trainPlacementToggleButton.textContent = "End Train Placement";
        layoutToggleButton.disabled = true;
        layoutToggleButton.textContent = "Start Layout";
    } else {
        trainStateMachine.happens("endPlacement");
        board.kmtParser.disabled = false;
        trainPlacementToggleButton.textContent = "Start Train Placement";
        layoutToggleButton.disabled = false;
    }
});

stateMachine.onStateChange((currentState, nextState )=>{

    console.log('from', currentState, 'to', nextState);
})


let lastTimestamp = 0;

let capture = false;

function step(timestamp: number){

    stats.begin();
    board.step(timestamp);

    const deltaTime = timestamp - lastTimestamp; // in milliseconds
    trainPlacementEngine.update(deltaTime);

    lastTimestamp = timestamp;

    if(board.context === undefined){
        return;
    }
    
    // Clear offset cache when track changes (simple version - clear when number of segments changes)
    const currentTrackSegmentCount = curveEngine.trackGraph.trackSegments.length;
    if (trackOffsetCache.size !== currentTrackSegmentCount) {
        trackOffsetCache.clear();
        trackCacheVersion++;
    }

    if(curveEngine.previewCurve !== null){
        const cps = curveEngine.previewCurve.curve.getControlPoints();
        board.context.save();
        board.context.strokeStyle = createGradient(board.context, curveEngine.previewCurve.elevation.from, curveEngine.previewCurve.elevation.to, cps[0], cps[1]);
        board.context.lineWidth = 5 / board.camera.zoomLevel;
        board.context.beginPath();
        board.context.moveTo(cps[0].x, cps[0].y);
        if(cps.length === 3){
            board.context.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
        } else {
            board.context.bezierCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y, cps[3].x, cps[3].y);
        }
        board.context.stroke();
        board.context.restore();
    }

    // NOTE with draw order sorted by elevation
    const viewportAABB = board.camera.viewPortAABB();
    const drawData = curveEngine.trackGraph.getDrawData(viewportAABB);

    drawData.forEach((drawData)=>{
        if(board.context === undefined){
            return;
        }

        const cps = drawData.curve.getControlPoints();

        board.context.save();
        board.context.beginPath();
        board.context.arc(cps[0].x, cps[0].y, 3, 0, 2 * Math.PI);
        board.context.fill();
        board.context.restore();

        board.context.save();
        board.context.beginPath();
        board.context.arc(cps[cps.length - 1].x, cps[cps.length - 1].y, 3, 0, 2 * Math.PI);
        board.context.fill();
        board.context.restore();


        board.context.save();
        board.context.strokeStyle = createGradient(board.context, drawData.originalElevation.from, drawData.originalElevation.to, drawData.originalTrackSegment.startJointPosition, drawData.originalTrackSegment.endJointPosition);
        board.context.lineWidth = 5 / board.camera.zoomLevel;
        board.context.beginPath();
        board.context.moveTo(cps[0].x, cps[0].y);
        if(cps.length === 3){
            board.context.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
        } else {
            board.context.bezierCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y, cps[3].x, cps[3].y);
        }
        board.context.stroke();
        board.context.restore();
    });


    // offset as line segments
    board.context.save();
    curveEngine.trackGraph.experimentTrackOffsets.forEach((offset)=>{
        if(board.context === undefined){
            return;
        }
        board.context.beginPath();
        board.context.moveTo(offset.positive[0].x, offset.positive[0].y);
        for(let i = 1; i < offset.positive.length; i++){
            board.context.lineTo(offset.positive[i].x, offset.positive[i].y);
        }
        board.context.stroke();
        board.context.beginPath();
        board.context.moveTo(offset.negative[0].x, offset.negative[0].y);
        for(let i = 1; i < offset.negative.length; i++){
            board.context.lineTo(offset.negative[i].x, offset.negative[i].y);
        }
        board.context.stroke();
    });
    board.context.restore();

    // Render GeoJSON polygons
    if (showDistricts && worldDistrictFeatures.length > 0) {
        renderGeoJSONPolygons(worldDistrictFeatures, "rgba(0, 100, 255, 0.2)", "rgba(0, 100, 255, 0.8)");
    }
    if (showVillages && worldVillageFeatures.length > 0) {
        renderGeoJSONPolygons(worldVillageFeatures, "rgba(255, 100, 0, 0.1)", "rgba(255, 100, 0, 0.6)");
    }

    if(curveEngine.previewCurveForDeletion !== null){
        const cps = curveEngine.previewCurveForDeletion.getControlPoints();
        board.context.save();
        board.context.lineWidth = 10 / board.camera.zoomLevel;
        board.context.strokeStyle = "rgba(255, 0, 0, 0.5)";
        board.context.beginPath();
        board.context.moveTo(cps[0].x, cps[0].y);
        if(cps.length === 3){
            board.context.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
        } else {
            board.context.bezierCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y, cps[3].x, cps[3].y);
        }
        board.context.stroke();
        board.context.restore();
    }

    curveEngine.trackGraph.getJoints().forEach(({joint, jointNumber})=>{
        if(board.context === undefined){
            return;
        }
        board.context.save();
        board.context.lineWidth = 1 / board.camera.zoomLevel;
        board.context.strokeStyle = "blue";
        board.context.beginPath();
        board.context.arc(joint.position.x, joint.position.y, 5, 0, 2 * Math.PI);
        board.context.stroke();
        board.context.textAlign = "center";
        board.context.textBaseline = "middle";
        drawArrow(board.context, board.camera.zoomLevel, joint.position, PointCal.addVector(PointCal.multiplyVectorByScalar(joint.tangent, 10), joint.position));
        board.context.fillText(jointNumber.toString(), joint.position.x, joint.position.y);
        board.context.restore();
    });

    if(curveEngine.previewStartProjection != null){
        board.context.save();
        board.context.fillStyle = "red";
        const point = curveEngine.previewStartProjection.projectionPoint;
        board.context.beginPath();
        board.context.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        board.context.fill();
        board.context.restore();
    }

    if(curveEngine.previewEndProjection != null){
        board.context.save();
        board.context.fillStyle = "green";
        const point = curveEngine.previewEndProjection.projectionPoint;
        board.context.beginPath();
        board.context.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        board.context.fill();
        board.context.restore();
    }

    if(curveEngine.newStartJointType != null) {
        board.context.save();
        board.context.fillStyle = colorForJoint(curveEngine.newStartJointType);
        board.context.beginPath();
        board.context.arc(curveEngine.newStartJointType.position.x, curveEngine.newStartJointType.position.y, 5, 0, 2 * Math.PI);
        board.context.fill();
        board.context.restore();
    }

    if(curveEngine.newEndJointType != null){
        board.context.save();
        board.context.fillStyle = colorForJoint(curveEngine.newEndJointType);
        board.context.beginPath();
        board.context.arc(curveEngine.newEndJointType.position.x, curveEngine.newEndJointType.position.y, 5, 0, 2 * Math.PI);
        board.context.fill();
        board.context.restore();
    }

    if(trainPlacementEngine.previewPosition != null){
        board.context.save();
        board.context.fillStyle = "red";
        board.context.beginPath();
        board.context.arc(trainPlacementEngine.previewPosition.x, trainPlacementEngine.previewPosition.y, 5, 0, 2 * Math.PI);
        board.context.fill();
        board.context.restore();
    }

    if(trainPlacementEngine.trainPosition != null){
        board.context.save();
        board.context.fillStyle = "green";
        board.context.beginPath();
        board.context.arc(trainPlacementEngine.trainPosition.x, trainPlacementEngine.trainPosition.y, 5, 0, 2 * Math.PI);
        board.context.fill();
        board.context.restore();
        if(trainPlacementEngine.trainTangent !== null){
            drawArrow(board.context, board.camera.zoomLevel, trainPlacementEngine.trainPosition, PointCal.addVector(PointCal.multiplyVectorByScalar(PointCal.unitVector(trainPlacementEngine.trainTangent), 10), trainPlacementEngine.trainPosition));
        }
    }

    if(trainPlacementEngine.secondBogiePosition != null){
        board.context.save();
        board.context.fillStyle = "green";
        board.context.beginPath();
        board.context.arc(trainPlacementEngine.secondBogiePosition.x, trainPlacementEngine.secondBogiePosition.y, 5, 0, 2 * Math.PI);
        board.context.fill();
        board.context.restore();
    }

    if(capture){
        
        const imageData = board.context.getImageData(0, 0, canvas.width, canvas.height);
        downloadImageDataAsPNG(imageData);
        capture = false;
    }

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

    stats.end();
    window.requestAnimationFrame(step);
}

window.requestAnimationFrame(step);

// Initialize GeoJSON data
initializeGeoJSON();

const curveCalculator = new PreviewCurveCalculator();

utilButton.addEventListener("click", ()=>{

    // NOTE check track draw order
    const trackSegmentNumber = 1;
    const tVal = 0.5;
    const order = curveEngine.trackGraph.getTrackDrawDataOrder(trackSegmentNumber, tVal);
    const totalCount = curveEngine.trackGraph.getDrawData(board.camera.viewPortAABB()).length;
    console.log('totalCount', totalCount);
    console.log('order', order);

    // NOTE pressure test
    // for(let i = 0; i < 10; i++){
    //     const viewportAABB = board.camera.viewPortAABB();
    //     const p1 = {x: getRandomNumber(viewportAABB.min.x, viewportAABB.max.x), y: getRandomNumber(viewportAABB.min.y, viewportAABB.max.y)};
    //     const p2 = {x: getRandomNumber(viewportAABB.min.x, viewportAABB.max.x), y: getRandomNumber(viewportAABB.min.y, viewportAABB.max.y)};
    //     const tangent = PointCal.unitVector(getRandomPoint(0, 1));
    //     const tangent2 = PointCal.unitVector(getRandomPoint(0, 1));
    //     const elevation = Math.floor(Math.random() * 7) - 3;
    //     const elevation2 = Math.floor(Math.random() * 7) - 3;
    //     const joint1 = curveEngine.trackGraph.createNewEmptyJoint({x: p1.x, y: p1.y}, tangent)
    //     const joint2 = curveEngine.trackGraph.createNewEmptyJoint({x: p2.x, y: p2.y}, tangent)
    //     const curve = createCubicFromTangentsCurvatures(p1, p2, tangent, tangent2, Math.random(), Math.random());
    //     curveEngine.trackGraph.connectJoints(joint1, joint2, [curve.p1, curve.p2]);
    // }

    // NOTE debug same direction
    // canvas.dispatchEvent(new PointerEvent('pointermove', {clientX: -174.12109375, clientY: 59.125}));
    // canvas.dispatchEvent(new PointerEvent('pointerup', {clientX: -174.12109375, clientY: 59.125}));
    // canvas.dispatchEvent(new PointerEvent('pointermove', {clientX: -27.76562499999997, clientY: 45.4296875}));
    // canvas.dispatchEvent(new PointerEvent('pointerup', {clientX: -27.76562499999997, clientY: 45.4296875}));
    // canvas.dispatchEvent(new PointerEvent('pointermove',{clientX: 86.41796875, clientY: -32.3203125}));
    // canvas.dispatchEvent(new PointerEvent('pointerup', {clientX: 86.41796875, clientY: -32.3203125}));
    // canvas.dispatchEvent(new PointerEvent('pointermove', {clientX: 209.05078125, clientY: -160.5234375}));
    // canvas.dispatchEvent(new PointerEvent('pointerup', {clientX: 209.05078125, clientY: -160.5234375}));
    // window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));


    console.log('viewport aabb', board.camera.viewPortAABB());
});


const p1Button = document.getElementById("p1") as HTMLButtonElement;
const neutralButton = document.getElementById("neutral") as HTMLButtonElement;
const switchDirectionButton = document.getElementById("switch-direction") as HTMLButtonElement;

p1Button.addEventListener("click", ()=>{
    trainPlacementEngine.setTrainSpeed(40);
});

neutralButton.addEventListener("click", ()=>{
    trainPlacementEngine.setTrainSpeed(0);
    trainPlacementEngine.setTrainAcceleration(0);
});

switchDirectionButton.addEventListener("click", ()=>{
    trainPlacementEngine.switchDirection();
});

// GeoJSON toggle buttons
const toggleDistrictsButton = document.getElementById("toggle-districts") as HTMLButtonElement;
const toggleVillagesButton = document.getElementById("toggle-villages") as HTMLButtonElement;

toggleDistrictsButton.addEventListener("click", ()=>{
    showDistricts = !showDistricts;
    toggleDistrictsButton.textContent = showDistricts ? "Hide Districts" : "Show Districts";
});

toggleVillagesButton.addEventListener("click", ()=>{
    showVillages = !showVillages;
    toggleVillagesButton.textContent = showVillages ? "Hide Villages" : "Show Villages";
});

// Initialize button text
toggleDistrictsButton.textContent = "Hide Districts";
toggleVillagesButton.textContent = "Hide Villages";

const captureButton = document.getElementById("capture") as HTMLButtonElement;

captureButton.addEventListener("click", ()=>{
    capture = true;
});

function colorForJoint(joint: NewJointType) {
    switch(joint.type) {
        case "new":
            return "purple";
        case "contrained":
            return "red";
        case "branchJoint":
            return "green";
        case "extendingTrack":
            return "blue";
        case "branchCurve":
            return "yellow";
    }
}

const getElevationColor = (elevation: ELEVATION): string => {
    switch(elevation){
        case ELEVATION.SUB_3:
            return "red";
        case ELEVATION.SUB_2:
            return "orange";
        case ELEVATION.SUB_1:
            return "yellow";
        case ELEVATION.GROUND:
            return "green";
        case ELEVATION.ABOVE_1:
            return "cyan";
        case ELEVATION.ABOVE_2:
            return "magenta";
        case ELEVATION.ABOVE_3:
            return "blue";
        default:
            return "gray";
    }
};

function createGradient(context: CanvasRenderingContext2D, startElevation: ELEVATION, endElevation: ELEVATION, startPoint: Point, endPoint: Point){ 

    // Create linear gradient from start to end of the curve
    const startColor = getElevationColor(startElevation);
    const endColor = getElevationColor(endElevation);
    
    // Create gradient along the curve from start point to end point
    const gradient = context.createLinearGradient(
        startPoint.x, startPoint.y,
        endPoint.x, endPoint.y
    );
    
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);

    return gradient;
}
