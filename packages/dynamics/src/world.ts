import { RigidBody } from "./rigidbody";
import * as Collision from "./collision";
import { RectangleBound, QuadTree} from "./quadtree"
import { DynamicTree, SpatialIndex, SweepAndPrune } from "./dynamic-tree";
import { Point } from "@ue-too/math";
import { Constraint } from "./constraint";
import { PinJointConstraint } from "./constraint";
import { PairManager, PairEvents } from "./pair-manager";
import { canCollide } from "./collision-filter";

/**
 * Spatial indexing algorithm types.
 *
 * @remarks
 * Different algorithms have different performance characteristics:
 * - **quadtree**: Best for static or mostly-static worlds
 * - **dynamictree**: Good balance for mixed static/dynamic
 * - **sap**: Best for many dynamic bodies (sweep-and-prune)
 *
 * @category Core
 */
export type SpatialIndexType = 'quadtree' | 'dynamictree' | 'sap';

/**
 * Main physics world managing rigid body simulation.
 *
 * @remarks
 * The World class is the main entry point for physics simulation. It manages
 * all rigid bodies, runs collision detection and response, enforces constraints,
 * and provides performance optimizations like sleeping and spatial indexing.
 *
 * ### Simulation Loop
 *
 * Call `world.step(deltaTime)` each frame to advance the simulation. This:
 * 1. Updates sleeping states
 * 2. Detects collisions (broad and narrow phase)
 * 3. Resolves collisions with impulses
 * 4. Enforces constraints
 * 5. Updates body positions and velocities
 *
 * ### Performance Tuning
 *
 * - Choose appropriate spatial index for your use case
 * - Enable sleeping for better performance with many bodies
 * - Use collision filtering to reduce collision checks
 *
 * @example
 * Basic setup
 * ```typescript
 * const world = new World(2000, 2000, 'dynamictree');
 *
 * // Add bodies
 * const ball = new Circle({ x: 0, y: 100 }, 20, 0, 10, false);
 * world.addRigidBody('ball', ball);
 *
 * // Simulation loop
 * function update(dt: number) {
 *   world.step(dt);
 * }
 * ```
 *
 * @category Core
 */
export class World {
    private rigidBodyList: RigidBody[];
    private rigidBodyMap: Map<string, RigidBody>;
    private _resolveCollision: boolean;
    private maxTransWidth: number;
    private maxTransHeight: number;
    private bound: RectangleBound;
    private spatialIndex: SpatialIndex<RigidBody>;
    private spatialIndexType: SpatialIndexType;
    private constraints: Constraint[];
    private pinJoints: PinJointConstraint[] = [];
    private pairManager: PairManager;
    private enableSleeping: boolean = true;
    _context: CanvasRenderingContext2D | null = null;

    constructor(maxTransWidth: number, maxTransHeight: number, spatialIndexType: SpatialIndexType = 'dynamictree'){
        this.maxTransHeight = maxTransHeight;
        this.maxTransWidth = maxTransWidth;
        this.spatialIndexType = spatialIndexType;
        this.bound = new RectangleBound({x: -this.maxTransWidth, y: -this.maxTransHeight}, 2 * this.maxTransWidth, 2 * this.maxTransHeight);
        
        // Initialize spatial index based on type
        if (spatialIndexType === 'dynamictree') {
            this.spatialIndex = new DynamicTree<RigidBody>();
        } else if (spatialIndexType === 'sap') {
            this.spatialIndex = new SweepAndPrune<RigidBody>();
        } else {
            this.spatialIndex = new QuadTree(0, this.bound);
        }
        
        this.rigidBodyList = [];
        this.rigidBodyMap = new Map<string, RigidBody>();
        this._resolveCollision = true;
        this.constraints = [];
        this.pairManager = new PairManager();
    }

    addRigidBody(ident: string, body: RigidBody): void{
        this.rigidBodyList.push(body);
        this.rigidBodyMap.set(ident, body);
        
        // Add to spatial index immediately for sweep-and-prune
        if (this.spatialIndexType === 'sap') {
            this.spatialIndex.insert(body);
        }
    }

    removeRigidBody(ident: string): void{
        if (this.rigidBodyMap.has(ident)) {
            const body = this.rigidBodyMap.get(ident);
            this.rigidBodyMap.delete(ident);
            
            // Remove from spatial index for sweep-and-prune
            if (body && this.spatialIndexType === 'sap' && this.spatialIndex instanceof SweepAndPrune) {
                (this.spatialIndex as SweepAndPrune<RigidBody>).remove(body);
            }
            
            // Remove from rigidBodyList as well
            const index = this.rigidBodyList.findIndex(b => b === body);
            if (index !== -1) {
                this.rigidBodyList.splice(index, 1);
            }
        }
    }

    step(deltaTime: number): void{
        // Update sleeping states first
        if (this.enableSleeping) {
            this.getRigidBodyList().forEach(rigidBody => {
                rigidBody.updateSleeping(deltaTime);
            });
        }

        if(this._resolveCollision){
            const contactPoints = this.resolveCollisionPhase();
        }
        // if(this._context != null){
        //     this.spatialIndex.draw?.(this._context);
        //     contactPoints.forEach((contactPoint) => {
        //         if(this._context != null){
        //             this._context.lineWidth = 1;
        //             this._context.strokeStyle = "red";
        //         }
        //         this._context?.beginPath();
        //         this._context?.arc(contactPoint.x, contactPoint.y, 3, 0, 2 * Math.PI);
        //         this._context?.stroke();
        //     });
        // }
        this.constraints.forEach(constraint => constraint.enforce(deltaTime));
        this.getRigidBodyList().forEach(rigidBody => {
            if (!rigidBody.isSleeping) {
                rigidBody.step(deltaTime);
            }
        });
    }

    resolveCollisionPhase(): Point[]{
        let rigidBodyList: RigidBody[] = [];
        
        // Use incremental updates for sweep-and-prune, full rebuild for others
        if (this.spatialIndexType === 'sap') {
            // For sweep-and-prune: use incremental updates for better performance
            this.rigidBodyMap.forEach((body) => {
                if (!this.enableSleeping || !body.isSleeping) {
                    rigidBodyList.push(body);
                    // Update existing objects in spatial index
                    if (this.spatialIndex instanceof SweepAndPrune) {
                        (this.spatialIndex as SweepAndPrune<RigidBody>).update(body);
                    }
                }
            });
        } else {
            // For QuadTree and DynamicTree: rebuild each frame (existing behavior)
            this.spatialIndex.clear();
            this.rigidBodyMap.forEach((body) => {
                if (!this.enableSleeping || !body.isSleeping) {
                    rigidBodyList.push(body);
                    this.spatialIndex.insert(body);
                }
            });
        }
        
        // console.log("spatial index size: ", this.spatialIndex);
        let possibleCombinations = Collision.broadPhaseWithSpatialIndexFiltered(this.spatialIndex, rigidBodyList);
        let collisionResults = Collision.narrowPhaseWithRigidBodyAndPairs(rigidBodyList, possibleCombinations, this._resolveCollision);
        
        // Update pair manager with new collisions
        const pairEvents = this.pairManager.updatePairs(collisionResults.collisions);
        
        // Wake up bodies that start colliding
        if (this.enableSleeping) {
            pairEvents.created.forEach(pair => {
                if (pair.bodyA.isSleeping) pair.bodyA.setSleeping(false);
                if (pair.bodyB.isSleeping) pair.bodyB.setSleeping(false);
            });
        }
        
        return collisionResults.contactPoints;
    }

    get resolveCollision(): boolean{
        return this._resolveCollision;
    }

    set resolveCollision(resolveCollision: boolean){
        this._resolveCollision = resolveCollision;
    }

    getRigidBodyList(){
        let rigidBodyList:RigidBody[] = [];
        this.rigidBodyMap.forEach((body) => {
            rigidBodyList.push(body);
        })
        return rigidBodyList;
    }

    getRigidBodyMap(): Map<string, RigidBody>{
        return this.rigidBodyMap;
    }

    setMaxTransHeight(height: number){
        this.maxTransHeight = height;
    }

    setMaxTransWidth(width: number){
        this.maxTransWidth = width;
    }

    addConstraint(constraint: Constraint): void{
        this.constraints.push(constraint);
    }

    getConstraints(): Constraint[]{
        return this.constraints;
    }

    addPinJoint(bodyA: RigidBody, bodyB: RigidBody, anchorA: Point, anchorB: Point) {
        this.pinJoints.push({ bodyA, bodyB, anchorA, anchorB });
    }

    get currentSpatialIndexType(): SpatialIndexType {
        return this.spatialIndexType;
    }

    setSpatialIndexType(type: SpatialIndexType): void {
        if (type === this.spatialIndexType) return;
        
        this.spatialIndexType = type;
        if (type === 'dynamictree') {
            this.spatialIndex = new DynamicTree<RigidBody>();
        } else if (type === 'sap') {
            this.spatialIndex = new SweepAndPrune<RigidBody>();
        } else {
            this.spatialIndex = new QuadTree(0, this.bound);
        }
    }

    getSpatialIndexStats(): any {
        if (this.spatialIndex instanceof DynamicTree) {
            return (this.spatialIndex as DynamicTree<RigidBody>).getStats();
        } else if (this.spatialIndex instanceof SweepAndPrune) {
            return {
                type: this.spatialIndexType,
                ...(this.spatialIndex as SweepAndPrune<RigidBody>).getStats()
            };
        }
        return { type: this.spatialIndexType, objects: this.rigidBodyMap.size };
    }

    // Sleeping control
    get sleepingEnabled(): boolean {
        return this.enableSleeping;
    }

    set sleepingEnabled(enabled: boolean) {
        this.enableSleeping = enabled;
        if (!enabled) {
            // Wake up all sleeping bodies
            this.rigidBodyMap.forEach(body => {
                if (body.isSleeping) {
                    body.setSleeping(false);
                }
            });
        }
    }

    // Pair manager access
    getPairManager(): PairManager {
        return this.pairManager;
    }

    // Get collision statistics
    getCollisionStats() {
        return {
            ...this.pairManager.getStats(),
            sleepingBodies: Array.from(this.rigidBodyMap.values()).filter(body => body.isSleeping).length,
            totalBodies: this.rigidBodyMap.size
        };
    }
}
