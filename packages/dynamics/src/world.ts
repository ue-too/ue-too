import { RigidBody } from "./rigidbody";
import * as Collision from "./collision";
import { RectangleBound, QuadTree} from "./quadtree"
import { Point } from "@ue-too/math";
import { Constraint } from "./constraint";
import { PinJointConstraint } from "./constraint";

export class World {
    private rigidBodyList: RigidBody[];
    private rigidBodyMap: Map<string, RigidBody>;
    private _resolveCollision: boolean;
    private maxTransWidth: number;
    private maxTransHeight: number;
    private bound: RectangleBound;
    private quadTree: QuadTree<RigidBody>;
    private constraints: Constraint[];
    private pinJoints: PinJointConstraint[] = [];
    _context: CanvasRenderingContext2D | null = null;

    constructor(maxTransWidth: number, maxTransHeight: number){
        this.maxTransHeight = maxTransHeight;
        this.maxTransWidth = maxTransWidth;
        this.bound = new RectangleBound({x: -this.maxTransWidth, y: -this.maxTransHeight}, 2 * this.maxTransWidth, 2 * this.maxTransHeight);
        this.quadTree = new QuadTree(0, this.bound);
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
        //     this.quadTree.draw(this._context);
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
        this.quadTree.clear();
        this.rigidBodyMap.forEach((body) => {
            rigidBodyList.push(body);
            this.quadTree.insert(body);
        });
        // console.log("quadtree size: ", this.quadTree);
        let possibleCombinations = Collision.broadPhaseWithRigidBodyReturned(this.quadTree, rigidBodyList);
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
}
