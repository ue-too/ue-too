import { World, SpatialIndexType, VisaulCircleBody, VisualPolygonBody, CollisionCategory } from "@ue-too/dynamics";
import { Point } from "@ue-too/math";

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const statsElement = document.getElementById('stats')!;

// World setup with SAP (like Matter.js)
let world = new World(canvas.width / 2, canvas.height / 2, 'sap');
let spatialIndexTypes: SpatialIndexType[] = ['sap', 'dynamictree', 'quadtree'];
let currentSpatialIndex = 0;

// Performance tracking
let frameCount = 0;
let lastTime = performance.now();
let fps = 0;
let frameTime = 0;
let bodyCount = 0;

// Performance history for averaging
let fpsHistory: number[] = [];
let frameTimeHistory: number[] = [];

function initializeWorld() {
    world = new World(canvas.width / 2, canvas.height / 2, spatialIndexTypes[currentSpatialIndex]);
    bodyCount = 0;
    
    // Create walls (ground and sides)
    createWalls();
}

function createWalls() {
    const wallThickness = 20;
    
    // Ground
    const ground = new VisualPolygonBody(
        { x: canvas.width / 2, y: canvas.height - wallThickness / 2 },
        [
            { x: -canvas.width / 2, y: -wallThickness / 2 },
            { x: canvas.width / 2, y: -wallThickness / 2 },
            { x: canvas.width / 2, y: wallThickness / 2 },
            { x: -canvas.width / 2, y: wallThickness / 2 }
        ],
        ctx, 0, 1000, true
    );
    ground.collisionFilter.category = CollisionCategory.STATIC;
    world.addRigidBody('ground', ground);
    
    // Left wall
    const leftWall = new VisualPolygonBody(
        { x: wallThickness / 2, y: canvas.height / 2 },
        [
            { x: -wallThickness / 2, y: -canvas.height / 2 },
            { x: wallThickness / 2, y: -canvas.height / 2 },
            { x: wallThickness / 2, y: canvas.height / 2 },
            { x: -wallThickness / 2, y: canvas.height / 2 }
        ],
        ctx, 0, 1000, true
    );
    leftWall.collisionFilter.category = CollisionCategory.STATIC;
    world.addRigidBody('leftWall', leftWall);
    
    // Right wall
    const rightWall = new VisualPolygonBody(
        { x: canvas.width - wallThickness / 2, y: canvas.height / 2 },
        [
            { x: -wallThickness / 2, y: -canvas.height / 2 },
            { x: wallThickness / 2, y: -canvas.height / 2 },
            { x: wallThickness / 2, y: canvas.height / 2 },
            { x: -wallThickness / 2, y: canvas.height / 2 }
        ],
        ctx, 0, 1000, true
    );
    rightWall.collisionFilter.category = CollisionCategory.STATIC;
    world.addRigidBody('rightWall', rightWall);
}

function addBodies(count: number) {
    const spawnWidth = canvas.width * 0.8;
    const spawnHeight = 200;
    const spawnStartY = 50;
    
    for (let i = 0; i < count; i++) {
        const isCircle = Math.random() > 0.5;
        const x = Math.random() * spawnWidth + (canvas.width - spawnWidth) / 2;
        const y = Math.random() * spawnHeight + spawnStartY;
        
        if (isCircle) {
            const radius = 5 + Math.random() * 10;
            const body = new VisaulCircleBody(
                { x, y },
                radius,
                ctx,
                0,
                20 + Math.random() * 30,
                false
            );
            body.collisionFilter.category = CollisionCategory.DYNAMIC;
            
            // Add some initial velocity for more interesting motion
            body.linearVelocity = { 
                x: (Math.random() - 0.5) * 100, 
                y: Math.random() * 50 
            };
            
            world.addRigidBody(`circle_${bodyCount++}`, body);
        } else {
            const width = 8 + Math.random() * 16;
            const height = 8 + Math.random() * 16;
            const body = new VisualPolygonBody(
                { x, y },
                [
                    { x: -width/2, y: -height/2 },
                    { x: width/2, y: -height/2 },
                    { x: width/2, y: height/2 },
                    { x: -width/2, y: height/2 }
                ],
                ctx,
                Math.random() * Math.PI * 2,
                25 + Math.random() * 25,
                false
            );
            body.collisionFilter.category = CollisionCategory.DYNAMIC;
            
            // Add initial velocity
            body.linearVelocity = { 
                x: (Math.random() - 0.5) * 100, 
                y: Math.random() * 50 
            };
            
            world.addRigidBody(`box_${bodyCount++}`, body);
        }
    }
}

function shake() {
    // Wake up all sleeping bodies with a shake
    world.getRigidBodyList().forEach(body => {
        if (!body.isStatic()) {
            body.setSleeping(false);
            body.linearVelocity = {
                x: (Math.random() - 0.5) * 200,
                y: -Math.random() * 100 - 50
            };
            body.angularVelocity = (Math.random() - 0.5) * 10;
        }
    });
}

function render() {
    const frameStart = performance.now();
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all bodies
    world.getRigidBodyList().forEach(body => {
        ctx.save();
        
        // Color based on state
        if (body.isStatic()) {
            ctx.strokeStyle = '#666';
            ctx.fillStyle = '#333';
        } else if (body.isSleeping) {
            ctx.strokeStyle = '#4CAF50';
            ctx.fillStyle = '#4CAF5020';
            ctx.globalAlpha = 0.7;
        } else {
            ctx.strokeStyle = '#2196F3';
            ctx.fillStyle = '#2196F320';
        }
        
        ctx.lineWidth = 1;
        
        // Draw based on body type
        if (body instanceof VisaulCircleBody) {
            ctx.beginPath();
            ctx.arc(body.center.x, body.center.y, 10, 0, 2 * Math.PI); // Approximate radius
            ctx.stroke();
            ctx.fill();
            
            // Draw orientation line for circles
            if (!body.isSleeping) {
                ctx.beginPath();
                ctx.moveTo(body.center.x, body.center.y);
                ctx.lineTo(
                    body.center.x + Math.cos(body.orientationAngle) * 8,
                    body.center.y + Math.sin(body.orientationAngle) * 8
                );
                ctx.stroke();
            }
        } else if (body instanceof VisualPolygonBody) {
            // Simplified box rendering
            ctx.save();
            ctx.translate(body.center.x, body.center.y);
            ctx.rotate(body.orientationAngle);
            ctx.beginPath();
            ctx.rect(-8, -8, 16, 16); // Approximate size
            ctx.stroke();
            ctx.fill();
            ctx.restore();
        }
        
        // Draw sleeping indicator
        if (body.isSleeping && !body.isStatic()) {
            ctx.fillStyle = '#4CAF50';
            ctx.font = '8px Arial';
            ctx.fillText('💤', body.center.x + 12, body.center.y - 12);
        }
        
        ctx.restore();
    });
    
    frameTime = performance.now() - frameStart;
}

function updateStats() {
    const currentTime = performance.now();
    frameCount++;
    
    if (currentTime - lastTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        frameCount = 0;
        lastTime = currentTime;
        
        // Update history for averaging
        fpsHistory.push(fps);
        frameTimeHistory.push(frameTime);
        if (fpsHistory.length > 10) {
            fpsHistory.shift();
            frameTimeHistory.shift();
        }
    }
    
    const collisionStats = world.getCollisionStats();
    const spatialStats = world.getSpatialIndexStats();
    
    const avgFps = Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length) || fps;
    const avgFrameTime = Math.round((frameTimeHistory.reduce((a, b) => a + b, 0) / frameTimeHistory.length) * 100) / 100 || frameTime;
    
    // Performance classification
    const fpsClass = avgFps >= 55 ? 'perf-good' : avgFps >= 30 ? 'perf-ok' : 'perf-bad';
    const frameTimeClass = avgFrameTime <= 16.67 ? 'perf-good' : avgFrameTime <= 33.33 ? 'perf-ok' : 'perf-bad';
    
    statsElement.innerHTML = `
        <div>
            <h3>Performance</h3>
            <div>FPS: <span class="${fpsClass}">${avgFps}</span></div>
            <div>Frame Time: <span class="${frameTimeClass}">${avgFrameTime.toFixed(2)}ms</span></div>
            <div>Target: <span class="perf-good">60 FPS (16.67ms)</span></div>
        </div>
        <div>
            <h3>Physics Engine</h3>
            <div>Spatial Index: <strong>${world.currentSpatialIndexType.toUpperCase()}</strong></div>
            <div>Total Bodies: <strong>${collisionStats.totalBodies}</strong></div>
            <div>Sleeping Bodies: <span class="perf-good">${collisionStats.sleepingBodies}</span></div>
            <div>Active Bodies: <strong>${collisionStats.totalBodies - collisionStats.sleepingBodies}</strong></div>
            <div>Sleeping Enabled: ${world.sleepingEnabled ? '<span class="perf-good">Yes</span>' : '<span class="perf-bad">No</span>'}</div>
        </div>
        <div>
            <h3>Collision Detection</h3>
            <div>Active Pairs: <strong>${collisionStats.activePairs}</strong></div>
            <div>Total Pairs: ${collisionStats.totalPairs}</div>
            <div>Frame: #${collisionStats.frameNumber}</div>
            <div>Efficiency: <span class="perf-good">${collisionStats.sleepingBodies > 0 ? Math.round((collisionStats.sleepingBodies / collisionStats.totalBodies) * 100) : 0}% sleeping</span></div>
        </div>
    `;
}

function gameLoop() {
    world.step(1/60); // 60 FPS target
    render();
    updateStats();
    requestAnimationFrame(gameLoop);
}

// Global functions for buttons
(window as any).addBodies = (count: number) => {
    addBodies(count);
};

(window as any).shake = () => {
    shake();
};

(window as any).toggleSpatialIndex = () => {
    currentSpatialIndex = (currentSpatialIndex + 1) % spatialIndexTypes.length;
    const newType = spatialIndexTypes[currentSpatialIndex];
    world.setSpatialIndexType(newType);
    
    const buttons = document.querySelectorAll('button');
    buttons[4].textContent = `Toggle Spatial Index (${newType.toUpperCase()})`;
};

(window as any).toggleSleeping = () => {
    world.sleepingEnabled = !world.sleepingEnabled;
    const buttons = document.querySelectorAll('button');
    buttons[5].textContent = `Toggle Sleeping (${world.sleepingEnabled ? 'Enabled' : 'Disabled'})`;
};

(window as any).resetWorld = () => {
    initializeWorld();
};

// Initialize with some bodies to start
initializeWorld();
addBodies(100); // Start with 100 bodies
gameLoop();