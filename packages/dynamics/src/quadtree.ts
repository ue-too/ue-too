import { Point } from "@ue-too/math";
import { RigidBody } from "./rigidbody";

export class RectangleBound{
    private bottomLeft: Point;
    private width: number;
    private height: number;

    constructor(bottomLeft: Point, width: number, height: number){
        this.bottomLeft = bottomLeft;
        this.width = width;
        this.height = height;
    }

    getWidth(){
        return this.width;
    }

    getHeight(){
        return this.height;
    }

    getbottomLeft(){
        return this.bottomLeft;
    }
}


export class QuadTree {
    private MAX_OBJECTS = 10; // per node
    private MAX_LEVELS = 5;

    private level: number;
    private objects: RigidBody[] = [];
    private nodes: (QuadTree | undefined)[] = [];
    private bounds: RectangleBound;
    

    constructor(level: number, bounds: RectangleBound){
        this.level = level;
        this.objects = [];
        this.bounds = bounds;
        this.nodes = [undefined, undefined, undefined, undefined];
    }

    draw(context: CanvasRenderingContext2D){
        context.beginPath();
        context.rect(this.bounds.getbottomLeft().x, this.bounds.getbottomLeft().y, this.bounds.getWidth(), this.bounds.getHeight());
        context.stroke();
        // console.log("objects: ", this.objects.length, "level: ", this.level);
        for(let index = 0; index < this.nodes.length; index++){
            let node = this.nodes[index];
            if(node != undefined){
                node.draw(context);
            }
        }
    }

    clear(){
        this.objects = [];
        for(let index = 0; index < this.nodes.length; index++){
            let node = this.nodes[index];
            if(node != undefined){
                node.clear();
                node = undefined;
            }
        }
    }

    split(){
        // console.log("split");
        let subWidth = this.bounds.getWidth() / 2;
        let subHeight = this.bounds.getHeight() / 2;
        let bottomLeft = this.bounds.getbottomLeft();
        // bottom left is the first node and it goes clock wise 
        this.nodes[0] = new QuadTree(this.level + 1, new RectangleBound({x: bottomLeft.x, y: bottomLeft.y}, subWidth, subHeight));
        this.nodes[1] = new QuadTree(this.level + 1, new RectangleBound({x: bottomLeft.x, y: bottomLeft.y + subHeight}, subWidth, subHeight));
        this.nodes[2] = new QuadTree(this.level + 1, new RectangleBound({x: bottomLeft.x + subWidth, y: bottomLeft.y + subHeight}, subWidth, subHeight));
        this.nodes[3] = new QuadTree(this.level + 1, new RectangleBound({x: bottomLeft.x + subWidth, y: bottomLeft.y}, subWidth, subHeight));
    }

    getIndex(vBody: RigidBody){
        let midPoint = {x: this.bounds.getbottomLeft().x + this.bounds.getWidth() / 2, y: this.bounds.getbottomLeft().y + this.bounds.getHeight() / 2};
        let points = vBody.AABB;
        let bottom = points.max.y < midPoint.y && points.min.y > this.bounds.getbottomLeft().y;
        let left = points.max.x < midPoint.x && points.min.x > this.bounds.getbottomLeft().x;
        let right = points.max.x > midPoint.x && points.min.x > midPoint.x;
        let top = points.max.y > midPoint.y && points.min.y > midPoint.y;
        // console.log("level", this.level);
        if (bottom && left){
            return 0;
        } else if (bottom && right){
            return 3;
        } else if (top && left){
            return 1;
        } else if (top && right){
            return 2;
        }
        return -1;
    }

    insert(vBody: RigidBody){
        let node = this.nodes[0];
        if (node != undefined){
            let index = this.getIndex(vBody);

            if (index !== -1){
                node = this.nodes[index];
                node?.insert(vBody);
                return;
            }
        }

        this.objects.push(vBody);
        if(this.objects.length > this.MAX_OBJECTS && this.level < this.MAX_LEVELS){
            if (this.nodes[0] == null || this.nodes[0] == undefined){
                this.split();
            }
            let i = 0;
            while (i < this.objects.length){
                let index = this.getIndex(this.objects[i]);
                let node = this.nodes[index];
                if (index != -1 && node !== undefined){
                    let vBody = this.objects[i];
                    this.objects.splice(i, 1);
                    node.insert(vBody);
                } else{
                    i++;
                }
            }
        }
    }

    retrieve(vBody: RigidBody): RigidBody[]{
        let index = this.getIndex(vBody);
        let res = [];
        let node = this.nodes[index];
        if(index !== -1 && node !== undefined){
            res.push(...node.retrieve(vBody));
        }
        res.push(...this.objects);
        return res;
    }

}
