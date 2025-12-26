import { RigidBody } from "./rigidbody";
import { Point } from "@ue-too/math";

/**
 * Represents a collision pair between two bodies.
 *
 * @remarks
 * Tracks collision information across multiple frames, enabling
 * detection of collision start, update, and end events.
 *
 * @category Collision
 */
export interface CollisionPair {
    bodyA: RigidBody;
    bodyB: RigidBody;
    id: string;
    isActive: boolean;
    contactPoints: Point[];
    normal?: Point;
    depth?: number;
    frameCreated: number;
    frameUpdated: number;
}

export interface PairEvents {
    created: CollisionPair[];
    updated: CollisionPair[];
    removed: CollisionPair[];
}

/**
 * Manages collision pairs across frames.
 *
 * @remarks
 * Tracks which bodies are colliding and for how long, enabling
 * collision lifecycle events (start, update, end). This is useful for
 * game logic like damage on collision start or triggers.
 *
 * Automatically cleans up old inactive pairs to prevent memory leaks.
 *
 * @example
 * Using collision events
 * ```typescript
 * const pairManager = world.getPairManager();
 *
 * world.step(dt);
 *
 * const events = pairManager.getActivePairs();
 * events.forEach(pair => {
 *   if (pair.frameCreated === world.currentFrame) {
 *     console.log('Collision started!');
 *   }
 * });
 * ```
 *
 * @category Collision
 */
export class PairManager {
    private pairs = new Map<string, CollisionPair>();
    private frameNumber = 0;
    private maxPairAge = 10; // Remove inactive pairs after N frames

    constructor() {}

    // Generate unique ID for a pair
    private getPairId(bodyA: RigidBody, bodyB: RigidBody): string {
        const idA = this.getBodyId(bodyA);
        const idB = this.getBodyId(bodyB);
        // Ensure consistent ordering
        return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
    }

    private getBodyId(body: RigidBody): string {
        // Use object reference as unique ID
        return body.toString();
    }

    // Update pairs for current frame
    updatePairs(newCollisions: {bodyA: RigidBody, bodyB: RigidBody, contactPoints?: Point[], normal?: Point, depth?: number}[]): PairEvents {
        this.frameNumber++;
        
        const events: PairEvents = {
            created: [],
            updated: [],
            removed: []
        };

        // Mark all existing pairs as inactive for this frame
        this.pairs.forEach(pair => {
            pair.isActive = false;
        });

        // Process new collisions
        for (const collision of newCollisions) {
            const id = this.getPairId(collision.bodyA, collision.bodyB);
            const existingPair = this.pairs.get(id);

            if (existingPair) {
                // Update existing pair
                existingPair.isActive = true;
                existingPair.frameUpdated = this.frameNumber;
                existingPair.contactPoints = collision.contactPoints || [];
                existingPair.normal = collision.normal;
                existingPair.depth = collision.depth;
                events.updated.push(existingPair);
            } else {
                // Create new pair
                const newPair: CollisionPair = {
                    bodyA: collision.bodyA,
                    bodyB: collision.bodyB,
                    id,
                    isActive: true,
                    contactPoints: collision.contactPoints || [],
                    normal: collision.normal,
                    depth: collision.depth,
                    frameCreated: this.frameNumber,
                    frameUpdated: this.frameNumber
                };
                this.pairs.set(id, newPair);
                events.created.push(newPair);
            }
        }

        // Remove old inactive pairs
        const pairsToRemove: string[] = [];
        this.pairs.forEach((pair, id) => {
            if (!pair.isActive && (this.frameNumber - pair.frameUpdated) > this.maxPairAge) {
                pairsToRemove.push(id);
                events.removed.push(pair);
            }
        });

        pairsToRemove.forEach(id => {
            this.pairs.delete(id);
        });

        return events;
    }

    // Get all active pairs
    getActivePairs(): CollisionPair[] {
        return Array.from(this.pairs.values()).filter(pair => pair.isActive);
    }

    // Get pair by bodies
    getPair(bodyA: RigidBody, bodyB: RigidBody): CollisionPair | undefined {
        const id = this.getPairId(bodyA, bodyB);
        return this.pairs.get(id);
    }

    // Clear all pairs
    clear(): void {
        this.pairs.clear();
        this.frameNumber = 0;
    }

    // Get statistics
    getStats() {
        return {
            totalPairs: this.pairs.size,
            activePairs: this.getActivePairs().length,
            frameNumber: this.frameNumber
        };
    }
}