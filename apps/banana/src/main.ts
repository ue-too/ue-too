import { Board, convertFromCanvas2ViewPort, convertFromViewport2World, convertFromWindow2Canvas, DefaultBoardCamera, drawArrow, drawRuler } from '@ue-too/board';
import { mercatorProjection } from '@ue-too/border';
import { PointCal } from '@ue-too/math';
import { Point } from '@ue-too/math';
import Stats from 'stats.js';

import './media';
import { TrainPlacementEngine, TrainPlacementStateMachine } from './trains';
import {
    CurveCreationEngine,
    NewJointType,
} from './trains/input-state-machine/kmt-state-machine';
import { createLayoutStateMachine } from './trains/input-state-machine/utils';
import './media';
import { ELEVATION, TrackSegmentDrawData } from './trains/tracks/types';
import { LEVEL_HEIGHT } from './trains/tracks/constants';
import { shadows } from './utils';
import { TrackRenderSystem } from './trains/tracks/render-system';
import { baseInitApp } from '@ue-too/board-pixi-integration';

const elevationText = document.getElementById(
    'elevation'
) as HTMLParagraphElement;

// Function to download ImageData as PNG
function downloadImageDataAsPNG(
    imageData: ImageData,
    filename: string = 'canvas-capture.png'
) {
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
    type: 'Feature';
    geometry: {
        type: 'Polygon' | 'MultiPolygon';
        coordinates: number[][][] | number[][][][];
    };
    properties: Record<string, any>;
}

interface GeoJSONFeatureCollection {
    type: 'FeatureCollection';
    features: GeoJSONFeature[];
}

const getRandomPoint = (min: number, max: number) => {
    return {
        x: Math.random() * (max - min) + min,
        y: Math.random() * (max - min) + min,
    };
};

const getRandomNumber = (min: number, max: number) => {
    return Math.random() * (max - min) + min;
};

// Function to convert GeoJSON coordinates to world coordinates
function geoJSONToWorldCoordinates(
    geoJSON: GeoJSONFeatureCollection,
    bounds?: { minLng: number; minLat: number; maxLng: number; maxLat: number }
) {
    const features = geoJSON.features;
    const worldFeatures: Array<{
        coordinates: number[][];
        properties: Record<string, any>;
    }> = [];

    // Calculate bounds if not provided
    if (!bounds) {
        let minLng = Infinity,
            minLat = Infinity,
            maxLng = -Infinity,
            maxLat = -Infinity;

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
                const projectionPoint = PointCal.subVector(
                    mercatorProjection(
                        { longitude: lng, latitude: lat },
                        120.35
                    ),
                    { x: 0, y: 2650000 }
                );
                worldRing.push(
                    projectionPoint.x * scale,
                    -projectionPoint.y * scale
                );
            });
            worldCoords.push(worldRing);
        });

        worldFeatures.push({
            coordinates: worldCoords,
            properties: feature.properties,
        });
    });

    return { worldFeatures, bounds };
}

const utilButton = document.getElementById('util') as HTMLButtonElement;

const layoutToggleButton = document.getElementById(
    'layout-toggle'
) as HTMLButtonElement;
const layoutDeleteToggleButton = document.getElementById(
    'layout-delete-toggle'
) as HTMLButtonElement;

// const canvas = document.getElementById('graph') as HTMLCanvasElement;
const pixiCanvas = document.getElementById('pixi-graph') as HTMLCanvasElement;
const stats = new Stats();
stats.showPanel(0);
const statsContainer = document.getElementById('stats') as HTMLDivElement;
statsContainer.appendChild(stats.dom);

// Override the stats.js default positioning to place it in top left
stats.dom.style.position = 'absolute';
stats.dom.style.top = '0px';
stats.dom.style.left = '0px';


const curveEngine = new CurveCreationEngine();
const trackRenderSystem = new TrackRenderSystem(curveEngine.trackGraph.trackCurveManager, curveEngine);

const res = await baseInitApp(pixiCanvas, {
    fullScreen: false,
});

res.app.stage.addChild(trackRenderSystem.container);

curveEngine.onElevationChange(elevation => {
    if (elevation != null) {
        elevationText.textContent = `Elevation: ${elevation}`;
    } else {
        elevationText.textContent = `Elevation: N/A`;
    }
});
const stateMachine = createLayoutStateMachine(curveEngine);

// GeoJSON data storage
let districtData: GeoJSONFeatureCollection | null = null;
let villageData: GeoJSONFeatureCollection | null = null;
let worldDistrictFeatures: Array<{
    coordinates: number[][];
    properties: Record<string, any>;
}> = [];
let worldVillageFeatures: Array<{
    coordinates: number[][];
    properties: Record<string, any>;
}> = [];

// Visibility toggles
let showDistricts = true;
let showVillages = true;

// Initialize GeoJSON data
async function initializeGeoJSON() {
    try {
        console.log('Initializing GeoJSON data...');
        const base = import.meta.env.BASE_URL || '/';
        const [districtResp, villageResp] = await Promise.all([
            fetch(`${base}tainan-district.json`),
            fetch(`${base}tainan-village.json`),
        ]);
        if (!districtResp.ok || !villageResp.ok) {
            throw new Error(
                `Failed to fetch GeoJSON: ${districtResp.status}/${villageResp.status}`
            );
        }
        districtData = (await districtResp.json()) as GeoJSONFeatureCollection;
        villageData = (await villageResp.json()) as GeoJSONFeatureCollection;

        // Convert to world coordinates
        const districtResult = geoJSONToWorldCoordinates(districtData);
        const villageResult = geoJSONToWorldCoordinates(villageData);

        worldDistrictFeatures = districtResult.worldFeatures;
        worldVillageFeatures = villageResult.worldFeatures;

        console.log(
            `Loaded ${worldDistrictFeatures.length} district features and ${worldVillageFeatures.length} village features`
        );

        // You can adjust the camera view to fit the data
        // board.camera.setViewport(districtResult.bounds);
    } catch (error) {
        console.error('Failed to initialize GeoJSON data:', error);
    }
}

stateMachine.onStateChange((currentState, nextState) => {
    switch (nextState) {
        case 'HOVER_FOR_CURVE_DELETION':
            layoutToggleButton.textContent = 'Start Layout';
            layoutToggleButton.disabled = true;
            layoutDeleteToggleButton.textContent = 'End Layout Deletion';
            layoutDeleteToggleButton.disabled = false;
            break;
        case 'HOVER_FOR_STARTING_POINT':
            // board.cameraMovementOnMouseEdge.toggleOn();
            layoutDeleteToggleButton.textContent = 'Start Layout Deletion';
            layoutDeleteToggleButton.disabled = true;
            layoutToggleButton.textContent = 'End Layout';
            layoutToggleButton.disabled = false;
            break;
        case 'IDLE':
            // board.cameraMovementOnMouseEdge.toggleOff();
            layoutDeleteToggleButton.textContent = 'Start Layout Deletion';
            layoutDeleteToggleButton.disabled = false;
            layoutToggleButton.textContent = 'Start Layout';
            layoutToggleButton.disabled = false;
            break;
        default:
            break;
    }
});

layoutDeleteToggleButton.addEventListener('click', () => {
    if (layoutDeleteToggleButton.textContent === 'Start Layout Deletion') {
        stateMachine.happens('startDeletion');
    } else {
        stateMachine.happens('endDeletion');
    }
});

const trainPlacementToggleButton = document.getElementById(
    'train-placement-toggle'
) as HTMLButtonElement;
const trainPlacementEngine = new TrainPlacementEngine(curveEngine.trackGraph);
const train = trainPlacementEngine.train;
const trainStateMachine = new TrainPlacementStateMachine(trainPlacementEngine);

pixiCanvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) {
        return;
    }

    const rawPoint = {
        x: event.clientX,
        y: event.clientY,
    }

    const pointInCanvas = convertFromWindow2Canvas(rawPoint, res.canvasProxy);

    const viewportPosition = convertFromCanvas2ViewPort(pointInCanvas, {
        x: res.canvasProxy.width / 2,
        y: res.canvasProxy.height / 2,
    });

    const worldPosition = convertFromViewport2World(viewportPosition, res.camera.position, res.camera.zoomLevel, res.camera.rotation);

    stateMachine.happens('pointerdown', {
        position: worldPosition,
        pointerId: event.pointerId,
    });

    trainStateMachine.happens('pointerdown', {
        position: worldPosition,
    });
});

pixiCanvas.addEventListener('wheel', event => {
    stateMachine.happens('scroll', {
        positive: event.deltaY > 0,
    });
});

pixiCanvas.addEventListener('pointerup', event => {
    if (event.button !== 0) {
        return;
    }

    const rawPoint = {
        x: event.clientX,
        y: event.clientY,
    }

    const pointInCanvas = convertFromWindow2Canvas(rawPoint, res.canvasProxy);

    const viewportPosition = convertFromCanvas2ViewPort(pointInCanvas, {
        x: res.canvasProxy.width / 2,
        y: res.canvasProxy.height / 2,
    });

    const worldPosition = convertFromViewport2World(viewportPosition, res.camera.position, res.camera.zoomLevel, res.camera.rotation);


    stateMachine.happens('pointerup', {
        pointerId: event.pointerId,
        position: worldPosition,
    });

    trainStateMachine.happens('pointerup', {
        position: worldPosition,
    });
});

window.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        console.log('Escape key pressed');
        stateMachine.happens('escapeKey');
    } else if (event.key === 'f') {
        stateMachine.happens('flipEndTangent');
        trainStateMachine.happens('flipTrainDirection');
    } else if (event.key === 'g') {
        stateMachine.happens('flipStartTangent');
    } else if (event.key === 'q') {
        stateMachine.happens('toggleStraightLine');
    }
});

pixiCanvas.addEventListener('pointermove', event => {
    const rawPoint = {
        x: event.clientX,
        y: event.clientY,
    }

    const pointInCanvas = convertFromWindow2Canvas(rawPoint, res.canvasProxy);

    const viewportPosition = convertFromCanvas2ViewPort(pointInCanvas, {
        x: res.canvasProxy.width / 2,
        y: res.canvasProxy.height / 2,
    });

    const worldPosition = convertFromViewport2World(viewportPosition, res.camera.position, res.camera.zoomLevel, res.camera.rotation);

    stateMachine.happens('pointermove', {
        pointerId: event.pointerId,
        position: worldPosition,
    });

    trainStateMachine.happens('pointermove', {
        position: worldPosition,
    });
});

layoutToggleButton.addEventListener('click', () => {
    if (layoutToggleButton.textContent === 'Start Layout') {
        stateMachine.happens('startLayout');
        console.log('start layout');
        res.kmtParser.disable();
        layoutToggleButton.textContent = 'End Layout';
        trainPlacementToggleButton.textContent = 'Start Train Placement';
        trainStateMachine.happens('endPlacement');
    } else {
        stateMachine.happens('endLayout');
        res.kmtParser.enable();
        layoutToggleButton.textContent = 'Start Layout';
        trainPlacementToggleButton.disabled = false;
    }
});

trainPlacementToggleButton.addEventListener('click', () => {
    if (trainPlacementToggleButton.textContent === 'Start Train Placement') {
        trainStateMachine.happens('startPlacement');
        stateMachine.happens('endLayout');
        res.kmtParser.disable();
        trainPlacementToggleButton.textContent = 'End Train Placement';
        layoutToggleButton.disabled = true;
        layoutToggleButton.textContent = 'Start Layout';
    } else {
        trainStateMachine.happens('endPlacement');
        res.kmtParser.enable();
        trainPlacementToggleButton.textContent = 'Start Train Placement';
        layoutToggleButton.disabled = false;
    }
});

stateMachine.onStateChange((currentState, nextState) => {
    console.log('from', currentState, 'to', nextState);
});

let lastTimestamp = 0;

let capture = false;


// Initialize GeoJSON data
initializeGeoJSON();

utilButton.addEventListener('click', () => {
    // NOTE check track draw order
    const trackSegmentNumber = 1;
    const tVal = 0.5;
    const order = curveEngine.trackGraph.getTrackDrawDataOrder(
        trackSegmentNumber,
        tVal
    );
    const totalCount = curveEngine.trackGraph.getDrawData(
        res.camera.viewPortAABB()
    ).length;
    console.log('totalCount', totalCount);
    console.log('order', order);

    console.log('occupied joint numbers', train.occupiedJointNumbers);
    console.log('occupied track segments', train.occupiedTrackSegments);

    console.log('viewport aabb', res.camera.viewPortAABB());
});

const p1Button = document.getElementById('p1') as HTMLButtonElement;
const neutralButton = document.getElementById('neutral') as HTMLButtonElement;
const switchDirectionButton = document.getElementById(
    'switch-direction'
) as HTMLButtonElement;

p1Button.addEventListener('click', () => {
    // trainPlacementEngine.setTrainSpeed(-40);
    // trainPlacementEngine.setTrainAcceleration(40);
    train.setThrottleStep('p5');
});

neutralButton.addEventListener('click', () => {
    // trainPlacementEngine.setTrainSpeed(0);
    // trainPlacementEngine.setTrainAcceleration(0);
    train.setThrottleStep('N');
});

switchDirectionButton.addEventListener('click', () => {
    train.switchDirection();
});

// GeoJSON toggle buttons
const toggleDistrictsButton = document.getElementById(
    'toggle-districts'
) as HTMLButtonElement;
const toggleVillagesButton = document.getElementById(
    'toggle-villages'
) as HTMLButtonElement;

toggleDistrictsButton.addEventListener('click', () => {
    showDistricts = !showDistricts;
    toggleDistrictsButton.textContent = showDistricts
        ? 'Hide Districts'
        : 'Show Districts';
});

toggleVillagesButton.addEventListener('click', () => {
    showVillages = !showVillages;
    toggleVillagesButton.textContent = showVillages
        ? 'Hide Villages'
        : 'Show Villages';
});

// Initialize button text
toggleDistrictsButton.textContent = 'Hide Districts';
toggleVillagesButton.textContent = 'Hide Villages';

const captureButton = document.getElementById('capture') as HTMLButtonElement;

captureButton.addEventListener('click', () => {
    capture = true;
});

function colorForJoint(joint: NewJointType) {
    switch (joint.type) {
        case 'new':
            return 'purple';
        case 'contrained':
            return 'red';
        case 'branchJoint':
            return 'green';
        case 'extendingTrack':
            return 'blue';
        case 'branchCurve':
            return 'yellow';
    }
}

const getElevationColor = (elevation: ELEVATION): string => {
    switch (elevation) {
        case ELEVATION.SUB_3:
            return 'red';
        case ELEVATION.SUB_2:
            return 'orange';
        case ELEVATION.SUB_1:
            return 'yellow';
        case ELEVATION.GROUND:
            return 'green';
        case ELEVATION.ABOVE_1:
            return 'cyan';
        case ELEVATION.ABOVE_2:
            return 'magenta';
        case ELEVATION.ABOVE_3:
            return 'blue';
        default:
            return 'gray';
    }
};

function createGradient(
    context: CanvasRenderingContext2D,
    startElevation: ELEVATION,
    endElevation: ELEVATION,
    startPoint: Point,
    endPoint: Point
) {
    // Create linear gradient from start to end of the curve
    const startColor = getElevationColor(startElevation);
    const endColor = getElevationColor(endElevation);

    // Create gradient along the curve from start point to end point
    const gradient = context.createLinearGradient(
        startPoint.x,
        startPoint.y,
        endPoint.x,
        endPoint.y
    );

    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);

    return gradient;
}

function drawElevationCurves(
    drawData: TrackSegmentDrawData,
    context: CanvasRenderingContext2D
) {
    const cps = drawData.curve.getControlPoints();

    context.save();
    context.strokeStyle = createGradient(
        context,
        drawData.originalElevation.from,
        drawData.originalElevation.to,
        drawData.originalTrackSegment.startJointPosition,
        drawData.originalTrackSegment.endJointPosition
    );
    context.lineWidth = drawData.gauge;
    context.beginPath();
    context.moveTo(cps[0].x, cps[0].y);
    if (cps.length === 3) {
        context.quadraticCurveTo(cps[1].x, cps[1].y, cps[2].x, cps[2].y);
    } else {
        context.bezierCurveTo(
            cps[1].x,
            cps[1].y,
            cps[2].x,
            cps[2].y,
            cps[3].x,
            cps[3].y
        );
    }
    context.stroke();
    context.restore();
}

function elevationConnectToFlat(drawData: TrackSegmentDrawData) {
    return (
        drawData.elevation.from % LEVEL_HEIGHT === 0 ||
        drawData.elevation.to % LEVEL_HEIGHT === 0
    );
}
