/**
 * Collision filtering configuration for rigid bodies.
 *
 * @remarks
 * Collision filters use a bitmask system to control which bodies can collide
 * with each other. This is useful for creating layers, groups, and special
 * collision rules in your physics simulation.
 *
 * ### How Filtering Works
 *
 * Two bodies A and B can collide if ALL of these conditions are met:
 * 1. `(A.category & B.mask) !== 0` - A's category matches B's mask
 * 2. `(B.category & A.mask) !== 0` - B's category matches A's mask
 * 3. Group rules are satisfied (see group field)
 *
 * @category Types
 */
export interface CollisionFilter {
    /**
     * What category this body belongs to (bitmask).
     *
     * @example
     * ```typescript
     * category: CollisionCategory.PLAYER  // 0x0004
     * ```
     */
    category: number;

    /**
     * What categories this body can collide with (bitmask).
     *
     * @example
     * ```typescript
     * // Collide with everything except other players
     * mask: ~CollisionCategory.PLAYER & 0xFFFF
     * ```
     */
    mask: number;

    /**
     * Collision group for special rules.
     * - 0: No group (use category/mask rules)
     * - Positive: Bodies in same group ALWAYS collide
     * - Negative: Bodies in same group NEVER collide
     *
     * @example
     * ```typescript
     * // Ragdoll parts shouldn't collide with each other
     * group: -1
     *
     * // Team members always collide (for physics interactions)
     * group: 1
     * ```
     */
    group: number;
}

/**
 * Default collision filter that collides with everything.
 *
 * @remarks
 * Uses category 0x0001 and mask 0xFFFF, meaning it belongs to the first
 * category and can collide with all 16 categories.
 *
 * @category Collision
 */
export const DEFAULT_COLLISION_FILTER: CollisionFilter = {
    category: 0x0001,
    mask: 0xFFFF,
    group: 0
};

/**
 * Determines if two bodies can collide based on their collision filters.
 *
 * @remarks
 * Checks group rules first, then falls back to category/mask matching.
 * This is used internally by the physics engine during broad phase collision detection.
 *
 * @param filterA - Collision filter of first body
 * @param filterB - Collision filter of second body
 * @returns True if the bodies should collide
 *
 * @example
 * ```typescript
 * const player: CollisionFilter = {
 *   category: CollisionCategory.PLAYER,
 *   mask: 0xFFFF,
 *   group: 0
 * };
 *
 * const enemy: CollisionFilter = {
 *   category: CollisionCategory.ENEMY,
 *   mask: CollisionCategory.PLAYER | CollisionCategory.STATIC,
 *   group: 0
 * };
 *
 * console.log(canCollide(player, enemy)); // true
 * ```
 *
 * @category Collision
 */
export function canCollide(filterA: CollisionFilter, filterB: CollisionFilter): boolean {
    // If objects are in the same group
    if (filterA.group !== 0 && filterA.group === filterB.group) {
        return filterA.group > 0; // Positive groups collide, negative groups don't
    }

    // Check category-mask pairs
    return (filterA.category & filterB.mask) !== 0 && (filterB.category & filterA.mask) !== 0;
}

/**
 * Predefined collision categories for common game entities.
 *
 * @remarks
 * These are bitmask constants (powers of 2) that can be combined using bitwise OR.
 * You can define up to 16 categories using values from 0x0001 to 0x8000.
 *
 * @example
 * Using predefined categories
 * ```typescript
 * // Player collides with everything except other players
 * player.collisionFilter = {
 *   category: CollisionCategory.PLAYER,
 *   mask: ~CollisionCategory.PLAYER & 0xFFFF,
 *   group: 0
 * };
 *
 * // Projectile only collides with enemies and static objects
 * projectile.collisionFilter = {
 *   category: CollisionCategory.PROJECTILE,
 *   mask: CollisionCategory.ENEMY | CollisionCategory.STATIC,
 *   group: 0
 * };
 * ```
 *
 * @category Collision
 */
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