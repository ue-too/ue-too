/**
 * Per-joint preferred-branch storage for switch junctions.
 *
 * Stores the user's last chosen next-joint at each switch, keyed by
 * (jointNumber, direction).  Used by `DefaultJointDirectionManager` to
 * remember and cycle through the available branches.
 *
 * @module trains/tracks/joint-direction-preference-map
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The travel direction through a joint: leaving along its tangent or its
 * reverse-tangent set.
 */
export type DirectionType = 'tangent' | 'reverseTangent';

/**
 * JSON-safe serialized form of preferences for a single joint.
 * Only the directions that have been explicitly stored are present.
 */
export type SerializedJointDirectionPreference = {
    joint: number;
    tangent?: number;
    reverseTangent?: number;
};

// ---------------------------------------------------------------------------
// Internal storage shape
// ---------------------------------------------------------------------------

type JointPreference = {
    tangent?: number;
    reverseTangent?: number;
};

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

/**
 * Stores the user's preferred next joint at switch junctions.
 *
 * @example
 * ```typescript
 * const prefs = new JointDirectionPreferenceMap();
 * prefs.set(1, 'tangent', 3);
 * prefs.get(1, 'tangent'); // 3
 * prefs.cycle(1, 'tangent', new Set([2, 3, 4])); // → 4 (next after 3)
 * ```
 */
export class JointDirectionPreferenceMap {
    private _map: Map<number, JointPreference> = new Map();

    // -----------------------------------------------------------------------
    // get / set
    // -----------------------------------------------------------------------

    /**
     * Returns the stored preferred next-joint number, or `undefined` if none
     * has been set for this (jointNumber, direction) pair.
     */
    get(jointNumber: number, direction: DirectionType): number | undefined {
        return this._map.get(jointNumber)?.[direction];
    }

    /**
     * Stores `nextJointNumber` as the preferred outgoing joint when leaving
     * `jointNumber` in the given `direction`.
     */
    set(
        jointNumber: number,
        direction: DirectionType,
        nextJointNumber: number
    ): void {
        let entry = this._map.get(jointNumber);
        if (entry === undefined) {
            entry = {};
            this._map.set(jointNumber, entry);
        }
        entry[direction] = nextJointNumber;
    }

    // -----------------------------------------------------------------------
    // clear
    // -----------------------------------------------------------------------

    /**
     * Clears preferences.
     *
     * @param jointNumber - If provided, only that joint's preferences are
     *   removed.  If omitted, all preferences are cleared.
     */
    clear(jointNumber?: number): void {
        if (jointNumber === undefined) {
            this._map.clear();
        } else {
            this._map.delete(jointNumber);
        }
    }

    // -----------------------------------------------------------------------
    // cycle
    // -----------------------------------------------------------------------

    /**
     * Advances the stored preference to the next joint in `availableJoints`
     * (in Set iteration order), wrapping around after the last entry.
     *
     * - If no preference is currently stored, the first joint in the set is
     *   chosen.
     * - If the stored preference is no longer in `availableJoints` (stale),
     *   the first joint is chosen.
     *
     * The chosen joint is persisted via {@link set} and returned.
     *
     * @param jointNumber - The switch joint.
     * @param direction - The travel direction through the joint.
     * @param availableJoints - The full set of reachable next joints.
     * @returns The newly selected next-joint number.
     */
    cycle(
        jointNumber: number,
        direction: DirectionType,
        availableJoints: Set<number>
    ): number {
        const joints = Array.from(availableJoints);
        const current = this.get(jointNumber, direction);

        let nextIndex: number;
        if (current === undefined || !availableJoints.has(current)) {
            nextIndex = 0;
        } else {
            const currentIndex = joints.indexOf(current);
            nextIndex = (currentIndex + 1) % joints.length;
        }

        const chosen = joints[nextIndex]!;
        this.set(jointNumber, direction, chosen);
        return chosen;
    }

    // -----------------------------------------------------------------------
    // serialize / deserialize
    // -----------------------------------------------------------------------

    /**
     * Returns a JSON-safe snapshot of all stored preferences.
     */
    serialize(): SerializedJointDirectionPreference[] {
        const result: SerializedJointDirectionPreference[] = [];
        for (const [joint, prefs] of this._map) {
            const entry: SerializedJointDirectionPreference = { joint };
            if (prefs.tangent !== undefined) {
                entry.tangent = prefs.tangent;
            }
            if (prefs.reverseTangent !== undefined) {
                entry.reverseTangent = prefs.reverseTangent;
            }
            result.push(entry);
        }
        return result;
    }

    /**
     * Reconstructs a {@link JointDirectionPreferenceMap} from serialized data
     * produced by {@link serialize}.
     */
    static deserialize(
        data: SerializedJointDirectionPreference[]
    ): JointDirectionPreferenceMap {
        const instance = new JointDirectionPreferenceMap();
        for (const entry of data) {
            if (entry.tangent !== undefined) {
                instance.set(entry.joint, 'tangent', entry.tangent);
            }
            if (entry.reverseTangent !== undefined) {
                instance.set(
                    entry.joint,
                    'reverseTangent',
                    entry.reverseTangent
                );
            }
        }
        return instance;
    }
}
