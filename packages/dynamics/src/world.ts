import { RigidBody } from "./rigidbody";
import * as Collision from "./collision";
import { RectangleBound, QuadTree} from "./quadtree"
import { DynamicTree, SpatialIndex } from "./dynamic-tree";
import { Point } from "@ue-too/math";
import { Constraint } from "./constraint";
import { PinJointConstraint } from "./constraint";

export type SpatialIndexType = 'quadtree' | 'dynamictree';

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
    _context: CanvasRenderingContext2D | null = null;

    constructor(maxTransWidth: number, maxTransHeight: number, spatialIndexType: SpatialIndexType = 'dynamictree'){
        this.maxTransHeight = maxTransHeight;
        this.maxTransWidth = maxTransWidth;
        this.spatialIndexType = spatialIndexType;
        this.bound = new RectangleBound({x: -this.maxTransWidth, y: -this.maxTransHeight}, 2 * this.maxTransWidth, 2 * this.maxTransHeight);
        
        // Initialize spatial index based on type
        if (spatialIndexType === 'dynamictree') {
            this.spatialIndex = new DynamicTree<RigidBody>();
        } else {
            this.spatialIndex = new QuadTree(0, this.bound);
        }
        
        this.rigidBodyList = [];
        this.rigidBodyMap = new Map<string, RigidBody>();
        this._resolveCollision = true;
        this.constraints = [];
    }

    addRigidBody(ident: string, body: RigidBody): void{
        this.rigidBodyList.push(body);
        this.rigidBodyMap.set(ident, body);
    }

    removeRigidBody(ident: string): void{
        if (this.rigidBodyMap.has(ident)) {
            this.rigidBodyMap.delete(ident);
        }
    }

    step(deltaTime: number): void{
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
            rigidBody.step(deltaTime);
        });
    }

    resolveCollisionPhase(): Point[]{
        let rigidBodyList: RigidBody[] = [];
        this.spatialIndex.clear();
        this.rigidBodyMap.forEach((body) => {
            rigidBodyList.push(body);
            this.spatialIndex.insert(body);
        });
        // console.log("spatial index size: ", this.spatialIndex);
        let possibleCombinations = Collision.broadPhaseWithSpatialIndex(this.spatialIndex, rigidBodyList);
        let contactPoints = Collision.narrowPhaseWithRigidBody(rigidBodyList, possibleCombinations, this._resolveCollision);
        return contactPoints;
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
        } else {
            this.spatialIndex = new QuadTree(0, this.bound);
        }
    }

    getSpatialIndexStats(): any {
        if (this.spatialIndex instanceof DynamicTree) {
            return (this.spatialIndex as DynamicTree<RigidBody>).getStats();
        }
        return { type: 'quadtree', objects: this.rigidBodyMap.size };
    }
}
