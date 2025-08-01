import { World, SpatialIndexType, VisaulCircleBody, VisualPolygonBody, CollisionCategory } from "@ue-too/dynamics";
import { Point } from "@ue-too/math";

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const statsElement = document.getElementById('stats')!;

// Create world with SAP collision detection
let world = new World(canvas.width / 2, canvas.height / 2, 'sap');
let spatialIndexTypes: SpatialIndexType[] = ['sap', 'dynamictree', 'quadtree'];
let currentSpatialIndex = 0;

// Performance tracking
let frameCount = 0;
let lastTime = performance.now();
let fps = 0;

// Colors for different collision categories
const categoryColors = {
    [CollisionCategory.STATIC]: '#8B4513',    // Brown for static objects
    [CollisionCategory.DYNAMIC]: '#4169E1',   // Royal Blue for dynamic objects
    [CollisionCategory.PLAYER]: '#32CD32',    // Lime Green for player
    [CollisionCategory.ENEMY]: '#DC143C',     // Crimson for enemies
    [CollisionCategory.PROJECTILE]: '#FFD700', // Gold for projectiles
    [CollisionCategory.SENSOR]: '#9370DB',    // Medium Purple for sensors
    [CollisionCategory.PICKUP]: '#FF69B4',    // Hot Pink for pickups
    [CollisionCategory.PLATFORM]: '#A0A0A0'   // Gray for platforms
};

function initializeWorld() {
    world = new World(canvas.width / 2, canvas.height / 2, spatialIndexTypes[currentSpatialIndex]);
    
    // Create static walls (boundaries)
    createWalls();
    
    // Create different types of bodies with collision filtering
    createPlayerBody();
    createEnemyBodies();
    createPickupItems();
    createProjectiles();
    createSensorZones();
    createPlatforms();
}

function createWalls() {
    const wallThickness = 20;
    
    // Bottom wall
    const bottomWall = new VisualPolygonBody(
        { x: canvas.width / 2, y: canvas.height - wallThickness / 2 },
        [
            { x: -canvas.width / 2, y: -wallThickness / 2 },
            { x: canvas.width / 2, y: -wallThickness / 2 },
            { x: canvas.width / 2, y: wallThickness / 2 },
            { x: -canvas.width / 2, y: wallThickness / 2 }
        ],
        ctx, 0, 1000, true
    );
    bottomWall.collisionFilter.category = CollisionCategory.STATIC;
    world.addRigidBody('bottomWall', bottomWall);
    
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

function createPlayerBody() {
    const player = new VisaulCircleBody(
        { x: 100, y: 100 },
        25,
        ctx,
        0,
        50,
        false
    );
    player.collisionFilter.category = CollisionCategory.PLAYER;
    player.collisionFilter.mask = CollisionCategory.STATIC | CollisionCategory.ENEMY | CollisionCategory.PICKUP | CollisionCategory.SENSOR;
    world.addRigidBody('player', player);
}

function createEnemyBodies() {
    for (let i = 0; i < 5; i++) {
        const enemy = new VisaulCircleBody(
            { x: 200 + i * 80, y: 150 + Math.random() * 100 },
            20,
            ctx,
            0,
            40,
            false
        );
        enemy.collisionFilter.category = CollisionCategory.ENEMY;
        enemy.collisionFilter.mask = CollisionCategory.STATIC | CollisionCategory.PLAYER | CollisionCategory.PROJECTILE;
        
        // Add some initial velocity
        enemy.linearVelocity = { x: (Math.random() - 0.5) * 100, y: (Math.random() - 0.5) * 100 };
        
        world.addRigidBody(`enemy_${i}`, enemy);
    }
}

function createPickupItems() {
    for (let i = 0; i < 8; i++) {
        const pickup = new VisaulCircleBody(
            { x: 150 + i * 60, y: 400 + Math.random() * 50 },
            10,
            ctx,
            0,
            10,
            false
        );
        pickup.collisionFilter.category = CollisionCategory.PICKUP;
        pickup.collisionFilter.mask = CollisionCategory.PLAYER;
        world.addRigidBody(`pickup_${i}`, pickup);
    }
}

function createProjectiles() {
    for (let i = 0; i < 3; i++) {
        const projectile = new VisaulCircleBody(
            { x: 50, y: 200 + i * 50 },
            5,
            ctx,
            0,
            5,
            false
        );
        projectile.collisionFilter.category = CollisionCategory.PROJECTILE;
        projectile.collisionFilter.mask = CollisionCategory.STATIC | CollisionCategory.ENEMY;
        
        // Fast moving projectiles
        projectile.linearVelocity = { x: 200 + Math.random() * 100, y: (Math.random() - 0.5) * 50 };
        
        world.addRigidBody(`projectile_${i}`, projectile);
    }
}

function createSensorZones() {
    // Create invisible sensor zones
    const sensor = new VisaulCircleBody(
        { x: 400, y: 300 },
        60,
        ctx,
        0,
        1,
        false
    );
    sensor.collisionFilter.category = CollisionCategory.SENSOR;
    sensor.collisionFilter.mask = CollisionCategory.PLAYER | CollisionCategory.ENEMY;
    world.addRigidBody('sensor', sensor);
}

function createPlatforms() {
    // One-way platforms
    for (let i = 0; i < 3; i++) {
        const platform = new VisualPolygonBody(
            { x: 200 + i * 200, y: 350 },
            [
                { x: -50, y: -10 },
                { x: 50, y: -10 },
                { x: 50, y: 10 },
                { x: -50, y: 10 }
            ],
            ctx, 0, 100, true
        );
        platform.collisionFilter.category = CollisionCategory.PLATFORM;
        world.addRigidBody(`platform_${i}`, platform);
    }
}

function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all bodies with category-specific colors
    world.getRigidBodyList().forEach(body => {
        const color = getCategoryColor(body.collisionFilter.category);
        
        ctx.save();
        
        // Dim sleeping bodies
        if (body.isSleeping) {
            ctx.globalAlpha = 0.5;
        }
        
        ctx.strokeStyle = color;
        ctx.fillStyle = color + '20'; // Semi-transparent fill
        ctx.lineWidth = 2;
        
        if (body instanceof VisaulCircleBody) {
            ctx.beginPath();
            ctx.arc(body.center.x, body.center.y, 25, 0, 2 * Math.PI); // Assuming radius 25 for visual
            ctx.stroke();
            ctx.fill();
        } else if (body instanceof VisualPolygonBody) {
            // Draw polygon (simplified)
            ctx.beginPath();
            ctx.rect(body.center.x - 50, body.center.y - 10, 100, 20); // Simplified rectangle
            ctx.stroke();
            ctx.fill();
        }
        
        // Draw sleeping indicator
        if (body.isSleeping) {
            ctx.fillStyle = '#FFFF00';
            ctx.font = '12px Arial';
            ctx.fillText('💤', body.center.x + 20, body.center.y - 20);
        }
        
        ctx.restore();
    });
    
    // Draw collision pairs (active collisions)
    const pairManager = world.getPairManager();
    const activePairs = pairManager.getActivePairs();
    
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    activePairs.forEach(pair => {
        ctx.beginPath();
        ctx.moveTo(pair.bodyA.center.x, pair.bodyA.center.y);
        ctx.lineTo(pair.bodyB.center.x, pair.bodyB.center.y);
        ctx.stroke();
    });
}

function getCategoryColor(category: number): string {
    return categoryColors[category] || '#FFFFFF';
}

function updateStats() {
    const currentTime = performance.now();
    frameCount++;
    
    if (currentTime - lastTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        frameCount = 0;
        lastTime = currentTime;
    }
    
    const collisionStats = world.getCollisionStats();
    const spatialStats = world.getSpatialIndexStats();
    
    statsElement.innerHTML = `
        <div>FPS: ${fps}</div>
        <div>Spatial Index: ${world.currentSpatialIndexType.toUpperCase()}</div>
        <div>Total Bodies: ${collisionStats.totalBodies}</div>
        <div>Sleeping Bodies: ${collisionStats.sleepingBodies}</div>
        <div>Active Pairs: ${collisionStats.activePairs}</div>
        <div>Total Pairs: ${collisionStats.totalPairs}</div>
        <div>Frame Number: ${collisionStats.frameNumber}</div>
        <div>Sleeping Enabled: ${world.sleepingEnabled ? 'Yes' : 'No'}</div>
    `;
}

function gameLoop() {
    world.step(1/60); // 60 FPS target
    render();
    updateStats();
    requestAnimationFrame(gameLoop);
}

// Global functions for buttons
(window as any).toggleSpatialIndex = () => {
    currentSpatialIndex = (currentSpatialIndex + 1) % spatialIndexTypes.length;
    const newType = spatialIndexTypes[currentSpatialIndex];
    world.setSpatialIndexType(newType);
    
    const button = document.querySelector('button') as HTMLButtonElement;
    button.textContent = `Toggle Spatial Index (Current: ${newType.toUpperCase()})`;
};

(window as any).toggleSleeping = () => {
    world.sleepingEnabled = !world.sleepingEnabled;
    const buttons = document.querySelectorAll('button');
    buttons[1].textContent = `Toggle Sleeping (${world.sleepingEnabled ? 'Enabled' : 'Disabled'})`;
};

(window as any).addRandomBodies = () => {
    for (let i = 0; i < 5; i++) {
        const body = new VisaulCircleBody(
            { 
                x: Math.random() * (canvas.width - 100) + 50, 
                y: Math.random() * (canvas.height - 100) + 50 
            },
            15 + Math.random() * 15,
            ctx,
            0,
            30 + Math.random() * 20,
            false
        );
        body.collisionFilter.category = CollisionCategory.DYNAMIC;
        body.linearVelocity = { 
            x: (Math.random() - 0.5) * 200, 
            y: (Math.random() - 0.5) * 200 
        };
        world.addRigidBody(`random_${Date.now()}_${i}`, body);
    }
};

(window as any).resetWorld = () => {
    initializeWorld();
};

// Initialize and start
initializeWorld();
gameLoop();