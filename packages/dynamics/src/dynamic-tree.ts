import { Point } from "@ue-too/math";

/**
 * Object that can be indexed spatially via AABB.
 * @category Types
 */
export interface SpatialIndexObject {
    AABB: { min: Point, max: Point };
}

/**
 * Interface for spatial indexing data structures.
 * @category Types
 */
export interface SpatialIndex<T extends SpatialIndexObject> {
    clear(): void;
    insert(object: T): void;
    retrieve(object: T): T[];
    draw?(context: CanvasRenderingContext2D): void;
}

interface AABB {
    min: Point;
    max: Point;
}

class TreeNode<T extends SpatialIndexObject> {
    public parent: TreeNode<T> | null = null;
    public children: [TreeNode<T> | null, TreeNode<T> | null] = [null, null];
    public aabb: AABB = { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
    public object: T | null = null;
    public height: number = 0;

    constructor(object?: T) {
        if (object) {
            this.setLeaf(object);
        }
    }

    isLeaf(): boolean {
        return this.children[0] === null;
    }

    setLeaf(object: T): void {
        this.object = object;
        this.updateAABB();
        this.children = [null, null];
        this.height = 0;
    }

    setBranch(child1: TreeNode<T>, child2: TreeNode<T>): void {
        child1.parent = this;
        child2.parent = this;
        this.children = [child1, child2];
        this.object = null;
        this.updateAABB();
        this.height = 1 + Math.max(child1.height, child2.height);
    }

    updateAABB(margin: number = 0.1): void {
        if (this.isLeaf() && this.object) {
            // Create "fat" AABB with margin for dynamic objects
            const obj = this.object.AABB;
            this.aabb = {
                min: { x: obj.min.x - margin, y: obj.min.y - margin },
                max: { x: obj.max.x + margin, y: obj.max.y + margin }
            };
        } else if (this.children[0] && this.children[1]) {
            // Union of children AABBs
            const aabb1 = this.children[0].aabb;
            const aabb2 = this.children[1].aabb;
            this.aabb = {
                min: {
                    x: Math.min(aabb1.min.x, aabb2.min.x),
                    y: Math.min(aabb1.min.y, aabb2.min.y)
                },
                max: {
                    x: Math.max(aabb1.max.x, aabb2.max.x),
                    y: Math.max(aabb1.max.y, aabb2.max.y)
                }
            };
        }
    }

    getSibling(): TreeNode<T> | null {
        if (!this.parent) return null;
        return this.parent.children[0] === this ? this.parent.children[1] : this.parent.children[0];
    }

    getBalance(): number {
        if (this.isLeaf()) return 0;
        const leftHeight = this.children[0] ? this.children[0].height : 0;
        const rightHeight = this.children[1] ? this.children[1].height : 0;
        return leftHeight - rightHeight;
    }
}

// Endpoint for Sweep and Prune algorithm
interface Endpoint<T> {
    value: number;
    isMin: boolean;
    object: T;
    id: number;
}

/**
 * Sweep and Prune (SAP) spatial indexing algorithm.
 * @category Spatial Indexing
 */
export class SweepAndPrune<T extends SpatialIndexObject> implements SpatialIndex<T> {
    private xEndpoints: Endpoint<T>[] = [];
    private objects: Map<T, { minEndpoint: Endpoint<T>, maxEndpoint: Endpoint<T> }> = new Map();
    private nextId: number = 0;

    clear(): void {
        this.xEndpoints = [];
        this.objects.clear();
        this.nextId = 0;
    }

    insert(object: T): void {
        const id = this.nextId++;
        
        const minEndpoint: Endpoint<T> = { value: object.AABB.min.x, isMin: true, object, id };
        const maxEndpoint: Endpoint<T> = { value: object.AABB.max.x, isMin: false, object, id };
        
        this.objects.set(object, { minEndpoint, maxEndpoint });

        // Use binary search + splice for O(n) insertion instead of O(n log n) sort
        this.insertEndpointSorted(minEndpoint);
        this.insertEndpointSorted(maxEndpoint);
    }

    update(object: T): void {
        const endpoints = this.objects.get(object);
        if (!endpoints) return;

        const newMinX = object.AABB.min.x;
        const newMaxX = object.AABB.max.x;

        // Update endpoint values and maintain sorted order
        if (endpoints.minEndpoint.value !== newMinX) {
            this.removeEndpoint(endpoints.minEndpoint);
            endpoints.minEndpoint.value = newMinX;
            this.insertEndpointSorted(endpoints.minEndpoint);
        }

        if (endpoints.maxEndpoint.value !== newMaxX) {
            this.removeEndpoint(endpoints.maxEndpoint);
            endpoints.maxEndpoint.value = newMaxX;
            this.insertEndpointSorted(endpoints.maxEndpoint);
        }
    }

    remove(object: T): void {
        const endpoints = this.objects.get(object);
        if (!endpoints) return;

        this.removeEndpoint(endpoints.minEndpoint);
        this.removeEndpoint(endpoints.maxEndpoint);
        this.objects.delete(object);
    }

    retrieve(queryObject: T): T[] {
        const result: T[] = [];
        const queryMin = queryObject.AABB.min.x;
        const queryMax = queryObject.AABB.max.x;

        // Find all objects that overlap on x-axis using sweep line
        for (const endpoint of this.xEndpoints) {
            if (endpoint.value > queryMax) break;
            
            if (endpoint.isMin && endpoint.object !== queryObject) {
                // Object starts - check if it overlaps with query on x-axis
                const objMax = this.objects.get(endpoint.object)?.maxEndpoint.value;
                if (objMax !== undefined && objMax >= queryMin) {
                    // Check y-axis overlap
                    if (this.aabbIntersects(endpoint.object.AABB, queryObject.AABB)) {
                        result.push(endpoint.object);
                    }
                }
            }
        }

        return result;
    }

    // Efficient method to find all collision pairs - the main strength of sweep-and-prune
    findAllOverlaps(): Array<{a: T, b: T}> {
        const pairs: Array<{a: T, b: T}> = [];
        const activeObjects = new Set<T>();
        
        for (const endpoint of this.xEndpoints) {
            if (endpoint.isMin) {
                // Check against all currently active objects
                for (const activeObj of activeObjects) {
                    if (this.aabbIntersects(endpoint.object.AABB, activeObj.AABB)) {
                        pairs.push({a: endpoint.object, b: activeObj});
                    }
                }
                activeObjects.add(endpoint.object);
            } else {
                activeObjects.delete(endpoint.object);
            }
        }
        return pairs;
    }

    private insertEndpointSorted(endpoint: Endpoint<T>): void {
        // Binary search for insertion position
        let left = 0;
        let right = this.xEndpoints.length;
        
        while (left < right) {
            const mid = Math.floor((left + right) / 2);
            const midEndpoint = this.xEndpoints[mid];
            
            if (midEndpoint.value < endpoint.value || 
                (midEndpoint.value === endpoint.value && midEndpoint.isMin && !endpoint.isMin)) {
                left = mid + 1;
            } else {
                right = mid;
            }
        }
        
        this.xEndpoints.splice(left, 0, endpoint);
    }

    private removeEndpoint(endpoint: Endpoint<T>): void {
        const index = this.xEndpoints.indexOf(endpoint);
        if (index !== -1) {
            this.xEndpoints.splice(index, 1);
        }
    }

    private aabbIntersects(aabb1: { min: Point, max: Point }, aabb2: { min: Point, max: Point }): boolean {
        return !(aabb1.max.x < aabb2.min.x || 
                 aabb1.min.x > aabb2.max.x || 
                 aabb1.max.y < aabb2.min.y || 
                 aabb1.min.y > aabb2.max.y);
    }

    // Enhanced visualization showing active sweep line and overlaps
    draw?(context: CanvasRenderingContext2D): void {
        context.strokeStyle = 'orange';
        context.lineWidth = 1;
        context.globalAlpha = 0.3;
        
        // Draw vertical lines at object boundaries
        for (const endpoint of this.xEndpoints) {
            context.beginPath();
            context.moveTo(endpoint.value, -1000);
            context.lineTo(endpoint.value, 1000);
            context.stroke();
            
            // Label min/max endpoints
            context.fillStyle = endpoint.isMin ? 'green' : 'red';
            context.fillText(endpoint.isMin ? 'min' : 'max', endpoint.value, -950);
        }
        
        context.globalAlpha = 1.0;
    }

    // Get statistics for performance monitoring
    getStats(): { endpointCount: number, objectCount: number } {
        return {
            endpointCount: this.xEndpoints.length,
            objectCount: this.objects.size
        };
    }
}

/**
 * Dynamic AABB tree for efficient spatial queries.
 * @category Spatial Indexing
 */
export class DynamicTree<T extends SpatialIndexObject> implements SpatialIndex<T> {
    private root: TreeNode<T> | null = null;
    private nodeCount: number = 0;
    private margin: number = 0.1; // Fat AABB margin

    clear(): void {
        this.root = null;
        this.nodeCount = 0;
    }

    insert(object: T): void {
        const node = new TreeNode(object);
        this.insertNode(node);
    }

    private insertNode(node: TreeNode<T>): void {
        this.nodeCount++;

        if (!this.root) {
            this.root = node;
            return;
        }

        // Find the best sibling for the new node
        let sibling = this.findBestSibling(node);
        
        // Create new parent
        const oldParent = sibling.parent;
        const newParent = new TreeNode<T>();
        newParent.parent = oldParent;
        newParent.setBranch(sibling, node);

        if (oldParent) {
            // Replace sibling with newParent in oldParent
            if (oldParent.children[0] === sibling) {
                oldParent.children[0] = newParent;
            } else {
                oldParent.children[1] = newParent;
            }
        } else {
            // sibling was root
            this.root = newParent;
        }

        // Walk back up the tree fixing heights and AABBs
        let ancestor = newParent.parent;
        while (ancestor) {
            ancestor.updateAABB(this.margin);
            ancestor.height = 1 + Math.max(
                ancestor.children[0] ? ancestor.children[0].height : 0,
                ancestor.children[1] ? ancestor.children[1].height : 0
            );

            // Balance the tree
            ancestor = this.balance(ancestor);
            ancestor = ancestor.parent;
        }
    }

    private findBestSibling(node: TreeNode<T>): TreeNode<T> {
        let current = this.root!;

        while (!current.isLeaf()) {
            const child1 = current.children[0]!;
            const child2 = current.children[1]!;

            const area = this.getArea(current.aabb);
            const combinedAABB = this.combineAABB(current.aabb, node.aabb);
            const combinedArea = this.getArea(combinedAABB);

            // Cost of creating new parent for this node and current
            const cost = 2.0 * combinedArea;

            // Minimum cost of pushing node further down the tree
            const inheritanceCost = 2.0 * (combinedArea - area);

            // Cost of descending into child1
            let cost1: number;
            const aabb1 = this.combineAABB(node.aabb, child1.aabb);
            if (child1.isLeaf()) {
                cost1 = this.getArea(aabb1) + inheritanceCost;
            } else {
                const oldArea = this.getArea(child1.aabb);
                const newArea = this.getArea(aabb1);
                cost1 = (newArea - oldArea) + inheritanceCost;
            }

            // Cost of descending into child2
            let cost2: number;
            const aabb2 = this.combineAABB(node.aabb, child2.aabb);
            if (child2.isLeaf()) {
                cost2 = this.getArea(aabb2) + inheritanceCost;
            } else {
                const oldArea = this.getArea(child2.aabb);
                const newArea = this.getArea(aabb2);
                cost2 = (newArea - oldArea) + inheritanceCost;
            }

            // Descend according to the minimum cost
            if (cost < cost1 && cost < cost2) {
                break;
            }

            // Descend
            current = cost1 < cost2 ? child1 : child2;
        }

        return current;
    }

    private balance(node: TreeNode<T>): TreeNode<T> {
        if (node.isLeaf()) {
            return node;
        }

        const balance = node.getBalance();

        // Rotate if imbalanced
        if (balance < -1) {
            return this.rotateLeft(node);
        } else if (balance > 1) {
            return this.rotateRight(node);
        }

        return node;
    }

    private rotateLeft(node: TreeNode<T>): TreeNode<T> {
        const child2 = node.children[1]!;
        const child2Child1 = child2.children[0]!;
        const child2Child2 = child2.children[1]!;

        // Swap
        child2.children[0] = node;
        child2.parent = node.parent;
        node.parent = child2;

        // Update parent
        if (child2.parent) {
            if (child2.parent.children[0] === node) {
                child2.parent.children[0] = child2;
            } else {
                child2.parent.children[1] = child2;
            }
        } else {
            this.root = child2;
        }

        // Rotate
        if (child2Child1.height > child2Child2.height) {
            child2.children[1] = child2Child1;
            node.children[1] = child2Child2;
            child2Child2.parent = node;
            node.updateAABB(this.margin);
            child2.updateAABB(this.margin);
            node.height = 1 + Math.max(node.children[0]!.height, node.children[1]!.height);
            child2.height = 1 + Math.max(node.height, child2Child1.height);
        } else {
            child2.children[1] = child2Child2;
            node.children[1] = child2Child1;
            child2Child1.parent = node;
            node.updateAABB(this.margin);
            child2.updateAABB(this.margin);
            node.height = 1 + Math.max(node.children[0]!.height, node.children[1]!.height);
            child2.height = 1 + Math.max(node.height, child2Child2.height);
        }

        return child2;
    }

    private rotateRight(node: TreeNode<T>): TreeNode<T> {
        const child1 = node.children[0]!;
        const child1Child1 = child1.children[0]!;
        const child1Child2 = child1.children[1]!;

        // Swap
        child1.children[1] = node;
        child1.parent = node.parent;
        node.parent = child1;

        // Update parent
        if (child1.parent) {
            if (child1.parent.children[0] === node) {
                child1.parent.children[0] = child1;
            } else {
                child1.parent.children[1] = child1;
            }
        } else {
            this.root = child1;
        }

        // Rotate
        if (child1Child1.height > child1Child2.height) {
            child1.children[0] = child1Child1;
            node.children[0] = child1Child2;
            child1Child2.parent = node;
            node.updateAABB(this.margin);
            child1.updateAABB(this.margin);
            node.height = 1 + Math.max(node.children[0]!.height, node.children[1]!.height);
            child1.height = 1 + Math.max(child1Child1.height, node.height);
        } else {
            child1.children[0] = child1Child2;
            node.children[0] = child1Child1;
            child1Child1.parent = node;
            node.updateAABB(this.margin);
            child1.updateAABB(this.margin);
            node.height = 1 + Math.max(node.children[0]!.height, node.children[1]!.height);
            child1.height = 1 + Math.max(child1Child2.height, node.height);
        }

        return child1;
    }

    retrieve(object: T): T[] {
        const result: T[] = [];
        if (!this.root) return result;

        const stack: TreeNode<T>[] = [this.root];

        while (stack.length > 0) {
            const node = stack.pop()!;

            if (this.aabbIntersects(node.aabb, object.AABB)) {
                if (node.isLeaf()) {
                    if (node.object && node.object !== object) {
                        result.push(node.object);
                    }
                } else {
                    if (node.children[0]) stack.push(node.children[0]);
                    if (node.children[1]) stack.push(node.children[1]);
                }
            }
        }

        return result;
    }

    draw(context: CanvasRenderingContext2D): void {
        if (!this.root) return;
        this.drawNode(context, this.root, 0);
    }

    private drawNode(context: CanvasRenderingContext2D, node: TreeNode<T>, depth: number): void {
        const { min, max } = node.aabb;
        
        // Different colors for different depths
        const colors = ['red', 'blue', 'green', 'orange', 'purple', 'brown'];
        context.strokeStyle = colors[depth % colors.length];
        context.lineWidth = Math.max(1, 3 - depth);

        context.beginPath();
        context.rect(min.x, min.y, max.x - min.x, max.y - min.y);
        context.stroke();

        if (!node.isLeaf()) {
            if (node.children[0]) this.drawNode(context, node.children[0], depth + 1);
            if (node.children[1]) this.drawNode(context, node.children[1], depth + 1);
        }
    }

    private getArea(aabb: AABB): number {
        return (aabb.max.x - aabb.min.x) * (aabb.max.y - aabb.min.y);
    }

    private combineAABB(aabb1: AABB, aabb2: AABB): AABB {
        return {
            min: {
                x: Math.min(aabb1.min.x, aabb2.min.x),
                y: Math.min(aabb1.min.y, aabb2.min.y)
            },
            max: {
                x: Math.max(aabb1.max.x, aabb2.max.x),
                y: Math.max(aabb1.max.y, aabb2.max.y)
            }
        };
    }

    private aabbIntersects(aabb1: AABB, aabb2: AABB): boolean {
        return !(aabb1.max.x < aabb2.min.x || 
                 aabb1.min.x > aabb2.max.x || 
                 aabb1.max.y < aabb2.min.y || 
                 aabb1.min.y > aabb2.max.y);
    }

    // Getter for tree statistics
    getStats(): { nodeCount: number, height: number } {
        return {
            nodeCount: this.nodeCount,
            height: this.root ? this.root.height : 0
        };
    }
}