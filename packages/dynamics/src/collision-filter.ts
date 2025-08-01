export interface CollisionFilter {
    category: number;    // What category this body belongs to
    mask: number;        // What categories this body can collide with
    group: number;       // Collision group (negative = never collide, positive = always collide if same group)
}

export const DEFAULT_COLLISION_FILTER: CollisionFilter = {
    category: 0x0001,
    mask: 0xFFFF, 
    group: 0
};

export function canCollide(filterA: CollisionFilter, filterB: CollisionFilter): boolean {
    // If objects are in the same group
    if (filterA.group !== 0 && filterA.group === filterB.group) {
        return filterA.group > 0; // Positive groups collide, negative groups don't
    }

    // Check category-mask pairs
    return (filterA.category & filterB.mask) !== 0 && (filterB.category & filterA.mask) !== 0;
}

// Common collision categories for games
export const CollisionCategory = {
    STATIC: 0x0001,      // Walls, floors, static objects
    DYNAMIC: 0x0002,     // Moving objects  
    PLAYER: 0x0004,      // Player character
    ENEMY: 0x0008,       // Enemy entities
    PROJECTILE: 0x0010,  // Bullets, projectiles
    SENSOR: 0x0020,      // Trigger zones, sensors
    PICKUP: 0x0040,      // Items that can be collected
    PLATFORM: 0x0080,    // One-way platforms
} as const;